/**
 * Which dietary icons a menu item's allergen note earns. A nut icon only for a nut note, and an
 * Egg icon only for an egg-free note: "Contains egg" must not show the Egg Free icon. Any other
 * note gets no icon, and its text is shown as written.
 */
export function allergenIcons(note: string | null): ("nut" | "egg-free")[] {
  if (!note) return [];
  const icons: ("nut" | "egg-free")[] = [];
  if (/nut/i.test(note)) icons.push("nut");
  if (/egg[\s-]*free/i.test(note)) icons.push("egg-free");
  return icons;
}
