import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseHoursBlob, upcomingDate } from '../scripts/scrape/lib/parse-hours.js'

// Verbatim from seasidersports.byuh.edu, Fitness Studio, as published on Labor
// Day 2026. Monday's regular row is replaced by the holiday row.
const STUDIO =
  ' Monday Labor Day Hours6 am - 12 noon Tuesday 5 am - 11 am | 12 noon - 2 pm |' +
  ' 3 pm - 10 pmClosed for Devotional: 11 am - 12 noonClosed for Cleaning: 2 - 3 pm' +
  ' Wednesday 5 am - 2 pm | 3 - 10 pmClosed for Cleaning: 2 - 3 pm Saturday 6am - 12 noon'

// Monday, 2026-09-07 at 09:00 campus time (UTC-10).
const LABOR_DAY = new Date('2026-09-07T19:00:00Z')

test('a holiday row does not become the weekly hours for that day', () => {
  const { hours } = parseHoursBlob(STUDIO, LABOR_DAY)
  // The bug this guards: mon came back as 06:00-12:00, wiping the real hours
  // for every Monday of the term.
  assert.equal(hours.mon, undefined)
})

test('a holiday row becomes a dated exception instead', () => {
  const { holidays } = parseHoursBlob(STUDIO, LABOR_DAY)
  assert.deepEqual(holidays, [
    {
      weekday: 'mon',
      date: '2026-09-07',
      label: 'Labor Day',
      intervals: [['06:00', '12:00']],
    },
  ])
})

test('the ordinary days around a holiday row still parse', () => {
  const { hours } = parseHoursBlob(STUDIO, LABOR_DAY)
  assert.deepEqual(hours.tue, [
    ['05:00', '11:00'],
    ['12:00', '14:00'],
    ['15:00', '22:00'],
  ])
  assert.deepEqual(hours.wed, [['05:00', '14:00'], ['15:00', '22:00']])
  assert.deepEqual(hours.sat, [['06:00', '12:00']])
})

test('a plain blob reports no holidays', () => {
  const { hours, holidays } = parseHoursBlob('Monday 6 - 8 am | 9 am - 12 pm', LABOR_DAY)
  assert.deepEqual(holidays, [])
  assert.deepEqual(hours.mon, [['06:00', '08:00'], ['09:00', '12:00']])
})

test('a day range still expands when it is not a holiday row', () => {
  const { hours } = parseHoursBlob('Mon - Thur: 7:00 am - 12:00 am', LABOR_DAY)
  for (const d of ['mon', 'tue', 'wed', 'thu']) {
    assert.deepEqual(hours[d], [['07:00', '24:00']], d)
  }
})

test('upcomingDate resolves a weekday to today when it is today', () => {
  assert.equal(upcomingDate('mon', LABOR_DAY), '2026-09-07')
})

test('upcomingDate looks forward, never back', () => {
  // Asked on Monday for Saturday: the coming Saturday, not the one just gone.
  assert.equal(upcomingDate('sat', LABOR_DAY), '2026-09-12')
  assert.equal(upcomingDate('sun', LABOR_DAY), '2026-09-13')
})
