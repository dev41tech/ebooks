import { cookies } from "next/headers";
import { REFRESH_COOKIE, clearedCookies, sessionCookies } from "../../auth";
import { AuthServiceError, hasAuthSession, supabaseAuth } from "../../lib/auth-service";

function json(body: unknown, status = 200, setCookies: string[] = []) {
  const headers = new Headers({ "content-type": "application/json", "cache-control": "no-store" });
  for (const cookie of setCookies) headers.append("set-cookie", cookie);
  return new Response(JSON.stringify(body), { status, headers });
}

/** POST /api/auth { action: "login" | "signup" | "refresh" | "logout" } */
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
    if (action === "logout") return json({ ok: true }, 200, clearedCookies());
    if (action === "refresh") {
      const refreshToken = (await cookies()).get(REFRESH_COOKIE)?.value;
      if (!refreshToken) return json({ error: "no_session" }, 401, clearedCookies());
      const data = await supabaseAuth("token?grant_type=refresh_token", { refresh_token: refreshToken });
      if (!hasAuthSession(data)) throw new AuthServiceError("auth_invalid_response", 502, "missing_session");
      return json({ ok: true }, 200, sessionCookies(data.access_token, data.refresh_token, data.expires_in || 3600));
    }
    const email = String(fields.email || "").trim().toLowerCase();
    const password = String(fields.password || "");
    if (!email.includes("@") || password.length < 8) return json({ error: "invalid_credentials_format" }, 400);

    if (action === "signup") {
      const displayName = String(fields.displayName || "").trim().slice(0, 120);
      const data = await supabaseAuth("signup", { email, password, data: displayName ? { display_name: displayName } : undefined });
      if (hasAuthSession(data)) return json({ ok: true }, 201, sessionCookies(data.access_token, data.refresh_token, data.expires_in || 3600));
      const user = data.user as { id?: unknown } | undefined;
      if (!data.access_token && !data.refresh_token &&
          ((typeof data.id === "string" && data.id) || (typeof user?.id === "string" && user.id))) {
        return json({ ok: true, confirmationRequired: true });
      }
      throw new AuthServiceError("auth_invalid_response", 502, "missing_signup_user");
    }
    const data = await supabaseAuth("token?grant_type=password", { email, password });
    if (!hasAuthSession(data)) throw new AuthServiceError("auth_invalid_response", 502, "missing_session");
    return json({ ok: true }, 200, sessionCookies(data.access_token, data.refresh_token, data.expires_in || 3600));
  } catch (error) {
    const failure = error instanceof AuthServiceError ? error : new AuthServiceError("auth_internal_error", 500, "unexpected_exception");
    // An outage must not delete a valid refresh token. Only definitive session rejections do.
    if (action === "refresh" && ["refresh_token_not_found", "refresh_token_already_used", "session_not_found", "session_expired", "invalid_credentials"].includes(failure.code)) {
      return json({ error: "session_expired" }, 401, clearedCookies());
    }
    const requestId = crypto.randomUUID();
    if (failure.status >= 500) console.error("sambu_auth_error", JSON.stringify({
      requestId, action, error: failure.code, reason: failure.reason, upstreamStatus: failure.upstreamStatus,
    }));
    return json({ error: failure.code, requestId }, failure.status);
  }
}
