// Browser entry point. Pages arrive fully rendered; this script redraws the
// drawings at the real screen width, applies the metre/foot preference and
// wires up search, comparison and custom sizes. Everything runs locally.

import { OBJECTS, CATEGORIES } from '../data.js'
import { buildIndex, search } from '../lib/search.js'
import { renderStage, renderBars, esc, headlineText, headlineLabel } from '../lib/render.js'
import { vizFigure, zoomFigures, ladderSection, tinyNote, massPane, volumePane, howManyHtml } from '../lib/figure.js'
import { sizeOf, shapeOf } from '../lib/layout.js'
import { compareSentence, comparisonSet, phraseOf, howManyFit } from '../lib/compare.js'
import { parseLength, formatNumber, fromBase, INPUT_UNITS, UNITS } from '../lib/units.js'
import { formatMeasure, measureRange, midOf } from '../lib/measures.js'

const BY = new Map(OBJECTS.map(o => [o.slug, o]))
const INDEX = buildIndex(OBJECTS, CATEGORIES)
const CAT = Object.fromEntries(CATEGORIES.map(c => [c.slug, c]))
const STORE_KEY = 'scale-explorer:units'
const cap = s => s.charAt(0).toUpperCase() + s.slice(1)

// ---------------------------------------------------------------------------
// Unit preference

function readStored() {
  try { return localStorage.getItem(STORE_KEY) } catch { return null }
}
function defaultSystem() {
  const lang = (navigator.languages && navigator.languages[0]) || navigator.language || ''
  return /^en-(US|LR|MM)$/i.test(lang) ? 'imperial' : 'metric'
}
let system = ['metric', 'imperial'].includes(readStored()) ? readStored() : defaultSystem()

function syncUnitButtons() {
  document.querySelectorAll('.units button[data-system]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.system === system)))
}
function setSystem(s) {
  if (s === system) return
  system = s
  try { localStorage.setItem(STORE_KEY, s) } catch { /* private mode: keep it for this page only */ }
  syncUnitButtons()
  redrawAll()
  document.dispatchEvent(new CustomEvent('units-change'))
}

// ---------------------------------------------------------------------------
// Redrawing on resize and unit changes

const redraws = new Set()
function redrawAll() { for (const r of redraws) r(true) }

const resizeObs = typeof ResizeObserver === 'function'
  ? new ResizeObserver(entries => { for (const e of entries) e.target._redraw?.() })
  : null

// Registers a draw(width) function for an element; redraws when its width
// changes, when units change, and when it becomes visible again.
function watch(el, draw) {
  let lastW = -1, lastSys = null, frame = 0
  const run = force => {
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(() => {
      const w = Math.round(el.clientWidth)
      if (!w) return
      if (!force && w === lastW && system === lastSys) return
      lastW = w
      lastSys = system
      draw(w)
    })
  }
  el._redraw = () => run(false)
  el._forceRedraw = () => run(true)
  redraws.add(run)
  resizeObs?.observe(el)
  run(true)
  return run
}

// Custom sizes typed on the measure page are drawn like any other object.
const extraObjects = new Map()
const objectFor = slug => BY.get(slug) || extraObjects.get(slug)

function stageHeight(w, max) {
  if (w < 640) return Math.round(Math.min(max * 1.25, Math.max(300, window.innerHeight * 0.62)))
  return max
}

// ---------------------------------------------------------------------------
// Figures

function hydrateFigure(fig) {
  if (fig._hydrated) return fig
  fig._hydrated = true
  const stageEl = fig.querySelector('.viz-stage')
  const barsEl = fig.querySelector('.viz-bars')
  const massEl = fig.querySelector('.viz-mass')
  const volEl = fig.querySelector('.viz-volume')
  const noteEl = fig.querySelector('[data-viz-note]')
  const highlight = fig.dataset.highlight
  const compact = 'compact' in fig.dataset
  const maxH = Number(fig.dataset.maxHeight) || 440
  let all = fig.dataset.items.split(',').map(objectFor).filter(Boolean)
  const hidden = new Set()
  const active = () => all.filter(o => !hidden.has(o.slug))

  fig.querySelectorAll('.viz-chips input[type=checkbox]').forEach(cb => {
    cb.addEventListener('change', () => {
      if (cb.checked) hidden.delete(cb.value)
      else hidden.add(cb.value)
      if (!active().length) { hidden.delete(cb.value); cb.checked = true }
      run(true)
    })
  })

  const tabs = [...fig.querySelectorAll('[role=tab]')]
  const selectTab = (tab, focus) => {
    for (const t of tabs) {
      const on = t === tab
      t.setAttribute('aria-selected', String(on))
      t.tabIndex = on ? 0 : -1
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on
    }
    if (focus) tab.focus()
    run(true)
  }
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => selectTab(t))
    t.addEventListener('keydown', e => {
      const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
      if (d) { e.preventDefault(); selectTab(tabs[(i + d + tabs.length) % tabs.length], true) }
    })
  })

  const draw = w => {
    const list = active()
    if (!stageEl.hidden) {
      const { svg, tinyNames } = renderStage(list, { width: w, maxHeight: compact ? maxH : stageHeight(w, maxH), system, highlight, idPrefix: `${fig.id}-svg`, compact })
      stageEl.innerHTML = svg
      if (noteEl) { noteEl.textContent = tinyNote(tinyNames); noteEl.hidden = !tinyNames.length }
    }
    if (barsEl && !barsEl.hidden) barsEl.innerHTML = renderBars(list, { system, highlight })
    if (massEl && !massEl.hidden) massEl.innerHTML = massPane(list, { system, highlight })
    if (volEl && !volEl.hidden) volEl.innerHTML = volumePane(list, { system, highlight, width: Math.round(volEl.clientWidth || w), id: fig.id })
  }
  const host = fig
  const run = watch(host, w => draw(Math.round(w - 24)))
  fig._setItems = objs => { all = objs; hidden.clear(); run(true) }
  return fig
}

