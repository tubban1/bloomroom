import { Pool } from "pg";
import { SUPABASE_CA } from "./supabase-ca";

let pool: Pool | undefined;

export function getDatabasePool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATA_URL || process.env.SUPABASE_DB_URL;
    if (!connectionString) throw new Error("Database connection string is not configured");
    pool = new Pool({
      connectionString,
      ssl: { ca: SUPABASE_CA, rejectUnauthorized: true },
      max: 4,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
  }
  return pool;
}
