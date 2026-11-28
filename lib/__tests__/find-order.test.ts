import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FIND_ORDER_RESPONSE } from "@/lib/orders/find-order-response";

const mocks = vi.hoisted(() => ({
  /** Orders in the fake database, keyed by the email column as stored. */
  orders: [] as Array<{
    email: string;
    order_number: string;
    access_token: string;
    customer_name: string;
    fulfil_date: string;
    status: string;
    created_at: string;
  }>,
  /** Callbacks passed to next/server after(), run by flush(). */
  afterCallbacks: [] as Array<() => Promise<void>>,
  send: vi.fn<(message: { to: string; subject: string; html: string }) => Promise<{ id: string }>>(
    async () => ({ id: "msg-1" }),
  ),
}));

vi.mock("next/server", () => ({
  after: (fn: () => Promise<void>) => {
    mocks.afterCallbacks.push(fn);
  },
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminSupabase: () => ({
    from: () => {
      let pattern = "";
      const builder = {
        select: () => builder,
        ilike: (_column: string, value: string) => {
          pattern = value;
          return builder;
        },
        neq: () => builder,
        order: () => builder,
        limit: () => builder,
        then: (resolve: (value: unknown) => void) => {
          const rows = mocks.orders.filter((row) => row.email.toLowerCase() === pattern.toLowerCase());
          resolve({ data: rows, error: null });
        },
      };
      return builder;
    },
  }),
}));

vi.mock("@/lib/email/deps", () => ({
  defaultEmailDeps: () => ({
    provider: { send: (message: { to: string; subject: string; html: string }) => mocks.send(message) },
    log: async () => {},
  }),
}));

import { findOrderAction } from "@/app/(shop)/find-order/actions";

function form(email: string): FormData {
  const data = new FormData();
  data.set("email", email);
  return data;
}

/** Runs the work scheduled with after(), as Next does once the response has gone out. */
async function flush() {
  const callbacks = mocks.afterCallbacks.splice(0);
  for (const callback of callbacks) await callback();
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://shop.test");
  // Each call moves the clock on two minutes, so the 60-second cooldown never hides a send.
  let clock = 1_000_000;
  vi.spyOn(Date, "now").mockImplementation(() => (clock += 120_000));
  mocks.orders.length = 0;
  mocks.afterCallbacks.length = 0;
  mocks.send.mockClear();
  mocks.orders.push({
    email: "asha@example.test",
    order_number: "BS-0001",
    access_token: "tok_asha-111",
    customer_name: "Asha Mohan",
    fulfil_date: "2026-12-05",
    status: "confirmed",
    created_at: "2026-11-28T10:00:00Z",
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("findOrderAction", () => {
  test("unknown and known emails get the same response", async () => {
    const known = await findOrderAction(form("asha@example.test"));
    const unknown = await findOrderAction(form("nobody@example.test"));
    await flush();

    expect(known).toEqual(unknown);
    expect(known).toEqual(FIND_ORDER_RESPONSE);
  });

  test("the response is the same for an email typed in another case or with spaces", async () => {
    const known = await findOrderAction(form("  ASHA@Example.TEST "));
    await flush();

    expect(known).toEqual(FIND_ORDER_RESPONSE);
  });

  test("only a known email triggers the link email", async () => {
    await findOrderAction(form("nobody@example.test"));
    await flush();
    expect(mocks.send).not.toHaveBeenCalled();

    await findOrderAction(form("asha@example.test"));
    await flush();
    expect(mocks.send).toHaveBeenCalledTimes(1);
    expect(mocks.send.mock.calls[0][0].to).toBe("asha@example.test");
  });

  test("the response does not say whether the email has orders", async () => {
    const response = await findOrderAction(form("asha@example.test"));

    expect(JSON.stringify(response)).not.toContain("BS-0001");
    expect(JSON.stringify(response)).not.toContain("tok_asha-111");
    expect(response.message).toBe("If that email has orders, we've sent the links.");
  });
});
