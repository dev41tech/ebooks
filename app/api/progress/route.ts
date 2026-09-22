import { env } from "../../../db/runtime";
import { and, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { books, readingProgress } from "../../../db/schema";
import { requireAccess } from "../../lib/access";
import { isValidProgress } from "../../lib/policy";
export async function GET() {
  const access = await requireAccess("participant");
  if (access.error) return access.error;
  const db = await getDb();
  const rows = await db.select().from(readingProgress).where(eq(readingProgress.userEmail, access.user!.email));
  return Response.json({ progress: Object.fromEntries(rows.map(r => [r.bookId, r.progress])), locations: Object.fromEntries(rows.map(r => [r.bookId, { position: r.position, progress: r.progress, revision: r.revision }])) }, { headers: { "Cache-Control": "no-store" } });
}
export async function POST(request: Request) {
  const access = await requireAccess("participant");
  if (access.error) return access.error;
  const body = await request.json().catch(() => ({})) as { bookId?: string; progress?: number; position?: number; revision?: number };
  if (!body.bookId || !isValidProgress(body.progress) || !Number.isInteger(body.position) || body.position! < 0 || body.position! > 1_000_000) return Response.json({ error: "invalid_payload" }, { status: 400 });
  const db = await getDb();
  const [book] = await db.select({ id: books.id }).from(books).where(and(eq(books.id, body.bookId), eq(books.status, "published"))).limit(1);
  if (!book) return Response.json({ error: "not_found" }, { status: 404 });
  const revision=body.revision??0;
  if(!Number.isInteger(revision)||revision<0)return Response.json({error:"invalid_payload"},{status:400});
  const now = new Date().toISOString();
  const row=await env.DB.prepare("INSERT INTO reading_progress(id,user_email,book_id,chapter,position,progress,revision,updated_at) SELECT ?,?,?,0,?,?,1,? WHERE ?=0 OR EXISTS(SELECT 1 FROM reading_progress WHERE user_email=? AND book_id=?) ON CONFLICT(user_email,book_id) DO UPDATE SET position=excluded.position,progress=excluded.progress,revision=reading_progress.revision+1,updated_at=excluded.updated_at WHERE reading_progress.revision=? RETURNING position,progress,revision").bind(crypto.randomUUID(),access.user!.email,body.bookId,body.position!,body.progress!,now,revision,access.user!.email,body.bookId,revision).first();
  if(!row){const location=await env.DB.prepare("SELECT position,progress,revision FROM reading_progress WHERE user_email=? AND book_id=?").bind(access.user!.email,body.bookId).first();return Response.json({error:"progress_conflict",location:location??{position:0,progress:0,revision:0}},{status:409,headers:{"Cache-Control":"no-store"}});}
  return Response.json({ok:true,location:row},{headers:{"Cache-Control":"no-store"}});
}
