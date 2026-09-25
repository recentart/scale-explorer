// Units, conversions and number formatting, shared by the build and the browser.
// Every length converts through metres, every mass through kilograms and every
// area through square metres, using the exact international definitions
// (1 ft = 0.3048 m, 1 mi = 1609.344 m, 1 lb = 0.45359237 kg).

export const UNITS = {
  mm: { kind: 'length', base: 0.001, symbol: 'mm', system: 'metric' },
  cm: { kind: 'length', base: 0.01, symbol: 'cm', system: 'metric' },
  m: { kind: 'length', base: 1, symbol: 'm', system: 'metric' },
  km: { kind: 'length', base: 1000, symbol: 'km', system: 'metric' },
  in: { kind: 'length', base: 0.0254, symbol: 'in', system: 'imperial' },
  ft: { kind: 'length', base: 0.3048, symbol: 'ft', system: 'imperial' },
  yd: { kind: 'length', base: 0.9144, symbol: 'yd', system: 'imperial' },
  mi: { kind: 'length', base: 1609.344, symbol: 'mi', system: 'imperial' },
  kg: { kind: 'mass', base: 1, symbol: 'kg', system: 'metric' },
  t: { kind: 'mass', base: 1000, symbol: 't', system: 'metric' },
  lb: { kind: 'mass', base: 0.45359237, symbol: 'lb', system: 'imperial' },
  shortTon: { kind: 'mass', base: 907.18474, symbol: 'US tons', system: 'imperial' },
  longTon: { kind: 'mass', base: 1016.0469088, symbol: 'long tons', system: 'imperial' },
  m2: { kind: 'area', base: 1, symbol: 'm²', system: 'metric' },
  km2: { kind: 'area', base: 1e6, symbol: 'km²', system: 'metric' },
  ft2: { kind: 'area', base: 0.09290304, symbol: 'sq ft', system: 'imperial' },
  mi2: { kind: 'area', base: 2589988.110336, symbol: 'sq mi', system: 'imperial' },
  acre: { kind: 'area', base: 4046.8564224, symbol: 'acres', system: 'imperial' },
}

export const SYSTEMS = ['metric', 'imperial']

export function toBase(value, unit) {
  const u = UNITS[unit]
  if (!u) throw new Error(`Unknown unit: ${unit}`)
  return value * u.base
}

export function fromBase(value, unit) {
  const u = UNITS[unit]
  if (!u) throw new Error(`Unknown unit: ${unit}`)
  return value / u.base
}

export function convert(value, from, to) {
  if (UNITS[from].kind !== UNITS[to].kind) throw new Error(`Cannot convert ${from} to ${to}`)
  return fromBase(toBase(value, from), to)
}

// The unit a value reads best in. Imperial lengths stay in feet up to 10 miles,
// so mountain heights read in feet (29,032 ft) as people expect.
export function pickUnit(kind, baseValue, system) {
  const v = Math.abs(baseValue)
  const imperial = system === 'imperial'
  if (kind === 'length') {
    if (imperial) return v < 0.3048 ? 'in' : v < 16093.44 ? 'ft' : 'mi'
    return v < 1 ? 'cm' : v < 10000 ? 'm' : 'km'
  }
  if (kind === 'mass') {
    // Astronomical masses read best in scientific notation of the base unit.
    if (imperial) return v < 907.18474 || v >= 1e12 ? 'lb' : 'shortTon'
    return v < 1000 || v >= 1e12 ? 'kg' : 't'
  }
  if (kind === 'area') {
    if (imperial) return v < 2589988.110336 ? 'ft2' : 'mi2'
    return v < 1e6 ? 'm2' : 'km2'
  }
  throw new Error(`Unknown kind: ${kind}`)
}

// Significant figures a number was written with (330 -> 2, 8848.86 -> 6).
export function sigFigsOf(n) {
  if (!Number.isFinite(n) || n === 0) return 1
  return Math.abs(n).toExponential().split('e')[0].replace('.', '').length
}

// Precision to show when converting a sourced figure into another unit: never
// more than the source had, at least 3 digits for exact figures and 2 for
// approximate ones, so conversions neither invent precision nor lose it.
export function conversionSig(n, approx) {
  const s = sigFigsOf(n)
  if (approx && s <= 2) return 2
  return Math.min(6, Math.max(3, s))
}

const SUPERSCRIPT = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' }

// Formats a number to `sig` significant figures with thousands separators.
// Millions and billions are written out; anything from a trillion up (planet
// masses) uses scientific notation.
export function formatNumber(n, sig = 3) {
  if (!Number.isFinite(n)) return '–'
  const abs = Math.abs(n)
  if (abs >= 1e12) {
    const [mant, exp] = n.toExponential(Math.max(0, sig - 1)).split('e')
    const m = String(Number(mant))
    const e = String(Number(exp)).split('').map(c => SUPERSCRIPT[c]).join('')
    return `${m} × 10${e}`
  }
  if (abs >= 1e9) return `${round(n / 1e9, sig)} billion`
  if (abs >= 1e6) return `${round(n / 1e6, sig)} million`
  return round(n, sig)
}

function round(n, sig) {
  return n.toLocaleString('en-US', { maximumSignificantDigits: Math.max(1, Math.min(21, sig)) })
}

