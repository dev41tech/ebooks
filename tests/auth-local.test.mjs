import assert from 'node:assert/strict';
import {before,beforeEach,after,test} from 'node:test';
import {mkdir,rm} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {build} from 'esbuild';

// Autenticação local substituindo o Supabase Auth. Este app já levou um furo
// grave por uma suposição caseira de autenticação (um header forjável dava
// admin), então o que está testado aqui não é o caminho feliz: é o que acontece
// quando alguém erra a senha, quando um token expira, quando a senha é trocada
// com sessão aberta, e o que sobra gravado no banco.

const root=path.resolve(import.meta.dirname,'..');
const output=path.join(root,'tests','.generated-auth');
const users=new Map(),sessions=new Map();
let auth;

const hashOf=token=>createHash('sha256').update(token).digest('hex');

before(async()=>{
 await mkdir(output,{recursive:true});
 globalThis.__authTestDb={
  prepare(query){
   return {bind(...v){
    return {
   async first(){
    if(query.includes('FROM auth_users WHERE email=?'))return users.get(v[0])??null;
    if(query.includes('WHERE s.access_hash=?')){
     const s=[...sessions.values()].find(x=>x.access_hash===v[0]);
     if(!s)return null;
     return {user_email:s.user_email,access_expires_at:s.access_expires_at,display_name:users.get(s.user_email)?.display_name||''};
    }
    if(query.includes('FROM auth_sessions WHERE refresh_hash=?')){
     const s=[...sessions.values()].find(x=>x.refresh_hash===v[0]);
     return s?{id:s.id,user_email:s.user_email,refresh_expires_at:s.refresh_expires_at}:null;
    }
    return null;
   },
   async run(){
    if(query.startsWith('INSERT INTO auth_users'))users.set(v[0],{email:v[0],display_name:v[1],password_hash:v[2]});
    else if(query.startsWith('UPDATE auth_users SET password_hash'))users.get(v[2]).password_hash=v[0];
    else if(query.startsWith('INSERT INTO auth_sessions'))sessions.set(v[0],{id:v[0],user_email:v[1],access_hash:v[2],refresh_hash:v[3],access_expires_at:v[4],refresh_expires_at:v[5]});
    else if(query.startsWith('UPDATE auth_sessions SET access_hash'))Object.assign(sessions.get(v[4]),{access_hash:v[0],refresh_hash:v[1],access_expires_at:v[2],refresh_expires_at:v[3]});
    else if(query.startsWith('DELETE FROM auth_sessions WHERE id=?'))sessions.delete(v[0]);
    else if(query.startsWith('DELETE FROM auth_sessions WHERE access_hash=?')){for(const [k,s] of sessions){if(s.access_hash===v[0])sessions.delete(k);}}
    else if(query.startsWith('DELETE FROM auth_sessions WHERE refresh_hash=?')){for(const [k,s] of sessions){if(s.refresh_hash===v[0])sessions.delete(k);}}
    else if(query.startsWith('DELETE FROM auth_sessions WHERE user_email=?')){for(const [k,s] of sessions){if(s.user_email===v[0])sessions.delete(k);}}
    else if(query.includes('refresh_expires_at<=?')){for(const [k,s] of sessions){if(s.refresh_expires_at<=v[0])sessions.delete(k);}}
    return {results:[],meta:{changes:0}};
   },
    };
   }};
  },
 };
 await build({entryPoints:{auth:path.join(root,'app/lib/auth-local.ts')},outdir:output,outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm',packages:'external',plugins:[{name:'only-test-db',setup(b){
  b.onResolve({filter:/sql$/},()=>({path:'test-db',namespace:'test'}));
  b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export const database=globalThis.__authTestDb;'}));
 }}]});
 auth=await import(pathToFileURL(path.join(output,'auth.mjs')));
});

beforeEach(()=>{users.clear();sessions.clear();});
after(async()=>{delete globalThis.__authTestDb;await rm(output,{recursive:true,force:true});});

test('senha volta a validar, e a errada não',async()=>{
 const hash=await auth.hashPassword('senha-de-teste-1');
 assert.equal(await auth.verifyPassword('senha-de-teste-1',hash),true);
 assert.equal(await auth.verifyPassword('senha-de-teste-2',hash),false);
});

test('o hash carrega os parâmetros e nunca a senha',async()=>{
 const hash=await auth.hashPassword('senha-de-teste-1');
 assert.match(hash,/^scrypt\$\d+\$\d+\$\d+\$[^$]+\$[^$]+$/);
 assert.ok(!hash.includes('senha-de-teste-1'));
});

test('a mesma senha gera hashes diferentes',async()=>{
 // Sem sal, dois usuários com a mesma senha teriam o mesmo hash — e quebrar um
 // quebraria os dois.
 assert.notEqual(await auth.hashPassword('igual-igual-1'),await auth.hashPassword('igual-igual-1'));
});

test('hash corrompido é rejeitado em vez de estourar',async()=>{
 for(const ruim of ['','x','scrypt$1$2$3','bcrypt$a$b$c$d$e','scrypt$N$r$p$!!!$!!!'])
  assert.equal(await auth.verifyPassword('qualquer-senha',ruim),false,'aceitou '+JSON.stringify(ruim));
});

test('cria conta e autentica',async()=>{
 await auth.createUser('Marcos@Exemplo.com ','senha-de-teste-1','Marcos Dias');
 const user=await auth.authenticate('marcos@exemplo.com','senha-de-teste-1');
 assert.equal(user.email,'marcos@exemplo.com','e-mail normalizado');
 assert.equal(user.displayName,'Marcos Dias');
});

