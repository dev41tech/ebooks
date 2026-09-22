import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile,readdir} from 'node:fs/promises';
import {migrate} from '../scripts/migrate-vps.mjs';
function client(pg){
 const tagged=async(strings,...values)=>{
  const query=strings.reduce((s,part,i)=>s+(i?'$'+i:'')+part,'');
  return (await pg.query(query,values)).rows;
 };
 tagged.unsafe=async q=>(await pg.query(q)).rows;
 tagged.begin=fn=>pg.transaction(tx=>fn(client(tx)));
 return tagged;
}
test('VPS migration preserves existing categories, drafts and progress; reruns safely',async()=>{
 const pg=new PGlite();
 try{
  for(const file of (await readdir('drizzle')).filter(f=>/^000[0-2].*\.sql$/.test(f)).sort())await pg.exec(await readFile('drizzle/'+file,'utf8'));
  await pg.exec(`INSERT INTO books(id,slug,title,author,genre,description,category_main,categories_secondary,created_at) VALUES('existing','existing','Existing','Author','Romance','Book','literatura','["romance"]','2026-01-01');
   INSERT INTO ebook_drafts(id,owner_email,theme,created_at,updated_at) VALUES('draft','owner@example.test','Theme','2026-01-01','2026-01-01');
   INSERT INTO reading_progress(id,user_email,book_id,progress,updated_at) VALUES('progress','reader@example.test','existing',47,'2026-01-01');`);
  assert.equal(await migrate(client(pg)),'applied');assert.equal(await migrate(client(pg)),'already_applied');
  const book=(await pg.query('SELECT category_main,categories_secondary FROM books')).rows[0];assert.deepEqual(book,{category_main:'literatura',categories_secondary:['romance']});
  assert.equal((await pg.query('SELECT theme FROM ebook_drafts')).rows[0].theme,'Theme');
  assert.deepEqual((await pg.query('SELECT progress,position,revision FROM reading_progress')).rows[0],{progress:47,position:0,revision:0});
  await pg.exec(`INSERT INTO master_credentials(id,salt,password_hash,created_at) VALUES('master','test-salt','test-hash',0);
    CREATE ROLE test_anon;
    GRANT USAGE ON SCHEMA public TO test_anon;
    GRANT SELECT ON master_credentials TO test_anon;
    SET ROLE test_anon;`);
  assert.equal((await pg.query('SELECT count(*)::int AS n FROM master_credentials')).rows[0].n,0,'RLS must hide credentials even if Supabase grants table access');
  await pg.exec('RESET ROLE');
 }finally{await pg.close();}
});
