# Armazenamento em disco

Alternativa ao Supabase Storage: os arquivos (EPUB, capas, partes de upload)
passam a viver num volume da própria VPS. O banco continua no Postgres e o
**Auth continua no Supabase** — só o Storage muda.

---

## Por que existe

O projeto Supabase configurado deixou de existir. O host do projeto devolve
**NXDOMAIN**, e essa é a diferença que decide o plano: um projeto *pausado*
continua resolvendo em DNS e responde com erro; NXDOMAIN significa projeto
apagado, ou referência errada. Não há o que reativar.

O sintoma era `GET /api/admin/uploads` → `503 storage_unavailable`, com a
importação parando em 0 de 21 livros. `storage_unavailable` sai só de
`transportError` em `db/storage-service.ts`, ou seja, a requisição nunca chegou
ao Supabase — o `reason` no log distingue DNS, recusa, tempo limite e
certificado.

## Como ligar

Duas variáveis no EasyPanel:

| Variável | Valor |
|---|---|
| `STORAGE_DRIVER` | `disk` |
| `STORAGE_DIR` | caminho do volume montado, ex. `/app/storage` |

E **um volume montado** em `STORAGE_DIR`. Sem `STORAGE_DRIVER=disk` nada muda:
o default continua `supabase`, para que um deploy sem a variável se comporte
exatamente como antes.

### O volume não é detalhe de implantação

Sem volume, o diretório vive na camada gravável do contêiner e **some a cada
deploy**. Foi exatamente assim que o app irmão (`dev41tech/sambu_ebook`) perdeu
todo o acervo em 2026-08-26: os caminhos eram fixos em código, nada estava
montado, e cada deploy criava um contêiner novo. O disco não é mais seguro que o
Supabase por natureza — é mais seguro por estar montado.

Se `STORAGE_DIR` não estiver definida, a chamada falha com `storage_dir_missing`
em vez de gravar num caminho arbitrário.

## Como funciona

`db/storage.ts` escolhe o driver e exporta o mesmo `bucket` de sempre
(`head`/`get`/`put`/`delete`), então `env.BUCKET` não muda para quem chama. O
driver Supabase segue intacto e testado.

Um objeto vira dois arquivos: o conteúdo e um `.meta` ao lado, com `contentType`
e `etag`. Os metadados do usuário (`customMetadata`) continuam no Postgres, na
tabela `storage_metadata`, como já era — `db/storage-meta.ts` guarda essa parte,
compartilhada pelos dois drivers.

Três decisões que valem registro:

**O etag é hash do conteúdo**, calculado na escrita. Derivar de tamanho+mtime
seria mais barato, mas quebraria `onlyIf` depois de qualquer restauração de
backup — que é justamente quando ele importa. `onlyIf` é usado em
`app/lib/pilot-backup.ts` e em `app/api/admin/catalog-transfer/route.ts`.

**A escrita é atômica**: grava em `.part` e renomeia. Um deploy no meio de um
upload de 200 MB deixaria o arquivo final pela metade, e a leitura seguinte o
trataria como válido.

**A chave é validada antes de virar caminho.** No Supabase isso evitava montar
uma URL absurda; no disco é a fronteira de segurança — uma chave com `..`
escreveria fora da pasta. Há uma segunda checagem no caminho resolvido, que é a
única que sobrevive a alguém afrouxar a primeira.

## Voltar atrás

Trocar `STORAGE_DRIVER` para `supabase` (ou remover a variável) e implantar. O
código do transporte REST não foi removido.

Os arquivos **não migram sozinhos** entre os dois: o que foi gravado em disco
fica no disco. Como o projeto Supabase não existe mais, não há acervo lá para
trazer — os 21 livros vêm do ZIP na importação.

## Testes

`tests/storage-disk.test.mjs`, 14 casos, cobrindo travessia de caminho, leitura
por range, `onlyIf`, escrita atômica com tamanho declarado, `ReadableStream`, e
arquivo copiado na mão sem sidecar. Roda em `npm run test:integration`, junto do
teste do driver Supabase.
