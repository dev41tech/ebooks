# Sambu Online — Fase 1

Fundação executável da plataforma literária: identidade visual responsiva, catálogo e busca, página de obra, Reader configurável, autenticação segura, progresso persistente em Postgres e esquema inicial de dados.

Use `npm run dev` para desenvolvimento, `npm run lint` para análise e `npm test` para validação completa.

## Migrations

| Migration | Status | Runbook |
|---|---|---|
| `0000_hard_kree` | aplicada | — |
| `0001_ebook_drafts` | aplicada em produção (conforme handoff de 2026-08-25) | [docs/MIGRATION-0001-ebook-drafts.md](docs/MIGRATION-0001-ebook-drafts.md) |

O runbook segue válido para subir um ambiente novo (staging, máquina local). Para
confirmar em segundos se as tabelas existem num banco:

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('ebook_drafts', 'ebook_draft_chapters');
```

Duas linhas = aplicada. O SQL do runbook é idempotente, então rodar de novo por
engano não quebra nada.
