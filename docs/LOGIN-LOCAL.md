# Login local

A autenticação saiu do Supabase e passou a viver no Postgres do próprio app.

---

## Por que mudou

O projeto Supabase que servia o login deixou de existir — o host devolve
NXDOMAIN, e projeto pausado continua resolvendo em DNS, então não era pausa. Com
isso `getUser()` passou a validar token contra um endereço que não resolve, e a
única porta que restou foi o modo temporário, que dá admin a **qualquer
visitante**.

A camada de **autorização** já era local: quem é admin sai de
`SAMBU_ADMIN_EMAILS`, da senha master e de `app/lib/policy.ts`. Só faltava a
**autenticação** — provar quem é a pessoa.

## Criar o primeiro usuário

```bash
node scripts/criar-usuario.mjs marcos@exemplo.com "Marcos Dias"
```

A senha é pedida pelo terminal, sem eco. **Não passe a senha por argumento**: ela
ficaria no histórico do shell e na lista de processos da máquina. Para uso
automatizado existe `SAMBU_NEW_PASSWORD` no ambiente.

Se o e-mail já existir, o script troca a senha e derruba todas as sessões
abertas daquele usuário.

Ser admin **não vem daí**: inclua o e-mail em `SAMBU_ADMIN_EMAILS` no EasyPanel.
O script só resolve identidade, nunca privilégio.

## O que muda na operação

Nenhuma variável nova é obrigatória. `DATABASE_URL` já era exigida. As variáveis
de Supabase deixam de participar do login — podem continuar definidas sem efeito.

Depois de criar o usuário, **desligue o acesso temporário**:

```env
SAMBU_TEMPORARY_PUBLIC_ADMIN=false
```

Enquanto ele estiver ligado, `/api/auth` recusa login e cadastro com 409 — o modo
temporário tem precedência de propósito, para não existirem duas formas
simultâneas de entrar.

## Como funciona

`app/lib/auth-local.ts`. Duas tabelas, criadas pela migration `0004_auth_local`:
`auth_users` e `auth_sessions`.

**Senha:** scrypt do `node:crypto`, com sal por usuário e os parâmetros gravados
junto do hash (`scrypt$N$r$p$sal$hash`) — endurecer o custo depois não invalida
as senhas já cadastradas. Não entrou bcrypt nem argon2 de propósito: dependência
nativa nova neste projeto já custou caro (`better-sqlite3` sem binário para Node
24 no Windows).

**Sessão no banco, não JWT auto-contido.** Um token assinado só expira; não dá
para cancelar. Com a sessão numa linha, logout e troca de senha revogam de
verdade.

**Só o hash do token é gravado.** Um vazamento do banco não entrega sessão
válida — mesma razão de não guardar senha em claro.

**Renovar rotaciona os dois tokens**, o que limita a janela de um refresh token
roubado. O contrato de `/api/auth` não mudou: mesmas ações, mesmos códigos de
erro, mesmos cookies (`HttpOnly`, `Secure`, `SameSite=Lax`).

**E-mail desconhecido e senha errada devolvem o mesmo erro.** Distinguir os dois
entrega a lista de quem tem conta.

## O que NÃO tem

- **Confirmação de e-mail.** Não há SMTP configurado, então o cadastro cria a
  conta direto. Era assim no Supabase também — a confirmação já estava como
  pendência. A conta criada nasce sem privilégio nenhum.
- **Recuperação de senha pelo app.** Sem e-mail não há link de redefinição. Hoje
  a recuperação é rodar `scripts/criar-usuario.mjs` com o mesmo e-mail.
- **Limite de tentativas de login.** O scrypt encarece cada tentativa, mas não
  substitui um bloqueio por IP ou por conta.

Os três dependem da mesma decisão adiada: um caminho de e-mail que funcione.

## Sobrou de Supabase

`app/lib/auth-service.ts` e `scripts/check-auth.ts` continuam no repositório,
agora servindo apenas ao reexport de `authConfig` em `app/auth.ts`. Não
participam mais do login. Remover é limpeza segura, mas foi deixada de fora
desta mudança para o diff não misturar duas coisas.

## Testes

- `tests/auth-local.test.mjs` — 15 casos: hash e verificação de senha, sal,
  hash corrompido, e-mail desconhecido versus senha errada, ciclo de sessão,
  expiração, rotação, revogação por logout e por troca de senha, e a garantia de
  que o banco guarda hash e nunca o token.
- `tests/auth-proxy.test.mjs` — 12 casos na rota, atrás do proxy: proteção de
  origem, payload inválido, atributos dos cookies, ausência da senha nas
  respostas de erro, e o 409 do modo temporário.
