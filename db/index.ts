/**
 * db/index.ts
 * Neon PostgreSQL database client using Drizzle ORM.
 * This module is SERVER-ONLY. Never import it from client components.
 */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is not set. See .env.example for setup.");
}

const sql = neon(process.env.DATABASE_URL);

export const db = drizzle(sql, { schema });

export * from "./schema";
