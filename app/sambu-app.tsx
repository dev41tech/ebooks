"use client";

import { useEffect, useMemo, useState } from "react";

type User = { name: string; email: string } | null;
type View =
  | "home"
  | "catalog"
  | "library"
  | "detail"
  | "reader"
  | "plans"
  | "profile"
  | "studio"
  | "admin";
type Chapter = {
  id: string;
  number: number;
  title: string;
  minutes: number;
  free: boolean;
  body: string[];
};
type Book = {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  author: string;
  authorId: string;
  genre: string;
  trope: string;
  format: string;
  ageRating: string;
  language: string;
  blurb: string;
  score: number;
  ratings: number;
  reads: string;
  progress: number;
  color: string;
  accent: string;
  status: string;
  price: number;
  subscribersOnly: boolean;
  tags: string[];
  chapters: Chapter[];
  contentLoaded?: boolean;
  freeChapters?: number;
  coverUrl?: string;
};

const MOOD_FILTERS = [
  { label: "Quero me apaixonar", icon: "♥", genre: "Romance", query: "" },
  { label: "Preciso recomeçar", icon: "↻", genre: "Todos", query: "recomeço" },
  { label: "Uma história intensa", icon: "⚡", genre: "Suspense", query: "" },
  { label: "Leitura leve", icon: "☀", genre: "Contemporâneo", query: "" },
] as const;

const CURATED_COVERS: Record<string, string> = {
  "abd7c45b-3bce-49a5-9721-472aaf7a1a9a":
    "/covers/alcoolismo-marcos-dias.png",
};

function coverUrlFor(bookId: string) {
  return (
    CURATED_COVERS[bookId] ||
    `/api/catalog/cover?id=${encodeURIComponent(bookId)}`
  );
}

const BOOKS: Book[] = [
  {
    id: "mar-de-dentro",
    slug: "o-mar-de-dentro",
    title: "O Mar de Dentro",
    subtitle: "Às vezes, voltar é a única forma de seguir",
    author: "Lia Montenegro",
    authorId: "aut_001",
    genre: "Romance",
    trope: "Recomeços",
    format: "Série",
    ageRating: "14",
    language: "pt-BR",
    blurb:
      "Aos quarenta, Marina retorna à ilha onde aprendeu a ir embora — e encontra uma carta que muda a história de sua família.",
    score: 4.9,
    ratings: 2384,
    reads: "12,4 mil",
    progress: 38,
    color: "#173d3a",
    accent: "#f0bf8d",
    status: "Publicado",
    price: 24.9,
    subscribersOnly: false,
    tags: ["recomeço", "família", "ilha"],
    chapters: [
      {
        id: "cap_001",
        number: 1,
        title: "O retorno",
        minutes: 8,
        free: true,
        body: [
          "A ilha aparecia devagar, recortada pela manhã como uma lembrança que ainda não decidira se queria voltar. Marina apoiou a testa no vidro do ferry e contou as casas brancas no morro.",
          "Havia vinte anos que não fazia aquele caminho. Ainda assim, seu corpo reconheceu primeiro: o cheiro de sal, o balanço curto, o sino do porto.",
        ],
      },
      {
        id: "cap_002",
        number: 2,
        title: "A carta",
        minutes: 7,
        free: true,
        body: [
          "A chave estava sob o vaso azul, exatamente onde sua mãe dizia que esconder chaves era o mesmo que não escondê-las.",
          "Sobre a mesa, uma carta levava apenas seu nome — Marina — na caligrafia inclinada do pai.",
        ],
      },
      {
        id: "cap_003",
        number: 3,
        title: "O farol",
        minutes: 9,
        free: false,
        body: [
          "O farol acendeu antes do pôr do sol. Na ilha, aquele era sempre um aviso.",
        ],
      },
    ],
  },
  {
    id: "arquivo-das-estrelas",
    slug: "arquivo-das-estrelas",
    title: "O Arquivo das Estrelas",
    subtitle: "Toda memória deixa uma constelação",
    author: "Caio Sambre",
    authorId: "aut_002",
    genre: "Fantasia",
    trope: "Segredo ancestral",
    format: "Ebook + áudio",
    ageRating: "12",
    language: "pt-BR",
    blurb:
      "Uma arquivista descobre que cada constelação guarda uma memória proibida do seu povo.",
    score: 4.8,
    ratings: 1621,
    reads: "9,8 mil",
    progress: 0,
    color: "#2b2343",
    accent: "#d7b3ff",
    status: "Publicado",
    price: 19.9,
    subscribersOnly: true,
    tags: ["magia", "mistério", "aventura"],
    chapters: [
      {
        id: "cap_101",
        number: 1,
        title: "Lume",
        minutes: 10,
        free: true,
        body: [
          "Na cidade de Lume, as estrelas eram catalogadas antes de receberem nomes.",
          "Íris sabia o número de cada uma, mas nunca ousara perguntar quem decidia quais memórias seriam apagadas.",
        ],
      },
    ],
  },
  {
    id: "sete-minutos",
    slug: "sete-minutos",
    title: "Sete Minutos",
    subtitle: "O relógio para. O crime começa.",
    author: "Nina Valença",
    authorId: "aut_003",
    genre: "Suspense",
    trope: "Tempo limitado",
    format: "Série imersiva",
    ageRating: "16",
    language: "pt-BR",
    blurb:
      "Toda noite, às 02h17, o relógio para. Clara tem sete minutos para impedir um crime que ainda não aconteceu.",
    score: 4.7,
    ratings: 918,
    reads: "7,1 mil",
    progress: 0,
    color: "#542a2c",
    accent: "#ffb099",
    status: "Publicado",
    price: 29.9,
    subscribersOnly: true,
    tags: ["crime", "tempo", "mistério"],
    chapters: [
      {
        id: "cap_201",
        number: 1,
        title: "02h17",
        minutes: 7,
        free: true,
        body: [
          "O primeiro silêncio aconteceu às duas e dezessete.",
          "Não foi ausência de ruído, mas a sensação de que o mundo inteiro prendia a respiração.",
        ],
      },
    ],
  },
  {
    id: "cafeteria-domingo",
    slug: "a-cafeteria-de-domingo",
    title: "A Cafeteria de Domingo",
    subtitle: "Ninguém toma café sozinho",
    author: "Tomás Rios",
    authorId: "aut_004",
    genre: "Contemporâneo",
    trope: "Found family",
    format: "Ebook",
    ageRating: "Livre",
    language: "pt-BR",
    blurb:
      "Cinco desconhecidos, uma mesa compartilhada e a coragem de começar de novo.",
    score: 4.6,
    ratings: 773,
    reads: "5,6 mil",
    progress: 72,
    color: "#65442c",
    accent: "#ffd3a3",
    status: "Publicado",
    price: 14.9,
    subscribersOnly: false,
    tags: ["amizade", "café", "acolhimento"],
    chapters: [
      {
        id: "cap_301",
        number: 1,
        title: "Mesa seis",
        minutes: 6,
        free: true,
        body: [
          "A mesa seis tinha cinco cadeiras incompatíveis e uma regra escrita a giz: aos domingos, ninguém toma café sozinho.",
        ],
      },
    ],
  },
  {
    id: "codigo-aurora",
    slug: "codigo-aurora",
    title: "Código Aurora",
    subtitle: "A última mensagem da Terra",
    author: "Yara Nascimento",
    authorId: "aut_005",
    genre: "Ficção científica",
    trope: "Rivais aliados",
    format: "Audiobook",
    ageRating: "14",
    language: "pt-BR",
    blurb:
      "Dois pesquisadores rivais precisam decifrar a última mensagem enviada pela Terra.",
    score: 4.8,
    ratings: 1104,
    reads: "8,2 mil",
    progress: 0,
    color: "#19344d",
    accent: "#88dce8",
    status: "Publicado",
    price: 27.9,
    subscribersOnly: true,
    tags: ["espaço", "futuro", "rivals"],
    chapters: [
      {
        id: "cap_401",
        number: 1,
        title: "A mensagem",
        minutes: 11,
        free: true,
        body: [
          "A mensagem levou oito anos para chegar e apenas três segundos para destruir todas as certezas de Aurora.",
        ],
      },
    ],
  },
  {
    id: "depois-da-chuva",
    slug: "depois-da-chuva",
    title: "Depois da Chuva",
    subtitle: "Toda despedida deixa uma janela aberta",
    author: "Helena Prado",
    authorId: "aut_006",
    genre: "Romance",
    trope: "Segunda chance",
    format: "Ebook + áudio",
    ageRating: "14",
    language: "pt-BR",
    blurb:
      "Uma fotógrafa retorna a Curitiba para vender a casa da família e reencontra o amor que deixou esperando.",
    score: 4.9,
    ratings: 684,
    reads: "4,7 mil",
    progress: 0,
    color: "#3d2949",
    accent: "#f47fb6",
    status: "Publicado",
    price: 22.9,
    subscribersOnly: true,
    tags: ["segunda chance", "Curitiba", "família"],
    chapters: [
      {
        id: "cap_501",
        number: 1,
        title: "A casa vazia",
        minutes: 8,
        free: true,
        body: [
          "A chuva desenhava caminhos no vidro quando Elisa reconheceu a rua onde aprendera a partir.",
        ],
      },
    ],
  },
  {
    id: "cartas-para-mim",
    slug: "cartas-para-mim",
    title: "Cartas Para Mim",
    subtitle: "A mulher que você será já conhece o caminho",
    author: "Beatriz Luz",
    authorId: "aut_007",
    genre: "Contemporâneo",
    trope: "Autodescoberta",
    format: "Ebook",
    ageRating: "Livre",
    language: "pt-BR",
    blurb:
      "Aos cinquenta, Clara encontra cartas que escreveu para si mesma durante três décadas.",
    score: 4.8,
    ratings: 591,
    reads: "4,1 mil",
    progress: 0,
    color: "#6a3048",
    accent: "#ffc36e",
    status: "Publicado",
    price: 17.9,
    subscribersOnly: false,
    tags: ["autoestima", "maturidade", "recomeço"],
    chapters: [
      {
        id: "cap_601",
        number: 1,
        title: "A caixa",
        minutes: 7,
        free: true,
        body: [
          "A caixa estava no alto do armário, atrás dos vestidos que Clara já não usava.",
        ],
      },
    ],
  },
  {
    id: "jardim-inverno",
    slug: "jardim-de-inverno",
    title: "Jardim de Inverno",
    subtitle: "Algumas sementes esperam anos",
    author: "Maya Torres",
    authorId: "aut_008",
    genre: "Romance",
    trope: "Amor maduro",
    format: "Série",
    ageRating: "14",
    language: "pt-BR",
    blurb:
      "Duas vidas interrompidas se encontram num curso de jardinagem e descobrem que ainda há tempo.",
    score: 4.7,
    ratings: 488,
    reads: "3,8 mil",
    progress: 0,
    color: "#25443a",
    accent: "#d8db75",
    status: "Publicado",
    price: 19.9,
    subscribersOnly: true,
    tags: ["amor maduro", "bem-estar", "natureza"],
    chapters: [
      {
        id: "cap_701",
        number: 1,
        title: "Terra nova",
        minutes: 9,
        free: true,
        body: [
          "Teresa não acreditava em recomeços, mas acreditava em terra bem cuidada.",
        ],
      },
    ],
  },
  {
    id: "entre-linhas",
    slug: "entre-linhas",
    title: "Entre Linhas",
    subtitle: "O segredo mora no que não foi escrito",
    author: "Sofia Brandão",
    authorId: "aut_009",
    genre: "Suspense",
    trope: "Segredo de família",
    format: "Série imersiva",
    ageRating: "16",
    language: "pt-BR",
    blurb:
      "Uma editora encontra mensagens escondidas no manuscrito de uma autora desaparecida.",
    score: 4.8,
    ratings: 726,
    reads: "5,2 mil",
    progress: 0,
    color: "#20243d",
    accent: "#bd8cff",
    status: "Publicado",
    price: 26.9,
    subscribersOnly: true,
    tags: ["mistério", "livros", "segredo"],
    chapters: [
      {
        id: "cap_801",
        number: 1,
        title: "O manuscrito",
        minutes: 8,
        free: true,
        body: [
          "Na página quarenta e três havia uma frase que não estava no arquivo original.",
        ],
      },
    ],
  },
  {
    id: "domingo-em-paris",
    slug: "domingo-em-paris",
    title: "Domingo em Paris",
    subtitle: "Uma viagem pode durar uma vida",
    author: "Laura Meireles",
    authorId: "aut_010",
    genre: "Romance",
    trope: "Viagem transformadora",
    format: "Audiobook",
    ageRating: "Livre",
    language: "pt-BR",
    blurb:
      "Uma brasileira viaja sozinha pela primeira vez e aceita um convite que muda seus planos.",
    score: 4.6,
    ratings: 352,
    reads: "2,9 mil",
    progress: 0,
    color: "#62353c",
    accent: "#ffd59c",
    status: "Publicado",
    price: 21.9,
    subscribersOnly: false,
    tags: ["viagem", "liberdade", "romance"],
    chapters: [
      {
        id: "cap_901",
        number: 1,
        title: "A passagem",
        minutes: 6,
        free: true,
        body: [
          "Lúcia comprou a passagem numa terça-feira, antes que a coragem tivesse tempo de desaparecer.",
        ],
      },
    ],
  },
];
const NAV: { id: View; label: string }[] = [
  { id: "home", label: "Início" },
  { id: "catalog", label: "Explorar" },
  { id: "library", label: "Minha biblioteca" },
  { id: "studio", label: "Studio do autor" },
];

