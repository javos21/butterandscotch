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
