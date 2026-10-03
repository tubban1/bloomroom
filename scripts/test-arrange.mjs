import puppeteer from 'puppeteer-core';
import fs from 'node:fs/promises';

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

// 1. Switch to Foliage tab
const tabs = await page.$$('.category-pill');
console.log('Category tabs count:', tabs.length);
if (tabs[2]) {
  await tabs[2].click();
  await new Promise(r => setTimeout(r, 800));
}

// Click Eucalyptus (first foliage)
let foliageCards = await page.$$('.flower-card');
console.log('Foliage cards count:', foliageCards.length);
if (foliageCards[0]) {
  await foliageCards[0].click();
  await new Promise(r => setTimeout(r, 1200));
}

// 2. Switch back to Main flowers
const tabsAgain = await page.$$('.category-pill');
if (tabsAgain[0]) {
  await tabsAgain[0].click();
  await new Promise(r => setTimeout(r, 800));
}

// Click Rose & Peony
let mainCards = await page.$$('.flower-card');
if (mainCards[0]) {
  console.log('Adding Rose...');
  await mainCards[0].click(); // Garden rose
  await new Promise(r => setTimeout(r, 1200));
}

mainCards = await page.$$('.flower-card');
if (mainCards[3]) {
  console.log('Adding Peony...');
  await mainCards[3].click(); // Peony
  await new Promise(r => setTimeout(r, 1200));
}

// 3. Switch to Accents
if (tabsAgain[1]) {
  await tabsAgain[1].click();
  await new Promise(r => setTimeout(r, 800));
}
let accentCards = await page.$$('.flower-card');
if (accentCards[1]) {
  console.log('Adding Chamomile / Accent...');
  await accentCards[1].click();
  await new Promise(r => setTimeout(r, 1200));
}

await page.screenshot({ path: '/tmp/step1_arranged.png' });
console.log('Saved /tmp/step1_arranged.png');

// Check selection card
const stemControls = await page.$('.selection-card');
console.log('Stem controls found:', !!stemControls);

await browser.close();
