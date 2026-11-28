import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BankDetails } from "@/components/shop/BankDetails";
import { OrderStatusBanner } from "@/components/shop/OrderStatusBanner";
import { ProofUploadForm } from "@/components/shop/ProofUploadForm";
import { Button } from "@/components/ui/button";
import { formatFulfilDate } from "@/lib/format-date";
import { formatMoney } from "@/lib/money";
import { getOrderView } from "@/lib/orders/get-order";
import { orderQuestionText } from "@/lib/orders/order-question";
import { waLink } from "@/lib/phone";
import { hasReceipt } from "@/lib/receipt/receipt-data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your order",
  robots: { index: false, follow: false },
};

/** The customer's private order page, reached only by its access token. */
export default async function OrderPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const order = await getOrderView(token);
  if (!order) notFound();

  const whatsappHref = waLink(order.whatsappNumber, orderQuestionText(order.orderNumber));
  const isDelivery = order.fulfilment === "delivery";

  return (
    <main className="mx-auto max-w-xl space-y-5 px-4 pb-6">
      <OrderStatusBanner
        status={order.status}
        statusLabel={order.statusLabel}
        latestPayment={order.latestPayment}
      />

      {hasReceipt(order.status) && (
        <Button asChild variant="outline" className="min-h-11 w-full">
          <a href={`/order/${token}/receipt`}>Download receipt</a>
        </Button>
      )}

      <section className="space-y-4 rounded-[22px] border border-olive-line bg-card-cream p-4 sm:p-6">
        <h1 className="font-display text-[clamp(2rem,7vw,2.75rem)] leading-tight text-oxblood">Order {order.orderNumber}</h1>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-base text-olive-ink">
          <dt className="text-olive">Date</dt>
          <dd>{formatFulfilDate(order.fulfilDate)}</dd>
          <dt className="text-olive">Fulfilment</dt>
          <dd>{isDelivery ? "Delivery" : "Pickup"}</dd>
          {isDelivery && (
            <>
              <dt className="text-olive">Address</dt>
              <dd className="whitespace-pre-line">{order.address}</dd>
            </>
          )}
        </dl>
      </section>

      <section className="space-y-4 rounded-[22px] border border-olive-line bg-card-cream p-4 sm:p-6">
        <h2 className="font-display text-2xl leading-tight text-crimson-deep">Items</h2>
        <ul className="divide-y divide-olive-line">
          {order.items.map((item, index) => (
            <li key={`${item.name}-${item.flavour ?? ""}-${index}`} className="flex justify-between gap-3 py-3 text-base text-olive-ink">
              <div className="min-w-0">
                <p>
                  {item.quantity} × {item.name}
                </p>
                {item.flavour && <p className="text-olive">{item.flavour}</p>}
              </div>
              <p>{formatMoney(item.lineTotalCents)}</p>
            </li>
          ))}
        </ul>

        <dl className="space-y-2 rounded-2xl bg-cream-warm p-4 text-base text-olive-ink">
          <div className="flex justify-between">
            <dt>Subtotal</dt>
            <dd>{formatMoney(order.subtotalCents)}</dd>
          </div>
          {order.adjustmentsCents !== 0 && (
            <div className="flex justify-between">
              <dt>Adjustments</dt>
              <dd>{formatMoney(order.adjustmentsCents)}</dd>
            </div>
          )}
          <div className="flex justify-between border-t border-olive-line pt-2 text-xl font-extrabold">
            <dt>Total</dt>
            <dd>{formatMoney(order.totalCents)}</dd>
          </div>
        </dl>
      </section>

      {order.bank && <BankDetails bank={order.bank} orderNumber={order.orderNumber} />}

      {order.canUploadProof && (
        <section className="space-y-4 rounded-[22px] border border-olive-line bg-card-cream p-4 sm:p-6">
          <h2 className="font-display text-2xl leading-tight text-crimson-deep">Upload proof of payment</h2>
          <ProofUploadForm token={token} />
        </section>
      )}

      {isDelivery && (
        <p className="text-center text-base text-olive-ink">
          Once your order is confirmed we will contact you with your total delivery amount. Delivery can be paid via
          cash or card upon delivery.
        </p>
      )}

      {order.pickupInfo && (
        <section className="space-y-2 rounded-[22px] border border-olive-line bg-card-cream p-4 sm:p-6">
          <h2 className="font-display text-2xl leading-tight text-crimson-deep">Pickup</h2>
          <p className="whitespace-pre-line text-base text-olive-ink">{order.pickupInfo}</p>
        </section>
      )}

      <section className="text-center text-base text-olive-ink">
        <p>Questions about this order?</p>
        {whatsappHref ? (
          <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="font-bold text-crimson-deep underline underline-offset-4">
            Order {order.orderNumber}
          </a>
        ) : (
          <span>Order {order.orderNumber}</span>
        )}
      </section>
    </main>
  );
}
