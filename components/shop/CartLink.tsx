"use client";

import Link from "next/link";
import { useCart } from "@/components/shop/CartProvider";
import { formatMoney } from "@/lib/money";

/** Header link to the bag, showing how many items are in it and their subtotal. */
export function CartLink() {
  const { count, subtotalCents } = useCart();
  return (
    <Link href="/checkout" className="text-sm underline underline-offset-4">
      Cart ({count}) {count > 0 && `· ${formatMoney(subtotalCents)}`}
    </Link>
  );
}
