// Loads the dataset from data/ and validates it. The build refuses to run on
// invalid data, so a typo in one object file cannot ship a broken page.

import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const QUALIFIERS = ['exact', 'about', 'typical', 'average', 'up to', 'at least', 'range']

export async function loadData(root) {
  const read = async p => JSON.parse(await readFile(path.join(root, p), 'utf8'))
  const site = await read('data/site.json')
  const categories = await read('data/categories.json')
  const dir = path.join(root, 'data/objects')
  const files = (await readdir(dir)).filter(f => f.endsWith('.json')).sort()
  const objects = []
  for (const f of files) {
    const o = JSON.parse(await readFile(path.join(dir, f), 'utf8'))
    o._file = f
    objects.push(o)
  }
  const { UNITS } = await import(pathToFileURL(path.join(root, 'src/lib/units.js')).href)
  const { SHAPES } = await import(pathToFileURL(path.join(root, 'src/lib/silhouettes.js')).href)
  const errors = validate({ site, categories, objects, UNITS, SHAPES })
  if (errors.length) {
    const err = new Error(`Data validation failed:\n  - ${errors.join('\n  - ')}`)
    err.errors = errors
    throw err
  }
  // Category order first, then file order within the category.
  const catIndex = Object.fromEntries(categories.map((c, i) => [c.slug, i]))
  objects.sort((a, b) => catIndex[a.category] - catIndex[b.category] || a.name.localeCompare(b.name))
  return { site, categories, objects }
}

