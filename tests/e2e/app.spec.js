import { test, expect } from "@playwright/test";
import { mockOpenMeteo, PREFS_KEY, PLACES_KEY, seedPlaces } from "./helpers";
import { BERLIN } from "../fixtures/weather";

test("onboarding search loads a complete forecast and refreshes", async ({ page }) => {
  const state = await mockOpenMeteo(page);
  await page.goto("/");

  await expect(page.getByTestId("onboarding")).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 1, name: /Weather, in colour/i }),
  ).toBeVisible();
  const search = page.getByRole("combobox", { name: /search for a city/i });
  await expect(search).toBeVisible();

  // Exercise the keyboard path through the combobox.
  await search.fill("Berlin");
  await page.getByRole("option", { name: /Berlin/ }).waitFor();
  await search.press("ArrowDown");
  await search.press("Enter");

  await expect(page.getByTestId("weather-dashboard")).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 1, name: /Weather forecast for Berlin/i }),
  ).toBeAttached();
  await expect(page.getByTestId("current-temperature")).toContainText(
    "Current temperature 13 degrees Celsius",
  );
  await expect(page.getByTestId("hourly-forecast").getByRole("listitem")).toHaveCount(24);
  await expect(page.getByTestId("daily-forecast").getByRole("button")).toHaveCount(7);
  await expect(page.getByTestId("sun-card")).toContainText("Total daylight");
  await expect(page.getByTestId("atmosphere-card")).toContainText("Humidity");
  await expect(page).toHaveTitle(/Berlin — Weather · Aeris/);
  await expect(
    page.getByRole("button", { name: /Berlin.*Change location/i }),
  ).toBeVisible();

  const places = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), PLACES_KEY);
  expect(places.saved).toHaveLength(1);
  expect(places.saved[0].name).toBe("Berlin");
  expect(places.saved[0].latitude).toBe(52.52);

  // Open a day detail dialog and close it with the keyboard.
  await page.getByTestId("daily-forecast").getByRole("button").first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Chance of rain")).toBeVisible();
  await expect(dialog.getByText("UV index")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  expect(state.weatherRequests).toBe(1);
  await page.getByRole("button", { name: /Refresh weather/ }).click();
  await expect.poll(() => state.weatherRequests).toBe(2);
  await expect(page.getByTestId("weather-dashboard")).toBeVisible();
});

test("shows a loading skeleton while the first forecast is in flight", async ({ page }) => {
  await seedPlaces(page, [BERLIN]);
  await mockOpenMeteo(page, { weatherDelayMs: 1_200 });
  await page.goto("/");

  const skeleton = page.getByRole("status").filter({ hasText: "Loading weather for Berlin" });
  await expect(skeleton).toBeVisible();
  await expect(page.locator("#main-content")).toHaveAttribute("aria-busy", "true");
  await expect(page.getByTestId("weather-dashboard")).toBeVisible({ timeout: 10_000 });
  await expect(page.locator("#main-content")).toHaveAttribute("aria-busy", "false");
});

test("a failed refresh keeps the last forecast and can be retried", async ({ page }) => {
  await seedPlaces(page, [BERLIN]);
  const state = await mockOpenMeteo(page, { failWeatherAfter: 1, failWeatherCount: 1 });
  await page.goto("/");
  await expect(page.getByTestId("weather-dashboard")).toBeVisible();

  await page.getByRole("button", { name: /Refresh weather/ }).click();
  const banner = page.getByRole("alert").filter({ hasText: "Couldn't refresh." });
  await expect(banner).toBeVisible();
  await expect(banner).toContainText("Showing the last forecast");
  await expect(page.getByTestId("current-temperature")).toBeVisible();
  expect(state.weatherRequests).toBe(2);
  expect(state.weatherFailures).toBe(1);

  await banner.getByRole("button", { name: "Try again" }).click();
  await expect(banner).toBeHidden();
  await expect(page.getByTestId("weather-dashboard")).toBeVisible();
  await expect.poll(() => state.weatherSuccesses).toBe(2);
});

