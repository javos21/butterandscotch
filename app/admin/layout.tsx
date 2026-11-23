import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

// Every admin page, including the login page, is kept out of search results.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * Applies the admin theme (docs/design.md) to every admin page, and mounts the toast container
 * and the tooltip provider once. The sidebar's collapsed-state tooltips need the provider.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="admin-theme flex min-h-dvh flex-col bg-background font-sans text-foreground">
      <TooltipProvider>
        {children}
        <Toaster position="bottom-right" />
      </TooltipProvider>
    </div>
  );
}
