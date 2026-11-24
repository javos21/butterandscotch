import { expect, test, type Page } from "@playwright/test";
import {
  RECEIPT,
  acceptPolicyAndAllergies,
  addToCart,
  fillContact,
  menuCard,
  trinidadToday,
} from "./helpers";

test("pickup order to proof", async ({ page }) => {
  await page.goto("/");
  await addToCart(page, "Mini Cookie Bag", { flavour: "Half & Half" });
  await addToCart(page, "Red Velvet Cupcakes", { quantity: 2 });

  await page.getByRole("link", { name: /Basket 3/ }).click();
  await expect(page).toHaveURL(/\/checkout$/);

  await fillContact(page);
  await page.getByLabel("Pickup", { exact: true }).check();
  await page.locator('[data-state="available"]').first().click();
  await acceptPolicyAndAllergies(page);
  await page.getByRole("button", { name: "Place order — pay to confirm" }).click();

  await expect(page).toHaveURL(/\/order\//);
  await expect(page.getByText("Your order is not confirmed until we receive and check your payment")).toBeVisible();
  await expect(page.getByText("650.00").first()).toBeVisible();

  await page.getByLabel("Payment receipt").setInputFiles(RECEIPT);
  await page.getByRole("button", { name: "Upload proof" }).click();
  await expect(page.getByText("Payment being checked", { exact: true })).toBeVisible();
});

test("lead time days cannot be picked", async ({ page }) => {
  await page.goto("/");
  await addToCart(page, "Mini Cookie Bag", { flavour: "Half & Half" });
  await page.getByRole("link", { name: /Basket 1/ }).click();
  await expect(page).toHaveURL(/\/checkout$/);

  const todayCell = page.locator(`[data-date="${trinidadToday()}"]`);
  if (!(await todayCell.isVisible())) {
    await page.getByRole("button", { name: "Previous month" }).click();
  }
  await expect(todayCell).toHaveAttribute("data-state", "too_soon");
  // Too-soon days use aria-disabled so they stay tappable for the lead-time note; Playwright
  // treats aria-disabled as not enabled, so the click is forced.
  await todayCell.click({ force: true });
  await expect(page.getByText("We need 5 days to bake this fresh")).toBeVisible();

  await fillContact(page);
  await acceptPolicyAndAllergies(page);
  await page.getByRole("button", { name: "Place order — pay to confirm" }).click();

  await expect(page.getByText("Please choose a date.")).toBeVisible();
  await expect(page).toHaveURL(/\/checkout$/);
  await expect(page.getByText(/^Your date:/)).toHaveCount(0);
});

test("other area waits for a quote", async ({ page }) => {
  await page.goto("/");
  await addToCart(page, "Mini Cookie Bag", { flavour: "Half & Half" });
  await page.getByRole("link", { name: /Basket 1/ }).click();
  await expect(page).toHaveURL(/\/checkout$/);

  await fillContact(page);
  await page.getByLabel("Delivery", { exact: true }).check();
  await page.getByLabel("Delivery area").selectOption({ label: "Other area (we'll contact you)" });
  await page.getByLabel("Delivery address").fill("1 Test Street, Port of Spain");
  await page.locator('[data-state="available"]').first().click();
  await acceptPolicyAndAllergies(page);
  await page.getByRole("button", { name: "Place order — pay to confirm" }).click();

  await expect(page).toHaveURL(/\/order\//);
  await expect(page.getByText("Awaiting delivery quote — we'll email your total")).toBeVisible();
  await expect(page.locator("body")).not.toContainText("Transit");
});

test("item limit across flavours", async ({ page }) => {
  await page.goto("/");
  await addToCart(page, "Cookie Jar", { flavour: "Coconut Butterscotch", quantity: 2 });

  // Still on the jar page: a second flavour cannot be added past the per-order limit of 2.
  await page.locator("label").filter({ hasText: "Half & Half" }).click();
    await expect(page.getByRole("radio", { name: "Half & Half", exact: true })).toBeChecked();
  await expect(page.getByRole("button", { name: "Increase quantity" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Most per order in basket" })).toBeDisabled();
  await expect(page.getByRole("group", { name: "Quantity of Cookie Jar" }).getByText("0", { exact: true })).toBeVisible();

  // The menu card says the same.
  await page.goto("/");
  await expect(menuCard(page, "Cookie Jar").getByText("Most per order (2) in basket")).toBeVisible();
});

test.describe("no horizontal scroll at 375px", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  async function expectFitsWidth(page: Page, label: string) {
    const fits = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    expect(fits, `${label} should not scroll horizontally at 375px`).toBe(true);
  }

  test("menu, checkout and order page fit the screen", async ({ page }) => {
    await page.goto("/");
    await addToCart(page, "Mini Cookie Bag", { flavour: "Half & Half" });
    await expectFitsWidth(page, "menu");

    await page.getByRole("link", { name: /Basket 1/ }).click();
    await expect(page).toHaveURL(/\/checkout$/);
    await expect(page.getByRole("heading", { name: "Your details" })).toBeVisible();
    await expectFitsWidth(page, "checkout");

    await fillContact(page);
    await page.getByLabel("Pickup", { exact: true }).check();
    await page.locator('[data-state="available"]').first().click();
    await acceptPolicyAndAllergies(page);
    await page.getByRole("button", { name: "Place order — pay to confirm" }).click();

    await expect(page).toHaveURL(/\/order\//);
    await expect(page.getByText("Your order is not confirmed until we receive and check your payment")).toBeVisible();
    await expectFitsWidth(page, "order page");
  });
});
