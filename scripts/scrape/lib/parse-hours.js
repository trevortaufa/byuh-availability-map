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

function expandDays(spec) {
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
 * Parenthetical closures ("Closed for Cleaning: 8 - 9 am") are stripped first —
 * they describe a gap that the published intervals already exclude, so parsing
 * them as opening times would make the place look open while it is being cleaned.
 */
export function parseIntervals(value) {
  const cleaned = value
    .replace(/closed for cleaning\s*:?[^|]*/gi, '|')
    .replace(/faculty hour\s*:?[^|]*/gi, '|')
    .replace(/women'?s hour[^|]*/gi, '|')

  if (!/\d/.test(cleaned)) return []

  // The trailing word must be part of the token, or "12 noon" parses as a bare
  // "12" with no am/pm and the whole interval gets dropped.
  const TIME = String.raw`(?:\d{1,2}(?::\d{2})?\s*(?:noon|midnight|[ap]\.?\s*m\.?)?|noon|midnight)`
  const out = []

  for (const chunk of cleaned.split(/[|;]/)) {
    if (!/\d|midnight|noon/i.test(chunk)) continue
    const m = chunk.match(new RegExp(`(${TIME})\\s*[-–—]\\s*(${TIME})`, 'i'))
    if (!m) continue

    const end = parseClock(m[2])
    // The start borrows the end's am/pm when it has none: "1 - 10 pm".
    const start = parseClock(m[1], m[2])
    if (start === null || end === null) continue

    // "7:00 am - 12:00 am" runs through to midnight, not backwards in time.
    out.push([pad(start), pad(end <= start ? 1440 : end)])
  }

  return out
}

/**
 * Split a blob into weekday -> intervals. Works with or without colons after
 * the day name. Days the text never mentions are omitted.
 */
export function parseHoursBlob(text) {
  // Break before each "Day..." marker — but NOT before a day that is the tail
  // of a range. Without these lookbehinds, "Mon - Thur: 7:00 am" splits at both
  // "Mon" and "Thur", so the range collapses to Thursday alone and Mon–Wed
  // silently come back closed.
  const NOT_RANGE_TAIL = String.raw`(?<![-–—]\s?)(?<!\bto\s)(?<!&\s?)`
  const split = text.replace(
    new RegExp(`(?=${NOT_RANGE_TAIL}${DAY_SPEC}\\s*:?\\s*(?:\\d|closed))`, 'gi'),
    '\n',
  )

  const hours = {}
  for (const line of split.split('\n')) {
    const m = line.match(new RegExp(`^\\s*(${DAY_SPEC})\\s*:?\\s*(.*)$`, 'i'))
    if (!m) continue
    const days = expandDays(m[1])
    if (days.length === 0) continue
    const intervals = parseIntervals(m[2])
    for (const day of days) hours[day] = intervals
  }
  return hours
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
