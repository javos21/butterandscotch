import Image from "next/image";
import Link from "next/link";
import { MessageCircle, Search } from "lucide-react";

/** Storefront footer (DESIGN.md "Footer"): logo, WhatsApp and Find my order, olive rules between. */
export function SiteFooter({ whatsappHref }: { whatsappHref: string | null }) {
  return (
    <footer className="mt-16 border-t border-olive-line bg-cream">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 px-4 py-8 sm:flex-row sm:justify-between">
        <Image src="/brand/logo-red-wide.png" alt="Butter and Scotch" width={471} height={238} className="h-12 w-auto" />
        <div className="flex flex-col items-center gap-3 text-base font-bold text-olive-ink sm:flex-row sm:gap-6">
          {whatsappHref ? (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-11 items-center gap-2 rounded-xl px-2 hover:text-crimson-deep"
            >
              <MessageCircle className="size-5 text-olive" aria-hidden="true" />
              Questions? WhatsApp us
            </a>
          ) : null}
          <span className="hidden h-8 w-px bg-olive-line sm:block" aria-hidden="true" />
          <Link href="/find-order" className="flex min-h-11 items-center gap-2 rounded-xl px-2 hover:text-crimson-deep">
            <Search className="size-5 text-olive" aria-hidden="true" />
            Find my order
          </Link>
        </div>
      </div>
      <div className="border-t border-olive-line">
        <p className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-2 gap-y-1 px-4 py-4 text-sm text-olive">
          Powered by
          <Image src="/brand/chaconia-labs.png" alt="Chaconia Labs" width={360} height={98} className="h-6 w-auto" />
        </p>
      </div>
    </footer>
  );
}
