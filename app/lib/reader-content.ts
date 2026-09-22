import { readingBlocks } from './reader-blocks';

export type ReadingBlock = ReturnType<typeof readingBlocks>[number];
export type ReaderChapter = { index:number; start:number; blocks:ReadingBlock[]; navigationLabel:string };
export type ReaderPage = { chapter:ReaderChapter; chapterCount:number; totalParagraphs:number };
export type ChapterEntry = { index:number; start:number; count:number; offset:number; length:number };
export type ReaderIndex = { chapters:ChapterEntry[]; totalParagraphs:number };
type Section = { id:string; title?:string; body:string[] };

/** Store chapters as byte ranges, so subsequent reads need only one chapter. */
export function packReaderContent(sections:Section[]) {
  const blocks=readingBlocks(sections), encoder=new TextEncoder();
  // Physical EPUB sections remain the paging unit; only numbered chapters
  // contribute to the visible total. Use the very same labels as the text.
  const chapterTotal=blocks.filter(block=>block.chapterLabel).length;
  const chunks:Uint8Array[]=[],chapters:ChapterEntry[]=[];
  let start=0,offset=0;
  for(const section of sections){
    const count=section.body.length;
    if(!count)continue;
    const index=chapters.length;
    const chapterBlocks=blocks.slice(start,start+count);
    const first=chapterBlocks[0];
    const navigationLabel=first.chapterLabel
      ? `${first.chapterLabel} · ${chapterTotal} capítulos`
      : first.heading || 'Início da leitura';
    const bytes=encoder.encode(JSON.stringify({index,start,blocks:chapterBlocks,navigationLabel} satisfies ReaderChapter));
    chapters.push({index,start,count,offset,length:bytes.length});chunks.push(bytes);
    start+=count;offset+=bytes.length;
  }
  if(!chapters.length)throw new Error('empty_epub');
  const bytes=new Uint8Array(offset);
  let cursor=0;for(const chunk of chunks){bytes.set(chunk,cursor);cursor+=chunk.length;}
  return {index:{chapters,totalParagraphs:start} satisfies ReaderIndex,bytes};
}

export function chapterForPosition(index:ReaderIndex,position:number) {
  const bounded=Math.min(Math.max(0,position),index.totalParagraphs-1);
  return index.chapters.find(c=>bounded>=c.start&&bounded<c.start+c.count)!;
}

export function chapterContains(page:ReaderPage,position:number) {
  const bounded=Math.min(Math.max(0,position),page.totalParagraphs-1);
  return bounded>=page.chapter.start&&bounded<page.chapter.start+page.chapter.blocks.length;
}
