// Telas de produção de ebooks, portadas do Sambu Ebooks (React+Vite+Express)
// para a stack deste projeto (Next.js/vinext + Postgres).
//
// Escopo desta etapa: as telas e a persistência. A geração por IA em si ainda
// não roda aqui — um Worker não sustenta os minutos de chamadas à OpenAI que um
// livro exige, e o PDF depende de Chromium. Por isso cada envio grava um
// rascunho com status "rascunho" e a tela deixa isso explícito, em vez de
// simular um progresso que não existe.
"use client";

import { useCallback, useEffect, useState } from "react";
import { Field, Icon } from "./ui";

type Painel =
  | "lista"
  | "criar"
  | "referencia"
  | "importar"
  | "revisar"
  | "marketing"
  | "ideias";

type Draft = {
  id: string;
  title: string;
  subtitle: string;
  theme: string;
  category: string;
  origin: string;
  status: string;
  statusMessage: string;
  pageCount: number;
  wordsPerPage: number;
  authorName: string;
  language: string;
  intro: string;
  conclusion: string;
  createdAt: string;
};

type DraftChapter = {
  id: string;
  position: number;
  title: string;
  content: string;
};

const TONES = ["Motivador", "Técnico e direto", "Descontraído", "Formal"];
const LANGUAGES = [
  "Português (Brasil)",
  "Português (Portugal)",
  "Inglês",
  "Espanhol",
];

const PAINEIS: { id: Painel; n: string; label: string }[] = [
  { id: "lista", n: "01", label: "Meus ebooks" },
  { id: "criar", n: "02", label: "Criar com IA" },
  { id: "referencia", n: "03", label: "Técnico / Comportamental" },
  { id: "importar", n: "04", label: "Importar manuscrito" },
  { id: "revisar", n: "05", label: "Revisão" },
  { id: "marketing", n: "06", label: "Marketing" },
  { id: "ideias", n: "07", label: "Ideias de nichos" },
];

function AvisoGeracao() {
  return (
    <div className="backend-note">
      <p>
        <b>Geração ainda não habilitada neste ambiente.</b> O pedido é gravado
        como rascunho e fica na fila. Escrever um livro leva minutos de chamadas
        à IA — mais do que uma requisição do Worker sustenta — então essa etapa
        será ligada junto com a infraestrutura de processamento em segundo plano.
      </p>
    </div>
  );
}

export default function Producao({
  notify,
}: {
  notify: (message: string) => void;
}) {
  const [painel, setPainel] = useState<Painel>("lista");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [selecionado, setSelecionado] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const data = await fetch("/api/studio/ebooks")
      .then((r) => (r.ok ? r.json() : { drafts: [] }))
      .catch(() => ({ drafts: [] }));
    setDrafts(data.drafts || []);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function abrirRevisao(id: string) {
    setSelecionado(id);
    setPainel("revisar");
  }

  async function aoCriar(message: string) {
    notify(message);
    await carregar();
    setPainel("lista");
  }

  return (
    <main className="page studio">
      <div className="page-title row">
        <div>
          <p className="eyebrow coral">SAMBU STUDIO · PRODUÇÃO</p>
          <h1>Produza seu próximo ebook</h1>
          <p>
            Crie com IA, escreva a partir de um material de referência ou importe
            um manuscrito pronto — e revise tudo antes de publicar no catálogo.
          </p>
        </div>
        <div>
          <button className="primary" onClick={() => setPainel("criar")}>
            <Icon name="spark" /> Criar novo ebook
          </button>
        </div>
      </div>

      <div className="studio-layout">
        <aside className="step-nav">
          {PAINEIS.map((p) => (
            <button
              key={p.id}
              className={painel === p.id ? "active" : ""}
              onClick={() => setPainel(p.id)}
            >
              <span>{p.n}</span>
              {p.label}
            </button>
          ))}
        </aside>

        <section className="panel studio-panel">
          {painel === "lista" && (
            <Lista
              drafts={drafts}
              abrirRevisao={abrirRevisao}
              recarregar={carregar}
              notify={notify}
              criar={() => setPainel("criar")}
            />
          )}
          {painel === "criar" && <FormularioIA aoCriar={aoCriar} />}
          {painel === "referencia" && <FormularioReferencia aoCriar={aoCriar} />}
          {painel === "importar" && <FormularioImportacao aoCriar={aoCriar} />}
          {painel === "revisar" && (
            <Revisao
              draftId={selecionado}
              drafts={drafts}
              selecionar={setSelecionado}
              notify={notify}
            />
          )}
          {painel === "marketing" && (
            <Marketing
              draftId={selecionado}
              drafts={drafts}
              selecionar={setSelecionado}
            />
          )}
          {painel === "ideias" && <Ideias />}
        </section>
      </div>
    </main>
  );
}

