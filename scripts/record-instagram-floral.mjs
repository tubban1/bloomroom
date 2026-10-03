import puppeteer from 'puppeteer-core';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile as _execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFile = promisify(_execFile);

const FRAMES_DIR = '/tmp/bloomroom-ig-frames';
const OUTPUT_MP4 = path.resolve('public/bloomroom_instagram_story.mp4');
const OUTPUT_GIF = path.resolve('public/bloomroom_instagram_preview.gif');
const AUDIO_WIND = path.resolve('public/audio/wind.mp3');
const AUDIO_BIRDS = path.resolve('public/audio/birds.mp3');

await fs.rm(FRAMES_DIR, { recursive: true, force: true });
await fs.mkdir(FRAMES_DIR, { recursive: true });

console.log('1. Launching browser for Instagram (4:5 portrait, 1080x1350)...');
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: [
    '--enable-webgl',
    '--use-gl=angle',
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--window-size=1080,1350'
  ]
});

const page = await browser.newPage();
await page.setViewport({ width: 1080, height: 1350, deviceScaleFactor: 1.25 });

console.log('2. Navigating to Bloomroom...');
await page.goto('https://flower.fde.fan?lang=en', { waitUntil: 'networkidle2', timeout: 45000 });
await new Promise(r => setTimeout(r, 3000));

let frameIndex = 0;
async function captureFrames(count = 1, delayMs = 50) {
  for (let i = 0; i < count; i++) {
    const framePath = path.join(FRAMES_DIR, `frame_${String(frameIndex++).padStart(5, '0')}.png`);
    await page.screenshot({ path: framePath });
    if (delayMs > 0) await new Promise(r => setTimeout(r, delayMs));
  }
}

