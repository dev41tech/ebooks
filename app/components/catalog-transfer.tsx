'use client';
import {useRef,useState} from 'react';
import {apiFetch} from '../lib/client-api';
import {extractBackupBook,inspectCatalogBackup,MAX_BACKUP_BYTES,type BackupBook} from '../lib/catalog-transfer';

const messages:Record<string,string>={
 backup_too_large:'O limite deste importador é um ZIP de 100 MB.',
 invalid_backup:'Este arquivo não é um backup válido do Sambu.',
 invalid_book:'Há dados de livro inválidos no backup.',
 empty_or_large_catalog:'O backup precisa conter entre 1 e 200 livros publicados.',
 unsupported_catalog:'Este importador recebe EPUBs com capas embutidas. O backup contém outro formato, áudio ou capa separada.',
 duplicate_book:'Há identificadores ou endereços de livros repetidos no backup.',
 missing_book_file:'Um dos EPUBs do backup está ausente ou incompleto.',
 invalid_book_file:'Não foi possível validar um dos arquivos enviados.',
 invalid_epub:'Um dos EPUBs não contém leitura válida.',
 checksum_mismatch:'O arquivo recebido ficou diferente do original. Tente novamente.',
 book_conflict:'Um livro conflita com um registro que já existe neste ambiente. Nenhum registro existente foi substituído.',
 source_changed:'O arquivo mudou durante a transferência. Tente novamente.',
 master_required:'Desbloqueie a administração com sua senha master e selecione o ZIP novamente.',
 owner_master_required:'Entre como proprietário e desbloqueie a administração com a senha master.',
 sign_in_required:'Entre novamente na sua conta para continuar.',
};
async function jsonResponse(response:Response){
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(messages[data.error] || `Não foi possível concluir a transferência (HTTP ${response.status}). Tente novamente.`);
 return data;
}
async function post(url:string,body:unknown){
 return jsonResponse(await apiFetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(120000)}));
}
async function uploadBook(bytes:Uint8Array,name:string,progress:(percent:number)=>void){
 const file=new Blob([bytes as BlobPart],{type:'application/epub+zip'});
 const init=await post('/api/admin/uploads',{action:'init',fileName:name,size:file.size});
 const total=Math.ceil(file.size/init.chunkSize);
 for(let part=0;part<total;part++){
  const chunk=file.slice(part*init.chunkSize,(part+1)*init.chunkSize);
  for(let attempt=0;;attempt++){
   try{
    const response=await apiFetch(`/api/admin/uploads?uploadId=${encodeURIComponent(init.uploadId)}&part=${part}`,{method:'PUT',body:chunk,signal:AbortSignal.timeout(60000)});
    if(response.status>=500 && attempt<2)continue;
    await jsonResponse(response); break;
   }catch(error){if(attempt>=2 || !(error instanceof TypeError || (error as Error).name==='TimeoutError'))throw error;}
  }
  progress(Math.round((part+1)/total*100));
 }
 return post('/api/admin/uploads',{action:'complete',uploadId:init.uploadId,totalParts:total,size:file.size});
}

export default function CatalogTransfer(){
 const bytes=useRef<Uint8Array|null>(null);
 const [items,setItems]=useState<BackupBook[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [stage,setStage]=useState(''),[done,setDone]=useState(0),[complete,setComplete]=useState(false);
 async function select(file:File|undefined){
  bytes.current=null;setItems([]);setError('');setStage('');setDone(0);setComplete(false);
  if(!file)return;
  setBusy(true);
  try{
   if(file.size>MAX_BACKUP_BYTES)throw new Error('backup_too_large');
   const buffer=new Uint8Array(await file.arrayBuffer());
   const books=inspectCatalogBackup(buffer);
   bytes.current=buffer;setItems(books);setStage(`${books.length} livros publicados encontrados. Pronto para importar.`);
  }catch(error){setError(messages[(error as Error).message] || 'Não foi possível ler o ZIP. Selecione o backup baixado do Sambu.');}
  finally{setBusy(false);}
 }
 async function transfer(){
  if(!bytes.current || busy)return;
  const archive=bytes.current;
  setBusy(true);setError('');setComplete(false);setDone(0);
  try{
   const target=await jsonResponse(await apiFetch('/api/admin/catalog-transfer',{cache:'no-store'}));
   const existing=target.books as {id:string;slug:string|null;status:string}[];
   for(const item of items){
    const conflicts=existing.filter(b=>b.id===item.book.id || (item.book.slug && b.slug===item.book.slug));
    if(conflicts.some(b=>b.id!==item.book.id || b.status!=='published'))throw new Error(messages.book_conflict);
   }
   let added=0,skipped=0;
   for(let i=0;i<items.length;i++){
    const item=items[i];
    if(existing.some(b=>b.id===item.book.id)){skipped++;setDone(i+1);continue;}
    const file=extractBackupBook(archive,item);
    const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',file as Uint8Array<ArrayBuffer>))).map(n=>n.toString(16).padStart(2,'0')).join('');
    setStage(`${i+1} de ${items.length}: ${item.book.title}`);
    const upload=await uploadBook(file,`${item.book.id}.epub`,percent=>setStage(`${i+1} de ${items.length}: ${item.book.title} · ${percent}% enviado`));
    setStage(`Validando leitura: ${item.book.title}`);
    const result=await post('/api/admin/catalog-transfer',{book:item.book,storageKey:upload.storageKey,sha256:digest});
    if(result.alreadyExists)skipped++;else added++;
    setDone(i+1);
   }
   setComplete(true);setStage(`Acervo importado: ${added} livros adicionados e ${skipped} já presentes.`);
  }catch(error){setError(messages[(error as Error).message] || (error as Error).message || 'A transferência foi interrompida. Tente novamente.');setStage('Você pode tentar novamente. Livros concluídos não serão duplicados.');}
  finally{setBusy(false);}
 }
 return <section className="beta-report"><h3>Importar acervo do backup</h3>
  <p>Selecione o ZIP baixado do outro Sambu para trazer seus livros publicados e as capas embutidas nos EPUBs. As contas e o histórico de leitura deste ambiente serão preservados.</p>
  <label>Backup do Sambu (.zip, até 100 MB)<input type="file" accept=".zip,application/zip" disabled={busy} onChange={e=>void select(e.target.files?.[0])}/></label>
  {!!items.length&&<><p>{items.length} livros prontos para transferência.</p><details><summary>Conferir livros</summary><ul>{items.map(item=><li key={item.book.id}>{item.book.title}</li>)}</ul></details>
   <p>Mantenha esta página aberta durante a importação.</p><progress aria-label="Livros transferidos" value={done} max={items.length}/><p>{done} de {items.length} livros concluídos</p>
   {!complete&&<button type="button" className="primary" disabled={busy} onClick={()=>void transfer()}>{busy?'Importando acervo…':error?'Tentar novamente':'Importar livros e capas'}</button>}</>}
  {stage&&<p role="status" aria-live="polite">{stage}</p>}{error&&<p role="alert">{error}</p>}
  {complete&&<a className="primary" href="/?view=home">Ver livros no aplicativo</a>}
 </section>;
}
