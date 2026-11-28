/** Settings tabs, in display order. Plain module so both the server page and the client tabs can import it. */
export const SETTINGS_TABS = ["ordering", "pickup", "payment", "contact"] as const;
export type SettingsTab = (typeof SETTINGS_TABS)[number];

/** The tab named in `?tab=`, or "ordering" when it is missing or unknown. */
export function parseSettingsTab(value: string | string[] | undefined): SettingsTab {
  return SETTINGS_TABS.find((tab) => tab === value) ?? "ordering";
}
