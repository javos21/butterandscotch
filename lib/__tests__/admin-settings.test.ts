import { describe, expect, test } from "vitest";
import {
  blockDates,
  settingsPatchSchema,
  unblockDate,
  updateSettings,
  type SettingsDeps,
  type SettingsRepo,
} from "@/lib/admin/settings";

const NOW = new Date("2026-11-23T14:00:00Z");
/** A settings row carrying the V2 column defaults from migration 0006. */
const defaults = {
  store_open: false,
  order_close_date: "2026-12-16",
  last_fulfilment_date: "2026-12-23",
  pickup_locations: ["West", "Chaguanas"],
};
const CLOSE_ORDER_ERROR = "Last fulfilment date must be on or after the order close date";
const STAFF_ID = "00000000-0000-0000-0000-0000000005a5";
const PHONE_ERROR = "Please enter a valid WhatsApp number";
const BANK = {
  bank: "Test Bank",
  account_name: "Test Account Holder",
  account_type: "Savings",
  transit: "00001",
  account_no_same_bank: "1111111",
  account_no_other_bank: "2222222",
};

type Calls = {
  settingsWrites: Record<string, unknown>[];
  upserts: { date: string; note: string | null }[][];
  deletes: string[];
};

function makeRepo(
  options: {
    policyText?: string;
    policyVersion?: number;
    closeDates?: { order_close_date: string; last_fulfilment_date: string };
  } = {},
) {
  const calls: Calls = { settingsWrites: [], upserts: [], deletes: [] };
  const repo: SettingsRepo = {
    async getPolicy() {
      return {
        policy_text: options.policyText ?? "Existing policy text for the shop.",
        policy_version: options.policyVersion ?? 3,
      };
    },
    async getCloseDates() {
      return options.closeDates ?? {
        order_close_date: defaults.order_close_date,
        last_fulfilment_date: defaults.last_fulfilment_date,
      };
    },
    async updateSettings(values) {
      calls.settingsWrites.push(values);
    },
    async upsertBlockedDates(rows) {
      calls.upserts.push(rows);
    },
    async deleteBlockedDate(date) {
      calls.deletes.push(date);
    },
  };
  const deps: SettingsDeps = { repo, staff: { userId: STAFF_ID }, now: () => NOW };
  return { deps, calls };
}

describe("settings schema", () => {
  test("reads the V2 close dates and pickup locations", () => {
    const parsed = settingsPatchSchema.parse(defaults);
    expect(parsed.order_close_date).toBe("2026-12-16");
    expect(parsed.last_fulfilment_date).toBe("2026-12-23");
    expect(parsed.pickup_locations).toEqual(["West", "Chaguanas"]);
  });
});

