import { EmailLayout, siteUrl } from "@/lib/email/layout";
import { formatFulfilDate } from "@/lib/format-date";
import type { DateChangedData } from "@/lib/email/types";

export default function DateChanged({
  orderNumber,
  token,
  customerName,
  oldDate,
  newDate,
}: DateChangedData) {
  return (
    <EmailLayout>
      <p>Hi {customerName},</p>
      <p>The date for order {orderNumber} has changed.</p>
      <ul style={{ paddingLeft: 20 }}>
        <li>Previous date: {formatFulfilDate(oldDate)}</li>
        <li>
          <strong>New date: {formatFulfilDate(newDate)}</strong>
        </li>
      </ul>
      <p>
        <a href={`${siteUrl()}/order/${token}`}>View your order</a>
      </p>
    </EmailLayout>
  );
}
