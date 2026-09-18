type ReadingSection={id:string;title?:string;body:string[]};
const normalized=(text:string)=>text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().replace(/[.:\s]+$/g,'');
const chapterPattern=/^cap[ií]tulo\s+(\d+|[ivxlcdm]+)(?=$|[\s.:—–-])\s*[.:—–-]?\s*(.*)$/i;
const introPattern=/^introdu[çc][ãa]o(?=$|[\s.:—–-])\s*[.:—–-]?\s*/i;
export function readingBlocks(sections:ReadingSection[]){
 let position=0,chapterSequence=0;
 return sections.flatMap((section,sectionIndex)=>{
  const title=section.title?.trim()||'';
  const intro=normalized(title)==='introducao'||sectionIndex===0&&introPattern.test(section.body[0]?.trim()||'');
  const frontMatter=/^(prologo|epilogo|prefacio|dedicatoria|agradecimentos|sumario|sobre o autor|sobre a autora|copyright)$/.test(normalized(title));
  const titleChapter=title.match(chapterPattern);
  // Only treat opening standalone labels as metadata, never scan narrative paragraphs.
  const opening=section.body.slice(0,3);
  const labelIndex=opening.findIndex((text,i)=>{
    const match=text.trim().match(chapterPattern);
    return !!match&&!match[2]&&opening.slice(0,i).every(p=>normalized(p)===normalized(title));
  });
  const bodyChapter=labelIndex>=0?opening[labelIndex].trim().match(chapterPattern):null;
  let chapterLabel='',heading='';
  if(!intro){
    const explicit=titleChapter||bodyChapter;
    if(!frontMatter){
      chapterSequence=explicit&&/^\d+$/.test(explicit[1])?Number(explicit[1]):chapterSequence+1;
      chapterLabel=`Capítulo ${explicit?.[1]||chapterSequence}`;
    }
    heading=titleChapter?titleChapter[2]:title;
  }
  return section.body.map((original,index)=>{
    // Preserve every original index for cross-device reading progress.
    const text=intro&&index===0?original.trimStart().replace(introPattern,''):original;
    const repeatedTitle=index<=2&&opening.slice(0,index).every(p=>normalized(p)===normalized(title)||!!p.trim().match(chapterPattern))&&!!title&&normalized(original)===normalized(title);
    const hidden=!text.trim()||(!intro&&(index===labelIndex||repeatedTitle));
    return {position:position++,text,heading:index===0?heading:'',chapterLabel:index===0?chapterLabel:'',hidden};
  });
 });
}
