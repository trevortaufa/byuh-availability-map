/**
 * Storage adapter for facility coordinates.
 *
 * This is the server-side twin of src/data/source.js: the API route talks to
 * this module and nothing else, so the store underneath can change without
 * touching the route or the client.
 *
 * Today: a single JSON document in a private Vercel Blob store. That is a
 * deliberate starting point, not a permanent one — for eight facilities and a
 * handful of editors, a document is the right size of tool. When facility
 * managers get their own logins and hours move server-side too, this is the
 * file that becomes a Postgres query. Nothing above it changes.
 */
import { get, put } from '@vercel/blob'
import seed from '../src/data/coords.json' with { type: 'json' }

const BLOB_PATH = 'coords.json'

/** The committed file, minus its documentation key. */
function seedCoords() {
  const { _comment, ...rest } = seed
  return rest
}

export async function readCoords() {
  try {
    // useCache: false — the CDN would otherwise serve a stale copy straight
    // after a save, and the editor would appear to lose the pin you just moved.
    const found = await get(BLOB_PATH, { useCache: false })
    if (!found) return { coords: seedCoords(), source: 'seed', updatedAt: null }

    const text = found.blob?.text
      ? await found.blob.text()
      : await new Response(found.stream).text()
    const parsed = JSON.parse(text)

    return {
      coords: parsed.coords ?? parsed,
      source: 'blob',
      updatedAt: parsed.updatedAt ?? null,
    }
  } catch (err) {
    // A storage outage must not blank the map. Serve the committed file and
    // say so, rather than returning nothing and dropping every pin.
    return {
      coords: seedCoords(),
      source: 'seed-fallback',
      updatedAt: null,
      warning: err.message,
    }
  }
}

export async function writeCoords(coords) {
  const updatedAt = new Date().toISOString()
  await put(BLOB_PATH, JSON.stringify({ coords, updatedAt }, null, 2), {
    access: 'private',
    contentType: 'application/json',
    // Both default to false. Without allowOverwrite every save after the first
    // would fail; without addRandomSuffix:false we'd write a new file each time
    // and never find it again.
    allowOverwrite: true,
    addRandomSuffix: false,
  })
  return { coords, source: 'blob', updatedAt }
}
