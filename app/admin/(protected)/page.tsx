import Link from "next/link";
import { ChevronRight, CreditCard, Nut, Truck } from "lucide-react";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { requireStaff } from "@/lib/auth/require-staff";
import { getTodayBoard } from "@/lib/admin/queries";
import { trinidadToday } from "@/lib/dates";
import { formatFulfilDate } from "@/lib/format-date";

const NO_FLAVOUR = "No flavour";

function orderCountLabel(count: number): string {
  return count === 1 ? "1 order" : `${count} orders`;
}

export default async function AdminTodayPage() {
  await requireStaff();
  const board = await getTodayBoard(trinidadToday(new Date()));

  const alerts = [
    board.proofsToCheck > 0
      ? {
          key: "proofs",
          href: "/admin/payments",
          icon: CreditCard,
          text: `${board.proofsToCheck} ${board.proofsToCheck === 1 ? "proof" : "proofs"} to check`,
        }
      : null,
    board.quotesToSet > 0
      ? {
          key: "quotes",
          href: "/admin/orders?status=awaiting_quote",
          icon: Truck,
          text: `${board.quotesToSet} delivery ${board.quotesToSet === 1 ? "quote" : "quotes"} to set`,
        }
      : null,
  ].filter((alert) => alert !== null);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Today</h1>

      {alerts.length > 0 ? (
        <ul className="space-y-2">
          {alerts.map((alert) => (
            <li key={alert.key}>
              <Link
                href={alert.href}
                className="flex min-h-11 items-center gap-3 rounded-lg border bg-card px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                <alert.icon className="size-4 shrink-0 text-primary" aria-hidden="true" />
                <span className="flex-1">{alert.text}</span>
                <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      {board.days.map((day) => {
        const headingId = `day-${day.date}`;
        return (
          <section key={day.date} aria-labelledby={headingId} className="space-y-3 border-t pt-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id={headingId} className="text-base font-semibold">
                {formatFulfilDate(day.date)}
              </h2>
              {day.orders.length > 0 ? (
                <span className="text-sm text-muted-foreground">{orderCountLabel(day.orders.length)}</span>
              ) : null}
            </div>

            {day.orders.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing booked</p>
            ) : (
              <>
                <ul className="space-y-2 text-sm">
                  {day.totals.map((total) => (
                    <li key={total.name}>
                      <p className="flex items-center gap-1.5 font-medium">
                        <span>
                          {total.quantity} × {total.name} ({total.unitLabel})
                        </span>
                        {total.nuts ? (
                          <>
                            <Nut className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                            <span className="sr-only">Contains nuts</span>
                          </>
                        ) : null}
                      </p>
                      {total.flavours.length > 1 || total.flavours[0]?.flavour !== NO_FLAVOUR ? (
                        <ul className="ml-4 text-muted-foreground">
                          {total.flavours.map((flavour) => (
                            <li key={flavour.flavour}>
                              {flavour.quantity} × {flavour.flavour}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  ))}
                </ul>

                <ul className="space-y-2">
                  {day.orders.map((order) => (
                    <li key={order.id}>
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="flex min-h-11 items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2 hover:bg-muted"
                      >
                        <span className="min-w-0">
                          <span className="block text-sm font-medium">{order.orderNumber}</span>
                          <span className="block truncate text-sm text-muted-foreground">
                            {order.customerName}
                          </span>
                        </span>
                        <StatusBadge status={order.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        );
      })}
    </div>
  );
}
