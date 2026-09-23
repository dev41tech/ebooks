import assert from 'node:assert/strict';
import {before,after,beforeEach,test} from 'node:test';
import {mkdir,rm,readdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {build} from 'esbuild';

// O driver de disco guarda arquivo de cliente num volume da VPS. Três coisas
// aqui erram em silêncio e por isso são testadas: travessia de caminho (uma
// chave com `..` escreveria fora da pasta), leitura parcial (o conteúdo dos
// capítulos é lido por range, e devolver o pedaço errado corrompe a leitura sem
// erro nenhum) e a escrita atômica (um upload interrompido não pode virar
// arquivo válido pela metade).

const root=path.resolve(import.meta.dirname,'..');
const output=path.join(root,'tests','.generated-storage-disk');
const storageDir=path.join(root,'tests','.storage-disk-data');
const originalEnv={...process.env};
const metadata=new Map();
let diskBucket;

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
 await build({entryPoints:{disk:path.join(root,'db/storage-disk.ts')},outdir:output,outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm',packages:'external',plugins:[{name:'only-test-db',setup(b){
  b.onResolve({filter:/^\.\/sql$/},()=>({path:'test-db',namespace:'test'}));
  b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export const database=globalThis.__storageTestDb;'}));
 }}]});
 ({diskBucket}=await import(pathToFileURL(path.join(output,'disk.mjs'))));
});

beforeEach(async()=>{
 await rm(storageDir,{recursive:true,force:true});
 await mkdir(storageDir,{recursive:true});
 metadata.clear();
 process.env.STORAGE_DIR=storageDir;
});

after(async()=>{
 process.env=originalEnv;
 delete globalThis.__storageTestDb;
 await rm(output,{recursive:true,force:true});
 await rm(storageDir,{recursive:true,force:true});
});

test('grava e lê de volta com tipo e metadados do usuário',async()=>{
 await diskBucket.put('livros/a/manifest.json','{"fileName":"x.epub"}',{httpMetadata:{contentType:'application/json'},customMetadata:{owner:'marcos@teste'}});
 const object=await diskBucket.get('livros/a/manifest.json');
 assert.equal(await object.text(),'{"fileName":"x.epub"}');
 assert.equal(object.httpMetadata.contentType,'application/json');
 assert.deepEqual(object.customMetadata,{owner:'marcos@teste'});
 assert.equal(object.size,21);
 assert.match(object.etag,/^[0-9a-f]{64}$/);
 assert.equal(object.httpEtag,'"'+object.etag+'"');
});

test('objeto inexistente devolve null, não erro',async()=>{
 assert.equal(await diskBucket.get('nao/existe'),null);
 assert.equal(await diskBucket.head('nao/existe'),null);
});

test('chave que sai da pasta é recusada',async()=>{
 // A fronteira de segurança do driver. Sem isto, `..` grava no sistema de arquivos da VPS.
 for(const key of ['../fora','livros/../../fora','/absoluto','com\\barra','nulo\0byte','']){
  await assert.rejects(()=>diskBucket.put(key,'x'),/invalid_storage_key/,'aceitou a chave '+JSON.stringify(key));
  await assert.rejects(()=>diskBucket.get(key),/invalid_storage_key/);
 }
});

test('range devolve exatamente a fatia pedida',async()=>{
 await diskBucket.put('blob','0123456789');
 const object=await diskBucket.get('blob',{range:{offset:3,length:4}});
 assert.equal(await object.text(),'3456');
 assert.equal(object.size,4,'size acompanha o recorte, como no 206 do provedor');
});

test('range além do fim recorta em vez de estourar',async()=>{
 await diskBucket.put('blob','012');
 assert.equal(await (await diskBucket.get('blob',{range:{offset:1,length:99}})).text(),'12');
});

test('range inválido é recusado',async()=>{
 await diskBucket.put('blob','012');
 await assert.rejects(()=>diskBucket.get('blob',{range:{offset:-1,length:1}}),/invalid_range/);
 await assert.rejects(()=>diskBucket.get('blob',{range:{offset:0,length:0}}),/invalid_range/);
});

test('onlyIf devolve o conteúdo com o etag certo e null com o errado',async()=>{
 await diskBucket.put('arquivo','conteudo');
 const {etag}=await diskBucket.head('arquivo');
 assert.equal(await (await diskBucket.get('arquivo',{onlyIf:{etagMatches:etag}})).text(),'conteudo');
 assert.equal(await diskBucket.get('arquivo',{onlyIf:{etagMatches:'outro'}}),null);
});

test('o etag muda quando o conteúdo muda',async()=>{
 await diskBucket.put('arquivo','antes');
 const primeiro=(await diskBucket.head('arquivo')).etag;
 await diskBucket.put('arquivo','depois');
 assert.notEqual((await diskBucket.head('arquivo')).etag,primeiro);
});

test('delete é idempotente e limpa os metadados',async()=>{
 await diskBucket.put('arquivo','x',{customMetadata:{owner:'a'}});
 await diskBucket.delete('arquivo');
 assert.equal(await diskBucket.head('arquivo'),null);
 assert.equal(metadata.size,0);
 await diskBucket.delete('arquivo'); // não pode lançar
});

test('tamanho declarado que não bate aborta e não deixa arquivo pela metade',async()=>{
 await assert.rejects(()=>diskBucket.put('parcial','abc',{size:99}),/size_mismatch/);
 assert.equal(await diskBucket.head('parcial'),null);
 assert.deepEqual(await readdir(storageDir),[],'sobrou temporário de upload abortado');
});

test('aceita ReadableStream, que é como o arquivo final é montado',async()=>{
 const stream=new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('parte1'));c.enqueue(new TextEncoder().encode('parte2'));c.close();}});
 await diskBucket.put('montado',stream,{size:12});
 assert.equal(await (await diskBucket.get('montado')).text(),'parte1parte2');
});

test('aceita Uint8Array',async()=>{
 await diskBucket.put('bytes',new Uint8Array([104,105]));
 assert.equal(await (await diskBucket.get('bytes')).text(),'hi');
});

test('arquivo copiado na mão, sem sidecar, ainda é servido',async()=>{
 // Restauração de backup ou cópia manual: melhor entregar com tipo genérico do
 // que tratar como inexistente.
 await writeFile(path.join(storageDir,'solto'),'conteudo');
 const object=await diskBucket.get('solto');
 assert.equal(await object.text(),'conteudo');
 assert.equal(object.httpMetadata.contentType,'application/octet-stream');
});

test('sem STORAGE_DIR a chamada falha em vez de escrever em lugar aleatório',async()=>{
 delete process.env.STORAGE_DIR;
 await assert.rejects(()=>diskBucket.put('x','y'),/storage_dir_missing/);
});
