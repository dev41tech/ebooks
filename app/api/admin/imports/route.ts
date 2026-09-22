import {checkEbook,type EditorialReport} from "../../../lib/editorial-check";
import { extractEpub } from "../../../lib/epub";
import { env } from "cloudflare:workers";
import { and, desc, eq, ne, or, isNull } from "drizzle-orm";
import { getDb } from "../../../../db";
import { books, importBatches, stagingBooks } from "../../../../db/schema";
import { requireAccess } from "../../../lib/access";

type Row = {
  title?: string;
  author?: string;
  genre?: string;
  language?: string;
  description?: string;
  isbn?: string;
  source?: string;
  sourceUrl?: string;
  licenseType?: string;
  fileName?: string;
  storageKey?: string;
  contentType?: string;
  fileSize?: number;
};
type UploadedFile = {
  fileName: string;
  storageKey: string;
  contentType: string;
  fileSize: number;
};
const testTitles: Row[] = [
  {
    title: "Dom Casmurro",
    author: "Machado de Assis",
    genre: "Clássico brasileiro",
    language: "pt-BR",
    licenseType: "Domínio público",
    source: "Portal Domínio Público",
  },
  {
    title: "Memórias Póstumas de Brás Cubas",
    author: "Machado de Assis",
    genre: "Clássico brasileiro",
    language: "pt-BR",
    licenseType: "Domínio público",
    source: "Biblioteca Nacional",
  },
  {
    title: "O Cortiço",
    author: "Aluísio Azevedo",
    genre: "Romance naturalista",
    language: "pt-BR",
    licenseType: "Domínio público",
    source: "Portal Domínio Público",
  },
  {
    title: "Iracema",
    author: "José de Alencar",
    genre: "Romance",
    language: "pt-BR",
    licenseType: "Domínio público",
    source: "Wikisource",
  },
  {
    title: "A Escrava Isaura",
    author: "Bernardo Guimarães",
    genre: "Romance",
    language: "pt-BR",
    licenseType: "Domínio público",
    source: "Wikisource",
  },
  {
    title: "Triste Fim de Policarpo Quaresma",
    author: "Lima Barreto",
    genre: "Sátira",
    language: "pt-BR",
    licenseType: "Domínio público",
    source: "Biblioteca Nacional",
  },
  {
    title: "Alice no País das Maravilhas",
    author: "Lewis Carroll",
    genre: "Fantasia",
    language: "pt-BR",
    licenseType: "Revisar tradução",
    source: "Project Gutenberg",
  },
  {
    title: "A Máquina do Tempo",
    author: "H. G. Wells",
    genre: "Ficção científica",
    language: "en",
    licenseType: "Domínio público EUA",
    source: "Standard Ebooks",
  },
];

function splitCsvLine(line: string) {
  const out: string[] = [];
  let current = "",
    quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"' && line[i + 1] === '"') {
      current += '"';
      i++;
    } else if (c === '"') quoted = !quoted;
    else if (c === "," && !quoted) {
      out.push(current.trim());
      current = "";
    } else current += c;
  }
  out.push(current.trim());
  return out;
}
function parseManifest(text: string, name: string): Row[] {
  if (name.toLowerCase().endsWith(".json")) {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : parsed.books || [];
  }
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter(Boolean);
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]).map((x) => x.trim());
  return lines
    .slice(1)
    .map((line) =>
      Object.fromEntries(
        splitCsvLine(line).map((value, i) => [headers[i], value]),
      ),
    );
}
function expiry() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString();
}
function clean(value: unknown, max = 500) {
  return String(value || "")
    .trim()
    .slice(0, max);
}

