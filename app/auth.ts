import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const ACCESS_COOKIE = "sb-access-token";
export const REFRESH_COOKIE = "sb-refresh-token";

export type SessionUser = {
  id: string;
  email: string;
  displayName: string;
};

export function authConfig() {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      "Supabase Auth nao configurado. Defina SUPABASE_URL e SUPABASE_ANON_KEY no ambiente.",
    );
  }
  return { url: SUPABASE_URL.replace(/\/+$/, ""), anonKey: SUPABASE_ANON_KEY };
}

/**
 * Valida o access token contra o Supabase em vez de apenas decodificar o JWT.
 * Custa um fetch por requisicao, mas respeita revogacao de sessao e nao depende
 * de sabermos o algoritmo de assinatura do projeto (HS256 legado vs. chaves
 * assimetricas dos projetos novos).
 */
export async function getUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) return null;

  const { url, anonKey } = authConfig();
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: { authorization: `Bearer ${token}`, apikey: anonKey },
  });
  if (!response.ok) return null;

  const payload = (await response.json()) as {
    id?: string;
    email?: string;
    user_metadata?: { display_name?: string; full_name?: string };
  };
  if (!payload.id || !payload.email) return null;

  return {
    id: payload.id,
    email: payload.email,
    displayName:
      payload.user_metadata?.display_name ||
      payload.user_metadata?.full_name ||
      payload.email,
  };
}

export async function requireUser(returnTo: string): Promise<SessionUser> {
  const user = await getUser();
  if (user) return user;
  redirect(`/login?return_to=${encodeURIComponent(safeReturnPath(returnTo))}`);
}

export function isAdmin(email: string): boolean {
  const { ADMIN_EMAILS } = process.env;
  if (!ADMIN_EMAILS) return false;
  const allowed = ADMIN_EMAILS.split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.toLowerCase());
}

/**
 * Portao das rotas /api/admin. Devolve o usuario ou a Response de erro pronta,
 * para o handler poder abortar com um `if`.
 */
export async function requireAdmin(): Promise<
  { user: SessionUser; error: null } | { user: null; error: Response }
> {
  const user = await getUser();
  if (!user) {
    return {
      user: null,
      error: Response.json({ error: "sign_in_required" }, { status: 401 }),
    };
  }
  if (!isAdmin(user.email)) {
    return {
      user: null,
      error: Response.json({ error: "forbidden" }, { status: 403 }),
    };
  }
  return { user, error: null };
}

export function safeReturnPath(value: string): string {
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  try {
    const url = new URL(value, "https://app.local");
    if (url.origin !== "https://app.local") return "/";
    if (url.pathname === "/login") return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}

export function sessionCookies(
  accessToken: string,
  refreshToken: string,
  expiresIn: number,
): string[] {
  const base = "Path=/; HttpOnly; Secure; SameSite=Lax";
  return [
    `${ACCESS_COOKIE}=${accessToken}; ${base}; Max-Age=${expiresIn}`,
    `${REFRESH_COOKIE}=${refreshToken}; ${base}; Max-Age=${60 * 60 * 24 * 30}`,
  ];
}

export function clearedCookies(): string[] {
  const base = "Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0";
  return [`${ACCESS_COOKIE}=; ${base}`, `${REFRESH_COOKIE}=; ${base}`];
}
