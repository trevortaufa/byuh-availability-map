/**
 * Open Gym / Open Field free play — seasidersports.byuh.edu/seasider-sports/open-gym
 *
 * Layout: prose, no tables. One block per venue, each listing activities with
 * a morning and an evening range run together with no separator:
 *
 *   "CAC Basketball8:15 am - 10:45 am5:15 am - 10:45 pm"
 *   "McKay Gym Badminton8:15 am - 10:45 am5:15 pm - 7:45 pmVolleyball8:15 ..."
 *
 * A venue can host several activities with different evening end times, so the
 * venue's own opening hours are the union of its activities'.
 */
import { fetchDoc } from './lib/fetch.js'
import { withClosedDefaults, parseIntervals } from './lib/parse-hours.js'

export const SOURCE_URL = 'https://seasidersports.byuh.edu/seasider-sports/open-gym'

// Order matters: each venue's block runs until the next venue's marker.
const VENUES = [
  { marker: 'CAC', id: 'cannon-activities-center', name: 'Cannon Activities Center (Open Gym)' },
  { marker: 'McKay Gym', id: 'mckay-gym', name: 'David O. McKay Gymnasium (Open Gym)' },
  { marker: 'Turf Field', id: 'turf-field', name: 'Turf Field (Open Play)' },
  { marker: 'Outdoor Sports Court', id: 'outdoor-sports-court', name: 'Outdoor Sports Court' },
  { marker: 'Tennis Courts', id: 'tennis-courts', name: 'Tennis Courts' },
]

// Only these get published. The other two parse fine — add an id here and a
// coords.json entry to put them on the map.
const PUBLISH = new Set(['cannon-activities-center', 'mckay-gym', 'turf-field'])

const MONDAY_EVENING_END = 19 * 60 + 45 // 7:45 pm, per the page's Monday note

// A venue block is ~50 chars ("Basketball8:15 am - 10:45 am5:15 pm - 10:45 pm").
// 250 is generous headroom without reaching the next section.
const MAX_BLOCK_CHARS = 250

const toMin = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3))
const pad = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

/**
 * The source page writes the evening block of four of its six rows as
 * "5:15 am - 10:45 pm". That is a typo for 5:15 PM — the same page's Monday
 * note and the McKay badminton row both say 5:15 pm, and an 05:15 start would
 * overlap the morning block that precedes it.
 *
 * Taken literally it would show the CAC and Turf Field as open at 6am. So:
 * within one activity, an interval that starts before the previous one ends is
 * treated as a missing "p" and shifted 12 hours. Anything corrected is logged,
 * because silently rewriting source data is how a scraper starts lying.
 */
function fixMeridiemTypos(intervals, label) {
  const out = []
  for (const [start, end] of intervals) {
    let s = toMin(start)
    const e = toMin(end)
    const prevEnd = out.length ? toMin(out[out.length - 1][1]) : -1
    if (s < prevEnd && s + 720 < e) {
      console.warn(`  note  ${label}: read "${start}" as "${pad(s + 720)}" (source says am, means pm)`)
      s += 720
    }
    out.push([pad(s), pad(e)])
  }
  return out
}

/** Union of overlapping or touching intervals. */
function union(intervals) {
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
  $('script,style,noscript,nav,footer').remove()
  const text = $('body').text().replace(/\s+/g, ' ')

  const start = text.indexOf('Open Gym / Open Field')
  if (start === -1) throw new Error('opengym: schedule section not found — page layout changed')
  const section = text.slice(start, start + 1200)

  const out = []
  for (const [i, venue] of VENUES.entries()) {
    if (!PUBLISH.has(venue.id)) continue

    const from = section.indexOf(`${venue.marker} `, 'Open Gym / Open Field'.length)
    if (from === -1) {
      // Never swallow this silently. A renamed marker means the page changed,
      // and a quietly-missing venue is indistinguishable from a closed one.
      console.warn(`  warn  opengym: venue marker "${venue.marker}" not found — skipping ${venue.id}`)
      continue
    }

    // Bound the block explicitly. Falling back to end-of-section would let a
    // later venue's or a footer's times overwrite this venue's hours, because
    // parseHoursBlob assigns days last-write-wins. A block is ~50 chars.
    const nextMarker = VENUES[i + 1]?.marker
    const nextAt = nextMarker ? section.indexOf(`${nextMarker} `, from + 1) : -1
    const to = nextAt === -1 ? Math.min(from + MAX_BLOCK_CHARS, section.length) : nextAt
    const block = section.slice(from + venue.marker.length, to)

    // Split per activity ("Badminton8:15...", "Volleyball8:15...") so the typo
    // fix compares an activity against itself, not against the previous one.
    // Require a capitalised word of 3+ letters. A looser [A-Za-z]+ also splits
    // on the meridiem in "10:45 am5:15 pm", which tears one activity's morning
    // and evening blocks apart and defeats the typo check below.
    const activities = block.split(/(?=[A-Z][a-z]{2,}\s*\d{1,2}:\d{2})/).filter((s) => /\d/.test(s))

    const all = []
    for (const activity of activities) {
      const name = activity.match(/^[A-Za-z ]+/)?.[0].trim() || venue.name
      all.push(...fixMeridiemTypos(parseIntervals(activity), `${venue.marker} ${name}`))
    }
    if (all.length === 0) continue

    const standard = union(all)
    // The page states a blanket Monday evening close of 7:45 pm (FHE night).
    const monday = standard.map(([s, e]) =>
      toMin(s) >= 720 && toMin(e) > MONDAY_EVENING_END ? [s, pad(MONDAY_EVENING_END)] : [s, e],
    )

    out.push({
      id: venue.id,
      name: venue.name,
      category: 'fitness',
      sourceUrl: SOURCE_URL,
      hours: withClosedDefaults({
        mon: monday,
        tue: standard, wed: standard, thu: standard, fri: standard, sat: standard,
      }),
      exceptions: [],
      notes:
        'Free play. Requires a valid physical BYUH ID. The page warns the schedule changes without notice for university events, FHE, club events, weather and staffing. Monday evenings end at 7:45 pm. Sunday closed and Saturday hours are assumed — the page does not break the week down.',
    })
  }

  if (out.length === 0) throw new Error('opengym: no venues parsed — page layout changed')
  return out
}

export async function scrape() {
  return parse(await fetchDoc(SOURCE_URL))
}
