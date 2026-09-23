import assert from 'node:assert/strict';
import {before, after, test} from 'node:test';
import {readFile, mkdir, rm} from 'node:fs/promises';
import {Readable} from 'node:stream';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';

const root=path.resolve(import.meta.dirname,'..');
const output=path.join(root,'tests','.generated-auth');
const publicHost='ebooks.41tech.cloud';
const publicOrigin=`https://${publicHost}`;
const originalEnv={...process.env};
let POST, nodeToWebRequest, checkAuth, authErrorMessage, authIdentity;

before(async()=>{
  // Use the actual production server and the exact configuration shipped in Docker.
  const dockerfile=await readFile(path.join(root,'Dockerfile'),'utf8');
  const hosts=dockerfile.match(/VINEXT_TRUSTED_HOSTS=([^\s]+)/)?.[1];
  assert.equal(hosts,publicHost);
  process.env.VINEXT_TRUSTED_HOSTS=hosts;
  delete process.env.VINEXT_TRUST_PROXY;
  process.env.SUPABASE_URL='https://auth.example.test';
  process.env.SUPABASE_ANON_KEY='isolated-test-key';
  delete process.env.SUPABASE_PUBLISHABLE_KEY;
  delete process.env.SAMBU_TEMPORARY_PUBLIC_ADMIN;
  delete process.env.SAMBU_TEMPORARY_PUBLIC_ADMIN_UNTIL;
  ({nodeToWebRequest}=await import('../node_modules/vinext/dist/server/prod-server.js'));
  await mkdir(output,{recursive:true});
  await build({
    entryPoints:{auth:path.join(root,'app/api/auth/route.ts'),identity:path.join(root,'app/auth.ts')},
    outdir:output,outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm',packages:'external',
    plugins:[{name:'isolated-next-request',setup(b){
      b.onResolve({filter:/^next\/(headers|navigation)$/},args=>({path:args.path,namespace:'test-next'}));
      b.onLoad({filter:/.*/,namespace:'test-next'},()=>({contents:'export async function cookies(){return new Map(globalThis.__authTestCookies || []);} export function redirect(){throw new Error("unexpected_redirect");}'}));
    }}],
  });
  ({POST}=await import(pathToFileURL(path.join(output,'auth.mjs'))));
  authIdentity=await import(pathToFileURL(path.join(output,'identity.mjs')));
  for(const [file,source] of [['check-auth','scripts/check-auth.ts'],['auth-messages','app/lib/auth-messages.ts']]){
    await build({entryPoints:[path.join(root,source)],outfile:path.join(output,`${file}.mjs`),bundle:true,platform:'node',format:'esm',packages:'external'});
  }
  ({checkAuth}=await import(pathToFileURL(path.join(output,'check-auth.mjs'))));
  ({authErrorMessage}=await import(pathToFileURL(path.join(output,'auth-messages.mjs'))));
});
after(async()=>{
  for(const key of ['VINEXT_TRUSTED_HOSTS','VINEXT_TRUST_PROXY','SUPABASE_URL','SUPABASE_ANON_KEY','SUPABASE_PUBLISHABLE_KEY','SAMBU_TEMPORARY_PUBLIC_ADMIN','SAMBU_TEMPORARY_PUBLIC_ADMIN_UNTIL']){
    if(originalEnv[key]===undefined)delete process.env[key];else process.env[key]=originalEnv[key];
  }
  await rm(output,{recursive:true,force:true});
});

function proxied(body={},overrides={}){
  const incoming=Readable.from([Buffer.from(JSON.stringify(body))]);
  incoming.method='POST';incoming.url='/api/auth';
  incoming.headers={host:'app_ebooks:3000','content-type':'application/json',origin:publicOrigin,
    'x-forwarded-host':publicHost,'x-forwarded-proto':'https',...overrides};
  return nodeToWebRequest(incoming);
}
function isolatedAuth(t,data,status=200){
  const calls=[];
  t.mock.method(globalThis,'fetch',async(url,options)=>{
    calls.push({url,options,body:options.body?JSON.parse(options.body):undefined});
    return Response.json(data,{status});
  });
  return calls;
}
const account={action:'signup',email:' READER@EXAMPLE.TEST ',password:'Only-for-isolated-tests',displayName:'Leitora de teste'};

test('Easypanel HTTPS origin reaches validation through the internal HTTP service',async(t)=>{
  const calls=isolatedAuth(t,{});
  const request=proxied();
  assert.equal(request.url,`${publicOrigin}/api/auth`);
  const response=await POST(request);
  assert.equal(response.status,400);
  assert.equal((await response.json()).error,'invalid_credentials_format');
  assert.equal(calls.length,0);
});