function Icon({ name }: { name: string }) {
  const g: Record<string, string> = {
    search: "⌕",
    home: "⌂",
    book: "▤",
    headphones: "◉",
    user: "○",
    bell: "◌",
    play: "▶",
    lock: "▣",
  };
  return <span aria-hidden="true">{g[name] || "•"}</span>;
}

function Cover({ book, large = false }: { book: Book; large?: boolean }) {
  return (
    <div
      className={`cover ${large ? "cover-large" : ""}`}
      style={{
        background: `radial-gradient(circle at 70% 25%,${book.accent}45,transparent 32%),linear-gradient(145deg,${book.color},#101114)`,
      }}
    >
      {book.coverUrl && (
        <img
          className="cover-image"
          src={book.coverUrl}
          alt={`Capa de ${book.title}`}
          loading={large ? "eager" : "lazy"}
        />
      )}
      <span className="cover-mark">S</span>
      <div>
        <small>{book.genre}</small>
        <strong>{book.title}</strong>
        <em>{book.author}</em>
      </div>
      <i style={{ background: book.accent }} />
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  placeholder,
  children,
  required = false,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  children?: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="field">
      <span>
        {label}
        {required && <b> *</b>}
      </span>
      {children || <input name={name} type={type} placeholder={placeholder} />}
      <small>{name}</small>
    </label>
  );
}

export default function SambuApp({ user }: { user: User }) {
  const [view, setView] = useState<View>("home"),
    [catalogBooks, setCatalogBooks] = useState<Book[]>(BOOKS),
    [selected, setSelected] = useState(BOOKS[0]),
    [chapter, setChapter] = useState(0),
    [query, setQuery] = useState(""),
    [genre, setGenre] = useState("Todos"),
    [discoveryMood, setDiscoveryMood] = useState(""),
    [theme, setTheme] = useState<"light" | "sepia" | "dark">("sepia"),
    [fontSize, setFontSize] = useState(20),
    [saved, setSaved] = useState<Record<string, number>>({
      "cafeteria-domingo": 72,
      "mar-de-dentro": 38,
    }),
    [favoriteIds, setFavoriteIds] = useState<string[]>([]),
    [toast, setToast] = useState(""),
    [studioTab, setStudioTab] = useState("obra");
  const results = useMemo(
    () =>
      catalogBooks.filter(
        (b) =>
          (genre === "Todos" || b.genre === genre) &&
          (b.title + b.author + b.genre + b.trope + b.tags.join(" "))
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [catalogBooks, query, genre],
  );
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("view") === "catalog") setView("catalog");
    if (params.get("search")) setQuery(params.get("search") || "");
    fetch("/api/progress")
      .then((r) => (r.ok ? r.json() : {}))
      .then((d) => d.progress && setSaved((s) => ({ ...s, ...d.progress })))
      .catch(() => {});
    fetch("/api/favorites")
      .then((r) => (r.ok ? r.json() : { favorites: [] }))
      .then((data) => setFavoriteIds(data.favorites || []))
      .catch(() => {});
    fetch("/api/catalog")
      .then((r) => (r.ok ? r.json() : { books: [] }))
      .then((data) => {
        const imported: Book[] = (data.books || []).map(
          (book: Record<string, unknown>, index: number) => ({
            id: String(book.id),
            slug: String(book.slug || book.id),
            title: String(book.title || "Sem título"),
            subtitle: String(book.subtitle || "Nova história no acervo Sambu"),
            author: String(book.author || "Autor desconhecido"),
            authorId: String(book.authorId || "imported"),
            genre: String(book.genre || "Literatura"),
            trope: "Novidade",
            format: String(book.format || "Ebook"),
            ageRating: String(book.ageRating || "14"),
            language: String(book.language || "pt-BR"),
            blurb: String(
              book.description || "Livro recém-publicado no Sambu.",
            ),
            score: 5,
            ratings: 0,
            reads: "Novo",
            progress: 0,
            color: ["#3b174d", "#173d3a", "#4f233c"][index % 3],
            accent: ["#ed008c", "#ffb51b", "#9400ff"][index % 3],
            status: "Publicado",
            price: Number(book.priceCents || 0) / 100,
            subscribersOnly: Boolean(book.subscribersOnly),
            freeChapters: Number(book.freeChapters || 1),
            coverUrl: coverUrlFor(String(book.id)),
            tags: ["novidade", "ebook", String(book.genre || "literatura")],
            contentLoaded: false,
            chapters: [
              {
                id: `${book.id}-arquivo`,
                number: 1,
                title: "Conteúdo do EPUB",
                minutes: 1,
                free: true,
                body: ["Carregando o conteúdo original do ebook…"],
              },
            ],
          }),
        );
        setCatalogBooks((current) => [
          ...imported,
          ...current.filter((item) => !imported.some((b) => b.id === item.id)),
        ]);
      })
      .catch(() => {});
  }, []);

  function go(next: View) {
    setView(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function discoverByMood(mood: (typeof MOOD_FILTERS)[number]) {
    setDiscoveryMood(mood.label);
    setGenre(mood.genre);
    setQuery(mood.query);
    go("catalog");
  }
  function clearDiscovery() {
    setDiscoveryMood("");
    setGenre("Todos");
    setQuery("");
  }
  async function openBook(book: Book) {
    let resolved = book;
    if (
      book.authorId === "imported" &&
      !book.contentLoaded &&
      !book.format.toUpperCase().includes("PDF")
    ) {
      notify("Abrindo o conteúdo original do EPUB…");
      const response = await fetch(
        `/api/catalog/content?id=${encodeURIComponent(book.id)}`,
      );
      const data = await response.json().catch(() => ({}));
      if (response.ok && data.chapters?.length) {
        resolved = { ...book, chapters: data.chapters, contentLoaded: true };
        setCatalogBooks((current) =>
          current.map((item) => (item.id === resolved.id ? resolved : item)),
        );
      } else {
        notify(
          response.status === 415
            ? "Este arquivo PDF será aberto no visualizador em uma próxima atualização."
            : "Não foi possível interpretar o conteúdo deste EPUB.",
        );
      }
    }
    setSelected(resolved);
    go("detail");
  }
  function notify(m: string) {
    setToast(m);
    window.setTimeout(() => setToast(""), 2500);
  }
  async function saveProgress(v: number) {
    setSaved((s) => ({ ...s, [selected.id]: v }));
    await fetch("/api/progress", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        bookId: selected.id,
        chapterId: selected.chapters[chapter]?.id,
        progress: v,
      }),
    }).catch(() => {});
  }
  async function saveFavorite(bookId: string) {
    const favorite = !favoriteIds.includes(bookId);
    const response = await fetch("/api/favorites", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ bookId, favorite }),
    });
    if (response.ok)
      setFavoriteIds((current) =>
        favorite
          ? [...new Set([...current, bookId])]
          : current.filter((id) => id !== bookId),
      );
    notify(
      response.ok
        ? favorite
          ? "Livro salvo na sua biblioteca"
          : "Livro removido dos favoritos"
        : "Entre na sua conta para salvar histórias",
    );
  }
  async function choosePlan(plan: string) {
    if (plan === "free" || plan === "individual") {
      notify("Você já pode aproveitar os capítulos gratuitos");
      return;
    }
    const response = await fetch("/api/subscription", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ plan }),
    });
    const data = await response.json().catch(() => ({}));
    notify(
      response.ok
        ? data.message || "Plano selecionado"
        : "Entre na sua conta para escolher um plano",
    );
  }
  return (
    <div className="app-shell">
      {view !== "reader" && (
        <>
          <header>
            <button
              className="brand"
              onClick={() => go("home")}
              aria-label="Ir para a página inicial da Sambu"
            >
              <img src="/sambu-logo.png" alt="Sambu" />
            </button>
            <nav>
              {NAV.map((x) => (
                <button
                  key={x.id}
                  className={view === x.id ? "active" : ""}
                  onClick={() => go(x.id)}
                >
                  {x.label}
                </button>
              ))}
            </nav>
            <div className="account">
              <button className="icon-btn" onClick={() => go("catalog")}>
                <Icon name="search" />
              </button>
              <button className="icon-btn">
                <Icon name="bell" />
              </button>
              <button className="avatar" onClick={() => go("profile")}>
                {user?.name?.charAt(0).toUpperCase() || "M"}
              </button>
            </div>
          </header>
          <div className="mobile-tabs">
            {NAV.slice(0, 3).map((x) => (
              <button
                key={x.id}
                className={view === x.id ? "active" : ""}
                onClick={() => go(x.id)}
              >
                <Icon
                  name={
                    x.id === "home"
                      ? "home"
                      : x.id === "catalog"
                        ? "search"
                        : "book"
                  }
                />
                <span>{x.label}</span>
              </button>
            ))}
            <button onClick={() => go("profile")}>
              <Icon name="user" />
              <span>Perfil</span>
            </button>
          </div>
        </>
      )}
      {view === "home" && (
        <Home
          openBook={openBook}
          go={go}
          saved={saved}
          onDiscover={discoverByMood}
          discoveryMood={discoveryMood}
        />
      )}{" "}
      {view === "catalog" && (
        <Catalog
          query={query}
          setQuery={setQuery}
          genre={genre}
          setGenre={setGenre}
          discoveryMood={discoveryMood}
          setDiscoveryMood={setDiscoveryMood}
          clearDiscovery={clearDiscovery}
          results={results}
          openBook={openBook}
        />
      )}{" "}
      {view === "library" && (
        <Library
          saved={saved}
          books={catalogBooks}
          favoriteIds={favoriteIds}
          openBook={openBook}
        />
      )}{" "}
      {view === "detail" && (
        <Detail
          book={selected}
          go={go}
          setChapter={setChapter}
          notify={notify}
          saveFavorite={saveFavorite}
        />
      )}{" "}
      {view === "reader" && (
        <Reader
          book={selected}
          chapter={chapter}
          setChapter={setChapter}
          go={go}
          theme={theme}
          setTheme={setTheme}
          fontSize={fontSize}
          setFontSize={setFontSize}
          notify={notify}
          saveProgress={saveProgress}
        />
      )}{" "}
      {view === "plans" && <Plans choosePlan={choosePlan} />}{" "}
      {view === "profile" && <Profile user={user} go={go} notify={notify} />}{" "}
      {view === "studio" && (
        <Studio tab={studioTab} setTab={setStudioTab} notify={notify} />
      )}{" "}
      {view === "admin" && <AdminV2 go={go} />}{" "}
      {toast && <div className="toast">✓ {toast}</div>}
    </div>
  );
}

