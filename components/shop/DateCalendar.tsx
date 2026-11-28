"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  addDays,
  BOOKING_HORIZON_DAYS,
  dayState,
  isAfterLastFulfilment,
  type DayState,
} from "@/lib/dates";
import { formatFulfilDate } from "@/lib/format-date";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Shown above the calendar, and on checkout, when orders are refused for the Christmas close. */
export const ORDERS_CLOSED_MESSAGE = "Orders are closed for Christmas.";

type DateCalendarProps = {
  today: string;
  leadDays: number;
  unavailable: string[];
  value: string | null;
  onChange(date: string): void;
  whatsappHref: string | null;
  /** Last date an order can be fulfilled (settings.last_fulfilment_date). Later dates cannot be chosen. */
  lastFulfilmentDate: string;
  /** True once ordering has closed (settings.order_close_date has passed). No date can be chosen. */
  orderingClosed: boolean;
};

/** "YYYY-MM-01" for the month containing an ISO date. */
function monthStart(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

function shiftMonth(monthIso: string, months: number): string {
  const date = new Date(`${monthIso}T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString().slice(0, 10);
}

function monthLabel(monthIso: string): string {
  return new Date(`${monthIso}T00:00:00Z`).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

const CELL_STYLE: Record<DayState, string> = {
  available: "border border-neutral-400 bg-white hover:bg-neutral-100",
  too_soon: "border border-dashed border-neutral-300 bg-neutral-50 text-neutral-400",
  unavailable: "bg-neutral-300 text-neutral-600 line-through",
  past: "text-neutral-300",
  beyond: "text-neutral-300",
};

/**
 * Pick a bake date. Only available days can be selected. Tapping a too-soon day shows the
 * lead-time note instead. Dates come from the server, so the calendar makes no booking decisions.
 */
export function DateCalendar({
  today,
  leadDays,
  unavailable,
  value,
  onChange,
  whatsappHref,
  lastFulfilmentDate,
  orderingClosed,
}: DateCalendarProps) {
  const firstMonth = monthStart(today);
  // Never page past the last bookable date: the horizon or the last fulfilment date, whichever is sooner.
  const horizonEnd = addDays(today, BOOKING_HORIZON_DAYS);
  const lastBookable = lastFulfilmentDate < horizonEnd ? lastFulfilmentDate : horizonEnd;
  const lastMonth = monthStart(lastBookable);
  const [shown, setShown] = useState(() => monthStart(value ?? addDays(today, leadDays)));
  const [showTooSoon, setShowTooSoon] = useState(false);
  const unavailableSet = useMemo(() => new Set(unavailable), [unavailable]);

  const year = Number(shown.slice(0, 4));
  const monthIndex = Number(shown.slice(5, 7)) - 1;
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const leadingBlanks = new Date(`${shown}T00:00:00Z`).getUTCDay();

  function onTap(iso: string, state: DayState) {
    if (state === "available") {
      setShowTooSoon(false);
      onChange(iso);
    } else if (state === "too_soon") {
      setShowTooSoon(true);
    }
  }

  const cells = [];
  for (let i = 0; i < leadingBlanks; i++) cells.push(<div key={`blank-${i}`} />);
  for (let day = 1; day <= daysInMonth; day++) {
    const iso = `${shown.slice(0, 7)}-${String(day).padStart(2, "0")}`;
    const base = dayState(iso, { today, leadDays, unavailable: unavailableSet });
    let state: DayState = base;
    if (isAfterLastFulfilment(iso, lastFulfilmentDate)) state = "beyond";
    else if (orderingClosed && (base === "available" || base === "too_soon")) state = "unavailable";
    const selected = iso === value;
    const tappable = state === "available" || state === "too_soon";

    cells.push(
      <button
        key={iso}
        type="button"
        data-date={iso}
        data-state={state}
        data-selected={selected ? "true" : undefined}
        aria-label={`${formatFulfilDate(iso)}${state === "available" ? "" : `, ${state.replace("_", " ")}`}`}
        aria-pressed={state === "available" ? selected : undefined}
        aria-disabled={state === "too_soon" ? true : undefined}
        disabled={!tappable}
        onClick={() => onTap(iso, state)}
        className={cn(
          "h-10 w-full rounded-md text-sm",
          CELL_STYLE[state],
          selected && "bg-crimson text-cream hover:bg-crimson-deep",
        )}
      >
        {day}
      </button>,
    );
  }

  return (
    <div className="space-y-3">
      {orderingClosed && (
        <p role="status" className="text-sm font-medium text-destructive">
          {ORDERS_CLOSED_MESSAGE}
        </p>
      )}
      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label="Previous month"
          disabled={shown <= firstMonth}
          onClick={() => setShown(shiftMonth(shown, -1))}
        >
          ←
        </Button>
        <p className="font-medium" aria-live="polite">
          {monthLabel(shown)}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label="Next month"
          disabled={shown >= lastMonth}
          onClick={() => setShown(shiftMonth(shown, 1))}
        >
          →
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
        {WEEKDAYS.map((day) => (
          <div key={day}>{day}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">{cells}</div>

      {showTooSoon && (
        <p role="status" className="text-sm">
          We need {leadDays} days to bake this fresh — need it sooner?{" "}
          {whatsappHref ? (
            <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
              WhatsApp us
            </a>
          ) : (
            "WhatsApp us"
          )}
          .
        </p>
      )}

      <ul className="flex flex-wrap gap-4 text-xs">
        <li className="flex items-center gap-2">
          <span className="inline-block size-4 rounded-sm border border-dashed border-neutral-300 bg-neutral-50" />
          Too soon
        </li>
        <li className="flex items-center gap-2">
          <span className="inline-block size-4 rounded-sm bg-neutral-300" />
          Unavailable
        </li>
        <li className="flex items-center gap-2">
          <span className="inline-block size-4 rounded-sm bg-crimson" />
          Your date
        </li>
      </ul>
    </div>
  );
}
