import { expect, test } from "@playwright/test";

function seedStaffCredentials() {
  const email = process.env.SEED_STAFF_EMAIL;
  const password = process.env.SEED_STAFF_PASSWORD;
  if (!email || !password) {
    throw new Error("SEED_STAFF_EMAIL and SEED_STAFF_PASSWORD must be set (see .env.local)");
  }
  return { email, password };
}

test("visiting /admin while logged out ends at /admin/login", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login$/);
});

test("staff can sign in and land on the orders shell", async ({ page }) => {
  const { email, password } = seedStaffCredentials();

  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "Admin" })).toBeVisible();
});

test("a wrong password shows the generic error", async ({ page }) => {
  const { email } = seedStaffCredentials();

  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("definitely-not-the-password");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByText("Email or password is incorrect")).toBeVisible();
});
