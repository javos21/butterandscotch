import { createPublicSupabase } from "@/lib/supabase/public";
import type { DeliveryArea, Item, Section } from "@/lib/types";

/** Sections in display order, each with its active items, and the active delivery areas. */
export async function getMenu(): Promise<{
  sections: (Section & { items: Item[] })[];
  areas: DeliveryArea[];
}> {
  const db = createPublicSupabase();
  const [sectionsRes, itemsRes, areasRes] = await Promise.all([
    db.from("sections").select("*").order("sort"),
    db.from("items").select("*").eq("active", true).order("sort"),
    db.from("delivery_areas").select("*").eq("active", true).order("sort"),
  ]);
  for (const res of [sectionsRes, itemsRes, areasRes]) {
    if (res.error) throw new Error(res.error.message);
  }

  const itemsBySection = new Map<string, Item[]>();
  for (const item of itemsRes.data ?? []) {
    const list = itemsBySection.get(item.section_id) ?? [];
    list.push(item);
    itemsBySection.set(item.section_id, list);
  }

  return {
    sections: (sectionsRes.data ?? []).map((section) => ({
      ...section,
      items: itemsBySection.get(section.id) ?? [],
    })),
    areas: areasRes.data ?? [],
  };
}

/** One active item with its section name, or null when the id is unknown or the item is switched off. */
export async function getItem(id: string): Promise<{ item: Item; sectionName: string } | null> {
  const db = createPublicSupabase();
  const { data: item, error } = await db.from("items").select("*").eq("id", id).eq("active", true).maybeSingle();
  if (error) throw new Error(error.message);
  if (!item) return null;
  const { data: section, error: sectionError } = await db
    .from("sections")
    .select("name")
    .eq("id", item.section_id)
    .maybeSingle();
  if (sectionError) throw new Error(sectionError.message);
  return { item, sectionName: section?.name ?? "Menu" };
}

/** Dates in [from, to] the customer cannot pick: blocked dates and dates at the daily cap. */
export async function getUnavailableDates(from: string, to: string): Promise<string[]> {
  const { data, error } = await createPublicSupabase().rpc("public_unavailable_dates", {
    from_date: from,
    to_date: to,
  });
  if (error) throw new Error(error.message);
  return data ?? [];
}
