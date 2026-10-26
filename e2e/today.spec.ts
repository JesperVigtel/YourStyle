import { expect, test } from "@playwright/test";
import { mockWeather, seed, TODAY } from "./helpers";

test.beforeEach(async ({ page }) => mockWeather(page));

test("suggest → wear (one tap) → 👎 with reason → swap one item", async ({ page }) => {
  await seed(page);
  await page.goto("/today");
  await expect(page.getByLabel("Weather")).toContainText("14°C");
  await page.getByRole("group", { name: "Mood" }).getByRole("button", { name: "smart/formal" }).click();
  await page.getByRole("group", { name: "Occasion" }).getByRole("button", { name: "dinner" }).click();
  await expect(page.getByRole("textbox", { name: "Occasion" })).toHaveValue("dinner");

  await page.getByRole("button", { name: "Suggest outfits" }).click();
  await expect(page.getByLabel("Loading suggestions")).toBeVisible();
  const cards = page.getByTestId("outfit-card");
  await expect(cards).toHaveCount(3);
  await expect(page.getByText(/Skipping 3 item\(s\) worn in the last 3 days/).filter({ visible: true })).toBeVisible();
  await expect(cards.first()).toContainText("smart/formal look for dinner");

  // One tap to log
  await cards.nth(0).getByRole("button", { name: "Wear this" }).click();
  await expect(cards.nth(0).getByRole("button", { name: "✓ Logged for today" })).toBeVisible();

  // 👎 with a reason
  await cards.nth(1).getByRole("button", { name: "Dislike" }).click();
  const sheet = page.getByRole("dialog", { name: "What's off?" });
  await sheet.getByRole("button", { name: "too formal" }).click();
  await sheet.getByLabel("Comment").fill("Too stiff for a casual dinner");
  await sheet.getByRole("button", { name: "Save feedback" }).click();
  await expect(sheet).toBeHidden();
  await expect(cards.nth(1).getByRole("button", { name: "Dislike" })).toHaveAttribute("aria-pressed", "true");

  // Swap: tap swap, then the item to replace
  const card = cards.nth(2);
  const srcs = () => card.getByRole("img").evaluateAll((imgs) => imgs.map((i) => i.getAttribute("src")).join());
  const original = await srcs();
  await card.getByRole("button", { name: "Swap one item" }).click();
  await expect(card.getByText("Tap the item you want to swap")).toBeVisible();
  const selectable = card.getByRole("button", { name: /^Select / });
  expect(await selectable.count()).toBeGreaterThan(1);
  await selectable.first().click();
  await expect(card).toContainText("Swap:");
  expect(await srcs()).not.toBe(original);

  // Persisted: wear log + feedback
  const wear = await (await page.request.get("/api/outfits")).json();
  expect(wear.outfits.some((o: { worn_on: string | null }) => o.worn_on === TODAY)).toBe(true);
  const rated = await (await page.request.get("/api/outfits?rated=1")).json();
  expect(rated.outfits[0].feedback).toMatchObject({ rating: -1, reason_tags: ["too formal"] });
});

test("a 👎 combination is never suggested again unchanged", async ({ page }) => {
  await seed(page);
  const body = { mood: "everyday", occasion: "uni", weather: { temp_c: 14 }, today: TODAY, includeRecent: false };
  const first = await (await page.request.post("/api/outfits/suggest", { data: body })).json();
  const disliked = first.outfits[0];
  await page.request.post("/api/feedback", {
    data: { outfit_id: disliked.outfit_id, rating: -1, reason_tags: ["not me"] },
  });
  const key = (ids: string[]) => [...ids].sort().join("|");
  for (let i = 0; i < 3; i++) {
    const again = await (await page.request.post("/api/outfits/suggest", { data: body })).json();
    for (const o of again.outfits) expect(key(o.item_ids)).not.toBe(key(disliked.item_ids));
  }
});

test("with fewer than 15 items the app asks for more instead of suggesting", async ({ page }) => {
  await seed(page, 6, false);
  await page.goto("/today");
  await page.getByRole("button", { name: "Suggest outfits" }).click();
  await expect(page.getByText("Add a few more items first").filter({ visible: true })).toBeVisible();
  await expect(page.getByText(/You have 6 items registered/).filter({ visible: true })).toBeVisible();
  await expect(page.getByTestId("outfit-card")).toHaveCount(0);
});

test("weather can be overridden", async ({ page }) => {
  await seed(page, 0);
  await page.goto("/today");
  await page.getByLabel("Weather").click();
  const sheet = page.getByRole("dialog", { name: "Weather" });
  await sheet.getByLabel("Temperature").fill("3");
  await sheet.getByRole("button", { name: "Rain" }).click();
  await sheet.getByRole("button", { name: "Use this weather" }).click();
  await expect(page.getByLabel("Weather")).toContainText("3°C");
  await expect(page.getByLabel("Weather")).toContainText("edited");
});

test("manual outfit builder logs today's outfit", async ({ page }) => {
  await seed(page);
  await page.goto("/today/build");
  await page.getByRole("button", { name: "black t-shirt" }).click();
  await page.getByRole("button", { name: "black tailored trousers" }).click();
  await page.getByRole("button", { name: "black derby shoes" }).click();
  await page.getByRole("button", { name: "Wear today" }).click();
  await expect(page.getByText("Logged as today's outfit.").filter({ visible: true })).toBeVisible();
});
