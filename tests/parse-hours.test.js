import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseIntervals } from '../scripts/scrape/lib/parse-hours.js'

// Verbatim from seasidersports.byuh.edu, Fitness Studio, Tuesday. The page runs
// the closure notes straight onto the last interval with no separator.
const TUESDAY =
  '5 am - 11 am | 12 noon - 2 pm | 3 pm - 10 pmClosed for Devotional: 11 am - 12 noonClosed for Cleaning: 2 - 3 pm'

test('a stated closure is not stored as an opening', () => {
  const intervals = parseIntervals(TUESDAY)
  assert.deepEqual(intervals, [
    ['05:00', '11:00'],
    ['12:00', '14:00'],
    ['15:00', '22:00'],
  ])
})

test('any closure reason is stripped, not just the ones we have seen', () => {
  // The bug this guards: the strip list named cleaning, faculty and women's
  // hour, so "Devotional" fell through and 11-12 was published as open.
  for (const reason of ['Devotional', 'Cleaning', 'Maintenance', 'a Private Event']) {
    const intervals = parseIntervals(`9 am - 5 pmClosed for ${reason}: 11 am - 12 noon`)
    assert.deepEqual(intervals, [['09:00', '17:00']], `reason: ${reason}`)
  }
})

test('faculty and women\'s hour are still excluded', () => {
  assert.deepEqual(
    parseIntervals('6 - 8 am | 9 am - 12 pmFaculty Hour: 12 - 1 pm'),
    [['06:00', '08:00'], ['09:00', '12:00']],
  )
})
