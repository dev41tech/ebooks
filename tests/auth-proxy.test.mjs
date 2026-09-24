import assert from 'node:assert/strict';
import {before, beforeEach, after, test} from 'node:test';
import {readFile, mkdir, rm} from 'node:fs/promises';
import {Readable} from 'node:stream';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';

// Rota /api/auth atrás do proxy do Easypanel.
//
// Este arquivo cobria o transporte para o Supabase Auth. Esse transporte saiu:
// o projeto Supabase deixou de existir e a autenticação passou a ser local
// (app/lib/auth-local.ts, coberto por tests/auth-local.test.mjs). O que continua
// valendo, e continua testado aqui, é o que nunca dependeu do provedor -- a
// proteção de origem atrás do proxy, o formato das respostas e o comportamento
// dos cookies, que é onde um erro vira sessão indevida ou logout em massa.

const root=path.resolve(import.meta.dirname,'..');
const output=path.join(root,'tests','.generated-auth-route');
const publicHost='ebooks.41tech.cloud';
const publicOrigin=`https://${publicHost}`;
const originalEnv={...process.env};
const users=new Map(),sessions=new Map();
let POST, nodeToWebRequest;

const SENHA='Only-for-isolated-tests';
const hashOf=token=>createHash('sha256').update(token).digest('hex');

before(async()=>{
 // Usa a configuração de proxy que vai no Docker de verdade, não uma inventada.
 const dockerfile=await readFile(path.join(root,'Dockerfile'),'utf8');
 const hosts=dockerfile.match(/VINEXT_TRUSTED_HOSTS=([^\s]+)/)?.[1];
 assert.equal(hosts,publicHost);
 process.env.VINEXT_TRUSTED_HOSTS=hosts;
 delete process.env.VINEXT_TRUST_PROXY;
 globalThis.__authTestCookies=[];
 globalThis.__authRouteDb={
  prepare(query){
   return {bind(...v){
    return {
     async first(){
      if(query.includes('FROM auth_users WHERE email=?'))return users.get(v[0])??null;
      if(query.includes('WHERE s.access_hash=?')){
       const s=[...sessions.values()].find(x=>x.access_hash===v[0]);
       return s?{user_email:s.user_email,access_expires_at:s.access_expires_at,display_name:''}:null;
      }
      if(query.includes('FROM auth_sessions WHERE refresh_hash=?')){
       const s=[...sessions.values()].find(x=>x.refresh_hash===v[0]);
       return s?{id:s.id,user_email:s.user_email,refresh_expires_at:s.refresh_expires_at}:null;
      }
      return null;
     },
     async run(){
      if(query.startsWith('INSERT INTO auth_users'))users.set(v[0],{email:v[0],display_name:v[1],password_hash:v[2]});
      else if(query.startsWith('INSERT INTO auth_sessions'))sessions.set(v[0],{id:v[0],user_email:v[1],access_hash:v[2],refresh_hash:v[3],access_expires_at:v[4],refresh_expires_at:v[5]});
      else if(query.startsWith('UPDATE auth_sessions SET access_hash')){Object.assign(sessions.get(v[4]),{access_hash:v[0],refresh_hash:v[1],access_expires_at:v[2],refresh_expires_at:v[3]});}
      else if(query.startsWith('DELETE FROM auth_sessions WHERE id=?')){sessions.delete(v[0]);}
      else if(query.startsWith('DELETE FROM auth_sessions WHERE access_hash=?')){for(const [k,s] of sessions){if(s.access_hash===v[0])sessions.delete(k);}}
      else if(query.startsWith('DELETE FROM auth_sessions WHERE refresh_hash=?')){for(const [k,s] of sessions){if(s.refresh_hash===v[0])sessions.delete(k);}}
      return {results:[],meta:{changes:0}};
     },
    };
   }};
  },
 };
 ({nodeToWebRequest}=await import('../node_modules/vinext/dist/server/prod-server.js'));
 await mkdir(output,{recursive:true});
 await build({
  entryPoints:{auth:path.join(root,'app/api/auth/route.ts')},
  outdir:output,outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm',packages:'external',
  plugins:[{name:'isolated',setup(b){
   b.onResolve({filter:/^next\/(headers|navigation)$/},args=>({path:args.path,namespace:'test-next'}));
   b.onResolve({filter:/db\/sql$/},()=>({path:'test-db',namespace:'test-next'}));
   b.onLoad({filter:/.*/,namespace:'test-next'},args=>({contents:args.path==='test-db'
    ?'export const database=globalThis.__authRouteDb;'
    :'export async function cookies(){return new Map(globalThis.__authTestCookies || []);} export function redirect(){throw new Error("unexpected_redirect");}'}));
  }}],
 });
 ({POST}=await import(pathToFileURL(path.join(output,'auth.mjs'))));
});

