/**
 * Armazenamento em disco, na própria VPS. Mesma superfície do bucket do
 * Supabase (head/get/put/delete), para que `env.BUCKET` continue igual para
 * quem chama.
 *
 * Existe porque o projeto Supabase configurado deixou de existir: o host
 * `*.supabase.co` do projeto devolve NXDOMAIN, e não há o que reativar — um
 * projeto pausado ainda resolve em DNS. Com a importação travada em
 * `storage_unavailable`, guardar os arquivos aqui tira uma dependência externa
 * de cima de um app que já roda com Postgres no mesmo VPS.
 *
 * PRÉ-REQUISITO OPERACIONAL: STORAGE_DIR precisa apontar para um volume montado
 * no EasyPanel. Sem volume, o diretório vive na camada gravável do contêiner e
 * **some a cada deploy** — foi exatamente assim que o app irmão perdeu todo o
 * acervo em 2026-08-26. O disco não é mais seguro que o Supabase por natureza;
 * ele é mais seguro por estar montado.
 *
 * Um objeto vira dois arquivos: o conteúdo e um `.meta` ao lado, com
 * contentType e etag. O etag é hash do conteúdo, calculado na escrita — derivar
 * de tamanho+mtime seria mais barato, mas quebraria `onlyIf` depois de qualquer
 * restauração de backup, que é justamente quando ele importa.
 */
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {assertStorageKey,readCustomMetadata,writeCustomMetadata,deleteCustomMetadata} from './storage-meta';
import {StorageServiceError} from './storage-service';

type Metadata={contentType?:string};
type GetOptions={range?:{offset:number;length:number};onlyIf?:{etagMatches:string}};
type PutOptions={size?:number;httpMetadata?:Metadata;customMetadata?:Record<string,string>};
type Sidecar={contentType:string;etag:string};

const DEFAULT_TYPE='application/octet-stream';

export function storageRoot(){
 const dir=process.env.STORAGE_DIR?.trim();
 if(!dir)throw new StorageServiceError('storage_dir_missing',503,'missing_storage_dir');
 if(!path.isAbsolute(dir))throw new StorageServiceError('storage_dir_invalid',503,'relative_storage_dir');
 return path.resolve(dir);
}

/** Checks the configured directory without creating files or contacting Supabase. */
export async function checkDiskStorage(){
 const root=storageRoot();
 try{
  const stat=await fsp.stat(root);
  if(!stat.isDirectory())throw new StorageServiceError('storage_dir_invalid',503,'not_a_directory');
  await fsp.access(root,fs.constants.R_OK|fs.constants.W_OK|fs.constants.X_OK);
  return {ready:true};
 }catch(error){
  if(error instanceof StorageServiceError)throw error;
  const code=(error as NodeJS.ErrnoException).code;
  if(code==='ENOENT')throw new StorageServiceError('storage_dir_unavailable',503,'storage_dir_not_found');
  if(code==='EACCES'||code==='EPERM')throw new StorageServiceError('storage_dir_access_denied',503,'storage_dir_permissions');
  throw new StorageServiceError('storage_disk_unavailable',503,'disk_check_failed');
 }
}

/**
 * Caminho no disco para uma chave. A validação da chave já recusa `..`, mas a
 * checagem do resolvido fica como segunda barreira: é a única que sobrevive a
 * alguém afrouxar a primeira.
 */
function objectFile(key:string){
 const root=storageRoot();
 const file=path.resolve(root,...assertStorageKey(key).split('/'));
 if(file!==root&&!file.startsWith(root+path.sep))throw new Error('invalid_storage_key');
 return file;
}

async function readSidecar(file:string):Promise<Sidecar>{
 try{
  const parsed=JSON.parse(await fsp.readFile(file+'.meta','utf8')) as Partial<Sidecar>;
  return {contentType:parsed.contentType||DEFAULT_TYPE,etag:parsed.etag||''};
 }catch{
  // Arquivo sem sidecar é objeto escrito por fora (cópia manual, restauração).
  // Entregar com o tipo genérico é melhor do que tratar como inexistente.
  return {contentType:DEFAULT_TYPE,etag:''};
 }
}

function properties(key:string,size:number,sidecar:Sidecar,customMetadata:Record<string,string>){
 return {
  key,etag:sidecar.etag,httpEtag:'"'+sidecar.etag+'"',size,customMetadata,
  httpMetadata:{contentType:sidecar.contentType},
  writeHttpMetadata(headers:Headers){headers.set('content-type',sidecar.contentType);},
 };
}

