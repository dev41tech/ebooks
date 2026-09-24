/**
 * Autenticação local: senha no Postgres, sessão no Postgres.
 *
 * Substitui o Supabase Auth, cujo projeto deixou de existir. A AUTORIZAÇÃO não
 * muda — quem é admin continua saindo de SAMBU_ADMIN_EMAILS, da senha master e
 * de app/lib/policy.ts. Aqui só se resolve "quem é esta pessoa".
 *
 * Duas decisões que valem explicar, porque este app já levou um furo de
 * autenticação (um header forjável dava admin a qualquer um):
 *
 * 1. **Sessão no banco, não JWT auto-contido.** Um token assinado só expira;
 *    não dá para cancelar. Com a sessão numa linha, logout e troca de senha
 *    revogam de verdade, e dá para derrubar tudo de um usuário.
 * 2. **Só o hash do token é guardado.** Um vazamento do banco não entrega
 *    sessão válida, pela mesma razão de não guardar senha em claro.
 *
 * O hash de senha usa scrypt do `node:crypto`. É proposital não trazer bcrypt
 * ou argon2: dependência nativa nova neste projeto já custou caro antes
 * (`better-sqlite3` sem binário para Node 24 no Windows), e scrypt é adequado
 * para senha — memória-dura e parametrizável.
 */
import {randomBytes, randomUUID, scrypt, timingSafeEqual, createHash} from 'node:crypto';
import {promisify} from 'node:util';
import {database} from '../../db/sql';

const scryptAsync=promisify(scrypt) as (secret:string,salt:Buffer,keylen:number,options:{N:number;r:number;p:number;maxmem:number})=>Promise<Buffer>;

// Custo do scrypt. N=2^15 leva ~100ms num contêiner modesto: caro o bastante
// para forca bruta, barato o bastante para um login não parecer travado.
const COST={N:32768,r:8,p:1};
const KEYLEN=32;
const MAXMEM=64*1024*1024;

export const ACCESS_TTL_SECONDS=60*60;            // 1 hora
export const REFRESH_TTL_SECONDS=60*60*24*30;     // 30 dias

export const MIN_PASSWORD_LENGTH=8;

export type LocalUser={id:string;email:string;displayName:string};

export class AuthLocalError extends Error{
 constructor(public code:string,public status:number){super(code);}
}

function nowIso(){return new Date().toISOString();}
function isoIn(seconds:number){return new Date(Date.now()+seconds*1000).toISOString();}

/** Token opaco de 32 bytes. Só o portador prova posse; o banco guarda o hash. */
function newToken(){return randomBytes(32).toString('base64url');}
function tokenHash(token:string){return createHash('sha256').update(token).digest('hex');}

export async function hashPassword(password:string){
 const salt=randomBytes(16);
 const derived=await scryptAsync(password,salt,KEYLEN,{...COST,maxmem:MAXMEM});
 return ['scrypt',COST.N,COST.r,COST.p,salt.toString('base64'),derived.toString('base64')].join('$');
}

export async function verifyPassword(password:string,stored:string){
 const parts=stored.split('$');
 if(parts.length!==6||parts[0]!=='scrypt')return false;
 const [,n,r,p,saltB64,hashB64]=parts;
 const salt=Buffer.from(saltB64,'base64');
 const expected=Buffer.from(hashB64,'base64');
 let derived:Buffer;
 try{
  derived=await scryptAsync(password,salt,expected.length,{N:Number(n),r:Number(r),p:Number(p),maxmem:MAXMEM});
 }catch{return false;}
 // Comparação em tempo constante: um `===` vaza, pelo tempo, quantos bytes
 // iniciais bateram.
 return derived.length===expected.length&&timingSafeEqual(derived,expected);
}

function normalizeEmail(email:string){return String(email||'').trim().toLowerCase();}

export async function findUser(email:string){
 return database.prepare('SELECT email,display_name,password_hash FROM auth_users WHERE email=?')
  .bind(normalizeEmail(email))
  .first<{email:string;display_name:string;password_hash:string}>();
}

export async function createUser(email:string,password:string,displayName=''){
 const normalized=normalizeEmail(email);
 if(!normalized.includes('@'))throw new AuthLocalError('invalid_credentials_format',400);
 if(password.length<MIN_PASSWORD_LENGTH)throw new AuthLocalError('invalid_credentials_format',400);
 if(await findUser(normalized))throw new AuthLocalError('email_already_registered',409);
 const at=nowIso();
 await database.prepare('INSERT INTO auth_users(email,display_name,password_hash,created_at,updated_at) VALUES(?,?,?,?,?)')
  .bind(normalized,String(displayName||'').trim().slice(0,120),await hashPassword(password),at,at).run();
 return toUser(normalized,displayName);
}

