// HTML for every page. Plain template strings: every interpolated value from
// the dataset goes through esc(). Pages are complete without JavaScript; the
// browser script re-draws the visualisations at the real screen width and
// adds the interactive parts.

import { esc, renderStage, headlineText, headlineLabel } from '../src/lib/render.js'
import { vizFigure as fig, zoomFigures as zoomFig, ladderSection as ladderSec } from '../src/lib/figure.js'
import { formatBoth, formatMeasure, measureRange } from '../src/lib/measures.js'
import { pickReferences, sizeOf, shapeOf } from '../src/lib/layout.js'
import { compareSentence, comparisonSet, adjOf, phraseOf, factorText } from '../src/lib/compare.js'
import { formatNumber, UNITS } from '../src/lib/units.js'

const cap = s => s.charAt(0).toUpperCase() + s.slice(1)
const SMALL_WORDS = new Set(['a', 'an', 'the', 'of', 'and', 'or', 'in', 'on', 'at', 'to', 'vs'])
export const titleCase = s => s.split(' ').map((w, i) => (i > 0 && SMALL_WORDS.has(w.toLowerCase()) ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1))).join(' ')

const ZOOM_THRESHOLD = 20 // show the step-by-step zoom when an object is 20x a human

export function questionOf(obj) {
  const verb = adjOf(obj).startsWith('tall') ? 'tall' : 'big'
  return `How ${verb} is ${phraseOf(obj)}?`
}

// ---------------------------------------------------------------------------
// Shared pieces

export const LOGO = `<svg class="logo" viewBox="0 0 32 32" aria-hidden="true" focusable="false"><rect x="2" y="21" width="7" height="8" rx="1.6"/><rect x="12" y="13" width="7" height="16" rx="1.6"/><rect x="22" y="3" width="8" height="26" rx="1.6"/></svg>`

export function icon(shapeKey, cls = 'icon') {
  const s = shapeOf(shapeKey)
  const pad = Math.max(s.w, s.h) * 0.04
  return `<svg class="${cls}" viewBox="${-pad} ${-pad} ${s.w + pad * 2} ${s.h + pad * 2}" aria-hidden="true" focusable="false">${s.layers.map(l => `<path d="${l.d}" fill="${l.fill}"${l.opacity != null ? ` fill-opacity="${l.opacity}"` : ''}${l.rule ? ` fill-rule="${l.rule}"` : ''}/>`).join('')}</svg>`
}

function searchBox(id, { big = false, value = '' } = {}) {
  return `<form class="search${big ? ' search-big' : ''}" role="search" action="/search" method="get" data-search>
  <label class="search-label${big ? '' : ' visually-hidden'}" for="${id}">What do you want to compare?</label>
  <div class="search-field">
    <svg class="search-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21"/></svg>
    <input id="${id}" name="q" type="search" value="${esc(value)}" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${big ? 'Try “blue whale”, “Eiffel Tower” or “150 m”' : 'Search objects'}" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="${id}-list">
    <button class="search-submit" type="submit">Search</button>
  </div>
  <ul id="${id}-list" class="search-results" role="listbox" aria-label="Suggestions" hidden></ul>
</form>`
}

function header(ctx, active) {
  const nav = [
    ...ctx.categories.map(c => [`/category/${c.slug}`, c.name, `category:${c.slug}`]),
    ['/compare', 'Compare', 'compare'],
    ['/measure', 'Custom size', 'measure'],
    ['/objects', 'All objects', 'objects'],
  ]
  return `<header class="site-header">
  <div class="wrap header-row">
    <a class="brand" href="/">${LOGO}<span>Scale Explorer</span></a>
    ${active === 'home' ? '<div class="header-spacer"></div>' : searchBox('site-search')}
    <div class="units" role="group" aria-label="Units for drawings">
      <button type="button" data-system="metric" aria-pressed="true" title="Metric (metres)">m</button>
      <button type="button" data-system="imperial" aria-pressed="false" title="Imperial (feet)">ft</button>
    </div>
  </div>
  <nav class="site-nav" aria-label="Main"><div class="wrap"><ul>${nav.map(([href, label, key]) =>
    `<li><a href="${href}"${key === active ? ' aria-current="page"' : ''}>${esc(label)}</a></li>`).join('')}</ul></div></nav>
</header>`
}

