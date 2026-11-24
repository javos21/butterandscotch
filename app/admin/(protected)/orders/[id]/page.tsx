import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Download, Mail, MessageCircle } from "lucide-react";
import { OrderActionsBar } from "@/components/admin/OrderActionsBar";
import { ProofReviewCard } from "@/components/admin/ProofReviewCard";
import { RequestProofAgainButton } from "@/components/admin/RequestProofAgainButton";
import { SetFeeForm } from "@/components/admin/SetFeeForm";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Button } from "@/components/ui/button";
import { getAdminOrder } from "@/lib/admin/queries";
import { requireStaff } from "@/lib/auth/require-staff";
import { TT_TIME_ZONE, trinidadToday } from "@/lib/dates";
import { formatFulfilDate } from "@/lib/format-date";
import { formatMoney, lineTotal } from "@/lib/money";
import { waLink } from "@/lib/phone";
import type { OrderStatus } from "@/lib/order-status";
import { isUuid } from "@/lib/uuid";

const EVENT_LABEL: Record<string, string> = {
  fee_set: "Delivery fee set",
  date_changed: "Date changed",
  proof_submitted: "Payment proof uploaded",
  payment_confirmed: "Payment confirmed",
  payment_rejected: "Payment proof rejected",
  order_confirmed: "Order confirmed",
  order_ready: "Order marked ready",
  total_ready: "Total emailed",
  proof_rejected: "Proof rejection emailed",
  order_cancelled: "Order cancelled",
};

const EMAIL_LABEL: Record<string, string> = {
  order_confirmed: "Confirmation email",
  proof_rejected: "Proof rejection email",
  total_ready: "Total email",
  date_changed: "Date change email",
  order_cancelled: "Cancellation email",
  order_ready: "Ready email",
};

const RECEIPT_STATUSES: OrderStatus[] = ["confirmed", "ready", "completed"];

