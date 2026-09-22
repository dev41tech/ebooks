"use client";
import BetaDashboard from './components/beta-dashboard';
import EditorialCheck from './components/editorial-check';
import {trackReading} from './lib/telemetry';
import PilotGuide from "./components/pilot-guide";
import Reader from "./components/reader";
import {loadReaderPage} from "./lib/reader-client";
import type {ReaderPage} from "./lib/reader-content";
import { cleanReaderProfile, type ReaderProfile } from "./lib/reader-profile";
import { apiFetch, serviceUrl } from "./lib/client-api";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type User = { name: string; email: string; admin: boolean; participant: boolean; adminTrial?:boolean } | null;
type View = "home" | "catalog" | "library" | "detail" | "reader" | "profile" | "admin" | "guide";
type Book = { id: string; title: string; author: string; genre: string; description: string; format?: string; status: string; publishedAt?: string; coverKey?: string; language?: string; };
type Location = { position: number; progress: number; revision?:number };
type ApiPayload = { recommendations?:{bookId:string;reason:string}[]; configured?:boolean; unlocked?:boolean; error?: string; message?: string; books?: Book[]; profile?: { displayName?: string; tasteProfile?:ReaderProfile }; favorites?: string[]; locations?: Record<string,Location>; batches?: ImportBatch[]; items?: StagedBook[]; uploadId?: string; chunkSize?: number; batch: { validItems:number; errorItems:number }; publishedBookId?:string; storageKey?:string; fileName?:string; contentType?:string; fileSize?:number };
const searchText=(value:string)=>value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-BR").trim().replace(/\s+/g," ");
const NAV: { id: View; label: string }[] = [{id:"home",label:"Início"},{id:"catalog",label:"Explorar"},{id:"library",label:"Minha biblioteca"}];
const messages: Record<string,string> = { title_confirmation_required:"Digite exatamente o título atual do ebook para confirmar.", master_required:"Digite a senha master para abrir a administração.", master_password_length:"Use uma senha entre 12 e 128 caracteres.", master_invalid_password:"Senha master incorreta.", master_rate_limited:"Muitas tentativas. Aguarde 15 minutos antes de tentar novamente.", master_already_configured:"A senha master já foi criada. Recarregue a página e entre com ela.", master_setup_required:"Crie a senha master no primeiro acesso.", sign_in_required:"Entre na sua conta para continuar.", invitation_required:"Esta conta ainda não está na lista de participantes do beta.", admin_required:"Esta área é exclusiva da administração.", invalid_book_content:"O arquivo não pôde ser lido. Confira o EPUB (até 32 MB) ou PDF antes de publicar.", review_required:"Publique esta obra pela revisão da importação.", published_import_protected:"Esta importação possui uma obra vinculada. Seus arquivos estão protegidos.", book_file_required:"Selecione um arquivo válido para o livro.", review_incomplete:"Confira os dados e confirme os direitos para publicar." };
async function requestJson(url: string, options?: RequestInit) {
  const response = await apiFetch(url, options);
  const data = await response.json().catch(() => ({error:"invalid_response"})) as ApiPayload;
  if(data.error === "master_required") window.dispatchEvent(new Event("sambu-master-locked"));
  if (!response.ok || data.error) throw new Error(messages[data.error || ""] || data.message || "Não foi possível concluir. Tente novamente.");
  return data;
}
function Cover({book}:{book:Book}) {
  const [failed,setFailed] = useState(false);
  useEffect(()=>setFailed(false),[book.id]);
  return <div className="beta-cover">{failed ? <span>{book.title}<small>{book.author}</small></span> : <img src={serviceUrl(`/api/catalog/cover?id=${encodeURIComponent(book.id)}`)} alt={`Capa de ${book.title}`} loading="lazy" onError={()=>setFailed(true)}/>}</div>;
}
function BookCard({book,onOpen,onFavorite,saved}:{book:Book;onOpen:()=>void;onFavorite:()=>void;saved:boolean}) {
  return <article className="book-card beta-card"><button className="book-open" onClick={onOpen}><Cover book={book}/><h3>{book.title}</h3><p>{book.author}</p><small>{book.genre}</small></button><button className="favorite-control" aria-label={`${saved ? "Remover dos" : "Adicionar aos"} favoritos: ${book.title}`} aria-pressed={saved} onClick={onFavorite}>{saved ? "♥" : "♡"}</button></article>;
}
export default function SambuApp({user}:{user:User}) {
  const [view,setView] = useState<View>("home");
  const booksRef = useRef<Book[]>([]);
  const [books,setBooks] = useState<Book[]>([]), [selected,setSelected] = useState<Book|null>(null);
  const [readerPage,setReaderPage] = useState<ReaderPage|null>(null), [favorites,setFavorites] = useState<string[]>([]);
  const [libraryLoading,setLibraryLoading]=useState(!!user?.participant),[libraryError,setLibraryError]=useState("");
  const [locations,setLocations] = useState<Record<string,Location>>({});
  const [query,setQuery] = useState(""), [genre,setGenre] = useState("Todos"), [sort,setSort] = useState("recent");
  const [loading,setLoading] = useState(true), [error,setError] = useState(""), [toast,setToast] = useState("");
  const [openingBookId,setOpeningBookId] = useState<string|null>(null), [favoriteBusy,setFavoriteBusy] = useState(false);
  const readingBusy=openingBookId!==null;
  const readingLock=useRef(false);
  const openingRequest=useRef<AbortController|null>(null);
  const cancelOpening=useCallback(()=>{
    openingRequest.current?.abort();openingRequest.current=null;
    readingLock.current=false;setOpeningBookId(null);
  },[]);
  const [theme,setTheme] = useState("sepia"), [font,setFont] = useState(20);
  const toastTimer = useRef<ReturnType<typeof setTimeout>|null>(null);
  const notify = useCallback((text:string)=>{setToast(text);if(toastTimer.current)clearTimeout(toastTimer.current);toastTimer.current=setTimeout(()=>setToast(""),6000);},[]);
  const lastSearch=useRef("");
  const rememberSearch=useCallback((value:string)=>{
    const query=value.trim().slice(0,100);if(!user?.participant||query.length<2||lastSearch.current===query)return;
    lastSearch.current=query;
    requestJson("/api/recommendations",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({query})}).catch(()=>{lastSearch.current="";});
  },[user?.email,user?.participant]);
  useEffect(()=>{if(view!=="catalog"||query.trim().length<2)return;const timer=setTimeout(()=>rememberSearch(query),1000);return()=>clearTimeout(timer);},[query,view,rememberSearch]);
  const navigate = useCallback((next:View,book?:Book)=>{
    if(next!=="reader")cancelOpening();
    setView(next); if(book)setSelected(book);
    const url = new URL(window.location.href);url.search="";url.searchParams.set("view",next);
    if(book)url.searchParams.set("book",book.id);
    if (url.href !== window.location.href) window.history.pushState({},"",url);window.scrollTo(0,0);
  },[cancelOpening]);
  const load = useCallback(async()=>{
    setLoading(true);setError("");
    try { const data=await requestJson("/api/catalog");setBooks(data.books||[]);booksRef.current=data.books||[];return data.books as Book[]; }
    catch(e){setError((e as Error).message);return null;}
    finally{setLoading(false);}
  },[]);
  const loadLibrary=useCallback(async()=>{
    if(!user?.participant)return;
    setLibraryLoading(true);setLibraryError("");
    try{const [saved,progress]=await Promise.all([requestJson("/api/favorites",{cache:"no-store"}),requestJson("/api/progress",{cache:"no-store"})]);setFavorites(saved.favorites||[]);setLocations(progress.locations||{});}
    catch{setLibraryError("Não foi possível atualizar sua biblioteca. Suas leituras continuam guardadas na conta.");}
    finally{setLibraryLoading(false);}
  },[user?.email,user?.participant]);
  const startReading = useCallback(async(book:Book)=>{
    if(!user){notify("Entre na sua conta para ler.");navigate("profile");return;}
    if(!user.participant){notify(messages.invitation_required);navigate("profile");return;}
    if(readingLock.current)return;
    readingLock.current=true;setOpeningBookId(book.id);
    const controller=new AbortController();openingRequest.current=controller;
    const timeout=setTimeout(()=>controller.abort(),30000);
    try {
      const progress=await requestJson("/api/progress",{cache:"no-store",signal:controller.signal});if(openingRequest.current!==controller)return;setLocations(progress.locations||{});
      if(book.format?.toUpperCase().includes("PDF")){setReaderPage(null);navigate("reader",book);}
      else {const page=await loadReaderPage(book.id,{position:progress.locations?.[book.id]?.position||0},controller.signal);if(openingRequest.current!==controller)return;setReaderPage(page);navigate("reader",book);}
    }catch(e){if(openingRequest.current!==controller)return;trackReading('reader_open_failed',book.id);notify(controller.signal.aborted?"A abertura demorou mais que o esperado. Verifique sua conexão e tente novamente.":(e as Error).message);}finally{clearTimeout(timeout);if(openingRequest.current===controller){openingRequest.current=null;readingLock.current=false;setOpeningBookId(null);}}
  },[user,navigate,notify]);
  useEffect(()=>{
    let active=true;
    if(new URLSearchParams(window.location.search).get("view")==="guide")setView("guide");
    const restore=async()=>{
      const rows=await load();if(!active||!rows)return;
      await loadLibrary();if(!active)return;
      const params=new URLSearchParams(window.location.search);const target=params.get("view") as View;
      const book=rows.find(b=>b.id===params.get("book"));
      if(book){setSelected(book);if(target==="reader")await startReading(book);else setView("detail");}
      else if(["catalog","library","profile","admin","guide"].includes(target))setView(target);
      if(params.get("search"))setQuery(params.get("search")!);
    };
    restore();
    try{const stored=JSON.parse(localStorage.getItem(`sambu:reader:${user?.email||"guest"}`)||"{}");if(["light","sepia","dark"].includes(stored.theme))setTheme(stored.theme);if(stored.font>=16&&stored.font<=32)setFont(stored.font);}catch{}
    const pop=async()=>{cancelOpening();const p=new URLSearchParams(window.location.search);const next=p.get("view") as View;const book=booksRef.current.find(b=>b.id===p.get("book"));if(book&&(next==="detail"||next==="reader")){if(next==="reader")await startReading(book);else{setSelected(book);setView("detail");}}else setView(["home","catalog","library","profile","admin","guide"].includes(next)?next:"home");};
    window.addEventListener("popstate",pop);return()=>{active=false;cancelOpening();window.removeEventListener("popstate",pop);};
  // Initialization runs once per authenticated identity.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[user?.email]);
  function preference(nextTheme:string,nextFont:number){setTheme(nextTheme);setFont(nextFont);try{localStorage.setItem(`sambu:reader:${user?.email||"guest"}`,JSON.stringify({theme:nextTheme,font:nextFont}));}catch{notify("Não foi possível guardar a preferência neste aparelho.");}}
  async function favorite(id:string){
    if(!user?.participant){navigate("profile");notify(user?messages.invitation_required:messages.sign_in_required);return;}
    if(favoriteBusy)return;setFavoriteBusy(true);
    try{const value=!favorites.includes(id);await requestJson("/api/favorites",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({bookId:id,favorite:value})});setFavorites(v=>value?[...v,id]:v.filter(x=>x!==id));notify(value?"Livro salvo na biblioteca.":"Livro removido dos favoritos.");}catch(e){notify((e as Error).message);}finally{setFavoriteBusy(false);}
  }
  useEffect(()=>{if(!user?.participant||view==="reader")return;const refresh=()=>{if(document.visibilityState==="visible")void loadLibrary();};window.addEventListener("focus",refresh);document.addEventListener("visibilitychange",refresh);if(view==="library")refresh();return()=>{window.removeEventListener("focus",refresh);document.removeEventListener("visibilitychange",refresh);};},[user?.participant,view,loadLibrary]);
  const save = useCallback(async(bookId:string,location:Location):Promise<Location>=>{
    const response=await apiFetch("/api/progress",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({bookId,...location}),keepalive:true,cache:"no-store"});
    const data=await response.json() as {location?:Location};
    if(response.status===409&&data.location){setLocations(current=>({...current,[bookId]:data.location!}));throw Object.assign(new Error("Leitura atualizada em outro dispositivo."),{location:data.location});}
    if(!response.ok||!data.location)throw new Error("Não foi possível salvar a leitura.");
    setLocations(current=>({...current,[bookId]:data.location!}));return data.location;
  },[]);
  const filtered=useMemo(()=>books.filter(b=>(genre==="Todos"||b.genre===genre)&&searchText(`${b.title} ${b.author} ${b.genre}`).includes(searchText(query))).sort((a,b)=>sort==="title"?a.title.localeCompare(b.title,"pt-BR"):(b.publishedAt||"").localeCompare(a.publishedAt||"")),[books,query,genre,sort]);
  const cards=(list:Book[])=><div className="book-grid">{list.map(book=><BookCard key={book.id} book={book} saved={favorites.includes(book.id)} onOpen={()=>navigate("detail",book)} onFavorite={()=>favorite(book.id)}/>)}</div>;
  return <div className="app-shell beta-app">
    {view!=="reader"&&<header><button className="brand community-brand" onClick={()=>navigate("home")} aria-label="Início Sambu"><img src="/sambu-comunidade-horizontal.webp" alt="Sambu — Comunidade de leitura" width="640" height="256"/></button><nav aria-label="Navegação principal">{NAV.map(item=><button key={item.id} className={view===item.id?"active":""} onClick={()=>navigate(item.id)}>{item.label}</button>)}{user?.admin&&<button onClick={()=>navigate("admin")}>Administração</button>}</nav><button className="outline" onClick={()=>navigate("profile")}>{user?"Minha conta":"Entrar"}</button></header>}
    {view!=="reader"&&<div className="beta-banner">Versão beta · leitura gratuita · registramos uso e falhas de leitura para melhorar o aplicativo · <button className="pilot-guide-link" onClick={()=>navigate("guide")}>Como participar</button></div>}
    {view!=="reader"&&<nav className="beta-mobile-nav" aria-label="Navegação móvel">{NAV.map(x=><button key={x.id} aria-current={view===x.id?"page":undefined} onClick={()=>navigate(x.id)}>{x.id==="library"?"Biblioteca":x.label}</button>)}<button aria-current={view==="profile"?"page":undefined} onClick={()=>navigate("profile")}>Conta</button>{user?.admin&&<button aria-current={view==="admin"?"page":undefined} onClick={()=>navigate("admin")}>Admin</button>}</nav>}
    {view==="home"&&<BetaHome books={books} user={user} loading={loading} error={error} retry={load} favorites={favorites} locations={locations} readingBusy={readingBusy} openingBookId={openingBookId} onOpen={b=>navigate("detail",b)} onRead={startReading} onFavorite={favorite} onCatalog={g=>{if(g)rememberSearch(g);setQuery("");setGenre(g||"Todos");navigate("catalog");}} onLibrary={()=>navigate("library")} onSearch={q=>{rememberSearch(q);setQuery(q);setGenre("Todos");navigate("catalog");}}/>}
    {view==="catalog"&&<main className="page"><div className="page-title"><p className="eyebrow">SAMBU EBOOKS</p><h1>Explore o acervo</h1><p>Escolha uma história e leia no seu ritmo.</p></div>
      <div className="search-box"><input aria-label="Buscar livros" placeholder="Busque por título, autor ou gênero" value={query} onChange={e=>setQuery(e.target.value)}/><button onClick={()=>{setQuery("");setGenre("Todos");}}>Limpar</button></div>
      <div className="filter-row"><label>Gênero <select value={genre} onChange={e=>{setGenre(e.target.value);if(e.target.value!=="Todos")rememberSearch(e.target.value);}}><option>Todos</option>{Array.from(new Set(books.map(b=>b.genre))).sort().map(g=><option key={g}>{g}</option>)}</select></label><label>Ordenar <select value={sort} onChange={e=>setSort(e.target.value)}><option value="recent">Mais recentes</option><option value="title">Título A–Z</option></select></label></div>
      {loading?<p role="status">Carregando acervo…</p>:error?<div role="alert"><p>{error}</p><button className="outline" onClick={load}>Tentar novamente</button></div>:<><p>{filtered.length} {filtered.length===1?"livro encontrado":"livros encontrados"}</p>{filtered.length?cards(filtered):<div className="library-empty"><h2>{books.length?"Nenhum resultado":"O acervo está sendo preparado"}</h2><p>{books.length?"Tente outro título ou gênero.":"As obras aprovadas aparecerão aqui."}</p></div>}</>}
    </main>}
    {view==="library"&&<main className="page"><h1>Minha biblioteca</h1>{!user?.participant?<AccessNotice user={user}/>:loading||libraryLoading?<p role="status">Atualizando sua biblioteca…</p>:error||libraryError?<div className="library-empty" role="alert"><h2>Sua biblioteca não pôde ser atualizada</h2><p>{error||libraryError}</p><button className="outline" onClick={()=>{void load();void loadLibrary();}}>Tentar novamente</button></div>:<>
      <section className="beta-library-section"><h2>Continue sua leitura</h2>{books.some(b=>locations[b.id]?.progress>0&&locations[b.id]?.progress<100)?books.filter(b=>locations[b.id]?.progress>0&&locations[b.id]?.progress<100).map(b=><article className="beta-continue" key={b.id}><Cover book={b}/><div className="continue-info"><h3>{b.title}</h3><p className="continue-percent">{locations[b.id].progress}% lido</p><progress className="reading-progress" value={locations[b.id].progress} max={100} aria-label={`Progresso da leitura de ${b.title}`}/></div><button className="primary continue-button" disabled={readingBusy} onClick={()=>startReading(b)}>{openingBookId===b.id?"Abrindo…":"Continuar leitura"}</button></article>):<div className="library-empty"><p>Seu próximo momento de leitura começa com uma escolha.</p><button className="outline" onClick={()=>navigate("catalog")}>Encontrar um livro</button></div>}</section>
      <section className="beta-library-section"><h2>Livros salvos</h2>{books.some(b=>favorites.includes(b.id))?cards(books.filter(b=>favorites.includes(b.id))):<div className="library-empty"><p>Toque no coração de um livro para guardá-lo aqui.</p><button className="outline" onClick={()=>navigate("home")}>Ver sugestões de leitura</button></div>}</section>
      <section className="beta-library-section"><h2>Concluídos</h2>{books.some(b=>locations[b.id]?.progress===100)?cards(books.filter(b=>locations[b.id]?.progress===100)):<p>Os livros que você concluir aparecerão aqui.</p>}</section>
    </>}</main>}
    {view==="detail"&&selected&&<main className="detail"><button className="back" onClick={()=>navigate("catalog")}>← Voltar ao acervo</button><section><Cover book={selected}/><div className="book-info"><p>{selected.genre}</p><h1>{selected.title}</h1><p>por {selected.author}</p><p className="blurb">{selected.description}</p><p>{selected.format||"Ebook"} · Disponível gratuitamente no beta</p><div className="actions"><button className="primary" disabled={readingBusy} onClick={()=>startReading(selected)}>{openingBookId===selected.id?"Abrindo…":locations[selected.id]?.progress&&locations[selected.id].progress<100?"Continuar leitura":"Ler agora"}</button><button className="outline" disabled={favoriteBusy} onClick={()=>favorite(selected.id)}>{favorites.includes(selected.id)?"♥ Salvo":"♡ Salvar"}</button></div></div></section></main>}
    {view==="reader"&&selected&&<Reader key={selected.id} book={selected} initialPage={readerPage} initial={locations[selected.id]||{position:0,progress:0}} theme={theme} font={font} preference={preference} onSave={save} onBack={()=>navigate("detail",selected)}/>}
    {view==="guide"&&<PilotGuide signedIn={!!user} onCatalog={()=>navigate("catalog")} onProfile={()=>navigate("profile")}/>}
    {view==="profile"&&<Profile user={user} notify={notify}/>}
    {view==="admin"&&<main className="page">{user?.admin?(user.adminTrial?<><p className="beta-banner">Administração de testes · as alterações afetam o acervo real.</p><Admin owner={user.email} notify={notify} onChange={load}/></>:<MasterGate owner={user.email} notify={notify} onChange={load}/>):<AccessNotice user={user} admin/>}</main>}
    {toast&&<div className="toast" role="status">{toast}</div>}
  </div>;
}
function BetaHome({books,user,loading,error,retry,favorites,locations,readingBusy,openingBookId,onOpen,onRead,onFavorite,onCatalog,onLibrary,onSearch}:{books:Book[];user:User;loading:boolean;error:string;retry:()=>unknown;favorites:string[];locations:Record<string,Location>;readingBusy:boolean;openingBookId:string|null;onOpen:(b:Book)=>void;onRead:(b:Book)=>void;onFavorite:(id:string)=>void;onCatalog:(genre?:string)=>void;onLibrary:()=>void;onSearch:(q:string)=>void}) {
  const [search,setSearch]=useState("");
  const latest=books.slice(0,10),spotlight=books.slice(0,3);
  const ongoing=books.filter(b=>locations[b.id]?.progress>0&&locations[b.id]?.progress<100).slice(0,2);
  const genres=Array.from(new Set(books.map(b=>b.genre))).filter(Boolean);
  return <main className="r3-home">
    <div className="r3-discover"><span>Encontre sua próxima leitura</span><button onClick={()=>onCatalog()}>Todo o acervo</button>{genres.slice(0,7).map(g=><button key={g} onClick={()=>onCatalog(g)}>{g}</button>)}</div>
    <section className="r3-hero">
      <div className="r3-hero-copy"><p className="r3-pill">SAMBU <span>Histórias que ficam em você</span></p><h1>Sua próxima história<br/><em>começa aqui.</em></h1><p className="r3-hero-description">Uma descoberta, uma nova perspectiva, um momento só seu. Encontre um livro que acompanhe você.</p><div className="r3-hero-actions"><button className="primary" onClick={()=>ongoing[0]?onRead(ongoing[0]):onCatalog()} disabled={readingBusy}>{ongoing[0]&&openingBookId===ongoing[0].id?"Abrindo…":ongoing[0]?"Continuar minha leitura":"Encontrar meu próximo livro"}</button><button className="r3-secondary" onClick={onLibrary}>Minha biblioteca</button></div><form className="r3-home-search" onSubmit={e=>{e.preventDefault();onSearch(search);}}><input aria-label="Buscar livros na página inicial" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Qual história você procura?"/><button type="submit">Buscar</button></form></div>
      <div className={`r3-spotlight r3-spotlight-${spotlight.length}`} aria-label="Livros em destaque">{spotlight.length?<><div className="r3-cover-fan">{spotlight.map((b,i)=><button key={b.id} className={`r3-featured-cover r3-cover-${i}`} onClick={()=>onOpen(b)} aria-label={`Conhecer ${b.title}`}><Cover book={b}/></button>)}</div><button className="r3-featured-caption" onClick={()=>onOpen(spotlight[0])}><span>EM DESTAQUE</span><strong>{spotlight[0].title}</strong><small>{spotlight[0].author} · Conhecer o livro →</small></button></>:<div className="r3-welcome"><img src="/sambu-comunidade-horizontal.webp" alt="Sambu — Comunidade de leitura" width="640" height="256"/><p>{loading?"Preparando suas próximas descobertas…":error?"Seu acervo estará de volta em breve.":"Novas histórias estão a caminho."}</p></div>}</div>
    </section>
    <div className="r3-home-content">
      {error&&<div className="r3-home-notice" role="alert"><p>{error}</p><button className="outline" onClick={retry}>Tentar novamente</button></div>}
      {!!ongoing.length&&<section className="r3-home-section"><div className="r3-section-heading"><div><p className="eyebrow">SUA JORNADA</p><h2>Continue de onde parou</h2></div><button onClick={onLibrary}>Minha biblioteca →</button></div><div className="r3-continue-grid">{ongoing.map(b=><article className="beta-continue" key={b.id}><Cover book={b}/><div className="continue-info"><h3>{b.title}</h3><p className="continue-percent">{locations[b.id].progress}% lido</p><progress className="reading-progress" value={locations[b.id].progress} max={100} aria-label={`Progresso da leitura de ${b.title}`}/></div><button className="primary continue-button" disabled={readingBusy} onClick={()=>onRead(b)}>{openingBookId===b.id?"Abrindo…":"Continuar leitura"}</button></article>)}</div></section>}
      <section className="r3-home-section"><div className="r3-section-heading"><div><p className="eyebrow">ABRA ESPAÇO PARA UMA NOVA HISTÓRIA</p><h2>Novidades no acervo</h2></div><button onClick={()=>onCatalog()}>Explorar todos →</button></div>{loading?<p role="status">Carregando livros…</p>:latest.length?<HomeBookRail books={latest} favorites={favorites} onOpen={onOpen} onFavorite={onFavorite}/>:!error&&<div className="r3-home-notice"><h3>O acervo está sendo preparado</h3><p>As obras publicadas aparecerão aqui para você descobrir.</p></div>}</section>
      <SuggestedBooks books={books} user={user} favorites={favorites} locations={locations} onOpen={onOpen} onFavorite={onFavorite} onLibrary={onLibrary} onCatalog={onCatalog}/>
      <section className="r3-reading-banner"><div><p className="eyebrow">NO SEU TEMPO, DO SEU JEITO</p><h2>Uma pausa.<br/>Um livro. Você.</h2><p>Guarde suas descobertas nos favoritos e volte à sua próxima leitura quando quiser.</p></div><button className="primary" onClick={user?.participant?onLibrary:()=>onCatalog()}>{user?.participant?"Abrir minha biblioteca":"Descobrir o acervo"}</button></section>
    </div>
  </main>;
}
function SuggestedBooks({books,user,favorites,locations,onOpen,onFavorite,onLibrary,onCatalog}:{books:Book[];user:User;favorites:string[];locations:Record<string,Location>;onOpen:(b:Book)=>void;onFavorite:(id:string)=>void;onLibrary:()=>void;onCatalog:(genre?:string)=>void}) {
  const [suggestions,setSuggestions]=useState<{bookId:string;reason:string}[]>([]),[busy,setBusy]=useState(!!user?.participant),[error,setError]=useState("");
  const [retry,setRetry]=useState(0),[adding,setAdding]=useState<string|null>(null);
  const signature=JSON.stringify([books.map(b=>b.id),favorites,locations]);
  useEffect(()=>{let active=true;setError("");if(!user?.participant){setBusy(false);return;}setBusy(true);requestJson("/api/recommendations",{cache:"no-store"}).then(d=>{if(active)setSuggestions(d.recommendations||[]);}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setBusy(false);});return()=>{active=false;};},[user?.email,user?.participant,signature,retry]);
  const eligible=books.filter(b=>!favorites.includes(b.id)&&!locations[b.id]?.progress);
  const displayed=(user?.participant?suggestions:eligible.slice(0,4).map(b=>({bookId:b.id,reason:"Uma nova descoberta no acervo"}))).flatMap(s=>{const book=eligible.find(b=>b.id===s.bookId);return book?[{book,reason:s.reason}]:[];});
  return <section className="r3-home-section r3-suggestions"><div className="r3-section-heading"><div><p className="eyebrow">SUA PRÓXIMA DESCOBERTA</p><h2>Sugestões para você</h2><p className="r3-suggestions-intro">{user?.participant?"Encontre novas leituras a partir das suas buscas e dos livros que você lê e salva.":"Conheça os livros do acervo e escolha quais quer guardar para depois."}</p></div><button onClick={onLibrary}>Minha biblioteca →</button></div>
    {busy?<p role="status">Selecionando suas próximas leituras…</p>:error?<div className="r3-home-notice" role="alert"><p>Não foi possível carregar suas sugestões.</p><button className="outline" onClick={()=>setRetry(v=>v+1)}>Tentar novamente</button></div>:displayed.length?<div className="r3-suggestion-grid">{displayed.map(({book,reason})=><article className="r3-suggestion-card" key={book.id}><button className="r3-suggestion-cover" aria-label={`Conhecer ${book.title}`} onClick={()=>onOpen(book)}><Cover book={book}/></button><div className="r3-suggestion-info"><p className="r3-suggestion-reason">{reason}</p><h3><button onClick={()=>onOpen(book)}>{book.title}</button></h3><p className="r3-suggestion-author">{book.author}</p><span className="r3-suggestion-genre">{book.genre}</span><p className="r3-suggestion-description">{book.description}</p></div><div className="r3-suggestion-actions"><button className="primary" disabled={!!adding} onClick={async()=>{setAdding(book.id);try{await onFavorite(book.id);}finally{setAdding(null);}}}>{adding===book.id?"Adicionando…":"+ Adicionar à biblioteca"}</button><button className="r3-suggestion-details" onClick={()=>onOpen(book)}>Conhecer o livro</button></div></article>)}</div>:<div className="r3-home-notice"><h3>{books.length?"Suas descobertas já estão com você":"Novas sugestões estão a caminho"}</h3><p>{books.length?"Você já salvou ou começou os livros disponíveis. Novas sugestões aparecerão quando o acervo crescer.":"Os livros publicados aparecerão aqui para você escolher sua próxima leitura."}</p><button className="outline" onClick={books.length?onLibrary:()=>onCatalog()}>{books.length?"Ir para minha biblioteca":"Explorar acervo"}</button></div>}
  </section>;
}
function HomeBookRail({books,favorites,onOpen,onFavorite}:{books:Book[];favorites:string[];onOpen:(b:Book)=>void;onFavorite:(id:string)=>void}) {
  const rail=useRef<HTMLDivElement>(null);
  const [edges,setEdges]=useState({start:true,end:true});
  useEffect(()=>{const el=rail.current;if(!el)return;const update=()=>setEdges({start:el.scrollLeft<5,end:el.scrollLeft+el.clientWidth>=el.scrollWidth-5});update();const observer=new ResizeObserver(update);observer.observe(el);el.addEventListener("scroll",update,{passive:true});return()=>{observer.disconnect();el.removeEventListener("scroll",update);};},[books.length]);
  return <><div className="r3-book-rail" ref={rail} aria-label="Novidades no acervo">{books.map(b=><BookCard key={b.id} book={b} saved={favorites.includes(b.id)} onOpen={()=>onOpen(b)} onFavorite={()=>onFavorite(b.id)}/>)}</div>{!(edges.start&&edges.end)&&<div className="r3-rail-controls"><button aria-label="Ver livros anteriores" disabled={edges.start} onClick={()=>rail.current?.scrollBy({left:-rail.current.clientWidth*.8,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'})}>←</button><button aria-label="Ver próximos livros" disabled={edges.end} onClick={()=>rail.current?.scrollBy({left:rail.current.clientWidth*.8,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'})}>→</button></div>}</>;
}
function AccessNotice({user,admin=false}:{user:User;admin?:boolean}) {
  return <section className="library-empty"><h2>{!user?"Entre para continuar":admin?"Acesso administrativo restrito":"Acesso por convite"}</h2><p>{!user?"Entre com sua própria conta do ChatGPT. Depois, salve seu nome em Minha conta e comece a ler.":admin?"Sua conta não possui permissão para administrar o acervo.":"Solicite à equipe Sambu a inclusão do seu email entre os participantes."}</p>{!user&&<a target="_top" className="primary" href={serviceUrl("/signin-with-chatgpt?return_to=%2F%3Fview%3Dprofile")}>Entrar com ChatGPT</a>}</section>;
}
function Profile({user,notify}:{user:User;notify:(s:string)=>void}) {
  const [name,setName]=useState(user?.name||""),[details,setDetails]=useState<ReaderProfile>(cleanReaderProfile(null)),[busy,setBusy]=useState(false),[loading,setLoading]=useState(!!user),[error,setError]=useState("");
  const load=useCallback(async()=>{if(!user)return;setLoading(true);setError("");try{const d=await requestJson("/api/profile");setName(d.profile?.displayName||user.name);setDetails(cleanReaderProfile(d.profile?.tasteProfile));}catch{setError("Não foi possível carregar seu cadastro. Tente novamente antes de editar.");}finally{setLoading(false);}},[user]);
  useEffect(()=>{void load();},[load]);
  if(!user)return <main className="page"><AccessNotice user={user}/></main>;
  const field=(key:keyof ReaderProfile,value:string)=>setDetails(current=>({...current,[key]:value}));
  return <main className="page profile-page"><div className="page-title"><p className="eyebrow">SEU ESPAÇO NO SAMBU</p><h1>Meu cadastro</h1><p>Conte um pouco sobre você e suas leituras.</p></div>{loading?<p role="status">Carregando cadastro…</p>:error?<div role="alert"><p>{error}</p><button className="outline" onClick={load}>Tentar novamente</button></div>:<form className="beta-form profile-card" onSubmit={async e=>{e.preventDefault();setBusy(true);try{await requestJson("/api/profile",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({displayName:name,tasteProfile:details})});notify("Cadastro salvo com sucesso.");}catch(e){notify((e as Error).message);}finally{setBusy(false);}}}>
    <fieldset disabled={busy}><legend>Dados pessoais</legend><div className="profile-fields"><label>Nome de exibição *<input autoComplete="nickname" value={name} required maxLength={80} onChange={e=>setName(e.target.value)} placeholder="Como você quer ser chamado?"/></label><label>E-mail da conta<input type="email" value={user.email} readOnly/><small>Vinculado à sua conta do ChatGPT.</small></label><label>Cidade<input autoComplete="address-level2" value={details.city} maxLength={80} placeholder="Ex.: Curitiba" onChange={e=>field('city',e.target.value)}/></label><label>Estado / região<input autoComplete="address-level1" value={details.region} maxLength={80} placeholder="Ex.: Paraná" onChange={e=>field('region',e.target.value)}/></label></div></fieldset>
    <fieldset disabled={busy}><legend>Sobre suas leituras</legend><div className="profile-fields"><label>Idioma preferido<select value={details.language} onChange={e=>field('language',e.target.value)}><option value="">Selecione</option><option>Português</option><option>Inglês</option><option>Espanhol</option><option>Outro</option></select></label><label>Gêneros favoritos<input value={details.genres} maxLength={200} placeholder="Ex.: suspense, romance, desenvolvimento pessoal" onChange={e=>field('genres',e.target.value)}/></label><label className="profile-wide">Sobre você como leitor<textarea value={details.bio} rows={3} maxLength={500} placeholder="O que você gosta de encontrar em um bom livro?" onChange={e=>field('bio',e.target.value)}/></label></div></fieldset><p className="profile-note">Cidade, região e preferências são opcionais. Essas informações ficam no seu cadastro e não são exibidas aos outros leitores.</p><div className="profile-actions"><button className="primary" disabled={busy}>{busy?"Salvando…":"Salvar cadastro"}</button><a className="outline" href="/?view=catalog">Explorar livros</a></div></form>}<p>O beta é gratuito. Nenhuma assinatura ou cobrança é iniciada aqui.</p><a href={serviceUrl("/signout-with-chatgpt?return_to=%2F")}>Sair da conta</a></main>;
}
function MasterGate({owner,notify,onChange}:{owner:string;notify:(s:string)=>void;onChange:()=>Promise<unknown>}) {
  const [status,setStatus]=useState<{configured:boolean;unlocked:boolean}|null>(null);
  const [password,setPassword]=useState(""),[confirm,setConfirm]=useState(""),[error,setError]=useState(""),[busy,setBusy]=useState(false);
  const check=useCallback(async()=>{setError("");try{const d=await requestJson("/api/admin/master",{cache:"no-store"});setStatus({configured:!!d.configured,unlocked:!!d.unlocked});}catch(e){setError((e as Error).message);}},[]);
  useEffect(()=>{check();const lock=()=>{setPassword("");setConfirm("");setStatus({configured:true,unlocked:false});};window.addEventListener("sambu-master-locked",lock);return()=>window.removeEventListener("sambu-master-locked",lock);},[check]);
  async function submit(action:string){
    setBusy(true);setError("");
    try{await requestJson("/api/admin/master",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action,password})});setPassword("");setConfirm("");await check();}
    catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  if(!status)return <section className="library-empty"><h1>Administração</h1>{error?<><p role="alert">{error}</p><button className="outline" onClick={check}>Tentar novamente</button></>:<p role="status">Verificando acesso…</p>}</section>;
  if(status.unlocked)return <><div className="master-toolbar"><span>Usuário master · acesso desbloqueado</span><button className="outline" disabled={busy} onClick={()=>submit("logout")}>Bloquear administração</button></div>{error&&<p role="alert">{error}</p>}<Admin owner={owner} notify={notify} onChange={onChange}/></>;
  return <section className="master-login"><p className="eyebrow">ADMINISTRAÇÃO SAMBU</p><h1>{status.configured?"Entrar como master":"Criar senha master"}</h1><p>{status.configured?"Digite sua senha para administrar o acervo.":"Defina a senha que protegerá a administração. Guarde-a em um local seguro."}</p><form className="beta-form" onSubmit={e=>{e.preventDefault();if(!status.configured&&password!==confirm){setError("As senhas não coincidem.");return;}submit(status.configured?"login":"setup");}}><label>Usuário<input value="master" readOnly autoComplete="username"/></label><label>Senha master<input type="password" autoComplete={status.configured?"current-password":"new-password"} required minLength={12} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)} aria-describedby="master-password-hint"/></label><p id="master-password-hint">Use entre 12 e 128 caracteres. O acesso expira em duas horas.</p>{!status.configured&&<label>Confirmar senha<input type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={confirm} onChange={e=>setConfirm(e.target.value)}/></label>}{error&&<p role="alert">{error}</p>}<button className="primary" disabled={busy}>{busy?"Aguarde…":status.configured?"Entrar na administração":"Criar senha e entrar"}</button></form></section>;
}
function Admin({owner,notify,onChange}:{owner:string;notify:(s:string)=>void;onChange:()=>Promise<unknown>}) {
  const [deleteOpen,setDeleteOpen]=useState(false),[confirmTitle,setConfirmTitle]=useState("");
  const [importing,setImporting]=useState(false);
  const [tab,setTab]=useState("catalog"),[rows,setRows]=useState<Book[]>([]),[error,setError]=useState(""),[busy,setBusy]=useState(false),[editing,setEditing]=useState<Book|null>(null);
  const reload=useCallback(async()=>{setError("");try{const data=await requestJson("/api/admin/books");setRows(data.books||[]);await onChange();}catch(e){setError((e as Error).message);}},[onChange]);
  useEffect(()=>{reload();},[reload]);
  return <><div className="page-title"><h1>Administração do acervo</h1><p>{rows.filter(b=>b.status==="published").length} obras publicadas · {rows.filter(b=>b.status!=="published").length} fora do catálogo</p></div><div className="tabs"><button disabled={importing} onClick={()=>{setTab("catalog");reload();}}>Acervo</button><button disabled={importing} onClick={()=>setTab("imports")}>Importar e revisar</button><button disabled={importing} onClick={()=>setTab("bulk")}>Subir ebooks em lote</button><button disabled={importing} onClick={()=>setTab("beta")}>Acompanhar beta</button></div>{error&&<div role="alert"><p>{error}</p><button onClick={reload}>Tentar novamente</button></div>}
    {tab==="beta"?<BetaDashboard/>:(tab==="imports"||tab==="bulk")?<ImportCenter onBusy={setImporting} key={tab} initialMode={tab==="bulk"?"quick":"individual"} owner={owner} notify={message=>{notify(message);reload();}}/>:<>{!rows.length&&!error&&<p>Importe e revise o primeiro ebook para iniciar o acervo.</p>}<div className="admin-table-wrap catalog-admin-table"><table><thead><tr><th>Livro</th><th>Autor</th><th>Situação</th><th>Ação</th></tr></thead><tbody>{rows.map(b=><tr key={b.id}><td data-label="Livro">{b.title}</td><td data-label="Autor">{b.author}</td><td data-label="Situação">{b.status==="published"?"Publicado":"Fora do catálogo"}</td><td data-label="Ação"><button className="outline" onClick={()=>{setEditing(b);setDeleteOpen(false);setConfirmTitle("");}}>Editar</button></td></tr>)}</tbody></table></div></>}
    {editing&&<div className="modal-backdrop"><section className="book-modal" role="dialog" aria-modal="true" aria-labelledby="edit-title"><h2 id="edit-title">Editar obra</h2><form className="beta-form" onSubmit={async e=>{e.preventDefault();const mediaForm=new FormData(e.currentTarget);setBusy(true);try{await requestJson("/api/admin/books",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify(editing)});for(const kind of ["cover","epub"]){const file=mediaForm.get(kind);if(file instanceof File&&file.size){const media=new FormData();media.set("file",file);media.set("kind",kind);media.set("bookId",editing.id);await requestJson("/api/media",{method:"POST",body:media});}}await reload();setEditing(null);notify("Obra atualizada.");}catch(e){notify((e as Error).message);}finally{setBusy(false);}}}><label>Título<input value={editing.title} required onChange={e=>setEditing({...editing,title:e.target.value})}/></label><label>Autor<input value={editing.author} required onChange={e=>setEditing({...editing,author:e.target.value})}/></label><label>Gênero<input value={editing.genre} required onChange={e=>setEditing({...editing,genre:e.target.value})}/></label><label>Sinopse<textarea value={editing.description} required onChange={e=>setEditing({...editing,description:e.target.value})}/></label><label>Substituir capa (opcional)<input type="file" name="cover" accept="image/jpeg,image/png,image/webp"/></label><label>Substituir ebook (opcional, até 32 MB)<input type="file" name="epub" accept="application/epub+zip,application/pdf"/></label><label>Visibilidade<select value={editing.status} onChange={e=>setEditing({...editing,status:e.target.value})}><option value="published">Publicado</option><option value="draft">Despublicado</option><option value="archived">Arquivado</option></select></label><section className="ebook-delete-area"><h3>Excluir ebook</h3><p>Remove o ebook do acervo e bloqueia novas leituras. Os arquivos de origem e o histórico permanecem guardados.</p>{deleteOpen?<><label>Digite o título atual para confirmar: <strong>{rows.find(book=>book.id===editing.id)?.title}</strong><input autoComplete="off" value={confirmTitle} disabled={busy} onChange={event=>setConfirmTitle(event.target.value)}/></label><button type="button" className="ebook-delete-button" disabled={busy||confirmTitle!==rows.find(book=>book.id===editing.id)?.title} onClick={async()=>{setBusy(true);try{await requestJson("/api/admin/books",{method:"DELETE",headers:{"content-type":"application/json"},body:JSON.stringify({id:editing.id,confirmTitle})});setEditing(null);setDeleteOpen(false);await reload();notify("Ebook excluído do acervo.");}catch(error){notify((error as Error).message);}finally{setBusy(false);}}}>{busy?"Excluindo…":"Confirmar exclusão"}</button><button type="button" className="outline" disabled={busy} onClick={()=>{setDeleteOpen(false);setConfirmTitle("");}}>Manter ebook</button></>:<button type="button" className="ebook-delete-button" disabled={busy} onClick={()=>setDeleteOpen(true)}>Excluir ebook</button>}</section><div><button type="button" disabled={busy} className="outline" onClick={()=>setEditing(null)}>Cancelar</button><button disabled={busy} className="primary">{busy?"Salvando…":"Salvar alterações"}</button></div></form></section></div>}
  </>;
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

