import Link from "next/link";
import { FileText } from "lucide-react";
import { isPdfPath } from "@/lib/admin/proof-file";
import { Button } from "@/components/ui/button";
import { listPaymentQueue, type PaymentQueueRow } from "@/lib/admin/queries";
import { requireStaff } from "@/lib/auth/require-staff";
import { formatFulfilDate } from "@/lib/format-date";
import { formatMoney } from "@/lib/money";

export default async function AdminPaymentsPage() {
  await requireStaff();
  const rows = await listPaymentQueue();

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">Payments</h1>

      {rows.length === 0 ? (
        <p className="rounded-lg border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          No proofs to check
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={row.paymentId ?? row.orderId}>
              <PaymentCard row={row} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PaymentCard({ row }: { row: PaymentQueueRow }) {
  return (
    <article className="flex gap-3 rounded-xl border bg-card p-3">
      <Thumbnail receiptPath={row.receiptPath} receiptUrl={row.receiptUrl} />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="min-w-0">
          <h2 className="font-semibold">{row.orderNumber}</h2>
          <p className="truncate text-sm">{row.customerName}</p>
          <p className="text-sm text-muted-foreground">{formatFulfilDate(row.fulfilDate)}</p>
          <p className="text-sm tabular-nums">Expected {formatMoney(row.totalCents)}</p>
        </div>

        {row.stuck ? (
          <p className="text-sm font-medium text-status-warning">No proof file — ask the customer to re-upload</p>
        ) : null}

        <div>
          <Button variant={row.stuck ? "outline" : "default"} className="min-h-11" asChild>
            <Link href={row.stuck ? `/admin/orders/${row.orderId}` : `/admin/orders/${row.orderId}#proof`}>
              {row.stuck ? "Open order" : "Review"}
              <span className="sr-only"> {row.orderNumber}</span>
            </Link>
          </Button>
        </div>
      </div>
    </article>
  );
}

function Thumbnail({ receiptPath, receiptUrl }: { receiptPath: string | null; receiptUrl: string | null }) {
  if (!receiptUrl) {
    return (
      <div className="flex size-20 shrink-0 items-center justify-center rounded-lg border bg-muted text-xs text-muted-foreground">
        No file
      </div>
    );
  }
  if (isPdfPath(receiptPath)) {
    return (
      <div className="flex size-20 shrink-0 flex-col items-center justify-center gap-1 rounded-lg border bg-muted text-xs font-medium">
        <FileText className="size-6 text-muted-foreground" aria-hidden="true" />
        PDF
      </div>
    );
  }
  return (
    // Signed storage URL, so next/image is not used.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={receiptUrl} alt="Payment proof" className="size-20 shrink-0 rounded-lg border object-cover" />
  );
}
