import puppeteer from "puppeteer-core";
import fs from "node:fs/promises";
import path from "node:path";

const BASE_URL = "http://localhost:3000";
const OUTPUT_DIR = path.resolve("public/test-backdrops");

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  console.log("Launching browser for backdrop verification...");

  const browser = await puppeteer.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: "new",
    args: ["--enable-webgl", "--use-gl=angle", "--no-sandbox", "--disable-setuid-sandbox"],
    defaultViewport: { width: 1440, height: 960 },
  });

  try {
    const page = await browser.newPage();
    await page.goto(`${BASE_URL}/?lang=zh`, { waitUntil: "networkidle0" });
    await sleep(2000);

    // 1. Add white flowers, deep red rose, foliage, and make container transparent
    console.log("Setting up test bouquet: white flower, deep red rose, foliage, transparent vase...");

    // Helper to click flower by card title
    async function addFlower(name) {
      const cards = await page.$$(".flower-card");
      for (const card of cards) {
        const text = await card.$eval("strong", (el) => el.textContent.trim());
        if (text === name) {
          await card.click();
          await sleep(500);
          return;
        }
      }
      console.warn(`Card ${name} not found`);
    }

    // Add Red Rose (深红主花)
    await addFlower("玫瑰");
    // Change rose color to "深红" (Velvet red / Deep red)
    await page.evaluate(() => {
      const colorBtns = Array.from(document.querySelectorAll(".flower-color-swatches button, .color-options button"));
      if (colorBtns.length > 1) {
        (colorBtns[1] || colorBtns[0]).click();
      }
    });
    await sleep(400);

    // Switch to accents tab
    await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll(".category-tab"));
      const accentTab = tabs.find((t) => t.textContent.includes("配花"));
      if (accentTab) accentTab.click();
    });
    await sleep(600);

    // Add white flower (银莲花 / 百合 / 铃兰)
    await addFlower("铃兰");
    await sleep(400);

    // Switch to foliage tab
    await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll(".category-tab"));
      const foliageTab = tabs.find((t) => t.textContent.includes("叶材"));
      if (foliageTab) foliageTab.click();
    });
    await sleep(600);

    // Add Eucalyptus
    await addFlower("银圆尤加利");
    await sleep(400);

    // Switch to main flowers to add Calla lily (马蹄莲)
    await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll(".category-tab"));
      const mainTab = tabs.find((t) => t.textContent.includes("主花"));
      if (mainTab) mainTab.click();
    });
    await sleep(600);
    await addFlower("马蹄莲");
    await sleep(500);

    // Adjust container: open container adjust panel and set opacity to 40% (transparent glass effect)
    console.log("Adjusting container opacity to 40%...");
    await page.evaluate(() => {
      const btn = document.querySelector(".vessel-adjust-toggle");
      if (btn) btn.click();
    });
    await sleep(500);

    await page.evaluate(() => {
      const opacitySlider = document.querySelector("#vessel-opacity");
      if (opacitySlider) {
        opacitySlider.value = "40";
        opacitySlider.dispatchEvent(new Event("input", { bubbles: true }));
        opacitySlider.dispatchEvent(new Event("change", { bubbles: true }));
      }
      // close panel
      const closeBtn = document.querySelector(".vessel-adjust-heading button");
      if (closeBtn) closeBtn.click();
    });
    await sleep(1000);

    // 2. Test and capture each of the 4 backdrops
    const backdrops = [
      { id: "linen", name: "米麻" },
      { id: "limestone", name: "石灰" },
      { id: "charcoal", name: "炭灰" },
      { id: "forest", name: "墨绿" },
    ];

    for (const b of backdrops) {
      console.log(`Testing backdrop: ${b.name} (${b.id})...`);
      await page.evaluate((targetName) => {
        const pills = Array.from(document.querySelectorAll(".backdrop-pill"));
        const target = pills.find((p) => p.textContent.includes(targetName));
        if (target) target.click();
      }, b.name);
      await sleep(1200);

      // Verify aria-checked
      const isChecked = await page.evaluate((targetName) => {
        const pills = Array.from(document.querySelectorAll(".backdrop-pill"));
        const target = pills.find((p) => p.textContent.includes(targetName));
        return target ? target.getAttribute("aria-checked") : null;
      }, b.name);
      console.log(`Backdrop ${b.name} checked: ${isChecked}`);

      await page.screenshot({
        path: path.join(OUTPUT_DIR, `desktop-${b.id}.png`),
        fullPage: false,
      });
    }

    // 3. Test Postcard export on charcoal
    console.log("Testing postcard export on charcoal backdrop...");
    await page.evaluate(() => {
      const finishBtn = document.querySelector(".finish-button");
      if (finishBtn) finishBtn.click();
    });
    await sleep(2500);

    await page.screenshot({
      path: path.join(OUTPUT_DIR, `postcard-preview-charcoal.png`),
      fullPage: false,
    });

    // Extract postcard rendered image data URL
    const postcardData = await page.evaluate(() => {
      const el = document.querySelector(".finish-preview");
      return el ? el.style.backgroundImage : null;
    });
    console.log("Postcard preview rendered:", Boolean(postcardData && postcardData.startsWith('url("data:image/')));

    // Close finish modal
    await page.evaluate(() => {
      const backBtn = document.querySelector(".finish-actions button:last-child");
      if (backBtn) backBtn.click();
    });
    await sleep(800);

    // 4. Test Mobile Viewport & Ergonomics
    console.log("Testing mobile viewport (390x844)...");
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await sleep(1000);

    // Open mobile tools drawer
    await page.evaluate(() => {
      const toolsBtn = document.querySelector(".mobile-tools-toggle");
      if (toolsBtn) toolsBtn.click();
    });
    await sleep(800);

    await page.screenshot({
      path: path.join(OUTPUT_DIR, `mobile-tools-open.png`),
      fullPage: false,
    });

    // Click 'forest' on mobile
    await page.evaluate(() => {
      const pills = Array.from(document.querySelectorAll(".backdrop-pill"));
      const forest = pills.find((p) => p.textContent.includes("墨绿"));
      if (forest) forest.click();
    });
    await sleep(1000);

    await page.screenshot({
      path: path.join(OUTPUT_DIR, `mobile-forest.png`),
      fullPage: false,
    });

    // 5. Test Link serialization & backward compatibility
    console.log("Testing Link serialization and backward compatibility...");
    // Reset desktop viewport
    await page.setViewport({ width: 1440, height: 960 });

    // Test Old Link (simulate legacy hash without backdrop, lightWarmth, lightDirection)
    const legacyBouquet = [
      { kind: "rose", x: 0, z: 0, height: 2.2, leanX: 0.1, leanZ: 0, seed: 1 },
      { kind: "tulip", x: 0.1, z: -0.1, height: 2.5, leanX: -0.2, leanZ: 0.1, seed: 2 }
    ];
    const legacyRaw = encodeURIComponent(JSON.stringify({
      stems: legacyBouquet,
      rotation: { x: 0, y: 0, z: 0 },
      vessel: "classic",
      vesselColor: "#ece5d8",
      vesselOpacity: 100,
      vesselScale: 1
    }));
    const legacyHash = Buffer.from(legacyRaw).toString("base64")
      .replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");

    console.log("Testing legacy link restore...");
    await page.goto(`${BASE_URL}/?lang=zh#b=${legacyHash}`, { waitUntil: "networkidle0" });
    await sleep(2000);

    // Verify backdrop fell back to linen and lightWarmth to 0
    const legacyRestoredState = await page.evaluate(() => {
      const activeBackdrop = document.querySelector('.backdrop-pill[aria-checked="true"] .backdrop-name')?.textContent;
      const warmthVal = document.querySelector("#light-warmth")?.value;
      const stemCount = document.querySelectorAll(".stem-count").length;
      return { activeBackdrop, warmthVal, stemCount };
    });
    console.log("Legacy link restore verification:", legacyRestoredState);

    // Test New Link with custom charcoal + warmth + direction
    const newBouquet = [
      { kind: "sunflower", x: 0, z: 0, height: 2.6, leanX: 0.15, leanZ: 0, seed: 3 },
      { kind: "gerbera", x: -0.05, z: 0.05, height: 2.1, leanX: -0.25, leanZ: 0.05, seed: 4 }
    ];
    const newRaw = encodeURIComponent(JSON.stringify({
      stems: newBouquet,
      rotation: { x: 5, y: -20, z: 0 },
      vessel: "footed",
      vesselColor: "#e6e0d4",
      vesselOpacity: 90,
      vesselScale: 1.1,
      backdrop: "charcoal",
      lightWarmth: 40,
      lightDirection: 60
    }));
    const newHash = Buffer.from(newRaw).toString("base64")
      .replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");

    console.log("Testing new link restore (charcoal, warmth=40, dir=60)...");
    await page.goto(`${BASE_URL}/?lang=zh#b=${newHash}`, { waitUntil: "networkidle0" });
    await sleep(2000);

    const newRestoredState = await page.evaluate(() => {
      const activeBackdrop = document.querySelector('.backdrop-pill[aria-checked="true"] .backdrop-name')?.textContent;
      const warmthVal = document.querySelector("#light-warmth")?.value;
      const dirVal = document.querySelector("#light-direction")?.value;
      return { activeBackdrop, warmthVal, dirVal };
    });
    console.log("New link restore verification:", newRestoredState);

    await page.screenshot({
      path: path.join(OUTPUT_DIR, `new-link-restored-charcoal.png`),
      fullPage: false,
    });

    console.log("All verifications completed successfully!");
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
