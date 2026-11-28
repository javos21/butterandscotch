import { z } from "zod";
import { addDays, trinidadToday } from "@/lib/dates";
import { PHONE_MESSAGE } from "@/lib/validation";
import { normalisePhone } from "@/lib/phone";
import type { BankDetails } from "@/lib/types";

const LEAD_TIME_ERROR = "Lead time must be between 1 and 60 days";
const DAILY_CAP_ERROR = "Daily limit must be between 1 and 200 orders";
const EMAIL_ERROR = "Enter a valid notification email";
const DATE_ERROR = "Pick a valid date";
const CLOSE_ORDER_ERROR = "Last fulfilment date must be on or after the order close date";
const PICKUP_ERROR = "Enter between 1 and 10 pickup locations, each up to 60 characters";
const PAST_DATE_ERROR = "Pick today or a later date";
const SPAN_ERROR = "Block at most 60 days at a time";
const ORDER_ERROR = "The end date can't be before the start date";
const NOTE_ERROR = "Note must be 200 characters or fewer";
const MAX_BLOCK_DAYS = 60;
const DAY_MS = 86_400_000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const BANK_LABELS: Record<keyof BankDetails, string> = {
  bank: "Bank",
  account_name: "Account name",
  account_type: "Account type",
  transit: "Transit number",
  account_no_same_bank: "Account number (same bank)",
  account_no_other_bank: "Account number (other bank)",
};

const bankField = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(80, `${label} must be 80 characters or fewer`);

const bankDetailsSchema = z.object({
  bank: bankField(BANK_LABELS.bank),
  account_name: bankField(BANK_LABELS.account_name),
  account_type: bankField(BANK_LABELS.account_type),
  transit: bankField(BANK_LABELS.transit),
  account_no_same_bank: bankField(BANK_LABELS.account_no_same_bank),
  account_no_other_bank: bankField(BANK_LABELS.account_no_other_bank),
});

const isoDate = z
  .string()
  .refine((value) => isIsoDate(value), { message: DATE_ERROR });

const pickupLocationsSchema = z
  .array(z.string().trim().min(1, PICKUP_ERROR).max(60, PICKUP_ERROR))
  .min(1, PICKUP_ERROR)
  .max(10, PICKUP_ERROR);

/** Every settings field. Each form section sends only its own fields, so every field is optional on save. */
const settingsFields = {
  store_open: z.boolean(),
  order_close_date: isoDate,
  last_fulfilment_date: isoDate,
  pickup_locations: pickupLocationsSchema,
  lead_time_days: z
    .number("Lead time must be a whole number of days")
    .int(LEAD_TIME_ERROR)
    .min(1, LEAD_TIME_ERROR)
    .max(60, LEAD_TIME_ERROR),
  daily_order_cap: z
    .number("Daily limit must be a whole number")
    .int(DAILY_CAP_ERROR)
    .min(1, DAILY_CAP_ERROR)
    .max(200, DAILY_CAP_ERROR),
  bank_details: bankDetailsSchema,
  pickup_info: z.string().trim().max(1000, "Pickup info must be 1000 characters or fewer"),
  policy_text: z
    .string()
    .trim()
    .min(1, "Policy text is required")
    .max(5000, "Policy text must be 5000 characters or fewer"),
  whatsapp_number: z.string().transform((value, ctx) => {
    const normalised = normalisePhone(value);
    if (!normalised) {
      ctx.addIssue({ code: "custom", message: PHONE_MESSAGE });
      return z.NEVER;
    }
    return normalised;
  }),
  notify_email: z.string().trim().transform((value, ctx) => {
    if (value === "") return null;
    if (!z.email().safeParse(value).success) {
      ctx.addIssue({ code: "custom", message: EMAIL_ERROR });
      return z.NEVER;
    }
    return value;
  }),
};

export const settingsSchema = z.object(settingsFields);
export const settingsPatchSchema = settingsSchema.partial();

export type SettingsPatchInput = z.input<typeof settingsPatchSchema>;
export type SettingsPatch = z.output<typeof settingsPatchSchema>;