// Bare stages (the small drawings on comparison cards).
function hydrateStage(el) {
  const items = el.dataset.items.split(',').map(objectFor).filter(Boolean)
  const maxH = Number(el.dataset.maxHeight) || 220
  const minH = Number(el.dataset.minHeight) || 150
  watch(el, w => {
    el.innerHTML = renderStage(items, { width: w, maxHeight: maxH, minHeight: minH, compact: 'compact' in el.dataset, system, idPrefix: `st-${items.map(o => o.slug).join('-')}` }).svg
  })
}

// The zoom ladder becomes a stepper: one step at a time with previous/next.
function hydrateLadder(sec) {
  const steps = [...sec.querySelectorAll('.ladder-step')]
  if (steps.length < 2) return
  sec.classList.add('is-stepper')
  const nav = document.createElement('div')
  nav.className = 'ladder-nav'
  nav.innerHTML = `<button type="button" class="btn btn-ghost" data-prev>← Zoom in</button>
    <span class="ladder-pos" aria-live="polite"></span>
    <button type="button" class="btn" data-next>Zoom out →</button>`
  const dots = document.createElement('ol')
  dots.className = 'ladder-dots'
  dots.innerHTML = steps.map((s, i) => `<li><button type="button" aria-label="Go to step ${i + 1}: ${esc(s.querySelector('.ladder-title').textContent.replace(/^Step \d+ of \d+\s*/, ''))}">${i + 1}</button></li>`).join('')
  sec.querySelector('.ladder-steps').before(nav)
  nav.after(dots)
  const pos = nav.querySelector('.ladder-pos')
  const prev = nav.querySelector('[data-prev]'), next = nav.querySelector('[data-next]')
  let current = 0
  const show = i => {
    current = Math.max(0, Math.min(steps.length - 1, i))
    steps.forEach((s, k) => { s.hidden = k !== current })
    dots.querySelectorAll('button').forEach((b, k) => b.setAttribute('aria-current', k === current ? 'step' : 'false'))
    pos.textContent = `Step ${current + 1} of ${steps.length}`
    prev.disabled = current === 0
    next.disabled = current === steps.length - 1
    steps[current].querySelector('.viz')?._forceRedraw?.()
  }
  prev.addEventListener('click', () => show(current - 1))
  next.addEventListener('click', () => show(current + 1))
  dots.addEventListener('click', e => { const b = e.target.closest('button'); if (b) show([...dots.querySelectorAll('button')].indexOf(b)) })
  sec.addEventListener('keydown', e => {
    if (e.target.closest('input, select, textarea')) return
    if (e.key === 'ArrowRight' && e.target.closest('.ladder-nav, .ladder-dots')) { e.preventDefault(); show(current + 1) }
    if (e.key === 'ArrowLeft' && e.target.closest('.ladder-nav, .ladder-dots')) { e.preventDefault(); show(current - 1) }
  })
  show(0)
}

