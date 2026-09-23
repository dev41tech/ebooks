import assert from 'node:assert/strict';
import {before,after,test} from 'node:test';
import {mkdir,rm} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {build} from 'esbuild';

const root=path.resolve(import.meta.dirname,'..'),output=path.join(root,'tests','.generated-storage');
const originalEnv={...process.env},originalFetch=globalThis.fetch;
const metadata=new Map(),objects=new Map();
let api,bucket,messages,mode='normal',calls=[],allowed=true;
const origin='https://sambu.test';
const post=body=>new Request(origin+'/api/admin/uploads',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
before(async()=>{
 await mkdir(output,{recursive:true});
 globalThis.__storageTestDb={
  prepare(query){return {
   bind(...values){return {
    async first(){return metadata.has(values[0])?{metadata:metadata.get(values[0])}:null;},
    async run(){if(query.startsWith('INSERT'))metadata.set(values[0],JSON.parse(values[1]));else metadata.delete(values[0]);},
   };},
  };},
 };
 globalThis.__storageTestAccess=()=>allowed?{user:{email:'tester@example.test'},error:null}:{error:Response.json({error:'sign_in_required'},{status:401})};
 await build({entryPoints:{uploads:path.join(root,'app/api/admin/uploads/route.ts'),storage:path.join(root,'db/storage.ts'),messages:path.join(root,'app/lib/import-messages.ts')},outdir:output,outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm',packages:'external',plugins:[{name:'only-test-db-and-identity',setup(b){
  b.onResolve({filter:/^\.\/sql$/},()=>({path:'test-db',namespace:'test'}));
  b.onResolve({filter:/lib\/access$/},()=>({path:'test-access',namespace:'test'}));
  b.onLoad({filter:/.*/,namespace:'test'},args=>({contents:args.path==='test-db'?'export const database=globalThis.__storageTestDb;':'export const requireAccess=()=>globalThis.__storageTestAccess();'}));
 }}]});
 api=await import(pathToFileURL(path.join(output,'uploads.mjs')));
 ({bucket}=await import(pathToFileURL(path.join(output,'storage.mjs'))));
 messages=await import(pathToFileURL(path.join(output,'messages.mjs')));
 process.env.SUPABASE_URL=' https://storage.example.test/ ';
 process.env.SUPABASE_SERVICE_ROLE_KEY=' legacy-test-only ';
 process.env.SUPABASE_STORAGE_BUCKET=' sambu ';
 delete process.env.SUPABASE_SECRET_KEY;
 globalThis.fetch=async(url,init)=>{
  calls.push({url,init});
  if(mode==='network')throw new TypeError('private provider URL',{cause:{code:'ENOTFOUND'}});
  if(mode==='timeout')throw new DOMException('private provider URL','TimeoutError');
  if(mode==='invalid_key')return Response.json({message:'Invalid API key',private:'never expose'},{status:401});
  if(mode==='missing_bucket')return Response.json({code:'NoSuchBucket',message:'private bucket path'},{status:404});
  if(mode==='legacy_bucket')return Response.json({statusCode:'404',message:'Bucket not found'},{status:400});
  if(mode==='mime')return Response.json({code:'InvalidMimeType',message:'private bucket info'},{status:400});
  if(mode==='size')return Response.json({code:'EntityTooLarge'},{status:413});
  if(mode==='proxy')return new Response('<h1>private proxy details</h1>',{status:502});
  if(mode==='denied')return Response.json({code:'AccessDenied'},{status:403});
  if(url.endsWith('/bucket/sambu'))return Response.json({id:'sambu'});
  const key=new URL(url).pathname.split('/object/sambu/')[1];
  if(init.method==='POST'){objects.set(key,new Uint8Array(await new Response(init.body).arrayBuffer()));return Response.json({Key:key});}
  if(init.method==='DELETE'){objects.delete(key);return new Response(null,{status:200});}
  if(!objects.has(key))return mode==='legacy_missing'?init.method==='HEAD'?new Response(null,{status:400}):Response.json({statusCode:'404',message:'Object not found'},{status:400}):new Response(null,{status:404});
  const bytes=objects.get(key);
  const headers={etag:'"test-etag"','content-length':String(bytes.length),'content-type':'application/epub+zip'};
  return new Response(init.method==='HEAD'?null:bytes,{headers});
 };
});
after(async()=>{
 globalThis.fetch=originalFetch;
 for(const name of ['SUPABASE_URL','SUPABASE_SECRET_KEY','SUPABASE_SERVICE_ROLE_KEY','SUPABASE_STORAGE_BUCKET'])if(originalEnv[name]===undefined)delete process.env[name];else process.env[name]=originalEnv[name];
 delete globalThis.__storageTestDb;delete globalThis.__storageTestAccess;
 await rm(output,{recursive:true,force:true});
});
test('storage preflight is read-only, authorized and trims environment settings',async()=>{
 calls=[];allowed=false;assert.equal((await api.GET()).status,401);assert.equal(calls.length,0);allowed=true;
 const response=await api.GET();assert.equal(response.status,200);assert.deepEqual(await response.json(),{ready:true});
 assert.equal(calls.length,1);assert.equal(calls[0].url,'https://storage.example.test/storage/v1/bucket/sambu');
 assert.equal(calls[0].init.method,'GET');assert.equal(calls[0].init.redirect,'error');
 assert.equal(calls[0].init.headers.authorization,'Bearer legacy-test-only');
 assert.equal(objects.size,0);
});
test('new secret key uses apikey, never a bearer JWT, and supports the old variable',async()=>{
 process.env.SUPABASE_SECRET_KEY=' sb_secret_test-only ';
 assert.equal((await api.GET()).status,200);
 assert.equal(calls.at(-1).init.headers.apikey,'sb_secret_test-only');assert.equal(calls.at(-1).init.headers.authorization,undefined);
 delete process.env.SUPABASE_SECRET_KEY;process.env.SUPABASE_SERVICE_ROLE_KEY='sb_secret_legacy-variable';
 assert.equal((await api.GET()).status,200);assert.equal(calls.at(-1).init.headers.authorization,undefined);
 process.env.SUPABASE_SERVICE_ROLE_KEY='legacy-test-only';
});
test('missing or malformed settings fail before sending a request without leaking values',async()=>{
 for(const [name,value,code] of [
  ['SUPABASE_URL','','storage_url_missing'],['SUPABASE_URL','https://host.test/storage/v1','storage_url_invalid'],
  ['SUPABASE_URL','https://user:private@host.test','storage_url_invalid'],
  ['SUPABASE_SERVICE_ROLE_KEY','','storage_key_missing'],['SUPABASE_SERVICE_ROLE_KEY','sb_publishable_private','storage_key_invalid'],
 ]){
  const saved=process.env[name];process.env[name]=value;const count=calls.length;
  try{const response=await api.GET();assert.equal(response.status,503);const data=await response.json();assert.equal(data.error,code);assert.match(data.requestId,/^[a-f0-9-]{36}$/);assert.equal(calls.length,count);assert.ok(!JSON.stringify(data).includes('private'));}finally{process.env[name]=saved;}
 }
});
test('provider failures return specific safe errors through the actual upload route',async()=>{
 const saved=console.error,logs=[];console.error=value=>logs.push(value);
 try{
  for(const [failure,status,code] of [
   ['network',503,'storage_unavailable'],['timeout',504,'storage_timeout'],['invalid_key',503,'storage_key_invalid'],
   ['missing_bucket',503,'storage_bucket_missing'],['legacy_bucket',503,'storage_bucket_missing'],
   ['mime',422,'storage_type_not_allowed'],['size',413,'storage_file_too_large'],
   ['proxy',502,'storage_provider_error'],['denied',503,'storage_access_denied'],
  ]){
   mode=failure;const response=await api.POST(post({action:'init',fileName:'book.epub',size:3}));
   assert.equal(response.status,status,failure);const data=await response.json();assert.equal(data.error,code);assert.ok(data.requestId);
   const text=messages.importErrorMessage(data,'fallback');assert.notEqual(text,'fallback');assert.ok(text.includes(data.requestId));
   assert.ok(!JSON.stringify(data).includes('private'));
  }
  assert.ok(logs.every(log=>!log.includes('private')&&!log.includes('legacy-test-only')&&!log.includes('tester@example')));
  assert.ok(logs.some(log=>log.includes('ENOTFOUND')));
 }finally{mode='normal';console.error=saved;}
});
test('chunk upload completes using the real Storage adapter, including legacy HEAD 400 for a missing object',async()=>{
 mode='legacy_missing';
 try{
  const init=await api.POST(post({action:'init',fileName:'book.epub',size:3}));assert.equal(init.status,200);
  const {uploadId}=await init.json();
  const part=await api.PUT(new Request(`${origin}/api/admin/uploads?uploadId=${uploadId}&part=0`,{method:'PUT',body:new Uint8Array([65,66,67])}));assert.equal(part.status,200);
  const complete=await api.POST(post({action:'complete',uploadId,totalParts:1,size:3}));assert.equal(complete.status,200);
  const result=await complete.json();assert.equal(await (await bucket.get(result.storageKey)).text(),'ABC');
  assert.equal((await bucket.head(result.storageKey)).customMetadata.owner,'tester@example.test');
  assert.equal((await api.POST(post({action:'complete',uploadId,totalParts:1,size:3}))).status,200);
  assert.equal(await bucket.get('missing.epub'),null);
 }finally{mode='normal';}
});
test('unrecognized error bodies and request IDs never become user-visible raw text',()=>{
 assert.equal(messages.importErrorMessage({error:'private',requestId:'private'},'Falha'),'Falha');
});
