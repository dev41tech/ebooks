'use client';
import {useState} from 'react';
import {apiFetch} from '../lib/client-api';
import type {EditorialReport} from '../lib/editorial-check';
export default function EditorialCheck({id}:{id:string}){
 const [report,setReport]=useState<EditorialReport|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 return <section className="editorial-check"><h3>Verificação automática</h3><p>Executada também ao publicar. Os alertas ajudam na revisão; não alteram o texto do livro.</p><button type="button" className="outline" disabled={busy} onClick={async e=>{
 const form=e.currentTarget.closest('form');if(!form)return;const data=new FormData(form);data.set('id',id);data.set('action','check');setBusy(true);setError('');
 try{const r=await apiFetch('/api/admin/imports',{method:'PATCH',body:data});const result=await r.json() as {report?:EditorialReport};if(!r.ok||!result.report)throw new Error();setReport(result.report);}catch{setError('Não foi possível verificar. Confira se há um arquivo e tente novamente.');}finally{setBusy(false);}
 }}>{busy?'Verificando…':'Verificar ebook agora'}</button>{error&&<p role="alert">{error}</p>}{report&&<div role="status"><p>{report.sections} seções · {report.paragraphs} parágrafos · {report.words} palavras</p>{report.errors.length>0&&<><b>Impedimentos</b><ul>{report.errors.map(s=><li key={s}>{s}</li>)}</ul></>}{report.warnings.length>0&&<><b>Pontos para conferir</b><ul>{report.warnings.map(s=><li key={s}>{s}</li>)}</ul></>}{!report.errors.length&&!report.warnings.length&&<p>Nenhum alerta nas verificações executadas.</p>}<p>{report.scope}</p></div>}</section>;
}
