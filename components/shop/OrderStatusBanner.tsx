import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import type { OrderViewPayment } from "@/lib/orders/get-order";
import type { OrderStatus } from "@/lib/order-status";

const UNPAID_BANNER = "Your order is not confirmed until we receive and check your payment";
const QUOTE_BANNER = "Awaiting delivery quote — we'll email your total";
const CHECKING_BANNER = "We're checking your payment. We'll email you once it's confirmed.";
const CONFIRMED_BANNER = "Your order is confirmed 🎉";

const BANNER_BY_STATUS: Partial<Record<OrderStatus, string>> = {
  awaiting_payment: UNPAID_BANNER,
  awaiting_quote: QUOTE_BANNER,
  proof_submitted: CHECKING_BANNER,
  confirmed: CONFIRMED_BANNER,
};

/** The order's status as a large badge, with the one sentence the customer needs to act on. */
export function OrderStatusBanner({
  status,
  statusLabel,
  latestPayment,
}: {
  status: OrderStatus;
  statusLabel: string;
  latestPayment: OrderViewPayment | null;
}) {
  const banner = BANNER_BY_STATUS[status];
  const rejected =
    status === "awaiting_payment" && latestPayment?.status === "rejected";

  return (
    <section className="space-y-3">
      <Badge className="px-3 py-1 text-base">{statusLabel}</Badge>

      {banner && (
        <Alert>
          <AlertDescription>{banner}</AlertDescription>
        </Alert>
      )}

      {rejected && (
        <Alert variant="destructive">
          <AlertTitle>Your payment proof was not accepted</AlertTitle>
          <AlertDescription>
            {latestPayment.rejectReason ? `${latestPayment.rejectReason} ` : ""}Please upload a new proof.
          </AlertDescription>
        </Alert>
      )}
    </section>
  );
}
