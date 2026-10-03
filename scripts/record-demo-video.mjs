import puppeteer from 'puppeteer-core';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { execFile as _execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFile = promisify(_execFile);

const FRAMES_DIR = '/tmp/bloomroom-frames';
const OUTPUT_MP4 = path.resolve('public/bloomroom_demo.mp4');
const OUTPUT_GIF = path.resolve('public/bloomroom_demo.gif');
const AUDIO_SRC = path.resolve('public/audio/wind.mp3');

await fs.rm(FRAMES_DIR, { recursive: true, force: true });
await fs.mkdir(FRAMES_DIR, { recursive: true });

console.log('1. Launching headless browser...');
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: [
    '--enable-webgl',
    '--use-gl=angle',
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--window-size=1080,1080'
  ]
});

const page = await browser.newPage();
await page.setViewport({ width: 1080, height: 1080, deviceScaleFactor: 1.5 });

console.log('2. Navigating to Bloomroom (German mode)...');
await page.goto('https://flower.fde.fan?lang=de', { waitUntil: 'networkidle2', timeout: 45000 });
await new Promise(r => setTimeout(r, 2500));

console.log('3. Arranging beautiful flowers...');
// Add Main Flowers: Rose, Tulip, Sunflower
const cards = await page.$$('.flower-card');
if (cards[0]) { await cards[0].click(); await new Promise(r => setTimeout(r, 600)); } // Rose
if (cards[1]) { await cards[1].click(); await new Promise(r => setTimeout(r, 600)); } // Tulip
if (cards[7]) { await cards[7].click(); await new Promise(r => setTimeout(r, 600)); } // Sunflower

// Switch to Foliage tab
const tabs = await page.$$('.category-pill');
if (tabs[2]) {
  await tabs[2].click();
  await new Promise(r => setTimeout(r, 600));
  const foliageCards = await page.$$('.flower-card');
  if (foliageCards[0]) { await foliageCards[0].click(); await new Promise(r => setTimeout(r, 600)); } // Eucalyptus
}

// Deselect any selected stem to clean up UI selection card
await page.evaluate(() => {
  const doneBtn = document.querySelector('.selection-done');
  if (doneBtn) doneBtn.click();
});

console.log('4. Waiting for 3D shaders and models to stabilize...');
await new Promise(r => setTimeout(r, 4000));

console.log('5. Capturing 120 animation frames with smooth rotation...');
const totalFrames = 120; // 6 seconds at 20fps

for (let i = 0; i < totalFrames; i++) {
  const angle = Math.round(-120 + (240 * (i / totalFrames)));
  
  await page.evaluate((val) => {
    const input = document.getElementById('bouquet-rotation-y');
    if (input) {
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      nativeSetter.call(input, val);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }, angle);

  const framePath = path.join(FRAMES_DIR, `frame_${String(i).padStart(4, '0')}.png`);
  await page.screenshot({ path: framePath });
  if (i % 20 === 0) console.log(`  Frame ${i}/${totalFrames} captured`);
}

await browser.close();
console.log('✓ All frames captured.');

console.log('6. Compiling MP4 video with natural wind ambient audio via ffmpeg...');
// Duration: 120 frames at 20fps = 6 seconds
const ffmpegArgs = [
  '-y',
  '-framerate', '20',
  '-i', path.join(FRAMES_DIR, 'frame_%04d.png'),
  '-ss', '0',
  '-t', '6',
  '-i', AUDIO_SRC,
  '-filter_complex', '[1:a]afade=t=in:st=0:d=0.8,afade=t=out:st=5.2:d=0.8[a]',
  '-map', '0:v',
  '-map', '[a]',
  '-c:v', 'libx264',
  '-pix_fmt', 'yuv420p',
  '-c:a', 'aac',
  '-b:a', '128k',
  '-movflags', '+faststart',
  OUTPUT_MP4
];

await execFile('ffmpeg', ffmpegArgs);
console.log(`✓ MP4 generated: ${OUTPUT_MP4}`);

console.log('7. Compiling animated GIF for instant chat preview...');
const gifArgs = [
  '-y',
  '-i', OUTPUT_MP4,
  '-vf', 'fps=15,scale=540:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer',
  OUTPUT_GIF
];

await execFile('ffmpeg', gifArgs);
console.log(`✓ GIF generated: ${OUTPUT_GIF}`);

const mp4Stat = await fs.stat(OUTPUT_MP4);
const gifStat = await fs.stat(OUTPUT_GIF);
console.log(`\nAll done! MP4: ${(mp4Stat.size / 1e6).toFixed(2)} MB, GIF: ${(gifStat.size / 1e6).toFixed(2)} MB`);
