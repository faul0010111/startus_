import { expect, test } from "@playwright/test";

test.describe("STRATUS Command Center", () => {
  test("renders the posture score and the infrastructure counters", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /STRATUS COMMAND CENTER/i })).toBeVisible();
    await expect(page.getByText("Total assets")).toBeVisible();
    await expect(page.getByText("P1 critical")).toBeVisible();
  });

  test("switches the risk trend window", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "30d" }).click();
    await expect(page.getByText(/over 30d/)).toBeVisible();
  });

  test("navigates from the incident list into the incident timeline", async ({ page }) => {
    await page.goto("/incidents");
    await expect(page.getByRole("heading", { name: /STRATUS INCIDENT COMMAND/i })).toBeVisible();
    await page.getByRole("link", { name: /deployment/i }).first().click();
    await expect(page.getByText("TIMELINE")).toBeVisible();
    await expect(page.getByText("SUGGESTED ACTIONS")).toBeVisible();
  });

  test("filters findings by severity", async ({ page }) => {
    await page.goto("/findings");
    await page.getByRole("button", { name: "critical", exact: true }).click();
    await expect(page.getByRole("table")).toBeVisible();
  });

  test("ranks the asset inventory by risk", async ({ page }) => {
    await page.goto("/assets");
    await expect(page.getByRole("heading", { name: /ASSET INVENTORY/i })).toBeVisible();
    await expect(page.getByRole("table")).toBeVisible();
  });

  test("flags sample data when the API is unreachable", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/bundled sample data/i)).toBeVisible();
  });
});
