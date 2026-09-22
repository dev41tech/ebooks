import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { books } from "../../../db/schema";

export async function GET(request: Request) {
  const status = "published";
  const db = await getDb();
  const rows = await db
    .select()
    .from(books)
    .where(eq(books.status, status))
    .orderBy(desc(books.publishedAt), desc(books.createdAt));
  return Response.json({ books: rows.map(({ epubKey, audioKey, coverKey, ...book }) => book) });
}
