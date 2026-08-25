// Produção de ebooks por IA — telas portadas do Sambu Ebooks.
//
// Nesta etapa a API só persiste o pedido do autor e o rascunho: a geração em si
// (chamadas à OpenAI, capa, exportação) ainda não roda no Worker. Por isso um
// registro criado aqui nasce em "rascunho" e fica aguardando a etapa de geração
// ser ligada — ver status/status_message.
import { and, asc, desc, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { ebookDraftChapters, ebookDrafts } from "../../../../db/schema";
import { requireAuthor } from "../../../auth";

const TONES = ["Motivador", "Técnico e direto", "Descontraído", "Formal"];
const LANGUAGES = [
  "Português (Brasil)",
  "Português (Portugal)",
  "Inglês",
  "Espanhol",
];
const CATEGORIES = ["geral", "tecnico", "comportamental"];
const ORIGINS = ["ia", "referencia", "importado"];

function text(value: unknown, max: number): string {
  return String(value ?? "")
    .trim()
    .slice(0, max);
}

export async function GET(request: Request) {
  const { user, error } = await requireAuthor();
  if (error) return error;

  const id = new URL(request.url).searchParams.get("id");
  const db = await getDb();

  if (id) {
    const [draft] = await db
      .select()
      .from(ebookDrafts)
      .where(and(eq(ebookDrafts.id, id), eq(ebookDrafts.ownerEmail, user.email)))
      .limit(1);
    if (!draft) return Response.json({ error: "not_found" }, { status: 404 });
    const chapters = await db
      .select()
      .from(ebookDraftChapters)
      .where(eq(ebookDraftChapters.draftId, id))
      .orderBy(asc(ebookDraftChapters.position));
    return Response.json({ draft, chapters });
  }

  const drafts = await db
    .select()
    .from(ebookDrafts)
    .where(eq(ebookDrafts.ownerEmail, user.email))
    .orderBy(desc(ebookDrafts.createdAt));
  return Response.json({ drafts });
}

export async function POST(request: Request) {
  const { user, error } = await requireAuthor();
  if (error) return error;

  const body = (await request.json()) as Record<string, unknown>;

  const theme = text(body.theme, 300);
  if (!theme)
    return Response.json({ error: "theme_required" }, { status: 400 });

  const pageCount = Number(body.pageCount ?? 20);
  if (!Number.isFinite(pageCount) || pageCount < 1 || pageCount > 1000)
    return Response.json({ error: "invalid_page_count" }, { status: 400 });

  const wordsPerPage = Number(body.wordsPerPage ?? 250);
  if (!Number.isFinite(wordsPerPage) || wordsPerPage < 150 || wordsPerPage > 500)
    return Response.json({ error: "invalid_words_per_page" }, { status: 400 });

  const origin = ORIGINS.includes(String(body.origin))
    ? String(body.origin)
    : "ia";
  const category = CATEGORIES.includes(String(body.category))
    ? String(body.category)
    : "geral";

  // Ebook técnico/comportamental é escrito em cima de um material de referência;
  // sem ele a IA inventaria os dados, então o campo é obrigatório nesse fluxo.
  const referenceMaterial = text(body.referenceMaterial, 200_000);
  if (origin === "referencia" && !referenceMaterial)
    return Response.json({ error: "reference_required" }, { status: 400 });

  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const db = await getDb();

  await db.insert(ebookDrafts).values({
    id,
    ownerEmail: user.email,
    origin,
    category,
    title: text(body.title, 200),
    titleMode: body.title ? "manual" : "ai",
    subtitle: text(body.subtitle, 200),
    theme,
    audience: text(body.audience, 500),
    tone: TONES.includes(String(body.tone)) ? String(body.tone) : TONES[0],
    language: LANGUAGES.includes(String(body.language))
      ? String(body.language)
      : LANGUAGES[0],
    pageCount: Math.round(pageCount),
    wordsPerPage: Math.round(wordsPerPage),
    authorName: text(body.authorName, 120),
    authorBio: text(body.authorBio, 1000),
    extraInstructions: text(body.extraInstructions, 1000),
    referenceMaterial,
    referenceSource: text(body.referenceSource, 500),
    coverSource: text(body.coverSource, 20) || "none",
    coverSuggestion: text(body.coverSuggestion, 500),
    sourceFileName: text(body.sourceFileName, 300) || null,
    status: "rascunho",
    statusMessage: "Aguardando a etapa de geração ser habilitada.",
    createdAt: now,
    updatedAt: now,
  });

  return Response.json({ ok: true, id }, { status: 201 });
}

export async function PATCH(request: Request) {
  const { user, error } = await requireAuthor();
  if (error) return error;

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return Response.json({ error: "invalid_payload" }, { status: 400 });

  const body = (await request.json()) as Record<string, unknown>;
  const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };

  if (body.title !== undefined) patch.title = text(body.title, 200);
  if (body.subtitle !== undefined) patch.subtitle = text(body.subtitle, 200);
  if (body.intro !== undefined) patch.intro = text(body.intro, 100_000);
  if (body.conclusion !== undefined)
    patch.conclusion = text(body.conclusion, 100_000);
  if (body.authorName !== undefined)
    patch.authorName = text(body.authorName, 120);
  if (body.authorBio !== undefined) patch.authorBio = text(body.authorBio, 1000);
  if (body.marketing !== undefined) patch.marketing = body.marketing;
  if (body.status !== undefined) patch.status = text(body.status, 40);

  const db = await getDb();
  await db
    .update(ebookDrafts)
    .set(patch)
    .where(and(eq(ebookDrafts.id, id), eq(ebookDrafts.ownerEmail, user.email)));

  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const { user, error } = await requireAuthor();
  if (error) return error;

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return Response.json({ error: "invalid_payload" }, { status: 400 });

  const db = await getDb();
  await db
    .delete(ebookDraftChapters)
    .where(eq(ebookDraftChapters.draftId, id));
  await db
    .delete(ebookDrafts)
    .where(and(eq(ebookDrafts.id, id), eq(ebookDrafts.ownerEmail, user.email)));

  return Response.json({ ok: true });
}
