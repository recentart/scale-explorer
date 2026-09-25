import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { buildIndex, search, normalize, editDistance } from '../src/lib/search.js'
import { loadData, toClient } from '../build/data.mjs'

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const { objects, categories } = await loadData(root)
const index = buildIndex(objects.map(toClient), categories)
const top = q => search(q, index, 5).map(r => r.obj.slug)

test('normalize and edit distance', () => {
  assert.equal(normalize('  Éiffel-Tower! '), 'eiffel tower')
  assert.equal(editDistance('girafe', 'giraffe'), 1)
  assert.equal(editDistance('boing', 'boeing'), 1)
  assert.equal(editDistance('teh', 'the'), 1)
})

test('exact and prefix matches rank first', () => {
  assert.equal(top('blue whale')[0], 'blue-whale')
  assert.equal(top('Blue')[0], 'blue-whale')
  assert.equal(top('eiffel')[0], 'eiffel-tower')
  assert.equal(top('titanic')[0], 'titanic')
  assert.equal(top('747')[0], 'boeing-747')
  assert.equal(top('a380')[0], 'airbus-a380')
})

test('aliases and abbreviations', () => {
  assert.equal(top('iss')[0], 'iss')
  assert.equal(top('space station')[0], 'iss')
  assert.equal(top('everest')[0], 'mount-everest')
  assert.ok(top('skyscraper').includes('burj-khalifa'))
})

test('typos still find the object', () => {
  assert.equal(top('girafe')[0], 'giraffe')
  assert.equal(top('eifel tower')[0], 'eiffel-tower')
  assert.equal(top('boing 747')[0], 'boeing-747')
  assert.equal(top('elefant')[0], 'elephant')
  assert.equal(top('saturn 5')[0], 'saturn-v')
})

test('category words list the category', () => {
  const r = search('space', index, 20).map(x => x.obj)
  assert.ok(r.length >= 6)
  assert.ok(r.filter(o => o.category === 'space').length >= 6)
})

test('nonsense returns nothing', () => {
  assert.deepEqual(top('zzzzqqq'), [])
  assert.deepEqual(top(''), [])
  assert.deepEqual(top('   '), [])
})

test('every object can be found by its own name', () => {
  for (const o of objects) assert.equal(top(o.name)[0], o.slug, o.name)
})
