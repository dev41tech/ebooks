import {env} from 'cloudflare:workers';
import {requireAccess} from '../../lib/access';
import {ISSUE_CATEGORIES,BETA_VERSION} from '../../lib/beta';
export async function POST(request:Request){
 const access=await requireAccess('participant');if(access.error)return access.error;
 const body=await request.json().catch(()=>null) as {id:string;bookId:string;category:string;message:string;position:number;chapterLabel:string;device:string}|null;
 if(!body||typeof body.bookId!=='string'||!Object.hasOwn(ISSUE_CATEGORIES,body.category)||typeof body.message!=='string'||body.message.trim().length<10||body.message.length>2000||!Number.isInteger(body.position)||body.position<0||body.position>1000000||typeof body.chapterLabel!=='string'||body.chapterLabel.length>200||!['mobile','desktop'].includes(body.device)||typeof body.id!=='string'||! /^[a-f0-9-]{36}$/.test(body.id))return Response.json({error:'invalid_feedback'},{status:400});
 const book=await env.DB.prepare("SELECT id FROM books WHERE id=? AND status='published'").bind(body.bookId).first();if(!book)return Response.json({error:'not_found'},{status:404});
 const now=new Date().toISOString(),email=access.user!.email;
 const existing=await env.DB.prepare('SELECT user_email FROM beta_feedback WHERE id=?').bind(body.id).first<{user_email:string}>();
 if(existing)return Response.json({ok:existing.user_email===email},{status:existing.user_email===email?200:409});
 const result=await env.DB.prepare(`INSERT INTO beta_feedback(id,user_email,book_id,category,message,chapter_label,position,app_version,device,status,created_at,updated_at) SELECT ?,?,?,?,?,?,?,?,?,'open',?,? WHERE (SELECT COUNT(*) FROM beta_feedback WHERE user_email=? AND created_at>=?)<10 ON CONFLICT(id) DO NOTHING`).bind(body.id,email,body.bookId,body.category,body.message.trim(),body.chapterLabel,body.position,BETA_VERSION,body.device,now,now,email,now.slice(0,10)).run();
 if(!result.meta.changes)return Response.json({error:'feedback_limit'},{status:429});
 return Response.json({ok:true},{status:201});
}
