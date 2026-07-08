# OpsCenter Workforce Dashboard

Static operations dashboard for GitHub Pages. The app loads a published Google Sheets workbook and turns it into four browser-side views:

- Executive Dashboard
- Ops Center
- Intake / Referral Reporting
- Staff Metrics
- Hubstaff

## Structure

- `index.html`: the root GitHub Pages entrypoint and app shell
- `styles.css`: shared visual system and responsive layout
- `app.js`: view state, rendering, filtering, and dashboard logic
- `sheets.js`: Google Sheets tab configuration, CSV loading, caching, and normalization
- `opscenter/`: legacy experimental app files kept in the repo for reference

## Google Sheets config

Update `TAB_CONFIG` and the published workbook URL in [`sheets.js`](/Users/yasirahmad/Documents/GitHub/opscenter/sheets.js) if the workbook or tab mapping changes.

The current published workbook is:

- [Candidates for Hire workbook](https://docs.google.com/spreadsheets/d/e/2PACX-1vTUQ5bqosxRzkSWO_xPAp6EauqGTV01N0meOZekSRzW93Z3DbPGbU4xpFnrvAgH4QhQF5QZHi7wp1-r/pubhtml)

If Google stops serving all tabs from that legacy published workbook, define `window.OPS_CENTER_SOURCE_OVERRIDES` before [`sheets.js`](/Users/yasirahmad/Documents/GitHub/opscenter/sheets.js) loads. You can either set `primaryWorkbookSheetId` to a link-shared workbook ID that supports anonymous `gviz` CSV access, or override tabs individually with keys like `candidatePool`, `interviews`, `finalHires`, `currentWorkforce`, `resumePool`, and `newHiring`.

## Local preview

Because the app fetches CSV data over HTTP, preview it with a simple static server instead of opening `index.html` directly from Finder.

Examples:

```bash
cd /Users/yasirahmad/Documents/GitHub/opscenter
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Testing (Cypress + Puppeteer)

End-to-end tests live alongside the app and run against a locally served copy
of the static site. Test tooling is excluded from the FTP deploy, so nothing
here ships to the live site.

```bash
npm install            # installs Cypress, Puppeteer, and a static server

# Cypress (interactive)
npm run cy:open

# Cypress (headless, auto-starts the static server)
npm run test:e2e

# Puppeteer smoke test (auto-starts the static server)
npm run test:smoke:served
```

- `cypress/e2e/smoke.cy.js` — verifies the app shell, header, and source-sheet link render.
- `tests/puppeteer/smoke.js` — headless Chromium smoke check that also saves a screenshot.

## GitHub Pages deploy

1. Push the repo to GitHub.
2. In the repository settings, open `Pages`.
3. Set the source to deploy from the default branch and `/ (root)`.
4. Make sure `index.html`, `styles.css`, `app.js`, and `sheets.js` stay in the repo root.
5. If you use a custom domain later, add a `CNAME` file in the repo root before enabling the domain in GitHub Pages.

## Resilience behavior

- Live Google Sheets tabs are fetched individually.
- If a live fetch fails, the app falls back to the last successful browser-cached version of that tab.
- If neither live nor cached data exists, the tab is marked unavailable in System Health and the Ops queue.

## Current known data gaps

- No explicit owner field exists in the workbook, so owner accountability is derived from workflow type.
- No direct revenue, patient census, or referral outcome table is present, so Ops Center uses hiring capacity proxies for risk and flow.
- `Resume Pool` is currently header-only, so it contributes structure but not operational volume yet.
- The Hubstaff tab reads from a published sanitized export feed, not directly from a Hubstaff API key in browser code.

## Hubstaff integration

For GitHub Pages, do not place a private Hubstaff API token in front-end JavaScript.

Recommended options:

- Best static option: export Hubstaff data into a published Google Sheet or CSV feed and add that source to `sheets.js`
- Good fallback: commit a CSV snapshot that the app can read statically
- Secure live option: use a small backend or serverless proxy to call Hubstaff privately and return sanitized data to the browser
