/**
 * Banyan Dining Hall — foodservices.byuh.edu
 *
 * Layout: one price table per audience (adult / child / senior), each holding
 * the same schedule. We read the first; the prices are irrelevant to "is it
 * open". Inside a table, a bare row names a day group and the meal rows beneath
 * it belong to that group:
 *
 *   Saturday
 *   Meal      | Hours
 *   Brunch    | 9:00 am - 1:00 pm
 *   Closed    | 1:00 pm - 4:00 pm     <- marks the gap, not an opening
 *   Dinner    | 4:00 pm - 8:00 pm
 *
 * The section headers are the whole trick. An earlier version ignored them and
 * flattened every meal row into Monday-Friday, so Saturday and Sunday came back
 * closed and the note claimed the weekend "isn't in a table". It always was.
 *
 * Two sections are deliberately not published as hours: "Fast Sunday" and
 * "Holidays" give times but no dates, and guessing which dates they land on
 * would be inventing data. They ride along in the note instead.
 */
import { fetchDoc } from './lib/fetch.js'
import { parseIntervals, withClosedDefaults, expandDays } from './lib/parse-hours.js'

export const SOURCE_URL = 'https://foodservices.byuh.edu/banyan-dining-hall'

/** A row naming a day group rather than a meal. */
const SECTION = /^(?:(?:mon|tues|wednes|thurs|fri|satur|sun)day|fast sunday|holidays?|special events?)/i

/** Sections that state times but no dates, so they cannot become exceptions. */
const UNDATED = /^(?:fast sunday|holidays?)/i

/** Sections with no times at all. */
const NO_HOURS = /^special events?/i

const HAS_TIME = /\d{1,2}(?::\d{2})?\s*[ap]/i

/** [["07:00","10:00"],["10:00","11:00"]] -> [["07:00","11:00"]] */
function mergeContiguous(intervals) {
  // Zero-padded "HH:MM" sorts lexicographically the same as chronologically,
  // so a plain string compare is safe here.
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

  /** day group label -> intervals collected under it */
  const sections = new Map()
  let current = null

  table.find('tr').each((_, tr) => {
    const cells = $(tr)
      .find('td,th')
      .map((__, c) => $(c).text().trim())
      .get()
      .filter(Boolean)

    if (cells.length === 0) return
    if (/^meal$/i.test(cells[0])) return // the per-section column header

    if (SECTION.test(cells[0])) {
      current = cells[0]
      if (!sections.has(current)) sections.set(current, [])
      return
    }

    // A meal row. "Closed" rows describe the gap between meals, so parsing
    // them as openings would show the hall open through the afternoon.
    if (!current || !HAS_TIME.test(cells[1] ?? '')) return
    if (/^closed$/i.test(cells[0])) return
    sections.get(current).push(...parseIntervals(cells[1]))
  })

  const byDay = {}
  const undated = []

  for (const [label, intervals] of sections) {
    if (NO_HOURS.test(label)) continue

    if (UNDATED.test(label)) {
      if (intervals.length) {
        const times = mergeContiguous(intervals)
          .map(([s, e]) => `${s}-${e}`)
          .join(', ')
        undated.push(`${label}: ${times}`)
      }
      continue
    }

    for (const day of expandDays(label)) {
      byDay[day] = mergeContiguous([...(byDay[day] ?? []), ...intervals])
    }
  }

  if (Object.keys(byDay).length === 0) {
    throw new Error('banyan: no day sections parsed — page layout changed')
  }

  const notes = [
    'Closed between meals; those gaps are already excluded.',
    undated.length
      ? `The page also lists ${undated.join(' and ')}, without dates — check it around holidays and the first Sunday of the month.`
      : null,
  ].filter(Boolean)

  return [
    {
      id: 'banyan-dining-hall',
      name: 'Banyan Dining Hall',
      category: 'dining',
      sourceUrl: SOURCE_URL,
      hours: withClosedDefaults(byDay),
      exceptions: [],
      notes: notes.join(' '),
    },
  ]
}

export async function scrape() {
  return parse(await fetchDoc(SOURCE_URL))
}
