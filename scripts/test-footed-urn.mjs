import puppeteer from 'puppeteer-core';

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--enable-webgl', '--use-gl=angle', '--no-sandbox']
});

const page = await browser.newPage();
await page.setViewport({ width: 1080, height: 1350, deviceScaleFactor: 2 });
await page.goto('https://flower.fde.fan?lang=en', { waitUntil: 'networkidle2' });
await new Promise(r => setTimeout(r, 2000));

// Switch to Footed urn
const paletteModes = await page.$$('.palette-mode');
await paletteModes[1].click();
await new Promise(r => setTimeout(r, 500));
const vessels = await page.$$('.vessel-card');
if (vessels[3]) { // Footed urn
  await vessels[3].click();
  await new Promise(r => setTimeout(r, 800));
}

// Switch to Flowers
await paletteModes[0].click();
await new Promise(r => setTimeout(r, 500));

// Foliage -> Eucalyptus
let catTabs = await page.$$('.category-tab');
await catTabs[2].click();
await new Promise(r => setTimeout(r, 500));
let cards = await page.$$('.flower-card');
await cards[0].click(); // Eucalyptus
await new Promise(r => setTimeout(r, 800));

// Mains -> Garden rose, Calla lily, Peony
catTabs = await page.$$('.category-tab');
await catTabs[0].click();
await new Promise(r => setTimeout(r, 500));
cards = await page.$$('.flower-card');
await cards[0].click(); // Rose
await new Promise(r => setTimeout(r, 800));
await cards[9].click(); // Calla lily
await new Promise(r => setTimeout(r, 800));
await cards[3].click(); // Peony
await new Promise(r => setTimeout(r, 800));

// Accents -> Chamomile
catTabs = await page.$$('.category-tab');
await catTabs[1].click();
await new Promise(r => setTimeout(r, 500));
cards = await page.$$('.flower-card');
await cards[1].click(); // Chamomile
await new Promise(r => setTimeout(r, 800));

// Close selection
const done = await page.$('.selection-done');
if (done) await done.click();

await new Promise(r => setTimeout(r, 2000));
await page.screenshot({ path: '/tmp/test_footed_urn.png' });
console.log('Saved /tmp/test_footed_urn.png');

await browser.close();
