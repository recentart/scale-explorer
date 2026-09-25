import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  toBase, fromBase, convert, parseLength, parseNumber, formatNumber, formatValue, formatRange, sigFigsOf, conversionSig, formatFeetInches,
} from '../src/lib/units.js'
import { formatMeasure, formatBoth, measureRange } from '../src/lib/measures.js'

const close = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} ≉ ${b}`)

test('exact unit definitions', () => {
  assert.equal(toBase(1, 'ft'), 0.3048)
  assert.equal(toBase(1, 'mi'), 1609.344)
  assert.equal(toBase(1, 'km'), 1000)
  assert.equal(toBase(1, 'in'), 0.0254)
  assert.equal(toBase(1, 'lb'), 0.45359237)
  close(toBase(1, 'shortTon'), 2000 * 0.45359237)
  close(convert(5280, 'ft', 'mi'), 1)
  close(convert(1, 'mi', 'km'), 1.609344)
  close(convert(150, 'm', 'ft'), 492.1259842519685)
  close(convert(8848.86, 'm', 'ft'), 29031.69291338583)
  close(fromBase(toBase(123.456, 'mi'), 'mi'), 123.456)
})

test('significant figures follow the source', () => {
  assert.equal(sigFigsOf(330), 2)
  assert.equal(sigFigsOf(8848.86), 6)
  assert.equal(sigFigsOf(0.3048), 4)
  assert.equal(conversionSig(330, false), 3)
  assert.equal(conversionSig(24, true), 2)
  assert.equal(conversionSig(8848.86, false), 6)
})

test('number formatting', () => {
  assert.equal(formatNumber(29031.69291, 6), '29,031.7')
  assert.equal(formatNumber(1082.677, 3), '1,080')
  assert.equal(formatNumber(6200000, 2), '6.2 million')
  assert.equal(formatNumber(5.9722e24, 5), '5.9722 × 10²⁴')
  assert.equal(formatNumber(0.0932057, 6), '0.0932057')
  assert.equal(formatFeetInches(1.75), '5 ft 9 in')
  assert.equal(formatFeetInches(1.8288), '6 ft')
})

test('value and range formatting picks sensible units', () => {
  assert.equal(formatValue('length', 330, 'metric', { sig: 3 }), '330 m')
  assert.equal(formatValue('length', 330, 'imperial', { sig: 3 }), '1,080 ft')
  assert.equal(formatValue('length', 12742000, 'metric', { sig: 5 }), '12,742 km')
  assert.equal(formatValue('length', 12742000, 'imperial', { sig: 5 }), '7,917.5 mi')
  assert.equal(formatRange('length', 24, 30, 'imperial', { sig: 2 }), '79–98 ft')
  assert.equal(formatRange('length', 1.61, 1.75, 'imperial', { sig: 3 }), '5 ft 3 in – 5 ft 9 in')
  assert.equal(formatValue('mass', 150000, 'metric', { sig: 3 }), '150 t')
  assert.equal(formatValue('mass', 150000, 'imperial', { sig: 3 }), '165 US tons')
})

test('measures keep the source figure and convert honestly', () => {
  const eiffel = { value: 330, unit: 'm', approx: false, qualifier: 'exact' }
  assert.equal(formatMeasure(eiffel, 'metric'), '330 m')
  assert.equal(formatMeasure(eiffel, 'imperial'), '1,080 ft')
  const dam = { value: 726.4, unit: 'ft', approx: false, qualifier: 'exact' }
  assert.equal(formatMeasure(dam, 'imperial'), '726.4 ft')
  assert.equal(formatMeasure(dam, 'metric'), '221.4 m')
  const whale = { min: 24, max: 30, unit: 'm', approx: true, qualifier: 'range' }
  assert.equal(formatBoth(whale), '24–30 m (79–98 ft)')
  assert.deepEqual(measureRange(whale), { lo: 24, hi: 30 })
  const upTo = { max: 150, unit: 't', approx: true, qualifier: 'up to' }
  assert.equal(formatMeasure(upTo, 'metric'), 'up to 150 t')
  assert.deepEqual(measureRange(upTo), { lo: 150000, hi: 150000 })
  assert.equal(formatMeasure({ value: 5.9722e24, unit: 'kg', approx: false, qualifier: 'exact' }, 'metric'), '5.9722 × 10²⁴ kg')
})

test('parseNumber accepts common formats', () => {
  assert.equal(parseNumber('1500'), 1500)
  assert.equal(parseNumber('1,500'), 1500)
  assert.equal(parseNumber('1,500.25'), 1500.25)
  assert.equal(parseNumber('1,5'), 1.5)
  assert.equal(parseNumber('1.5e3'), 1500)
  assert.ok(Number.isNaN(parseNumber('1,50,0')))
  assert.ok(Number.isNaN(parseNumber('abc')))
})

test('parseLength understands units and rejects bad input', () => {
  const ok = (text, unit, meters) => {
    const r = parseLength(text, unit)
    assert.ok(r.ok, `${text}: ${r.error}`)
    close(r.meters, meters)
  }
  ok('150', 'm', 150)
  ok('150 m', 'ft', 150)
  ok('150m', 'ft', 150)
  ok('150 meters', 'ft', 150)
  ok('150 metres', 'ft', 150)
  ok('492 feet', 'm', 492 * 0.3048)
  ok('492 ft', 'm', 492 * 0.3048)
  ok("10'", 'm', 3.048)
  ok('1.5 km', 'm', 1500)
  ok('3 miles', 'm', 3 * 1609.344)
  ok('1 mi', 'm', 1609.344)
  ok('1,000', 'ft', 304.8)
  ok('5\'10"', 'm', 70 * 0.0254)
  ok('5 ft 10 in', 'm', 70 * 0.0254)
  ok('  2 KM ', 'm', 2000)

  const bad = (text, pattern) => {
    const r = parseLength(text, 'm')
    assert.equal(r.ok, false, `${text} should fail`)
    assert.match(r.error, pattern)
  }
  bad('', /Enter a size/)
  bad('abc', /Enter a number/)
  bad('-5', /greater than zero/)
  bad('0', /greater than zero/)
  bad('0.001', /smaller than 1 cm/)
  bad('2000000 km', /larger than 1,000,000 km/)
  bad('10 yards', /not a supported unit/)
  bad('10 sq m', /not a supported unit/)
  bad('5\'13"', /Inches should be less than 12/)
  bad('1e999', /Enter a number/)
  bad('12..5', /Enter a number/)
})
