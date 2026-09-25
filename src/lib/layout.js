// Scale maths: how big each object's drawing is in metres, how a group of
// objects is laid out on one shared scale, and which objects to use as
// stepping stones when two sizes are too far apart to see together.
// Pure functions: no DOM, so the build, the browser and the tests share them.

import { SHAPES } from './silhouettes.js'
import { measureRange, midOf } from './measures.js'

// Generic shapes for sizes a visitor types in.
export const BUILTIN_SHAPES = {
  'custom-column': {
    w: 12, h: 100,
    layers: [
      { d: 'M0 100 V2 L6 0 L12 2 V100 Z', fill: '#e0533c' },
      { d: 'M3 100 V6 H9 V100 Z', fill: '#f07f63' },
    ],
  },
  'custom-span': {
    w: 100, h: 4,
    layers: [
      { d: 'M0 4 V0 H0.6 V2.6 H99.4 V0 H100 V4 Z', fill: '#e0533c' },
    ],
  },
}

export function shapeOf(key) {
  return SHAPES[key] || BUILTIN_SHAPES[key]
}

// The drawing box of an object in metres at the low, middle or high end of
// its measured range. The shape is scaled so its reference extent (refX/refY)
// equals the sourced measurement; with both axes sourced each axis is scaled
// on its own, otherwise the silhouette keeps its proportions.
export function drawingBox(obj, end = 'hi') {
  const shape = shapeOf(obj.profile.shape)
  if (!shape) throw new Error(`No shape "${obj.profile.shape}" for ${obj.slug}`)
  const refX = shape.refX ?? shape.w
  const refY = shape.refY ?? shape.h
  const pick = key => {
    const m = obj.measures[key]
    if (!m) throw new Error(`${obj.slug}: profile measure "${key}" missing`)
    const r = measureRange(m)
    return end === 'lo' ? r.lo : end === 'mid' ? midOf(r) : r.hi
  }
  let sx = obj.profile.x ? pick(obj.profile.x) / refX : null
  let sy = obj.profile.y ? pick(obj.profile.y) / refY : null
  if (sx == null) sx = sy
  if (sy == null) sy = sx
  return { sx, sy, w: shape.w * sx, h: shape.h * sy, below: !!shape.below }
}

// One number for "how big is it", used to order objects and pick stepping
// stones: the larger side of its drawing, at the middle of its range.
export function sizeOf(obj) {
  const b = drawingBox(obj, 'mid')
  return Math.max(b.w, b.h)
}

export function hasRange(obj) {
  const lo = drawingBox(obj, 'lo'), hi = drawingBox(obj, 'hi')
  return Math.abs(hi.w - lo.w) > 1e-9 * hi.w || Math.abs(hi.h - lo.h) > 1e-9 * hi.h
}

// Finds s in (lo, hi) with f(s) true and f(s') false just above it.
function searchScale(fits) {
  let lo = 1e-15, hi = 1e15
  if (!fits(lo)) return lo
  for (let i = 0; i < 200 && hi / lo > 1 + 1e-9; i++) {
    const mid = Math.sqrt(lo * hi)
    if (fits(mid)) lo = mid
    else hi = mid
  }
  return lo
}

export const TINY_PX = 1.5

// Lays objects out left to right on one ground line at one shared scale
// (pixels per metre). Objects too small to see at that scale keep a narrow
// slot so a marker can point at them.
export function layoutStage(objects, {
  width = 960,
  maxHeight = 420,
  minHeight = 200,
  padLeft = 52,
  padRight = 14,
  padTop = 56,
  padBottom = 38,
  gap = 16,
  maxGap = 64,
  minSlot = 18,
} = {}) {
  const items = objects.map(obj => ({ obj, lo: drawingBox(obj, 'lo'), hi: drawingBox(obj, 'hi') }))
  const above = Math.max(0, ...items.filter(i => !i.hi.below).map(i => i.hi.h))
  const below = Math.max(0, ...items.filter(i => i.hi.below).map(i => i.hi.h))
  const n = items.length
  const innerW = Math.max(40, width - padLeft - padRight)
  // Crowded lineups on narrow screens shrink the gaps, then the marker slots.
  let baseGap = gap
  let slotMin = minSlot
  if (n > 1 && innerW - baseGap * (n - 1) < n * slotMin) {
    baseGap = Math.max(2, (innerW - n * slotMin) / (n - 1))
    if (innerW - baseGap * (n - 1) < n * slotMin) slotMin = Math.max(1, (innerW - baseGap * (n - 1)) / n)
  }
  const usableW = innerW - baseGap * (n - 1)
  const usableH = Math.max(40, maxHeight - padTop - padBottom)

  const sV = usableH / Math.max(above + below, 1e-12)
  const sH = searchScale(s => items.reduce((sum, i) => sum + Math.max(i.hi.w * s, slotMin), 0) <= usableW)
  const scale = Math.min(sV, sH)

  const slots = items.map(i => Math.max(i.hi.w * scale, slotMin))
  const used = slots.reduce((a, b) => a + b, 0)
  const spare = Math.max(0, innerW - used - baseGap * (n - 1))
  const g = Math.max(baseGap, Math.min(maxGap, baseGap + (n > 1 ? spare / (n + 1) : 0)))
  const totalW = used + g * (n - 1)
  let cursor = padLeft + Math.max(0, (innerW - totalW) / 2)

  const contentH = (above + below) * scale
  const height = Math.max(minHeight, Math.round(padTop + contentH + padBottom))
  const groundY = height - padBottom - below * scale

  const placed = items.map((i, k) => {
    const slot = slots[k]
    const hiW = i.hi.w * scale, hiH = i.hi.h * scale
    const x = cursor + (slot - hiW) / 2
    const out = {
      obj: i.obj,
      x,
      cx: cursor + slot / 2,
      slotX: cursor,
      slotW: slot,
      below: i.hi.below,
      hi: { w: hiW, h: hiH, sx: i.hi.sx * scale, sy: i.hi.sy * scale },
      lo: { w: i.lo.w * scale, h: i.lo.h * scale, sx: i.lo.sx * scale, sy: i.lo.sy * scale },
      tiny: Math.max(hiW, hiH) < TINY_PX,
    }
    cursor += slot + g
    return out
  })

  return { width, height, scale, groundY, above, below, padLeft, padRight, padTop, padBottom, items: placed }
}

