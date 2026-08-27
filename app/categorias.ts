// Taxonomia de classificacao dos ebooks - categoria principal e secundarias.
//
// Este campo substituiu o antigo "Tema / Nicho" de texto livre: alem de
// classificar o livro para busca na vitrine, o caminho escolhido alimenta o
// prompt da IA. Por isso a lista cobre tanto genero de ficcao quanto nicho de
// nao ficcao - o acervo atual e majoritariamente nao ficcao (emagrecimento,
// perimenopausa, DRE gerencial) e nao podia ficar sem lugar.
//
// O detalhe especifico da obra ("voltar a amar depois dos 40") vai no campo de
// instrucoes extras, que comporta 5000 caracteres.
//
// Usado pelo cliente (formularios) e pelo servidor (validacao).
//
// Espelho de ebook-forge/src/lib/categorias.ts: os dois apps classificam com a
// mesma lista, senao um livro criado num lado nao e encontravel no outro.

export interface GrupoCategorias {
  grupo: string;
  itens: string[];
}

export const TAXONOMIA: GrupoCategorias[] = [
  {
    grupo: "Romance",
    itens: [
      "Romance contemporâneo",
      "Romance paranormal/sobrenatural",
      "Romance histórico",
      "Romance de época",
      "Segundas chances",
      "Comédia romântica",
      "Romance LGBTQIA+",
    ],
  },
  {
    grupo: "Ficção",
    itens: [
      "Ficção gótica",
      "Ficção literária",
      "Ficção histórica brasileira",
      "Ficção contemporânea",
      "Contos e crônicas",
    ],
  },
  {
    grupo: "Fantasia",
    itens: [
      "Fantasia sombria",
      "Alta fantasia",
      "Fantasia urbana",
      "Fantasia brasileira/folclórica",
    ],
  },
  {
    grupo: "Terror",
    itens: ["Sobrenatural", "Terror psicológico", "Terror folclórico"],
  },
  {
    grupo: "Suspense e mistério",
    itens: [
      "Sobrenatural",
      "Thriller psicológico",
      "Policial e investigação",
      "True crime",
    ],
  },
  {
    grupo: "Ficção científica",
    itens: ["Distopia", "Ficção científica especulativa", "Pós-apocalíptico"],
  },
  {
    grupo: "Saúde e bem-estar",
    itens: [
      "Emagrecimento",
      "Menopausa e perimenopausa",
      "Sono e descanso",
      "Alimentação e receitas",
      "Saúde mental e ansiedade",
      "Exercício e movimento",
      "Saúde da mulher",
    ],
  },
  {
    grupo: "Desenvolvimento pessoal",
    itens: [
      "Autoestima e autoconhecimento",
      "Produtividade e hábitos",
      "Recomeços e transições",
      "Propósito e carreira",
      "Maternidade e paternidade",
    ],
  },
  {
    grupo: "Relacionamentos",
    itens: [
      "Vida a dois",
      "Divórcio e recomeço",
      "Namoro e maturidade",
      "Família e educação dos filhos",
    ],
  },
  {
    grupo: "Negócios e finanças",
    itens: [
      "Finanças pessoais e dívidas",
      "Empreendedorismo",
      "Contabilidade e controladoria",
      "Vendas e marketing",
      "Gestão e liderança",
      "Inteligência artificial nos negócios",
    ],
  },
  {
    grupo: "Educação e estudo",
    itens: ["Métodos de estudo", "Educação infantil", "Formação profissional"],
  },
  {
    grupo: "Espiritualidade",
    itens: ["Filosofia de vida", "Espiritualidade e fé", "Meditação"],
  },
  {
    grupo: "Tecnologia",
    itens: [
      "Inteligência artificial",
      "Programação e dados",
      "Ferramentas digitais",
    ],
  },
  {
    grupo: "Biografias e memórias",
    itens: ["Memórias pessoais", "Biografias", "Histórias de superação"],
  },
];

export const SEPARADOR = " > ";

/** Todos os caminhos no formato "Grupo > Item". */
export const CATEGORIAS: string[] = TAXONOMIA.flatMap((g) =>
  g.itens.map((item) => `${g.grupo}${SEPARADOR}${item}`),
);

const VALIDAS = new Set(CATEGORIAS);

export function isCategoriaValida(valor: string): boolean {
  return VALIDAS.has(valor);
}
