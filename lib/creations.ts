import { getDatabasePool } from "./db";
import {
  BUCKET_IMAGES,
  downloadStorageObject,
  isStorageConfigured,
  uploadStorageObject,
  validateImageBuffer,
} from "./storage";

export type CreationVisibility = "public" | "private";

export type Creation = {
  id: string;
  owner_user_id: string | null;
  source_draft_id: string | null;
  title: string;
  bouquet_data: Record<string, unknown>;
  preview_image_path: string | null;
  preview_image_data: string | null;
  visibility: CreationVisibility;
  like_count: number;
  created_at: Date;
  published_at: Date;
  updated_at: Date;
};

export type CreationCard = {
  id: string;
  title: string;
  author_name: string;
  is_owner: boolean;
  like_count: number;
  liked: boolean;
  published_at: string;
  image_url: string;
};

export type CreationDetail = {
  id: string;
  title: string;
  author_name: string;
  is_owner: boolean;
  visibility: CreationVisibility;
  like_count: number;
  liked: boolean;
  bouquet_data: Record<string, unknown>;
  published_at: string;
  created_at: string;
  image_url: string;
};

export type GallerySort = "latest" | "popular";

export const GUEST_COOKIE_NAME = "bloomroom_guest_id";
export const GUEST_COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

/**
 * Creates a creation in the database and uploads its preview image if provided.
 */
