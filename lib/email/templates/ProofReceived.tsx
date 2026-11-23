import { EmailLayout, siteUrl } from "@/lib/email/layout";
import type { ProofReceivedData } from "@/lib/email/types";
import { formatMoney } from "@/lib/money";

export default function ProofReceived({
  orderNumber,
  token,
  customerName,
  totalCents,
}: ProofReceivedData) {
  return (
    <EmailLayout>
      <p>Hi {customerName},</p>
      <p>
        Thank you. We received your payment proof for order {orderNumber} ({formatMoney(totalCents)}).
      </p>
      <p>
        Our team will check it against your bank transfer. Once they do, your order is confirmed
        and we will let you know.
      </p>
      <p>
        <a href={`${siteUrl()}/order/${token}`}>View your order</a>
      </p>
    </EmailLayout>
  );
}
