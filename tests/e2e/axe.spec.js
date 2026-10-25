import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mockOpenMeteo, seedPreferences, seedPlaces } from "./helpers";
import { BERLIN } from "../fixtures/weather";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function analyse(page) {
  return new AxeBuilder({ page }).withTags(TAGS).analyze();
}

function formatViolations(violations) {
  return violations
    .map(
      (violation) =>
        `${violation.id} (${violation.impact}): ${violation.help}\n${violation.nodes
          .map((node) => `  ${node.target.join(" ")}: ${node.failureSummary}`)
          .join("\n")}`,
    )
    .join("\n\n");
}

test("onboarding has no automated accessibility violations", async ({ page }) => {
  await mockOpenMeteo(page);
  await page.goto("/");
  await expect(page.getByTestId("onboarding")).toBeVisible();
  await page.waitForTimeout(500);

  const results = await analyse(page);
  expect(results.violations, formatViolations(results.violations)).toEqual([]);
});

test("weather dashboard has no automated accessibility violations", async ({ page }) => {
  await seedPlaces(page, [BERLIN]);
  await mockOpenMeteo(page);
  await page.goto("/");
  await expect(page.getByTestId("weather-dashboard")).toBeVisible();
  await page.waitForTimeout(600);

  const results = await analyse(page);
  expect(results.violations, formatViolations(results.violations)).toEqual([]);
});

test("dark dashboard has no automated accessibility violations", async ({ page }) => {
  await seedPlaces(page, [BERLIN]);
  await seedPreferences(page, { theme: "dark" });
  await mockOpenMeteo(page);
  await page.goto("/");
  await expect(page.getByTestId("weather-dashboard")).toBeVisible();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.waitForTimeout(600);

  const results = await analyse(page);
  expect(results.violations, formatViolations(results.violations)).toEqual([]);
});

test("day detail dialog has no automated accessibility violations", async ({ page }) => {
  await seedPlaces(page, [BERLIN]);
  await mockOpenMeteo(page);
  await page.goto("/");
  await expect(page.getByTestId("weather-dashboard")).toBeVisible();
  await page.getByTestId("daily-forecast").getByRole("button").first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.waitForTimeout(250);

  const results = await analyse(page);
  expect(results.violations, formatViolations(results.violations)).toEqual([]);
});

test("preferences dialog has no automated accessibility violations", async ({ page }) => {
  await seedPlaces(page, [BERLIN]);
  await mockOpenMeteo(page);
  await page.goto("/");
  await expect(page.getByTestId("weather-dashboard")).toBeVisible();
  await page.getByRole("button", { name: "Preferences" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.waitForTimeout(250);

  const results = await analyse(page);
  expect(results.violations, formatViolations(results.violations)).toEqual([]);
});

test("location dialog has no automated accessibility violations", async ({ page }) => {
  await seedPlaces(page, [BERLIN]);
  await mockOpenMeteo(page);
  await page.goto("/");
  await expect(page.getByTestId("weather-dashboard")).toBeVisible();
  await page.getByRole("button", { name: /Change location/i }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Saved places", { exact: true })).toBeVisible();
  await page.waitForTimeout(250);

  const results = await analyse(page);
  expect(results.violations, formatViolations(results.violations)).toEqual([]);
});

