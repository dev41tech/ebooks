# Sambu R3 Beta — implementação sobre a base R2

Versão do código: 0.3.0. Data: 15/09/2026.

Esta entrega implementa as correções na base R2 recuperada. Não representa uma cópia do código atualmente publicado em ebooks.41tech.cloud e não foi publicada nesse domínio. O registro documental R3 anterior continua separado desta implementação.

## O que mudou

- Catálogo consultado no banco, com busca, gênero, ordenação por título/data e estados de carregamento, erro e acervo vazio. Apenas obras publicadas aparecem.
- Favoritos persistidos por conta e botão independente da abertura do livro.
- EPUB com leitura por parágrafos, tamanho de fonte, temas, posição e percentual salvos. A posição é gravada após pausa na rolagem e pode ser salva manualmente.
- PDF exibido com campo de página salva manualmente; não há detecção automática da página do visualizador.
- Perfil usa a conta autenticada e permite atualizar o nome.
- Beta gratuito, com participantes e administradores definidos por listas no servidor. APIs verificam as permissões; esconder um botão não concede acesso.
- Removidos da interface os livros fictícios, avaliações artificiais, planos de demonstração e promessas de áudio/offline. A API bloqueia criação de assinaturas simuladas.
- Importação com retomada de envio em partes, revisão de metadados, confirmação de direitos, validação de PDF/EPUB e publicação idempotente. Publicações simultâneas não duplicam a obra.
- Arquivamento de importações conserva arquivos e bloqueia remoção de registros ligados a obras publicadas.
- Limites de extração do EPUB e cache de conteúdo na publicação reduzem processamento e exposição a arquivos excessivos.

## Instalação e validação

Requer Node 22.13 ou posterior e ambiente compatível com Vinext/Cloudflare Workers, D1 e R2. Não é um pacote para hospedagem puramente estática.

```sh
npm ci
npm run typecheck
npm test
```

`npm test` gera o build, verifica a renderização e executa os testes de integração. `npm run test:beta` executa somente os testes do beta. Os testes usam banco e armazenamento isolados; não alteram o acervo de produção.

## Configuração antes de disponibilizar aos convidados

1. Identificar a hospedagem que realmente atende ebooks.41tech.cloud. O identificador do projeto Sites original foi removido do manifesto desta cópia para evitar publicação no projeto errado.
2. Configurar os bindings D1 `DB` e R2 `BUCKET` no ambiente de destino. Não estão incluídos banco, livros, usuários ou credenciais de produção.
3. Fazer backup do banco existente e aplicar as migrações pendentes. Banco novo: todas as migrações em `drizzle/`. Banco já com 0000–0005: aplicar `0006_robust_silvermane.sql`, que adiciona a posição da leitura.
4. Integrar autenticação verificada em `app/chatgpt-auth.ts`. O adaptador atual só aceita o gateway autenticado do Sites quando `SAMBU_AUTH_MODE=sites`. Em outro servidor, é necessário substituir a obtenção da identidade por sessão/token validado e adaptar as rotas de entrada/saída. **Não habilitar o modo Sites aceitando cabeçalhos enviados diretamente pelo navegador**: isso permitiria falsificar identidades. Por padrão, sem configuração, o acesso fica como visitante.
5. Configurar `SAMBU_ADMIN_EMAILS` e `SAMBU_BETA_EMAILS` com emails separados por vírgulas. Administradores têm acesso ao beta. As listas ficam vazias por padrão.
6. Importar um pequeno acervo autorizado, revisar metadados e testar leitura com contas reais de administrador, participante e pessoa não convidada no ambiente de homologação.
7. Definir canal de suporte, política de privacidade e rotina de backup/monitoramento antes de convidar o grupo piloto. Esses serviços operacionais não são provisionados por este pacote.

`.env.example` documenta as variáveis, mas elas precisam ser configuradas como variáveis do Worker no destino; o arquivo sozinho não provisiona serviços nem autenticação.

## Limitações conhecidas

- EPUB é convertido para texto por parágrafos. Imagens internas, diagramação editorial e navegação avançada por capítulos não estão preservadas integralmente.
- A prévia de importação abre o arquivo original; não existe leitor EPUB integrado à revisão administrativa.
- PDF usa marcação manual de página. EPUB aceita até 32 MB, PDF até 250 MB na importação; substituição pelo editor aceita até 32 MB. Capas aceitam JPEG, PNG e WebP até 8 MB.
- Retomada do upload depende do mesmo navegador/conta e do mesmo arquivo. Arquivos de 250 MB e falhas prolongadas de rede ainda precisam de ensaio na infraestrutura final.
- Arquivos arquivados são conservados; não há rotina automática de limpeza do armazenamento.
- Não inclui cobrança, áudio, downloads offline, analytics de produto ou gestão de convites por email.
- Autenticação real e uso em múltiplos dispositivos dependem da configuração de hospedagem. A persistência foi verificada nas APIs em ambiente isolado; o fluxo completo de login de produção não foi validado nesta implementação.

