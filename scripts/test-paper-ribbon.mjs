import puppeteer from 'puppeteer-core';

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: [
    '--enable-webgl',
    '--use-gl=angle',
    '--no-sandbox',
    '--disable-setuid-sandbox'
  ]
});

const page = await browser.newPage();
await page.setViewport({ width: 1080, height: 1350, deviceScaleFactor: 2 });
await page.goto('https://flower.fde.fan?lang=en', { waitUntil: 'networkidle2', timeout: 45000 });
await new Promise(r => setTimeout(r, 2000));

// 1. Switch to Containers -> Bouquets
const paletteModes = await page.$$('.palette-mode');
if (paletteModes[1]) {
  await paletteModes[1].click();
  await new Promise(r => setTimeout(r, 500));
}

const vesselTabs = await page.$$('.vessel-tab');
if (vesselTabs[1]) {
  await vesselTabs[1].click(); // Bouquets category
  await new Promise(r => setTimeout(r, 500));
}

const bouquetCards = await page.$$('.vessel-card');
console.log('Bouquet vessel cards:', bouquetCards.length);
if (bouquetCards[1]) {
  console.log('Clicking Paper + ribbon...');
  await bouquetCards[1].click(); // Paper + ribbon
  await new Promise(r => setTimeout(r, 800));
}

// 2. Switch back to Flowers
if (paletteModes[0]) {
  await paletteModes[0].click();
  await new Promise(r => setTimeout(r, 500));
}

// Foliage -> Eucalyptus
const catTabs = await page.$$('.category-tab');
if (catTabs[2]) {
  await catTabs[2].click();
  await new Promise(r => setTimeout(r, 500));
  const foliage = await page.$$('.flower-card');
  if (foliage[0]) await foliage[0].click(); // Eucalyptus
  await new Promise(r => setTimeout(r, 800));
}

// Main flowers -> Rose, Calla Lily, Peony
const catTabs2 = await page.$$('.category-tab');
if (catTabs2[0]) {
  await catTabs2[0].click();
  await new Promise(r => setTimeout(r, 500));
  const mains = await page.$$('.flower-card');
  if (mains[0]) await mains[0].click(); // Rose
  await new Promise(r => setTimeout(r, 800));
  if (mains[9]) await mains[9].click(); // Calla lily
  await new Promise(r => setTimeout(r, 800));
}

// Accents -> Delphinium
const catTabs3 = await page.$$('.category-tab');
if (catTabs3[1]) {
  await catTabs3[1].click();
  await new Promise(r => setTimeout(r, 500));
  const accents = await page.$$('.flower-card');
  if (accents[3]) await accents[3].click(); // Delphinium
  await new Promise(r => setTimeout(r, 800));
}

// Wait for 3D stabilization
await new Promise(r => setTimeout(r, 2000));
await page.screenshot({ path: '/tmp/test_paper_ribbon.png' });
console.log('Saved /tmp/test_paper_ribbon.png');

await browser.close();
