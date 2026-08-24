import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { strFromU8, unzipSync } from "fflate";
import { getDb } from "../../../../db";
import { books } from "../../../../db/schema";

type ZipFiles = Record<string, Uint8Array>;

function decodeEntities(value: string) {
  const named: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, n) =>
      String.fromCodePoint(parseInt(n, 16)),
    )
    .replace(/&#([0-9]+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10)))
    .replace(/&([a-z]+);/gi, (all, name) => named[name.toLowerCase()] ?? all);
}

function textOnly(html: string) {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/\s*\n\s*/g, "\n")
      .trim(),
  );
}

function resolvePath(baseFile: string, href: string) {
  const parts =
    `${baseFile.slice(0, baseFile.lastIndexOf("/") + 1)}${href.split("#")[0]}`.split(
      "/",
    );
  const resolved: string[] = [];
  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") resolved.pop();
    else resolved.push(part);
  }
  return resolved.join("/");
}

function extractEpub(bytes: Uint8Array) {
  const files: ZipFiles = unzipSync(bytes);
  const container = files["META-INF/container.xml"]
    ? strFromU8(files["META-INF/container.xml"])
    : "";
  const opfPath =
    container.match(/full-path=["']([^"']+)["']/i)?.[1] ||
    Object.keys(files).find((name) => name.toLowerCase().endsWith(".opf"));
  if (!opfPath || !files[opfPath]) throw new Error("invalid_epub");
  const opf = strFromU8(files[opfPath]);
  const manifest = new Map<string, string>();
  for (const match of opf.matchAll(/<item\b([^>]+)>?/gi)) {
    const attrs = match[1];
    const id = attrs.match(/\bid=["']([^"']+)["']/i)?.[1];
    const href = attrs.match(/\bhref=["']([^"']+)["']/i)?.[1];
    const media = attrs.match(/\bmedia-type=["']([^"']+)["']/i)?.[1] || "";
    if (id && href && /xhtml|html/i.test(media)) manifest.set(id, href);
  }
  const spine = [
    ...opf.matchAll(/<itemref\b[^>]*\bidref=["']([^"']+)["'][^>]*\/?\s*>/gi),
  ].map((match) => match[1]);
  const ordered = spine
    .map((id) => manifest.get(id))
    .filter((href): href is string => Boolean(href));
  const hrefs = ordered.length ? ordered : [...manifest.values()];
  const chapters = [];
  for (const href of hrefs.slice(0, 250)) {
    const path = resolvePath(opfPath, href);
    if (
      !files[path] ||
      /(?:cover|title[_-]?page|nav)\.(?:x?html?)$/i.test(path)
    )
      continue;
    const html = strFromU8(files[path]);
    const title =
      textOnly(html.match(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i)?.[1] || "") ||
      textOnly(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "") ||
      `Capítulo ${chapters.length + 1}`;
    const body = [
      ...html.matchAll(
        /<(?:p|blockquote|li)[^>]*>([\s\S]*?)<\/(?:p|blockquote|li)>/gi,
      ),
    ]
      .map((match) => textOnly(match[1]))
      .filter((text) => text.length > 1);
    if (!body.length) {
      const fallback = textOnly(
        html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] || "",
      );
      if (fallback) body.push(...fallback.split(/\n{2,}/).filter(Boolean));
    }
    if (body.length)
      chapters.push({
        id: `${path}-${chapters.length}`,
        number: chapters.length + 1,
        title,
        minutes: Math.max(
          1,
          Math.ceil(body.join(" ").split(/\s+/).length / 220),
        ),
        free: chapters.length === 0,
        body,
      });
  }
  if (!chapters.length) throw new Error("empty_epub");
  return chapters;
}

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
  if (book.format === "PDF")
    return Response.json({ error: "pdf_requires_viewer" }, { status: 415 });
  try {
    const chapters = extractEpub(
      new Uint8Array(await object.arrayBuffer()),
    ).map((chapter, index) => ({
      ...chapter,
      free: index < (book.freeChapters || 1),
    }));
    return Response.json({ chapters });
  } catch {
    return Response.json({ error: "invalid_epub" }, { status: 422 });
  }
}
