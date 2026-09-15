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