function humanise(text: string): string {
  const spaced = text.replace(/_/g, " ").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function whenLabel(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    timeZone: TT_TIME_ZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const order = await getAdminOrder(id);
  if (!order) notFound();

  const whatsapp = waLink(order.phone, `Order ${order.orderNumber}`);
  const hasAllergy = order.allergies.trim() !== "" && order.allergies.trim() !== "None";
  // A stuck proof has no submitted payment row. An older rejected payment is not shown as the proof.
  const proof = order.latestPayment?.status === "submitted" ? order.latestPayment : null;

  const timeline = [
    ...order.events.map((event) => ({
      key: `event-${event.id}`,
      at: event.createdAt,
      text: EVENT_LABEL[event.kind] ?? humanise(event.kind),
      failed: false,
    })),
    ...order.emails.map((email, index) => ({
      key: `email-${index}-${email.sentAt}`,
      at: email.sentAt,
      text: `${EMAIL_LABEL[email.template] ?? humanise(email.template)} to ${email.toEmail}`,
      failed: email.error !== null,
    })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  return (
    <div className="space-y-6">
      <Link href="/admin/orders" className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" aria-hidden="true" />
        Orders
      </Link>

      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold">{order.orderNumber}</h1>
          <StatusBadge status={order.status} />
        </div>
        <p className="text-base">{order.customerName}</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          {whatsapp ? (
            <Button variant="outline" className="min-h-11 gap-2" asChild>
              <a href={whatsapp} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="size-4" aria-hidden="true" />
                WhatsApp {order.phone}
              </a>
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">{order.phone}</p>
          )}
          <Button variant="outline" className="min-h-11 gap-2" asChild>
            <a href={`mailto:${order.email}`}>
              <Mail className="size-4" aria-hidden="true" />
              Email {order.email}
            </a>
          </Button>
        </div>
      </header>

      <section aria-labelledby="details-heading" className="space-y-3 rounded-xl border bg-card p-4">
        <h2 id="details-heading" className="text-base font-semibold">
          Details
        </h2>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Fulfil date</dt>
            <dd className="font-medium">{formatFulfilDate(order.fulfilDate)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Fulfilment</dt>
            <dd className="font-medium capitalize">{order.fulfilment}</dd>
          </div>
          {order.fulfilment === "delivery" ? (
            <>
              <div>
                <dt className="text-muted-foreground">Area</dt>
                <dd className="font-medium">{order.areaName ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Address</dt>
                <dd className="font-medium break-words">{order.address ?? "—"}</dd>
              </div>
            </>
          ) : null}
        </dl>
      </section>

      <section aria-labelledby="items-heading" className="space-y-3 rounded-xl border bg-card p-4">
        <h2 id="items-heading" className="text-base font-semibold">
          Items
        </h2>
        <ul className="divide-y text-sm">
          {order.items.map((item, index) => (
            <li key={`${item.name}-${item.flavour}-${index}`} className="flex items-start justify-between gap-3 py-2">
              <span className="min-w-0">
                <span className="block font-medium">
                  {item.quantity} × {item.name} ({item.unitLabel})
                </span>
                {item.flavour ? <span className="block text-muted-foreground">{item.flavour}</span> : null}
              </span>
              <span className="shrink-0 tabular-nums">{formatMoney(lineTotal(item.unitPriceCents, item.quantity))}</span>
            </li>
          ))}
        </ul>
        {hasAllergy ? (
          <p className="rounded-lg bg-status-warning-bg px-3 py-2 text-sm font-medium text-status-warning">
            Allergies: {order.allergies}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">Allergies: None</p>
        )}
        {order.notes ? (
          <p className="text-sm">
            <span className="text-muted-foreground">Notes: </span>
            {order.notes}
          </p>
        ) : null}
      </section>

      <section aria-labelledby="totals-heading" className="rounded-xl border bg-card p-4">
        <h2 id="totals-heading" className="sr-only">
          Totals
        </h2>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Subtotal</dt>
            <dd className="tabular-nums">{formatMoney(order.subtotalCents)}</dd>
          </div>
          {order.adjustmentsCents !== 0 ? (
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Adjustments</dt>
              <dd className="tabular-nums">{formatMoney(order.adjustmentsCents)}</dd>
            </div>
          ) : null}
          {order.fulfilment === "delivery" ? (
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Delivery fee</dt>
              <dd className="tabular-nums">
                {order.deliveryFeeCents === null ? "To be set" : formatMoney(order.deliveryFeeCents)}
              </dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-3 border-t pt-2 text-base font-semibold">
            <dt>Total</dt>
            <dd className="tabular-nums">{formatMoney(order.totalCents)}</dd>
          </div>
        </dl>
      </section>

      {order.status === "proof_submitted" ? (
        proof ? (
          <ProofReviewCard
            paymentId={proof.id}
            receiptPath={proof.receiptPath}
            receiptUrl={proof.receiptUrl}
            reference={proof.reference}
            totalCents={order.totalCents}
          />
        ) : (
          <section aria-labelledby="stuck-heading" className="space-y-2 rounded-xl border bg-card p-4">
            <h2 id="stuck-heading" className="text-base font-semibold">
              Payment proof
            </h2>
            <p className="text-sm">No proof file — ask the customer to re-upload</p>
            <RequestProofAgainButton orderId={order.id} />
          </section>
        )
      ) : null}

      {order.status === "awaiting_quote" ? <SetFeeForm orderId={order.id} /> : null}

      <OrderActionsBar
        orderId={order.id}
        status={order.status}
        fulfilDate={order.fulfilDate}
        today={trinidadToday(new Date())}
      />

      {RECEIPT_STATUSES.includes(order.status) ? (
        <Button variant="outline" className="min-h-11 gap-2" asChild>
          <a href={`/admin/orders/${order.id}/receipt`}>
            <Download className="size-4" aria-hidden="true" />
            Download receipt
          </a>
        </Button>
      ) : null}

      <section aria-labelledby="history-heading" className="space-y-3">
        <h2 id="history-heading" className="text-base font-semibold">
          History
        </h2>
        {timeline.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing yet</p>
        ) : (
          <ol className="space-y-2 text-sm">
            {timeline.map((entry) => (
              <li key={entry.key} className="rounded-lg border bg-card px-3 py-2">
                <span className="block font-medium">{entry.text}</span>
                <span className="block text-muted-foreground">{whenLabel(entry.at)}</span>
                {entry.failed ? <span className="block font-medium text-status-danger">Email failed to send</span> : null}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
