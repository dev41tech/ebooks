# Sambu Online — Fase 1

Fundação executável da plataforma literária: identidade visual responsiva, catálogo e busca, página de obra, Reader configurável, autenticação segura, progresso persistente em D1 e esquema inicial de dados.

Use `npm run dev` para desenvolvimento, `npm run lint` para análise e `npm test` para validação completa.

## Migrations pendentes

| Migration | Status | Runbook |
|---|---|---|
| `0001_ebook_drafts` | **precisa ser aplicada no Postgres** | [docs/MIGRATION-0001-ebook-drafts.md](docs/MIGRATION-0001-ebook-drafts.md) |

Sem ela as telas do Studio IA não funcionam — o restante do site não é afetado.
