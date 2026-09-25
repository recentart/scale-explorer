// HTML for visualisation figures: the stage with its tabs and chips, zoomed-in
// levels and the step-by-step zoom ladder. Shared by the build (pre-rendered
// pages) and the browser (compare and custom-size results).

import { esc, renderStage, renderBars, ladderSteps } from './render.js'
import { sizeOf, zoomLevels } from './layout.js'
import { compareSentence, phraseOf } from './compare.js'
import { formatNumber } from './units.js'

const cap = s => s.charAt(0).toUpperCase() + s.slice(1)

export function defaultCaption(ranged) {
  return `Everything is drawn to the same scale, standing on the same ground line. Silhouettes are simplified outlines scaled to the measured dimension.${ranged ? ' A faded outline shows the top of a size range.' : ''}`
}

export function tinyNote(names) {
  if (!names.length) return ''
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
  const verb = names.length === 1 ? 'is' : 'are'
  return `${list} ${verb} too small to see at this scale and ${verb} marked with ▲.`
}

function isRanged(o) {
  const m = o.measures[o.profile.x || o.profile.y]
  return m.min != null && m.max != null && m.min !== m.max
}

// A stage figure: SVG plus the data attributes the browser needs to redraw it.
export function vizFigure(objects, {
  id, highlight, chips = [], caption, maxHeight = 440, compact = false, tabs = true, note = true, system = 'metric', width = 960,
} = {}) {
  const { svg, tinyNames } = renderStage(objects, { width, maxHeight, highlight, idPrefix: `${id}-svg`, compact, system })
  const items = objects.map(o => o.slug).join(',')
  const chipHtml = chips.length ? `<fieldset class="viz-chips"><legend>Show</legend>${chips.map(o =>
    `<label class="chip"><input type="checkbox" value="${esc(o.slug)}" checked> ${esc(o.name)}</label>`).join('')}</fieldset>` : ''
  const tabHtml = tabs ? `<div class="viz-tabs" role="tablist" aria-label="View">
      <button type="button" role="tab" id="${id}-tab-stage" aria-selected="true" aria-controls="${id}-stage">Side by side</button>
      <button type="button" role="tab" id="${id}-tab-bars" aria-selected="false" aria-controls="${id}-bars" tabindex="-1">Bars</button>
    </div>` : ''
  const capText = caption ?? defaultCaption(objects.some(isRanged))
  return `<figure class="viz" id="${id}" data-viz data-items="${esc(items)}"${highlight ? ` data-highlight="${esc(highlight)}"` : ''} data-max-height="${maxHeight}"${compact ? ' data-compact' : ''}>
  ${tabHtml || chipHtml ? `<div class="viz-toolbar">${tabHtml}${chipHtml}</div>` : ''}
  <div class="viz-pane viz-stage" id="${id}-stage"${tabs ? ` role="tabpanel" aria-labelledby="${id}-tab-stage"` : ''}>${svg}</div>
  ${tabs ? `<div class="viz-pane viz-bars" id="${id}-bars" role="tabpanel" aria-labelledby="${id}-tab-bars" hidden>${renderBars(objects, { highlight, system })}</div>` : ''}
  ${note ? `<p class="viz-note" data-viz-note${tinyNames.length ? '' : ' hidden'}>${esc(tinyNote(tinyNames))}</p>` : ''}
  <figcaption class="viz-caption">${esc(capText)}</figcaption>
</figure>`
}

// Extra figures for objects that vanish next to the largest one, each at a
// larger scale than the one before and labelled with its magnification.
export function zoomFigures(objects, idBase, { highlight, system = 'metric', width = 960 } = {}) {
  const levels = zoomLevels(objects, { width, maxHeight: 360 })
  if (levels.length < 2) return ''
  return levels.slice(1).map((lv, i) => `<div class="zoom-level">
  <h3 class="zoom-title">Zoomed in ${esc(formatNumber(lv.zoom, 2))}×: ${esc(lv.objects.map(o => o.name).join(', '))}</h3>
  <p class="zoom-sub">This view uses a different scale from the one above: everything here is drawn about ${esc(formatNumber(lv.zoom, 2))} times larger.</p>
  ${vizFigure(lv.objects, { id: `${idBase}-z${i + 1}`, highlight, maxHeight: 360, tabs: false, system, width })}
</div>`).join('')
}

// Step-by-step zoom from a small object up to a large one.
export function ladderSection(all, from, to, { id = 'zoom', heading, system = 'metric', width = 960 } = {}) {
  const steps = ladderSteps(from, to, all)
  if (steps.length < 2) return ''
  const big = sizeOf(to) >= sizeOf(from) ? to : from
  const small = big === to ? from : to
  return `<section class="ladder" id="${id}" aria-labelledby="${id}-h" data-ladder>
  <h2 id="${id}-h">${esc(heading || `Zoom out from ${phraseOf(small)} to ${phraseOf(big)}`)}</h2>
  <p class="section-lede">${esc(cap(phraseOf(big)))} is too big to show next to ${esc(phraseOf(small))} in one picture, so here it is in ${steps.length} steps. Each step is drawn to its own scale and zooms out from the step before.</p>
  <ol class="ladder-steps">${steps.map(([a, b], i) => `<li class="ladder-step" data-step="${i + 1}">
    <h3 class="ladder-title"><span class="step-num">Step ${i + 1} of ${steps.length}</span> ${esc(a.name)} → ${esc(b.name)}</h3>
    <p class="ladder-sentence">${esc(compareSentence(b, a))}</p>
    ${vizFigure([a, b], { id: `${id}-s${i + 1}`, maxHeight: 300, compact: true, tabs: false, note: false, system, width, caption: `Step ${i + 1}: ${a.name} and ${b.name} at the same scale.` })}
  </li>`).join('')}</ol>
</section>`
}
