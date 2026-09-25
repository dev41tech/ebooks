import { cookies } from "next/headers";
import { ACCESS_COOKIE, REFRESH_COOKIE, clearedCookies, sessionCookies } from "../../auth";
import {
  AuthLocalError,
  authenticate,
  createSession,
  createUser,
  revokeSession,
  rotateSession,
} from "../../lib/auth-local";

function json(body: unknown, status = 200, setCookies: string[] = []) {
  const headers = new Headers({ "content-type": "application/json", "cache-control": "no-store" });
  for (const cookie of setCookies) headers.append("set-cookie", cookie);
  return new Response(JSON.stringify(body), { status, headers });
}

/**
 * POST /api/auth { action: "login" | "signup" | "refresh" | "logout" }
 *
 * O contrato com o front nao mudou -- mesmas acoes, mesmos codigos de erro,
 * mesmos cookies. O que mudou e quem responde: era o Supabase Auth, agora e a
 * tabela `auth_users` do proprio Postgres, porque o projeto Supabase deixou de
 * existir. Ver app/lib/auth-local.ts.
 *
 * `signup` NAO exige confirmacao por e-mail, porque nao ha SMTP configurado --
 * era assim tambem no Supabase (a confirmacao esta como pendencia conhecida). A
 * conta criada aqui nasce sem privilegio nenhum: admin continua saindo de
 * SAMBU_ADMIN_EMAILS e da senha master, nao de quem consegue se cadastrar.
 */
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return json({ error: "invalid_origin" }, 403);
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "invalid_payload" }, 400);
  const fields = body as Record<string, unknown>;
  const action = fields.action ?? "login";
  if (typeof action !== "string" || !["login", "signup", "refresh", "logout"].includes(action)) {
    return json({ error: "invalid_payload" }, 400);
  }

  try {
    if (action === "logout") {
      const jar = await cookies();
      // Apaga a sessao no banco, nao so o cookie: cookie limpo em navegador
      // roubado nao adianta se a linha continua valendo no servidor.
      await revokeSession(jar.get(ACCESS_COOKIE)?.value, jar.get(REFRESH_COOKIE)?.value);
      return json({ ok: true }, 200, clearedCookies());
    }

    if (action === "refresh") {
      const refreshToken = (await cookies()).get(REFRESH_COOKIE)?.value;
      if (!refreshToken) return json({ error: "no_session" }, 401, clearedCookies());
      const session = await rotateSession(refreshToken);
      return json({ ok: true }, 200, sessionCookies(session.accessToken, session.refreshToken, session.expiresIn));
    }

    const email = String(fields.email || "").trim().toLowerCase();
    const password = String(fields.password || "");
    if (!email.includes("@") || password.length < 8) return json({ error: "invalid_credentials_format" }, 400);

    if (action === "signup") {
      const displayName = String(fields.displayName || "").trim().slice(0, 120);
      const user = await createUser(email, password, displayName);
      const session = await createSession(user.email);
      return json({ ok: true }, 201, sessionCookies(session.accessToken, session.refreshToken, session.expiresIn));
    }

    const user = await authenticate(email, password);
    const session = await createSession(user.email);
    return json({ ok: true }, 200, sessionCookies(session.accessToken, session.refreshToken, session.expiresIn));
  } catch (error) {
    const failure =
      error instanceof AuthLocalError ? error : new AuthLocalError("auth_internal_error", 500);
    // Sessao definitivamente invalida limpa o cookie; falha de servidor nao,
    // para uma indisponibilidade nao deslogar quem tinha sessao boa.
    if (action === "refresh" && ["session_not_found", "session_expired", "no_session"].includes(failure.code)) {
      return json({ error: "session_expired" }, 401, clearedCookies());
    }
    const requestId = crypto.randomUUID();
    if (failure.status >= 500) {
      console.error("sambu_auth_error", JSON.stringify({ requestId, action, error: failure.code }));
    }
    return json({ error: failure.code, requestId }, failure.status);
  }
}
