import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { books, mediaAssets } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";

const allowed: Record<string, string[]> = {
  cover: ["image/jpeg", "image/png", "image/webp"],
  epub: ["application/epub+zip", "application/pdf"],
  audio: ["audio/mpeg", "audio/mp4", "audio/x-m4a"],
};
const limits: Record<string, number> = {
  cover: 8_000_000,
  epub: 40_000_000,
  audio: 250_000_000,
};

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user)
    return Response.json({ error: "sign_in_required" }, { status: 401 });
  const form = await request.formData();
  const file = form.get("file");
  const kind = String(form.get("kind") || "");
  const bookId = String(form.get("bookId") || "") || null;
  if (
    !(file instanceof File) ||
    !allowed[kind]?.includes(file.type) ||
    file.size > (limits[kind] || 0)
  )
    return Response.json({ error: "invalid_file" }, { status: 400 });
  const id = crypto.randomUUID();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-120);
  const storageKey = `books/${bookId || "unassigned"}/${kind}/${id}-${safeName}`;
  await env.BUCKET.put(storageKey, file.stream(), {
    httpMetadata: { contentType: file.type },
    customMetadata: { owner: user.email, kind },
  });
  const record = {
    id,
    ownerEmail: user.email,
    bookId,
    kind,
    storageKey,
    fileName: file.name.slice(0, 180),
    contentType: file.type,
    size: file.size,
    status: "ready",
    createdAt: new Date().toISOString(),
  };
  const db = await getDb();
  await db.insert(mediaAssets).values(record);
  if (bookId) {
    const keyField =
      kind === "cover" ? "coverKey" : kind === "audio" ? "audioKey" : "epubKey";
    await db
      .update(books)
      .set({ [keyField]: storageKey, updatedAt: new Date().toISOString() })
      .where(eq(books.id, bookId));
  }
  return Response.json({ ok: true, asset: record }, { status: 201 });
}

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user)
    return Response.json({ error: "sign_in_required" }, { status: 401 });
  const bookId = new URL(request.url).searchParams.get("bookId");
  const db = await getDb();
  const rows = bookId
    ? await db.select().from(mediaAssets).where(eq(mediaAssets.bookId, bookId))
    : [];
  return Response.json({ assets: rows });
}
