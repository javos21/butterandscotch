import { EmailLayout } from "@/lib/email/layout";
import type { StaffProofReceivedData } from "@/lib/email/types";
import { formatMoney } from "@/lib/money";

export default function StaffProofReceived({
  orderNumber,
  customerName,
  totalCents,
  adminUrl,
}: StaffProofReceivedData) {
  return (
    <EmailLayout>
      <p>
        <strong>Payment proof for order {orderNumber}</strong> from {customerName}.
      </p>
      <ul style={{ paddingLeft: 20 }}>
        <li>Total: {formatMoney(totalCents)}</li>
      </ul>
      <p>Please check the bank transfer and confirm or reject the payment.</p>
      <p>
        <a href={adminUrl}>Open the order</a>
      </p>
    </EmailLayout>
  );
}