test('signup behind the proxy calls Supabase and creates secure session cookies',async(t)=>{
  const calls=isolatedAuth(t,{access_token:'test-access',refresh_token:'test-refresh',expires_in:3600});
  const response=await POST(proxied(account));
  assert.equal(response.status,201);
  assert.deepEqual(await response.json(),{ok:true});
  assert.equal(calls.length,1);
  assert.equal(calls[0].url,'https://auth.example.test/auth/v1/signup');
  assert.deepEqual(calls[0].body,{email:'reader@example.test',password:account.password,data:{display_name:account.displayName}});
  const cookies=response.headers.getSetCookie();
  assert.equal(cookies.length,2);
  for(const cookie of cookies){assert.match(cookie,/HttpOnly/);assert.match(cookie,/Secure/);assert.match(cookie,/SameSite=Lax/);}
});

test('signup requiring email confirmation does not pretend the reader is signed in',async(t)=>{
  isolatedAuth(t,{id:'pending-account'});
  const response=await POST(proxied(account));
  assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{ok:true,confirmationRequired:true});
  assert.equal(response.headers.get('set-cookie'),null);
});

test('login behind the proxy accepts the same public domain',async(t)=>{
  const calls=isolatedAuth(t,{access_token:'test-access',refresh_token:'test-refresh',expires_in:3600});
  const response=await POST(proxied({...account,action:'login'}));
  assert.equal(response.status,200);
  assert.equal(calls[0].url,'https://auth.example.test/auth/v1/token?grant_type=password');
});

test('third-party origins and forged forwarded hosts remain blocked before authentication',async(t)=>{
  const calls=isolatedAuth(t,{});
  for(const headers of [
    {origin:'https://evil.test'},
    {origin:'https://evil.test','x-forwarded-host':'evil.test'},
    {origin:`https://${publicHost}.evil.test`,'x-forwarded-host':`${publicHost}.evil.test`},
    {origin:'null'},
  ]){
    const response=await POST(proxied(account,headers));
    assert.equal(response.status,403);
    assert.equal((await response.json()).error,'invalid_origin');
  }
  assert.equal(calls.length,0);
});

test('an unlisted proxy host is ignored; malformed protocol cannot bypass origin protection',async(t)=>{
  const calls=isolatedAuth(t,{});
  const untrusted=proxied(account,{'x-forwarded-host':'evil.test'});
  assert.equal(new URL(untrusted.url).hostname,'app_ebooks');
  assert.equal((await POST(untrusted)).status,403);
  assert.equal((await POST(proxied(account,{'x-forwarded-proto':'javascript'}))).status,403);
  assert.equal(calls.length,0);
});

test('Supabase signup errors are still returned and no session is created',async(t)=>{
  isolatedAuth(t,{msg:'Email rate limit exceeded'},429);
  const response=await POST(proxied(account));
  assert.equal(response.status,429);
  assert.equal(response.headers.get('set-cookie'),null);
  assert.equal((await response.json()).error,'over_request_rate_limit');
});

test('missing or invalid Auth configuration returns JSON instead of an empty 500, without leaking secrets',async(t)=>{
  const calls=isolatedAuth(t,{});
  const logs=[];t.mock.method(console,'error',(...args)=>logs.push(args));
  const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_ANON_KEY;
  try{
    for(const [name,value,code,reason] of [
      ['SUPABASE_URL','','auth_not_configured','missing_supabase_url'],
      ['SUPABASE_ANON_KEY','','auth_not_configured','missing_supabase_public_key'],
      ['SUPABASE_URL','https://private-name:private-password@project.test','auth_config_invalid','invalid_supabase_url'],
      ['SUPABASE_URL','https://project.test/auth/v1','auth_config_invalid','invalid_supabase_url'],
      ['SUPABASE_ANON_KEY','sb_secret_DO_NOT_PRINT','auth_config_invalid','invalid_supabase_public_key'],
    ]){
      process.env.SUPABASE_URL=url;process.env.SUPABASE_ANON_KEY=key;process.env[name]=value;
      const response=await POST(proxied(account));
      assert.equal(response.status,503);
      const data=await response.json();assert.equal(data.error,code);assert.match(data.requestId,/^[a-f0-9-]{36}$/);
      assert.equal(response.headers.get('set-cookie'),null);
      assert.equal(response.headers.get('cache-control'),'no-store');
      const log=JSON.parse(logs.at(-1)[1]);assert.equal(log.reason,reason);assert.equal(log.requestId,data.requestId);
      const diagnosis=await checkAuth();assert.equal(diagnosis.reason,reason);
    }
    assert.equal(calls.length,0);
    assert.doesNotMatch(JSON.stringify(logs),/private-password|DO_NOT_PRINT|READER@|Only-for-isolated|isolated-test-key/);
  }finally{process.env.SUPABASE_URL=url;process.env.SUPABASE_ANON_KEY=key;}
});