// Helper to set range input value
async function setRangeValue(selector, value) {
  await page.evaluate((sel, val) => {
    const input = document.querySelector(sel);
    if (input) {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(input, val);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }, selector, value);
}

console.log('3. Choosing luxury Footed Urn vessel...');
// Select containers
const paletteModes = await page.$$('.palette-mode');
if (paletteModes[1]) {
  await paletteModes[1].click();
  await captureFrames(6, 60);
  const vessels = await page.$$('.vessel-card');
  if (vessels[3]) { // Footed urn
    await vessels[3].click();
    await captureFrames(12, 60);
  }
}

// Switch back to flowers
if (paletteModes[0]) {
  await paletteModes[0].click();
  await captureFrames(8, 60);
}

console.log('4. Curation Phase: Artful stem selection...');
// 4.1 Foliage: Silver dollar eucalyptus (Base & structure)
let catTabs = await page.$$('.category-tab');
if (catTabs[2]) {
  await catTabs[2].click();
  await captureFrames(6, 50);
  let foliageCards = await page.$$('.flower-card');
  if (foliageCards[0]) {
    await foliageCards[0].click(); // Eucalyptus
    await captureFrames(15, 60);
  }
}

// 4.2 Main Flowers: Garden rose, Calla lily, Peony (Focal blooms)
catTabs = await page.$$('.category-tab');
if (catTabs[0]) {
  await catTabs[0].click();
  await captureFrames(6, 50);

  let mainCards = await page.$$('.flower-card');
  // Rose
  if (mainCards[0]) {
    console.log('  Placing Garden rose...');
    await mainCards[0].click();
    await captureFrames(16, 60);
  }

  // Calla lily
  mainCards = await page.$$('.flower-card');
  if (mainCards[9]) {
    console.log('  Placing Calla lily...');
    await mainCards[9].click();
    await captureFrames(16, 60);
  }

  // Peony
  mainCards = await page.$$('.flower-card');
  if (mainCards[3]) {
    console.log('  Placing Peony...');
    await mainCards[3].click();
    await captureFrames(16, 60);
  }
}

// 4.3 Accents: Lily of the valley (Airy texture & light)
catTabs = await page.$$('.category-tab');
if (catTabs[1]) {
  await catTabs[1].click();
  await captureFrames(6, 50);

  let accentCards = await page.$$('.flower-card');
  if (accentCards[1]) { // Lily of the valley
    console.log('  Placing Lily of the valley...');
    await accentCards[1].click();
    await captureFrames(16, 60);
  }
}

console.log('5. Adjustment Phase: Master Florist Tuning...');
// Select the Calla Lily to adjust height and lean
await page.evaluate(() => {
  const select = document.getElementById('selected-stem');
  if (select && select.options.length > 2) {
    // Select Calla lily (stem 3)
    select.selectedIndex = 2;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }
});
await captureFrames(8, 60);

// Smoothly raise stem height
console.log('  Tuning height...');
for (let h = 2.0; h <= 2.65; h += 0.08) {
  await setRangeValue('#stem-height', h);
  await captureFrames(2, 30);
}

// Smoothly adjust lean angle for natural grace
console.log('  Tuning lean angle...');
for (let ang = -0.1; ang <= 0.42; ang += 0.06) {
  await setRangeValue('#stem-angle', ang);
  await captureFrames(2, 30);
}

// Switch to Garden Rose to adjust color
await page.evaluate(() => {
  const select = document.getElementById('selected-stem');
  if (select && select.options.length > 1) {
    select.selectedIndex = 1; // Rose
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }
});
await captureFrames(8, 60);

// Select Velvet Red color
const colorBtns = await page.$$('.color-option');
if (colorBtns[1]) {
  console.log('  Selecting Velvet Red petal variant...');
  await colorBtns[1].click();
  await captureFrames(12, 60);
}

// Close adjustment panel cleanly
const doneBtn = await page.$('.selection-done');
if (doneBtn) {
  await doneBtn.click();
  await captureFrames(10, 60);
}

console.log('6. Atmosphere: Gentle wind & 360 rotation showcase...');
// Smooth rotation showcase
const rotationSteps = 45;
for (let i = 0; i <= rotationSteps; i++) {
  // Smooth sine curve rotation from -45 to +45 and settling back
  const t = i / rotationSteps;
  const angle = Math.round(-35 + 70 * Math.sin(t * Math.PI));
  await setRangeValue('#bouquet-rotation-y', angle);
  await captureFrames(1, 40);
}

console.log('7. Completion Phase: Finish Bouquet & Postcard creation...');
const finishBtn = await page.$('.finish-button');
if (finishBtn) {
  await finishBtn.click();
  await captureFrames(20, 80); // Wait for snapshot to render
}

// Type personalized floral note
const toInput = await page.$('#gift-to');
if (toInput) {
  await toInput.click();
  await page.type('#gift-to', 'Mon Chéri', { delay: 60 });
  await captureFrames(6, 40);
}

const msgInput = await page.$('#gift-message');
if (msgInput) {
  await page.evaluate(() => {
    const el = document.getElementById('gift-message');
    if (el) el.value = '';
  });
  await msgInput.click();
  await page.type('#gift-message', 'Every petal holds a quiet breath of wild spring.', { delay: 40 });
  await captureFrames(8, 40);
}

const fromInput = await page.$('#gift-from');
if (fromInput) {
  await fromInput.click();
  await page.type('#gift-from', 'Bloom Studio', { delay: 60 });
  await captureFrames(8, 40);
}

// Hold final frame to admire the postcard
console.log('  Holding final postcard showcase...');
await captureFrames(35, 60);

await browser.close();
console.log(`✓ Total frames captured: ${frameIndex}`);

console.log('8. Encoding high-definition MP4 with audio via ffmpeg...');
const videoDurationSec = (frameIndex / 20).toFixed(1);

const ffmpegArgs = [
  '-y',
  '-framerate', '20',
  '-i', path.join(FRAMES_DIR, 'frame_%05d.png'),
  '-ss', '0',
  '-t', videoDurationSec,
  '-i', AUDIO_WIND,
  '-filter_complex', `[1:a]afade=t=in:st=0:d=1.0,afade=t=out:st=${Math.max(0, videoDurationSec - 1.5)}:d=1.5,volume=0.8[a]`,
  '-map', '0:v',
  '-map', '[a]',
  '-c:v', 'libx264',
  '-pix_fmt', 'yuv420p',
  '-crf', '18',
  '-preset', 'slow',
  '-c:a', 'aac',
  '-b:a', '192k',
  '-movflags', '+faststart',
  OUTPUT_MP4
];

await execFile('ffmpeg', ffmpegArgs);
console.log(`✓ MP4 generated at: ${OUTPUT_MP4}`);

console.log('9. Generating animated GIF preview...');
const gifArgs = [
  '-y',
  '-i', OUTPUT_MP4,
  '-vf', 'fps=12,scale=540:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=160[p];[s1][p]paletteuse=dither=bayer',
  OUTPUT_GIF
];

await execFile('ffmpeg', gifArgs);
console.log(`✓ GIF preview generated at: ${OUTPUT_GIF}`);

const mp4Stat = await fs.stat(OUTPUT_MP4);
const gifStat = await fs.stat(OUTPUT_GIF);
console.log(`\n🎉 Success! MP4: ${(mp4Stat.size / 1e6).toFixed(2)} MB (${videoDurationSec}s), GIF: ${(gifStat.size / 1e6).toFixed(2)} MB`);
