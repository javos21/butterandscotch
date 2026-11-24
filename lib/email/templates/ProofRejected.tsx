import { EmailLayout, siteUrl } from "@/lib/email/layout";
import type { ProofRejectedData } from "@/lib/email/types";
import { formatMoney } from "@/lib/money";

export default function ProofRejected({
  orderNumber,
  token,
  customerName,
  reason,
  totalCents,
}: ProofRejectedData) {
  return (
    <EmailLayout>
      <p>Hi {customerName},</p>
      <p>
        We could not confirm the payment proof for order {orderNumber} ({formatMoney(totalCents)}).
      </p>
      <p>
        <strong>Reason:</strong> {reason}
      </p>
      <p>
        Please send a new payment proof from your order page. Your order is not confirmed until we
        receive and check your payment.
      </p>
      <p>
        <a href={`${siteUrl()}/order/${token}`}>View your order</a>
      </p>
    </EmailLayout>
  );
}
