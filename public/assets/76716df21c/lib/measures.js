// Helpers for the measurements stored on each object. A measure keeps the
// figure exactly as its source states it (value, or min/max) in the source's
// unit; these helpers turn it into base units and readable text.

import { UNITS, toBase, conversionSig, formatNumber, formatRange, formatValue, pickUnit } from './units.js'

// { lo, hi } in base units (metres, kilograms, square metres).
export function measureRange(m) {
  if (m.value != null) {
    const v = toBase(m.value, m.unit)
    return { lo: v, hi: v }
  }
  const lo = m.min != null ? toBase(m.min, m.unit) : null
  const hi = m.max != null ? toBase(m.max, m.unit) : null
  return { lo: lo ?? hi, hi: hi ?? lo }
}

export const midOf = r => (r.lo + r.hi) / 2

export function isRange(m) {
  return m.value == null && m.min != null && m.max != null && m.min !== m.max
}

// Text for a measure in one unit system. When the system matches the source's
// own unit the source's figure is shown exactly as published; otherwise it is
// converted and rounded to the precision the source used.
export function formatMeasure(m, system, { prefix = true } = {}) {
  const kind = UNITS[m.unit].kind
  const r = measureRange(m)
  let text
  if (UNITS[m.unit].system === system && !(kind === 'length' && system === 'imperial' && m.unit === 'in' && r.hi >= 0.3048)) {
    const sym = UNITS[m.unit].symbol
    if (m.value != null) text = `${formatNumber(m.value, 21)} ${sym}`
    else if (isRange(m)) text = `${formatNumber(m.min, 21)}–${formatNumber(m.max, 21)} ${sym}`
    else text = `${formatNumber(m.max ?? m.min, 21)} ${sym}`
  } else {
    const sig = Math.min(...[m.value, m.min, m.max].filter(v => v != null).map(v => conversionSig(v, m.approx)))
    text = formatRange(kind, r.lo, r.hi, system, { sig })
  }
  if (!prefix) return text
  return qualifierPrefix(m) + text
}

export function qualifierPrefix(m) {
  if (m.qualifier === 'up to') return 'up to '
  if (m.qualifier === 'at least') return 'at least '
  if (m.value != null && (m.approx || m.qualifier === 'about')) return '≈ '
  return ''
}

// "24–30 m (79–98 ft)": metric first, imperial in brackets.
export function formatBoth(m) {
  const metric = formatMeasure(m, 'metric')
  const imperial = formatMeasure(m, 'imperial', { prefix: false })
  return `${metric} (${imperial})`
}

export function kindOf(m) {
  return UNITS[m.unit].kind
}

// Formats a bare length in metres, e.g. for axis labels and custom sizes.
export function formatMeters(meters, system, sig = 3) {
  return formatValue('length', meters, system, { sig })
}

export function lengthUnitFor(meters, system) {
  return pickUnit('length', meters, system)
}
