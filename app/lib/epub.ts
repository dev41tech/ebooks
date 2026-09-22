import { strFromU8, unzipSync } from "fflate";
export function safeUnzip(bytes: Uint8Array) {
  if (bytes.byteLength > 32_000_000) throw new Error("epub_too_large");
  let total = 0, count = 0;
  return unzipSync(bytes, { filter(file) {
    total += file.originalSize; count++;
    if (total > 48_000_000 || file.originalSize > 12_000_000 || count > 2000) throw new Error("epub_expansion_limit");
    return true;
  }});
}
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

export function extractEpub(bytes: Uint8Array) {
  const files: ZipFiles = safeUnzip(bytes);
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
  const chapters: { id: string; number: number; title: string; minutes: number; free: boolean; body: string[] }[] = [];
  for (const href of hrefs) {
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

