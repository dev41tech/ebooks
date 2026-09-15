import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../chatgpt-auth";
import { masterUnlocked } from "./master";
import { accessFor } from "./policy";
export async function sessionAccess() {
  const user = await getChatGPTUser();
  const config = env as unknown as Record<string, unknown>;
  return { user, ...accessFor(user?.email, config.SAMBU_ADMIN_EMAILS, config.SAMBU_BETA_EMAILS) };
}
export async function requireAccess(role: "admin" | "participant") {
  const session = await sessionAccess();
  if (!session.user) return { ...session, error: Response.json({ error: "sign_in_required" }, { status: 401 }) };
  if (!session[role]) return { ...session, error: Response.json({ error: role === "admin" ? "admin_required" : "invitation_required" }, { status: 403 }) };
  if (role === "admin" && !await masterUnlocked(session.user.email)) return { ...session, error: Response.json({ error: "master_required" }, { status: 403 }) };
  return { ...session, error: null };
}
