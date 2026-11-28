import { EmailLayout } from "@/lib/email/layout";
import type { StaffNewOrderData } from "@/lib/email/types";
import { formatMoney } from "@/lib/money";

export default function StaffNewOrder({
  orderNumber,
  customerName,
  email,
  phone,
  fulfilDate,
  totalCents,
  adminUrl,
}: StaffNewOrderData) {
  return (
    <EmailLayout>
      <p>
        <strong>New order {orderNumber}</strong> from {customerName}.
      </p>
      <ul style={{ paddingLeft: 20 }}>
        <li>Email: {email}</li>
        <li>WhatsApp: {phone}</li>
        <li>Date: {fulfilDate}</li>
        <li>Total: {formatMoney(totalCents)}</li>
      </ul>
      <p>
        <a href={adminUrl}>Open the order</a>
      </p>
    </EmailLayout>
  );
}
