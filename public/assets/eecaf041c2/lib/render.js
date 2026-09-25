// Turns a stage layout into an SVG string, and draws the bar and ladder views.
// Returns strings so the build can pre-render pages and the browser can
// re-render at the real container width with the same code.

import { shapeOf, layoutStage, niceFloor, niceCeil, sizeOf, buildLadder, hasRange } from './layout.js'
import { formatMeasure, measureRange } from './measures.js'
import { measureOfKind } from './compare.js'
import { UNITS, fromBase, toBase, pickUnit, formatNumber } from './units.js'

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

const n1 = v => Math.round(v * 10) / 10
const n3 = v => Math.round(v * 1000) / 1000

// Short label for the headline measure: "24–30 m", "up to 150 t".
export function headlineText(obj, system) {
  const m = obj.measures[obj.headline]
  return formatMeasure(m, system)
}

export function headlineLabel(obj) {
  return (obj.measures[obj.headline].label || obj.headline).toLowerCase()
}

function shapeLayers(shape) {
  return shape.layers
    .map(l => `<path d="${l.d}" fill="${l.fill}"${l.opacity != null ? ` fill-opacity="${l.opacity}"` : ''}${l.rule ? ` fill-rule="${l.rule}"` : ''}/>`)
    .join('')
}

function drawShape(it, box, groundY, cls) {
  const shape = shapeOf(it.obj.profile.shape)
  const w = shape.w * box.sx, h = shape.h * box.sy
  const x = it.cx - w / 2
  const y = it.below ? groundY : groundY - h
  const layers = it.obj.fill ? { ...shape, layers: shape.layers.map((l, i) => (i === 0 ? { ...l, fill: it.obj.fill } : l)) } : shape
  return `<g class="${cls}" transform="translate(${n3(x)} ${n3(y)}) scale(${box.sx} ${box.sy})">${shapeLayers(layers)}</g>`
}

// Rough text widths for label placement (system-ui at 13px bold / 12px).
const textW = (s, px) => s.length * px

function placeLabels(layout, labels) {
  const placed = []
  const W = layout.width
  const order = labels.slice().sort((a, b) => a.anchorY - b.anchorY)
  for (const l of order) {
    const w = Math.max(textW(l.name, 7.4), textW(l.dim, 6.5)) + 10
    const h = l.dim ? 32 : 17
    // Keep clear of the axis labels on the left.
    const minX = Math.min(layout.padLeft - 4, W - w - 2)
    let x = Math.min(Math.max(minX, l.anchorX - w / 2), W - w - 2)
    let y = l.anchorY - 6 - h
    const hits = r => placed.some(p => r.x < p.x + p.w + 4 && r.x + r.w + 4 > p.x && r.y < p.y + p.h + 2 && r.y + r.h + 2 > p.y)
    let guard = 0
    while (hits({ x, y, w, h }) && guard++ < 60) y -= 8
    if (y < 2) {
      // Out of room above: try sliding sideways at the top instead.
      y = Math.max(2, l.anchorY - 6 - h)
      let dx = 0
      guard = 0
      while (hits({ x: x + dx, y, w, h }) && guard++ < 80) dx = dx <= 0 ? -dx + 12 : -dx
      x = Math.min(Math.max(minX, x + dx), W - w - 2)
    }
    const r = { ...l, x, y, w, h }
    placed.push(r)
  }
  return placed
}

// Axis tick labels and grid lines in the viewer's unit system.
function gridLines(layout, system) {
  const { scale, groundY, above, below, padLeft, width } = layout
  const out = []
  const span = Math.max(above, below)
  if (!(span > 0)) return ''
  const unit = pickUnit('length', span, system)
  const spanU = fromBase(span, unit)
  const step = niceCeil(spanU / 4)
  const sym = UNITS[unit].symbol
  const line = (y, label) => {
    out.push(`<line class="grid-line" x1="${padLeft}" x2="${width - layout.padRight}" y1="${n1(y)}" y2="${n1(y)}"/>`)
    out.push(`<text class="grid-label" x="${padLeft - 6}" y="${n1(y + 4)}" text-anchor="end">${esc(label)}</text>`)
  }
  for (let v = step; v <= fromBase(above, unit) + 1e-9; v += step) {
    line(groundY - toBase(v, unit) * scale, `${formatNumber(v, 6)} ${sym}`)
  }
  for (let v = step; v <= fromBase(below, unit) + 1e-9; v += step) {
    line(groundY + toBase(v, unit) * scale, `−${formatNumber(v, 6)} ${sym}`)
  }
  return out.join('')
}

