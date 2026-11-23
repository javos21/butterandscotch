import { describe, expect, test } from "vitest";
import { planReceipt, RECEIPT_MAX_BYTES } from "@/lib/receipt-file";

const MB = 1024 * 1024;

describe("planReceipt", () => {
  test("the receipt limit is 4 MB", () => {
    expect(RECEIPT_MAX_BYTES).toBe(4 * MB);
  });

  test("a small image is sent as it is", () => {
    expect(planReceipt({ type: "image/png", size: 1 * MB })).toEqual({ action: "send" });
  });

  test("a JPEG under 3.5 MB is sent as it is", () => {
    expect(planReceipt({ type: "image/jpeg", size: 3.4 * MB })).toEqual({ action: "send" });
  });

  test.each(["image/jpeg", "image/png", "image/webp"])(
    "a %s over 3.5 MB is compressed before upload",
    (type) => {
      expect(planReceipt({ type, size: 3.6 * MB })).toEqual({ action: "compress" });
    },
  );

  test("a large photo is compressed even when it is over the limit, because the compressed copy may fit", () => {
    expect(planReceipt({ type: "image/jpeg", size: 9 * MB })).toEqual({ action: "compress" });
  });

  test("a HEIC file over 4 MB is too large, since it cannot be compressed here", () => {
    expect(planReceipt({ type: "image/heic", size: 4.5 * MB })).toEqual({ action: "too_large" });
  });

  test("a PDF over 4 MB is too large", () => {
    expect(planReceipt({ type: "application/pdf", size: 4.1 * MB })).toEqual({ action: "too_large" });
  });

  test("a PDF of exactly 4 MB is sent", () => {
    expect(planReceipt({ type: "application/pdf", size: 4 * MB })).toEqual({ action: "send" });
  });

  test("an empty file is refused", () => {
    expect(planReceipt({ type: "image/png", size: 0 })).toEqual({ action: "empty" });
  });
});
