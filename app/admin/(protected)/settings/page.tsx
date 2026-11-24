import { BlockedDatesEditor } from "@/components/admin/BlockedDatesEditor";
import { DeliveryAreasEditor } from "@/components/admin/DeliveryAreasEditor";
import { SettingsForm } from "@/components/admin/SettingsForm";
import { loadSettingsAdmin } from "@/lib/admin/settings-repo";
import { requireStaff } from "@/lib/auth/require-staff";

export default async function AdminSettingsPage() {
  await requireStaff();
  const { settings, areas, blocked } = await loadSettingsAdmin();

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Settings</h1>
      <SettingsForm settings={settings} />
      <DeliveryAreasEditor areas={areas} />
      <BlockedDatesEditor blocked={blocked} />
    </div>
  );
}
