type ReadingSection={id:string;title?:string;body:string[]};
const normalized=(text:string)=>text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().replace(/[.:\s]+$/g,'');
export function readingBlocks(sections:ReadingSection[]){
 let position=0;
 return sections.flatMap((section,sectionIndex)=>section.body.map((text,index)=>{
  const title=section.title?.trim()||'';
  const openingIntro=sectionIndex===0&&normalized(title)==='introducao';
  const heading=index===0&&!openingIntro?title:'';
  // Keep the original paragraph index so existing reading positions stay valid.
  const hidden=index===0&&((sectionIndex===0&&normalized(text)==='introducao')||!!heading&&normalized(text)===normalized(heading));
  return {position:position++,text,heading,hidden};
 }));
}