test("opening a place dialog shows saved places and summary", async ({ page }) => {
  await seedPlaces(page, [BERLIN]);
  await mockOpenMeteo(page);
  await page.goto("/");
  await expect(page.getByTestId("weather-dashboard")).toBeVisible();

  await page.getByRole("button", { name: /Change location/i }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Saved places")).toBeVisible();
  await expect(dialog.getByText("1 / 20")).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: /Berlin.*Land Berlin.*Germany/i }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("units and theme persist after a reload", async ({ page }) => {
  await seedPlaces(page, [BERLIN]);
  await mockOpenMeteo(page);
  await page.goto("/");
  await expect(page.getByTestId("weather-dashboard")).toBeVisible();

  await page.getByRole("button", { name: "Preferences" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByText("°F", { exact: true }).click();
  await dialog.getByText("mph", { exact: true }).click();
  await dialog.getByText("Dark", { exact: true }).click();
  await expect(dialog.getByRole("radio", { name: "°F" })).toBeChecked();
  await expect(dialog.getByRole("radio", { name: "mph" })).toBeChecked();
  await expect(dialog.getByRole("radio", { name: "Dark" })).toBeChecked();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  await expect(page.getByTestId("current-temperature")).toContainText(
    "Current temperature 56 degrees Fahrenheit",
  );
  await expect(page.getByText(/mph wind/)).toBeVisible();

  const preferences = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), PREFS_KEY);
  expect(preferences).toMatchObject({
    theme: "dark",
    temperatureUnit: "f",
    windUnit: "mph",
  });

  await page.reload();
  await expect(page.getByTestId("weather-dashboard")).toBeVisible();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(page.getByTestId("current-temperature")).toContainText(
    "56 degrees Fahrenheit",
  );

  await page.getByRole("button", { name: "Preferences" }).click();
  const reopened = page.getByRole("dialog");
  await expect(reopened.getByRole("radio", { name: "°F" })).toBeChecked();
  await expect(reopened.getByRole("radio", { name: "mph" })).toBeChecked();
  await expect(reopened.getByRole("radio", { name: "Dark" })).toBeChecked();
});

test("switching cities and removing a saved place updates storage", async ({ page }) => {
  await seedPlaces(page, [BERLIN]);
  const state = await mockOpenMeteo(page);
  await page.goto("/");
  await expect(page.getByTestId("weather-dashboard")).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Berlin.*Change location/i }),
  ).toBeVisible();

  await page.getByRole("button", { name: /Change location/i }).click();
  await page.getByRole("combobox", { name: /search for a city/i }).fill("Lisbon");
  await page.getByRole("option", { name: /Lisbon/ }).click();

  await expect(
    page.getByRole("button", { name: /Lisbon.*Change location/i }),
  ).toBeVisible();
  await expect(page.getByTestId("weather-dashboard")).toBeVisible();
  await expect.poll(() => state.weatherRequests).toBe(2);

  let places = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), PLACES_KEY);
  expect(places.saved.map((place) => place.name)).toEqual(["Berlin", "Lisbon"]);
  expect(places.activeId).toBe("2267057");

  await page.getByRole("button", { name: /Change location/i }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Remove Berlin from saved places" }).click();
  await expect(dialog.getByText("1 / 20")).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Remove Berlin from saved places" }),
  ).toHaveCount(0);

  places = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), PLACES_KEY);
  expect(places.saved.map((place) => place.name)).toEqual(["Lisbon"]);
  expect(places.activeId).toBe("2267057");
});

test("initial weather error can be retried", async ({ page }) => {
  await seedPlaces(page, [BERLIN]);
  const state = await mockOpenMeteo(page, { failWeatherTimes: 1 });
  await page.goto("/");

  const error = page.getByTestId("weather-error");
  await expect(error).toBeVisible();
  await expect(error).toContainText(/temporarily unavailable/i);
  await expect(error).toContainText("Berlin");
  expect(state.weatherRequests).toBe(1);

  await error.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByTestId("weather-dashboard")).toBeVisible();
  await expect.poll(() => state.weatherRequests).toBe(2);
});

test("offline state keeps the last forecast and recovers", async ({ page, context }) => {
  await seedPlaces(page, [BERLIN]);
  const state = await mockOpenMeteo(page);
  await page.goto("/");
  await expect(page.getByTestId("weather-dashboard")).toBeVisible();

  await context.setOffline(true);
  await expect(page.getByText("You're offline")).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Refresh unavailable offline/ }),
  ).toBeDisabled();

  await context.setOffline(false);
  await expect(page.getByText("You're offline")).toBeHidden();
  await expect.poll(() => state.weatherRequests).toBeGreaterThanOrEqual(2);
});

test.describe("geolocation", () => {
  test.use({
    geolocation: { latitude: 40.7128, longitude: -74.006 },
    permissions: ["geolocation"],
  });

  test("uses the current position for one session without saving it", async ({ page }) => {
    await mockOpenMeteo(page);
    await page.goto("/");
    await expect(page.getByTestId("onboarding")).toBeVisible();

    await page.getByRole("button", { name: "Use my location" }).click();
    await expect(page.getByTestId("weather-dashboard")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Current location.*Change location/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 1, name: /Weather forecast for Current location/i }),
    ).toBeAttached();

    const places = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), PLACES_KEY);
    expect(places.saved).toHaveLength(0);

    // Current-location coordinates stay in session storage for this tab, so a
    // reload keeps the forecast without adding it to the saved-places list.
    await page.reload();
    await expect(page.getByTestId("weather-dashboard")).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 1, name: /Weather forecast for Current location/i }),
    ).toBeAttached();
    const restoredPlaces = await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)),
      PLACES_KEY,
    );
    expect(restoredPlaces.saved).toHaveLength(0);
  });
});

test("shows a helpful empty search state", async ({ page }) => {
  await mockOpenMeteo(page);
  await page.goto("/");
  await page.getByRole("combobox", { name: /search for a city/i }).fill("Zzzzzz");
  await expect(page.getByText(/No places found for “Zzzzzz”/)).toBeVisible();
  await expect(page.getByText(/Try a nearby town/)).toBeVisible();
});
