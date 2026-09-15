# Sambu — Web e mobile na mesma base

- O produto é uma aplicação web responsiva, com os mesmos componentes, APIs, autenticação e dados em desktop e celular. Não criar uma versão mobile paralela nem duplicar regras de negócio por dispositivo.
- Toda mudança de funcionalidade deve atender os dois formatos. Preservar leitura, progresso, favoritos, recomendações, importação e administração em ambos.
- Ajustes de apresentação mobile ficam em `app/mobile.css`, carregado após os estilos compartilhados. Usar media queries, controles com área de toque adequada e safe-area para navegação fixa.
- Considerar larguras de 320, 390, 768 e 1440 px; evitar overflow da página. Tabelas e vitrines podem rolar dentro de sua região. Não bloquear zoom.
- Não afirmar que houve teste em aparelho físico ou navegador quando somente TypeScript/build/testes de servidor foram executados. QA visual deve seguir as capacidades disponíveis.
- Este projeto é o ambiente separado Sambu R3 Testes. Preservar seu project_id e a publicação privada. O domínio ebooks.41tech.cloud é outro ambiente e não deve ser alterado por suposição.