function hydrateAll(root = document) {
  root.querySelectorAll('figure[data-viz]').forEach(hydrateFigure)
  root.querySelectorAll('[data-stage]').forEach(hydrateStage)
  root.querySelectorAll('[data-ladder]').forEach(hydrateLadder)
}

// ---------------------------------------------------------------------------
// Search box (combobox with a listbox of suggestions)

function suggestionsFor(q) {
  const out = search(q, INDEX, 7).map(r => ({
    href: `/objects/${r.obj.slug}`,
    label: r.obj.name,
    meta: `${CAT[r.obj.category]?.name || ''} · ${cap(headlineLabel(r.obj))} ${headlineText(r.obj, system)}`,
    shape: r.obj.profile.shape,
  }))
  const parsed = parseLength(q, 'm')
  if (parsed.ok && /\d/.test(q)) {
    // "150 m" is clearly a size; a bare "747" is more likely a name.
    const hasUnit = /[a-z'’]/i.test(q)
    const opt = { href: `/measure?q=${encodeURIComponent(q.trim())}`, label: `See what ${q.trim()}${hasUnit ? '' : ' m'} looks like`, meta: 'Custom size', shape: 'custom-column' }
    if (hasUnit || !out.length) out.unshift(opt)
    else out.push(opt)
  }
  return out
}

function miniIcon(shapeKey) {
  const s = shapeOf(shapeKey)
  if (!s) return ''
  return `<svg class="opt-icon" viewBox="0 0 ${s.w} ${s.h}" aria-hidden="true" focusable="false">${s.layers.map(l => `<path d="${l.d}" fill="${l.fill}"${l.opacity != null ? ` fill-opacity="${l.opacity}"` : ''}${l.rule ? ` fill-rule="${l.rule}"` : ''}/>`).join('')}</svg>`
}

function hydrateSearch(form) {
  const input = form.querySelector('input[role=combobox]')
  const list = form.querySelector('[role=listbox]')
  if (!input || !list) return
  let items = [], activeIdx = -1
  const close = () => { list.hidden = true; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); activeIdx = -1 }
  const setActive = i => {
    activeIdx = i
    list.querySelectorAll('[role=option]').forEach((li, k) => li.setAttribute('aria-selected', String(k === i)))
    if (i >= 0) {
      const li = list.children[i]
      input.setAttribute('aria-activedescendant', li.id)
      li.scrollIntoView({ block: 'nearest' })
    } else input.removeAttribute('aria-activedescendant')
  }
  const update = () => {
    const q = input.value.trim()
    items = q ? suggestionsFor(q) : []
    if (!q) { close(); list.innerHTML = ''; return }
    list.innerHTML = items.length
      ? items.map((it, i) => `<li role="option" id="${list.id}-o${i}" aria-selected="false" data-href="${esc(it.href)}">${miniIcon(it.shape)}<span class="opt-text"><span class="opt-label">${esc(it.label)}</span><span class="opt-meta">${esc(it.meta)}</span></span></li>`).join('')
      : `<li class="no-results" role="option" aria-disabled="true" id="${list.id}-none">No matches. Press Enter to search.</li>`
    list.hidden = false
    input.setAttribute('aria-expanded', 'true')
    activeIdx = -1
  }
  input.addEventListener('input', update)
  input.addEventListener('focus', () => { if (input.value.trim()) update() })
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (list.hidden) update()
      if (!items.length) return
      e.preventDefault()
      const d = e.key === 'ArrowDown' ? 1 : -1
      setActive(activeIdx < 0 ? (d > 0 ? 0 : items.length - 1) : (activeIdx + d + items.length) % items.length)
    } else if (e.key === 'Escape') {
      if (!list.hidden) { e.preventDefault(); close() }
    } else if (e.key === 'Enter') {
      if (activeIdx >= 0 && items[activeIdx]) { e.preventDefault(); location.href = items[activeIdx].href }
    }
  })
  list.addEventListener('mousedown', e => e.preventDefault())
  list.addEventListener('click', e => {
    const li = e.target.closest('[data-href]')
    if (li) location.href = li.dataset.href
  })
  input.addEventListener('blur', () => setTimeout(close, 120))
  form.addEventListener('submit', e => {
    const q = input.value.trim()
    if (!q) { e.preventDefault(); input.focus(); return }
    // A single exact hit goes straight to its page.
    const hits = search(q, INDEX, 2)
    if (hits.length && hits[0].score >= 90 && (!hits[1] || hits[1].score < 90)) {
      e.preventDefault()
      location.href = `/objects/${hits[0].obj.slug}`
    }
  })
}

