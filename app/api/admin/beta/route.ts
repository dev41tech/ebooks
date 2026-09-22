import {env} from 'cloudflare:workers';
import {requireAccess} from '../../../lib/access';
import {feedbackStatus} from '../../../lib/beta';
export async function GET(){
 const access=await requireAccess('admin');if(access.error)return access.error;
 try{
 const since=new Date(Date.now()-14*86400000).toISOString();
 const [activity,failures,feedback,ratings,books,counts]=await Promise.all([
  env.DB.prepare(`SELECT COUNT(*) AS activeReaders,COALESCE(SUM(days>1),0) AS returningReaders FROM (SELECT user_email,COUNT(DISTINCT substr(created_at,1,10)) AS days FROM analytics_events WHERE event='reader_opened' AND created_at>=? GROUP BY user_email)`).bind(since).first(),
  env.DB.prepare(`SELECT event,COUNT(*) AS count FROM analytics_events WHERE created_at>=? AND event IN ('reader_open_failed','chapter_load_failed','sync_failed') GROUP BY event`).bind(since).all(),
  env.DB.prepare(`SELECT f.id,f.book_id AS bookId,b.title AS bookTitle,f.category,f.message,f.chapter_label AS chapterLabel,f.position,f.app_version AS appVersion,f.device,f.status,f.created_at AS createdAt FROM beta_feedback f LEFT JOIN books b ON b.id=f.book_id ORDER BY CASE f.status WHEN 'open' THEN 0 WHEN 'reviewing' THEN 1 ELSE 2 END,f.created_at DESC LIMIT 100`).all(),
  env.DB.prepare(`SELECT r.id,b.title AS bookTitle,r.rating,r.text_rating AS textRating,r.comment,r.updated_at AS updatedAt FROM reviews r LEFT JOIN books b ON b.id=r.book_id WHERE r.status='beta_private' ORDER BY r.updated_at DESC LIMIT 100`).all(),
  env.DB.prepare(`SELECT b.id,b.title,
   (SELECT COUNT(DISTINCT e.user_email) FROM analytics_events e WHERE e.book_id=b.id AND e.event='reader_opened' AND e.created_at>=?) AS readers,
   (SELECT COUNT(*) FROM reading_progress p WHERE p.book_id=b.id AND p.progress>=25 AND EXISTS(SELECT 1 FROM analytics_events e WHERE e.book_id=p.book_id AND e.user_email=p.user_email AND e.event='reader_opened' AND e.created_at>=?)) AS advanced,
   (SELECT COUNT(*) FROM reading_progress p WHERE p.book_id=b.id AND p.progress=100 AND EXISTS(SELECT 1 FROM analytics_events e WHERE e.book_id=p.book_id AND e.user_email=p.user_email AND e.event='reader_opened' AND e.created_at>=?)) AS completed,
   (SELECT ROUND(AVG(r.rating),1) FROM reviews r WHERE r.book_id=b.id AND r.status='beta_private') AS storyRating,
   (SELECT ROUND(AVG(r.text_rating),1) FROM reviews r WHERE r.book_id=b.id AND r.status='beta_private') AS textRating,
   (SELECT COUNT(*) FROM reviews r WHERE r.book_id=b.id AND r.status='beta_private') AS ratings
   FROM books b ORDER BY readers DESC,b.title LIMIT 200`).bind(since,since,since).all(),
  env.DB.prepare("SELECT COUNT(*) AS reports,COALESCE(SUM(status!='resolved'),0) AS unresolved FROM beta_feedback").first()
 ]);
 return Response.json({since,activity,failures:failures.results,feedback:feedback.results,reviews:ratings.results,books:books.results,counts},{headers:{'Cache-Control':'private, no-store'}});
 }catch(error){console.error('beta_dashboard_unavailable',error);return Response.json({error:'unavailable'},{status:503});}
}
export async function PATCH(request:Request){
 const access=await requireAccess('admin');if(access.error)return access.error;
 const body=await request.json().catch(()=>null) as {id:string;status:string}|null;
 if(!body||typeof body.id!=='string'||!Object.hasOwn(feedbackStatus,body.status))return Response.json({error:'invalid_status'},{status:400});
 const result=await env.DB.prepare('UPDATE beta_feedback SET status=?,updated_at=? WHERE id=?').bind(body.status,new Date().toISOString(),body.id).run();
 return Response.json({ok:!!result.meta.changes},{status:result.meta.changes?200:404});
}
