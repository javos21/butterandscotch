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

type Row = Record<string, unknown>;

/** In-memory stand-in for the two customers calls the repo makes: update().eq().eq().select() and upsert(). */
function fakeCustomersDb(seed: Row[] = []) {
  const rows = new Map<string, Row>(seed.map((row) => [row.email as string, { ...row }]));
  const db = {
    rows,
    from(table: string) {
      expect(table).toBe("customers");
      return {
        update(values: Row) {
          const filters: [string, unknown][] = [];
          const chain = {
            eq(column: string, value: unknown) {
              filters.push([column, value]);
              return chain;
            },
            async select() {
              const hit = [...rows.values()].filter((row) => filters.every(([c, v]) => row[c] === v));
              for (const row of hit) Object.assign(row, values);
              return { data: hit.map((row) => ({ email: row.email })), error: null };
            },
          };
          return chain;
        },
        async upsert(payload: Row, options?: { ignoreDuplicates?: boolean }) {
          const email = payload.email as string;
          const existing = rows.get(email);
          if (!existing) rows.set(email, { ...payload });
          else if (!options?.ignoreDuplicates) Object.assign(existing, payload);
          return { error: null };
        },
      };
    },
  };
  return db;
}

describe("buildCommunityRepo", () => {
  test("writes only the community columns, so broadcast_opt_in is never sent", async () => {
    const db = fakeCustomersDb([]);
    const repo = buildCommunityRepo(db as never);

    await repo.setCommunityOptIn({
      email: "anna@x.com",
      optInAt: "2026-11-28T09:30:00.000Z",
      consentText: COMMUNITY_CONSENT_TEXT,
    });

    const saved = db.rows.get("anna@x.com") ?? {};
    expect(saved).toEqual({
      email: "anna@x.com",
      community_opt_in: true,
      community_opt_in_at: "2026-11-28T09:30:00.000Z",
      community_consent_text: COMMUNITY_CONSENT_TEXT,
    });
    expect(saved).not.toHaveProperty("broadcast_opt_in");
    expect(saved).not.toHaveProperty("broadcast_opt_in_at");
  });

  test("a repeat submit keeps the first community opt-in time and text", async () => {
    const db = fakeCustomersDb([]);
    const repo = buildCommunityRepo(db as never);

    await repo.setCommunityOptIn({
      email: "anna@x.com",
      optInAt: "2026-11-28T09:30:00.000Z",
      consentText: "first text",
    });
    await repo.setCommunityOptIn({
      email: "anna@x.com",
      optInAt: "2026-12-01T12:00:00.000Z",
      consentText: "later text",
    });

    expect(db.rows.get("anna@x.com")).toMatchObject({
      community_opt_in: true,
      community_opt_in_at: "2026-11-28T09:30:00.000Z",
      community_consent_text: "first text",
    });
  });

  test("an existing broadcast-only customer is switched on for community, with its own first time", async () => {
    const db = fakeCustomersDb([
      {
        email: "anna@x.com",
        broadcast_opt_in: true,
        broadcast_opt_in_at: "2026-11-01T10:00:00.000Z",
        broadcast_consent_text: "broadcast text",
        community_opt_in: false,
      },
    ]);
    const repo = buildCommunityRepo(db as never);

    await repo.setCommunityOptIn({
      email: "anna@x.com",
      optInAt: "2026-11-28T09:30:00.000Z",
      consentText: "community text",
    });

    expect(db.rows.get("anna@x.com")).toMatchObject({
      broadcast_opt_in: true,
      broadcast_opt_in_at: "2026-11-01T10:00:00.000Z",
      broadcast_consent_text: "broadcast text",
      community_opt_in: true,
      community_opt_in_at: "2026-11-28T09:30:00.000Z",
      community_consent_text: "community text",
    });
  });

  test("a database error is thrown so the action can report it", async () => {
    const repo = buildCommunityRepo({
      from: () => ({
        update: () => ({
          eq() {
            return this;
          },
          select: async () => ({ data: null, error: { message: "boom" } }),
        }),
      }),
    } as never);
    await expect(
      repo.setCommunityOptIn({ email: "a@x.com", optInAt: "x", consentText: COMMUNITY_CONSENT_TEXT }),
    ).rejects.toThrow("boom");
  });
});
