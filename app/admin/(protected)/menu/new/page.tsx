import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { ProductForm } from "@/components/admin/ProductForm";
import { loadSections } from "@/lib/admin/products-repo";
import { requireStaff } from "@/lib/auth/require-staff";

/** Add a menu item. After saving, the page moves to the item's edit page for its photo. */
export default async function AdminNewMenuItemPage() {
  await requireStaff();
  const sections = await loadSections();

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div className="space-y-2">
        <Link href="/admin/menu" className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
          <ChevronLeft className="size-4" aria-hidden="true" />
          Menu
        </Link>
        <h1 className="text-xl font-semibold">Add item</h1>
      </div>
      <ProductForm item={null} sections={sections} />
    </div>
  );
}
