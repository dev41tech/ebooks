// Upload direto de ebook pelo painel administrativo.
//
// Portado da versao Cloudflare: la o arquivo ia para o R2 via multipart de
// env.BUCKET. Aqui o destino e o Supabase Storage, que nao expoe multipart pela
// API REST -- entao as partes sao gravadas como objetos temporarios e unidas no
// "complete". O protocolo visto pelo frontend continua o mesmo (init/part/
// complete), porque o troceamento existe para manter cada requisicao pequena.
import { requireAdmin } from "../../../auth";
import { getObject, putObject, deleteObject } from "../../../../db/storage";

const CHUNK_SIZE = 250_000;
const MAX_FILE_SIZE = 250_000_000;
const MAX_PARTS = Math.ceil(MAX_FILE_SIZE / CHUNK_SIZE);

function safeName(value: unknown) {
  return String(value || "ebook")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .slice(-140);
}

function uploadPrefix(owner: string, uploadId: string) {
  const ownerKey = owner.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 80);
  return `direct-uploads/${ownerKey}/${uploadId}`;
}

export async function POST(request: Request) {
  const { user, error } = await requireAdmin();
  if (error) return error;

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
    if (!/\.(epub|pdf|txt)$/i.test(fileName))
      return Response.json({ error: "invalid_file_type" }, { status: 400 });
    if (!size || size > MAX_FILE_SIZE)
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
    await putObject(
      key,
      new Blob([bytes.buffer as ArrayBuffer]),
      "application/octet-stream",
    );
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
    !/\.(epub|pdf|txt)$/i.test(fileName)
  )
    return Response.json({ error: "invalid_upload" }, { status: 400 });

  const prefix = uploadPrefix(user.email, uploadId);
  const pedacos: ArrayBuffer[] = [];
  let actualSize = 0;

  for (let index = 0; index < totalParts; index++) {
    const object = await getObject(`${prefix}/parts/${index}`);
    if (!object)
      return Response.json({ error: "missing_part", part: index }, { status: 409 });
    const buffer = await object.arrayBuffer();
    actualSize += buffer.byteLength;
    pedacos.push(buffer);
  }

  if (actualSize !== expectedSize)
    return Response.json(
      { error: "size_mismatch", expected: expectedSize, actual: actualSize },
      { status: 409 },
    );

  const storageKey = `${prefix}/${fileName}`;
  await putObject(
    storageKey,
    new Blob(pedacos),
    body.contentType || "application/octet-stream",
  );

  // Limpa as partes; falha aqui nao invalida o upload, que ja foi consolidado.
  await Promise.all(
    Array.from({ length: totalParts }, (_, index) =>
      deleteObject(`${prefix}/parts/${index}`).catch(() => {}),
    ),
  );

  return Response.json({
    ok: true,
    storageKey,
    fileName,
    contentType: body.contentType || "application/octet-stream",
    fileSize: actualSize,
  });
}

export async function PUT(request: Request) {
  const { user, error } = await requireAdmin();
  if (error) return error;

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
  await putObject(key, await request.blob(), "application/octet-stream");
  return Response.json({ ok: true, part });
}
