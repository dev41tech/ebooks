import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./drizzle",
  schema: "./db/schema.ts",
  dialect: "postgresql",
  // Para `drizzle-kit migrate`. Use a connection string DIRETA do Supabase
  // (porta 5432), nao a do pooler em modo transaction: DDL e prepared
  // statements nao se dao bem com o pooler.
  dbCredentials: {
    url: process.env.DATABASE_URL || "",
  },
});
