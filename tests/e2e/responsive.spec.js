import fs from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";
import { mockOpenMeteo, openCityFromOnboarding, seedPlaces } from "./helpers";
import { BERLIN, COLOMBO } from "../fixtures/weather";

const SCREENSHOT_DIR = path.join(process.cwd(), "test-results", "screenshots");

test.beforeAll(() => {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
});

async function expectNoHorizontalOverflow(page) {
  const sizes = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(
    sizes.scrollWidth,
    `horizontal overflow at ${sizes.innerWidth}px: ${sizes.scrollWidth}px`,
  ).toBeLessThanOrEqual(sizes.innerWidth + 1);
}

test("layouts stay within the viewport from 360px to 1440px", async ({ page }) => {
  await mockOpenMeteo(page);
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  await expect(page.getByTestId("onboarding")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, "onboarding-360.png"),
    fullPage: true,
    animations: "disabled",
  });

  await page.setViewportSize({ width: 1440, height: 950 });
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, "onboarding-1440.png"),
    fullPage: true,
    animations: "disabled",
  });

  await page.setViewportSize({ width: 1440, height: 950 });
  await openCityFromOnboarding(page);
  await expect(page.getByTestId("weather-dashboard")).toBeVisible();

  for (const width of [360, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: width < 768 ? 800 : 950 });
    await page.waitForTimeout(250);
    await expectNoHorizontalOverflow(page);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, `dashboard-${width}.png`),
      fullPage: true,
      animations: "disabled",
    });
  }

  await page.getByRole("button", { name: "Preferences" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByText("Dark", { exact: true }).click();
  await expect(dialog.getByRole("radio", { name: "Dark" })).toBeChecked();
  await page.keyboard.press("Escape");
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.waitForTimeout(250);
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, "dashboard-1440-dark.png"),
    fullPage: true,
    animations: "disabled",
  });
});

test("Sri Lankan station, Weather Desk, and footer reflow from 360px to 1440px", async ({
  page,
}) => {
  await seedPlaces(page, [COLOMBO]);
  await mockOpenMeteo(page);
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");

  await expect(page.getByTestId("weather-dashboard")).toBeVisible();
  const card = page.getByTestId("official-observations");
  await expect(card.getByTestId("official-station-name")).toHaveText("COLOMBO");

  for (const width of [360, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: width < 768 ? 800 : 950 });
    await page.waitForTimeout(200);
    await expectNoHorizontalOverflow(page);
    await expect(card).toBeVisible();
    await expect(page.getByRole("contentinfo")).toBeVisible();
  }

  await page.getByRole("tablist", { name: "Weather desk tools" })
    .getByRole("tab", { name: "Rain" })
    .click();
  await expect(
    page.getByRole("tablist", { name: "Weather desk tools" }).getByRole("tab", { name: "Rain" }),
  ).toHaveAttribute("aria-selected", "true");
  await expectNoHorizontalOverflow(page);

  for (const width of [360, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: width < 768 ? 800 : 950 });
    await page.waitForTimeout(200);
    await expectNoHorizontalOverflow(page);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, `station-dashboard-${width}.png`),
      fullPage: true,
      animations: "disabled",
    });
  }
});

test("daily cards reflow without clipping at every breakpoint", async ({ page }) => {
  await seedPlaces(page, [BERLIN]);
  await mockOpenMeteo(page);
  await page.goto("/");
  await expect(page.getByTestId("daily-forecast")).toBeVisible();

  for (const width of [360, 768, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    const cards = page.getByTestId("daily-forecast").getByRole("button");
    await expect(cards).toHaveCount(7);
    const boxes = await cards.evaluateAll((nodes) =>
      nodes.map((node) => {
        const box = node.getBoundingClientRect();
        return { left: box.left, right: box.right };
      }),
    );
    for (const box of boxes) {
      expect(box.left).toBeGreaterThanOrEqual(0);
      expect(box.right).toBeLessThanOrEqual(width + 1);
    }
  }
});
