const { defineConfig } = require("cypress");

module.exports = defineConfig({
  e2e: {
    // The static site is served locally (see `npm run serve`) on port 8080.
    baseUrl: "http://localhost:8080",
    specPattern: "cypress/e2e/**/*.cy.js",
    supportFile: "cypress/support/e2e.js",
    fixturesFolder: "cypress/fixtures",
    video: false,
    // Google Sheets CSV fetches can be slow / flaky in CI; don't fail the
    // whole suite on a single uncaught upstream error.
    defaultCommandTimeout: 10000,
    setupNodeEvents(on, config) {
      return config;
    },
  },
});
