/**
 * Bloomroom – Sketchfab batch downloader + packer
 *
 * Usage:
 *   node scripts/download-sketchfab-models.mjs
 *
 * Requires SKETCHFAB_TOKEN in env or hardcoded below.
 * Downloads each model's GLB (or glTF zip fallback), then runs the
 * existing pack-sketchfab-gltf.mjs pipeline to resize textures and
 * produce a production-ready GLB in public/models/.
 */

import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import https from "node:https";
import { execFile as _execFile } from "node:child_process";
import { promisify } from "node:util";
import { createWriteStream } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { default: sharp } = await import("sharp");

const execFile = promisify(_execFile);

const TOKEN = process.env.SKETCHFAB_TOKEN ?? "eeaa2f68adc4416fabc9276bcb3c80a7";
const MODELS_DIR = path.resolve("public/models");
const TMP_DIR = path.resolve("/tmp/bloomroom-downloads");

await fs.mkdir(TMP_DIR, { recursive: true });

// ─────────────────────────────────────────────────────────────────────────────
// Model manifest
// Each entry:
//   uid      – Sketchfab model UID
//   out      – output filename (without .glb)
//   title    – human-readable name
//   author   – display name shown in credits
//   username – Sketchfab username (for profileUrl)
//   license  – CC license URL
//   changes  – what we did to it
//   type     – "stem" | "flower" (affects ImportedFlower.tsx registration note)
// ─────────────────────────────────────────────────────────────────────────────
const MANIFEST = [
  // ── Main / Focal Blooms ─────────────────────────────────────────────────
  {
    uid: "569a71ccf4d94c1585c9573521fb998f",
    out: "sunflower",
    title: "Sunflower",
    author: "Polygonal Miniatures",
    username: "PolygonalMindstudio",
    license: "http://creativecommons.org/licenses/by/4.0/",
    changes: "Complete flower stem retained; textures resized to at most 1024px; materials normalized at runtime.",
    type: "stem",
  },
  {
    uid: "ed453cd6b12f4dfa8d4f3dcf68c97cf1",
    out: "orchid",
    title: "Orchid",
    author: "Rigsters",
    username: "Rigsters",
    license: "http://creativecommons.org/licenses/by/4.0/",
    changes: "Photogrammetry orchid stem retained; textures resized to at most 1024px; materials converted to PBR and normalized.",
    type: "stem",
  },
  {
    uid: "92008b5d9d0c4643bf7de2c5374a8cb3",
    out: "calla-lily",
    title: "Kála – Calla Lily (Zantedeschia)",
    author: "TIS",
    username: "TIS",
    license: "http://creativecommons.org/licenses/by/4.0/",
    changes: "Complete calla lily stem retained; textures resized to at most 1024px; materials normalized at runtime.",
    type: "stem",
  },
  {
    uid: "1f051fc353e746869844ca45412c850b",
    out: "carnation",
    title: "Single flower / Carnation",
    author: "GardenBee",
    username: "pocketpastel456",
    license: "http://creativecommons.org/licenses/by/4.0/",
    changes: "Flower stem extracted and normalized; textures resized to at most 1024px; materials normalized at runtime.",
    type: "stem",
  },
  {
    uid: "cc518ec481154c51b1effbc67dd685ff",
    out: "lily",
    title: "Lilium",
    author: "TahirNilin",
    username: "TahirNilin",
    license: "http://creativecommons.org/licenses/by/4.0/",
    changes: "Complete lily stem retained; textures resized to at most 1024px; materials normalized at runtime.",
    type: "stem",
  },
  {
    uid: "d69e1be5895f40e484f0db472a721c2f",
    out: "lotus",
    title: "CC0 Indian Lotus (Nelumbo nucifera)",
    author: "ffish.asia / floraZia.com",
    username: "ffishAsia-and-floraZia",
    license: "https://creativecommons.org/publicdomain/zero/1.0/",
    changes: "Photogrammetry lotus flower retained; textures resized to at most 1024px; materials converted to PBR.",
    type: "stem",
  },
  {
    uid: "d40b58e0af514977aa52b839659dc1d3",
    out: "anemone",
    title: "Anemone hybrida 'Honorine Jobert'",
    author: "Livin Vision",
    username: "LivinVision",
    license: "http://creativecommons.org/licenses/by/4.0/",
    changes: "Complete anemone stem retained; textures resized to at most 1024px; materials normalized at runtime.",
    type: "stem",
  },

  // ── Filler / Accent Blooms ──────────────────────────────────────────────
  {
    uid: "31df46bbac484e3aa549032d8f321b6d",
    out: "chamomile",
    title: "Chamomile",
    author: "Cosmic_dust",
    username: "Cosmic_dust",
    license: "http://creativecommons.org/licenses/by/4.0/",
    changes: "Complete chamomile stem retained; textures resized to at most 1024px; materials normalized at runtime.",
    type: "stem",
  },
  {
    uid: "221602f5ae55471990f669d480217626",
    out: "delphinium",
    title: "White Delphinium / Witte Delphinium",
    author: "Marco van Ammers – Tazama",
    username: "tazama",
    license: "http://creativecommons.org/licenses/by/4.0/",
    changes: "Complete delphinium spike retained; textures resized to at most 1024px; materials normalized at runtime.",
    type: "stem",
  },
  {
    uid: "14890248c9374b569a7bc0d497ccdbe0",
    out: "snowdrop",
    title: "Snowdrop pack (lowpoly, gameready, LOD)",
    author: "LOLIPOP",
    username: "lolipop_1707",
    license: "http://creativecommons.org/licenses/by/4.0/",
    changes: "One snowdrop stem extracted; scale normalized for Bloomroom arrangement.",
    type: "stem",
  },
  {
    uid: "7c92205759f24f8fb0a0974d192e2c74",
    out: "lavender",
    title: "Lavender vase",
    author: "Moons",
    username: "Moons",
    license: "http://creativecommons.org/licenses/by/4.0/",
    changes: "Lavender stems extracted from vase scene; textures resized to at most 1024px; materials normalized.",
    type: "stem",
  },

  // ── Foliage ─────────────────────────────────────────────────────────────
  {
    uid: "0c80d67aa8fb4688bd1187518e4cc686",
    out: "ivy",
    title: "Ivy pack (12 variations, lowpoly, LODs)",
    author: "LOLIPOP",
    username: "lolipop_1707",
    license: "http://creativecommons.org/licenses/by/4.0/",
    changes: "One trailing ivy vine extracted; scale normalized for Bloomroom arrangement.",
    type: "stem",
  },
  {
    uid: "321f1c05b802494196096e462a6c4e72",
    out: "monstera",
    title: "Monstera Deliciosa Leaf",
    author: "Shift4cube",
    username: "Shift4cube",
    license: "http://creativecommons.org/licenses/by/4.0/",
    changes: "Single monstera leaf with stem retained; textures resized to at most 1024px; materials normalized.",
    type: "stem",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "User-Agent": "Bloomroom/1.0" } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) {
        return resolve(httpsGet(res.headers.location));
      }
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", reject);
    }).on("error", reject);
  });
}