function footer(ctx) {
  return `<footer class="site-footer">
  <div class="wrap footer-grid">
    <div>
      <p class="footer-brand">${LOGO}<span>Scale Explorer</span></p>
      <p>${esc(ctx.site.tagline)} Measurements come from NASA, NOAA, the US National Park Service, manufacturers and other published sources, cited on every page.</p>
    </div>
    <nav aria-label="Categories"><h2>Explore</h2><ul>${ctx.categories.map(c => `<li><a href="/category/${c.slug}">${esc(c.name)}</a></li>`).join('')}</ul></nav>
    <nav aria-label="Tools"><h2>Tools</h2><ul>
      <li><a href="/compare">Compare two objects</a></li>
      <li><a href="/measure">Visualise your own size</a></li>
      <li><a href="/objects">All objects</a></li>
      <li><a href="/about">About the data</a></li>
      <li><a href="${esc(ctx.site.repo)}">Source code</a></li>
    </ul></nav>
  </div>
  <div class="wrap footer-note"><p>No accounts, cookies or tracking. Drawings are computed in your browser. Data last reviewed ${esc(humanDate(ctx.site.updated))}.</p></div>
</footer>`
}

export function humanDate(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  return `${d} ${months[m - 1]} ${y}`
}

function crumbs(ctx, items) {
  return `<nav class="crumbs" aria-label="Breadcrumb"><ol>${items.map(([href, label], i) =>
    i === items.length - 1
      ? `<li><span aria-current="page">${esc(label)}</span></li>`
      : `<li><a href="${href}">${esc(label)}</a></li>`).join('')}</ol></nav>`
}

function breadcrumbLd(ctx, items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map(([href, label], i) => ({ '@type': 'ListItem', position: i + 1, name: label, item: ctx.site.url + (href === '/' ? '/' : href) })),
  }
}

// The whole document around a page's main content.
export function layout(ctx, { path, title, description, active, page = active, main, jsonld = [], ogImage, ogType = 'website', noindex = false, pageAttrs = '' }) {
  const url = ctx.site.url + (path === '/' ? '/' : path)
  const image = ogImage || ctx.ogDefault
  const ld = jsonld.map(j => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, '\\u003c')}</script>`).join('\n')
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(url)}">
${noindex ? '<meta name="robots" content="noindex, follow">\n' : ''}<meta property="og:type" content="${ogType}">
<meta property="og:site_name" content="Scale Explorer">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:locale" content="en_US">
${image ? `<meta property="og:image" content="${esc(ctx.site.url + image)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(title)}">
<meta name="twitter:card" content="summary_large_image">` : '<meta name="twitter:card" content="summary">'}
<meta name="theme-color" content="#f6f5f1" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0f1218" media="(prefers-color-scheme: dark)">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="${ctx.assets}/site.css">
<script type="module" src="${ctx.assets}/client/app.js"></script>
${ld}
</head>
<body data-page="${esc(page)}"${pageAttrs}>
<a class="skip-link" href="#main">Skip to content</a>
${header(ctx, active)}
<main id="main" tabindex="-1">
${main}
</main>
${footer(ctx)}
</body>
</html>
`
}

const vizFigure = (ctx, objects, opts) => fig(objects, opts)
const zoomFigures = (ctx, objects, idBase, highlight) => zoomFig(objects, idBase, { highlight })
const ladderSection = (ctx, from, to, opts) => ladderSec(ctx.clientObjects, from, to, opts)

function objectCard(o, { showCategory = false, ctx } = {}) {
  const cat = showCategory && ctx ? ctx.categoryBySlug[o.category] : null
  return `<li class="card"><a class="card-link" href="/objects/${esc(o.slug)}">
  <span class="card-icon">${icon(o.profile.shape)}</span>
  <span class="card-body"><span class="card-name">${esc(o.name)}</span>
  <span class="card-meta">${esc(cap(headlineLabel(o)))}: ${esc(headlineText(o, 'metric'))}${cat ? ` · ${esc(cat.name)}` : ''}</span></span>
</a></li>`
}

function comparisonCard(ctx, a, b, id) {
  const { svg } = renderStage([a, b].sort((x, y) => sizeOf(x) - sizeOf(y)), { width: 480, maxHeight: 220, minHeight: 150, compact: true, idPrefix: id })
  return `<li class="pair-card"><a href="/compare?items=${esc(a.slug)},${esc(b.slug)}">
  <span class="pair-title">${esc(a.name)} <span class="vs">vs</span> ${esc(b.name)}</span>
  <span class="pair-stage" data-stage data-items="${esc([a, b].sort((x, y) => sizeOf(x) - sizeOf(y)).map(o => o.slug).join(','))}" data-max-height="220" data-min-height="150" data-compact>${svg}</span>
  <span class="pair-sentence">${esc(compareSentence(a, b))}</span>
</a></li>`
}

function optionList(ctx, selected) {
  return ctx.categories.map(c => `<optgroup label="${esc(c.name)}">${ctx.clientObjects.filter(o => o.category === c.slug)
    .map(o => `<option value="${esc(o.slug)}"${o.slug === selected ? ' selected' : ''}>${esc(o.name)}</option>`).join('')}</optgroup>`).join('')
}