function Lista({
  drafts,
  abrirRevisao,
  recarregar,
  notify,
  criar,
}: {
  drafts: Draft[];
  abrirRevisao: (id: string) => void;
  recarregar: () => Promise<void>;
  notify: (m: string) => void;
  criar: () => void;
}) {
  async function excluir(id: string) {
    await fetch(`/api/studio/ebooks?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    notify("Rascunho excluído");
    await recarregar();
  }

  if (drafts.length === 0) {
    return (
      <>
        <div className="panel-head">
          <h2>Meus ebooks</h2>
        </div>
        <div className="empty-import">
          <p>Você ainda não tem nenhum ebook em produção.</p>
          <button className="primary" onClick={criar}>
            Criar o primeiro
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="panel-head">
        <h2>Meus ebooks</h2>
        <span>{drafts.length} em produção</span>
      </div>
      <div className="staged-books">
        <table>
          <thead>
            <tr>
              <th>Título</th>
              <th>Tema</th>
              <th>Origem</th>
              <th>Páginas</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {drafts.map((d) => (
              <tr key={d.id}>
                <td>
                  <b>{d.title || "Sem título (a IA vai gerar)"}</b>
                  {d.subtitle && <small>{d.subtitle}</small>}
                </td>
                <td>{d.theme}</td>
                <td>
                  {d.origin === "importado"
                    ? "Manuscrito"
                    : d.origin === "referencia"
                      ? "Com referência"
                      : "IA"}
                </td>
                <td>{d.pageCount}</td>
                <td>
                  {/* reaproveita as cores de pill que o admin já usa */}
                  <span
                    className={`status-pill ${
                      d.status === "rascunho" ? "draft" : d.status
                    }`}
                  >
                    {d.status}
                  </span>
                </td>
                <td>
                  <button
                    className="table-action"
                    onClick={() => abrirRevisao(d.id)}
                  >
                    Revisar
                  </button>
                  <button className="danger-link" onClick={() => excluir(d.id)}>
                    Excluir
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

async function enviarRascunho(payload: Record<string, unknown>) {
  const response = await fetch("/api/studio/ebooks", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = (await response.json().catch(() => ({}))) as {
    error?: string;
    id?: string;
  };
  if (!response.ok) {
    const motivos: Record<string, string> = {
      theme_required: "Informe o tema / nicho do ebook.",
      invalid_page_count: "Número de páginas deve estar entre 1 e 1000.",
      invalid_words_per_page: "Palavras por página deve estar entre 150 e 500.",
      reference_required: "Cole o material de referência para este tipo de ebook.",
      sign_in_required: "Entre na sua conta para criar um ebook.",
    };
    throw new Error(motivos[data.error || ""] || "Não foi possível salvar.");
  }
  return data.id as string;
}

function CamposComuns({
  pageCount,
  setPageCount,
  wordsPerPage,
  setWordsPerPage,
  tone,
  setTone,
  language,
  setLanguage,
  titleMode,
  setTitleMode,
  title,
  setTitle,
  subtitle,
  setSubtitle,
  extraInstructions,
  setExtraInstructions,
  authorName,
  setAuthorName,
}: {
  pageCount: number;
  setPageCount: (n: number) => void;
  wordsPerPage: number;
  setWordsPerPage: (n: number) => void;
  tone: string;
  setTone: (s: string) => void;
  language: string;
  setLanguage: (s: string) => void;
  titleMode: "ai" | "manual";
  setTitleMode: (s: "ai" | "manual") => void;
  title: string;
  setTitle: (s: string) => void;
  subtitle: string;
  setSubtitle: (s: string) => void;
  extraInstructions: string;
  setExtraInstructions: (s: string) => void;
  authorName: string;
  setAuthorName: (s: string) => void;
}) {
  return (
    <>
      <div className="form-grid">
        <Field label="Tom de voz" name="tone">
          <select value={tone} onChange={(e) => setTone(e.target.value)}>
            {TONES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
        <Field label="Idioma" name="language">
          <select value={language} onChange={(e) => setLanguage(e.target.value)}>
            {LANGUAGES.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </Field>
      </div>

      <div className="setting-card">
        <p>Título do ebook</p>
        <div className="choice-chips">
          <button
            type="button"
            className={titleMode === "ai" ? "selected" : ""}
            onClick={() => setTitleMode("ai")}
          >
            Deixar a IA gerar
          </button>
          <button
            type="button"
            className={titleMode === "manual" ? "selected" : ""}
            onClick={() => setTitleMode("manual")}
          >
            Escrever meu próprio título
          </button>
        </div>
        {titleMode === "manual" && (
          <div className="form-grid">
            <Field label="Título" name="title">
              <input
                value={title}
                maxLength={120}
                onChange={(e) => setTitle(e.target.value)}
              />
            </Field>
            <Field label="Subtítulo (opcional)" name="subtitle">
              <input
                value={subtitle}
                maxLength={160}
                onChange={(e) => setSubtitle(e.target.value)}
              />
            </Field>
          </div>
        )}
      </div>

      <Field
        label="Instrução extra para este ebook (opcional)"
        name="extra_instructions"
      >
        <textarea
          rows={2}
          maxLength={1000}
          value={extraInstructions}
          onChange={(e) => setExtraInstructions(e.target.value)}
          placeholder="Ex.: dê ênfase à parte prática, use exemplos brasileiros, evite um tom acadêmico…"
        />
      </Field>

      <div className="form-grid">
        <Field
          label="Número de páginas"
          name="page_count"
          hint="Mínimo 1, máximo 1000 páginas."
        >
          <input
            type="number"
            min={1}
            max={1000}
            value={pageCount}
            onChange={(e) => setPageCount(Number(e.target.value))}
          />
        </Field>
        <Field
          label="Palavras por página"
          name="words_per_page"
          hint="Mínimo 150, máximo 500 palavras."
        >
          <input
            type="number"
            min={150}
            max={500}
            step={10}
            value={wordsPerPage}
            onChange={(e) => setWordsPerPage(Number(e.target.value))}
          />
        </Field>
      </div>

      <Field label="Autor (opcional)" name="author_name">
        <input
          value={authorName}
          maxLength={120}
          onChange={(e) => setAuthorName(e.target.value)}
          placeholder="Nome do autor"
        />
      </Field>
    </>
  );
}

function useCamposComuns() {
  const [pageCount, setPageCount] = useState(20);
  const [wordsPerPage, setWordsPerPage] = useState(250);
  const [tone, setTone] = useState(TONES[0]);
  const [language, setLanguage] = useState(LANGUAGES[0]);
  const [titleMode, setTitleMode] = useState<"ai" | "manual">("ai");
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [extraInstructions, setExtraInstructions] = useState("");
  const [authorName, setAuthorName] = useState("");
  return {
    props: {
      pageCount,
      setPageCount,
      wordsPerPage,
      setWordsPerPage,
      tone,
      setTone,
      language,
      setLanguage,
      titleMode,
      setTitleMode,
      title,
      setTitle,
      subtitle,
      setSubtitle,
      extraInstructions,
      setExtraInstructions,
      authorName,
      setAuthorName,
    },
    payload: {
      pageCount,
      wordsPerPage,
      tone,
      language,
      title: titleMode === "manual" ? title : "",
      subtitle: titleMode === "manual" ? subtitle : "",
      extraInstructions,
      authorName,
    },
  };
}

function FormularioIA({ aoCriar }: { aoCriar: (m: string) => Promise<void> }) {
  const [theme, setTheme] = useState("");
  const [audience, setAudience] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const comuns = useCamposComuns();

  async function submeter(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setErro(null);
    try {
      await enviarRascunho({ ...comuns.payload, origin: "ia", theme, audience });
      await aoCriar("Ebook criado e aguardando geração");
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao salvar.");
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={submeter}>
      <div className="panel-head">
        <h2>Criar novo ebook com IA</h2>
      </div>
      <AvisoGeracao />
      <Field label="Tema / Nicho" name="theme" required>
        <input
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          placeholder="ex: emagrecimento"
          required
        />
      </Field>
      <Field label="Público-alvo" name="audience">
        <textarea
          rows={2}
          value={audience}
          onChange={(e) => setAudience(e.target.value)}
          placeholder="ex: mulheres depois dos 40 anos"
        />
      </Field>
      <CamposComuns {...comuns.props} />
      {erro && <p className="login-error">{erro}</p>}
      <div className="form-actions">
        <button className="primary" type="submit" disabled={enviando}>
          {enviando ? "Salvando…" : "Salvar e enviar para geração"}
        </button>
      </div>
    </form>
  );
}

function FormularioReferencia({
  aoCriar,
}: {
  aoCriar: (m: string) => Promise<void>;
}) {
  const [categoria, setCategoria] = useState<"tecnico" | "comportamental">(
    "tecnico",
  );
  const [theme, setTheme] = useState("");
  const [audience, setAudience] = useState("");
  const [material, setMaterial] = useState("");
  const [fonte, setFonte] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const comuns = useCamposComuns();

  async function submeter(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setErro(null);
    try {
      await enviarRascunho({
        ...comuns.payload,
        origin: "referencia",
        category: categoria,
        theme,
        audience,
        referenceMaterial: material,
        referenceSource: fonte,
      });
      await aoCriar("Ebook criado e aguardando geração");
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao salvar.");
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={submeter}>
      <div className="panel-head">
        <h2>Ebook técnico ou comportamental</h2>
      </div>
      <p className="commercial-intro">
        Cole a documentação, manual, artigo ou estudo que o ebook deve seguir
        como fonte. A IA escreve em cima desse material, sem inventar dados.
      </p>
      <AvisoGeracao />

      <div className="setting-card">
        <p>Tipo de ebook</p>
        <div className="choice-chips">
          <button
            type="button"
            className={categoria === "tecnico" ? "selected" : ""}
            onClick={() => setCategoria("tecnico")}
          >
            Técnico
          </button>
          <button
            type="button"
            className={categoria === "comportamental" ? "selected" : ""}
            onClick={() => setCategoria("comportamental")}
          >
            Comportamental
          </button>
        </div>
      </div>

      <Field
        label="Material de referência"
        name="reference_material"
        required
        hint={`${material.length} caracteres de material de referência.`}
      >
        <textarea
          rows={8}
          value={material}
          onChange={(e) => setMaterial(e.target.value)}
          placeholder="Cole aqui o texto da documentação, manual, artigo ou estudo…"
          required
        />
      </Field>
      <Field label="Origem do material (opcional)" name="reference_source">
        <input
          value={fonte}
          onChange={(e) => setFonte(e.target.value)}
          placeholder="Link, nome do documento ou norma de origem"
        />
      </Field>
      <Field label="Tema / Nicho" name="theme" required>
        <input
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          required
        />
      </Field>
      <Field label="Público-alvo" name="audience">
        <textarea
          rows={2}
          value={audience}
          onChange={(e) => setAudience(e.target.value)}
        />
      </Field>
      <CamposComuns {...comuns.props} />
      {erro && <p className="login-error">{erro}</p>}
      <div className="form-actions">
        <button className="primary" type="submit" disabled={enviando}>
          {enviando ? "Salvando…" : "Salvar e enviar para geração"}
        </button>
      </div>
    </form>
  );
}

function FormularioImportacao({
  aoCriar,
}: {
  aoCriar: (m: string) => Promise<void>;
}) {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [conteudo, setConteudo] = useState("");
  const [title, setTitle] = useState("");
  const [theme, setTheme] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [language, setLanguage] = useState(LANGUAGES[0]);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // .txt e .md são lidos aqui mesmo; .pdf e .epub precisam de extração no
  // servidor, que entra junto com a etapa de geração.
  async function escolher(file: File | null) {
    setArquivo(file);
    setConteudo("");
    setErro(null);
    if (!file) return;
    const nome = file.name.toLowerCase();
    if (nome.endsWith(".txt") || nome.endsWith(".md")) {
      setConteudo(await file.text());
    }
  }

  async function submeter(e: React.FormEvent) {
    e.preventDefault();
    if (!arquivo) return;
    setEnviando(true);
    setErro(null);
    try {
      const id = await enviarRascunho({
        origin: "importado",
        theme: theme || title || arquivo.name,
        title,
        language,
        authorName,
        sourceFileName: arquivo.name,
        pageCount: Math.max(
          1,
          Math.round(conteudo.split(/\s+/).filter(Boolean).length / 250) || 20,
        ),
      });
      // Manuscrito em texto puro já pode virar capítulos sem passar pela IA:
      // quebramos pelos títulos de capítulo do próprio arquivo.
      if (conteudo.trim()) {
        for (const [i, cap] of dividirCapitulos(conteudo).entries()) {
          await fetch("/api/studio/chapters", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              draftId: id,
              position: i,
              title: cap.title,
              content: cap.content,
            }),
          });
        }
      }
      await aoCriar("Manuscrito importado");
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao importar.");
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={submeter}>
      <div className="panel-head">
        <h2>Importar manuscrito</h2>
      </div>
      <p className="commercial-intro">
        Envie um arquivo com o texto já escrito. A IA não é usada para escrever —
        você revisa e publica. Use esta tela só para manuscrito pronto; se o que
        você tem é um roteiro do que o livro deve conter, use{" "}
        <b>Técnico / Comportamental</b>.
      </p>

      <Field
        label="Arquivo do ebook"
        name="file"
        required
        hint="Aceita .txt, .md, .pdf ou .epub. Títulos de capítulo (ex.: “# Capítulo 1”) são reconhecidos automaticamente."
      >
        <input
          type="file"
          accept=".txt,.md,.pdf,.epub"
          required
          onChange={(e) => escolher(e.target.files?.[0] ?? null)}
        />
      </Field>

      {arquivo && !conteudo && (
        <div className="backend-note">
          <p>
            <b>{arquivo.name}</b> — a extração de texto de PDF e EPUB roda no
            servidor e entra junto com a etapa de geração. O registro é criado
            agora e o conteúdo é anexado quando essa etapa for ligada.
          </p>
        </div>
      )}
      {conteudo && (
        <div className="import-summary">
          <p>
            <b>{arquivo?.name}</b> — {dividirCapitulos(conteudo).length}{" "}
            capítulo(s) reconhecido(s),{" "}
            {conteudo.split(/\s+/).filter(Boolean).length} palavras.
          </p>
        </div>
      )}

      <Field label="Título do ebook" name="title">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Se deixar em branco, usamos o nome do arquivo"
        />
      </Field>
      <div className="form-grid">
        <Field label="Tema / Nicho (opcional)" name="theme">
          <input value={theme} onChange={(e) => setTheme(e.target.value)} />
        </Field>
        <Field label="Idioma" name="language">
          <select value={language} onChange={(e) => setLanguage(e.target.value)}>
            {LANGUAGES.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Autor (opcional)" name="author_name">
        <input
          value={authorName}
          onChange={(e) => setAuthorName(e.target.value)}
        />
      </Field>

      {erro && <p className="login-error">{erro}</p>}
      <div className="form-actions">
        <button className="primary" type="submit" disabled={!arquivo || enviando}>
          {enviando ? "Importando…" : "Importar e continuar"}
        </button>
      </div>
    </form>
  );
}

// Mesma heurística do Sambu Ebooks: cabeçalhos markdown (# / ##) e marcadores de
// texto puro ("Capítulo 3", "Chapter 3: ..."). Sem cabeçalho, o texto inteiro
// vira um capítulo só para o autor dividir na revisão.
const LINHA_CAPITULO =
  /^(?:#{1,2}\s+(.+)|cap[íi]tulo\s+\d+\s*[:.\-–]?\s*(.*)|chapter\s+\d+\s*[:.\-–]?\s*(.*))$/i;

function dividirCapitulos(texto: string): { title: string; content: string }[] {
  const linhas = texto.replace(/\r\n/g, "\n").split("\n");
  const secoes: { title: string; content: string }[] = [];
  let atual: { title: string; content: string } | null = null;

  for (const linha of linhas) {
    const t = linha.trim();
    const m = t ? t.match(LINHA_CAPITULO) : null;
    if (m) {
      if (atual) secoes.push(atual);
      atual = { title: (m[1] || m[2] || m[3] || t).trim() || t, content: "" };
    } else if (atual) {
      atual.content += linha + "\n";
    } else if (t) {
      atual = { title: "Capítulo 1", content: linha + "\n" };
    }
  }
  if (atual) secoes.push(atual);
  return secoes
    .map((s) => ({ title: s.title, content: s.content.trim() }))
    .filter((s) => s.content);
}

function SeletorDeRascunho({
  drafts,
  draftId,
  selecionar,
}: {
  drafts: Draft[];
  draftId: string | null;
  selecionar: (id: string) => void;
}) {
  return (
    <Field label="Ebook" name="draft_id">
      <select
        value={draftId ?? ""}
        onChange={(e) => selecionar(e.target.value)}
      >
        <option value="">Selecione um ebook…</option>
        {drafts.map((d) => (
          <option key={d.id} value={d.id}>
            {d.title || d.theme}
          </option>
        ))}
      </select>
    </Field>
  );
}

function Revisao({
  draftId,
  drafts,
  selecionar,
  notify,
}: {
  draftId: string | null;
  drafts: Draft[];
  selecionar: (id: string) => void;
  notify: (m: string) => void;
}) {
  const [capitulos, setCapitulos] = useState<DraftChapter[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);

  useEffect(() => {
    if (!draftId) {
      setCapitulos([]);
      setDraft(null);
      return;
    }
    fetch(`/api/studio/ebooks?id=${encodeURIComponent(draftId)}`)
      .then((r) => (r.ok ? r.json() : { draft: null, chapters: [] }))
      .then((d) => {
        setDraft(d.draft ?? null);
        setCapitulos(d.chapters || []);
      })
      .catch(() => {});
  }, [draftId]);

  async function salvarCapitulo(cap: DraftChapter) {
    await fetch(`/api/studio/chapters?id=${encodeURIComponent(cap.id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: cap.title, content: cap.content }),
    });
    notify("Capítulo salvo");
  }

  return (
    <>
      <div className="panel-head">
        <h2>Revisão</h2>
      </div>
      <SeletorDeRascunho
        drafts={drafts}
        draftId={draftId}
        selecionar={selecionar}
      />

      {draft && (
        <div className="review-audit">
          <p>
            <b>{draft.title || "Sem título"}</b> — {draft.theme} ·{" "}
            {draft.pageCount} páginas · {draft.language}
          </p>
          {draft.statusMessage && <p>{draft.statusMessage}</p>}
        </div>
      )}

      {draftId && capitulos.length === 0 && (
        <div className="empty-import">
          <p>
            Este ebook ainda não tem capítulos. Eles aparecem aqui quando a
            geração rodar, ou quando você importar um manuscrito em .txt/.md.
          </p>
        </div>
      )}

      {capitulos.length > 0 && (
        <div className="chapter-list">
          {capitulos.map((cap) => (
            <div key={cap.id} className="setting-card">
              <button
                type="button"
                className="row"
                onClick={() => setAberto(aberto === cap.id ? null : cap.id)}
              >
                <span className="chapter-no">
                  {String(cap.position + 1).padStart(2, "0")}
                </span>
                <b>{cap.title}</b>
              </button>
              {aberto === cap.id && (
                <>
                  <Field label="Título do capítulo" name="chapter_title">
                    <input
                      value={cap.title}
                      onChange={(e) =>
                        setCapitulos((c) =>
                          c.map((x) =>
                            x.id === cap.id
                              ? { ...x, title: e.target.value }
                              : x,
                          ),
                        )
                      }
                    />
                  </Field>
                  <Field label="Conteúdo" name="chapter_content">
                    <textarea
                      rows={14}
                      value={cap.content}
                      onChange={(e) =>
                        setCapitulos((c) =>
                          c.map((x) =>
                            x.id === cap.id
                              ? { ...x, content: e.target.value }
                              : x,
                          ),
                        )
                      }
                    />
                  </Field>
                  <div className="form-actions">
                    <button
                      className="primary"
                      type="button"
                      onClick={() => salvarCapitulo(cap)}
                    >
                      Salvar capítulo
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function Marketing({
  draftId,
  drafts,
  selecionar,
}: {
  draftId: string | null;
  drafts: Draft[];
  selecionar: (id: string) => void;
}) {
  const draft = drafts.find((d) => d.id === draftId) ?? null;
  return (
    <>
      <div className="panel-head">
        <h2>Marketing e vendas</h2>
      </div>
      <p className="commercial-intro">
        Posicionamento, persona, descrição comercial, sequência de e-mails e
        plano de lançamento gerados a partir do conteúdo do ebook.
      </p>
      <SeletorDeRascunho
        drafts={drafts}
        draftId={draftId}
        selecionar={selecionar}
      />
      {draft && (
        <div className="review-audit">
          <p>
            <b>{draft.title || draft.theme}</b> — público:{" "}
            {draft.authorName || "não informado"}
          </p>
        </div>
      )}
      <AvisoGeracao />
    </>
  );
}

function Ideias() {
  return (
    <>
      <div className="panel-head">
        <h2>Ideias de nichos</h2>
      </div>
      <p className="commercial-intro">
        Sugestões de nichos e temas com potencial de venda, a partir do que já
        existe no seu acervo e do que o público procura.
      </p>
      <AvisoGeracao />
    </>
  );
}
