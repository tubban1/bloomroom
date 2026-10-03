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
await new Promise(r => setTimeout(r, 2500));

// 1. Switch to Containers tab
const paletteModes = await page.$$('.palette-mode');
console.log('Palette modes count:', paletteModes.length);
if (paletteModes[1]) {
  console.log('Switching to Containers...');
  await paletteModes[1].click();
  await new Promise(r => setTimeout(r, 800));
}

// Check vessel category tabs if any, or vessel cards
const vesselCards = await page.$$('.vessel-card');
console.log('Vessel cards found:', vesselCards.length);

// Let's see what vessel categories exist
const vesselTabs = await page.$$('.vessel-category-tab');
console.log('Vessel category tabs:', vesselTabs.length);

// Let's inspect the vessel options
const vesselNames = await page.evaluate(() => {
  return Array.from(document.querySelectorAll('.vessel-card strong')).map(el => el.textContent);
});
console.log('Vessel names:', vesselNames);

// Let's click Paper wrap or Paper + ribbon
const categoryButtons = await page.$$('.category-tab');
console.log('Category buttons in vessel mode:', categoryButtons.length);

await browser.close();
