# Integração do beta R26 na VPS

Branch `integrate/beta-r26-easypanel`, baseada na `main` (`5a2611e`).
Não faça merge das branches `sambu-beta-r26` ou `sambu-beta-r26-pr`: elas representam o snapshot do ambiente Sites, com outra infraestrutura.

## O que esta integração entrega

- Interface responsiva do beta, logo WebP de 13.260 bytes, sugestões, cadastro ampliado, avaliações e painel do piloto de um mês.
- Leitura por capítulo, títulos consistentes, aumento/redução de fonte e progresso com revisão para impedir que um dispositivo atrasado sobrescreva o outro.
- Importação em lote com revisão editorial, upload em partes, permissões e exclusão lógica protegida.
- Login existente do Supabase, PostgreSQL, campos de classificação, tabelas/APIs do Studio e Docker/Easypanel preservados. O Studio não ganhou funcionalidades novas nesta integração.
- Storage privado do Supabase com leitura por intervalo e metadados de propriedade no PostgreSQL. A service role fica somente no servidor.
- Novas tabelas privadas com RLS sem políticas para clientes; acesso pela conexão PostgreSQL do servidor/proprietário.
- Migrações aditivas 0002 e 0003 executadas automaticamente antes de iniciar o container, em uma única transação, com trava e checksum. A 0002 ausente ou parcialmente aplicada é completada sem substituir dados. Reiniciar o container não repete migrações já registradas.
- Progresso legado em porcentagem é convertido em posição aproximada na primeira abertura; as próximas gravações usam posição e revisão.

Os dados e arquivos do site hospedado no ChatGPT NÃO são transportados pelo GitHub. O acervo utilizado será o do PostgreSQL/Storage configurado na VPS. Para transferir o acervo do Sites, use a importação de backup descrita abaixo. Web e navegador mobile usam o mesmo aplicativo; esta branch não é um pacote publicado na App Store/Play Store.

## Importar o acervo da versão de teste

1. Implante a `main` atual no Easypanel usando o Dockerfile do repositório.
2. No aplicativo da VPS, entre como proprietário, desbloqueie a senha master e abra **Administração → Acompanhar beta → Importar acervo do backup**.
3. Selecione o ZIP baixado em **Baixar backup de dados e acervo** na versão de origem. Confira a lista e clique em **Importar livros e capas**.
4. Mantenha a página aberta. Cada EPUB é enviado em partes e validado antes da publicação. Em caso de interrupção, selecione o mesmo ZIP e tente novamente; livros concluídos são identificados pelo ID e não são duplicados.
5. Ao concluir, clique em **Ver livros no aplicativo** e confira capas e leitura. A importação é comum à versão web e ao navegador mobile.

O importador recebe backups Sambu de até 100 MB com até 200 livros publicados em EPUB com capas embutidas. Recusa formatos não atendidos, arquivos ausentes e conflitos com registros existentes. Preserva os IDs, sinopses, autores, classificações e datas. A reexecução não sobrescreve livros existentes nem reativa livros excluídos. Apenas o proprietário com sessão master pode concluir a transferência, com validação da origem da requisição, propriedade do upload e SHA-256 do EPUB.

O ZIP é lido no navegador; somente os livros publicados são enviados ao Storage privado. Contas, permissões, histórico pessoal e demais tabelas do backup não são importados. Não coloque o ZIP, EPUBs ou dados pessoais no GitHub. Capítulos de leitura são regenerados pelo leitor da VPS; a capa é extraída do EPUB. Este fluxo não substitui uma restauração completa do banco.

## Variáveis de ambiente

Defina pelo painel de secrets do Easypanel, nunca no repositório:

