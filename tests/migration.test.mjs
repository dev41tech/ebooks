import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile,readdir,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
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
  // The previous runner recorded only 0003; adopting 0002 must not reapply 0003.
  await pg.exec("DELETE FROM sambu_schema_migrations WHERE name='0002_book_classification'");
  assert.equal(await migrate(client(pg)), 'applied');
  assert.equal(await migrate(client(pg)), 'already_applied');
  await pg.exec(`INSERT INTO master_credentials(id,salt,password_hash,created_at) VALUES('master','test-salt','test-hash',0);
    CREATE ROLE test_anon;
    GRANT USAGE ON SCHEMA public TO test_anon;
    GRANT SELECT ON master_credentials TO test_anon;
    SET ROLE test_anon;`);
  assert.equal((await pg.query('SELECT count(*)::int AS n FROM master_credentials')).rows[0].n,0,'RLS must hide credentials even if Supabase grants table access');
  await pg.exec('RESET ROLE');
 }finally{await pg.close();}
});

async function baseSchema(pg) {
 for (const file of ['0000_hard_kree.sql', '0001_ebook_drafts.sql']) {
  await pg.exec(await readFile('drizzle/' + file, 'utf8'));
 }
 await pg.exec(`INSERT INTO books(id,title,author,genre,description,created_at) VALUES('legacy','Legacy','Author','Romance','Original description','2026-01-01');
  INSERT INTO ebook_drafts(id,owner_email,theme,created_at,updated_at) VALUES('draft','owner@example.test','Original theme','2026-01-01','2026-01-01');
  INSERT INTO reading_progress(id,user_email,book_id,progress,updated_at) VALUES('progress','reader@example.test','legacy',54,'2026-01-01');`);
}

test('missing 0002 is applied before beta; a failure rolls everything back and allows retry', async () => {
 const pg = new PGlite();
 try {
  await baseSchema(pg);
  // A conflicting beta table forces a failure after 0002 has run in the transaction.
  await pg.exec('CREATE TABLE beta_feedback (legacy_value text)');
  await assert.rejects(migrate(client(pg)), /beta_feedback.*already exists/);
  assert.equal((await pg.query(`SELECT count(*)::int AS n FROM information_schema.columns
   WHERE table_name='books' AND column_name='category_main'`)).rows[0].n, 0);
  assert.equal((await pg.query("SELECT to_regclass('public.sambu_schema_migrations') AS journal")).rows[0].journal, null);
  await pg.exec('DROP TABLE beta_feedback');

  assert.equal(await migrate(client(pg)), 'applied');
  assert.equal(await migrate(client(pg)), 'already_applied');
  assert.deepEqual((await pg.query('SELECT name FROM sambu_schema_migrations ORDER BY name')).rows.map(row => row.name),
   ['0002_book_classification', '0003_beta_r26_vps']);
  assert.deepEqual((await pg.query('SELECT title,description,category_main,categories_secondary FROM books')).rows[0],
   {title:'Legacy', description:'Original description', category_main:null, categories_secondary:null});
  assert.deepEqual((await pg.query('SELECT theme,category_main,categories_secondary FROM ebook_drafts')).rows[0],
   {theme:'Original theme', category_main:null, categories_secondary:null});
  assert.deepEqual((await pg.query('SELECT progress,position,revision FROM reading_progress')).rows[0],
   {progress:54, position:0, revision:0});
  assert.ok((await pg.query("SELECT to_regclass('public.books_category_main_idx') AS name")).rows[0].name);

  await pg.exec("UPDATE sambu_schema_migrations SET checksum='modified' WHERE name='0003_beta_r26_vps'");
  await assert.rejects(migrate(client(pg)), /Checksum divergente.*0003_beta_r26_vps/);
 } finally { await pg.close(); }
});

test('partially applied 0002 preserves classifications and validates existing column types', async () => {
 const pg = new PGlite();
 try {
  await baseSchema(pg);
  await pg.exec(`ALTER TABLE books ADD COLUMN category_main text;
   CREATE INDEX books_category_main_idx ON books(category_main);
   UPDATE books SET category_main='literatura';
   ALTER TABLE ebook_drafts ADD COLUMN categories_secondary text;
   UPDATE ebook_drafts SET categories_secondary='["romance"]';`);
  await assert.rejects(migrate(client(pg)), /Campos de classificação incompatíveis/);
  assert.equal((await pg.query('SELECT category_main FROM books')).rows[0].category_main, 'literatura');
  assert.equal((await pg.query("SELECT to_regclass('public.beta_feedback') AS feedback")).rows[0].feedback, null);

  await pg.exec('ALTER TABLE ebook_drafts ALTER COLUMN categories_secondary TYPE jsonb USING categories_secondary::jsonb');
  assert.equal(await migrate(client(pg)), 'applied');
  assert.equal(await migrate(client(pg)), 'already_applied');
  assert.equal((await pg.query('SELECT category_main FROM books')).rows[0].category_main, 'literatura');
  assert.deepEqual((await pg.query('SELECT categories_secondary FROM ebook_drafts')).rows[0].categories_secondary, ['romance']);
 } finally { await pg.close(); }
});

test('container starts the server only after a successful migration', async () => {
 const directory = await mkdtemp(join(tmpdir(), 'sambu-startup-'));
 try {
  const calls = join(directory, 'calls');
  await writeFile(join(directory, 'node'), `#!/bin/sh
printf '%s\\n' "$1" >> "$CALL_LOG"
if [ "$1" = "scripts/migrate-vps.mjs" ]; then exit "$MIGRATE_EXIT"; fi
exit 0
`, {mode:0o700});
  const script = fileURLToPath(new URL('../scripts/start-vps.sh', import.meta.url));
  const env = {...process.env, PATH:directory + ':' + process.env.PATH, CALL_LOG:calls, MIGRATE_EXIT:'0'};
  const success = spawnSync('sh', [script], {cwd:directory, env, encoding:'utf8'});
  assert.equal(success.status, 0, success.stderr);
  assert.equal(await readFile(calls, 'utf8'), 'scripts/migrate-vps.mjs\nserver.js\n');
  await writeFile(calls, '');
  const failure = spawnSync('sh', [script], {cwd:directory, env:{...env, MIGRATE_EXIT:'7'}, encoding:'utf8'});
  assert.equal(failure.status, 7);
  assert.equal(await readFile(calls, 'utf8'), 'scripts/migrate-vps.mjs\n');
 } finally { await rm(directory, {recursive:true, force:true}); }
});
