const TRINIDAD_CODE = "1868";

/**
 * Normalises a free-form phone number. Most customers are in Trinidad: 7-digit local numbers
 * and 868 area-code numbers become "+1-868-XXX-XXXX". Other numbers entered with a leading "+"
 * become "+<digits>". Returns null when no usable number is there.
 */
export function normalisePhone(input: string): string | null {
  const hasPlus = input.trim().startsWith("+");
  let digits = input.replace(/\D/g, "");
  if (!hasPlus && digits.startsWith("00")) digits = digits.slice(2);

  if (digits.length === 7) digits = `${TRINIDAD_CODE}${digits}`;
  else if (digits.length === 10 && digits.startsWith("868")) digits = `1${digits}`;

  if (digits.length === 11 && digits.startsWith(TRINIDAD_CODE)) {
    // "1868" + 3 digits + 4 digits: country code, area code, then the local number.
    return `+1-868-${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (hasPlus && digits.length >= 8 && digits.length <= 15) return `+${digits}`;
  return null;
}

/**
 * A wa.me link for a phone number entered in free form, optionally with a prefilled message.
 * Null when the number cannot be normalised.
 */
export function waLink(phone: string, text?: string): string | null {
  const normalised = normalisePhone(phone);
  if (!normalised) return null;

  const digits = normalised.replace(/\D/g, "");
  const query = text ? `?text=${encodeURIComponent(text)}` : "";
  return `https://wa.me/${digits}${query}`;
}
