// Plain-language comparisons computed from the data ("A blue whale is about
// 16 times as long as a human is tall"). Ranges stay ranges: the ratio runs
// from the smallest plausible value to the largest.

import { measureRange, midOf } from './measures.js'
import { formatNumber, UNITS } from './units.js'
import { sizeOf } from './layout.js'

const ADJ = {
  length: 'long', height: 'tall', diameter: 'wide', width: 'wide', depth: 'deep', span: 'wide', wingspan: 'wide',
}

export function adjOf(obj) {
  if (obj.headlineAdj) return obj.headlineAdj
  const k = obj.headline
  for (const [key, adj] of Object.entries(ADJ)) if (k.toLowerCase().includes(key.toLowerCase())) return adj
  return 'big'
}

export function phraseOf(obj) {
  return obj.phrase || obj.name
}

const cap = s => s.charAt(0).toUpperCase() + s.slice(1)

// a / b by headline measurement, as { lo, hi, mid }.
export function ratioRange(a, b) {
  const ra = measureRange(a.measures[a.headline])
  const rb = measureRange(b.measures[b.headline])
  return { lo: ra.lo / rb.hi, hi: ra.hi / rb.lo, mid: midOf(ra) / midOf(rb) }
}

export function formatTimes(x) {
  if (x >= 1e6) return formatNumber(x, 2)
  if (x >= 100) return formatNumber(x, 2)
  if (x >= 10) return String(Math.round(x))
  return String(Math.round(x * 10) / 10)
}

// "2.3" or "2–2.5" (only when the spread is meaningful).
export function formatRatio(lo, hi) {
  const a = formatTimes(lo), b = formatTimes(hi)
  if (a === b || hi / lo < 1.2) return formatTimes(Math.sqrt(lo * hi))
  return `${a}–${b}`
}

// One sentence comparing a with b, always phrased with a factor of at least 1.
export function compareSentence(a, b) {
  return youGrammar(sentence(a, b))
}

const youGrammar = s => s.replace(/(you|You) is/g, '$1 are')

function sentence(a, b) {
  const r = ratioRange(a, b)
  const adjA = adjOf(a), adjB = adjOf(b)
  // Ranges that overlap: either can be the bigger one, so say so.
  if (r.lo < 0.95 && r.hi > 1.05 && r.hi / r.lo >= 1.3) {
    const span = `between ${formatTimes(r.lo)} and ${formatTimes(r.hi)} times`
    return adjA === adjB
      ? `${cap(phraseOf(a))} is roughly as ${adjA} as ${phraseOf(b)}: ${span} as ${adjA}, depending on size.`
      : `${cap(phraseOf(a))} is roughly as ${adjA} as ${phraseOf(b)} is ${adjB}: ${span}, depending on size.`
  }
  if (r.mid >= 0.87 && r.mid <= 1.15) {
    return adjA === adjB
      ? `${cap(phraseOf(a))} is about as ${adjA} as ${phraseOf(b)}.`
      : `${cap(phraseOf(a))} is about as ${adjA} as ${phraseOf(b)} is ${adjB}.`
  }
  let big = a, small = b, lo = r.lo, hi = r.hi
  if (r.mid < 1) { big = b; small = a; lo = 1 / r.hi; hi = 1 / r.lo }
  const adjBig = adjOf(big), adjSmall = adjOf(small)
  const times = formatRatio(lo, hi)
  return adjBig === adjSmall
    ? `${cap(phraseOf(big))} is about ${times} times as ${adjBig} as ${phraseOf(small)}.`
    : `${cap(phraseOf(big))} is about ${times} times as ${adjBig} as ${phraseOf(small)} is ${adjSmall}.`
}

// Short factor for tables: "16×" or "1/12".
export function factorText(a, b) {
  const r = ratioRange(a, b)
  if (r.lo < 0.95 && r.hi > 1.05 && r.hi / r.lo >= 1.3) return `${formatTimes(r.lo)}–${formatTimes(r.hi)}×`
  if (r.mid >= 1) return `${formatRatio(r.lo, r.hi)}×`
  return `1/${formatRatio(1 / r.hi, 1 / r.lo)}`
}

// References for an object's comparison table: a human plus familiar objects
// spread across scales, a few smaller and a few larger.
export function comparisonSet(obj, all, count = 5) {
  const size = sizeOf(obj)
  const human = all.find(o => o.slug === 'human')
  const pool = all.filter(o => o.familiar && o.slug !== obj.slug && o.slug !== 'human')
    .sort((x, y) => Math.abs(Math.log(sizeOf(x) / size)) - Math.abs(Math.log(sizeOf(y) / size)))
  const out = []
  for (const o of pool) {
    if (out.length >= count) break
    if (out.every(p => Math.abs(Math.log(sizeOf(p) / sizeOf(o))) > Math.log(1.3))) out.push(o)
  }
  const list = obj.slug === 'human' ? out : [human, ...out].filter(Boolean)
  return list.sort((x, y) => sizeOf(x) - sizeOf(y))
}

// The first measurement of a kind ('mass', 'volume'), preferring the key of
// the same name, e.g. "mass" over "maxMass".
export function measureOfKind(obj, kind) {
  const ms = obj.measures
  if (ms[kind] && unitKind(ms[kind]) === kind) return { key: kind, m: ms[kind] }
  for (const [key, m] of Object.entries(ms)) if (unitKind(m) === kind) return { key, m }
  return null
}

function unitKind(m) {
  return UNITS[m.unit]?.kind
}

function rangeRatio(ma, mb) {
  const ra = measureRange(ma), rb = measureRange(mb)
  return { lo: ra.lo / rb.hi, hi: ra.hi / rb.lo, mid: midOf(ra) / midOf(rb) }
}

// "How many fit" rows for two objects: how many of the smaller one match the
// bigger one end to end (main measurement), by weight and by volume. Only
// uses sourced figures; a row is left out when either object lacks the data.
export function howManyFit(a, b) {
  const [big, small] = sizeOf(a) >= sizeOf(b) ? [a, b] : [b, a]
  const rows = []
  const add = (kind, rb, rs, what) => {
    const r = rangeRatio(rb.m, rs.m)
    if (!(r.mid >= 1.2) || !Number.isFinite(r.mid)) return
    rows.push({
      kind, big, small,
      count: formatRatio(Math.max(r.lo, 1), r.hi),
      smallLabel: `${small.name} · ${rs.m.label.toLowerCase()}`,
      bigLabel: `${big.name} · ${rb.m.label.toLowerCase()}`,
      what,
    })
  }
  add('length', { m: big.measures[big.headline] }, { m: small.measures[small.headline] }, 'lined up end to end')
  const mb = measureOfKind(big, 'mass'), msm = measureOfKind(small, 'mass')
  if (mb && msm) add('mass', mb, msm, 'on the scales')
  const vb = measureOfKind(big, 'volume'), vs = measureOfKind(small, 'volume')
  if (vb && vs) add('volume', vb, vs, 'packed inside, by volume')
  return rows
}
