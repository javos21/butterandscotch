import "server-only";
import type { SettingsRepo, SettingsUpdate } from "@/lib/admin/settings";
import type { Json } from "@/lib/database.types";
import { createAdminSupabase } from "@/lib/supabase/admin";
import type { Settings } from "@/lib/types";

/**
 * Settings persistence for the admin Settings page. Uses the service role, so callers must run
 * requireStaff() first. Writes touch only the single settings row (id = 1).
 */
export function settingsRepo(): SettingsRepo {
  const db = createAdminSupabase();

  return {
    async getPolicy() {
      const { data, error } = await db
        .from("settings")
        .select("policy_text, policy_version")
        .eq("id", 1)
        .single();
      if (error) throw new Error(error.message);
      return data;
    },

    async getCloseDates() {
      const { data, error } = await db
        .from("settings")
        .select("order_close_date, last_fulfilment_date")
        .eq("id", 1)
        .single();
      if (error) throw new Error(error.message);
      return data;
    },

    async updateSettings(values: SettingsUpdate) {
      const { bank_details, ...rest } = values;
      const { error } = await db
        .from("settings")
        .update({
          ...rest,
          ...(bank_details ? { bank_details: bank_details as unknown as NonNullable<Json> } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq("id", 1);
      if (error) throw new Error(error.message);
    },

    async upsertBlockedDates(rows) {
      const { error } = await db.from("blocked_dates").upsert(rows, { onConflict: "date" });
      if (error) throw new Error(error.message);
    },

    async deleteBlockedDate(date) {
      const { error } = await db.from("blocked_dates").delete().eq("date", date);
      if (error) throw new Error(error.message);
    },
  };
}

/** Everything the Settings page shows: the settings row and blocked dates. */
export async function loadSettingsAdmin(): Promise<{
  settings: Settings;
  blocked: { date: string; note: string | null }[];
}> {
  const db = createAdminSupabase();
  const [settings, blocked] = await Promise.all([
    db.from("settings").select("*").eq("id", 1).single(),
    db.from("blocked_dates").select("*").order("date"),
  ]);
  if (settings.error) throw new Error(settings.error.message);
  if (blocked.error) throw new Error(blocked.error.message);

  return {
    settings: settings.data as unknown as Settings,
    blocked: blocked.data,
  };
}
