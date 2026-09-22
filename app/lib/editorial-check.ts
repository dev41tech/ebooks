import {extractEpub,safeUnzip} from './epub';
import {strFromU8} from 'fflate';
export type EditorialReport={errors:string[];warnings:string[];sections:number;paragraphs:number;words:number;scope:string};
export function checkEbook(bytes:Uint8Array,meta:{title:string;author:string;cover:boolean;pdf:boolean}):EditorialReport{
 const report:EditorialReport={errors:[],warnings:[],sections:0,paragraphs:0,words:0,scope:meta.pdf?'PDF: assinatura do arquivo e cadastro. Texto e capítulos exigem conferência na prévia.':'EPUB: estrutura e sinais de formatação. Não avalia gramática, enredo ou direitos autorais.'};
 if(!meta.title.trim())report.errors.push('Informe o título.');
 if(!meta.author.trim()||/^(autor desconhecido|autor a confirmar)$/i.test(meta.author.trim()))report.errors.push('Informe a autoria correta.');
 if(meta.pdf){if(new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')report.errors.push('PDF inválido.');if(!meta.cover)report.warnings.push('Capa não enviada.');return report;}
 try{
  const sections=extractEpub(bytes),files=safeUnzip(bytes);
  report.sections=sections.length;report.paragraphs=sections.reduce((n,c)=>n+c.body.length,0);
  const opfs=Object.entries(files).filter(([k])=>/\.opf$/i.test(k)).map(([,v])=>strFromU8(v)).join('\n');
  if(!meta.cover&&!/cover-image|name\s*=\s*["']cover["']/i.test(opfs))report.warnings.push('Capa não encontrada no EPUB nem no cadastro.');
  if(!/<item\b[^>]*(?:properties\s*=\s*["'][^"']*\bnav\b|media-type\s*=\s*["']application\/x-dtbncx\+xml)/i.test(opfs))report.warnings.push('Sumário de navegação não identificado.');
  const titles=new Set<string>(),contents=new Set<string>();let duplicates=0,repeatedTitles=0,broken=0,short=0;
  for(const c of sections){
   const normalized=c.body.join(' ').replace(/\s+/g,' ').trim();
   report.words+=normalized.split(/\s+/).filter(Boolean).length;
   if(contents.has(normalized))duplicates++;contents.add(normalized);
   const title=c.title.toLocaleLowerCase('pt-BR').trim();if(titles.has(title))repeatedTitles++;titles.add(title);
   for(const p of c.body){if(/\p{L}-\s+\p{Ll}/u.test(p))broken++;if(p.trim().split(/\s+/).length<=3)short++;}
  }
  if(duplicates)report.warnings.push(`${duplicates} seção(ões) com conteúdo integralmente repetido. Confira antes de publicar.`);
  if(repeatedTitles)report.warnings.push(`${repeatedTitles} título(s) de seção repetido(s). Confira a sequência.`);
  if(broken)report.warnings.push(`${broken} parágrafo(s) com possível palavra quebrada por hífen. Conferência manual recomendada.`);
  if(short>10&&short/report.paragraphs>.35)report.warnings.push('Muitos parágrafos muito curtos; confira se as linhas foram importadas separadamente.');
 }catch{report.errors.push('Não foi possível extrair texto válido do EPUB. Confira o arquivo e o limite de 32 MB.');}
 return report;
}
