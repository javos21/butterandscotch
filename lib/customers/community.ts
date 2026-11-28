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
 * Production repo. Upserts on email and names only the community columns in the payload, so an
 * existing broadcast_opt_in and its time are left as they are.
 */
export function buildCommunityRepo(db: SupabaseClient): CommunityRepo {
  return {
    async setCommunityOptIn(row) {
      const { error } = await db.from("customers").upsert(
        {
          email: row.email,
          community_opt_in: true,
          community_opt_in_at: row.optInAt,
          community_consent_text: row.consentText,
        },
        { onConflict: "email" },
      );
      if (error) throw new Error(error.message);
    },
  };
}
