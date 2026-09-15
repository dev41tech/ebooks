import { env } from "cloudflare:workers";
import { requireAccess } from "../../../lib/access";

// Mantém cada requisição abaixo do limite do gateway do Sites. O agrupamento
// posterior recompõe partes válidas de multipart no R2.
const CHUNK_SIZE = 250_000;
const R2_GROUP_SIZE = 21;
const MAX_FILE_SIZE = 250_000_000;
const MAX_PARTS = Math.ceil(MAX_FILE_SIZE / CHUNK_SIZE);

function safeName(value: unknown) {
  return String(value || "ebook")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .slice(-140);
}

function uploadPrefix(owner: string, uploadId: string) {
  const ownerKey = encodeURIComponent(owner.trim().toLowerCase());
  return `direct-uploads/${ownerKey}/${uploadId}`;
}

export async function POST(request: Request) {
  const access = await requireAccess("admin");
  if (access.error) return access.error;
  const user = access.user!;

  const body = (await request.json().catch(() => ({}))) as {
    action?: string;
    uploadId?: string;
    fileName?: string;
    contentType?: string;
    size?: number;
    totalParts?: number;
    part?: number;
    data?: string;
  };

  if (body.action === "init") {
    const fileName = safeName(body.fileName);
    const size = Number(body.size || 0);
    if (!/\.(epub|pdf)$/i.test(fileName))
      return Response.json({ error: "invalid_file_type" }, { status: 400 });
    if (!size || size > MAX_FILE_SIZE || (/\.epub$/i.test(fileName) && size > 32_000_000))
      return Response.json(
        { error: "file_too_large", maxFileSize: MAX_FILE_SIZE },
        { status: 400 },
      );
    return Response.json({
      uploadId: crypto.randomUUID(),
      chunkSize: CHUNK_SIZE,
      maxFileSize: MAX_FILE_SIZE,
    });
  }

  if (body.action === "part") {
    const uploadId = String(body.uploadId || "");
    const part = Number(body.part);
    if (
      !/^[a-f0-9-]{36}$/i.test(uploadId) ||
      !Number.isInteger(part) ||
      part < 0 ||
      part >= MAX_PARTS ||
      typeof body.data !== "string"
    )
      return Response.json({ error: "invalid_part" }, { status: 400 });
    let bytes: Uint8Array;
    try {
      const decoded = atob(body.data);
      bytes = Uint8Array.from(decoded, (character) => character.charCodeAt(0));
    } catch {
      return Response.json({ error: "invalid_part_data" }, { status: 400 });
    }
    if (!bytes.byteLength || bytes.byteLength > CHUNK_SIZE)
      return Response.json({ error: "invalid_chunk_size" }, { status: 400 });
    const key = `${uploadPrefix(user.email, uploadId)}/parts/${part}`;
    await env.BUCKET.put(key, bytes, {
      httpMetadata: { contentType: "application/octet-stream" },
      customMetadata: { owner: user.email, uploadId, part: String(part) },
    });
    return Response.json({ ok: true, part, size: bytes.byteLength });
  }

  if (body.action !== "complete")
    return Response.json({ error: "invalid_action" }, { status: 400 });

  const uploadId = String(body.uploadId || "");
  const totalParts = Number(body.totalParts || 0);
  const expectedSize = Number(body.size || 0);
  const fileName = safeName(body.fileName);
  if (
    !/^[a-f0-9-]{36}$/i.test(uploadId) ||
    totalParts < 1 ||
    totalParts > MAX_PARTS ||
    expectedSize < 1 ||
    expectedSize > MAX_FILE_SIZE ||
    !/\.(epub|pdf)$/i.test(fileName)
  )
    return Response.json({ error: "invalid_upload" }, { status: 400 });

  const completedKey = `imports/direct/${uploadId}-${fileName}`;
  const existing = await env.BUCKET.head(completedKey);
  if (existing && existing.customMetadata?.owner === user.email && existing.size === expectedSize) return Response.json({ok:true,storageKey:completedKey,fileName,contentType:existing.httpMetadata?.contentType||"application/octet-stream",fileSize:existing.size});
  const prefix = uploadPrefix(user.email, uploadId);
  const parts = [];
  let actualSize = 0;
  for (let index = 0; index < totalParts; index++) {
    const object = await env.BUCKET.get(`${prefix}/parts/${index}`);
    if (!object)
      return Response.json(
        { error: "missing_part", part: index },
        { status: 409 },
      );
    actualSize += object.size;
    parts.push(object);
  }
  if (actualSize !== expectedSize)
    return Response.json({ error: "size_mismatch" }, { status: 409 });

  const storageKey = `imports/direct/${uploadId}-${fileName}`;
  let completedSuccessfully = false;
  if (actualSize <= 10_000_000) {
    try {
      const buffers = await Promise.all(parts.map((part) => part.arrayBuffer()));
      await env.BUCKET.put(storageKey, new Blob(buffers), {
        httpMetadata: {
          contentType: fileName.toLowerCase().endsWith(".pdf") ? "application/pdf" : "application/epub+zip",
        },
        customMetadata: {
          owner: user.email,
          uploadId,
          originalName: fileName,
        },
      });
      completedSuccessfully = true;
    } catch (error) {
      console.error("ebook_small_upload_complete_failed", error);
      return Response.json({ error: "storage_complete_failed" }, { status: 500 });
    } finally {
      if (completedSuccessfully) await Promise.all(
        Array.from({ length: totalParts }, (_, index) =>
          env.BUCKET.delete(`${prefix}/parts/${index}`),
        ),
      );
    }
    return Response.json({
      ok: true,
      storageKey,
      fileName,
      contentType: fileName.toLowerCase().endsWith(".pdf") ? "application/pdf" : "application/epub+zip",
      fileSize: actualSize,
    });
  }
  const multipart = await env.BUCKET.createMultipartUpload(storageKey, {
    httpMetadata: {
      contentType: fileName.toLowerCase().endsWith(".pdf") ? "application/pdf" : "application/epub+zip",
    },
    customMetadata: {
      owner: user.email,
      uploadId,
      originalName: fileName,
    },
  });
  try {
    // R2 exige pelo menos 5 MiB por parte, exceto na última. Vinte e um blocos
    // do navegador formam uma parte de 5,25 MB sem carregar o ebook inteiro
    // na memória do Worker.
    const completedParts = [];
    for (let start = 0; start < parts.length; start += R2_GROUP_SIZE) {
      const group = parts.slice(start, start + R2_GROUP_SIZE);
      const buffers = await Promise.all(group.map((part) => part.arrayBuffer()));
      const uploaded = await multipart.uploadPart(
        completedParts.length + 1,
        new Blob(buffers),
      );
      completedParts.push(uploaded);
    }
    await multipart.complete(completedParts);
    completedSuccessfully = true;
  } catch (error) {
    await multipart.abort().catch(() => undefined);
    console.error("ebook_upload_complete_failed", error);
    return Response.json({ error: "storage_complete_failed" }, { status: 500 });
  } finally {
    if (completedSuccessfully) await Promise.all(
      Array.from({ length: totalParts }, (_, index) =>
        env.BUCKET.delete(`${prefix}/parts/${index}`),
      ),
    );
  }
  return Response.json({
    ok: true,
    storageKey,
    fileName,
    contentType: fileName.toLowerCase().endsWith(".pdf") ? "application/pdf" : "application/epub+zip",
    fileSize: actualSize,
  });
}

export async function PUT(request: Request) {
  const access = await requireAccess("admin");
  if (access.error) return access.error;
  const user = access.user!;
  const url = new URL(request.url);
  const uploadId = url.searchParams.get("uploadId") || "";
  const part = Number(url.searchParams.get("part"));
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (
    !/^[a-f0-9-]{36}$/i.test(uploadId) ||
    !Number.isInteger(part) ||
    part < 0 ||
    part >= MAX_PARTS
  )
    return Response.json({ error: "invalid_part" }, { status: 400 });
  if (!contentLength || contentLength > CHUNK_SIZE)
    return Response.json({ error: "invalid_chunk_size" }, { status: 400 });

  const key = `${uploadPrefix(user.email, uploadId)}/parts/${part}`;
  await env.BUCKET.put(key, request.body, {
    httpMetadata: { contentType: "application/octet-stream" },
    customMetadata: { owner: user.email, uploadId, part: String(part) },
  });
  return Response.json({ ok: true, part });
}
