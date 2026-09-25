// End-to-end browser tests. Drives headless Chrome over the DevTools protocol
// (no npm dependencies; needs Node 22+ for the global WebSocket).
//
//   node tools/e2e.mjs                 builds nothing; serves ./public locally
//   BASE_URL=https://… node tools/e2e.mjs   tests a deployed site instead
//
// Screenshots go to .e2e/ (git-ignored). Exits non-zero on any failure.

import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { startServer } from './serve.mjs'
import { launchChrome, sleep } from './cdp.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SHOTS = path.join(ROOT, '.e2e')

let server = null
let BASE = process.env.BASE_URL?.replace(/\/$/, '')
if (!BASE) {
  server = await startServer(8799)
  BASE = 'http://127.0.0.1:8799'
}

const chrome = await launchChrome()
const { send, listeners } = chrome

const problems = []   // console errors, exceptions, CSP violations
const requests = []
listeners.add(m => {
  if (m.method === 'Runtime.exceptionThrown') problems.push(`exception: ${m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text}`)
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') problems.push(`console.error: ${m.params.args.map(a => a.value ?? a.description).join(' ')}`)
  if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') problems.push(`log: ${m.params.entry.text} ${m.params.entry.url || ''}`)
  if (m.method === 'Network.requestWillBeSent') requests.push(m.params.request.url)
})
await send('Page.enable')
await send('Runtime.enable')
await send('Log.enable')
await send('Network.enable')

async function viewport(width, height, mobile = false) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile })
  await send('Emulation.setTouchEmulationEnabled', { enabled: mobile })
}

const evaluate = chrome.evaluate

const settle = () => evaluate('new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 30))))')

async function goto(urlPath) {
  const loaded = new Promise(res => {
    const l = m => { if (m.method === 'Page.loadEventFired') { listeners.delete(l); res() } }
    listeners.add(l)
  })
  const nav = await send('Page.navigate', { url: BASE + urlPath })
  if (nav.errorText) throw new Error(`navigate ${urlPath}: ${nav.errorText}`)
  await loaded
  await settle()
}

async function screenshot(name) {
  await mkdir(SHOTS, { recursive: true })
  const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  await writeFile(path.join(SHOTS, `${name}.png`), Buffer.from(data, 'base64'))
}

async function fullScreenshot(name) {
  await mkdir(SHOTS, { recursive: true })
  const h = await evaluate('Math.min(document.documentElement.scrollHeight, 8000)')
  const w = await evaluate('window.innerWidth')
  const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: w, height: h, scale: 1 } })
  await writeFile(path.join(SHOTS, `${name}.png`), Buffer.from(data, 'base64'))
}

