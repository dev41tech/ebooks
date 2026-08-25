import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

let client: ReturnType<typeof postgres> | null = null;
let database: ReturnType<typeof drizzle<typeof schema>> | null = null;

export async function getDb() {
  if (database) return database;

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL nao definida. Use a connection string do Supabase (Connection Pooling, modo transaction, porta 6543).",
    );
  }

  // `prepare: false` e obrigatorio com o pooler do Supabase em modo transaction:
  // prepared statements nao sobrevivem entre conexoes reaproveitadas.
  client = postgres(url, { prepare: false });
  database = drizzle(client, { schema });
  return database;
}
