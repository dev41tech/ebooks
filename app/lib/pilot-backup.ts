import {env} from '../../db/runtime';
import {Zip,ZipPassThrough,strToU8} from 'fflate';

// Product data only. Authentication sessions, secrets and credentials are never exported.
export const BACKUP_TABLES=['profiles','books','chapters','reading_progress','bookmarks','favorites','analytics_events','subscriptions','reviews','reading_sessions','notifications','media_assets','import_batches','staging_books','discovery_searches','beta_feedback','ebook_drafts','ebook_draft_chapters','storage_metadata'] as const;
export const validAssetKey=(key:string)=>!key.startsWith('/')&&!key.includes('\\')&&!key.split('/').some(p=>p==='..'||p==='.')&&!key.includes('\0');
export async function prepareBackup(){
 const results=await env.DB.batch<Record<string,unknown>>(BACKUP_TABLES.map(table=>env.DB.prepare(`SELECT * FROM "${table}" LIMIT 5001`)));
 const tables:Record<string,Record<string,unknown>[]>=Object.fromEntries(BACKUP_TABLES.map((table,i)=>[table,results[i].results]));
 if(Object.values(tables).some(rows=>rows.length>5000))throw new Error('backup_limit');
 const schema=(await env.DB.prepare("SELECT table_name,column_name,data_type,is_nullable,column_default FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position").all()).results.filter(row=>BACKUP_TABLES.includes(row.table_name as typeof BACKUP_TABLES[number]));
 const keys=new Set<string>();const ebooks=new Set<string>();
 const add=(value:unknown,ebook=false)=>{if(typeof value==='string'&&value){if(!validAssetKey(value))throw new Error('invalid_asset');keys.add(value);if(ebook)ebooks.add(value);}};
 for(const row of tables.books){add(row.epub_key,true);add(row.cover_key);add(row.audio_key);}
 for(const row of tables.staging_books){add(row.storage_key,true);add(row.cover_key);}
 for(const row of tables.media_assets)add(row.storage_key);
 for(const row of tables.ebook_drafts){add(row.source_storage_key,true);add(row.cover_key);}
 if(keys.size>200)throw new Error('backup_limit');
 for(const key of ebooks){const parsed=`${key}.sambu-content.json`;if(await env.BUCKET.head(parsed))keys.add(parsed);}
 const assets:{key:string;size:number;etag:string;contentType:string;customMetadata:Record<string,string>}[]=[];
 let size=0;
 for(const key of keys){const object=await env.BUCKET.head(key);if(!object)throw new Error('backup_missing_file');size+=object.size;if(size>250_000_000)throw new Error('backup_limit');assets.push({key,size:object.size,etag:object.etag,contentType:object.httpMetadata?.contentType||'application/octet-stream',customMetadata:object.customMetadata||{}});}
 const snapshot={format:'sambu-postgres-backup-v1',createdAt:new Date().toISOString(),tables,schema,assets,excluded:['login credentials and sessions','hosting secrets','source code','unreferenced uploads','regenerable chapter caches']};
 const metadata=strToU8(JSON.stringify(snapshot));if(metadata.byteLength>10_000_000)throw new Error('backup_limit');
 return {snapshot,metadata};
}

/** ZIP store mode streams each source once; no complete ebook is buffered in the server. */
export function streamBackup(prepared:Awaited<ReturnType<typeof prepareBackup>>){
 let zip:Zip;
 const stream=new TransformStream<Uint8Array,Uint8Array>();
 const writer=stream.writable.getWriter();
 let pending:Promise<unknown>=Promise.resolve();
 const push=(bytes:Uint8Array)=>{pending=pending.then(()=>writer.write(bytes));};
 zip=new Zip((error,chunk)=>{if(error){pending=pending.then(()=>Promise.reject(error));return;}push(chunk);});
 const produce=async()=>{
  try{
   const entry=new ZipPassThrough('snapshot.json');zip.add(entry);entry.push(prepared.metadata,true);await pending;
   for(const asset of prepared.snapshot.assets){
    const object=await env.BUCKET.get(asset.key,{onlyIf:{etagMatches:asset.etag}});
    if(!object||!('body' in object))throw new Error('backup_source_changed');
    const entry=new ZipPassThrough(`assets/${asset.key}`);zip.add(entry);await pending;
    const reader=object.body.getReader();let read=0;
    try{while(true){const chunk=await reader.read();if(chunk.done)break;read+=chunk.value.byteLength;entry.push(chunk.value);await pending;}}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
    if(read!==asset.size)throw new Error('backup_source_changed');entry.push(new Uint8Array(),true);await pending;
   }
   zip.end();await pending;await writer.close();
  }catch(error){zip.terminate();await writer.abort(error).catch(()=>{});}
 };
 // Stream lifetime is bound to the response, and cancellation rejects writer writes.
 void produce();return stream.readable;
}
