import { getDatabasePool } from "../lib/db";
import { randomUUID } from "crypto";

const FLOWER_NAMES: Record<string, string> = {
  rose: "玫瑰",
  tulip: "郁金香",
  daisy: "雏菊",
  poppy: "虞美人",
  peony: "芍药",
  "blue-poppy": "蓝罂粟",
  sunflower: "向日葵",
  orchid: "兰花",
  "calla-lily": "马蹄莲",
  carnation: "康乃馨",
  lily: "百合",
  lotus: "荷花",
  anemone: "银莲花",
  chamomile: "洋甘菊",
  delphinium: "飞燕草",
  lavender: "薰衣草",
  ranunculus: "花毛茛",
  dahlia: "大丽花",
  amaryllis: "朱顶红",
  astrantia: "大星芹",
  eryngium: "刺芹",
  hydrangea: "绣球",
  chrysanthemum: "菊花",
  "lily-of-the-valley": "铃兰",
  fern: "蕨叶",
  eucalyptus: "尤加利",
  "seeded-eucalyptus": "果尤加利",
  ivy: "常春藤",
  monstera: "龟背竹",
  "pine-cone": "松果",
};

function decodeBouquet(value: string): Record<string, unknown> | null {
  try {
    let raw = value;
    try { raw = decodeURIComponent(value); } catch {}
    if (raw.startsWith("{") || raw.startsWith("[")) return JSON.parse(raw);
    let normalized = raw.replaceAll("-", "+").replaceAll("_", "/");
    while (normalized.length % 4) normalized += "=";
    return JSON.parse(decodeURIComponent(Buffer.from(normalized, "base64").toString("utf-8")));
  } catch {
    try { return JSON.parse(decodeURIComponent(value)); } catch { return null; }
  }
}

function generateTitleFromBouquet(bouquetData: Record<string, unknown> | null): string {
  if (!bouquetData || !Array.isArray(bouquetData.stems) || bouquetData.stems.length === 0) {
    return "花间小品";
  }

  const stemKinds = Array.from(
    new Set(
      bouquetData.stems
        .map((s: { kind?: string }) => s.kind)
        .filter((k): k is string => Boolean(k && FLOWER_NAMES[k]))
    )
  );

  const mainFlowers = stemKinds.filter(
    (k) => !["fern", "eucalyptus", "seeded-eucalyptus", "ivy", "monstera", "pine-cone"].includes(k)
  );

  if (mainFlowers.length === 1) {
    return `${FLOWER_NAMES[mainFlowers[0]]}小品`;
  }
  if (mainFlowers.length === 2) {
    return `${FLOWER_NAMES[mainFlowers[0]]}与${FLOWER_NAMES[mainFlowers[1]]}`;
  }
  if (mainFlowers.length >= 3) {
    return `${FLOWER_NAMES[mainFlowers[0]]}与杂木之歌`;
  }
  if (stemKinds.length > 0) {
    return `${FLOWER_NAMES[stemKinds[0]]}花束`;
  }
  return "花间小品";
}

async function run() {
  const pool = getDatabasePool();
  console.log("Starting backfill of historical postcards into creations...");

  const postcardsRes = await pool.query(
    `SELECT id, user_id, bouquet, image_path, image_base64, created_at, creation_id
     FROM bloomroom.postcards
     ORDER BY created_at ASC`
  );

  console.log(`Found ${postcardsRes.rows.length} total postcards.`);

  let createdCount = 0;
  let linkedCount = 0;

  for (const p of postcardsRes.rows) {
    if (p.creation_id) {
      console.log(`Postcard ${p.id} already linked to creation ${p.creation_id}. Skipping.`);
      continue;
    }

    const decoded = decodeBouquet(p.bouquet);
    if (!decoded) {
      console.warn(`Could not decode bouquet for postcard ${p.id}. Skipping.`);
      continue;
    }

    const title = generateTitleFromBouquet(decoded);
    const creationId = randomUUID();

    // Insert into bloomroom.creations
    await pool.query(
      `INSERT INTO bloomroom.creations (
         id, owner_user_id, source_draft_id, title,
         bouquet_data, preview_image_path, preview_image_data,
         visibility, like_count, published_at, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        creationId,
        p.user_id || null,
        null,
        title,
        JSON.stringify(decoded),
        p.image_path || null,
        p.image_base64 || null,
        "public",
        0,
        p.created_at,
        p.created_at,
        p.created_at,
      ]
    );

    // Link postcard to this creation
    await pool.query(
      `UPDATE bloomroom.postcards SET creation_id = $1 WHERE id = $2`,
      [creationId, p.id]
    );

    createdCount++;
    linkedCount++;
    console.log(`Created creation ${creationId} ("${title}") from postcard ${p.id}.`);
  }

  console.log(`\nBackfill complete! Created ${createdCount} creations, linked ${linkedCount} postcards.`);
  process.exit(0);
}

run().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
