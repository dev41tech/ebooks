# Backup e restauração do piloto Sambu

## Criar a cópia

No navegador web, entrar com a conta do proprietário, desbloquear a senha master e usar Administração → Acompanhar beta → Preparar o piloto → Baixar backup de dados e acervo.

O arquivo ZIP inclui uma cópia transacional das 16 tabelas de produto e os arquivos referenciados pelo acervo, importações e registros de mídia. Inclui textos processados persistidos quando existentes; índices de capítulos regeneráveis não são necessários. Cada arquivo é verificado pelo ETag antes da leitura e pelo tamanho ao concluir a cópia. O ZIP registra CRC por entrada.

O limite desta exportação é de 5.000 registros por tabela, 200 arquivos de origem referenciados, 250 MB de arquivos e 10 MB de dados JSON. Ultrapassar o limite ou encontrar uma referência ausente interrompe o backup em vez de omitir dados silenciosamente. Evite alterações no acervo durante a exportação: a transação do banco e o armazenamento de arquivos não têm uma transação distribuída única.

A cópia é um download manual. Não existe agendamento, retenção automática nem cópia externa contratada nesta entrega. Guarde o ZIP fora do acesso público e em armazenamento restrito. Ele contém informações pessoais dos leitores. Não o envie ao repositório de código.

## O que não está incluído

- Senhas, credenciais master, sessões de login e tentativas de acesso.
- Segredos e configurações do ambiente de hospedagem (listas de acesso incluídas).
- Código-fonte, já mantido separadamente no histórico do projeto.
- Uploads órfãos que não estejam referenciados no banco.
- Caches de capítulos que podem ser reconstruídos.

Assim, este é um backup de **dados do produto e acervo vinculado**, e não uma imagem completa da infraestrutura.

## Ensaio em pasta nova, sem afetar a produção

Requisitos do operador: código do projeto e Python 3. Usar exclusivamente um ZIP exportado pelo próprio Sambu. O script se recusa a sobrescrever uma pasta existente.

```bash
python scripts/restore-pilot-backup.py /caminho/Sambu-backup.zip /caminho/ensaio-sambu-novo
```

O script verifica estrutura e CRC do ZIP, rejeita caminhos que escapem da pasta, recria um banco SQLite local, importa os registros, verifica integridade/referências e extrai os arquivos. A pasta de saída contém:

- `data.sqlite`: dados de produto restaurados.
- `assets/`: arquivos originais com as mesmas chaves relativas.
- `snapshot.json`: esquema, dados, inventário e metadados dos arquivos.
- `verification.json`: resultado da restauração local.

Além do resultado automático, abrir uma amostra de EPUB/PDF, comparar a quantidade de livros publicados e conferir posições de leitura. Registrar data, responsável e localização privada da cópia.

A promoção da cópia para uma hospedagem real exige um operador: restaurar as tabelas no esquema correspondente, enviar os arquivos e metadados para o armazenamento, configurar as listas de acesso e segredos e restabelecer a credencial master por procedimento seguro. Não há botão público de restauração nem alteração automática do ambiente ativo.

## Evidência e limites

O teste automatizado desta entrega exporta dados/arquivos fictícios, restaura em uma pasta isolada e compara contagens e bytes do EPUB. Isso valida o formato e o caminho de restauração. **Não é um ensaio com o banco real de produção.** O ZIP real deve ser baixado pelo proprietário, pois esta sessão não possui a sessão master autenticada no aplicativo.
