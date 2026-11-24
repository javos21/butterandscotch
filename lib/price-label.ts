import { formatPrice } from "@/lib/money";
import type { Item } from "@/lib/types";

/** Price with its unit, e.g. "300 per dozen". "each" is implied, so it is left off. */
export function priceLabel(item: Pick<Item, "price_cents" | "unit_label">): string {
  const unit = item.unit_label.trim();
  return unit && unit !== "each" ? `${formatPrice(item.price_cents)} ${unit}` : formatPrice(item.price_cents);
}
