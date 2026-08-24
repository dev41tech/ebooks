import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { subscriptions } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ subscription: null });
  const db = await getDb();
  const [subscription] = await db.select().from(subscriptions).where(eq(subscriptions.userEmail, user.email)).limit(1);
  return Response.json({ subscription: subscription ?? null });
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "sign_in_required" }, { status: 401 });
  const body = (await request.json()) as { plan?: string };
  if (!body.plan || !["immersive_monthly", "immersive_annual", "family_monthly"].includes(body.plan)) return Response.json({ error: "invalid_plan" }, { status: 400 });
  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setDate(periodEnd.getDate() + 7);
  const db = await getDb();
  await db.insert(subscriptions).values({ id: crypto.randomUUID(), userEmail: user.email, plan: body.plan, status: "trialing", provider: "pending", currentPeriodEnd: periodEnd.toISOString(), createdAt: now.toISOString(), updatedAt: now.toISOString() }).onConflictDoUpdate({ target: subscriptions.userEmail, set: { plan: body.plan, status: "trialing", currentPeriodEnd: periodEnd.toISOString(), updatedAt: now.toISOString() } });
  return Response.json({ ok: true, checkoutRequired: true, message: "Plano reservado. Conecte o gateway para concluir a cobrança." }, { status: 202 });
}
