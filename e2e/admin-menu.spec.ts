import path from "node:path";
import { expect, test } from "@playwright/test";
import { menuCard, serviceClient, signInAsStaff, waitForHydration } from "./helpers";

const ITEM = "Glazed Lemon Loaf";
const PHOTO = path.join(__dirname, "fixtures", "bake.jpg");

/** Puts the loaf back exactly as the seed had it, whatever a failed test left behind. */
async function restoreLoaf(original: { price_cents: number; active: boolean; seasonal: boolean; image_url: string | null }) {
  const { error } = await serviceClient().from("items").update(original).eq("name", ITEM);
  if (error) throw new Error(error.message);
}

async function loadLoaf() {
  const { data, error } = await serviceClient()
    .from("items")
    .select("id, price_cents, active, seasonal, image_url")
    .eq("name", ITEM)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

// These tests edit one shared menu item, so they run one after another, in one project only:
// the desktop and phone projects run in parallel and would edit the same row at once. The phone
// layout of the Menu page is covered by "admin pages fit 375px" in admin.spec.ts.
test.describe.configure({ mode: "serial" });
test.skip(({ isMobile }) => isMobile, "Edits shared data; runs in the desktop project only.");

test("switching an item off hides it from the shop", async ({ page }) => {
  const original = await loadLoaf();
  try {
    await signInAsStaff(page);
    await page.goto("/admin/menu");
    await waitForHydration(page);
    const onMenu = page.getByRole("switch", { name: `On menu: ${ITEM}` });
    await expect(onMenu).toBeChecked();
    await onMenu.click();
    await expect(page.getByText("Saved")).toBeVisible();
    await expect(onMenu).not.toBeChecked();

    const shop = await page.context().newPage();
    await shop.goto("/");
    await expect(shop.getByRole("heading", { name: "Chocolate Cranberry Loaf", exact: true })).toBeVisible();
    await expect(menuCard(shop, ITEM)).toHaveCount(0);
  } finally {
    await restoreLoaf(original);
  }
});

test("a new price shows on the shop", async ({ page }) => {
  const original = await loadLoaf();
  try {
    await signInAsStaff(page);
    await page.goto(`/admin/menu/${original.id}`);
    await waitForHydration(page);
    await page.getByLabel("Price", { exact: true }).fill("275.50");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Saved")).toBeVisible();

    const shop = await page.context().newPage();
    await shop.goto("/");
    await expect(menuCard(shop, ITEM).getByText("275.50")).toBeVisible();
  } finally {
    await restoreLoaf(original);
  }
});

test("a bad price is refused next to the field", async ({ page }) => {
  const original = await loadLoaf();
  await signInAsStaff(page);
  await page.goto(`/admin/menu/${original.id}`);
  await waitForHydration(page);
  await page.getByLabel("Price", { exact: true }).fill("lots");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText(/Enter a price between 0 and 10,000/).first()).toBeVisible();
  expect((await loadLoaf()).price_cents).toBe(original.price_cents);
});

test("uploading a photo replaces the placeholder", async ({ page }) => {
  const original = await loadLoaf();
  try {
    await signInAsStaff(page);
    await page.goto(`/admin/menu/${original.id}`);
    await waitForHydration(page);
    await page.locator('input[type="file"]').setInputFiles(PHOTO);
    await expect(page.getByText("Saved")).toBeVisible();
    await expect(page.getByRole("button", { name: "Replace photo" })).toBeVisible();

    const updated = await loadLoaf();
    expect(updated.image_url).toMatch(/\/items\/[0-9a-f-]+-\d+\.webp$/);
    const response = await page.request.get(updated.image_url!);
    expect(response.headers()["content-type"]).toContain("image/webp");

    const shop = await page.context().newPage();
    await shop.goto("/");
    // The card's photo link is hidden from screen readers (the name link duplicates it), so match by alt.
    await expect(menuCard(shop, ITEM).locator(`img[alt="${ITEM}"]`)).toBeVisible();
  } finally {
    const uploaded = (await loadLoaf()).image_url;
    await restoreLoaf(original);
    const marker = "/storage/v1/object/public/items/";
    if (uploaded?.includes(marker)) {
      await serviceClient().storage.from("items").remove([uploaded.slice(uploaded.indexOf(marker) + marker.length)]);
    }
  }
});