test('e-mail desconhecido e senha errada devolvem o MESMO erro',async()=>{
 // Distinguir os dois entrega ao atacante a lista de quem tem conta.
 await auth.createUser('a@exemplo.com','senha-de-teste-1');
 const erros=[];
 for(const [email,senha] of [['a@exemplo.com','senha-errada-9'],['naoexiste@exemplo.com','senha-de-teste-1']]){
  await auth.authenticate(email,senha).catch(e=>erros.push({code:e.code,status:e.status}));
 }
 assert.equal(erros.length,2);
 assert.deepEqual(erros[0],erros[1]);
 assert.equal(erros[0].code,'invalid_credentials');
});

test('e-mail duplicado e senha curta são recusados',async()=>{
 await auth.createUser('a@exemplo.com','senha-de-teste-1');
 await assert.rejects(()=>auth.createUser('A@Exemplo.com','outra-senha-1'),/email_already_registered/);
 await assert.rejects(()=>auth.createUser('b@exemplo.com','curta'),/invalid_credentials_format/);
 await assert.rejects(()=>auth.createUser('sem-arroba','senha-de-teste-1'),/invalid_credentials_format/);
});

test('a sessão resolve o usuário pelo access token',async()=>{
 await auth.createUser('a@exemplo.com','senha-de-teste-1','Ana');
 const {accessToken}=await auth.createSession('a@exemplo.com');
 assert.equal((await auth.userForAccessToken(accessToken)).displayName,'Ana');
 assert.equal(await auth.userForAccessToken('token-inventado'),null);
 assert.equal(await auth.userForAccessToken(''),null);
});

test('o banco guarda o hash do token, nunca o token',async()=>{
 // Vazamento de banco não pode virar sessão válida.
 await auth.createUser('a@exemplo.com','senha-de-teste-1');
 const {accessToken,refreshToken}=await auth.createSession('a@exemplo.com');
 const gravada=[...sessions.values()][0];
 assert.ok(!Object.values(gravada).includes(accessToken));
 assert.ok(!Object.values(gravada).includes(refreshToken));
 assert.equal(gravada.access_hash,hashOf(accessToken));
});

test('access token vencido deixa de valer',async()=>{
 await auth.createUser('a@exemplo.com','senha-de-teste-1');
 const {accessToken}=await auth.createSession('a@exemplo.com');
 [...sessions.values()][0].access_expires_at=new Date(Date.now()-1000).toISOString();
 assert.equal(await auth.userForAccessToken(accessToken),null);
});

test('renovar rotaciona os dois tokens e invalida os antigos',async()=>{
 await auth.createUser('a@exemplo.com','senha-de-teste-1');
 const antiga=await auth.createSession('a@exemplo.com');
 const nova=await auth.rotateSession(antiga.refreshToken);
 assert.notEqual(nova.accessToken,antiga.accessToken);
 assert.notEqual(nova.refreshToken,antiga.refreshToken);
 assert.equal(await auth.userForAccessToken(antiga.accessToken),null,'o access antigo continuou valendo');
 assert.ok(await auth.userForAccessToken(nova.accessToken));
 await assert.rejects(()=>auth.rotateSession(antiga.refreshToken),/session_not_found/);
});

test('refresh vencido é apagado e recusado',async()=>{
 await auth.createUser('a@exemplo.com','senha-de-teste-1');
 const s=await auth.createSession('a@exemplo.com');
 [...sessions.values()][0].refresh_expires_at=new Date(Date.now()-1000).toISOString();
 await assert.rejects(()=>auth.rotateSession(s.refreshToken),/session_expired/);
 assert.equal(sessions.size,0,'sessão vencida deveria sair do banco');
});

test('logout apaga a sessão no servidor',async()=>{
 await auth.createUser('a@exemplo.com','senha-de-teste-1');
 const s=await auth.createSession('a@exemplo.com');
 await auth.revokeSession(s.accessToken,s.refreshToken);
 assert.equal(await auth.userForAccessToken(s.accessToken),null);
 assert.equal(sessions.size,0);
});

test('trocar a senha derruba as sessões abertas',async()=>{
 // O caso que isto cobre é o pior: senha trocada porque vazou, com a sessão do
 // invasor ainda viva.
 await auth.createUser('a@exemplo.com','senha-de-teste-1');
 const s1=await auth.createSession('a@exemplo.com');
 const s2=await auth.createSession('a@exemplo.com');
 await auth.setPassword('a@exemplo.com','senha-de-teste-2');
 assert.equal(await auth.userForAccessToken(s1.accessToken),null);
 assert.equal(await auth.userForAccessToken(s2.accessToken),null);
 assert.ok(await auth.authenticate('a@exemplo.com','senha-de-teste-2'));
 await assert.rejects(()=>auth.authenticate('a@exemplo.com','senha-de-teste-1'),/invalid_credentials/);
});

test('purga remove só o que já venceu',async()=>{
 await auth.createUser('a@exemplo.com','senha-de-teste-1');
 await auth.createSession('a@exemplo.com');
 const viva=await auth.createSession('a@exemplo.com');
 [...sessions.values()][0].refresh_expires_at=new Date(Date.now()-1000).toISOString();
 await auth.purgeExpiredSessions();
 assert.equal(sessions.size,1);
 assert.ok(await auth.userForAccessToken(viva.accessToken));
});
