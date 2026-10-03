import { getDatabasePool } from "./db";

export type Postcard = {
  id: string;
  bouquet: string;
  to_name: string;
  message: string;
  from_name: string;
  created_at: Date;
  user_id?: string | null;
};

export async function createPostcard(
  postcard: Omit<Postcard, "created_at"> & { image_base64: string; user_id?: string | null },
) {
  const db = getDatabasePool();
  await db.query(
    `INSERT INTO bloomroom.postcards (id, bouquet, to_name, message, from_name, image_base64, user_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      postcard.id,
      postcard.bouquet,
      postcard.to_name,
      postcard.message,
      postcard.from_name,
      postcard.image_base64,
      postcard.user_id || null,
    ],
  );
}

export async function getPostcard(id: string): Promise<Postcard | null> {
  const db = getDatabasePool();
  const result = await db.query<Postcard>(
    "SELECT id, bouquet, to_name, message, from_name, created_at, user_id FROM bloomroom.postcards WHERE id = $1",
    [id],
  );
  return result.rows[0] ?? null;
}

export async function getPostcardImage(id: string): Promise<string | null> {
  const db = getDatabasePool();
  const result = await db.query<{ image_base64: string }>(
    "SELECT image_base64 FROM bloomroom.postcards WHERE id = $1",
    [id],
  );
  return result.rows[0]?.image_base64 ?? null;
}
