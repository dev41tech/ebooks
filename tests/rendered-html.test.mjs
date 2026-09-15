import assert from "node:assert/strict";
import test from "node:test";
import { readFile, writeFile, unlink } from "node:fs/promises";

test("renders beta catalog for an unauthenticated visitor", async (t) => {
  // Render the built worker as a visitor; Cloudflare bindings are unavailable in Node.
  const source = await readFile(new URL("../dist/server/index.js", import.meta.url), "utf8");
  const workerUrl = new URL(`../dist/server/render-test-${process.pid}.mjs`, import.meta.url);
  await writeFile(workerUrl, source.replaceAll('"cloudflare:workers"', '"data:text/javascript,export const env = {}"'));
  t.after(() => unlink(workerUrl));
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  const response = await worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );

  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-type") ?? "",
    /^text\/html\b/i,
  );
  const html = await response.text();
  assert.match(html, /<title>Sambu<\/title>/);
  assert.match(html, /Sua próxima história/);
  assert.match(html, /participantes convidados/);
  assert.doesNotMatch(html, /Painel administrativo/);
});
