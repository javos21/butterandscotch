import type { ReactNode } from "react";
import { CartProvider } from "@/components/shop/CartProvider";
import { SiteFooter } from "@/components/shop/SiteFooter";
import { SiteHeader } from "@/components/shop/SiteHeader";
import { Toaster } from "@/components/ui/sonner";
import { getPublicSettings } from "@/lib/data/settings";
import { waLink } from "@/lib/phone";

export const dynamic = "force-dynamic";

/** Customer shell: cream header with logo and basket, footer with WhatsApp and order lookup. */
export default async function ShopLayout({ children }: { children: ReactNode }) {
  const settings = await getPublicSettings();
  const whatsappHref = waLink(settings.whatsapp_number);

  return (
    <CartProvider>
      <div className="flex flex-1 flex-col bg-cream">
        <SiteHeader whatsappHref={whatsappHref} />
        <div className="flex-1">{children}</div>
        <SiteFooter whatsappHref={whatsappHref} />
      </div>
      <Toaster position="top-center" />
    </CartProvider>
  );
}