// ---------------------------------------------------------------------------
// Search results page

function initSearchPage() {
  const params = new URLSearchParams(location.search)
  const q = (params.get('q') || '').trim()
  const input = document.getElementById('page-search')
  if (input) input.value = q
  const out = document.querySelector('[data-search-page]')
  if (!out || !q) return
  const hits = search(q, INDEX, 40)
  const parsed = parseLength(q, 'm')
  const measureLink = parsed.ok && /\d/.test(q)
    ? `<p class="measure-hint"><a class="btn" href="/measure?q=${encodeURIComponent(q)}">See what ${esc(q)}${/[a-z'’]/i.test(q) ? '' : ' m'} looks like →</a></p>` : ''
  document.title = `“${q}” – Search | Scale Explorer`
  out.innerHTML = `<h2>${hits.length ? `${hits.length} result${hits.length === 1 ? '' : 's'} for “${esc(q)}”` : `No objects match “${esc(q)}”`}</h2>${measureLink}` +
    (hits.length ? `<ul class="card-grid">${hits.map(h => cardHtml(h.obj)).join('')}</ul>`
      : `<p>Try a simpler word such as “whale”, “tower”, “ship” or “planet”, or browse a category:</p><ul class="link-list">${CATEGORIES.map(c => `<li><a href="/category/${c.slug}">${esc(c.name)}</a></li>`).join('')}</ul>`)
}

function cardHtml(o) {
  return `<li class="card"><a class="card-link" href="/objects/${esc(o.slug)}"><span class="card-icon">${miniIcon(o.profile.shape)}</span><span class="card-body"><span class="card-name">${esc(o.name)}</span><span class="card-meta">${esc(cap(headlineLabel(o)))}: ${esc(headlineText(o, system))} · ${esc(CAT[o.category]?.name || '')}</span></span></a></li>`
}

// ---------------------------------------------------------------------------
// Compare page

const MAX_ITEMS = 5

