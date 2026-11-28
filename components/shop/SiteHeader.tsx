import Image from "next/image";
import Link from "next/link";
import { Menu, Search, UtensilsCrossed, MessageCircle } from "lucide-react";
import { CartLink } from "@/components/shop/CartLink";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

/**
 * Storefront header (spec "Navigation bar"): brand red bar, beige text, larger centred logo.
 * The logo file is red, so it is inverted to beige on the bar.
 */
export function SiteHeader({ whatsappHref }: { whatsappHref: string | null }) {
  return (
    <header className="bg-crimson text-beige">
      <div className="mx-auto grid max-w-6xl grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 pt-3 pb-3">
        <Sheet>
          <SheetTrigger
            className="flex min-h-11 items-center gap-2 justify-self-start rounded-xl px-2 text-beige hover:bg-crimson-deep"
            aria-label="Open menu"
          >
            <Menu className="size-7" strokeWidth={1.75} aria-hidden="true" />
            <span className="hidden text-base font-bold sm:inline">Menu</span>
          </SheetTrigger>
          <SheetContent side="left" className="w-[85vw] max-w-xs bg-cream">
            <SheetHeader>
              <SheetTitle className="font-display text-2xl font-normal text-crimson-deep">Butter & Scotch</SheetTitle>
            </SheetHeader>
            <nav aria-label="Main" className="flex flex-col gap-1 px-4">
              <SheetLink href="/#menu" icon={<UtensilsCrossed className="size-5" aria-hidden="true" />}>
                Our menu
              </SheetLink>
              <SheetLink href="/find-order" icon={<Search className="size-5" aria-hidden="true" />}>
                Find my order
              </SheetLink>
              {whatsappHref ? (
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-base font-bold text-olive-ink hover:bg-cream-warm"
                >
                  <MessageCircle className="size-5 text-olive" aria-hidden="true" />
                  WhatsApp us
                </a>
              ) : null}
            </nav>
          </SheetContent>
        </Sheet>

        <Link href="/" className="justify-self-center" aria-label="Butter & Scotch home">
          <Image
            src="/brand/logo-red-wide.png"
            alt="Butter and Scotch"
            width={471}
            height={238}
            priority
            className="h-16 w-auto brightness-0 invert sm:h-20"
          />
        </Link>

        <div className="flex items-center gap-1 justify-self-end sm:gap-3">
          <Link
            href="/find-order"
            className="flex min-h-11 items-center whitespace-nowrap rounded-xl px-1 text-[0.8125rem] font-bold text-beige hover:bg-crimson-deep sm:px-2 sm:text-sm"
          >
            Find my order
          </Link>
          <span className="hidden h-9 w-px bg-beige/40 sm:block" aria-hidden="true" />
          <CartLink />
        </div>
      </div>
    </header>
  );
}

function SheetLink({ href, icon, children }: { href: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-base font-bold text-olive-ink hover:bg-cream-warm [&_svg]:text-olive"
    >
      {icon}
      {children}
    </Link>
  );
}