async function statOrNull(file:string){
 try{const s=await fsp.stat(file);return s.isFile()?s:null;}catch{return null;}
}

export const diskBucket={
 async head(key:string){
  const file=objectFile(key);
  const stat=await statOrNull(file);
  if(!stat)return null;
  return properties(key,stat.size,await readSidecar(file),await readCustomMetadata(key));
 },

 async get(key:string,options?:GetOptions){
  const file=objectFile(key);
  const stat=await statOrNull(file);
  if(!stat)return null;
  const sidecar=await readSidecar(file);
  // Mesma semântica do provedor: condicional que não bate devolve null, não erro.
  if(options?.onlyIf&&sidecar.etag!==options.onlyIf.etagMatches)return null;

  let offset=0,length=stat.size;
  if(options?.range){
   ({offset,length}=options.range);
   if(!Number.isSafeInteger(offset)||offset<0||!Number.isSafeInteger(length)||length<1)throw new Error('invalid_range');
   // Recorta no fim do arquivo, como faz um 206 com range maior que o conteúdo.
   length=Math.max(0,Math.min(length,stat.size-offset));
  }

  const bytes=length>0?await readSlice(file,offset,length):new Uint8Array(0);
  return {
   ...properties(key,bytes.byteLength,sidecar,await readCustomMetadata(key)),
   get body(){return Readable.toWeb(Readable.from(Buffer.from(bytes))) as ReadableStream;},
   arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength) as ArrayBuffer,
   text:async()=>Buffer.from(bytes).toString('utf8'),
  };
 },

 async put(key:string,body:BodyInit|Uint8Array|ReadableStream,options?:PutOptions){
  if(options?.size!==undefined&&(!Number.isSafeInteger(options.size)||options.size<0))throw new Error('invalid_upload_size');
  const file=objectFile(key);
  await fsp.mkdir(path.dirname(file),{recursive:true});

  // Escreve em temporário e renomeia: um deploy no meio de um upload de 200 MB
  // deixaria o arquivo final pela metade, e a leitura seguinte o trataria como
  // válido — rename é atômico no mesmo sistema de arquivos.
  const temp=file+'.'+Date.now().toString(36)+'.part';
  const hash=createHash('sha256');
  try{
   const source=toNodeStream(body,hash);
   await pipeline(source,fs.createWriteStream(temp));
   const written=(await fsp.stat(temp)).size;
   if(options?.size!==undefined&&written!==options.size){throw new Error('size_mismatch');}
   const sidecar:Sidecar={contentType:options?.httpMetadata?.contentType||DEFAULT_TYPE,etag:hash.digest('hex')};
   await fsp.writeFile(temp+'.meta',JSON.stringify(sidecar));
   await fsp.rename(temp+'.meta',file+'.meta');
   await fsp.rename(temp,file);
  }catch(error){
   await fsp.rm(temp,{force:true}).catch(()=>{});
   await fsp.rm(temp+'.meta',{force:true}).catch(()=>{});
   throw error;
  }
  await writeCustomMetadata(key,options?.customMetadata||{});
 },

 async delete(key:string){
  const file=objectFile(key);
  // Idempotente, como o DELETE do provedor: apagar o que não existe não é erro.
  await fsp.rm(file,{force:true});
  await fsp.rm(file+'.meta',{force:true});
  await deleteCustomMetadata(key);
 },
};

async function readSlice(file:string,offset:number,length:number){
 const handle=await fsp.open(file,'r');
 try{
  const buffer=Buffer.allocUnsafe(length);
  const {bytesRead}=await handle.read(buffer,0,length,offset);
  return new Uint8Array(buffer.subarray(0,bytesRead));
 }finally{await handle.close();}
}

/** Aceita as mesmas formas de corpo que o `fetch` do driver Supabase aceitava. */
function toNodeStream(body:BodyInit|Uint8Array|ReadableStream,hash:ReturnType<typeof createHash>){
 const observe=(stream:Readable)=>{stream.on('data',chunk=>hash.update(chunk));return stream;};
 if(body instanceof Uint8Array)return observe(Readable.from(Buffer.from(body)));
 if(typeof body==='string')return observe(Readable.from(Buffer.from(body,'utf8')));
 if(body instanceof Blob)return observe(Readable.fromWeb(body.stream() as never));
 if(body instanceof ReadableStream)return observe(Readable.fromWeb(body as never));
 if(body instanceof ArrayBuffer)return observe(Readable.from(Buffer.from(body)));
 throw new Error('unsupported_upload_body');
}