// ---------------------------------------------------------------------------
// Pages

export function homePage(ctx) {
  const { site } = ctx
  const by = ctx.clientBySlug
  const hero = site.heroLineup.map(s => by[s])
  const popular = site.popular.map(([a, b], i) => comparisonCard(ctx, by[a], by[b], `pop${i}`)).join('')
  const featured = site.featured.map(s => objectCard(by[s], { showCategory: true, ctx })).join('')
  const cats = ctx.categories.map(c => {
    const list = ctx.clientObjects.filter(o => o.category === c.slug)
    const iconShape = by[c.icon]?.profile.shape || list[0].profile.shape
    return `<li class="cat-card cat-${esc(c.slug)}"><a href="/category/${esc(c.slug)}">
  <span class="cat-icon">${icon(iconShape)}</span>
  <span class="cat-name">${esc(c.name)}</span>
  <span class="cat-count">${list.length} objects</span>
  <span class="cat-examples">${esc(list.slice(0, 3).map(o => o.name).join(', '))}${list.length > 3 ? '…' : ''}</span>
</a></li>`
  }).join('')
  const main = `<section class="hero">
  <div class="wrap hero-grid">
    <div class="hero-copy">
      <p class="eyebrow">Scale Explorer</p>
      <h1>See how big things really are.</h1>
      <p class="hero-lede">Real measurements, drawn to scale. Pick anything from a lion to the planet Mars and see it next to a person, a bus or a skyscraper.</p>
      ${searchBox('hero-search', { big: true })}
      <p class="hero-links">Or <a href="/compare">compare two objects</a> · <a href="/measure">see what 150 m looks like</a></p>
    </div>
  </div>
  <div class="wrap">
    ${vizFigure(ctx, hero, { id: 'hero-viz', highlight: hero[hero.length - 1].slug, maxHeight: 360, tabs: true })}
  </div>
</section>

<section class="section" aria-labelledby="pop-h">
  <div class="wrap">
    <div class="section-head"><h2 id="pop-h">Popular comparisons</h2><a class="more" href="/compare">Build your own →</a></div>
    <ul class="pair-grid">${popular}</ul>
  </div>
</section>

<section class="section" aria-labelledby="cat-h">
  <div class="wrap">
    <div class="section-head"><h2 id="cat-h">Browse by category</h2><a class="more" href="/objects">All ${ctx.clientObjects.length} objects →</a></div>
    <ul class="cat-grid">${cats}</ul>
  </div>
</section>

<section class="section" aria-labelledby="feat-h">
  <div class="wrap">
    <div class="section-head"><h2 id="feat-h">Featured objects</h2></div>
    <ul class="card-grid">${featured}</ul>
  </div>
</section>

<section class="section section-alt" aria-labelledby="any-h">
  <div class="wrap any-grid">
    <div>
      <h2 id="any-h">Compare anything</h2>
      <p>Put any two objects side by side at their true relative size, with a person for scale.</p>
      <form class="mini-compare" action="/compare" method="get">
        <label>First <select name="a">${optionList(ctx, 'blue-whale')}</select></label>
        <label>Second <select name="b">${optionList(ctx, 'boeing-747')}</select></label>
        <button class="btn" type="submit">Compare</button>
      </form>
    </div>
    <div>
      <h2>Or enter your own size</h2>
      <p>Type a measurement in meters, feet, kilometers or miles and see it next to familiar things.</p>
      <form class="mini-measure" action="/measure" method="get">
        <label for="home-q" class="visually-hidden">Size</label>
        <input id="home-q" name="q" inputmode="decimal" placeholder="150" value="150" autocomplete="off">
        <label for="home-unit" class="visually-hidden">Unit</label>
        <select id="home-unit" name="unit"><option value="m">meters</option><option value="ft">feet</option><option value="km">kilometers</option><option value="mi">miles</option></select>
        <button class="btn" type="submit">Show me</button>
      </form>
    </div>
  </div>
</section>`
  return layout(ctx, {
    path: '/',
    title: 'Scale Explorer – See How Big Things Really Are',
    description: site.description,
    active: 'home',
    main,
    jsonld: [{
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'Scale Explorer',
      url: site.url + '/',
      description: site.description,
      potentialAction: { '@type': 'SearchAction', target: { '@type': 'EntryPoint', urlTemplate: `${site.url}/search?q={search_term_string}` }, 'query-input': 'required name=search_term_string' },
    }],
  })
}

