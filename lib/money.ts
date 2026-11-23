const CURRENCY_PREFIX = "TT$";

const numberFormat = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Cents as "TT$300.00". */
export function formatMoney(cents: number): string {
  return `${CURRENCY_PREFIX}${numberFormat.format(cents / 100)}`;
}

/** Like formatMoney, but drops ".00" from whole amounts ("TT$300"). For prices on product cards. */
export function formatPrice(cents: number): string {
  if (cents % 100 !== 0) return formatMoney(cents);
  return `${CURRENCY_PREFIX}${(cents / 100).toLocaleString("en-US")}`;
}

export function sumCents(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

/** Unit price times quantity, in cents. */
export function lineTotal(unitPriceCents: number, quantity: number): number {
  return unitPriceCents * quantity;
}
