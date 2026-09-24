'use client';
import {useRef,useState,useEffect} from 'react';
import type {ReaderPage} from '../lib/reader-content';
import ReaderFeedback from './reader-feedback';

type Props={bookId:string;title:string;page:ReaderPage|null;progress:number;position:number;font:number;theme:string;loading:boolean;preference:(theme:string,font:number)=>void;goChapter:(index:number)=>Promise<void>};
export default function ReaderMobileTools(p:Props){
 const dialog=useRef<HTMLDialogElement>(null);
 const [tab,setTab]=useState<'contents'|'settings'|'feedback'>('contents');
 const [open,setOpen]=useState(false);
 useEffect(()=>{const media=window.matchMedia('(max-width:600px)');const close=()=>{if(!media.matches)dialog.current?.close();};media.addEventListener('change',close);return()=>media.removeEventListener('change',close);},[]);
 useEffect(()=>{if(!open)return;const previous=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=previous;};},[open]);
 const show=(next:typeof tab)=>{setTab(next);setOpen(true);dialog.current?.showModal();};
 return <><div className="mobile-reader-dock" aria-label="Ferramentas de leitura"><button onClick={()=>show('contents')} aria-haspopup="dialog"><span aria-hidden="true">☷</span> Conteúdo · {p.progress}%</button><button onClick={()=>show('settings')} aria-haspopup="dialog" aria-label="Temas e tamanho do texto">Aa</button><button onClick={()=>show('feedback')} aria-haspopup="dialog" aria-label="Avaliar ou relatar problema">•••</button></div>
 <dialog ref={dialog} className="mobile-reader-sheet" aria-labelledby="mobile-reader-sheet-title" onClose={()=>setOpen(false)} onClick={e=>{if(e.target===dialog.current)dialog.current.close();}}><div className="mobile-sheet-body"><div className="mobile-sheet-heading"><h2 id="mobile-reader-sheet-title">{tab==='settings'?'Temas e ajustes':tab==='feedback'?'Sua opinião':'Conteúdo'}</h2><button aria-label="Fechar painel" onClick={()=>dialog.current?.close()}>×</button></div><p className="mobile-sheet-book">{p.title}</p>
 {tab==='contents'&&<><p>{p.page?.chapter.navigationLabel} · {p.progress}% lido</p><progress value={p.progress} max={100} aria-label="Progresso no livro"/>{p.page&&<><label className="mobile-section-select">Ir para uma seção<select aria-label="Seção do livro" disabled={p.loading} value={p.page.chapter.index} onChange={e=>{void p.goChapter(Number(e.target.value));dialog.current?.close();}}>{Array.from({length:p.page.chapterCount},(_,i)=><option key={i} value={i}>{i===p.page?.chapter.index?p.page.chapter.navigationLabel:`Seção ${i+1}`}</option>)}</select></label><p className="mobile-sheet-note">As seções seguem a divisão do EPUB e podem incluir páginas de abertura.</p></>}</>}
 {tab==='settings'&&<><div className="mobile-font-controls"><button disabled={p.font<=16} aria-label="Diminuir fonte" onClick={()=>p.preference(p.theme,Math.max(16,p.font-2))}>A−</button><span>{p.font}px</span><button disabled={p.font>=32} aria-label="Aumentar fonte" onClick={()=>p.preference(p.theme,Math.min(32,p.font+2))}>A+</button></div><div className="mobile-theme-options">{[{id:'light',label:'Claro'},{id:'sepia',label:'Papel'},{id:'dark',label:'Noturno'}].map(t=><button key={t.id} className={`theme-swatch ${t.id}`} aria-pressed={p.theme===t.id} onClick={()=>p.preference(t.id,p.font)}><span>Aa</span>{t.label}</button>)}</div></>}
 {open&&tab==='feedback'&&<ReaderFeedback bookId={p.bookId} chapterLabel={p.page?.chapter.navigationLabel} position={p.position}/>}
 </div></dialog></>;
}
