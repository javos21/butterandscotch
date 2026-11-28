"use server";

import { buildCommunityRepo, joinCommunity, type JoinCommunityResult } from "@/lib/customers/community";
import { createAdminSupabase } from "@/lib/supabase/admin";

/** Form action for the footer "Join the community" box. Form field: email. */
export async function joinCommunityAction(formData: FormData): Promise<JoinCommunityResult> {
  return joinCommunity(formData.get("email"), {
    repo: buildCommunityRepo(createAdminSupabase()),
    now: () => new Date(),
  });
}