export async function createCreation({
  ownerUserId,
  sourceDraftId,
  title,
  bouquetData,
  imageBuffer,
  visibility = "public",
}: {
  ownerUserId?: string | null;
  sourceDraftId?: string | null;
  title?: string;
  bouquetData: Record<string, unknown>;
  imageBuffer?: Buffer | null;
  visibility?: CreationVisibility;
}): Promise<Creation> {
  const db = getDatabasePool();
  const safeTitle = (title || "未命名花束").trim().slice(0, 64) || "未命名花束";
  // Guests cannot create private creations
  const safeVisibility: CreationVisibility = ownerUserId ? (visibility === "private" ? "private" : "public") : "public";

  let uploadedPath: string | null = null;
  let fallbackData: string | null = null;

  if (imageBuffer && imageBuffer.length > 0) {
    const validated = validateImageBuffer(imageBuffer);
    if (validated && isStorageConfigured()) {
      try {
        const tempId = Math.random().toString(36).slice(2, 10);
        const path = `creations/${Date.now()}_${tempId}.${validated.ext}`;
        await uploadStorageObject(BUCKET_IMAGES, path, imageBuffer, validated.mime);
        uploadedPath = path;
      } catch (err) {
        console.warn("Could not upload creation image to storage, saving fallback data:", err);
        fallbackData = `data:${validated.mime};base64,${imageBuffer.toString("base64")}`;
      }
    } else if (validated) {
      fallbackData = `data:${validated.mime};base64,${imageBuffer.toString("base64")}`;
    }
  }

  const res = await db.query<Creation>(
    `INSERT INTO bloomroom.creations (
       owner_user_id, source_draft_id, title, bouquet_data,
       preview_image_path, preview_image_data, visibility
     ) VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      ownerUserId || null,
      sourceDraftId || null,
      safeTitle,
      JSON.stringify(bouquetData),
      uploadedPath,
      fallbackData,
      safeVisibility,
    ],
  );

  return res.rows[0];
}

/**
 * Retrieves public creations for the gallery with pagination and like status.
 */
export async function getGalleryCreations({
  sort = "latest",
  limit = 18,
  offset = 0,
  viewerUserId,
  guestId,
}: {
  sort?: GallerySort;
  limit?: number;
  offset?: number;
  viewerUserId?: string | null;
  guestId?: string | null;
}): Promise<{ items: CreationCard[]; total: number; hasMore: boolean }> {
  const db = getDatabasePool();
  const safeLimit = Math.min(Math.max(1, limit), 60);
  const safeOffset = Math.max(0, offset);

  // Determine sort clause:
  // latest: published_at DESC, id DESC
  // popular: like_count DESC, published_at DESC, id DESC
  const orderClause =
    sort === "popular"
      ? "c.like_count DESC, c.published_at DESC, c.id DESC"
      : "c.published_at DESC, c.id DESC";

  // Build like check condition
  const hasViewer = Boolean(viewerUserId || guestId);
  const likeJoinParam = viewerUserId ? viewerUserId : guestId;
  const likeCondition = viewerUserId ? "l.user_id = $1" : "l.guest_id = $1";

  const countRes = await db.query<{ count: string }>(
    `SELECT count(*) FROM bloomroom.creations WHERE visibility = 'public'`,
  );
  const total = Number.parseInt(countRes.rows[0]?.count || "0", 10);

  let query = "";
  let params: unknown[] = [];

  if (hasViewer) {
    query = `
      SELECT
        c.id,
        c.title,
        c.owner_user_id,
        u.username AS author_username,
        c.like_count,
        c.published_at,
        (l.id IS NOT NULL) AS liked
      FROM bloomroom.creations c
      LEFT JOIN bloomroom.users u ON c.owner_user_id = u.id
      LEFT JOIN bloomroom.creation_likes l ON l.creation_id = c.id AND ${likeCondition}
      WHERE c.visibility = 'public'
      ORDER BY ${orderClause}
      LIMIT $2 OFFSET $3
    `;
    params = [likeJoinParam, safeLimit, safeOffset];
  } else {
    query = `
      SELECT
        c.id,
        c.title,
        c.owner_user_id,
        u.username AS author_username,
        c.like_count,
        c.published_at,
        FALSE AS liked
      FROM bloomroom.creations c
      LEFT JOIN bloomroom.users u ON c.owner_user_id = u.id
      WHERE c.visibility = 'public'
      ORDER BY ${orderClause}
      LIMIT $1 OFFSET $2
    `;
    params = [safeLimit, safeOffset];
  }

  const result = await db.query<{
    id: string;
    title: string;
    owner_user_id: string | null;
    author_username: string | null;
    like_count: number;
    published_at: Date;
    liked: boolean;
  }>(query, params);

  const items: CreationCard[] = result.rows.map((row) => ({
    id: row.id,
    title: row.title || "未命名花束",
    author_name: row.author_username || "匿名花友",
    is_owner: Boolean(viewerUserId && row.owner_user_id === viewerUserId),
    like_count: Math.max(0, row.like_count || 0),
    liked: Boolean(row.liked),
    published_at: row.published_at.toISOString(),
    image_url: `/api/creations/${row.id}/image`,
  }));

  const hasMore = safeOffset + items.length < total;

  return { items, total, hasMore };
}

/**
 * Retrieves a single creation by ID, enforcing visibility checks.
 */
export async function getCreationDetail(
  id: string,
  viewerUserId?: string | null,
  guestId?: string | null,
): Promise<CreationDetail | null> {
  const db = getDatabasePool();

  const hasViewer = Boolean(viewerUserId || guestId);
  const likeCondition = viewerUserId ? "l.user_id = $2" : "l.guest_id = $2";
  const likeParam = viewerUserId ? viewerUserId : guestId;

  let query = "";
  let params: unknown[] = [];

  if (hasViewer) {
    query = `
      SELECT
        c.id,
        c.title,
        c.bouquet_data,
        c.visibility,
        c.owner_user_id,
        u.username AS author_username,
        c.like_count,
        c.published_at,
        c.created_at,
        (l.id IS NOT NULL) AS liked
      FROM bloomroom.creations c
      LEFT JOIN bloomroom.users u ON c.owner_user_id = u.id
      LEFT JOIN bloomroom.creation_likes l ON l.creation_id = c.id AND ${likeCondition}
      WHERE c.id = $1
    `;
    params = [id, likeParam];
  } else {
    query = `
      SELECT
        c.id,
        c.title,
        c.bouquet_data,
        c.visibility,
        c.owner_user_id,
        u.username AS author_username,
        c.like_count,
        c.published_at,
        c.created_at,
        FALSE AS liked
      FROM bloomroom.creations c
      LEFT JOIN bloomroom.users u ON c.owner_user_id = u.id
      WHERE c.id = $1
    `;
    params = [id];
  }

  const res = await db.query<{
    id: string;
    title: string;
    bouquet_data: Record<string, unknown>;
    visibility: CreationVisibility;
    owner_user_id: string | null;
    author_username: string | null;
    like_count: number;
    published_at: Date;
    created_at: Date;
    liked: boolean;
  }>(query, params);

  const row = res.rows[0];
  if (!row) return null;

  const isOwner = Boolean(viewerUserId && row.owner_user_id === viewerUserId);

  // If private, only owner can view details
  if (row.visibility === "private" && !isOwner) {
    return null;
  }

  return {
    id: row.id,
    title: row.title || "未命名花束",
    author_name: row.author_username || "匿名花友",
    is_owner: isOwner,
    visibility: row.visibility,
    like_count: Math.max(0, row.like_count || 0),
    liked: Boolean(row.liked),
    bouquet_data: row.bouquet_data,
    published_at: row.published_at.toISOString(),
    created_at: row.created_at.toISOString(),
    image_url: `/api/creations/${row.id}/image`,
  };
}

/**
 * Retrieves the raw image buffer for a creation, strictly checking permissions.
 */
export async function getCreationImageMedia(
  id: string,
  viewerUserId?: string | null,
): Promise<{ buffer: Buffer; mime: string; visibility: CreationVisibility } | null> {
  const db = getDatabasePool();
  const res = await db.query<{
    visibility: CreationVisibility;
    owner_user_id: string | null;
    preview_image_path: string | null;
    preview_image_data: string | null;
  }>(
    `SELECT visibility, owner_user_id, preview_image_path, preview_image_data
     FROM bloomroom.creations
     WHERE id = $1`,
    [id],
  );

  const row = res.rows[0];
  if (!row) return null;

  const isOwner = Boolean(viewerUserId && row.owner_user_id === viewerUserId);
  if (row.visibility === "private" && !isOwner) {
    return null;
  }

  if (row.preview_image_path) {
    try {
      const downloaded = await downloadStorageObject(BUCKET_IMAGES, row.preview_image_path);
      if (downloaded) {
        return {
          buffer: downloaded,
          mime: "image/jpeg",
          visibility: row.visibility,
        };
      }
    } catch (err) {
      console.warn("Could not download creation image from storage:", err);
    }
  }

  if (row.preview_image_data && row.preview_image_data.startsWith("data:")) {
    const comma = row.preview_image_data.indexOf(",");
    if (comma !== -1) {
      const meta = row.preview_image_data.slice(5, comma);
      const mime = meta.split(";")[0] || "image/jpeg";
      const b64 = row.preview_image_data.slice(comma + 1);
      return {
        buffer: Buffer.from(b64, "base64"),
        mime,
        visibility: row.visibility,
      };
    }
  }

  return null;
}

/**
 * Updates a creation's title or visibility. Only the owner can perform this.
 */
export async function updateCreation(
  id: string,
  ownerUserId: string,
  updates: { title?: string; visibility?: CreationVisibility },
): Promise<Creation | null> {
  const db = getDatabasePool();

  const current = await db.query<{ visibility: CreationVisibility }>(
    `SELECT visibility FROM bloomroom.creations WHERE id = $1 AND owner_user_id = $2`,
    [id, ownerUserId],
  );
  if (!current.rows[0]) return null;

  const prevVis = current.rows[0].visibility;
  const newVis = updates.visibility || prevVis;
  const safeTitle = updates.title !== undefined ? updates.title.trim().slice(0, 64) : undefined;

  // If switching from private to public, update published_at to now
  const shouldTouchPublishedAt = prevVis === "private" && newVis === "public";

  const res = await db.query<Creation>(
    `UPDATE bloomroom.creations
     SET title = COALESCE($3, title),
         visibility = COALESCE($4, visibility),
         published_at = CASE WHEN $5 THEN now() ELSE published_at END,
         updated_at = now()
     WHERE id = $1 AND owner_user_id = $2
     RETURNING *`,
    [id, ownerUserId, safeTitle, newVis, shouldTouchPublishedAt],
  );

  return res.rows[0] || null;
}

/**
 * Deletes a creation. Only the owner can delete their creation.
 */
export async function deleteCreation(id: string, ownerUserId: string): Promise<boolean> {
  const db = getDatabasePool();
  const res = await db.query(
    `DELETE FROM bloomroom.creations WHERE id = $1 AND owner_user_id = $2`,
    [id, ownerUserId],
  );
  return (res.rowCount ?? 0) > 0;
}

/**
 * Retrieves all creations owned by a user (both public and private).
 */
export async function getUserCreations(userId: string, limit = 50): Promise<CreationCard[]> {
  const db = getDatabasePool();
  const res = await db.query<{
    id: string;
    title: string;
    like_count: number;
    visibility: CreationVisibility;
    published_at: Date;
    created_at: Date;
    liked: boolean;
  }>(
    `SELECT
       c.id,
       c.title,
       c.like_count,
       c.visibility,
       c.published_at,
       c.created_at,
       (l.id IS NOT NULL) AS liked
     FROM bloomroom.creations c
     LEFT JOIN bloomroom.creation_likes l ON l.creation_id = c.id AND l.user_id = $1
     WHERE c.owner_user_id = $1
     ORDER BY c.updated_at DESC
     LIMIT $2`,
    [userId, limit],
  );

  return res.rows.map((row) => ({
    id: row.id,
    title: row.title || "未命名花束",
    author_name: "我",
    is_owner: true,
    visibility: row.visibility,
    like_count: Math.max(0, row.like_count || 0),
    liked: Boolean(row.liked),
    published_at: row.published_at.toISOString(),
    image_url: `/api/creations/${row.id}/image`,
  }));
}

/**
 * Adds a like to a public creation in an atomic transaction.
 */
export async function likeCreation(
  creationId: string,
  identity: { userId?: string | null; guestId?: string | null },
): Promise<{ success: boolean; like_count: number; liked: boolean }> {
  const { userId, guestId } = identity;
  if (!userId && !guestId) {
    throw new Error("No identity provided for like operation.");
  }

  const db = getDatabasePool();
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    // 1. Verify creation is public
    const creationCheck = await client.query<{ visibility: CreationVisibility; like_count: number }>(
      `SELECT visibility, like_count FROM bloomroom.creations WHERE id = $1 FOR UPDATE`,
      [creationId],
    );
    const creation = creationCheck.rows[0];
    if (!creation || creation.visibility !== "public") {
      await client.query("ROLLBACK");
      throw new Error("Artwork is not available for likes.");
    }

    // 2. Insert into creation_likes
    let insertRes;
    if (userId) {
      insertRes = await client.query(
        `INSERT INTO bloomroom.creation_likes (creation_id, user_id)
         VALUES ($1, $2)
         ON CONFLICT (creation_id, user_id) WHERE user_id IS NOT NULL DO NOTHING`,
        [creationId, userId],
      );
    } else {
      insertRes = await client.query(
        `INSERT INTO bloomroom.creation_likes (creation_id, guest_id)
         VALUES ($1, $2)
         ON CONFLICT (creation_id, guest_id) WHERE guest_id IS NOT NULL DO NOTHING`,
        [creationId, guestId],
      );
    }

    let finalCount = creation.like_count;
    if ((insertRes.rowCount ?? 0) > 0) {
      const updateRes = await client.query<{ like_count: number }>(
        `UPDATE bloomroom.creations
         SET like_count = like_count + 1
         WHERE id = $1
         RETURNING like_count`,
        [creationId],
      );
      finalCount = updateRes.rows[0]?.like_count ?? (finalCount + 1);
    }

    await client.query("COMMIT");
    return { success: true, like_count: finalCount, liked: true };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Removes a like from a creation in an atomic transaction.
 */
export async function unlikeCreation(
  creationId: string,
  identity: { userId?: string | null; guestId?: string | null },
): Promise<{ success: boolean; like_count: number; liked: boolean }> {
  const { userId, guestId } = identity;
  if (!userId && !guestId) {
    throw new Error("No identity provided for unlike operation.");
  }

  const db = getDatabasePool();
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const creationCheck = await client.query<{ like_count: number }>(
      `SELECT like_count FROM bloomroom.creations WHERE id = $1 FOR UPDATE`,
      [creationId],
    );
    const creation = creationCheck.rows[0];
    if (!creation) {
      await client.query("ROLLBACK");
      throw new Error("Artwork not found.");
    }

    let deleteRes;
    if (userId) {
      deleteRes = await client.query(
        `DELETE FROM bloomroom.creation_likes
         WHERE creation_id = $1 AND user_id = $2`,
        [creationId, userId],
      );
    } else {
      deleteRes = await client.query(
        `DELETE FROM bloomroom.creation_likes
         WHERE creation_id = $1 AND guest_id = $2`,
        [creationId, guestId],
      );
    }

    let finalCount = creation.like_count;
    if ((deleteRes.rowCount ?? 0) > 0) {
      const updateRes = await client.query<{ like_count: number }>(
        `UPDATE bloomroom.creations
         SET like_count = GREATEST(0, like_count - 1)
         WHERE id = $1
         RETURNING like_count`,
        [creationId],
      );
      finalCount = updateRes.rows[0]?.like_count ?? Math.max(0, finalCount - 1);
    }

    await client.query("COMMIT");
    return { success: true, like_count: finalCount, liked: false };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Merges guest likes into an authenticated user upon login or signup.
 * Removes duplicate likes and accurately reconciles like_count.
 */
export async function mergeGuestLikesIntoUser(guestId: string, userId: string): Promise<void> {
  if (!guestId || !userId) return;

  const db = getDatabasePool();
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    // 1. Delete conflict likes where user already liked the same creation
    const conflicts = await client.query<{ creation_id: string }>(
      `DELETE FROM bloomroom.creation_likes gl
       USING bloomroom.creation_likes ul
       WHERE gl.guest_id = $1
         AND ul.user_id = $2
         AND gl.creation_id = ul.creation_id
       RETURNING gl.creation_id`,
      [guestId, userId],
    );

    // If conflicts existed, decrement the like_count because guest was double-counted
    if (conflicts.rows.length > 0) {
      const countsByCreation: Record<string, number> = {};
      for (const row of conflicts.rows) {
        countsByCreation[row.creation_id] = (countsByCreation[row.creation_id] || 0) + 1;
      }
      for (const [cid, decr] of Object.entries(countsByCreation)) {
        await client.query(
          `UPDATE bloomroom.creations
           SET like_count = GREATEST(0, like_count - $1)
           WHERE id = $2`,
          [decr, cid],
        );
      }
    }

    // 2. Transfer non-conflicting guest likes to user
    await client.query(
      `UPDATE bloomroom.creation_likes
       SET user_id = $2, guest_id = NULL
       WHERE guest_id = $1`,
      [guestId, userId],
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Failed to merge guest likes into user:", err);
  } finally {
    client.release();
  }
}