function initComparePage() {
  const form = document.querySelector('[data-compare-form]')
  if (!form) return
  const selA = form.querySelector('select[name=a]'), selB = form.querySelector('select[name=b]')
  const extra = form.querySelector('[data-extra]')
  const addBtn = form.querySelector('[data-add]')
  const humanCb = form.querySelector('[data-human]')
  const result = document.querySelector('[data-compare-result]')
  const title = result.querySelector('[data-result-title]')
  const sentencesEl = result.querySelector('[data-sentences]')
  const vizHost = result.querySelector('[data-result-viz]')
  const zoomHost = result.querySelector('[data-result-zoom]')
  const ladderHost = result.querySelector('[data-result-ladder]')
  const howManyHost = result.querySelector('[data-result-howmany]')
  const youInput = form.querySelector('[data-you]')
  const youError = form.querySelector('[data-you-error]')
  const optionsHtml = selA.innerHTML.replace(/<option value="">[^<]*<\/option>/, '')

  const addExtra = slug => {
    const n = extra.children.length + 3
    const row = document.createElement('div')
    row.className = 'cf-extra-row'
    row.innerHTML = `<label class="cf-pick"><span>Object ${n}</span><select name="c">${optionsHtml}</select></label><button type="button" class="btn btn-ghost remove" aria-label="Remove object ${n}">Remove</button>`
    const sel = row.querySelector('select')
    sel.querySelectorAll('option').forEach(o => { o.selected = o.value === slug })
    sel.addEventListener('change', update)
    row.querySelector('.remove').addEventListener('click', () => { row.remove(); renumber(); update() })
    extra.append(row)
    renumber()
  }
  const renumber = () => {
    [...extra.children].forEach((row, i) => {
      row.querySelector('.cf-pick span').textContent = `Object ${i + 3}`
      row.querySelector('.remove').setAttribute('aria-label', `Remove object ${i + 3}`)
    })
    addBtn.hidden = extra.children.length >= MAX_ITEMS - 2
  }

  // Read the URL: ?items=a,b,c or ?a=..&b=..; human=0 hides the human.
  const params = new URLSearchParams(location.search)
  let slugs = (params.get('items') || '').split(',').map(s => s.trim()).filter(s => BY.has(s))
  if (!slugs.length) slugs = [params.get('a'), params.get('b')].filter(s => BY.has(s))
  slugs = [...new Set(slugs)].slice(0, MAX_ITEMS)
  const humanParams = params.getAll('human')
  if (humanParams.length) humanCb.checked = humanParams[humanParams.length - 1] !== '0'
  if (params.get('you')) youInput.value = params.get('you')
  if (slugs[0]) selA.value = slugs[0]
  if (slugs[1]) selB.value = slugs[1]
  else if (slugs[0] && params.get('you')) selB.value = ''
  for (const s of slugs.slice(2)) addExtra(s)
  addBtn.hidden = false
  renumber()

  // "You": a person drawn at the height the visitor types.
  function youObject() {
    const text = youInput.value.trim()
    youError.hidden = true
    youInput.removeAttribute('aria-invalid')
    if (!text) return null
    const hasUnit = /[a-zµ'"’”]/i.test(text)
    const parsed = parseLength(text, hasUnit ? 'm' : (parseFloat(text) >= 3 ? 'cm' : 'm'))
    let error = parsed.ok ? '' : parsed.error
    if (parsed.ok && (parsed.meters < 0.3 || parsed.meters > 3)) error = 'Enter a height between 30 cm and 3 m, for example 5 ft 10 in or 178 cm.'
    if (error) {
      youError.textContent = error
      youError.hidden = false
      youInput.setAttribute('aria-invalid', 'true')
      return null
    }
    const you = {
      slug: 'you', name: 'You', phrase: 'you', category: 'animals', familiar: false, fill: '#d9480f',
      headline: 'height', headlineAdj: 'tall', profile: { shape: 'human', y: 'height' },
      measures: { height: { label: 'Height', value: parsed.value, unit: parsed.unit, approx: false, qualifier: 'exact' } },
    }
    extraObjects.set('you', you)
    return you
  }

  // Surprise me: two random objects close enough in size to see together.
  function surprise() {
    let a, b
    for (let i = 0; i < 80; i++) {
      a = OBJECTS[Math.floor(Math.random() * OBJECTS.length)]
      b = OBJECTS[Math.floor(Math.random() * OBJECTS.length)]
      const r = sizeOf(a) > sizeOf(b) ? sizeOf(a) / sizeOf(b) : sizeOf(b) / sizeOf(a)
      if (a !== b && a.category !== b.category && r >= 1.3 && r <= 60) break
    }
    extra.innerHTML = ''
    renumber()
    selA.value = a.slug
    selB.value = b.slug
    update()
  }

  let fig = null
  function update() {
    const chosen = [...new Set([selA.value, selB.value, ...[...extra.querySelectorAll('select')].map(s => s.value)])].map(s => BY.get(s)).filter(Boolean)
    const you = youObject()
    const withHuman = humanCb.checked && !chosen.some(o => o.slug === 'human')
    const lineup = [...(withHuman ? [BY.get('human')] : []), ...(you ? [you] : []), ...chosen].sort((a, b) => sizeOf(a) - sizeOf(b))
    const names = [...(you ? ['You'] : []), ...chosen.map(o => o.name)]
    title.textContent = names.length > 1 ? names.join(' vs ') : names[0] || ''
    document.title = `${names.join(' vs ')} – Size Comparison | Scale Explorer`

    const sentences = []
    for (let i = 1; i < chosen.length; i++) sentences.push(compareSentence(chosen[i], chosen[0]))
    if (you) for (const o of chosen) sentences.push(compareSentence(o, you))
    if (withHuman) for (const o of chosen) sentences.push(compareSentence(o, BY.get('human')))
    sentencesEl.innerHTML = sentences.map(s => `<li>${esc(s)}</li>`).join('')
    const fit = [...(chosen.length > 1 ? howManyFit(chosen[0], chosen[1]) : []), ...(you && chosen[0] ? howManyFit(chosen[0], you) : [])]
    howManyHost.innerHTML = howManyHtml(fit)

    if (!fig) {
      fig = vizHost.querySelector('figure[data-viz]')
      hydrateFigure(fig)
    }
    fig.dataset.items = lineup.map(o => o.slug).join(',')
    fig._setItems(lineup)

    const w = vizHost.clientWidth || 960
    zoomHost.innerHTML = zoomFigures(lineup, 'cmpz', { system, width: w })
    hydrateAll(zoomHost)

    ladderHost.innerHTML = ''
    const objs = chosen.slice().sort((a, b) => sizeOf(a) - sizeOf(b))
    if (objs.length >= 2 && sizeOf(objs[objs.length - 1]) / sizeOf(objs[0]) > 25) {
      ladderHost.innerHTML = ladderSection(OBJECTS, objs[0], objs[objs.length - 1], { id: 'cmp-ladder', system, width: w })
      hydrateAll(ladderHost)
    }

    const qs = new URLSearchParams({ items: chosen.map(o => o.slug).join(',') })
    if (!humanCb.checked) qs.set('human', '0')
    if (you) qs.set('you', youInput.value.trim())
    history.replaceState(null, '', `/compare?${qs.toString().replace(/%2C/g, ',')}`)
  }

  selA.addEventListener('change', update)
  selB.addEventListener('change', update)
  humanCb.addEventListener('change', update)
  youInput.addEventListener('change', update)
  form.querySelector('[data-surprise]').addEventListener('click', surprise)
  form.querySelector('[data-swap]').addEventListener('click', () => {
    const a = selA.value
    selA.value = selB.value
    selB.value = a
    update()
  })
  addBtn.addEventListener('click', () => {
    const used = new Set([selA.value, selB.value, ...[...extra.querySelectorAll('select')].map(s => s.value)])
    const next = OBJECTS.find(o => o.familiar && !used.has(o.slug)) || OBJECTS.find(o => !used.has(o.slug))
    addExtra(next.slug)
    update()
    extra.lastElementChild.querySelector('select').focus()
  })
  form.addEventListener('submit', e => { e.preventDefault(); update() })
  if (params.get('surprise')) surprise()
  else update()
}

// ---------------------------------------------------------------------------
// Custom size page

function customObject(parsed, as) {
  const valueText = formatMeasure({ value: parsed.value, unit: parsed.unit, approx: false, qualifier: 'exact' }, UNITS[parsed.unit].system)
  return {
    slug: 'custom',
    name: `Your size (${valueText})`,
    phrase: valueText,
    category: 'custom',
    headline: 'size',
    headlineAdj: as === 'length' ? 'long' : 'tall',
    familiar: false,
    profile: as === 'length' ? { shape: 'custom-span', x: 'size' } : { shape: 'custom-column', y: 'size' },
    measures: { size: { label: as === 'length' ? 'Length' : 'Height', value: parsed.value, unit: parsed.unit, approx: false, qualifier: 'exact' } },
  }
}

function headlineMid(o) {
  return midOf(measureRange(o.measures[o.headline]))
}

// "150 m is about 1.4 times the length of an American football field (110 m)."
function customSentence(meters, valueText, ref) {
  const m = ref.measures[ref.headline]
  const r = meters / headlineMid(ref)
  const refText = `the ${headlineLabel(ref)} of ${phraseOf(ref)} (${formatMeasure(m, system)})`
  if (r >= 0.9 && r <= 1.1) return `${valueText} is about the same as ${refText}.`
  if (r > 1.1) {
    const times = r >= 100 ? formatNumber(r, 2) : r >= 10 ? String(Math.round(r)) : String(Math.round(r * 10) / 10)
    return `${valueText} is about ${times} times ${refText}.`
  }
  if (r >= 0.01) return `${valueText} is about ${formatNumber(r * 100, 2)}% of ${refText}.`
  return `${valueText} is about 1/${formatNumber(1 / r, 2)} of ${refText}.`
}

function initMeasurePage() {
  const form = document.querySelector('[data-measure-form]')
  if (!form) return
  const input = form.querySelector('[data-measure-input]')
  const unitSel = form.querySelector('[data-measure-unit]')
  const errorEl = form.querySelector('[data-measure-error]')
  const out = document.querySelector('[data-measure-result]')
  const params = new URLSearchParams(location.search)
  if (params.get('q')) input.value = params.get('q')
  if (INPUT_UNITS.includes(params.get('unit'))) unitSel.value = params.get('unit')
  if (params.get('as') === 'length') form.querySelector('input[name=as][value=length]').checked = true

  const showError = msg => {
    errorEl.textContent = msg
    errorEl.hidden = false
    input.setAttribute('aria-invalid', 'true')
    out.innerHTML = ''
  }

  function update(push) {
    const as = form.querySelector('input[name=as]:checked').value
    const parsed = parseLength(input.value, unitSel.value)
    if (!parsed.ok) return showError(parsed.error)
    errorEl.hidden = true
    input.removeAttribute('aria-invalid')
    const custom = customObject(parsed, as)
    extraObjects.set('custom', custom)
    const meters = parsed.meters
    const valueText = custom.phrase

    // Conversions, to 6 significant figures.
    const conv = INPUT_UNITS.map(u => `<tr${u === parsed.unit ? ' class="is-source"' : ''}><th scope="row">${esc({ m: 'Meters', ft: 'Feet', km: 'Kilometers', mi: 'Miles' }[u])}</th><td>${esc(formatNumber(fromBase(meters, u), 6))} ${esc(UNITS[u].symbol)}</td></tr>`).join('')

    // Familiar objects just smaller and just larger, plus a human.
    const candidates = OBJECTS.filter(o => o.familiar && o.slug !== 'human' && !shapeOf(o.profile.shape).below)
    const smaller = candidates.filter(o => sizeOf(o) <= sizeOf(custom)).sort((a, b) => sizeOf(b) - sizeOf(a))[0]
    const larger = candidates.filter(o => sizeOf(o) > sizeOf(custom)).sort((a, b) => sizeOf(a) - sizeOf(b))[0]
    const lineup = [BY.get('human'), smaller, custom, larger].filter(Boolean)
      .filter((o, i, arr) => arr.indexOf(o) === i).sort((a, b) => sizeOf(a) - sizeOf(b))
    const refs = comparisonSet(custom, OBJECTS, 6)
    const w = out.clientWidth || 960

    out.innerHTML = `<h2>${esc(valueText)} ${as === 'length' ? 'long' : 'tall'}</h2>
<div class="measure-grid">
  <div class="table-wrap"><table class="conv"><caption>${esc(valueText)} in other units</caption><tbody>${conv}</tbody></table>
  <p class="fine">Exact definitions: 1 ft = 0.3048 m, 1 mi = 1,609.344 m.</p></div>
  <div><h3>Compared with familiar things</h3><ul class="sentences">${refs.map(r => `<li>${esc(customSentence(meters, valueText, r))}</li>`).join('')}</ul></div>
</div>
${vizFigure(lineup, { id: 'mviz', highlight: 'custom', system, width: w, caption: `Everything is drawn to the same scale. Your size is shown as a plain ${as === 'length' ? 'bar' : 'column'}; its ${as === 'length' ? 'thickness' : 'width'} is only for visibility.` })}
${zoomFigures(lineup, 'mz', { highlight: 'custom', system, width: w })}
${sizeOf(custom) / sizeOf(BY.get('human')) > 25 ? ladderSection(OBJECTS, BY.get('human'), custom, { id: 'm-ladder', system, width: w, heading: `Zoom out from a human to ${valueText}` }) : ''}`
    hydrateAll(out)

    if (push) {
      const qs = new URLSearchParams({ q: input.value.trim(), unit: unitSel.value })
      if (as === 'length') qs.set('as', 'length')
      history.replaceState(null, '', `/measure?${qs}`)
    }
  }

  form.addEventListener('submit', e => { e.preventDefault(); update(true) })
  document.addEventListener('units-change', () => update(false))
  form.querySelectorAll('input[name=as]').forEach(r => r.addEventListener('change', () => update(true)))
  unitSel.addEventListener('change', () => update(true))
  form.querySelectorAll('[data-example]').forEach(a => a.addEventListener('click', e => {
    e.preventDefault()
    input.value = a.dataset.example
    update(true)
  }))
  update(false)
}

// ---------------------------------------------------------------------------

function init() {
  syncUnitButtons()
  document.querySelectorAll('.units button[data-system]').forEach(b => b.addEventListener('click', () => setSystem(b.dataset.system)))
  document.querySelectorAll('form[data-search]').forEach(hydrateSearch)
  const page = document.body.dataset.page
  if (page === 'compare') initComparePage()
  if (page === 'measure') initMeasurePage()
  if (page === 'search') {
    initSearchPage()
    document.addEventListener('units-change', initSearchPage)
  }
  hydrateAll()
  document.documentElement.classList.add('js')
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init)
else init()
