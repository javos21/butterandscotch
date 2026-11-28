import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  createOrder,
  DateUnavailableError,
  type NewOrder,
  type NewOrderItem,
  type OrderRef,
  type OrderRepo,
} from "@/lib/orders/create-order";
import type { EmailDeps, EmailLogEntry } from "@/lib/email/types";
import type { BankDetails, Item, Settings } from "@/lib/types";

const SITE = "https://shop.test";
const NOW = new Date("2026-11-23T12:00:00Z");
const SECTION_ID = "00000000-0000-4000-8000-0000000000a1";
const RED_VELVET_ID = "11111111-1111-4111-8111-111111111111";
const COOKIE_JAR_ID = "22222222-2222-4222-8222-222222222222";
const MINI_BAG_ID = "33333333-3333-4333-8333-333333333333";
const INACTIVE_ID = "44444444-4444-4444-8444-444444444444";
const UNKNOWN_ID = "55555555-5555-4555-8555-555555555555";
const KEY = "idem-0001-abcdefgh";

const BANK: BankDetails = {
  bank: "Sample Bank",
  account_name: "Butter and Scotch Ltd",
  account_type: "Chequing",
  transit: "00100",
  account_no_same_bank: "1234567",
  account_no_other_bank: "7654321",
};

function makeItem(overrides: Partial<Item>): Item {
  return {
    id: RED_VELVET_ID,
    section_id: SECTION_ID,
    name: "Red Velvet",
    description: null,
    unit_label: "cake",
    price_cents: 30000,
    image_url: null,
    allergen_note: null,
    seasonal: false,
    flavours: [],
    max_qty: 10,
    active: true,
    sort: 0,
    ...overrides,
  };
}

const redVelvet = makeItem({});
const cookieJar = makeItem({
  id: COOKIE_JAR_ID,
  name: "Cookie Jar",
  unit_label: "jar",
  price_cents: 12000,
  flavours: ["Coconut Butterscotch", "Half & Half"],
  max_qty: 2,
});
const miniBag = makeItem({
  id: MINI_BAG_ID,
  name: "Mini Cookie Bag",
  unit_label: "bag",
  price_cents: 4500,
  flavours: ["Coconut Butterscotch", "Half & Half"],
});
const inactive = makeItem({ id: INACTIVE_ID, name: "Old Sponge", active: false });

function makeSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    id: 1,
    store_open: true,
    lead_time_days: 5,
    daily_order_cap: 10,
    bank_details: BANK,
    pickup_info: "",
    policy_text: "Policy text",
    policy_version: 3,
    whatsapp_number: "",
    notify_email: "staff@example.test",
    order_close_date: "2026-12-16",
    last_fulfilment_date: "2026-12-23",
    pickup_locations: ["West", "Chaguanas"],
    updated_at: "2026-11-11T00:00:00Z",
    ...overrides,
  };
}

function checkout(overrides: Record<string, unknown> = {}) {
  return {
    name: "Asha Mohan",
    email: "asha@example.test",
    phone: "868 555 0100",
    fulfilment: { type: "pickup" },
    date: "2026-11-28",
    allergies: "None",
    acceptPolicy: true,
    idempotencyKey: KEY,
    lines: [{ itemId: RED_VELVET_ID, flavour: null, quantity: 2 }],
    ...overrides,
  };
}

function fakeRepo(opts: { settings?: Partial<Settings>; items?: Item[] } = {}) {
  const settings = makeSettings(opts.settings);
  const items = opts.items ?? [redVelvet, cookieJar, miniBag, inactive];
  const byKey = new Map<string, OrderRef>();
  let seq = 0;

  const insertOrder = vi.fn(async (...args: [NewOrder, NewOrderItem[]]) => {
    const [o] = args;
    seq += 1;
    const stored: OrderRef = {
      id: `00000000-0000-4000-8000-00000000000${seq}`,
      orderNumber: `BS-000${seq}`,
      token: o.access_token,
    };
    byKey.set(o.idempotency_key, stored);
    return { ...stored, created: true };
  });

  const repo: OrderRepo = {
    getSettings: vi.fn(async () => settings),
    getItems: vi.fn(async (ids: string[]) => items.filter((item) => ids.includes(item.id))),
    findByIdempotencyKey: vi.fn(async (key: string) => byKey.get(key) ?? null),
    insertOrder,
  };
  return { repo, insertOrder };
}

