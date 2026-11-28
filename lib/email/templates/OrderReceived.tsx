import { EmailLayout, siteUrl } from "@/lib/email/layout";
import type { OrderReceivedData } from "@/lib/email/types";
import { formatMoney } from "@/lib/money";

export default function OrderReceived({
  orderNumber,
  token,
  customerName,
  items,
  subtotalCents,
  totalCents,
  fulfilment,
  bank,
}: OrderReceivedData) {
  return (
    <EmailLayout>
      <p>Hi {customerName},</p>
      <p>Thank you for your order {orderNumber}.</p>

      <ul style={{ paddingLeft: 20 }}>
        {items.map((item, index) => (
          <li key={index}>
            {item.quantity} × {item.name}
            {item.flavour ? ` (${item.flavour})` : ""}: {formatMoney(item.lineTotalCents)}
          </li>
        ))}
      </ul>

      <p>Subtotal: {formatMoney(subtotalCents)}</p>
      <p>
        <strong>{`Total: ${formatMoney(totalCents)}`}</strong>
      </p>
      {fulfilment === "delivery" && (
        <p>
          Once your order is confirmed we will contact you with your total delivery amount. Delivery
          can be paid via cash or card upon delivery.
        </p>
      )}

      <p>
        <strong>Pay by bank transfer</strong>
      </p>
      <ul style={{ paddingLeft: 20 }}>
        <li>Bank: {bank.bank}</li>
        <li>Account name: {bank.account_name}</li>
        <li>Account type: {bank.account_type}</li>
        <li>Transit: {bank.transit}</li>
        <li>Account # (from Scotiabank): {bank.account_no_same_bank}</li>
        <li>Account # (from another bank): {bank.account_no_other_bank}</li>
      </ul>
      <p>Please use your order number {orderNumber} as the payment reference.</p>

      <p>
        <strong>Your order is not confirmed until we receive and check your payment.</strong>
      </p>

      <p>
        <a href={`${siteUrl()}/order/${token}`}>View your order</a>
      </p>
    </EmailLayout>
  );
}