function statTiles(obj, full) {
  const head = full.measures.find(m => m.key === obj.headline)
  const others = full.measures.filter(m => m.key !== obj.headline).slice(0, 3)
  const tile = (m, big) => {
    const badge = m.qualifier === 'up to' ? 'maximum' : (m.min != null && m.max != null && m.min !== m.max) ? 'range' : m.approx ? 'approx.' : ''
    return `<div class="stat${big ? ' stat-main' : ''}"><dt>${esc(m.label)}</dt><dd><span class="stat-value">${esc(formatMeasure(m, 'metric'))}</span> <span class="stat-alt">${esc(formatMeasure(m, 'imperial', { prefix: false }))}</span>${badge ? ` <span class="badge">${badge}</span>` : ''}</dd></div>`
  }
  return `<dl class="stats">${tile(head, true)}${others.map(m => tile(m, false)).join('')}</dl>`
}

function dimensionsTable(full) {
  const srcIndex = Object.fromEntries(full.sources.map((s, i) => [s.id, i + 1]))
  return `<div class="table-wrap"><table class="dims">
  <caption class="visually-hidden">Measurements of ${esc(full.name)}</caption>
  <thead><tr><th scope="col">Measurement</th><th scope="col">Metric</th><th scope="col">Imperial</th><th scope="col">Notes</th><th scope="col">Source</th></tr></thead>
  <tbody>${full.measures.map(m => `<tr>
    <th scope="row">${esc(m.label)}</th>
    <td>${esc(formatMeasure(m, 'metric'))}</td>
    <td>${esc(formatMeasure(m, 'imperial'))}</td>
    <td>${esc(noteText(m))}</td>
    <td><a class="ref" href="#src-${esc(m.source)}" aria-label="Source ${srcIndex[m.source]}">[${srcIndex[m.source]}]</a></td>
  </tr>`).join('')}</tbody>
</table></div>`
}

function noteText(m) {
  const bits = []
  if (m.note) bits.push(cap(m.note))
  if (m.min != null && m.max != null && m.min !== m.max) bits.push('Range: varies')
  else if (m.qualifier === 'up to') bits.push('Maximum')
  else if (m.approx) bits.push('Approximate')
  return bits.join('. ').replace(/\.\./g, '.')
}

function sourcesList(full) {
  return `<ol class="sources">${full.sources.map(s => `<li id="src-${esc(s.id)}"><span class="src-pub">${esc(s.publisher)}</span>, <a href="${esc(s.url)}" rel="nofollow noopener" target="_blank">${esc(s.title)}</a>. <span class="src-date">Accessed ${esc(humanDate(s.accessed))}.</span></li>`).join('')}</ol>`
}

