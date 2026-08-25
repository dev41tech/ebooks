import { cookies } from "next/headers";
import {
  REFRESH_COOKIE,
  authConfig,
  clearedCookies,
  sessionCookies,
} from "../../auth";

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error_description?: string;
  msg?: string;
};

function withCookies(body: unknown, status: number, setCookies: string[]) {
  const headers = new Headers({ "content-type": "application/json" });
  for (const cookie of setCookies) headers.append("set-cookie", cookie);
  return new Response(JSON.stringify(body), { status, headers });
}

async function supabaseAuth(path: string, payload: unknown) {
  const { url, anonKey } = authConfig();
  const response = await fetch(`${url}/auth/v1/${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      apikey: anonKey,
      authorization: `Bearer ${anonKey}`,
    },
    body: JSON.stringify(payload),
  });
  return { response, data: (await response.json()) as TokenResponse };
}

/** POST /api/auth  { action: "login" | "signup" | "refresh" | "logout" } */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  const action = String(body.action || "login");

  if (action === "logout") {
    return withCookies({ ok: true }, 200, clearedCookies());
  }

  if (action === "refresh") {
    const refreshToken = (await cookies()).get(REFRESH_COOKIE)?.value;
    if (!refreshToken) {
      return withCookies(
        { error: "no_session" },
        401,
        clearedCookies(),
      );
    }
    const { response, data } = await supabaseAuth(
      "token?grant_type=refresh_token",
      { refresh_token: refreshToken },
    );
    if (!response.ok || !data.access_token || !data.refresh_token) {
      return withCookies({ error: "session_expired" }, 401, clearedCookies());
    }
    return withCookies(
      { ok: true },
      200,
      sessionCookies(data.access_token, data.refresh_token, data.expires_in || 3600),
    );
  }

  const email = String(body.email || "")
    .trim()
    .toLowerCase();
  const password = String(body.password || "");
  if (!email.includes("@") || password.length < 8) {
    return Response.json({ error: "invalid_credentials_format" }, { status: 400 });
  }

  if (action === "signup") {
    const displayName = String(body.displayName || "").trim().slice(0, 120);
    const { response, data } = await supabaseAuth("signup", {
      email,
      password,
      data: displayName ? { display_name: displayName } : undefined,
    });
    if (!response.ok) {
      return Response.json(
        { error: data.error_description || data.msg || "signup_failed" },
        { status: response.status },
      );
    }
    // Com confirmacao de e-mail ativada o Supabase nao devolve sessao aqui.
    if (!data.access_token || !data.refresh_token) {
      return Response.json({ ok: true, confirmationRequired: true });
    }
    return withCookies(
      { ok: true },
      201,
      sessionCookies(data.access_token, data.refresh_token, data.expires_in || 3600),
    );
  }

  const { response, data } = await supabaseAuth("token?grant_type=password", {
    email,
    password,
  });
  if (!response.ok || !data.access_token || !data.refresh_token) {
    return Response.json({ error: "invalid_credentials" }, { status: 401 });
  }
  return withCookies(
    { ok: true },
    200,
    sessionCookies(data.access_token, data.refresh_token, data.expires_in || 3600),
  );
}
