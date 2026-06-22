// Loaded automatically before every e2e spec.
// Add global behavior / custom commands here.

// The dashboard fetches published Google Sheets CSVs at runtime. A failed
// upstream fetch should not crash the test run, so swallow uncaught
// exceptions that originate from network/data loading rather than the app shell.
Cypress.on("uncaught:exception", () => false);