test('DNS failure, timeout and malformed provider responses have distinct safe errors',async(t)=>{
  const logs=[];t.mock.method(console,'error',(...args)=>logs.push(args));
  const cases=[
    [()=>{throw new TypeError('contains a secret',{cause:{code:'ENOTFOUND'}});},503,'auth_unavailable'],
    [()=>{throw new DOMException('contains a secret','TimeoutError');},504,'auth_timeout'],
    [()=>new Response('<html>contains a secret</html>',{status:502}),502,'auth_invalid_response'],
    [()=>Response.json(null),502,'auth_invalid_response'],
    [()=>Response.json({message:'contains a secret'},{status:500}),502,'auth_upstream_error'],
    [()=>Response.json({message:'Invalid API key',hint:'contains a secret'},{status:401}),503,'auth_config_invalid'],
  ];
  for(const [implementation,status,code] of cases){
    const mock=t.mock.method(globalThis,'fetch',implementation);
    try{
      const response=await POST(proxied(account));assert.equal(response.status,status);
      const text=await response.text();assert.equal(JSON.parse(text).error,code);assert.doesNotMatch(text,/contains a secret/);
      assert.equal(response.headers.get('set-cookie'),null);
    }finally{mock.mock.restore();}
  }
  assert.doesNotMatch(JSON.stringify(logs),/contains a secret/);
});

test('publishable keys work without sending a non-JWT as bearer authorization',async(t)=>{
  process.env.SUPABASE_PUBLISHABLE_KEY='  sb_publishable_isolated  ';
  t.after(()=>delete process.env.SUPABASE_PUBLISHABLE_KEY);
  const calls=isolatedAuth(t,{id:'pending-account'});
  const response=await POST(proxied(account));assert.equal(response.status,200);
  assert.equal(calls[0].options.headers.apikey,'sb_publishable_isolated');
  assert.equal(calls[0].options.headers.authorization,undefined);
  assert.equal(calls[0].options.redirect,'error');
});

test('known Supabase rejections keep their code and display Portuguese guidance',async(t)=>{
  for(const [code,status,expected] of [
    ['email_not_confirmed',400,/Confirme seu e-mail/],
    ['email_address_not_authorized',422,/envio de confirmação/],
    ['signup_disabled',422,/cadastros estão desativados/],
    ['weak_password',422,/senha mais forte/],
    ['over_email_send_rate_limit',429,/limite de e-mails/],
    ['invalid_credentials',400,/E-mail ou senha incorretos/],
  ]){
    const mock=t.mock.method(globalThis,'fetch',async()=>Response.json({error_code:code,msg:'private provider text'},{status}));
    try{
      const response=await POST(proxied(account));assert.equal(response.status,status);
      const data=await response.json();assert.equal(data.error,code);assert.match(authErrorMessage(data.error,status),expected);
      assert.doesNotMatch(JSON.stringify(data),/private provider text/);
    }finally{mock.mock.restore();}
  }
});

test('incomplete success bodies cannot create a fake session or claim signup completed',async(t)=>{
  t.mock.method(console,'error',()=>{});
  for(const payload of [{},{access_token:'only-access'},{user:null},{access_token:'bad;cookie',refresh_token:'refresh'}]){
    const mock=t.mock.method(globalThis,'fetch',async()=>Response.json(payload));
    try{
      const response=await POST(proxied(account));assert.equal(response.status,502);
      assert.equal((await response.json()).error,'auth_invalid_response');assert.equal(response.headers.get('set-cookie'),null);
    }finally{mock.mock.restore();}
  }
});

test('refresh retains cookies during outages but clears an explicitly expired session',async(t)=>{
  t.mock.method(console,'error',()=>{});
  globalThis.__authTestCookies=[['sb-refresh-token',{value:'existing-refresh'}]];
  t.after(()=>delete globalThis.__authTestCookies);
  const outage=t.mock.method(globalThis,'fetch',async()=>{throw new TypeError('fetch failed');});
  const response=await POST(proxied({action:'refresh'}));assert.equal(response.status,503);assert.equal(response.headers.get('set-cookie'),null);
  outage.mock.restore();
  isolatedAuth(t,{error_code:'refresh_token_not_found'},400);
  const expired=await POST(proxied({action:'refresh'}));assert.equal(expired.status,401);
  assert.equal((await expired.json()).error,'session_expired');assert.equal(expired.headers.getSetCookie().length,2);
  for(const cookie of expired.headers.getSetCookie())assert.match(cookie,/Max-Age=0/);
});

