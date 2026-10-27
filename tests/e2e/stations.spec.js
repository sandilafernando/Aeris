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

test("automatic selection prefers a fresh observation over nearer stale stations", async ({
  page,
}) => {
  await seedPlaces(page, [COLOMBO]);
  const state = await mockOpenMeteo(page, {
    stationAges: { colombo: 720, ratmalana: 720, katunayake: 20 },
  });
  await page.goto("/");

  await expect(page.getByTestId("weather-dashboard")).toBeVisible();
  const card = page.getByTestId("at-a-glance");
  const dom = card.getByTestId("glance-group-dom");
  await expect(dom.getByTestId("glance-dom-station")).toHaveText("KATUNAYAKE");
  await expect(dom.getByTestId("glance-dom-freshness-badge")).toHaveText(
    "Official reading",
  );
  await expect(dom).toContainText("25.1°C");
  await expect(dom.getByTestId("glance-dom-observed")).toContainText(
    /Observed .* · 2\d min ago/,
  );
  await expect(dom.getByTestId("glance-dom-station")).not.toHaveText("COLOMBO");
  await expect(card).toContainText("nearest fresh station to the active place");

  await expect(card.locator("#glance-station-select")).toHaveValue("auto");
  expect(state.meteoJsonRequests).toBeGreaterThanOrEqual(1);
});

