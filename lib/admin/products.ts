import { z } from "zod";
import { parsePriceCents } from "@/lib/admin/price";

/** What the product form sends. Price is the  text staff typed; flavours are one per line. */
export type ProductInput = {
  id?: string;
  sectionId: string;
  name: string;
  description: string;
  price: string;
  unitLabel: string;
  allergenNote: string;
  flavours: string;
  maxQty: number;
  active: boolean;
  seasonal: boolean;
};

export type ProductValues = {
  section_id: string;
  name: string;
  description: string | null;
  price_cents: number;
  unit_label: string;
  allergen_note: string | null;
  flavours: string[];
  max_qty: number;
  active: boolean;
  seasonal: boolean;
};

export type ProductField =
  | "sectionId"
  | "name"
  | "description"
  | "price"
  | "unitLabel"
  | "allergenNote"
  | "flavours"
  | "maxQty"
  | "photo";

export type ProductResult = { ok: true; id: string } | { error: string; field?: ProductField };

export type ProductFlags = { active?: boolean; seasonal?: boolean };

export type PhotoFile = { name: string; type: string; size: number; bytes: ArrayBuffer };

/** Persistence for menu items. Production wiring: lib/admin/products-repo.ts (service role). */
export type ProductRepo = {
  sectionExists(sectionId: string): Promise<boolean>;
  nextSort(sectionId: string): Promise<number>;
  insert(values: ProductValues & { sort: number; image_url: string }): Promise<string>;
  /** False when no item has this id. */
  update(id: string, values: ProductValues): Promise<boolean>;
  /** False when no item has this id. */
  delete(id: string): Promise<boolean>;
  /** False when no item has this id. */
  setFlags(id: string, flags: ProductFlags): Promise<boolean>;
  /** Null when no item has this id. */
  getImage(id: string): Promise<{ imageUrl: string | null } | null>;
  setImage(id: string, imageUrl: string): Promise<void>;
};

export type PhotoDeps = {
  repo: ProductRepo;
  storage: { put(key: string, body: Buffer, contentType: string): Promise<string>; remove(url: string): Promise<void> };
  resize: (input: Buffer) => Promise<Buffer>;
  now: () => Date;
};

export const NOT_FOUND = "This item no longer exists — refresh the page.";
export const PHOTO_TYPE_ERROR = "Please upload a JPG, PNG or WEBP photo.";
export const PHOTO_SIZE_ERROR = "That photo is too large — please use one under 5 MB.";
export const PHOTO_READ_ERROR = "That file couldn't be read as a photo. Try another one.";
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/** The placeholder shown for a new item until a photo is uploaded (DESIGN.md: never a fake photo). */
export function placeholderImage(name: string): string {
  return `https://placehold.co/800x800/F5EFE6/8B1E1E.png?text=${encodeURIComponent(name).replace(/%20/g, "+")}`;
}

const MESSAGES: Record<ProductField, string> = {
  sectionId: "Choose a menu section.",
  name: "Enter a name (2–80 characters).",
  description: "Keep the description under 400 characters.",
  price: "Enter a price between 0 and 10,000, e.g. 300 or 45.50.",
  unitLabel: "Enter a unit, e.g. each, per dozen (1–30 characters).",
  allergenNote: "Keep the allergen note under 80 characters.",
  flavours: "Up to 8 flavours, one per line, each under 40 characters.",
  maxQty: "Most per order must be a whole number from 1 to 100.",
  photo: PHOTO_TYPE_ERROR,
};

const flavourList = (text: string) =>
  text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

/** Validates the form and turns it into database values, or names the first field that is wrong. */
export function parseProduct(input: ProductInput): { values: ProductValues } | { error: string; field: ProductField } {
  const fail = (field: ProductField) => ({ error: MESSAGES[field], field });

  if (!z.guid().safeParse(input.sectionId).success) return fail("sectionId");
  const name = input.name.trim();
  if (name.length < 2 || name.length > 80) return fail("name");
  const description = input.description.trim();
  if (description.length > 400) return fail("description");
  const priceCents = parsePriceCents(input.price);
  if (priceCents === null) return fail("price");
  const unitLabel = input.unitLabel.trim();
  if (unitLabel.length < 1 || unitLabel.length > 30) return fail("unitLabel");
  const allergenNote = input.allergenNote.trim();
  if (allergenNote.length > 80) return fail("allergenNote");
  const flavours = flavourList(input.flavours);
  if (flavours.length > 8 || flavours.some((flavour) => flavour.length > 40)) return fail("flavours");
  if (new Set(flavours.map((flavour) => flavour.toLowerCase())).size !== flavours.length) {
    return { error: "Each flavour can only be listed once.", field: "flavours" };
  }
  if (!Number.isInteger(input.maxQty) || input.maxQty < 1 || input.maxQty > 100) return fail("maxQty");

  return {
    values: {
      section_id: input.sectionId,
      name,
      description: description || null,
      price_cents: priceCents,
      unit_label: unitLabel,
      allergen_note: allergenNote || null,
      flavours,
      max_qty: input.maxQty,
      active: input.active,
      seasonal: input.seasonal,
    },
  };
}

