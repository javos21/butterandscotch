"use client";

import Link from "next/link";
import { toast } from "sonner";
import { ItemPhoto } from "@/components/shop/ItemPhoto";
import { useCart } from "@/components/shop/CartProvider";
import { roomFor } from "@/lib/cart";
import { priceLabel } from "@/lib/price-label";
import type { Item } from "@/lib/types";

/**
 * One menu card (DESIGN.md "Product card"): photo, name, price, allergen line and Add.
 * Items with flavours open their page to choose one; the rest add one straight to the basket.
 */
export function MenuItemCard({ item, priority }: { item: Item; priority?: boolean }) {
  const { lines, add } = useCart();
  const hasFlavours = item.flavours.length > 0;
  const room = roomFor(lines, item.id, item.max_qty);
  const href = `/items/${item.id}`;

  function onAdd() {
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
    <article className="flex h-full flex-col rounded-[22px] border border-olive-line bg-card-cream p-2.5 pb-3.5">
      <Link href={href} className="block rounded-2xl" tabIndex={-1} aria-hidden="true">
        <ItemPhoto
          src={item.image_url}
          name={item.name}
          sizes="(min-width: 1200px) 25vw, (min-width: 768px) 33vw, 50vw"
          priority={priority}
          className="aspect-[4/3]"
        />
      </Link>
      {/* Fixed slots: every card reserves the same height for its tag, name, price and note, so the
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
          <Link href={href} className="hover:underline hover:decoration-1 hover:underline-offset-4">
            {item.name}
          </Link>
        </h3>
        <p className="mt-1 min-h-[3rem] text-lg font-extrabold leading-tight text-olive-ink sm:min-h-[1.75rem] sm:text-xl">
          {priceLabel(item)}
        </p>
        <p className="min-h-[1.5rem] text-[0.9375rem] text-olive">{item.allergen_note ?? ""}</p>
      </div>
      <div className="px-0.5 pt-3">
        {room <= 0 ? (
          <p className="flex min-h-12 items-center justify-center rounded-[14px] bg-cream-warm px-2 text-center text-sm font-bold text-olive-ink">
            Most per order ({item.max_qty}) in basket
          </p>
        ) : hasFlavours ? (
          <Link
            href={href}
            className="flex min-h-12 items-center justify-center rounded-[14px] bg-crimson px-3 text-base font-bold text-cream transition-colors hover:bg-crimson-deep active:scale-[0.98]"
            aria-label={`Choose a flavour for ${item.name}`}
          >
            Add
          </Link>
        ) : (
          <button
            type="button"
            onClick={onAdd}
            className="flex min-h-12 w-full items-center justify-center rounded-[14px] bg-crimson px-3 text-base font-bold text-cream transition-colors hover:bg-crimson-deep active:scale-[0.98]"
            aria-label={`Add ${item.name} to basket`}
          >
            Add
          </button>
        )}
      </div>
    </article>
  );
}
