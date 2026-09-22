import { apiFetch } from './client-api';
import type { ReaderPage } from './reader-content';

export async function loadReaderPage(bookId:string,target:{position:number}|{chapter:number},signal?:AbortSignal):Promise<ReaderPage>{
  const query=new URLSearchParams({id:bookId,...Object.fromEntries(Object.entries(target).map(([k,v])=>[k,String(v)]))});
  const controller=new AbortController();
  const abort=()=>controller.abort();
  signal?.addEventListener('abort',abort,{once:true});
  if(signal?.aborted)controller.abort();
  const timeout=setTimeout(abort,30000);
  try{
    const response=await apiFetch(`/api/catalog/content?${query}`,{signal:controller.signal,cache:'no-store'});
    const data=await response.json() as {reader?:ReaderPage};
    if(!response.ok||!data.reader?.chapter?.blocks?.length)throw new Error('Não foi possível carregar este capítulo. Tente novamente.');
    return data.reader;
  }catch(error){
    if(controller.signal.aborted)throw new Error('O capítulo demorou para abrir. Verifique a conexão e tente novamente.');
    throw error;
  }finally{clearTimeout(timeout);signal?.removeEventListener('abort',abort);}
}