test('read-only diagnostic checks settings without creating accounts or returning keys',async(t)=>{
  const calls=isolatedAuth(t,{disable_signup:false,external:{email:true},mailer_autoconfirm:false,private:'DO_NOT_PRINT'});
  const result=await checkAuth();assert.equal(result.ok,true);assert.equal(result.emailSignup,'enabled');assert.equal(result.emailConfirmation,'enabled');
  assert.equal(calls[0].options.method,'GET');assert.equal(calls[0].body,undefined);
  assert.equal(calls[0].url,'https://auth.example.test/auth/v1/settings');
  assert.doesNotMatch(JSON.stringify(result),/DO_NOT_PRINT|isolated-test-key|auth.example/);
});

test('invalid request bodies return 400; blank server errors still have useful client messages',async(t)=>{
  const calls=isolatedAuth(t,{});
  for(const body of [null,[],{action:'unknown'}])assert.equal((await POST(proxied(body))).status,400);
  assert.equal(calls.length,0);
  assert.match(authErrorMessage(undefined,500),/indisponível/);
  assert.doesNotMatch(authErrorMessage('secret SQL details',500,'not-a-reference'),/secret SQL|not-a-reference/);
});

test('temporary access works without Supabase or cookies and does not unlock private or AI administration',async(t)=>{
  const prior={url:process.env.SUPABASE_URL,key:process.env.SUPABASE_ANON_KEY};
  process.env.SAMBU_TEMPORARY_PUBLIC_ADMIN='true';
  process.env.SAMBU_TEMPORARY_PUBLIC_ADMIN_UNTIL=new Date(Date.now()+3600000).toISOString().replace(/\.\d{3}Z$/,'Z');
  delete process.env.SUPABASE_URL;delete process.env.SUPABASE_ANON_KEY;
  // A leftover authenticated cookie must not require the broken Auth service.
  globalThis.__authTestCookies=[['sb-access-token',{value:'old-session'}]];
  t.after(()=>{delete process.env.SAMBU_TEMPORARY_PUBLIC_ADMIN;delete process.env.SAMBU_TEMPORARY_PUBLIC_ADMIN_UNTIL;delete globalThis.__authTestCookies;process.env.SUPABASE_URL=prior.url;process.env.SUPABASE_ANON_KEY=prior.key;});
  const calls=isolatedAuth(t,{});
  const user=await authIdentity.getUser();
  assert.equal(user.temporary,true);assert.equal(user.email,'public-test@sambu.invalid');
  assert.equal((await authIdentity.requireAdmin()).error.status,403);
  assert.equal((await authIdentity.requireAuthor()).error.status,403);
  assert.equal((await POST(proxied(account))).status,409);
  assert.equal(calls.length,0);
});

test('turning temporary mode off restores login; only the exact server setting enables it',async(t)=>{
  const calls=isolatedAuth(t,{});
  t.after(()=>{delete process.env.SAMBU_TEMPORARY_PUBLIC_ADMIN;delete process.env.SAMBU_TEMPORARY_PUBLIC_ADMIN_UNTIL;});
  const future=new Date(Date.now()+3600000).toISOString().replace(/\.\d{3}Z$/,'Z');
  process.env.SAMBU_TEMPORARY_PUBLIC_ADMIN_UNTIL=future;
  for(const value of ['false','1','yes','true ','TRUE','']){
    process.env.SAMBU_TEMPORARY_PUBLIC_ADMIN=value;
    assert.equal(await authIdentity.getUser(),null);
  }
  process.env.SAMBU_TEMPORARY_PUBLIC_ADMIN='true';assert.equal((await authIdentity.getUser()).temporary,true);
  process.env.SAMBU_TEMPORARY_PUBLIC_ADMIN='false';assert.equal(await authIdentity.getUser(),null);
  process.env.SAMBU_TEMPORARY_PUBLIC_ADMIN='true';
  for(const value of ['', 'invalid', new Date(Date.now()-1000).toISOString().replace(/\.\d{3}Z$/,'Z')]){
    process.env.SAMBU_TEMPORARY_PUBLIC_ADMIN_UNTIL=value;
    assert.equal(await authIdentity.getUser(),null);
  }
  assert.equal(calls.length,0);
});
