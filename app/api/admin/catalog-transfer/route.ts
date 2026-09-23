import {eq, or} from 'drizzle-orm';
import {getDb} from '../../../../db';
import {books} from '../../../../db/schema';
import {env} from '../../../../db/runtime';
import {requireAccess} from '../../../lib/access';
import {masterUnlocked} from '../../../lib/master';
import {transferBook} from '../../../lib/catalog-transfer';
import {extractEpub} from '../../../lib/epub';

async function ownerAccess() {
 const access=await requireAccess('admin');
 if(access.error) return access;
 if(access.temporaryAdmin) return access;
 if(!access.ownerAdmin || !await masterUnlocked(access.user!.email)) return {...access,error:Response.json({error:'owner_master_required'},{status:403})};
 return access;
}
export async function GET() {
 const access=await ownerAccess(); if(access.error) return access.error;
 const db=await getDb();
 return Response.json({books:await db.select({id:books.id,slug:books.slug,status:books.status}).from(books)},{headers:{'Cache-Control':'private, no-store'}});
}
export async function POST(request:Request) {
 const access=await ownerAccess(); if(access.error) return access.error;
 if(request.headers.get('origin')!==new URL(request.url).origin) return Response.json({error:'invalid_origin'},{status:403});
 if(!request.body) return Response.json({error:'invalid_payload'},{status:400});
 const reader=request.body.getReader(); let raw=''; let size=0; const decoder=new TextDecoder();
 try {
  while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>65000){await reader.cancel();return Response.json({error:'payload_too_large'},{status:413});}raw+=decoder.decode(part.value,{stream:true});}
  raw+=decoder.decode();
 } finally {reader.releaseLock();}
 let body, book;
 try {body=JSON.parse(raw);book=transferBook(body.book);} catch {return Response.json({error:'invalid_book'},{status:400});}
 const db=await getDb();
 const condition=book.slug?or(eq(books.id,book.id),eq(books.slug,book.slug))!:eq(books.id,book.id);
 const existing=await db.select().from(books).where(condition);
 if(existing.length) {
  if(existing.length===1 && existing[0].id===book.id && existing[0].status==='published') return Response.json({ok:true,alreadyExists:true,id:book.id});
  return Response.json({error:'book_conflict'},{status:409});
 }
 const key=body.storageKey;
 const root='imports/direct/'+encodeURIComponent(access.user!.email.toLowerCase())+'/';
 if(typeof key!=='string' || !key.startsWith(root) || key.includes('\\') || key.includes('\0') || key.split('/').some((p:string)=>p==='.'||p==='..') || !/\.epub$/i.test(key)) return Response.json({error:'invalid_storage_key'},{status:400});
 if(typeof body.sha256!=='string' || !/^[a-f0-9]{64}$/.test(body.sha256)) return Response.json({error:'invalid_checksum'},{status:400});
 const source=await env.BUCKET.head(key);
 if(!source || source.customMetadata.owner!==access.user!.email || source.size<1 || source.size>32_000_000) return Response.json({error:'invalid_book_file'},{status:422});
 const object=await env.BUCKET.get(key,{onlyIf:{etagMatches:source.etag}});
 if(!object) return Response.json({error:'source_changed'},{status:409});
 const bytes=new Uint8Array(await object.arrayBuffer());
 const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(n=>n.toString(16).padStart(2,'0')).join('');
 if(bytes.length!==source.size || digest!==body.sha256) return Response.json({error:'checksum_mismatch'},{status:422});
 let parsed;
 try{parsed=extractEpub(bytes);}catch{return Response.json({error:'invalid_epub'},{status:422});}
 // Publish only after the complete file and readable content are safely stored.
 await env.BUCKET.put(key+'.sambu-content.json',JSON.stringify(parsed),{httpMetadata:{contentType:'application/json'}});
 const inserted=await db.insert(books).values({...book,epubKey:key,status:'published'}).onConflictDoNothing().returning({id:books.id});
 if(!inserted.length) {
  const [current]=await db.select().from(books).where(eq(books.id,book.id));
  if(!current || current.status!=='published') return Response.json({error:'book_conflict'},{status:409});
 }
 return Response.json({ok:true,id:book.id,alreadyExists:!inserted.length},{status:inserted.length?201:200});
}
