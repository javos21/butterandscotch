import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BankDetails } from "@/components/shop/BankDetails";
import { OrderStatusBanner } from "@/components/shop/OrderStatusBanner";
import { ProofUploadForm } from "@/components/shop/ProofUploadForm";
import { Button } from "@/components/ui/button";
import { formatFulfilDate } from "@/lib/format-date";
import { formatMoney } from "@/lib/money";
import { getOrderView } from "@/lib/orders/get-order";
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

  const whatsappHref = waLink(order.whatsappNumber, `Order ${order.orderNumber}`);
  const isDelivery = order.fulfilment === "delivery";
  const quoteOnly = isDelivery && order.deliveryFeeCents === null;

  return (
    <main className="mx-auto max-w-xl space-y-8 p-4">
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

      <section className="space-y-3">
        <h1 className="text-2xl font-semibold">Order {order.orderNumber}</h1>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Date</dt>
          <dd>{formatFulfilDate(order.fulfilDate)}</dd>
          <dt className="text-muted-foreground">Fulfilment</dt>
          <dd>{isDelivery ? "Delivery" : "Pickup"}</dd>
          {isDelivery && (
            <>
              <dt className="text-muted-foreground">Area</dt>
              <dd>{order.areaName}</dd>
              <dt className="text-muted-foreground">Address</dt>
              <dd className="whitespace-pre-line">{order.address}</dd>
            </>
          )}
        </dl>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Items</h2>
        <ul className="divide-y rounded-lg border">
          {order.items.map((item, index) => (
            <li key={`${item.name}-${item.flavour ?? ""}-${index}`} className="flex justify-between gap-3 p-3 text-sm">
              <div className="min-w-0">
                <p>
                  {item.quantity} × {item.name}
                </p>
                {item.flavour && <p className="text-muted-foreground">{item.flavour}</p>}
              </div>
              <p>{formatMoney(item.lineTotalCents)}</p>
            </li>
          ))}
        </ul>

        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt>Subtotal</dt>
            <dd>{formatMoney(order.subtotalCents)}</dd>
          </div>
          {isDelivery && quoteOnly && (
            <div className="flex justify-between">
              <dt>Delivery fee</dt>
              <dd>We&apos;ll email your total</dd>
            </div>
          )}
          {isDelivery && !quoteOnly && order.deliveryFeeCents !== null && (
            <div className="flex justify-between">
              <dt>Delivery fee</dt>
              <dd>{formatMoney(order.deliveryFeeCents)}</dd>
            </div>
          )}
          {order.adjustmentsCents !== 0 && (
            <div className="flex justify-between">
              <dt>Adjustments</dt>
              <dd>{formatMoney(order.adjustmentsCents)}</dd>
            </div>
          )}
          <div className="flex justify-between border-t pt-2 text-base font-semibold">
            <dt>Total</dt>
            <dd>
              {quoteOnly
                ? `${formatMoney(order.totalCents)} + delivery (we'll email your total)`
                : formatMoney(order.totalCents)}
            </dd>
          </div>
        </dl>
      </section>

      {order.bank && <BankDetails bank={order.bank} orderNumber={order.orderNumber} />}

      {order.canUploadProof && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Upload proof of payment</h2>
          <ProofUploadForm token={token} />
        </section>
      )}

      {order.pickupInfo && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Pickup</h2>
          <p className="whitespace-pre-line text-sm">{order.pickupInfo}</p>
        </section>
      )}

      <section className="text-sm">
        <p>Questions about this order?</p>
        {whatsappHref ? (
          <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
            Order {order.orderNumber}
          </a>
        ) : (
          <span>Order {order.orderNumber}</span>
        )}
      </section>
    </main>
  );
}
