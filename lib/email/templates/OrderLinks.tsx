import { EmailLayout, siteUrl } from "@/lib/email/layout";
import { formatFulfilDate } from "@/lib/format-date";
import type { OrderLinksData } from "@/lib/email/types";

export default function OrderLinks({ customerName, orders }: OrderLinksData) {
  return (
    <EmailLayout>
      <p>{customerName ? `Hi ${customerName},` : "Hello,"}</p>
      <p>Here are your Butter & Scotch orders:</p>
      <ul style={{ paddingLeft: 20 }}>
        {orders.map((order) => (
          <li key={order.orderNumber} style={{ marginBottom: 8 }}>
            <strong>{order.orderNumber}</strong> for {formatFulfilDate(order.fulfilDate)}:{" "}
            <a href={`${siteUrl()}/order/${order.token}`}>View your order</a>
          </li>
        ))}
      </ul>
    </EmailLayout>
  );
}
