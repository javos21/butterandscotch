import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { HomeCalendar } from "@/components/admin/HomeCalendar";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { parseDate, parseMonth } from "@/lib/admin/home-calendar";
import { requireStaff } from "@/lib/auth/require-staff";
import { getHomeData, type HomeOrder } from "@/lib/admin/queries";
import { trinidadToday } from "@/lib/dates";
import { formatFulfilDate } from "@/lib/format-date";
import { cn } from "@/lib/utils";

type Tone = "urgent" | "attention" | "progress" | "neutral";

const TONE_CLASS: Record<Tone, string> = {
  urgent: "bg-status-danger-bg text-status-danger",
  attention: "bg-status-warning-bg text-status-warning",
  progress: "bg-status-progress-bg text-status-progress",
  neutral: "bg-status-neutral-bg text-status-neutral",
};

function itemSummary(items: HomeOrder["items"]): string {
  return items
    .map((item) => `${item.quantity} × ${item.name}${item.flavour ? ` (${item.flavour})` : ""}`)
    .join(", ");
}

export default async function AdminHomePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string | string[]; date?: string | string[] }>;
}) {
  await requireStaff();
  const params = await searchParams;
  const today = trinidadToday(new Date());
  const monthStart = parseMonth(typeof params.month === "string" ? params.month : undefined, today);
  const selectedDate = parseDate(typeof params.date === "string" ? params.date : undefined);
  const home = await getHomeData(today, monthStart, selectedDate);

  const tiles: { key: string; href: string; count: number; label: string; tone: Tone }[] = [
    {
      key: "proofs",
      href: "/admin/payments",
      count: home.tiles.proofsToCheck,
      label: "Payment proofs to check",
      tone: "urgent",
    },
    {
      key: "quotes",
      href: "/admin/orders?status=awaiting_quote",
      count: home.tiles.quotesToSet,
      label: "Delivery quotes to set",
      tone: "attention",
    },
    {
      key: "complete",
      href: "/admin/orders?status=ready",
      count: home.tiles.readyToComplete,
      label: "Orders to mark complete",
      tone: "progress",
    },
    {
      key: "today",
      href: `/admin/orders?date=${today}&status=open`,
      count: home.tiles.ordersToday,
      label: "Orders due today",
      tone: "neutral",
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Home</h1>

      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((tile) => (
          <li key={tile.key}>
            <Link
              href={tile.href}
              className={cn(
                "flex h-full min-h-32 flex-col justify-between gap-3 rounded-lg p-4 hover:opacity-90",
                tile.count > 0 ? TONE_CLASS[tile.tone] : "bg-card text-muted-foreground",
              )}
            >
              <span className="flex items-center justify-between gap-2 text-sm font-medium">
                {tile.label}
                <ChevronRight className="size-4 shrink-0" aria-hidden="true" />
              </span>
              <span className="text-4xl font-semibold tabular-nums">{tile.count}</span>
            </Link>
          </li>
        ))}
      </ul>

      <HomeCalendar
        monthStart={monthStart}
        today={today}
        countsByDate={home.countsByDate}
        selectedDate={selectedDate}
      />

      {selectedDate ? (
        <section aria-labelledby="day-orders" className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="day-orders" className="text-base font-semibold">
              {formatFulfilDate(selectedDate)}
            </h2>
            <Link
              href={`/admin/orders?date=${selectedDate}`}
              className="inline-flex min-h-11 items-center text-sm underline-offset-4 hover:underline"
            >
              Open in Orders
            </Link>
          </div>

          {home.dayOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground">No orders on this day.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="hidden md:table-cell">Items</TableHead>
                    <TableHead className="hidden md:table-cell">Delivery</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {home.dayOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">
                        <Link href={`/admin/orders/${order.id}`} className="inline-flex min-h-11 items-center underline-offset-4 hover:underline">
                          {order.orderNumber}
                        </Link>
                      </TableCell>
                      <TableCell>{order.customerName}</TableCell>
                      <TableCell className="hidden max-w-xs whitespace-normal md:table-cell">
                        {itemSummary(order.items)}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {order.fulfilment === "delivery" ? "Delivery" : "Pickup"}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={order.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>
      ) : (
        <p className="text-sm text-muted-foreground">Tap a day to see its orders.</p>
      )}
    </div>
  );
}
