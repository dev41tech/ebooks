import {requireAccess} from '../../../lib/access';
import {bucket} from '../../../../db/storage';
const CHUNK_SIZE=250_000,MAX_FILE_SIZE=250_000_000,MAX_PARTS=1000;
const validId=(id:string)=>/^[a-f0-9-]{36}$/i.test(id);
const prefix=(email:string,id:string)=>'imports/direct/'+encodeURIComponent(email.toLowerCase())+'/'+id;
const safeName=(name:unknown)=>String(name||'ebook').replace(/[^a-zA-Z0-9._-]+/g,'-').slice(-140);
async function boundedBody(request:Request){
 if(!request.body)return null;
 const reader=request.body.getReader(),parts:Uint8Array[]=[];let size=0;
 try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>CHUNK_SIZE){await reader.cancel();return null;}parts.push(value);}}finally{reader.releaseLock();}
 if(!size)return null;
 return new Blob(parts as BlobPart[]);
}
export async function POST(request:Request){
 const access=await requireAccess('admin');if(access.error)return access.error;const email=access.user!.email;
 const b=await request.json().catch(()=>({}));const id=String(b.uploadId||'');
 if(b.action==='init'){
  const name=safeName(b.fileName),size=Number(b.size);
  if(!/\.(epub|pdf)$/i.test(name))return Response.json({error:'invalid_file_type'},{status:400});
  if(!Number.isSafeInteger(size)||size<1||size>MAX_FILE_SIZE||(/\.epub$/i.test(name)&&size>32_000_000))return Response.json({error:'file_too_large'},{status:400});
  const uploadId=crypto.randomUUID();
  await bucket.put(prefix(email,uploadId)+'/manifest.json',JSON.stringify({fileName:name,size,contentType:/\.pdf$/i.test(name)?'application/pdf':'application/epub+zip'}),{httpMetadata:{contentType:'application/json'},customMetadata:{owner:email}});
  return Response.json({uploadId,chunkSize:CHUNK_SIZE,maxFileSize:MAX_FILE_SIZE});
 }
 if(!validId(id))return Response.json({error:'invalid_upload'},{status:400});
 const root=prefix(email,id),manifest=await bucket.get(root+'/manifest.json');
 if(!manifest)return Response.json({error:'upload_not_found'},{status:404});
 const meta=JSON.parse(await manifest.text()) as {fileName:string;size:number;contentType:string};
 const total=Math.ceil(meta.size/CHUNK_SIZE);
 if(b.action==='part'){
  const part=Number(b.part);
  if(!Number.isInteger(part)||part<0||part>=total||typeof b.data!=='string'||b.data.length>340000)return Response.json({error:'invalid_part'},{status:400});
  let bytes:Uint8Array;try{bytes=Uint8Array.from(atob(b.data),c=>c.charCodeAt(0));}catch{return Response.json({error:'invalid_part_data'},{status:400});}
  if(bytes.length!==Math.min(CHUNK_SIZE,meta.size-part*CHUNK_SIZE))return Response.json({error:'invalid_chunk_size'},{status:400});
  await bucket.put(root+'/parts/'+part,bytes);return Response.json({ok:true,part});
 }
 if(b.action!=='complete'||b.totalParts!==total||total>MAX_PARTS||b.size!==meta.size)return Response.json({error:'invalid_upload'},{status:400});
 const key=root+'/'+meta.fileName;
 const existing=await bucket.head(key);
 if(!existing){
  // Sequential source reads and streaming upload keep a 250 MB PDF out of RAM.
  let next=0;
  const stream=new ReadableStream<Uint8Array>({
   async pull(controller){
    if(next===total){controller.close();return;}
    try{const i=next++;const object=await bucket.get(root+'/parts/'+i);if(!object)throw new Error('missing_part');const bytes=new Uint8Array(await object.arrayBuffer());if(bytes.length!==Math.min(CHUNK_SIZE,meta.size-i*CHUNK_SIZE))throw new Error('size_mismatch');controller.enqueue(bytes);}catch(e){controller.error(e);}
   }
  });
  await bucket.put(key,stream,{size:meta.size,httpMetadata:{contentType:meta.contentType},customMetadata:{owner:email}});
 }else if(existing.size!==meta.size||existing.customMetadata.owner!==email)return Response.json({error:'upload_conflict'},{status:409});
 for(let i=0;i<total;i++)await bucket.delete(root+'/parts/'+i).catch(()=>{});
 return Response.json({ok:true,storageKey:key,fileName:meta.fileName,contentType:meta.contentType,fileSize:meta.size});
}
export async function PUT(request:Request){
 const access=await requireAccess('admin');if(access.error)return access.error;
 const u=new URL(request.url),id=u.searchParams.get('uploadId')||'',part=Number(u.searchParams.get('part'));
 if(!validId(id)||!Number.isInteger(part)||part<0||part>=MAX_PARTS)return Response.json({error:'invalid_part'},{status:400});
 const root=prefix(access.user!.email,id),object=await bucket.get(root+'/manifest.json');
 if(!object)return Response.json({error:'upload_not_found'},{status:404});
 const meta=JSON.parse(await object.text()) as {size:number};
 const body=await boundedBody(request);
 if(!body||part>=Math.ceil(meta.size/CHUNK_SIZE)||body.size!==Math.min(CHUNK_SIZE,meta.size-part*CHUNK_SIZE))return Response.json({error:'invalid_chunk_size'},{status:400});
 await bucket.put(root+'/parts/'+part,body);return Response.json({ok:true,part,size:body.size});
}
