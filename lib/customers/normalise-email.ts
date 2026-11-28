/** The one form an email is stored and matched in: trimmed and lowercased, nothing else. */
export function normaliseEmail(input: string): string {
  return input.trim().toLowerCase();
}
