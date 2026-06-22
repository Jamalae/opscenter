#!/usr/bin/env node
/**
 * Puppeteer smoke test for the OpsCenter static dashboard.
 *
 * Launches headless Chromium, loads the app, and asserts the static shell
 * renders. Also captures a screenshot for visual inspection.
 *
 * Usage:
 *   BASE_URL=http://localhost:8080 node tests/puppeteer/smoke.js
 *   # or, with an auto-started static server:
 *   npm run test:smoke:served
 *
 * Exits non-zero on failure so it can be wired into CI.
 */
const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");

const BASE_URL = process.env.BASE_URL || "http://localhost:8080";
const SHOT_DIR = path.join(__dirname, "screenshots");

function assert(condition, message) {
  if (!condition) throw new Error("Assertion failed: " + message);
  console.log("  ✓ " + message);
}

(async () => {
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    console.log(`Loading ${BASE_URL} …`);
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 30000 });

    const title = await page.title();
    assert(title === "OpsCenter Workforce Dashboard", `page title is "${title}"`);

    await page.waitForSelector("main.shell", { timeout: 10000 });
    assert(true, "app shell (main.shell) is present");

    const heading = await page.$eval("header.head h1", (el) => el.textContent.trim());
    assert(heading.includes("Ops Center"), `header reads "${heading}"`);

    const hasLiveStatus = (await page.$("#liveStatus")) !== null;
    assert(hasLiveStatus, "live status indicator (#liveStatus) is present");

    const shot = path.join(SHOT_DIR, "smoke.png");
    await page.screenshot({ path: shot, fullPage: true });
    console.log(`\nScreenshot saved to ${shot}`);
    console.log("\n✅ Puppeteer smoke test passed.");
  } finally {
    await browser.close();
  }
})().catch((err) => {
  console.error("\n❌ Puppeteer smoke test failed:\n", err.message);
  process.exit(1);
});
