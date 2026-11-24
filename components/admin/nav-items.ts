import { ClipboardList, CreditCard, House, type LucideIcon, Settings } from "lucide-react";

export type AdminNavLabel = "Today" | "Orders" | "Payments" | "Settings";

export type AdminNavItem = { href: string; label: AdminNavLabel; icon: LucideIcon };

/** The four staff sections, shared by the phone tab bar and the desktop sidebar. */
export const ADMIN_NAV: AdminNavItem[] = [
  { href: "/admin", label: "Today", icon: House },
  { href: "/admin/orders", label: "Orders", icon: ClipboardList },
  { href: "/admin/payments", label: "Payments", icon: CreditCard },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

/** `/admin` is active only on exactly `/admin`; every other item is active on its prefix. */
export function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}
