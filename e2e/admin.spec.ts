import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { formatFulfilDate } from "../lib/format-date";
import {
  addToCart,
  openAdminOrder,
  pickAvailableDate,
  placePickupOrder,
  serviceClient,
  showCalendarDate,
  signInAsStaff,
  trinidadDaysFromToday,
  uploadProof,
} from "./helpers";

test.describe.configure({ timeout: 120_000 });

/**
 * Each test books its own bookable day (0 is left to the order-flow specs), and the mobile project
 * uses days 20 later, so the desktop and mobile runs never book or block the same date.
 */
function dayFor(base: number, testInfo: TestInfo): number {
  return base + (testInfo.project.name === "mobile" ? 20 : 0);
}

/** Opens the payment queue on the admin side and the order's proof card. Returns the admin order id. */
async function openProofForReview(admin: Page, orderNumber: string): Promise<string> {
  await admin.goto("/admin/payments");
  const card = admin.getByRole("article").filter({
    has: admin.getByRole("heading", { name: orderNumber, exact: true }),
  });
  await card.getByRole("link", { name: /^Review/ }).click();
  await expect(admin).toHaveURL(/\/admin\/orders\/[0-9a-f-]+#proof$/);
  return new URL(admin.url()).pathname.split("/")[3];
}

test("confirm a proof", async ({ page }, testInfo) => {
  const order = await placePickupOrder(page, dayFor(1, testInfo));
  await uploadProof(page);

  const admin = await page.context().newPage();
  await signInAsStaff(admin);
  const orderId = await openProofForReview(admin, order.orderNumber);

  await admin.getByRole("button", { name: "Confirm payment" }).click();
  await admin.getByRole("dialog").getByRole("button", { name: "Yes, confirm" }).click();
  await expect(admin.getByText("Saved", { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByText("Confirmed", { exact: true })).toBeVisible();

  const receipt = page.getByRole("link", { name: "Download receipt" });
  const href = await receipt.getAttribute("href");
  expect(href).toBeTruthy();
  const response = await page.request.get(href!);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("application/pdf");

  await expect
    .poll(async () => {
      const { data } = await serviceClient().from("email_log").select("template").eq("order_id", orderId);
      return data?.map((row) => row.template) ?? [];
    })
    .toContain("order_confirmed");
});

test("reject a proof", async ({ page }, testInfo) => {
  const order = await placePickupOrder(page, dayFor(2, testInfo));
  await uploadProof(page);

  const admin = await page.context().newPage();
  await signInAsStaff(admin);
  await openProofForReview(admin, order.orderNumber);

  await admin.getByRole("button", { name: "Reject proof" }).click();
  const dialog = admin.getByRole("dialog");
  await dialog.getByLabel("Reason for the customer").fill("Amount doesn't match");
  await dialog.getByRole("button", { name: "Reject proof" }).click();
  await expect(admin.getByText("Saved", { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByText("Your payment proof was not accepted")).toBeVisible();
  await expect(page.getByText("Amount doesn't match")).toBeVisible();
  await expect(page.getByLabel("Payment receipt")).toBeVisible();
});

test("blocked date in settings", async ({ page }, testInfo) => {
  await page.goto("/");
  await addToCart(page, "Mini Cookie Bag", { flavour: "Half & Half" });
  await page.getByRole("link", { name: /Basket 1/ }).click();
  await expect(page).toHaveURL(/\/checkout$/);
  const iso = await pickAvailableDate(page, dayFor(6, testInfo));

  const admin = await page.context().newPage();
  await signInAsStaff(admin);
  await admin.goto("/admin/settings");
  // Fill only after the form hydrates: a value typed before React attaches is reset by the first render.
  await admin.waitForFunction(() =>
    Array.from(document.querySelectorAll("button")).some(
      (button) =>
        button.textContent === "Block dates" &&
        Object.keys(button).some((key) => key.startsWith("__reactProps")),
    ),
  );
  const removeButton = admin.getByRole("button", { name: `Remove blocked date ${formatFulfilDate(iso)}` });

  try {
    await admin.getByLabel("From", { exact: true }).fill(iso);
    await admin.getByRole("button", { name: "Block dates" }).click();
    await expect(removeButton).toBeVisible();

    await page.goto("/checkout");
    await showCalendarDate(page, iso);
    await expect(page.locator(`[data-date="${iso}"]`)).toHaveAttribute("data-state", "unavailable");
  } finally {
    // Unblock the day this test blocked, so later specs can book it.
    await admin.goto("/admin/settings");
    if ((await removeButton.count()) > 0) {
      await removeButton.click();
      await expect(removeButton).toHaveCount(0);
    }
  }
});

test("change date refuses a blocked date", async ({ page }, testInfo) => {
  const order = await placePickupOrder(page, dayFor(4, testInfo));
  const blocked = trinidadDaysFromToday(testInfo.project.name === "mobile" ? 61 : 60);
  const db = serviceClient();
  const { error: insertError } = await db.from("blocked_dates").insert({ date: blocked, note: "E2E change-date check" });
  expect(insertError).toBeNull();

  try {
    const admin = await page.context().newPage();
    await signInAsStaff(admin);
    await openAdminOrder(admin, order.orderNumber);

    await admin.getByRole("button", { name: "Change date" }).click();
    const dialog = admin.getByRole("dialog");
    await dialog.getByLabel("New date").fill(blocked);
    await dialog.getByRole("button", { name: "Change date" }).click();
    await expect(dialog.getByText("That date is blocked. Unblock it in Settings first.")).toBeVisible();
  } finally {
    await db.from("blocked_dates").delete().eq("date", blocked);
  }
});

test.describe("admin pages fit 375px", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  async function expectFitsWidth(page: Page, label: string) {
    const fits = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    expect(fits, `${label} should not scroll horizontally at 375px`).toBe(true);
  }

  /** Scrolls to the end of the page and checks the last content sits above the tab bar. */
  async function expectClearOfTabBar(page: Page, label: string) {
    const measured = await page.evaluate(() => {
      window.scrollTo(0, document.documentElement.scrollHeight);
      // The sidebar also renders an "Admin" nav, hidden below lg, so take the one that is shown.
      const navs = Array.from(document.querySelectorAll('nav[aria-label="Admin"]'));
      const shown = navs.find((nav) => nav.getBoundingClientRect().height > 0);
      const navTop = shown ? shown.getBoundingClientRect().top : null;
      let lastBottom = -Infinity;
      document.querySelectorAll("#main *").forEach((element) => {
        const rect = element.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) lastBottom = Math.max(lastBottom, rect.bottom);
      });
      return { navTop, lastBottom };
    });
    expect(measured.navTop, `${label} should show the tab bar at 375px`).not.toBeNull();
    expect(measured.lastBottom, `${label} last element should clear the tab bar`).toBeLessThanOrEqual(
      measured.navTop as number,
    );
  }

  test("admin pages fit 375px", async ({ page }, testInfo) => {
    const order = await placePickupOrder(page, dayFor(5, testInfo));

    const admin = await page.context().newPage();
    await signInAsStaff(admin);
    const orderId = await openAdminOrder(admin, order.orderNumber);

    const paths = ["/admin", "/admin/orders", `/admin/orders/${orderId}`, "/admin/payments", "/admin/menu", "/admin/settings"];
    for (const path of paths) {
      await admin.goto(path);
      await expect(admin.getByRole("heading", { level: 1 })).toBeVisible();
      await expectFitsWidth(admin, path);
      await expectClearOfTabBar(admin, path);
    }
  });
});
