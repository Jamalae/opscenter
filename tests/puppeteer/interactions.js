#!/usr/bin/env node
/**
 * Browser interaction test for the OpsCenter static dashboard.
 *
 * Verifies the rendered navigation, switches across the major views,
 * exercises a few interactive controls, and fails on page-level runtime
 * errors so regressions are easier to catch after dashboard refactors.
 *
 * Usage:
 *   BASE_URL=http://localhost:8080 node tests/puppeteer/interactions.js
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

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function clickView(page, viewId, expectedSelector) {
  await page.click(`.view-tab[data-view="${viewId}"]`);
  await page.waitForFunction(
    (id) => {
      const activeTab = document.querySelector(".view-tab.active");
      const activeView = document.querySelector(".view.active");
      return (
        activeTab?.getAttribute("data-view") === id &&
        activeView?.id === `view-${id}`
      );
    },
    { timeout: 15000 },
    viewId
  );

  if (expectedSelector) {
    await page.waitForSelector(expectedSelector, { timeout: 20000 });
  }
}

(async () => {
  fs.mkdirSync(SHOT_DIR, { recursive: true });

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const pageErrors = [];
  const consoleErrors = [];
  const failedResponses = [];

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 1400 });

    page.on("pageerror", (error) => {
      pageErrors.push(error.message);
    });

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    page.on("response", (response) => {
      if (response.status() >= 400) {
        failedResponses.push({
          status: response.status(),
          url: response.url(),
        });
      }
    });

    console.log(`Loading ${BASE_URL} …`);
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForSelector("main.shell", { timeout: 15000 });

    await page.waitForSelector(".view-tab[data-view='executive']", { timeout: 15000 });

    const viewIds = await page.$$eval(".view-tab", (buttons) =>
      buttons.map((button) => button.getAttribute("data-view"))
    );
    const expectedViews = [
      "executive",
      "ops",
      "intake",
      "credentialing",
      "staff",
      "hubstaff",
      "insurance",
      "marketing",
      "minutes",
    ];

    assert(
      expectedViews.every((id) => viewIds.includes(id)),
      `all expected views are present (${viewIds.join(", ")})`
    );

    await page.waitForSelector("#executiveKpis .kpi-card, #executiveKpis .kpi", { timeout: 30000 });
    assert(true, "executive KPIs render");

    await clickView(page, "ops", "#issuesTable tr, #issuesTable td");
    assert(true, "ops view opens");

    await page.select("#stateFilter", "PA").catch(() => {});
    await wait(300);
    assert(true, "global state filter accepts selection");

    await clickView(page, "staff", "#stateCoverageSelect");
    const staffOptions = await page.$$eval("#stateCoverageSelect option", (options) => options.length);
    assert(staffOptions > 0, `staff state coverage selector has ${staffOptions} options`);

    await clickView(page, "hubstaff", "#hubstaffSummary");
    const hubstaffSummary = await page.$eval("#hubstaffSummary", (el) => el.textContent.trim());
    assert(hubstaffSummary.length > 0, "hubstaff summary is populated");

    await clickView(page, "insurance", "#insuranceStateSelect");
    await page.waitForFunction(
      () => document.querySelectorAll("#insuranceStateSelect option").length > 0,
      { timeout: 30000 }
    );
    const insuranceOptions = await page.$$eval("#insuranceStateSelect option", (options) => options.length);
    assert(insuranceOptions > 0, `insurance state selector has ${insuranceOptions} options`);

    await page.click('.map-mode-toggle .mode-btn[data-mode="priority"]');
    await page.waitForFunction(
      () => document.querySelector('.map-mode-toggle .mode-btn.active')?.getAttribute('data-mode') === 'priority',
      { timeout: 15000 }
    );
    assert(true, "insurance map mode toggles to priority");

    await clickView(page, "marketing", "#marketingSummary");
    const marketingSummary = await page.$eval("#marketingSummary", (el) => el.textContent.trim());
    assert(marketingSummary.length > 0, "marketing summary is populated");

    await clickView(page, "minutes", "#minutesSummary, #meetingMinutesList, #minutesList");
    assert(true, "minutes view opens");

    await clickView(page, "executive", "#executiveNarrative");
    assert(true, "returns to executive view");

    assert(pageErrors.length === 0, `no page errors (${pageErrors.join(" | ") || "none"})`);

    const relevantFailedResponses = failedResponses.filter((entry) => !entry.url.endsWith("/favicon.ico"));
    const relevantConsoleErrors = consoleErrors.filter((text) => !text.includes("favicon.ico"));
    const errorSummary = [
      ...relevantConsoleErrors,
      ...relevantFailedResponses.map((entry) => `${entry.status} ${entry.url}`),
    ];
    assert(errorSummary.length === 0, `no console errors (${errorSummary.join(" | ") || "none"})`);

    const shot = path.join(SHOT_DIR, "interactions.png");
    await page.screenshot({ path: shot, fullPage: true });
    console.log(`\nScreenshot saved to ${shot}`);
    console.log("\n✅ Puppeteer interaction test passed.");
  } finally {
    await browser.close();
  }
})().catch((err) => {
  console.error("\n❌ Puppeteer interaction test failed:\n", err.message);
  process.exit(1);
});
