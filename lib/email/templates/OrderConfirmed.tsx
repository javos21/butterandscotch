import { EmailLayout, siteUrl } from "@/lib/email/layout";
import { formatFulfilDate } from "@/lib/format-date";
import { formatMoney } from "@/lib/money";
import type { OrderConfirmedData } from "@/lib/email/types";

export default function OrderConfirmed({
  orderNumber,
  token,
  customerName,
  fulfilDate,
  fulfilment,
  totalCents,
}: OrderConfirmedData) {
  return (
    <EmailLayout>
      <p>Hi {customerName},</p>
      <p>
        Thank you. We have received and checked your payment for order {orderNumber}, so your
        order is confirmed. Your receipt is attached to this email.
      </p>
      <p>
        {fulfilment === "pickup" ? "Pickup" : "Delivery"}: {formatFulfilDate(fulfilDate)}
      </p>
      <p>Total paid: {formatMoney(totalCents)}</p>
      <p>
        <a href={`${siteUrl()}/order/${token}`}>View your order</a>
      </p>
    </EmailLayout>
  );
}
