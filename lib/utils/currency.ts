export type CurrencyCode = "USD" | "SOS" | "ETB";
export const supportedCurrencies: CurrencyCode[] = ["USD", "SOS", "ETB"];

/** Converts an amount where each rate is the value of one unit in the same base currency. */
export function convertCurrency(amount: number, fromRate: number, toRate: number): number {
  if (![amount, fromRate, toRate].every(Number.isFinite) || fromRate <= 0 || toRate <= 0) throw new RangeError("Currency amount and rates must be finite, with positive rates");
  return Math.round((amount / fromRate * toRate + Number.EPSILON) * 100) / 100;
}

/** Formats an amount using the requested supported currency code. */
export function formatCurrency(amount: number, currency: CurrencyCode, locale = "en-US"): string {
  if (!Number.isFinite(amount)) throw new RangeError("Currency amount must be finite");
  return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
}
