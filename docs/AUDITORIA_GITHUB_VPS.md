# Sambu — auditoria de fluidez e preparação para GitHub/VPS

Data: 18/09/2026. Base avaliada: Sambu R3 Testes, versão publicada 20, commit `be5c0697a3d55fc0b7b328bc7211d34a04533fd7`.

## Parecer

**GitHub: apto para transferência do código a um repositório privado, com ressalvas de qualidade e segurança. VPS: ainda não apto para produção independente.**

O código já tem Git, histórico, lockfile, migrações e testes. O remoto atual pertence ao Sites; não é um repositório no GitHub. Nenhum repositório GitHub foi criado e nenhuma VPS foi alterada nesta auditoria. Guardar o código no GitHub não resolve as dependências de execução e não equivale a hospedar o aplicativo. GitHub Pages, por ser hospedagem estática, não substitui este backend.

A interface compartilhada web/mobile funciona nos cenários verificados. Os maiores bloqueios para uma VPS são autenticação, banco, arquivos e configuração do servidor, além da atualização das dependências vulneráveis. Não é uma aplicação pronta para simplesmente copiar e executar com Docker ou PM2.

## Testes realizados

| Verificação | Resultado | Alcance |
|---|---|---|
| TypeScript (`npm run typecheck`) | Passou | Compatibilidade de tipos |
| Build web | Passou | Artefato Worker, handler e manifesto válidos |
| Integração de backend | 21/21 passaram | D1/R2 isolados, dados sintéticos |
| Cliente, capítulos e HTML inicial | 5/5 passaram após corrigir teste desatualizado | Inclui transporte e preservação dos índices de leitura |
| Build mobile | Passou | Assets web do Capacitor; não APK/IPA |
| ESLint | Reprovado: 10 erros, 20 avisos | 9 erros de atualização de estado em efeitos e 1 de navegação por link |
| Auditoria npm completa | 27 pacotes sinalizados | 1 crítico, 16 altos, 9 moderados, 1 baixo |
| Auditoria npm sem devDependencies | 6 pacotes sinalizados | 1 crítico, 3 altos, 2 moderados |
| Navegador Chrome, telas em iframes de 320, 390, 768 e 1440 px | Fluxos verificados responderam | Teste responsivo; não aparelho físico |

A suíte de integração cobre: restrições administrativas, publicação sem duplicidade, catálogo sem rascunhos, leitura autorizada, favoritos, cadastro e isolamento de perfis, importação em lote, exclusão lógica, senha master, recomendações, beta aberto e conflitos de progresso entre dispositivos.

O teste de HTML ainda esperava a frase “participantes convidados”, removida quando o beta foi aberto. A expectativa foi atualizada para o aviso real de entrada com ChatGPT e para a logo horizontal. Não foi alterada a regra de acesso para fazer o teste passar.

No navegador, foi usado o componente real `SambuApp`, com transporte simulado apenas em uma página temporária de teste. Foram apresentados 24 livros e um livro de 40 capítulos, 100 parágrafos por capítulo (4.000 parágrafos). Foram conferidos:

- Busca sem acento: “Historia de teste 1” encontrou 11 títulos correspondentes.
- Navegação entre início, catálogo, cadastro e leitura.
- Cadastro com confirmação visual de salvamento no transporte simulado.
- Aumentar e diminuir fonte: retorno a 20 px.
- Rolagem, confirmação de posição salva e retorno ao detalhe com “Continuar leitura”.
- Abertura do livro longo em tela estreita e em desktop.
- Largura rolável igual à largura útil em todas as quatro telas; sem overflow horizontal da página inicial. O cadastro também foi conferido em 390 px.

As barras do navegador de teste reduzem a largura útil dos iframes em 15 px. Isso não reproduz exatamente Safari/iPhone. O preview local não tinha o banco do acervo real configurado; o catálogo real local apresentou a mensagem de erro com opção de tentar novamente. Por isso os fluxos visuais autenticados foram avaliados com dados simulados. As APIs foram verificadas separadamente pela suíte de integração. Não se testou login real no navegador, Safari, aparelho físico, rede móvel lenta ou acesso concorrente de usuários reais. Não há medição de FPS, Core Web Vitals ou capacidade máxima de usuários que sustente uma certificação de desempenho.

As páginas e os dados de simulação foram removidos ao final e não fazem parte da publicação.

## Fluidez: pontos que precisam melhorar

