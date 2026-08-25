# Migration 0001 — `ebook_drafts`

Runbook para aplicar a migration `drizzle/0001_ebook_drafts.sql` no Postgres.

> **Status: já aplicada em produção** (conforme o handoff de infraestrutura de 2026-08-25).
> Este runbook continua valendo para **ambientes novos** — staging, máquina local, ou uma
> reinstalação. Antes de rodar, confira com a query da seção
> [Como verificar se deu certo](#como-verificar-se-deu-certo): se as duas tabelas já
> aparecerem, não há nada a fazer.

> **Onde o Postgres vive.** A produção saiu do Cloudflare/D1 e hoje roda em Postgres próprio
> no VPS do EasyPanel — o Supabase ficou só com Auth e Storage. Existem **duas** connection
> strings e elas não são intercambiáveis: o app usa o host **interno** na 5432, e a migração
> feita da máquina do dev usa `vps.41tech.cloud` na **3308**. Se a senha tiver caractere
> especial, codifique (`@`→`%40`, `:`→`%3A`, `/`→`%2F`, `#`→`%23`, `%`→`%25`, `&`→`%26`) —
> em **ambas**.

## Por que ela é necessária

As telas novas do **Studio IA** (`app/studio-ia.tsx`) gravam o rascunho do ebook antes de ele virar
um livro publicado. As rotas `app/api/studio/ebooks/route.ts` e `app/api/studio/chapters/route.ts`
leem e escrevem nas duas tabelas criadas aqui.

**Enquanto a migration não rodar, essas telas quebram** — a API responde erro de relação inexistente
(`relation "ebook_drafts" does not exist`). O resto do site (catálogo, leitor, biblioteca, perfil)
não é afetado: nenhuma tabela existente é alterada.

## O que ela cria

| Objeto | Tipo | Função |
|---|---|---|
| `ebook_drafts` | tabela | Rascunho do ebook: tema, público, tom, nº de páginas, capa, material de referência, status |
| `ebook_draft_chapters` | tabela | Capítulos do rascunho (título, resumo, conteúdo, posição) |
| `ebook_draft_chapters_draft_id_ebook_drafts_id_fk` | foreign key | Liga o capítulo ao rascunho |
| `draft_chapter_position_idx` | índice único | Impede dois capítulos na mesma posição do mesmo rascunho |
| `ebook_drafts_owner_idx` | índice | Busca dos rascunhos por dono (`owner_email`) |

Só há `CREATE`. **Nenhuma tabela ou coluna existente é alterada ou removida** — não há risco para os
dados já em produção.

## Atenção: qual connection string usar

O Postgres roda no mesmo VPS do app. São **duas** strings, e elas **não** são intercambiáveis:

| Uso | Host | Porta |
|---|---|---|
| App em runtime | host **interno** (nome do serviço no EasyPanel) | `5432` |
| **Esta migration, rodada da máquina do dev** | **`vps.41tech.cloud`** | **`3308`** |

A 3308 é apenas o mapeamento externo da porta. Usar a externa no app faz o tráfego sair para a
internet e voltar para o container vizinho.

Se a senha tiver caractere especial, **codifique nas duas**: `@`→`%40`, `:`→`%3A`, `/`→`%2F`,
`#`→`%23`, `?`→`%3F`, `%`→`%25`, `&`→`%26`. Um `@` cru quebra a URL (ele separa credencial de host)
e o app falha com `28P01` — o que passa a falsa impressão de que a migration não rodou.

> **`drizzle-kit migrate` falha em silêncio** com credencial errada: imprime
> `Using 'postgres' driver...` e sai sem mensagem de erro. Não confie na saída — confirme as
> tabelas com a query de verificação abaixo. `drizzle-kit check` também não resolve: ele valida
> os arquivos de migração, não se foram aplicadas.
>
> Códigos úteis: `28P01` senha errada · `3D000` banco não existe · `ECONNREFUSED` porta fechada.

## Como aplicar

Escolha **uma** das três opções.

### Opção A — colar o SQL num cliente Postgres (mais simples)

Vale para qualquer cliente conectado ao banco `ebooks`: DBeaver, pgAdmin, TablePlus, ou o console
do próprio serviço Postgres no EasyPanel. Conecte com a string **externa** (`vps.41tech.cloud:3308`)
se for da sua máquina, cole e execute:

> Não use o SQL Editor do Supabase — desde a migração de infra o Supabase só cuida de Auth e
> Storage; o Postgres da aplicação é o do VPS e o editor de lá não o alcança.

```sql
CREATE TABLE IF NOT EXISTS "ebook_drafts" (
  "id" text PRIMARY KEY NOT NULL,
  "owner_email" text NOT NULL,
  "origin" text DEFAULT 'ia' NOT NULL,
  "category" text DEFAULT 'geral' NOT NULL,
  "title" text DEFAULT '' NOT NULL,
  "title_mode" text DEFAULT 'ai' NOT NULL,
  "subtitle" text DEFAULT '' NOT NULL,
  "theme" text NOT NULL,
  "audience" text DEFAULT '' NOT NULL,
  "tone" text DEFAULT 'Motivador' NOT NULL,
  "language" text DEFAULT 'Português (Brasil)' NOT NULL,
  "page_count" integer DEFAULT 20 NOT NULL,
  "words_per_page" integer DEFAULT 250 NOT NULL,
  "author_name" text DEFAULT '' NOT NULL,
  "author_bio" text DEFAULT '' NOT NULL,
  "extra_instructions" text DEFAULT '' NOT NULL,
  "reference_material" text DEFAULT '' NOT NULL,
  "reference_source" text DEFAULT '' NOT NULL,
  "cover_source" text DEFAULT 'none' NOT NULL,
  "cover_suggestion" text DEFAULT '' NOT NULL,
  "cover_key" text,
  "source_file_name" text,
  "source_storage_key" text,
  "intro" text DEFAULT '' NOT NULL,
  "conclusion" text DEFAULT '' NOT NULL,
  "marketing" jsonb,
  "status" text DEFAULT 'rascunho' NOT NULL,
  "status_message" text DEFAULT '' NOT NULL,
  "published_book_id" text,
  "created_at" text NOT NULL,
  "updated_at" text NOT NULL
);

CREATE TABLE IF NOT EXISTS "ebook_draft_chapters" (
  "id" text PRIMARY KEY NOT NULL,
  "draft_id" text NOT NULL,
  "position" integer NOT NULL,
  "title" text NOT NULL,
  "summary" text DEFAULT '' NOT NULL,
  "content" text DEFAULT '' NOT NULL,
  "created_at" text NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ebook_draft_chapters_draft_id_ebook_drafts_id_fk'
  ) THEN
    ALTER TABLE "ebook_draft_chapters"
      ADD CONSTRAINT "ebook_draft_chapters_draft_id_ebook_drafts_id_fk"
      FOREIGN KEY ("draft_id") REFERENCES "public"."ebook_drafts"("id")
      ON DELETE no action ON UPDATE no action;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "draft_chapter_position_idx"
  ON "ebook_draft_chapters" USING btree ("draft_id", "position");

CREATE INDEX IF NOT EXISTS "ebook_drafts_owner_idx"
  ON "ebook_drafts" USING btree ("owner_email");
```

> Este bloco é a versão **idempotente** (com `IF NOT EXISTS`) do arquivo
> `drizzle/0001_ebook_drafts.sql`, para poder ser executado sem quebrar caso alguém já tenha rodado
> parte dele. O arquivo original em `drizzle/` foi mantido como o drizzle-kit o gerou, para não
> invalidar o checksum do journal.

### Opção B — `psql`

```bash
psql "postgres://sambu:SENHA_CODIFICADA@vps.41tech.cloud:3308/ebooks" \
  -f drizzle/0001_ebook_drafts.sql
```

Aqui vale o arquivo original. Se já tiver sido aplicado antes, o comando falha em
`CREATE TABLE` — nesse caso use a Opção A.

### Opção C — `drizzle-kit migrate`

Aplica o que estiver pendente no journal e registra a aplicação:

```bash
DATABASE_URL="postgres://sambu:SENHA_CODIFICADA@vps.41tech.cloud:3308/ebooks" \
  npx drizzle-kit migrate
```

É a opção que mantém `drizzle/meta/_journal.json` em dia. Prefira esta se o fluxo do projeto já usa
drizzle-kit para as migrations.

**Confirme o resultado pela query de verificação, não pela saída do comando** — com credencial
errada o drizzle-kit sai sem erro nenhum, como se tivesse funcionado.

## Como verificar se deu certo

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('ebook_drafts', 'ebook_draft_chapters')
ORDER BY table_name;
```

Deve retornar as duas linhas:

```
ebook_draft_chapters
ebook_drafts
```

E os índices:

```sql
SELECT indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN ('draft_chapter_position_idx', 'ebook_drafts_owner_idx');
```

Depois disso, abrir o **Studio IA** no site e criar um rascunho deve funcionar.

## Rollback

Só se for necessário desfazer. **Apaga os rascunhos gravados** — confirme antes de rodar:

```sql
DROP TABLE IF EXISTS "ebook_draft_chapters";
DROP TABLE IF EXISTS "ebook_drafts";
```

A ordem importa: a tabela de capítulos referencia a de rascunhos.
