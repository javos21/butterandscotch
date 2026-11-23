import { z } from "zod";
import { normalisePhone } from "@/lib/phone";

export const PHONE_MESSAGE = "Please enter a valid WhatsApp number";

const lineSchema = z.object({
  itemId: z.guid(),
  flavour: z.string().trim().min(1).max(60).nullable(),
  quantity: z.number().int().min(1).max(100),
});

export const checkoutSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z
    .email()
    .transform((value) => value.toLowerCase()),
  phone: z.string().transform((value, ctx) => {
    const normalised = normalisePhone(value);
    if (!normalised) {
      ctx.addIssue({ code: "custom", message: PHONE_MESSAGE });
      return z.NEVER;
    }
    return normalised;
  }),
  fulfilment: z.discriminatedUnion("type", [
    z.object({ type: z.literal("pickup") }),
    z.object({
      type: z.literal("delivery"),
      areaId: z.guid(),
      address: z.string().trim().min(5).max(300),
    }),
  ]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  allergies: z.string().trim().min(1).max(500),
  notes: z.string().trim().max(1000).optional(),
  marketingOptIn: z.boolean().default(false),
  acceptPolicy: z.literal(true),
  idempotencyKey: z.string().min(16).max(64),
  lines: z.array(lineSchema).min(1).max(30),
});

export type CheckoutInput = z.output<typeof checkoutSchema>;

/** The form field a checkout problem belongs to. Used to show the message beside that field. */
export type CheckoutField =
  | "name"
  | "email"
  | "phone"
  | "address"
  | "allergies"
  | "policy"
  | "date"
  | "lines"
  | "fulfilment";

const FIELD_MESSAGES: Record<CheckoutField, string> = {
  name: "Please enter your name.",
  email: "Please enter a valid email address.",
  phone: PHONE_MESSAGE,
  address: "Please enter your delivery address.",
  allergies: "Please tell us about any allergies, or type None.",
  policy: "Please accept the order policy to continue.",
  date: "Please choose a date.",
  lines: "Please check your cart and try again.",
  fulfilment: "Please choose a delivery area.",
};

/**
 * Maps the first schema issue to its field and message. Null when the issue is not about a
 * field the customer can fix (for example a malformed idempotency key).
 */
export function checkoutIssueError(
  issues: readonly { readonly path: readonly PropertyKey[] }[],
): { field: CheckoutField; error: string } | null {
  const [head, second] = issues[0]?.path ?? [];
  let field: CheckoutField | null = null;
  switch (head) {
    case "name":
    case "email":
    case "phone":
    case "allergies":
    case "date":
    case "lines":
      field = head;
      break;
    case "acceptPolicy":
      field = "policy";
      break;
    case "fulfilment":
      field = second === "address" ? "address" : "fulfilment";
      break;
  }
  return field ? { field, error: FIELD_MESSAGES[field] } : null;
}

/** Checkout field problems found in the browser, before the order is sent to the server. */
export function checkoutFieldError(input: unknown): { field: CheckoutField; error: string } | null {
  const parsed = checkoutSchema.safeParse(input);
  return parsed.success ? null : checkoutIssueError(parsed.error.issues);
}
