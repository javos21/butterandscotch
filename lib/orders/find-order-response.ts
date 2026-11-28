/**
 * The one response find-my-order gives, whatever the email. It is client-safe (no server imports),
 * so the form shows the same text the action returns.
 */
export const FIND_ORDER_RESPONSE = {
  ok: true,
  message: "If that email has orders, we've sent the links.",
} as const;
