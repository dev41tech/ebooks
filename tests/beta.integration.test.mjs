import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import { test, before, after } from 'node:test';
import { build } from 'esbuild';
import { Miniflare } from 'miniflare';
import { zipSync, strToU8 } from 'fflate';
import { readFile, readdir, mkdir, rm, writeFile } from 'node:fs/promises';
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
 for(const [name,file] of Object.entries({books:'admin/books',imports:'admin/imports',catalog:'catalog',content:'catalog/content',file:'catalog/file',favorites:'favorites',progress:'progress',profile:'profile',subscription:'subscription',master:'admin/master',recommendations:'recommendations',feedback:'feedback',reviews:'reviews',analytics:'analytics',beta:'admin/beta',backup:'admin/backup',session:'session'})) {
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
 assert.deepEqual((await (await routes.progress.GET()).json()).locations[publishedId],{position:1,progress:47,revision:1});
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

test('suggestions follow reading themes, exclude saved/read books and unpublished titles',async()=>{
 identity.email=reader;identity.cookie='';
 const fixtures=[
 ['rec-seed','Ansiedade sob controle','Ana','Livre','Ansiedade equilibrio emocional descanso respiracao','published','2026-09-01'],
 ['rec-related','Respirar para descansar','Beatriz','Livre','Ansiedade equilibrio emocional descanso respiracao','published','2026-09-02'],
 ['rec-cooking','Receitas de cozinha','Carlos','Culinaria','Receitas cozinha sabores ingredientes','published','2026-09-03'],
 ['rec-hidden','Ansiedade equilibrio','Ana','Livre','Ansiedade equilibrio emocional descanso respiracao','draft','2026-09-04']
 ];
 for(const [id,title,author,genre,description,status,date] of fixtures)await db.prepare('INSERT INTO books(id,title,author,genre,description,status,created_at,published_at) VALUES(?,?,?,?,?,?,?,?)').bind(id,title,author,genre,description,status,date,date).run();
 assert.equal((await routes.progress.POST(payload({bookId:'rec-seed',position:3,progress:20}))).status,200);
 let result=await (await routes.recommendations.GET()).json();
 assert.equal(result.recommendations[0].bookId,'rec-related');
 assert.match(result.recommendations[0].reason,/Temas próximos/);
 assert.ok(!result.recommendations.some(r=>['rec-seed','rec-hidden'].includes(r.bookId)));
 assert.equal((await routes.favorites.POST(payload({bookId:'rec-related',favorite:true}))).status,200);
 result=await (await routes.recommendations.GET()).json();assert.ok(!result.recommendations.some(r=>r.bookId==='rec-related'));
});
test('recent searches personalize only their owner and remain bounded',async()=>{
 identity.email=reader;
 for(let i=0;i<14;i++)assert.equal((await routes.recommendations.POST(payload({query:'consulta '+i}))).status,200);
 assert.equal((await routes.recommendations.POST(payload({query:'Receitas de cozinha'}))).status,200);
 assert.equal((await routes.recommendations.POST(payload({query:'Receitas de cozinha'}))).status,200);
 const rows=await db.prepare('SELECT query FROM discovery_searches WHERE user_email=?').bind(reader).all();assert.equal(rows.results.length,12);
 assert.equal(rows.results.filter(r=>r.query==='receitas de cozinha').length,1);
 const result=await (await routes.recommendations.GET()).json();assert.equal(result.recommendations[0].bookId,'rec-cooking');assert.match(result.recommendations[0].reason,/buscas recentes/);
 identity.email=admin;const other=await (await routes.recommendations.GET()).json();assert.ok(other.recommendations.every(r=>r.reason!=='Combina com suas buscas recentes'));
 identity.email=null;assert.equal((await routes.recommendations.GET()).status,401);
 assert.equal((await routes.recommendations.POST(payload({query:'Receitas'}))).status,401);
});

test('web and mobile resume the same position and stale device writes cannot overwrite it',async()=>{
 identity.email=reader;
 const web=(await (await routes.progress.GET()).json()).locations[publishedId];
 const mobile={...web};
 const response=await routes.progress.POST(payload({bookId:publishedId,position:25,progress:70,revision:mobile.revision}));assert.equal(response.status,200);
 const latest=(await response.json()).location;
 const stale=await routes.progress.POST(payload({bookId:publishedId,position:2,progress:10,revision:web.revision}));assert.equal(stale.status,409);assert.deepEqual((await stale.json()).location,latest);
 const reopened=await routes.progress.GET();assert.equal(reopened.headers.get('cache-control'),'no-store');assert.deepEqual((await reopened.json()).locations[publishedId],latest);
 const reread=await routes.progress.POST(payload({bookId:publishedId,position:12,progress:35,revision:latest.revision}));assert.equal(reread.status,200);
 assert.equal((await (await routes.progress.GET()).json()).locations[publishedId].position,12);
});

test('bulk uploads enter review together without invented authors or automatic publication',async()=>{
 identity.email=admin;await db.prepare('DELETE FROM master_attempts').run();
 const login=await routes.master.POST(masterRequest('login'));assert.equal(login.status,200);identity.cookie=login.headers.get('set-cookie').split(';')[0];
 const uploads=[];
 for(const fileName of ['Lote um.epub','Lote dois.epub']){
  const storageKey=`imports/direct/${fileName}`;
  await env.BUCKET.put(storageKey,epub,{httpMetadata:{contentType:'application/epub+zip'},customMetadata:{owner:admin}});
  uploads.push({fileName,storageKey,contentType:'application/epub+zip',fileSize:epub.length});
 }
 const form=new FormData();form.set('mode','batch');form.set('name','Lote sem planilha');form.set('uploadedFiles',JSON.stringify(uploads));
 form.set('manifest',new File([JSON.stringify(uploads.map(f=>({title:f.fileName,author:'',licenseType:'',fileName:f.fileName})))],'livros.json',{type:'application/json'}));
 const response=await routes.imports.POST(new Request('https://sambu.test/api',{method:'POST',body:form}));assert.equal(response.status,201);
 const data=await response.json();assert.equal(data.batch.errorItems,2);
 const rows=await db.prepare("SELECT * FROM staging_books WHERE file_name IN ('Lote um.epub','Lote dois.epub')").all();assert.equal(rows.results.length,2);
 for(const row of rows.results){assert.equal(row.published_book_id,null);assert.equal(row.rights_confirmed,0);assert.ok(row.storage_key);}
});

test('ebook deletion requires master and exact title, removes access and preserves source',async()=>{
 identity.email=admin;await db.prepare('DELETE FROM master_attempts').run();
 const login=await routes.master.POST(masterRequest('login'));identity.cookie=login.headers.get('set-cookie').split(';')[0];
 const staged=await stage('imports/direct/delete-test.epub');
 const result=await (await routes.imports.PATCH(review(staged))).json();const id=result.publishedBookId;
 identity.email=reader;assert.equal((await routes.books.DELETE(payload({id,confirmTitle:'Livro de teste'},'DELETE'))).status,403);
 identity.email=admin;assert.equal((await routes.books.DELETE(payload({id,confirmTitle:'errado'},'DELETE'))).status,400);
 assert.equal((await routes.books.DELETE(payload({id,confirmTitle:'Livro de teste'},'DELETE'))).status,200);
 assert.ok(!(await (await routes.books.GET()).json()).books.some(book=>book.id===id));
 assert.ok(!(await (await routes.catalog.GET(new Request('https://sambu.test/api'))).json()).books.some(book=>book.id===id));
 assert.ok(await env.BUCKET.head('imports/direct/delete-test.epub'));
 identity.email=reader;assert.notEqual((await routes.content.GET(new Request(`https://sambu.test/api?id=${id}`))).status,200);
});

test('open beta permits a new signed-in reader to save name and read without admin access',async()=>{
 env.SAMBU_BETA_OPEN='true';identity.email='new-beta-reader@example.test';identity.cookie='';
 try{
  assert.equal((await routes.profile.PATCH(payload({displayName:'Nova leitora'},'PATCH'))).status,200);
  assert.equal((await (await routes.profile.GET()).json()).profile.displayName,'Nova leitora');
  assert.equal((await routes.content.GET(new Request(`https://sambu.test/api?id=${publishedId}`))).status,200);
  assert.equal((await routes.books.GET()).status,403);
  assert.equal((await routes.master.POST(masterRequest('login'))).status,403);
  identity.email=null;assert.equal((await routes.content.GET(new Request(`https://sambu.test/api?id=${publishedId}`))).status,401);
 }finally{delete env.SAMBU_BETA_OPEN;}
});

test('named administration testers can manage books while other users and master credentials stay protected',async()=>{
 env.SAMBU_ADMIN_TESTER_EMAILS='admin-tester@example.test';identity.email='admin-tester@example.test';identity.cookie='';
 try{
  assert.equal((await routes.books.GET()).status,200);
  assert.equal((await routes.imports.GET(new Request('https://sambu.test/api'))).status,200);
  assert.equal((await routes.master.POST(masterRequest('setup'))).status,403);
  const response=await routes.books.POST(payload({title:'Teste colaborativo',author:'Testador',genre:'Teste',description:'Rascunho criado no teste'}));assert.equal(response.status,201);
  const {book}=await response.json();
  assert.equal((await routes.books.PATCH(payload({...book,title:'Teste alterado',status:'draft'},'PATCH'))).status,200);
  assert.equal((await routes.books.DELETE(payload({id:book.id,confirmTitle:'Teste alterado'},'DELETE'))).status,200);
  identity.email='uninvited-admin@example.test';assert.equal((await routes.books.GET()).status,403);
  identity.email=null;assert.equal((await routes.books.GET()).status,401);
  delete env.SAMBU_ADMIN_TESTER_EMAILS;identity.email='admin-tester@example.test';assert.equal((await routes.books.GET()).status,403);
  identity.email=admin;assert.equal((await routes.books.GET()).status,403);
 }finally{delete env.SAMBU_ADMIN_TESTER_EMAILS;}
});

test('expanded reader profile persists optional fields privately and rejects invalid names',async()=>{
 identity.email=reader;
 const tasteProfile={city:'Curitiba',region:'Paraná',language:'Português',genres:'Suspense',bio:'Leio à noite.'};
 assert.equal((await routes.profile.PATCH(payload({displayName:'Leitora',tasteProfile},'PATCH'))).status,200);
 assert.deepEqual((await (await routes.profile.GET()).json()).profile.tasteProfile,tasteProfile);
 assert.equal((await routes.profile.PATCH(payload({displayName:'Novo nome'},'PATCH'))).status,200);
 assert.deepEqual((await (await routes.profile.GET()).json()).profile.tasteProfile,tasteProfile);
 assert.equal((await routes.profile.PATCH(payload({displayName:{}},'PATCH'))).status,400);
 identity.email='other-profile@example.test';assert.equal((await (await routes.profile.GET()).json()).profile.tasteProfile,undefined);
});

test('chapter reads transfer 100 of 4000 paragraphs, preserve global positions and use ranged cache reads',async()=>{
 const entries={'META-INF/container.xml':strToU8('<container><rootfiles><rootfile full-path="book.opf"/></rootfiles></container>')};
 entries['book.opf']=strToU8('<package><manifest>'+Array.from({length:40},(_,i)=>`<item id="c${i}" href="c${i}.xhtml" media-type="application/xhtml+xml"/>`).join('')+'</manifest><spine>'+Array.from({length:40},(_,i)=>`<itemref idref="c${i}"/>`).join('')+'</spine></package>');
 for(let c=0;c<40;c++)entries[`c${c}.xhtml`]=strToU8(`<html><h1>Capítulo ${c+1} — Tema ${c+1}</h1><body>`+Array.from({length:100},(_,p)=>`<p>Texto português — ação e emoção, posição ${c*100+p}.</p>`).join('')+'</body></html>');
 identity.email=admin;identity.cookie='';await db.prepare('DELETE FROM master_attempts').run();
 const login=await routes.master.POST(masterRequest('login'));assert.equal(login.status,200);identity.cookie=login.headers.get('set-cookie').split(';')[0];
 const key='imports/direct/long-reader.epub';const staged=await stage(key,zipSync(entries));
 const published=await routes.imports.PATCH(review(staged));assert.equal(published.status,200);
 const bookId=(await published.json()).publishedBookId;
 identity.email=reader;
 const firstResponse=await routes.content.GET(new Request(`https://sambu.test/api?id=${bookId}&position=2555`));
 assert.equal(firstResponse.status,200);assert.equal(firstResponse.headers.get('cache-control'),'private, no-store');
 const first=await firstResponse.json();assert.equal('chapters' in first,false);
 assert.equal(first.reader.totalParagraphs,4000);assert.equal(first.reader.chapterCount,40);assert.equal(first.reader.chapter.index,25);
 assert.equal(first.reader.chapter.blocks.length,100);assert.equal(first.reader.chapter.blocks[0].position,2500);assert.equal(first.reader.chapter.blocks[55].position,2555);
 assert.equal(first.reader.chapter.navigationLabel,'Capítulo 26 · 40 capítulos');assert.equal(first.reader.chapter.blocks[0].chapterLabel,'Capítulo 26');assert.equal(first.reader.chapter.blocks[0].heading,'Tema 26');
 assert.match(first.reader.chapter.blocks[55].text,/ação e emoção, posição 2555/);
 const bucket=env.BUCKET,reads=[];
 env.BUCKET=new Proxy(bucket,{get(target,name){const value=Reflect.get(target,name);return typeof value==='function'?(...args)=>{if(name==='get')reads.push(args);return value.apply(target,args);}:value;}});
 try{
  const next=await (await routes.content.GET(new Request(`https://sambu.test/api?id=${bookId}&chapter=26`))).json();
  assert.equal(next.reader.chapter.blocks[0].position,2600);
  assert.ok(reads.some(([key,options])=>key.endsWith('.chapters')&&options.range.length>0));
  assert.ok(!reads.some(([k])=>k===key||k===`${key}.sambu-content.json`),'warm reads must not download full EPUB or cached full text');
 }finally{env.BUCKET=bucket;}
 for(const query of ['chapter=-1','chapter=40','position=abc','position=1&chapter=2']){
  assert.ok([400,404].includes((await routes.content.GET(new Request(`https://sambu.test/api?id=${bookId}&${query}`))).status));
 }
 const beyond=await (await routes.content.GET(new Request(`https://sambu.test/api?id=${bookId}&position=9000`))).json();assert.equal(beyond.reader.chapter.index,39);
 const full=await (await routes.content.GET(new Request(`https://sambu.test/api?id=${bookId}`))).json();assert.equal(full.chapters.length,40);
 // Reprocessing the cached source must invalidate the ranged reader cache.
 full.chapters[0].body[0]='Texto corrigido para a nova edição.';
 await env.BUCKET.put(`${key}.sambu-content.json`,JSON.stringify(full.chapters));
 const revised=await (await routes.content.GET(new Request(`https://sambu.test/api?id=${bookId}&chapter=0`))).json();assert.equal(revised.reader.chapter.blocks[0].text,'Texto corrigido para a nova edição.');
 identity.email=null;assert.equal((await routes.content.GET(new Request(`https://sambu.test/api?id=${bookId}&chapter=0`))).status,401);
 identity.email=reader;await db.prepare("UPDATE books SET status='archived' WHERE id=?").bind(bookId).run();assert.equal((await routes.content.GET(new Request(`https://sambu.test/api?id=${bookId}&chapter=0`))).status,404);
});


test('beta feedback requires identity, validates input, is idempotent and stays admin-only',async()=>{
 await db.prepare("UPDATE books SET status='published' WHERE id=?").bind(publishedId).run();
 const report={id:crypto.randomUUID(),bookId:publishedId,category:'chapter',message:'O capítulo apresenta um título repetido.',chapterLabel:'Capítulo 1',position:2,device:'mobile'};
 identity.email=null;assert.equal((await routes.feedback.POST(payload(report))).status,401);
 identity.email=reader;
 assert.equal((await routes.feedback.POST(payload({...report,message:'curto'}))).status,400);
 assert.equal((await routes.feedback.POST(payload(report))).status,201);
 assert.equal((await routes.feedback.POST(payload(report))).status,200);
 assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM beta_feedback').first()).n,1);
 assert.equal((await routes.beta.GET()).status,403);
 assert.equal((await routes.beta.PATCH(payload({id:report.id,status:'resolved'},'PATCH'))).status,403);
 identity.email=admin;identity.cookie='';await db.prepare('DELETE FROM master_attempts').run();
 const login=await routes.master.POST(masterRequest('login'));identity.cookie=login.headers.get('set-cookie').split(';')[0];
 const dashboard=await (await routes.beta.GET()).json();assert.equal(dashboard.counts.unresolved,1);
 assert.equal(dashboard.feedback[0].message,report.message);assert.equal('user_email' in dashboard.feedback[0],false);
 assert.equal((await routes.beta.PATCH(payload({id:report.id,status:'invalid'},'PATCH'))).status,400);
 assert.equal((await routes.beta.PATCH(payload({id:report.id,status:'resolved'},'PATCH'))).status,200);
 assert.equal((await (await routes.beta.GET()).json()).counts.unresolved,0);
 identity.email=reader;
 for(let i=0;i<9;i++)assert.equal((await routes.feedback.POST(payload({...report,id:crypto.randomUUID()}))).status,201);
 assert.equal((await routes.feedback.POST(payload({...report,id:crypto.randomUUID()}))).status,429);
});

test('book ratings are private, bounded, persistent and update rather than duplicate',async()=>{
 identity.email=reader;
 assert.equal((await routes.reviews.POST(payload({bookId:publishedId,rating:6,textRating:4,comment:''}))).status,400);
 assert.equal((await routes.reviews.POST(payload({bookId:publishedId,rating:4,textRating:3,comment:'Boa história.'}))).status,200);
 assert.equal((await routes.reviews.POST(payload({bookId:publishedId,rating:5,textRating:4,comment:'Gostei do final.'}))).status,200);
 const own=await (await routes.reviews.GET(new Request(`https://sambu.test/api?bookId=${publishedId}`))).json();assert.equal(own.review.rating,5);
 identity.email=admin;assert.equal((await (await routes.reviews.GET(new Request(`https://sambu.test/api?bookId=${publishedId}`))).json()).review,null);
 assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM reviews WHERE book_id=?').bind(publishedId).first()).n,1);
});

test('beta metrics deduplicate repeat opens and measure distinct-day returns without fabricated history',async()=>{
 identity.email=reader;
 const event={event:'reader_opened',bookId:publishedId};
 assert.equal((await routes.analytics.POST(payload(event))).status,201);await routes.analytics.POST(payload(event));
 assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM analytics_events WHERE event='reader_opened'").first()).n,1);
 assert.equal((await routes.analytics.POST(payload({...event,event:'invented'}))).status,400);
 identity.email=null;assert.equal((await routes.analytics.POST(payload(event))).status,401);
 await db.prepare('INSERT INTO analytics_events(id,user_email,event,book_id,created_at) VALUES(?,?,?,?,?)').bind('yesterday',reader,'reader_opened',publishedId,new Date(Date.now()-86400000).toISOString()).run();
 identity.email=admin;
 const data=await (await routes.beta.GET()).json();assert.equal(data.activity.activeReaders,1);assert.equal(data.activity.returningReaders,1);
 assert.equal(data.books.find(b=>b.id===publishedId).readers,1);assert.equal(data.books.find(b=>b.id===publishedId).ratings,1);
});

test('editorial check is read-only and publication stores automatic warnings',async()=>{
 identity.email=admin;
 const id=await stage('imports/direct/editorial.epub');
 const before=await db.prepare('SELECT status FROM staging_books WHERE id=?').bind(id).first();
 const check=await routes.imports.PATCH(formRequest({id,action:'check',title:'Título',author:'Autor'}));assert.equal(check.status,200);
 const report=(await check.json()).report;assert.equal(report.errors.length,0);assert.equal(report.sections,1);assert.ok(report.warnings.some(w=>w.includes('Capa')));assert.ok(report.warnings.some(w=>w.includes('Sumário')));
 assert.deepEqual(await db.prepare('SELECT status FROM staging_books WHERE id=?').bind(id).first(),before);
 assert.equal((await routes.imports.PATCH(review(id))).status,200);
 const stored=JSON.parse((await db.prepare('SELECT validation_errors AS value FROM staging_books WHERE id=?').bind(id).first()).value);assert.ok(stored.length>0);
 identity.email=reader;assert.equal((await routes.imports.PATCH(formRequest({id,action:'check'}))).status,403);
});

test('editorial alerts identify duplicated sections without rewriting source text',async()=>{
 identity.email=admin;
 const entries={
 'META-INF/container.xml':strToU8('<container><rootfiles><rootfile full-path="book.opf"/></rootfiles></container>'),
 'book.opf':strToU8('<package><manifest><item id="a" href="a.xhtml" media-type="application/xhtml+xml"/><item id="b" href="b.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="a"/><itemref idref="b"/></spine></package>'),
 'a.xhtml':strToU8('<html><body><h1>Capítulo 1</h1><p>Palavra que foi que- brada no texto original.</p></body></html>'),
 'b.xhtml':strToU8('<html><body><h1>Capítulo 1</h1><p>Palavra que foi que- brada no texto original.</p></body></html>')};
 const bytes=zipSync(entries),id=await stage('imports/direct/duplicate.epub',bytes);
 const result=await (await routes.imports.PATCH(formRequest({id,action:'check',title:'Teste',author:'Autora'}))).json();
 assert.ok(result.report.warnings.some(w=>w.includes('integralmente repetido')));
 assert.ok(result.report.warnings.some(w=>w.includes('título(s)')));
 assert.ok(result.report.warnings.some(w=>w.includes('hífen')));
 assert.deepEqual(new Uint8Array(await (await env.BUCKET.get('imports/direct/duplicate.epub')).arrayBuffer()),bytes);
});


test('pilot backup is master-only, contains product data and restores to an isolated directory',async()=>{
 const request=()=>new Request('https://sambu.test/api/admin/backup',{method:'POST',headers:{origin:'https://sambu.test'}});
 identity.email=reader;assert.equal((await routes.backup.POST(request())).status,403);
 identity.email='grazi.sam@hotmail.com';assert.equal((await routes.backup.POST(request())).status,403);
 identity.email=admin;identity.cookie='';assert.equal((await routes.backup.POST(request())).status,403);
 await db.prepare('DELETE FROM master_attempts').run();const login=await routes.master.POST(masterRequest('login'));identity.cookie=login.headers.get('set-cookie').split(';')[0];
 assert.equal((await routes.backup.POST(new Request('https://sambu.test/api/admin/backup',{method:'POST',headers:{origin:'https://other.test'}}))).status,403);
 const response=await routes.backup.POST(request());assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'application/zip');
 const archive=path.join(output,'backup.zip'),target=path.join(output,'restored');
 await writeFile(archive,new Uint8Array(await response.arrayBuffer()));
 const result=JSON.parse(execFileSync('python',['scripts/restore-pilot-backup.py',archive,target],{cwd:root,encoding:'utf8'}));
 assert.equal(result.integrity,'ok');assert.ok(result.assets>0);assert.equal(result.productionChanged,false);
 const snapshot=JSON.parse(await readFile(path.join(target,'snapshot.json'),'utf8'));
 assert.equal('master_credentials' in snapshot.tables,false);assert.equal('master_sessions' in snapshot.tables,false);
 assert.equal(snapshot.tables.books.length,(await db.prepare('SELECT COUNT(*) AS n FROM books').first()).n);
 assert.ok(snapshot.tables.reading_progress.length>0);assert.ok(snapshot.tables.profiles.length>0);
 assert.deepEqual(new Uint8Array(await readFile(path.join(target,'assets/imports/direct/valid.epub'))),epub);
 assert.throws(()=>execFileSync('python',['scripts/restore-pilot-backup.py',archive,target],{cwd:root,stdio:'pipe'}));
});

