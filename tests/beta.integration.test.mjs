import assert from 'node:assert/strict';
import { test, before, after } from 'node:test';
import { build } from 'esbuild';
import { Miniflare } from 'miniflare';
import { zipSync, strToU8 } from 'fflate';
import { readFile, readdir, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { env, identity } from './test-runtime.mjs';
const root = path.resolve(import.meta.dirname, '..');
const output = path.join(root, '.sites-runtime', 'api-tests');
const routes = {};
let runtime, db, publishedId, stagedId;
const admin = 'admin@example.test', reader = 'reader@example.test';
const payload = (body, method='POST') => new Request('https://sambu.test/api', { method, headers: {'content-type':'application/json'}, body:JSON.stringify(body) });
const formRequest = (fields,method='PATCH') => {const form=new FormData();for(const [key,value] of Object.entries(fields))form.set(key,String(value));return new Request('https://sambu.test/api',{method,body:form});};
const review = id => formRequest({id,action:'publish',title:'Livro de teste',author:'Autor de teste',genre:'Suspense',description:'Obra de teste para validar o fluxo.',licenseType:'Autorização do autor',rightsConfirmed:true});
const epub = zipSync({
 'META-INF/container.xml':strToU8('<container><rootfiles><rootfile full-path="book.opf"/></rootfiles></container>'),
 'book.opf':strToU8('<package><manifest><item id="one" href="one.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="one"/></spine></package>'),
 'one.xhtml':strToU8('<html><body><h1>Primeira parte</h1><p>Um texto original para testar a abertura.</p><p>Outro parágrafo para verificar a posição.</p></body></html>')
});
async function stage(key,bytes=epub) {
 await env.BUCKET.put(key,bytes,{httpMetadata:{contentType:'application/epub+zip'},customMetadata:{owner:admin}});
 const data=formRequest({mode:'individual',title:'Livro de teste',author:'Autor de teste',genre:'Suspense',description:'Obra de teste para validar o fluxo.',licenseType:'Autorização do autor',uploadedFiles:JSON.stringify([{fileName:'teste.epub',storageKey:key,contentType:'application/epub+zip',fileSize:bytes.length}])},'POST');
 const response=await routes.imports.POST(data);assert.equal(response.status,201);
 return (await db.prepare('SELECT id FROM staging_books WHERE storage_key = ?').bind(key).first()).id;
}
before(async()=>{
 await mkdir(output,{recursive:true});
 runtime=new Miniflare({modules:true,script:'export default {fetch(){return new Response("test")}}',compatibilityDate:'2026-05-01',d1Databases:{DB:'sambu-tests'},r2Buckets:['BUCKET']});
 db=await runtime.getD1Database('DB');
 Object.assign(env,{DB:db,BUCKET:await runtime.getR2Bucket('BUCKET'),SAMBU_AUTH_MODE:'sites',SAMBU_ADMIN_EMAILS:admin,SAMBU_BETA_EMAILS:reader});
 for(const name of (await readdir(path.join(root,'drizzle'))).filter(x=>x.endsWith('.sql')).sort()) {
   const sql=await readFile(path.join(root,'drizzle',name),'utf8');
   for(const statement of sql.split(';').map(s=>s.replace(/--> statement-breakpoint/g,'').trim()).filter(Boolean))await db.prepare(statement).run();
 }
 const runtimePath=path.join(root,'tests/test-runtime.mjs');
 for(const [name,file] of Object.entries({books:'admin/books',imports:'admin/imports',catalog:'catalog',content:'catalog/content',file:'catalog/file',favorites:'favorites',progress:'progress',profile:'profile',subscription:'subscription',master:'admin/master'})) {
  const outfile=path.join(output,`${name}.mjs`);
  await build({entryPoints:[path.join(root,`app/api/${file}/route.ts`)],outfile,bundle:true,platform:'node',format:'esm',packages:'external',plugins:[{name:'isolated-runtime',setup(b){b.onResolve({filter:/^(cloudflare:workers|next\/headers|next\/navigation)$/},()=>({path:runtimePath,external:true}));}}]});
  routes[name]=await import(pathToFileURL(outfile));
 }
 identity.email=admin;
 const setup=await routes.master.POST(new Request('https://sambu.test/api/admin/master',{method:'POST',headers:{'content-type':'application/json',origin:'https://sambu.test'},body:JSON.stringify({action:'setup',password:'Isolated-test-master-2026'})}));
 assert.equal(setup.status,200);identity.cookie=setup.headers.get('set-cookie').split(';')[0];
});
after(async()=>{await runtime?.dispose();await rm(output,{recursive:true,force:true});});
test('visitor and reader cannot administer; uninvited account cannot read',async()=>{
 identity.email=null;assert.equal((await routes.books.GET()).status,401);
 identity.email=reader;assert.equal((await routes.books.GET()).status,403);
 identity.email='outsider@example.test';assert.equal((await routes.content.GET(new Request('https://sambu.test/api?id=unknown'))).status,403);
});
test('publication is valid, repeatable and does not duplicate the book',async()=>{
 identity.email=admin;stagedId=await stage('imports/direct/valid.epub');
 const responses=await Promise.all([routes.imports.PATCH(review(stagedId)),routes.imports.PATCH(review(stagedId))]);
 for(const response of responses)assert.equal(response.status,200);
 const values=await Promise.all(responses.map(r=>r.json()));publishedId=values[0].publishedBookId;assert.equal(publishedId,values[1].publishedBookId);
 assert.equal((await db.prepare('SELECT count(*) AS n FROM books').first()).n,1);
 assert.ok(await env.BUCKET.head('imports/direct/valid.epub.sambu-content.json'));
});
test('public catalog excludes drafts even when requested and omits storage keys',async()=>{
 identity.email=admin;const r=await routes.books.POST(payload({title:'Rascunho',author:'Autor',genre:'Romance',description:'Descrição',status:'published'}));assert.equal(r.status,201);
 identity.email=null;const list=await (await routes.catalog.GET(new Request('https://sambu.test/api?status=draft'))).json();assert.equal(list.books.length,1);assert.equal(list.books[0].id,publishedId);assert.equal('epubKey' in list.books[0],false);
});
test('published import cannot be deleted and its file survives',async()=>{
 identity.email=admin;assert.equal((await routes.imports.DELETE(new Request(`https://sambu.test/api?id=${stagedId}`))).status,409);assert.ok(await env.BUCKET.head('imports/direct/valid.epub'));
});
test('invited reader gets content but visitor does not',async()=>{
 identity.email=null;assert.equal((await routes.file.GET(new Request(`https://sambu.test/api?id=${publishedId}`))).status,401);
 identity.email=reader;const r=await routes.content.GET(new Request(`https://sambu.test/api?id=${publishedId}`));assert.equal(r.status,200);assert.equal((await r.json()).chapters[0].body.length,2);
});
test('favorites persist, remain unique and can be removed',async()=>{
 identity.email=reader;for(let i=0;i<2;i++)assert.equal((await routes.favorites.POST(payload({bookId:publishedId,favorite:true}))).status,200);
 assert.deepEqual((await (await routes.favorites.GET()).json()).favorites,[publishedId]);
 await routes.favorites.POST(payload({bookId:publishedId,favorite:false}));assert.deepEqual((await (await routes.favorites.GET()).json()).favorites,[]);
});
test('reading position persists independently of percentage and rejects invalid values',async()=>{
 identity.email=reader;assert.equal((await routes.progress.POST(payload({bookId:publishedId,position:1,progress:47}))).status,200);
 assert.deepEqual((await (await routes.progress.GET()).json()).locations[publishedId],{position:1,progress:47});
 assert.equal((await routes.progress.POST(payload({bookId:publishedId,position:-1,progress:150}))).status,400);
});
test('profile PATCH persists name without granting admin access',async()=>{
 identity.email=reader;assert.equal((await routes.profile.PATCH(payload({displayName:'Leitor do beta',role:'admin'},'PATCH'))).status,200);
 const p=await (await routes.profile.GET()).json();assert.equal(p.profile.displayName,'Leitor do beta');assert.equal(p.profile.role,'reader');assert.equal((await routes.books.GET()).status,403);
});
test('invalid EPUB cannot be published',async()=>{
 identity.email=admin;const id=await stage('imports/direct/invalid.epub',strToU8('arquivo inválido'));assert.equal((await routes.imports.PATCH(review(id))).status,422);
 assert.equal((await db.prepare("SELECT count(*) AS n FROM books WHERE status='published'").first()).n,1);
});
test('archiving an unpublished import preserves its source file',async()=>{
 identity.email=admin;const id=await stage('imports/direct/archive.epub');assert.equal((await routes.imports.DELETE(new Request(`https://sambu.test/api?id=${id}`))).status,200);assert.ok(await env.BUCKET.head('imports/direct/archive.epub'));assert.equal((await db.prepare('SELECT status FROM staging_books WHERE id=?').bind(id).first()).status,'archived');
});
test('beta does not create a fake subscription',async()=>{
 identity.email=reader;assert.equal((await routes.subscription.POST(payload({plan:'immersive_monthly'}))).status,409);assert.equal((await db.prepare('SELECT count(*) AS n FROM subscriptions').first()).n,0);
});

const masterRequest = (action,password='Isolated-test-master-2026',origin='https://sambu.test') => new Request('https://sambu.test/api/admin/master',{method:'POST',headers:{'content-type':'application/json',origin},body:JSON.stringify({action,password})});
test('master session requires allowlisted identity, valid cookie and same-origin login',async()=>{
 identity.email=admin;const saved=identity.cookie;identity.cookie='';
 assert.equal((await routes.books.GET()).status,403);
 assert.equal((await routes.master.GET()).status,200);
 assert.equal((await routes.master.POST(masterRequest('login','Isolated-test-master-2026','https://evil.test'))).status,403);
 assert.equal((await routes.master.POST(masterRequest('login','Wrong-password-2026'))).status,401);
 const success=await routes.master.POST(masterRequest('login'));assert.equal(success.status,200);
 const cookie=success.headers.get('set-cookie');assert.match(cookie,/HttpOnly/);assert.match(cookie,/Secure/);assert.match(cookie,/SameSite=Strict/);
 identity.cookie=cookie.split(';')[0];assert.equal((await routes.books.GET()).status,200);
 identity.email=reader;assert.equal((await routes.master.POST(masterRequest('login'))).status,403);
 identity.email=admin;assert.equal((await routes.master.POST(masterRequest('setup'))).status,409);
 assert.equal((await routes.master.POST(masterRequest('logout'))).status,200);
 assert.equal((await routes.books.GET()).status,403);
 identity.cookie=saved;await db.prepare('UPDATE master_sessions SET expires_at=0').run();
 assert.equal((await routes.books.GET()).status,403);
});
test('master login limits repeated failures and does not store cleartext passwords',async()=>{
 identity.email=admin;identity.cookie='';await db.prepare('DELETE FROM master_attempts').run();
 for(let i=0;i<5;i++)assert.equal((await routes.master.POST(masterRequest('login','Wrong-password-2026'))).status,401);
 assert.equal((await routes.master.POST(masterRequest('login'))).status,429);
 const credential=await db.prepare('SELECT * FROM master_credentials').first();
 assert.equal(credential.password_hash.length,64);assert.notEqual(credential.password_hash,'Isolated-test-master-2026');
});
