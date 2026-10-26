import { test, expect } from "@playwright/test";
import {
  mockOpenMeteo,
  PREFS_KEY,
  seedPlaces,
  seedPreferences,
} from "./helpers";
import { BERLIN, COLOMBO } from "../fixtures/weather";

async function storedStationId(page) {
  return page.evaluate(
    (key) => JSON.parse(window.localStorage.getItem(key) || "{}").stationId,
    PREFS_KEY,
  );
}

test("automatic selection prefers a fresh observation over a nearer stale station", async ({
  page,
}) => {
  const bulletinRequests = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/weather/official-bulletins")) {
      bulletinRequests.push(request.url());
    }
  });

  await seedPlaces(page, [COLOMBO]);
  const state = await mockOpenMeteo(page, {
    stationAges: { colombo: 720, jaffna: 20 },
  });
  await page.goto("/");

  await expect(page.getByTestId("weather-dashboard")).toBeVisible();
  const card = page.getByTestId("official-observations");
  await expect(card.getByTestId("official-station-name")).toHaveText("JAFFNA");
  await expect(card).toContainText("Automatic station");
  await expect(card.getByTestId("official-temperature")).toHaveText("24.5°C");
  await expect(card.getByTestId("official-freshness")).toHaveText(/Observed 2\d min ago/);
  await expect(card.getByText("Official reading")).toBeVisible();
  await expect(card.getByTestId("official-station-name")).not.toHaveText("COLOMBO");

  await card.locator("summary").click();
  await expect(
    card.getByText(/nearest station's observation was stale or missing/i),
  ).toBeVisible();
  await expect(card).toContainText("Approximate city-centre reference");

  expect(state.officialObservationRequests).toBeGreaterThanOrEqual(1);
  expect(bulletinRequests).toEqual([]);
});

test("manual station choice stays in sync and survives a reload", async ({ page }) => {
  await seedPlaces(page, [COLOMBO]);
  await mockOpenMeteo(page);
  await page.goto("/");

  await expect(page.getByTestId("weather-dashboard")).toBeVisible();
  const card = page.getByTestId("official-observations");
  await expect(card.getByTestId("official-station-name")).toHaveText("COLOMBO");

  const dashboardSelect = page.locator("#official-station-select");
  await expect(dashboardSelect).toHaveValue("auto");
  await dashboardSelect.selectOption("jaffna");

  await expect(card.getByTestId("official-station-name")).toHaveText("JAFFNA");
  await expect(card).toContainText("Manual station");
  await expect(card.getByTestId("official-temperature")).toHaveText("24.5°C");
  await expect.poll(() => storedStationId(page)).toBe("jaffna");

  await page.getByRole("button", { name: "Preferences" }).click();
  const dialog = page.getByRole("dialog");
  const settingsSelect = dialog.locator("#settings-station-select");
  await expect(settingsSelect).toHaveValue("jaffna");
  await settingsSelect.selectOption("colombo");
  await expect(settingsSelect).toHaveValue("colombo");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  await expect(card.getByTestId("official-station-name")).toHaveText("COLOMBO");
  await expect(dashboardSelect).toHaveValue("colombo");
  await expect.poll(() => storedStationId(page)).toBe("colombo");

  await page.reload();
  await expect(page.getByTestId("weather-dashboard")).toBeVisible();
  await expect(
    page.getByTestId("official-observations").getByTestId("official-station-name"),
  ).toHaveText("COLOMBO");
  await expect(page.locator("#official-station-select")).toHaveValue("colombo");

  await page.getByRole("button", { name: "Preferences" }).click();
  await expect(
    page.getByRole("dialog").locator("#settings-station-select"),
  ).toHaveValue("colombo");
});