test('a new pilot reader can save a profile, open, resume and report without admin privileges',async()=>{
 env.SAMBU_BETA_OPEN='true';identity.email='pilot-new@example.test';identity.cookie='';
 assert.equal((await (await routes.session.GET()).json()).user.admin,false);
 assert.equal((await routes.profile.PATCH(payload({displayName:'Leitor piloto'},'PATCH'))).status,200);
 const page=await (await routes.content.GET(new Request(`https://sambu.test/api?id=${publishedId}&position=0`))).json();assert.ok(page.reader.chapter.blocks.length);
 const saved=await (await routes.progress.POST(payload({bookId:publishedId,position:1,progress:40,revision:0}))).json();assert.equal(saved.location.position,1);
 const resumed=await (await routes.progress.GET()).json();assert.equal(resumed.locations[publishedId].position,1);
 assert.equal((await routes.feedback.POST(payload({id:crypto.randomUUID(),bookId:publishedId,category:'layout',message:'Teste integrado do leitor piloto.',chapterLabel:'Capítulo 1',position:1,device:'mobile'}))).status,201);
 assert.equal((await routes.books.GET()).status,403);
});


test('backup rejects missing assets and fails the download if a source changes mid-copy',async()=>{
 identity.email=admin;await db.prepare('DELETE FROM master_attempts').run();const login=await routes.master.POST(masterRequest('login'));identity.cookie=login.headers.get('set-cookie').split(';')[0];
 const request=()=>new Request('https://sambu.test/api/admin/backup',{method:'POST',headers:{origin:'https://sambu.test'}});
 const old=await db.prepare('SELECT epub_key FROM books WHERE id=?').bind(publishedId).first();
 await db.prepare('UPDATE books SET epub_key=? WHERE id=?').bind('missing-source.epub',publishedId).run();
 try{const missing=await routes.backup.POST(request());assert.equal(missing.status,409);assert.equal((await missing.json()).error,'backup_missing_file');}finally{await db.prepare('UPDATE books SET epub_key=? WHERE id=?').bind(old.epub_key,publishedId).run();}
 const bucket=env.BUCKET;
 env.BUCKET=new Proxy(bucket,{get(target,name){const value=Reflect.get(target,name);return typeof value==='function'?(...args)=>{if(name==='get'&&args[0]==='imports/direct/valid.epub'&&args[1]?.onlyIf)return Promise.resolve(null);return value.apply(target,args);}:value;}});
 try{const changed=await routes.backup.POST(request());assert.equal(changed.status,200);await assert.rejects(()=>changed.arrayBuffer(),/backup_source_changed/);}finally{env.BUCKET=bucket;}
});
