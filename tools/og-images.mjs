// Renders the 1200x630 Open Graph share images into static/og/ with headless
// Chrome, using the same drawing code as the site. Run after changing data or
// silhouettes:  node tools/og-images.mjs   (then rebuild)

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadData, toClient } from '../build/data.mjs'
import { renderStage, esc, headlineText } from '../src/lib/render.js'
import { pickReferences, sizeOf } from '../src/lib/layout.js'
import { questionOf, LOGO } from '../build/templates.mjs'
import { launchChrome } from './cdp.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'static', 'og')
const W = 1200, H = 630

const { objects, site } = await loadData(ROOT)
const all = objects.map(toClient)
const by = Object.fromEntries(all.map(o => [o.slug, o]))
const css = await readFile(path.join(ROOT, 'src/styles/site.css'), 'utf8')

const cap = s => s.charAt(0).toUpperCase() + s.slice(1)

function card({ title, sub, lineup, highlight }) {
  const { svg } = renderStage(lineup, { width: 1080, maxHeight: 380, minHeight: 300, highlight, idPrefix: 'og' })
  return `<!doctype html><html><head><meta charset="utf-8"><style>${css}
    html, body { margin: 0; width: ${W}px; height: ${H}px; overflow: hidden; background: #f6f5f1; color-scheme: light; }
    :root { color-scheme: light; }
    .og { box-sizing: border-box; width: ${W}px; height: ${H}px; padding: 40px 60px 30px; display: flex; flex-direction: column; }
    .og-top { display: flex; align-items: center; justify-content: space-between; }
    .og-brand { display: flex; align-items: center; gap: 12px; font-weight: 780; font-size: 30px; color: #16181d; }
    .og-brand .logo { width: 40px; height: 40px; fill: #1c5dcf; }
    .og-tag { font-size: 22px; color: #676d7c; }
    .og h1 { font-size: 58px; margin: 18px 0 4px; color: #16181d; }
    .og p { font-size: 28px; margin: 0 0 8px; color: #454a55; }
    .og-stage { margin-top: auto; background: #fbfaf6; border: 1px solid #dedad0; border-radius: 16px; overflow: hidden; }
  </style></head><body><div class="og">
    <div class="og-top"><div class="og-brand">${LOGO}Scale Explorer</div><div class="og-tag">${esc(site.tagline)}</div></div>
    <h1>${esc(title)}</h1><p>${esc(sub)}</p>
    <div class="og-stage">${svg}</div>
  </div></body></html>`
}

const chrome = await launchChrome({ port: 9334 })
await chrome.send('Page.enable')
await chrome.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false })
await chrome.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] })
const { frameTree } = await chrome.send('Page.getFrameTree')

async function shoot(html, file) {
  await chrome.send('Page.setDocumentContent', { frameId: frameTree.frame.id, html })
  await chrome.evaluate('new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))')
  const { data } = await chrome.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: W, height: H, scale: 1 } })
  await writeFile(path.join(OUT, file), Buffer.from(data, 'base64'))
}

await mkdir(OUT, { recursive: true })
await shoot(card({ title: 'See how big things really are.', sub: 'Real measurements, drawn to scale.', lineup: site.heroLineup.map(s => by[s]) }), 'default.png')
for (const o of all) {
  const lineup = [...new Set([o.slug === 'human' ? null : by.human, ...pickReferences(o, all), o].filter(Boolean))].sort((a, b) => sizeOf(a) - sizeOf(b))
  const label = o.measures[o.headline].label
  await shoot(card({ title: cap(questionOf(o)), sub: `${label}: ${headlineText(o, 'metric')} (${headlineText(o, 'imperial')})`, lineup, highlight: o.slug }), `${o.slug}.png`)
}
await chrome.close()
console.log(`Wrote ${all.length + 1} share images to static/og/`)
