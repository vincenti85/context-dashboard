// db/client.ts — Neon Postgres client for Drizzle ORM.
// Lazy initialization to avoid build-time errors when DATABASE_URL is not set.
// DATABASE_URL = pooler connection (runtime).
// DIRECT_URL = direct connection (drizzle-kit migrate only, see drizzle.config.ts).

import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

type DB = NeonHttpDatabase<typeof schema>;

let _db: DB | null = null;

function getDb(): DB {
  if (!_db) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error(
        "DATABASE_URL is not set. Configure Neon Postgres connection in Vercel env vars.",
      );
    }
    const sql = neon(databaseUrl);
    _db = drizzle(sql, { schema });
  }
  return _db;
}

// Proxy that lazily initializes on first access
export const db = new Proxy({} as DB, {
  get(_target, prop, receiver) {
    const realDb = getDb();
    const value = Reflect.get(realDb, prop, receiver);
    return typeof value === "function" ? value.bind(realDb) : value;
  },
}) as DB;