test("manual station choice stays in sync and survives a reload", async ({ page }) => {
  await seedPlaces(page, [COLOMBO]);
  await mockOpenMeteo(page);
  await page.goto("/");

  await expect(page.getByTestId("weather-dashboard")).toBeVisible();
  const card = page.getByTestId("at-a-glance");
  const dom = card.getByTestId("glance-group-dom");
  await expect(dom.getByTestId("glance-dom-station")).toHaveText("COLOMBO");

  const dashboardSelect = page.locator("#glance-station-select");
  await expect(dashboardSelect).toHaveValue("auto");
  await dashboardSelect.selectOption("jaffna");

  await expect(dom.getByTestId("glance-dom-station")).toHaveText("JAFFNA");
  await expect(dom).toContainText("24.0°C");
  await expect(card).toContainText("A manual station stays fixed");
  await expect.poll(() => storedStationId(page)).toBe("jaffna");

  await page.getByRole("button", { name: "Preferences" }).click();
  const dialog = page.getByRole("dialog");
  const settingsSelect = dialog.locator("#settings-station-select");
  await expect(settingsSelect).toHaveValue("jaffna");
  await settingsSelect.selectOption("colombo");
  await expect(settingsSelect).toHaveValue("colombo");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  await expect(dom.getByTestId("glance-dom-station")).toHaveText("COLOMBO");
  await expect(dashboardSelect).toHaveValue("colombo");
  await expect.poll(() => storedStationId(page)).toBe("colombo");

  await page.reload();
  await expect(page.getByTestId("weather-dashboard")).toBeVisible();
  await expect(
    page.getByTestId("glance-group-dom").getByTestId("glance-dom-station"),
  ).toHaveText("COLOMBO");
  await expect(page.locator("#glance-station-select")).toHaveValue("colombo");

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
  const card = page.getByTestId("at-a-glance");

  const dashboardSelect = card.locator("#glance-station-select");
  await expect(dashboardSelect).toHaveValue("kandy");
  const savedOption = dashboardSelect.locator('option[value="kandy"]');
  await expect(savedOption).toHaveText("Saved station unavailable");
  await expect(savedOption).toBeDisabled();
  await expect.poll(() => storedStationId(page)).toBe("kandy");

  // The missing DoM station falls back to a labelled airport report, never a
  // different DoM district station pretending to be the saved one.
  await expect(card).toContainText("DoM reading replaced by a labelled airport fallback");
  await expect(card.getByTestId("glance-metar-station")).toHaveText("RATMALANA");

  await page.getByRole("button", { name: "Preferences" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator("#settings-station-select")).toHaveValue("kandy");
  await expect(dialog).toContainText("Saved station unavailable");
  await expect(dialog).toContainText("Your manual choice has not been changed");
});

test("outside Sri Lanka automatic selection uses a labelled default, not a nearest claim", async ({
  page,
}) => {
  await seedPlaces(page, [BERLIN]);
  await mockOpenMeteo(page);
  await page.goto("/");

  await expect(page.getByTestId("weather-dashboard")).toBeVisible();
  const card = page.getByTestId("at-a-glance");
  const dom = card.getByTestId("glance-group-dom");
  await expect(dom.getByTestId("glance-dom-station")).toHaveText("COLOMBO");
  await expect(dom).toContainText("Default station for this place");
  await expect(card).not.toContainText("nearest fresh station");

  const dashboardSelect = page.locator("#glance-station-select");
  await expect(dashboardSelect).toHaveValue("auto");
  await dashboardSelect.selectOption("jaffna");

  await expect(dom.getByTestId("glance-dom-station")).toHaveText("JAFFNA");
  await expect(dom).toContainText("24.0°C");
  await expect(dom).not.toContainText("Default station for this place");
});

test("combined mode keeps a delayed DoM reading separate from a fresh airport report", async ({
  page,
}) => {
  await seedPlaces(page, [COLOMBO]);
  await seedPreferences(page, { glanceSource: "combined" });
  await mockOpenMeteo(page, { observationAgeMinutes: 500 });
  await page.goto("/");

  await expect(page.getByTestId("weather-dashboard")).toBeVisible();
  const card = page.getByTestId("at-a-glance");
  const dom = card.getByTestId("glance-group-dom");
  const metar = card.getByTestId("glance-group-metar");

  await expect(dom.getByTestId("glance-dom-station")).toHaveText("COLOMBO");
  await expect(dom.getByTestId("glance-dom-freshness-badge")).toHaveText("Delayed");
  await expect(dom.getByTestId("glance-dom-observed")).toContainText("8 hrs ago");
  await expect(dom.getByText("Official reading")).toHaveCount(0);

  await expect(metar.getByTestId("glance-metar-station")).toHaveText("RATMALANA");
  await expect(metar.getByTestId("glance-metar-freshness-badge")).toHaveText(
    "Airport report",
  );
  await expect(card).toContainText("not a replacement DoM observation");
});

test("an observation failure is shown honestly and can be retried", async ({ page }) => {
  await seedPlaces(page, [COLOMBO]);
  const state = await mockOpenMeteo(page, { failMeteoJsonTimes: 1 });
  await page.goto("/");

  await expect(page.getByTestId("weather-dashboard")).toBeVisible();
  const card = page.getByTestId("at-a-glance");
  await expect(card).toContainText("DoM reading replaced by a labelled airport fallback");
  await expect(card.getByTestId("glance-metar-station")).toHaveText("RATMALANA");
  expect(state.meteoJsonRequests).toBe(1);
  expect(state.meteoJsonFailures).toBe(1);

  await card
    .getByRole("button", { name: /Retry/ })
    .first()
    .click();
  await expect(card.getByTestId("glance-dom-station")).toHaveText("COLOMBO");
  await expect(card.getByTestId("glance-group-metar")).toHaveCount(0);
  await expect(card).not.toContainText(
    "DoM reading replaced by a labelled airport fallback",
  );
  await expect.poll(() => state.meteoJsonRequests).toBe(2);
  expect(state.meteoJsonFailures).toBe(1);
});

test("an unreachable DoM snapshot falls back to clearly labelled NOAA AWC airport METAR", async ({
  page,
}) => {
  await seedPlaces(page, [COLOMBO]);
  await mockOpenMeteo(page, { officialSource: "metar" });
  await page.goto("/");

  await expect(page.getByTestId("weather-dashboard")).toBeVisible();
  const card = page.getByTestId("at-a-glance");
  const metar = card.getByTestId("glance-group-metar");

  await expect(card).toContainText("DoM reading replaced by a labelled airport fallback");
  await expect(card).toContainText(/not a DoM district reading/i);
  await expect(metar.getByTestId("glance-metar-station")).toHaveText("RATMALANA");
  await expect(metar.getByTestId("glance-metar-freshness-badge")).toHaveText(
    "Airport report",
  );
  await expect(metar).toContainText("VCCC · NOAA AWC METAR");
  await expect(metar).not.toContainText("Rain, last 3 h");
  await expect(card).toContainText(
    "METAR reports do not include a rainfall total",
  );

  const sourceLink = card.getByRole("link", { name: /aviationweather\.gov/i });
  await expect(sourceLink).toHaveAttribute(
    "href",
    "https://aviationweather.gov/data/api/",
  );
});

test("POTTUVIL trace rainfall is shown as trace, not zero or unavailable", async ({
  page,
}) => {
  await seedPlaces(page, [COLOMBO]);
  await seedPreferences(page, { stationId: "pottuvil" });
  await mockOpenMeteo(page);
  await page.goto("/");

  await expect(page.getByTestId("weather-dashboard")).toBeVisible();
  const dom = page.getByTestId("glance-group-dom");
  await expect(dom.getByTestId("glance-dom-station")).toHaveText("POTTUVIL");
  await expect(dom.getByText("Trace", { exact: true })).toBeVisible();
  await expect(dom).toContainText("Below 0.1 mm");
  await expect(dom).not.toContainText("0.0 mm");
});

test("the source selector and metric choices persist across the widget and Preferences", async ({
  page,
}) => {
  await seedPlaces(page, [COLOMBO]);
  await mockOpenMeteo(page);
  await page.goto("/");

  await expect(page.getByTestId("weather-dashboard")).toBeVisible();
  const card = page.getByTestId("at-a-glance");
  await expect(card.getByTestId("glance-group-dom")).toBeVisible();
  await expect(card.getByTestId("glance-group-metar")).toHaveCount(0);

  await card.getByRole("radio", { name: "Both" }).check();
  await expect(card.getByTestId("glance-group-dom")).toBeVisible();
  await expect(card.getByTestId("glance-group-metar")).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        (key) => JSON.parse(window.localStorage.getItem(key) || "{}").glanceSource,
        PREFS_KEY,
      ),
    )
    .toBe("combined");

  // The "On both sources" metric panel is present and limited to six choices.
  await card.getByRole("button", { name: /Metrics/ }).click();
  const checkboxes = card.getByRole("checkbox");
  await expect(checkboxes).toHaveCount(9);
  const checked = await checkboxes.evaluateAll((nodes) =>
    nodes.filter((node) => node.checked).length,
  );
  expect(checked).toBe(3);

  await page.getByRole("button", { name: "Preferences" }).click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.locator('input[name="settings-glance-source"][value="combined"]'),
  ).toBeChecked();
  await expect(
    page.locator('input[name="glance-source"][value="combined"]'),
  ).toBeChecked();

  await page.keyboard.press("Escape");
  await page.reload();
  await expect(page.getByTestId("weather-dashboard")).toBeVisible();
  await expect(page.getByTestId("glance-group-metar")).toBeVisible();
});
