type Candidate = {id:string;title:string;author:string;genre:string;description:string;publishedAt:string|null};
export const normalize = (value:string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9 ]/g," ").replace(/\s+/g," ").trim();
const stop = new Set("para como uma umas uns seus suas sobre entre mais pelo pela pelos pelas voce este esta esse essa livro livros ebook ebooks historia historias autor autora vida livre geral todos todas auto ajuda".split(" "));
const tokens = (value:string) => new Set(normalize(value).split(" ").filter(x=>x.length>3&&!stop.has(x)));
export function recommend(books:Candidate[],favorites:string[],progress:{bookId:string;progress:number}[],searches:string[]) {
  const saved=new Set(favorites),read=new Set(progress.filter(x=>x.progress>0).map(x=>x.bookId));
  const seeds=books.filter(b=>saved.has(b.id)||read.has(b.id));
  return books.filter(b=>!saved.has(b.id)&&!read.has(b.id)).map(book=>{
    let score=0,reason="Uma nova descoberta no acervo",best=0;
    const words=tokens(`${book.title} ${book.description}`),title=normalize(book.title),genre=normalize(book.genre);
    for(const seed of seeds){
      const overlap=[...tokens(`${seed.title} ${seed.description}`)].filter(w=>words.has(w)).length;
      const sameGenre=genre===normalize(seed.genre)&&!['livre','geral','ebook','ebooks',''].includes(genre);
      const sameAuthor=normalize(book.author)===normalize(seed.author)&&!normalize(book.author).startsWith('sambu');
      const affinity=Math.min(overlap,6)*2+(sameGenre?3:0)+(sameAuthor?2:0);
      score+=affinity;
      if(affinity>best){best=affinity;reason=overlap>0?`Temas próximos de “${seed.title}”`:sameGenre?`Mais livros de ${book.genre}`:`Do mesmo autor de “${seed.title}”`;}
    }
    for(const [index,search] of searches.entries()){
      const query=normalize(search);if(!query)continue;
      const terms=[...tokens(search)];
      const overlap=terms.filter(w=>words.has(w)||normalize(book.author).includes(w)).length;
      const exact=title.includes(query)||normalize(book.author).includes(query)||genre===query;
      const relevance=(exact?12:0)+Math.min(overlap,4)*3;
      score+=relevance/(1+index*.25);
      if(relevance>best){best=relevance;reason="Combina com suas buscas recentes";}
    }
    return {bookId:book.id,reason,score,publishedAt:book.publishedAt||""};
  }).sort((a,b)=>b.score-a.score||b.publishedAt.localeCompare(a.publishedAt)||a.bookId.localeCompare(b.bookId)).slice(0,4).map(({bookId,reason})=>({bookId,reason}));
}
