// Contact sheet of every silhouette, for checking shapes after editing them.
//   node tools/shapes-sheet.mjs [key ...] [--out=file.png]   -> .e2e/shapes.png by default
// Each shape is shown large and small on light and dark tiles, with its tight
// box dashed and the measured extents (refX red, refY blue) drawn in.

import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { SHAPES } from '../src/lib/silhouettes.js'
import { launchChrome } from './cdp.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const outArg = args.find(a => a.startsWith('--out='))
const keys = args.filter(a => !a.startsWith('--')).length ? args.filter(a => !a.startsWith('--')) : Object.keys(SHAPES)
const missing = keys.filter(k => !SHAPES[k])
if (missing.length) { console.error(`Unknown shapes: ${missing.join(', ')}`); process.exit(1) }

function svg(s, targetH, targetW) {
  const k = Math.min(targetH / s.h, targetW / s.w)
  const W = s.w * k, H = s.h * k
  const refX = s.refX ?? s.w, refY = s.refY ?? s.h
  const paths = s.layers.map(l => `<path d="${l.d}" fill="${l.fill}"${l.opacity != null ? ` fill-opacity="${l.opacity}"` : ''}${l.rule ? ` fill-rule="${l.rule}"` : ''} stroke="rgba(20,22,28,.42)" stroke-width="1" vector-effect="non-scaling-stroke"/>`).join('')
  const yRef = s.below ? `M${s.w + 0.5} 0 V${refY}` : `M${s.w + 0.5} ${s.h} V${s.h - refY}`
  return `<svg width="${W + 8}" height="${H + 4}" viewBox="-1 -1 ${s.w + 4} ${s.h + 2}" preserveAspectRatio="xMinYMin meet">
    <rect x="0" y="0" width="${s.w}" height="${s.h}" fill="none" stroke="#999" stroke-dasharray="3 3" vector-effect="non-scaling-stroke"/>
    ${paths}
    <path d="M0 ${s.below ? 0 : s.h + 0.5} H${refX}" stroke="#e11" stroke-width="2" vector-effect="non-scaling-stroke"/>
    <path d="${yRef}" stroke="#15f" stroke-width="2" vector-effect="non-scaling-stroke"/>
  </svg>`
}

const tiles = keys.map(key => {
  const s = SHAPES[key]
  const big = svg(s, 230, 330)
  const small = svg(s, 24, 200)
  return `<div class="t"><div class="k">${key} <span>${s.w}×${s.h} refX ${s.refX ?? '-'} refY ${s.refY ?? '-'}</span></div>
    <div class="row"><div class="light">${big}${small}</div><div class="dark">${big}${small}</div></div></div>`
}).join('')

const html = `<!doctype html><meta charset="utf-8"><style>
body{margin:10px;font:12px system-ui;background:#fff}
.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}
.k{font-weight:700;margin-bottom:2px}.k span{font-weight:400;color:#666}
.row{display:flex;gap:6px}.light,.dark{flex:1;padding:6px;display:flex;align-items:flex-end;gap:10px;min-height:250px;overflow:hidden}
.light{background:#fbfaf6}.dark{background:#12161e}
</style><div class="grid">${tiles}</div>`

const chrome = await launchChrome({ port: 9400 + (process.pid % 500) })
await chrome.send('Page.enable')
const rows = Math.ceil(keys.length / 2)
const height = rows * 290 + 30
await chrome.send('Emulation.setDeviceMetricsOverride', { width: 1500, height, deviceScaleFactor: 1, mobile: false })
const { frameTree } = await chrome.send('Page.getFrameTree')
await chrome.send('Page.setDocumentContent', { frameId: frameTree.frame.id, html })
await chrome.evaluate('new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))')
const { data } = await chrome.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 1500, height, scale: 1 } })
const out = outArg ? path.resolve(outArg.slice(6)) : path.join(ROOT, '.e2e', 'shapes.png')
await mkdir(path.dirname(out), { recursive: true })
await writeFile(out, Buffer.from(data, 'base64'))
await chrome.close()
console.log(`Wrote ${out} (${keys.length} shapes)`)
