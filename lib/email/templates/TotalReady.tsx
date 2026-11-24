import { EmailLayout, siteUrl } from "@/lib/email/layout";
import type { TotalReadyData } from "@/lib/email/types";
import { formatMoney } from "@/lib/money";

export default function TotalReady({
  orderNumber,
  token,
  customerName,
  deliveryFeeCents,
  totalCents,
  bank,
}: TotalReadyData) {
  return (
    <EmailLayout>
      <p>Hi {customerName},</p>
      <p>
        We have worked out the delivery fee for order {orderNumber}. Your total is ready.
      </p>
      <p>Delivery: {formatMoney(deliveryFeeCents)}</p>
      <p>
        <strong>Total: {formatMoney(totalCents)}</strong>
      </p>

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