export async function setPassword(email:string,password:string){
 if(password.length<MIN_PASSWORD_LENGTH)throw new AuthLocalError('invalid_credentials_format',400);
 const normalized=normalizeEmail(email);
 if(!await findUser(normalized))throw new AuthLocalError('user_not_found',404);
 await database.prepare('UPDATE auth_users SET password_hash=?,updated_at=? WHERE email=?')
  .bind(await hashPassword(password),nowIso(),normalized).run();
 // Trocar a senha derruba as sessões abertas. O caso que isso cobre é o pior:
 // senha trocada porque vazou, com a sessão do invasor ainda viva.
 await revokeAllSessions(normalized);
}

function toUser(email:string,displayName?:string):LocalUser{
 const normalized=normalizeEmail(email);
 return {id:normalized,email:normalized,displayName:String(displayName||'').trim()||normalized};
}

export async function authenticate(email:string,password:string):Promise<LocalUser>{
 const row=await findUser(email);
 // Mesma resposta para e-mail inexistente e senha errada: distinguir os dois
 // entrega ao atacante a lista de quem tem conta.
 if(!row||!await verifyPassword(password,row.password_hash))throw new AuthLocalError('invalid_credentials',401);
 return toUser(row.email,row.display_name);
}

export async function createSession(email:string){
 const accessToken=newToken(),refreshToken=newToken();
 await database.prepare('INSERT INTO auth_sessions(id,user_email,access_hash,refresh_hash,access_expires_at,refresh_expires_at,created_at) VALUES(?,?,?,?,?,?,?)')
  .bind(randomUUID(),normalizeEmail(email),tokenHash(accessToken),tokenHash(refreshToken),isoIn(ACCESS_TTL_SECONDS),isoIn(REFRESH_TTL_SECONDS),nowIso()).run();
 return {accessToken,refreshToken,expiresIn:ACCESS_TTL_SECONDS};
}

export async function userForAccessToken(token:string):Promise<LocalUser|null>{
 if(!token)return null;
 const row=await database.prepare('SELECT s.user_email,s.access_expires_at,u.display_name FROM auth_sessions s JOIN auth_users u ON u.email=s.user_email WHERE s.access_hash=?')
  .bind(tokenHash(token))
  .first<{user_email:string;access_expires_at:string;display_name:string}>();
 if(!row||row.access_expires_at<=nowIso())return null;
 return toUser(row.user_email,row.display_name);
}

/**
 * Renova a sessão rotacionando os dois tokens. Rotacionar em vez de reemitir só
 * o access token limita a janela de um refresh token roubado.
 */
export async function rotateSession(refreshToken:string){
 if(!refreshToken)throw new AuthLocalError('no_session',401);
 const row=await database.prepare('SELECT id,user_email,refresh_expires_at FROM auth_sessions WHERE refresh_hash=?')
  .bind(tokenHash(refreshToken))
  .first<{id:string;user_email:string;refresh_expires_at:string}>();
 if(!row)throw new AuthLocalError('session_not_found',401);
 if(row.refresh_expires_at<=nowIso()){
  await database.prepare('DELETE FROM auth_sessions WHERE id=?').bind(row.id).run();
  throw new AuthLocalError('session_expired',401);
 }
 const accessToken=newToken(),nextRefresh=newToken();
 await database.prepare('UPDATE auth_sessions SET access_hash=?,refresh_hash=?,access_expires_at=?,refresh_expires_at=? WHERE id=?')
  .bind(tokenHash(accessToken),tokenHash(nextRefresh),isoIn(ACCESS_TTL_SECONDS),isoIn(REFRESH_TTL_SECONDS),row.id).run();
 return {accessToken,refreshToken:nextRefresh,expiresIn:ACCESS_TTL_SECONDS,email:row.user_email};
}

export async function revokeSession(accessToken:string|undefined,refreshToken:string|undefined){
 for(const [column,token] of [['access_hash',accessToken],['refresh_hash',refreshToken]] as const){
  if(token)await database.prepare('DELETE FROM auth_sessions WHERE '+column+'=?').bind(tokenHash(token)).run();
 }
}

export async function revokeAllSessions(email:string){
 await database.prepare('DELETE FROM auth_sessions WHERE user_email=?').bind(normalizeEmail(email)).run();
}

/** Higiene: sessão vencida não precisa ficar no banco. */
export async function purgeExpiredSessions(){
 await database.prepare('DELETE FROM auth_sessions WHERE refresh_expires_at<=?').bind(nowIso()).run();
}
