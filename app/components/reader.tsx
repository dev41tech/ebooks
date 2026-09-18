"use client";
import {useCallback,useEffect,useRef,useState} from 'react';
import {apiFetch,serviceUrl} from '../lib/client-api';
import {chapterContains,type ReaderPage} from '../lib/reader-content';
import {loadReaderPage} from '../lib/reader-client';

type Location={position:number;progress:number;revision?:number};
type Props={book:{id:string;title:string;format?:string};initialPage:ReaderPage|null;initial:Location;theme:string;font:number;preference:(t:string,f:number)=>void;onSave:(id:string,l:Location)=>Promise<Location>;onBack:()=>void};

export default function Reader({book,initialPage,initial,theme,font,preference,onSave,onBack}:Props){
  const pdf=book.format?.toUpperCase().includes('PDF');
  const [page,setPage]=useState(initialPage),pageRef=useRef(initialPage);
  const [current,setCurrent]=useState(initial),currentRef=useRef(initial),revision=useRef(initial.revision??0);
  const initialRef=useRef(initial);
  const [pdfPage,setPdfPage]=useState(Math.max(1,initial.position));
  const [state,setState]=useState(''),[loading,setLoading]=useState(false),[error,setError]=useState('');
  const [scrollTarget,setScrollTarget]=useState({position:initial.position,stamp:0});
  const retry=useRef<(()=>void)|null>(null);
  const ready=useRef(false),dirty=useRef(false),intent=useRef(false),mounted=useRef(true),switching=useRef(false),syncing=useRef(false);
  const generation=useRef(0),requestId=useRef(0),request=useRef<AbortController|null>(null);
  const pendingRefresh=useRef(false),refreshRef=useRef<(()=>Promise<void>)|null>(null);
  const timer=useRef<ReturnType<typeof setTimeout>|null>(null),queue=useRef<Promise<boolean>>(Promise.resolve(true));
  const article=useRef<HTMLElement|null>(null),toolbar=useRef<HTMLDivElement|null>(null);
  const clearTimer=()=>{if(timer.current)clearTimeout(timer.current);};

  const show=useCallback((next:ReaderPage,location:Location)=>{
    pageRef.current=next;setPage(next);
    setScrollTarget(t=>({position:location.position,stamp:t.stamp+1}));
  },[]);

  // Saved positions remain absolute paragraph indices across all chapters.
  const apply=useCallback(async(location:Location)=>{
    ready.current=false;intent.current=false;dirty.current=false;generation.current++;clearTimer();
    revision.current=location.revision??0;currentRef.current=location;setCurrent(location);
    request.current?.abort();const ticket=++requestId.current;
    if(pdf){setPdfPage(Math.max(1,location.position));return;}
    setError('');retry.current=null;
    if(pageRef.current&&chapterContains(pageRef.current,location.position)){
      switching.current=false;setLoading(false);show(pageRef.current,location);return;
    }
    const controller=new AbortController();request.current=controller;
    switching.current=true;setLoading(true);
    try{
      const next=await loadReaderPage(book.id,{position:location.position},controller.signal);
      if(ticket!==requestId.current||!mounted.current)return;
      show(next,location);
    }catch(e){if(ticket===requestId.current&&mounted.current){setError((e as Error).message);retry.current=()=>{void apply(location);};}}
    finally{if(ticket===requestId.current&&mounted.current){switching.current=false;setLoading(false);}}
  },[book.id,pdf,show]);

  const persist=useCallback((location:Location):Promise<boolean>=>{
    if(!dirty.current)return queue.current.then(()=>!dirty.current);
    const stamp=generation.current;
    const job=queue.current.catch(()=>false).then(async()=>{
      if(stamp!==generation.current)return false;
      if(mounted.current)setState('Salvando posição…');
      try{
        const saved=await onSave(book.id,{...location,revision:revision.current});
        if(stamp!==generation.current)return false;
        revision.current=saved.revision??0;
        if(currentRef.current.position===location.position&&currentRef.current.progress===location.progress){dirty.current=false;currentRef.current=saved;if(mounted.current)setCurrent(saved);}
        if(mounted.current)setState('Posição sincronizada com sua conta');return true;
      }catch(e){
        const remote=(e as Error&{location?:Location}).location;
        if(mounted.current){
          if(remote){void apply(remote);setState('Retomamos a posição salva no outro dispositivo.');}
          else setState('Sem sincronização. Tente salvar novamente antes de trocar de dispositivo.');
        }
        return false;
      }
    });queue.current=job;return job;
  },[apply,book.id,onSave]);

  const goChapter=useCallback(async(index:number)=>{
    if(switching.current||!pageRef.current)return;
    switching.current=true;ready.current=false;setLoading(true);setError('');retry.current=null;clearTimer();
    const ticket=++requestId.current;
    const controller=new AbortController();request.current?.abort();request.current=controller;
    try{
      // Never abandon unsaved reading progress just to change chapter.
      if(!await persist(currentRef.current))return;
      const next=await loadReaderPage(book.id,{chapter:index},controller.signal);
      if(ticket!==requestId.current||!mounted.current)return;
      const location={position:next.chapter.start,progress:currentRef.current.progress===100?100:Math.min(99,Math.max(1,Math.round(next.chapter.start/next.totalParagraphs*100))),revision:revision.current};
      intent.current=false;currentRef.current=location;dirty.current=true;setCurrent(location);show(next,location);
      await persist(location);
    }catch(e){
      if(ticket===requestId.current&&mounted.current){setError((e as Error).message);retry.current=()=>{void goChapter(index);};}
    }finally{
      if(ticket===requestId.current&&mounted.current){switching.current=false;setLoading(false);setScrollTarget(t=>({position:currentRef.current.position,stamp:t.stamp+1}));}
    }
  },[book.id,persist,show]);

  useEffect(()=>{
    if(pdf||loading||error||!page)return;
    let second=0;
    const frame=requestAnimationFrame(()=>{
      const bounded=Math.min(Math.max(page.chapter.start,scrollTarget.position),page.chapter.start+page.chapter.blocks.length-1);
      const node=document.getElementById(`paragraph-${bounded}`);
      if(bounded===page.chapter.start)window.scrollTo(0,0);
      else if(node){const top=node.getBoundingClientRect().top+window.scrollY-(toolbar.current?.getBoundingClientRect().height||125)-20;window.scrollTo(0,Math.max(0,top));}
      second=requestAnimationFrame(()=>{ready.current=true;});
    });
    return()=>{cancelAnimationFrame(frame);cancelAnimationFrame(second);};
  },[page,scrollTarget,pdf,loading,error]);

  useEffect(()=>{
    mounted.current=true;void apply(initialRef.current);
    let frame=0;
    const input=()=>{intent.current=true;};
    const measure=()=>{
      frame=0;if(pdf||!ready.current||!intent.current||switching.current||document.visibilityState!=='visible'||!pageRef.current)return;
      const elements=article.current?.querySelectorAll<HTMLElement>('[data-reader-position]');if(!elements?.length)return;
      const threshold=(toolbar.current?.getBoundingClientRect().height||125)+20;
      // Only the current chapter exists in the DOM. Binary search avoids a full scan.
      let low=0,high=elements.length-1,found=0;
      while(low<=high){const mid=(low+high)>>1;if(elements[mid].getBoundingClientRect().top<=threshold){found=mid;low=mid+1;}else high=mid-1;}
      const position=Number(elements[found].dataset.readerPosition);
      if(position===currentRef.current.position)return;
      const location={position,progress:currentRef.current.progress===100?100:Math.min(99,Math.max(1,Math.round(position/pageRef.current.totalParagraphs*100))),revision:revision.current};
      currentRef.current=location;setCurrent(location);dirty.current=true;setState('Salvando posição…');clearTimer();timer.current=setTimeout(()=>persist(location),600);
    };
    const scroll=()=>{if(!frame)frame=requestAnimationFrame(measure);};
    const refresh=async()=>{
      if(document.visibilityState!=='visible')return;
      if(syncing.current||switching.current){pendingRefresh.current=true;return;}
      pendingRefresh.current=false;syncing.current=true;
      try{
        await persist(currentRef.current);if(dirty.current||switching.current||!mounted.current)return;
        const requestedRevision=revision.current;
        const response=await apiFetch('/api/progress',{cache:'no-store'});if(!response.ok)throw new Error('sync_failed');
        const data=await response.json() as {locations?:Record<string,Location>};if(switching.current||dirty.current||revision.current!==requestedRevision||!mounted.current)return;
        const latest=data.locations?.[book.id]||{position:0,progress:0,revision:0};
        if((latest.revision??0)!==revision.current){await apply(latest);if(mounted.current)setState('Leitura sincronizada com o outro dispositivo.');}
      }catch{if(mounted.current)setState('Não foi possível sincronizar. Verifique sua conexão.');}
      finally{syncing.current=false;if(pendingRefresh.current&&!switching.current&&mounted.current)void refresh();}
    };
    refreshRef.current=refresh;
    const leave=()=>{clearTimer();void persist(currentRef.current);};
    const hide=()=>{if(document.visibilityState==='hidden')leave();else void refresh();};
    window.addEventListener('wheel',input,{passive:true});window.addEventListener('touchmove',input,{passive:true});window.addEventListener('keydown',input);window.addEventListener('pointerdown',input,{passive:true});window.addEventListener('scroll',scroll,{passive:true});window.addEventListener('focus',refresh);window.addEventListener('pagehide',leave);document.addEventListener('visibilitychange',hide);
    return()=>{mounted.current=false;refreshRef.current=null;requestId.current++;request.current?.abort();cancelAnimationFrame(frame);window.removeEventListener('wheel',input);window.removeEventListener('touchmove',input);window.removeEventListener('keydown',input);window.removeEventListener('pointerdown',input);window.removeEventListener('scroll',scroll);window.removeEventListener('focus',refresh);window.removeEventListener('pagehide',leave);document.removeEventListener('visibilitychange',hide);leave();};
  },[book.id,pdf,apply,persist]);

  useEffect(()=>{if(!loading&&pendingRefresh.current)void refreshRef.current?.();},[loading]);

  const navigation=page&&<nav className="reader-chapter-nav" aria-label="Navegação de capítulos"><button className="outline" disabled={loading||page.chapter.index===0} onClick={()=>goChapter(page.chapter.index-1)}>← Capítulo anterior</button><span>Parte {page.chapter.index+1} de {page.chapterCount}</span><button className="outline" disabled={loading||page.chapter.index===page.chapterCount-1} onClick={()=>goChapter(page.chapter.index+1)}>Próximo capítulo →</button></nav>;
  return <main className={`reader ${theme}`}><div className="reader-top" ref={toolbar}><button disabled={loading} onClick={async()=>{clearTimer();if(await persist(currentRef.current))onBack();}}>← Voltar</button><b>{book.title}</b><div className="reader-controls">{!pdf&&<><button type="button" title="Diminuir fonte" disabled={font<=16} aria-label="Diminuir fonte" onClick={()=>preference(theme,Math.max(16,font-2))}>A−</button><button type="button" title="Aumentar fonte" disabled={font>=32} aria-label="Aumentar fonte" onClick={()=>preference(theme,Math.min(32,font+2))}>A+</button><select aria-label="Tema do leitor" value={theme} onChange={e=>preference(e.target.value,font)}><option value="light">Claro</option><option value="sepia">Sépia</option><option value="dark">Escuro</option></select></>}</div></div>
    {pdf?<section className="pdf-reader"><p>Para retomar um PDF, informe e salve a página exibida no visualizador.</p><label>Página <input type="number" min={1} max={100000} value={pdfPage} onChange={e=>{const position=Math.max(1,Math.min(100000,Number(e.target.value)||1));setPdfPage(position);currentRef.current={position,progress:currentRef.current.progress||1,revision:revision.current};dirty.current=true;}}/></label><button className="outline" onClick={()=>persist(currentRef.current)}>Salvar posição</button><iframe title={`Leitura de ${book.title}`} src={serviceUrl(`/api/catalog/file?id=${encodeURIComponent(book.id)}#page=${pdfPage}`)}/></section>:<>
      <div className="reader-chapter-tools">{navigation}{loading&&<p role="status">Carregando capítulo…</p>}{error&&<div role="alert"><p>{error}</p><button className="outline" onClick={()=>retry.current?.()}>Tentar novamente</button></div>}</div>
      {!loading&&!error&&page&&<article ref={article} style={{fontSize:font}}>{page.chapter.blocks.map(block=><div className="reader-block" key={block.position} id={`paragraph-${block.position}`} data-reader-position={block.position}>{(block.chapterLabel||block.heading)&&<div className="reader-chapter-heading">{block.chapterLabel&&<p className="reader-chapter-number">{block.chapterLabel}</p>}{block.heading&&<h2 className="reader-chapter-title">{block.heading}</h2>}</div>}{!block.hidden&&<p>{block.text}</p>}</div>)}{navigation}<div className="reader-end"><button className="outline" onClick={()=>persist(currentRef.current)}>Salvar posição</button>{page.chapter.index===page.chapterCount-1&&<button className="primary" onClick={async()=>{clearTimer();const end={position:page.totalParagraphs-1,progress:100,revision:revision.current};currentRef.current=end;dirty.current=true;setCurrent(end);await persist(end);}}>Concluir leitura</button>}</div></article>}
    </>}
    <div className="beta-reader-status" role="status">{state||`${current.progress}% lido`}</div></main>;
}
