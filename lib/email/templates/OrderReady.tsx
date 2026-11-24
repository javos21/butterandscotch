import { EmailLayout, siteUrl } from "@/lib/email/layout";
import type { OrderReadyData } from "@/lib/email/types";

export default function OrderReady({
  orderNumber,
  token,
  customerName,
  fulfilment,
  pickupInfo,
}: OrderReadyData) {
  const isPickup = fulfilment === "pickup";
  return (
    <EmailLayout>
      <p>Hi {customerName},</p>
      {isPickup ? (
        <>
          <p>Order {orderNumber} is ready for pickup.</p>
          {pickupInfo && <p>{pickupInfo}</p>}
        </>
      ) : (
        <p>Order {orderNumber} is on its way.</p>
      )}
      <p>
        <a href={`${siteUrl()}/order/${token}`}>View your order</a>
      </p>
    </EmailLayout>
  );
}
