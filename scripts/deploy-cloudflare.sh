#!/usr/bin/env bash
# Deploy do Sambu para Cloudflare Workers.
#
# Runtime e banco continuam na Cloudflare (Workers + D1, plano gratuito, sem
# cartao). O storage de arquivos foi movido para o Supabase, entao o binding R2
# nao existe mais -- ver db/storage.ts.
#
# O build (vite + @cloudflare/vite-plugin) ja emite dist/server/wrangler.json,
# porem com os placeholders do control plane da OpenAI. Este script rebuilda e
# corrige antes do deploy:
#   1. database_id do D1 (vem como 0000...0000 no artefato)
#   2. remove o binding R2 herdado do template
#   3. binding IMAGES, usado por worker/index.ts e ausente no config gerado
#   4. SUPABASE_URL / SUPABASE_STORAGE_BUCKET como vars publicas
#
# A service role key NAO entra aqui. Ela e secret, definida uma unica vez com:
#   npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY -c dist/server/wrangler.json
set -euo pipefail

D1_NAME="${D1_NAME:-sambu-d1}"
CONFIG="dist/server/wrangler.json"

: "${D1_ID:?Defina D1_ID com o UUID do banco (npx wrangler d1 list)}"
: "${SUPABASE_URL:?Defina SUPABASE_URL, ex: https://xxxx.supabase.co}"
: "${SUPABASE_ANON_KEY:?Defina SUPABASE_ANON_KEY (chave publica, painel > API)}"
: "${ADMIN_EMAILS:?Defina ADMIN_EMAILS separados por virgula}"
SUPABASE_STORAGE_BUCKET="${SUPABASE_STORAGE_BUCKET:-sambu}"

echo "==> Build"
npm run build

echo "==> Ajustando ${CONFIG}"
node --input-type=module - \
  "$CONFIG" "$D1_ID" "$D1_NAME" "$SUPABASE_URL" "$SUPABASE_STORAGE_BUCKET" \
  "$SUPABASE_ANON_KEY" "$ADMIN_EMAILS" <<'NODE'
import { readFile, writeFile } from "node:fs/promises";

const [file, d1Id, d1Name, supabaseUrl, supabaseBucket, anonKey, adminEmails] =
  process.argv.slice(2);
const config = JSON.parse(await readFile(file, "utf8"));

config.d1_databases = [
  { binding: "DB", database_name: d1Name, database_id: d1Id },
];
config.r2_buckets = [];
// worker/index.ts usa env.IMAGES para /_vinext/image
config.images = { binding: "IMAGES" };
config.vars = {
  ...config.vars,
  SUPABASE_URL: supabaseUrl,
  SUPABASE_STORAGE_BUCKET: supabaseBucket,
  SUPABASE_ANON_KEY: anonKey,
  ADMIN_EMAILS: adminEmails,
};

await writeFile(file, JSON.stringify(config, null, 2));
console.log(`  D1        ${d1Name} (${d1Id})`);
console.log(`  R2        removido`);
console.log(`  IMAGES    binding adicionado`);
console.log(`  Supabase  ${supabaseUrl} bucket=${supabaseBucket}`);
console.log(`  Admins    ${adminEmails}`);
NODE

echo "==> Deploy"
npx wrangler deploy -c "$CONFIG"
