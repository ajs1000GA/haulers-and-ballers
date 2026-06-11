export const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

export const numberFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
})

export function parseNumber(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0
  }

  if (value === null || value === undefined) {
    return 0
  }

  const cleaned = String(value)
    .replace(/\(([^)]+)\)/, '-$1')
    .replace(/[$,%\s,]/g, '')
    .trim()

  const parsed = Number.parseFloat(cleaned)
  return Number.isFinite(parsed) ? parsed : 0
}

export function parsePercent(value) {
  const parsed = parseNumber(value)
  if (typeof value === 'string' && value.includes('%')) {
    return parsed
  }

  if (parsed > 0 && parsed <= 1) {
    return parsed * 100
  }

  return parsed
}

export function formatCurrency(value) {
  return currencyFormatter.format(parseNumber(value))
}

export function formatNumber(value) {
  return numberFormatter.format(parseNumber(value))
}

export function formatPercent(value, digits = 0) {
  const parsed = parsePercent(value)
  return `${parsed.toFixed(digits)}%`
}

export function formatAjs(value) {
  return currencyFormatter.format(parseNumber(value))
}

export function compactCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(parseNumber(value))
}

export function safeDivide(numerator, denominator) {
  const bottom = parseNumber(denominator)
  if (!bottom) {
    return 0
  }

  return parseNumber(numerator) / bottom
}
