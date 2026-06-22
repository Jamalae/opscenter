/// <reference types="cypress" />

// Smoke test: verifies the static app shell renders correctly.
// These assertions intentionally target the static shell (not live Google
// Sheets data) so the test is deterministic regardless of upstream data.
describe("OpsCenter dashboard — smoke", () => {
  beforeEach(() => {
    cy.visit("/");
  });

  it("loads with the correct page title", () => {
    cy.title().should("eq", "OpsCenter Workforce Dashboard");
  });

  it("renders the app shell and header", () => {
    cy.get("main.shell").should("be.visible");
    cy.get("header.head h1").should("contain.text", "Ops Center");
    cy.get(".logo").should("contain.text", "OC");
  });

  it("shows the live data status indicator", () => {
    cy.get("#liveStatus").should("exist");
  });

  it("links out to the source Google Sheet", () => {
    cy.contains("a", "Open Source Sheet")
      .should("have.attr", "href")
      .and("include", "docs.google.com/spreadsheets");
  });
});
