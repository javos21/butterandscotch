import "server-only";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createPublicSupabase } from "@/lib/supabase/public";
import type { BankDetails } from "@/lib/types";

/** Everything the customer site may show, from the public_settings view (no notify_email). */
export async function getPublicSettings() {
  const { data, error } = await createPublicSupabase()
    .from("public_settings")
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

/** Bank transfer details. Read with the service role, server only, and never sent to the browser. */
export async function getBankDetails(): Promise<BankDetails> {
  const { data, error } = await createAdminSupabase()
    .from("settings")
    .select("bank_details")
    .eq("id", 1)
    .single();
  if (error) throw new Error(error.message);
  return data.bank_details as unknown as BankDetails;
}
