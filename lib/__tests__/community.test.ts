import { describe, expect, test, vi } from "vitest";
import { COMMUNITY_CONSENT_TEXT } from "@/lib/customers/consent-text";
import {
  buildCommunityRepo,
  joinCommunity,
  type CommunityRepo,
  type CommunityRow,
} from "@/lib/customers/community";

const NOW = new Date("2026-11-28T09:30:00.000Z");

function fakeRepo(): CommunityRepo & { rows: CommunityRow[] } {
  const rows: CommunityRow[] = [];
  return {
    rows,
    async setCommunityOptIn(row) {
      rows.push(row);
    },
  };
}

describe("joinCommunity", () => {
  test("an invalid email returns an error and writes nothing", async () => {
    const repo = fakeRepo();
    const result = await joinCommunity("not-an-email", { repo, now: () => NOW });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("Please enter a valid email address");
    expect(repo.rows).toHaveLength(0);
  });

  test("an empty email returns an error", async () => {
    const result = await joinCommunity("   ", { repo: fakeRepo(), now: () => NOW });
    expect(result.ok).toBe(false);
  });

  test("a valid email is saved trimmed and lowercased, with the time and the shown text", async () => {
    const repo = fakeRepo();
    const result = await joinCommunity("  Anna@X.com ", { repo, now: () => NOW });
    expect(result).toEqual({ ok: true });
    expect(repo.rows).toEqual([
      {
        email: "anna@x.com",
        optInAt: "2026-11-28T09:30:00.000Z",
        consentText: COMMUNITY_CONSENT_TEXT,
      },
    ]);
  });

  test("the shown text is the subtext under the footer box", () => {
    expect(COMMUNITY_CONSENT_TEXT).toBe(
      "be the first to know about special offers, flash sales, new items & more",
    );
  });

  test("a repository failure returns a generic error, not the database message", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const repo: CommunityRepo = {
      async setCommunityOptIn() {
        throw new Error("duplicate key value violates constraint customers_pkey");
      },
    };
    const result = await joinCommunity("anna@x.com", { repo, now: () => NOW });
    expect(result).toEqual({ ok: false, error: "Something went wrong. Please try again." });
    spy.mockRestore();
  });
});

describe("buildCommunityRepo", () => {
  test("upserts only the community columns, so broadcast_opt_in is never sent", async () => {
    const upsert = vi.fn<(payload: Record<string, unknown>, options?: unknown) => Promise<{ error: null }>>(
      async () => ({ error: null }),
    );
    const from = vi.fn(() => ({ upsert }));
    const repo = buildCommunityRepo({ from } as never);

    await repo.setCommunityOptIn({
      email: "anna@x.com",
      optInAt: "2026-11-28T09:30:00.000Z",
      consentText: COMMUNITY_CONSENT_TEXT,
    });

    expect(from).toHaveBeenCalledWith("customers");
    expect(upsert).toHaveBeenCalledWith(
      {
        email: "anna@x.com",
        community_opt_in: true,
        community_opt_in_at: "2026-11-28T09:30:00.000Z",
        community_consent_text: COMMUNITY_CONSENT_TEXT,
      },
      { onConflict: "email" },
    );
    const payload = upsert.mock.calls[0][0];
    expect(payload).not.toHaveProperty("broadcast_opt_in");
    expect(payload).not.toHaveProperty("broadcast_opt_in_at");
  });

  test("a database error is thrown so the action can report it", async () => {
    const repo = buildCommunityRepo({
      from: () => ({ upsert: async () => ({ error: { message: "boom" } }) }),
    } as never);
    await expect(
      repo.setCommunityOptIn({ email: "a@x.com", optInAt: "x", consentText: COMMUNITY_CONSENT_TEXT }),
    ).rejects.toThrow("boom");
  });
});