function Home({
  openBook,
  go,
  saved,
  onDiscover,
  discoveryMood,
}: {
  openBook: (b: Book) => void;
  go: (v: View) => void;
  saved: Record<string, number>;
  onDiscover: (mood: (typeof MOOD_FILTERS)[number]) => void;
  discoveryMood: string;
}) {
  return (
    <main className="home">
      <div className="discovery-bar">
        <span>Descubra por:</span>
        {MOOD_FILTERS.map((mood) => (
          <button
            key={mood.label}
            onClick={() => onDiscover(mood)}
            className={discoveryMood === mood.label ? "hot" : ""}
            aria-pressed={discoveryMood === mood.label}
          >
            <i aria-hidden="true">{mood.icon}</i>
            {mood.label}
          </button>
        ))}
      </div>
      <section className="hero">
        <div className="hero-copy">
          <p className="offer-pill">
            <span>OFERTA DE BOAS-VINDAS</span> 7 dias grátis
          </p>
          <h1>
            Sua próxima história
            <br />
            <em>começa aqui.</em>
          </h1>
          <p>
            Romances que abraçam, surpreendem e acompanham o seu momento — para
            ler ou ouvir, onde você estiver.
          </p>
          <div className="hero-actions">
            <button className="primary" onClick={() => go("plans")}>
              <Icon name="play" /> Começar grátis
            </button>
            <button className="hero-secondary" onClick={() => go("catalog")}>
              Explorar histórias →
            </button>
          </div>
          <div className="hero-trust">
            <div>
              <b>4,9</b>
              <span>★★★★★</span>
              <small>avaliação das leitoras</small>
            </div>
            <i />
            <div>
              <b>50 mil+</b>
              <small>mulheres lendo juntas</small>
            </div>
            <i />
            <div>
              <b>Novos</b>
              <small>capítulos toda semana</small>
            </div>
          </div>
        </div>
        <div className="hero-stage">
          <div className="cover-fan back-one">
            <Cover book={BOOKS[1]} />
          </div>
          <div className="cover-fan main-cover">
            <Cover book={BOOKS[0]} large />
          </div>
          <div className="cover-fan back-two">
            <Cover book={BOOKS[3]} />
          </div>
          <div className="float-card audio">
            <span className="pulse">
              <Icon name="headphones" />
            </span>
            <span>
              <b>Ouça a história</b>
              <small>Narração imersiva</small>
            </span>
          </div>
          <div className="float-card pick">
            MAIS LIDO
            <br />
            <b>DA SEMANA</b>
          </div>
        </div>
      </section>
      <section className="content">
        <Section
          title="Continue de onde parou"
          kicker="SUA JORNADA"
          action={() => go("library")}
        />
        <div className="continue-strip">
          {BOOKS.filter((b) => saved[b.id]).map((b) => (
            <article key={b.id} onClick={() => openBook(b)}>
              <Cover book={b} />
              <div>
                <span>{saved[b.id]}% CONCLUÍDO</span>
                <h3>{b.title}</h3>
                <p>{b.author}</p>
                <div className="bar">
                  <i style={{ width: `${saved[b.id]}%` }} />
                </div>
                <small>Continuar leitura →</small>
              </div>
            </article>
          ))}
        </div>
        <div className="editorial-head">
          <div>
            <p className="eyebrow coral">ESCOLHIDOS PARA VOCÊ</p>
            <h2>Histórias para se apaixonar</h2>
          </div>
          <button onClick={() => go("catalog")}>Ver catálogo completo →</button>
        </div>
        <div className="story-rail">
          {BOOKS.map((b, i) => (
            <div className="ranked-book" key={b.id}>
              <span className="rank">0{i + 1}</span>
              <BookCard book={b} open={openBook} />
            </div>
          ))}
        </div>
        <section className="audio-banner">
          <div className="audio-art">
            <div className="sound-wave">
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
            </div>
            <b>S</b>
          </div>
          <div>
            <p className="eyebrow">SAMBU EM ÁUDIO</p>
            <h2>Uma história no seu ritmo.</h2>
            <p>
              Caminhe, cozinhe ou desacelere enquanto narradores dão vida a cada
              capítulo.
            </p>
          </div>
          <button className="ivory" onClick={() => openBook(BOOKS[2])}>
            <Icon name="headphones" /> Ouvir uma amostra
          </button>
        </section>
        <div className="editorial-head compact">
          <div>
            <p className="eyebrow coral">PARA VIRAR A PÁGINA</p>
            <h2>Recomeços que inspiram</h2>
          </div>
          <button onClick={() => go("catalog")}>Ver todos →</button>
        </div>
        <div className="quick-picks">
          {BOOKS.slice(0, 3).map((b, i) => (
            <article key={b.id} onClick={() => openBook(b)}>
              <Cover book={b} />
              <div>
                <span>
                  {
                    [
                      "ROMANCE CONTEMPORÂNEO",
                      "SEGUNDAS CHANCES",
                      "AMOR & AUTODESCOBERTA",
                    ][i]
                  }
                </span>
                <h3>{b.title}</h3>
                <p>{b.blurb}</p>
                <button>Ler primeiro capítulo →</button>
              </div>
            </article>
          ))}
        </div>
        <section className="membership">
          <div>
            <p className="eyebrow">SAMBU ILIMITADO</p>
            <h2>Mais histórias. Mais você.</h2>
            <p>
              Catálogo completo, audiobooks, leitura offline e experiências
              imersivas em uma assinatura simples.
            </p>
            <div className="member-actions">
              <button className="ivory" onClick={() => go("plans")}>
                Experimentar 7 dias grátis
              </button>
              <small>Cancele quando quiser</small>
            </div>
          </div>
          <div className="membership-orbit">
            <span>♫</span>
            <span>✦</span>
            <b>S</b>
            <span>◉</span>
          </div>
        </section>
      </section>
    </main>
  );
}

function Section({
  title,
  kicker,
  action,
}: {
  title: string;
  kicker: string;
  action: () => void;
}) {
  return (
    <div className="section-head">
      <div>
        <p className="eyebrow coral">{kicker}</p>
        <h2>{title}</h2>
      </div>
      <button onClick={action}>Ver todos →</button>
    </div>
  );
}

function BookCard({ book, open }: { book: Book; open: (b: Book) => void }) {
  return (
    <article className="book-card" onClick={() => open(book)}>
      <div className="cover-wrap">
        <Cover book={book} />
        {book.subscribersOnly && <span className="mini-premium">✦</span>}
        <button>♡</button>
      </div>
      <div className="rating">★ {book.score}</div>
      <h3>{book.title}</h3>
      <p>{book.author}</p>
      <span>
        {book.genre} · {book.format}
      </span>
    </article>
  );
}

function Catalog({
  query,
  setQuery,
  genre,
  setGenre,
  discoveryMood,
  setDiscoveryMood,
  clearDiscovery,
  results,
  openBook,
}: {
  query: string;
  setQuery: (s: string) => void;
  genre: string;
  setGenre: (s: string) => void;
  discoveryMood: string;
  setDiscoveryMood: (s: string) => void;
  clearDiscovery: () => void;
  results: Book[];
  openBook: (b: Book) => void;
}) {
  return (
    <main className="page">
      <div className="page-title">
        <p className="eyebrow coral">CATÁLOGO SAMBU</p>
        <h1>Encontre sua próxima história</h1>
        <p>Busque por título, autora, gênero, tema ou emoção.</p>
      </div>
      <div className="search-box">
        <Icon name="search" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setDiscoveryMood("");
          }}
          placeholder="O que você quer sentir hoje?"
        />
        <button onClick={clearDiscovery}>Limpar</button>
      </div>
      {discoveryMood && (
        <div className="active-discovery" role="status">
          <span>Seleção ativa</span>
          <b>{discoveryMood}</b>
          <button onClick={clearDiscovery} aria-label="Remover seleção de descoberta">×</button>
        </div>
      )}
      <div className="filter-row">
        {[
          "Todos",
          "Romance",
          "Fantasia",
          "Suspense",
          "Contemporâneo",
          "Ficção científica",
        ].map((x) => (
          <button
            key={x}
            className={genre === x ? "selected" : ""}
            onClick={() => {
              setGenre(x);
              setDiscoveryMood("");
            }}
          >
            {x}
          </button>
        ))}
        <select>
          <option>Mais relevantes</option>
          <option>Mais lidos</option>
          <option>Melhor avaliados</option>
        </select>
      </div>
      <div className="result-count">{results.length} títulos encontrados</div>
      <div className="book-grid catalog-grid">
        {results.map((b) => (
          <BookCard key={b.id} book={b} open={openBook} />
        ))}
      </div>
    </main>
  );
}

function Library({
  saved,
  books,
  favoriteIds,
  openBook,
}: {
  saved: Record<string, number>;
  books: Book[];
  favoriteIds: string[];
  openBook: (b: Book) => void;
}) {
  const [tab, setTab] = useState<"progress" | "saved" | "completed">(
    "progress",
  );
  const visible = books.filter((book) =>
    tab === "saved"
      ? favoriteIds.includes(book.id)
      : tab === "completed"
        ? saved[book.id] === 100
        : saved[book.id] > 0 && saved[book.id] < 100,
  );
  return (
    <main className="page">
      <div className="page-title row">
        <div>
          <p className="eyebrow coral">MINHA BIBLIOTECA</p>
          <h1>Sua estante, seu ritmo</h1>
        </div>
        <button className="outline">Gerenciar downloads</button>
      </div>
      <div className="stats-row">
        <div>
          <b>
            {
              Object.values(saved).filter((value) => value > 0 && value < 100)
                .length
            }
          </b>
          <span>Em andamento</span>
        </div>
        <div>
          <b>{favoriteIds.length}</b>
          <span>Salvos</span>
        </div>
        <div>
          <b>{Object.values(saved).filter((value) => value === 100).length}</b>
          <span>Concluídos</span>
        </div>
        <div>
          <b>{Object.values(saved).reduce((sum, value) => sum + value, 0)}%</b>
          <span>Tempo de leitura</span>
        </div>
      </div>
      <div className="tabs">
        <button
          className={tab === "progress" ? "active" : ""}
          onClick={() => setTab("progress")}
        >
          Em andamento
        </button>
        <button
          className={tab === "saved" ? "active" : ""}
          onClick={() => setTab("saved")}
        >
          Salvos
        </button>
        <button
          className={tab === "completed" ? "active" : ""}
          onClick={() => setTab("completed")}
        >
          Concluídos
        </button>
      </div>
      <div className="library-list">
        {visible.map((b) => (
          <article key={b.id}>
            <Cover book={b} />
            <div>
              <span>
                {b.genre} · {b.format}
              </span>
              <h3>{b.title}</h3>
              <p>{b.author}</p>
              <div className="bar">
                <i style={{ width: `${saved[b.id]}%` }} />
              </div>
              <small>{saved[b.id]}% concluído</small>
            </div>
            <button className="primary" onClick={() => openBook(b)}>
              Continuar
            </button>
            <button className="icon-btn">•••</button>
          </article>
        ))}
        {!visible.length && (
          <div className="library-empty">
            <b>Nenhum livro nesta seção</b>
            <p>Explore o catálogo, salve uma obra ou comece uma leitura.</p>
          </div>
        )}
      </div>
    </main>
  );
}

function Detail({
  book,
  go,
  setChapter,
  notify,
  saveFavorite,
}: {
  book: Book;
  go: (v: View) => void;
  setChapter: (n: number) => void;
  notify: (s: string) => void;
  saveFavorite: (id: string) => void;
}) {
  return (
    <main className="detail">
      <button className="back" onClick={() => go("catalog")}>
        ← Voltar ao catálogo
      </button>
      <section>
        <div className="detail-cover">
          <Cover book={book} large />
          {book.subscribersOnly && (
            <span className="premium-badge">✦ INCLUSO NO IMERSIVO</span>
          )}
        </div>
        <div className="book-info">
          <p className="eyebrow coral">
            {book.genre} · {book.trope}
          </p>
          <h1>{book.title}</h1>
          <h3>{book.subtitle}</h3>
          <p className="author">
            por <b>{book.author}</b>
          </p>
          <div className="metrics">
            <span>
              ★ <b>{book.score}</b>
              <small>{book.ratings} avaliações</small>
            </span>
            <span>
              <b>{book.reads}</b>
              <small>leituras</small>
            </span>
            <span>
              <b>{book.chapters.length}</b>
              <small>capítulos</small>
            </span>
            <span>
              <b>{book.ageRating}</b>
              <small>classificação</small>
            </span>
          </div>
          <p className="blurb">{book.blurb}</p>
          <div className="tag-row">
            {book.tags.map((t) => (
              <span key={t}>#{t}</span>
            ))}
          </div>
          <div className="actions">
            <button
              className="primary"
              onClick={() => {
                setChapter(0);
                go("reader");
              }}
            >
              <Icon name="book" /> Ler agora
            </button>
            <button className="outline" onClick={() => saveFavorite(book.id)}>
              ♡ Salvar
            </button>
            <button
              className="outline"
              onClick={() => notify("Amostra de áudio iniciada")}
            >
              <Icon name="headphones" /> Ouvir amostra
            </button>
          </div>
          <small className="purchase">
            Compra definitiva por{" "}
            <b>R$ {book.price.toFixed(2).replace(".", ",")}</b>
          </small>
        </div>
      </section>
      <div className="chapter-list">
        <div className="section-head">
          <div>
            <p className="eyebrow coral">TEMPORADA 1</p>
            <h2>Capítulos</h2>
          </div>
          <span>
            {book.chapters.reduce((a, c) => a + c.minutes, 0)} min de leitura
          </span>
        </div>
        {book.chapters.map((c, i) => (
          <button
            key={c.id}
            onClick={() => {
              setChapter(i);
              go("reader");
            }}
          >
            <span>{String(c.number).padStart(2, "0")}</span>
            <div>
              <b>{c.title}</b>
              <small>
                {c.free ? "Acesso gratuito" : "Plano Imersivo ou compra"}
              </small>
            </div>
            <em>{c.minutes} min</em>
            {!c.free && <Icon name="lock" />}
            <i>→</i>
          </button>
        ))}
      </div>
    </main>
  );
}

