// Local static server that behaves like the Cloudflare deployment:
// /objects/blue-whale serves objects/blue-whale.html, *.html URLs redirect to
// the clean URL, unknown paths get 404.html with status 404, and the headers
// from public/_headers (including the Content-Security-Policy) are applied.
// Usage: node tools/serve.mjs [port]

import http from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public')
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8',
}

async function isFile(p) {
  try { return (await stat(p)).isFile() } catch { return false }
}

async function loadHeaderRules() {
  let text = ''
  try { text = await readFile(path.join(ROOT, '_headers'), 'utf8') } catch { return [] }
  const rules = []
  let cur = null
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue
    if (!/^\s/.test(line)) { cur = { pattern: line.trim(), headers: [] }; rules.push(cur); continue }
    const i = line.indexOf(':')
    if (cur && i > 0) cur.headers.push([line.slice(0, i).trim(), line.slice(i + 1).trim()])
  }
  return rules.map(r => ({ ...r, re: new RegExp('^' + r.pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$') }))
}

export async function startServer(port = 8788) {
  const rules = await loadHeaderRules()
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost')
    let p = decodeURIComponent(url.pathname)
    if (p.includes('..')) { res.writeHead(400); return res.end() }
    const send = async (file, status = 200) => {
      const body = await readFile(file)
      const headers = { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' }
      for (const r of rules) if (r.re.test(p)) for (const [k, v] of r.headers) headers[k] = v
      res.writeHead(status, headers)
      res.end(req.method === 'HEAD' ? undefined : body)
    }
    if (p.endsWith('.html')) {
      const clean = p === '/index.html' ? '/' : p.slice(0, -5)
      res.writeHead(307, { Location: clean + url.search })
      return res.end()
    }
    const base = path.join(ROOT, p)
    if (p.endsWith('/')) {
      if (await isFile(path.join(base, 'index.html'))) return send(path.join(base, 'index.html'))
      if (p !== '/' && await isFile(base.replace(/[\\/]$/, '') + '.html')) {
        res.writeHead(307, { Location: p.slice(0, -1) + url.search })
        return res.end()
      }
    } else {
      if (await isFile(base)) return send(base)
      if (await isFile(base + '.html')) return send(base + '.html')
    }
    return send(path.join(ROOT, '404.html'), 404)
  })
  await new Promise(resolve => server.listen(port, '127.0.0.1', resolve))
  return server
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.argv[2]) || 8788
  await startServer(port)
  console.log(`Serving ${ROOT} at http://127.0.0.1:${port}`)
}
