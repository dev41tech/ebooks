import { cleanReaderProfile } from "../../lib/reader-profile";
import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { profiles } from "../../../db/schema";
import { getUser } from "../../auth";

export async function GET() {
  const user = await getUser();
  if (!user) return Response.json({ profile: null });
  if (user.temporary) return Response.json({ profile:null, temporaryAccess:true },{headers:{"Cache-Control":"no-store"}});
  const db = await getDb();
  const [profile] = await db.select().from(profiles).where(eq(profiles.email, user.email)).limit(1);
  return Response.json({ profile: profile ?? { email: user.email, displayName: user.displayName, role: "reader" } });
}

export async function PATCH(request: Request) {
  const user = await getUser();
  if (!user) return Response.json({ error: "sign_in_required" }, { status: 401 });
  if (user.temporary) return Response.json({ error: "personal_profile_unavailable" }, { status: 403 });
  const body = await request.json().catch(()=>null) as { displayName?: unknown; tasteProfile?: unknown }|null;
  if(!body || typeof body.displayName!=="string" || !body.displayName.trim())return Response.json({error:"invalid_profile",message:"Preencha seu nome para salvar o cadastro."},{status:400});
  const displayName = body.displayName?.trim().slice(0, 80) || user.displayName || user.email.split("@")[0];
  const db = await getDb();
  const [existing]=await db.select().from(profiles).where(eq(profiles.email,user.email)).limit(1);
  const tasteProfile=body.tasteProfile===undefined?existing?.tasteProfile??null:cleanReaderProfile(body.tasteProfile);
  await db.insert(profiles).values({ id: crypto.randomUUID(), email: user.email, displayName, role: "reader", tasteProfile: tasteProfile, createdAt: new Date().toISOString() }).onConflictDoUpdate({ target: profiles.email, set: { displayName, tasteProfile: tasteProfile } });
  return Response.json({ ok: true, profile: { email: user.email, displayName, tasteProfile: tasteProfile } });
}
