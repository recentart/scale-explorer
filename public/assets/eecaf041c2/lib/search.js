// Local search over the object list: exact, prefix, word-prefix, substring and
// typo-tolerant matches on names, aliases and categories. Runs instantly in the
// browser; no network requests.

export function normalize(s) {
  return String(s ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

// Optimal string alignment distance (Levenshtein plus adjacent swaps), capped.
export function editDistance(a, b, cap = 3) {
  if (Math.abs(a.length - b.length) > cap) return cap + 1
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    let rowMin = Infinity
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let v = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, d[i - 2][j - 2] + 1)
      d[i][j] = v
      if (v < rowMin) rowMin = v
    }
    if (rowMin > cap) return cap + 1
  }
  return d[a.length][b.length]
}

function allowedTypos(word) {
  return word.length >= 7 ? 2 : word.length >= 4 ? 1 : 0
}

// Builds the searchable terms for each object once.
export function buildIndex(objects, categories = []) {
  const catName = Object.fromEntries(categories.map(c => [c.slug, [c.name, c.singular || ''].map(normalize)]))
  return objects.map(o => {
    const terms = [o.name, o.subtitle, o.scientificName, ...(o.aliases || []), o.slug.replace(/-/g, ' ')]
      .filter(Boolean).map(normalize).filter(Boolean)
    const words = [...new Set(terms.flatMap(t => t.split(' ')))]
    return { obj: o, terms, words, cats: catName[o.category] || [normalize(o.category)] }
  })
}

function scoreEntry(q, qWords, e) {
  let best = 0
  for (const t of e.terms) {
    if (t === q) best = Math.max(best, 100)
    else if (t.startsWith(q)) best = Math.max(best, 90)
    else if (t.includes(' ' + q)) best = Math.max(best, 78)
    else if (q.length >= 3 && t.includes(q)) best = Math.max(best, 62)
  }
  if (best >= 62) return best
  // Every query word matches some word of the object (prefix or small typo).
  let total = 0
  for (const qw of qWords) {
    let w = 0
    for (const word of e.words) {
      if (word === qw) { w = 30; break }
      if (word.startsWith(qw) && qw.length >= 2) w = Math.max(w, 26)
      else if (qw.length >= 3 && word.includes(qw)) w = Math.max(w, 18)
      else {
        const allowed = allowedTypos(qw)
        if (allowed) {
          const dist = editDistance(qw, word.slice(0, Math.max(qw.length, Math.min(word.length, qw.length + 1))), allowed)
          const full = editDistance(qw, word, allowed)
          const dd = Math.min(dist, full)
          if (dd <= allowed) w = Math.max(w, 22 - dd * 6)
        }
      }
    }
    if (!w) { total = 0; break }
    total += w
  }
  if (total) best = Math.max(best, Math.min(70, 30 + total / qWords.length))
  // Category words ("animals", "space") list that category.
  for (const c of e.cats) {
    if (!c) continue
    if (c === q || (q.length >= 3 && c.startsWith(q))) best = Math.max(best, 40)
    else if (q.length >= 5 && editDistance(q, c, 1) <= 1) best = Math.max(best, 30)
  }
  return best
}

export function search(query, index, limit = 8) {
  const q = normalize(query)
  if (!q) return []
  const qWords = q.split(' ')
  return index
    .map(e => ({ obj: e.obj, score: scoreEntry(q, qWords, e) }))
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score || a.obj.name.localeCompare(b.obj.name))
    .slice(0, limit)
}
