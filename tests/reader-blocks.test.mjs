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

const packedOutput=await build({entryPoints:['app/lib/reader-content.ts'],bundle:true,write:false,format:'esm',platform:'node'});
const {packReaderContent,chapterForPosition}=await import('data:text/javascript;base64,'+Buffer.from(packedOutput.outputFiles[0].text).toString('base64'));
const unpack=(packed,index)=>{const entry=packed.index.chapters[index];return JSON.parse(new TextDecoder().decode(packed.bytes.slice(entry.offset,entry.offset+entry.length)));};
test('intro plus thirteen chapters keeps chapter one aligned in the second of fourteen sections',()=>{
 const sections=[{id:'intro',title:'Introdução',body:['Introdução Texto inicial.']},...Array.from({length:13},(_,i)=>({id:String(i),title:`Capítulo ${i+1} — Tema`,body:['Texto do capítulo.','Mais texto.']}))];
 const packed=packReaderContent(sections);
 assert.equal(packed.index.chapters.length,14);
 assert.equal(unpack(packed,0).navigationLabel,'Início da leitura');
 for(let i=1;i<=13;i++){
  const chapter=unpack(packed,i);
  assert.equal(chapter.navigationLabel,`${chapter.blocks[0].chapterLabel} · 13 capítulos`);
  assert.equal(chapter.blocks[0].chapterLabel,`Capítulo ${i}`);
  assert.equal(chapter.start,1+(i-1)*2);
  assert.equal(chapterForPosition(packed.index,chapter.start+1).index,i);
 }
 assert.equal(packed.index.totalParagraphs,27);
 assert.equal(unpack(packed,0).blocks[0].text,'Texto inicial.');
});
test('front and back matter do not inflate totals, and Roman labels agree with reading text',()=>{
 const packed=packReaderContent([
  {id:'p',title:'Prefácio',body:['Texto preservado.']},
  {id:'1',title:'Capítulo I — Tema',body:['Texto.']},
  {id:'2',title:'Tema seguinte',body:['Capítulo II','Texto.']},
  {id:'e',title:'Epílogo',body:['Fim.']}
 ]);
 assert.equal(unpack(packed,0).navigationLabel,'Prefácio');
 assert.equal(unpack(packed,1).navigationLabel,'Capítulo I · 2 capítulos');
 assert.equal(unpack(packed,2).navigationLabel,'Capítulo II · 2 capítulos');
 assert.equal(unpack(packed,3).navigationLabel,'Epílogo');
 assert.deepEqual(packed.index.chapters.map(c=>c.start),[0,1,2,4]);
});
