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
 assert.equal(result[2].chapterLabel,'Capítulo 1');assert.equal(result[2].heading,'Chegada');assert.equal(result[2].hidden,true);
 assert.equal(result[3].text,'Uma nova história.');
});

test('removes inline introduction prefix and places chapter number ahead of its theme',()=>{
 const result=readingBlocks([{id:'intro',title:'Introdução',body:['Introdução A primeira vez que entendi o peso de uma porta fechada.']},{id:'two',title:'Sangue no corredor',body:['Capítulo 2','— Você não devia estar de pé.']}]);
 assert.equal(result[0].text,'A primeira vez que entendi o peso de uma porta fechada.');
 assert.equal(result[0].chapterLabel,'');assert.equal(result[0].heading,'');
 assert.equal(result[1].chapterLabel,'Capítulo 2');assert.equal(result[1].heading,'Sangue no corredor');assert.equal(result[1].hidden,true);
 assert.equal(result[2].text,'— Você não devia estar de pé.');assert.deepEqual(result.map(b=>b.position),[0,1,2]);
});
test('keeps narrative mentions and roman chapter numbers',()=>{
 const result=readingBlocks([{id:'a',title:'Capítulo IV — A volta',body:['Na introdução, ela explicou tudo.','Capítulo 5 seria o próximo assunto.']}]);
 assert.equal(result[0].chapterLabel,'Capítulo IV');assert.equal(result[0].heading,'A volta');assert.equal(result[0].text,'Na introdução, ela explicou tudo.');assert.equal(result[1].hidden,false);
});
