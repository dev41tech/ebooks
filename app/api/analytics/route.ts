import {env} from '../../../db/runtime';
import {requireAccess} from '../../lib/access';
export async function POST(request:Request){
 const access=await requireAccess('participant');if(access.error)return access.error;
 const body=await request.json().catch(()=>null) as {event:string;bookId:string}|null;
 if(!body||!['reader_opened','reader_open_failed','chapter_load_failed','sync_failed'].includes(body.event)||typeof body.bookId!=='string')return Response.json({error:'invalid_event'},{status:400});
 const book=await env.DB.prepare("SELECT id FROM books WHERE id=? AND status='published'").bind(body.bookId).first();if(!book)return Response.json({error:'not_found'},{status:404});
 const now=new Date().toISOString();
 // Once per reader, book, event and UTC day, including across devices.
 const id=JSON.stringify([access.user!.email,body.bookId,body.event,now.slice(0,10)]);
 await env.DB.prepare('INSERT INTO analytics_events(id,user_email,event,book_id,created_at) VALUES(?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(id,access.user!.email,body.event,body.bookId,now).run();
 return Response.json({ok:true},{status:201});
}
