import { env } from "../../db/runtime";
import { getUser } from "../auth";
import { masterUnlocked } from "./master";
import { accessFor, emailList } from "./policy";
export async function sessionAccess() {
  const user = await getUser();
  const config = env as unknown as Record<string, unknown>;
  const access=accessFor(user?.email, config.SAMBU_ADMIN_EMAILS || config.ADMIN_EMAILS, config.SAMBU_BETA_EMAILS, config.SAMBU_BETA_OPEN ?? "true");
  const adminTrial=!!user && emailList(config.SAMBU_ADMIN_TESTER_EMAILS).includes(user.email.toLowerCase());
  return { user, ...access, ownerAdmin:access.admin, adminTrial, admin:access.admin||adminTrial, participant:access.participant||adminTrial };
}
export async function requireAccess(role: "admin" | "participant") {
  const session = await sessionAccess();
  if (!session.user) return { ...session, error: Response.json({ error: "sign_in_required" }, { status: 401 }) };
  if (!session[role]) return { ...session, error: Response.json({ error: role === "admin" ? "admin_required" : "invitation_required" }, { status: 403 }) };
  if (role === "admin" && !session.adminTrial && !await masterUnlocked(session.user.email)) return { ...session, error: Response.json({ error: "master_required" }, { status: 403 }) };
  return { ...session, error: null };
}
