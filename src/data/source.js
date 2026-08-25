/**
 * The seam.
 *
 * Every part of the UI reads facilities through this module and nothing else.
 * Today it returns a JSON file that a scraper writes. Later it will hit a
 * database or a CMS API. As long as the returned shape stays the same, that
 * swap touches this file only.
 *
 * Rule: no component imports facilities.json directly.
 */
import raw from './facilities.json'

/**
 * @returns {Promise<{generatedAt: string, facilities: Facility[]}>}
 */
export async function getFacilities() {
  return { generatedAt: raw.generatedAt, facilities: raw.facilities }
}

/**
 * @typedef {Object} Facility
 * @property {string} id
 * @property {string} name
 * @property {'library'|'dining'|'fitness'|'services'} category
 * @property {[number, number]} coords            [lat, lng]
 * @property {boolean} coordsVerified
 * @property {string} sourceUrl
 * @property {Record<Weekday, Interval[]>} hours  empty array = closed that day
 * @property {Exception[]} exceptions             dated overrides, beat `hours`
 * @property {string} [notes]
 *
 * @typedef {['00:00'|string, string]} Interval   ["HH:MM", "HH:MM"], "24:00" = midnight
 * @typedef {'mon'|'tue'|'wed'|'thu'|'fri'|'sat'|'sun'} Weekday
 * @typedef {{date: string, intervals: Interval[], label: string}} Exception
 */
