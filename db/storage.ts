export type StoredObject = {
  body: ReadableStream<Uint8Array>;
  contentType: string | null;
  arrayBuffer(): Promise<ArrayBuffer>;
};

function config() {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_STORAGE_BUCKET } =
    process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "Supabase Storage nao configurado. Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente.",
    );
  }
  return {
    url: SUPABASE_URL.replace(/\/+$/, ""),
    key: SUPABASE_SERVICE_ROLE_KEY,
    bucket: SUPABASE_STORAGE_BUCKET || "sambu",
  };
}

function objectUrl(bucket: string, base: string, key: string) {
  const path = key.split("/").map(encodeURIComponent).join("/");
  return `${base}/storage/v1/object/${bucket}/${path}`;
}

export async function getObject(key: string): Promise<StoredObject | null> {
  const { url, key: token, bucket } = config();
  const response = await fetch(objectUrl(bucket, url, key), {
    headers: { authorization: `Bearer ${token}` },
  });
  if (response.status === 404 || response.status === 400) return null;
  if (!response.ok || !response.body) {
    throw new Error(`Supabase Storage GET ${key} falhou: ${response.status}`);
  }
  return {
    body: response.body,
    contentType: response.headers.get("content-type"),
    arrayBuffer: () => response.arrayBuffer(),
  };
}

export async function putObject(
  key: string,
  body: Blob,
  contentType: string,
): Promise<void> {
  const { url, key: token, bucket } = config();
  const response = await fetch(objectUrl(bucket, url, key), {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": contentType || "application/octet-stream",
      "x-upsert": "true",
    },
    body,
  });
  if (!response.ok) {
    throw new Error(
      `Supabase Storage PUT ${key} falhou: ${response.status} ${await response.text()}`,
    );
  }
}

export async function deleteObject(key: string): Promise<void> {
  const { url, key: token, bucket } = config();
  const response = await fetch(objectUrl(bucket, url, key), {
    method: "DELETE",
    headers: { authorization: `Bearer ${token}` },
  });
  if (!response.ok && response.status !== 404) {
    throw new Error(`Supabase Storage DELETE ${key} falhou: ${response.status}`);
  }
}
