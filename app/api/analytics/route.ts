import { getDb } from "../../../db";
import { analyticsEvents } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  const body = (await request.json()) as { event?: string; bookId?: string; chapterId?: string; anonymousId?: string; metadata?: unknown };
  if (!body.event || body.event.length > 80) return Response.json({ error: "invalid_event" }, { status: 400 });
  const db = await getDb();
  await db.insert(analyticsEvents).values({ id: crypto.randomUUID(), userEmail: user?.email ?? null, anonymousId: body.anonymousId?.slice(0, 100), event: body.event, bookId: body.bookId, chapterId: body.chapterId, metadata: body.metadata ?? null, createdAt: new Date().toISOString() });
  return Response.json({ ok: true }, { status: 201 });
}
