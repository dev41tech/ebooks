/** Server-only Supabase Auth transport. Never include provider bodies or credentials in errors. */
export class AuthServiceError extends Error {
  constructor(
    public code: string,
    public status: number,
    public reason: string,
    public upstreamStatus?: number,
  ) {
    super(code);
  }
}

export function authConfig() {
  const rawUrl = process.env.SUPABASE_URL?.trim();
  const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY?.trim() || process.env.SUPABASE_ANON_KEY?.trim();
  if (!rawUrl) throw new AuthServiceError("auth_not_configured", 503, "missing_supabase_url");
  if (!anonKey) throw new AuthServiceError("auth_not_configured", 503, "missing_supabase_public_key");
  let url: URL;
  try { url = new URL(rawUrl); } catch {
    throw new AuthServiceError("auth_config_invalid", 503, "invalid_supabase_url");
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash || !/^\/*$/.test(url.pathname)) {
    throw new AuthServiceError("auth_config_invalid", 503, "invalid_supabase_url");
  }
  if (/[^\x21-\x7e]/.test(anonKey) || anonKey.startsWith("sb_secret_")) {
    throw new AuthServiceError("auth_config_invalid", 503, "invalid_supabase_public_key");
  }
  return { url: url.origin, anonKey };
}

export type AuthPayload = Record<string, unknown> & {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
};

function transportError(error: unknown): AuthServiceError {
  const value = error as { name?: string; cause?: { code?: string } };
  if (value?.name === "TimeoutError" || value?.name === "AbortError") {
    return new AuthServiceError("auth_timeout", 504, "timeout");
  }
  const code = value?.cause?.code;
  const reasons = ["ENOTFOUND", "EAI_AGAIN", "ECONNREFUSED", "ETIMEDOUT", "UND_ERR_CONNECT_TIMEOUT", "CERT_HAS_EXPIRED", "DEPTH_ZERO_SELF_SIGNED_CERT"];
  return new AuthServiceError("auth_unavailable", 503, code && reasons.includes(code) ? code : "network_error");
}

const providerErrors = new Set([
  "invalid_credentials", "email_not_confirmed", "email_address_invalid", "email_address_not_authorized",
  "email_exists", "user_already_exists", "signup_disabled", "email_provider_disabled", "weak_password",
  "over_email_send_rate_limit", "over_request_rate_limit", "captcha_failed", "user_banned",
  "refresh_token_not_found", "refresh_token_already_used", "session_not_found", "session_expired",
]);

export async function supabaseAuth(path: string, payload?: unknown, method: "GET" | "POST" = "POST") {
  const { url, anonKey } = authConfig();
  let response: Response;
  try {
    response = await fetch(`${url}/auth/v1/${path}`, {
      method,
      headers: {
        "content-type": "application/json", apikey: anonKey,
        // Publishable keys identify the app in apikey; they are not bearer JWTs.
        ...(!anonKey.startsWith("sb_publishable_") ? { authorization: `Bearer ${anonKey}` } : {}),
      },
      body: method === "POST" ? JSON.stringify(payload) : undefined,
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15000),
    });
  } catch (error) { throw transportError(error); }
  let data: AuthPayload;
  try {
    const value = await response.json();
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid_shape");
    data = value;
  } catch (error) {
    if (["TimeoutError", "AbortError"].includes((error as Error)?.name)) throw transportError(error);
    throw new AuthServiceError("auth_invalid_response", 502, "non_json_or_invalid_body", response.status);
  }
  if (!response.ok) {
    const code = typeof data.error_code === "string" ? data.error_code : typeof data.code === "string" ? data.code : "";
    if (["bad_jwt", "no_authorization", "invalid_api_key"].includes(code) ||
        (response.status === 401 && !code && typeof data.message === "string")) {
      throw new AuthServiceError("auth_config_invalid", 503, "api_key_rejected", response.status);
    }
    if (response.status >= 500) throw new AuthServiceError("auth_upstream_error", 502, "provider_server_error", response.status);
    if (providerErrors.has(code)) throw new AuthServiceError(code, response.status, "provider_rejection", response.status);
    if (response.status === 429) throw new AuthServiceError("over_request_rate_limit", 429, "provider_rate_limit", 429);
    if (data.error === "invalid_grant" && path === "token?grant_type=password") {
      throw new AuthServiceError("invalid_credentials", 401, "provider_rejection", response.status);
    }
    throw new AuthServiceError(path === "signup" ? "signup_failed" : "auth_unavailable", path === "signup" ? 400 : 503, "provider_rejection", response.status);
  }
  return data;
}

export function hasAuthSession(data: AuthPayload): data is AuthPayload & { access_token: string; refresh_token: string } {
  return typeof data.access_token === "string" && /^[A-Za-z0-9._~-]+$/.test(data.access_token) &&
    typeof data.refresh_token === "string" && /^[A-Za-z0-9._~-]+$/.test(data.refresh_token);
}
