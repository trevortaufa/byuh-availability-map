/**
 * Campus time.
 *
 * Everything about "is it open right now" is answered in BYU–Hawaii's local
 * time, never the browser's. A student checking from the mainland, or anyone
 * with a phone still set to their home timezone, must see the same answer as
 * someone standing outside the building.
 *
 * Pacific/Honolulu has no daylight saving, but we still go through Intl rather
 * than hardcoding UTC-10 — that way the rule lives in one place and stays right
 * if it ever changes.
 */

export const CAMPUS_TZ = 'Pacific/Honolulu'

export const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

const WEEKDAY_LABELS = {
  sun: 'Sunday',
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
}

const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: CAMPUS_TZ,
  weekday: 'short',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

/**
 * Resolve a real instant into campus-local weekday, date and minutes-past-midnight.
 * @param {Date} [date] defaults to now; pass a fixed Date in tests
 */
export function nowInCampusTime(date = new Date()) {
  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((p) => [p.type, p.value]),
  )

  // Some engines emit "24" for midnight under hour12:false. Normalise it.
  const hour = parts.hour === '24' ? 0 : Number(parts.hour)
  const minute = Number(parts.minute)

  return {
    weekday: parts.weekday.toLowerCase().slice(0, 3),
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: hour * 60 + minute,
  }
}

/** "07:30" -> 450. "24:00" -> 1440 (end-of-day sentinel). */
export function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/** 450 -> "7:30 AM". Short form so it fits on a phone. */
export function formatTime(minutes) {
  const total = minutes % 1440
  const h24 = Math.floor(total / 60)
  const m = total % 60
  const suffix = h24 < 12 ? 'AM' : 'PM'
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  return m === 0 ? `${h12} ${suffix}` : `${h12}:${String(m).padStart(2, '0')} ${suffix}`
}

/** 'mon' -> 'Monday' */
export function weekdayLabel(key) {
  return WEEKDAY_LABELS[key] ?? key
}

/** The weekday key `offset` days after `weekday`. */
export function addDays(weekday, offset) {
  const i = WEEKDAYS.indexOf(weekday)
  return WEEKDAYS[(i + offset) % 7]
}
