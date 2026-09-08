/**
 * How old is the data, and should we say so out loud?
 *
 * The product promises "open right now". That promise is only as good as the
 * last scrape, so the age of the data is part of the answer, not metadata about
 * it — a confident "Open until 10 PM" computed from hours scraped three weeks
 * ago is worse than no answer, because the user makes the walk.
 *
 * Pure functions, no React, so the thresholds can be tested directly.
 */
import { nowInCampusTime } from './time.js'

/**
 * Days after which we start warning, and then warn loudly.
 *
 * Published hours change at semester boundaries and holidays, not daily, so a
 * two-day-old scrape is almost always still correct. A week is long enough for
 * a term to have turned over underneath us.
 */
const AGING_AFTER_DAYS = 3
const STALE_AFTER_DAYS = 7

/** Whole campus-calendar days between two instants. */
function daysBetween(then, now) {
  // Compare campus dates, not raw elapsed milliseconds, so "yesterday" means
  // the day before on the island rather than a rolling 24 hours.
  const a = nowInCampusTime(then).date
  const b = nowInCampusTime(now).date
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000)
}

/** "today" | "yesterday" | "6 days ago" */
function relativeLabel(days) {
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  return `${days} days ago`
}

/**
 * @param {string|null|undefined} generatedAt ISO timestamp from the scraper
 * @param {Date} [now]
 * @returns {{
 *   level: 'fresh'|'aging'|'stale'|'unknown',
 *   ageDays: number|null,
 *   label: string,     // always shown, e.g. "Hours updated yesterday"
 *   warning: string|null  // shown as a banner only when not fresh
 * }}
 */
export function getFreshness(generatedAt, now = new Date()) {
  const then = generatedAt ? new Date(generatedAt) : null

  // An unparseable or missing timestamp is itself a reason to distrust the
  // data, so it warns rather than quietly rendering nothing.
  if (!then || Number.isNaN(then.getTime())) {
    return {
      level: 'unknown',
      ageDays: null,
      label: 'Hours last updated at an unknown time',
      warning: "These hours have no recorded update time — check the official page.",
    }
  }

  const ageDays = Math.max(0, daysBetween(then, now))
  const label = `Hours updated ${relativeLabel(ageDays)}`

  if (ageDays >= STALE_AFTER_DAYS) {
    return {
      level: 'stale',
      ageDays,
      label,
      warning: `These hours are ${ageDays} days old and may be wrong — check the official page before making the walk.`,
    }
  }

  if (ageDays >= AGING_AFTER_DAYS) {
    return {
      level: 'aging',
      ageDays,
      label,
      warning: `These hours were last checked ${ageDays} days ago.`,
    }
  }

  return { level: 'fresh', ageDays, label, warning: null }
}
