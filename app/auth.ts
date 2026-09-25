import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { userForAccessToken } from "./lib/auth-local";
import { temporaryAdminEnabled, TEMPORARY_USER } from "./lib/temporary-access";
export { authConfig } from "./lib/auth-service";

export const ACCESS_COOKIE = "sb-access-token";
export const REFRESH_COOKIE = "sb-refresh-token";

export type SessionUser = {
  id: string;
  email: string;
  displayName: string;
  temporary?: boolean;
};

/**
 * Resolve a sessao contra a tabela `auth_sessions` do proprio Postgres.
 *
 * Antes isto era um fetch ao `/auth/v1/user` do Supabase. O projeto que servia
 * esse endereco deixou de existir -- o host devolve NXDOMAIN --, entao a
 * validacao passou a falhar para todo mundo e a unica porta que restou foi o
 * modo temporario, que da admin a qualquer visitante.
 *
 * A troca mantem a propriedade que motivava o fetch: a sessao e consultada a
 * cada requisicao, entao logout e troca de senha revogam de verdade. O que sai
 * e a dependencia de rede -- agora e uma consulta ao banco que ja e obrigatorio
 * para o app subir.
 */
export async function getUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (token) {
    const user = await userForAccessToken(token);
    if (user) return { id: user.id, email: user.email, displayName: user.displayName };
    // An expired personal session must never become the shared admin identity.
    return null;
  }
  return temporaryAdminEnabled() ? TEMPORARY_USER : null;
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
  if (user.temporary || !isAdmin(user.email)) {
    return {
      user: null,
      error: Response.json({ error: "forbidden" }, { status: 403 }),
    };
  }
  return { user, error: null };
}

/**
 * Quem pode usar o Studio: admin (por ADMIN_EMAILS) ou quem tiver `profiles.role`
 * marcado como "author"/"admin" no banco.
 *
 * O cadastro do site e aberto e `profiles.role` nasce "reader", entao hoje isto
 * fecha o Studio para todo mundo fora da lista de admin -- que e o objetivo:
 * quando a geracao por IA for ligada, um desconhecido que se cadastre nao pode
 * queimar credito. Liberar um autor depois e um UPDATE em profiles.role, sem
 * deploy nem mudanca de codigo.
 */
export async function isAuthor(email: string): Promise<boolean> {
  if (isAdmin(email)) return true;

  const { getDb } = await import("../db");
  const { profiles } = await import("../db/schema");
  const { eq } = await import("drizzle-orm");

  const db = await getDb();
  const [profile] = await db
    .select({ role: profiles.role })
    .from(profiles)
    .where(eq(profiles.email, email))
    .limit(1);

  const role = profile?.role?.toLowerCase();
  return role === "author" || role === "admin";
}

/**
 * Portao das rotas /api/studio. Mesmo contrato de `requireAdmin()`: o handler
 * aborta com `if (error) return error`.
 */
export async function requireAuthor(): Promise<
  { user: SessionUser; error: null } | { user: null; error: Response }
> {
  const user = await getUser();
  if (!user) {
    return {
      user: null,
      error: Response.json({ error: "sign_in_required" }, { status: 401 }),
    };
  }
  if (user.temporary || !(await isAuthor(user.email))) {
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
