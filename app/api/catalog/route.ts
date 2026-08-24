import { asc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { books } from "../../../db/schema";

export async function GET(request: Request) {
  const status = new URL(request.url).searchParams.get("status") || "published";
  const db = await getDb();
  const rows = await db.select().from(books).where(eq(books.status, status)).orderBy(asc(books.title));
  return Response.json({ books: rows });
}
