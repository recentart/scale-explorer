import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadData, toClient } from '../build/data.mjs'
import { drawingBox, layoutStage, sizeOf, buildLadder, zoomLevels, pickReferences, shapeOf, niceFloor, niceCeil } from '../src/lib/layout.js'
import { renderStage, renderBars } from '../src/lib/render.js'
import { compareSentence, factorText, ratioRange } from '../src/lib/compare.js'
import { measureRange } from '../src/lib/measures.js'

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const { objects } = await loadData(root)
const all = objects.map(toClient)
const by = Object.fromEntries(all.map(o => [o.slug, o]))

test('drawing boxes match the sourced measurement exactly', () => {
  for (const o of all) {
    const shape = shapeOf(o.profile.shape)
    for (const end of ['lo', 'hi']) {
      const box = drawingBox(o, end)
      assert.ok(box.w > 0 && box.h > 0 && Number.isFinite(box.w) && Number.isFinite(box.h), o.slug)
      for (const axis of ['x', 'y']) {
        const key = o.profile[axis]
        if (!key) continue
        const r = measureRange(o.measures[key])
        const want = end === 'lo' ? r.lo : r.hi
        const ref = axis === 'x' ? (shape.refX ?? shape.w) : (shape.refY ?? shape.h)
        const got = (axis === 'x' ? box.sx : box.sy) * ref * (o.profile.circumference ? Math.PI : 1)
        assert.ok(Math.abs(got - want) < 1e-9 * want, `${o.slug} ${axis}: ${got} vs ${want}`)
      }
    }
  }
})

test('one stage uses one scale for every object', () => {
  const lineup = [by.human, by.elephant, by['blue-whale'], by['boeing-747']]
  const L = layoutStage(lineup, { width: 900, maxHeight: 400 })
  for (const it of L.items) {
    const box = drawingBox(it.obj, 'hi')
    assert.ok(Math.abs(it.hi.w - box.w * L.scale) < 1e-6)
    assert.ok(Math.abs(it.hi.h - box.h * L.scale) < 1e-6)
  }
  // Relative heights on screen equal relative heights in reality.
  const h = L.items.find(i => i.obj.slug === 'human')
  const e = L.items.find(i => i.obj.slug === 'elephant')
  assert.ok(Math.abs(e.hi.h / h.hi.h - drawingBox(by.elephant).h / drawingBox(by.human).h) < 1e-9)
})

test('stages fit their box at many widths', () => {
  const lineups = [
    [by.human, by.giraffe],
    [by.human, by['burj-khalifa']],
    [by.human, by['grand-canyon'], by['empire-state-building']],
    all.filter(o => o.category === 'vehicles'),
    all,
  ]
  for (const lineup of lineups) {
    for (const width of [320, 375, 768, 1180]) {
      const L = layoutStage(lineup, { width, maxHeight: 440 })
      assert.ok(Number.isFinite(L.scale) && L.scale > 0)
      for (const it of L.items) {
        assert.ok(it.slotX >= 0 && it.slotX + it.slotW <= width + 0.5, `${it.obj.slug} overflows at ${width}`)
        if (!it.tiny) {
          const top = it.below ? L.groundY : L.groundY - it.hi.h
          assert.ok(top >= -0.5, `${it.obj.slug} above top at ${width}`)
          if (it.below) assert.ok(L.groundY + it.hi.h <= L.height + 0.5)
        }
      }
    }
  }
})

test('extreme differences mark tiny objects instead of breaking', () => {
  const L = layoutStage([by.human, by.earth], { width: 375, maxHeight: 440 })
  const human = L.items.find(i => i.obj.slug === 'human')
  assert.equal(human.tiny, true)
  assert.ok(Number.isFinite(human.hi.h) && human.hi.h > 0)
  const { svg, tinyNames } = renderStage([by.human, by.iss, by.earth], { width: 375 })
  assert.ok(tinyNames.includes(by.human.name))
  assert.ok(tinyNames.includes(by.iss.name))
  assert.ok(!/NaN|Infinity|undefined/.test(svg))
})

test('zoom levels magnify what the first view cannot show', () => {
  const levels = zoomLevels([by.human, by.iss, by.moon, by.earth], { width: 960, maxHeight: 360 })
  assert.ok(levels.length >= 2)
  assert.equal(levels[0].zoom, 1)
  for (const lv of levels.slice(1)) assert.ok(lv.zoom > 1)
  assert.ok(levels.at(-1).objects.some(o => o.slug === 'human'))
})

test('the zoom ladder climbs in bounded steps', () => {
  for (const target of all) {
    if (target.slug === 'human') continue
    const chain = buildLadder(by.human, target, all)
    const ends = [chain[0].slug, chain.at(-1).slug].sort()
    assert.deepEqual(ends, ['human', target.slug].sort())
    for (let i = 1; i < chain.length; i++) assert.ok(sizeOf(chain[i]) >= sizeOf(chain[i - 1]) * 0.999, `${target.slug} step ${i}`)
    assert.ok(chain.length <= 32)
  }
  const earth = buildLadder(by.human, by.earth, all)
  assert.ok(earth.length >= 4, 'human to Earth needs several steps')
})

test('references are smaller, familiar objects when possible', () => {
  for (const o of all) {
    const refs = pickReferences(o, all)
    assert.ok(refs.length >= 1, o.slug)
    for (const r of refs) assert.notEqual(r.slug, o.slug)
  }
})

test('every pair renders without NaN and compares with a factor of at least 1', () => {
  for (const a of all) {
    for (const b of all) {
      if (a === b) continue
      const s = compareSentence(a, b)
      assert.ok(!/NaN|Infinity|undefined/.test(s), s)
      const m = s.match(/about ([\d.,–]+) times/)
      if (m) assert.ok(Number(m[1].split('–')[0].replace(/,/g, '')) >= 1, s)
      assert.ok(!/NaN|Infinity/.test(factorText(a, b)))
      const r = ratioRange(a, b)
      assert.ok(r.lo <= r.mid * 1.0000001 && r.mid <= r.hi * 1.0000001)
    }
    const { svg } = renderStage([by.human, a], { width: 600 })
    assert.ok(!/NaN|Infinity|undefined/.test(svg), a.slug)
    assert.ok(!/NaN|Infinity|undefined/.test(renderBars([by.human, a])), a.slug)
  }
})

test('nice numbers', () => {
  assert.equal(niceFloor(7), 5)
  assert.equal(niceFloor(0.034), 0.02)
  assert.equal(niceCeil(7), 10)
  assert.equal(niceCeil(120), 200)
})
