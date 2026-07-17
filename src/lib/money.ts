export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function toCents(value: number): number {
  if (!Number.isFinite(value)) throw new Error("Money value must be finite")
  return Math.round((value + Number.EPSILON) * 100)
}

export function fromCents(value: number): number {
  return value / 100
}

export function sumMoney(values: number[]): number {
  const cents = values.reduce((sum, value) => sum + Math.round(value * 100), 0)
  return cents / 100
}

export function formatMoney(value: number, currency = "USD", locale = "en-US") {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}
