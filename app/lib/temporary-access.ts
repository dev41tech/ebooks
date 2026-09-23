// Explicit, reversible server setting. Never derive this permission from a request.
export function temporaryAdminEnabled() {
  const until = process.env.SAMBU_TEMPORARY_PUBLIC_ADMIN_UNTIL || "";
  if (process.env.SAMBU_TEMPORARY_PUBLIC_ADMIN !== "true" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(until)) return false;
  const expiresAt = Date.parse(until);
  return Number.isFinite(expiresAt) && Date.now() < expiresAt;
}

// Separate from every real account; no Supabase identity or admin email is impersonated.
export const TEMPORARY_USER = Object.freeze({
  id: "sambu-temporary-public-test",
  email: "public-test@sambu.invalid",
  displayName: "Teste aberto Sambu",
  temporary: true as const,
});