function scaleBar(layout, system) {
  const { scale, height, padLeft } = layout
  const targetM = 110 / scale
  const unit = pickUnit('length', targetM, system)
  const v = niceFloor(fromBase(targetM, unit))
  const px = toBase(v, unit) * scale
  const y = height - 12
  const x0 = padLeft
  return `<g class="scale-bar" aria-hidden="true">` +
    `<path d="M${x0} ${y - 5} V${y} H${n1(x0 + px)} V${y - 5}"/>` +
    `<text x="${n1(x0 + px + 6)}" y="${y + 1}">${esc(formatNumber(v, 6))} ${esc(UNITS[unit].symbol)}</text></g>`
}

// Full comparison stage. `objects` are drawn in the given order.
export function renderStage(objects, {
  width = 960, maxHeight = 420, minHeight = 200, system = 'metric', highlight, idPrefix = 'st', compact = false,
} = {}) {
  const narrow = width < 520 && objects.length > 2
  const layout = layoutStage(objects, {
    width, maxHeight, minHeight,
    padLeft: compact ? 44 : narrow ? 40 : 56, padTop: compact ? 48 : 58, padBottom: compact ? 30 : 38,
  })
  const { groundY, height } = layout
  const parts = []
  const labels = []
  const tinyNames = []

  for (const it of layout.items) {
    const o = it.obj
    const dim = headlineText(o, system)
    const isHi = o.slug === highlight
    if (it.tiny) {
      tinyNames.push(o.name)
      const mx = n1(it.cx)
      parts.push(`<g class="marker${isHi ? ' is-highlight' : ''}"><title>${esc(o.name)}: ${esc(dim)} (too small to see at this scale)</title>` +
        `<line x1="${mx}" x2="${mx}" y1="${groundY - 16}" y2="${groundY - 3}"/><path d="M${mx - 4} ${groundY - 9} L${mx} ${groundY - 2} L${mx + 4} ${groundY - 9} Z"/></g>`)
      labels.push({ name: o.name, dim: narrow && !isHi ? '' : `${dim} · too small to see`, anchorX: it.cx, anchorY: groundY - 18, hi: isHi })
      continue
    }
    const ranged = hasRange(o)
    parts.push(`<g class="obj${isHi ? ' is-highlight' : ''}" data-slug="${esc(o.slug)}"><title>${esc(o.name)}: ${esc(dim)}</title>`)
    if (ranged) parts.push(drawShape(it, it.hi, groundY, 'sil ghost'))
    parts.push(drawShape(it, ranged ? it.lo : it.hi, groundY, 'sil'))
    parts.push('</g>')
    const top = it.below ? groundY : groundY - it.hi.h
    // On phones only the highlighted object keeps its value in the label;
    // every value is still in the Bars view and the shape's tooltip.
    labels.push({ name: o.name, dim: narrow && !isHi ? '' : dim, anchorX: it.cx, anchorY: top, hi: isHi })
  }

  const placed = placeLabels(layout, labels)
  const labelSvg = placed.map(l => {
    const cx = l.x + l.w / 2
    const lead = l.anchorY - (l.y + l.h) > 10
      ? `<line class="leader" x1="${n1(Math.min(Math.max(l.anchorX, l.x + 4), l.x + l.w - 4))}" y1="${n1(l.y + l.h)}" x2="${n1(l.anchorX)}" y2="${n1(l.anchorY - 2)}"/>`
      : ''
    return `${lead}<g class="label${l.hi ? ' is-highlight' : ''}"><text x="${n1(cx)}" y="${n1(l.y + 13)}" text-anchor="middle"><tspan class="label-name">${esc(l.name)}</tspan>${l.dim ? `<tspan class="label-dim" x="${n1(cx)}" dy="15">${esc(l.dim)}</tspan>` : ''}</text></g>`
  }).join('')

  const summary = describeStage(layout, system)
  const svg = `<svg class="stage-svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-labelledby="${idPrefix}-t ${idPrefix}-d">` +
    `<title id="${idPrefix}-t">${esc(summary.title)}</title><desc id="${idPrefix}-d">${esc(summary.desc)}</desc>` +
    `<g class="grid" aria-hidden="true">${compact ? '' : gridLines(layout, system)}</g>` +
    `<line class="ground" x1="0" x2="${width}" y1="${n1(groundY)}" y2="${n1(groundY)}"/>` +
    parts.join('') + labelSvg + scaleBar(layout, system) + `</svg>`
  return { svg, layout, tinyNames }
}