| Prioridade | Evidência no código | Impacto e ajuste recomendado |
|---|---|---|
| Alta | O leitor monta os 4.000 blocos de uma vez no cenário testado; `app/sambu-app.tsx`, `Reader` | Implementar carregamento por capítulo ou virtualização, mantendo os identificadores de progresso estáveis. Reduz DOM e memória em livros extensos. |
| Alta | O evento de rolagem consulta todos os blocos e mede suas posições até localizar o parágrafo atual | Usar referências estáveis e observação de visibilidade ou índices de posição. O custo cresce conforme o usuário avança. Não foi comprovado travamento no Chrome de teste. |
| Média | `/api/catalog` devolve todos os livros; busca e filtro são feitos no cliente | Paginar o catálogo e a administração antes de aumentar muito o acervo. |
| Média | A logo horizontal PNG tem 1.016.416 bytes, aproximadamente 0,97 MiB | Gerar uma versão otimizada para as dimensões do cabeçalho, sem alterar a identidade visual. O peso da imagem supera o JavaScript inicial comprimido. |
| Média | Aproximadamente 339 kB de JavaScript cliente em 5 arquivos; soma gzip aproximada de 102 kB. CSS mobile gerado: 94,4 kB, gzip 20,5 kB | Separar administração/importação do pacote inicial e revisar estilos antigos após a medição de desempenho. Esses números são de arquivos locais, não de uma transferência medida em rede real. |
| Média | Abertura busca progresso e depois conteúdo; `/api/catalog/content` acessa o arquivo original antes do cache de texto | Reduzir consultas sequenciais quando seguro e aproveitar o cache sem abrir primeiro o ebook original. |
| Média | Leitor, cadastro, catálogo e administração concentrados em `app/sambu-app.tsx` | Separar componentes e responsabilidades para reduzir regressões e facilitar testes. |
| Média | Apenas a abertura de leitura possui cancelamento por tempo de espera de 30 segundos | Padronizar cancelamento, repetição e mensagem de falha para outras requisições. |

Pontos positivos: capas carregam sob demanda; a leitura tem bloqueio contra cliques duplicados; salvamento de progresso usa atraso de 600 ms e revisão de concorrência; favoritos e permissões são validados no servidor. O PDF tem limite funcional conhecido: a página é informada e salva manualmente; não há acompanhamento automático do visualizador.

## Segurança das dependências

Os totais do npm audit representam pacotes afetados e suas cadeias, não 27 explorações comprovadas no Sambu. Dependências de desenvolvimento também podem participar do build do servidor; classificá-las como “dev” não resolve automaticamente sua exposição.

