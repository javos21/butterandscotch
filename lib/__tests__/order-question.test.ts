import { describe, expect, test } from "vitest";
import { orderQuestionText } from "@/lib/orders/order-question";
import { waLink } from "@/lib/phone";

describe("orderQuestionText", () => {
  test("names the order number in the prefilled message", () => {
    expect(orderQuestionText("BS-0142")).toBe("Hi, I have a question about order BS-0142.");
  });

  test("the WhatsApp link carries the message URL-encoded", () => {
    const href = waLink("868 123 4567", orderQuestionText("BS-0142"));

    expect(href).toBe(
      "https://wa.me/18681234567?text=Hi%2C%20I%20have%20a%20question%20about%20order%20BS-0142.",
    );
  });
});