export function validate({ site, categories, objects, UNITS, SHAPES }) {
  const errors = []
  const e = (o, msg) => errors.push(`${o?.slug || o?._file || '?'}: ${msg}`)
  for (const key of ['name', 'tagline', 'url', 'description', 'updated']) {
    if (!site[key]) errors.push(`site.json: missing ${key}`)
  }
  if (site.url && (!/^https:\/\//.test(site.url) || site.url.endsWith('/'))) errors.push('site.json: url must be https and have no trailing slash')

  const catSlugs = new Set()
  for (const c of categories) {
    if (!/^[a-z-]+$/.test(c.slug || '')) errors.push(`categories.json: bad slug ${c.slug}`)
    if (!c.name || !c.description || !c.singular) errors.push(`categories.json: ${c.slug} needs name, singular, description`)
    catSlugs.add(c.slug)
  }

  const slugs = new Set(objects.map(o => o.slug))
  const seen = new Set()
  for (const o of objects) {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(o.slug || '')) e(o, 'slug must be lowercase words joined by hyphens')
    if (o._file !== `${o.slug}.json`) e(o, `file name should be ${o.slug}.json`)
    if (seen.has(o.slug)) e(o, 'duplicate slug')
    seen.add(o.slug)
    for (const key of ['name', 'phrase', 'description', 'category', 'headline']) {
      if (typeof o[key] !== 'string' || !o[key].trim()) e(o, `missing ${key}`)
    }
    if (o.category && !catSlugs.has(o.category)) e(o, `unknown category ${o.category}`)
    if (typeof o.familiar !== 'boolean') e(o, 'familiar must be true or false')
    if (o.description && (o.description.length < 60 || o.description.length > 1500)) e(o, 'description should be 60-1500 characters')
    if (!Array.isArray(o.aliases)) e(o, 'aliases must be an array')

    const sources = new Map()
    if (!Array.isArray(o.sources) || !o.sources.length) e(o, 'needs at least one source')
    for (const s of o.sources || []) {
      if (!s.id || sources.has(s.id)) e(o, `source id missing or duplicated: ${s.id}`)
      if (!/^https?:\/\/\S+$/.test(s.url || '')) e(o, `source ${s.id} needs a web url`)
      if (!s.publisher || !s.title) e(o, `source ${s.id} needs publisher and title`)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(s.accessed || '')) e(o, `source ${s.id} needs an accessed date (YYYY-MM-DD)`)
      sources.set(s.id, s)
    }

    const measures = new Map()
    if (!Array.isArray(o.measures) || !o.measures.length) e(o, 'needs measures')
    for (const m of o.measures || []) {
      const where = `measure ${m.key}`
      if (!m.key || measures.has(m.key)) e(o, `${where}: key missing or duplicated`)
      measures.set(m.key, m)
      if (!m.label) e(o, `${where}: missing label`)
      const unit = UNITS[m.unit]
      if (!unit) { e(o, `${where}: unknown unit ${m.unit}`); continue }
      if (m.kind && m.kind !== unit.kind) e(o, `${where}: kind ${m.kind} does not match unit ${m.unit}`)
      const nums = [m.value, m.min, m.max].filter(v => v != null)
      if (!nums.length) e(o, `${where}: needs value or min/max`)
      if (nums.some(v => typeof v !== 'number' || !(v > 0) || !Number.isFinite(v))) e(o, `${where}: numbers must be positive`)
      if (m.value != null && (m.min != null || m.max != null)) e(o, `${where}: use value or min/max, not both`)
      if (m.min != null && m.max != null && m.min > m.max) e(o, `${where}: min is larger than max`)
      if (m.min != null && m.max == null) e(o, `${where}: min without max`)
      if (!QUALIFIERS.includes(m.qualifier)) e(o, `${where}: qualifier must be one of ${QUALIFIERS.join(', ')}`)
      if (typeof m.approx !== 'boolean') e(o, `${where}: approx must be true or false`)
      const ids = Array.isArray(m.source) ? m.source : [m.source]
      if (!ids.length || ids.some(id => !sources.has(id))) e(o, `${where}: source "${ids.join(', ')}" is not listed`)
    }
    if (o.headline && !measures.has(o.headline)) e(o, `headline measure ${o.headline} not found`)
    if (o.headline && measures.has(o.headline) && UNITS[measures.get(o.headline).unit]?.kind !== 'length') e(o, 'headline must be a length')

    const p = o.profile || {}
    if (!SHAPES[p.shape]) e(o, `profile shape "${p.shape}" does not exist in silhouettes.js`)
    if (!p.x && !p.y) e(o, 'profile needs x or y')
    for (const axis of ['x', 'y']) {
      if (!p[axis]) continue
      const m = measures.get(p[axis])
      if (!m) e(o, `profile.${axis} measure ${p[axis]} not found`)
      else if (UNITS[m.unit]?.kind !== 'length') e(o, `profile.${axis} must be a length`)
    }
    for (const f of o.facts || []) {
      if (!f.text) e(o, 'fact without text')
      const fids = Array.isArray(f.source) ? f.source : [f.source]
      if (!fids.length || fids.some(id => !sources.has(id))) e(o, `fact source "${fids.join(', ')}" is not listed`)
    }
    for (const r of [...(o.related || []), ...(o.lineup || [])]) {
      if (!slugs.has(r)) e(o, `unknown related/lineup slug ${r}`)
      if (r === o.slug) e(o, 'lists itself as related')
    }
    if (o.wikipedia && !/^https:\/\/en\.wikipedia\.org\/wiki\//.test(o.wikipedia)) e(o, 'wikipedia must be an en.wikipedia.org/wiki URL')
  }
  if (!slugs.has('human')) errors.push('dataset needs a "human" object (used as the default reference)')
  for (const c of catSlugs) if (!objects.some(o => o.category === c)) errors.push(`category ${c} has no objects`)
  for (const key of ['popular', 'featured', 'heroLineup']) {
    for (const item of (site[key] || []).flat()) if (!slugs.has(item)) errors.push(`site.json ${key}: unknown slug ${item}`)
  }
  return errors
}

// The compact form shipped to the browser: what search and drawing need,
// without descriptions and sources (those are already in the page HTML).
export function toClient(o) {
  const measures = {}
  for (const m of o.measures) {
    const c = { label: m.label, unit: m.unit, approx: m.approx, qualifier: m.qualifier }
    if (m.value != null) c.value = m.value
    if (m.min != null) c.min = m.min
    if (m.max != null) c.max = m.max
    measures[m.key] = c
  }
  const out = {
    slug: o.slug, name: o.name, category: o.category, phrase: o.phrase,
    headline: o.headline, familiar: o.familiar, profile: o.profile, measures,
  }
  if (o.subtitle) out.subtitle = o.subtitle
  if (o.scientificName) out.scientificName = o.scientificName
  if (o.aliases?.length) out.aliases = o.aliases
  if (o.headlineAdj) out.headlineAdj = o.headlineAdj
  if (o.lineup?.length) out.lineup = o.lineup
  return out
}
