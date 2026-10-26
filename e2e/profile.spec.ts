import { expect, test } from "@playwright/test";
import { seed, TODAY } from "./helpers";

test("style profile: my edits survive regeneration", async ({ page }) => {
  await seed(page);
  await page.goto("/profile");
  await expect(page.getByText("No profile yet").filter({ visible: true })).toBeVisible();
  await page.getByLabel("Summary").fill("Minimal, mostly dark colours, one accent.");
  await page.getByRole("list", { name: "Hard rules" }).locator("..").getByRole("button", { name: "+ Add" }).click();
  await page.getByLabel("Hard rules 1").fill("Never pair navy with black");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByText("Edited by me.").filter({ visible: true })).toBeVisible();

  await page.getByRole("button", { name: "Regenerate" }).click();
  await expect(page.getByText(/Last change: Mock/).filter({ visible: true })).toBeVisible();
  await expect(page.getByLabel("Summary")).toHaveValue("Minimal, mostly dark colours, one accent.");
  await expect(page.getByLabel("Hard rules 1")).toHaveValue("Never pair navy with black");
  await expect(page.getByLabel("Soft preferences 1")).toHaveValue(/Prefers muted colours/);

  await page.reload();
  await expect(page.getByLabel("Hard rules 1")).toHaveValue("Never pair navy with black");
});

test("profile regenerates automatically after 10 feedback events", async ({ page }) => {
  await seed(page);
  const body = { mood: "everyday", occasion: null, weather: null, today: TODAY, includeRecent: true };
  for (let i = 0; i < 4; i++) {
    const s = await (await page.request.post("/api/outfits/suggest", { data: body })).json();
    for (const o of s.outfits) {
      await page.request.post("/api/feedback", {
        data: { outfit_id: o.outfit_id, rating: 1, reason_tags: ["love it"] },
      });
    }
  }
  await expect
    .poll(async () => (await (await page.request.get("/api/style-profile")).json()).profile?.summary ?? "", {
      timeout: 10_000,
    })
    .toContain("Mock profile from");
});

test("body profile and moods are editable", async ({ page }) => {
  await seed(page, 0);
  await page.goto("/profile/body");
  await page.getByLabel("Height (cm)").fill("182");
  await page.getByLabel("Fit preferences").fill("Relaxed tops, straight trousers");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("button", { name: "Saved ✓" })).toBeVisible();
  const body = await (await page.request.get("/api/body-profile")).json();
  expect(body.body).toMatchObject({ height_cm: 182, fit_preferences: "Relaxed tops, straight trousers" });

  await page.goto("/profile/moods");
  await expect(page.getByLabel("Mood name")).toHaveCount(6);
  await page.getByRole("button", { name: "+ Add mood" }).click();
  await page.getByLabel("Mood name").last().fill("rainy day");
  await page.getByLabel("Mood description").last().fill("Waterproof, dark, practical.");
  await page.getByRole("button", { name: "Save moods" }).click();
  await expect(page.getByRole("button", { name: "Saved ✓" })).toBeVisible();
  await page.goto("/today");
  await expect(page.getByRole("group", { name: "Mood" }).getByRole("button", { name: "rainy day" })).toBeVisible();
});

test("settings shows AI cost for the month", async ({ page }) => {
  await seed(page);
  await page.request.post("/api/outfits/suggest", {
    data: { mood: "comfy", occasion: null, weather: null, today: TODAY },
  });
  await page.goto("/profile/settings");
  await expect(page.getByTestId("ai-cost-total")).toHaveText("$0.000");
  await expect(page.getByText("suggestOutfits").filter({ visible: true })).toBeVisible();
  await expect(page.getByText("mock (no API calls)").filter({ visible: true })).toBeVisible();
});
