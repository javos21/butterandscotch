import { formatPrice } from "@/lib/money";
import type { Item } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * A menu price as one element: "$300" with "TTD" to its right, and the unit ("per dozen") under
 * the price. "each" is implied, so no unit line is shown for it.
 */
export function PriceTag({
  item,
  size = "card",
  className,
}: {
  item: Pick<Item, "price_cents" | "unit_label">;
  size?: "card" | "page";
  className?: string;
}) {
  const unit = item.unit_label.trim();
  const showUnit = unit !== "" && unit !== "each";
  const amount = formatPrice(item.price_cents);
  const big = size === "page" ? "text-4xl sm:text-5xl" : "text-3xl sm:text-[2rem]";
  const currency = size === "page" ? "text-base sm:text-lg" : "text-sm";

  return (
    <div className={cn("flex flex-col items-start gap-0 text-crimson-deep", className)}>
      <p className="flex items-baseline gap-2 leading-none">
        <span className={cn("font-extrabold tabular-nums tracking-tight", big)}>
          <span aria-hidden="true">$</span>
          {amount}
        </span>
        <span className={cn("font-bold text-olive", currency)}>TTD</span>
      </p>
      {showUnit ? <p className={cn("font-bold leading-tight text-olive", currency)}>{unit}</p> : null}
    </div>
  );
}
