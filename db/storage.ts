import {database} from './sql';
type Metadata={contentType?:string};
type GetOptions={range?:{offset:number;length:number};onlyIf?:{etagMatches:string}};
type PutOptions={size?:number;httpMetadata?:Metadata;customMetadata?:Record<string,string>};
function config(){
 const {SUPABASE_URL:url,SUPABASE_SERVICE_ROLE_KEY:key,SUPABASE_STORAGE_BUCKET:bucket='sambu'}=process.env;
 if(!url||!key)throw new Error('Supabase Storage não configurado');
 return {url:url.replace(/\/+$/,''),key,bucket};
}
function objectUrl(key:string){
 if(!key||key.startsWith('/')||key.includes('\\')||key.includes('\0')||key.split('/').some(x=>x==='.'||x==='..'))throw new Error('invalid_storage_key');
 const c=config();return {url:c.url+'/storage/v1/object/'+encodeURIComponent(c.bucket)+'/'+key.split('/').map(encodeURIComponent).join('/'),headers:{authorization:'Bearer '+c.key,apikey:c.key}};
}
async function metadata(key:string){
 const row=await database.prepare('SELECT metadata FROM storage_metadata WHERE key=?').bind(key).first<{metadata:Record<string,string>}>();
 return row?.metadata||{};
}
function info(response:Response,key:string,customMetadata:Record<string,string>){
 const etag=response.headers.get('etag');
 const size=Number(response.headers.get('content-length'));
 if(!response.headers.has('content-length')||!etag||!Number.isSafeInteger(size)||size<0)throw new Error('storage_metadata_unavailable');
 return {key,etag:etag.replace(/^"|"$/g,''),httpEtag:etag,size,customMetadata,httpMetadata:{contentType:response.headers.get('content-type')||'application/octet-stream'},writeHttpMetadata(headers:Headers){headers.set('content-type',response.headers.get('content-type')||'application/octet-stream');}};
}
async function storageRequest(key:string,method:string,headers:Record<string,string>={},body?:BodyInit){
 const target=objectUrl(key);
 return fetch(target.url,{method,headers:{...target.headers,...headers},...(body!==undefined?{body,duplex:'half'}:{}),cache:'no-store',signal:AbortSignal.timeout(120000)} as RequestInit);
}
export const bucket={
 async head(key:string){
  const response=await storageRequest(key,'HEAD');
  if(response.status===404)return null;
  if(!response.ok)throw new Error('storage_head_failed:'+response.status);
  return info(response,key,await metadata(key));
 },
 async get(key:string,options?:GetOptions){
  const headers:Record<string,string>={};
  if(options?.range){const {offset,length}=options.range;if(!Number.isSafeInteger(offset)||offset<0||!Number.isSafeInteger(length)||length<1)throw new Error('invalid_range');headers.Range='bytes='+offset+'-'+(offset+length-1);}
  if(options?.onlyIf)headers['If-Match']='"'+options.onlyIf.etagMatches+'"';
  const response=await storageRequest(key,'GET',headers);
  if(response.status===404||response.status===412)return null;
  if(!response.ok||!response.body)throw new Error('storage_get_failed:'+response.status);
  // Fail closed if the provider ignored conditional/range headers.
  if(options?.onlyIf&&response.headers.get('etag')?.replace(/^"|"$/g,'')!==options.onlyIf.etagMatches){await response.body.cancel();return null;}
  if(options?.range&&response.status!==206){await response.body.cancel();throw new Error('storage_range_not_supported');}
  const properties=info(response,key,{});
  return {...properties,body:response.body,arrayBuffer:()=>response.arrayBuffer(),text:()=>response.text()};
 },
 async put(key:string,body:BodyInit|Uint8Array|ReadableStream,options?:PutOptions){
  const headers:Record<string,string>={'content-type':options?.httpMetadata?.contentType||'application/octet-stream','x-upsert':'true'};
  if(options?.size!==undefined){if(!Number.isSafeInteger(options.size)||options.size<0)throw new Error('invalid_upload_size');headers['content-length']=String(options.size);}
  const response=await storageRequest(key,'POST',headers,body as BodyInit);
  if(!response.ok)throw new Error('storage_put_failed:'+response.status);
  await database.prepare('INSERT INTO storage_metadata(key,metadata,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET metadata=excluded.metadata,updated_at=excluded.updated_at').bind(key,JSON.stringify(options?.customMetadata||{}),new Date().toISOString()).run();
 },
 async delete(key:string){
  const response=await storageRequest(key,'DELETE');
  if(!response.ok&&response.status!==404)throw new Error('storage_delete_failed:'+response.status);
  await database.prepare('DELETE FROM storage_metadata WHERE key=?').bind(key).run();
 }
};
// Existing studio/import scripts continue using the same storage entry points.
export async function getObject(key:string){const obj=await bucket.get(key);return obj?{...obj,contentType:obj.httpMetadata.contentType}:null;}
export async function putObject(key:string,body:Blob,contentType:string){return bucket.put(key,body,{httpMetadata:{contentType}});}
export async function deleteObject(key:string){return bucket.delete(key);}
export type StoredObject=NonNullable<Awaited<ReturnType<typeof getObject>>>;