export function objectPage(ctx, full) {
  const obj = ctx.clientBySlug[full.slug]
  const cat = ctx.categoryBySlug[obj.category]
  const human = ctx.clientBySlug.human
  const refs = pickReferences(obj, ctx.clientObjects)
  const lineup = [...new Set([obj.slug === 'human' ? null : human, ...refs, obj].filter(Boolean))].sort((a, b) => sizeOf(a) - sizeOf(b))
  const chips = lineup.filter(o => o !== obj)
  const question = questionOf(obj)
  const head = obj.measures[obj.headline]
  const mass = full.measures.find(m => UNITS[m.unit].kind === 'mass')
  const refNames = chips.map(o => phraseOf(o))
  const refList = refNames.length > 1 ? `${refNames.slice(0, -1).join(', ')} and ${refNames[refNames.length - 1]}` : refNames[0]
  const description = `${cap(phraseOf(obj))} is ${formatBoth(head)} ${adjOf(obj)}${mass ? `, with a mass of ${formatMeasure(mass, 'metric')}` : ''}. See it drawn to scale next to ${refList}, with sourced measurements.`
  const title = `${titleCase(question)} Real Size, Compared | Scale Explorer`
  const trail = [['/', 'Home'], [`/category/${cat.slug}`, cat.name], [`/objects/${obj.slug}`, obj.name]]
  const needsLadder = obj.slug !== 'human' && sizeOf(obj) / sizeOf(human) > ZOOM_THRESHOLD
  const compareRefs = comparisonSet(obj, ctx.clientObjects)
  const related = (full.related?.length ? full.related.map(s => ctx.clientBySlug[s]) : autoRelated(ctx, obj)).slice(0, 6)

  const main = `<div class="wrap">
${crumbs(ctx, trail)}
<header class="object-head">
  <p class="eyebrow cat-${esc(cat.slug)}"><a href="/category/${esc(cat.slug)}">${esc(cat.name)}</a></p>
  <h1>${esc(cap(question))}</h1>
  <p class="object-sub"><strong>${esc(obj.name)}</strong>${full.subtitle ? ` · ${esc(full.subtitle)}` : ''}${full.scientificName ? ` · <i>${esc(full.scientificName)}</i>` : ''}</p>
  ${statTiles(obj, full)}
</header>

<section class="viz-section" aria-labelledby="viz-h">
  <h2 id="viz-h" class="visually-hidden">${esc(obj.name)} drawn to scale</h2>
  ${vizFigure(ctx, lineup, { id: 'viz', highlight: obj.slug, chips })}
  <p class="viz-actions"><a class="btn btn-ghost" href="/compare?items=${esc(obj.slug)},${esc((refs[0] || human).slug)}">Compare ${esc(obj.name)} with something else →</a></p>
</section>
<div class="ad-slot" data-ad-slot="below-visualization" hidden></div>

<div class="content-grid">
  <div class="content-main">
    ${needsLadder ? ladderSection(ctx, human, obj) : ''}

    <section aria-labelledby="dims-h">
      <h2 id="dims-h">Dimensions</h2>
      ${dimensionsTable(full)}
    </section>

    <section aria-labelledby="about-h">
      <h2 id="about-h">About ${esc(phraseOf(obj).replace(/^(a|an) /, 'the '))}</h2>
      <p>${esc(full.description)}</p>
      ${full.facts?.length ? `<ul class="facts">${full.facts.map(f => `<li>${esc(f.text)} <a class="ref" href="#src-${esc(f.source)}">[${full.sources.findIndex(s => s.id === f.source) + 1}]</a></li>`).join('')}</ul>` : ''}
    </section>

    <section aria-labelledby="cmp-h">
      <h2 id="cmp-h">How it compares</h2>
      <ul class="compare-list">${compareRefs.map(r => `<li>
        <span class="cmp-factor">${esc(factorText(obj, r))}</span>
        <span class="cmp-text">${esc(compareSentence(obj, r))} <a href="/compare?items=${esc(obj.slug)},${esc(r.slug)}">See side by side</a></span>
      </li>`).join('')}</ul>
      <p class="fine">Factors compare the ${esc(headlineLabel(obj))} of ${esc(phraseOf(obj))} with each object’s own main measurement (${esc(headlineLabel(human))} for a human). Where a size varies, the factor is given as a range.</p>
    </section>

    <div class="ad-slot" data-ad-slot="between-sections" hidden></div>

    ${full.caveats?.length ? `<section aria-labelledby="notes-h">
      <h2 id="notes-h">Notes on these figures</h2>
      <ul class="notes">${full.caveats.map(c => `<li>${esc(c)}</li>`).join('')}</ul>
    </section>` : ''}

    <section aria-labelledby="src-h">
      <h2 id="src-h">Sources</h2>
      ${sourcesList(full)}
    </section>
  </div>
  <aside class="rail" data-ad-slot="sidebar" hidden></aside>
</div>

<section class="section" aria-labelledby="rel-h">
  <h2 id="rel-h">Related objects</h2>
  <ul class="card-grid">${related.map(o => objectCard(o, { showCategory: true, ctx })).join('')}</ul>
</section>
</div>`

  return layout(ctx, {
    path: `/objects/${obj.slug}`,
    title,
    description,
    active: `category:${cat.slug}`,
    page: 'object',
    ogType: 'article',
    ogImage: ctx.ogFor(obj.slug),
    main,
    pageAttrs: ` data-slug="${esc(obj.slug)}"`,
    jsonld: [{
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: cap(question),
      url: `${ctx.site.url}/objects/${obj.slug}`,
      description,
      dateModified: full.updated || ctx.site.updated,
      isPartOf: { '@type': 'WebSite', name: 'Scale Explorer', url: ctx.site.url + '/' },
      about: {
        '@type': full.schemaType || 'Thing',
        name: full.name,
        description: full.description,
        ...(full.wikipedia ? { sameAs: [full.wikipedia] } : {}),
      },
      citation: full.sources.map(s => ({ '@type': 'CreativeWork', name: s.title, url: s.url, publisher: { '@type': 'Organization', name: s.publisher } })),
    }, breadcrumbLd(ctx, trail)],
  })
}

function autoRelated(ctx, obj) {
  const size = sizeOf(obj)
  return ctx.clientObjects.filter(o => o.slug !== obj.slug)
    .sort((a, b) => {
      const sa = (a.category === obj.category ? 0 : 1.5) + Math.abs(Math.log(sizeOf(a) / size))
      const sb = (b.category === obj.category ? 0 : 1.5) + Math.abs(Math.log(sizeOf(b) / size))
      return sa - sb
    })
}

