import postgres from 'postgres';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const file=new URL('../drizzle/0003_beta_r26_vps.sql',import.meta.url);
export async function migrate(sql){
 const source=await readFile(file,'utf8'),checksum=createHash('sha256').update(source).digest('hex');
 return sql.begin(async tx=>{
  await tx`SELECT pg_advisory_xact_lock(410026)`;
  // Existing VPS schema is required. This command never initializes/replaces data.
  const prerequisites=await tx`SELECT to_regclass('public.books') AS books,to_regclass('public.ebook_drafts') AS drafts`;
  if(!prerequisites[0].books||!prerequisites[0].drafts)throw new Error('Aplique as migrações 0000–0002 antes desta atualização.');
  const columns=await tx`SELECT column_name FROM information_schema.columns WHERE table_name='books' AND table_schema='public' AND column_name='category_main'`;
  if(!columns.length)throw new Error('Migração 0002 ausente.');
  await tx`CREATE TABLE IF NOT EXISTS sambu_schema_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())`;
  const previous=await tx`SELECT checksum FROM sambu_schema_migrations WHERE name='0003_beta_r26_vps'`;
  if(previous.length){if(previous[0].checksum!==checksum)throw new Error('Checksum divergente da migração aplicada.');return 'already_applied';}
  for(const statement of source.split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean))await tx.unsafe(statement);
  await tx`INSERT INTO sambu_schema_migrations(name,checksum) VALUES('0003_beta_r26_vps',${checksum})`;
  return 'applied';
 });
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL ausente');
 const sql=postgres(process.env.DATABASE_URL,{max:1,prepare:false});
 try{console.log(await migrate(sql));}finally{await sql.end();}
}
