import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { normaliseEmail } from "@/lib/customers/normalise-email";
import { createOrder, type NewOrder, type OrderRef, type OrderRepo } from "@/lib/orders/create-order";
import type { EmailDeps } from "@/lib/email/types";
import type { Item, Settings } from "@/lib/types";
import { checkoutSchema } from "@/lib/validation";

const NOW = new Date("2026-11-23T12:00:00Z");
const RED_VELVET_ID = "11111111-1111-4111-8111-111111111111";

describe("normaliseEmail", () => {
  test("trims and lowercases, so both spellings match", () => {
    expect(normaliseEmail("Anna@X.com ")).toBe("anna@x.com");
    expect(normaliseEmail("  anna@x.com")).toBe("anna@x.com");
    expect(normaliseEmail("Anna@X.com ")).toBe(normaliseEmail("anna@x.com"));
  });
});

describe("checkoutSchema broadcast opt-in", () => {
  const base = {
    name: "Anna",
    email: "anna@x.com",
    phone: "868 123 4567",
    fulfilment: { type: "pickup", location: "West" },
    date: "2026-12-20",
    allergies: "None",
    acceptPolicy: true,
    idempotencyKey: "k".repeat(20),
    lines: [{ itemId: RED_VELVET_ID, flavour: null, quantity: 1 }],
  };

  test("broadcastOptIn defaults to false and replaces marketingOptIn", () => {
    const parsed = checkoutSchema.parse(base);
    expect(parsed.broadcastOptIn).toBe(false);
    expect(parsed).not.toHaveProperty("marketingOptIn");
  });

  test("keeps broadcastOptIn when the customer ticks the box", () => {
    expect(checkoutSchema.parse({ ...base, broadcastOptIn: true }).broadcastOptIn).toBe(true);
  });

  test("trims an email with surrounding spaces before validating it", () => {
    expect(checkoutSchema.parse({ ...base, email: " Anna@X.com " }).email).toBe("anna@x.com");
  });
});

// --- createOrder hands the normalised email, opt-in and typed name to the repo ---------------

const BANK = {
  bank: "Sample Bank",
  account_name: "Butter and Scotch Ltd",
  account_type: "Chequing",
  transit: "00100",
  account_no_same_bank: "1234567",
  account_no_other_bank: "7654321",
};

const settings: Settings = {
  id: 1,
  store_open: true,
  lead_time_days: 5,
  daily_order_cap: 10,
  bank_details: BANK,
  pickup_info: "",
  policy_text: "Policy text",
  policy_version: 3,
  whatsapp_number: "",
  notify_email: null,
  order_close_date: "2026-12-16",
  last_fulfilment_date: "2026-12-23",
  pickup_locations: ["West", "Chaguanas"],
  updated_at: "2026-11-11T00:00:00Z",
} as unknown as Settings;

const redVelvet = {
  id: RED_VELVET_ID,
  name: "Red Velvet",
  unit_label: "cake",
  price_cents: 30000,
  flavours: [],
  max_qty: 10,
  active: true,
} as unknown as Item;

function fakeRepo() {
  const inserted: NewOrder[] = [];
  let seq = 0;
  const repo: OrderRepo = {
    getSettings: vi.fn(async () => settings),
    getItems: vi.fn(async () => [redVelvet]),
    findByIdempotencyKey: vi.fn(async () => null),
    insertOrder: vi.fn(async (order: NewOrder) => {
      inserted.push(order);
      seq += 1;
      const ref: OrderRef = {
        id: `00000000-0000-4000-8000-00000000000${seq}`,
        orderNumber: `BS-000${seq}`,
        token: order.access_token,
      };
      return { ...ref, created: true };
    }),
  };
  return { repo, inserted };
}

const emailDeps: EmailDeps = {
  provider: { send: vi.fn(async () => ({ id: "msg" })) },
  log: vi.fn(async () => {}),
};

function checkout(overrides: Record<string, unknown> = {}) {
  return {
    name: "Anna",
    email: "Anna@X.com ",
    phone: "868 555 0100",
    fulfilment: { type: "pickup", location: "West" },
    date: "2026-11-28",
    allergies: "None",
    acceptPolicy: true,
    idempotencyKey: "idem-customers-0001",
    lines: [{ itemId: RED_VELVET_ID, flavour: null, quantity: 1 }],
    ...overrides,
  };
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://shop.test");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("createOrder customer fields", () => {
  test("passes the normalised email and the broadcast opt-in to the repo", async () => {
    const { repo, inserted } = fakeRepo();
    await createOrder(checkout({ broadcastOptIn: true }), {
      repo,
      email: emailDeps,
      now: () => NOW,
    });
    expect(inserted[0].email).toBe("anna@x.com");
    expect(inserted[0].broadcast_opt_in).toBe(true);
  });

  test("the order keeps the name as typed, for the snapshot", async () => {
    const { repo, inserted } = fakeRepo();
    await createOrder(checkout({ name: "Anna B", idempotencyKey: "idem-customers-0002" }), {
      repo,
      email: emailDeps,
      now: () => NOW,
    });
    expect(inserted[0].customer_name).toBe("Anna B");
  });
});
