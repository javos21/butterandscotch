import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { monthGrid, shiftMonth } from "@/lib/admin/home-calendar";
import { formatFulfilDate } from "@/lib/format-date";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function monthLabel(monthStart: string): string {
  return new Date(`${monthStart}T00:00:00Z`).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Month view of live orders per fulfil date. Each day is a link to `/admin?month=…&date=…`, so the
 * selected day's orders render below the calendar on the server, with no client state.
 */
export function HomeCalendar({
  monthStart,
  today,
  countsByDate,
  selectedDate,
}: {
  monthStart: string;
  today: string;
  countsByDate: Record<string, number>;
  selectedDate: string | null;
}) {
  const month = monthStart.slice(0, 7);
  const cells = monthGrid(monthStart);

  return (
    <section aria-label="Orders calendar" className="rounded-lg border bg-card p-3 md:p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <Link
          href={`/admin?month=${shiftMonth(monthStart, -1).slice(0, 7)}`}
          aria-label="Previous month"
          className="flex size-11 items-center justify-center rounded-md hover:bg-muted"
        >
          <ChevronLeft className="size-5" aria-hidden="true" />
        </Link>
        <h2 className="text-base font-semibold" aria-live="polite">
          {monthLabel(monthStart)}
        </h2>
        <Link
          href={`/admin?month=${shiftMonth(monthStart, 1).slice(0, 7)}`}
          aria-label="Next month"
          className="flex size-11 items-center justify-center rounded-md hover:bg-muted"
        >
          <ChevronRight className="size-5" aria-hidden="true" />
        </Link>
      </div>

      <div className="grid grid-cols-7 gap-1 pb-1 text-center text-xs font-medium text-muted-foreground">
        {WEEKDAYS.map((day) => (
          <div key={day}>{day}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((iso, index) => {
          if (iso === null) return <div key={`blank-${index}`} aria-hidden="true" />;
          const count = countsByDate[iso] ?? 0;
          const selected = iso === selectedDate;
          const isToday = iso === today;
          const isPast = iso < today;
          return (
            <Link
              key={iso}
              href={`/admin?month=${month}&date=${iso}`}
              data-date={iso}
              aria-label={`${formatFulfilDate(iso)}, ${count} ${count === 1 ? "order" : "orders"}`}
              aria-current={selected ? "date" : undefined}
              className={cn(
                "flex min-h-14 flex-col items-center justify-between rounded-md border px-1 py-1.5 text-sm tabular-nums hover:bg-muted",
                count > 0 ? "border-border bg-background" : "border-transparent",
                isPast && "text-muted-foreground",
                isToday && "font-bold",
                selected && "border-primary ring-2 ring-primary",
              )}
            >
              <span>{Number(iso.slice(8, 10))}</span>
              {count > 0 ? (
                <span className="rounded-full bg-primary px-1.5 text-[11px] leading-4 font-medium text-primary-foreground">
                  {count}
                </span>
              ) : (
                <span className="h-4" aria-hidden="true" />
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
