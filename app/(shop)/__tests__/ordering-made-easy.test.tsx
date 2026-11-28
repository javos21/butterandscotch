import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/lib/data/menu", () => ({
  getMenu: async () => ({ sections: [] }),
}));

vi.mock("@/lib/data/settings", () => ({
  getPublicSettings: async () => ({
    store_open: true,
    lead_time_days: 5,
    order_close_date: "2026-12-16",
    last_fulfilment_date: "2026-12-23",
    whatsapp_number: "+1-868-123-4567",
  }),
}));

import MenuPage from "../page";

const decode = (html: string) =>
  html
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x2F;/g, "/");

async function renderHome() {
  return decode(renderToStaticMarkup(await MenuPage()));
}

describe("home page Ordering made easy", () => {
  it("uses the revised heading, steps and copy", async () => {
    const html = await renderHome();

    expect(html).toContain("Ordering made easy");
    expect(html).toContain(">Choose your treats<");
    expect(html).not.toContain("Choose your bakes");
    expect(html).toContain(">Pick a date<");
    expect(html).toContain(">Pay to confirm<");
    expect(html).not.toContain(">See your total<");
    expect(html).toContain(
      "We want to ensure you get your treats for when you need them, so don't forget that your order is only confirmed once proof of payment is received and confirmed. Orders need a 5 day lead time.",
    );
    expect(html).not.toContain("Delivery fee included before checkout");
  });

  it("links the gifting line to WhatsApp", async () => {
    const html = await renderHome();

    expect(html.replace(/<[^>]+>/g, "")).toContain(
      "If you have gifting questions, catering needs, specific requests or dietary requirements, reach out to us before you order.",
    );
    expect(html).toMatch(/<a [^>]*href="https:\/\/wa\.me\/18681234567"[^>]*>reach out to us<\/a>/);
  });

  it("sits above the menu section", async () => {
    const html = await renderHome();

    const how = html.indexOf('id="how-heading"');
    const menu = html.indexOf('id="menu"');
    expect(how).toBeGreaterThan(-1);
    expect(menu).toBeGreaterThan(-1);
    expect(how).toBeLessThan(menu);
  });
});
