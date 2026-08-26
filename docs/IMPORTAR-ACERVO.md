# Importar o acervo do Sambu Ebooks

Carrega no Sambu Online os ebooks já produzidos pelo Sambu Ebooks: sobe os
arquivos para o Supabase Storage e insere cada livro em `books` **já publicado**.

## Por que não usar o Import Center

O Import Center (`/api/admin/imports`) grava em `staging_books`, que **expira em
7 dias** se ninguém publicar. Este script pula a área de teste e publica direto —
é o caminho certo para uma carga inicial grande.

## Antes de rodar

O pacote com os arquivos é gerado a partir do Sambu Ebooks e fica em
`C:\Users\marcos.dias\sambu-import`:

```
sambu-import/
  acervo.json        <- metadados dos livros
  arquivos/          <- .epub, capas (.png/.jpg/.webp) e .mp3
```

São 29 livros, ~116 MB de EPUB, 19 com capa e 6 com audiobook.

## Rodar

```bash
node --env-file=.env scripts/importar-acervo.mjs --dir=C:/Users/marcos.dias/sambu-import
```

Variáveis exigidas no `.env`: `DATABASE_URL`, `SUPABASE_URL` e
`SUPABASE_SERVICE_ROLE_KEY` (opcional: `SUPABASE_STORAGE_BUCKET`, padrão `sambu`).

> **Use a `DATABASE_URL` externa** (`vps.41tech.cloud:3308`) ao rodar da sua
> máquina — a interna só resolve de dentro do container. Senha com caractere
> especial precisa ser codificada: `@`→`%40`, `:`→`%3A`, `/`→`%2F`, `#`→`%23`,
> `%`→`%25`, `&`→`%26`.

### Opções

| Flag | Efeito |
|---|---|
| `--dry-run` | mostra o que faria, sem gravar nada e sem exigir credencial |
| `--limit=N` | processa só os N primeiros — bom para testar com 1 ou 2 |
| `--dir=...` | caminho do pacote (padrão: `C:/Users/marcos.dias/sambu-import`) |

Sugestão: rode `--dry-run` primeiro, depois `--limit=1` para conferir um livro no
site, e só então a carga completa.

## É seguro repetir

O script é **idempotente**: antes de inserir, procura o `slug` em `books` e pula
se já existir. Se a execução cair no meio, é só rodar de novo — ele continua de
onde parou, sem duplicar.

## O que ele grava

Para cada livro: `epub_key`, `cover_key` e `audio_key` apontando para
`acervo/<uuid>/...` no Storage, mais os metadados, com `status = 'published'` e
`price_cents = 0`.

O `genre` vem da classificação nova do Sambu Ebooks — usa o **grupo** da
categoria principal (ex.: `Saúde e bem-estar`), porque `books.genre` é texto
único aqui.

## Limitação conhecida

`acervo.json` traz `classificacaoCompleta` e `categoriasSecundarias`, mas **o
script não grava esses campos: não há coluna para eles**. Enquanto o schema não
tiver subcategoria e secundárias (ou uma tabela de tags), a busca do site não
encontra os livros por essas categorias, ao contrário do que já funciona no
Sambu Ebooks. É o principal pendente do port.
