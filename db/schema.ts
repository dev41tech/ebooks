import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";
export const profiles = pgTable(
  "profiles",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    displayName: text("display_name"),
    role: text("role").notNull().default("reader"),
    tasteProfile: jsonb("taste_profile"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [uniqueIndex("profiles_email_idx").on(t.email)],
);
export const books = pgTable(
  "books",
  {
    id: text("id").primaryKey(),
    slug: text("slug"),
    title: text("title").notNull(),
    subtitle: text("subtitle"),
    author: text("author").notNull(),
    authorId: text("author_id"),
    genre: text("genre").notNull(),
    language: text("language").notNull().default("pt-BR"),
    isbn: text("isbn"),
    collection: text("collection"),
    featured: boolean("featured").notNull().default(false),
    freeChapters: integer("free_chapters").notNull().default(1),
    format: text("format"),
    ageRating: text("age_rating"),
    description: text("description").notNull(),
    priceCents: integer("price_cents"),
    subscribersOnly: boolean("subscribers_only").default(
      false,
    ),
    coverKey: text("cover_key"),
    epubKey: text("epub_key"),
    audioKey: text("audio_key"),
    status: text("status").notNull().default("draft"),
    publishedAt: text("published_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at"),
  },
  (t) => [uniqueIndex("books_slug_idx").on(t.slug)],
);
export const chapters = pgTable("chapters", {
  id: text("id").primaryKey(),
  bookId: text("book_id")
    .notNull()
    .references(() => books.id),
  position: integer("position").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  createdAt: text("created_at").notNull(),
});
export const readingProgress = pgTable(
  "reading_progress",
  {
    id: text("id").primaryKey(),
    userEmail: text("user_email").notNull(),
    bookId: text("book_id").notNull(),
    chapter: integer("chapter").notNull().default(0),
    progress: integer("progress").notNull().default(0),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [uniqueIndex("progress_owner_book_idx").on(t.userEmail, t.bookId)],
);
export const bookmarks = pgTable(
  "bookmarks",
  {
    id: text("id").primaryKey(),
    userEmail: text("user_email").notNull(),
    bookId: text("book_id").notNull(),
    chapter: integer("chapter").notNull().default(0),
    chapterId: text("chapter_id"),
    label: text("label"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    uniqueIndex("bookmarks_owner_book_chapter_idx").on(
      t.userEmail,
      t.bookId,
      t.chapter,
    ),
  ],
);
export const favorites = pgTable(
  "favorites",
  {
    id: text("id").primaryKey(),
    userEmail: text("user_email").notNull(),
    bookId: text("book_id").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [uniqueIndex("favorites_owner_book_idx").on(t.userEmail, t.bookId)],
);
export const analyticsEvents = pgTable("analytics_events", {
  id: text("id").primaryKey(),
  userEmail: text("user_email"),
  anonymousId: text("anonymous_id"),
  event: text("event").notNull(),
  bookId: text("book_id"),
  chapterId: text("chapter_id"),
  metadata: jsonb("metadata"),
  createdAt: text("created_at").notNull(),
});
export const subscriptions = pgTable(
  "subscriptions",
  {
    id: text("id").primaryKey(),
    userEmail: text("user_email").notNull(),
    plan: text("plan").notNull(),
    status: text("status").notNull().default("trialing"),
    provider: text("provider").notNull().default("pending"),
    providerCustomerId: text("provider_customer_id"),
    providerSubscriptionId: text("provider_subscription_id"),
    currentPeriodEnd: text("current_period_end"),
    cancelAtPeriodEnd: boolean("cancel_at_period_end")
      .notNull()
      .default(false),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [uniqueIndex("subscription_owner_idx").on(t.userEmail)],
);
export const reviews = pgTable(
  "reviews",
  {
    id: text("id").primaryKey(),
    userEmail: text("user_email").notNull(),
    bookId: text("book_id").notNull(),
    rating: integer("rating").notNull(),
    comment: text("comment"),
    status: text("status").notNull().default("published"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [uniqueIndex("reviews_owner_book_idx").on(t.userEmail, t.bookId)],
);
export const readingSessions = pgTable("reading_sessions", {
  id: text("id").primaryKey(),
  userEmail: text("user_email").notNull(),
  bookId: text("book_id").notNull(),
  chapterId: text("chapter_id"),
  minutes: integer("minutes").notNull().default(0),
  startedAt: text("started_at").notNull(),
  endedAt: text("ended_at"),
});
export const notifications = pgTable("notifications", {
  id: text("id").primaryKey(),
  userEmail: text("user_email").notNull(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  readAt: text("read_at"),
  createdAt: text("created_at").notNull(),
});
export const mediaAssets = pgTable(
  "media_assets",
  {
    id: text("id").primaryKey(),
    ownerEmail: text("owner_email").notNull(),
    bookId: text("book_id"),
    kind: text("kind").notNull(),
    storageKey: text("storage_key").notNull(),
    fileName: text("file_name").notNull(),
    contentType: text("content_type").notNull(),
    size: integer("size").notNull(),
    status: text("status").notNull().default("ready"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [uniqueIndex("media_storage_key_idx").on(t.storageKey)],
);
// Produção de ebooks por IA (telas portadas do Sambu Ebooks). Guarda o pedido do
// autor e o rascunho resultante. A geração em si ainda não roda aqui — o registro
// nasce em "rascunho" e é preenchido quando a etapa de geração for ligada.
export const ebookDrafts = pgTable("ebook_drafts", {
  id: text("id").primaryKey(),
  ownerEmail: text("owner_email").notNull(),
  origin: text("origin").notNull().default("ia"),
  category: text("category").notNull().default("geral"),
  title: text("title").notNull().default(""),
  titleMode: text("title_mode").notNull().default("ai"),
  subtitle: text("subtitle").notNull().default(""),
  theme: text("theme").notNull(),
  audience: text("audience").notNull().default(""),
  tone: text("tone").notNull().default("Motivador"),
  language: text("language").notNull().default("Português (Brasil)"),
  pageCount: integer("page_count").notNull().default(20),
  wordsPerPage: integer("words_per_page").notNull().default(250),
  authorName: text("author_name").notNull().default(""),
  authorBio: text("author_bio").notNull().default(""),
  extraInstructions: text("extra_instructions").notNull().default(""),
  referenceMaterial: text("reference_material").notNull().default(""),
  referenceSource: text("reference_source").notNull().default(""),
  coverSource: text("cover_source").notNull().default("none"),
  coverSuggestion: text("cover_suggestion").notNull().default(""),
  coverKey: text("cover_key"),
  sourceFileName: text("source_file_name"),
  sourceStorageKey: text("source_storage_key"),
  intro: text("intro").notNull().default(""),
  conclusion: text("conclusion").notNull().default(""),
  marketing: jsonb("marketing"),
  status: text("status").notNull().default("rascunho"),
  statusMessage: text("status_message").notNull().default(""),
  publishedBookId: text("published_book_id"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const ebookDraftChapters = pgTable(
  "ebook_draft_chapters",
  {
    id: text("id").primaryKey(),
    draftId: text("draft_id")
      .notNull()
      .references(() => ebookDrafts.id),
    position: integer("position").notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull().default(""),
    content: text("content").notNull().default(""),
    createdAt: text("created_at").notNull(),
  },
  (t) => [uniqueIndex("draft_chapter_position_idx").on(t.draftId, t.position)],
);

export const importBatches = pgTable("import_batches", {
  id: text("id").primaryKey(),
  ownerEmail: text("owner_email").notNull(),
  name: text("name").notNull(),
  source: text("source").notNull(),
  environment: text("environment").notNull().default("test"),
  status: text("status").notNull().default("processing"),
  totalItems: integer("total_items").notNull().default(0),
  validItems: integer("valid_items").notNull().default(0),
  errorItems: integer("error_items").notNull().default(0),
  createdAt: text("created_at").notNull(),
  expiresAt: text("expires_at"),
});
export const stagingBooks = pgTable(
  "staging_books",
  {
    id: text("id").primaryKey(),
    batchId: text("batch_id").notNull(),
    ownerEmail: text("owner_email").notNull(),
    title: text("title").notNull(),
    author: text("author").notNull(),
    genre: text("genre"),
    language: text("language").notNull().default("pt-BR"),
    description: text("description"),
    isbn: text("isbn"),
    source: text("source"),
    sourceUrl: text("source_url"),
    licenseType: text("license_type"),
    rightsStatus: text("rights_status").notNull().default("pending"),
    fileName: text("file_name"),
    storageKey: text("storage_key"),
    contentType: text("content_type"),
    fileSize: integer("file_size"),
    coverKey: text("cover_key"),
    status: text("status").notNull().default("ready"),
    rightsConfirmed: boolean("rights_confirmed")
      .notNull()
      .default(false),
    reviewedBy: text("reviewed_by"),
    reviewedAt: text("reviewed_at"),
    correctionNote: text("correction_note"),
    publishedBookId: text("published_book_id"),
    validationErrors: jsonb("validation_errors"),
    isTest: boolean("is_test").notNull().default(true),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at"),
    expiresAt: text("expires_at"),
  },
  (t) => [
    uniqueIndex("staging_batch_title_author_idx").on(
      t.batchId,
      t.title,
      t.author,
    ),
  ],
);
