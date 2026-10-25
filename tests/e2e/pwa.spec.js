import { test, expect } from "@playwright/test";
import { mockOpenMeteo, seedPlaces } from "./helpers";
import { COLOMBO } from "../fixtures/weather";

// The service worker is deliberately not registered during `next dev`, so
// these checks only make sense against a production build.
test.skip(process.env.PW_DEV === "1", "The service worker is production-only.");

test("the service worker caches the shell but not the observation API", async ({ page }) => {
  const state = await mockOpenMeteo(page);
  await seedPlaces(page, [COLOMBO]);
  await page.goto("/");

  await expect(page.getByTestId("weather-dashboard")).toBeVisible();
  await expect
    .poll(
      () => page.evaluate(() => Boolean(navigator.serviceWorker?.controller)),
      { timeout: 20_000 },
    )
    .toBe(true);

  const cacheState = await page.evaluate(async () => {
    const result = {};
    for (const name of await caches.keys()) {
      const cache = await caches.open(name);
      result[name] = (await cache.keys()).map((request) => new URL(request.url).pathname);
    }
    return result;
  });

  const shellKey = Object.keys(cacheState).find((name) => name.startsWith("aeris-shell-"));
  expect(shellKey, "the app-shell cache should exist").toBeTruthy();
  expect(cacheState[shellKey]).toContain("/");
  expect(cacheState[shellKey]).toContain("/offline.html");

  const cachedPaths = Object.values(cacheState).flat();
  expect(cachedPaths).not.toContain("/api/weather/sri-lanka-dom");

  // The observation request came from the page, not from a cached response.
  expect(state.officialObservationRequests).toBeGreaterThanOrEqual(1);
});

test("an offline reload boots from the cached app shell", async ({ page, context }) => {
  await mockOpenMeteo(page);
  await seedPlaces(page, [COLOMBO]);
  await page.goto("/");

  await expect(page.getByTestId("weather-dashboard")).toBeVisible();
  await expect
    .poll(
      () => page.evaluate(() => Boolean(navigator.serviceWorker?.controller)),
      { timeout: 20_000 },
    )
    .toBe(true);

  await context.setOffline(true);
  try {
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByRole("link", { name: "Aeris home" })).toBeVisible();

    // The cached document must also bring its hashed stylesheet, otherwise the
    // offline shell renders as unstyled HTML.
    const bodyStyle = await page.evaluate(() => {
      const style = getComputedStyle(document.body);
      return { background: style.backgroundColor, font: style.fontFamily };
    });
    expect(bodyStyle.background).toBe("rgb(246, 246, 240)");
    expect(bodyStyle.font.toLowerCase()).not.toContain("times");
  } finally {
    await context.setOffline(false);
  }
});
