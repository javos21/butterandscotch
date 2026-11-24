import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import { ProductFlagSwitch } from "@/components/admin/ProductFlagSwitch";
import { ProductPhoto } from "@/components/admin/ProductPhoto";
import { Button } from "@/components/ui/button";
import { loadMenuAdmin } from "@/lib/admin/products-repo";
import { requireStaff } from "@/lib/auth/require-staff";
import { priceLabel } from "@/lib/price-label";

/** Every menu item by section, with On menu and Seasonal switches, and a link to edit price and photo. */
export default async function AdminMenuPage() {
  await requireStaff();
  const sections = await loadMenuAdmin();
  const total = sections.reduce((sum, section) => sum + section.items.length, 0);
  const onMenu = sections.reduce((sum, section) => sum + section.items.filter((item) => item.active).length, 0);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Menu</h1>
          <p className="text-sm text-muted-foreground">
            {onMenu} of {total} items on the menu. Switches save straight away.
          </p>
        </div>
        <Button asChild className="min-h-11 w-full gap-2 sm:w-auto">
          <Link href="/admin/menu/new">
            <Plus className="size-4" aria-hidden="true" />
            Add item
          </Link>
        </Button>
      </div>

      {sections.map((section) => (
        <section key={section.id} aria-labelledby={`menu-${section.id}`} className="rounded-xl border bg-card">
          <div className="border-b px-4 py-3 md:px-6">
            <h2 id={`menu-${section.id}`} className="text-base font-semibold">
              {section.name}
            </h2>
          </div>
          {section.items.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground md:px-6">No items in this section yet.</p>
          ) : (
            <ul className="divide-y">
              {section.items.map((item) => (
                <li key={item.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4 md:px-6">
                  <Link
                    href={`/admin/menu/${item.id}`}
                    className="group flex min-w-0 flex-1 items-center gap-3 rounded-lg"
                  >
                    <ProductPhoto src={item.image_url} name={item.name} sizes="64px" className="size-16" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium group-hover:underline group-hover:underline-offset-4">{item.name}</p>
                      <p className="text-sm tabular-nums text-muted-foreground">{priceLabel(item)}</p>
                    </div>
                    <ChevronRight className="size-5 shrink-0 text-muted-foreground sm:hidden" aria-hidden="true" />
                  </Link>
                  <div className="flex items-center gap-5 pl-[76px] sm:pl-0">
                    <ProductFlagSwitch id={item.id} name={item.name} flag="active" initial={item.active} />
                    <ProductFlagSwitch id={item.id} name={item.name} flag="seasonal" initial={item.seasonal} />
                    <Button asChild variant="outline" className="hidden min-h-11 sm:inline-flex">
                      <Link href={`/admin/menu/${item.id}`} aria-label={`Edit ${item.name}`}>
                        Edit
                      </Link>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
