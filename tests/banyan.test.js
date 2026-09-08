import { test } from 'node:test'
import assert from 'node:assert/strict'
import { load } from 'cheerio'
import { parse } from '../scripts/scrape/banyan.js'

// The shape of the real table on foodservices.byuh.edu: bare rows name a day
// group, and the meal rows beneath belong to it. Times and structure are
// verbatim; prices are trimmed to the first column.
const PAGE = `<table>
  <tr><td>Monday to Friday</td><td>Adult Price with Tax</td></tr>
  <tr><th>Meal</th><th>Hours</th><th>Regular</th></tr>
  <tr><td>Breakfast</td><td>7:00 am &ndash; 10:00 am</td><td>$19.25</td></tr>
  <tr><td>Late Breakfast</td><td>10:00 am &ndash; 11:00 am</td></tr>
  <tr><td>Lunch</td><td>11:00 am &ndash; 2:00 pm</td><td>$21.50</td></tr>
  <tr><td>Closed</td><td>2:00 pm &ndash; 4:00 pm</td></tr>
  <tr><td>Dinner</td><td>4:00 pm &ndash; 8:00 pm</td><td>$23.25</td></tr>
  <tr><td>Saturday</td></tr>
  <tr><th>Meal</th><th>Hours</th><th>Regular</th></tr>
  <tr><td>Brunch</td><td>9:00 am &ndash; 1:00 pm</td><td>$21.50</td></tr>
  <tr><td>Closed</td><td>1:00 pm &ndash; 4:00 pm</td></tr>
  <tr><td>Dinner</td><td>4:00 pm &ndash; 8:00 pm</td><td>$23.25</td></tr>
  <tr><td>Sunday</td></tr>
  <tr><th>Meal</th><th>Hours</th><th>Regular</th></tr>
  <tr><td>Lunch</td><td>11:00 am &ndash; 1:30 pm</td><td>$23.25</td></tr>
  <tr><td>Dinner</td><td>4:00 pm &ndash; 6:30 pm</td></tr>
  <tr><td>Fast Sunday</td></tr>
  <tr><th>Meal</th><th>Hours</th><th>Regular</th></tr>
  <tr><td>Dinner</td><td>5:00 pm &ndash; 7:00 pm</td><td>$23.25</td></tr>
  <tr><td>Holidays</td></tr>
  <tr><th>Meal</th><th>Hours</th><th>Regular</th></tr>
  <tr><td>Breakfast</td><td>8:00 am &ndash; 10:00 am</td><td>See Breakfast Prices</td></tr>
  <tr><td>Late Breakfast</td><td>10:00 am &ndash; 11:00 am</td></tr>
  <tr><td>Lunch</td><td>11:00 am &ndash; 2:00 pm</td><td>See Lunch Prices</td></tr>
  <tr><td>Closed</td><td>2:00 pm &ndash; 4:00 pm</td></tr>
  <tr><td>Dinner</td><td>4:00 pm &ndash; 8:00 pm</td><td>See Dinner Prices</td></tr>
  <tr><td>Special Events</td></tr>
  <tr><th>Meal</th><th>Hours</th><th>Regular</th></tr>
  <tr><td>Breakfast</td><td>-</td><td>$20.25</td></tr>
</table>`

const facility = () => parse(load(PAGE))[0]

test('the weekend is scraped, not left closed', () => {
  // The bug this guards: every meal row was flattened into Monday-Friday, so
  // Saturday and Sunday came back empty and the app showed the hall shut.
  const { hours } = facility()
  assert.deepEqual(hours.sat, [['09:00', '13:00'], ['16:00', '20:00']])
  assert.deepEqual(hours.sun, [['11:00', '13:30'], ['16:00', '18:30']])
})

test('back-to-back meals merge into one opening', () => {
  // Breakfast, late breakfast and lunch run 7-10, 10-11, 11-2 with no gap, so
  // the hall is open straight through and should read that way.
  assert.deepEqual(facility().hours.mon, [['07:00', '14:00'], ['16:00', '20:00']])
})

test('the gap between meals stays closed', () => {
  const { hours } = facility()
  // 2-4pm on a weekday and 1-4pm on Saturday are "Closed" rows on the page.
  // Two separate intervals per day is the assertion: one merged block spanning
  // the gap would mean the closure row had been parsed as an opening.
  assert.equal(hours.mon.length, 2)
  assert.equal(hours.mon[0][1], '14:00')
  assert.equal(hours.mon[1][0], '16:00')

  assert.equal(hours.sat.length, 2)
  assert.equal(hours.sat[0][1], '13:00')
  assert.equal(hours.sat[1][0], '16:00')
})

test('undated sections are never published as hours', () => {
  const { hours, notes } = facility()
  // Fast Sunday is 5-7pm; regular Sunday dinner is 4-6:30. If the two were
  // merged, Sunday would wrongly read 16:00-19:00.
  assert.deepEqual(hours.sun, [['11:00', '13:30'], ['16:00', '18:30']])
  // They are still worth telling the user about, just not as a status.
  assert.match(notes, /Fast Sunday: 17:00-19:00/)
  assert.match(notes, /Holidays: 08:00-14:00/)
})

test('a section with no times is ignored entirely', () => {
  // "Special Events" lists prices against a "-" for hours.
  assert.doesNotMatch(facility().notes, /Special Events/)
})

test('a layout change is loud rather than silent', () => {
  assert.throws(() => parse(load('<p>no table here</p>')), /page layout changed/)
  assert.throws(
    () => parse(load('<table><tr><td>Meal</td><td>Hours</td></tr></table>')),
    /page layout changed/,
  )
})
