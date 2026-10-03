import { getDatabasePool } from "./db";

export type Postcard = {
  id: string;
  bouquet: string;
  to_name: string;
  message: string;
  from_name: string;
  image_base64?: string | null;
  image_path?: string | null;
  audio_path?: string | null;
  audio_mime?: string | null;
  audio_duration_ms?: number | null;
  audio_size_bytes?: number | null;
  created_at: Date;
  user_id?: string | null;
  creation_id?: string | null;
};

export async function createPostcard(
  postcard: {
    id: string;
    bouquet: string;
    to_name: string;
    message: string;
    from_name: string;
    image_base64?: string | null;
    image_path?: string | null;
    audio_path?: string | null;
    audio_mime?: string | null;
    audio_duration_ms?: number | null;
    audio_size_bytes?: number | null;
    user_id?: string | null;
    creation_id?: string | null;
  },
) {
  const db = getDatabasePool();
  await db.query(
    `INSERT INTO bloomroom.postcards (
       id, bouquet, to_name, message, from_name,
       image_base64, image_path,
       audio_path, audio_mime, audio_duration_ms, audio_size_bytes,
       user_id, creation_id
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
    [
      postcard.id,
      postcard.bouquet,
      postcard.to_name,
      postcard.message,
      postcard.from_name,
      postcard.image_base64 || null,
      postcard.image_path || null,
      postcard.audio_path || null,
      postcard.audio_mime || null,
      postcard.audio_duration_ms || null,
      postcard.audio_size_bytes || null,
      postcard.user_id || null,
      postcard.creation_id || null,
    ],
  );
}

export async function getPostcard(id: string): Promise<Postcard | null> {
  const db = getDatabasePool();
  const result = await db.query<Postcard>(
    `SELECT id, bouquet, to_name, message, from_name,
            image_base64, image_path,
            audio_path, audio_mime, audio_duration_ms, audio_size_bytes,
            created_at, user_id
     FROM bloomroom.postcards WHERE id = $1`,
    [id],
  );
  return result.rows[0] ?? null;
}

export async function getPostcardImageRecord(id: string): Promise<{ image_base64: string | null; image_path: string | null } | null> {
  const db = getDatabasePool();
  const result = await db.query<{ image_base64: string | null; image_path: string | null }>(
    "SELECT image_base64, image_path FROM bloomroom.postcards WHERE id = $1",
    [id],
  );
  return result.rows[0] ?? null;
}

// Kept for backward compatibility
export async function getPostcardImage(id: string): Promise<string | null> {
  const record = await getPostcardImageRecord(id);
  return record?.image_base64 ?? null;
}
