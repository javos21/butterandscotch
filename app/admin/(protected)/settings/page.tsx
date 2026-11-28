import Link from "next/link";
import { BlockedDatesEditor } from "@/components/admin/BlockedDatesEditor";
import {
  BankSection,
  ContactSection,
  PickupSection,
  PolicySection,
  ShopSection,
} from "@/components/admin/SettingsForm";
import { SettingsTabs } from "@/components/admin/SettingsTabs";
import { loadSettingsAdmin } from "@/lib/admin/settings-repo";
import { parseSettingsTab } from "@/lib/admin/settings-tabs";
import { requireStaff } from "@/lib/auth/require-staff";

export default async function AdminSettingsPage({ searchParams }: PageProps<"/admin/settings">) {
  await requireStaff();
  const [{ settings, blocked }, params] = await Promise.all([loadSettingsAdmin(), searchParams]);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">Each card saves on its own.</p>
      </div>
      <Link
        href="/admin/customers"
        className="flex min-h-11 items-center justify-between rounded-xl border bg-card px-4 py-3 text-sm font-medium hover:bg-muted"
      >
        <span>Customers</span>
        <span className="text-muted-foreground">View and download the broadcast list</span>
      </Link>
      <SettingsTabs
        initialTab={parseSettingsTab(params.tab)}
        panels={{
          ordering: (
            <>
              <ShopSection settings={settings} />
              <BlockedDatesEditor blocked={blocked} />
              <PolicySection settings={settings} />
            </>
          ),
          pickup: <PickupSection settings={settings} />,
          payment: <BankSection settings={settings} />,
          contact: <ContactSection settings={settings} />,
        }}
      />
    </div>
  );
}
