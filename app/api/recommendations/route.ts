import { env } from "../../../db/runtime";
import { requireAccess } from "../../lib/access";
import { recommend, normalize } from "../../lib/recommendations";
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{"Cache-Control":"no-store"}});
export async function GET(){
  const access=await requireAccess("participant");if(access.error)return access.error;
  const email=access.user!.email;
  const [catalog,favorites,progress,searches]=await Promise.all([
    env.DB.prepare("SELECT id,title,author,genre,description,published_at AS publishedAt FROM books WHERE status='published'").all<{id:string;title:string;author:string;genre:string;description:string;publishedAt:string|null}>(),
    env.DB.prepare("SELECT book_id AS bookId FROM favorites WHERE user_email=?").bind(email).all<{bookId:string}>(),
    env.DB.prepare("SELECT book_id AS bookId,progress FROM reading_progress WHERE user_email=?").bind(email).all<{bookId:string;progress:number}>(),
    env.DB.prepare("SELECT query FROM discovery_searches WHERE user_email=? AND created_at>? ORDER BY created_at DESC LIMIT 12").bind(email,Date.now()-90*86400000).all<{query:string}>()
  ]);
  return json({recommendations:recommend(catalog.results,favorites.results.map(f=>f.bookId),progress.results,searches.results.map(s=>s.query))});
}
export async function POST(request:Request){
  const access=await requireAccess("participant");if(access.error)return access.error;
  const body=await request.json().catch(()=>null) as {query?:unknown}|null;
  if(typeof body?.query!=="string"||body.query.trim().length<2||body.query.length>100)return json({error:"invalid_payload"},400);
  const query=normalize(body.query);if(query.length<2)return json({error:"invalid_payload"},400);
  const email=access.user!.email;
  await env.DB.batch([
    env.DB.prepare("DELETE FROM discovery_searches WHERE user_email=? AND query=?").bind(email,query),
    env.DB.prepare("INSERT INTO discovery_searches(id,user_email,query,created_at) VALUES(?,?,?,?)").bind(crypto.randomUUID(),email,query,Date.now()),
    env.DB.prepare("DELETE FROM discovery_searches WHERE user_email=? AND (created_at<? OR id NOT IN (SELECT id FROM discovery_searches WHERE user_email=? ORDER BY created_at DESC LIMIT 12))").bind(email,Date.now()-90*86400000,email)
  ]);
  return json({ok:true});
}
