import puppeteer from 'puppeteer-core';
import fs from 'node:fs/promises';
import path from 'node:path';

const OUTPUT_AVATAR_SQUARE = path.resolve('public/bloomroom_instagram_avatar.png');
const OUTPUT_AVATAR_CIRCLE = path.resolve('public/bloomroom_instagram_avatar_circular.png');
const OUTPUT_AVATAR_PREVIEW = path.resolve('public/bloomroom_instagram_avatar_preview.png');

console.log('1. Removing background to create pristine transparent flower PNG...');
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox']
});

const page = await browser.newPage();
await page.goto('file:///tmp/flower_render_raw.png');

const transparentFlowerBase64 = await page.evaluate(() => {
  const img = document.querySelector('img');
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);

  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;

  // Background target: rgb(223, 219, 206)
  const bgR = 223, bgG = 219, bgB = 206;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const dist = Math.sqrt((r - bgR) ** 2 + (g - bgG) ** 2 + (b - bgB) ** 2);
    if (dist < 10) {
      data[i + 3] = 0; // Pure transparent
    } else if (dist < 26) {
      // Smooth anti-aliased edge
      const factor = (dist - 10) / 16;
      data[i + 3] = Math.round(data[i + 3] * factor);
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, '');
});

await fs.writeFile('/tmp/flower_transparent.png', transparentFlowerBase64, 'base64');
console.log('✓ Transparent flower saved to /tmp/flower_transparent.png');

console.log('2. Composing Instagram Master Avatar (1080x1080)...');

