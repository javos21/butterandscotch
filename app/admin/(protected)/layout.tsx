import type { ReactNode } from "react";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { requireStaff } from "@/lib/auth/require-staff";

export default async function ProtectedAdminLayout({ children }: { children: ReactNode }) {
  const staff = await requireStaff();

  return (
    <SidebarProvider>
      <AdminSidebar staffName={staff.name} />
      {/* min-w-0 keeps wide children (tables) scrolling inside their own boxes. */}
      <SidebarInset className="min-w-0">
        <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
        </header>
        <main id="main" className="mx-auto w-full max-w-7xl flex-1 p-4 md:p-6">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