export async function GET(request: Request) {
  const access = await requireAccess("admin");
  if (access.error) return access.error;
  const user = access.user!;
  const db = await getDb();
  const fileId = new URL(request.url).searchParams.get("file");
  if (fileId) {
    const [item] = await db
      .select()
      .from(stagingBooks)
      .where(
        and(
          eq(stagingBooks.id, fileId),
          eq(stagingBooks.ownerEmail, user.email),
        ),
      )
      .limit(1);
    if (!item?.storageKey)
      return Response.json({ error: "file_not_found" }, { status: 404 });
    const object = await env.BUCKET.get(item.storageKey);
    if (!object)
      return Response.json({ error: "file_not_found" }, { status: 404 });
    return new Response(object.body, {
      headers: {
        "content-type": item.contentType || "application/octet-stream",
        "content-disposition": `inline; filename="${(item.fileName || "ebook").replace(/"/g, "")}"`,
      },
    });
  }
  const batches = await db
    .select()
    .from(importBatches)
    .where(eq(importBatches.ownerEmail, user.email))
    .orderBy(desc(importBatches.createdAt));
  const items = await db
    .select()
    .from(stagingBooks)
    .where(and(eq(stagingBooks.ownerEmail, user.email), ne(stagingBooks.status, "archived")))
    .orderBy(desc(stagingBooks.createdAt));
  return Response.json({ batches, items: items.slice(0, 100) });
}

