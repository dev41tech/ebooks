import { and, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { bookmarks } from "../../../db/schema";
import { getUser } from "../../auth";

export async function GET(request: Request) {
  const user = await getUser();
  if (!user) return Response.json({ bookmarks: [] });
  const bookId = new URL(request.url).searchParams.get("bookId");
  const db = await getDb();
  const rows = bookId
    ? await db
        .select()
        .from(bookmarks)
        .where(
          and(
            eq(bookmarks.userEmail, user.email),
            eq(bookmarks.bookId, bookId),
          ),
        )
    : await db
        .select()
        .from(bookmarks)
        .where(eq(bookmarks.userEmail, user.email));
  return Response.json({ bookmarks: rows });
}

export async function POST(request: Request) {
  const user = await getUser();
  if (!user)
    return Response.json({ error: "sign_in_required" }, { status: 401 });
  const body = (await request.json()) as {
    bookId?: string;
    chapter?: number;
    chapterId?: string;
    active?: boolean;
  };
  if (!body.bookId || !Number.isInteger(body.chapter))
    return Response.json({ error: "invalid_payload" }, { status: 400 });
  const db = await getDb();
  const where = and(
    eq(bookmarks.userEmail, user.email),
    eq(bookmarks.bookId, body.bookId),
    eq(bookmarks.chapter, body.chapter || 0),
  );
  if (body.active === false) await db.delete(bookmarks).where(where);
  else
    await db
      .insert(bookmarks)
      .values({
        id: crypto.randomUUID(),
        userEmail: user.email,
        bookId: body.bookId,
        chapter: body.chapter || 0,
        chapterId: body.chapterId || null,
        label: `Capítulo ${(body.chapter || 0) + 1}`,
        createdAt: new Date().toISOString(),
      })
      .onConflictDoNothing();
  return Response.json({ ok: true, active: body.active !== false });
}
