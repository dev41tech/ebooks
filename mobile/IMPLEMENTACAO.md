# Sambu — preparação Android e iOS após R1_Sambu

A tag R1_Sambu permanece no commit 4486306a7e9efd42c81a94d16b4528e75af36239. Esta etapa não modifica esse ponto de restauração.

## Implementado

- Capacitor 8 e projetos nativos Android/iOS gerados.
- Entrada mobile que importa diretamente `app/sambu-app.tsx` e todos os estilos compartilhados: não há cópia da interface nem das regras por plataforma.
- Build mobile local (`dist-native`) com HTML e assets, separado do Worker e de seus segredos. O servidor Vinext continua sendo backend, não é embarcado no aparelho.
- Transporte compartilhado para requisições, capas, arquivos e prévias. Web usa a mesma origem; o build mobile aceita uma origem HTTPS explícita.
- Endpoint `/api/session` com a mesma verificação de identidade e permissões do servidor e resposta sem cache.
- Eventos de minimizar/retomar e botão Voltar do Android conectados à navegação e ao fluxo de sincronização existente.
- Dependências fixadas e arquivos de assinatura/build excluídos do Git.

## Limite desta entrega

Os projetos nativos e os assets web foram gerados. Não foram compilados APK/AAB/IPA, assinados nem enviados às lojas. Não foi feito teste em aparelho físico. Xcode não está disponível neste ambiente. Ícones de launcher/splash gerados pelo template ainda precisam ser substituídos pelos assets finais antes do lançamento.

O aplicativo nativo ainda não é um beta utilizável: a inicialização permanece bloqueada até existir autenticação pública e uma API compatível. Não aponta `server.url` para o site privado e não inclui tokens de bypass do Sites. Definir a flag de configuração não implementa login nem libera acesso por si só.

## Bloqueio real: autenticação e destino

O ambiente atual é um Site privado com gateway de login do ChatGPT. Ele não é, por esse motivo, um backend público já pronto para um aplicativo nativo. As instruções de autenticação do recurso Sites exigem confirmar o caminho de login público/externo antes de implementar esse fluxo.

É necessário definir o serviço de autenticação e o destino de hospedagem para implementar cadastro, verificação de email, recuperação de senha, sessão nativa segura e exclusão de conta. A mesma identidade deverá ser usada na web, iOS e Android. Qualquer vinculação com contas atuais precisa verificar a propriedade do email; não confiar em identidade enviada pelo cliente.

Somente após essa definição será possível concluir os seguintes pontos:

1. Implementar login próprio com um provedor confirmado e configurar domínio/remetente/retorno de autenticação.
2. Validar acesso nativo ao servidor, incluindo origens explícitas, política de cookies ou tokens adequados, arquivos autenticados e proteção administrativa. A senha master e o cookie SameSite=Strict atuais precisam de validação/adaptação nesse transporte; não habilitar CORS genérico.
3. Preencher `mobile/.env.local` a partir do exemplo e liberar `VITE_SAMBU_NATIVE_AUTH_READY` apenas após testes reais de sessão. São configurações públicas do cliente: nunca colocar segredos nesses arquivos.
4. Confirmar o identificador provisório `cloud.tech41.sambu`, gerar ícones oficiais, política de privacidade, suporte e dados para avaliação das lojas.
5. Configurar contas de desenvolvedor, certificados e assinatura; compilar no Android Studio e em um Mac com Xcode compatível; testar em aparelhos reais.

## Comandos disponíveis

```sh
npm ci
npm run typecheck
npm run test:client
npm run test:beta
npm run build
npm run mobile:build
npm run mobile:sync
npm run mobile:android
npm run mobile:ios
```

Os comandos `mobile:android` e `mobile:ios` abrem os projetos nas ferramentas locais quando elas estão instaladas. Não enviam aplicativos para as lojas.

## Continuidade

Mudanças em `app/sambu-app.tsx`, estilos e regras compartilhadas atendem as três interfaces. Alterações nos assets embarcados exigem novo build/sync dos projetos nativos e podem exigir nova publicação nas lojas. Alterações no servidor devem preservar compatibilidade com aplicativos já instalados.

Referências: https://capacitorjs.com/docs/getting-started e https://capacitorjs.com/docs/apis/app