function Reader({
  book,
  chapter,
  setChapter,
  go,
  theme,
  setTheme,
  fontSize,
  setFontSize,
  notify,
  saveProgress,
}: {
  book: Book;
  chapter: number;
  setChapter: (n: number) => void;
  go: (v: View) => void;
  theme: "light" | "sepia" | "dark";
  setTheme: (t: "light" | "sepia" | "dark") => void;
  fontSize: number;
  setFontSize: (n: number) => void;
  notify: (s: string) => void;
  saveProgress: (n: number) => void;
}) {
  const c = book.chapters[chapter];
  const [tocOpen, setTocOpen] = useState(false);
  const [markedChapters, setMarkedChapters] = useState<number[]>([]);
  const isPdf = book.format.toUpperCase().includes("PDF");
  useEffect(() => {
    fetch(`/api/bookmarks?bookId=${encodeURIComponent(book.id)}`)
      .then((r) => (r.ok ? r.json() : { bookmarks: [] }))
      .then((data) =>
        setMarkedChapters(
          (data.bookmarks || []).map(
            (bookmark: { chapter: number }) => bookmark.chapter,
          ),
        ),
      )
      .catch(() => {});
  }, [book.id]);

  async function toggleBookmark() {
    const active = !markedChapters.includes(chapter);
    const response = await fetch("/api/bookmarks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        bookId: book.id,
        chapter,
        chapterId: c?.id,
        active,
      }),
    });
    if (response.ok) {
      setMarkedChapters((current) =>
        active
          ? [...current, chapter]
          : current.filter((item) => item !== chapter),
      );
      notify(active ? "Marcador adicionado" : "Marcador removido");
    } else notify("Entre na sua conta para criar marcadores");
  }
  return (
    <main className={`reader ${theme}`}>
      <div className="reader-top">
        <button onClick={() => go("detail")}>←</button>
        <div>
          <b>{book.title}</b>
          <span>
            Capítulo {chapter + 1} de {book.chapters.length}
          </span>
        </div>
        <div className="reader-controls">
          <button onClick={() => setTocOpen((open) => !open)}>☰</button>
          <button onClick={toggleBookmark}>
            {markedChapters.includes(chapter) ? "♥" : "♡"}
          </button>
          <button onClick={() => setFontSize(Math.max(16, fontSize - 2))}>
            A−
          </button>
          <button onClick={() => setFontSize(Math.min(28, fontSize + 2))}>
            A+
          </button>
          <button
            onClick={() =>
              setTheme(
                theme === "light"
                  ? "sepia"
                  : theme === "sepia"
                    ? "dark"
                    : "light",
              )
            }
          >
            ◐
          </button>
          <button onClick={() => notify("Preferências de leitura aplicadas")}>
            ⚙
          </button>
        </div>
      </div>
      {tocOpen && (
        <aside className="reader-toc">
          <div>
            <b>Índice do livro</b>
            <button onClick={() => setTocOpen(false)}>×</button>
          </div>
          {book.chapters.map((item, index) => (
            <button
              key={item.id}
              className={index === chapter ? "active" : ""}
              onClick={() => {
                setChapter(index);
                setTocOpen(false);
                window.scrollTo(0, 0);
              }}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              <b>{item.title}</b>
              {markedChapters.includes(index) && <i>♥</i>}
            </button>
          ))}
        </aside>
      )}
      <aside className="audio-mini">
        <button>▶</button>
        <div>
          <b>Narração imersiva</b>
          <small>00:00 / {c?.minutes}:00</small>
        </div>
        <span>♫ Efeitos ligados</span>
      </aside>
      {isPdf ? (
        <section className="pdf-reader">
          <iframe
            title={`Leitura de ${book.title}`}
            src={`/api/catalog/file?id=${encodeURIComponent(book.id)}`}
          />
          <a
            className="outline"
            href={`/api/catalog/file?id=${encodeURIComponent(book.id)}`}
            target="_blank"
            rel="noreferrer"
          >
            Abrir PDF em tela cheia
          </a>
        </section>
      ) : (
        <article style={{ fontSize }}>
          <p className="chapter-no">CAPÍTULO {chapter + 1}</p>
          <h1>{c?.title}</h1>
          {c?.body.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
          <div className="reader-end">
            <span>•</span>
            <p>Fim do capítulo</p>
            {chapter < book.chapters.length - 1 ? (
              <button
                className="primary"
                onClick={() => {
                  saveProgress(
                    Math.round(((chapter + 1) / book.chapters.length) * 100),
                  );
                  setChapter(chapter + 1);
                  window.scrollTo(0, 0);
                }}
              >
                Próximo capítulo →
              </button>
            ) : (
              <button
                className="primary"
                onClick={() => {
                  saveProgress(100);
                  go("detail");
                }}
              >
                Concluir leitura ✓
              </button>
            )}
          </div>
        </article>
      )}
      <div className="reader-progress">
        <i
          style={{ width: `${((chapter + 1) / book.chapters.length) * 100}%` }}
        />
      </div>
    </main>
  );
}

function Plans({ choosePlan }: { choosePlan: (plan: string) => void }) {
  const [annual, setAnnual] = useState(false);
  return (
    <main className="page plans">
      <div className="page-title center">
        <p className="eyebrow coral">PLANOS SAMBU</p>
        <h1>Escolha como viver suas histórias</h1>
        <p>
          Sem esperas artificiais. Cancele quando quiser. Livros comprados
          continuam seus.
        </p>
      </div>
      <div className="billing">
        <button
          className={!annual ? "active" : ""}
          onClick={() => setAnnual(false)}
        >
          Mensal
        </button>
        <button
          className={annual ? "active" : ""}
          onClick={() => setAnnual(true)}
        >
          Anual <span>economize 33%</span>
        </button>
      </div>
      <div className="plan-grid">
        <Plan
          name="Gratuito"
          price="R$ 0"
          text="Para descobrir o Sambu"
          items={[
            "Capítulos gratuitos",
            "Progresso sincronizado",
            "Biblioteca pessoal",
          ]}
          onChoose={() => choosePlan("free")}
        />
        <Plan
          featured
          name="Imersivo"
          price={annual ? "R$ 19,90" : "R$ 29,90"}
          text={
            annual ? "R$ 238,80 cobrados por ano" : "A experiência completa"
          }
          items={[
            "Catálogo ilimitado",
            "Ebooks e audiobooks",
            "Leitura offline",
            "Efeitos imersivos",
            "Sem anúncios",
          ]}
          onChoose={() =>
            choosePlan(annual ? "immersive_annual" : "immersive_monthly")
          }
        />
        <Plan
          name="Família"
          price="R$ 39,90"
          text="Até quatro perfis"
          items={[
            "Todos os benefícios Imersivo",
            "4 perfis independentes",
            "Controle parental",
            "Bibliotecas separadas",
          ]}
          onChoose={() => choosePlan("family_monthly")}
        />
        <Plan
          name="Compra avulsa"
          price="R$ 9,90"
          text="Preço inicial por ebook"
          items={[
            "Livro permanece na biblioteca",
            "Leitura online e offline",
            "Sem assinatura obrigatória",
          ]}
          onChoose={() => choosePlan("individual")}
        />
      </div>
      <div className="backend-note">
        <b>✓ Assinatura preparada para integração</b>
        <span>
          O plano escolhido será associado à conta e encaminhado ao gateway de
          pagamento na próxima etapa.
        </span>
      </div>
    </main>
  );
}

function Plan({
  name,
  price,
  text,
  items,
  featured = false,
  onChoose,
}: {
  name: string;
  price: string;
  text: string;
  items: string[];
  featured?: boolean;
  onChoose: () => void;
}) {
  return (
    <article className={`plan ${featured ? "featured" : ""}`}>
      {featured && <span className="popular">MAIS ESCOLHIDO</span>}
      <h3>{name}</h3>
      <p>{text}</p>
      <div className="price">
        <b>{price}</b>
        {price !== "R$ 0" && <span>/mês</span>}
      </div>
      <button className={featured ? "primary" : "outline"} onClick={onChoose}>
        {featured ? "Começar 7 dias grátis" : "Escolher plano"}
      </button>
      <ul>
        {items.map((x) => (
          <li key={x}>✓ {x}</li>
        ))}
      </ul>
    </article>
  );
}

