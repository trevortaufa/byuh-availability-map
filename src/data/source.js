/**
 * The seam.
 *
 * Every part of the UI reads facilities through this module and nothing else.
 * Today it joins a scraper-written JSON file to a hand-maintained coordinates
 * file. Later it will hit a database or a CMS API. As long as the returned
 * shape stays the same, that swap touches this file only.
 *
 * Rule: no component imports facilities.json or coords.json directly.
 *
 * Hours and locations come from different places on purpose. Hours are scraped
 * and change often; locations are placed by hand and change almost never.
 * Joining them here means nudging a pin is a file save and a hot reload, not a
 * 40-second re-scrape of four byuh.edu pages.
 */
import raw from './facilities.json'
import coordsFile from './coords.json'

/**
 * @returns {Promise<{generatedAt: string, facilities: Facility[]}>}
 */
export async function getFacilities() {
  const facilities = raw.facilities.map((f) => {
    const entry = coordsFile[f.id]
    return {
      ...f,
      // null, not a guessed default: a facility with no location is shown in
      // the list without a pin rather than dropped, or worse, placed at [0,0]
      // in the Gulf of Guinea.
      coords: entry?.coords ?? null,
      coordsVerified: entry?.verified ?? false,
    }
  })

  return { generatedAt: raw.generatedAt, facilities }
}

/** The current coordinates file, for the dev-only pin editor to start from. */
export function getCoordsFile() {
  return coordsFile
}

/**
 * @typedef {Object} Facility
 * @property {string} id
 * @property {string} name
 * @property {'library'|'dining'|'fitness'|'services'} category
 * @property {[number, number]|null} coords   [lat, lng], or null if unplaced
 * @property {boolean} coordsVerified
 * @property {string} sourceUrl
 * @property {Record<Weekday, Interval[]>} hours  empty array = closed that day
 * @property {Exception[]} exceptions             dated overrides, beat `hours`
 * @property {string} [notes]
 *
 * @typedef {[string, string]} Interval   ["HH:MM", "HH:MM"], "24:00" = midnight
 * @typedef {'mon'|'tue'|'wed'|'thu'|'fri'|'sat'|'sun'} Weekday
 * @typedef {{date: string, intervals: Interval[], label: string}} Exception
 */
