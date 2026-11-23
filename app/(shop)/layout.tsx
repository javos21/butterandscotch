import Link from "next/link";
import type { ReactNode } from "react";
import { CartLink } from "@/components/shop/CartLink";
import { CartProvider } from "@/components/shop/CartProvider";
import { Toaster } from "@/components/ui/sonner";
import { getPublicSettings } from "@/lib/data/settings";
import { waLink } from "@/lib/phone";

export const dynamic = "force-dynamic";

/** Plain shell for the customer pages: header with the bag, footer with WhatsApp and order lookup. */
export default async function ShopLayout({ children }: { children: ReactNode }) {
  const settings = await getPublicSettings();
  const whatsappHref = waLink(settings.whatsapp_number);

  return (
    <CartProvider>
      <div className="flex flex-1 flex-col">
        <header className="border-b">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 p-4">
            <Link href="/" className="font-semibold">
              Butter & Scotch
            </Link>
            <CartLink />
          </div>
        </header>

        <div className="flex-1">{children}</div>

        <footer className="border-t">
          <div className="mx-auto flex max-w-3xl flex-col gap-2 p-4 text-sm">
            {whatsappHref ? (
              <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
                Questions or problems? WhatsApp us
              </a>
            ) : (
              <span>Questions or problems? WhatsApp us</span>
            )}
            <Link href="/find-order" className="underline underline-offset-4">
              Find my order
            </Link>
          </div>
        </footer>
      </div>
      <Toaster />
    </CartProvider>
  );
}
