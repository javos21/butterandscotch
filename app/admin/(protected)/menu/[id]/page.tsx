import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ExternalLink } from "lucide-react";
import { ProductForm } from "@/components/admin/ProductForm";
import { ProductPhotoUploader } from "@/components/admin/ProductPhotoUploader";
import { loadProductAdmin } from "@/lib/admin/products-repo";
import { requireStaff } from "@/lib/auth/require-staff";
import { isUuid } from "@/lib/uuid";

/** Edit one menu item: photo, then details. */
export default async function AdminMenuItemPage({ params }: PageProps<"/admin/menu/[id]">) {
  await requireStaff();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const { item, sections } = await loadProductAdmin(id);
  if (!item) notFound();

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div className="space-y-2">
        <Link href="/admin/menu" className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
          <ChevronLeft className="size-4" aria-hidden="true" />
          Menu
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold">{item.name}</h1>
          {item.active ? (
            <Link
              href="/#menu"
              target="_blank"
              className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary hover:underline hover:underline-offset-4"
            >
              View the menu on the shop
              <ExternalLink className="size-4" aria-hidden="true" />
            </Link>
          ) : (
            <span className="text-sm text-muted-foreground">Not on the menu</span>
          )}
        </div>
      </div>
      <ProductPhotoUploader id={item.id} name={item.name} imageUrl={item.image_url} />
      <ProductForm key={item.id} item={item} sections={sections} />
    </div>
  );
}
