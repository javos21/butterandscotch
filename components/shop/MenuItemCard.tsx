"use client";

import Image from "next/image";
import { useState } from "react";
import { toast } from "sonner";
import { useCart } from "@/components/shop/CartProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { roomFor } from "@/lib/cart";
import { formatPrice } from "@/lib/money";
import type { Item } from "@/lib/types";

/** One menu item: flavour choice, quantity stepper and Add to cart. */
export function MenuItemCard({ item }: { item: Item }) {
  const { lines, add } = useCart();
  const [flavour, setFlavour] = useState("");
  const [requested, setRequested] = useState(1);

  const hasFlavours = item.flavours.length > 0;
  const room = roomFor(lines, item.id, item.max_qty);
  const quantity = Math.min(requested, room);
  const canAdd = room > 0 && (!hasFlavours || flavour !== "");

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
    toast(`Added ${item.name} to your cart`);
    setRequested(1);
  }

  return (
    <article className="flex flex-col gap-3 rounded-lg border p-4">
      {item.image_url && (
        <Image
          src={item.image_url}
          alt=""
          width={800}
          height={800}
          sizes="(min-width: 640px) 50vw, 100vw"
          className="aspect-square w-full rounded-md object-cover"
        />
      )}

      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-lg font-semibold">{item.name}</h3>
          {item.seasonal && <Badge variant="secondary">Seasonal</Badge>}
        </div>
        <p className="text-sm">
          {formatPrice(item.price_cents)}{" "}
          <span className="text-muted-foreground">{item.unit_label}</span>
        </p>
        {item.description && <p className="text-sm text-muted-foreground">{item.description}</p>}
        {item.allergen_note && <p className="text-sm">Allergen note: {item.allergen_note}</p>}
      </div>

      {hasFlavours && (
        <div className="space-y-1">
          <label htmlFor={`flavour-${item.id}`} className="text-sm font-medium">
            Flavour
          </label>
          <select
            id={`flavour-${item.id}`}
            value={flavour}
            onChange={(event) => setFlavour(event.target.value)}
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
          >
            <option value="">Choose a flavour</option>
            {item.flavours.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label={`Quantity of ${item.name}`} className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Decrease quantity"
            disabled={quantity <= 1}
            onClick={() => setRequested(Math.max(1, quantity - 1))}
          >
            −
          </Button>
          <span className="w-6 text-center" aria-live="polite">
            {quantity}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Increase quantity"
            disabled={quantity >= room}
            onClick={() => setRequested(Math.min(room, quantity + 1))}
          >
            +
          </Button>
        </div>
        <Button type="button" onClick={onAdd} disabled={!canAdd}>
          Add to cart
        </Button>
      </div>

      {room === 0 && (
        <p className="text-sm text-muted-foreground">
          Your cart already has the most of this that one order allows ({item.max_qty}).
        </p>
      )}
      {room > 0 && hasFlavours && flavour === "" && (
        <p className="text-xs text-muted-foreground">Choose a flavour to add this.</p>
      )}
    </article>
  );
}
