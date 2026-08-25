/**
 * Banyan Dining Hall — foodservices.byuh.edu
 *
 * Layout: a price table per audience (adult / child / senior), each with the
 * same meal periods. We only need the first one; the prices are irrelevant to
 * "is it open". Rows are [Meal, Hours, ...prices], with a literal "Closed" row
 * marking the gap between lunch and dinner.
 *
 * KNOWN GAP: only the Monday–Friday table is real markup. The weekend and
 * holiday schedules are rendered outside a table on this page and are not
 * parsed — Sat/Sun come back empty and the note says so.
 */
import { fetchDoc } from './lib/fetch.js'
import { parseIntervals, withClosedDefaults } from './lib/parse-hours.js'

export const SOURCE_URL = 'https://foodservices.byuh.edu/banyan-dining-hall'

/** [["07:00","10:00"],["10:00","11:00"]] -> [["07:00","11:00"]] */
function mergeContiguous(intervals) {
  const sorted = [...intervals].sort((a, b) => a[0].localeCompare(b[0]))
  const out = []
  for (const [start, end] of sorted) {
    const last = out[out.length - 1]
    if (last && last[1] >= start) last[1] = end > last[1] ? end : last[1]
    else out.push([start, end])
  }
  return out
}

export function parse($) {
  const table = $('table').first()
  if (table.length === 0) throw new Error('banyan: no table found — page layout changed')

  const periods = []
  table.find('tr').each((_, tr) => {
    const cells = $(tr).find('td,th').map((__, c) => $(c).text().trim()).get()
    if (cells.length < 2) return
    const [meal, hours] = cells
    if (/^closed$/i.test(meal)) return
    if (!/\d{1,2}(:\d{2})?\s*[ap]/i.test(hours)) return
    periods.push(...parseIntervals(hours))
  })

  if (periods.length === 0) throw new Error('banyan: no meal periods parsed — page layout changed')

  const weekday = mergeContiguous(periods)
  const hours = withClosedDefaults({
    mon: weekday, tue: weekday, wed: weekday, thu: weekday, fri: weekday,
  })

  return [
    {
      id: 'banyan-dining-hall',
      name: 'Banyan Dining Hall',
      category: 'dining',
      sourceUrl: SOURCE_URL,
      hours,
      exceptions: [],
      notes:
        'Monday–Friday only. Weekend and holiday hours are published outside the table on the source page and are not yet scraped — check the page for Sat/Sun.',
    },
  ]
}

export async function scrape() {
  return parse(await fetchDoc(SOURCE_URL))
}
