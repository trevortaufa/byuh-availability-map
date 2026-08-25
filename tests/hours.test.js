import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getStatus } from '../src/lib/hours.js'
import { parseIntervals, parseHoursBlob } from '../scripts/scrape/lib/parse-hours.js'

const library = {
  id: 'lib',
  name: 'Library',
  hours: {
    mon: [['07:00', '24:00']],
    tue: [['07:00', '24:00']],
    wed: [['07:00', '24:00']],
    thu: [['07:00', '24:00']],
    fri: [['07:00', '20:00']],
    sat: [['09:00', '15:00']],
    sun: [],
  },
  exceptions: [{ date: '2026-12-25', intervals: [], label: 'Christmas' }],
}

const gym = {
  id: 'gym',
  name: 'Gym',
  hours: { mon: [['06:00', '08:00'], ['09:00', '12:00'], ['13:00', '22:00']], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] },
  exceptions: [],
}

// Every Date below is a real UTC instant. Hawaii is UTC-10 year round, so
// 2026-08-24T20:00Z is Monday 10:00 in Laie.
const at = (iso) => new Date(iso)

test('open during a normal weekday interval', () => {
  assert.equal(getStatus(library, at('2026-08-24T20:00:00Z')).open, true)
})

test('closed on Sunday, reports the next opening', () => {
  const s = getStatus(library, at('2026-08-23T20:00:00Z'))
  assert.equal(s.open, false)
  assert.match(s.detail, /tomorrow 7 AM/)
})

test('the gap between intervals reads as closed', () => {
  // Monday 08:30 campus time — inside the 8–9am cleaning gap.
  const s = getStatus(gym, at('2026-08-24T18:30:00Z'))
  assert.equal(s.open, false)
  assert.match(s.detail, /Reopens 9 AM/)
})

test('a dated exception overrides the weekly hours', () => {
  // Christmas 2026 is a Friday; weekly hours would say open.
  assert.equal(getStatus(library, at('2026-12-25T20:00:00Z')).open, false)
})

test('answer does not depend on the machine timezone', () => {
  // Same instant, whatever TZ the process is in — Monday 10:00 in Laie.
  const s = getStatus(library, at('2026-08-24T20:00:00Z'))
  assert.equal(s.label, 'Open until 12 AM')
})

test('parses a range with the meridiem only on the end', () => {
  assert.deepEqual(parseIntervals('1 - 10 pm'), [['13:00', '22:00']])
})

test('parses "12 noon" as an end time', () => {
  assert.deepEqual(parseIntervals('6 am - 12 noon'), [['06:00', '12:00']])
})

test('a day range expands to every day in it', () => {
  const h = parseHoursBlob('Mon - Thur: 7:00 am – 12:00 am')
  assert.deepEqual(Object.keys(h).sort(), ['mon', 'thu', 'tue', 'wed'])
})