export async function POST(request: Request) {
  const access = await requireAccess("admin");
  if (access.error) return access.error;
  const user = access.user!;
  const db = await getDb();
  const contentType = request.headers.get("content-type") || "";
  const now = new Date().toISOString(),
    expiresAt = null,
    batchId = crypto.randomUUID();
  let rows: Row[] = [],
    files: File[] = [],
    uploadedFiles: UploadedFile[] = [],
    name = "Lote de importação",
    source = "Upload manual";
  if (contentType.includes("application/json")) {
    const body = (await request.json()) as { action?: string };
    if (body.action !== "seed")
      return Response.json({ error: "invalid_action" }, { status: 400 });
    return Response.json({ error: "demo_disabled" }, { status: 409 });
    rows = testTitles;
    name = "Acervo temporário de demonstração";
    source = "Base de testes Sambu";
  } else {
    const form = await request.formData();
    const mode = clean(form.get("mode"), 20) || "batch";
    name = clean(form.get("name"), 100) || name;
    source = clean(form.get("source"), 100) || source;
    try {
      const parsed = JSON.parse(String(form.get("uploadedFiles") || "[]"));
      if (Array.isArray(parsed))
        uploadedFiles = parsed.slice(0, 50).map((item) => ({
          fileName: clean(item.fileName, 180),
          storageKey: clean(item.storageKey, 500),
          contentType: clean(item.contentType, 120),
          fileSize: Number(item.fileSize || 0),
        }));
    } catch {
      return Response.json({ error: "invalid_uploaded_files" }, { status: 400 });
    }
    const folderFiles = form
      .getAll("folderFiles")
      .filter((x): x is File => x instanceof File && x.size > 0);
    files = [
      ...form
        .getAll("files")
        .filter((x): x is File => x instanceof File && x.size > 0),
      ...folderFiles.filter((file) => !/\.(csv|json)$/i.test(file.name)),
    ];
    if (mode === "individual") {
      const singleFile = form.get("singleFile");
      const uploaded = uploadedFiles[0];
      if (!(singleFile instanceof File && singleFile.size) && !uploaded)
        return Response.json({ error: "book_file_required" }, { status: 400 });
      if (singleFile instanceof File && singleFile.size) files = [singleFile];
      name = `Importação individual — ${clean(form.get("title"), 140)}`;
      rows = [
        {
          title: clean(form.get("title"), 140),
          author: clean(form.get("author"), 100),
          genre: clean(form.get("genre"), 60),
          language: clean(form.get("language"), 12) || "pt-BR",
          description: clean(form.get("description"), 4000),
          isbn: clean(form.get("isbn"), 32),
          source,
          sourceUrl: clean(form.get("sourceUrl"), 500),
          licenseType: clean(form.get("licenseType"), 100),
          fileName: uploaded?.fileName || (singleFile as File).name,
          storageKey: uploaded?.storageKey,
          contentType: uploaded?.contentType,
          fileSize: uploaded?.fileSize,
        },
      ];
    } else {
      const explicitManifest = form.get("manifest");
      const manifest =
        explicitManifest instanceof File && explicitManifest.size
          ? explicitManifest
          : folderFiles.find((file) => /\.(csv|json)$/i.test(file.name));
      if (!(manifest instanceof File))
        return Response.json({ error: "manifest_required" }, { status: 400 });
      if (manifest.size > 2_000_000 || files.length > 50)
        return Response.json({ error: "batch_limit" }, { status: 400 });
      try {
        rows = parseManifest(await manifest.text(), manifest.name);
      } catch {
        return Response.json({ error: "invalid_manifest" }, { status: 400 });
      }
      if (rows.length > 250)
        return Response.json({ error: "row_limit" }, { status: 400 });
    }
  }
  const fileMap = new Map(files.map((file) => [file.name.toLowerCase(), file]));
  const uploadedMap = new Map(
    uploadedFiles.map((file) => [file.fileName.toLowerCase(), file]),
  );
  let valid = 0,
    errors = 0;
  const itemRows = [];
  for (const row of rows) {
    const title = clean(row.title, 140),
      author = clean(row.author, 100),
      fileName = clean(row.fileName, 180);
    const validationErrors = [];
    if (!title) validationErrors.push("Título ausente");
    if (!author) validationErrors.push("Autor ausente");
    if (!clean(row.licenseType, 100)) validationErrors.push("Licença pendente");
    const file = fileName ? fileMap.get(fileName.toLowerCase()) : undefined;
    const uploaded = fileName
      ? uploadedMap.get(fileName.toLowerCase())
      : undefined;
    let storageKey: string | null = null;
    let storedContentType: string | null = null;
    let storedFileSize: number | null = null;
    if (file) {
      if (file.size > 40_000_000) validationErrors.push("Arquivo excede 40 MB");
      else {
        storageKey = `imports/${batchId}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-120)}`;
        await env.BUCKET.put(storageKey, file.stream(), {
          httpMetadata: {
            contentType: file.type || "application/octet-stream",
          },
          customMetadata: { owner: user.email, batchId },
        });
        storedContentType = file.type || "application/octet-stream";
        storedFileSize = file.size;
      }
    } else if (uploaded) {
      const object = await env.BUCKET.head(uploaded.storageKey);
      if (
        !object ||
        object.customMetadata?.owner !== user.email ||
        !uploaded.storageKey.startsWith("imports/direct/")
      )
        validationErrors.push("Upload direto não confirmado");
      else if (object.size > 250_000_000)
        validationErrors.push("Arquivo excede 250 MB");
      else {
        storageKey = uploaded.storageKey;
        storedContentType =
          object.httpMetadata?.contentType ||
          uploaded.contentType ||
          "application/octet-stream";
        storedFileSize = object.size;
      }
    } else if (fileName)
      validationErrors.push("Arquivo não encontrado no lote");
    validationErrors.length ? errors++ : valid++;
    itemRows.push({
      id: crypto.randomUUID(),
      batchId,
      ownerEmail: user.email,
      title: title || "Sem título",
      author: author || "Autor desconhecido",
      genre: clean(row.genre, 60) || null,
      language: clean(row.language, 12) || "pt-BR",
      description: clean(row.description, 4000) || null,
      isbn: clean(row.isbn, 32) || null,
      source: clean(row.source, 100) || source,
      sourceUrl: clean(row.sourceUrl, 500) || null,
      licenseType: clean(row.licenseType, 100) || null,
      rightsStatus: clean(row.licenseType, 100) ? "review" : "pending",
      fileName: file?.name || fileName || null,
      storageKey,
      contentType: storedContentType,
      fileSize: storedFileSize,
      status: validationErrors.length ? "needs_review" : "ready",
      validationErrors,
      isTest: source === "Base de testes Sambu",
      createdAt: now,
      expiresAt,
    });
  }
  await db.insert(importBatches).values({
    id: batchId,
    ownerEmail: user.email,
    name,
    source,
    environment: "review",
    status: errors ? "needs_review" : "ready",
    totalItems: itemRows.length,
    validItems: valid,
    errorItems: errors,
    createdAt: now,
    expiresAt,
  });
  if (itemRows.length) await db.insert(stagingBooks).values(itemRows);
  return Response.json(
    {
      ok: true,
      batch: {
        id: batchId,
        name,
        totalItems: itemRows.length,
        validItems: valid,
        errorItems: errors,
        expiresAt,
      },
    },
    { status: 201 },
  );
}

