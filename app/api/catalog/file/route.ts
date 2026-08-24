import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { books } from "../../../../db/schema";

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return Response.json({ error: "book_required" }, { status: 400 });
  const db = await getDb();
  const [book] = await db.select().from(books).where(eq(books.id, id)).limit(1);
  if (!book || book.status !== "published" || !book.epubKey)
    return Response.json({ error: "content_not_found" }, { status: 404 });
  const object = await env.BUCKET.get(book.epubKey);
  if (!object)
    return Response.json({ error: "file_not_found" }, { status: 404 });
  const isPdf = book.format?.toUpperCase().includes("PDF");
  return new Response(object.body, {
    headers: {
      "content-type": isPdf ? "application/pdf" : "application/epub+zip",
      "content-disposition": `${isPdf ? "inline" : "attachment"}; filename="${book.slug || "ebook"}.${isPdf ? "pdf" : "epub"}"`,
      "cache-control": "private, max-age=300",
    },
  });
}
