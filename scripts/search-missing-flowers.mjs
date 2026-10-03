import https from 'node:https';

const TOKEN = process.env.SKETCHFAB_TOKEN;
if (!TOKEN) throw new Error("Set SKETCHFAB_TOKEN in the environment before downloading/searching.");

const QUERIES = [
  { key: 'ranunculus', terms: ['ranunculus flower', 'ranunculus stem', 'ranunculus'] },
  { key: 'narcissus', terms: ['narcissus flower', 'daffodil flower', 'daffodil stem'] },
  { key: 'dahlia', terms: ['dahlia flower', 'dahlia stem', 'dahlia'] },
  { key: 'amaryllis', terms: ['amaryllis flower', 'amaryllis stem', 'hippeastrum'] },
  { key: 'helleborus', terms: ['hellebore flower', 'helleborus', 'christmas rose flower'] },
  { key: 'lisianthus', terms: ['lisianthus flower', 'eustoma flower', 'lisianthus'] },
  { key: 'astrantia', terms: ['astrantia flower', 'astrantia'] },
  { key: 'eryngium', terms: ['eryngium', 'sea holly flower', 'blue thistle flower'] },
  { key: 'waxflower', terms: ['waxflower', 'chamelaucium'] },
  { key: 'scabiosa', terms: ['scabiosa flower', 'scabiosa'] },
  { key: 'laceflower', terms: ['queen anne lace flower', 'ammi majus'] },
  { key: 'olive_branch', terms: ['olive branch', 'olive twig'] },
  { key: 'pussy_willow', terms: ['pussy willow', 'salix caprea branch'] },
  { key: 'rose_hips', terms: ['rose hips branch', 'rosehip branch', 'rose hips'] },
  { key: 'larch_branch', terms: ['larch branch', 'pine cone branch', 'larch twig'] },
];

function fetchSearch(q) {
  return new Promise((resolve) => {
    const url = `https://api.sketchfab.com/v3/search?type=models&downloadable=true&sort_by=-likeCount&q=${encodeURIComponent(q)}`;
    https.get(url, { headers: { Authorization: `Token ${TOKEN}` } }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json.results || []);
        } catch {
          resolve([]);
        }
      });
    }).on('error', () => resolve([]));
  });
}

const report = {};

for (const item of QUERIES) {
  report[item.key] = [];
  for (const term of item.terms) {
    const results = await fetchSearch(term);
    for (const r of results) {
      if (!report[item.key].some(x => x.uid === r.uid)) {
        report[item.key].push({
          uid: r.uid,
          name: r.name,
          author: r.user.displayName,
          username: r.user.username,
          likeCount: r.likeCount,
          vertexCount: r.vertexCount,
          faceCount: r.faceCount,
          license: r.license?.label || 'CC',
          thumbnails: r.thumbnails?.images?.[0]?.url,
          viewerUrl: r.viewerUrl
        });
      }
    }
    if (report[item.key].length >= 4) break;
  }
  console.log(`[${item.key}] found ${report[item.key].length} candidate models`);
}

import fs from 'node:fs/promises';
await fs.writeFile('/tmp/sketchfab_missing_models.json', JSON.stringify(report, null, 2));
console.log('Saved detailed results to /tmp/sketchfab_missing_models.json');
