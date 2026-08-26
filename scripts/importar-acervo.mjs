#!/usr/bin/env node
// Importa o acervo do Sambu Ebooks para o Sambu Online.
//
// Sobe cada .epub (e capa/audio, quando existem) para o Supabase Storage e insere
// o livro em `books` ja publicado -- diferente do Import Center, que deixa tudo em
// staging_books com expiracao de 7 dias.
//
// Uso:
//   node --env-file=.env scripts/importar-acervo.mjs --dir=C:/Users/marcos.dias/sambu-import
//   node --env-file=.env scripts/importar-acervo.mjs --dir=... --dry-run
//
// Precisa no ambiente: DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
// Use a DATABASE_URL EXTERNA (vps.41tech.cloud:3308) ao rodar da sua maquina.
//
// E idempotente: livro cujo slug ja exista em `books` e pulado.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import postgres from "postgres";

const args = new Map(
  process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, "").split("=");
    return [k, v.length ? v.join("=") : true];
  }),
);
const DIR = String(args.get("dir") || "C:/Users/marcos.dias/sambu-import");
const DRY = !!args.get("dry-run");
const LIMITE = args.get("limit") ? Number(args.get("limit")) : Infinity;

const { DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "sambu";

function exigir(nome, valor) {
  if (!valor) {
    console.error(`Falta ${nome} no ambiente. Rode com: node --env-file=.env scripts/importar-acervo.mjs`);
    process.exit(1);
  }
}
if (!DRY) {
  exigir("DATABASE_URL", DATABASE_URL);
  exigir("SUPABASE_URL", SUPABASE_URL);
  exigir("SUPABASE_SERVICE_ROLE_KEY", SUPABASE_SERVICE_ROLE_KEY);
}

const manifesto = path.join(DIR, "acervo.json");
if (!fs.existsSync(manifesto)) {
  console.error(`Nao achei ${manifesto}. Confira o --dir.`);
  process.exit(1);
}
const livros = JSON.parse(fs.readFileSync(manifesto, "utf-8"));
const dirArquivos = path.join(DIR, "arquivos");

const MIME = {
  ".epub": "application/epub+zip",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
};

async function subir(chave, arquivo) {
  const base = SUPABASE_URL.replace(/\/+$/, "");
  const url = `${base}/storage/v1/object/${BUCKET}/${chave.split("/").map(encodeURIComponent).join("/")}`;
  const corpo = fs.readFileSync(arquivo);
  const ext = path.extname(arquivo).toLowerCase();
  const tipo = MIME[ext];
  if (!tipo) {
    // Subir como octet-stream faz o navegador baixar em vez de exibir a capa.
    throw new Error(`extensao ${ext} sem content-type mapeado (${path.basename(arquivo)})`);
  }
  const r = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "content-type": tipo,
      "x-upsert": "true",
    },
    body: corpo,
  });
  if (!r.ok) throw new Error(`upload ${chave} falhou: ${r.status} ${await r.text()}`);
}

const sql = DRY ? null : postgres(DATABASE_URL, { prepare: false });
const agora = new Date().toISOString();
let criados = 0, pulados = 0, erros = 0;

try {
  for (const [i, livro] of livros.entries()) {
    if (criados + pulados >= LIMITE) break;
    const rotulo = `[${i + 1}/${livros.length}] ${livro.title}`;

    if (!DRY) {
      const existe = await sql`SELECT id FROM books WHERE slug = ${livro.slug} LIMIT 1`;
      if (existe.length > 0) {
        console.log(`${rotulo} -> ja existe, pulando`);
        pulados++;
        continue;
      }
    }

    const epub = path.join(dirArquivos, livro.epubFile);
    if (!fs.existsSync(epub)) {
      console.log(`${rotulo} -> ERRO: ${livro.epubFile} nao encontrado`);
      erros++;
      continue;
    }

    const id = crypto.randomUUID();
    const prefixo = `acervo/${id}`;
    const epubKey = `${prefixo}/${livro.epubFile}`;
    const coverKey = livro.coverFile ? `${prefixo}/${livro.coverFile}` : null;
    const audioKey = livro.audioFile ? `${prefixo}/${livro.audioFile}` : null;

    if (DRY) {
      console.log(`${rotulo} -> [dry-run] subiria ${[livro.epubFile, livro.coverFile, livro.audioFile].filter(Boolean).join(", ")}`);
      criados++;
      continue;
    }

    try {
      await subir(epubKey, epub);
      if (coverKey) await subir(coverKey, path.join(dirArquivos, livro.coverFile));
      if (audioKey) await subir(audioKey, path.join(dirArquivos, livro.audioFile));

      await sql`
        INSERT INTO books (
          id, slug, title, subtitle, author, author_id, genre, language,
          featured, free_chapters, format, age_rating, description,
          price_cents, subscribers_only, cover_key, epub_key, audio_key,
          status, published_at, created_at, updated_at
        ) VALUES (
          ${id}, ${livro.slug}, ${livro.title}, ${livro.subtitle || null},
          ${livro.author}, ${"sambu-ebooks"}, ${livro.genre}, ${livro.language},
          ${false}, ${livro.freeChapters}, ${livro.format}, ${livro.ageRating},
          ${livro.description}, ${0}, ${false},
          ${coverKey}, ${epubKey}, ${audioKey},
          ${"published"}, ${agora}, ${agora}, ${agora}
        )`;
      console.log(`${rotulo} -> publicado${coverKey ? " (com capa)" : ""}${audioKey ? " (com audio)" : ""}`);
      criados++;
    } catch (e) {
      console.log(`${rotulo} -> ERRO: ${e.message}`);
      erros++;
    }
  }
} finally {
  if (sql) await sql.end();
}

console.log(`\npublicados: ${criados} | pulados: ${pulados} | erros: ${erros}`);
if (DRY) console.log("(dry-run: nada foi gravado)");