type Sent = { to: string; subject: string; html: string };

function fakeEmail() {
  const sent: Sent[] = [];
  const send = vi.fn(async (msg: Sent) => {
    sent.push(msg);
    return { id: `msg-${sent.length}` };
  });
  const log = vi.fn<(entry: EmailLogEntry) => Promise<void>>(async () => {});
  const deps: EmailDeps = { provider: { send }, log };
  return { deps, send, sent, log };
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", SITE);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("createOrder", () => {
  test("places a pickup order", async () => {
    const { repo, insertOrder } = fakeRepo();
    const { deps, sent } = fakeEmail();

    const result = await createOrder(checkout(), { repo, email: deps, now: () => NOW });

    expect(result).toHaveProperty("token");
    expect(insertOrder).toHaveBeenCalledTimes(1);
    const [order, items] = insertOrder.mock.calls[0];
    expect(order).toMatchObject({
      status: "awaiting_payment",
      subtotal_cents: 60000,
      total_cents: 60000,
      payment_window_started_at: NOW.toISOString(),
      fulfilment: "pickup",
      fulfil_date: "2026-11-28",
      policy_version: 3,
    });
    expect(items).toEqual([
      {
        item_id: RED_VELVET_ID,
        item_name: "Red Velvet",
        flavour: null,
        unit_label: "cake",
        unit_price_cents: 30000,
        quantity: 2,
      },
    ]);
    const customer = sent.find((msg) => msg.to === "asha@example.test");
    expect(customer?.subject).toBe("Order BS-0001 received — awaiting payment");
    expect(customer?.html).toContain("Sample Bank");
  });

  test("delivery order total excludes any fee", async () => {
    const { repo, insertOrder } = fakeRepo();
    const { deps, sent } = fakeEmail();

    const result = await createOrder(
      checkout({
        fulfilment: { type: "delivery", address: "12 Frederick St, Port of Spain" },
        lines: [
          { itemId: RED_VELVET_ID, flavour: null, quantity: 1 },
          { itemId: MINI_BAG_ID, flavour: "Half & Half", quantity: 1 },
        ],
      }),
      { repo, email: deps, now: () => NOW },
    );

    expect(result).toHaveProperty("token");
    const [order] = insertOrder.mock.calls[0];
    expect(order).toMatchObject({
      status: "awaiting_payment",
      fulfilment: "delivery",
      subtotal_cents: 34500,
      total_cents: 34500,
      delivery_address: "12 Frederick St, Port of Spain",
      payment_window_started_at: NOW.toISOString(),
    });
    expect(order).not.toHaveProperty("delivery_fee_cents");
    const customer = sent.find((msg) => msg.to === "asha@example.test");
    expect(customer?.subject).toBe("Order BS-0001 received — awaiting payment");
    expect(customer?.html).toContain("Sample Bank");
    expect(customer?.html).toContain("Once your order is confirmed we will contact you with your total delivery amount.");
    expect(customer?.html).toContain("Delivery can be paid via cash or card upon delivery.");
  });

  test("refuses a date inside the lead time", async () => {
    const { repo, insertOrder } = fakeRepo();
    const { deps } = fakeEmail();

    const result = await createOrder(checkout({ date: "2026-11-27" }), {
      repo,
      email: deps,
      now: () => NOW,
    });

    expect(result).toEqual({
      field: "date",
      error: "Please choose a date at least 5 days from today.",
    });
    expect(insertOrder).not.toHaveBeenCalled();
  });

  test("refuses an impossible date", async () => {
    const { repo, insertOrder } = fakeRepo();
    const { deps } = fakeEmail();

    for (const date of ["2026-12-45", "2026-02-30"]) {
      const result = await createOrder(checkout({ date }), { repo, email: deps, now: () => NOW });
      expect(result).toEqual({
        field: "date",
        error: "Please choose a date at least 5 days from today.",
      });
    }
    expect(insertOrder).not.toHaveBeenCalled();
  });

  test("refuses a date beyond the 90-day horizon", async () => {
    const { repo, insertOrder } = fakeRepo();
    const { deps } = fakeEmail();

    const result = await createOrder(checkout({ date: "2027-03-01" }), {
      repo,
      email: deps,
      now: () => NOW,
    });

    expect(result).toEqual({ field: "date", error: "Please choose a date within the next 90 days." });
    expect(insertOrder).not.toHaveBeenCalled();
  });

  test("reprices from the database and ignores any price the client sends", async () => {
    const { repo, insertOrder } = fakeRepo();
    const { deps } = fakeEmail();

    await createOrder(
      checkout({
        lines: [{ itemId: RED_VELVET_ID, flavour: null, quantity: 2, unitPriceCents: 1, priceCents: 1 }],
      }),
      { repo, email: deps, now: () => NOW },
    );

    const [order, items] = insertOrder.mock.calls[0];
    expect(order.total_cents).toBe(60000);
    expect(items[0].unit_price_cents).toBe(30000);
  });

  test("refuses an inactive item", async () => {
    const { repo, insertOrder } = fakeRepo();
    const { deps } = fakeEmail();

    const result = await createOrder(
      checkout({ lines: [{ itemId: INACTIVE_ID, flavour: null, quantity: 1 }] }),
      { repo, email: deps, now: () => NOW },
    );

    expect(result).toEqual({
      field: "lines",
      error: "Old Sponge is no longer available. Remove it from your cart to continue.",
    });
    expect(insertOrder).not.toHaveBeenCalled();
  });

  test("refuses an item id that no longer exists", async () => {
    const { repo } = fakeRepo();
    const { deps } = fakeEmail();

    const result = await createOrder(
      checkout({ lines: [{ itemId: UNKNOWN_ID, flavour: null, quantity: 1 }] }),
      { repo, email: deps, now: () => NOW },
    );

    expect(result).toEqual({
      field: "lines",
      error: "An item is no longer available. Remove it from your cart to continue.",
    });
  });

  test("limit is per item across flavours", async () => {
    const { repo, insertOrder } = fakeRepo();
    const { deps } = fakeEmail();

    const result = await createOrder(
      checkout({
        lines: [
          { itemId: COOKIE_JAR_ID, flavour: "Coconut Butterscotch", quantity: 2 },
          { itemId: COOKIE_JAR_ID, flavour: "Half & Half", quantity: 1 },
        ],
      }),
      { repo, email: deps, now: () => NOW },
    );

    expect(result).toEqual({
      field: "lines",
      error: "You can order up to 2 Cookie Jar per order.",
    });
    expect(insertOrder).not.toHaveBeenCalled();
  });

  test("flavour required", async () => {
    const { repo, insertOrder } = fakeRepo();
    const { deps } = fakeEmail();

    const result = await createOrder(
      checkout({ lines: [{ itemId: MINI_BAG_ID, flavour: null, quantity: 1 }] }),
      { repo, email: deps, now: () => NOW },
    );

    expect(result).toEqual({ field: "lines", error: "Please choose a flavour for Mini Cookie Bag." });
    expect(insertOrder).not.toHaveBeenCalled();
  });

  test("same idempotency key returns the existing order", async () => {
    const { repo, insertOrder } = fakeRepo();
    const { deps, send } = fakeEmail();

    const first = await createOrder(checkout(), { repo, email: deps, now: () => NOW });
    const second = await createOrder(checkout(), { repo, email: deps, now: () => NOW });

    expect(second).toEqual(first);
    expect(insertOrder).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledTimes(2);
  });

  test("a date that filled up after the check is reported against the date field", async () => {
    const { repo, insertOrder } = fakeRepo();
    insertOrder.mockRejectedValueOnce(new DateUnavailableError());
    const { deps, send } = fakeEmail();

    const result = await createOrder(checkout(), { repo, email: deps, now: () => NOW });

    expect(result).toEqual({
      field: "date",
      error: "Sorry — that date just filled up. Please pick another date.",
    });
    expect(send).not.toHaveBeenCalled();
  });

  test("store closed refuses the order and inserts nothing", async () => {
    const { repo, insertOrder } = fakeRepo({ settings: { store_open: false } });
    const { deps } = fakeEmail();

    const result = await createOrder(checkout(), { repo, email: deps, now: () => NOW });

    expect(result).toEqual({ error: "We're not taking orders right now. Your cart is saved." });
    expect(insertOrder).not.toHaveBeenCalled();
  });

  test("blank allergies is refused against the allergies field", async () => {
    const { repo, insertOrder } = fakeRepo();
    const { deps } = fakeEmail();

    const result = await createOrder(checkout({ allergies: "   " }), { repo, email: deps, now: () => NOW });

    expect(result).toEqual({
      field: "allergies",
      error: "Please tell us about any allergies, or type None.",
    });
    expect(insertOrder).not.toHaveBeenCalled();
  });

  test("a 10-digit number without a country code is refused against the phone field", async () => {
    const { repo, insertOrder } = fakeRepo();
    const { deps } = fakeEmail();

    const result = await createOrder(checkout({ phone: "212 555 0100" }), {
      repo,
      email: deps,
      now: () => NOW,
    });

    expect(result).toEqual({ field: "phone", error: "Please enter a valid WhatsApp number" });
    expect(insertOrder).not.toHaveBeenCalled();
  });

  test("a Trinidad 7-digit number and a +1 868 number are both accepted", async () => {
    const { repo, insertOrder } = fakeRepo();
    const { deps } = fakeEmail();

    await createOrder(checkout({ phone: "555 0100" }), { repo, email: deps, now: () => NOW });
    await createOrder(checkout({ phone: "+1 868 555 0101", idempotencyKey: "idem-0002-abcdefgh" }), {
      repo,
      email: deps,
      now: () => NOW,
    });

    expect(insertOrder.mock.calls.map(([order]) => order.phone)).toEqual([
      "+1-868-555-0100",
      "+1-868-555-0101",
    ]);
  });

  test("a short name and a short delivery address are each refused against their own field", async () => {
    const { repo, insertOrder } = fakeRepo();
    const { deps } = fakeEmail();
    const delivery = { type: "delivery", address: "1 A" };

    expect(
      await createOrder(checkout({ name: "A" }), { repo, email: deps, now: () => NOW }),
    ).toEqual({ field: "name", error: "Please enter your name." });
    expect(
      await createOrder(checkout({ fulfilment: delivery }), { repo, email: deps, now: () => NOW }),
    ).toEqual({ field: "address", error: "Please enter your delivery address." });
    expect(insertOrder).not.toHaveBeenCalled();
  });

  test("an unaccepted policy is refused against the policy field", async () => {
    const { repo, insertOrder } = fakeRepo();
    const { deps } = fakeEmail();

    const result = await createOrder(checkout({ acceptPolicy: false }), {
      repo,
      email: deps,
      now: () => NOW,
    });

    expect(result).toEqual({ field: "policy", error: "Please accept the order policy to continue." });
    expect(insertOrder).not.toHaveBeenCalled();
  });

  test("with the site URL unset, no email is sent (links cannot be built) and the order still stands", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    const { repo, insertOrder } = fakeRepo();
    const { deps, sent } = fakeEmail();

    const result = await createOrder(checkout(), { repo, email: deps, now: () => NOW });

    expect(result).toHaveProperty("token");
    expect(insertOrder).toHaveBeenCalledTimes(1);
    expect(sent.map((msg) => msg.to)).toEqual([]);
    expect(errorLog).toHaveBeenCalled();
  });

  test("emails are deferred when a defer hook is given", async () => {
    const { repo } = fakeRepo();
    const { deps, send } = fakeEmail();
    const tasks: (() => Promise<void>)[] = [];

    await createOrder(checkout(), {
      repo,
      email: deps,
      now: () => NOW,
      defer: (task) => tasks.push(task),
    });

    expect(send).not.toHaveBeenCalled();
    await Promise.all(tasks.map((task) => task()));
    expect(send.mock.calls.map(([msg]) => msg.subject)).toEqual([
      "Order BS-0001 received — awaiting payment",
      "New order BS-0001 from Asha Mohan",
    ]);
  });

  test("no staff email when notify_email is not set", async () => {
    const { repo } = fakeRepo({ settings: { notify_email: null } });
    const { deps, send } = fakeEmail();

    await createOrder(checkout(), { repo, email: deps, now: () => NOW });

    expect(send.mock.calls.map(([msg]) => msg.subject)).toEqual([
      "Order BS-0001 received — awaiting payment",
    ]);
  });
});