| Variável | Uso |
| --- | --- |
| `SAMBU_TEMPORARY_PUBLIC_ADMIN` | `true` autoriza o modo temporário de leitura e importação sem login, somente com a data abaixo ainda válida. Desativado por padrão. |
| `SAMBU_TEMPORARY_PUBLIC_ADMIN_UNTIL` | Expiração obrigatória em UTC, no formato `AAAA-MM-DDTHH:MM:SSZ`. Ausente, inválida ou vencida mantém o modo fechado. |
| `DATABASE_URL` | PostgreSQL; conexão Supabase adequada ao servidor. Driver usa `prepare:false`. |
| `SUPABASE_URL` | URL HTTPS do projeto. |
| `SUPABASE_ANON_KEY` | Autenticação Supabase. |
| `SUPABASE_PUBLISHABLE_KEY` | Alternativa à chave `anon` para autenticação; tem prioridade quando preenchida. Use uma chave pública do mesmo projeto de `SUPABASE_URL`. |
| `SUPABASE_SERVICE_ROLE_KEY` | Acesso do servidor ao Storage. |
| `SUPABASE_STORAGE_BUCKET` | Bucket privado; padrão `sambu`. |
| `VINEXT_TRUSTED_HOSTS` | Hosts públicos aceitos do proxy, sem protocolo nem caminho. O Dockerfile já define `ebooks.41tech.cloud`. Em homologação com outro domínio, substitua pelo host exato. |
| `ADMIN_EMAILS` | E-mails dos proprietários, separados por vírgula. |
| `SAMBU_ADMIN_EMAILS` | Opcional; substitui `ADMIN_EMAILS` nos recursos do beta. Prefira manter somente `ADMIN_EMAILS` para também manter o Studio alinhado. |
| `SAMBU_ADMIN_TESTER_EMAILS` | Opcional; operadores convidados de livros, sem acesso ao backup/master. |
| `SAMBU_BETA_OPEN` | `false` para lista fechada; padrão `true` permite contas cadastradas. |
| `SAMBU_BETA_EMAILS` | Lista de leitores convidados quando o beta está fechado. |

O proprietário precisa definir/desbloquear a senha master pelo painel. O cadastro e a confirmação de e-mail seguem a configuração do Supabase Auth. Mantenha HTTPS para os cookies seguros. Configure no Supabase o domínio da homologação e depois o definitivo.

### Modo temporário sem login

A imagem permanece protegida por padrão. Para abrir o teste, defina no **Ambiente do serviço ebooks** `SAMBU_TEMPORARY_PUBLIC_ADMIN=true` e `SAMBU_TEMPORARY_PUBLIC_ADMIN_UNTIL` com uma data futura em UTC (formato `AAAA-MM-DDTHH:MM:SSZ`). Escolha um período curto, por exemplo 24 horas. Salve e clique em **Implantar**. Não é necessário usar o console. Acesse `https://ebooks.41tech.cloud/?view=admin`.

- Até a expiração, entrada, leitura, importação individual/em lote, revisão de novas importações e publicação ficam disponíveis a qualquer visitante.
- **Importar acervo do backup** aceita o ZIP já baixado. Não sobrescreve livros existentes. Validações de origem, propriedade do upload, arquivos e checksum continuam ativas.
- Livros já publicados ficam somente para consulta no painel aberto. Edição, substituição de arquivos e exclusão do catálogo exigem o modo autenticado.
- O modo usa uma identidade de teste separada das contas reais, sem chamar Supabase Auth. Biblioteca, favoritos, buscas, avaliações e progresso de teste são compartilhados entre visitantes, com aviso na interface. Não é um teste de sincronização de contas individuais.
- Cadastro pessoal, credenciais master, exportação de dados pessoais e relatos privados permanecem protegidos. O painel aberto se concentra na importação dos livros; não concede acesso ao Studio/geração por IA.
- Quando o prazo vence, as próximas requisições voltam a exigir autenticação, sem reiniciar o servidor. Para encerrar antes, defina `SAMBU_TEMPORARY_PUBLIC_ADMIN=false` e reimplante. Livros publicados no teste continuam no acervo; contas, permissões e senha master são preservadas. O diagnóstico do Supabase ainda será necessário para resolver a causa do erro de autenticação antes de voltar a usar contas reais.

Este modo publica no acervo real. Use-o somente durante o período de teste autorizado.