function Profile({
  user,
  go,
  notify,
}: {
  user: User;
  go: (v: View) => void;
  notify: (s: string) => void;
}) {
  type ProfileTab = "personal" | "reading" | "subscription" | "notifications" | "privacy";
  const [activeTab, setActiveTab] = useState<ProfileTab>("personal");
  const [saving, setSaving] = useState(false);
  const [profileName, setProfileName] = useState(user?.name || "Marcos Dias");
  const [displayName, setDisplayName] = useState(user?.name || "Marcos");
  const tabs: { id: ProfileTab; label: string; icon: string }[] = [
    { id: "personal", label: "Dados pessoais", icon: "♙" },
    { id: "reading", label: "Preferências de leitura", icon: "Aa" },
    { id: "subscription", label: "Assinatura e compras", icon: "◇" },
    { id: "notifications", label: "Notificações", icon: "♢" },
    { id: "privacy", label: "Privacidade e LGPD", icon: "⌁" },
  ];

  useEffect(() => {
    fetch("/api/profile")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data?.profile?.displayName) {
          setProfileName(data.profile.displayName);
          setDisplayName(data.profile.displayName);
        }
      })
      .catch(() => {});
  }, []);

  function saveLocalPreferences(form: HTMLFormElement, message: string) {
    const values = Object.fromEntries(new FormData(form).entries());
    localStorage.setItem(`sambu:${activeTab}`, JSON.stringify(values));
    notify(message);
  }

  const sectionTitle = tabs.find((tab) => tab.id === activeTab)?.label;

  return (
    <main className="page profile">
      <aside>
        <div className="profile-summary">
          <div className="profile-avatar">
            {profileName?.charAt(0).toUpperCase() || "M"}
          </div>
          <div>
            <h3>{profileName}</h3>
            <p>{user?.email || "marcos@sambu.online"}</p>
          </div>
        </div>
        <nav className="profile-menu" aria-label="Configurações da conta">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={activeTab === tab.id ? "active" : ""}
              onClick={() => setActiveTab(tab.id)}
            >
              <span>{tab.icon}</span>
              <b>{tab.label}</b>
              <i>›</i>
            </button>
          ))}
        </nav>
        <button className="admin-link" onClick={() => go("admin")}>
          Painel administrativo <span>↗</span>
        </button>
      </aside>
      <section className="panel profile-panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow coral">MINHA CONTA</p>
            <h2>{sectionTitle}</h2>
          </div>
          <span className="status-pill">✓ Conta verificada</span>
        </div>

        {activeTab === "personal" && (
          <form
            className="form-grid"
            onSubmit={async (e) => {
              e.preventDefault();
              setSaving(true);
              const form = new FormData(e.currentTarget);
              const response = await fetch("/api/profile", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  displayName: form.get("display_name"),
                  tasteProfile: JSON.stringify(Object.fromEntries(form.entries())),
                }),
              }).catch(() => null);
              setSaving(false);
              if (response?.ok) {
                setProfileName(String(form.get("display_name") || form.get("full_name")));
                notify("Dados pessoais salvos com sucesso");
              } else notify("Não foi possível salvar. Entre novamente na sua conta.");
            }}
          >
            <Field label="Nome completo" name="full_name" required>
              <input name="full_name" defaultValue={profileName} required />
            </Field>
            <Field label="Nome de exibição" name="display_name">
              <input
                name="display_name"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
              />
            </Field>
            <Field label="E-mail" name="email" type="email" required>
              <input name="email" type="email" value={user?.email || ""} readOnly />
            </Field>
            <Field label="Telefone" name="phone" />
            <Field label="Data de nascimento" name="birth_date" type="date" />
            <Field label="Idioma" name="locale">
              <select name="locale">
                <option value="pt-BR">Português (Brasil)</option>
                <option value="en-US">English</option>
              </select>
            </Field>
            <Field label="Pronomes" name="pronouns" />
            <Field label="País" name="country">
              <select name="country">
                <option value="BR">Brasil</option>
                <option value="PT">Portugal</option>
              </select>
            </Field>
            <div className="full form-actions">
              <button className="primary" disabled={saving}>
                {saving ? "Salvando…" : "Salvar alterações"}
              </button>
              <button type="button" className="outline" onClick={() => notify("Enviamos as instruções de acesso para seu e-mail")}>Alterar acesso</button>
            </div>
          </form>
        )}

        {activeTab === "reading" && (
          <form className="settings-stack" onSubmit={(e) => { e.preventDefault(); saveLocalPreferences(e.currentTarget, "Preferências de leitura atualizadas"); }}>
            <div className="setting-card">
              <div><b>Tema do leitor</b><small>Escolha o conforto visual para suas leituras.</small></div>
              <select name="reader_theme" defaultValue="sepia"><option value="light">Claro</option><option value="sepia">Sépia</option><option value="dark">Escuro</option></select>
            </div>
            <div className="setting-card">
              <div><b>Tamanho da fonte</b><small>Aplicado automaticamente ao abrir um livro.</small></div>
              <select name="font_size" defaultValue="20"><option value="16">Pequena</option><option value="20">Média</option><option value="24">Grande</option></select>
            </div>
            <div className="setting-card genre-setting">
              <div><b>Gêneros favoritos</b><small>Melhora as recomendações da sua página inicial.</small></div>
              <div className="choice-chips"><label><input type="checkbox" name="genre_romance" defaultChecked /> Romance</label><label><input type="checkbox" name="genre_fantasy" /> Fantasia</label><label><input type="checkbox" name="genre_business" defaultChecked /> Negócios</label><label><input type="checkbox" name="genre_thriller" /> Suspense</label></div>
            </div>
            <button className="primary settings-save">Salvar preferências</button>
          </form>
        )}

        {activeTab === "subscription" && (
          <div className="settings-stack">
            <article className="subscription-card">
              <div><span className="eyebrow">PLANO ATUAL</span><h3>Leitor gratuito</h3><p>Acesso aos capítulos gratuitos e livros liberados.</p></div>
              <button className="primary" onClick={() => go("plans")}>Conhecer o Sambu+</button>
            </article>
            <div className="account-row"><div><b>Forma de pagamento</b><small>Nenhuma forma cadastrada</small></div><button className="outline" onClick={() => go("plans")}>Adicionar</button></div>
            <div className="account-row"><div><b>Histórico de compras</b><small>Você ainda não realizou compras.</small></div><button className="ghost" onClick={() => notify("Não há comprovantes disponíveis")}>Ver histórico</button></div>
          </div>
        )}

        {activeTab === "notifications" && (
          <form className="settings-stack" onSubmit={(e) => { e.preventDefault(); saveLocalPreferences(e.currentTarget, "Notificações atualizadas"); }}>
            {[["new_books", "Novos livros e lançamentos", "Avisos quando um título do seu interesse chegar."], ["reading_reminder", "Lembrete de leitura", "Um convite gentil para continuar sua história."], ["promotions", "Ofertas e benefícios", "Descontos, períodos gratuitos e novidades do Sambu+."], ["author_news", "Autores que você acompanha", "Novos capítulos e publicações dos seus favoritos."]].map(([name, title, text], index) => (
              <label className="toggle-row" key={name}><div><b>{title}</b><small>{text}</small></div><input type="checkbox" name={name} defaultChecked={index < 2} /><span /></label>
            ))}
            <button className="primary settings-save">Salvar notificações</button>
          </form>
        )}

        {activeTab === "privacy" && (
          <div className="settings-stack">
            <div className="privacy-intro"><b>Seus dados, sob seu controle</b><p>Consulte, exporte ou solicite a exclusão dos dados associados à sua conta conforme a LGPD.</p></div>
            <div className="account-row"><div><b>Baixar meus dados</b><small>Gera uma cópia das informações da conta e do histórico de leitura.</small></div><button className="outline" onClick={() => notify("Solicitação recebida. O arquivo será preparado por e-mail.")}>Solicitar arquivo</button></div>
            <div className="account-row"><div><b>Personalização da experiência</b><small>Permitir recomendações baseadas no seu histórico.</small></div><label className="mini-toggle"><input type="checkbox" defaultChecked onChange={() => notify("Preferência de privacidade atualizada")} /><span /></label></div>
            <div className="danger-zone"><div><b>Excluir minha conta</b><small>Essa solicitação inicia a remoção definitiva dos seus dados.</small></div><button className="danger-button" onClick={() => notify("Para sua segurança, enviaremos uma confirmação por e-mail")}>Solicitar exclusão</button></div>
          </div>
        )}
      </section>
    </main>
  );
}

function Studio({
  tab,
  setTab,
  notify,
}: {
  tab: string;
  setTab: (s: string) => void;
  notify: (s: string) => void;
}) {
  const steps = [
    ["obra", "01", "Dados da obra"],
    ["conteudo", "02", "Conteúdo"],
    ["classificacao", "03", "Classificação"],
    ["midia", "04", "Capa e mídia"],
    ["comercial", "05", "Comercial"],
    ["direitos", "06", "Direitos"],
    ["publicacao", "07", "Publicação"],
  ];
  return (
    <main className="page studio">
      <div className="page-title row">
        <div>
          <p className="eyebrow coral">SAMBU STUDIO</p>
          <h1>Publique sua próxima história</h1>
          <p>Campos preparados para o contrato de dados do backend.</p>
        </div>
        <div>
          <button className="outline" onClick={() => notify("Rascunho salvo")}>
            Salvar rascunho
          </button>{" "}
          <button
            className="primary"
            onClick={() => notify("Obra enviada para revisão")}
          >
            Enviar para revisão
          </button>
        </div>
      </div>
      <div className="studio-layout">
        <aside className="step-nav">
          {steps.map(([id, n, label]) => (
            <button
              key={id}
              className={tab === id ? "active" : ""}
              onClick={() => setTab(id)}
            >
              <span>{n}</span>
              {label}
              <i>✓</i>
            </button>
          ))}
        </aside>
        <section className="panel studio-panel">
          <StudioForm tab={tab} />
        </section>
      </div>
    </main>
  );
}

