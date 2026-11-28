import { describe, expect, test } from "vitest";
import { deliveryFeeSentence } from "@/lib/checkout-copy";

const PLAN_SENTENCE =
  "If you would like to check your exact delivery fee before you place your order, click here.";

describe("deliveryFeeSentence", () => {
  test("with the oDeliver URL still unset, the full sentence is plain text and has no link", () => {
    const sentence = deliveryFeeSentence(null);
    expect(sentence.link).toBeNull();
    expect(sentence.lead + "here" + sentence.trail).toBe(PLAN_SENTENCE);
  });

  test("with a URL set, only the word here is the link", () => {
    const sentence = deliveryFeeSentence("https://example.test/fee");
    expect(sentence.link).toEqual({ text: "here", href: "https://example.test/fee" });
    expect(sentence.lead + "here" + sentence.trail).toBe(PLAN_SENTENCE);
  });
});