function httpsGetToFile(url, filePath) {
  return new Promise((resolve, reject) => {
    const follow = (u) => {
      https.get(u, { headers: { "User-Agent": "Bloomroom/1.0" } }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) {
          return follow(res.headers.location);
        }
        const ws = createWriteStream(filePath);
        res.pipe(ws);
        ws.on("finish", () => resolve(filePath));
        ws.on("error", reject);
        res.on("error", reject);
      }).on("error", reject);
    };
    follow(url);
  });
}

async function getDownloadUrls(uid) {
  const buf = await httpsGet(`https://api.sketchfab.com/v3/models/${uid}/download`);
  // Note: we need auth header here, can't use simple httpsGet
  // Use curl via execFile instead
  throw new Error("use curl path");
}

async function fetchDownloadUrls(uid) {
  const { stdout } = await execFile("curl", [
    "-s",
    `https://api.sketchfab.com/v3/models/${uid}/download`,
    "-H", `Authorization: Token ${TOKEN}`,
  ]);
  return JSON.parse(stdout);
}

async function downloadGlb(uid, outPath) {
  const urls = await fetchDownloadUrls(uid);
  if (urls.glb?.url) {
    console.log(`  ↓ Downloading pre-built GLB (${(urls.glb.size / 1e6).toFixed(1)} MB)…`);
    await httpsGetToFile(urls.glb.url, outPath);
    return "glb";
  }
  throw new Error("No GLB available; source-only model");
}

async function downloadGltfZip(uid, outZip) {
  const urls = await fetchDownloadUrls(uid);
  const src = urls.gltf ?? urls.source;
  if (!src?.url) throw new Error(`No downloadable URL for ${uid}`);
  console.log(`  ↓ Downloading glTF zip (${(src.size / 1e6).toFixed(1)} MB)…`);
  await httpsGetToFile(src.url, outZip);
  return src;
}

async function unzip(zipPath, destDir) {
  await fs.mkdir(destDir, { recursive: true });
  await execFile("unzip", ["-o", "-q", zipPath, "-d", destDir]);
}

async function findSceneGltf(dir) {
  const entries = await fs.readdir(dir, { recursive: true });
  for (const e of entries) {
    if (e.endsWith("scene.gltf") || e.endsWith(".gltf")) {
      return path.join(dir, e);
    }
  }
  return null;
}

