import { CheckoutForm } from "@/components/shop/CheckoutForm";
import { BOOKING_HORIZON_DAYS, trinidadToday, addDays } from "@/lib/dates";
import { getMenu, getUnavailableDates } from "@/lib/data/menu";
import { getPublicSettings } from "@/lib/data/settings";
import { isOrderingClosed } from "@/lib/dates";

export const dynamic = "force-dynamic";

/** Checkout. The date window and unavailable dates are computed on the server in Trinidad time. */
export default async function CheckoutPage() {
  const today = trinidadToday(new Date());
  const [menu, settings, unavailable] = await Promise.all([
    getMenu(),
    getPublicSettings(),
    getUnavailableDates(today, addDays(today, BOOKING_HORIZON_DAYS)),
  ]);

  const allergenNotes = menu.sections.flatMap((section) =>
    section.items.flatMap((item) =>
      item.allergen_note ? [{ name: item.name, note: item.allergen_note }] : [],
    ),
  );

  return (
    <CheckoutForm
      allergenNotes={allergenNotes}
      leadDays={settings.lead_time_days}
      today={today}
      unavailable={unavailable}
      lastFulfilmentDate={settings.last_fulfilment_date}
      orderingClosed={isOrderingClosed(new Date(), settings.order_close_date)}
      pickupLocations={settings.pickup_locations}
      policyText={settings.policy_text}
      whatsappNumber={settings.whatsapp_number}
    />
  );
}
