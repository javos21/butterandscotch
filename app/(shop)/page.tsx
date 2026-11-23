import { MenuItemCard } from "@/components/shop/MenuItemCard";
import { getMenu } from "@/lib/data/menu";
import { getPublicSettings } from "@/lib/data/settings";
import { waLink } from "@/lib/phone";

export const dynamic = "force-dynamic";

const CLOSED_MESSAGE = "We're not taking orders right now — check back soon.";

/** The menu, grouped by section, with an add-to-bag control on every item. */
export default async function MenuPage() {
  const [menu, settings] = await Promise.all([getMenu(), getPublicSettings()]);

  if (!settings.store_open) {
    return (
      <main className="mx-auto max-w-3xl p-4">
        <p>{CLOSED_MESSAGE}</p>
      </main>
    );
  }

  const whatsappHref = waLink(settings.whatsapp_number);

  return (
    <main className="mx-auto max-w-3xl space-y-10 p-4">
      {menu.sections.map((section) => (
        <section key={section.id} className="space-y-4">
          <h2 className="text-xl font-semibold">{section.name}</h2>
          {section.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing in this section right now.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {section.items.map((item) => (
                <MenuItemCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </section>
      ))}

      <p className="text-sm">
        Ordering more than this, or something custom?{" "}
        {whatsappHref ? (
          <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
            Message us on WhatsApp first.
          </a>
        ) : (
          "Message us on WhatsApp first."
        )}
      </p>
    </main>
  );
}
