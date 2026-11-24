import "server-only";
import type { ProductRepo } from "@/lib/admin/products";
import { createAdminSupabase } from "@/lib/supabase/admin";
import type { Item, Section } from "@/lib/types";

/**
 * Menu item persistence for the admin Menu pages. Uses the service role, so callers must run
 * requireStaff() first.
 */
export function productsRepo(): ProductRepo {
  const db = createAdminSupabase();

  return {
    async sectionExists(sectionId) {
      const { data, error } = await db.from("sections").select("id").eq("id", sectionId).maybeSingle();
      if (error) throw new Error(error.message);
      return data !== null;
    },

    async nextSort(sectionId) {
      const { data, error } = await db
        .from("items")
        .select("sort")
        .eq("section_id", sectionId)
        .order("sort", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data?.sort ?? 0) + 1;
    },

    async insert(values) {
      const { data, error } = await db.from("items").insert(values).select("id").single();
      if (error) throw new Error(error.message);
      return data.id;
    },

    async update(id, values) {
      const { data, error } = await db.from("items").update(values).eq("id", id).select("id");
      if (error) throw new Error(error.message);
      return (data ?? []).length === 1;
    },

    async delete(id) {
      const { data, error } = await db.from("items").delete().eq("id", id).select("id");
      if (error) throw new Error(error.message);
      return (data ?? []).length === 1;
    },

    async setFlags(id, flags) {
      const { data, error } = await db.from("items").update(flags).eq("id", id).select("id");
      if (error) throw new Error(error.message);
      return (data ?? []).length === 1;
    },

    async getImage(id) {
      const { data, error } = await db.from("items").select("image_url").eq("id", id).maybeSingle();
      if (error) throw new Error(error.message);
      return data ? { imageUrl: data.image_url } : null;
    },

    async setImage(id, imageUrl) {
      const { error } = await db.from("items").update({ image_url: imageUrl }).eq("id", id);
      if (error) throw new Error(error.message);
    },
  };
}

export type MenuAdminSection = Section & { items: Item[] };

/** Every section with all its items, switched on or off, in menu order. */
export async function loadMenuAdmin(): Promise<MenuAdminSection[]> {
  const db = createAdminSupabase();
  const [sections, items] = await Promise.all([
    db.from("sections").select("*").order("sort"),
    db.from("items").select("*").order("sort"),
  ]);
  if (sections.error) throw new Error(sections.error.message);
  if (items.error) throw new Error(items.error.message);
  return (sections.data ?? []).map((section) => ({
    ...section,
    items: (items.data ?? []).filter((item) => item.section_id === section.id),
  }));
}

/** One item for the edit page, with the section list for its dropdown. Null item when the id is unknown. */
export async function loadProductAdmin(id: string): Promise<{ item: Item | null; sections: Section[] }> {
  const db = createAdminSupabase();
  const [item, sections] = await Promise.all([
    db.from("items").select("*").eq("id", id).maybeSingle(),
    db.from("sections").select("*").order("sort"),
  ]);
  if (item.error) throw new Error(item.error.message);
  if (sections.error) throw new Error(sections.error.message);
  return { item: item.data, sections: sections.data ?? [] };
}

export async function loadSections(): Promise<Section[]> {
  const { data, error } = await createAdminSupabase().from("sections").select("*").order("sort");
  if (error) throw new Error(error.message);
  return data ?? [];
}
