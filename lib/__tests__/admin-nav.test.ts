import { describe, expect, test } from "vitest";
import { ADMIN_NAV, isActive } from "@/components/admin/nav-items";

describe("ADMIN_NAV", () => {
  test("has exactly the four staff sections in order", () => {
    expect(ADMIN_NAV.map((n) => n.label)).toEqual(["Today", "Orders", "Payments", "Settings"]);
  });

  test("hrefs match the admin routes", () => {
    expect(ADMIN_NAV.map((n) => n.href)).toEqual([
      "/admin",
      "/admin/orders",
      "/admin/payments",
      "/admin/settings",
    ]);
  });
});

describe("isActive", () => {
  test("/admin is active only on exactly /admin", () => {
    expect(isActive("/admin", "/admin")).toBe(true);
    expect(isActive("/admin/orders", "/admin")).toBe(false);
  });

  test("other items are active on their prefix", () => {
    expect(isActive("/admin/orders/abc", "/admin/orders")).toBe(true);
    expect(isActive("/admin/orders", "/admin/orders")).toBe(true);
    expect(isActive("/admin/payments", "/admin/orders")).toBe(false);
  });
});
