"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck, CalendarDays, Check, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { useCart } from "@/components/shop/CartProvider";
import { roomFor } from "@/lib/cart";
import { formatMoney } from "@/lib/money";
import type { Item } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Swatch colour for a flavour name (DESIGN.md: caramel, cocoa, or split for Half & Half). */
function swatchStyle(flavour: string): React.CSSProperties {
  const name = flavour.toLowerCase();
  if (name.includes("half")) return { background: "linear-gradient(90deg, var(--caramel) 50%, var(--cocoa) 50%)" };
  if (name.includes("chocolate") || name.includes("toffee")) return { background: "var(--cocoa)" };
  return { background: "var(--caramel)" };
}

/** Flavour choice, quantity and Add to basket for one item (DESIGN.md "Choice rows", "Quantity stepper"). */
export function ItemDetail({ item, leadDays }: { item: Item; leadDays: number }) {
  const router = useRouter();
  const { lines, add } = useCart();
  const hasFlavours = item.flavours.length > 0;
  const [flavour, setFlavour] = useState<string>(hasFlavours ? item.flavours[0] : "");
  const [requested, setRequested] = useState(1);

  const room = roomFor(lines, item.id, item.max_qty);
  const quantity = Math.max(0, Math.min(requested, room));
  const canAdd = room > 0 && quantity > 0;

  function onAdd() {
    if (!canAdd) return;
    add({
      itemId: item.id,
      name: item.name,
      flavour: hasFlavours ? flavour : null,
      unitLabel: item.unit_label,
      unitPriceCents: item.price_cents,
      quantity,
      maxQty: item.max_qty,
    });
    toast(`Added ${item.name}${hasFlavours ? ` (${flavour})` : ""} to your basket`, {
      action: { label: "View basket", onClick: () => router.push("/checkout") },
    });
    setRequested(1);
  }

  return (
    <div className="space-y-7">
      {hasFlavours ? (
        <fieldset className="space-y-3">
          <legend className="mb-3 font-display text-2xl text-crimson-deep">Flavour</legend>
          {item.flavours.map((option) => {
            const selected = option === flavour;
            return (
              <label
                key={option}
                className={cn(
                  "flex min-h-14 cursor-pointer items-center gap-3 rounded-[10px] border bg-card-cream px-4 text-base font-bold text-crimson-deep transition-colors",
                  selected ? "border-[1.5px] border-crimson-deep bg-cream-warm" : "border-olive hover:bg-cream-warm/60",
                )}
              >
                <input
                  type="radio"
                  name="flavour"
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
                <span className="size-[22px] shrink-0 rounded-full ring-1 ring-olive-ink/20" style={swatchStyle(option)} aria-hidden="true" />
              </label>
            );
          })}
          {item.max_qty > 1 ? (
            <p className="pt-1 text-[0.9375rem] text-olive-ink">
              <span className="font-bold">Ordering several?</span> You can add another flavour after this one.
            </p>
          ) : null}
        </fieldset>
      ) : null}

      <div className="flex gap-3">
        <div
          role="group"
          aria-label={`Quantity of ${item.name}`}
          className="grid h-[52px] shrink-0 grid-cols-3 overflow-hidden rounded-[10px] border border-olive bg-card-cream"
        >
          <button
            type="button"
            aria-label="Decrease quantity"
            disabled={quantity <= 1}
            onClick={() => setRequested(Math.max(1, quantity - 1))}
            className="flex w-12 items-center justify-center text-olive-ink hover:bg-cream-warm disabled:opacity-40"
          >
            <Minus className="size-5" aria-hidden="true" />
          </button>
          <span className="flex w-12 items-center justify-center border-x border-olive text-lg font-extrabold text-olive-ink" aria-live="polite">
            {quantity}
          </span>
          <button
            type="button"
            aria-label="Increase quantity"
            disabled={quantity >= room}
            onClick={() => setRequested(Math.min(room, quantity + 1))}
            className="flex w-12 items-center justify-center text-olive-ink hover:bg-cream-warm disabled:opacity-40"
          >
            <Plus className="size-5" aria-hidden="true" />
          </button>
        </div>
        <button
          type="button"
          onClick={onAdd}
          disabled={!canAdd}
          className="flex h-[52px] flex-1 items-center justify-center rounded-2xl bg-crimson px-4 text-base font-bold text-cream transition-colors hover:bg-crimson-deep active:scale-[0.98] disabled:opacity-45 sm:text-lg"
        >
          {canAdd ? `Add to basket · ${formatMoney(item.price_cents * quantity).replace(".00", "")}` : "Most per order in basket"}
        </button>
      </div>

      {room <= 0 ? (
        <p className="text-[0.9375rem] text-olive-ink">
          Your basket already has the most of this one order allows ({item.max_qty}).
        </p>
      ) : (
        <p className="text-[0.9375rem] text-olive">Up to {item.max_qty} per order.</p>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-olive-line pt-5 text-[0.9375rem] font-bold text-olive-ink">
        <span className="flex items-center gap-2">
          <CalendarDays className="size-5 text-olive" aria-hidden="true" />
          {leadDays}-day lead time
        </span>
        <span className="h-6 w-px bg-olive-line" aria-hidden="true" />
        <span className="flex items-center gap-2">
          <CalendarCheck className="size-5 text-olive" aria-hidden="true" />
          Choose your date at checkout
        </span>
      </div>
    </div>
  );
}
