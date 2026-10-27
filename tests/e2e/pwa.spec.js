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
  expect(cachedPaths).not.toContain("/api/weather/meteo-json");
  expect(cachedPaths).not.toContain("/api/weather/metar");

  // The observation request came from the page, not from a cached response.
  expect(state.meteoJsonRequests).toBeGreaterThanOrEqual(1);
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

    // The last successfully loaded forecast is kept in localStorage, so an
    // offline reload still shows the dashboard instead of only an error. The
    // copy must be labelled with its original age, never as live data.
    await expect(page.getByTestId("weather-dashboard")).toBeVisible();
    await expect(
      page.getByText(/Showing the saved forecast for Colombo/),
    ).toBeVisible();
    await expect(page.getByText(/not live until you reconnect/)).toBeVisible();
  } finally {
    await context.setOffline(false);
  }
});

test("a real install prompt is offered in Preferences and never shown as fake", async ({
  page,
}) => {
  await mockOpenMeteo(page);
  await seedPlaces(page, [COLOMBO]);
  await page.goto("/");
  await expect(page.getByTestId("weather-dashboard")).toBeVisible();

  await page.getByRole("button", { name: "Preferences" }).click();
  let dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");

  await page.evaluate(() => {
    const event = new Event("beforeinstallprompt", { cancelable: true });
    event.prompt = async () => {};
    event.userChoice = Promise.resolve({ outcome: "accepted" });
    window.dispatchEvent(event);
  });

  await page.getByRole("button", { name: "Preferences" }).click();
  dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Install Aeris" })).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Install Aeris" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
});

test.describe("iOS install guidance", () => {
  test.use({
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  });

  test("iPhone users get Safari Add to Home Screen instructions", async ({ page }) => {
    await mockOpenMeteo(page);
    await seedPlaces(page, [COLOMBO]);
    await page.goto("/");
    await expect(page.getByTestId("weather-dashboard")).toBeVisible();

    await page.getByRole("button", { name: "Preferences" }).click();
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("heading", { name: "Install Aeris" }),
    ).toBeVisible();
    await expect(dialog).toContainText("open Aeris in Safari");
    await expect(dialog).toContainText("Add to Home Screen");
    await expect(dialog.getByRole("button", { name: "Install Aeris" })).toHaveCount(0);
  });
});

test("an installed standalone window does not offer installation again", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window.navigator, "standalone", { get: () => true });
  });
  await mockOpenMeteo(page);
  await seedPlaces(page, [COLOMBO]);
  await page.goto("/");
  await expect(page.getByTestId("weather-dashboard")).toBeVisible();

  await page.getByRole("button", { name: "Preferences" }).click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: "Installed app" }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("heading", { name: "Install Aeris" }),
  ).toHaveCount(0);
});
