import { describe, expect, test } from "vitest";
import { parsePriceCents } from "@/lib/admin/fee";
import {
  NOT_FOUND,
  PHOTO_READ_ERROR,
  PHOTO_SIZE_ERROR,
  PHOTO_TYPE_ERROR,
  parseProduct,
  placeholderImage,
  saveProduct,
  setProductFlags,
  uploadProductPhoto,
  type ProductInput,
  type ProductRepo,
  type ProductValues,
} from "@/lib/admin/products";

const SECTION = "11111111-1111-4111-8111-111111111111";
const ITEM = "22222222-2222-4222-8222-222222222222";

const base: ProductInput = {
  sectionId: SECTION,
  name: "  Rum Cake ",
  description: "Soaked overnight.",
  price: "350",
  unitLabel: "each",
  allergenNote: "",
  flavours: "",
  maxQty: 5,
  active: true,
  seasonal: true,
};

type Row = ProductValues & { id: string; sort: number; image_url: string };

function makeRepo(rows: Row[] = []) {
  const state = { rows, inserted: [] as Row[] };
  const repo: ProductRepo = {
    async sectionExists(id) {
      return id === SECTION;
    },
    async nextSort() {
      return 7;
    },
    async insert(values) {
      const row = { ...values, id: ITEM };
      state.rows.push(row);
      state.inserted.push(row);
      return ITEM;
    },
    async update(id, values) {
      const row = state.rows.find((r) => r.id === id);
      if (!row) return false;
      Object.assign(row, values);
      return true;
    },
    async setFlags(id, flags) {
      const row = state.rows.find((r) => r.id === id);
      if (!row) return false;
      Object.assign(row, flags);
      return true;
    },
    async getImage(id) {
      const row = state.rows.find((r) => r.id === id);
      return row ? { imageUrl: row.image_url } : null;
    },
    async setImage(id, url) {
      const row = state.rows.find((r) => r.id === id);
      if (row) row.image_url = url;
    },
  };
  return { repo, state };
}

function existing(overrides: Partial<Row> = {}): Row {
  return {
    id: ITEM,
    section_id: SECTION,
    name: "Rum Cake",
    description: null,
    price_cents: 35000,
    unit_label: "each",
    allergen_note: null,
    flavours: [],
    max_qty: 5,
    active: true,
    seasonal: false,
    sort: 1,
    image_url: "https://photos.example.test/items/old.webp",
    ...overrides,
  };
}

describe("parsePriceCents", () => {
  test("accepts plain amounts,  and thousands commas", () => {
    expect(parsePriceCents("300")).toBe(30000);
    expect(parsePriceCents("45.50")).toBe(4550);
    expect(parsePriceCents("1,250")).toBe(125000);
    expect(parsePriceCents("10000")).toBe(1_000_000);
  });
  test("refuses junk, negatives and amounts over 10,000", () => {
    for (const bad of ["", "abc", "-5", "12.345", "10000.01"]) expect(parsePriceCents(bad)).toBeNull();
  });
});

describe("parseProduct", () => {
  test("trims text, turns price into cents, splits flavours and drops blanks", () => {
    const result = parseProduct({ ...base, flavours: " Vanilla \n\nChocolate\n" });
    expect(result).toEqual({
      values: {
        section_id: SECTION,
        name: "Rum Cake",
        description: "Soaked overnight.",
        price_cents: 35000,
        unit_label: "each",
        allergen_note: null,
        flavours: ["Vanilla", "Chocolate"],
        max_qty: 5,
        active: true,
        seasonal: true,
      },
    });
  });

  test.each([
    [{ name: "A" }, "name"],
    [{ price: "free" }, "price"],
    [{ unitLabel: "  " }, "unitLabel"],
    [{ maxQty: 0 }, "maxQty"],
    [{ maxQty: 2.5 }, "maxQty"],
    [{ sectionId: "nope" }, "sectionId"],
    [{ flavours: "a\nb\nc\nd\ne\nf\ng\nh\ni" }, "flavours"],
    [{ allergenNote: "x".repeat(81) }, "allergenNote"],
  ] as const)("names the wrong field: %o", (patch, field) => {
    expect(parseProduct({ ...base, ...patch })).toMatchObject({ field });
  });

  test("refuses the same flavour twice", () => {
    expect(parseProduct({ ...base, flavours: "Vanilla\nvanilla" })).toEqual({
      error: "Each flavour can only be listed once.",
      field: "flavours",
    });
  });
});

