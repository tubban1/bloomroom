import puppeteer from 'puppeteer-core';
import fs from 'node:fs/promises';
import path from 'node:path';

const SHOWCASE_DIR = path.resolve('public/showcase');
await fs.mkdir(SHOWCASE_DIR, { recursive: true });

// 4 distinct floral recipes
const BOUQUETS = [
  {
    id: "verona-romance",
    title: "维罗纳之约 (Verona Romance)",
    desc: "古典油画风：天鹅绒红玫瑰 × 雕塑白马蹄莲 × 重瓣牡丹 × 悬垂白铃兰 × 尤加利",
    vesselIdx: 3, // Footed urn in Vases
    isBouquet: false,
    stems: [
      { tab: 'foliage', name: 'Eucalyptus', height: 2.7, leanX: -0.9 },
      { tab: 'main', name: 'Garden rose', height: 2.45, leanX: -0.3, colorIdx: 1 }, // red
      { tab: 'main', name: 'Calla lily', height: 2.85, leanX: 0.38 },
      { tab: 'main', name: 'Peony', height: 2.5, leanX: 0.75 },
      { tab: 'accents', name: 'Lily of the valley', height: 2.15, leanX: -0.7 },
    ],
    rotation: -18
  },
  {
    id: "monet-meadow",
    title: "莫奈花园 (Monet Meadow)",
    desc: "法式野趣手捧：珊瑚橙虞美人 × 蓝紫飞燕草 × 浅粉郁金香 × 碎花洋甘菊 × 柔风蕨叶",
    vesselIdx: 1, // Paper + ribbon in Bouquets
    isBouquet: true,
    stems: [
      { tab: 'foliage', name: 'Fern', height: 2.75, leanX: -0.85 },
      { tab: 'accents', name: 'Delphinium', height: 2.95, leanX: -0.35 },
      { tab: 'main', name: 'Poppy', height: 2.65, leanX: 0.28 },
      { tab: 'main', name: 'Tulip', height: 2.5, leanX: 0.68 },
      { tab: 'accents', name: 'Chamomile', height: 2.25, leanX: -0.4 },
      { tab: 'accents', name: 'Chamomile', height: 2.2, leanX: 0.78 },
    ],
    rotation: 12
  },
  {
    id: "sculptural-mist",
    title: "幽蓝秘境 (Sculptural Mist)",
    desc: "现代极简空间雕塑：轻垂粉紫蝴蝶兰 × 挺拔马蹄莲 × 黑芯银莲花 × 尤加利线条",
    vesselIdx: 1, // Bud vase in Vases
    isBouquet: false,
    stems: [
      { tab: 'foliage', name: 'Eucalyptus', height: 2.55, leanX: -0.85 },
      { tab: 'main', name: 'Orchid', height: 2.85, leanX: 0.65 },
      { tab: 'main', name: 'Calla lily', height: 3.0, leanX: -0.3 },
      { tab: 'main', name: 'Anemone', height: 2.35, leanX: -0.6 },
    ],
    rotation: -25
  },
  {
    id: "autumn-solstice",
    title: "暖阳秋日 (Autumn Solstice)",
    desc: "大地丰饶颂歌：灿烂向日葵 × 金黄秋菊 × 暖橙非洲菊 × 薰衣草穗 × 常春藤",
    vesselIdx: 0, // Soft ceramic in Vases
    isBouquet: false,
    stems: [
      { tab: 'foliage', name: 'Eucalyptus', height: 2.8, leanX: -0.9 },
      { tab: 'main', name: 'Sunflower', height: 2.6, leanX: 0.15 },
      { tab: 'main', name: 'Chrysanthemum', height: 2.7, leanX: -0.48 },
      { tab: 'main', name: 'Gerbera', height: 2.45, leanX: 0.65 },
      { tab: 'accents', name: 'Lavender', height: 2.8, leanX: 0.95 },
      { tab: 'foliage', name: 'Ivy', height: 2.2, leanX: -0.65 },
    ],
    rotation: 20
  }
];

