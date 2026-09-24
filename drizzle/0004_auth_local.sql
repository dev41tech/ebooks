-- Migration 0004 — autenticação local, no lugar do Supabase Auth.
--
-- O projeto Supabase que servia o login deixou de existir (o host devolve
-- NXDOMAIN), então `getUser()` passou a validar token contra um endereço que não
-- resolve. A única porta que restou foi o modo temporário, que dá admin a
-- qualquer visitante — aceitável por algumas horas, não como regime.
--
-- A camada de AUTORIZAÇÃO já era local (SAMBU_ADMIN_EMAILS, senha master,
-- políticas em app/lib/policy.ts). Só faltava a AUTENTICAÇÃO.
--
-- Os separadores entre os comandos abaixo não são decoração: o
-- scripts/migrate-vps.mjs faz split neles e executa um comando por vez. Sem
-- eles o arquivo inteiro vira um único statement e o Postgres recusa com
-- "cannot insert multiple commands into a prepared statement". E o separador
-- não pode ser citado literalmente em comentário nenhum deste arquivo, porque
-- o split acontece ali também.
--
-- Aditiva: cria duas tabelas novas e não toca em nada existente.

CREATE TABLE IF NOT EXISTS "auth_users" (
	"email" text PRIMARY KEY NOT NULL,
	"display_name" text DEFAULT '' NOT NULL,
	-- scrypt$N$r$p$salt_b64$hash_b64. O formato carrega os parâmetros para que
	-- endurecer o custo depois não invalide as senhas já cadastradas.
	"password_hash" text NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
-- Sessões no banco, não JWT auto-contido: assim logout e troca de senha
-- revogam de verdade. Um token assinado só expira, nunca é cancelado.
CREATE TABLE IF NOT EXISTS "auth_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_email" text NOT NULL REFERENCES "auth_users"("email") ON DELETE CASCADE,
	-- Guardamos só o SHA-256 dos tokens. Um vazamento de banco não vira sessão
	-- válida — é a mesma razão de não guardar senha em claro.
	"access_hash" text NOT NULL,
	"refresh_hash" text NOT NULL,
	"access_expires_at" text NOT NULL,
	"refresh_expires_at" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_auth_sessions_access" ON "auth_sessions" ("access_hash");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_auth_sessions_refresh" ON "auth_sessions" ("refresh_hash");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_auth_sessions_user" ON "auth_sessions" ("user_email");
