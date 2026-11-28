import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  broadcastCsv,
  csvField,
  listCustomers,
  summariseCustomers,
  type CustomerOrderRecord,
  type CustomerRecord,
} from "@/lib/admin/customers";
import { GET } from "@/app/admin/(protected)/customers/export/route";

vi.mock("server-only", () => ({}));

// A tiny stand-in for the service-role client: it applies eq / neq / not filters to in-memory rows.
const fake = vi.hoisted(() => {
  const state = {
    tables: {} as Record<string, Array<Record<string, unknown>>>,
    touched: [] as string[],
  };

  function builder(table: string) {
    const predicates: Array<(row: Record<string, unknown>) => boolean> = [];
    const api = {
      select: () => api,
      order: () => api,
      eq: (column: string, value: unknown) => {
        predicates.push((row) => row[column] === value);
        return api;
      },
      neq: (column: string, value: unknown) => {
        predicates.push((row) => row[column] !== value);
        return api;
      },
      not: (column: string, _operator: string, value: unknown) => {
        predicates.push((row) => row[column] !== value);
        return api;
      },
      then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
        Promise.resolve({
          data: (state.tables[table] ?? []).filter((row) => predicates.every((test) => test(row))),
          error: null,
        }).then(resolve, reject),
    };
    return api;
  }

  return {
    state,
    from: (table: string) => {
      state.touched.push(table);
      return builder(table);
    },
    requireStaff: vi.fn(),
  };
});

vi.mock("@/lib/auth/require-staff", () => ({ requireStaff: fake.requireStaff }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminSupabase: () => ({ from: fake.from }),
}));

function customer(overrides: Partial<CustomerRecord> & { id: string; email: string }): CustomerRecord {
  return {
    name: null,
    phone: null,
    broadcast_opt_in: false,
    broadcast_opt_in_at: null,
    community_opt_in: false,
    ...overrides,
  };
}

function order(customerId: string | null, totalCents: number, status = "paid"): CustomerOrderRecord {
  return { customer_id: customerId, total_cents: totalCents, status };
}

const anna = customer({
  id: "c-anna",
  email: "anna@x.com",
  name: "Anna",
  phone: "868 555 0100",
  broadcast_opt_in: true,
  broadcast_opt_in_at: "2026-11-01T10:00:00.000Z",
});
const ben = customer({ id: "c-ben", email: "ben@x.com", name: "Ben", phone: "868 555 0200" });
const cara = customer({ id: "c-cara", email: "cara@x.com", name: "Cara", broadcast_opt_in: true, broadcast_opt_in_at: "2026-11-02T10:00:00.000Z" });

beforeEach(() => {
  fake.state.tables = {};
  fake.state.touched = [];
  fake.requireStaff.mockReset();
  fake.requireStaff.mockResolvedValue({ userId: "staff-1", name: "Staff" });
});

describe("summariseCustomers", () => {
  test("a customer with two orders totals both", () => {
    const [row] = summariseCustomers(
      [anna],
      [order("c-anna", 30000), order("c-anna", 12500)],
    ).filter((r) => r.id === "c-anna");
    expect(row.orderCount).toBe(2);
    expect(row.totalSpentCents).toBe(42500);
  });

  test("a customer with no orders has orderCount 0 and nothing spent", () => {
    const row = summariseCustomers([ben], []).find((r) => r.id === "c-ben");
    expect(row?.orderCount).toBe(0);
    expect(row?.totalSpentCents).toBe(0);
  });

  test("cancelled orders are left out of both the count and the total", () => {
    const row = summariseCustomers(
      [anna],
      [order("c-anna", 30000), order("c-anna", 9999, "cancelled")],
    )[0];
    expect(row.orderCount).toBe(1);
    expect(row.totalSpentCents).toBe(30000);
  });

  test("orders from other customers, or with no customer, do not count", () => {
    const row = summariseCustomers(
      [anna],
      [order("c-ben", 5000), order(null, 7000), order("c-anna", 1000)],
    )[0];
    expect(row.orderCount).toBe(1);
    expect(row.totalSpentCents).toBe(1000);
  });

  test("the optedIn filter keeps only broadcast opt-ins", () => {
    const rows = summariseCustomers([anna, ben, cara], [], { optedIn: true });
    expect(rows.map((r) => r.id).sort()).toEqual(["c-anna", "c-cara"]);
  });
});

