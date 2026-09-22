# Sambu — fluidez e paridade web/mobile
Data: 22/09/2026. Base publicada examinada: versão 25.

## Resultado
Duas falhas reproduzidas e corrigidas:
1. Os seletores de gênero e ordenação eram ocultados por uma regra antiga no celular. Agora ficam visíveis e utilizáveis.
2. Ao iniciar a abertura de um livro e trocar de área, a resposta atrasada podia devolver o usuário ao leitor. A troca de área e o histórico cancelam a abertura pendente; respostas antigas não alteram a tela nem liberam o estado de uma nova solicitação.

## Evidências
- 30 testes de integração e 6 testes de cliente aprovados.
- TypeScript aprovado após as alterações.
- UI dos componentes reais exercitada em prévia interna com respostas simuladas e conta fictícia; nenhuma avaliação, perfil ou obra de produção foi alterada.
- Contêineres de 320, 390, 768 e 1440 px. As barras do navegador reservaram 15 px: áreas úteis medidas de 305, 375, 753 e 1425 px.
- Início, catálogo, leitor e importação em lote sem overflow horizontal da página nessas larguras; tabelas mantêm rolagem interna.
- Busca sem acento encontrou título acentuado; limpar busca restaurou resultados.
- Gênero e ordenação exercitados nos quatro tamanhos após a correção.
- Favorito apareceu na biblioteca; cadastro foi salvo e reaberto com o nome de teste.
- Somente o livro selecionado mostrou “Abrindo…”.
- Aumentar/reduzir fonte resultou em 22/20 px; tema claro aplicado.
- Troca para capítulo 2 mostrou o mesmo número na navegação e no texto; apenas 20 parágrafos do capítulo corrente ficaram no DOM na amostra de 60.
- Avaliação enviada no ambiente simulado; edição do acervo, importação em lote e painel beta acessíveis em tela estreita.
- Troca para Conta durante abertura foi reproduzida antes da correção; depois a tela de cadastro permaneceu, inclusive após a resposta atrasada.
- A bateria de APIs valida posição compartilhada e rejeição de gravação antiga, além de carregar apenas 100 dos 4.000 parágrafos da amostra grande.

## Limites
Não é um ensaio de carga, medição de velocidade da hospedagem ou certificação em aparelho físico. Os atrasos da prévia e da automação não representam latência de produção.
Não foram testados neste ciclo login real, PDF em Safari, rede móvel, suspensão do sistema ou envio de arquivos pelo seletor nativo.
O mobile validado é o site responsivo no navegador. O projeto nativo reutiliza componentes, mas sua liberação de autenticação continua separada e não foi certificada para lojas.
Uma repetição longa de navegação excedeu o tempo da ferramenta; não foi contabilizada como teste aprovado nem como travamento do aplicativo.

