"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ADMIN_NAV, isActive } from "./nav-items";

/** Bottom navigation for screens under 1024 px. The sidebar takes over from lg up. */
export function AdminTabBar({ proofsToCheck }: { proofsToCheck: number }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Admin"
      className="fixed inset-x-0 bottom-0 z-20 border-t bg-background pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="grid grid-cols-4">
        {ADMIN_NAV.map((item) => {
          const active = isActive(pathname, item.href);
          const badge = item.label === "Payments" ? proofsToCheck : 0;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-xs font-medium",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <span className="relative">
                  <item.icon className="size-5" aria-hidden="true" />
                  {badge > 0 ? (
                    <span
                      aria-hidden="true"
                      className="absolute -top-1.5 -right-2.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] leading-none text-primary-foreground tabular-nums"
                    >
                      {badge}
                    </span>
                  ) : null}
                </span>
                <span>{item.label}</span>
                {badge > 0 ? (
                  <span className="sr-only">
                    , {badge} {badge === 1 ? "proof" : "proofs"} to check
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