describe("broadcastCsv", () => {
  test("the export contains only opted-in customers", () => {
    const csv = broadcastCsv([anna, ben, cara]);
    const lines = csv.trim().split("\r\n");
    expect(lines).toHaveLength(3);
    expect(csv).not.toContain("ben@x.com");
    expect(csv).toContain("anna@x.com");
    expect(csv).toContain("cara@x.com");
  });

  test("the header is email,name,phone,broadcast_opt_in_at and each row follows it", () => {
    const [header, firstRow] = broadcastCsv([anna]).trim().split("\r\n");
    expect(header).toBe("email,name,phone,broadcast_opt_in_at");
    expect(firstRow).toBe("anna@x.com,Anna,868 555 0100,2026-11-01T10:00:00.000Z");
  });

  test("a missing name or phone becomes an empty field", () => {
    const [, row] = broadcastCsv([customer({ id: "c-x", email: "x@x.com", broadcast_opt_in: true })])
      .trim()
      .split("\r\n");
    expect(row).toBe("x@x.com,,,");
  });

  test("commas, quotes and line breaks in a field are escaped", () => {
    const tricky = customer({
      id: "c-t",
      email: "t@x.com",
      name: 'Smith, "Sam"',
      phone: "line1\nline2",
      broadcast_opt_in: true,
      broadcast_opt_in_at: "2026-11-03T10:00:00.000Z",
    });
    const [, row] = broadcastCsv([tricky]).split("\r\n").slice(0, 2);
    expect(row).toBe('t@x.com,"Smith, ""Sam""","line1\nline2",2026-11-03T10:00:00.000Z');
  });
});

describe("csvField", () => {
  test("plain text is left alone, and null becomes empty", () => {
    expect(csvField("Anna")).toBe("Anna");
    expect(csvField(null)).toBe("");
  });

  test("a value starting with = gets a leading quote", () => {
    expect(csvField("=cmd")).toBe("'=cmd");
  });

  test("a value starting with @ gets a leading quote", () => {
    expect(csvField("@SUM(A1)")).toBe("'@SUM(A1)");
  });

  test("a value starting with - gets a leading quote", () => {
    expect(csvField("-2+3")).toBe("'-2+3");
  });

  test("a value starting with a tab gets a leading quote", () => {
    expect(csvField("\tx")).toBe("'\tx");
  });

  test("a value that needs both the quote and RFC 4180 quoting gets both, quote first", () => {
    expect(csvField("=1,2")).toBe("\"'=1,2\"");
  });

  test("a stored phone starting with + is not prefixed", () => {
    expect(csvField("+18685551234", "phone")).toBe("+18685551234");
  });

  test("the phone exemption does not cover other columns", () => {
    expect(csvField("+18685551234")).toBe("'+18685551234");
  });

  test("a stored phone is exported as +1868... through broadcastCsv", () => {
    const row = broadcastCsv([
      customer({
        id: "c-p",
        email: "p@x.com",
        name: "=Pat",
        phone: "+18685551234",
        broadcast_opt_in: true,
        broadcast_opt_in_at: "2026-11-04T10:00:00.000Z",
      }),
    ]).split("\r\n")[1];
    expect(row).toBe("p@x.com,'=Pat,+18685551234,2026-11-04T10:00:00.000Z");
  });
});

describe("listCustomers", () => {
  test("requireStaff runs before any table is read", async () => {
    fake.requireStaff.mockRejectedValueOnce(new Error("not staff"));
    await expect(listCustomers()).rejects.toThrow("not staff");
    expect(fake.state.touched).toEqual([]);
  });

  test("returns the summaries, and counts only linked, non-cancelled orders", async () => {
    fake.state.tables = {
      customers: [anna, ben],
      orders: [
        { customer_id: "c-anna", total_cents: 30000, status: "paid" },
        { customer_id: "c-anna", total_cents: 4000, status: "cancelled" },
        { customer_id: "c-anna", total_cents: 6000, status: "completed" },
        { customer_id: null, total_cents: 900, status: "paid" },
      ],
    };
    const rows = await listCustomers();
    expect(fake.requireStaff).toHaveBeenCalledTimes(1);
    const annaRow = rows.find((r) => r.id === "c-anna");
    expect(annaRow).toEqual({
      id: "c-anna",
      email: "anna@x.com",
      name: "Anna",
      phone: "868 555 0100",
      orderCount: 2,
      totalSpentCents: 36000,
      broadcastOptIn: true,
      communityOptIn: false,
    });
    expect(rows.find((r) => r.id === "c-ben")?.orderCount).toBe(0);
  });

  test("the optedIn filter is applied to the list", async () => {
    fake.state.tables = { customers: [anna, ben, cara], orders: [] };
    const rows = await listCustomers({ optedIn: true });
    expect(rows.map((r) => r.id).sort()).toEqual(["c-anna", "c-cara"]);
  });
});

describe("GET /admin/customers/export", () => {
  test("requireStaff runs before any customer is read", async () => {
    fake.requireStaff.mockRejectedValueOnce(new Error("not staff"));
    await expect(GET()).rejects.toThrow("not staff");
    expect(fake.state.touched).toEqual([]);
  });

  test("responds with a CSV attachment of opted-in customers only", async () => {
    fake.state.tables = { customers: [anna, ben, cara] };
    const response = await GET();
    expect(response.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
    expect(response.headers.get("Content-Disposition")).toBe('attachment; filename="broadcast-customers.csv"');
    const body = await response.text();
    expect(body.split("\r\n")[0]).toBe("email,name,phone,broadcast_opt_in_at");
    expect(body).toContain("anna@x.com");
    expect(body).toContain("cara@x.com");
    expect(body).not.toContain("ben@x.com");
  });
});