describe("saveProduct", () => {
  test("a new item goes last in its section with a placeholder photo", async () => {
    const { repo, state } = makeRepo();
    await expect(saveProduct(base, { repo })).resolves.toEqual({ ok: true, id: ITEM });
    expect(state.inserted[0]).toMatchObject({ sort: 7, name: "Rum Cake", image_url: placeholderImage("Rum Cake") });
  });

  test("editing keeps the photo and updates the fields", async () => {
    const { repo, state } = makeRepo([existing()]);
    await expect(saveProduct({ ...base, id: ITEM, price: "400" }, { repo })).resolves.toEqual({ ok: true, id: ITEM });
    expect(state.rows[0]).toMatchObject({ price_cents: 40000, image_url: "https://photos.example.test/items/old.webp" });
  });

  test("an unknown section is refused", async () => {
    const { repo } = makeRepo();
    const other = "33333333-3333-4333-8333-333333333333";
    await expect(saveProduct({ ...base, sectionId: other }, { repo })).resolves.toMatchObject({ field: "sectionId" });
  });

  test("editing a deleted item says so", async () => {
    const { repo } = makeRepo();
    await expect(saveProduct({ ...base, id: ITEM }, { repo })).resolves.toEqual({ error: NOT_FOUND });
  });
});

describe("setProductFlags", () => {
  test("switches one flag without touching the other", async () => {
    const { repo, state } = makeRepo([existing({ active: true, seasonal: true })]);
    await expect(setProductFlags({ id: ITEM, active: false }, { repo })).resolves.toEqual({ ok: true, id: ITEM });
    expect(state.rows[0]).toMatchObject({ active: false, seasonal: true });
  });

  test("nothing to change, or a missing item, is refused", async () => {
    const { repo } = makeRepo();
    await expect(setProductFlags({ id: ITEM }, { repo })).resolves.toEqual({ error: "Nothing to change." });
    await expect(setProductFlags({ id: ITEM, seasonal: true }, { repo })).resolves.toEqual({ error: NOT_FOUND });
  });
});

describe("uploadProductPhoto", () => {
  const photo = (overrides: Partial<{ type: string; size: number }> = {}) => ({
    name: "cake.jpg",
    type: "image/jpeg",
    size: 1000,
    bytes: new Uint8Array([1, 2, 3]).buffer,
    ...overrides,
  });

  function storage() {
    const calls = { put: [] as string[], removed: [] as string[] };
    return {
      calls,
      put: async (key: string) => {
        calls.put.push(key);
        return `https://photos.example.test/${key}`;
      },
      remove: async (url: string) => {
        calls.removed.push(url);
      },
    };
  }
  const now = () => new Date("2026-11-24T12:00:00Z");

  test("resizes, stores as webp, points the item at it, then removes the old photo", async () => {
    const { repo, state } = makeRepo([existing()]);
    const store = storage();
    const result = await uploadProductPhoto(
      { id: ITEM, file: photo() },
      { repo, storage: store, resize: async () => Buffer.from("webp"), now },
    );
    expect(result).toEqual({ ok: true, id: ITEM });
    const key = `items/${ITEM}-${now().getTime()}.webp`;
    expect(store.calls.put).toEqual([key]);
    expect(state.rows[0].image_url).toBe(`https://photos.example.test/${key}`);
    expect(store.calls.removed).toEqual(["https://photos.example.test/items/old.webp"]);
  });

  test("refuses other file types and oversize files before reading them", async () => {
    const { repo } = makeRepo([existing()]);
    const deps = { repo, storage: storage(), resize: async () => Buffer.from(""), now };
    await expect(uploadProductPhoto({ id: ITEM, file: photo({ type: "image/heic" }) }, deps)).resolves.toEqual({
      error: PHOTO_TYPE_ERROR,
      field: "photo",
    });
    await expect(uploadProductPhoto({ id: ITEM, file: photo({ size: 6 * 1024 * 1024 }) }, deps)).resolves.toEqual({
      error: PHOTO_SIZE_ERROR,
      field: "photo",
    });
  });

  test("an unreadable image stores nothing", async () => {
    const { repo, state } = makeRepo([existing()]);
    const store = storage();
    const result = await uploadProductPhoto(
      { id: ITEM, file: photo() },
      {
        repo,
        storage: store,
        resize: async () => {
          throw new Error("bad input");
        },
        now,
      },
    );
    expect(result).toEqual({ error: PHOTO_READ_ERROR, field: "photo" });
    expect(store.calls.put).toEqual([]);
    expect(state.rows[0].image_url).toBe("https://photos.example.test/items/old.webp");
  });

  test("a failed clean-up of the old photo does not fail the upload", async () => {
    const { repo } = makeRepo([existing()]);
    const store = storage();
    store.remove = async () => {
      throw new Error("network");
    };
    const result = await uploadProductPhoto(
      { id: ITEM, file: photo() },
      { repo, storage: store, resize: async () => Buffer.from("webp"), now },
    );
    expect(result).toEqual({ ok: true, id: ITEM });
  });
});