/** Adds a new item (placeholder photo, last in its section) or saves an existing one. */
export async function saveProduct(input: ProductInput, deps: { repo: ProductRepo }): Promise<ProductResult> {
  const parsed = parseProduct(input);
  if ("error" in parsed) return parsed;
  const { values } = parsed;

  if (!(await deps.repo.sectionExists(values.section_id))) return { error: MESSAGES.sectionId, field: "sectionId" };

  if (!input.id) {
    const sort = await deps.repo.nextSort(values.section_id);
    const id = await deps.repo.insert({ ...values, sort, image_url: placeholderImage(values.name) });
    return { ok: true, id };
  }

  const updated = await deps.repo.update(input.id, values);
  return updated ? { ok: true, id: input.id } : { error: NOT_FOUND };
}

/** Switches an item on or off the menu, or marks it seasonal. Either flag may be sent alone. */
export async function setProductFlags(
  input: { id: string } & ProductFlags,
  deps: { repo: ProductRepo },
): Promise<ProductResult> {
  const flags: ProductFlags = {};
  if (typeof input.active === "boolean") flags.active = input.active;
  if (typeof input.seasonal === "boolean") flags.seasonal = input.seasonal;
  if (Object.keys(flags).length === 0) return { error: "Nothing to change." };
  const updated = await deps.repo.setFlags(input.id, flags);
  return updated ? { ok: true, id: input.id } : { error: NOT_FOUND };
}

/**
 * Checks an uploaded photo, resizes it to WebP, stores it, points the item at it, then removes the
 * photo it replaced. The old photo is only removed after the item points at the new one.
 */
export async function uploadProductPhoto(
  input: { id: string; file: PhotoFile },
  deps: PhotoDeps,
): Promise<ProductResult> {
  const { file } = input;
  if (!PHOTO_TYPES.has(file.type)) return { error: PHOTO_TYPE_ERROR, field: "photo" };
  if (file.size === 0 || file.size > PHOTO_MAX_BYTES) return { error: PHOTO_SIZE_ERROR, field: "photo" };

  const current = await deps.repo.getImage(input.id);
  if (!current) return { error: NOT_FOUND };

  let webp: Buffer;
  try {
    webp = await deps.resize(Buffer.from(file.bytes));
  } catch {
    return { error: PHOTO_READ_ERROR, field: "photo" };
  }

  const key = `items/${input.id}-${deps.now().getTime()}.webp`;
  const url = await deps.storage.put(key, webp, "image/webp");
  await deps.repo.setImage(input.id, url);

  if (current.imageUrl && current.imageUrl !== url) {
    try {
      await deps.storage.remove(current.imageUrl);
    } catch (error) {
      console.error("[products] failed to remove the replaced photo", error);
    }
  }
  return { ok: true, id: input.id };
}

/**
 * Deletes a menu item and its photo. Past orders keep their own copy of the item's name and price, so
 * their records do not change. The photo is removed only after the item is gone.
 */
export async function deleteProduct(
  input: { id: string },
  deps: { repo: ProductRepo; storage: { remove(url: string): Promise<void> } },
): Promise<ProductResult> {
  const current = await deps.repo.getImage(input.id);
  if (!current) return { error: NOT_FOUND };
  const removed = await deps.repo.delete(input.id);
  if (!removed) return { error: NOT_FOUND };
  if (current.imageUrl) {
    try {
      await deps.storage.remove(current.imageUrl);
    } catch (error) {
      console.error("[products] failed to remove the deleted item's photo", error);
    }
  }
  return { ok: true, id: input.id };
}
