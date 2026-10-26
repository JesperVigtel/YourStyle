import { expect, type Page } from "@playwright/test";
import path from "path";

export const fixture = (name: string) => path.join(__dirname, "fixtures", name);
export const TODAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date());

/** Resets the local database and seeds `count` fixture items (19 = all). */
export async function seed(page: Page, count = 19, wear = true) {
  const res = await page.request.post(`/api/dev/seed?reset=1&count=${count}&wear=${wear ? 1 : 0}&today=${TODAY}`);
  expect(res.ok()).toBeTruthy();
}

/** Open-Meteo is mocked so tests don't depend on the network. */
export async function mockWeather(page: Page) {
  await page.route("https://api.open-meteo.com/**", (route) =>
    route.fulfill({
      json: {
        current: { temperature_2m: 14.2, precipitation: 0, weather_code: 3, wind_speed_10m: 9 },
        daily: { temperature_2m_max: [17], temperature_2m_min: [9], precipitation_probability_max: [40] },
      },
    }),
  );
}