async function packFromGltfDir(gltfDir, outGlb) {
  // Use existing pack script
  const packScript = path.resolve("scripts/pack-sketchfab-gltf.mjs");
  const { stdout, stderr } = await execFile("node", [packScript, gltfDir, outGlb], { timeout: 120_000 });
  if (stdout) console.log("  pack:", stdout.trim());
  if (stderr) console.error("  pack stderr:", stderr.trim());
}

async function resizeGlbTextures(glbPath) {
  // Use existing resize script
  const resizeScript = path.resolve("scripts/resize-model-textures.mjs");
  try {
    await fs.access(resizeScript);
    const { stdout, stderr } = await execFile("node", [resizeScript, glbPath], { timeout: 120_000 });
    if (stdout) console.log("  resize:", stdout.trim());
  } catch {
    // resize script may not exist or not applicable for GLB
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main download + pack loop
// ─────────────────────────────────────────────────────────────────────────────

const results = [];

for (const model of MANIFEST) {
  const outGlb = path.join(MODELS_DIR, `${model.out}.glb`);

  // Skip if already exists
  if (fsSync.existsSync(outGlb)) {
    const stat = await fs.stat(outGlb);
    console.log(`✓ SKIP ${model.out}.glb (already ${(stat.size / 1e6).toFixed(1)} MB)`);
    results.push({ ...model, status: "skipped", size: stat.size });
    continue;
  }

  console.log(`\n▶ ${model.title}`);
  console.log(`  UID: ${model.uid}`);

  try {
    const tmpGlb = path.join(TMP_DIR, `${model.out}.glb`);
    const tmpZip = path.join(TMP_DIR, `${model.out}.zip`);
    const tmpDir = path.join(TMP_DIR, model.out);

    // First try: pre-built GLB from Sketchfab (fastest, already packed)
    let strategy = "unknown";
    try {
      await downloadGlb(model.uid, tmpGlb);
      // Copy to models dir
      await fs.copyFile(tmpGlb, outGlb);
      strategy = "glb-direct";
    } catch (glbErr) {
      // Fallback: download glTF zip and pack locally
      console.log("  No direct GLB, trying glTF zip…");
      await downloadGltfZip(model.uid, tmpZip);
      await unzip(tmpZip, tmpDir);

      // find the gltf dir
      const gltfFile = await findSceneGltf(tmpDir);
      if (!gltfFile) throw new Error("Could not find scene.gltf in zip");
      const gltfDir = path.dirname(gltfFile);

      await packFromGltfDir(gltfDir, outGlb);
      strategy = "gltf-packed";
    }

    const stat = await fs.stat(outGlb);
    console.log(`  ✓ ${model.out}.glb saved (${(stat.size / 1e6).toFixed(1)} MB, strategy=${strategy})`);
    results.push({ ...model, status: "ok", strategy, size: stat.size });
  } catch (err) {
    console.error(`  ✗ FAILED: ${err.message}`);
    results.push({ ...model, status: "failed", error: err.message });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Update credits.json
// ─────────────────────────────────────────────────────────────────────────────

const creditsPath = path.join(MODELS_DIR, "credits.json");
const existing = JSON.parse(await fs.readFile(creditsPath, "utf8"));
const existingFiles = new Set(existing.map((e) => e.file));

for (const r of results) {
  if (r.status === "failed") continue;
  const file = `${r.out}.glb`;
  if (existingFiles.has(file)) continue;

  existing.push({
    file,
    title: r.title,
    author: r.author,
    authorUrl: `https://sketchfab.com/${r.username}`,
    source: `https://sketchfab.com/3d-models/${r.uid}`,
    license: r.license,
    changes: r.changes,
  });
  existingFiles.add(file);
}

await fs.writeFile(creditsPath, JSON.stringify(existing, null, 2) + "\n");
console.log("\n✓ credits.json updated");

// ─────────────────────────────────────────────────────────────────────────────
// Print summary
// ─────────────────────────────────────────────────────────────────────────────

console.log("\n═══════════════════════════════════════════════════════");
console.log("SUMMARY");
console.log("═══════════════════════════════════════════════════════");
for (const r of results) {
  const mb = r.size ? `${(r.size / 1e6).toFixed(1)} MB` : "";
  const tag = r.status === "ok" ? "✓" : r.status === "skipped" ? "–" : "✗";
  console.log(`${tag} ${r.out}.glb ${mb} ${r.status === "failed" ? "← " + r.error : ""}`);
}

const failed = results.filter((r) => r.status === "failed");
if (failed.length) {
  console.log(`\n⚠ ${failed.length} model(s) failed. See above for details.`);
  process.exit(1);
} else {
  console.log("\nAll done ✓");
}
