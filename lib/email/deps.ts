import "server-only";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { chooseProvider } from "@/lib/email/choose-provider";
import type { EmailDeps, EmailLogEntry } from "@/lib/email/send";

/**
 * Production wiring. The provider comes from chooseProvider(process.env);
 * misconfiguration fails on send and is logged. Log rows go to email_log.
 */
export function defaultEmailDeps(): EmailDeps {
  return {
    provider: chooseProvider(process.env),
    async log(entry: EmailLogEntry) {
      const { error } = await createAdminSupabase()
        .from("email_log")
        .insert(entry);
      if (error) throw new Error(error.message);
    },
  };
}