## Escopo dos testes automatizados

Onze testes de integração cobrem bloqueio por perfil, publicação concorrente, filtragem pública, proteção do arquivo publicado, leitura por convite, favoritos, progresso, perfil sem elevação de privilégios, EPUB inválido, arquivamento e assinaturas desabilitadas. Há também uma verificação de renderização do build e checagem estática TypeScript.

O pacote é uma base implementada para homologação. A liberação do teste de mercado exige configuração do destino e validação com contas e acervo reais.

Resultado desta entrega: TypeScript e build aprovados; 11/11 testes de integração e 1/1 teste de renderização aprovados. No navegador local, busca e ordenação foram verificadas com dois registros de homologação, ausentes do pacote.

## Atualização: senha master da administração

A administração agora exige a conta autorizada e uma senha master adicional. No primeiro acesso, o administrador cria a senha (12–128 caracteres) no próprio aplicativo. Não há senha padrão. O acesso é mantido por duas horas em cookie Secure, HttpOnly e SameSite=Strict e pode ser encerrado em “Bloquear administração”.

A senha é armazenada somente como derivação PBKDF2-SHA256 com salt aleatório; os tokens de sessão ficam como hashes no banco e são vinculados à conta. Após cinco tentativas, novas verificações são bloqueadas até o fim da janela de 15 minutos. O servidor exige a sessão master em todas as APIs administrativas, inclusive importações e mídia. A nova migração é `0007_small_the_renegades.sql`.

Não há recuperação automática de senha nesta versão; guarde a senha em seu gerenciador. A redefinição, se necessária, deverá ser realizada pelo responsável autorizado pela hospedagem, revogando também as sessões existentes.

Validação desta atualização: TypeScript aprovado e 13 testes de integração aprovados, incluindo bloqueio sem sessão, senha inválida, autorização por conta, origem das requisições, expiração, encerramento de sessão e limite de tentativas.

## Atualização: sugestões personalizadas

A seção de categorias na página inicial foi substituída por “Sugestões para você”, com capas reais do acervo, motivo da indicação e botão de inclusão na biblioteca (favoritos). Categorias continuam acessíveis pelo catálogo e pela faixa superior da página inicial.

As recomendações usam afinidade de palavras nos títulos/sinopses, gênero, autoria, buscas recentes e livros salvos ou com leitura iniciada. São regras locais, sem serviço externo de IA. Não sugerem obras não publicadas, já salvas ou com progresso. Sem histórico, apresentam novidades elegíveis; sem candidatos, mostram um estado vazio explicativo.

A migração `0008_overrated_blazing_skull.sql` adiciona buscas por conta. Mantém até 12 consultas distintas e considera apenas os últimos 90 dias; buscas seguintes removem registros antigos. Visitantes não têm buscas gravadas. A busca textual é registrada após uma pausa de um segundo ou envio pela página inicial; seleção de gênero também contribui. Cada conta acessa somente suas próprias sugestões.

Validação: TypeScript, build, renderização e 15 testes de integração aprovados, incluindo afinidade, exclusões, gravação de buscas limitada e isolamento entre contas.

## Correção: retomada entre web e mobile

O leitor consulta a posição da conta sem cache sempre que o livro é aberto, inclusive pelo histórico do navegador. Ao retornar à aba, sincroniza a posição; a biblioteca também atualiza seus percentuais ao voltar ao primeiro plano. A posição EPUB é um parágrafo do conteúdo, independente do tamanho da tela. Em PDF, continua sendo a página informada manualmente.

A migração `0009_nice_risque.sql` acrescenta uma revisão numérica ao progresso. Cada gravação compara sua revisão com a do servidor em uma operação atômica. Uma aba desatualizada recebe a posição atual em vez de sobrescrevê-la. A posição pode recuar intencionalmente quando a revisão está atualizada; não usamos simplesmente o maior percentual.

O leitor salva somente alterações reais, após pausa na rolagem, e tenta finalizar a gravação ao sair/ocultar a página usando keepalive. Não há garantia de entrega se o navegador for encerrado abruptamente ou estiver sem conexão; a mensagem “Posição sincronizada com sua conta” confirma a gravação. Após esta atualização, recarregar os dois aparelhos. Uma aba com código antigo será bloqueada ao tentar sobrescrever uma revisão mais nova.

Validação: 16 testes de integração aprovados, incluindo dois clientes da mesma conta, conflito de revisão e retomada. Não houve teste desta alteração em dois aparelhos físicos.
