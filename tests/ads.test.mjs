import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, mkdtemp, rm, stat } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { build } from '../build/build.mjs'
import { adSettings, pickSize } from '../src/lib/ads.js'

export const TEST_ADSENSE = { network: 'adsense', client: 'ca-pub-0000000000000000', slots: { bottom: '1111111111', sidebar: '2222222222' } }

async function built(ads, fn) {
  const out = await mkdtemp(path.join(os.tmpdir(), 'scale-explorer-ads-'))
  try {
    await build({ outDir: out, quiet: true, ads })
    await fn(rel => readFile(path.join(out, rel), 'utf8'), rel => stat(path.join(out, rel)).then(() => true, () => false))
  } finally {
    await rm(out, { recursive: true, force: true })
  }
}

test('with ads off there is no ad markup, no ads.txt and the strict CSP stays', () => built(null, async (read, has) => {
  for (const rel of ['index.html', 'objects/blue-whale.html', 'compare.html', 'about.html']) {
    const html = await read(rel)
    assert.ok(!/class="ad[ "]|class="rail"|data-ad[=-]/.test(html), rel)
  }
  assert.ok((await read('about.html')).includes('no cookies, no analytics and no tracking'))
  assert.ok(!await has('ads.txt'))
  assert.match(await read('_headers'), /script-src 'self'; style-src 'self';/)
}))

test('with AdSense on: a labelled bottom banner on every page, a sidebar on object pages only', () => built(TEST_ADSENSE, async (read, has) => {
  for (const rel of ['index.html', 'objects/blue-whale.html', 'category/space.html', 'compare.html', 'measure.html', 'about.html', '404.html']) {
    const html = await read(rel)
    assert.equal((html.match(/data-ad="bottom"/g) || []).length, 1, rel)
    assert.equal((html.match(/data-ad="sidebar"/g) || []).length, rel.startsWith('objects/') ? 1 : 0, rel)
    assert.equal((html.match(/<p class="ad-label">Advertisement<\/p>/g) || []).length, rel.startsWith('objects/') ? 2 : 1, rel)
    assert.ok(html.includes('data-ad-client="ca-pub-0000000000000000"'), rel)
    assert.ok(html.includes('Ads are provided by Google AdSense'), rel)
    // the bottom banner sits after the page content, never inside it
    assert.ok(html.indexOf('data-ad="bottom"') > html.indexOf('</main>'), rel)
  }
  const blue = await read('objects/blue-whale.html')
  assert.ok(blue.indexOf('data-ad="sidebar"') > blue.indexOf('id="viz-h"'))
  assert.ok((await read('about.html')).includes('policies.google.com/technologies/ads'))
  assert.equal(await read('ads.txt'), 'google.com, pub-0000000000000000, DIRECT, f08c47fec0942fa0\n')
  assert.ok(await has('ads.txt'))
  assert.match(await read('_headers'), /script-src 'self' 'unsafe-inline' 'unsafe-eval' https:;/)
}))

test('ad settings are checked', () => {
  assert.equal(adSettings({ network: '', slots: {} }), null)
  assert.equal(adSettings(undefined), null)
  assert.deepEqual(adSettings(TEST_ADSENSE).slots, { bottom: { '728x90': '1111111111', '320x50': '1111111111' }, sidebar: { '300x250': '2222222222' } })
  assert.throws(() => adSettings({ ...TEST_ADSENSE, client: 'pub-123' }), /client/)
  assert.throws(() => adSettings({ ...TEST_ADSENSE, slots: { bottom: 'abc' } }), /ad unit id/)
  assert.throws(() => adSettings({ ...TEST_ADSENSE, slots: {} }), /no slots/)
  assert.throws(() => adSettings({ ...TEST_ADSENSE, slots: { popup: '1111111111' } }), /unknown slot/)
  assert.throws(() => adSettings({ network: 'popcash', slots: { bottom: '1' } }), /network/)
  const key = 'a'.repeat(32)
  const terra = adSettings({ network: 'adsterra', host: 'www.highperformanceformat.com', slots: { bottom: { '320x50': key } } })
  assert.deepEqual(terra.slots, { bottom: { '320x50': key } })
  assert.throws(() => adSettings({ network: 'adsterra', host: 'x.com', slots: { bottom: { '300x250': key } } }), /not used here/)
  assert.throws(() => adSettings({ network: 'adsterra', slots: { bottom: { '320x50': key } } }), /host/)
})

test('the banner size follows the slot width', () => {
  const units = { '728x90': '1', '320x50': '1' }
  assert.deepEqual(pickSize('bottom', units, 1000), [728, 90])
  assert.deepEqual(pickSize('bottom', units, 727), [320, 50])
  assert.equal(pickSize('bottom', units, 300), null)
  assert.deepEqual(pickSize('bottom', { '320x50': '1' }, 1000), [320, 50])
  assert.equal(pickSize('sidebar', { '300x250': '1' }, 299), null)
})
