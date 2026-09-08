/**
 * Turns the free text BYUH publishes into the interval shape the app stores.
 *
 * Two layouts exist across the sites, so both are handled:
 *   library.byuh.edu     "Mon - Thur: 7:00 am – 12:00 am" (colon, full times)
 *   seasidersports       "Monday 6 - 8 am | 9 am - 12 pm | 1 - 10 pm"
 *                        (no colon, pipe-separated, meridiem only on the end)
 *
 * These pages run lines together with no separator in the DOM, so we re-split
 * on the day tokens rather than trusting whitespace.
 */

// Campus time is the app's single source of truth for what "today" means,
// so resolving a holiday's weekday to a date reuses it rather than
// re-deriving the timezone rule here.
import { nowInCampusTime, WEEKDAYS } from '../../../src/lib/time.js'

// Range order as the pages write them (Mon-Thur, Mon-Fri, Sat-Sun).
const RANGE_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const ALL_DAYS = RANGE_ORDER

const DAY_TOKEN = '(?:sundays?|mondays?|tuesdays?|wednesdays?|thursdays?|fridays?|saturdays?|sun|mon|tues?|weds?|thurs?|fri|sat)\\.?'
const RANGE_SEP = '(?:\\s*[-–—]\\s*|\\s+to\\s+|\\s*&\\s*)'
const DAY_SPEC = `${DAY_TOKEN}(?:${RANGE_SEP}${DAY_TOKEN})?`

function normaliseDay(token) {
  const t = token.toLowerCase().replace(/\./g, '')
  if (t.startsWith('su')) return 'sun'
  if (t.startsWith('m')) return 'mon'
  if (t.startsWith('tu')) return 'tue'
  if (t.startsWith('w')) return 'wed'
  if (t.startsWith('th')) return 'thu'
  if (t.startsWith('f')) return 'fri'
  if (t.startsWith('sa')) return 'sat'
  return null
}

/** "Mon - Thur" -> ['mon','tue','wed','thu']. "Monday to Friday" works too. */
export function expandDays(spec) {
  const tokens = spec
    .split(new RegExp(RANGE_SEP, 'i'))
    .map((s) => normaliseDay(s.trim()))
    .filter(Boolean)
  if (tokens.length === 0) return []
  if (tokens.length === 1) return tokens
  const from = RANGE_ORDER.indexOf(tokens[0])
  const to = RANGE_ORDER.indexOf(tokens[1])
  if (from === -1 || to === -1) return tokens
  const out = []
  for (let i = from; ; i = (i + 1) % 7) {
    out.push(RANGE_ORDER[i])
    if (i === to) break
  }
  return out
}

const hasMeridiem = (s) => /[ap]\.?\s*m\.?|midnight|noon/i.test(s)

/**
 * "7:30 pm" -> 1170, "midnight" -> 1440, "12 noon" -> 720.
 * `fallback` supplies the am/pm when the token omits it, as in "6 - 8 am"
 * where only the end of the range is marked.
 */
function parseClock(raw, fallback = '') {
  const s = raw.toLowerCase().trim()
  if (s.includes('midnight')) return 1440
  if (s.includes('noon')) return 720

  const m = s.match(/(\d{1,2})(?::(\d{2}))?/)
  if (!m) return null

  const source = hasMeridiem(s) ? s : fallback.toLowerCase()
  const pm = /p\.?\s*m\.?/.test(source)
  const am = /a\.?\s*m\.?/.test(source)
  if (!pm && !am) return null

  let h = Number(m[1]) % 12
  if (pm) h += 12
  return h * 60 + Number(m[2] ?? 0)
}

const pad = (mins) =>
  `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`

/**
 * Pull intervals out of a value string. Returns [] for "Closed".
 *
 * Stated closures ("Closed for Cleaning: 8 - 9 am") are stripped first — they
 * describe a gap that the published intervals already exclude, so parsing them
 * as opening times would make the place look open while it is shut.
 *
 * The "Closed for ..." arm is deliberately generic rather than a list of known
 * reasons. It was a list once, and the page shipped "Closed for Devotional"
 * against the Fitness Studio, which the list did not cover — so an explicit
 * closure was stored as an opening. Matching the phrase instead of the reason
 * means a new reason costs nothing.
 */
