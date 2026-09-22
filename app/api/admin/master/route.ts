import { env } from "../../../../db/runtime";
import { sessionAccess } from "../../../lib/access";
import { digest, equalHash, masterCookie, masterToken, masterUnlocked, passwordHash, randomSecret, SESSION_SECONDS } from "../../../lib/master";
const json=(data:unknown,status=200,cookie?:string)=>Response.json(data,{status,headers:{"Cache-Control":"no-store",...(cookie?{"Set-Cookie":cookie}:{})}});
async function adminIdentity() {
  const s=await sessionAccess();
  return s.user && s.ownerAdmin ? s.user : null;
}
export async function GET() {
  const user=await adminIdentity();if(!user)return json({error:"admin_required"},403);
  const configured=!!await env.DB.prepare("SELECT id FROM master_credentials WHERE id='master'").first();
  return json({configured,unlocked:configured&&await masterUnlocked(user.email)});
}
export async function POST(request:Request) {
  const user=await adminIdentity();if(!user)return json({error:"admin_required"},403);
  if(request.headers.get("origin")!==new URL(request.url).origin || !request.headers.get("content-type")?.includes("application/json"))return json({error:"invalid_origin"},403);
  if(Number(request.headers.get("content-length")||0)>4096)return json({error:"invalid_payload"},400);
  let body:{action?:string;password?:string};try{const raw=await request.text();if(raw.length>4096)return json({error:"invalid_payload"},400);body=JSON.parse(raw);}catch{return json({error:"invalid_payload"},400);}
  if(!body || !["setup","login","logout"].includes(body.action||""))return json({error:"invalid_payload"},400);
  if(body.action==="logout") {
    const token=await masterToken();if(token)await env.DB.prepare("DELETE FROM master_sessions WHERE token_hash=? AND email=?").bind(await digest(token),user.email).run();
    return json({ok:true},200,masterCookie("",0));
  }
  const password=body.password;
  if(typeof password!=="string"||password.length<12||password.length>128)return json({error:"master_password_length"},400);
  const now=Date.now(),windowMs=15*60*1000;
  const attempt=await env.DB.prepare("INSERT INTO master_attempts(email,attempts,window_start) VALUES(?,1,?) ON CONFLICT(email) DO UPDATE SET attempts=CASE WHEN master_attempts.window_start<=? THEN 1 ELSE master_attempts.attempts+1 END, window_start=CASE WHEN master_attempts.window_start<=? THEN excluded.window_start ELSE master_attempts.window_start END RETURNING attempts").bind(user.email,now,now-windowMs,now-windowMs).first<{attempts:number}>();
  if(!attempt||attempt.attempts>5)return json({error:"master_rate_limited"},429);
  const credential=await env.DB.prepare("SELECT salt,password_hash FROM master_credentials WHERE id='master'").first<{salt:string;password_hash:string}>();
  if(body.action==="setup") {
    if(credential)return json({error:"master_already_configured"},409);
    const salt=randomSecret();const hash=await passwordHash(password,salt);
    const result=await env.DB.prepare("INSERT INTO master_credentials(id,salt,password_hash,created_at) VALUES('master',?,?,?) ON CONFLICT(id) DO NOTHING").bind(salt,hash,now).run();
    if(result.meta.changes!==1)return json({error:"master_already_configured"},409);
  } else {
    if(!credential)return json({error:"master_setup_required"},409);
    if(!equalHash(await passwordHash(password,credential.salt),credential.password_hash))return json({error:"master_invalid_password"},401);
  }
  const token=randomSecret();
  await env.DB.batch([
    env.DB.prepare("DELETE FROM master_attempts WHERE email=?").bind(user.email),
    env.DB.prepare("DELETE FROM master_sessions WHERE expires_at<=?").bind(now),
    env.DB.prepare("INSERT INTO master_sessions(token_hash,email,expires_at) VALUES(?,?,?)").bind(await digest(token),user.email,now+SESSION_SECONDS*1000)
  ]);
  return json({ok:true},200,masterCookie(token));
}
