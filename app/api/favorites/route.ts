import { and, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { favorites } from "../../../db/schema";
import { getUser } from "../../auth";

export async function GET() {
  const user = await getUser();
  if (!user) return Response.json({ favorites: [] });
  const db = await getDb();
  const rows = await db.select({ bookId: favorites.bookId }).from(favorites).where(eq(favorites.userEmail, user.email));
  return Response.json({ favorites: rows.map((row) => row.bookId) });
}

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return Response.json({ error: "sign_in_required" }, { status: 401 });
  const body = (await request.json()) as { bookId?: string; favorite?: boolean };
  if (!body.bookId || typeof body.favorite !== "boolean") return Response.json({ error: "invalid_payload" }, { status: 400 });
  const db = await getDb();
  if (body.favorite) {
    await db.insert(favorites).values({ id: crypto.randomUUID(), userEmail: user.email, bookId: body.bookId, createdAt: new Date().toISOString() }).onConflictDoNothing();
  } else {
    await db.delete(favorites).where(and(eq(favorites.userEmail, user.email), eq(favorites.bookId, body.bookId)));
  }
  return Response.json({ ok: true, bookId: body.bookId, favorite: body.favorite });
}
