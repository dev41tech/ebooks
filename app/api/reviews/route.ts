import {env} from '../../../db/runtime';
import {requireAccess} from '../../lib/access';
const headers={'Cache-Control':'private, no-store'};
export async function GET(request:Request){
 const access=await requireAccess('participant');if(access.error)return access.error;
 const bookId=new URL(request.url).searchParams.get('bookId');
 const review=await env.DB.prepare('SELECT rating,text_rating AS textRating,comment FROM reviews WHERE user_email=? AND book_id=?').bind(access.user!.email,bookId||'').first();
 return Response.json({review},{headers});
}
export async function POST(request:Request){
 const access=await requireAccess('participant');if(access.error)return access.error;
 const body=await request.json().catch(()=>null) as {bookId:string;rating:number;textRating:number;comment:string}|null;
 if(!body||typeof body.bookId!=='string'||![body.rating,body.textRating].every(n=>Number.isInteger(n)&&n>=1&&n<=5)||typeof body.comment!=='string'||body.comment.length>1000)return Response.json({error:'invalid_review'},{status:400});
 const book=await env.DB.prepare("SELECT id FROM books WHERE id=? AND status='published'").bind(body.bookId).first();if(!book)return Response.json({error:'not_found'},{status:404});
 const now=new Date().toISOString();
 await env.DB.prepare(`INSERT INTO reviews(id,user_email,book_id,rating,text_rating,comment,status,created_at,updated_at) VALUES(?,?,?,?,?,?,'beta_private',?,?) ON CONFLICT(user_email,book_id) DO UPDATE SET rating=excluded.rating,text_rating=excluded.text_rating,comment=excluded.comment,status='beta_private',updated_at=excluded.updated_at`).bind(crypto.randomUUID(),access.user!.email,body.bookId,body.rating,body.textRating,body.comment.trim(),now,now).run();
 return Response.json({ok:true},{headers});
}
