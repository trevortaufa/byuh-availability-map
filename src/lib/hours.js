/**
 * Open / closed logic. This is the whole product — everything else is chrome.
 *
 * Stored hours are a list of intervals per weekday, so a day can have gaps
 * (the Fitness Center shuts 8–9am to clean and 12–1pm for faculty hour).
 * "24:00" means midnight at the end of that day, so no interval ever crosses
 * a day boundary and we never have to look at yesterday.
 *
 * Dated `exceptions` (holidays) replace that day's intervals entirely.
 */
import {
  nowInCampusTime,
  toMinutes,
  formatTime,
  weekdayLabel,
  addDays,
} from './time.js'

/** Intervals in effect for a facility on a given campus date/weekday. */
function intervalsFor(facility, weekday, date) {
  const exception = facility.exceptions?.find((e) => e.date === date)
  if (exception) return { intervals: exception.intervals, exception }
  return { intervals: facility.hours[weekday] ?? [], exception: null }
}

/**
 * Full status for one facility.
 *
 * @returns {{
 *   open: boolean,
 *   label: string,        // ready to render, e.g. "Open until 10 PM"
 *   detail: string|null,  // secondary line, e.g. "Reopens 1 PM"
 *   exception: object|null
 * }}
 */
export function getStatus(facility, now = new Date()) {
  const { weekday, date, minutes } = nowInCampusTime(now)
  const { intervals, exception } = intervalsFor(facility, weekday, date)

  const current = intervals.find(
    ([start, end]) => minutes >= toMinutes(start) && minutes < toMinutes(end),
  )

  if (current) {
    return {
      open: true,
      label: `Open until ${formatTime(toMinutes(current[1]))}`,
      detail: exception ? exception.label : null,
      exception,
    }
  }

  // Closed. Find the next opening — later today first, then scan ahead a week.
  const laterToday = intervals.find(([start]) => toMinutes(start) > minutes)
  if (laterToday) {
    return {
      open: false,
      label: 'Closed',
      detail: `Reopens ${formatTime(toMinutes(laterToday[0]))}`,
      exception,
    }
  }

  for (let offset = 1; offset <= 7; offset++) {
    const day = addDays(weekday, offset)
    const next = (facility.hours[day] ?? [])[0]
    if (!next) continue
    const when = offset === 1 ? 'tomorrow' : weekdayLabel(day)
    return {
      open: false,
      label: 'Closed',
      detail: `Opens ${when} ${formatTime(toMinutes(next[0]))}`,
      exception,
    }
  }

  return { open: false, label: 'Closed', detail: 'No hours listed', exception }
}

/** Open facilities first, then alphabetical. Used for the mobile list. */
export function sortByStatus(facilities, now = new Date()) {
  return [...facilities].sort((a, b) => {
    const openA = getStatus(a, now).open
    const openB = getStatus(b, now).open
    if (openA !== openB) return openA ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}
