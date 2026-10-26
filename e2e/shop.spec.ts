import { expect, test } from "@playwright/test";
import { fixture, seed } from "./helpers";

test.beforeEach(async ({ page }) => seed(page));

test("guided scan → verdict in seconds → 'I bought it' → owned item", async ({ page }) => {
  await page.goto("/shop");
  await page
    .getByRole("group", { name: "Where are you?" })
    .getByRole("button", { name: "Vintage / second-hand" })
    .click();
  const started = Date.now();
  await page.getByLabel("Scan garment").setInputFiles(fixture("sweater.jpg"));

  // Step 2: brand label — skip it
  await expect(page.getByLabel("Photo of Brand label")).toBeAttached();
  await page.getByRole("button", { name: "Skip" }).click();
  // Step 3: size/care label
  await page.getByLabel("Photo of Size / care label").setInputFiles(fixture("care-label.jpg"));
  // Step 4: price tag — Done is always available
  await expect(page.getByLabel("Photo of Price tag")).toBeAttached();
  await page.getByRole("button", { name: "Done" }).click();

  await expect(page).toHaveURL(/\/shop\/[0-9a-f-]{36}/);
  await expect(page.getByTestId("verdict-reason")).toBeVisible();
  expect(Date.now() - started).toBeLessThan(10_000);
  await expect(page.getByTestId("verdict-badge").filter({ visible: true })).toHaveText("buy");
  await expect(page.getByText("Acne Studios").filter({ visible: true })).toBeVisible();
  await expect(page.getByText(/new outfits? with what you own/).filter({ visible: true })).toBeVisible();
  await expect(page.getByText("You already own something similar").filter({ visible: true })).toBeVisible();
  await expect(page.getByText("Price sanity (rough estimate)").filter({ visible: true })).toBeVisible();

  await page.getByRole("button", { name: "Wishlist" }).click();
  await expect(page.getByRole("button", { name: "✓ Wishlist" })).toBeVisible();
  await page.getByLabel("Price paid").fill("45");
  await page.getByRole("button", { name: "I bought it" }).click();
  await expect(page.getByText("Bought ✓").filter({ visible: true })).toBeVisible();

  const { items } = await (await page.request.get("/api/items")).json();
  const bought = items.filter((i: { brand: string }) => i.brand === "Acne Studios");
  expect(bought).toHaveLength(1); // the wishlist item was converted, not duplicated
  expect(bought[0]).toMatchObject({ status: "owned", price: 45, source: "vintage", material: "100% wool" });

  await page.getByRole("link", { name: "Open item" }).click();
  await expect(page.getByText("Acne Studios").filter({ visible: true })).toBeVisible();
});

test("offline: scan is queued, shown as pending, and processed when back online", async ({ page, context }) => {
  await page.goto("/shop");
  await expect(page.getByLabel("Scan garment")).toBeAttached();
  await context.setOffline(true);

  await page.getByLabel("Scan garment").setInputFiles(fixture("sweater.jpg"));
  await page.getByLabel("Photo of Brand label").setInputFiles(fixture("brand-label.jpg"));
  await page.getByRole("button", { name: "Done" }).click();

  await expect(page.getByRole("status")).toContainText("No signal");
  await expect(page.getByTestId("pending-scan")).toHaveCount(1);
  await expect(page.getByTestId("pending-scan")).toContainText("2 photos");
  // Nothing reached the server
  await context.setOffline(false);
  const before = await (await page.request.get("/api/scans")).json();
  expect(before.scans).toHaveLength(0);
  await context.setOffline(true);

  // Back online → the queue drains automatically
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.getByTestId("pending-scan")).toHaveCount(0, { timeout: 15_000 });
  await expect(page.getByRole("link", { name: /Acne Studios/ })).toBeVisible();
  const after = await (await page.request.get("/api/scans")).json();
  expect(after.scans).toHaveLength(1);
  expect(after.scans[0]).toMatchObject({ status: "done", photo_kinds: ["garment", "brand"] });
});

test("web-shop screenshot goes through the same evaluation", async ({ page }) => {
  await page.goto("/shop");
  await page.getByLabel("Upload screenshot").setInputFiles(fixture("screenshot.jpg"));
  await expect(page).toHaveURL(/\/shop\/[0-9a-f-]{36}/);
  await expect(page.getByTestId("verdict-reason")).toBeVisible();
  const { scans } = await (await page.request.get("/api/scans")).json();
  expect(scans[0]).toMatchObject({ source: "online", photo_kinds: ["screenshot"] });
});

test("the Shop tab opens with no signal (service worker shell)", async ({ page, context }) => {
  await page.goto("/shop");
  await page.waitForFunction(async () => {
    const reg = await navigator.serviceWorker?.getRegistration();
    return !!reg?.active;
  });
  await page.reload(); // now controlled by the worker, which caches the page
  await expect(page.getByLabel("Scan garment")).toBeAttached();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByLabel("Scan garment")).toBeAttached();
  await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();

  // Opening the app offline (start URL /today) and switching to the Shop tab also works.
  await page.goto("/today").catch(() => undefined);
  await expect(page.getByRole("button", { name: "Suggest outfits" })).toBeVisible();
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Shop" }).click();
  await expect(page.getByLabel("Scan garment")).toBeAttached();
  await context.setOffline(false);
});
