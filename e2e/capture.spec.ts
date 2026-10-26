import { expect, test } from "@playwright/test";
import { fixture, seed } from "./helpers";

test.beforeEach(async ({ page }) => seed(page, 0));

test("add an item: photo → AI tags (low confidence highlighted) → save → in the grid", async ({ page }) => {
  await page.goto("/wardrobe");
  await expect(page.getByText("No items yet").filter({ visible: true })).toBeVisible();
  await page.getByRole("link", { name: "Add item" }).click();
  await expect(page).toHaveURL(/\/wardrobe\/add/);

  await page.getByLabel("Take a photo").setInputFiles(fixture("tshirt.jpg"));
  await expect(page.getByText("Using original photo").filter({ visible: true })).toBeVisible(); // background removal off in tests
  await page.getByLabel("Add label photo").setInputFiles(fixture("care-label.jpg"));
  await expect(page.getByText("1 label photo added").filter({ visible: true })).toBeVisible();
  await page.getByRole("button", { name: "Tag it" }).click();

  // Pre-filled form, with at least one field flagged for checking
  await expect(page.getByRole("combobox", { name: "Category" })).toBeVisible();
  await expect(page.locator("[data-low-confidence]").first()).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Type" })).not.toHaveValue("");
  await page.getByRole("textbox", { name: "Brand" }).fill("Test Brand");

  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Saved ✓").filter({ visible: true })).toBeVisible();
  await page.getByRole("button", { name: "View item" }).click();
  await expect(page.getByText("Test Brand").filter({ visible: true })).toBeVisible();
  await expect(page.getByText("Worn 0 times").filter({ visible: true })).toBeVisible();

  await page.getByRole("link", { name: "Back" }).click();
  await expect(page.getByTestId("item-tile")).toHaveCount(1);
});

test("'Save & add another' resets the flow for the next garment", async ({ page }) => {
  await page.goto("/wardrobe/add");
  await page.getByLabel("Choose from library").setInputFiles(fixture("jeans.jpg"));
  await page.getByRole("button", { name: "Tag it" }).click();
  await page.getByRole("button", { name: "Save & add another" }).click();
  await expect(page.getByLabel("Take a photo")).toBeAttached();
  const items = await (await page.request.get("/api/items")).json();
  expect(items.items).toHaveLength(1);
  expect(items.items[0].capture_seconds).toBeGreaterThan(0);
});

test("batch mode: pick several photos, review one by one", async ({ page }) => {
  await page.goto("/wardrobe/batch");
  await page
    .getByLabel("Pick photos")
    .setInputFiles([fixture("tshirt.jpg"), fixture("jeans.jpg"), fixture("sweater.jpg")]);
  await expect(page.getByRole("button", { name: /Review 3 items/ })).toBeVisible();
  await page.getByRole("button", { name: /Review 3 items/ }).click();
  await page.getByRole("button", { name: "Save & next" }).click();
  await page.getByRole("button", { name: "Skip" }).click();
  await page.getByRole("button", { name: "Save & next" }).click();
  await expect(page.getByText("2 saved.").filter({ visible: true })).toBeVisible();
  const items = await (await page.request.get("/api/items")).json();
  expect(items.items).toHaveLength(2);
});

test("filters and search narrow the grid; archive moves an item out of 'owned'", async ({ page }) => {
  await seed(page, 19, false);
  await page.goto("/wardrobe");
  await expect(page.getByTestId("item-tile")).toHaveCount(19);
  await page.getByRole("group", { name: "Category" }).getByRole("button", { name: "shoes" }).click();
  await expect(page.getByTestId("item-tile")).toHaveCount(3);
  await page.getByRole("searchbox", { name: "Search" }).fill("chelsea");
  await expect(page.getByTestId("item-tile")).toHaveCount(1);
  await page.getByTestId("item-tile").click();
  await page.getByRole("button", { name: "Archive" }).click();
  await expect(page.getByTestId("status-badge")).toHaveText("archived");
  await page.getByRole("link", { name: "Back" }).click();
  await page.getByRole("searchbox", { name: "Search" }).fill("");
  await page.getByRole("group", { name: "Category" }).getByRole("button", { name: "all" }).click();
  await expect(page.getByTestId("item-tile")).toHaveCount(18);
  await page.getByRole("group", { name: "Status" }).getByRole("button", { name: /^archived/ }).click();
  await expect(page.getByTestId("item-tile")).toHaveCount(1);
});
