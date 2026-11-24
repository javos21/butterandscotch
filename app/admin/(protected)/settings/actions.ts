"use server";

import { revalidatePath } from "next/cache";
import {
  blockDates,
  saveArea,
  unblockDate,
  updateSettings,
  type AreaInput,
  type SettingsPatchInput,
  type SettingsResult,
} from "@/lib/admin/settings";
import { settingsRepo } from "@/lib/admin/settings-repo";
import { requireStaff } from "@/lib/auth/require-staff";

/** Settings reach the customer site too, so both trees are refreshed after a save. */
function refreshSite() {
  revalidatePath("/admin", "layout");
  revalidatePath("/", "layout");
}

/** Saves the fields of one settings section (Shop, Bank details, Pickup and contact, or Order policy). */
export async function updateSettingsAction(input: SettingsPatchInput): Promise<SettingsResult> {
  const staff = await requireStaff();
  const result = await updateSettings(input, {
    repo: settingsRepo(),
    staff: { userId: staff.userId },
    now: () => new Date(),
  });
  refreshSite();
  return result;
}

/** Adds or edits a delivery area. */
export async function saveAreaAction(input: AreaInput): Promise<SettingsResult> {
  await requireStaff();
  const result = await saveArea(input, { repo: settingsRepo() });
  refreshSite();
  return result;
}

/** Blocks one date, or an inclusive range, with an optional note. */
export async function blockDatesAction(input: { from: string; to?: string; note?: string }): Promise<SettingsResult> {
  await requireStaff();
  const result = await blockDates(input, { repo: settingsRepo(), now: () => new Date() });
  refreshSite();
  return result;
}

/** Removes a blocked date. */
export async function unblockDateAction(date: string): Promise<SettingsResult> {
  await requireStaff();
  const result = await unblockDate(date, { repo: settingsRepo() });
  refreshSite();
  return result;
}