1. **`fflate` 0.8.2:** usado diretamente em `app/lib/epub.ts` para descompactar EPUB. Existe falha de loop infinito em ZIP64 malformado; a correção publicada é 0.8.3. É um risco concreto para disponibilidade durante importação/processamento. As verificações de tamanho já existentes não substituem essa correção. [Aviso de segurança](https://github.com/advisories/GHSA-px8p-9vwx-vf98).
2. **`next` 16.2.6:** o npm sinaliza criticidade máxima crítica. Parte dos avisos depende do runtime, Windows ou otimização de imagem do Next. O Sambu executa Vinext/Cloudflare; não foi demonstrada exploração desses caminhos no artefato atual. A versão precisa ser revisada antes da migração, quando o runtime poderá mudar. [Aviso crítico de referência](https://github.com/advisories/GHSA-2xp9-vwfh-vxw4).
3. **`react-server-dom-webpack` 19.2.6:** há aviso alto de negação de serviço em Server Functions. Atualizar com uma combinação compatível de React, React DOM e Vinext. [Aviso](https://github.com/advisories/GHSA-wx67-qw84-cm4g).
4. Vite, Vinext, Wrangler, Miniflare e cadeias auxiliares também têm alertas. O relatório completo sugeriu mudanças de versão que incluem saltos maiores e até downgrades em algumas cadeias. Evitar `npm audit fix --force`; atualizar em etapa isolada, com build e regressão.

Não foram aplicadas atualizações de dependências durante esta auditoria. O resultado não certifica o sistema como livre de vulnerabilidades.

## Prontidão para GitHub

Já existem `package-lock.json`, `.gitignore`, exemplos de ambiente, migrações SQL e testes. Não há `node_modules`, saída de build, banco local ou estado do runtime entre os arquivos versionados. A varredura limitada por padrões de chaves e tokens não encontrou segredo real no estado atual nem nos 136 blobs históricos de texto examinados. Um candidato por URL com credenciais no teste de transporte é uma entrada sintética de teste. Essa varredura não substitui uma ferramenta completa de secret scanning nem cobre toda informação pessoal ou direitos dos assets.

Pendências para um repositório de trabalho confiável:

- Criar/conectar o destino no GitHub; preferência por repositório privado para o produto.
- Adicionar CI com instalação pelo lockfile, tipos, build, testes e análise de segurança.
- Resolver o lint; não apenas desabilitar globalmente as regras.
- Atualizar `README.md`, `docs/ARCHITECTURE.md` e `mobile/IMPLEMENTACAO.md`: ainda há descrições históricas de beta privado, mídia futura e dados de demonstração.
- Completar `.env.example` com as opções atuais de beta aberto e administradores de teste, sem valores reais.
- Definir licença/visibilidade do código e revisar permissão de distribuição dos assets se o repositório for público.
- Configurar proteção da branch principal e política de revisão/rollback.

O registro do projeto Sites não é uma credencial. Não copiar variáveis reais, sessões, arquivos de usuários ou backup de banco para o GitHub. [Orientação do GitHub sobre dados sensíveis e histórico](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository).

## Bloqueios para uma VPS independente

| Área | Situação atual | O que concluir |
|---|---|---|
| Execução | Worker Vinext; configuração depende do plugin Cloudflare e do Sites | Criar e testar saída Node/Linux e inicialização de produção. Não servir Vite de desenvolvimento publicamente. |
| Autenticação | `app/chatgpt-auth.ts` confia em cabeçalhos inseridos pelo gateway Sites, somente no modo `sites` | Implementar login e sessão verificáveis no novo destino. Jamais aceitar esses cabeçalhos vindos livremente da internet. |
| Banco | `db/index.ts` usa Drizzle D1; também há SQL por `env.DB` | Criar adaptador para o banco escolhido ou conexão remota suportada. Migrar perfis, progresso, favoritos e permissões com validação. |
| Arquivos | Rotas usam `env.BUCKET`, inclusive upload multipart | Adaptar para API compatível com o destino e migrar ebooks, capas, cache de conteúdo e metadados. |
| Configuração | Há importações `cloudflare:workers` em 14 arquivos versionados, incluindo tipos gerados | Isolar o acesso ao runtime; variáveis de ambiente comuns não criam bindings D1/R2. |
| Operação | Não há Dockerfile/Compose, configuração de proxy, healthcheck ou processo de backup/restore no repositório | Definir HTTPS, reinício automático, limites de upload, logs, monitoramento, backups e teste de restauração. |
| Mobile nativo | Assets Capacitor compilam, mas bootstrap exige API/autenticação nativa confirmadas | Testar sessão, origem HTTPS e transporte autenticado. Build de assets não equivale a app pronto para lojas. |

Vinext tem suporte a Node com diferenças de plataforma; portanto o bloqueio não é uma impossibilidade geral do framework. São o acoplamento deste projeto e a falta de homologação no destino. A própria documentação recomenda avaliar compatibilidade por aplicação. [Documentação oficial](https://github.com/cloudflare/vinext).

Não foram executados provisionamento, login SSH, deploy em VPS, teste de Docker, instalação limpa em uma VPS ou restauração de dados. Não há credenciais/endereço de VPS nem destino GitHub definido nesta solicitação.

## Sequência recomendada

1. Corrigir as dependências de risco e estabilizar lint/testes em uma etapa isolada.
2. Colocar a base no GitHub privado e ativar CI. O beta atual pode continuar no ambiente existente enquanto a nova hospedagem é preparada.
3. Separar autenticação, banco e arquivos do código específico de Sites. Decidir se a VPS será independente ou usará serviços externos gerenciados; documentar essa dependência.
4. Criar o ambiente VPS de homologação com HTTPS, segredos fora do Git, inicialização de produção e backups.
5. Migrar uma cópia dos dados e testar cadastro, autorização, importação, leitura, exclusão lógica e sincronização em dois dispositivos reais.
6. Medir desempenho com rede móvel e concorrência representativas. Definir capacidade somente após essa medição.
7. Fazer a troca de domínio com backup, janela de migração e caminho de retorno.

**Decisão recomendada:** iniciar a organização no GitHub e manter a VPS em homologação até os bloqueios acima serem resolvidos. O beta atual é uma base funcional; ainda não é uma entrega portátil de produção.
