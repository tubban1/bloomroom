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
await page.setViewport({ width: 1200, height: 1200, deviceScaleFactor: 2 });
await page.goto('https://flower.fde.fan?lang=en', { waitUntil: 'networkidle2', timeout: 45000 });
await new Promise(r => setTimeout(r, 2000));

// 1. Choose vessel: Footed urn
const paletteModes = await page.$$('.palette-mode');
if (paletteModes[1]) {
  await paletteModes[1].click();
  await new Promise(r => setTimeout(r, 500));
}
const vessels = await page.$$('.vessel-card');
if (vessels[3]) { // Footed urn
  await vessels[3].click();
  await new Promise(r => setTimeout(r, 800));
}

// 2. Switch back to flowers
if (paletteModes[0]) {
  await paletteModes[0].click();
  await new Promise(r => setTimeout(r, 500));
}

// 3. Foliage: Eucalyptus
let catTabs = await page.$$('.category-tab');
if (catTabs[2]) {
  await catTabs[2].click();
  await new Promise(r => setTimeout(r, 500));
  let foliageCards = await page.$$('.flower-card');
  if (foliageCards[0]) {
    await foliageCards[0].click(); // Eucalyptus
    await new Promise(r => setTimeout(r, 800));
  }
}

// 4. Mains: Garden rose, Calla lily, Peony
catTabs = await page.$$('.category-tab');
if (catTabs[0]) {
  await catTabs[0].click();
  await new Promise(r => setTimeout(r, 500));
  let mainCards = await page.$$('.flower-card');
  if (mainCards[0]) { await mainCards[0].click(); await new Promise(r => setTimeout(r, 800)); }
  if (mainCards[9]) { await mainCards[9].click(); await new Promise(r => setTimeout(r, 800)); }
  if (mainCards[3]) { await mainCards[3].click(); await new Promise(r => setTimeout(r, 800)); }
}

// 5. Accents: Lily of the valley
catTabs = await page.$$('.category-tab');
if (catTabs[1]) {
  await catTabs[1].click();
  await new Promise(r => setTimeout(r, 500));
  let accentCards = await page.$$('.flower-card');
  if (accentCards[1]) { await accentCards[1].click(); await new Promise(r => setTimeout(r, 800)); }
}

// Adjust Calla lily height and lean
await page.evaluate(() => {
  const select = document.getElementById('selected-stem');
  if (select && select.options.length > 2) {
    select.selectedIndex = 2; // Calla lily
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }
  const hInput = document.getElementById('stem-height');
  if (hInput) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(hInput, 2.5);
    hInput.dispatchEvent(new Event('input', { bubbles: true }));
    hInput.dispatchEvent(new Event('change', { bubbles: true }));
  }
  const aInput = document.getElementById('stem-angle');
  if (aInput) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(aInput, 0.35);
    aInput.dispatchEvent(new Event('input', { bubbles: true }));
    aInput.dispatchEvent(new Event('change', { bubbles: true }));
  }
  const done = document.querySelector('.selection-done');
  if (done) done.click();
});

// Wait for stabilization
await new Promise(r => setTimeout(r, 2000));

// Capture raw canvas snapshot
const canvasDataUrl = await page.evaluate(() => {
  const canvas = document.querySelector('canvas');
  if (canvas) return canvas.toDataURL('image/png');
  return null;
});

if (canvasDataUrl) {
  const base64Data = canvasDataUrl.replace(/^data:image\/png;base64,/, '');
  await fs.writeFile('/tmp/flower_render_raw.png', base64Data, 'base64');
  console.log('Saved raw canvas to /tmp/flower_render_raw.png');
}

await browser.close();