// 1, 2 or 5 times a power of ten, at most `v`.
export function niceFloor(v) {
  if (!(v > 0)) return 0
  const p = 10 ** Math.floor(Math.log10(v))
  const f = v / p
  return (f >= 5 ? 5 : f >= 2 ? 2 : 1) * p
}

// 1, 2 or 5 times a power of ten, at least `v`.
export function niceCeil(v) {
  if (!(v > 0)) return 0
  const p = 10 ** Math.floor(Math.log10(v))
  const f = v / p
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p
}

// ---------------------------------------------------------------------------
// Choosing companions

const isBelow = o => drawingBox(o, 'hi').below

// Familiar objects that make an object's size easy to read: preferably a
// couple of things a few times smaller, from different categories.
export function pickReferences(obj, all, max = 2) {
  if (obj.lineup) return obj.lineup.map(slug => all.find(o => o.slug === slug)).filter(Boolean)
  const size = sizeOf(obj)
  const pool = all.filter(o => o.slug !== obj.slug && o.slug !== 'human' && o.familiar && !isBelow(o))
  const smaller = pool
    .filter(o => sizeOf(o) < size * 0.85 && sizeOf(o) > size / 25)
    .sort((a, b) => Math.abs(Math.log(sizeOf(a) / (size / 3))) - Math.abs(Math.log(sizeOf(b) / (size / 3))))
  const chosen = []
  for (const o of smaller) {
    if (chosen.length >= max) break
    const distinct = chosen.every(c => c.category !== o.category || Math.abs(Math.log(sizeOf(c) / sizeOf(o))) > Math.log(1.6))
    if (distinct && chosen.every(c => Math.abs(Math.log(sizeOf(c) / sizeOf(o))) > Math.log(1.25))) chosen.push(o)
  }
  if (chosen.length < max) {
    const larger = pool.filter(o => sizeOf(o) >= size * 0.85 && !chosen.includes(o))
      .sort((a, b) => sizeOf(a) - sizeOf(b))
    for (const o of larger) {
      if (chosen.length >= max) break
      if (chosen.every(c => Math.abs(Math.log(sizeOf(c) / sizeOf(o))) > Math.log(1.25))) chosen.push(o)
    }
  }
  return chosen
}

// A chain of objects from `from` up to `to` where each step is at most
// `maxRatio` times the previous one when the dataset allows it, preferring
// familiar objects. Each consecutive pair is drawn as one "zoom out" step.
export function buildLadder(from, to, all, { maxRatio = 12, minRatio = 1.6, maxSteps = 12 } = {}) {
  let a = from, b = to
  if (sizeOf(a) > sizeOf(b)) [a, b] = [b, a]
  const target = sizeOf(b)
  const pool = all.filter(o => o.slug !== a.slug && o.slug !== b.slug && !isBelow(o))
  const chain = [a]
  let cur = a
  for (let i = 0; i < maxSteps; i++) {
    const s = sizeOf(cur)
    if (target <= s * maxRatio) break
    const window = pool.filter(o => sizeOf(o) >= s * minRatio && sizeOf(o) <= s * maxRatio && sizeOf(o) < target / minRatio)
    let next
    if (window.length) {
      const biggest = Math.max(...window.map(sizeOf))
      const familiar = window.filter(o => o.familiar && sizeOf(o) >= biggest * 0.45)
      const pickFrom = familiar.length ? familiar : window
      next = pickFrom.reduce((x, y) => (sizeOf(y) > sizeOf(x) ? y : x))
    } else {
      const beyond = pool.filter(o => sizeOf(o) > s * maxRatio && sizeOf(o) < target / minRatio)
      if (!beyond.length) break
      next = beyond.reduce((x, y) => (sizeOf(y) < sizeOf(x) ? y : x))
    }
    chain.push(next)
    cur = next
  }
  chain.push(b)
  return chain
}

// Splits a lineup into zoom levels: the first level shows everything at one
// scale; objects too small to see there get their own, zoomed-in level, and so
// on. Each level records how much it is magnified relative to the previous one.
export function zoomLevels(objects, opts = {}, maxLevels = 4) {
  const levels = []
  let remaining = objects
  let prevScale = null
  while (remaining.length && levels.length < maxLevels) {
    const layout = layoutStage(remaining, opts)
    levels.push({ objects: remaining, scale: layout.scale, zoom: prevScale ? layout.scale / prevScale : 1 })
    const tiny = layout.items.filter(i => i.tiny).map(i => i.obj)
    if (!tiny.length || tiny.length === remaining.length) break
    prevScale = layout.scale
    remaining = tiny
  }
  return levels
}

// How many times bigger b is than a (by drawing size).
export function sizeRatio(a, b) {
  return sizeOf(b) / sizeOf(a)
}