export function categoryPage(ctx, cat) {
  const list = ctx.clientObjects.filter(o => o.category === cat.slug).sort((a, b) => sizeOf(a) - sizeOf(b))
  const trail = [['/', 'Home'], [`/category/${cat.slug}`, cat.name]]
  const title = `${cat.name} Size Comparison: ${list.length} ${cat.name} Drawn to Scale | Scale Explorer`
  const description = `${cat.description} Compare ${list.map(o => o.name).slice(0, 4).join(', ')} and more at their true relative size.`
  const main = `<div class="wrap">
${crumbs(ctx, trail)}
<header class="page-head cat-${esc(cat.slug)}">
  <p class="eyebrow">Category</p>
  <h1>${esc(cat.name)}</h1>
  <p class="lede">${esc(cat.description)}</p>
</header>
<section class="viz-section" aria-labelledby="viz-h">
  <h2 id="viz-h">All ${esc(cat.name.toLowerCase())} at the same scale</h2>
  ${vizFigure(ctx, list, { id: 'viz', chips: list })}
  ${zoomFigures(ctx, list, 'viz')}
</section>
<div class="ad-slot" data-ad-slot="below-visualization" hidden></div>
<section class="section" aria-labelledby="list-h">
  <h2 id="list-h">${esc(cat.name)} from smallest to largest</h2>
  <ul class="card-grid">${list.map(o => objectCard(o)).join('')}</ul>
</section>
</div>`
  return layout(ctx, {
    path: `/category/${cat.slug}`, title, description, active: `category:${cat.slug}`, page: 'category', main,
    jsonld: [{
      '@context': 'https://schema.org', '@type': 'CollectionPage', name: `${cat.name} drawn to scale`, url: `${ctx.site.url}/category/${cat.slug}`, description,
      mainEntity: { '@type': 'ItemList', itemListElement: list.map((o, i) => ({ '@type': 'ListItem', position: i + 1, name: o.name, url: `${ctx.site.url}/objects/${o.slug}` })) },
    }, breadcrumbLd(ctx, trail)],
  })
}

export function comparePage(ctx) {
  const a = ctx.clientBySlug['blue-whale'], b = ctx.clientBySlug['boeing-747'], human = ctx.clientBySlug.human
  const lineup = [human, a, b].sort((x, y) => sizeOf(x) - sizeOf(y))
  const trail = [['/', 'Home'], ['/compare', 'Compare']]
  const popular = ctx.site.popular.map(([x, y]) => `<li><a href="/compare?items=${esc(x)},${esc(y)}">${esc(ctx.clientBySlug[x].name)} vs ${esc(ctx.clientBySlug[y].name)}</a></li>`).join('')
  const main = `<div class="wrap">
${crumbs(ctx, trail)}
<header class="page-head">
  <h1>Compare sizes</h1>
  <p class="lede">Choose two objects to see them side by side at their true relative size. Add a human for scale, or up to five objects in total.</p>
</header>
<form class="compare-form" action="/compare" method="get" data-compare-form>
  <div class="cf-row" data-pickers>
    <label class="cf-pick"><span>First object</span><select name="a">${optionList(ctx, a.slug)}</select></label>
    <button type="button" class="swap" data-swap aria-label="Swap the first and second objects" title="Swap"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 7h12l-3-3M17 17H5l3 3"/></svg></button>
    <label class="cf-pick"><span>Second object</span><select name="b">${optionList(ctx, b.slug)}</select></label>
  </div>
  <div class="cf-extra" data-extra></div>
  <div class="cf-options">
    <button type="button" class="btn btn-ghost" data-add hidden>+ Add another object</button>
    <input type="hidden" name="human" value="0">
    <label class="check"><input type="checkbox" name="human" value="1" checked data-human> Include a human for scale</label>
    <button class="btn" type="submit" data-submit>Compare</button>
  </div>
</form>
<div class="ad-slot" data-ad-slot="below-form" hidden></div>
<section class="compare-result" aria-labelledby="result-h" data-compare-result>
  <h2 id="result-h" data-result-title>${esc(a.name)} vs ${esc(b.name)}</h2>
  <ul class="sentences" data-sentences>${[compareSentence(b, a), compareSentence(a, human), compareSentence(b, human)].map(s => `<li>${esc(s)}</li>`).join('')}</ul>
  <div data-result-viz>${vizFigure(ctx, lineup, { id: 'cmp' })}</div>
  <div data-result-zoom></div>
  <div data-result-ladder></div>
</section>
<div class="ad-slot" data-ad-slot="below-visualization" hidden></div>
<section class="section" aria-labelledby="pop-h">
  <h2 id="pop-h">Popular comparisons</h2>
  <ul class="link-list">${popular}</ul>
</section>
</div>`
  return layout(ctx, {
    path: '/compare',
    title: 'Compare Sizes Side by Side – True Scale Comparison Tool | Scale Explorer',
    description: 'Choose any two objects, from a human to the planet Earth, and see them side by side at their true relative size, with a person for scale.',
    active: 'compare', main,
    jsonld: [{ '@context': 'https://schema.org', '@type': 'WebApplication', name: 'Scale Explorer size comparison', url: `${ctx.site.url}/compare`, applicationCategory: 'EducationalApplication', operatingSystem: 'Any', isAccessibleForFree: true, offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } }, breadcrumbLd(ctx, trail)],
  })
}

