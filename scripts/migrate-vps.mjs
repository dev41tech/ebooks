import postgres from 'postgres';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const migrationNames = ['0002_book_classification', '0003_beta_r26_vps', '0004_auth_local'];

export async function migrate(sql) {
 const migrations = await Promise.all(migrationNames.map(async name => {
  const source = await readFile(new URL(`../drizzle/${name}.sql`, import.meta.url), 'utf8');
  return {name, source, checksum: createHash('sha256').update(source).digest('hex')};
 }));
 return sql.begin(async tx => {
  await tx`SELECT pg_advisory_xact_lock(410026)`;
  await tx`SET LOCAL search_path TO public`;
  // Upgrade the existing VPS schema; never initialize or replace its data.
  const prerequisites = await tx`SELECT to_regclass('public.books') AS books, to_regclass('public.ebook_drafts') AS drafts`;
  if (!prerequisites[0].books || !prerequisites[0].drafts) {
   throw new Error('Aplique as migrações 0000 e 0001 antes desta atualização.');
  }
  await tx`CREATE TABLE IF NOT EXISTS sambu_schema_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())`;
  const previous = await tx`SELECT name, checksum FROM sambu_schema_migrations`;
  for (const migration of migrations) {
   const recorded = previous.find(row => row.name === migration.name);
   if (recorded && recorded.checksum !== migration.checksum) {
    throw new Error(`Checksum divergente da migração aplicada: ${migration.name}.`);
   }
  }

  let applied = false;
  for (const {name, source, checksum} of migrations) {
   if (previous.some(row => row.name === name)) continue;
   for (let statement of source.split('--> statement-breakpoint').map(s => s.trim()).filter(Boolean)) {
    if (name === '0002_book_classification') {
     // 0002 may have been applied manually, fully or partially, without this journal.
     // Keep the original SQL/checksum and only make its additive DDL repeatable.
     statement = statement
      .replace(/^(ALTER TABLE "(?:books|ebook_drafts)" ADD COLUMN) /, '$1 IF NOT EXISTS ')
      .replace(/^CREATE INDEX "books_category_main_idx"/, 'CREATE INDEX IF NOT EXISTS "books_category_main_idx"');
    }
    await tx.unsafe(statement);
   }
   if (name === '0002_book_classification') {
    const columns = await tx`SELECT table_name, column_name, data_type FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name IN ('books', 'ebook_drafts')
     AND column_name IN ('category_main', 'categories_secondary')`;
    if (columns.length !== 4 || columns.some(column => column.data_type !== (column.column_name === 'category_main' ? 'text' : 'jsonb'))) {
     throw new Error('Campos de classificação incompatíveis com a migração 0002. Nenhum dado foi alterado.');
    }
   }
   await tx`INSERT INTO sambu_schema_migrations(name, checksum) VALUES(${name}, ${checksum})`;
   applied = true;
  }
  return applied ? 'applied' : 'already_applied';
 });
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL ausente');
 const sql=postgres(process.env.DATABASE_URL,{max:1,prepare:false});
 try{console.log(await migrate(sql));}finally{await sql.end();}
}
