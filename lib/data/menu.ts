import { createPublicSupabase } from "@/lib/supabase/public";
import type { Item, Section } from "@/lib/types";

/** Sections in display order, each with its active items. */
export async function getMenu(): Promise<{
  sections: (Section & { items: Item[] })[];
}> {
  const db = createPublicSupabase();
  const [sectionsRes, itemsRes] = await Promise.all([
    db.from("sections").select("*").order("sort"),
    db.from("items").select("*").eq("active", true).order("sort"),
  ]);
  for (const res of [sectionsRes, itemsRes]) {
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
  };
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
