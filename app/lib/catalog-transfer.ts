import {strFromU8, unzipSync} from 'fflate';

export const MAX_BACKUP_BYTES = 100_000_000;
export type TransferBook = {
 id:string; slug:string|null; title:string; subtitle:string|null; author:string; authorId:string|null;
 genre:string; categoryMain:string|null; categoriesSecondary:string[]|null; language:string; isbn:string|null; collection:string|null; featured:boolean;
 freeChapters:number; format:'EPUB'; ageRating:string|null; description:string; priceCents:number|null;
 subscribersOnly:boolean; publishedAt:string; createdAt:string; updatedAt:string|null;
};
export type BackupBook = {book:TransferBook; key:string; size:number};
const safeKey = (value:string) => !!value && !value.startsWith('/') && !value.includes('\\') && !value.includes('\0') && !value.split('/').some(part => part === '.' || part === '..');
function text(value:unknown, limit:number, required=false):string|null {
 if (value == null || value === '') { if (required) throw new Error('invalid_book'); return null; }
 if (typeof value !== 'string' || value.length > limit || !value.trim()) throw new Error('invalid_book');
 return value;
}
function integer(value:unknown, max:number, fallback:number|null):number|null {
 if (value == null) return fallback;
 if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > max) throw new Error('invalid_book');
 return value;
}
function bool(value:unknown):boolean {
 if (value == null || value === 0 || value === false) return false;
 if (value === 1 || value === true) return true;
 throw new Error('invalid_book');
}
function date(value:unknown, required=false):string|null {
 const result=text(value, 40, required);
 if (result && !Number.isFinite(Date.parse(result))) throw new Error('invalid_book');
 return result;
}
function categories(value:unknown):string[]|null {
 if(value==null)return null;
 if(!Array.isArray(value) || value.length>30 || value.some(item=>typeof item!=='string' || item.length>300))throw new Error('invalid_book');
 return value;
}
/** The transfer accepts data fields only, never SQL, roles or account records. */
export function transferBook(input:unknown):TransferBook {
 if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('invalid_book');
 const b=input as Record<string,unknown>;
 const id=text(b.id, 100, true)!;
 if (!/^[a-zA-Z0-9_-]+$/.test(id) || b.format !== 'EPUB') throw new Error('invalid_book');
 return {
  id, slug:text(b.slug,180), title:text(b.title,140,true)!, subtitle:text(b.subtitle,160),
  author:text(b.author,100,true)!, authorId:text(b.authorId,100), genre:text(b.genre,100,true)!,
  categoryMain:text(b.categoryMain,300), categoriesSecondary:categories(b.categoriesSecondary),
  language:text(b.language,12) || 'pt-BR', isbn:text(b.isbn,32), collection:text(b.collection,100),
  featured:bool(b.featured), freeChapters:integer(b.freeChapters,1000,1)!, format:'EPUB',
  ageRating:text(b.ageRating,30), description:text(b.description,10000,true)!,
  priceCents:integer(b.priceCents,2_147_483_647,null), subscribersOnly:bool(b.subscribersOnly),
  publishedAt:date(b.publishedAt,true)!, createdAt:date(b.createdAt,true)!, updatedAt:date(b.updatedAt),
 };
}

/** Inspect the bounded archive without unpacking ebooks or personal tables. */
export function inspectCatalogBackup(bytes:Uint8Array):BackupBook[] {
 if (!bytes.length || bytes.length > MAX_BACKUP_BYTES) throw new Error('backup_too_large');
 const entries=new Map<string,number>(); let total=0;
 const metadata=unzipSync(bytes,{filter(file){
  if (!safeKey(file.name) || entries.has(file.name)) throw new Error('invalid_backup');
  entries.set(file.name,file.originalSize); total+=file.originalSize;
  if (entries.size>1000 || total>270_000_000 || file.originalSize>250_000_000) throw new Error('backup_too_large');
  if (file.name==='snapshot.json' && file.originalSize>10_000_000) throw new Error('backup_too_large');
  return file.name==='snapshot.json';
 }});
 if (!metadata['snapshot.json']) throw new Error('invalid_backup');
 const snapshot=JSON.parse(strFromU8(metadata['snapshot.json']));
 if (!['sambu-pilot-backup-v1','sambu-postgres-backup-v1'].includes(snapshot.format) || !Array.isArray(snapshot.tables?.books) || !Array.isArray(snapshot.assets)) throw new Error('invalid_backup');
 const rows=snapshot.tables.books.filter((b:Record<string,unknown>)=>b.status==='published');
 if (!rows.length || rows.length>200) throw new Error('empty_or_large_catalog');
 const ids=new Set<string>(), slugs=new Set<string>();
 return rows.map((b:Record<string,unknown>)=>{
  if (b.format!=='EPUB' || b.cover_key || b.audio_key) throw new Error('unsupported_catalog');
  const book=transferBook({id:b.id,slug:b.slug,title:b.title,subtitle:b.subtitle,author:b.author,authorId:b.author_id,
   genre:b.genre,categoryMain:b.category_main,categoriesSecondary:b.categories_secondary,language:b.language,isbn:b.isbn,collection:b.collection,featured:b.featured,freeChapters:b.free_chapters,
   format:b.format,ageRating:b.age_rating,description:b.description,priceCents:b.price_cents,subscribersOnly:b.subscribers_only,
   publishedAt:b.published_at,createdAt:b.created_at,updatedAt:b.updated_at});
  if (ids.has(book.id) || (book.slug && slugs.has(book.slug))) throw new Error('duplicate_book');
  ids.add(book.id); if(book.slug) slugs.add(book.slug);
  const key=b.epub_key;
  if (typeof key!=='string' || !safeKey(key) || !/\.epub$/i.test(key)) throw new Error('missing_book_file');
  const size=entries.get('assets/'+key);
  const asset=snapshot.assets.find((a:{key?:unknown})=>a.key===key);
  if (!size || size>32_000_000 || !asset || asset.size!==size) throw new Error('missing_book_file');
  return {book,key,size};
 });
}

export function extractBackupBook(bytes:Uint8Array, item:BackupBook):Uint8Array {
 const name='assets/'+item.key;
 const selected=unzipSync(bytes,{filter(file){
  if (file.name!==name) return false;
  if (file.originalSize!==item.size || file.originalSize>32_000_000) throw new Error('invalid_book_file');
  return true;
 }});
 if (!selected[name] || selected[name].length!==item.size) throw new Error('missing_book_file');
 return selected[name];
}
