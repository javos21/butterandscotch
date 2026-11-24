"use server";

import { revalidatePath } from "next/cache";
import {
  deleteProduct,
  saveProduct,
  setProductFlags,
  uploadProductPhoto,
  type ProductFlags,
  type ProductInput,
  type ProductResult,
} from "@/lib/admin/products";
import { productsRepo } from "@/lib/admin/products-repo";
import { requireStaff } from "@/lib/auth/require-staff";
import { photoStorage } from "@/lib/storage/photo-storage";
import { resizePhoto } from "@/lib/storage/resize-photo";

/** Menu changes show on the customer site too, so both trees are refreshed. */
function refreshSite() {
  revalidatePath("/admin", "layout");
  revalidatePath("/", "layout");
}

/** Adds a new menu item or saves an existing one. */
export async function saveProductAction(input: ProductInput): Promise<ProductResult> {
  await requireStaff();
  const result = await saveProduct(input, { repo: productsRepo() });
  refreshSite();
  return result;
}

/** Switches an item on or off the menu, or marks it seasonal. */
export async function setProductFlagsAction(input: { id: string } & ProductFlags): Promise<ProductResult> {
  await requireStaff();
  const result = await setProductFlags(input, { repo: productsRepo() });
  refreshSite();
  return result;
}

/** Uploads a new photo for an item (FormData fields: id, photo). */
export async function uploadProductPhotoAction(formData: FormData): Promise<ProductResult> {
  await requireStaff();
  const id = formData.get("id");
  const photo = formData.get("photo");
  if (typeof id !== "string" || !(photo instanceof File)) {
    return { error: "Choose a photo first.", field: "photo" };
  }
  const result = await uploadProductPhoto(
    { id, file: { name: photo.name, type: photo.type, size: photo.size, bytes: await photo.arrayBuffer() } },
    { repo: productsRepo(), storage: photoStorage(), resize: resizePhoto, now: () => new Date() },
  );
  refreshSite();
  return result;
}

/** Deletes a menu item for good. Used by the Delete item button, after confirmation. */
export async function deleteProductAction(input: { id: string }): Promise<ProductResult> {
  await requireStaff();
  const result = await deleteProduct(input, { repo: productsRepo(), storage: photoStorage() });
  refreshSite();
  return result;
}
