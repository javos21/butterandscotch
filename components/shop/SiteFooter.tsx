import Image from "next/image";
import Link from "next/link";
import { CommunitySignup } from "@/components/shop/CommunitySignup";

const SOCIAL_LINKS = [
  { label: "Instagram", href: "http://instagram.com/butterandscotchtt" },
  { label: "TikTok", href: "https://www.tiktok.com/@butterandscotchtt" },
  { label: "Facebook", href: "https://www.facebook.com/butterscotchtt/" },
] as const;

const EMAIL = "butterandscotchtt@gmail.com";

/**
 * Storefront footer (spec "Footer"): social links, WhatsApp, email, Find my order, and the
 * community box. The WhatsApp link is hidden when no number is set, rather than shown broken.
 */
export function SiteFooter({ whatsappHref }: { whatsappHref: string | null }) {
  return (
    <footer className="mt-16 border-t border-olive-line bg-cream">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-8 px-4 py-10">
        <CommunitySignup />

        <nav aria-label="Footer" className="flex flex-col items-center gap-4 text-base font-bold text-olive-ink">
          <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            {SOCIAL_LINKS.map((link) => (
              <li key={link.label}>
                <a
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center rounded-xl px-2 hover:text-crimson-deep"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
          <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            {whatsappHref ? (
              <li>
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center rounded-xl px-2 hover:text-crimson-deep"
                >
                  WhatsApp us
                </a>
              </li>
            ) : null}
            <li>
              <a href={`mailto:${EMAIL}`} className="inline-flex min-h-11 items-center rounded-xl px-2 hover:text-crimson-deep">
                {EMAIL}
              </a>
            </li>
            <li>
              <Link href="/find-order" className="inline-flex min-h-11 items-center whitespace-nowrap rounded-xl px-2 hover:text-crimson-deep">
                Find my order
              </Link>
            </li>
          </ul>
        </nav>

        <Image src="/brand/logo-red-wide.png" alt="Butter and Scotch" width={471} height={238} className="h-12 w-auto" />
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
