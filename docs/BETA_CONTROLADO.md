# Sambu — acompanhamento do beta

Atualização: 22/09/2026. Ambiente: Sambu R3 Testes.

## Recursos entregues

- No leitor: **Relatar problema** com categoria, descrição e contexto (livro, capítulo/posição, versão e tipo de tela). O formulário informa os dados enviados e preserva o texto quando há falha.
- Um identificador por relato evita duplicação em reenvios. Limite: 10 relatos por conta/dia UTC.
- **Avaliar livro**: notas de 1 a 5 para interesse na história e qualidade do texto, mais comentário opcional. Uma avaliação por conta/livro, atualizável e privada para a equipe.
- **Administração → Acompanhar beta**: leitores ativos, retorno em outro dia, progresso por obra, notas, falhas e tratamento de relatos (aberto/em análise/resolvido).
- **Importar e revisar → Revisar → Verificar ebook agora**: capa, sumário, conteúdo válido, seções/textos repetidos e sinais de palavras quebradas. A publicação também executa a verificação. Impedimentos bloqueiam; alertas são preservados na importação. O verificador não reescreve a obra nem atesta qualidade literária, gramática ou direitos.
- PDF: assinatura e cadastro apenas; capítulos e texto exigem prévia manual. Sua abertura no visualizador não confirma que todas as páginas foram renderizadas.

## Como interpretar os números

A coleta de abertura/falhas começa nesta atualização. Não foi criado histórico retroativo.

- Leitor ativo: conta com abertura de pelo menos um livro nos últimos 14 dias.
- Retorno: essa conta abriu livros em pelo menos dois dias UTC distintos dentro da janela; não é retenção D1/D7 por coorte.
- Aberturas/falhas: no máximo um evento por conta, livro, tipo e dia; não são contagens de todos os cliques.
- Avançaram/concluíram: progresso atual dos leitores que abriram a obra na janela (≥25%/100%). Não mede conclusão ocorrida necessariamente dentro da janela.
- Notas e relatos: desde o início da coleta. Painel mostra até 200 livros e 100 relatos/comentários, com relatos pendentes primeiro.
- Falhas totalmente offline podem não ser registradas. Não há rastreamento de tela, conteúdo digitado ou agente externo de analytics.
- Progresso baixo não comprova desinteresse. Compare com o relato explícito e as notas.

## Ciclo sugerido de um mês

1. Selecionar 10 a 20 leitores e um acervo pequeno já revisado.
2. Pedir cadastro, abertura de livro, avanço de capítulo e retomada após fechar o navegador.
3. Com a mesma conta, ler no computador e retomar no celular; depois inverter.
4. Conferir diariamente os relatos e reproduzir antes de marcar como resolvidos.
5. Ao fim do ciclo, comparar retorno, avanço, avaliações e falhas; priorizar correções que bloqueiem leitura.

## Operação e limites verificados

Acesso administrativo segue a lista de administradores de teste e a proteção master do proprietário. O monitoramento novo não amplia essas permissões. Testes usam banco, armazenamento e contas fictícios isolados; a prévia de interface usa dados simulados, sem escrever no acervo real.

Os testes automatizados cobrem cadastro, importação, publicação, permissões, progresso e sincronização, além de relatos/avaliações/indicadores/verificação editorial. A interface foi exercitada em navegador com larguras de 320, 390, 768 e 1440 px. Isso não equivale a teste em Safari/iPhone ou Android físicos.

## Pendências de operação antes de ampliar a divulgação

- Testar em iPhone/Safari e Android/Chrome físicos, inclusive interrupção de rede e troca entre dispositivos.
- Confirmar com o operador da hospedagem a política de backup de **D1 e R2**. Histórico Git restaura código, não o acervo e as posições de leitura.
- Executar restauração de uma cópia de produção em ambiente isolado: aplicar o esquema correspondente, restaurar dados, arquivos e permissões; conferir quantidades, abrir amostra de EPUB/PDF e retomar posições.
- Definir responsável, periodicidade, retenção e registro do último ensaio de restauração. Nenhum backup completo de produção foi criado ou certificado nesta atualização.
- Recuperação da conta de leitura permanece pelo provedor de login. A recuperação da senha master requer procedimento operacional do proprietário; não foi criada uma rota pública de redefinição.
- VPS e publicação nas lojas continuam separadas desta entrega. D1, R2 e autenticação atuais ainda precisam de estratégia de migração.
