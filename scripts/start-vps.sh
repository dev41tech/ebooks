#!/bin/sh
set -eu

echo "Sambu: verificando as migrações do banco..."
node scripts/migrate-vps.mjs
echo "Sambu: banco atualizado; iniciando o aplicativo."
exec node server.js
