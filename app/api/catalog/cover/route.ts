import { eq } from "drizzle-orm";
import { strFromU8, unzipSync } from "fflate";
import { getDb } from "../../../../db";
import { books } from "../../../../db/schema";
import { getObject } from "../../../../db/storage";

function mediaType(path: string) {
  const extension = path.toLowerCase().split(".").pop();
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  if (extension === "gif") return "image/gif";
  if (extension === "svg") return "image/svg+xml";
  return "image/jpeg";
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

function extractCover(bytes: Uint8Array) {
  const files = unzipSync(bytes);
  const container = files["META-INF/container.xml"]
    ? strFromU8(files["META-INF/container.xml"])
    : "";
  const opfPath =
    container.match(/full-path=["']([^"']+)["']/i)?.[1] ||
    Object.keys(files).find((name) => name.toLowerCase().endsWith(".opf"));
  if (!opfPath || !files[opfPath]) return null;
  const opf = strFromU8(files[opfPath]);
  const coverId = opf.match(
    /<meta\b[^>]*name=["']cover["'][^>]*content=["']([^"']+)["']/i,
  )?.[1];
  const items = [...opf.matchAll(/<item\b([^>]+)>?/gi)].map((match) => {
    const attrs = match[1];
    return {
      id: attrs.match(/\bid=["']([^"']+)["']/i)?.[1],
      href: attrs.match(/\bhref=["']([^"']+)["']/i)?.[1],
      media: attrs.match(/\bmedia-type=["']([^"']+)["']/i)?.[1],
      properties: attrs.match(/\bproperties=["']([^"']+)["']/i)?.[1] || "",
    };
  });
  const item =
    items.find((entry) => entry.properties.includes("cover-image")) ||
    items.find((entry) => entry.id === coverId) ||
    items.find(
      (entry) =>
        entry.media?.startsWith("image/") &&
        /(?:^|[\/_-])cover(?:[._-]|$)/i.test(entry.href || ""),
    );
  const path = item?.href
    ? resolvePath(opfPath, item.href)
    : Object.keys(files).find(
        (name) =>
          /(?:^|\/)cover\.(?:jpe?g|png|webp|gif)$/i.test(name) &&
          !name.startsWith("__MACOSX"),
      );
  if (!path || !files[path]) return null;
  return { bytes: files[path], type: item?.media || mediaType(path) };
}

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return new Response(null, { status: 400 });
  const db = await getDb();
  const [book] = await db.select().from(books).where(eq(books.id, id)).limit(1);
  if (!book || book.status !== "published")
    return new Response(null, { status: 404 });

  if (book.coverKey) {
    const cover = await getObject(book.coverKey);
    if (cover)
      return new Response(cover.body, {
        headers: {
          "content-type": cover.contentType || "image/jpeg",
          "cache-control": "public, max-age=86400",
        },
      });
  }
  if (!book.epubKey || book.format?.toUpperCase().includes("PDF"))
    return new Response(null, { status: 404 });
  const ebook = await getObject(book.epubKey);
  if (!ebook) return new Response(null, { status: 404 });
  try {
    const cover = extractCover(new Uint8Array(await ebook.arrayBuffer()));
    if (!cover) return new Response(null, { status: 404 });
    return new Response(cover.bytes, {
      headers: {
        "content-type": cover.type,
        "cache-control": "public, max-age=86400",
      },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}
