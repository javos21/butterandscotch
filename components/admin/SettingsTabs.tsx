"use client";

import { useState, type ReactNode } from "react";
import { CalendarClock, CreditCard, MessageCircle, Truck, type LucideIcon } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SETTINGS_TABS, type SettingsTab } from "@/lib/admin/settings-tabs";

const TAB_META: Record<SettingsTab, { label: string; icon: LucideIcon }> = {
  ordering: { label: "Ordering", icon: CalendarClock },
  delivery: { label: "Delivery", icon: Truck },
  payment: { label: "Payment", icon: CreditCard },
  contact: { label: "Contact", icon: MessageCircle },
};

/**
 * Settings grouped into four tabs. The active tab is kept in the URL (?tab=) so a reload or a
 * shared link lands on the same tab, without a server round trip on every switch.
 */
export function SettingsTabs({
  initialTab,
  panels,
}: {
  initialTab: SettingsTab;
  panels: Record<SettingsTab, ReactNode>;
}) {
  const [tab, setTab] = useState<SettingsTab>(initialTab);

  function change(value: string) {
    const next = value as SettingsTab;
    setTab(next);
    const url = new URL(window.location.href);
    if (next === "ordering") url.searchParams.delete("tab");
    else url.searchParams.set("tab", next);
    window.history.replaceState(null, "", url);
  }

  return (
    <Tabs value={tab} onValueChange={change} className="gap-6">
      <TabsList className="grid h-auto w-full grid-cols-4 gap-1 p-1">
        {SETTINGS_TABS.map((value) => {
          const { label, icon: Icon } = TAB_META[value];
          return (
            <TabsTrigger
              key={value}
              value={value}
              className="min-h-11 flex-col gap-1 px-1 text-xs data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm sm:flex-row sm:gap-2 sm:text-sm"
            >
              <Icon aria-hidden="true" />
              {label}
            </TabsTrigger>
          );
        })}
      </TabsList>
      {SETTINGS_TABS.map((value) => (
        <TabsContent key={value} value={value} className="space-y-6">
          {panels[value]}
        </TabsContent>
      ))}
    </Tabs>
  );
}
