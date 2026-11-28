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
  await addToCart(page, "Mini Cookie Bag", { flavour: "Mix of all 3 flavours" });
  await addToCart(page, "Red Velvet Cupcakes", { quantity: 2 });

  await page.getByRole("link", { name: /Basket 3/ }).click();
  await expect(page).toHaveURL(/\/checkout$/);

  await fillContact(page);
  await page.getByLabel("Pickup", { exact: true }).check();
  await page.getByLabel("Pickup location").selectOption("West");
  await page.locator('[data-state="available"]').first().click();
  await acceptPolicyAndAllergies(page);
  await page.getByRole("button", { name: "Place Order" }).click();

  await expect(page).toHaveURL(/\/order\//);
  await expect(page.getByText("Your order is not confirmed until we have received and approved your payment.")).toBeVisible();
  await expect(page.getByText("650.00").first()).toBeVisible();

  await page.getByLabel("Payment receipt").setInputFiles(RECEIPT);
  await page.getByRole("button", { name: "Upload proof" }).click();
  await expect(page.getByText("Payment being checked", { exact: true })).toBeVisible();
});

test("lead time days cannot be picked", async ({ page }) => {
  await page.goto("/");
  await addToCart(page, "Mini Cookie Bag", { flavour: "Mix of all 3 flavours" });
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
  await page.getByLabel("Pickup location").selectOption("West");
  await acceptPolicyAndAllergies(page);
  await page.getByRole("button", { name: "Place Order" }).click();

  await expect(page.getByText("Please choose a date.")).toBeVisible();
  await expect(page).toHaveURL(/\/checkout$/);
  await expect(page.getByText(/^Your date:/)).toHaveCount(0);
});

test("a delivery order shows the delivery note and no fee", async ({ page }) => {
  await page.goto("/");
  await addToCart(page, "Mini Cookie Bag", { flavour: "Mix of all 3 flavours" });
  await page.getByRole("link", { name: /Basket 1/ }).click();
  await expect(page).toHaveURL(/\/checkout$/);

  await fillContact(page);
  await page.getByLabel("Delivery", { exact: true }).check();
  await page.getByLabel("Delivery address").fill("1 Test Street, Port of Spain");
  await page.locator('[data-state="available"]').first().click();
  await acceptPolicyAndAllergies(page);
  await page.getByRole("button", { name: "Place Order" }).click();

  await expect(page).toHaveURL(/\/order\//);
  await expect(page.getByText("Once your order is confirmed we will contact you with your total delivery amount.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pay by bank transfer" })).toBeVisible();
  await expect(page.getByText("Delivery fee", { exact: true })).toHaveCount(0);
});

test("item limit across flavours", async ({ page }) => {
  await addToCart(page, "Cookie Jar", { flavour: "Coconut Butterscotch", quantity: 6 });
  await addToCart(page, "Cookie Jar", { flavour: "Red Velvet", quantity: 4 });

  // The limit (10) counts across flavour lines: the basket is full for this item, so the card says
  // so and offers no Add button.
  const jar = menuCard(page, "Cookie Jar");
  await expect(jar.getByText("Most per order (10) in basket")).toBeVisible();
  await expect(jar.getByRole("button", { name: "Add Cookie Jar to basket" })).toHaveCount(0);
});

test.describe("no horizontal scroll at 375px", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  async function expectFitsWidth(page: Page, label: string) {
    const fits = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    expect(fits, `${label} should not scroll horizontally at 375px`).toBe(true);
  }

  test("menu, checkout and order page fit the screen", async ({ page }) => {
    await page.goto("/");
    await addToCart(page, "Mini Cookie Bag", { flavour: "Mix of all 3 flavours" });
    await expectFitsWidth(page, "menu");

    await page.getByRole("link", { name: /Basket 1/ }).click();
    await expect(page).toHaveURL(/\/checkout$/);
    await expect(page.getByRole("heading", { name: "Your details" })).toBeVisible();
    await expectFitsWidth(page, "checkout");

    await fillContact(page);
    await page.getByLabel("Pickup", { exact: true }).check();
    await page.getByLabel("Pickup location").selectOption("West");
    await page.locator('[data-state="available"]').first().click();
    await acceptPolicyAndAllergies(page);
    await page.getByRole("button", { name: "Place Order" }).click();

    await expect(page).toHaveURL(/\/order\//);
    await expect(page.getByText("Your order is not confirmed until we have received and approved your payment.")).toBeVisible();
    await expectFitsWidth(page, "order page");
  });
});
