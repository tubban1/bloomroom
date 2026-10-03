import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import https from "node:https";
import { execFile as _execFile } from "node:child_process";
import { promisify } from "node:util";
import { createWriteStream } from "node:fs";

const execFile = promisify(_execFile);

const TOKEN = process.env.SKETCHFAB_TOKEN;
if (!TOKEN) throw new Error("Set SKETCHFAB_TOKEN in the environment before downloading/searching.");
const MODELS_DIR = path.resolve(".asset-sources/swiss-downloads");
await fs.mkdir(MODELS_DIR, { recursive: true });
const TMP_DIR = path.resolve("/tmp/bloomroom-swiss-downloads");

await fs.mkdir(TMP_DIR, { recursive: true });

const SWISS_MANIFEST = [
  {
    "uid": "fc8c0cd50b7f4e108d054c401b2bc148",
    "out": "ranunculus",
    "title": "Generic Ranunculus flower",
    "author": "assetfactory",
    "username": "assetfactory",
    "license": "https://sketchfab.com/licenses",
    "changes": "Raw verified source download; requires prepare-swiss-florals.py before serving.",
    "type": "head"
  },
  {
    "uid": "ab69ed2779eb4a14b0d3967859c5242a",
    "out": "narcissus",
    "title": "CC0 \u30b9\u30a4\u30bb\u30f3 \u6c34\u4ed9 Chinese Sacred Lily, N. tazetta",
    "author": "ffish.asia / floraZia.com",
    "username": "ffishAsia-and-floraZia",
    "license": "http://creativecommons.org/publicdomain/zero/1.0/",
    "changes": "Raw verified source download; requires prepare-swiss-florals.py before serving.",
    "type": "head"
  },
  {
    "uid": "6b7e01c17b114aa1ba4902f52e8b5966",
    "out": "dahlia",
    "title": "Bicolor dahila",
    "author": "Angelica_Andreasson",
    "username": "Angelica_Andreasson",
    "license": "http://creativecommons.org/licenses/by/4.0/",
    "changes": "Raw verified source download; requires prepare-swiss-florals.py before serving.",
    "type": "head"
  },
  {
    "uid": "79a78278d66d4659ace5de05826df23d",
    "out": "amaryllis",
    "title": "PINK AMARYLLIS",
    "author": "tmt.accon",
    "username": "tmt.accon",
    "license": "http://creativecommons.org/licenses/by/4.0/",
    "changes": "Raw verified source download; requires prepare-swiss-florals.py before serving.",
    "type": "stem"
  },
  {
    "uid": "2aa7264393544dc98f7b2e74857e6952",
    "out": "astrantia",
    "title": "Flowers",
    "author": "rahumbarger27",
    "username": "rahumbarger27",
    "license": "http://creativecommons.org/licenses/by/4.0/",
    "changes": "Raw verified source download; requires prepare-swiss-florals.py before serving.",
    "type": "head"
  },
  {
    "uid": "e19a4c1a3b1541308923c744221899e7",
    "out": "eryngium",
    "title": "Mixed Flower Bouquet \u2013 Downloadable 3D Scan",
    "author": "David Antalek",
    "username": "David.Antalek",
    "license": "http://creativecommons.org/licenses/by/4.0/",
    "changes": "Raw verified source download; requires prepare-swiss-florals.py before serving.",
    "type": "head"
  },
  {
    "uid": "f606d751e51341bb807209c6404208ed",
    "out": "pine-cone",
    "title": "Pine Cone",
    "author": "ChrisLee",
    "username": "chrisleeX",
    "license": "http://creativecommons.org/licenses/by/4.0/",
    "changes": "Raw verified source download; requires prepare-swiss-florals.py before serving.",
    "type": "head"
  }
];

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

