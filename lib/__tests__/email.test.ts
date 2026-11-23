import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { brevoProvider, consoleProvider, sendTemplate } from "@/lib/email/send";
import type { EmailProvider } from "@/lib/email/types";
import { chooseProvider } from "@/lib/email/choose-provider";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("brevoProvider", () => {
  const from = { email: "orders@example.test", name: "Butter & Scotch" };

  test("posts to the Brevo API and returns messageId as id", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ messageId: "<brevo-42@smtp>" }), {
        status: 201,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = brevoProvider("test-key", from);
    const result = await provider.send({
      to: "asha@example.test",
      subject: "Hello",
      html: "<p>Hi</p>",
    });

    expect(result).toEqual({ id: "<brevo-42@smtp>" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("https://api.brevo.com/v3/smtp/email");
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers["api-key"]).toBe("test-key");
    expect(headers["content-type"]).toBe("application/json");
    expect(JSON.parse(init.body as string)).toEqual({
      sender: from,
      to: [{ email: "asha@example.test" }],
      subject: "Hello",
      htmlContent: "<p>Hi</p>",
    });
  });

  test("the request is aborted after a timeout so a hung send cannot stall the action", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ messageId: "<x@smtp>" }), {
        status: 201,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await brevoProvider("test-key", from).send({ to: "a@example.test", subject: "s", html: "h" });

    const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  test("a 401 response throws an error containing Brevo's message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({ code: "unauthorized", message: "Key not found" }),
          { status: 401, headers: { "content-type": "application/json" } },
        ),
      ),
    );

    const provider = brevoProvider("bad-key", from);
    await expect(
      provider.send({ to: "a@example.test", subject: "s", html: "h" }),
    ).rejects.toThrow("Key not found");
  });
});

describe("consoleProvider", () => {
  test("logs the email and returns a console id", async () => {
    const info = vi.spyOn(console, "log").mockImplementation(() => {});
    const provider = consoleProvider();

    const result = await provider.send({
      to: "asha@example.test",
      subject: "Hello",
      html: "<p>Hi</p>",
    });

    expect(result.id).toMatch(/^console-\d+$/);
    expect(info).toHaveBeenCalled();
  });
});

