"use client";

import { useState } from "react";
import { Check, Minus, Plus, ShoppingBasket } from "lucide-react";
import { toast } from "sonner";
import { useCart } from "@/components/shop/CartProvider";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { roomFor } from "@/lib/cart";
import { formatMoney } from "@/lib/money";
import type { Item } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Swatch colour for a flavour name (caramel, cocoa, or split for Half & Half). */
function swatchStyle(flavour: string): React.CSSProperties {
  const name = flavour.toLowerCase();
  if (name.includes("half")) return { background: "linear-gradient(90deg, var(--caramel) 50%, var(--cocoa) 50%)" };
  if (name.includes("chocolate") || name.includes("toffee")) return { background: "var(--cocoa)" };
  return { background: "var(--caramel)" };
}

/**
 * Flavour choice for an item, opened from its menu card: flavour rows, quantity, and Add to basket.
 * The menu stays the one place to shop.
 */
export function FlavourSheet({
  item,
  open,
  onOpenChange,
}: {
  item: Item;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { lines, add } = useCart();
  const [flavour, setFlavour] = useState<string>(item.flavours[0] ?? "");
  const [requested, setRequested] = useState(1);

  const room = roomFor(lines, item.id, item.max_qty);
  const quantity = Math.max(0, Math.min(requested, room));
  const canAdd = room > 0 && quantity > 0 && flavour !== "";

  function onAdd() {
    if (!canAdd) return;
    add({
      itemId: item.id,
      name: item.name,
      flavour,
      unitLabel: item.unit_label,
      unitPriceCents: item.price_cents,
      quantity,
      maxQty: item.max_qty,
    });
    toast(`Added ${item.name} (${flavour}) to your basket`);
    setRequested(1);
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[88vh] overflow-y-auto rounded-t-[28px] border-olive-line bg-cream px-5 pt-6 pb-8"
      >
        <SheetHeader className="p-0 text-left">
          <SheetTitle className="font-display text-3xl font-normal text-oxblood">{item.name}</SheetTitle>
          <SheetDescription className="text-base text-olive-ink">
            Choose a flavour, then add it to your basket.
          </SheetDescription>
        </SheetHeader>

        <fieldset className="mt-6 space-y-3">
          <legend className="sr-only">Flavour</legend>
          {item.flavours.map((option) => {
            const selected = option === flavour;
            return (
              <label
                key={option}
                className={cn(
                  "flex min-h-14 cursor-pointer items-center gap-3 rounded-[12px] border bg-card-cream px-4 text-base font-bold text-crimson-deep transition-[background-color,border-color,transform] duration-200 ease-out active:scale-[0.99]",
                  selected ? "border-[1.5px] border-crimson-deep bg-cream-warm" : "border-olive hover:bg-cream-warm/60",
                )}
              >
                <input
                  type="radio"
                  name={`flavour-${item.id}`}
                  value={option}
                  checked={selected}
                  onChange={() => setFlavour(option)}
                  className="peer sr-only"
                />
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full border-2 peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-holly",
                    selected ? "border-crimson bg-crimson text-cream" : "border-olive",
                  )}
                  aria-hidden="true"
                >
                  {selected ? <Check className="size-4" strokeWidth={3} /> : null}
                </span>
                <span className="flex-1">{option}</span>
                <span
                  className="size-[22px] shrink-0 rounded-full ring-1 ring-olive-ink/20"
                  style={swatchStyle(option)}
                  aria-hidden="true"
                />
              </label>
            );
          })}
        </fieldset>

        <div className="mt-6 flex gap-3">
          <div
            role="group"
            aria-label={`Quantity of ${item.name}`}
            className="grid h-[52px] shrink-0 grid-cols-3 overflow-hidden rounded-[12px] border border-olive bg-card-cream"
          >
            <button
              type="button"
              aria-label="Decrease quantity"
              disabled={quantity <= 1}
              onClick={() => setRequested(Math.max(1, quantity - 1))}
              className="flex w-12 items-center justify-center text-olive-ink transition-colors hover:bg-cream-warm active:scale-95 disabled:opacity-40"
            >
              <Minus className="size-5" aria-hidden="true" />
            </button>
            <span
              className="flex w-12 items-center justify-center border-x border-olive text-lg font-extrabold text-olive-ink"
              aria-live="polite"
            >
              {quantity}
            </span>
            <button
              type="button"
              aria-label="Increase quantity"
              disabled={quantity >= room}
              onClick={() => setRequested(Math.min(room, quantity + 1))}
              className="flex w-12 items-center justify-center text-olive-ink transition-colors hover:bg-cream-warm active:scale-95 disabled:opacity-40"
            >
              <Plus className="size-5" aria-hidden="true" />
            </button>
          </div>
          <button
            type="button"
            onClick={onAdd}
            disabled={!canAdd}
            className="flex h-[52px] flex-1 items-center justify-center gap-2 rounded-2xl bg-crimson px-4 text-base font-bold text-cream shadow-[0_6px_18px_rgba(86,0,8,0.18)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-crimson-deep hover:shadow-[0_10px_24px_rgba(86,0,8,0.24)] active:translate-y-0 active:scale-[0.98] disabled:translate-y-0 disabled:opacity-45 disabled:shadow-none"
          >
            <ShoppingBasket className="size-5 shrink-0" aria-hidden="true" />
            {room > 0
              ? `Add to basket · ${formatMoney(item.price_cents * quantity).replace(".00", "")}`
              : "Most per order in basket"}
          </button>
        </div>
        {room <= 0 ? (
          <p className="mt-3 text-[0.9375rem] text-olive-ink">
            Your basket already has the most of this one order allows ({item.max_qty}).
          </p>
        ) : (
          <p className="mt-3 text-[0.9375rem] text-olive">Up to {item.max_qty} per order.</p>
        )}
      </SheetContent>
    </Sheet>
  );
}
