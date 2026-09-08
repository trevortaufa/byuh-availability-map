import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getFreshness } from '../src/lib/freshness.js'

// Late evening UTC on the 25th is still the 25th on campus (UTC-10), which is
// the case the campus-date comparison exists to get right.
const scraped = '2026-08-25T21:50:51.950Z'

test('fresh data warns about nothing', () => {
  const f = getFreshness(scraped, new Date('2026-08-26T02:00:00Z'))
  assert.equal(f.level, 'fresh')
  assert.equal(f.warning, null)
})

test('age is counted in campus days, not elapsed hours', () => {
  // 08-25 21:50Z is 11:50 on the 25th in Honolulu; 08-27 10:30Z is 00:30 on the
  // 27th. Under 37 hours elapsed, but two calendar days on the island.
  const f = getFreshness(scraped, new Date('2026-08-27T10:30:00Z'))
  assert.equal(f.ageDays, 2)
  assert.equal(f.label, 'Hours updated 2 days ago')
})

test('yesterday reads as a word, not a number', () => {
  const f = getFreshness(scraped, new Date('2026-08-26T20:00:00Z'))
  assert.equal(f.label, 'Hours updated yesterday')
})

test('three days old starts warning quietly', () => {
  const f = getFreshness(scraped, new Date('2026-08-28T20:00:00Z'))
  assert.equal(f.level, 'aging')
  assert.ok(f.warning.includes('3 days ago'))
})

test('a week old warns loudly and says to check the source', () => {
  const f = getFreshness(scraped, new Date('2026-09-04T20:00:00Z'))
  assert.equal(f.level, 'stale')
  assert.equal(f.ageDays, 10)
  assert.match(f.warning, /official page/)
})

test('a missing timestamp warns rather than rendering nothing', () => {
  for (const bad of [null, undefined, '', 'not-a-date']) {
    const f = getFreshness(bad, new Date('2026-09-04T20:00:00Z'))
    assert.equal(f.level, 'unknown', `for ${JSON.stringify(bad)}`)
    assert.ok(f.warning)
  }
})

test('a clock skewed behind the scrape never reports negative age', () => {
  const f = getFreshness(scraped, new Date('2026-08-20T20:00:00Z'))
  assert.equal(f.ageDays, 0)
  assert.equal(f.level, 'fresh')
})
