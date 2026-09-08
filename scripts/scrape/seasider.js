/**
 * Fitness facilities — seasidersports.byuh.edu
 *
 * Layout: prose, no tables. Each facility has a "<Name> Hours" heading
 * followed by one line per day with pipe-separated intervals:
 *   "Monday 6 - 8 am | 9 am - 12 pm | 1 - 10 pm Closed for Cleaning: 8 - 9 am"
 */
import { fetchDoc } from './lib/fetch.js'
import { parseHoursBlob, withClosedDefaults } from './lib/parse-hours.js'

export const SOURCE_URL = 'https://seasidersports.byuh.edu/fitness-center'

const FACILITIES = [
  { id: 'fitness-center', name: 'Fitness Center', heading: 'Fitness Center Hours' },
  { id: 'cardio-room', name: 'Cardio Room', heading: 'Cardio Room Hours' },
  { id: 'fitness-studio', name: 'Fitness Studio', heading: 'Fitness Studio Hours' },
]

export function parse($, now = new Date()) {
  $('script,style,noscript').remove()
  const text = $('body').text().replace(/\s+/g, ' ')

  const out = []
  for (const [i, f] of FACILITIES.entries()) {
    const start = text.indexOf(f.heading)
    if (start === -1) continue

    // The section runs until the next facility's heading, or a chunk of text
    // if this is the last one.
    const nextHeading = FACILITIES[i + 1]?.heading
    const end = nextHeading ? text.indexOf(nextHeading, start) : start + 800
    const section = text.slice(start + f.heading.length, end === -1 ? undefined : end)

    const { hours: weekly, holidays } = parseHoursBlob(section, now)
    const hours = withClosedDefaults(weekly)
    if (Object.values(hours).every((d) => d.length === 0) && holidays.length === 0) continue

    out.push({
      id: f.id,
      name: f.name,
      category: 'fitness',
      sourceUrl: SOURCE_URL,
      hours,
      exceptions: holidays.map(({ date, label, intervals }) => ({ date, label, intervals })),
      // A holiday row replaces that weekday's row on the page, so this scrape
      // never saw the regular hours for it. index.js carries the previous
      // scrape's value forward for these days instead of writing "closed".
      carryOverDays: holidays.map((h) => h.weekday),
      notes: 'Cleaning and faculty-hour closures are already excluded from the times shown.',
    })
  }

  if (out.length === 0) throw new Error('seasider: no facility sections parsed — page layout changed')
  return out
}

export async function scrape() {
  return parse(await fetchDoc(SOURCE_URL))
}
