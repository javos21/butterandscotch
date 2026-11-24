import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { OrderFilters, ORDER_FILTERS, ordersHref, type OrderFilterValue } from "@/components/admin/OrderFilters";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listOrders } from "@/lib/admin/queries";
import { requireStaff } from "@/lib/auth/require-staff";
import { isIsoDate } from "@/lib/dates";
import { formatFulfilDate } from "@/lib/format-date";
import { formatMoney } from "@/lib/money";

const PAGE_SIZE = 25;

type SearchParams = { status?: string; q?: string; date?: string; page?: string };

function isFilter(value: string | undefined): value is OrderFilterValue {
  return ORDER_FILTERS.some((filter) => filter.value === value);
}

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireStaff();
  const params = await searchParams;

  const status: OrderFilterValue = isFilter(params.status) ? params.status : "open";
  const q = (params.q ?? "").trim().slice(0, 100);
  const parsedPage = Number.parseInt(params.page ?? "1", 10);
  const page = Number.isFinite(parsedPage) && parsedPage >= 1 ? parsedPage : 1;
  // An impossible or malformed date is ignored, the same as no date.
  const date = params.date && isIsoDate(params.date) ? params.date : undefined;

  const { rows, total } = await listOrders({ status, q, date, page });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filter = ORDER_FILTERS.find((f) => f.value === status);
  const emptyText = q ? `No orders match "${q}"` : (filter?.empty ?? "No orders");

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">Orders</h1>

      <OrderFilters active={status} q={q} date={date} />

      {rows.length === 0 ? (
        <p className="rounded-lg border bg-card px-4 py-8 text-center text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <>
          <ul className="space-y-2 lg:hidden">
            {rows.map((row) => (
              <li key={row.id}>
                <Link
                  href={`/admin/orders/${row.id}`}
                  className="block min-h-11 rounded-lg border bg-card px-4 py-3 hover:bg-muted"
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block font-medium">{row.orderNumber}</span>
                      <span className="block truncate text-sm text-muted-foreground">{row.customerName}</span>
                    </span>
                    <StatusBadge status={row.status} />
                  </span>
                  <span className="mt-2 flex flex-wrap justify-between gap-x-3 text-sm text-muted-foreground">
                    <span>{formatFulfilDate(row.fulfilDate)}</span>
                    <span className="font-medium text-foreground tabular-nums">{formatMoney(row.totalCents)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          <div className="hidden overflow-hidden rounded-lg border bg-card lg:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Fulfil date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/admin/orders/${row.id}`}
                        className="inline-flex min-h-11 items-center underline-offset-4 hover:underline"
                      >
                        {row.orderNumber}
                      </Link>
                    </TableCell>
                    <TableCell>{row.customerName}</TableCell>
                    <TableCell>{formatFulfilDate(row.fulfilDate)}</TableCell>
                    <TableCell className="capitalize">{row.fulfilment}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(row.totalCents)}</TableCell>
                    <TableCell>
                      <StatusBadge status={row.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {totalPages > 1 ? (
        <nav aria-label="Pagination" className="flex items-center justify-between gap-3">
          <PageButton
            direction="previous"
            disabled={page <= 1}
            href={ordersHref({ status, q, date, page: page - 1 })}
          />
          <span className="text-sm text-muted-foreground tabular-nums">
            Page {page} of {totalPages}
          </span>
          <PageButton
            direction="next"
            disabled={page >= totalPages}
            href={ordersHref({ status, q, date, page: page + 1 })}
          />
        </nav>
      ) : null}
    </div>
  );
}

function PageButton({ direction, disabled, href }: { direction: "previous" | "next"; disabled: boolean; href: string }) {
  const previous = direction === "previous";
  const content = (
    <>
      {previous ? <ChevronLeft className="size-4" aria-hidden="true" /> : null}
      {previous ? "Previous" : "Next"}
      {previous ? null : <ChevronRight className="size-4" aria-hidden="true" />}
    </>
  );
  if (disabled) {
    return (
      <Button variant="outline" className="min-h-11 gap-1" disabled>
        {content}
      </Button>
    );
  }
  return (
    <Button variant="outline" className="min-h-11 gap-1" asChild>
      <Link href={href}>{content}</Link>
    </Button>
  );
}