beforeEach(()=>{
 users.clear();sessions.clear();
 globalThis.__authTestCookies=[];
 delete process.env.SAMBU_TEMPORARY_PUBLIC_ADMIN;
 delete process.env.SAMBU_TEMPORARY_PUBLIC_ADMIN_UNTIL;
});

after(async()=>{
 for(const key of ['VINEXT_TRUSTED_HOSTS','VINEXT_TRUST_PROXY','SAMBU_TEMPORARY_PUBLIC_ADMIN','SAMBU_TEMPORARY_PUBLIC_ADMIN_UNTIL']){
  if(originalEnv[key]===undefined)delete process.env[key];else process.env[key]=originalEnv[key];
 }
 delete globalThis.__authRouteDb;delete globalThis.__authTestCookies;
 await rm(output,{recursive:true,force:true});
});

function proxied(body={},overrides={}){
 const incoming=Readable.from([Buffer.from(JSON.stringify(body))]);
 incoming.method='POST';incoming.url='/api/auth';
 incoming.headers={host:'app_ebooks:3000','content-type':'application/json',origin:publicOrigin,
  'x-forwarded-host':publicHost,'x-forwarded-proto':'https',...overrides};
 return nodeToWebRequest(incoming);
}
const cookiesOf=response=>response.headers.getSetCookie?.()??[];
const criar=(over={})=>({action:'signup',email:'reader@example.test',password:SENHA,displayName:'Leitora',...over});

// --- proteção de origem atrás do proxy (nunca dependeu do provedor) ---------

test('origem HTTPS do Easypanel chega na validação através do serviço HTTP interno',async()=>{
 const request=proxied();
 assert.equal(request.url,`${publicOrigin}/api/auth`,'o proxy precisa reconstruir a origem pública');
 const response=await POST(request);
 assert.equal(response.status,400);
 assert.equal((await response.json()).error,'invalid_credentials_format');
});

test('origem de terceiro e host encaminhado forjado continuam bloqueados antes da autenticação',async()=>{
 for(const overrides of [{origin:'https://atacante.example'},{origin:'https://atacante.example','x-forwarded-host':'atacante.example'}]){
  const response=await POST(proxied(criar(),overrides));
  assert.equal(response.status,403);
  assert.equal((await response.json()).error,'invalid_origin');
  assert.equal(users.size,0,'nenhuma conta pode nascer de uma origem recusada');
 }
});

test('payload e ação inválidos são recusados',async()=>{
 for(const body of [[],'texto',{action:'apagar-tudo'}]){
  const response=await POST(proxied(body));
  assert.equal(response.status,400);
  assert.equal((await response.json()).error,'invalid_payload');
 }
});

// --- sessão ----------------------------------------------------------------

test('cadastro cria a sessão com cookies HttpOnly, Secure e SameSite',async()=>{
 const response=await POST(proxied(criar()));
 assert.equal(response.status,201);
 assert.deepEqual(await response.json(),{ok:true});
 const cookies=cookiesOf(response);
 assert.equal(cookies.length,2);
 for(const cookie of cookies){
  assert.match(cookie,/HttpOnly/,'cookie de sessão legível por JavaScript vira roubo de sessão');
  assert.match(cookie,/Secure/);
  assert.match(cookie,/SameSite=Lax/);
 }
 assert.equal(sessions.size,1);
});

test('login com senha errada não cria sessão nem cookie',async()=>{
 await POST(proxied(criar()));
 sessions.clear();
 const response=await POST(proxied({action:'login',email:'reader@example.test',password:'senha-que-nao-e-essa'}));
 assert.equal(response.status,401);
 assert.equal((await response.json()).error,'invalid_credentials');
 assert.equal(cookiesOf(response).length,0);
 assert.equal(sessions.size,0);
});

