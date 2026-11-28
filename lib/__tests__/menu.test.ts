import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

/**
 * The menu is seeded from SQL, not from code, so these tests read the two seed files and check
 * the menu they describe. Both seeds must agree: the dev seed and the production seed.
 */

type SeedItem = {
  id: string;
  section: string;
  name: string;
  description: string | null;
  unit: string;
  priceCents: number;
  allergenNote: string | null;
  seasonal: boolean;
  flavours: string[];
  maxQty: number;
  active: boolean;
  sort: number;
};

type SeedMenu = {
  sections: { name: string; sort: number }[];
  items: SeedItem[];
};

const SEEDS = ["supabase/seed.sql", "supabase/production-seed.sql"] as const;

const SQL_STRING = "'((?:[^']|'')*)'";
const SQL_NULLABLE_STRING = `(null|${SQL_STRING})`;

/** Reads the sections and items inserted by one seed file. */
function readMenu(relPath: string): SeedMenu {
  const sql = readFileSync(new URL(`../../${relPath}`, import.meta.url), "utf8");
  const unescape = (s: string) => s.replace(/''/g, "'");

  const sectionNames = new Map<string, string>();
  const sectionRow = new RegExp(`\\('([0-9a-f-]+)',\\s*${SQL_STRING},\\s*(\\d+)\\)`, "g");
  const sectionsBlock = sql.slice(sql.indexOf("insert into sections"), sql.indexOf("on conflict", sql.indexOf("insert into sections")));
  const sections: SeedMenu["sections"] = [];
  for (const m of sectionsBlock.matchAll(sectionRow)) {
    sectionNames.set(m[1], unescape(m[2]));
    sections.push({ name: unescape(m[2]), sort: Number(m[3]) });
  }

  const itemsBlock = sql.slice(sql.indexOf("insert into items"), sql.indexOf("on conflict", sql.indexOf("insert into items")));
  const itemRow = new RegExp(
    [
      "\\(\\s*'([0-9a-f-]+)',",
      `\\s*'([0-9a-f-]+)',`,
      `\\s*${SQL_STRING},`,
      `\\s*${SQL_NULLABLE_STRING},`,
      `\\s*${SQL_STRING},`,
      "\\s*(\\d+),",
      `\\s*${SQL_STRING},`,
      `\\s*${SQL_NULLABLE_STRING},`,
      "\\s*(true|false),",
      "\\s*'\\{([^}]*)\\}',",
      "\\s*(\\d+),",
      "\\s*(true|false),",
      "\\s*(\\d+)\\s*\\)",
    ].join(""),
    "g",
  );
  const items: SeedItem[] = [];
  for (const m of itemsBlock.matchAll(itemRow)) {
    // Groups: 1 id, 2 section id, 3 name, 4-5 description, 6 unit, 7 price, 8 image,
    // 9-10 allergen note, 11 seasonal, 12 flavours, 13 max_qty, 14 active, 15 sort.
    const flavours = [...m[12].matchAll(/"([^"]*)"/g)].map((f) => f[1]);
    items.push({
      id: m[1],
      section: sectionNames.get(m[2]) ?? `unknown section ${m[2]}`,
      name: unescape(m[3]),
      description: m[4] === "null" ? null : unescape(m[5]),
      unit: unescape(m[6]),
      priceCents: Number(m[7]),
      allergenNote: m[9] === "null" ? null : unescape(m[10]),
      seasonal: m[11] === "true",
      flavours,
      maxQty: Number(m[13]),
      active: m[14] === "true",
      sort: Number(m[15]),
    });
  }
  return { sections, items };
}

function byName(menu: SeedMenu, name: string): SeedItem {
  const found = menu.items.filter((i) => i.name === name);
  if (found.length !== 1) throw new Error(`expected one item named ${name}, found ${found.length}`);
  return found[0];
}

