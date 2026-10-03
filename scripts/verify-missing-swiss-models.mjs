import https from 'node:https';

const TOKEN = process.env.SKETCHFAB_TOKEN;
if (!TOKEN) throw new Error("Set SKETCHFAB_TOKEN in the environment before downloading/searching.");

const SEARCH_TASKS = [
  // 1. 洋牡丹 / 花毛茛 (Ranunculus)
  { id: 'ranunculus', name: '洋牡丹 / 花毛茛 (Ranunculus)', queries: ['ranunculus', 'buttercup flower', 'ranunculus asiaticus'] },
  // 2. 水仙花 (Narcissus / Daffodil)
  { id: 'narcissus', name: '水仙花 (Narcissus / Daffodil)', queries: ['narcissus', 'daffodil', 'daffodil flower stem'] },
  // 3. 大丽花 (Dahlia)
  { id: 'dahlia', name: '大丽花 (Dahlia)', queries: ['dahlia', 'dahlia flower', 'georgine'] },
  // 4. 朱顶红 (Amaryllis)
  { id: 'amaryllis', name: '朱顶红 (Amaryllis / Hippeastrum)', queries: ['amaryllis', 'hippeastrum'] },
  // 5. 圣诞玫瑰 / 嚏根草 (Helleborus)
  { id: 'helleborus', name: '圣诞玫瑰 / 嚏根草 (Helleborus)', queries: ['hellebore', 'helleborus', 'winter rose'] },
  // 6. 洋桔梗 (Lisianthus / Eustoma)
  { id: 'lisianthus', name: '洋桔梗 (Lisianthus / Eustoma)', queries: ['eustoma', 'lisianthus', 'prairie gentian'] },
  // 7. 大星芹 (Astrantia)
  { id: 'astrantia', name: '大星芹 (Astrantia / 瑞士特色)', queries: ['astrantia', 'masterwort'] },
  // 8. 刺芹 / 蓝蓟 (Eryngium / Thistle)
  { id: 'eryngium', name: '刺芹 / 蓝蓟 (Eryngium / Alpine Thistle)', queries: ['eryngium', 'sea holly', 'blue thistle', 'alpine thistle'] },
  // 9. 蜡梅花 / 澳蜡 (Waxflower)
  { id: 'waxflower', name: '蜡梅花 (Chamelaucium / Waxflower)', queries: ['waxflower', 'chamelaucium'] },
  // 10. 蓝盆花 / 松虫草 (Scabiosa)
  { id: 'scabiosa', name: '蓝盆花 / 松虫草 (Scabiosa)', queries: ['scabiosa', 'pincushion flower'] },
  // 11. 蕾丝花 / 阿米芹 (Ammi majus / Queen Anne Lace)
  { id: 'laceflower', name: '蕾丝花 / 阿米芹 (Ammi majus)', queries: ['queen anne lace', 'ammi majus', 'cow parsley', 'daucus carota'] },
  // 12. 橄榄枝 (Olive branch)
  { id: 'olive', name: '橄榄枝 (Olive branch)', queries: ['olive branch', 'olive twig', 'olea europaea'] },
  // 13. 银柳 / 柳枝 (Pussy Willow)
  { id: 'willow', name: '银柳 / 柳絮枝 (Pussy willow / Salix)', queries: ['willow branch', 'pussy willow', 'salix'] },
  // 14. 蔷薇果 (Rose hips)
  { id: 'rosehip', name: '野蔷薇果枝 (Rose hips / Hagebutten)', queries: ['rosehip', 'rose hips', 'rosa canina'] },
  // 15. 落叶松松果枝 (Larch cone branch)
  { id: 'larch', name: '落叶松松果枝 (Larch branch with cones)', queries: ['pine cone branch', 'larch branch', 'pine branch'] },
];

function searchQ(q) {
  return new Promise((resolve) => {
    const url = `https://api.sketchfab.com/v3/search?type=models&downloadable=true&sort_by=-likeCount&q=${encodeURIComponent(q)}`;
    https.get(url, { headers: { Authorization: `Token ${TOKEN}` } }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data).results || []);
        } catch {
          resolve([]);
        }
      });
    }).on('error', () => resolve([]));
  });
}

function checkDownloadable(uid) {
  return new Promise((resolve) => {
    const url = `https://api.sketchfab.com/v3/models/${uid}/download`;
    https.get(url, { headers: { Authorization: `Token ${TOKEN}` } }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(!!(json.gltf || json.glb || json.source));
        } catch {
          resolve(false);
        }
      });
    }).on('error', () => resolve(false));
  });
}

console.log('Searching & verifying 3D models for missing Swiss florals...\n');
const finalPicks = {};

for (const task of SEARCH_TASKS) {
  let matched = [];
  for (const q of task.queries) {
    const res = await searchQ(q);
    for (const r of res) {
      if (!matched.some(m => m.uid === r.uid)) {
        matched.push(r);
      }
    }
  }

  // Filter and find top 2 downloadable models
  const verified = [];
  for (const m of matched.slice(0, 10)) {
    const isDown = await checkDownloadable(m.uid);
    if (isDown) {
      verified.push({
        uid: m.uid,
        name: m.name,
        author: m.user?.displayName || m.user?.username,
        username: m.user?.username,
        license: m.license?.label || 'CC-BY',
        likeCount: m.likeCount,
        faceCount: m.faceCount,
        url: m.viewerUrl
      });
    }
    if (verified.length >= 2) break;
  }

  finalPicks[task.id] = {
    meta: task,
    candidates: verified
  };

  console.log(`✓ [${task.name}]: 找到 ${verified.length} 个直接可下载的高质量模型`);
  if (verified[0]) {
    console.log(`   - 推荐: ${verified[0].name} (UID: ${verified[0].uid}) by ${verified[0].author}`);
  }
}

import fs from 'node:fs/promises';
await fs.writeFile('/tmp/verified_swiss_floral_models.json', JSON.stringify(finalPicks, null, 2));
console.log('\nAll done! Saved to /tmp/verified_swiss_floral_models.json');