function ImportCenter({ notify, owner, onBusy, initialMode="individual" }: { onBusy:(busy:boolean)=>void; notify: (message: string) => void; owner: string; initialMode?:"individual"|"quick" }) {
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [items, setItems] = useState<StagedBook[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(()=>{onBusy(busy);return()=>onBusy(false);},[busy,onBusy]);
  const [mode, setMode] = useState<"individual" | "batch" | "quick">(initialMode);
  const [queue,setQueue]=useState<{file:File;status:string;uploaded?:ApiPayload;registered?:boolean}[]>([]);
  const queueRef=useRef(queue);
  const updateQueue=(next:typeof queue)=>{queueRef.current=next;setQueue(next);};
  const updateFile=(index:number,patch:Partial<(typeof queue)[number]>)=>updateQueue(queueRef.current.map((item,i)=>i===index?{...item,...patch}:item));
  useEffect(()=>{if(!busy)return;const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue="";};window.addEventListener("beforeunload",warn);return()=>window.removeEventListener("beforeunload",warn);},[busy]);
  const [folderPath, setFolderPath] = useState("");
  const [selected, setSelected] = useState<StagedBook | null>(null);
  const [uploadStage, setUploadStage] = useState("");

  async function load() {
    const response = await apiFetch("/api/admin/imports");
    if (!response.ok) throw new Error("Não foi possível carregar as importações.");
    const data = await response.json() as ApiPayload;
    setBatches(data.batches || []);
    setItems(data.items || []);
  }
  useEffect(() => {
    load().catch(error => notify(error.message));
  }, []);

  async function uploadIndividual(file: File, progress?:(text:string)=>void) {
    const limit = file.name.toLowerCase().endsWith(".epub") ? 32_000_000 : 250_000_000;
    if (file.size > limit) throw new Error("Arquivo acima do limite: EPUB 32 MB; PDF 250 MB.");
    const resumeKey = `sambu:upload:${owner}:${file.name}:${file.size}:${file.lastModified}`;
    let resumed: { uploadId:string; chunkSize:number; nextPart:number } | null = null;
    try { const candidate=JSON.parse(localStorage.getItem(resumeKey)||"null"); if(candidate && /^[a-f0-9-]{36}$/i.test(candidate.uploadId) && candidate.chunkSize===250000 && Number.isInteger(candidate.nextPart) && candidate.nextPart>=0 && candidate.nextPart<=Math.ceil(file.size/candidate.chunkSize)) resumed=candidate; } catch {}
    let initialized: ApiPayload;
    if (resumed) initialized = { ...resumed, batch: { validItems:0,errorItems:0 } };
    else {
      const initResponse = await apiFetch("/api/admin/uploads?v=3", {method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"init",fileName:file.name,contentType:file.type,size:file.size})});
      initialized = await initResponse.json().catch(()=>({})) as ApiPayload;
      if (!initResponse.ok) throw new Error(initialized.error || `init_${initResponse.status}`);
    }

    function base64(buffer: ArrayBuffer) {
      const bytes = new Uint8Array(buffer);
      let binary = "";
      for (let start = 0; start < bytes.length; start += 0x8000)
        binary += String.fromCharCode(...bytes.subarray(start, start + 0x8000));
      return btoa(binary);
    }

    const chunkSize = Number(initialized.chunkSize);
    const totalParts = Math.ceil(file.size / chunkSize);
    for (let part = resumed?.nextPart || 0; part < totalParts; part++) {
      setUploadStage(`Enviando ${file.name}… ${Math.round(part / totalParts * 100)}%`);progress?.(`Enviando · ${Math.round(part / totalParts * 100)}%`);
      const chunk = file.slice(part * chunkSize, (part + 1) * chunkSize);
      let response: Response | undefined;
      for (let attempt = 0; attempt < 3; attempt++) {
      try { response = await apiFetch("/api/admin/uploads?v=3", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "part",
          uploadId: initialized.uploadId,
          part,
          data: base64(await chunk.arrayBuffer()),
        }),
      });
      if (response.ok || response.status < 500) break;
      } catch { if (attempt === 2) throw new Error("network_error"); }
      await new Promise(resolve => setTimeout(resolve, 400 * (attempt + 1)));
      }
      if (!response) throw new Error("network_error");
      const detail = await response.json().catch(() => ({})) as ApiPayload;
      if (!response.ok)
        throw new Error(detail.error || `part_${part + 1}_${response.status}`);
      try { localStorage.setItem(resumeKey,JSON.stringify({uploadId:initialized.uploadId,chunkSize,nextPart:part+1})); } catch {}
    }

    setUploadStage("Finalizando o ebook…");progress?.("Finalizando arquivo…");
    const completeResponse = await apiFetch("/api/admin/uploads?v=3", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "complete",
        uploadId: initialized.uploadId,
        fileName: file.name,
        contentType: file.type,
        size: file.size,
        totalParts,
      }),
    });
    const completed = await completeResponse.json().catch(() => ({})) as ApiPayload;
    if (!completeResponse.ok)
      throw new Error(completed.error || `complete_${completeResponse.status}`);
    try { localStorage.removeItem(resumeKey); } catch {}
    return completed;
  }

  async function importBatch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if(busy)return;
    setBusy(true);
    const form = event.currentTarget;
    setUploadStage(mode === "individual" ? "Preparando o ebook…" : "Processando lote…");
    try {
      const requestForm = new FormData(form);
      if(mode==="quick"){
        if(!queueRef.current.length)throw new Error("Selecione ao menos um EPUB ou PDF.");
        for(let i=0;i<queueRef.current.length;i++){
          const item=queueRef.current[i];if(item.registered||item.uploaded)continue;
          try{const uploaded=await uploadIndividual(item.file,status=>updateFile(i,{status}));updateFile(i,{uploaded,status:"Enviado · aguardando registro"});}
          catch(error){updateFile(i,{status:`Falha: ${(error as Error).message}`});}
        }
        const ready=queueRef.current.filter(item=>item.uploaded&&!item.registered);
        if(!ready.length)throw new Error("Nenhum novo arquivo enviado. Confira os erros abaixo.");
        const rows=ready.map(item=>({title:item.file.name.replace(/\.(epub|pdf)$/i,""),author:"",licenseType:"",fileName:item.uploaded!.fileName}));
        requestForm.set("mode","batch");
        requestForm.set("manifest",new File([JSON.stringify(rows)],"livros.json",{type:"application/json"}));
        requestForm.set("uploadedFiles",JSON.stringify(ready.map(item=>item.uploaded)));
      }
      if (mode === "individual") {
        const file = requestForm.get("singleFile");
        if (!(file instanceof File) || !file.size)
          throw new Error("book_file_required");
        const uploaded = await uploadIndividual(file);
        requestForm.delete("singleFile");
        requestForm.set("uploadedFiles", JSON.stringify([uploaded]));
      }
      setUploadStage("Registrando na fila de revisão…");
      const response = await apiFetch("/api/admin/imports?v=3", {
        method: "POST",
        body: requestForm,
      });
      const data = await response.json().catch(() => ({})) as ApiPayload;
      if (!response.ok)
        throw new Error(data.error || `import_${response.status}`);
      if(mode==="quick")updateQueue(queueRef.current.map(item=>item.uploaded?{...item,registered:true,status:"Na fila de revisão"}:item));
      notify(
        mode === "individual"
          ? `Livro recebido: ${data.batch.validItems} válido e ${data.batch.errorItems} para revisar.`
          : `Lote recebido: ${data.batch.validItems} válidos e ${data.batch.errorItems} para revisar.`,
      );
      if(mode!=="quick")form.reset();
      setFolderPath("");
      await load();
    } catch (error) {
      const code = error instanceof Error ? error.message : "unknown_error";
      notify(
        code === "sign_in_required"
          ? "Sua sessão expirou. Entre novamente para importar."
          : code === "book_file_required"
            ? "Selecione o arquivo EPUB antes de importar."
            : `Falha na importação (${code}).`,
      );
    } finally {
      setUploadStage("");
      setBusy(false);
    }
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
    try {
    const response = await apiFetch("/api/admin/imports", {
      method: "PATCH",
      body: form,
    });
    const data = await response.json().catch(() => ({})) as ApiPayload;
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
            : messages[data.error || ""] || "Não foi possível salvar a revisão.",
      );
    }
    } catch(error) { notify((error as Error).message || "Falha de conexão. Tente novamente."); } finally { setBusy(false); }
  }

  async function deleteBook(item: StagedBook) {
    if (!window.confirm(`Arquivar a importação de “${item.title}”?`)) return;
    setBusy(true);
    try {
    const response = await apiFetch(
      `/api/admin/imports?id=${encodeURIComponent(item.id)}`,
      { method: "DELETE" },
    );
    if (response.ok) {
      notify("Importação arquivada. Os arquivos foram preservados.");
      setSelected(null);
      await load();
    } else notify("Não foi possível excluir esta importação.");
    } catch(error) { notify((error as Error).message || "Falha de conexão. Tente novamente."); } finally { setBusy(false); }
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
          <span>REVISÃO DE CONTEÚDO</span>
          <b>Fila de revisão</b>
          <p>Os arquivos aguardam revisão e não aparecem no catálogo antes da publicação.</p>
          <div>
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
          disabled={busy} onClick={() => setMode("individual")}
        >
          <span>01</span>
          <b>Livro individual</b>
          <small>Um título por vez</small>
        </button>
        <button
          className={mode === "batch" ? "active" : ""}
          disabled={busy} onClick={() => setMode("batch")}
        >
          <span>02</span>
          <b>Lote com planilha</b>
          <small>Selecione uma pasta</small>
        </button>
        <button disabled={busy} className={mode==="quick"?"active":""} onClick={()=>setMode("quick")}><span>03</span><b>Subir ebooks em lote</b><small>Vários arquivos, sem planilha</small></button>
      </div>

      <div className="import-layout">
        <form className="batch-form" onSubmit={importBatch} key={mode}>
          <input type="hidden" name="mode" value={mode} />
          <div className="card-head">
            <div>
              <h3>
                {mode === "individual"
                  ? "Importar livro ou ebook"
                  : mode==="quick"?"Subir ebooks em lote":"Importar pasta de livros"}
              </h3>
              <small>
                {mode === "individual"
                  ? "EPUB ou PDF"
                  : mode==="quick"?"Até 50 arquivos EPUB ou PDF":"Pasta com CSV/JSON + arquivos"}
              </small>
            </div>
            <span className="step-badge">
              {mode === "individual" ? "1×" : "N×"}
            </span>
          </div>
          <label>
            <span>Origem da obra</span>
            <select name="source">
              <option>Sambu Ebooks</option>
                  <option>Portal Domínio Público</option>
              <option>Standard Ebooks</option>
              <option>Project Gutenberg</option>
              <option>Biblioteca Nacional</option>
              <option>Wikisource</option>
              <option>Autores parceiros</option>
            </select>
          </label>
          {mode==="quick"?<>
            <label>Nome do lote<input name="name" required disabled={busy} placeholder="Novos livros — setembro"/></label>
            <label className="drop-field featured-drop"><b>Selecionar ebooks</b><span>EPUB até 32 MB · PDF até 250 MB por arquivo</span><input type="file" accept=".epub,.pdf" multiple disabled={busy} onChange={event=>{
              const files=Array.from(event.target.files||[]);
              if(files.length>50||files.some(f=>!f.size||! /\.(epub|pdf)$/i.test(f.name))||new Set(files.map(f=>f.name.toLowerCase())).size!==files.length){notify("Selecione até 50 EPUBs ou PDFs não vazios, com nomes diferentes.");event.target.value="";return;}
              updateQueue(files.map(file=>({file,status:"Aguardando envio"})));
            }}/></label>
            <p>O nome do arquivo será usado como título inicial. Confira autor, capa e licença na revisão. Mantenha esta tela aberta durante o envio.</p>
            {!!queue.length&&<div className="bulk-upload-list" aria-live="polite"><p>{queue.length} arquivos · {queue.filter(item=>item.registered).length} na revisão</p>{queue.map((item,i)=><div className="bulk-upload-row" key={i}><strong>{item.file.name}</strong><small>{(item.file.size/1000000).toFixed(1)} MB</small><span>{item.status}</span>{!busy&&!item.registered&&!item.uploaded&&<button type="button" className="outline" onClick={()=>updateQueue(queueRef.current.filter((_,index)=>index!==i))}>Remover</button>}</div>)}</div>}
          </>:mode === "individual" ? (
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
                <span>EPUB até 32 MB ou PDF até 250 MB</span>
                <input
                  name="singleFile"
                  type="file"
                  accept=".epub,.pdf"
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
                  Inclua a planilha CSV/JSON e até 50 arquivos EPUB ou PDF
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
                    accept=".epub,.pdf"
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
          <button className="primary import-submit" disabled={busy||(mode==="quick"&&(!queue.length||queue.every(item=>item.registered)))}>
            {busy
              ? uploadStage || "Processando…"
              : mode === "individual"
                ? "Validar e importar livro"
                : mode==="quick"?"Enviar pendentes para revisão":"Validar e importar pasta"}
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
        <div className="admin-table-wrap" role="region" aria-label="Importações — deslize para ver todas as colunas" tabIndex={0}>
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
                  <input name="cover" type="file" accept="image/jpeg,image/png,image/webp" />
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
                <EditorialCheck id={selected.id}/>
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
                      href={serviceUrl(`/api/admin/imports?file=${encodeURIComponent(selected.id)}`)}
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
                Arquivar importação
              </button>
              <div>
                <button
                  type="submit"
                  name="action"
                  value="correction"
                  formNoValidate
                  className="outline"
                  disabled={busy}
                >
                  Solicitar correção
                </button>
                <button
                  type="submit"
                  name="action"
                  value="draft"
                  formNoValidate
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

