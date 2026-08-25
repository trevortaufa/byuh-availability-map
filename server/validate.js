/**
 * Server-side validation of anything a client sends.
 *
 * The editor is open to the public — only saving is gated — so this runs on
 * data that anyone with the admin token can shape, and it must assume that
 * data is hostile. Client-side checks are a convenience for honest users; this
 * is the one that counts.
 */
const ID = /^[a-z0-9][a-z0-9-]{0,63}$/
const MAX_FACILITIES = 200

export function validateCoords(input) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'body.coords must be an object' }
  }

  const entries = Object.entries(input)
  if (entries.length > MAX_FACILITIES) {
    return { ok: false, error: `too many facilities (max ${MAX_FACILITIES})` }
  }

  const clean = {}
  for (const [id, value] of entries) {
    if (id === '_comment') continue
    if (!ID.test(id)) return { ok: false, error: `bad facility id: ${id}` }
    if (!value || typeof value !== 'object') {
      return { ok: false, error: `${id}: entry must be an object` }
    }

    const { coords, verified } = value
    if (!Array.isArray(coords) || coords.length !== 2) {
      return { ok: false, error: `${id}: coords must be [lat, lng]` }
    }

    const [lat, lng] = coords
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      return { ok: false, error: `${id}: latitude out of range` }
    }
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
      return { ok: false, error: `${id}: longitude out of range` }
    }

    clean[id] = {
      // Re-round server-side rather than trusting the client's precision.
      coords: [Number(lat.toFixed(6)), Number(lng.toFixed(6))],
      verified: verified === true,
    }
  }

  return { ok: true, coords: clean }
}
