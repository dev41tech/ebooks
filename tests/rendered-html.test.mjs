import assert from "node:assert/strict";
import test from "node:test";

// Este teste checava a presenca de <meta name="codex-preview" content="development">,
// marca injetada pela plataforma OpenAI Sites de onde o projeto saiu. Como o app
// hoje roda como container Node proprio, aquela tag nunca mais aparece e o teste
// falhava sempre. No lugar, verificamos o que continua valendo: a pagina renderiza
// no servidor com o HTML e os metadados certos.

async function renderizarHome() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  const response = await worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
  return { response, html: await response.text() };
}

test("a home renderiza HTML no servidor", async () => {
  const { response, html } = await renderizarHome();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  assert.match(html, /<html[^>]*\blang=["']pt-BR["']/i);
  assert.match(html, /<title>Sambu<\/title>/i);
});

test("os metadados sociais nao apontam para o dominio antigo", async () => {
  const { html } = await renderizarHome();
  // O projeto saiu de sambu-online.marcosdiascwb.chatgpt.site; se essa URL voltar
  // ao HTML, a previa de link passa a buscar imagem num dominio que nao e nosso.
  assert.doesNotMatch(html, /chatgpt\.site/i);
  assert.match(html, /<meta[^>]+property=["']og:image["'][^>]*>/i);
});