test('login correto devolve sessão nova',async()=>{
 await POST(proxied(criar()));
 sessions.clear();
 const response=await POST(proxied({action:'login',email:'reader@example.test',password:SENHA}));
 assert.equal(response.status,200);
 assert.equal(cookiesOf(response).length,2);
 assert.equal(sessions.size,1);
});

test('e-mail já cadastrado é recusado sem tocar na conta existente',async()=>{
 await POST(proxied(criar()));
 const hashOriginal=users.get('reader@example.test').password_hash;
 const response=await POST(proxied(criar({password:'Outra-senha-qualquer'})));
 assert.equal(response.status,409);
 assert.equal((await response.json()).error,'email_already_registered');
 assert.equal(users.get('reader@example.test').password_hash,hashOriginal,'a senha existente não pode ser sobrescrita');
});

test('a resposta de erro nunca devolve a senha enviada',async()=>{
 const response=await POST(proxied({action:'login',email:'reader@example.test',password:SENHA}));
 assert.ok(!(await response.text()).includes(SENHA));
});

// --- renovação e logout ----------------------------------------------------

test('renovar sem cookie devolve 401 e limpa a sessão do navegador',async()=>{
 const response=await POST(proxied({action:'refresh'}));
 assert.equal(response.status,401);
 assert.equal((await response.json()).error,'no_session');
 assert.equal(cookiesOf(response).length,2,'precisa limpar os dois cookies');
 for(const cookie of cookiesOf(response))assert.match(cookie,/Max-Age=0/);
});

test('refresh desconhecido limpa os cookies; o válido rotaciona os dois',async()=>{
 await POST(proxied(criar()));
 const sessao=[...sessions.values()][0];

 globalThis.__authTestCookies=[['sb-refresh-token',{value:'token-que-nao-existe'}]];
 const recusada=await POST(proxied({action:'refresh'}));
 assert.equal(recusada.status,401);
 assert.equal((await recusada.json()).error,'session_expired');
 for(const cookie of cookiesOf(recusada))assert.match(cookie,/Max-Age=0/);

 // O banco guarda só o hash, então o teste planta um token conhecido.
 const token='token-em-claro-de-teste';
 sessao.refresh_hash=hashOf(token);
 globalThis.__authTestCookies=[['sb-refresh-token',{value:token}]];
 const renovada=await POST(proxied({action:'refresh'}));
 assert.equal(renovada.status,200);
 assert.equal(cookiesOf(renovada).length,2);
 assert.notEqual([...sessions.values()][0].refresh_hash,hashOf(token),'o refresh precisa rotacionar');
});

test('logout limpa os cookies mesmo sem sessão, e apaga a do servidor quando existe',async()=>{
 const semSessao=await POST(proxied({action:'logout'}));
 assert.equal(semSessao.status,200);
 for(const cookie of cookiesOf(semSessao))assert.match(cookie,/Max-Age=0/);

 await POST(proxied(criar()));
 const token='access-em-claro-de-teste';
 [...sessions.values()][0].access_hash=hashOf(token);
 globalThis.__authTestCookies=[['sb-access-token',{value:token}]];
 await POST(proxied({action:'logout'}));
 assert.equal(sessions.size,0,'logout precisa apagar a sessão no servidor, não só o cookie');
});

// --- modo temporário -------------------------------------------------------

test('com acesso temporário ligado, login e cadastro respondem 409 em vez de criar conta',async()=>{
 process.env.SAMBU_TEMPORARY_PUBLIC_ADMIN='true';
 // O formato aceito é estrito (sem milissegundos): a regex de
 // temporaryAdminEnabled recusa o toISOString() cru, e recusar é o certo --
 // data malformada não pode virar acesso aberto por acidente.
 process.env.SAMBU_TEMPORARY_PUBLIC_ADMIN_UNTIL=new Date(Date.now()+3600_000).toISOString().replace(/\.\d{3}Z$/,'Z');
 for(const body of [criar(),{action:'login',email:'reader@example.test',password:SENHA}]){
  const response=await POST(proxied(body));
  assert.equal(response.status,409);
  assert.equal((await response.json()).error,'temporary_access_enabled');
 }
 assert.equal(users.size,0);
 // Logout segue funcionando: é como se sai do modo temporário no navegador.
 assert.equal((await POST(proxied({action:'logout'}))).status,200);
});