/** Columns written to the settings row. policy_version is set only when the policy text changes. */
export type SettingsUpdate = SettingsPatch & { policy_version?: number };

export type SettingsRepo = {
  getPolicy(): Promise<{ policy_text: string; policy_version: number }>;
  /** The stored order close date and last fulfilment date, used to check a partial update. */
  getCloseDates(): Promise<{ order_close_date: string; last_fulfilment_date: string }>;
  /** Updates the single settings row (id = 1). */
  updateSettings(values: SettingsUpdate): Promise<void>;
  /** Inserts or replaces blocked dates. */
  upsertBlockedDates(rows: { date: string; note: string | null }[]): Promise<void>;
  deleteBlockedDate(date: string): Promise<void>;
};

export type SettingsDeps = {
  repo: SettingsRepo;
  staff: { userId: string };
  now: () => Date;
};

export type SettingsResult = { ok: true } | { error: string; field?: string };

/** Maps the first zod issue to a message and the dotted field path it belongs to. */
function firstIssue(error: z.ZodError): SettingsResult {
  const issue = error.issues[0];
  const field = issue?.path.join(".");
  return { error: issue?.message ?? "Something went wrong — refresh and try again", ...(field ? { field } : {}) };
}

/** Saves the fields of one settings section. Changing policy_text bumps policy_version by one. */
export async function updateSettings(input: SettingsPatchInput, deps: SettingsDeps): Promise<SettingsResult> {
  const parsed = settingsPatchSchema.safeParse(input);
  if (!parsed.success) return firstIssue(parsed.error);

  const values: SettingsUpdate = { ...parsed.data };

  if (parsed.data.order_close_date !== undefined || parsed.data.last_fulfilment_date !== undefined) {
    const stored = await deps.repo.getCloseDates();
    const closeDate = parsed.data.order_close_date ?? stored.order_close_date;
    const lastDate = parsed.data.last_fulfilment_date ?? stored.last_fulfilment_date;
    if (lastDate < closeDate) return { error: CLOSE_ORDER_ERROR, field: "last_fulfilment_date" };
  }

  if (parsed.data.policy_text !== undefined) {
    const current = await deps.repo.getPolicy();
    if (current.policy_text !== parsed.data.policy_text) {
      values.policy_version = current.policy_version + 1;
    }
  }

  await deps.repo.updateSettings(values);
  return { ok: true };
}

function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  return !Number.isNaN(time) && new Date(time).toISOString().slice(0, 10) === value;
}

/** Whole days from one ISO date to another, both in UTC. */
function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

/** Blocks one date or an inclusive range of up to 60 days, from today in Trinidad onwards. */
export async function blockDates(
  input: { from: string; to?: string; note?: string },
  deps: Pick<SettingsDeps, "repo" | "now">,
): Promise<SettingsResult> {
  if (!isIsoDate(input.from)) return { error: DATE_ERROR, field: "from" };
  const to = input.to ? input.to : input.from;
  if (!isIsoDate(to)) return { error: DATE_ERROR, field: "to" };

  if (daysBetween(input.from, trinidadToday(deps.now())) > 0) {
    return { error: PAST_DATE_ERROR, field: "from" };
  }
  if (to < input.from) return { error: ORDER_ERROR, field: "to" };

  const span = daysBetween(input.from, to) + 1;
  if (span > MAX_BLOCK_DAYS) return { error: SPAN_ERROR, field: "to" };

  const note = (input.note ?? "").trim();
  if (note.length > 200) return { error: NOTE_ERROR, field: "note" };

  const rows = Array.from({ length: span }, (_, offset) => ({
    date: addDays(input.from, offset),
    note: note === "" ? null : note,
  }));
  await deps.repo.upsertBlockedDates(rows);
  return { ok: true };
}

/** Removes one blocked date. */
export async function unblockDate(date: string, deps: Pick<SettingsDeps, "repo">): Promise<SettingsResult> {
  if (!isIsoDate(date)) return { error: DATE_ERROR, field: "date" };
  await deps.repo.deleteBlockedDate(date);
  return { ok: true };
}