console.log('Launching browser for accurate floral rendering...');
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--enable-webgl', '--use-gl=angle', '--no-sandbox']
});

const page = await browser.newPage();
await page.setViewport({ width: 1080, height: 1350, deviceScaleFactor: 2 });
// Load English mode so flower names strictly match
await page.goto('https://flower.fde.fan?lang=en', { waitUntil: 'networkidle2', timeout: 45000 });
await new Promise(r => setTimeout(r, 2500));

for (let i = 0; i < BOUQUETS.length; i++) {
  const b = BOUQUETS[i];
  console.log(`\n[${i + 1}/4] Arranging "${b.title}"...`);

  // Start Over
  await page.evaluate(() => {
    const btn = document.querySelector('button[aria-label="Start over"], button[title="Start over"], .start-over-button');
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 600));

  // Switch to Containers
  const modes = await page.$$('.palette-mode');
  if (modes[1]) await modes[1].click();
  await new Promise(r => setTimeout(r, 500));

  const vTabs = await page.$$('.vessel-tab');
  if (b.isBouquet && vTabs[1]) {
    await vTabs[1].click(); // Bouquets tab
    await new Promise(r => setTimeout(r, 500));
  } else if (!b.isBouquet && vTabs[0]) {
    await vTabs[0].click(); // Vases tab
    await new Promise(r => setTimeout(r, 500));
  }

  const vCards = await page.$$('.vessel-card');
  if (vCards[b.vesselIdx]) {
    await vCards[b.vesselIdx].click();
    await new Promise(r => setTimeout(r, 600));
  }

  // Switch to Flowers
  if (modes[0]) await modes[0].click();
  await new Promise(r => setTimeout(r, 500));

  // Insert each stem
  for (const s of b.stems) {
    const catTabs = await page.$$('.category-tab');
    let tabIndex = 0;
    if (s.tab === 'foliage') tabIndex = 2;
    else if (s.tab === 'accents') tabIndex = 1;
    else tabIndex = 0;

    if (catTabs[tabIndex]) await catTabs[tabIndex].click();
    await new Promise(r => setTimeout(r, 400));

    // Find flower card by text
    const cards = await page.$$('.flower-card');
    let clicked = false;
    for (const card of cards) {
      const title = await card.evaluate(el => el.querySelector('strong')?.textContent || '');
      if (title.toLowerCase().includes(s.name.toLowerCase())) {
        console.log(`  + Added: ${title}`);
        await card.click();
        clicked = true;
        break;
      }
    }
    if (!clicked && cards[0]) {
      await cards[0].click();
    }
    await new Promise(r => setTimeout(r, 700));

    // Tune height & angle
    await page.evaluate((h, lx) => {
      const hInput = document.getElementById('stem-height');
      if (hInput) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(hInput, h);
        hInput.dispatchEvent(new Event('input', { bubbles: true }));
        hInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
      const aInput = document.getElementById('stem-angle');
      if (aInput) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(aInput, lx);
        aInput.dispatchEvent(new Event('input', { bubbles: true }));
        aInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, s.height, s.leanX);

    // Color variant if needed
    if (typeof s.colorIdx === 'number') {
      const colors = await page.$$('.color-option');
      if (colors[s.colorIdx]) await colors[s.colorIdx].click();
      await new Promise(r => setTimeout(r, 300));
    }

    const done = await page.$('.selection-done');
    if (done) await done.click();
  }

  // Set rotation
  await page.evaluate((rot) => {
    const input = document.getElementById('bouquet-rotation-y');
    if (input) {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(input, rot);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }, b.rotation);

  // Wait for 3D stabilization
  await new Promise(r => setTimeout(r, 2200));

  const outPath = path.join(SHOWCASE_DIR, `${b.id}.png`);
  await page.screenshot({ path: outPath });
  console.log(`✓ Saved ${b.id}.png`);
}

await browser.close();
console.log('Finished rendering all 4 bouquets accurately!');