// "5 ft 9 in" for short imperial lengths, which is how people say heights.
export function formatFeetInches(meters) {
  const totalIn = meters / 0.0254
  let ft = Math.floor(totalIn / 12)
  let inch = Math.round(totalIn - ft * 12)
  if (inch === 12) { ft += 1; inch = 0 }
  if (ft === 0) return `${inch} in`
  return inch === 0 ? `${ft} ft` : `${ft} ft ${inch} in`
}

// Formats a value (already in base units) in the given unit system. `sig`
// controls precision; `unit` forces a unit instead of picking one.
export function formatValue(kind, baseValue, system, { sig = 3, unit } = {}) {
  const u = unit || pickUnit(kind, baseValue, system)
  if (kind === 'length' && !unit && system === 'imperial' && baseValue < 3.048 && baseValue >= 0.3048) {
    return formatFeetInches(baseValue)
  }
  return `${formatNumber(fromBase(baseValue, u), sig)} ${UNITS[u].symbol}`
}

// Formats a lo..hi range (base units) with one shared unit: "24–30 m".
export function formatRange(kind, lo, hi, system, { sig = 3, unit } = {}) {
  if (lo === hi) return formatValue(kind, lo, system, { sig, unit })
  const u = unit || pickUnit(kind, hi, system)
  if (kind === 'length' && !unit && system === 'imperial' && hi < 3.048 && lo >= 0.3048) {
    return `${formatFeetInches(lo)} – ${formatFeetInches(hi)}`
  }
  const a = formatNumber(fromBase(lo, u), sig)
  const b = formatNumber(fromBase(hi, u), sig)
  return `${a}–${b} ${UNITS[u].symbol}`
}

// ---------------------------------------------------------------------------
// Parsing a length typed by a visitor ("150 m", "492 feet", "1.5 km", "5'10\"")

export const INPUT_UNITS = ['m', 'ft', 'km', 'mi']
export const INPUT_MIN_M = 0.01
export const INPUT_MAX_M = 1e9

const UNIT_WORDS = {
  m: 'm', meter: 'm', meters: 'm', metre: 'm', metres: 'm', mtr: 'm', mtrs: 'm',
  ft: 'ft', foot: 'ft', feet: 'ft', "'": 'ft', '’': 'ft', '′': 'ft',
  km: 'km', kms: 'km', kilometer: 'km', kilometers: 'km', kilometre: 'km', kilometres: 'km',
  mi: 'mi', mile: 'mi', miles: 'mi',
}

// Accepts 1500, 1,500, 1500.5, 1,500.5, 1.5e3 and a European decimal comma (1,5).
export function parseNumber(text) {
  let s = String(text).trim().replace(/\s+/g, '')
  if (/^[+]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '')
  else if (/^[+-]?\d+,\d+$/.test(s)) s = s.replace(',', '.')
  if (!/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(s)) return NaN
  return Number(s)
}

function validated(meters, value, unit) {
  if (!Number.isFinite(meters)) return { ok: false, error: 'Enter a number, like 150 or 150 m.' }
  if (meters <= 0) return { ok: false, error: 'Enter a size greater than zero.' }
  if (meters < INPUT_MIN_M) return { ok: false, error: 'That is smaller than 1 cm. Try a larger size.' }
  if (meters > INPUT_MAX_M) return { ok: false, error: 'That is larger than 1,000,000 km. Try a size up to 1 million km.' }
  return { ok: true, meters, value, unit }
}

export function parseLength(text, fallbackUnit = 'm') {
  const raw = String(text ?? '').trim().toLowerCase()
  if (!raw) return { ok: false, error: 'Enter a size, like 150 or 150 m.' }

  // Feet and inches: 5'10", 5 ft 10 in, 5 feet 10 inches
  const fi = raw.match(/^(\d+(?:\.\d+)?)\s*(?:'|’|′|ft|foot|feet)\s*(\d+(?:\.\d+)?)\s*(?:"|”|″|in|inch|inches)?$/)
  if (fi) {
    const ft = Number(fi[1]), inch = Number(fi[2])
    if (inch >= 12) return { ok: false, error: 'Inches should be less than 12, for example 5 ft 10 in.' }
    return validated((ft * 12 + inch) * 0.0254, ft + inch / 12, 'ft')
  }

  const m = raw.match(/^([+-]?[\d.,]*\d[\d.,]*(?:e[+-]?\d+)?)\s*([a-z'’′]+)?\.?$/)
  if (!m) {
    if (/^[+-]?[\d.,]/.test(raw)) {
      const word = raw.replace(/^[+-]?[\d.,\s]+/, '').trim()
      if (word) return { ok: false, error: `“${word}” is not a supported unit. Use m, ft, km or mi.` }
    }
    return { ok: false, error: 'Enter a number, like 150 or 150 m.' }
  }
  const value = parseNumber(m[1])
  if (Number.isNaN(value)) return { ok: false, error: 'Enter a number, like 150 or 150 m.' }
  let unit = fallbackUnit
  if (m[2]) {
    unit = UNIT_WORDS[m[2]]
    if (!unit) return { ok: false, error: `“${m[2]}” is not a supported unit. Use m, ft, km or mi.` }
  }
  if (!INPUT_UNITS.includes(unit)) return { ok: false, error: 'Choose meters, feet, kilometers or miles.' }
  return validated(toBase(value, unit), value, unit)
}
