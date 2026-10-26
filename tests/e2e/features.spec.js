import { test, expect } from "@playwright/test";
import {
  mockOpenMeteo,
  PREFS_KEY,
  seedPlaces,
} from "./helpers";
import { BERLIN } from "../fixtures/weather";

test("NASA satellite imagery is labelled, timestamped, and switchable", async ({ page }) => {
  await seedPlaces(page, [BERLIN]);
  const state = await mockOpenMeteo(page);
  await page.goto("/");

  await expect(page.getByTestId("weather-dashboard")).toBeVisible();
  const card = page.getByTestId("satellite-card");
  await expect(
    card.getByRole("img", { name: /Himawari-9 infrared satellite imagery/i }),
  ).toBeVisible();
  await expect(card).toContainText("NASA EOSDIS GIBS");
  await expect(card).toContainText("Sri Lanka time");
  await expect(card).toContainText("not a Department of Meteorology observation");
  expect(state.satelliteMetadataRequests).toBeGreaterThanOrEqual(1);
  expect(state.satelliteImageRequests).toBeGreaterThanOrEqual(1);

  await card.getByRole("button", { name: "True colour" }).click();
  await expect(
    card.getByRole("img", { name: /VIIRS natural-colour satellite imagery/i }),
  ).toBeVisible();
  await expect(card).toContainText("Natural colour");
});

test.describe("weather notifications", () => {
  test.use({ permissions: ["notifications"] });

  test("the notification preference is opt-in, persisted, and local", async ({ page }) => {
    await seedPlaces(page, [BERLIN]);
    await mockOpenMeteo(page);
    await page.goto("/");
    await expect(page.getByTestId("weather-dashboard")).toBeVisible();

    await page.getByRole("button", { name: "Preferences" }).click();
    const dialog = page.getByRole("dialog");
    const toggle = dialog.getByRole("switch", {
      name: /Rain and storm notifications/i,
    });
    await expect(toggle).not.toBeChecked();
    await expect(dialog).toContainText("Nothing is sent to a server");

    await toggle.click();
    await expect(toggle).toBeChecked();
    await expect(dialog).toContainText("Notifications are on for this browser");
    await expect
      .poll(() =>
        page.evaluate(
          (key) => JSON.parse(window.localStorage.getItem(key) || "{}").weatherNotifications,
          PREFS_KEY,
        ),
      )
      .toBe(true);

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await page.reload();
    await expect(page.getByTestId("weather-dashboard")).toBeVisible();
    await page.getByRole("button", { name: "Preferences" }).click();
    const reopened = page.getByRole("dialog");
    const persisted = reopened.getByRole("switch", {
      name: /Rain and storm notifications/i,
    });
    await expect(persisted).toBeChecked();

    await persisted.click();
    await expect(persisted).not.toBeChecked();
    await expect
      .poll(() =>
        page.evaluate(
          (key) => JSON.parse(window.localStorage.getItem(key) || "{}").weatherNotifications,
          PREFS_KEY,
        ),
      )
      .toBe(false);
  });
});
