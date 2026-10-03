import https from 'node:https';

const TOKEN = process.env.SKETCHFAB_TOKEN;
if (!TOKEN) throw new Error("Set SKETCHFAB_TOKEN in the environment before downloading/searching.");

const BOTANICAL_TARGETS = [
  { key: 'ranunculus', title: '洋牡丹 / 花毛茛 (Ranunculus)', q: 'ranunculus' },
  { key: 'narcissus', title: '水仙花 (Narcissus / Daffodil)', q: 'narcissus flower' },
  { key: 'dahlia', title: '大丽花 (Dahlia)', q: 'dahlia flower' },
  { key: 'amaryllis', title: '朱顶红 (Amaryllis / Hippeastrum)', q: 'amaryllis flower' },
  { key: 'helleborus', title: '圣诞玫瑰 / 嚏根草 (Helleborus)', q: 'hellebore' },
  { key: 'lisianthus', title: '洋桔梗 (Lisianthus / Eustoma)', q: 'eustoma' },
  { key: 'astrantia', title: '大星芹 (Astrantia / 瑞士高山特色)', q: 'astrantia' },
  { key: 'eryngium', title: '蓝蓟 / 刺芹 (Eryngium / Sea Holly)', q: 'eryngium' },
  { key: 'waxflower', title: '蜡梅花 / 澳蜡 (Chamelaucium)', q: 'waxflower' },
  { key: 'scabiosa', title: '蓝盆花 / 松虫草 (Scabiosa)', q: 'scabiosa' },
  { key: 'laceflower', title: '蕾丝花 / 莳萝花 (Queen Anne Lace)', q: 'queen anne lace' },
  { key: 'olive', title: '橄榄枝 (Olive branch)', q: 'olive branch' },
  { key: 'willow', title: '银柳 / 柳枝 (Willow branch)', q: 'willow branch' },
  { key: 'rosehip', title: '野蔷薇果枝 (Rose hips / Hagebutten)', q: 'rosehip' },
  { key: 'pinecone', title: '松果果枝 / 落叶松 (Pine cone branch)', q: 'pine cone' }
];

function searchSketchfab(q) {
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

const finalResults = [];

for (const t of BOTANICAL_TARGETS) {
  const results = await searchSketchfab(t.q);
  // Pick botanical ones
  const filtered = results.filter(r => {
    const name = r.name.toLowerCase();
    const desc = (r.description || '').toLowerCase();
    // Exclude anime, guns, random objects
    if (name.includes('xenoblade') || name.includes('character') || name.includes('girl') || name.includes('sword')) return false;
    return true;
  });

  const best = filtered[0];
  const second = filtered[1];

  finalResults.push({
    species: t.title,
    key: t.key,
    count: filtered.length,
    primary: best ? {
      name: best.name,
      uid: best.uid,
      author: best.user?.displayName || best.user?.username,
      username: best.user?.username,
      license: best.license?.label || 'CC-BY',
      likes: best.likeCount,
      faces: best.faceCount,
      url: best.viewerUrl
    } : null,
    alternative: second ? {
      name: second.name,
      uid: second.uid,
      author: second.user?.displayName || second.user?.username,
      license: second.license?.label || 'CC-BY'
    } : null
  });
}

import fs from 'node:fs/promises';
await fs.writeFile('/tmp/swiss_models_curated.json', JSON.stringify(finalResults, null, 2));

console.log(JSON.stringify(finalResults, null, 2));
