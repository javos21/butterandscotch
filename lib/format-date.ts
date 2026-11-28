/** "Saturday, 28 November 2026" for an ISO "YYYY-MM-DD" business date. */
export function formatFulfilDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** "December 16th" for an ISO "YYYY-MM-DD" business date. */
export function formatMonthDay(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  const day = date.getUTCDate();
  const suffix =
    day % 100 >= 11 && day % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[day % 10] ?? "th";
  const month = date.toLocaleDateString("en-GB", { month: "long", timeZone: "UTC" });
  return `${month} ${day}${suffix}`;
}
