import { requireAccess } from "../../../lib/access";
import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { extractEpub } from "../../../lib/epub";
import { getDb } from "../../../../db";
import { books } from "../../../../db/schema";
import { chapterForPosition, packReaderContent, type ReaderIndex } from "../../../lib/reader-content";

export async function GET(request: Request) {
  const access = await requireAccess("participant");
  if (access.error) return access.error;
  const params = new URL(request.url).searchParams;
  const id = params.get("id");
  if (!id) return Response.json({ error: "book_required" }, { status: 400 });
  const paged=params.has('chapter')||params.has('position');
  const value=params.get('chapter')??params.get('position');
  if(paged&&(!/^\d+$/.test(value||'')||!Number.isSafeInteger(Number(value))||(params.has('chapter')&&params.has('position'))))
    return Response.json({error:'invalid_chapter'},{status:400});
  const db = await getDb();
  const [book] = await db.select().from(books).where(eq(books.id, id)).limit(1);
  if (!book || book.status !== "published" || !book.epubKey)
    return Response.json({ error: "content_not_found" }, { status: 404 });
  const source = await env.BUCKET.head(book.epubKey);
  if (!source)
    return Response.json({ error: "file_not_found" }, { status: 404 });
  if (book.format === "PDF")
    return Response.json({ error: "pdf_requires_viewer" }, { status: 415 });
  try {
    const cacheKey=`${book.epubKey}.sambu-content.json`;
    const cachedMeta=await env.BUCKET.head(cacheKey);
    // An edited/reprocessed source gets a new immutable cache namespace.
    const prefix=`${book.epubKey}.reader-v2.${source.etag}.${cachedMeta?.etag||'source'}`;
    let index:ReaderIndex|null=null;
    if(paged){const object=await env.BUCKET.get(`${prefix}.index.json`);if(object)index=JSON.parse(await object.text());}
    const readParsed=async()=>{
      const cached=await env.BUCKET.get(cacheKey);
      if(cached)return JSON.parse(await cached.text());
      const original=await env.BUCKET.get(book.epubKey!);
      if(!original)throw new Error('file_not_found');
      return extractEpub(new Uint8Array(await original.arrayBuffer()));
    };
    if(paged){
      if(!index){
        const packed=packReaderContent(await readParsed());index=packed.index;
        // Publish the index last, so another request never sees a partial cache.
        await env.BUCKET.put(`${prefix}.chapters`,packed.bytes);
        await env.BUCKET.put(`${prefix}.index.json`,JSON.stringify(index),{httpMetadata:{contentType:'application/json'}});
      }
      const entry=params.has('chapter')?index.chapters[Number(value)]:chapterForPosition(index,Number(value));
      if(!entry)return Response.json({error:'chapter_not_found'},{status:404});
      const content=await env.BUCKET.get(`${prefix}.chapters`,{range:{offset:entry.offset,length:entry.length}});
      if(!content)throw new Error('chapter_cache_missing');
      return Response.json({reader:{chapter:JSON.parse(await content.text()),chapterCount:index.chapters.length,totalParagraphs:index.totalParagraphs}},{headers:{'Cache-Control':'private, no-store'}});
    }
    // Compatibility for clients already open before chapter loading was added.
    const parsed = await readParsed();
    const chapters = parsed.map((chapter: { body: string[] }, index: number) => ({
      ...chapter,
      free: index < (book.freeChapters || 1),
    }));
    return Response.json({ chapters },{headers:{'Cache-Control':'private, no-store'}});
  } catch {
    return Response.json({ error: "invalid_epub" }, { status: 422 });
  }
}
