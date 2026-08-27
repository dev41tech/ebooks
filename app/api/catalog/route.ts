import { asc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { books } from "../../../db/schema";

// A classificacao escolhida na criacao ("Grupo > Subcategoria") e o que deve
// governar a busca. O grupo continua em `genre`, para o filtro do catalogo; a
// subcategoria e as secundarias saem como `tags`, que e sobre o que o Catalog
// do sambu-app procura. Sem isto a classificacao ficaria gravada e nunca usada.
function tagsDaClassificacao(row: {
  categoryMain: string | null;
  categoriesSecondary: unknown;
  genre: string;
}): string[] {
  const principal = (row.categoryMain || "").trim();

  let secundarias: string[] = [];
  if (Array.isArray(row.categoriesSecondary)) {
    secundarias = (row.categoriesSecondary as unknown[]).map((c) => String(c));
  }

  const tags: string[] = [];
  for (const caminho of [principal, ...secundarias]) {
    for (const parte of caminho.split(">")) {
      const t = parte.trim();
      if (t && !tags.includes(t)) tags.push(t);
    }
  }
  if (tags.length === 0) tags.push("novidade", "ebook", row.genre || "literatura");
  return tags;
}

export async function GET(request: Request) {
  const status = new URL(request.url).searchParams.get("status") || "published";
  const db = await getDb();
  const rows = await db
    .select()
    .from(books)
    .where(eq(books.status, status))
    .orderBy(asc(books.title));

  return Response.json({
    books: rows.map((row) => ({ ...row, tags: tagsDaClassificacao(row) })),
  });
}