const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&family=Plus+Jakarta+Sans:wght@500;600;700&family=Playfair+Display:ital,wght@0,600;1,400&display=swap');

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      width: 1080px;
      height: 1080px;
      background: #F4EFE6;
      display: flex;
      justify-content: center;
      align-items: center;
      font-family: 'Plus Jakarta Sans', -apple-system, sans-serif;
      overflow: hidden;
    }

    .avatar-card {
      width: 1080px;
      height: 1080px;
      position: relative;
      background: radial-gradient(circle at 50% 48%, #FAF6ED 0%, #F3EDE2 60%, #E6DDCE 100%);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
      overflow: hidden;
    }

    /* Instagram Circular Crop Visual Guide (Fine luxury concentric rings) */
    .border-ring-outer {
      position: absolute;
      width: 1020px;
      height: 1020px;
      border-radius: 50%;
      border: 1.5px solid rgba(48, 42, 32, 0.12);
      top: 30px;
      left: 30px;
      pointer-events: none;
      z-index: 20;
    }

    .border-ring-inner {
      position: absolute;
      width: 980px;
      height: 980px;
      border-radius: 50%;
      border: 1px dashed rgba(48, 42, 32, 0.10);
      top: 50px;
      left: 50px;
      pointer-events: none;
      z-index: 20;
    }

    /* 1. TOP: BRAND LOGO (Centered & High-Profile) */
    .brand-section {
      position: absolute;
      top: 76px;
      left: 0;
      right: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      z-index: 15;
    }

    .brand-mark {
      width: 62px;
      height: 62px;
      border: 2px solid #231F1A;
      background: rgba(255, 255, 255, 0.75);
      backdrop-filter: blur(10px);
      box-shadow: 0 4px 16px rgba(40, 30, 20, 0.08);
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 10px;
    }

    .brand-mark span {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 38px;
      font-weight: 600;
      color: #231F1A;
      line-height: 1;
      transform: translateY(-1px);
    }

    .brand-title {
      font-family: 'Cinzel', Georgia, serif;
      font-size: 24px;
      font-weight: 700;
      letter-spacing: 0.26em;
      color: #231F1A;
      text-transform: uppercase;
      margin-left: 0.26em; /* optical balance */
    }

    .brand-sub {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.36em;
      color: #7D7464;
      text-transform: uppercase;
      margin-top: 3px;
      margin-left: 0.36em;
    }

    /* 2. CENTER: MASTER FLORAL PIECE */
    .flower-section {
      position: absolute;
      top: 51%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 760px;
      height: 760px;
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 8;
    }

    .flower-img {
      width: 820px;
      height: 820px;
      object-fit: contain;
      object-position: center 52%;
      filter: drop-shadow(0 24px 32px rgba(45, 36, 24, 0.12));
    }

    /* 3. BOTTOM: WEBSITE URL (Pill badge safely placed inside circular crop) */
    .website-section {
      position: absolute;
      bottom: 82px;
      left: 0;
      right: 0;
      display: flex;
      justify-content: center;
      z-index: 15;
    }

    .website-pill {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 11px 28px;
      background: #231F1A;
      border-radius: 999px;
      box-shadow: 0 10px 28px rgba(35, 31, 26, 0.22);
      border: 1px solid rgba(255, 255, 255, 0.15);
    }

    .website-dot {
      width: 7px;
      height: 7px;
      background: #E8C145; /* Golden pistil accent */
      border-radius: 50%;
      box-shadow: 0 0 8px rgba(232, 193, 69, 0.8);
    }

    .website-text {
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 21px;
      font-weight: 600;
      letter-spacing: 0.08em;
      color: #FAF6ED;
    }
  </style>
</head>
<body>
  <div class="avatar-card">
    <div class="border-ring-outer"></div>
    <div class="border-ring-inner"></div>

    <!-- 1. Top Logo -->
    <div class="brand-section">
      <div class="brand-mark"><span>B</span></div>
      <h1 class="brand-title">Bloomroom</h1>
      <div class="brand-sub">Digital Flower Studio</div>
    </div>

    <!-- 2. Floral Piece -->
    <div class="flower-section">
      <img class="flower-img" src="data:image/png;base64,${transparentFlowerBase64}" alt="Botanical Piece" />
    </div>

    <!-- 3. Website Address -->
    <div class="website-section">
      <div class="website-pill">
        <span class="website-dot"></span>
        <span class="website-text">flower.fde.fan</span>
      </div>
    </div>
  </div>
</body>
</html>
`;

await fs.writeFile('/tmp/avatar_v2.html', htmlContent);

const pageV2 = await browser.newPage();
await pageV2.setViewport({ width: 1080, height: 1080, deviceScaleFactor: 1 });
await pageV2.goto(`file:///tmp/avatar_v2.html`, { waitUntil: 'networkidle0' });

// 1. Master Square Avatar (Upload to Instagram)
await pageV2.screenshot({ path: OUTPUT_AVATAR_SQUARE });
console.log(`✓ Master square avatar saved: ${OUTPUT_AVATAR_SQUARE}`);

// 2. Circular Avatar with transparent background
const circularHtml = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { margin: 0; background: transparent; width: 1080px; height: 1080px; }
    iframe { width: 1080px; height: 1080px; border: none; border-radius: 50%; }
  </style>
</head>
<body>
  <iframe src="file:///tmp/avatar_v2.html"></iframe>
</body>
</html>
`;
await fs.writeFile('/tmp/avatar_circular_v2.html', circularHtml);
const pageCircle = await browser.newPage();
await pageCircle.setViewport({ width: 1080, height: 1080, deviceScaleFactor: 1 });
await pageCircle.goto('file:///tmp/avatar_circular_v2.html', { waitUntil: 'networkidle0' });
await pageCircle.screenshot({ path: OUTPUT_AVATAR_CIRCLE, omitBackground: true });
console.log(`✓ Circular avatar saved: ${OUTPUT_AVATAR_CIRCLE}`);

// 3. Instagram Profile Mockup
const previewHtml = `
<!DOCTYPE html>
<html>
<head>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
    body {
      margin: 0;
      width: 1080px;
      height: 1080px;
      background: #0F0F11;
      display: flex;
      justify-content: center;
      align-items: center;
      font-family: 'Plus Jakarta Sans', -apple-system, sans-serif;
      color: #fff;
    }
    .mockup-card {
      width: 820px;
      background: #18181B;
      border-radius: 36px;
      padding: 56px 48px;
      box-shadow: 0 32px 80px rgba(0,0,0,0.7);
      border: 1px solid #27272A;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .avatar-wrapper {
      position: relative;
      width: 320px;
      height: 320px;
      border-radius: 50%;
      padding: 6px;
      background: linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%);
      box-shadow: 0 16px 40px rgba(220, 39, 67, 0.4);
      margin-bottom: 30px;
    }
    .avatar-img {
      width: 100%;
      height: 100%;
      border-radius: 50%;
      background: #F4EFE6;
      border: 4px solid #18181B;
      display: block;
    }
    .profile-name {
      font-size: 34px;
      font-weight: 700;
      letter-spacing: -0.01em;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .badge-verified {
      width: 24px;
      height: 24px;
      background: #0095f6;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 15px;
      font-weight: bold;
    }
    .profile-bio {
      text-align: center;
      font-size: 20px;
      color: #A1A1AA;
      line-height: 1.55;
      max-width: 580px;
      margin-bottom: 26px;
    }
    .profile-link {
      color: #E0F2FE;
      font-weight: 600;
      text-decoration: none;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 20px;
      padding: 8px 18px;
      background: rgba(255, 255, 255, 0.06);
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
  </style>
</head>
<body>
  <div class="mockup-card">
    <div class="avatar-wrapper">
      <img class="avatar-img" src="${OUTPUT_AVATAR_CIRCLE}" />
    </div>
    <div class="profile-name">
      bloomroom.studio
      <span class="badge-verified">✓</span>
    </div>
    <div class="profile-bio">
      🌿 Digital Flower Studio & Virtual Florist<br>
      Curated botanical moments in 3D.
    </div>
    <div class="profile-link">
      🔗 flower.fde.fan
    </div>
  </div>
</body>
</html>
`;
await fs.writeFile('/tmp/avatar_preview_v2.html', previewHtml);
const pagePreview = await browser.newPage();
await pagePreview.setViewport({ width: 1080, height: 1080, deviceScaleFactor: 1 });
await pagePreview.goto('file:///tmp/avatar_preview_v2.html', { waitUntil: 'networkidle0' });
await pagePreview.screenshot({ path: OUTPUT_AVATAR_PREVIEW });
console.log(`✓ Preview mockup saved: ${OUTPUT_AVATAR_PREVIEW}`);

await browser.close();
console.log('✓ All V2 avatars rendered successfully!');
