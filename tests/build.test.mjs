import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir, mkdtemp, rm, stat } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { build } from '../build/build.mjs'
import { loadData } from '../build/data.mjs'

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const out = await mkdtemp(path.join(os.tmpdir(), 'scale-explorer-'))
const result = await build({ outDir: out, quiet: true })
const { site, objects, categories } = await loadData(root)
const read = rel => readFile(path.join(out, rel), 'utf8')

async function walk(dir) {
  const files = []
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) files.push(...await walk(p))
    else files.push(p)
  }
  return files
}
const htmlFiles = (await walk(out)).filter(f => f.endsWith('.html'))
const one = (html, re) => { const m = html.match(re); return m ? m[1] : null }

test.after(() => rm(out, { recursive: true, force: true }))

test('one page per object and category', () => {
  assert.equal(result.objects, objects.length)
  assert.equal(result.categories, categories.length)
  assert.equal(htmlFiles.length, objects.length + categories.length + 7)
})

test('every page has a title, description, canonical URL, one h1 and Open Graph tags', async () => {
  const titles = new Set()
  for (const f of htmlFiles) {
    const html = await readFile(f, 'utf8')
    const rel = path.relative(out, f)
    const title = one(html, /<title>([^<]+)<\/title>/)
    assert.ok(title && title.length > 10, `${rel} title`)
    assert.ok(!titles.has(title), `${rel} duplicate title`)
    titles.add(title)
    const desc = one(html, /<meta name="description" content="([^"]+)">/)
    assert.ok(desc && desc.length >= 50, `${rel} description`)
    const canonical = one(html, /<link rel="canonical" href="([^"]+)">/)
    assert.ok(canonical?.startsWith(site.url), `${rel} canonical`)
    assert.equal((html.match(/<h1[\s>]/g) || []).length, 1, `${rel} h1 count`)
    for (const p of ['og:title', 'og:description', 'og:url', 'og:type', 'og:site_name']) assert.ok(html.includes(`property="${p}"`), `${rel} ${p}`)
    for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) JSON.parse(m[1])
    assert.ok(!/NaN|Infinity|undefined|\[object Object\]/.test(html.replace(/<script[\s\S]*?<\/script>/g, '')), `${rel} has NaN/undefined`)
    assert.ok(!/\sstyle="/.test(html), `${rel} has an inline style attribute (blocked by the CSP)`)
    assert.ok(!/<script>(?!\s*$)/.test(html), `${rel} has an inline script (blocked by the CSP)`)
  }
})

test('object pages carry the data, sources and a drawing', async () => {
  for (const o of objects) {
    const html = await read(`objects/${o.slug}.html`)
    assert.ok(html.includes(`<link rel="canonical" href="${site.url}/objects/${o.slug}">`))
    assert.ok(html.includes('class="stage-svg"'), `${o.slug} drawing`)
    assert.ok(html.includes(`data-slug="${o.slug}"`), `${o.slug} object in drawing`)
    for (const s of o.sources) assert.ok(html.includes(s.url.replace(/&/g, '&amp;')), `${o.slug} source ${s.id}`)
    assert.equal((html.match(/<tr>\s*<th scope="row">/g) || []).length, o.measures.length, `${o.slug} dimension rows`)
    const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => JSON.parse(m[1]))
    assert.ok(ld.some(j => j['@type'] === 'BreadcrumbList'))
    assert.ok(ld.some(j => j['@type'] === 'WebPage' && j.about?.name === o.name))
  }
})

test('internal links point at pages that exist', async () => {
  const exists = async rel => { try { await stat(path.join(out, rel)); return true } catch { return false } }
  const seen = new Set()
  for (const f of htmlFiles) {
    const html = await readFile(f, 'utf8')
    for (const m of html.matchAll(/href="(\/[^"#?]*)/g)) {
      const href = m[1]
      if (seen.has(href)) continue
      seen.add(href)
      const candidates = href === '/' ? ['index.html'] : [href.slice(1), `${href.slice(1)}.html`, `${href.slice(1)}/index.html`]
      let ok = false
      for (const c of candidates) if (await exists(c)) ok = true
      assert.ok(ok, `broken link ${href} in ${path.relative(out, f)}`)
    }
  }
})

test('sitemap, robots and headers', async () => {
  const sitemap = await read('sitemap.xml')
  for (const o of objects) assert.ok(sitemap.includes(`<loc>${site.url}/objects/${o.slug}</loc>`))
  for (const c of categories) assert.ok(sitemap.includes(`<loc>${site.url}/category/${c.slug}</loc>`))
  assert.ok(!sitemap.includes('/search'))
  const robots = await read('robots.txt')
  assert.ok(robots.includes(`Sitemap: ${site.url}/sitemap.xml`))
  const headers = await read('_headers')
  assert.ok(headers.includes('Content-Security-Policy'))
})

test('the build is deterministic', async () => {
  const out2 = await mkdtemp(path.join(os.tmpdir(), 'scale-explorer-'))
  try {
    await build({ outDir: out2, quiet: true })
    for (const f of htmlFiles) {
      const rel = path.relative(out, f)
      assert.equal(await readFile(path.join(out2, rel), 'utf8'), await readFile(f, 'utf8'), rel)
    }
  } finally {
    await rm(out2, { recursive: true, force: true })
  }
})
