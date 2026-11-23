import { afterEach, describe, expect, test, vi } from "vitest";
import { randomId } from "@/lib/uuid";

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("randomId", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("returns an RFC4122 v4 UUID", () => {
    expect(randomId()).toMatch(V4);
  });

  test("still returns a v4 UUID when crypto.randomUUID is unavailable", () => {
    const real = globalThis.crypto;
    vi.stubGlobal("crypto", {
      getRandomValues: <T extends ArrayBufferView>(array: T) => real.getRandomValues(array),
      randomUUID: undefined,
    });

    const ids = new Set(Array.from({ length: 20 }, () => randomId()));
    for (const id of ids) expect(id).toMatch(V4);
    expect(ids.size).toBe(20);
  });
});