function StudioForm({ tab }: { tab: string }) {
  const common = {
    obra: [
      "Título|title",
      "Subtítulo|subtitle",
      "Slug|slug",
      "Tipo de publicação|publication_type",
      "Idioma original|original_language",
      "Autor responsável|author_id",
      "Sinopse curta|short_description",
      "Sinopse completa|description",
    ],
    conteudo: [
      "Número da temporada|season_number",
      "Título da temporada|season_title",
      "Número do capítulo|chapter_number",
      "Título do capítulo|chapter_title",
      "Tempo estimado (min)|estimated_minutes",
      "Disponibilidade|access_type",
      "Conteúdo estruturado|content_json",
      "Resumo do capítulo|chapter_summary",
      "Data de liberação|release_at",
      "Status editorial|editorial_status",
    ],
    classificacao: [
      "Gênero principal|primary_genre_id",
      "Gêneros secundários|secondary_genre_ids",
      "Tropes|trope_ids",
      "Tags de busca|tags",
      "Classificação etária|age_rating",
      "Motivos da classificação|age_rating_reasons",
      "Avisos de conteúdo|content_warnings",
      "Emoções predominantes|mood_tags",
    ],
    midia: [
      "Capa principal|cover_asset_id",
      "Banner horizontal|hero_asset_id",
      "Arquivo de audiobook|audio_asset_id",
      "Narrador(a)|narrator_name",
      "Duração do áudio|audio_duration_seconds",
      "Trilha sonora|soundtrack_asset_id",
      "Eventos imersivos|immersive_events_json",
    ],
    comercial: [
      "Modelo de acesso|monetization_model",
      "Preço de venda (R$)|price_brl",
      "Preço promocional (R$)|sale_price_brl",
      "Créditos para desbloqueio|credits_price",
      "Capítulos gratuitos|free_chapters_count",
      "Percentual de royalties|royalty_rate",
      "Início da promoção|sale_starts_at",
      "Fim da promoção|sale_ends_at",
      "SKU interno|sku",
      "ID Apple|apple_product_id",
      "ID Google|google_product_id",
      "ID pagamento web|web_product_id",
    ],
    direitos: [
      "Titular dos direitos|rights_holder_name",
      "CPF/CNPJ do titular|rights_holder_document",
      "Contrato|contract_id",
      "Tipo de licença|license_type",
      "Territórios autorizados|territories",
      "Idiomas autorizados|licensed_languages",
      "Início da licença|license_starts_at",
      "Fim da licença|license_ends_at",
      "ISBN|isbn",
      "Registro autoral|copyright_registration",
      "Documentos comprobatórios|rights_documents_asset_ids",
      "Observações jurídicas|legal_notes",
    ],
    publicacao: [
      "Status|status",
      "Data de publicação|published_at",
      "Visibilidade|visibility",
      "Destaque editorial|featured_position",
      "Regiões de lançamento|release_regions",
      "Campanha associada|campaign_id",
      "SEO title|seo_title",
      "SEO description|seo_description",
    ],
  };
  const titles: Record<string, [string, string, string]> = {
    obra: [
      "01",
      "Dados da obra",
      "Informações principais exibidas no catálogo.",
    ],
    conteudo: [
      "02",
      "Estrutura e conteúdo",
      "Temporadas, capítulos e blocos do Reader.",
    ],
    classificacao: [
      "03",
      "Classificação e descoberta",
      "Busca, recomendação, segurança e controle parental.",
    ],
    midia: ["04", "Capa, áudio e imersão", "Ativos visuais e sonoros da obra."],
    comercial: ["05", "Configuração comercial", "Acesso, preço e remuneração."],
    direitos: [
      "06",
      "Direitos e contratos",
      "Governança obrigatória antes da publicação.",
    ],
    publicacao: [
      "07",
      "Revisão e publicação",
      "Checklist, visibilidade e lançamento.",
    ],
  };
  return (
    <>
      <PanelTitle
        step={titles[tab][0]}
        title={titles[tab][1]}
        text={titles[tab][2]}
      />
      <div className="form-grid">
        {common[tab].map((s, i) => {
          const [label, name] = s.split("|");
          const isLong =
            /description|content_json|summary|warnings|mood|events|notes/.test(
              name,
            );
          const type = /(_at|_date|starts|ends)/.test(name)
            ? "date"
            : /(price|number|count|rate|duration|position)/.test(name)
              ? "number"
              : "text";
          return (
            <Field key={name} label={label} name={name} type={type}>
              {isLong ? (
                <textarea
                  name={name}
                  rows={4}
                  placeholder={`Informe ${label.toLowerCase()}`}
                />
              ) : undefined}
            </Field>
          );
        })}
        <div className="full consent">
          <label>
            <input type="checkbox" name={`${tab}_verified`} /> Informações desta
            etapa verificadas.
          </label>
          <label>
            <input type="checkbox" name={`${tab}_approved`} /> Etapa aprovada
            para publicação.
          </label>
        </div>
        {tab === "publicacao" && (
          <div className="full checklist">
            <h4>Checklist obrigatório</h4>
            {[
              "Texto revisado",
              "Continuidade validada",
              "Capa aprovada",
              "Áudio validado",
              "Direitos confirmados",
              "Classificação revisada",
              "Preço conferido",
              "QA concluído",
            ].map((x, i) => (
              <label key={x}>
                <input type="checkbox" name={`check_${i}`} /> {x}
              </label>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function PanelTitle({
  step,
  title,
  text,
}: {
  step: string;
  title: string;
  text: string;
}) {
  return (
    <div className="panel-title">
      <span>{step}</span>
      <div>
        <h2>{title}</h2>
        <p>{text}</p>
      </div>
    </div>
  );
}

function Admin({ go }: { go: (v: View) => void }) {
  return (
    <main className="admin">
      <aside className="admin-nav">
        <div className="brand inverse">
          <span>S</span>
          <b>Sambu</b>
          <small>Admin</small>
        </div>
        <p>GESTÃO</p>
        {[
          "Visão geral",
          "Catálogo",
          "Autores",
          "Leitores",
          "Assinaturas",
          "Financeiro",
          "Curadoria",
          "Moderação",
          "Analytics",
          "Configurações",
        ].map((x, i) => (
          <button key={x} className={i === 0 ? "active" : ""}>
            {x}
            <span>›</span>
          </button>
        ))}
        <button onClick={() => go("home")}>← Voltar ao aplicativo</button>
      </aside>
      <section className="admin-main">
        <div className="admin-head">
          <div>
            <p className="eyebrow coral">PAINEL ADMINISTRATIVO</p>
            <h1>Visão geral</h1>
          </div>
          <button className="primary">+ Nova obra</button>
        </div>
        <div className="kpi-grid">
          <Kpi label="Receita recorrente" value="R$ 84.620" />
          <Kpi label="Assinantes ativos" value="3.284" />
          <Kpi label="Leitores ativos" value="18.943" />
          <Kpi label="Conclusão média" value="68,2%" />
        </div>
        <div className="admin-grid">
          <section className="admin-card wide">
            <div className="card-head">
              <h3>Obras recentes</h3>
              <button>Ver catálogo →</button>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Obra</th>
                  <th>Autor</th>
                  <th>Status</th>
                  <th>Leituras</th>
                  <th>Receita</th>
                </tr>
              </thead>
              <tbody>
                {BOOKS.slice(0, 4).map((b, i) => (
                  <tr key={b.id}>
                    <td>
                      <span
                        className="mini-cover"
                        style={{ background: b.color }}
                      />{" "}
                      <b>{b.title}</b>
                    </td>
                    <td>{b.author}</td>
                    <td>
                      <span className="table-status">
                        {i === 2 ? "Em revisão" : b.status}
                      </span>
                    </td>
                    <td>{b.reads}</td>
                    <td>R$ {(8420 - i * 930).toLocaleString("pt-BR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <section className="admin-card">
            <div className="card-head">
              <h3>Fila editorial</h3>
              <span>12 pendências</span>
            </div>
            {[
              "Revisão de conteúdo",
              "Direitos pendentes",
              "QA de audiobook",
              "Classificação etária",
            ].map((x, i) => (
              <div className="queue" key={x}>
                <span>{i + 2}</span>
                <div>
                  <b>{x}</b>
                  <small>Prioridade {i < 2 ? "alta" : "normal"}</small>
                </div>
                <button>→</button>
              </div>
            ))}
          </section>
          <section className="admin-card">
            <div className="card-head">
              <h3>Novos cadastros</h3>
            </div>
            <div className="donut">
              <b>+1.284</b>
              <span>usuários</span>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

function AdminV2({ go }: { go: (v: View) => void }) {
  const [tab, setTab] = useState("Visão geral"),
    [creating, setCreating] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const nav = [
    "Visão geral",
    "Catálogo",
    "Importação",
    "Autores",
    "Leitores",
    "Assinaturas",
    "Curadoria",
    "Analytics",
    "Configurações",
  ];
  async function createBook(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    const form = e.currentTarget,
      data = new FormData(form);
    const payload = {
      title: data.get("title"),
      subtitle: data.get("subtitle"),
      author: data.get("author"),
      genre: data.get("genre"),
      language: data.get("language"),
      isbn: data.get("isbn"),
      collection: data.get("collection"),
      format: data.get("format"),
      ageRating: data.get("ageRating"),
      description: data.get("description"),
      price: Number(data.get("price")),
      subscribersOnly: data.get("subscribersOnly") === "on",
      featured: data.get("featured") === "on",
      freeChapters: Number(data.get("freeChapters") || 1),
      status: data.get("status"),
    };
    const response = await fetch("/api/admin/books", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(
        response.status === 401
          ? "Entre na conta administrativa para cadastrar."
          : "Revise os campos obrigatórios.",
      );
      setBusy(false);
      return;
    }
    for (const kind of ["cover", "epub", "audio"]) {
      const file = data.get(kind);
      if (file instanceof File && file.size) {
        const media = new FormData();
        media.set("file", file);
        media.set("kind", kind);
        media.set("bookId", result.book.id);
        await fetch("/api/media", { method: "POST", body: media });
      }
    }
    setMessage("Obra criada e arquivos enviados para processamento.");
    setBusy(false);
    setCreating(false);
    form.reset();
  }
  return (
    <main className="admin admin-v2">
      <aside className="admin-nav">
        <div className="brand inverse">
          <span>S</span>
          <b>Sambu</b>
          <small>Admin</small>
        </div>
        <p>OPERAÇÃO</p>
        {nav.map((x) => (
          <button
            key={x}
            className={tab === x ? "active" : ""}
            onClick={() => setTab(x)}
          >
            {x}
            <span>›</span>
          </button>
        ))}
        <button onClick={() => go("home")}>← Voltar ao aplicativo</button>
      </aside>
      <section className="admin-main">
        <div className="admin-head">
          <div>
            <p className="eyebrow coral">CENTRAL DE CONTEÚDO</p>
            <h1>{tab}</h1>
          </div>
          <button className="primary" onClick={() => setCreating(true)}>
            + Nova obra
          </button>
        </div>
        {tab === "Visão geral" && (
          <>
            <div className="kpi-grid">
              <Kpi label="Obras no catálogo" value={String(BOOKS.length)} />
              <Kpi label="Em revisão" value="3" />
              <Kpi label="Capítulos publicados" value="48" />
              <Kpi label="Conclusão média" value="68,2%" />
            </div>
            <div className="admin-grid">
              <section className="admin-card wide">
                <div className="card-head">
                  <h3>Catálogo editorial</h3>
                  <button onClick={() => setTab("Catálogo")}>
                    Gerenciar →
                  </button>
                </div>
                <AdminBooks />
              </section>
              <AdminPipeline />
              <section className="admin-card">
                <div className="card-head">
                  <h3>Infraestrutura MVP</h3>
                </div>
                <div className="infra-list">
                  {[
                    "Banco de dados ativo",
                    "Armazenamento de mídia",
                    "Contas identificadas",
                    "Progresso sincronizado",
                    "APIs de catálogo",
                  ].map((x) => (
                    <span key={x}>✓ {x}</span>
                  ))}
                </div>
              </section>
            </div>
          </>
        )}
        {tab === "Catálogo" && (
          <section className="admin-card">
            <div className="card-head">
              <div>
                <h3>Obras e séries</h3>
                <small>{BOOKS.length} títulos iniciais</small>
              </div>
              <button className="primary" onClick={() => setCreating(true)}>
                Cadastrar obra
              </button>
            </div>
            <AdminBooks full />
          </section>
        )}
        {tab === "Importação" && <ImportCenter notify={setMessage} />}
        {tab === "Autores" && (
          <AdminModule
            title="Gestão de autores"
            text="Cadastros, contratos, direitos, royalties e obras vinculadas."
            stats={[
              "10 autores ativos",
              "3 contratos pendentes",
              "2 propostas em análise",
            ]}
          />
        )}{" "}
        {tab === "Leitores" && (
          <AdminModule
            title="Leitores e perfis"
            text="Perfis, preferências, biblioteca, progresso e solicitações LGPD."
            stats={[
              "18.943 leitores",
              "4.286 ativos na semana",
              "68% de retenção",
            ]}
          />
        )}{" "}
        {tab === "Assinaturas" && <CommercialRules />}{" "}
        {tab === "Curadoria" && (
          <AdminModule
            title="Curadoria da home"
            text="Organize destaques, rankings, coleções emocionais e lançamentos."
            stats={["4 vitrines ativas", "10 títulos elegíveis", "2 campanhas"]}
          />
        )}{" "}
        {tab === "Analytics" && (
          <AdminModule
            title="Analytics editorial"
            text="Leituras, conclusão, favoritos, abandono e desempenho por capítulo."
            stats={["68,2% conclusão", "14h leitura média", "4,9 avaliação"]}
          />
        )}{" "}
        {tab === "Configurações" && (
          <AdminModule
            title="Configurações e permissões"
            text="Funções de administrador, curador, autor, revisor e leitor."
            stats={[
              "5 perfis de acesso",
              "Logs habilitados",
              "LGPD estruturada",
            ]}
          />
        )}{" "}
        {message && <div className="admin-message">{message}</div>}
      </section>
      {creating && (
        <div className="modal-backdrop" onClick={() => setCreating(false)}>
          <section className="book-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <p className="eyebrow coral">NOVA OBRA</p>
                <h2>Cadastrar conteúdo</h2>
              </div>
              <button onClick={() => setCreating(false)}>×</button>
            </div>
            <form className="form-grid" onSubmit={createBook}>
              <Field label="Título" name="title" required />
              <Field label="Subtítulo" name="subtitle" />
              <Field label="Autor" name="author" required />
              <Field label="Gênero" name="genre" required />
              <Field label="Idioma" name="language">
                <select name="language">
                  <option value="pt-BR">Português</option>
                  <option value="en">Inglês</option>
                  <option value="es">Espanhol</option>
                </select>
              </Field>
              <Field label="ISBN" name="isbn" />
              <Field label="Coleção" name="collection" />
              <Field label="Formato" name="format">
                <select name="format">
                  <option>Ebook</option>
                  <option>Ebook + áudio</option>
                  <option>Série imersiva</option>
                  <option>Audiobook</option>
                  <option>EPUB</option>
                  <option>PDF</option>
                </select>
              </Field>
              <Field label="Classificação" name="ageRating">
                <select name="ageRating">
                  <option>Livre</option>
                  <option>12</option>
                  <option>14</option>
                  <option>16</option>
                  <option>18</option>
                </select>
              </Field>
              <Field label="Preço (R$)" name="price" type="number" />
              <Field
                label="Capítulos gratuitos"
                name="freeChapters"
                type="number"
              >
                <input
                  name="freeChapters"
                  type="number"
                  min="0"
                  defaultValue="1"
                />
              </Field>
              <Field label="Status" name="status">
                <select name="status">
                  <option value="draft">Rascunho</option>
                  <option value="review">Em revisão</option>
                  <option value="scheduled">Agendado</option>
                  <option value="published">Publicado</option>
                </select>
              </Field>
              <Field label="Sinopse" name="description" required>
                <textarea name="description" rows={5} />
              </Field>
              <div className="media-fields">
                <label>
                  <span>Capa</span>
                  <input
                    name="cover"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                  />
                  <small>PNG, JPG ou WebP · até 8 MB</small>
                </label>
                <label>
                  <span>Livro digital</span>
                  <input
                    name="epub"
                    type="file"
                    accept=".epub,.pdf,application/epub+zip,application/pdf"
                  />
                  <small>EPUB · até 40 MB</small>
                </label>
                <label>
                  <span>Áudio</span>
                  <input
                    name="audio"
                    type="file"
                    accept="audio/mpeg,audio/mp4"
                  />
                  <small>MP3 ou M4A · até 250 MB</small>
                </label>
              </div>
              <label className="full premium-check">
                <input type="checkbox" name="subscribersOnly" /> Disponível
                exclusivamente para assinantes
              </label>
              <label className="full premium-check">
                <input type="checkbox" name="featured" /> Destacar como
                lançamento
              </label>
              <div className="full modal-actions">
                <button
                  type="button"
                  className="outline"
                  onClick={() => setCreating(false)}
                >
                  Cancelar
                </button>
                <button className="primary" disabled={busy}>
                  {busy ? "Enviando…" : "Criar obra"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}

function AdminBooks({ full = false }: { full?: boolean }) {
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [editing, setEditing] = useState<Record<string, any> | null>(null);
  const [busy, setBusy] = useState(false);
  async function loadBooks() {
    const response = await fetch("/api/admin/books");
    if (response.ok) {
      const data = await response.json();
      setRows(full ? data.books || [] : (data.books || []).slice(0, 5));
    }
  }
  useEffect(() => {
    loadBooks().catch(() => undefined);
  }, [full]);

  async function saveBook(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    setBusy(true);
    const data = new FormData(event.currentTarget);
    const payload = {
      id: editing.id,
      title: data.get("title"),
      subtitle: data.get("subtitle"),
      author: data.get("author"),
      genre: data.get("genre"),
      language: data.get("language"),
      isbn: data.get("isbn"),
      collection: data.get("collection"),
      format: data.get("format"),
      ageRating: data.get("ageRating"),
      description: data.get("description"),
      price: Number(data.get("price")),
      freeChapters: Number(data.get("freeChapters")),
      subscribersOnly: data.get("subscribersOnly") === "on",
      featured: data.get("featured") === "on",
      status: data.get("status"),
    };
    const response = await fetch("/api/admin/books", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (response.ok) {
      for (const kind of ["cover", "epub", "audio"]) {
        const file = data.get(kind);
        if (file instanceof File && file.size) {
          const media = new FormData();
          media.set("file", file);
          media.set("kind", kind);
          media.set("bookId", editing.id);
          await fetch("/api/media", { method: "POST", body: media });
        }
      }
      setEditing(null);
      await loadBooks();
    }
    setBusy(false);
  }

  return (
    <div className="admin-table-wrap catalog-manager">
      <table>
        <thead>
          <tr>
            <th>Obra</th>
            <th>Autoria</th>
            <th>Formato</th>
            <th>Status</th>
            <th>Preço</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((b) => (
            <tr key={b.id}>
              <td>
                <img
                  className="mini-cover"
                  src={coverUrlFor(b.id)}
                  alt=""
                  loading="lazy"
                />
                <b>{b.title}</b>
              </td>
              <td>{b.author}</td>
              <td>{b.format}</td>
              <td>
                <span className="table-status">{b.status}</span>
              </td>
              <td>
                R$ {((b.priceCents || 0) / 100).toFixed(2).replace(".", ",")}
              </td>
              <td>
                <button
                  className="outline table-action"
                  onClick={() => setEditing(b)}
                >
                  Editar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && (
        <p className="table-empty">Nenhuma obra cadastrada no banco.</p>
      )}
      {editing && (
        <div className="modal-backdrop" onClick={() => setEditing(null)}>
          <section
            className="book-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-head">
              <div>
                <p className="eyebrow coral">GESTÃO DO ACERVO</p>
                <h2>Editar obra</h2>
              </div>
              <button onClick={() => setEditing(null)}>×</button>
            </div>
            <form className="form-grid" onSubmit={saveBook}>
              <Field label="Título" name="title" required>
                <input name="title" defaultValue={editing.title} required />
              </Field>
              <Field label="Subtítulo" name="subtitle">
                <input name="subtitle" defaultValue={editing.subtitle || ""} />
              </Field>
              <Field label="Autor" name="author" required>
                <input name="author" defaultValue={editing.author} required />
              </Field>
              <Field label="Gênero/categoria" name="genre" required>
                <input name="genre" defaultValue={editing.genre} required />
              </Field>
              <Field label="Idioma" name="language">
                <select
                  name="language"
                  defaultValue={editing.language || "pt-BR"}
                >
                  <option value="pt-BR">Português</option>
                  <option value="en">Inglês</option>
                  <option value="es">Espanhol</option>
                </select>
              </Field>
              <Field label="ISBN" name="isbn">
                <input name="isbn" defaultValue={editing.isbn || ""} />
              </Field>
              <Field label="Coleção" name="collection">
                <input
                  name="collection"
                  defaultValue={editing.collection || ""}
                />
              </Field>
              <Field label="Formato" name="format">
                <select name="format" defaultValue={editing.format || "EPUB"}>
                  <option>EPUB</option>
                  <option>PDF</option>
                  <option>Ebook + áudio</option>
                </select>
              </Field>
              <Field label="Classificação" name="ageRating">
                <select
                  name="ageRating"
                  defaultValue={editing.ageRating || "14"}
                >
                  <option>Livre</option>
                  <option>12</option>
                  <option>14</option>
                  <option>16</option>
                  <option>18</option>
                </select>
              </Field>
              <Field label="Preço (R$)" name="price" type="number">
                <input
                  name="price"
                  type="number"
                  step="0.01"
                  defaultValue={(editing.priceCents || 0) / 100}
                />
              </Field>
              <Field
                label="Capítulos gratuitos"
                name="freeChapters"
                type="number"
              >
                <input
                  name="freeChapters"
                  type="number"
                  min="0"
                  defaultValue={editing.freeChapters || 1}
                />
              </Field>
              <Field label="Status" name="status">
                <select name="status" defaultValue={editing.status}>
                  <option value="draft">Rascunho</option>
                  <option value="review">Em revisão</option>
                  <option value="published">Publicado</option>
                  <option value="archived">Despublicado</option>
                </select>
              </Field>
              <Field label="Descrição" name="description" required>
                <textarea
                  name="description"
                  rows={5}
                  defaultValue={editing.description}
                  required
                />
              </Field>
              <div className="media-fields">
                <label>
                  <span>Substituir capa</span>
                  <input
                    name="cover"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                  />
                </label>
                <label>
                  <span>Substituir livro</span>
                  <input
                    name="epub"
                    type="file"
                    accept=".epub,.pdf,application/epub+zip,application/pdf"
                  />
                </label>
                <label>
                  <span>Substituir áudio</span>
                  <input
                    name="audio"
                    type="file"
                    accept="audio/mpeg,audio/mp4"
                  />
                </label>
              </div>
              <label className="full premium-check">
                <input
                  type="checkbox"
                  name="subscribersOnly"
                  defaultChecked={editing.subscribersOnly}
                />{" "}
                Exclusivo para assinantes
              </label>
              <label className="full premium-check">
                <input
                  type="checkbox"
                  name="featured"
                  defaultChecked={editing.featured}
                />{" "}
                Destacar como lançamento
              </label>
              <div className="full modal-actions">
                <button
                  type="button"
                  className="outline"
                  onClick={() => setEditing(null)}
                >
                  Cancelar
                </button>
                <button className="primary" disabled={busy}>
                  {busy ? "Salvando…" : "Salvar alterações"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

type ImportBatch = {
  id: string;
  name: string;
  source: string;
  status: string;
  totalItems: number;
  validItems: number;
  errorItems: number;
  expiresAt: string | null;
};
type StagedBook = {
  id: string;
  title: string;
  author: string;
  genre: string | null;
  language: string;
  description: string | null;
  source: string | null;
  licenseType: string | null;
  fileName: string | null;
  contentType: string | null;
  fileSize: number | null;
  coverKey: string | null;
  rightsConfirmed: boolean;
  reviewedBy: string | null;
  reviewedAt: string | null;
  correctionNote: string | null;
  publishedBookId: string | null;
  status: string;
};

function ImportCenter({ notify }: { notify: (message: string) => void }) {
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [items, setItems] = useState<StagedBook[]>([]);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"individual" | "batch">("individual");
  const [folderPath, setFolderPath] = useState("");
  const [selected, setSelected] = useState<StagedBook | null>(null);

  async function load() {
    const response = await fetch("/api/admin/imports");
    if (!response.ok) return;
    const data = await response.json();
    setBatches(data.batches || []);
    setItems(data.items || []);
  }
  useEffect(() => {
    load().catch(() => undefined);
  }, []);

  async function importBatch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const form = event.currentTarget;
    const response = await fetch("/api/admin/imports", {
      method: "POST",
      body: new FormData(form),
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      notify(
        mode === "individual"
          ? `Livro recebido: ${data.batch.validItems} válido e ${data.batch.errorItems} para revisar.`
          : `Lote recebido: ${data.batch.validItems} válidos e ${data.batch.errorItems} para revisar.`,
      );
      form.reset();
      setFolderPath("");
      await load();
    } else {
      notify(
        response.status === 401
          ? "Entre na conta administrativa para importar."
          : "Não foi possível importar. Confira o modelo e os limites.",
      );
    }
    setBusy(false);
  }

  async function seed() {
    setBusy(true);
    const response = await fetch("/api/admin/imports", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "seed" }),
    });
    notify(
      response.ok
        ? "Banco temporário criado com 8 livros de demonstração."
        : "Entre na conta administrativa para criar a base de testes.",
    );
    if (response.ok) await load();
    setBusy(false);
  }

  async function clearTest() {
    if (!window.confirm("Remover todos os lotes e livros temporários?")) return;
    setBusy(true);
    const response = await fetch("/api/admin/imports", { method: "DELETE" });
    if (response.ok) {
      setBatches([]);
      setItems([]);
      notify("Banco temporário limpo com sucesso.");
    }
    setBusy(false);
  }

  async function reviewBook(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const submitter = (event.nativeEvent as SubmitEvent)
      .submitter as HTMLButtonElement | null;
    const action = submitter?.value || "draft";
    const form = new FormData(event.currentTarget);
    form.set("id", selected.id);
    form.set("action", action);
    form.set(
      "rightsConfirmed",
      form.get("rightsConfirmed") === "on" ? "true" : "false",
    );
    setBusy(true);
    const response = await fetch("/api/admin/imports", {
      method: "PATCH",
      body: form,
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      notify(
        action === "publish"
          ? "Livro publicado com sucesso. Ele já está disponível no acervo."
          : action === "correction"
            ? "Correção solicitada e registrada."
            : "Revisão salva como rascunho.",
      );
      setSelected(null);
      await load();
    } else {
      notify(
        data.error === "review_incomplete"
          ? "Preencha os campos obrigatórios e confirme os direitos de publicação."
          : data.error === "book_file_required"
            ? "O arquivo do ebook é obrigatório para publicar."
            : "Não foi possível salvar a revisão.",
      );
    }
    setBusy(false);
  }

  async function deleteBook(item: StagedBook) {
    if (!window.confirm(`Excluir a importação de “${item.title}”?`)) return;
    setBusy(true);
    const response = await fetch(
      `/api/admin/imports?id=${encodeURIComponent(item.id)}`,
      { method: "DELETE" },
    );
    if (response.ok) {
      notify("Importação excluída.");
      setSelected(null);
      await load();
    } else notify("Não foi possível excluir esta importação.");
    setBusy(false);
  }

  return (
    <section className="import-center">
      <div className="import-hero">
        <div>
          <p className="eyebrow coral">SAMBU CONTENT HUB</p>
          <h2>Importe livros no seu ritmo</h2>
          <p>
            Cadastre um livro com seus dados completos ou escolha uma pasta para
            enviar um acervo inteiro. Tudo entra primeiro em validação.
          </p>
        </div>
        <div className="test-database">
          <span>AMBIENTE ISOLADO</span>
          <b>Banco temporário</b>
          <p>Registros expiram em 7 dias e não aparecem no catálogo público.</p>
          <div>
            <button className="primary" onClick={seed} disabled={busy}>
              Gerar dados de teste
            </button>
            <button className="outline" onClick={clearTest} disabled={busy}>
              Limpar base
            </button>
          </div>
        </div>
      </div>

      <div
        className="import-mode-tabs"
        role="tablist"
        aria-label="Modo de importação"
      >
        <button
          className={mode === "individual" ? "active" : ""}
          onClick={() => setMode("individual")}
        >
          <span>01</span>
          <b>Livro individual</b>
          <small>Um título por vez</small>
        </button>
        <button
          className={mode === "batch" ? "active" : ""}
          onClick={() => setMode("batch")}
        >
          <span>02</span>
          <b>Importação em lote</b>
          <small>Selecione uma pasta</small>
        </button>
      </div>

      <div className="import-layout">
        <form className="batch-form" onSubmit={importBatch} key={mode}>
          <input type="hidden" name="mode" value={mode} />
          <div className="card-head">
            <div>
              <h3>
                {mode === "individual"
                  ? "Importar livro ou ebook"
                  : "Importar pasta de livros"}
              </h3>
              <small>
                {mode === "individual"
                  ? "EPUB, PDF ou TXT"
                  : "Pasta com CSV/JSON + arquivos"}
              </small>
            </div>
            <span className="step-badge">
              {mode === "individual" ? "1×" : "N×"}
            </span>
          </div>
          <label>
            <span>Fonte do acervo</span>
            <select name="source">
              <option>Portal Domínio Público</option>
              <option>Standard Ebooks</option>
              <option>Project Gutenberg</option>
              <option>Biblioteca Nacional</option>
              <option>Wikisource</option>
              <option>Autores parceiros</option>
            </select>
          </label>
          {mode === "individual" ? (
            <>
              <div className="individual-fields">
                <label>
                  <span>Título *</span>
                  <input name="title" required placeholder="Título da obra" />
                </label>
                <label>
                  <span>Autor *</span>
                  <input name="author" required placeholder="Nome do autor" />
                </label>
                <label>
                  <span>Gênero</span>
                  <input name="genre" placeholder="Romance, suspense…" />
                </label>
                <label>
                  <span>Idioma</span>
                  <select name="language">
                    <option value="pt-BR">Português (Brasil)</option>
                    <option value="en">Inglês</option>
                    <option value="es">Espanhol</option>
                  </select>
                </label>
                <label>
                  <span>ISBN</span>
                  <input name="isbn" placeholder="Opcional" />
                </label>
                <label>
                  <span>Licença *</span>
                  <select name="licenseType" required>
                    <option value="">Selecione</option>
                    <option>Domínio público</option>
                    <option>Autorização do autor</option>
                    <option>Contrato editorial</option>
                    <option>Creative Commons</option>
                    <option>Revisão jurídica pendente</option>
                  </select>
                </label>
              </div>
              <label>
                <span>Sinopse</span>
                <textarea
                  name="description"
                  rows={4}
                  placeholder="Resumo da obra"
                />
              </label>
              <label className="drop-field featured-drop">
                <b>Selecione o livro ou ebook *</b>
                <span>Um arquivo EPUB, PDF ou TXT de até 40 MB</span>
                <input
                  name="singleFile"
                  type="file"
                  accept=".epub,.pdf,.txt"
                  required
                />
              </label>
            </>
          ) : (
            <>
              <label>
                <span>Nome do lote</span>
                <input
                  name="name"
                  required
                  placeholder="Clássicos brasileiros — lote 01"
                />
              </label>
              <label className="drop-field folder-field">
                <b>Escolher pasta do acervo</b>
                <span>
                  Inclua a planilha CSV/JSON e até 50 arquivos EPUB, PDF ou TXT
                </span>
                <input
                  name="folderFiles"
                  type="file"
                  multiple
                  ref={(input) => {
                    if (input) input.setAttribute("webkitdirectory", "");
                  }}
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0] as
                      | (File & { webkitRelativePath?: string })
                      | undefined;
                    setFolderPath(
                      file?.webkitRelativePath?.split("/")[0] ||
                        file?.name ||
                        "",
                    );
                  }}
                />
              </label>
              <div className={`folder-path ${folderPath ? "selected" : ""}`}>
                <span>⌂ Caminho da pasta</span>
                <b>
                  {folderPath ? `/${folderPath}/` : "Nenhuma pasta selecionada"}
                </b>
                <small>
                  Por segurança, o navegador mostra apenas o caminho relativo.
                </small>
              </div>
              <details className="alternate-upload">
                <summary>Ou selecionar os arquivos separadamente</summary>
                <label className="drop-field">
                  <b>Planilha de metadados</b>
                  <input
                    name="manifest"
                    type="file"
                    accept=".csv,.json,text/csv,application/json"
                  />
                </label>
                <label className="drop-field">
                  <b>Arquivos dos livros</b>
                  <input
                    name="files"
                    type="file"
                    accept=".epub,.pdf,.txt"
                    multiple
                  />
                </label>
              </details>
              <div className="manifest-help">
                <b>Colunas aceitas</b>
                <code>
                  title, author, genre, language, description, isbn, source,
                  sourceUrl, licenseType, fileName
                </code>
              </div>
            </>
          )}
          <button className="primary import-submit" disabled={busy}>
            {busy
              ? "Processando…"
              : mode === "individual"
                ? "Validar e importar livro"
                : "Validar e importar pasta"}
          </button>
        </form>

        <div className="import-summary">
          <div className="card-head">
            <div>
              <h3>Status das importações</h3>
              <small>{batches.length} importações recentes</small>
            </div>
            <span className="step-badge">02</span>
          </div>
          {batches.length === 0 ? (
            <div className="empty-import">
              <span>⇧</span>
              <b>Nenhuma importação registrada</b>
              <p>
                Envie um livro, selecione uma pasta ou gere a base
                demonstrativa.
              </p>
            </div>
          ) : (
            <div className="batch-list">
              {batches.map((batch) => (
                <article key={batch.id}>
                  <div>
                    <div className="batch-title">
                      <b>{batch.name}</b>
                      <span className={`batch-status ${batch.status}`}>
                        {batch.status === "ready"
                          ? "Importação concluída"
                          : batch.status === "needs_review"
                            ? "Revisar pendências"
                            : "Processando"}
                      </span>
                    </div>
                    <small>{batch.source}</small>
                  </div>
                  <div className="batch-numbers">
                    <span>{batch.totalItems} itens</span>
                    <em>{batch.validItems} válidos</em>
                    {batch.errorItems > 0 && <i>{batch.errorItems} revisar</i>}
                  </div>
                  <div className="batch-progress">
                    <i
                      style={{
                        width: `${batch.totalItems ? (batch.validItems / batch.totalItems) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <div className="batch-footer">
                    <small>
                      {batch.status === "ready"
                        ? "Arquivo recebido e pronto para revisão editorial."
                        : batch.status === "needs_review"
                          ? "Importação finalizada, mas alguns dados precisam de correção."
                          : "Validando arquivo e metadados…"}
                    </small>
                    {batch.status !== "processing" && (
                      <button
                        type="button"
                        className="outline compact"
                        onClick={() =>
                          document
                            .getElementById("staged-books")
                            ?.scrollIntoView({ behavior: "smooth" })
                        }
                      >
                        {batch.status === "ready"
                          ? "Revisar ebook"
                          : "Ver pendências"}
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>

      <section id="staged-books" className="admin-card staged-books">
        <div className="card-head">
          <div>
            <h3>Livros no banco temporário</h3>
            <small>Revisão de licença obrigatória antes da publicação</small>
          </div>
          <span>{items.length} registros</span>
        </div>
        <div className="admin-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Livro</th>
                <th>Fonte</th>
                <th>Licença</th>
                <th>Validação</th>
                <th>Ação</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <b>{item.title}</b>
                    <small>
                      {item.author} · {item.genre || "Sem gênero"}
                    </small>
                  </td>
                  <td>{item.source || "Não informada"}</td>
                  <td>{item.licenseType || "Pendente"}</td>
                  <td>
                    <span className={`import-status ${item.status}`}>
                      {item.status === "published"
                        ? "Publicado"
                        : item.status === "draft"
                          ? "Rascunho"
                          : item.status === "correction_requested"
                            ? "Correção solicitada"
                            : item.status === "ready"
                              ? "Pronto para revisar"
                              : "Atenção necessária"}
                    </span>
                  </td>
                  <td>
                    {item.status === "published" ? (
                      <button
                        className="outline table-action"
                        onClick={() =>
                          window.location.assign(
                            `/?view=catalog&search=${encodeURIComponent(item.title)}`,
                          )
                        }
                      >
                        Ver no acervo
                      </button>
                    ) : (
                      <button
                        className="primary table-action"
                        onClick={() => setSelected(item)}
                      >
                        Revisar ebook
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {selected && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <form className="review-modal" onSubmit={reviewBook}>
            <div className="modal-head">
              <div>
                <p className="eyebrow coral">REVISÃO EDITORIAL</p>
                <h2>{selected.title}</h2>
                <small>
                  Confira o arquivo, os metadados e os direitos antes de
                  publicar.
                </small>
              </div>
              <button type="button" onClick={() => setSelected(null)}>
                ×
              </button>
            </div>

            <div className="review-layout">
              <div className="review-fields">
                <label>
                  <span>Título *</span>
                  <input name="title" defaultValue={selected.title} required />
                </label>
                <label>
                  <span>Autor *</span>
                  <input
                    name="author"
                    defaultValue={selected.author}
                    required
                  />
                </label>
                <label>
                  <span>Gênero *</span>
                  <input
                    name="genre"
                    defaultValue={selected.genre || ""}
                    required
                  />
                </label>
                <label>
                  <span>Idioma *</span>
                  <select name="language" defaultValue={selected.language}>
                    <option value="pt-BR">Português (Brasil)</option>
                    <option value="en">Inglês</option>
                    <option value="es">Espanhol</option>
                  </select>
                </label>
                <label className="wide">
                  <span>Descrição *</span>
                  <textarea
                    name="description"
                    rows={5}
                    defaultValue={selected.description || ""}
                    required
                  />
                </label>
                <label>
                  <span>Licença *</span>
                  <input
                    name="licenseType"
                    defaultValue={selected.licenseType || ""}
                    required
                  />
                </label>
                <label>
                  <span>Capa</span>
                  <input name="cover" type="file" accept="image/*" />
                </label>
                <label className="wide">
                  <span>Observação para correção</span>
                  <textarea
                    name="correctionNote"
                    rows={2}
                    defaultValue={selected.correctionNote || ""}
                    placeholder="Descreva o que precisa ser ajustado"
                  />
                </label>
              </div>

              <aside className="file-review">
                <div className="cover-check">
                  <span>{selected.coverKey ? "✓" : "+"}</span>
                  <b>{selected.coverKey ? "Capa recebida" : "Capa pendente"}</b>
                  <small>Envie uma imagem no formulário, se necessário.</small>
                </div>
                <div className="file-check">
                  <p className="eyebrow">ARQUIVO DO LIVRO</p>
                  <b>{selected.fileName || "Arquivo não localizado"}</b>
                  <small>
                    {selected.fileSize
                      ? `${(selected.fileSize / 1024 / 1024).toFixed(1)} MB`
                      : "Tamanho não informado"}
                  </small>
                  {selected.fileName && (
                    <a
                      className="outline preview-link"
                      href={`/api/admin/imports?file=${encodeURIComponent(selected.id)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Abrir prévia do EPUB/PDF
                    </a>
                  )}
                </div>
                <label className="rights-check">
                  <input
                    type="checkbox"
                    name="rightsConfirmed"
                    defaultChecked={selected.rightsConfirmed}
                  />
                  <span>
                    <b>Direitos de publicação conferidos</b>
                    <small>
                      Confirmo que o Sambu possui autorização ou licença válida
                      para disponibilizar esta obra.
                    </small>
                  </span>
                </label>
                {selected.reviewedAt && (
                  <p className="review-audit">
                    Última revisão por <b>{selected.reviewedBy}</b> em{" "}
                    {new Date(selected.reviewedAt).toLocaleString("pt-BR")}
                  </p>
                )}
              </aside>
            </div>

            <div className="review-actions">
              <button
                type="button"
                className="danger-link"
                onClick={() => deleteBook(selected)}
                disabled={busy}
              >
                Excluir importação
              </button>
              <div>
                <button
                  type="submit"
                  name="action"
                  value="correction"
                  className="outline"
                  disabled={busy}
                >
                  Solicitar correção
                </button>
                <button
                  type="submit"
                  name="action"
                  value="draft"
                  className="outline"
                  disabled={busy}
                >
                  Salvar rascunho
                </button>
                <button
                  type="submit"
                  name="action"
                  value="publish"
                  className="primary"
                  disabled={busy}
                >
                  Aprovar e publicar
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}

function CommercialRules() {
  return (
    <section className="commercial-rules">
      <div className="admin-module commercial-intro">
        <div>
          <p className="eyebrow coral">REGRAS COMERCIAIS</p>
          <h2>Planos e controle de acesso</h2>
          <p>
            Estrutura pronta para receber o Mercado Pago. Até a integração, os
            planos podem ser reservados sem cobrança real.
          </p>
        </div>
        <div className="rule-highlights">
          <article>
            <span>7</span>
            <b>Dias de teste</b>
            <small>Somente no primeiro cadastro Imersivo.</small>
          </article>
          <article>
            <span>1</span>
            <b>Capítulo gratuito</b>
            <small>Quantidade configurável em cada obra.</small>
          </article>
          <article>
            <span>✓</span>
            <b>Compra definitiva</b>
            <small>Ebook avulso permanece na biblioteca.</small>
          </article>
        </div>
      </div>
      <div className="access-matrix admin-card">
        <div className="card-head">
          <div>
            <h3>Matriz de acesso</h3>
            <small>Política definida para a integração de pagamentos</small>
          </div>
          <span>4 modalidades</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>Modalidade</th>
              <th>Preço</th>
              <th>Acesso</th>
              <th>Cancelamento</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <b>Gratuito</b>
              </td>
              <td>R$ 0</td>
              <td>Amostras e capítulos liberados</td>
              <td>Não se aplica</td>
            </tr>
            <tr>
              <td>
                <b>Imersivo mensal</b>
              </td>
              <td>R$ 29,90/mês</td>
              <td>Catálogo ilimitado</td>
              <td>Acesso até o fim do ciclo</td>
            </tr>
            <tr>
              <td>
                <b>Imersivo anual</b>
              </td>
              <td>R$ 238,80/ano</td>
              <td>Catálogo ilimitado</td>
              <td>Acesso até o fim da vigência</td>
            </tr>
            <tr>
              <td>
                <b>Compra avulsa</b>
              </td>
              <td>A partir de R$ 9,90</td>
              <td>Livro adquirido permanentemente</td>
              <td>Conforme política de reembolso</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AdminPipeline() {
  return (
    <section className="admin-card">
      <div className="card-head">
        <h3>Fluxo editorial</h3>
        <span>8 pendências</span>
      </div>
      {[
        ["Revisão de texto", "3"],
        ["Direitos autorais", "2"],
        ["QA de áudio", "2"],
        ["Classificação", "1"],
      ].map(([x, n]) => (
        <div className="queue" key={x}>
          <span>{n}</span>
          <div>
            <b>{x}</b>
            <small>Requer validação</small>
          </div>
          <button>→</button>
        </div>
      ))}
    </section>
  );
}
function AdminModule({
  title,
  text,
  stats,
}: {
  title: string;
  text: string;
  stats: string[];
}) {
  return (
    <section className="admin-module">
      <div>
        <p className="eyebrow coral">MÓDULO OPERACIONAL</p>
        <h2>{title}</h2>
        <p>{text}</p>
      </div>
      <div>
        {stats.map((s, i) => (
          <article key={s}>
            <span>{["◈", "◎", "↗"][i]}</span>
            <b>{s}</b>
          </article>
        ))}
      </div>
      <button className="outline">Configurar módulo →</button>
    </section>
  );
}
function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <article className="kpi">
      <span>{label}</span>
      <b>{value}</b>
      <small>↗ 12,4% no mês</small>
    </article>
  );
}
