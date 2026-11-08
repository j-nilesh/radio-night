/**
 * db/index.ts
 * Neon PostgreSQL database client using Drizzle ORM.
 * SERVER-ONLY — never import this from client components.
 *
 * The connection is lazy — built on first use, not at module evaluation time.
 * This prevents build failures when DATABASE_URL is not set in CI/build environments.
 */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

type DbClient = ReturnType<typeof drizzle<typeof schema>>;

let _db: DbClient | null = null;

function getDb(): DbClient {
  if (_db) return _db;

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL environment variable is not set. " +
      "Copy .env.example to .env.local and add your Neon connection string."
    );
  }

  const sql = neon(url);
  _db = drizzle(sql, { schema });
  return _db;
}

// Lazy proxy — the db object is a proxy that builds the connection on first property access
export const db = new Proxy({} as DbClient, {
  get(_target, prop) {
    return (getDb() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export * from "./schema";