### Cadastro bloqueado por `invalid_origin`

O Easypanel termina o HTTPS e encaminha HTTP ao container. O servidor Vinext precisa reconhecer os cabeçalhos do proxy para reconstruir o endereço público antes de comparar o `Origin`. A imagem já configura `VINEXT_TRUSTED_HOSTS=ebooks.41tech.cloud`; após atualizar a `main`, clique em **Implantar**. Se houver uma variável de mesmo nome no ambiente do serviço, ela deve conter esse host, pois o Easypanel pode substituir o padrão da imagem.

Para corrigir uma imagem anterior sem mudar código, adicione essa mesma variável em **app → ebooks → Ambiente**, salve e reimplante. O proxy deve enviar `X-Forwarded-Proto: https` e `X-Forwarded-Host: ebooks.41tech.cloud`. Não use curingas nem libere todas as origens. As verificações de origem do cadastro/login, master, backup e importação continuam ativas; requisições de outros sites continuam bloqueadas. Se usar um comando de inicialização fora do Docker, configure também a variável nesse ambiente.

### Cadastro com erro 500 ou mensagem de indisponibilidade

Após reimplantar a `main`, o cadastro retorna erros JSON e uma referência que pode ser localizada nos logs `sambu_auth_error`. Esses logs mostram somente ação, código, motivo e status do provedor; não registram e-mail, senha, chaves, tokens ou a resposta bruta do Supabase.

No **Console do serviço ebooks**, execute:

```sh
node /app/scripts/check-auth.mjs
```

O comando consulta apenas as configurações do Supabase Auth. Não cria usuários, não envia e-mails e não modifica dados. Pode compartilhar a saída: os valores das variáveis e as credenciais não são exibidos. Um resultado `ok: true` confirma a conexão e mostra se o cadastro por e-mail está habilitado, mas não comprova o envio SMTP nem a criação de usuários no banco.

| Motivo/código | O que verificar no Easypanel ou Supabase |
| --- | --- |
| `missing_supabase_url` | Preencher `SUPABASE_URL` em Ambiente com a URL do projeto. |
| `missing_supabase_public_key` | Preencher `SUPABASE_ANON_KEY` ou `SUPABASE_PUBLISHABLE_KEY` do mesmo projeto. |
| `invalid_supabase_url` | Usar a URL base do projeto, sem `/auth/v1`, `/rest/v1`, usuário/senha ou parâmetros. |
| `invalid_supabase_public_key` / `api_key_rejected` | Conferir a chave pública e se ela continua ativa no projeto; não usar `sb_secret_` nesse campo. |
| `ENOTFOUND` / `EAI_AGAIN` | Conferir o domínio do projeto e a resolução DNS na VPS. |
| `ECONNREFUSED` / `network_error` / `timeout` | Verificar disponibilidade do projeto, conexão de saída da VPS e HTTPS. |
| `non_json_or_invalid_body` / `invalid_settings` | A URL/proxy está devolvendo conteúdo diferente da API esperada. |
| `provider_server_error` | Consultar os logs do Supabase Auth; pode haver falha no provedor, SMTP ou gatilho de cadastro. |
| `emailSignup: disabled` | Verificar as opções de novos cadastros e provedor de e-mail no Supabase Auth. |
| `email_address_not_authorized` | Configurar SMTP próprio para enviar confirmações a leitores fora da organização Supabase. |

Depois de ajustar o ambiente, salve e reimplante. Não desative confirmação de e-mail, CAPTCHA ou outras proteções como solução automática. Não há senha padrão de usuário no Sambu.

## Homologação antes do merge

