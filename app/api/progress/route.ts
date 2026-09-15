import { and, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { books, readingProgress } from "../../../db/schema";
import { requireAccess } from "../../lib/access";
import { isValidProgress } from "../../lib/policy";
export async function GET() {
  const access = await requireAccess("participant");
  if (access.error) return access.error;
  const db = await getDb();
  const rows = await db.select().from(readingProgress).where(eq(readingProgress.userEmail, access.user!.email));
  return Response.json({ progress: Object.fromEntries(rows.map(r => [r.bookId, r.progress])), locations: Object.fromEntries(rows.map(r => [r.bookId, { position: r.position, progress: r.progress }])) });
}
export async function POST(request: Request) {
  const access = await requireAccess("participant");
  if (access.error) return access.error;
  const body = await request.json().catch(() => ({})) as { bookId?: string; progress?: number; position?: number };
  if (!body.bookId || !isValidProgress(body.progress) || !Number.isInteger(body.position) || body.position! < 0 || body.position! > 1_000_000) return Response.json({ error: "invalid_payload" }, { status: 400 });
  const db = await getDb();
  const [book] = await db.select({ id: books.id }).from(books).where(and(eq(books.id, body.bookId), eq(books.status, "published"))).limit(1);
  if (!book) return Response.json({ error: "not_found" }, { status: 404 });
  const now = new Date().toISOString();
  await db.insert(readingProgress).values({ id: crypto.randomUUID(), userEmail: access.user!.email, bookId: body.bookId, chapter: 0, position: body.position!, progress: body.progress!, updatedAt: now }).onConflictDoUpdate({ target: [readingProgress.userEmail, readingProgress.bookId], set: { position: body.position!, progress: body.progress!, updatedAt: now } });
  return Response.json({ ok: true });
}