export function measurePage(ctx) {
  const trail = [['/', 'Home'], ['/measure', 'Custom size']]
  const examples = ['1.8 m', '100 ft', '150 m', '1 km', '1 mi', '10 km', '100 mi']
  const main = `<div class="wrap">
${crumbs(ctx, trail)}
<header class="page-head">
  <h1>What does your size look like?</h1>
  <p class="lede">Enter a measurement in meters, feet, kilometers or miles to see it drawn to scale next to familiar things, with exact unit conversions.</p>
</header>
<form class="measure-form" action="/measure" method="get" data-measure-form novalidate>
  <div class="mf-row">
    <label class="mf-field"><span>Size</span><input name="q" value="150" inputmode="decimal" autocomplete="off" spellcheck="false" aria-describedby="m-help m-error" data-measure-input></label>
    <label class="mf-field"><span>Unit</span><select name="unit" data-measure-unit><option value="m" selected>meters (m)</option><option value="ft">feet (ft)</option><option value="km">kilometers (km)</option><option value="mi">miles (mi)</option></select></label>
    <button class="btn" type="submit">Show me</button>
  </div>
  <fieldset class="mf-as"><legend>Show it as</legend>
    <label class="check"><input type="radio" name="as" value="height" checked> a height</label>
    <label class="check"><input type="radio" name="as" value="length"> a length</label>
  </fieldset>
  <p id="m-help" class="fine">You can also type the unit, for example “492 ft”, “1.5 km” or “5 ft 10 in”.</p>
  <p id="m-error" class="form-error" role="alert" data-measure-error hidden></p>
  <p class="examples">Examples: ${examples.map(x => `<a href="/measure?q=${encodeURIComponent(x)}" data-example="${esc(x)}">${esc(x)}</a>`).join(' ')}</p>
</form>
<section class="measure-result" aria-live="polite" data-measure-result>
  <noscript><p>Turn on JavaScript to draw your own size. Everything is calculated in your browser; nothing is sent anywhere.</p></noscript>
</section>
<div class="ad-slot" data-ad-slot="below-visualization" hidden></div>
</div>`
  return layout(ctx, {
    path: '/measure',
    title: 'How Big Is 150 Meters? Visualize Any Size to Scale | Scale Explorer',
    description: 'Type any length in meters, feet, kilometers or miles and see what it looks like next to a person, a bus, the Eiffel Tower and more. Exact unit conversions included.',
    active: 'measure', main,
    jsonld: [{ '@context': 'https://schema.org', '@type': 'WebApplication', name: 'Scale Explorer custom size visualizer', url: `${ctx.site.url}/measure`, applicationCategory: 'EducationalApplication', operatingSystem: 'Any', isAccessibleForFree: true, offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } }, breadcrumbLd(ctx, trail)],
  })
}

export function searchPage(ctx) {
  const main = `<div class="wrap">
<header class="page-head">
  <h1>Search</h1>
</header>
${searchBox('page-search', { big: true })}
<section class="search-page-results" aria-live="polite" data-search-page>
  <p>Type what you want to compare, for example “whale”, “tower” or “rocket”.</p>
  <h2>All objects</h2>
  <ul class="card-grid">${ctx.clientObjects.map(o => objectCard(o, { showCategory: true, ctx })).join('')}</ul>
</section>
</div>`
  return layout(ctx, {
    path: '/search', title: 'Search | Scale Explorer', description: 'Search Scale Explorer for animals, vehicles, buildings, natural wonders and space objects drawn to scale.',
    active: 'search', main, noindex: true,
  })
}

