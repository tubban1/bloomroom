import { getDatabasePool } from "./db";

export type DraftSummary = {
  id: string;
  title: string;
  preview_image: string | null;
  version: number;
  created_at: string;
  updated_at: string;
};

export type DraftDetail = DraftSummary & {
  bouquet_data: Record<string, unknown>;
  ai_reading?: Record<string, unknown> | null;
};

export type SentPostcardSummary = {
  id: string;
  bouquet: string;
  to_name: string;
  message: string;
  from_name: string;
  created_at: string;
};

export async function getUserLibrary(userId: string, limit = 50): Promise<{
  drafts: DraftSummary[];
  postcards: SentPostcardSummary[];
}> {
  const db = getDatabasePool();

  const [draftsRes, postcardsRes] = await Promise.all([
    db.query<{
      id: string;
      title: string;
      preview_image: string | null;
      version: number;
      created_at: Date;
      updated_at: Date;
    }>(
      `SELECT id, title, preview_image, version, created_at, updated_at
       FROM bloomroom.drafts
       WHERE user_id = $1
       ORDER BY updated_at DESC
       LIMIT $2`,
      [userId, limit],
    ),
    db.query<{
      id: string;
      bouquet: string;
      to_name: string;
      message: string;
      from_name: string;
      created_at: Date;
    }>(
      `SELECT id, bouquet, to_name, message, from_name, created_at
       FROM bloomroom.postcards
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit],
    ),
  ]);

  return {
    drafts: draftsRes.rows.map((r) => ({
      id: r.id,
      title: r.title,
      preview_image: r.preview_image,
      version: r.version,
      created_at: r.created_at.toISOString(),
      updated_at: r.updated_at.toISOString(),
    })),
    postcards: postcardsRes.rows.map((r) => ({
      id: r.id,
      bouquet: r.bouquet,
      to_name: r.to_name,
      message: r.message,
      from_name: r.from_name,
      created_at: r.created_at.toISOString(),
    })),
  };
}

export async function createDraft(
  userId: string,
  title: string,
  bouquetData: Record<string, unknown>,
  previewImage?: string | null,
  customId?: string,
  aiReading?: Record<string, unknown> | null,
): Promise<DraftSummary> {
  const db = getDatabasePool();
  const safeTitle = (title || "未命名花束").trim().slice(0, 64);
  const safePreview = previewImage && previewImage.length <= 600000 ? previewImage : null;
  const safeAiReading = aiReading ? JSON.stringify(aiReading) : null;

  if (customId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(customId)) {
    const res = await db.query<{
      id: string;
      title: string;
      preview_image: string | null;
      version: number;
      created_at: Date;
      updated_at: Date;
    }>(
      `INSERT INTO bloomroom.drafts (id, user_id, title, bouquet_data, preview_image, ai_reading, version)
       VALUES ($1, $2, $3, $4, $5, $6, 1)
       ON CONFLICT (id) DO UPDATE
       SET title = EXCLUDED.title,
           bouquet_data = EXCLUDED.bouquet_data,
           preview_image = COALESCE(EXCLUDED.preview_image, bloomroom.drafts.preview_image),
           ai_reading = COALESCE(EXCLUDED.ai_reading, bloomroom.drafts.ai_reading),
           version = bloomroom.drafts.version + 1,
           updated_at = now()
       WHERE bloomroom.drafts.user_id = $2
       RETURNING id, title, preview_image, version, created_at, updated_at`,
      [customId, userId, safeTitle, JSON.stringify(bouquetData), safePreview, safeAiReading],
    );
    const row = res.rows[0];
    return {
      id: row.id,
      title: row.title,
      preview_image: row.preview_image,
      version: row.version,
      created_at: row.created_at.toISOString(),
      updated_at: row.updated_at.toISOString(),
    };
  }

  const res = await db.query<{
    id: string;
    title: string;
    preview_image: string | null;
    version: number;
    created_at: Date;
    updated_at: Date;
  }>(
    `INSERT INTO bloomroom.drafts (user_id, title, bouquet_data, preview_image, ai_reading, version)
     VALUES ($1, $2, $3, $4, $5, 1)
     RETURNING id, title, preview_image, version, created_at, updated_at`,
    [userId, safeTitle, JSON.stringify(bouquetData), safePreview, safeAiReading],
  );

  const row = res.rows[0];
  return {
    id: row.id,
    title: row.title,
    preview_image: row.preview_image,
    version: row.version,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

export async function getDraftDetail(draftId: string, userId: string): Promise<DraftDetail | null> {
  const db = getDatabasePool();
  const res = await db.query<{
    id: string;
    title: string;
    bouquet_data: Record<string, unknown>;
    preview_image: string | null;
    ai_reading: Record<string, unknown> | null;
    version: number;
    created_at: Date;
    updated_at: Date;
  }>(
    `SELECT id, title, bouquet_data, preview_image, ai_reading, version, created_at, updated_at
     FROM bloomroom.drafts
     WHERE id = $1 AND user_id = $2`,
    [draftId, userId],
  );

  const row = res.rows[0];
  if (!row) return null;

  return {
    id: row.id,
    title: row.title,
    bouquet_data: row.bouquet_data,
    preview_image: row.preview_image,
    ai_reading: row.ai_reading,
    version: row.version,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

export async function updateDraft(
  draftId: string,
  userId: string,
  title: string,
  bouquetData: Record<string, unknown>,
  previewImage: string | null | undefined,
  expectedVersion?: number,
  aiReading?: Record<string, unknown> | null,
): Promise<{ draft?: DraftSummary; conflict?: boolean; notFound?: boolean }> {
  const db = getDatabasePool();
  const safeTitle = (title || "未命名花束").trim().slice(0, 64);
  const safePreview = previewImage && previewImage.length <= 600000 ? previewImage : null;
  const safeAiReading = aiReading !== undefined ? (aiReading ? JSON.stringify(aiReading) : null) : undefined;

  if (typeof expectedVersion === "number") {
    const res = await db.query<{
      id: string;
      title: string;
      preview_image: string | null;
      version: number;
      created_at: Date;
      updated_at: Date;
    }>(
      `UPDATE bloomroom.drafts
       SET title = $3,
           bouquet_data = $4,
           preview_image = CASE WHEN $5::text IS NOT NULL THEN $5 ELSE preview_image END,
           ai_reading = CASE WHEN $7::jsonb IS NOT NULL THEN $7::jsonb ELSE ai_reading END,
           version = version + 1,
           updated_at = now()
       WHERE id = $1 AND user_id = $2 AND version = $6
       RETURNING id, title, preview_image, version, created_at, updated_at`,
      [draftId, userId, safeTitle, JSON.stringify(bouquetData), safePreview, expectedVersion, safeAiReading],
    );

    if (res.rows.length > 0) {
      const row = res.rows[0];
      return {
        draft: {
          id: row.id,
          title: row.title,
          preview_image: row.preview_image,
          version: row.version,
          created_at: row.created_at.toISOString(),
          updated_at: row.updated_at.toISOString(),
        },
      };
    }

    // Check if it exists with different version (conflict) or doesn't exist
    const checkRes = await db.query<{ version: number }>(
      `SELECT version FROM bloomroom.drafts WHERE id = $1 AND user_id = $2`,
      [draftId, userId],
    );

    if (checkRes.rows.length === 0) {
      return { notFound: true };
    }
    return { conflict: true };
  }

  // Without version check (e.g. rename only)
  const res = await db.query<{
    id: string;
    title: string;
    preview_image: string | null;
    version: number;
    created_at: Date;
    updated_at: Date;
  }>(
    `UPDATE bloomroom.drafts
     SET title = $3,
         bouquet_data = $4,
         preview_image = CASE WHEN $5::text IS NOT NULL THEN $5 ELSE preview_image END,
         ai_reading = CASE WHEN $6::jsonb IS NOT NULL THEN $6::jsonb ELSE ai_reading END,
         version = version + 1,
         updated_at = now()
     WHERE id = $1 AND user_id = $2
     RETURNING id, title, preview_image, version, created_at, updated_at`,
    [draftId, userId, safeTitle, JSON.stringify(bouquetData), safePreview, safeAiReading],
  );

  if (res.rows.length === 0) return { notFound: true };

  const row = res.rows[0];
  return {
    draft: {
      id: row.id,
      title: row.title,
      preview_image: row.preview_image,
      version: row.version,
      created_at: row.created_at.toISOString(),
      updated_at: row.updated_at.toISOString(),
    },
  };
}

export async function deleteDraft(draftId: string, userId: string): Promise<boolean> {
  const db = getDatabasePool();
  const res = await db.query(
    `DELETE FROM bloomroom.drafts WHERE id = $1 AND user_id = $2`,
    [draftId, userId],
  );
  return (res.rowCount ?? 0) > 0;
}
