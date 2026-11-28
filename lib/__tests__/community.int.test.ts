import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, test, vi } from "vitest";
import { buildCommunityRepo, joinCommunity } from "@/lib/customers/community";

vi.mock("server-only", () => ({}));

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const stamp = `community-${Date.now()}`;

describe.skipIf(!url || !serviceKey)("footer community opt-in against the database", () => {
  const service = (): SupabaseClient =>
    createClient(url as string, serviceKey as string, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

  afterAll(async () => {
    await service().from("customers").delete().like("email", `${stamp}%`);
  });

  test("a new email is saved with community opt-in and no broadcast opt-in", async () => {
    const email = `${stamp}-new@example.test`;
    const result = await joinCommunity(email, { repo: buildCommunityRepo(service()), now: () => new Date() });
    expect(result).toEqual({ ok: true });

    const { data } = await service().from("customers").select("*").eq("email", email).single();
    expect(data?.community_opt_in).toBe(true);
    expect(data?.community_opt_in_at).not.toBeNull();
    expect(data?.broadcast_opt_in).toBe(false);
    expect(data?.broadcast_opt_in_at).toBeNull();
  });

  test("an existing broadcast opt-in is kept when the footer box is submitted", async () => {
    const email = `${stamp}-broadcast@example.test`;
    const db = service();
    const broadcastAt = "2026-11-01T10:00:00.000Z";
    const { error: insertError } = await db.from("customers").insert({
      email,
      broadcast_opt_in: true,
      broadcast_opt_in_at: broadcastAt,
      broadcast_consent_text: "Opt in to our WhatsApp broadcast for offers",
    });
    expect(insertError).toBeNull();

    const result = await joinCommunity(email, { repo: buildCommunityRepo(db), now: () => new Date() });
    expect(result).toEqual({ ok: true });

    const { data } = await db.from("customers").select("*").eq("email", email).single();
    expect(data?.broadcast_opt_in).toBe(true);
    expect(new Date(data?.broadcast_opt_in_at as string).getTime()).toBe(new Date(broadcastAt).getTime());
    expect(data?.broadcast_consent_text).toBe("Opt in to our WhatsApp broadcast for offers");
    expect(data?.community_opt_in).toBe(true);
  });

  test("an invalid email writes no customer row", async () => {
    const result = await joinCommunity("not-an-email", { repo: buildCommunityRepo(service()), now: () => new Date() });
    expect(result.ok).toBe(false);
    const { data } = await service().from("customers").select("email").like("email", `${stamp}%`);
    expect(data?.some((row) => row.email.includes("not-an-email"))).toBe(false);
  });
});
