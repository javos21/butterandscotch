export const TT_TIME_ZONE = "America/Port_of_Spain";
export const BOOKING_HORIZON_DAYS = 90;

export type DayState = "past" | "too_soon" | "unavailable" | "available" | "beyond";

const trinidadDateFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: TT_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** The current calendar date in Trinidad, as "YYYY-MM-DD". */
export function trinidadToday(now: Date): string {
  return trinidadDateFormat.format(now);
}

/** Adds whole days to an ISO date ("YYYY-MM-DD") and returns the ISO date. */
export function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** The first date a customer can book: Trinidad today plus the lead time. */
export function earliestDate(now: Date, leadDays: number): string {
  return addDays(trinidadToday(now), leadDays);
}

/**
 * Classifies a calendar date for the booking picker. ISO dates compare correctly as strings.
 * Precedence: past, too_soon, beyond, unavailable, available.
 */
export function dayState(
  iso: string,
  ctx: { today: string; leadDays: number; unavailable: ReadonlySet<string> },
): DayState {
  if (iso < ctx.today) return "past";
  if (iso < addDays(ctx.today, ctx.leadDays)) return "too_soon";
  if (iso > addDays(ctx.today, BOOKING_HORIZON_DAYS)) return "beyond";
  if (ctx.unavailable.has(iso)) return "unavailable";
  return "available";
}

/** True for a real calendar date written as "YYYY-MM-DD". Rejects impossible dates such as 2027-02-30. */
export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
