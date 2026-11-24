import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, type Locator, type Page } from "@playwright/test";

export const PHONE = "868 555 0101";
export const RECEIPT = path.join(__dirname, "fixtures", "receipt.png");

export type PlacedOrder = { orderNumber: string; token: string };

/** Today's date in Trinidad as "YYYY-MM-DD", matching the server's calendar. */
export function trinidadToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Port_of_Spain",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** The ISO date `days` after today in Trinidad. */
export function trinidadDaysFromToday(days: number): string {
  const [year, month, day] = trinidadToday().split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/** The menu card for one item, found by its heading. */
export function menuCard(page: Page, name: string): Locator {
  return page.getByRole("article").filter({ has: page.getByRole("heading", { name, exact: true }) });
}

/** Waits until React has hydrated the page, so clicks and selects are not reset by the first render. */
export async function waitForHydration(page: Page) {
  await page.waitForFunction(() =>
    Array.from(document.querySelectorAll("button")).some((button) =>
      Object.keys(button).some((key) => key.startsWith("__reactProps")),
    ),
  );
}

/** Adds an item to the cart with an optional flavour and quantity, then waits for the toast. */
export async function addToCart(page: Page, name: string, options: { flavour?: string; quantity?: number } = {}) {
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

export async function fillContact(page: Page) {
  await page.getByLabel("Name", { exact: true }).fill("Test Customer");
  await page.getByLabel("Email", { exact: true }).fill("customer@example.test");
  await page.getByLabel("WhatsApp number").fill(PHONE);
}

export async function acceptPolicyAndAllergies(page: Page) {
  await page.getByLabel("Allergies or dietary needs", { exact: true }).fill("None");
  await page.getByRole("checkbox", { name: "I have read and accept the order policy" }).check();
}

function monthLabel(page: Page): Locator {
  return page.locator('p[aria-live="polite"]');
}

/**
 * Clicks the bookable day at `index` (0-based) on the checkout calendar, moving to later months
 * when the visible month runs out. Returns the chosen ISO date.
 */
export async function pickAvailableDate(page: Page, index: number): Promise<string> {
  let skipped = 0;
  for (let attempt = 0; attempt < 4; attempt++) {
    const cells = page.locator('[data-state="available"]');
    const count = await cells.count();
    if (index - skipped < count) {
      const cell = cells.nth(index - skipped);
      const iso = await cell.getAttribute("data-date");
      if (!iso) throw new Error("Bookable calendar day has no data-date");
      await cell.click();
      return iso;
    }
    skipped += count;
    const before = (await monthLabel(page).textContent()) ?? "";
    await page.getByRole("button", { name: "Next month" }).click();
    await expect(monthLabel(page)).not.toHaveText(before);
  }
  throw new Error(`No bookable calendar day at index ${index}`);
}

/** Moves the checkout calendar forward until the given ISO date is on screen. */
export async function showCalendarDate(page: Page, iso: string) {
  for (let attempt = 0; attempt < 4; attempt++) {
    if ((await page.locator(`[data-date="${iso}"]`).count()) > 0) return;
    const before = (await monthLabel(page).textContent()) ?? "";
    await page.getByRole("button", { name: "Next month" }).click();
    await expect(monthLabel(page)).not.toHaveText(before);
  }
  throw new Error(`${iso} is not on the checkout calendar`);
}

async function readPlacedOrder(page: Page): Promise<PlacedOrder> {
  await expect(page).toHaveURL(/\/order\/[^/]+$/);
  const heading = (await page.getByRole("heading", { level: 1 }).textContent()) ?? "";
  return {
    orderNumber: heading.replace(/^Order\s+/, "").trim(),
    token: new URL(page.url()).pathname.split("/").pop() ?? "",
  };
}

/** Places a one-item pickup order on the bookable day at `dayIndex` and returns its number and token. */
export async function placePickupOrder(page: Page, dayIndex: number): Promise<PlacedOrder> {
  await page.goto("/");
  await addToCart(page, "Mini Cookie Bag", { flavour: "Half & Half" });
  await page.getByRole("link", { name: /Cart \(1\)/ }).click();
  await expect(page).toHaveURL(/\/checkout$/);

  await fillContact(page);
  await page.getByLabel("Pickup", { exact: true }).check();
  await pickAvailableDate(page, dayIndex);
  await acceptPolicyAndAllergies(page);
  await page.getByRole("button", { name: "Place order — pay to confirm" }).click();
  return readPlacedOrder(page);
}

/** Places a one-item delivery order to "Other area", which waits for an admin quote. */
export async function placeOtherAreaOrder(page: Page, dayIndex: number): Promise<PlacedOrder> {
  await page.goto("/");
  await addToCart(page, "Mini Cookie Bag", { flavour: "Half & Half" });
  await page.getByRole("link", { name: /Cart \(1\)/ }).click();
  await expect(page).toHaveURL(/\/checkout$/);

  await fillContact(page);
  await page.getByLabel("Delivery", { exact: true }).check();
  await page.getByLabel("Delivery area").selectOption({ label: "Other area (we'll contact you)" });
  await page.getByLabel("Delivery address").fill("1 Test Street, Port of Spain");
  await pickAvailableDate(page, dayIndex);
  await acceptPolicyAndAllergies(page);
  await page.getByRole("button", { name: "Place order — pay to confirm" }).click();
  return readPlacedOrder(page);
}

/** Uploads the sample receipt on the customer's order page and waits for "Payment being checked". */
export async function uploadProof(page: Page) {
  await page.getByLabel("Payment receipt").setInputFiles(RECEIPT);
  await page.getByRole("button", { name: "Upload proof" }).click();
  await expect(page.getByText("Payment being checked", { exact: true })).toBeVisible();
}

function seedStaffCredentials() {
  const email = process.env.SEED_STAFF_EMAIL;
  const password = process.env.SEED_STAFF_PASSWORD;
  if (!email || !password) {
    throw new Error("SEED_STAFF_EMAIL and SEED_STAFF_PASSWORD must be set (see .env.local)");
  }
  return { email, password };
}

/** Signs the seed staff user in on the admin login page and waits for Today. */
export async function signInAsStaff(page: Page) {
  const { email, password } = seedStaffCredentials();
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

/** Opens an order from the admin orders list by its number and returns the admin order id. */
export async function openAdminOrder(admin: Page, orderNumber: string): Promise<string> {
  await admin.goto(`/admin/orders?q=${encodeURIComponent(orderNumber)}`);
  await admin.getByRole("link", { name: orderNumber }).click();
  await expect(admin).toHaveURL(/\/admin\/orders\/[0-9a-f-]+$/);
  return new URL(admin.url()).pathname.split("/").pop() ?? "";
}

/** A service-role client for checking or seeding rows the UI does not show. Only for local e2e use. */
export function serviceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (see .env.local)");
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
