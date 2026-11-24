import { EmailLayout, siteUrl } from "@/lib/email/layout";
import type { OrderCancelledData } from "@/lib/email/types";

export default function OrderCancelled({
  orderNumber,
  token,
  customerName,
  reason,
}: OrderCancelledData) {
  return (
    <EmailLayout>
      <p>Hi {customerName},</p>
      <p>Order {orderNumber} has been cancelled.</p>
      <p>
        <strong>Reason:</strong> {reason}
      </p>
      <p>
        <a href={`${siteUrl()}/order/${token}`}>View your order</a>
      </p>
    </EmailLayout>
  );
}
