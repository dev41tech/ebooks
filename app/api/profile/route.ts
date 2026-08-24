import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { profiles } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ profile: null });
  const db = await getDb();
  const [profile] = await db.select().from(profiles).where(eq(profiles.email, user.email)).limit(1);
  return Response.json({ profile: profile ?? { email: user.email, displayName: user.displayName, role: "reader" } });
}

export async function PATCH(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "sign_in_required" }, { status: 401 });
  const body = (await request.json()) as { displayName?: string; tasteProfile?: unknown };
  const displayName = body.displayName?.trim().slice(0, 80) || user.displayName || user.email.split("@")[0];
  const db = await getDb();
  await db.insert(profiles).values({ id: crypto.randomUUID(), email: user.email, displayName, role: "reader", tasteProfile: body.tasteProfile ?? null, createdAt: new Date().toISOString() }).onConflictDoUpdate({ target: profiles.email, set: { displayName, tasteProfile: body.tasteProfile ?? null } });
  return Response.json({ ok: true, profile: { email: user.email, displayName, tasteProfile: body.tasteProfile ?? null } });
}