export function parseIntervals(value) {
  const cleaned = value
    .replace(/closed for\s+[^|]*/gi, '|')
    .replace(/faculty hour\s*:?[^|]*/gi, '|')
    .replace(/women'?s hour[^|]*/gi, '|')

  if (!/\d/.test(cleaned)) return []

  // The trailing word must be part of the token, or "12 noon" parses as a bare
  // "12" with no am/pm and the whole interval gets dropped.
  const TIME = String.raw`(?:\d{1,2}(?::\d{2})?\s*(?:noon|midnight|[ap]\.?\s*m\.?)?|noon|midnight)`
  const out = []

  for (const chunk of cleaned.split(/[|;]/)) {
    if (!/\d|midnight|noon/i.test(chunk)) continue
    // matchAll, not match: the open-gym page runs two ranges together with no
    // separator at all ("8:15 am - 10:45 am5:15 pm - 10:45 pm"), so a single
    // match would silently drop the evening block.
    const ranges = chunk.matchAll(new RegExp(`(${TIME})\\s*[-–—]\\s*(${TIME})`, 'gi'))

    for (const m of ranges) {
      const end = parseClock(m[2])
      // The start borrows the end's am/pm when it has none: "1 - 10 pm".
      const start = parseClock(m[1], m[2])
      if (start === null || end === null) continue

      // "7:00 am - 12:00 am" runs through to midnight, not backwards in time.
      out.push([pad(start), pad(end <= start ? 1440 : end)])
    }
  }

  return out
}

/**
 * A day row carrying a named override instead of the regular hours, as in
 * "Monday Labor Day Hours6 am - 12 noon".
 *
 * There is deliberately no word-boundary escape after "hours": the page runs the
 * label straight into the first digit ("Hours6 am"), and 's' to '6' is not a
 * word boundary. The lookahead does that job instead, and also stops a stray
 * sentence ending in "hours" from matching.
 */
const HOLIDAY_LABEL =
  /^\s*([A-Za-z][A-Za-z'’.\- ]*?)\s*hours\s*:?\s*(?=\d|noon|midnight|closed)/i

/**
 * The campus date of the next `weekday` on or after today, as YYYY-MM-DD.
 *
 * The pages publish a holiday against a weekday, never a date, so the date has
 * to be inferred. "On or after today" is the right reading: these notices go up
 * shortly before the day and come down after it.
 */
export function upcomingDate(weekday, now = new Date()) {
  const { weekday: today, date } = nowInCampusTime(now)
  const offset = (WEEKDAYS.indexOf(weekday) - WEEKDAYS.indexOf(today) + 7) % 7
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + offset)
  return d.toISOString().slice(0, 10)
}

/**
 * Split a blob into weekday -> intervals. Works with or without colons after
 * the day name. Days the text never mentions are omitted.
 *
 * Holiday rows come back separately rather than folded into `hours`. A holiday's
 * times are true for one date, not every week, and writing them into the weekly
 * slot silently destroys the real hours for that weekday — the Labor Day
 * notice overwrote every Monday for three fitness facilities.
 *
 * @returns {{
 *   hours: Record<string, Array>,
 *   holidays: Array<{weekday: string, date: string, label: string, intervals: Array}>
 * }}
 */
export function parseHoursBlob(text, now = new Date()) {
  // Break before each "Day..." marker — but NOT before a day that is the
  // tail of a range. Without these lookbehinds, "Mon - Thur: 7:00 am" splits at
  // both "Mon" and "Thur", so the range collapses to Thursday alone and Mon-Wed
  // silently come back closed.
  const NOT_RANGE_TAIL = String.raw`(?<![-–—]\s?)(?<!\bto\s)(?<!&\s?)`
  // A holiday row reads "Monday Labor Day Hours6 am", so the day is followed by
  // a label rather than a digit. Allowing a short run of words before the time
  // is what lets that row become its own line at all.
  const BEFORE_TIME = String.raw`(?:[A-Za-z'’.\- ]{0,30}hours\s*:?\s*)?`
  const split = text.replace(
    new RegExp(
      `(?=${NOT_RANGE_TAIL}${DAY_SPEC}\\s*:?\\s*${BEFORE_TIME}(?:\\d|closed))`,
      'gi',
    ),
    '\n',
  )

  const hours = {}
  const holidays = []

  for (const line of split.split('\n')) {
    const m = line.match(new RegExp(`^\\s*(${DAY_SPEC})\\s*:?\\s*(.*)$`, 'i'))
    if (!m) continue
    const days = expandDays(m[1])
    if (days.length === 0) continue

    const named = m[2].match(HOLIDAY_LABEL)
    if (named) {
      const intervals = parseIntervals(m[2].slice(named[0].length))
      for (const day of days) {
        holidays.push({
          weekday: day,
          date: upcomingDate(day, now),
          label: named[1].trim(),
          intervals,
        })
      }
      // Deliberately no `hours[day]` write. This page does not say what the
      // regular hours for that weekday are, so the caller carries forward the
      // previous scrape's value instead of guessing.
      continue
    }

    const intervals = parseIntervals(m[2])
    for (const day of days) hours[day] = intervals
  }

  return { hours, holidays }
}

/** Fill any day the source didn't mention with "closed". */
export function withClosedDefaults(hours) {
  return Object.fromEntries(ALL_DAYS.map((d) => [d, hours[d] ?? []]))
}

/** "Jan 1, 2026" -> ["2026-01-01"]. "Dec 24 - 25, 2026" -> two dates. */
export function parseDates(raw) {
  const MONTHS = {
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
    jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  }
  const m = raw
    .toLowerCase()
    .match(/([a-z]{3})[a-z]*\.?\s+(\d{1,2})(?:\s*[-–—]\s*(\d{1,2}))?,?\s*(\d{4})/)
  if (!m) return []
  const month = MONTHS[m[1]]
  if (!month) return []
  const out = []
  for (let d = Number(m[2]); d <= Number(m[3] ?? m[2]); d++) {
    out.push(`${m[4]}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
  }
  return out
}
