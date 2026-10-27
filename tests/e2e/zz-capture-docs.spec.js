import path from "node:path";
import { test, expect } from "@playwright/test";
import { COLOMBO } from "../fixtures/weather";
import { seedPlaces, seedPreferences } from "./helpers";

// Capture the README screenshots from a production build against the real
// Open-Meteo forecast, DoM snapshot route, and NASA GIBS imagery. Deterministic
// fixtures produce incoherent combinations (a 30 °C tropical afternoon with a
// 15 °C daily high), so this script deliberately does not mock anything.
const OUT = path.join(process.cwd(), "docs", "screenshots");

async function waitForDashboard(page) {
  await page.goto("/");
  await expect(page.getByTestId("weather-dashboard")).toBeVisible({ timeout: 30_000 });
  // Give the satellite card time to fetch its first real frame. It is allowed
  // to fail; the screenshot then shows its honest error state.
  const frame = page.getByTestId("satellite-card").locator("img").first();
  await expect
    .poll(
      () =>
        frame
          .evaluate((img) => Boolean(img && img.complete && img.naturalWidth > 0))
          .catch(() => false),
      { timeout: 30_000 },
    )
    .toBe(true)
    .catch(() => {});
  await page.waitForTimeout(2_500);
}

test.describe("docs screenshots", () => {
  test.describe("desktop light", () => {
    test.use({ viewport: { width: 1440, height: 950 } });

    test("onboarding", async ({ page }) => {
      await page.goto("/");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await page.waitForTimeout(1_500);
      await page.screenshot({ path: path.join(OUT, "onboarding-light.png") });
    });

    test("dashboard", async ({ page }) => {
      await seedPlaces(page, [COLOMBO]);
      await waitForDashboard(page);
      await page.screenshot({
        path: path.join(OUT, "dashboard-light.png"),
        fullPage: true,
      });
    });
  });

  test.describe("desktop dark", () => {
    test.use({ viewport: { width: 1440, height: 950 } });

    test("dashboard", async ({ page }) => {
      await seedPlaces(page, [COLOMBO]);
      await seedPreferences(page, { theme: "dark" });
      await waitForDashboard(page);
      await page.screenshot({
        path: path.join(OUT, "dashboard-dark.png"),
        fullPage: true,
      });
    });
  });

  test.describe("mobile", () => {
    test.use({
      viewport: { width: 360, height: 800 },
      deviceScaleFactor: 1,
      isMobile: true,
      hasTouch: true,
    });

    test("dashboard", async ({ page }) => {
      await seedPlaces(page, [COLOMBO]);
      await waitForDashboard(page);
      await page.screenshot({
        path: path.join(OUT, "dashboard-mobile.png"),
        fullPage: true,
      });
    });
  });
});
