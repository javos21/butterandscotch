import { addDays, isIsoDate } from "@/lib/dates";

/*
 * Month maths for the admin Home calendar. Pure string and UTC date work, so it runs on the server
 * and in tests. Dates are "YYYY-MM-DD"; a month is its first day, "YYYY-MM-01".
 */

/** The first day of the month containing an ISO date. */
export function monthStartOf(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

/** The last day of the month that starts on `monthStart`. */
export function lastDayOfMonth(monthStart: string): string {
  const [year, month] = monthStart.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

/** Moves a month start by whole months. */
export function shiftMonth(monthStart: string, months: number): string {
  const date = new Date(`${monthStart}T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + months);
  return monthStartOf(date.toISOString().slice(0, 10));
}

/**
 * Reads a `?month=YYYY-MM` value. Anything missing or invalid falls back to the month of `today`.
 * Returns the first day of the month.
 */
export function parseMonth(value: string | undefined, today: string): string {
  if (value && /^\d{4}-\d{2}$/.test(value) && isIsoDate(`${value}-01`)) {
    return `${value}-01`;
  }
  return monthStartOf(today);
}

/** Whether an ISO date is a real date, for reading `?date=`. */
export function parseDate(value: string | undefined): string | null {
  return value && isIsoDate(value) ? value : null;
}

/**
 * The cells of a Sunday-first month grid. Leading `null`s pad the first week; every other cell is
 * an ISO date.
 */
export function monthGrid(monthStart: string): (string | null)[] {
  const leading = new Date(`${monthStart}T00:00:00Z`).getUTCDay();
  const last = lastDayOfMonth(monthStart);
  const days = Number(last.slice(8, 10));
  const cells: (string | null)[] = Array.from({ length: leading }, () => null);
  for (let day = 1; day <= days; day++) {
    cells.push(addDays(monthStart, day - 1));
  }
  return cells;
}