async function type(selector, text) {
  await evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); el.focus(); el.value = ''; })()`)
  await send('Input.insertText', { text })
  await evaluate(`document.querySelector(${JSON.stringify(selector)}).dispatchEvent(new Event('input', { bubbles: true }))`)
  await settle()
}

async function key(k, code = k, keyCode) {
  const codes = { ArrowDown: 40, ArrowUp: 38, Enter: 13, Escape: 27, ArrowRight: 39, ArrowLeft: 37 }
  const kc = keyCode ?? codes[k]
  await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: k, code, windowsVirtualKeyCode: kc, nativeVirtualKeyCode: kc })
  if (k === 'Enter') await send('Input.dispatchKeyEvent', { type: 'char', key: k, text: '\r', windowsVirtualKeyCode: 13 })
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: kc, nativeVirtualKeyCode: kc })
  await settle()
}

async function waitFor(expr, timeout = 4000) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeout) {
    if (await evaluate(expr)) return true
    await sleep(40)
  }
  throw new Error(`timed out waiting for: ${expr}`)
}

// ---------------------------------------------------------------------------
// Test runner

const results = []
async function check(name, fn) {
  const before = problems.length
  try {
    await fn()
    const newProblems = problems.slice(before)
    if (newProblems.length) throw new Error(`browser reported: ${newProblems.join(' | ')}`)
    results.push({ name, ok: true })
    process.stdout.write(`  ✓ ${name}\n`)
  } catch (e) {
    results.push({ name, ok: false, error: e.message })
    process.stdout.write(`  ✗ ${name}\n      ${e.message.split('\n').join('\n      ')}\n`)
  }
}
const assert = (cond, msg) => { if (!cond) throw new Error(msg) }

const noOverflow = () => evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1')

// ---------------------------------------------------------------------------

const clientData = await (async () => {
  await viewport(1280, 900)
  await goto('/')
  const src = await evaluate(`[...document.querySelectorAll('script[type=module]')].map(s => s.src)[0]`)
  const dataUrl = src.replace(/client\/app\.js$/, 'data.js')
  const text = await (await fetch(dataUrl)).text()
  const mod = await import('data:text/javascript;base64,' + Buffer.from(text).toString('base64'))
  return mod
})()
const OBJECTS = clientData.OBJECTS
const CATEGORIES = clientData.CATEGORIES
console.log(`Testing ${BASE} with ${OBJECTS.length} objects in ${CATEGORIES.length} categories`)

console.log('\nObject pages')
for (const o of OBJECTS) {
  await check(`object page /objects/${o.slug}`, async () => {
    await viewport(1280, 900)
    await goto(`/objects/${o.slug}`)
    const info = await evaluate(`(() => ({
      status: document.title,
      h1: document.querySelectorAll('h1').length,
      h1text: document.querySelector('h1')?.textContent,
      canonical: document.querySelector('link[rel=canonical]')?.href,
      svg: document.querySelectorAll('#viz-stage .stage-svg').length,
      drawn: document.querySelectorAll('#viz-stage .stage-svg [data-slug="${o.slug}"], #viz-stage .stage-svg .marker').length,
      width: document.querySelector('#viz-stage .stage-svg')?.getAttribute('width'),
      bad: /NaN|Infinity|undefined/.test(document.querySelector('main').innerHTML),
      sources: document.querySelectorAll('.sources li a[href^="http"]').length,
      rows: document.querySelectorAll('.dims tbody tr').length,
      ld: [...document.querySelectorAll('script[type="application/ld+json"]')].map(s => { try { JSON.parse(s.textContent); return true } catch { return false } }),
    }))()`)
    assert(info.h1 === 1, 'needs exactly one h1')
    assert(info.canonical === `${await evaluate('location.origin')}/objects/${o.slug}` || info.canonical.endsWith(`/objects/${o.slug}`), `canonical ${info.canonical}`)
    assert(info.svg === 1, 'drawing missing')
    assert(info.drawn >= 1, 'object not drawn')
    assert(Number(info.width) > 300, `drawing not redrawn at page width (${info.width})`)
    assert(!info.bad, 'NaN/undefined in page')
    assert(info.sources >= 1, 'no sources')
    assert(info.rows >= 1, 'no dimensions')
    assert(info.ld.length >= 2 && info.ld.every(Boolean), 'bad JSON-LD')
    if (await evaluate('!!document.querySelector("[data-ladder]")')) {
      await evaluate('document.querySelector("[data-ladder] [data-next]").click()')
      await settle()
      const vis = await evaluate('[...document.querySelectorAll(".ladder-step")].filter(s => !s.hidden).length')
      assert(vis === 1, 'ladder should show one step at a time')
      const step2 = await evaluate('Number(document.querySelector(".ladder-step:not([hidden]) svg")?.getAttribute("width"))')
      assert(step2 > 300, 'ladder step not drawn')
    }
  })
}

console.log('\nCategories and navigation')
for (const c of CATEGORIES) {
  await check(`category /category/${c.slug}`, async () => {
    await goto(`/category/${c.slug}`)
    const n = await evaluate(`document.querySelectorAll('.card-grid .card').length`)
    const expected = OBJECTS.filter(o => o.category === c.slug).length
    assert(n === expected, `${n} cards, expected ${expected}`)
    const drawn = await evaluate(`document.querySelectorAll('#viz-stage .stage-svg .obj, #viz-stage .stage-svg .marker').length`)
    assert(drawn === expected, `drawing shows ${drawn} of ${expected}`)
    const zoomNeeded = await evaluate(`document.querySelectorAll('#viz-stage .stage-svg .marker').length > 0`)
    if (zoomNeeded) assert(await evaluate(`document.querySelectorAll('.zoom-level').length > 0`), 'tiny objects but no zoomed view')
  })
}
await check('nav links reach category pages', async () => {
  await goto('/')
  const hrefs = await evaluate(`[...document.querySelectorAll('.site-nav a')].map(a => a.getAttribute('href'))`)
  assert(hrefs.length >= CATEGORIES.length + 3, 'nav incomplete')
  await evaluate(`document.querySelector('.site-nav a[href="/category/space"]').click()`)
  await waitFor(`location.pathname === '/category/space' && document.readyState === 'complete'`)
  await settle()
  assert(await evaluate(`document.querySelector('.site-nav a[aria-current=page]')?.getAttribute('href') === '/category/space'`), 'active nav item')
})
await check('object cards link to object pages', async () => {
  await goto('/category/animals')
  await evaluate(`document.querySelector('.card-grid .card-link').click()`)
  await waitFor(`location.pathname.startsWith('/objects/') && document.readyState === 'complete'`)
})
for (const p of ['/', '/objects', '/compare', '/measure', '/about', '/search']) {
  await check(`page ${p} renders`, async () => {
    await goto(p)
    assert(await evaluate(`document.querySelectorAll('h1').length === 1`), 'h1')
    assert(!(await evaluate(`/NaN|Infinity|undefined/.test(document.querySelector('main').innerHTML)`)), 'NaN in page')
  })
}
await check('unknown URL gives the 404 page', async () => {
  const res = await fetch(BASE + '/objects/not-a-thing')
  assert(res.status === 404, `status ${res.status}`)
  assert((await res.text()).includes('Page not found'), '404 content')
})
await check('clean URLs: /objects/blue-whale.html redirects', async () => {
  const res = await fetch(BASE + '/objects/blue-whale.html', { redirect: 'manual' })
  assert([301, 302, 307, 308].includes(res.status), `status ${res.status}`)
  const loc = res.headers.get('location')
  assert(loc && loc.replace(BASE, '').replace(/^https?:\/\/[^/]+/, '') === '/objects/blue-whale', `location ${loc}`)
})

console.log('\nSearch')
await check('header search suggests and navigates with the keyboard', async () => {
  await goto('/objects/human')
  await type('#site-search', 'whale')
  const first = await evaluate(`document.querySelector('#site-search-list [role=option] .opt-label')?.textContent`)
  assert(/blue whale/i.test(first), `first suggestion: ${first}`)
  assert(await evaluate(`document.querySelector('#site-search').getAttribute('aria-expanded') === 'true'`), 'aria-expanded')
  await key('ArrowDown')
  assert(await evaluate(`document.querySelector('#site-search').getAttribute('aria-activedescendant') === 'site-search-list-o0'`), 'active descendant')
  await key('Enter')
  await waitFor(`location.pathname === '/objects/blue-whale' && document.readyState === 'complete'`)
})
for (const [q, slug] of [['girafe', 'giraffe'], ['eifel', 'eiffel-tower'], ['space station', 'iss'], ['747', 'boeing-747'], ['saturn 5', 'saturn-v'], ['EVEREST', 'mount-everest']]) {
  await check(`search "${q}" finds ${slug}`, async () => {
    await goto('/')
    await type('#hero-search', q)
    const hrefs = await evaluate(`[...document.querySelectorAll('#hero-search-list [data-href]')].map(li => li.dataset.href)`)
    assert(hrefs[0] === `/objects/${slug}`, `got ${hrefs.join(', ')}`)
  })
}
await check('search offers a custom size for "150 m"', async () => {
  await goto('/')
  await type('#hero-search', '150 m')
  const href = await evaluate(`document.querySelector('#hero-search-list [data-href]')?.dataset.href`)
  assert(href === '/measure?q=150%20m', href)
})
await check('search with no match says so', async () => {
  await goto('/')
  await type('#hero-search', 'zzqqxx')
  assert(await evaluate(`!!document.querySelector('#hero-search-list .no-results')`), 'no-results message')
  await key('Escape')
  assert(await evaluate(`document.querySelector('#hero-search-list').hidden`), 'Escape closes')
})
await check('search results page', async () => {
  await goto('/search?q=tower')
  const n = await evaluate(`document.querySelectorAll('[data-search-page] .card').length`)
  assert(n >= 1, 'no results for tower')
  assert(await evaluate(`/result/.test(document.querySelector('[data-search-page] h2').textContent)`), 'heading')
  await goto('/search?q=%3Cscript%3Ealert(1)%3C%2Fscript%3E')
  assert(await evaluate(`!document.querySelector('[data-search-page] script') && /No objects match/.test(document.querySelector('[data-search-page]').textContent)`), 'escaped no-match')
})

console.log('\nCompare')
await check('compare from URL', async () => {
  await goto('/compare?items=blue-whale,boeing-747')
  assert(await evaluate(`document.querySelector('[data-result-title]').textContent === 'Blue whale vs Boeing 747'`), 'title')
  const slugs = await evaluate(`[...document.querySelectorAll('#cmp-stage .stage-svg .obj')].map(g => g.dataset.slug)`)
  assert(slugs.includes('blue-whale') && slugs.includes('boeing-747') && slugs.includes('human'), `drawn: ${slugs}`)
  const s = await evaluate(`document.querySelector('[data-sentences]').textContent`)
  assert(/times as long as/.test(s), `sentences: ${s}`)
})
await check('compare controls update drawing and URL', async () => {
  await goto('/compare?items=blue-whale,boeing-747')
  await evaluate(`(() => { const s = document.querySelector('select[name=b]'); s.value = 'titanic'; s.dispatchEvent(new Event('change')) })()`)
  await settle()
  assert(await evaluate(`location.search === '?items=blue-whale,titanic'`), 'URL after change: ' + await evaluate('location.search'))
  assert(await evaluate(`[...document.querySelectorAll('#cmp-stage .stage-svg .obj')].some(g => g.dataset.slug === 'titanic')`), 'titanic drawn')
  await evaluate(`document.querySelector('[data-swap]').click()`)
  await settle()
  assert(await evaluate(`location.search === '?items=titanic,blue-whale'`), 'swap')
  await evaluate(`document.querySelector('[data-human]').click()`)
  await settle()
  assert(await evaluate(`location.search.includes('human=0') && ![...document.querySelectorAll('#cmp-stage .stage-svg .obj')].some(g => g.dataset.slug === 'human')`), 'human removed')
  await evaluate(`document.querySelector('[data-add]').click()`)
  await settle()
  assert(await evaluate(`document.querySelectorAll('[data-extra] select').length === 1 && location.search.split(',').length === 3`), 'third object added')
  await evaluate(`document.querySelector('[data-extra] .remove').click()`)
  await settle()
  assert(await evaluate(`document.querySelectorAll('[data-extra] select').length === 0`), 'third object removed')
})
await check('compare falls back on bad URL input', async () => {
  await goto('/compare?items=nope,%3Cb%3E,,')
  assert(await evaluate(`document.querySelector('[data-result-title]').textContent.includes(' vs ')`), 'fallback comparison')
})
await check('extreme comparison: human vs Earth uses markers, zoom levels and a ladder', async () => {
  await goto('/compare?items=human,earth')
  assert(await evaluate(`document.querySelectorAll('#cmp-stage .stage-svg .marker').length >= 1`), 'marker for human')
  assert(await evaluate(`!/NaN|Infinity/.test(document.querySelector('#cmp').innerHTML)`), 'NaN')
  assert(await evaluate(`document.querySelectorAll('[data-result-zoom] .zoom-level').length >= 1`), 'zoom level')
  assert(await evaluate(`document.querySelectorAll('[data-result-ladder] .ladder-step').length >= 4`), 'ladder steps')
  const zoomText = await evaluate(`document.querySelector('.zoom-title').textContent`)
  assert(/Zoomed in [\d.,]+( million| billion)?×/.test(zoomText), `zoom label: ${zoomText}`)
})
await check('extreme comparison: ISS vs Mars', async () => {
  await goto('/compare?items=iss,mars')
  assert(await evaluate(`document.querySelectorAll('#cmp-stage .stage-svg .marker').length >= 1`), 'marker')
  assert(await evaluate(`document.querySelectorAll('[data-result-ladder] .ladder-step').length >= 2`), 'ladder')
})

await check('surprise me picks two different objects', async () => {
  await goto('/compare?surprise=1')
  const items = await evaluate(`new URLSearchParams(location.search).get('items')`)
  const parts = (items || '').split(',')
  assert(parts.length === 2 && parts[0] !== parts[1], `items: ${items}`)
  await evaluate(`document.querySelector('[data-surprise]').click()`)
  await settle()
  assert(await evaluate(`document.querySelectorAll('#cmp-stage .stage-svg .obj, #cmp-stage .stage-svg .marker').length >= 2`), 'drawn')
})
await check('compare yourself: your height joins the drawing', async () => {
  await goto(`/compare?you=${encodeURIComponent("5'10\"")}&items=giraffe&human=0`)
  assert(await evaluate(`!!document.querySelector('#cmp-stage .stage-svg [data-slug=you]')`), 'you drawn')
  assert(await evaluate(`/You/.test(document.querySelector('[data-result-title]').textContent)`), 'title')
  const sent = await evaluate(`document.querySelector('[data-sentences]').textContent`)
  assert(/you are|as you/.test(sent) && !/you is/.test(sent), 'sentence grammar: ' + sent)
  await evaluate(`(() => { const i = document.querySelector('[data-you]'); i.value = '12 m'; i.dispatchEvent(new Event('change')) })()`)
  await settle()
  assert(await evaluate(`!document.querySelector('[data-you-error]').hidden`), 'bad height error')
})
await check('how many fit cards and weight/volume views', async () => {
  await goto('/compare?items=blue-whale,human')
  assert(await evaluate(`document.querySelectorAll('[data-result-howmany] .fit-card').length >= 1`), 'fit cards')
  await evaluate(`document.querySelector('#cmp-tab-mass').click()`)
  await settle()
  assert(await evaluate(`document.querySelectorAll('#cmp-mass .bar-row').length >= 2`), 'weight bars')
  await evaluate(`document.querySelector('#cmp-tab-volume').click()`)
  await settle()
  assert(await evaluate(`!document.querySelector('#cmp-volume').hidden && document.querySelector('#cmp-volume').textContent.length > 10`), 'volume pane')
  await goto('/compare?items=earth,moon')
  await evaluate(`document.querySelector('#cmp-tab-volume').click()`)
  await settle()
  assert(await evaluate(`document.querySelectorAll('#cmp-volume .stage-svg .obj').length >= 2`), 'volume cubes for planets')
})
await check('extreme range: atom vs galaxy', async () => {
  await goto('/compare?items=hydrogen-atom,milky-way&human=1')
  assert(await evaluate(`!/NaN|Infinity/.test(document.querySelector('.compare-result').innerHTML)`), 'NaN')
  assert(await evaluate(`document.querySelectorAll('[data-result-zoom] .zoom-level').length >= 2`), 'zoom levels')
  assert(await evaluate(`document.querySelectorAll('[data-result-ladder] .ladder-step').length >= 8`), 'ladder')
})

console.log('\nCustom size and units')
await check('custom size: 150 m', async () => {
  await goto('/measure?q=150&unit=m')
  const conv = await evaluate(`[...document.querySelectorAll('.conv td')].map(td => td.textContent)`)
  assert(conv.join('|') === '150 m|492.126 ft|0.15 km|0.0932057 mi', `conversions: ${conv.join('|')}`)
  assert(await evaluate(`!!document.querySelector('#mviz-stage .stage-svg [data-slug=custom]')`), 'custom drawn')
  assert(await evaluate(`document.querySelectorAll('.measure-result .sentences li').length >= 3`), 'comparisons')
})
for (const [q, unit, expect] of [
  ['1', 'mi', ['1,609.34 m', '5,280 ft', '1.60934 km', '1 mi']],
  ['5280', 'ft', ['1,609.34 m', '5,280 ft', '1.60934 km', '1 mi']],
  ['10 km', 'm', ['10,000 m', '32,808.4 ft', '10 km', '6.21371 mi']],
  ['1,000 ft', 'm', ['304.8 m', '1,000 ft', '0.3048 km', '0.189394 mi']],
  ['5\'10"', 'm', ['1.778 m', '5.83333 ft', '0.001778 km', '0.0011048 mi']],
]) {
  await check(`unit conversion ${q} (${unit})`, async () => {
    await goto(`/measure?q=${encodeURIComponent(q)}&unit=${unit}`)
    const conv = await evaluate(`[...document.querySelectorAll('.conv td')].map(td => td.textContent)`)
    assert(conv.join('|') === expect.join('|'), `got ${conv.join('|')}`)
  })
}
for (const [q, msg] of [['', 'Enter a size'], ['abc', 'Enter a number'], ['-5', 'greater than zero'], ['0', 'greater than zero'], ['10 yards', 'not a supported unit'], ['1e20 km', 'larger than'], ['0.0000000001', 'smaller than 1 nanometre']]) {
  await check(`invalid custom size "${q}"`, async () => {
    await goto('/measure')
    await evaluate(`(() => { const i = document.querySelector('[data-measure-input]'); i.value = ${JSON.stringify(q)}; i.form.requestSubmit() })()`)
    await settle()
    const err = await evaluate(`document.querySelector('[data-measure-error]').hidden ? '' : document.querySelector('[data-measure-error]').textContent`)
    assert(err.includes(msg), `error: "${err}"`)
    assert(await evaluate(`document.querySelector('[data-measure-input]').getAttribute('aria-invalid') === 'true'`), 'aria-invalid')
    assert(await evaluate(`!document.querySelector('[data-measure-result] svg')`), 'stale drawing left')
  })
}
await check('huge custom size gets a zoom ladder', async () => {
  await goto('/measure?q=5000&unit=km')
  assert(await evaluate(`document.querySelectorAll('.measure-result .ladder-step').length >= 3`), 'ladder')
  assert(await evaluate(`!/NaN|Infinity/.test(document.querySelector('.measure-result').innerHTML)`), 'NaN')
})
await check('metre/foot toggle redraws labels and persists', async () => {
  await goto('/objects/eiffel-tower')
  await evaluate(`document.querySelector('.units button[data-system=metric]').click()`)
  await settle()
  const m = await evaluate(`document.querySelector('#viz-stage .stage-svg').textContent`)
  assert(/ m\b/.test(m) && !/ ft\b/.test(m), 'metric labels')
  await evaluate(`document.querySelector('.units button[data-system=imperial]').click()`)
  await settle()
  const ft = await evaluate(`document.querySelector('#viz-stage .stage-svg').textContent`)
  assert(/ ft\b/.test(ft), 'imperial labels: ' + ft.slice(0, 200))
  await goto('/objects/titanic')
  assert(await evaluate(`document.querySelector('.units button[data-system=imperial]').getAttribute('aria-pressed') === 'true'`), 'persisted')
  await evaluate(`document.querySelector('.units button[data-system=metric]').click()`)
})
await check('chips toggle objects in a drawing', async () => {
  await goto('/objects/blue-whale')
  const before = await evaluate(`document.querySelectorAll('#viz-stage .stage-svg .obj, #viz-stage .stage-svg .marker').length`)
  await evaluate(`document.querySelector('#viz .viz-chips input').click()`)
  await settle()
  const after = await evaluate(`document.querySelectorAll('#viz-stage .stage-svg .obj, #viz-stage .stage-svg .marker').length`)
  assert(after === before - 1, `${before} -> ${after}`)
})
await check('bars view', async () => {
  await goto('/objects/blue-whale')
  await evaluate(`document.querySelector('#viz-tab-bars').click()`)
  await settle()
  assert(await evaluate(`!document.querySelector('#viz-bars').hidden && document.querySelectorAll('#viz-bars .bar-row').length >= 2`), 'bars shown')
  assert(await evaluate(`document.querySelector('#viz-stage').hidden`), 'stage hidden')
})

console.log('\nLayouts')
const layoutPages = ['/', '/objects/blue-whale', '/objects/earth', '/objects/burj-khalifa', '/category/space', '/compare?items=titanic,cruise-ship', '/measure?q=150&unit=m', '/objects', '/about']
for (const [name, w, h, mobile] of [['mobile', 375, 812, true], ['small', 320, 640, true], ['tablet', 768, 1024, true], ['desktop', 1366, 900, false]]) {
  await check(`${name} layout (${w}px) has no horizontal scrolling`, async () => {
    await viewport(w, h, mobile)
    for (const p of layoutPages) {
      await goto(p)
      assert(await noOverflow(), `${p} overflows: ${await evaluate('document.documentElement.scrollWidth')}px`)
      const svgW = await evaluate(`Math.max(0, ...[...document.querySelectorAll('.viz .stage-svg')].filter(s => s.getBoundingClientRect().width > 0).map(s => s.getBoundingClientRect().right))`)
      assert(svgW <= w + 1, `${p} drawing wider than screen`)
    }
  })
}
for (const [name, w, h, mobile] of [['mobile', 375, 812, true], ['desktop', 1366, 900, false]]) {
  await viewport(w, h, mobile)
  for (const p of ['/', '/objects/blue-whale', '/objects/earth', '/compare?items=eiffel-tower,burj-khalifa', '/measure?q=150&unit=m', '/category/space']) {
    await goto(p)
    await fullScreenshot(`${name}${p.replace(/[/?=&,]+/g, '_')}`)
  }
}
await viewport(1280, 900)

console.log('\nPrivacy and locality')
await check('all requests stay on this site (no tracking, APIs or CDNs)', async () => {
  const origin = new URL(BASE).origin
  const external = [...new Set(requests.filter(u => /^https?:/.test(u) && !u.startsWith(origin)))]
  assert(!external.length, `external requests: ${external.join(', ')}`)
})
await check('calculations run in the browser with the network off', async () => {
  await goto('/measure?q=150&unit=m')
  await send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 })
  await evaluate(`(() => { const i = document.querySelector('[data-measure-input]'); i.value = '3 mi'; i.form.requestSubmit() })()`)
  await settle()
  const conv = await evaluate(`[...document.querySelectorAll('.conv td')].map(td => td.textContent).join('|')`)
  assert(conv === '4,828.03 m|15,840 ft|4.82803 km|3 mi', conv)
  await send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 })
})

// ---------------------------------------------------------------------------

const failed = results.filter(r => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} browser checks passed${failed.length ? `; ${failed.length} failed` : ''}. Screenshots in .e2e/`)
await chrome.close()
server?.close()
process.exit(failed.length ? 1 : 0)
