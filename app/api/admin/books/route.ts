import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { books } from "../../../../db/schema";
import { getChatGPTUser } from "../../../chatgpt-auth";

export async function GET() {
  const user = await getChatGPTUser();
  if (!user)
    return Response.json({ error: "sign_in_required" }, { status: 401 });
  const db = await getDb();
  return Response.json({
    books: await db.select().from(books).orderBy(desc(books.createdAt)),
  });
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user)
    return Response.json({ error: "sign_in_required" }, { status: 401 });
  const body = (await request.json()) as Record<string, unknown>;
  const title = String(body.title || "")
    .trim()
    .slice(0, 140);
  const author = String(body.author || "")
    .trim()
    .slice(0, 100);
  const genre = String(body.genre || "")
    .trim()
    .slice(0, 60);
  const description = String(body.description || "")
    .trim()
    .slice(0, 4000);
  if (!title || !author || !genre || !description)
    return Response.json({ error: "required_fields" }, { status: 400 });
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const slug =
    String(body.slug || title)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 90) +
    "-" +
    id.slice(0, 6);
  const record = {
    id,
    slug,
    title,
    subtitle: String(body.subtitle || "").slice(0, 160) || null,
    author,
    genre,
    language: String(body.language || "pt-BR").slice(0, 12),
    isbn: String(body.isbn || "").slice(0, 32) || null,
    collection: String(body.collection || "").slice(0, 100) || null,
    featured: Boolean(body.featured),
    freeChapters: Math.max(0, Math.min(20, Number(body.freeChapters || 1))),
    format: String(body.format || "Ebook"),
    ageRating: String(body.ageRating || "14"),
    description,
    priceCents: Math.max(0, Math.round(Number(body.price || 0) * 100)),
    subscribersOnly: Boolean(body.subscribersOnly),
    status: String(body.status || "draft"),
    createdAt: now,
    updatedAt: now,
  };
  const db = await getDb();
  await db.insert(books).values(record);
  return Response.json({ ok: true, book: record }, { status: 201 });
}

export async function PATCH(request: Request) {
  const user = await getChatGPTUser();
  if (!user)
    return Response.json({ error: "sign_in_required" }, { status: 401 });
  const body = (await request.json()) as Record<string, unknown>;
  const id = String(body.id || "");
  const status = String(body.status || "draft");
  if (
    !id ||
    !["draft", "review", "scheduled", "published", "archived"].includes(status)
  )
    return Response.json({ error: "invalid_payload" }, { status: 400 });
  const db = await getDb();
  const now = new Date().toISOString();
  await db
    .update(books)
    .set({
      title: body.title ? String(body.title).trim().slice(0, 140) : undefined,
      subtitle:
        body.subtitle === undefined
          ? undefined
          : String(body.subtitle).slice(0, 160) || null,
      author: body.author
        ? String(body.author).trim().slice(0, 100)
        : undefined,
      genre: body.genre ? String(body.genre).trim().slice(0, 60) : undefined,
      language: body.language ? String(body.language).slice(0, 12) : undefined,
      isbn:
        body.isbn === undefined
          ? undefined
          : String(body.isbn).slice(0, 32) || null,
      collection:
        body.collection === undefined
          ? undefined
          : String(body.collection).slice(0, 100) || null,
      featured:
        body.featured === undefined ? undefined : Boolean(body.featured),
      freeChapters:
        body.freeChapters === undefined
          ? undefined
          : Math.max(0, Math.min(20, Number(body.freeChapters))),
      format: body.format ? String(body.format).slice(0, 30) : undefined,
      ageRating: body.ageRating
        ? String(body.ageRating).slice(0, 10)
        : undefined,
      description: body.description
        ? String(body.description).slice(0, 4000)
        : undefined,
      priceCents:
        body.price === undefined
          ? undefined
          : Math.max(0, Math.round(Number(body.price) * 100)),
      subscribersOnly:
        body.subscribersOnly === undefined
          ? undefined
          : Boolean(body.subscribersOnly),
      status,
      publishedAt: status === "published" ? now : null,
      updatedAt: now,
    })
    .where(eq(books.id, id));
  return Response.json({ ok: true });
}