describe("updateSettings", () => {
  test("refuses a last fulfilment date before the order close date", async () => {
    const { deps, calls } = makeRepo();
    const result = await updateSettings({ last_fulfilment_date: "2026-12-10" }, deps);
    expect(result).toEqual({ error: CLOSE_ORDER_ERROR, field: "last_fulfilment_date" });
    expect(calls.settingsWrites).toHaveLength(0);
  });

  test("checks the new close date against the stored last fulfilment date", async () => {
    const { deps, calls } = makeRepo();
    const result = await updateSettings({ order_close_date: "2026-12-30" }, deps);
    expect(result).toEqual({ error: CLOSE_ORDER_ERROR, field: "last_fulfilment_date" });
    expect(calls.settingsWrites).toHaveLength(0);
  });

  test("saves close dates in order", async () => {
    const { deps, calls } = makeRepo();
    const result = await updateSettings(
      { order_close_date: "2026-12-14", last_fulfilment_date: "2026-12-21" },
      deps,
    );
    expect(result).toEqual({ ok: true });
    expect(calls.settingsWrites[0]).toEqual({
      order_close_date: "2026-12-14",
      last_fulfilment_date: "2026-12-21",
    });
  });

  test("saves a valid shop section", async () => {
    const { deps, calls } = makeRepo();
    const result = await updateSettings({ store_open: false, lead_time_days: 2, daily_order_cap: 30 }, deps);
    expect(result).toEqual({ ok: true });
    expect(calls.settingsWrites).toEqual([{ store_open: false, lead_time_days: 2, daily_order_cap: 30 }]);
  });

  test("refuses a lead time of 0 under lead_time_days", async () => {
    const { deps, calls } = makeRepo();
    const result = await updateSettings({ lead_time_days: 0 }, deps);
    expect(result).toEqual({ error: "Lead time must be between 1 and 60 days", field: "lead_time_days" });
    expect(calls.settingsWrites).toHaveLength(0);
  });

  test("refuses a daily limit above 200 under daily_order_cap", async () => {
    const { deps } = makeRepo();
    const result = await updateSettings({ daily_order_cap: 201 }, deps);
    expect(result).toEqual({ error: "Daily limit must be between 1 and 200 orders", field: "daily_order_cap" });
  });

  test("refuses a bad WhatsApp number under whatsapp_number", async () => {
    const { deps, calls } = makeRepo();
    const result = await updateSettings({ whatsapp_number: "12" }, deps);
    expect(result).toEqual({ error: PHONE_ERROR, field: "whatsapp_number" });
    expect(calls.settingsWrites).toHaveLength(0);
  });

  test("stores a WhatsApp number in normalised form", async () => {
    const { deps, calls } = makeRepo();
    await updateSettings({ whatsapp_number: "868 555 1234" }, deps);
    expect(calls.settingsWrites[0]).toEqual({ whatsapp_number: "+1-868-555-1234" });
  });

  test("bumps policy_version when the policy text changes", async () => {
    const { deps, calls } = makeRepo({ policyText: "Existing policy text for the shop.", policyVersion: 3 });
    await updateSettings({ policy_text: "A brand new policy for orders." }, deps);
    expect(calls.settingsWrites[0]).toMatchObject({
      policy_text: "A brand new policy for orders.",
      policy_version: 4,
    });
  });

  test("leaves policy_version alone when the policy text is unchanged", async () => {
    const { deps, calls } = makeRepo({ policyText: "Existing policy text for the shop.", policyVersion: 3 });
    await updateSettings({ policy_text: "Existing policy text for the shop." }, deps);
    expect(calls.settingsWrites[0]).not.toHaveProperty("policy_version");
  });

  test("trims bank details before saving", async () => {
    const { deps, calls } = makeRepo();
    await updateSettings({ bank_details: { ...BANK, bank: "  Test Bank  " } }, deps);
    expect(calls.settingsWrites[0]).toMatchObject({ bank_details: { ...BANK, bank: "Test Bank" } });
  });

  test("refuses a blank bank field under its field name", async () => {
    const { deps } = makeRepo();
    const result = await updateSettings({ bank_details: { ...BANK, transit: "   " } }, deps);
    expect(result).toMatchObject({ field: "bank_details.transit" });
  });

  test("stores a blank notify email as null", async () => {
    const { deps, calls } = makeRepo();
    await updateSettings({ notify_email: "" }, deps);
    expect(calls.settingsWrites[0]).toEqual({ notify_email: null });
  });

  test("refuses an invalid notify email", async () => {
    const { deps } = makeRepo();
    const result = await updateSettings({ notify_email: "not-an-email" }, deps);
    expect(result).toEqual({ error: "Enter a valid notification email", field: "notify_email" });
  });
});

describe("blockDates", () => {
  test("blocks a single date with a trimmed note", async () => {
    const { deps, calls } = makeRepo();
    const result = await blockDates({ from: "2026-12-01", note: "  Shop closed  " }, deps);
    expect(result).toEqual({ ok: true });
    expect(calls.upserts[0]).toEqual([{ date: "2026-12-01", note: "Shop closed" }]);
  });

  test("blocks every day in a range", async () => {
    const { deps, calls } = makeRepo();
    await blockDates({ from: "2026-12-24", to: "2026-12-26" }, deps);
    expect(calls.upserts[0]!.map((row) => row.date)).toEqual(["2026-12-24", "2026-12-25", "2026-12-26"]);
  });

  test("refuses a 61-day range", async () => {
    const { deps, calls } = makeRepo();
    const result = await blockDates({ from: "2026-12-01", to: "2027-01-30" }, deps);
    expect(result).toEqual({ error: "Block at most 60 days at a time", field: "to" });
    expect(calls.upserts).toHaveLength(0);
  });

  test("accepts a 60-day range", async () => {
    const { deps } = makeRepo();
    const result = await blockDates({ from: "2026-12-01", to: "2027-01-29" }, deps);
    expect(result).toEqual({ ok: true });
  });

  test("refuses a date in the past", async () => {
    const { deps, calls } = makeRepo();
    const result = await blockDates({ from: "2026-11-22" }, deps);
    expect(result).toEqual({ error: "Pick today or a later date", field: "from" });
    expect(calls.upserts).toHaveLength(0);
  });

  test("accepts today", async () => {
    const { deps } = makeRepo();
    const result = await blockDates({ from: "2026-11-23" }, deps);
    expect(result).toEqual({ ok: true });
  });

  test("refuses an end date before the start date", async () => {
    const { deps } = makeRepo();
    const result = await blockDates({ from: "2026-12-05", to: "2026-12-01" }, deps);
    expect(result).toMatchObject({ field: "to" });
  });
});

describe("unblockDate", () => {
  test("removes the blocked date", async () => {
    const { deps, calls } = makeRepo();
    const result = await unblockDate("2026-12-01", deps);
    expect(result).toEqual({ ok: true });
    expect(calls.deletes).toEqual(["2026-12-01"]);
  });

  test("refuses a malformed date", async () => {
    const { deps, calls } = makeRepo();
    const result = await unblockDate("1 Dec", deps);
    expect(result).toMatchObject({ error: expect.any(String) });
    expect(calls.deletes).toHaveLength(0);
  });
});
