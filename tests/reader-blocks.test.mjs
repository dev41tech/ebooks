import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const output=await build({entryPoints:['app/lib/reader-blocks.ts'],bundle:true,write:false,format:'esm',platform:'node'});
const {readingBlocks}=await import('data:text/javascript;base64,'+Buffer.from(output.outputFiles[0].text).toString('base64'));
test('chapter headings return without changing saved positions or removing introductory prose',()=>{
 const result=readingBlocks([{id:'a',title:'Introdução',body:['Introdução','Texto original da introdução.']},{id:'b',title:'Capítulo 1 — Chegada',body:['Capítulo 1 — Chegada','Uma nova história.']}]);
 assert.deepEqual(result.map(b=>b.position),[0,1,2,3]);
 assert.equal(result[0].heading,'');assert.equal(result[0].hidden,true);
 assert.equal(result[1].text,'Texto original da introdução.');assert.equal(result[1].hidden,false);
 assert.equal(result[2].heading,'Capítulo 1 — Chegada');assert.equal(result[2].hidden,true);
 assert.equal(result[3].text,'Uma nova história.');
});
