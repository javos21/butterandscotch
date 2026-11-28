import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { resendOrderLinks, type ResendLinksDeps, type ResendOrder } from "@/lib/orders/resend-links";
import { FIND_ORDER_RESPONSE } from "@/lib/orders/find-order-response";
import type { EmailDeps, EmailLogEntry } from "@/lib/email/send";

const SITE = "https://shop.test";

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", SITE);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

type SendMessage = { to: string; subject: string; html: string };

/** Fake repo returns the rows given, already in created_at desc order (as the real query does). */
function fakeDeps(orders: ResendOrder[] = []) {
  const findOrdersByEmail = vi.fn<(email: string) => Promise<ResendOrder[]>>(async () => orders);
  const send = vi.fn<(msg: SendMessage) => Promise<{ id: string }>>(async () => ({ id: "msg-1" }));
  const log = vi.fn<(entry: EmailLogEntry) => Promise<void>>(async () => {});
  const email: EmailDeps = { provider: { send }, log };
  const deps: ResendLinksDeps = { repo: { findOrdersByEmail }, email };
  return { deps, findOrdersByEmail, send, log };
}

const ASHA_ORDERS: ResendOrder[] = [
  {
    orderNumber: "BS-0002",
    token: "tok_newer-222",
    customerName: "Asha Mohan",
    fulfilDate: "2026-12-05",
  },
  {
    orderNumber: "BS-0001",
    token: "tok_older-111",
    customerName: "Asha M.",
    fulfilDate: "2026-11-28",
  },
];

describe("resendOrderLinks", () => {
  test("an unknown email returns ok and sends nothing", async () => {
    const { deps, send } = fakeDeps([]);

    const result = await resendOrderLinks("nobody@example.test", deps);

    expect(result).toEqual(FIND_ORDER_RESPONSE);
    expect(send).not.toHaveBeenCalled();
  });

  test("a known email with 2 orders sends one email containing both links", async () => {
    const { deps, send } = fakeDeps(ASHA_ORDERS);

    const result = await resendOrderLinks("asha@example.test", deps);

    expect(result).toEqual(FIND_ORDER_RESPONSE);
    expect(send).toHaveBeenCalledTimes(1);
    const msg = send.mock.calls[0][0];
    expect(msg.to).toBe("asha@example.test");
    expect(msg.subject).toBe("Your Butter & Scotch orders");
    expect(msg.html).toContain("BS-0001");
    expect(msg.html).toContain("BS-0002");
    expect(msg.html).toContain(`${SITE}/order/tok_older-111`);
    expect(msg.html).toContain(`${SITE}/order/tok_newer-222`);
    // Greeting uses the most recent order's name.
    expect(msg.html).toContain("Hi Asha Mohan,");
  });

  test("each order's fulfilment date reaches the email", async () => {
    const { deps, send } = fakeDeps(ASHA_ORDERS);

    await resendOrderLinks("asha@example.test", deps);

    const msg = send.mock.calls[0][0];
    expect(msg.html).toContain("Saturday, 5 December 2026");
    expect(msg.html).toContain("Saturday, 28 November 2026");
  });

  test("an invalid email returns ok and sends nothing", async () => {
    const { deps, findOrdersByEmail, send } = fakeDeps(ASHA_ORDERS);

    const result = await resendOrderLinks("not-an-email", deps);

    expect(result).toEqual(FIND_ORDER_RESPONSE);
    expect(findOrdersByEmail).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  test("uppercase and whitespace input finds the orders", async () => {
    const { deps, findOrdersByEmail, send } = fakeDeps(ASHA_ORDERS);

    const result = await resendOrderLinks("  ASHA@Example.TEST \n", deps);

    expect(result).toEqual(FIND_ORDER_RESPONSE);
    expect(findOrdersByEmail).toHaveBeenCalledWith("asha@example.test");
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].to).toBe("asha@example.test");
  });
});