1. Faça um backup completo do PostgreSQL e do bucket atual. Confirme recuperação em ambiente separado.
2. Crie um serviço separado no Easypanel apontando para esta branch, com banco e bucket de homologação. Não reutilize os dados de produção para testar exclusões/importações.
3. Confirme que as migrações de base `0000` e `0001` estão aplicadas. Em uma instalação nova, aplique-as em ordem pelo SQL Editor/psql antes do passo seguinte. A classificação `0002` e a atualização do beta `0003` são gerenciadas pelo aplicativo.
4. Build pelo Dockerfile, porta interna 3000. Mantenha o comando de inicialização do Dockerfile; remova eventual substituição por `node server.js` no Easypanel. Clique em **Implantar**. O container aplica as migrações pendentes e só inicia o servidor após sucesso. Nos logs devem aparecer `applied` (atualização) ou `already_applied` (já atualizado), seguidos de `Sambu: banco atualizado; iniciando o aplicativo.` Se houver erro, o servidor não inicia e a transação é revertida. Para executar manualmente em um container desta versão:

   ```sh
   node scripts/migrate-vps.mjs
   ```

   Em um checkout com dependências e `DATABASE_URL` configurada, o equivalente é `npm run db:migrate:vps`. O comando não apaga tabelas e rejeita uma base sem os pré-requisitos. Não aplique as migrações 0002/0003 também por outro runner.
5. Valide cadastro, confirmação de e-mail, login, renovação de sessão, nome/perfil e saída. Um leitor comum não deve acessar administração.
6. Importe um EPUB e um PDF, revise e publique. Confira capa, leitura, progresso, favoritos e busca. Confirme que o bucket privado bloqueia acesso público direto.
7. Abra o mesmo EPUB em desktop e celular com a mesma conta; avance, feche, retome no outro e tente uma gravação atrasada. Confira também fonte, capítulos, voltar/avançar e conexão lenta.
8. Confirme no Storage real respostas HEAD com ETag/tamanho e GET com Range (206). O adaptador recusa ignorar o intervalo para evitar baixar todo o livro a cada capítulo. Valide os limites/tipos permitidos do bucket: EPUB, PDF, imagens, JSON e application/octet-stream para caches e partes; máximo do app: EPUB 32 MB, PDF 250 MB, sujeito aos limites do plano do Supabase/proxy.
9. Envie avaliação/relato e confira o painel; baixe o backup. Só depois marque o PR como pronto e faça o merge. Na produção, o container aguarda a migração terminar antes de aceitar tráfego.

## Backup e reversão

O ZIP administrativo tem formato `sambu-postgres-backup-v1`, com snapshot JSON e arquivos. Não use o restaurador SQLite do Sites. O teste automatizado restaura as linhas numa instância PostgreSQL isolada e verifica arquivos; isso não substitui validar recuperação no Supabase real. Para recuperação operacional completa, mantenha `pg_dump`/backup do provedor e cópia do bucket, incluindo identidades Auth e configuração fora do ZIP. O ZIP é limitado a 5.000 linhas por tabela, 200 arquivos-base e 250 MB; caches por capítulo são regeneráveis. Uploads sem referência precisam de retenção/limpeza operacional.

Para reverter o aplicativo, reimplante a imagem anterior. As novas colunas/tabelas podem permanecer; não reverta o banco apagando-as. A versão anterior só grava porcentagem, portanto, se ela for usada para novas leituras, planeje a reconciliação desse progresso antes de retornar ao beta.

## Validação desta branch

`npm test`: TypeScript + testes de cliente/leitor + integração com PostgreSQL PGlite. Abrange permissões, publicação concorrente, importação, migração/reexecução preservando dados, sincronização, 4.000 parágrafos carregados por capítulo, feedback, avaliações, métricas, backup e adaptação de Storage com HTTP simulado.

`npm run build:vps`: gera `dist/standalone`. Smoke local confirmou `/login` (200), `/api/session` (200), `/api/progress` sem sessão (401) e logo (200). Docker não está disponível no ambiente de desenvolvimento; o workflow `.github/workflows/vps.yml` executa o build da imagem no GitHub.

Ainda exigem homologação: Docker no CI, Supabase Auth/Storage reais, dados reais, proxy/HTTPS do Easypanel e teste visual no celular físico. Nenhuma migração foi executada na VPS durante a preparação deste PR.
