/**
 * GET  /api/coords  — public. Returns the current facility coordinates.
 * PUT  /api/coords  — requires the admin token. Replaces them.
 *
 * Reads are public because the map is public. Only writing is gated.
 */
import { timingSafeEqual } from 'node:crypto'
import { readCoords, writeCoords } from '../server/store.js'
import { validateCoords } from '../server/validate.js'

const MAX_BODY_BYTES = 64 * 1024

/**
 * Constant-time comparison.
 *
 * A plain `a === b` returns as soon as two characters differ, so how long it
 * takes leaks how much of the token was right. Repeated over many guesses that
 * is enough to recover a secret one character at a time. timingSafeEqual always
 * looks at every byte.
 */
function tokenMatches(supplied, expected) {
  if (typeof supplied !== 'string' || supplied.length === 0) return false
  const a = Buffer.from(supplied)
  const b = Buffer.from(expected)
  // timingSafeEqual throws on length mismatch, which would itself leak length.
  if (a.length !== b.length) {
    timingSafeEqual(b, b)
    return false
  }
  return timingSafeEqual(a, b)
}

function bearer(req) {
  const header = req.headers?.authorization ?? ''
  return header.startsWith('Bearer ') ? header.slice(7) : ''
}

export default async function handler(req, res) {
  res.setHeader('cache-control', 'no-store')

  if (req.method === 'GET') {
    return res.status(200).json(await readCoords())
  }

  if (req.method !== 'PUT') {
    res.setHeader('allow', 'GET, PUT')
    return res.status(405).json({ error: 'method not allowed' })
  }

  const expected = process.env.ADMIN_TOKEN
  if (!expected) {
    // Fail closed. An unset token must never mean "anyone may write".
    return res.status(503).json({ error: 'ADMIN_TOKEN is not configured on the server' })
  }

  if (!tokenMatches(bearer(req), expected)) {
    return res.status(401).json({ error: 'bad or missing admin token' })
  }

  let body = req.body
  if (typeof body === 'string') {
    if (Buffer.byteLength(body) > MAX_BODY_BYTES) {
      return res.status(413).json({ error: 'body too large' })
    }
    try {
      body = JSON.parse(body)
    } catch {
      return res.status(400).json({ error: 'body is not valid JSON' })
    }
  }

  const result = validateCoords(body?.coords)
  if (!result.ok) return res.status(400).json({ error: result.error })

  try {
    return res.status(200).json(await writeCoords(result.coords))
  } catch (err) {
    return res.status(502).json({ error: `write failed: ${err.message}` })
  }
}