export function objectsIndexPage(ctx) {
  const trail = [['/', 'Home'], ['/objects', 'All objects']]
  const sections = ctx.categories.map(c => {
    const list = ctx.clientObjects.filter(o => o.category === c.slug).sort((a, b) => sizeOf(a) - sizeOf(b))
    return `<section class="section" aria-labelledby="idx-${c.slug}">
  <div class="section-head"><h2 id="idx-${c.slug}">${esc(c.name)}</h2><a class="more" href="/category/${c.slug}">See ${esc(c.name.toLowerCase())} to scale →</a></div>
  <div class="table-wrap"><table class="index-table"><thead><tr><th scope="col">Object</th><th scope="col">Main measurement</th><th scope="col">Metric</th><th scope="col">Imperial</th></tr></thead><tbody>
  ${list.map(o => `<tr><th scope="row"><a href="/objects/${esc(o.slug)}">${esc(o.name)}</a></th><td>${esc(cap(headlineLabel(o)))}</td><td>${esc(headlineText(o, 'metric'))}</td><td>${esc(headlineText(o, 'imperial'))}</td></tr>`).join('')}
  </tbody></table></div>
</section>`
  }).join('')
  const main = `<div class="wrap">
${crumbs(ctx, trail)}
<header class="page-head">
  <h1>All objects</h1>
  <p class="lede">Every object in Scale Explorer with its main measurement. Each page has the full dimensions, sources and a drawing to scale.</p>
</header>
${sections}
</div>`
  return layout(ctx, {
    path: '/objects', title: `All ${ctx.clientObjects.length} Objects and Their Sizes | Scale Explorer`,
    description: `The size of ${ctx.clientObjects.length} animals, vehicles, buildings, structures, natural wonders and space objects, with sourced measurements in metric and imperial units.`,
    active: 'objects', main, jsonld: [breadcrumbLd(ctx, trail)],
  })
}

export function aboutPage(ctx) {
  const trail = [['/', 'Home'], ['/about', 'About']]
  const publishers = [...new Set(ctx.objects.flatMap(o => o.sources.map(s => s.publisher)))].sort((a, b) => a.localeCompare(b))
  const main = `<div class="wrap narrow">
${crumbs(ctx, trail)}
<header class="page-head">
  <h1>About Scale Explorer</h1>
  <p class="lede">Scale Explorer shows how big real things are by drawing them side by side at their true relative size.</p>
</header>
<section aria-labelledby="a1"><h2 id="a1">Where the numbers come from</h2>
<p>Every measurement is taken from a published source and cited on the object’s page, with the date it was checked. We prefer primary sources: space agencies, national parks and zoos, government transport agencies, manufacturers and the official sites of landmarks. Figures are stored exactly as the source states them, in the source’s own unit, and converted only when shown.</p>
<p>Many things do not have one true size. Animals vary, vehicles come in versions, and some figures are estimates. Where a source gives a range, we keep the range instead of picking one number, and approximate figures are labelled as approximate.</p>
<p>Sources used across the site: ${esc(publishers.join(', '))}.</p>
</section>
<section aria-labelledby="a2"><h2 id="a2">How to read the drawings</h2>
<ul>
<li>Objects in one drawing share one scale and stand on the same ground line. The scale bar and the grid show real distances.</li>
<li>Silhouettes are simplified outlines. The measured dimension (for example the length of a whale or the height of a tower) is exactly to scale; small details of the outline are illustrative.</li>
<li>When a size is a range, the solid shape shows the low end and a faded outline shows the high end.</li>
<li>When something is too small to see next to a much larger object, it is marked with ▲ and shown again in a zoomed-in view or a step-by-step zoom. Every zoomed view says that it uses a different scale.</li>
<li>No perspective or 3D tricks are used: everything is a flat side view.</li>
</ul></section>
<section aria-labelledby="a3"><h2 id="a3">Units</h2>
<p>Conversions use the exact international definitions: 1 foot = 0.3048 m, 1 mile = 1,609.344 m, 1 pound = 0.45359237 kg. Converted figures are rounded to the precision of the original source, so they never look more precise than the measurement they come from.</p></section>
<section aria-labelledby="a4"><h2 id="a4">Privacy</h2>
<p>There are no accounts, no cookies, no analytics and no tracking. All searching, comparing and drawing happens in your browser. The only thing stored is your choice of meters or feet, kept in your browser’s local storage.</p></section>
<section aria-labelledby="a5"><h2 id="a5">Corrections</h2>
<p>Found a figure that is wrong or out of date? Please open an issue on <a href="${esc(ctx.site.repo)}/issues">GitHub</a> with a link to a better source.</p></section>
</div>`
  return layout(ctx, {
    path: '/about', title: 'About the Data and Drawings | Scale Explorer',
    description: 'How Scale Explorer sources its measurements, draws objects to scale, handles size ranges and converts units.',
    active: 'about', main, jsonld: [breadcrumbLd(ctx, trail)],
  })
}

export function notFoundPage(ctx) {
  const main = `<div class="wrap narrow">
<header class="page-head">
  <h1>Page not found</h1>
  <p class="lede">That page does not exist. Search for an object or browse a category instead.</p>
</header>
${searchBox('nf-search', { big: true })}
<ul class="link-list">${ctx.categories.map(c => `<li><a href="/category/${c.slug}">${esc(c.name)}</a></li>`).join('')}</ul>
</div>`
  return layout(ctx, { path: '/404', title: 'Page Not Found | Scale Explorer', description: 'This page could not be found. Search Scale Explorer or browse animals, vehicles, buildings, structures, nature and space.', active: 'notfound', main, noindex: true })
}