describe("order emails", () => {
  const SITE = "https://shop.test";
  const TOKEN = "tok-abc123";
  const bank = {
    bank: "Sample Bank",
    account_name: "Butter and Scotch Ltd",
    account_type: "Chequing",
    transit: "00100",
    account_no_same_bank: "1234567",
    account_no_other_bank: "7654321",
  };

  function recordingProvider() {
    const sent: { to: string; subject: string; html: string }[] = [];
    const provider: EmailProvider = {
      async send(msg) {
        sent.push(msg);
        return { id: `rec-${sent.length}` };
      },
    };
    return { sent, provider };
  }

  const deps = (provider: EmailProvider) => ({
    provider,
    log: async () => {},
  });

  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", SITE);
  });

  test("order_received asks for payment, shows bank details and links to the order", async () => {
    const { sent, provider } = recordingProvider();

    const result = await sendTemplate(deps(provider), {
      orderId: null,
      template: "order_received",
      to: "asha@example.test",
      data: {
        orderNumber: "BS-0007",
        token: TOKEN,
        customerName: "Asha",
        items: [{ name: "Red Velvet", flavour: null, quantity: 2, lineTotalCents: 60000 }],
        subtotalCents: 60000,
        deliveryFeeCents: null,
        totalCents: 60000,
        awaitingQuote: false,
        bank,
      },
    });

    expect(result).toEqual({ ok: true });
    expect(sent).toHaveLength(1);
    expect(sent[0].subject).toBe("Order BS-0007 received — awaiting payment");
    expect(sent[0].html).toContain("Your order is not confirmed until we receive and check your payment.");
    expect(sent[0].html).toContain("Sample Bank");
    expect(sent[0].html).toContain(`${SITE}/order/${TOKEN}`);
  });

  test("order_received awaiting a quote has no bank details and says so in the subject", async () => {
    const { sent, provider } = recordingProvider();

    await sendTemplate(deps(provider), {
      orderId: null,
      template: "order_received",
      to: "asha@example.test",
      data: {
        orderNumber: "BS-0008",
        token: TOKEN,
        customerName: "Asha",
        items: [{ name: "Red Velvet", flavour: null, quantity: 1, lineTotalCents: 30000 }],
        subtotalCents: 30000,
        deliveryFeeCents: null,
        totalCents: 30000,
        awaitingQuote: true,
        bank: null,
      },
    });

    expect(sent[0].subject).toBe("Order BS-0008 received — awaiting delivery quote");
    expect(sent[0].html).not.toContain("Sample Bank");
    expect(sent[0].html).toContain("Your order is not confirmed until we receive and check your payment.");
  });

  test("order_received for a delivery quote shows the subtotal as a price plus delivery, not a total", async () => {
    const { sent, provider } = recordingProvider();

    await sendTemplate(deps(provider), {
      orderId: null,
      template: "order_received",
      to: "asha@example.test",
      data: {
        orderNumber: "BS-0011",
        token: TOKEN,
        customerName: "Asha",
        items: [{ name: "Red Velvet", flavour: null, quantity: 2, lineTotalCents: 60000 }],
        subtotalCents: 60000,
        deliveryFeeCents: null,
        totalCents: 60000,
        awaitingQuote: true,
        bank: null,
      },
    });

    expect(sent[0].html).toMatch(/Total: TT\$600\.00 \+ delivery \(we(&#x27;|')ll email your total\)/);
    expect(sent[0].html).not.toMatch(/Total: TT\$600\.00<\/strong>/);
  });

  test("order_received for a pickup shows a plain total", async () => {
    const { sent, provider } = recordingProvider();

    await sendTemplate(deps(provider), {
      orderId: null,
      template: "order_received",
      to: "asha@example.test",
      data: {
        orderNumber: "BS-0012",
        token: TOKEN,
        customerName: "Asha",
        items: [{ name: "Red Velvet", flavour: null, quantity: 2, lineTotalCents: 60000 }],
        subtotalCents: 60000,
        deliveryFeeCents: null,
        totalCents: 60000,
        awaitingQuote: false,
        bank,
      },
    });

    expect(sent[0].html).toContain("Total: TT$600.00</strong>");
    expect(sent[0].html).not.toContain("+ delivery");
  });

  test("order_received names the bank account numbers the way the order page does", async () => {
    const { sent, provider } = recordingProvider();

    await sendTemplate(deps(provider), {
      orderId: null,
      template: "order_received",
      to: "asha@example.test",
      data: {
        orderNumber: "BS-0013",
        token: TOKEN,
        customerName: "Asha",
        items: [{ name: "Red Velvet", flavour: null, quantity: 1, lineTotalCents: 30000 }],
        subtotalCents: 30000,
        deliveryFeeCents: null,
        totalCents: 30000,
        awaitingQuote: false,
        bank,
      },
    });

    expect(sent[0].html).toContain("Account # (from Scotiabank)");
    expect(sent[0].html).toContain("Account # (from another bank)");
    expect(sent[0].html).not.toContain("Account number (same bank)");
  });

  test("order_links shows each fulfilment date in words, not as ISO", async () => {
    const { sent, provider } = recordingProvider();

    await sendTemplate(deps(provider), {
      orderId: null,
      template: "order_links",
      to: "asha@example.test",
      data: {
        customerName: "Asha",
        orders: [{ orderNumber: "BS-0014", token: TOKEN, fulfilDate: "2026-11-28" }],
      },
    });

    expect(sent[0].html).toContain("Saturday, 28 November 2026");
    expect(sent[0].html).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  test("staff_new_order names the customer and links to the admin order", async () => {
    const { sent, provider } = recordingProvider();

    const result = await sendTemplate(deps(provider), {
      orderId: null,
      template: "staff_new_order",
      to: "staff@example.test",
      data: {
        orderNumber: "BS-0009",
        customerName: "Asha Mohan",
        email: "asha@example.test",
        phone: "+1-868-555-0100",
        fulfilDate: "2026-11-28",
        totalCents: 60000,
        awaitingQuote: false,
        adminUrl: `${SITE}/admin/orders/abc`,
      },
    });

    expect(result).toEqual({ ok: true });
    expect(sent[0].subject).toBe("New order BS-0009 from Asha Mohan");
    expect(sent[0].html).toContain(`${SITE}/admin/orders/abc`);
  });
});

describe("payment proof emails", () => {
  const SITE = "https://shop.test";
  const TOKEN = "tok-proof456";

  function recordingProvider() {
    const sent: { to: string; subject: string; html: string }[] = [];
    const provider: EmailProvider = {
      async send(msg) {
        sent.push(msg);
        return { id: `rec-${sent.length}` };
      },
    };
    return { sent, provider };
  }

  const deps = (provider: EmailProvider) => ({
    provider,
    log: async () => {},
  });

  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", SITE);
  });

  test("proof_received thanks the customer, says the order is confirmed once staff check it, and links to the order", async () => {
    const { sent, provider } = recordingProvider();

    const result = await sendTemplate(deps(provider), {
      orderId: null,
      template: "proof_received",
      to: "asha@example.test",
      data: { orderNumber: "BS-0010", token: TOKEN, customerName: "Asha", totalCents: 64000 },
    });

    expect(result).toEqual({ ok: true });
    expect(sent[0].subject).toBe("We received your payment proof for BS-0010");
    expect(sent[0].html).toContain("Our team will check it");
    expect(sent[0].html).toContain("Once they do, your order is confirmed");
    expect(sent[0].html).toContain(`${SITE}/order/${TOKEN}`);
  });

  test("staff_proof_received names the order and links to the admin order", async () => {
    const { sent, provider } = recordingProvider();

    const result = await sendTemplate(deps(provider), {
      orderId: null,
      template: "staff_proof_received",
      to: "staff@example.test",
      data: {
        orderNumber: "BS-0010",
        customerName: "Asha Mohan",
        totalCents: 64000,
        adminUrl: `${SITE}/admin/orders/abc`,
      },
    });

    expect(result).toEqual({ ok: true });
    expect(sent[0].subject).toBe("Payment proof to check for BS-0010");
    expect(sent[0].html).toContain("Asha Mohan");
    expect(sent[0].html).toContain(`${SITE}/admin/orders/abc`);
  });
});

describe("chooseProvider", () => {
  test("production without EMAIL_PROVIDER=brevo fails loudly on send", async () => {
    const provider = chooseProvider({ NODE_ENV: "production" });
    await expect(
      provider.send({ to: "a@example.test", subject: "s", html: "h" }),
    ).rejects.toThrow("Email provider not configured (set EMAIL_PROVIDER=brevo)");
  });

  test("brevo without a key fails loudly on send", async () => {
    const provider = chooseProvider({
      NODE_ENV: "production",
      EMAIL_PROVIDER: "brevo",
      EMAIL_FROM: "orders@example.test",
    });
    await expect(
      provider.send({ to: "a@example.test", subject: "s", html: "h" }),
    ).rejects.toThrow("Brevo not configured (BREVO_API_KEY / EMAIL_FROM)");
  });

  test("brevo without a sender address fails loudly on send", async () => {
    const provider = chooseProvider({
      NODE_ENV: "production",
      EMAIL_PROVIDER: "brevo",
      BREVO_API_KEY: "k",
    });
    await expect(
      provider.send({ to: "a@example.test", subject: "s", html: "h" }),
    ).rejects.toThrow("Brevo not configured (BREVO_API_KEY / EMAIL_FROM)");
  });

  test("development without a provider uses the console provider", async () => {
    const info = vi.spyOn(console, "log").mockImplementation(() => {});
    const provider = chooseProvider({ NODE_ENV: "development" });
    const result = await provider.send({ to: "a@example.test", subject: "s", html: "h" });
    expect(result.id).toMatch(/^console-\d+$/);
    expect(info).toHaveBeenCalled();
  });
});


describe("order links emails", () => {
  const SITE = "https://shop.test";

  function recordingProvider() {
    const sent: { to: string; subject: string; html: string }[] = [];
    const provider: EmailProvider = {
      async send(msg) {
        sent.push(msg);
        return { id: `rec-${sent.length}` };
      },
    };
    return { sent, provider };
  }

  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", SITE);
  });

  test("order_links lists each order with its fulfilment date and private link", async () => {
    const { sent, provider } = recordingProvider();

    const result = await sendTemplate(
      { provider, log: async () => {} },
      {
        orderId: null,
        template: "order_links",
        to: "asha@example.test",
        data: {
          customerName: "Asha",
          orders: [
            { orderNumber: "BS-0002", token: "tok-new", fulfilDate: "2026-12-05" },
            { orderNumber: "BS-0001", token: "tok-old", fulfilDate: "2026-11-28" },
          ],
        },
      },
    );

    expect(result).toEqual({ ok: true });
    expect(sent[0].subject).toBe("Your Butter & Scotch orders");
    expect(sent[0].html).toContain("Hi Asha,");
    expect(sent[0].html).toContain("BS-0002");
    expect(sent[0].html).toContain("Saturday, 5 December 2026");
    expect(sent[0].html).toContain(`${SITE}/order/tok-new`);
    expect(sent[0].html).toContain("BS-0001");
    expect(sent[0].html).toContain("Saturday, 28 November 2026");
    expect(sent[0].html).toContain(`${SITE}/order/tok-old`);
  });
});
