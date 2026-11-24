import { cn } from "@/lib/utils";

/**
 * Seasonal garnish (DESIGN.md "Holly divider"): a holly sprig between two thin olive rules.
 * Decorative only. Remove it from the page when the festive season ends.
 */
export function HollyDivider({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-center gap-4", className)} aria-hidden="true">
      <span className="h-[1.5px] w-16 bg-olive sm:w-28" />
      <svg width="76" height="30" viewBox="0 0 76 30" fill="none" className="shrink-0">
        <path
          d="M36 15C30 8 20 5 8 8c5 2 7 5 8 8-4-1-8 0-11 2 9 3 20 2 31-3Z"
          fill="var(--holly)"
        />
        <path
          d="M40 15c6-7 16-10 28-7-5 2-7 5-8 8 4-1 8 0 11 2-9 3-20 2-31-3Z"
          fill="var(--holly)"
        />
        <circle cx="33" cy="20" r="3.4" fill="var(--crimson)" />
        <circle cx="43" cy="20" r="3.4" fill="var(--crimson)" />
        <circle cx="38" cy="13.5" r="3.4" fill="var(--crimson)" />
      </svg>
      <span className="h-[1.5px] w-16 bg-olive sm:w-28" />
    </div>
  );
}
