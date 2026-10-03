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

// Click category tabs
const tabs = await page.$$('.category-tab');
console.log('Category tabs count:', tabs.length);

// 1. Foliage tab (index 2)
if (tabs[2]) {
  await tabs[2].click();
  await new Promise(r => setTimeout(r, 600));
  const foliageCards = await page.$$('.flower-card');
  console.log('Foliage cards:', foliageCards.length);
  if (foliageCards[0]) {
    console.log('Adding Eucalyptus...');
    await foliageCards[0].click(); // Eucalyptus
    await new Promise(r => setTimeout(r, 1000));
  }
}

// 2. Main flowers tab (index 0)
const tabsAgain = await page.$$('.category-tab');
if (tabsAgain[0]) {
  await tabsAgain[0].click();
  await new Promise(r => setTimeout(r, 600));
  const mainCards = await page.$$('.flower-card');
  console.log('Main cards:', mainCards.length);
  // Rose
  if (mainCards[0]) {
    console.log('Adding Rose...');
    await mainCards[0].click();
    await new Promise(r => setTimeout(r, 1000));
  }
  // Poppy
  if (mainCards[2]) {
    console.log('Adding Poppy...');
    await mainCards[2].click();
    await new Promise(r => setTimeout(r, 1000));
  }
  // Peony
  if (mainCards[3]) {
    console.log('Adding Peony...');
    await mainCards[3].click();
    await new Promise(r => setTimeout(r, 1000));
  }
}

// 3. Accents tab (index 1)
const tabsThird = await page.$$('.category-tab');
if (tabsThird[1]) {
  await tabsThird[1].click();
  await new Promise(r => setTimeout(r, 600));
  const accentCards = await page.$$('.flower-card');
  console.log('Accent cards:', accentCards.length);
  // Chamomile or Delphinium
  if (accentCards[1]) {
    console.log('Adding Accent...');
    await accentCards[1].click();
    await new Promise(r => setTimeout(r, 1000));
  }
}

// Check stem controls
const heightInput = await page.$('#stem-height');
console.log('Height input found:', !!heightInput);
if (heightInput) {
  // adjust height
  await page.evaluate(() => {
    const input = document.getElementById('stem-height');
    if (input) {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(input, 2.6);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
  await new Promise(r => setTimeout(r, 600));
}

// adjust angle
const angleInput = await page.$('#stem-angle');
if (angleInput) {
  await page.evaluate(() => {
    const input = document.getElementById('stem-angle');
    if (input) {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(input, 0.45);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
  await new Promise(r => setTimeout(r, 600));
}

// Color option click
const colorOptions = await page.$$('.color-option');
console.log('Color options found:', colorOptions.length);
if (colorOptions[1]) {
  console.log('Clicking color option...');
  await colorOptions[1].click();
  await new Promise(r => setTimeout(r, 600));
}

// Click selection done
const doneBtn = await page.$('.selection-done');
if (doneBtn) {
  console.log('Clicking selection done...');
  await doneBtn.click();
  await new Promise(r => setTimeout(r, 600));
}

await page.screenshot({ path: '/tmp/step2_adjusted.png' });

// Test Finish Bouquet button
const finishBtn = await page.$('.finish-button');
console.log('Finish button found:', !!finishBtn);
if (finishBtn) {
  await finishBtn.click();
  await new Promise(r => setTimeout(r, 3000));
  await page.screenshot({ path: '/tmp/step3_finished.png' });
}

await browser.close();
console.log('Test completed successfully');