async function fetchDownloadUrls(uid, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const { stdout } = await execFile("curl", [
      "-s",
      `https://api.sketchfab.com/v3/models/${uid}/download`,
      "-H", `Authorization: Token ${TOKEN}`,
    ]);
    const json = JSON.parse(stdout);
    if (json.detail?.includes("Too many requests")) {
      console.log(`    ⏳ Rate limited (429). Backing off for 12s... (attempt ${attempt}/${retries})`);
      await new Promise((r) => setTimeout(r, 12000));
      continue;
    }
    return json;
  }
  throw new Error("Sketchfab API rate limit exceeded after retries");
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
  const packScript = path.resolve("scripts/pack-sketchfab-gltf.mjs");
  const { stdout, stderr } = await execFile("node", [packScript, gltfDir, outGlb], { timeout: 180_000 });
  if (stdout) console.log("    pack stdout:", stdout.trim().split("\n").slice(-2).join(" "));
  if (stderr) console.error("    pack stderr:", stderr.trim());
}

console.log(`Starting download of ${SWISS_MANIFEST.length} Swiss Floral 3D Models...\n`);

const results = [];

for (let i = 0; i < SWISS_MANIFEST.length; i++) {
  const model = SWISS_MANIFEST[i];
  const outGlb = path.join(MODELS_DIR, `${model.out}.glb`);

  console.log(`[${i + 1}/${SWISS_MANIFEST.length}] ▶ ${model.title} (${model.out}.glb)`);

  if (fsSync.existsSync(outGlb)) {
    const stat = await fs.stat(outGlb);
    console.log(`  ✓ SKIP: Already exists (${(stat.size / 1e6).toFixed(2)} MB)\n`);
    results.push({ ...model, status: "skipped", size: stat.size });
    continue;
  }

  try {
    const tmpGlb = path.join(TMP_DIR, `${model.out}.glb`);
    const tmpZip = path.join(TMP_DIR, `${model.out}.zip`);
    const tmpDir = path.join(TMP_DIR, model.out);

    // Fetch download URLs from Sketchfab with rate limiting safety
    const urls = await fetchDownloadUrls(model.uid);
    let strategy = "unknown";

    if (urls.glb?.url) {
      console.log(`  ↓ Direct GLB available (${(urls.glb.size / 1e6).toFixed(2)} MB)...`);
      await httpsGetToFile(urls.glb.url, tmpGlb);
      await fs.copyFile(tmpGlb, outGlb);
      strategy = "glb-direct";
    } else if (urls.gltf?.url || urls.source?.url) {
      const src = urls.gltf ?? urls.source;
      console.log(`  ↓ glTF zip available (${(src.size / 1e6).toFixed(2)} MB)...`);
      await httpsGetToFile(src.url, tmpZip);
      console.log(`  ⚙ Unpacking & optimizing textures with Sharp...`);
      await unzip(tmpZip, tmpDir);
      const gltfFile = await findSceneGltf(tmpDir);
      if (!gltfFile) throw new Error("No gltf found in archive");
      await packFromGltfDir(path.dirname(gltfFile), outGlb);
      strategy = "gltf-packed";
    } else {
      throw new Error("No valid download link in API response: " + JSON.stringify(urls));
    }

    const stat = await fs.stat(outGlb);
    console.log(`  ✓ Saved ${model.out}.glb (${(stat.size / 1e6).toFixed(2)} MB via ${strategy})\n`);
    results.push({ ...model, status: "ok", strategy, size: stat.size });
  } catch (err) {
    console.error(`  ✗ Failed: ${err.message}\n`);
    results.push({ ...model, status: "failed", error: err.message });
  }

  // Graceful pause between requests to respect Sketchfab API limits
  if (i < SWISS_MANIFEST.length - 1) {
    await new Promise((r) => setTimeout(r, 4500));
  }
}

// Update credits.json
const creditsPath = path.join(MODELS_DIR, "credits.json");
const existing = fsSync.existsSync(creditsPath) ? JSON.parse(await fs.readFile(creditsPath, "utf8")) : [];
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
console.log("✓ credits.json successfully updated with Swiss botanical licenses.\n");

console.log("═══════════════════════════════════════════════════════");
console.log("DOWNLOAD & PACK SUMMARY");
console.log("═══════════════════════════════════════════════════════");
for (const r of results) {
  const mb = r.size ? `${(r.size / 1e6).toFixed(2)} MB` : "";
  const tag = r.status === "ok" ? "✓ SUCCESS" : r.status === "skipped" ? "– SKIPPED" : "✗ FAILED";
  console.log(`${tag}: ${r.out}.glb ${mb} ${r.status === "failed" ? "← " + r.error : ""}`);
}