test("a missing manual station is preserved and explained instead of replaced", async ({
  page,
}) => {
  await seedPlaces(page, [COLOMBO]);
  await seedPreferences(page, { stationId: "kandy" });
  await mockOpenMeteo(page);
  await page.goto("/");

  await expect(page.getByTestId("weather-dashboard")).toBeVisible();
  const card = page.getByTestId("official-observations");
  const alert = card.getByRole("alert");
  await expect(alert).toBeVisible();
  await expect(alert).toContainText("Saved station is not in this response");
  await expect(alert).toContainText("Your manual choice has not been changed");
  await expect(card.getByTestId("official-temperature")).toHaveCount(0);

  const dashboardSelect = page.locator("#official-station-select");
  await expect(dashboardSelect).toHaveValue("kandy");
  const savedOption = dashboardSelect.locator('option[value="kandy"]');
  await expect(savedOption).toHaveText("Saved station unavailable");
  await expect(savedOption).toBeDisabled();
  await expect.poll(() => storedStationId(page)).toBe("kandy");

  await page.getByRole("button", { name: "Preferences" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator("#settings-station-select")).toHaveValue("kandy");
  await expect(dialog).toContainText("Saved station unavailable");
  await expect(dialog).toContainText("Your manual choice has not been changed");
});

test("outside Sri Lanka automatic selection explains the limit but manual choice works", async ({
  page,
}) => {
  await seedPlaces(page, [BERLIN]);
  await mockOpenMeteo(page);
  await page.goto("/");

  await expect(page.getByTestId("weather-dashboard")).toBeVisible();
  const card = page.getByTestId("official-observations");
  await expect(card).toContainText("No automatic station for this place");
  await expect(card).toContainText("Automatic selection needs a Sri Lankan place");
  await expect(card.getByTestId("official-temperature")).toHaveCount(0);

  const dashboardSelect = page.locator("#official-station-select");
  await expect(dashboardSelect).toHaveValue("auto");
  await dashboardSelect.selectOption("jaffna");

  await expect(card.getByTestId("official-station-name")).toHaveText("JAFFNA");
  await expect(card).toContainText("Manual station");
  await expect(card.getByTestId("official-temperature")).toHaveText("24.5°C");
  await expect(card).toContainText("Approximate city-centre reference");
});

test("a stale station reading is labelled delayed rather than presented as current", async ({
  page,
}) => {
  await seedPlaces(page, [COLOMBO]);
  await mockOpenMeteo(page, { observationAgeMinutes: 500 });
  await page.goto("/");

  await expect(page.getByTestId("weather-dashboard")).toBeVisible();
  const card = page.getByTestId("official-observations");
  await expect(card.getByTestId("official-station-name")).toHaveText("COLOMBO");
  await expect(card.getByText("Station data delayed")).toBeVisible();
  await expect(card.getByTestId("official-freshness")).toHaveText("Observed 8 hrs ago");
  await expect(card).toContainText("delayed for this reading");
  await expect(card.getByTestId("official-fetched")).toContainText(/Fetched (just now|\d+ min ago)/);
  await expect(card.getByTestId("official-fetched")).toContainText("Aeris checked");
  await expect(card.getByText("Official reading")).toHaveCount(0);
});

test("an observation failure is shown honestly and can be retried", async ({ page }) => {
  await seedPlaces(page, [COLOMBO]);
  const state = await mockOpenMeteo(page, { failObservationsTimes: 1 });
  await page.goto("/");

  await expect(page.getByTestId("weather-dashboard")).toBeVisible();
  const card = page.getByTestId("official-observations");
  const alert = card.getByRole("alert");
  await expect(alert).toBeVisible();
  await expect(alert).toContainText("Official readings offline");
  await expect(alert).toContainText("The Department of Meteorology did not respond");
  await expect(alert).toContainText("Retrying in");
  expect(state.officialObservationRequests).toBe(1);
  expect(state.officialObservationFailures).toBe(1);

  await alert.getByRole("button", { name: /Retry/ }).click();
  await expect(card.getByTestId("official-station-name")).toHaveText("COLOMBO");
  await expect(alert).toBeHidden();
  await expect.poll(() => state.officialObservationRequests).toBe(2);
  expect(state.officialObservationFailures).toBe(1);
});

test("an unreachable DoM page falls back to clearly labelled NOAA AWC airport METAR", async ({
  page,
}) => {
  await seedPlaces(page, [COLOMBO]);
  await mockOpenMeteo(page, { officialSource: "metar", observationAgeMinutes: 12 });
  await page.goto("/");

  await expect(page.getByTestId("weather-dashboard")).toBeVisible();
  const card = page.getByTestId("official-observations");
  await expect(card).toContainText("Official observation · NOAA AWC METAR");
  await expect(card).toContainText(/not DoM district stations/i);
  await expect(card.getByTestId("official-station-name")).toHaveText("RATMALANA");
  await expect(card.getByText("Official airport report")).toBeVisible();
  await expect(card).toContainText("Colombo Ratmalana Airport (VCCC)");
  await expect(card).toContainText("Official station point");
  await expect(card.getByText("Pressure", { exact: true })).toBeVisible();
  await expect(card.getByText("Visibility", { exact: true })).toBeVisible();
  await expect(card.getByText("Rain, 3 h")).toHaveCount(0);
  await expect(card.getByText("Since 08:30")).toHaveCount(0);
  await expect(card).toContainText("METAR does not carry a rainfall total");

  await card.getByText("Raw METAR report").click();
  await expect(card).toContainText("METAR VCCC 260000Z 22008KT 9999 FEW016 28/26 Q1009");

  const sourceLink = card.getByRole("link", { name: /NOAA/i });
  await expect(sourceLink).toHaveAttribute("href", "https://aviationweather.gov/data/api/");
});
