import Image from "next/image";
import { ArrowRight, CalendarDays, Landmark, ReceiptText, ShoppingBasket, CalendarCheck } from "lucide-react";
import { HollyDivider } from "@/components/shop/HollyDivider";
import { MenuItemCard } from "@/components/shop/MenuItemCard";
import { getMenu } from "@/lib/data/menu";
import { getPublicSettings } from "@/lib/data/settings";
import { waLink } from "@/lib/phone";
import { SEASON, YEAR_ROUND } from "@/lib/season";

export const dynamic = "force-dynamic";

/** Home: hero, the menu by section, how ordering works, and the payment promise. */
export default async function MenuPage() {
  const [menu, settings] = await Promise.all([getMenu(), getPublicSettings()]);
  const whatsappHref = waLink(settings.whatsapp_number, "Hi! I'd like to ask about a larger order.");
  const festive = SEASON.festive;
  const copy = festive ? SEASON : YEAR_ROUND;
  let cardIndex = 0;

  return (
    <main>
      <section className="mx-auto max-w-6xl px-4 pt-2 text-center">
        {festive ? <HollyDivider className="mb-3" /> : null}
        <h1 className="mx-auto max-w-[14ch] font-display text-[clamp(2.4rem,9vw,4.25rem)] leading-[1.04] tracking-[-0.01em] text-oxblood">
          {copy.heroTitle}
        </h1>
      </section>

      <div className="mx-auto mt-6 max-w-6xl md:px-4">
        <div className="relative aspect-[4/3] overflow-hidden md:aspect-[21/9] md:rounded-[22px]">
          <Image
            src={SEASON.heroImage.src}
            alt={SEASON.heroImage.alt}
            fill
            priority
            sizes="(min-width: 1152px) 1120px, 100vw"
            className="object-cover"
          />
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4">
        {settings.store_open ? (
          <a
            href="#menu"
            className="mx-auto -mt-7 relative flex min-h-14 max-w-xl items-center justify-center gap-3 rounded-2xl bg-crimson px-6 text-lg font-bold text-cream shadow-[0_10px_30px_rgba(86,0,8,0.18)] transition-colors hover:bg-crimson-deep active:scale-[0.99] sm:text-xl"
          >
            {copy.heroCta}
            <ArrowRight className="size-6" aria-hidden="true" />
          </a>
        ) : (
          <p className="mx-auto -mt-7 relative max-w-xl rounded-2xl bg-card-cream px-6 py-4 text-center text-lg font-bold text-olive-ink ring-1 ring-olive-line">
            We&rsquo;re not taking orders right now. Check back soon.
          </p>
        )}

        <div className="mt-5 flex items-center justify-center gap-3 text-[0.875rem] font-bold whitespace-nowrap text-olive-ink min-[400px]:gap-4 min-[400px]:text-[0.9375rem] sm:text-base">
          <span className="flex items-center gap-2">
            <CalendarDays className="size-6 text-olive" strokeWidth={1.75} aria-hidden="true" />
            {settings.lead_time_days}-day lead time
          </span>
          <span className="h-7 w-px bg-olive-line" aria-hidden="true" />
          <span className="flex items-center gap-2">
            <Landmark className="size-6 text-olive" strokeWidth={1.75} aria-hidden="true" />
            Bank transfer
          </span>
        </div>
        <p className="mt-2 text-center text-sm text-olive">All prices are in TTD.</p>
      </div>

      {settings.store_open ? (
        <div id="menu" className="mx-auto max-w-6xl scroll-mt-4 space-y-12 px-4 pt-12">
          {menu.sections.map((section) =>
            section.items.length === 0 ? null : (
              <section key={section.id} aria-labelledby={`section-${section.id}`} className="space-y-5">
                <div className="space-y-2 text-center">
                  {festive ? <HollyDivider /> : null}
                  <h2 id={`section-${section.id}`} className="font-display text-[clamp(1.75rem,6vw,2.5rem)] leading-[1.1] text-crimson-deep">
                    {section.name}
                  </h2>
                </div>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5 xl:grid-cols-4">
                  {section.items.map((item) => (
                    <MenuItemCard key={item.id} item={item} priority={cardIndex++ < 2} />
                  ))}
                </div>
              </section>
            ),
          )}
        </div>
      ) : null}

      <section aria-labelledby="how-heading" className="mx-auto mt-14 max-w-5xl space-y-6 px-4">
        <div className="flex items-center gap-4">
          <span className="h-[1.5px] flex-1 bg-olive" aria-hidden="true" />
          <h2 id="how-heading" className="text-center font-display text-[clamp(1.75rem,6vw,2.5rem)] leading-[1.1] text-crimson-deep">
            Ordering made easy
          </h2>
          <span className="h-[1.5px] flex-1 bg-olive" aria-hidden="true" />
        </div>
        <ol className="grid gap-4 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-olive-line">
          {[
            { icon: ShoppingBasket, label: "Choose your bakes" },
            { icon: CalendarCheck, label: "Pick a date" },
            { icon: ReceiptText, label: "See your total" },
          ].map(({ icon: Icon, label }, index) => (
            <li key={label} className="flex items-center gap-3 sm:justify-center sm:px-3">
              <Icon className="size-9 shrink-0 text-olive" strokeWidth={1.5} aria-hidden="true" />
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-crimson text-lg font-extrabold text-cream">
                {index + 1}
              </span>
              <span className="text-lg font-bold leading-tight text-olive-ink">{label}</span>
            </li>
          ))}
        </ol>
        <p className="text-center text-base text-olive-ink">Delivery fee included before checkout.</p>
        <p className="rounded-2xl bg-crimson px-5 py-3.5 text-center text-base font-bold leading-snug text-cream sm:text-lg">
          Your order is confirmed after payment proof is checked.
        </p>
      </section>

      {whatsappHref ? (
        <section className="mx-auto mt-8 max-w-5xl px-4">
          <div className="flex flex-col items-center gap-4 rounded-2xl bg-sage-wash px-5 py-5 text-center sm:flex-row sm:justify-between sm:text-left">
            <h2 className="font-display text-[1.75rem] leading-tight text-crimson-deep">Gifting or catering?</h2>
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-12 items-center justify-center rounded-2xl bg-crimson px-6 text-base font-bold text-cream transition-colors hover:bg-crimson-deep"
            >
              Ask about a larger order
            </a>
          </div>
        </section>
      ) : null}
    </main>
  );
}
