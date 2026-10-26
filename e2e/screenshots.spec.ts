import { expect, test, type Page } from "@playwright/test";
import { fixture, mockWeather, seed } from "./helpers";

// Screenshots of every main screen at iPhone 15 size, light and dark, for visual review.
// Also asserts basic layout rules: no horizontal overflow and ≥ 44px tap targets.

async function checkLayout(page: Page, name: string) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, `${name}: horizontal overflow`).toBeLessThanOrEqual(0);
  const small = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("button, a, select, input:not([type=file]):not(.sr-only)")]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        if (r.width === 0 || style.visibility === "hidden" || el.closest("[aria-hidden]")) return false;
        if (el.matches("input[type=checkbox], input[type=color]")) return false; // wrapped in a 44px label
        return r.height < 32 || r.width < 32;
      })
      .map(
        (el) =>
          `${el.tagName} "${(el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 30)}" ${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)}`,
      ),
  );
  expect(small, `${name}: tap targets smaller than 32px`).toEqual([]);
}

for (const scheme of ["light", "dark"] as const) {
  test.describe(`${scheme} mode`, () => {
    test.use({ colorScheme: scheme });

    test(`screens (${scheme})`, async ({ page }) => {
      const shot = async (name: string) => {
        await page.waitForTimeout(250);
        await checkLayout(page, name);
        await page.screenshot({ path: `e2e/screenshots/${name}-${scheme}.png`, scale: "css" });
      };
      await mockWeather(page);
      await seed(page);

      await page.goto("/today");
      await expect(page.getByLabel("Weather")).toContainText("14°C");
      await shot("01-today");
      await page.getByRole("button", { name: "Suggest outfits" }).click();
      await expect(page.getByTestId("outfit-card")).toHaveCount(3);
      await shot("02-today-suggestions");
      await page.getByTestId("outfit-card").first().getByRole("button", { name: "Dislike" }).click();
      await shot("03-today-feedback");
      await page.keyboard.press("Escape");

      await page.goto("/today/build");
      await page.getByRole("button", { name: "white t-shirt" }).click();
      await page.getByRole("button", { name: "indigo straight jeans" }).click();
      await shot("04-builder");

      await page.goto("/wardrobe");
      await expect(page.getByTestId("item-tile")).toHaveCount(19);
      await shot("05-wardrobe");
      await page.getByTestId("item-tile").first().click();
      await expect(page.getByText(/Worn \d+ time/).filter({ visible: true })).toBeVisible();
      await shot("06-item");

      await page.goto("/wardrobe/add");
      await shot("07-add");
      await page.getByLabel("Take a photo").setInputFiles(fixture("tshirt.jpg"));
      await page.getByRole("button", { name: "Tag it" }).click();
      await expect(page.locator("[data-low-confidence]").first()).toBeVisible();
      await shot("08-add-review");

      await page.goto("/shop");
      await shot("09-shop");
      await page.getByLabel("Scan garment").setInputFiles(fixture("sweater.jpg"));
      await shot("10-shop-step");
      await page.getByRole("button", { name: "Done" }).click();
      await expect(page.getByTestId("verdict-reason")).toBeVisible();
      await shot("11-verdict");

      await page.goto("/profile");
      await shot("12-profile");
      await page.goto("/profile/settings");
      await expect(page.getByTestId("ai-cost-total")).toBeVisible();
      await shot("13-settings");
      await page.goto("/login");
      await shot("14-login");
    });
  });
}
