"use client";

import Link from "next/link";
import { ShoppingBasket } from "lucide-react";
import { useCart } from "@/components/shop/CartProvider";

/** Header basket: icon plus a live item count. */
export function CartLink() {
  const { count } = useCart();
  return (
    <Link
      href="/checkout"
      className="flex min-h-11 min-w-11 flex-col items-center justify-center rounded-xl px-1 text-crimson-deep hover:bg-cream-warm"
    >
      <ShoppingBasket className="size-7" strokeWidth={1.75} aria-hidden="true" />
      <span key={count} className="animate-basket-pop text-sm font-bold leading-tight">Basket {count}</span>
    </Link>
  );
}
