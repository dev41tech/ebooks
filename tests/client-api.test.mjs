import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const result=await build({entryPoints:['app/lib/client-api.ts'],bundle:true,write:false,platform:'node',format:'esm'});
const api=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
test('web keeps same-origin requests; native routes API and media only to the configured HTTPS origin',async()=>{
 const calls=[];const original=globalThis.fetch;globalThis.fetch=async(...args)=>{calls.push(args);return new Response('{}');};
 try{
  assert.equal(api.serviceUrl('/api/catalog'),'/api/catalog');await api.apiFetch('/api/progress',{method:'POST'});assert.equal(calls[0][1].credentials,'same-origin');
  assert.throws(()=>api.configureApiOrigin('http://api.example.test'));
  assert.throws(()=>api.configureApiOrigin('https://user:secret@api.example.test'));
  assert.throws(()=>api.configureApiOrigin('https://api.example.test/path'));
  assert.throws(()=>api.serviceUrl('//another.test'));
  api.configureApiOrigin('https://api.example.test');
  assert.equal(api.serviceUrl('/api/catalog/file?id=book#page=3'),'https://api.example.test/api/catalog/file?id=book#page=3');
  await api.apiFetch('/api/progress',{method:'POST',keepalive:true});assert.equal(calls[1][0],'https://api.example.test/api/progress');assert.equal(calls[1][1].credentials,'include');assert.equal(calls[1][1].keepalive,true);
 }finally{globalThis.fetch=original;}
});

test('expired sessions refresh once and retry concurrent requests',async()=>{
 const original=globalThis.fetch;let refreshes=0,authorized=false;
 globalThis.fetch=async(url)=>{
  if(url.endsWith('/api/auth')){refreshes++;await new Promise(r=>setTimeout(r,10));authorized=true;return new Response('{}');}
  return new Response('{}',{status:authorized?200:401});
 };
 try{const responses=await Promise.all([api.apiFetch('/api/progress'),api.apiFetch('/api/profile')]);assert.equal(refreshes,1);assert.ok(responses.every(r=>r.status===200));}finally{globalThis.fetch=original;}
});
test('failed refresh leaves the original unauthorized result without retry loops',async()=>{
 const original=globalThis.fetch;let count=0;globalThis.fetch=async()=>{count++;return new Response('{}',{status:401});};
 try{assert.equal((await api.apiFetch('/api/progress')).status,401);assert.equal(count,2);}finally{globalThis.fetch=original;}
});
