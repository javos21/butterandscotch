"use client";

import { useState } from "react";
import { ShoppingBasket } from "lucide-react";
import { toast } from "sonner";
import { useCart } from "@/components/shop/CartProvider";
import { FlavourSheet } from "@/components/shop/FlavourSheet";
import { ItemPhoto } from "@/components/shop/ItemPhoto";
import { PriceTag } from "@/components/shop/PriceTag";
import { roomFor } from "@/lib/cart";
import type { Item } from "@/lib/types";

/**
 * One menu card: photo, name, allergen note, price and Add to basket. Items with flavours open a
 * flavour sheet; the rest add one straight to the basket.
 */
export function MenuItemCard({ item, priority }: { item: Item; priority?: boolean }) {
  const { lines, add } = useCart();
  const [sheetOpen, setSheetOpen] = useState(false);
  const hasFlavours = item.flavours.length > 0;
  const room = roomFor(lines, item.id, item.max_qty);

  function onAdd() {
    if (hasFlavours) {
      setSheetOpen(true);
      return;
    }
    if (room <= 0) return;
    add({
      itemId: item.id,
      name: item.name,
      flavour: null,
      unitLabel: item.unit_label,
      unitPriceCents: item.price_cents,
      quantity: 1,
      maxQty: item.max_qty,
    });
    toast(`Added ${item.name} to your basket`);
  }

  return (
    <article className="flex h-full flex-col rounded-[22px] border border-olive-line bg-card-cream p-2.5 pb-3.5 transition-[transform,box-shadow] duration-300 ease-out hover:-translate-y-1 hover:shadow-[0_14px_30px_rgba(86,0,8,0.10)]">
      <ItemPhoto
        src={item.image_url}
        name={item.name}
        sizes="(min-width: 1200px) 25vw, (min-width: 768px) 33vw, 50vw"
        priority={priority}
        className="aspect-[4/3]"
      />
      {/* Fixed slots: every card reserves the same height for its tag, name, note and price, so the
          Add buttons line up across a row whether or not an item is seasonal or has an allergen note. */}
      <div className="flex flex-1 flex-col px-1.5 pt-3">
        <div className="flex h-7 items-start">
          {item.seasonal ? (
            <span className="w-fit rounded-full bg-cream-warm px-2.5 py-0.5 text-xs font-bold text-crimson-deep">
              Seasonal
            </span>
          ) : null}
        </div>
        <h3 className="min-h-[2.25rem] font-display text-[1.2rem] leading-[1.12] text-crimson-deep sm:min-h-[2.5rem] sm:text-[1.375rem]">
          {item.name}
        </h3>
        <p className="mt-1 min-h-[1.5rem] text-[0.9375rem] text-olive">{item.allergen_note ?? ""}</p>
        <PriceTag item={item} className="mt-2 min-h-[4.25rem] sm:min-h-[4rem]" />
      </div>
      <div className="px-0.5 pt-3">
        {room <= 0 ? (
          <p className="flex min-h-12 items-center justify-center rounded-[14px] bg-cream-warm px-2 text-center text-sm font-bold text-olive-ink">
            Most per order ({item.max_qty}) in basket
          </p>
        ) : (
          <button
            type="button"
            onClick={onAdd}
            aria-label={`Add ${item.name} to basket`}
            className="flex min-h-12 w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-[14px] bg-crimson px-2 text-[0.8125rem] font-bold text-cream shadow-[0_4px_12px_rgba(86,0,8,0.16)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-crimson-deep hover:shadow-[0_8px_18px_rgba(86,0,8,0.22)] active:translate-y-0 active:scale-[0.97] min-[400px]:text-sm sm:px-3 sm:text-base"
          >
            <ShoppingBasket className="size-5 shrink-0" aria-hidden="true" />
            Add to basket
          </button>
        )}
      </div>
      {hasFlavours ? <FlavourSheet item={item} open={sheetOpen} onOpenChange={setSheetOpen} /> : null}
    </article>
  );
}
