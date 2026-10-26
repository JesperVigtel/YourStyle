import { expect, test } from "@playwright/test";
import { readFileSync } from "fs";
import { fixture, seed } from "./helpers";

// Regression checks for issues found in code review (API level).

test("moods: swapping two names in one save works", async ({ page }) => {
  await seed(page, 0);
  const { moods } = await (await page.request.get("/api/moods")).json();
  const [a, b, ...rest] = moods;
  const res = await page.request.put("/api/moods", {
    data: { moods: [{ ...a, name: b.name }, { ...b, name: a.name }, ...rest] },
  });
  expect(res.ok()).toBeTruthy();
  const names = (await res.json()).moods.map((m: { name: string }) => m.name);
  expect(names.slice(0, 2)).toEqual([b.name, a.name]);
  expect(names).toHaveLength(moods.length);
});

test("style profile: saving rules with an empty summary still lets the AI write one", async ({ page }) => {
  await seed(page);
  await page.request.put("/api/style-profile", {
    data: { summary: "", hard_rules: [{ text: "Never wear neon", source: "user" }], soft_preferences: [] },
  });
  const { profile } = await (await page.request.post("/api/style-profile/regenerate")).json();
  expect(profile.summary).toContain("Mock profile");
  expect(profile.hard_rules[0]).toEqual({ text: "Never wear neon", source: "user" });
});

test("scans: uploading the same scan twice evaluates and stores it once", async ({ page }) => {
  await seed(page);
  const id = crypto.randomUUID();
  const form = () => ({
    multipart: {
      id,
      source: "store",
      kind: "garment",
      photo: { name: "g.jpg", mimeType: "image/jpeg", buffer: readFileSync(fixture("sweater.jpg")) },
    },
  });
  const [r1, r2] = await Promise.all([page.request.post("/api/scans", form()), page.request.post("/api/scans", form())]);
  expect(r1.ok() && r2.ok()).toBeTruthy();
  const { scans } = await (await page.request.get("/api/scans")).json();
  expect(scans).toHaveLength(1);
  await expect.poll(async () => (await (await page.request.get(`/api/scans/${id}`)).json()).scan.status).toBe("done");
  const costs = await (await page.request.get("/api/costs")).json();
  expect(costs.byTask.evaluatePurchase.calls).toBe(1);
});
