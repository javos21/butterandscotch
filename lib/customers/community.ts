import { z } from "zod";
import { COMMUNITY_CONSENT_TEXT } from "@/lib/customers/consent-text";
import { normaliseEmail } from "@/lib/customers/normalise-email";
import type { SupabaseClient } from "@supabase/supabase-js";

export const COMMUNITY_EMAIL_MESSAGE = "Please enter a valid email address";
const FAILURE_MESSAGE = "Something went wrong. Please try again.";

export type JoinCommunityResult = { ok: true } | { ok: false; error: string };

export type CommunityRow = { email: string; optInAt: string; consentText: string };

/** Writes the footer opt-in. Implementations must touch only the community columns. */
export interface CommunityRepo {
  setCommunityOptIn(row: CommunityRow): Promise<void>;
}

const emailSchema = z
  .string()
  .transform(normaliseEmail)
  .pipe(z.email({ message: COMMUNITY_EMAIL_MESSAGE }));

/**
 * Footer "Join the community" box. Saves the email to the customer with its own opt-in flag and
 * the time and text it was given. broadcast_opt_in is never changed here.
 */
export async function joinCommunity(
  input: unknown,
  deps: { repo: CommunityRepo; now: () => Date },
): Promise<JoinCommunityResult> {
  const parsed = emailSchema.safeParse(typeof input === "string" ? input : "");
  if (!parsed.success) {
    return { ok: false, error: COMMUNITY_EMAIL_MESSAGE };
  }
  try {
    await deps.repo.setCommunityOptIn({
      email: parsed.data,
      optInAt: deps.now().toISOString(),
      consentText: COMMUNITY_CONSENT_TEXT,
    });
    return { ok: true };
  } catch (err) {
    console.error("[community] joinCommunity failed", err);
    return { ok: false, error: FAILURE_MESSAGE };
  }
}

/**
 * Production repo. Only the community columns are ever written, so an existing broadcast_opt_in and
 * its time are left as they are. The same first-time rule as broadcast applies: the time and the
 * text are set only when community_opt_in turns on (false to true). A repeat submit changes nothing.
 */
export function buildCommunityRepo(db: SupabaseClient): CommunityRepo {
  return {
    async setCommunityOptIn(row) {
      // Existing row that is not yet opted in: switch it on, with its first time and text.
      const { data, error: updateError } = await db
        .from("customers")
        .update({
          community_opt_in: true,
          community_opt_in_at: row.optInAt,
          community_consent_text: row.consentText,
        })
        .eq("email", row.email)
        .eq("community_opt_in", false)
        .select("email");
      if (updateError) throw new Error(updateError.message);
      if (data && data.length > 0) return;

      // No row changed: either a new email, or an email that is already opted in. Insert the new
      // one; ignoreDuplicates leaves an existing row exactly as it is.
      const { error } = await db.from("customers").upsert(
        {
          email: row.email,
          community_opt_in: true,
          community_opt_in_at: row.optInAt,
          community_consent_text: row.consentText,
        },
        { onConflict: "email", ignoreDuplicates: true },
      );
      if (error) throw new Error(error.message);
    },
  };
}