function slugify(title: string, id: string) {
  return (
    title
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 90) +
    "-" +
    id.slice(0, 6)
  );
}

export async function PATCH(request: Request) {
  const access = await requireAccess("admin");
  if (access.error) return access.error;
  const user = access.user!;
  const form = await request.formData();
  const id = clean(form.get("id"), 80);
  const action = clean(form.get("action"), 30);
  if (!id || !["draft", "correction", "publish", "check"].includes(action))
    return Response.json({ error: "invalid_action" }, { status: 400 });
  const db = await getDb();
  const [item] = await db
    .select()
    .from(stagingBooks)
    .where(
      and(eq(stagingBooks.id, id), eq(stagingBooks.ownerEmail, user.email)),
    )
    .limit(1);
  if (!item || item.status === "archived") return Response.json({ error: "not_found" }, { status: 404 });

  const title = clean(form.get("title"), 140);
  const author = clean(form.get("author"), 100);
  const genre = clean(form.get("genre"), 60);
  const language = clean(form.get("language"), 12) || "pt-BR";
  const description = clean(form.get("description"), 4000);
  const licenseType = clean(form.get("licenseType"), 100);
  const correctionNote = clean(form.get("correctionNote"), 1000);
  const rightsConfirmed = form.get("rightsConfirmed") === "true";
  const now = new Date().toISOString();
  let coverKey = item.coverKey;
  const cover = form.get("cover");
  if (action !== "check" && cover instanceof File && cover.size) {
    if (!["image/png", "image/jpeg", "image/webp"].includes(cover.type) || cover.size > 8_000_000)
      return Response.json({ error: "invalid_cover" }, { status: 400 });
    coverKey = `imports/${item.batchId}/covers/${crypto.randomUUID()}-${cover.name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-100)}`;
    await env.BUCKET.put(coverKey, cover.stream(), {
      httpMetadata: { contentType: cover.type },
      customMetadata: { owner: user.email, stagingBookId: item.id },
    });
  }
  const requiredOk = title && author && genre && description && licenseType && !/pendente|revisar/i.test(licenseType);
  if (
    action === "publish" &&
    (!requiredOk || !rightsConfirmed || !item.storageKey)
  )
    return Response.json(
      { error: !item.storageKey ? "book_file_required" : "review_incomplete" },
      { status: 400 },
    );

  let report:EditorialReport|undefined;
  if(action==='check'||action==='publish'){
    const pdf=!!item.fileName?.toLowerCase().endsWith('.pdf');
    const object=item.storageKey?await env.BUCKET.get(item.storageKey,pdf?{range:{offset:0,length:5}}:undefined):null;
    if(!object)return Response.json({error:'book_file_required'},{status:400});
    if(!pdf&&object.size>32_000_000)return Response.json({error:'invalid_book_content'},{status:422});
    report=checkEbook(new Uint8Array(await object.arrayBuffer()),{title,author,cover:!!coverKey||(cover instanceof File&&cover.size>0),pdf});
    if(action==='check')return Response.json({report});
    if(report.errors.length)return Response.json({error:'invalid_book_content',report},{status:422});
  }
  let publishedBookId = item.publishedBookId;
  const mutations = [];
  if (action === "publish") {
    if (item.publishedBookId) {
      const [existing] = await db.select().from(books).where(eq(books.id, item.publishedBookId)).limit(1);
      if (existing) return Response.json({ ok: true, status: item.status, publishedBookId: existing.id });
    }
    const object = await env.BUCKET.get(item.storageKey!);
    if (!object) return Response.json({ error: "book_file_required" }, { status: 400 });
    try {
      if (item.fileName?.toLowerCase().endsWith(".pdf")) {
        const head = await env.BUCKET.get(item.storageKey!, { range: { offset: 0, length: 5 } });
        if (!head || await head.text() !== "%PDF-") throw new Error("invalid_pdf");
      } else if (item.fileName?.toLowerCase().endsWith(".epub")) {
        const content = extractEpub(new Uint8Array(await object.arrayBuffer()));
        await env.BUCKET.put(`${item.storageKey}.sambu-content.json`, JSON.stringify(content), { httpMetadata: { contentType: "application/json" } });
      } else throw new Error("invalid_file_type");
    } catch {
      return Response.json({ error: "invalid_book_content" }, { status: 422 });
    }
    publishedBookId = item.id;
    mutations.push(db.insert(books).values({
      id: publishedBookId,
      slug: slugify(title, publishedBookId),
      title,
      author,
      genre,
      language,
      isbn: item.isbn,
      freeChapters: 1,
      format: item.fileName?.toLowerCase().endsWith(".pdf") ? "PDF" : "EPUB",
      ageRating: "14",
      description,
      coverKey,
      epubKey: item.storageKey,
      status: "published",
      publishedAt: now,
      createdAt: now,
      updatedAt: now,
    }).onConflictDoNothing({ target: books.id }));
  }
  const status =
    action === "publish"
      ? "published"
      : action === "correction"
        ? "correction_requested"
        : "draft";
  mutations.push(db
    .update(stagingBooks)
    .set({
      title: title || item.title,
      author: author || item.author,
      genre: genre || null,
      language,
      description: description || null,
      licenseType: licenseType || null,
      rightsStatus: rightsConfirmed ? "confirmed" : "review",
      rightsConfirmed,
      coverKey,
      correctionNote: correctionNote || null,
      ...(report?{validationErrors:report.warnings}:{}),
      status,
      reviewedBy: user.email,
      reviewedAt: now,
      publishedBookId,
      updatedAt: now,
    })
    .where(and(eq(stagingBooks.id, id), ne(stagingBooks.status, "published"))));
  await db.batch(mutations as [typeof mutations[number], ...typeof mutations[number][]]);
  return Response.json({ ok: true, status, publishedBookId, report });
}

export async function DELETE(request: Request) {
  const access = await requireAccess("admin");
  if (access.error) return access.error;
  const user = access.user!;
  const db = await getDb();
  const id = new URL(request.url).searchParams.get("id");
  if (id) {
    const [item] = await db
      .select()
      .from(stagingBooks)
      .where(
        and(eq(stagingBooks.id, id), eq(stagingBooks.ownerEmail, user.email)),
      )
      .limit(1);
    if (!item || item.status === "archived") return Response.json({ error: "not_found" }, { status: 404 });
    const references = await db.select({ id: books.id }).from(books).where(or(eq(books.epubKey, item.storageKey || ""), eq(books.coverKey, item.coverKey || ""))).limit(1);
    if (item.publishedBookId || references.length) return Response.json({ error: "published_import_protected" }, { status: 409 });
    await db.update(stagingBooks).set({ status: "archived", updatedAt: new Date().toISOString() }).where(and(eq(stagingBooks.id, id), ne(stagingBooks.status, "published"), isNull(stagingBooks.publishedBookId)));
    return Response.json({ ok: true });
  }
  return Response.json({ error: "bulk_delete_disabled", message: "Remova individualmente as importações não publicadas." }, { status: 409 });
}
