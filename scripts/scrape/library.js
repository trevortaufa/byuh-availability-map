/**
 * Joseph F. Smith Library — library.byuh.edu
 *
 * Layout: a table whose first column is the area name and second column is a
 * run-together hours blob, plus a separate "Holiday Hours" table of dated
 * overrides.
 *
 * `parse` is split out from `scrape` so the parsing can be tested against a
 * saved copy of the page without hitting the network.
 */
import { fetchDoc } from './lib/fetch.js'
import { parseHoursBlob, withClosedDefaults, parseIntervals, parseDates } from './lib/parse-hours.js'

export const SOURCE_URL = 'https://library.byuh.edu/hours-of-the-library'

export function parse($, now = new Date()) {
  const rows = []
  $('table tr').each((_, tr) => {
    const cells = $(tr).find('td,th').map((__, c) => $(c).text().trim()).get()
    if (cells.length >= 2) rows.push(cells)
  })

  const main = rows.find(([name]) => /^library building$/i.test(name))
  if (!main) throw new Error('library: "Library Building" row not found — page layout changed')

  const { hours: weekly, holidays } = parseHoursBlob(main[1], now)
  const hours = withClosedDefaults(weekly)

  // Holiday table: Holiday | Date | Hours. "CLOSED" becomes an empty day.
  // Seeded with any holiday written into the weekly blob itself, which the
  // dated table below does not always repeat.
  const exceptions = holidays.map(({ date, label, intervals }) => ({ date, label, intervals }))
  for (const [label, date, times] of rows) {
    if (!/\d{4}/.test(date ?? '')) continue
    if (/^holiday$/i.test(label)) continue
    for (const d of parseDates(date)) {
      exceptions.push({
        date: d,
        intervals: /closed/i.test(times ?? '') ? [] : parseIntervals(times ?? ''),
        label: label.replace(/\s*\(not a school holiday\)/i, '').trim(),
      })
    }
  }

  // Sub-areas keep their own hours; surfacing them as separate map pins would
  // just be five dots on one building, so they ride along as a note.
  const areas = rows
    .filter(([name]) => /computing lab|makerspace|circulation|collection|archives/i.test(name))
    .map(([name, blob]) => `${name.replace(/:$/, '')}: ${blob.split(/(?=[A-Z][a-z]+ ?- ?[A-Z])/)[0].trim()}`)

  return [
    {
      id: 'joseph-f-smith-library',
      name: 'Joseph F. Smith Library',
      category: 'library',
      sourceUrl: SOURCE_URL,
      hours,
      exceptions,
      carryOverDays: holidays.map((h) => h.weekday),
      notes: ['Closed Sundays and during devotionals.', ...areas].join(' '),
    },
  ]
}

export async function scrape() {
  return parse(await fetchDoc(SOURCE_URL))
}
