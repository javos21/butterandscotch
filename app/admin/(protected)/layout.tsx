import type { ReactNode } from "react";
import Image from "next/image";
import { LogOut } from "lucide-react";
import { signOut } from "@/app/admin/login/actions";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminTabBar } from "@/components/admin/AdminTabBar";
import { Button } from "@/components/ui/button";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { getAdminCounts } from "@/lib/admin/counts";
import { requireStaff } from "@/lib/auth/require-staff";

export default async function ProtectedAdminLayout({ children }: { children: ReactNode }) {
  const staff = await requireStaff();
  const counts = await getAdminCounts();

  return (
    <SidebarProvider>
      {/* The sidebar is shown from lg (1024 px) up; below that the tab bar takes over. */}
      <div className="hidden lg:block">
        <AdminSidebar staffName={staff.name} proofsToCheck={counts.proofsToCheck} />
      </div>
      {/* min-w-0 keeps wide children (tables) scrolling inside their own boxes. */}
      <SidebarInset className="min-w-0">
        <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center justify-between border-b bg-background px-4 lg:hidden">
          <Image src="/brand/logo-red-wide.png" alt="Butter and Scotch admin" width={471} height={238} className="h-8 w-auto" />
          <form action={signOut}>
            <Button type="submit" variant="ghost" className="min-h-11 gap-2 px-3">
              <LogOut className="size-4" aria-hidden="true" />
              Sign out
            </Button>
          </form>
        </header>
        <main id="main" className="mx-auto w-full max-w-7xl flex-1 p-4 pb-[calc(6rem+env(safe-area-inset-bottom))] md:p-6 md:pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-6">
          {children}
        </main>
      </SidebarInset>
      <AdminTabBar proofsToCheck={counts.proofsToCheck} />
    </SidebarProvider>
  );
}