describe.each(SEEDS)("menu seed %s", (relPath) => {
  const menu = readMenu(relPath);

  test("sections are Cookies & Shortbread then Cakes, Cupcakes & Loaves", () => {
    const ordered = [...menu.sections].sort((a, b) => a.sort - b.sort).map((s) => s.name);
    expect(ordered).toEqual(["Cookies & Shortbread", "Cakes, Cupcakes & Loaves"]);
  });

  test("the cookie bag and jar sections hold the cookies and the shortbread bar", () => {
    const cookies = menu.items.filter((i) => i.section === "Cookies & Shortbread").map((i) => i.name);
    expect(cookies.sort()).toEqual(["Cookie Jar", "Mini Cookie Bag", "Sorrel Cranberry Shortbread"]);
  });

  test("the cupcakes sit in Cakes, Cupcakes & Loaves", () => {
    for (const name of ["Red Velvet Cupcakes", "Lemon Blueberry Cupcakes"]) {
      expect(byName(menu, name).section).toBe("Cakes, Cupcakes & Loaves");
    }
  });

  test("bag and jar flavours are the four v2 flavours and Half & Half is gone", () => {
    const expected = ["Dark Chocolate & Toffee", "Coconut Butterscotch", "Red Velvet", "Mix of all 3 flavours"];
    expect(byName(menu, "Mini Cookie Bag").flavours).toEqual(expected);
    expect(byName(menu, "Cookie Jar").flavours).toEqual(expected);
    expect(JSON.stringify(menu)).not.toContain("Half & Half");
  });

  test("bag and jar limit is 10", () => {
    expect(byName(menu, "Mini Cookie Bag").maxQty).toBe(10);
    expect(byName(menu, "Cookie Jar").maxQty).toBe(10);
  });

  test("the glazed lemon loaf and chocolate cranberry loaf limit is 10", () => {
    expect(byName(menu, "Glazed Lemon Loaf").maxQty).toBe(10);
    expect(byName(menu, "Chocolate Cranberry Loaf").maxQty).toBe(10);
  });

  test("the Sorrel Cranberry Shortbread is tagged Egg Free", () => {
    expect(byName(menu, "Sorrel Cranberry Shortbread").allergenNote).toBe("Egg Free");
  });

  test("the Hummingbird Cake is seasonal and tagged Contains nuts", () => {
    const hummingbird = byName(menu, "Hummingbird Cake");
    expect(hummingbird.seasonal).toBe(true);
    expect(hummingbird.allergenNote).toBe("Contains nuts");
  });

  test("the two cupcakes offer Christmas Themed Icing and Standard, at no extra price", () => {
    for (const name of ["Red Velvet Cupcakes", "Lemon Blueberry Cupcakes"]) {
      const cupcake = byName(menu, name);
      expect(cupcake.flavours).toEqual(["Christmas Themed Icing", "Standard"]);
      expect(cupcake.priceCents).toBe(30000);
    }
  });

  test("item names and prices are unchanged from the database", () => {
    const prices = Object.fromEntries(menu.items.map((i) => [i.name, i.priceCents]));
    expect(prices).toEqual({
      "Lemon Blueberry Cupcakes": 30000,
      "Red Velvet Cupcakes": 30000,
      "Mini Cookie Bag": 5000,
      "Cookie Jar": 9000,
      "Sorrel Cranberry Shortbread": 30000,
      "Hummingbird Cake": 60000,
      "Orange Almond Cake": 40000,
      "Honey Pistachio Cake": 60000,
      "Glazed Lemon Loaf": 25000,
      "Chocolate Cranberry Loaf": 30000,
    });
  });
});

describe("dev and production seeds describe the same menu", () => {
  test("the items match", () => {
    const dev = readMenu("supabase/seed.sql").items.map((i) => [i.name, i.section, i.maxQty, i.flavours, i.allergenNote]);
    const prod = readMenu("supabase/production-seed.sql").items.map((i) => [i.name, i.section, i.maxQty, i.flavours, i.allergenNote]);
    expect(prod).toEqual(dev);
  });
});
