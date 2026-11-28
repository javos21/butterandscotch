import Link from "next/link";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { OrderStatus } from "@/lib/order-status";
import { cn } from "@/lib/utils";

export type OrderFilterValue = OrderStatus | "open";

export const ORDER_FILTERS: { value: OrderFilterValue; label: string; empty: string }[] = [
  { value: "open", label: "Open", empty: "No open orders" },
  { value: "awaiting_payment", label: "Awaiting payment", empty: "No orders waiting for payment" },
  { value: "proof_submitted", label: "Payment being checked", empty: "No payments waiting to be checked" },
  { value: "confirmed", label: "Confirmed", empty: "No confirmed orders" },
  { value: "ready", label: "Ready", empty: "No orders ready for pickup or delivery" },
  { value: "completed", label: "Completed", empty: "No completed orders" },
  { value: "cancelled", label: "Cancelled", empty: "No cancelled orders" },
];

/** Builds a /admin/orders URL that keeps the other filters. Empty values are left out. */
export function ordersHref(params: { status?: OrderFilterValue; q?: string; date?: string; page?: number }): string {
  const search = new URLSearchParams();
  if (params.status && params.status !== "open") search.set("status", params.status);
  if (params.q) search.set("q", params.q);
  if (params.date) search.set("date", params.date);
  if (params.page && params.page > 1) search.set("page", String(params.page));
  const query = search.toString();
  return query ? `/admin/orders?${query}` : "/admin/orders";
}

/** Status chips (links), a search box and a fulfil-date box. All are plain GET links and forms, so they work without JavaScript. */
export function OrderFilters({ active, q, date }: { active: OrderFilterValue; q: string; date?: string }) {
  return (
    <div className="space-y-3">
      <nav aria-label="Filter orders by status">
        <ul className="flex flex-wrap gap-2">
          {ORDER_FILTERS.map((filter) => {
            const selected = filter.value === active;
            return (
              <li key={filter.value}>
                <Link
                  href={ordersHref({ status: filter.value, q, date })}
                  aria-current={selected ? "page" : undefined}
                  className={cn(
                    "inline-flex min-h-11 items-center rounded-full border px-3 text-sm font-medium",
                    selected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "bg-background text-foreground hover:bg-muted",
                  )}
                >
                  {filter.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <form action="/admin/orders" method="get" role="search" className="flex items-end gap-2">
        {active !== "open" ? <input type="hidden" name="status" value={active} /> : null}
        <div className="min-w-0 flex-1 space-y-1.5">
          <Label htmlFor="order-search">Search</Label>
          <Input
            id="order-search"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Order number, name or phone"
            className="min-h-11"
          />
        </div>
        <div className="shrink-0 space-y-1.5">
          <Label htmlFor="order-date">Fulfil date</Label>
          <Input id="order-date" name="date" type="date" defaultValue={date ?? ""} className="min-h-11" />
        </div>
        <Button type="submit" variant="outline" className="min-h-11 gap-2">
          <Search className="size-4" aria-hidden="true" />
          Search
        </Button>
      </form>
    </div>
  );
}
