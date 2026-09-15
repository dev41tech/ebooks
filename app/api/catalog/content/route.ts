import { requireAccess } from "../../../lib/access";
import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { extractEpub } from "../../../lib/epub";
import { getDb } from "../../../../db";
import { books } from "../../../../db/schema";

export async function GET(request: Request) {
  const access = await requireAccess("participant");
  if (access.error) return access.error;
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return Response.json({ error: "book_required" }, { status: 400 });
  const db = await getDb();
  const [book] = await db.select().from(books).where(eq(books.id, id)).limit(1);
  if (!book || book.status !== "published" || !book.epubKey)
    return Response.json({ error: "content_not_found" }, { status: 404 });
  const object = await env.BUCKET.get(book.epubKey);
  if (!object)
    return Response.json({ error: "file_not_found" }, { status: 404 });
  if (book.format === "PDF")
    return Response.json({ error: "pdf_requires_viewer" }, { status: 415 });
  try {
    const cached = await env.BUCKET.get(`${book.epubKey}.sambu-content.json`);
    const parsed = cached ? JSON.parse(await cached.text()) : extractEpub(new Uint8Array(await object.arrayBuffer()));
    const chapters = parsed.map((chapter: { body: string[] }, index: number) => ({
      ...chapter,
      free: index < (book.freeChapters || 1),
    }));
    return Response.json({ chapters });
  } catch {
    return Response.json({ error: "invalid_epub" }, { status: 422 });
  }
}
