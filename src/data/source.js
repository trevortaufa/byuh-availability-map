/**
 * The seam.
 *
 * Every part of the UI reads facilities through this module and nothing else.
 * Hours come from the scraper as a bundled JSON file; coordinates come from the
 * server, because those are edited live through the admin panel.
 *
 * Rule: no component imports facilities.json or coords.json directly.
 */
import raw from './facilities.json'
import bundledCoords from './coords.json'

const API = '/api/coords'

function stripComment(obj) {
  const { _comment, ...rest } = obj
  return rest
}

/**
 * Coordinates, preferring the live store.
 *
 * Falls back to the file committed in the repo when the API is unreachable —
 * which is the normal case under plain `npm run dev`, since Vite alone does not
 * run serverless functions. A map with slightly stale pins beats no map.
 */
async function fetchCoords() {
  try {
    const res = await fetch(API, { cache: 'no-store' })
    if (!res.ok) throw new Error(`${res.status}`)
    const data = await res.json()
    return { coords: data.coords ?? {}, source: data.source ?? 'api' }
  } catch {
    return { coords: stripComment(bundledCoords), source: 'bundled' }
  }
}

/**
 * @returns {Promise<{generatedAt: string, coordsSource: string, facilities: Facility[]}>}
 */
export async function getFacilities() {
  const { coords, source } = await fetchCoords()

  const facilities = raw.facilities.map((f) => {
    const entry = coords[f.id]
    return {
      ...f,
      // null, not a guessed default: a facility with no location is shown in
      // the list without a pin rather than dropped, or worse, placed at [0,0]
      // in the Gulf of Guinea.
      coords: Array.isArray(entry?.coords) ? entry.coords : null,
      coordsVerified: entry?.verified === true,
    }
  })

  return { generatedAt: raw.generatedAt, coordsSource: source, facilities }
}

/** Persist coordinates. Throws with the server's message on failure. */
export async function saveCoords(coords, token) {
  const res = await fetch(API, {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ coords }),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? `save failed (${res.status})`)
  return data
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
