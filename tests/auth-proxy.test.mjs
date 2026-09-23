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
let POST, nodeToWebRequest;

before(async()=>{
  // Use the actual production server and the exact configuration shipped in Docker.
  const dockerfile=await readFile(path.join(root,'Dockerfile'),'utf8');
  const hosts=dockerfile.match(/VINEXT_TRUSTED_HOSTS=([^\s]+)/)?.[1];
  assert.equal(hosts,publicHost);
  process.env.VINEXT_TRUSTED_HOSTS=hosts;
  delete process.env.VINEXT_TRUST_PROXY;
  process.env.SUPABASE_URL='https://auth.example.test';
  process.env.SUPABASE_ANON_KEY='isolated-test-key';
  ({nodeToWebRequest}=await import('../node_modules/vinext/dist/server/prod-server.js'));
  await mkdir(output,{recursive:true});
  await build({
    entryPoints:[path.join(root,'app/api/auth/route.ts')],
    outfile:path.join(output,'auth.mjs'),bundle:true,platform:'node',format:'esm',packages:'external',
    plugins:[{name:'isolated-next-request',setup(b){
      b.onResolve({filter:/^next\/(headers|navigation)$/},args=>({path:args.path,namespace:'test-next'}));
      b.onLoad({filter:/.*/,namespace:'test-next'},()=>({contents:'export async function cookies(){return new Map();} export function redirect(){throw new Error("unexpected_redirect");}'}));
    }}],
  });
  ({POST}=await import(pathToFileURL(path.join(output,'auth.mjs'))));
});
after(async()=>{
  for(const key of ['VINEXT_TRUSTED_HOSTS','VINEXT_TRUST_PROXY','SUPABASE_URL','SUPABASE_ANON_KEY']){
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
    calls.push({url,options,body:JSON.parse(options.body)});
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
  assert.deepEqual(await response.json(),{error:'Email rate limit exceeded'});
});