export function describeStage(layout, system) {
  const items = layout.items
  const names = items.map(i => i.obj.name)
  const title = `${names.join(', ')} drawn to the same scale`
  const desc = items.map(i => `${i.obj.name}: ${headlineLabel(i.obj)} ${headlineText(i.obj, system)}${i.tiny ? ' (too small to see at this scale)' : ''}`).join('. ') + '.'
  return { title, desc }
}

// Horizontal bars of each object's headline measurement on one linear scale.
const colorOf = o => o.fill || shapeOf(o.profile.shape).layers[0].fill
const linkName = o => (o.slug === 'custom' || o.slug === 'you' ? esc(o.name) : `<a href="/objects/${esc(o.slug)}">${esc(o.name)}</a>`)
const KIND_WORD = { mass: 'weight', volume: 'volume' }

// Horizontal bars on one linear scale: the main measurement by default, or
// the weight (kind 'mass') or volume of each object that has a sourced figure.
export function renderBars(objects, { system = 'metric', highlight, kind } = {}) {
  const pick = o => {
    if (!kind) return { label: headlineLabel(o), m: o.measures[o.headline] }
    const hit = measureOfKind(o, kind)
    return hit && { label: hit.m.label.toLowerCase(), m: hit.m }
  }
  const rows = objects.map(o => ({ o, p: pick(o) })).filter(x => x.p).map(x => ({ ...x, r: measureRange(x.p.m) }))
  const missing = objects.filter(o => !pick(o) && o.slug !== 'custom')
  if (rows.length < 1) return `<p class="viz-empty">None of these objects has a sourced ${KIND_WORD[kind] || 'figure'}.</p>`
  const max = Math.max(...rows.map(x => x.r.hi))
  return `<ol class="bars">` + rows.map(({ o, p, r }) => {
    const lo = (r.lo / max) * 1000, hi = (r.hi / max) * 1000
    const vis = Math.max(lo, 3)
    const tiny = hi < 3
    return `<li class="bar-row${o.slug === highlight ? ' is-highlight' : ''}">` +
      `<span class="bar-name">${linkName(o)}</span>` +
      `<span class="bar-dim">${esc(p.label)}</span>` +
      `<span class="bar-track"><svg viewBox="0 0 1000 16" preserveAspectRatio="none" aria-hidden="true" focusable="false">` +
      (hi > lo + 0.5 ? `<rect class="bar-range" x="0" y="2" width="${n1(Math.max(hi, 3))}" height="12" fill="${colorOf(o)}"/>` : '') +
      `<rect class="bar-fill" x="0" y="2" width="${n1(vis)}" height="12" fill="${colorOf(o)}"/></svg></span>` +
      `<span class="bar-value">${esc(formatMeasure(p.m, system))}${tiny ? ' <span class="bar-note">(too small to show at this scale)</span>' : ''}</span></li>`
  }).join('') + `</ol>` +
    (missing.length ? `<p class="viz-missing">No sourced ${KIND_WORD[kind] || 'figure'} for ${esc(missing.map(o => o.name).join(', '))}.</p>` : '')
}

// Volumes drawn as cubes: each square is the side of a cube with the same
// volume, all at one scale, so the drawing stays honest about 3D size.
export function volumeCubes(objects) {
  return objects.map(o => {
    const hit = measureOfKind(o, 'volume')
    if (!hit) return null
    const r = measureRange(hit.m)
    const side = r.lo === r.hi ? { value: Math.cbrt(r.lo), unit: 'm' } : { min: Math.cbrt(r.lo), max: Math.cbrt(r.hi), unit: 'm' }
    return {
      slug: o.slug, name: o.name, phrase: o.phrase, category: o.category, familiar: false, fill: colorOf(o),
      headline: 'volume', profile: { shape: 'volume-cube', x: 'side' },
      measures: { volume: hit.m, side: { label: 'Cube side', ...side, approx: hit.m.approx, qualifier: 'exact' } },
    }
  }).filter(Boolean)
}

// Step-by-step zoom from a small object to a large one.
export function ladderSteps(from, to, all) {
  const chain = buildLadder(from, to, all)
  const steps = []
  for (let i = 0; i < chain.length - 1; i++) steps.push([chain[i], chain[i + 1]])
  return steps
}

export function ratioWords(a, b) {
  const r = sizeOf(b) / sizeOf(a)
  return r >= 100 ? formatNumber(r, 2) : r >= 10 ? String(Math.round(r)) : String(Math.round(r * 10) / 10)
}
