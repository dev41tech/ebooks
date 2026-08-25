// Capítulos do rascunho em produção — usados pela tela de revisão, onde o autor
// ajusta o texto antes de publicar no catálogo.
import { and, asc, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { ebookDraftChapters, ebookDrafts } from "../../../../db/schema";
import { getUser } from "../../../auth";

async function ownsDraft(email: string, draftId: string): Promise<boolean> {
  const db = await getDb();
  const [row] = await db
    .select({ id: ebookDrafts.id })
    .from(ebookDrafts)
    .where(and(eq(ebookDrafts.id, draftId), eq(ebookDrafts.ownerEmail, email)))
    .limit(1);
  return !!row;
}

export async function GET(request: Request) {
  const user = await getUser();
  if (!user) return Response.json({ chapters: [] });

  const draftId = new URL(request.url).searchParams.get("draftId");
  if (!draftId)
    return Response.json({ error: "invalid_payload" }, { status: 400 });
  if (!(await ownsDraft(user.email, draftId)))
    return Response.json({ error: "not_found" }, { status: 404 });

  const db = await getDb();
  const chapters = await db
    .select()
    .from(ebookDraftChapters)
    .where(eq(ebookDraftChapters.draftId, draftId))
    .orderBy(asc(ebookDraftChapters.position));
  return Response.json({ chapters });
}

export async function POST(request: Request) {
  const user = await getUser();
  if (!user)
    return Response.json({ error: "sign_in_required" }, { status: 401 });

  const body = (await request.json()) as {
    draftId?: string;
    title?: string;
    content?: string;
    position?: number;
  };
  if (!body.draftId || !body.title?.trim())
    return Response.json({ error: "invalid_payload" }, { status: 400 });
  if (!(await ownsDraft(user.email, body.draftId)))
    return Response.json({ error: "not_found" }, { status: 404 });

  const db = await getDb();
  const existing = await db
    .select({ position: ebookDraftChapters.position })
    .from(ebookDraftChapters)
    .where(eq(ebookDraftChapters.draftId, body.draftId));
  const position = Number.isInteger(body.position)
    ? Number(body.position)
    : existing.length;

  await db.insert(ebookDraftChapters).values({
    id: crypto.randomUUID(),
    draftId: body.draftId,
    position,
    title: body.title.trim().slice(0, 200),
    content: (body.content ?? "").slice(0, 200_000),
    createdAt: new Date().toISOString(),
  });

  return Response.json({ ok: true }, { status: 201 });
}

export async function PATCH(request: Request) {
  const user = await getUser();
  if (!user)
    return Response.json({ error: "sign_in_required" }, { status: 401 });

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return Response.json({ error: "invalid_payload" }, { status: 400 });

  const body = (await request.json()) as { title?: string; content?: string };
  const db = await getDb();

  const [chapter] = await db
    .select()
    .from(ebookDraftChapters)
    .where(eq(ebookDraftChapters.id, id))
    .limit(1);
  if (!chapter || !(await ownsDraft(user.email, chapter.draftId)))
    return Response.json({ error: "not_found" }, { status: 404 });

  await db
    .update(ebookDraftChapters)
    .set({
      title: (body.title ?? chapter.title).trim().slice(0, 200),
      content: (body.content ?? chapter.content).slice(0, 200_000),
    })
    .where(eq(ebookDraftChapters.id, id));

  return Response.json({ ok: true });
}
