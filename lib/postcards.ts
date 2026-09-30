import { Pool } from "pg";

export type Postcard = {
  id: string;
  bouquet: string;
  to_name: string;
  message: string;
  from_name: string;
  created_at: Date;
};

let pool: Pool | undefined;

function database() {
  if (!pool) {
    const connectionString = process.env.DATA_URL || process.env.SUPABASE_DB_URL;
    if (!connectionString) throw new Error("Postcard database is not configured");
    pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: true },
      max: 2,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
  }
  return pool;
}

export async function createPostcard(postcard: Omit<Postcard, "created_at"> & { image_base64: string }) {
  await database().query(
    `insert into bloomroom.postcards (id, bouquet, to_name, message, from_name, image_base64)
     values ($1, $2, $3, $4, $5, $6)`,
    [postcard.id, postcard.bouquet, postcard.to_name, postcard.message, postcard.from_name, postcard.image_base64],
  );
}

export async function getPostcard(id: string): Promise<Postcard | null> {
  const result = await database().query<Postcard>(
    "select id, bouquet, to_name, message, from_name, created_at from bloomroom.postcards where id = $1",
    [id],
  );
  return result.rows[0] ?? null;
}

export async function getPostcardImage(id: string): Promise<string | null> {
  const result = await database().query<{ image_base64: string }>(
    "select image_base64 from bloomroom.postcards where id = $1",
    [id],
  );
  return result.rows[0]?.image_base64 ?? null;
}
