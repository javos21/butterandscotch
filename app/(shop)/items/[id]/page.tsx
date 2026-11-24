import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { HollyDivider } from "@/components/shop/HollyDivider";
import { ItemDetail } from "@/components/shop/ItemDetail";
import { ItemPhoto } from "@/components/shop/ItemPhoto";
import { priceLabel } from "@/lib/price-label";
import { getItem } from "@/lib/data/menu";
import { getPublicSettings } from "@/lib/data/settings";
import { isUuid } from "@/lib/uuid";

export const dynamic = "force-dynamic";

async function load(id: string) {
  if (!isUuid(id)) return null;
  return getItem(id);
}

export async function generateMetadata({ params }: PageProps<"/items/[id]">): Promise<Metadata> {
  const found = await load((await params).id);
  return { title: found?.item.name ?? "Menu item" };
}

/** One item: photo, name, price, allergen note, flavour choice and Add to basket. */
export default async function ItemPage({ params }: PageProps<"/items/[id]">) {
  const { id } = await params;
  const [found, settings] = await Promise.all([load(id), getPublicSettings()]);
  if (!found) notFound();
  const { item, sectionName } = found;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-8">
      <HollyDivider className="mb-4" />
      <nav aria-label="Breadcrumb" className="mb-4 text-[0.9375rem] font-bold">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link href="/#menu" className="text-crimson-deep hover:underline hover:underline-offset-4">
              Our menu
            </Link>
          </li>
          <li aria-hidden="true" className="text-olive">
            /
          </li>
          <li className="text-olive-ink" aria-current="page">
            {sectionName}
          </li>
        </ol>
      </nav>

      <div className="grid gap-7 md:grid-cols-2 md:gap-10">
        <div className="relative">
          <ItemPhoto
            src={item.image_url}
            name={item.name}
            sizes="(min-width: 768px) 50vw, 100vw"
            priority
            className="aspect-[4/3] rounded-[22px] md:aspect-square"
          />
          {item.seasonal ? (
            <span className="absolute top-4 left-4 rounded-full bg-card-cream px-3.5 py-1 text-base font-bold text-crimson-deep">
              Seasonal
            </span>
          ) : null}
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <h1 className="font-display text-[2.25rem] leading-[1.06] text-oxblood sm:text-5xl">{item.name}</h1>
            <p className="text-2xl font-extrabold text-olive-ink">{priceLabel(item)}</p>
            {item.description ? <p className="max-w-prose text-lg text-olive-ink">{item.description}</p> : null}
            {item.allergen_note ? (
              <p className="w-fit rounded-lg bg-sage-wash px-3 py-1.5 text-[0.9375rem] font-bold text-olive-ink">
                {item.allergen_note}
              </p>
            ) : null}
          </div>
          {settings.store_open ? (
            <ItemDetail item={item} leadDays={settings.lead_time_days} />
          ) : (
            <p className="rounded-2xl bg-cream-warm p-4 text-base font-bold text-olive-ink">
              We&rsquo;re not taking orders right now. Check back soon.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
