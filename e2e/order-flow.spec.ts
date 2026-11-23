import path from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";

const PHONE = "868 555 0101";
const RECEIPT = path.join(__dirname, "fixtures", "receipt.png");

/** Today's date in Trinidad as "YYYY-MM-DD", matching the server's calendar. */
function trinidadToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Port_of_Spain",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** The menu card for one item, found by its heading. */
function menuCard(page: Page, name: string): Locator {
  return page.getByRole("article").filter({ has: page.getByRole("heading", { name, exact: true }) });
}

/** Waits until React has hydrated the page, so clicks and selects are not reset by the first render. */
async function waitForHydration(page: Page) {
  await page.waitForFunction(() =>
    Array.from(document.querySelectorAll("button")).some((button) =>
      Object.keys(button).some((key) => key.startsWith("__reactProps")),
    ),
  );
}

/** Adds an item to the cart with an optional flavour and quantity, then waits for the toast. */
async function addToCart(page: Page, name: string, options: { flavour?: string; quantity?: number } = {}) {
  await waitForHydration(page);
  const card = menuCard(page, name);
  if (options.flavour) {
    await card.getByLabel("Flavour").selectOption(options.flavour);
  }
  for (let i = 1; i < (options.quantity ?? 1); i++) {
    await card.getByRole("button", { name: "Increase quantity" }).click();
  }
  await card.getByRole("button", { name: "Add to cart" }).click();
  await expect(page.getByText(`Added ${name} to your cart`)).toBeVisible();
}

async function fillContact(page: Page) {
  await page.getByLabel("Name", { exact: true }).fill("Test Customer");
  await page.getByLabel("Email", { exact: true }).fill("customer@example.test");
  await page.getByLabel("WhatsApp number").fill(PHONE);
}

async function acceptPolicyAndAllergies(page: Page) {
  await page.getByLabel("Allergies or dietary needs", { exact: true }).fill("None");
  await page.getByRole("checkbox", { name: "I have read and accept the order policy" }).check();
}

test("pickup order to proof", async ({ page }) => {
  await page.goto("/");
  await addToCart(page, "Mini Cookie Bag", { flavour: "Half & Half" });
  await addToCart(page, "Red Velvet Cupcakes", { quantity: 2 });

  await page.getByRole("link", { name: /Cart \(3\)/ }).click();
  await expect(page).toHaveURL(/\/checkout$/);

  await fillContact(page);
  await page.getByLabel("Pickup", { exact: true }).check();
  await page.locator('[data-state="available"]').first().click();
  await acceptPolicyAndAllergies(page);
  await page.getByRole("button", { name: "Place order — pay to confirm" }).click();

  await expect(page).toHaveURL(/\/order\//);
  await expect(page.getByText("Your order is not confirmed until we receive and check your payment")).toBeVisible();
  await expect(page.getByText("TT$650.00").first()).toBeVisible();

  await page.getByLabel("Payment receipt").setInputFiles(RECEIPT);
  await page.getByRole("button", { name: "Upload proof" }).click();
  await expect(page.getByText("Payment being checked", { exact: true })).toBeVisible();
});

test("lead time days cannot be picked", async ({ page }) => {
  await page.goto("/");
  await addToCart(page, "Mini Cookie Bag", { flavour: "Half & Half" });
  await page.getByRole("link", { name: /Cart \(1\)/ }).click();
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
  await page.getByRole("link", { name: /Cart \(1\)/ }).click();
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

  const jar = menuCard(page, "Cookie Jar");
  await jar.getByLabel("Flavour").selectOption("Half & Half");
  await expect(jar.getByRole("button", { name: "Increase quantity" })).toBeDisabled();
  await expect(jar.getByRole("button", { name: "Add to cart" })).toBeDisabled();
  await expect(jar.getByText("0", { exact: true })).toBeVisible();
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

    await page.getByRole("link", { name: /Cart \(1\)/ }).click();
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
