'use client';
import {useEffect,useRef,useState} from 'react';
import {apiFetch} from '../lib/client-api';
import {BETA_VERSION,ISSUE_CATEGORIES} from '../lib/beta';
function reportIdentifier(){
 const bytes=crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
 const h=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}
export default function ReaderFeedback({bookId,chapterLabel='',position=0}:{bookId:string;chapterLabel?:string;position?:number}){
 const [mode,setMode]=useState<'issue'|'review'|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 const [category,setCategory]=useState('technical'),[description,setDescription]=useState(''),[rating,setRating]=useState(''),[textRating,setTextRating]=useState(''),[comment,setComment]=useState('');
 const [reviewLoaded,setReviewLoaded]=useState(false),[loadAttempt,setLoadAttempt]=useState(0);
 const reportId=useRef(''),formRef=useRef<HTMLFormElement>(null),trigger=useRef<HTMLButtonElement|null>(null);
 const context=useRef({chapterLabel,position});
 useEffect(()=>{if(mode){formRef.current?.focus();}else trigger.current?.focus();},[mode]);
 useEffect(()=>{if(mode!=='review'||reviewLoaded)return;let active=true;
  setBusy(true);setError('');apiFetch(`/api/reviews?bookId=${encodeURIComponent(bookId)}`,{cache:'no-store'}).then(async r=>{if(!r.ok)throw new Error();return r.json() as Promise<{review?:{rating:number;textRating:number;comment:string}}>;}).then(d=>{if(active){setRating(d.review?.rating?String(d.review.rating):'');setTextRating(d.review?.textRating?String(d.review.textRating):'');setComment(d.review?.comment||'');setReviewLoaded(true);}}).catch(()=>{if(active)setError('Não foi possível carregar sua avaliação. Tente novamente.');}).finally(()=>{if(active)setBusy(false);});return()=>{active=false;};
 },[mode,reviewLoaded,bookId,loadAttempt]);
 const close=()=>{if(!busy)setMode(null);};
 return <section className="reader-feedback" aria-label="Ajude a melhorar o beta"><div className="feedback-actions"><button className="outline" disabled={busy} onClick={e=>{trigger.current=e.currentTarget;context.current={chapterLabel,position};reportId.current=reportId.current||reportIdentifier();setMode('issue');setMessage('');setError('');}}>Relatar problema</button><button className="outline" disabled={busy} onClick={e=>{trigger.current=e.currentTarget;setMode('review');setMessage('');setError('');}}>Avaliar livro</button></div>
 {message&&<p role="status">{message}</p>}
 {mode&&<form className="beta-form feedback-form" ref={formRef} tabIndex={-1} aria-label={mode==='issue'?'Relatar problema':'Avaliar livro'} onKeyDown={e=>{if(e.key==='Escape')close();}} onSubmit={async e=>{
  e.preventDefault();if(busy||mode==='review'&&!reviewLoaded)return;setBusy(true);setError('');
  try{
   const body=mode==='issue'?{id:reportId.current,bookId,category,message:description,chapterLabel:context.current.chapterLabel.slice(0,200),position:context.current.position,device:window.matchMedia('(max-width: 768px)').matches?'mobile':'desktop',appVersion:BETA_VERSION}:{bookId,rating:Number(rating),textRating:Number(textRating),comment};
   const response=await apiFetch(mode==='issue'?'/api/feedback':'/api/reviews',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
   if(!response.ok)throw new Error(response.status===429?'Você atingiu o limite de 10 relatos hoje. Tente novamente amanhã.':'Não foi possível enviar. Seu texto foi mantido; tente novamente.');
   setMessage(mode==='issue'?'Relato enviado. Obrigado por ajudar a melhorar o Sambu.':'Avaliação salva. Você pode atualizá-la quando quiser.');if(mode==='issue'){setDescription('');reportId.current='';}setMode(null);
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }}>
 <h2>{mode==='issue'?'O que aconteceu?':'Como foi sua leitura?'}</h2>
 {mode==='issue'?<><label>Tipo de problema<select value={category} onChange={e=>setCategory(e.target.value)}>{Object.entries(ISSUE_CATEGORIES).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><label>Conte o que você encontrou<textarea required minLength={10} maxLength={2000} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Ex.: ao avançar, o texto do capítulo anterior apareceu novamente."/></label><p className="feedback-note">Enviaremos à equipe sua conta, este livro, {context.current.chapterLabel||'a posição de leitura'}, a versão do aplicativo e se você usa celular ou computador. Não inclua senhas ou dados sensíveis.</p></>:<><p>Sua avaliação fica disponível apenas para a equipe do beta.</p><label>Interesse na história<select required value={rating} onChange={e=>setRating(e.target.value)}><option value="">Escolha uma nota</option>{[1,2,3,4,5].map(n=><option key={n} value={n}>{n} de 5</option>)}</select></label><label>Qualidade do texto<select required value={textRating} onChange={e=>setTextRating(e.target.value)}><option value="">Escolha uma nota</option>{[1,2,3,4,5].map(n=><option key={n} value={n}>{n} de 5</option>)}</select></label><label>O que podemos melhorar? (opcional)<textarea maxLength={1000} value={comment} onChange={e=>setComment(e.target.value)}/></label></>}
 {error&&<p role="alert">{error}</p>}{mode==='review'&&!reviewLoaded&&!busy&&<button className="outline" type="button" onClick={()=>setLoadAttempt(v=>v+1)}>Tentar carregar novamente</button>}
 <div className="feedback-actions"><button className="primary" disabled={busy||mode==='review'&&!reviewLoaded}>{busy?'Aguarde…':mode==='issue'?'Enviar relato':'Salvar avaliação'}</button><button type="button" className="outline" disabled={busy} onClick={close}>Fechar</button></div>
 </form>}</section>;
}
