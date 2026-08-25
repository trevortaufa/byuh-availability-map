/**
 * Polite fetching.
 *
 * byuh.edu's robots.txt sets `Crawl-delay: 10`, so we serialise every request
 * and wait 10s between them. This is not optional politeness — ignoring a
 * stated crawl-delay is how a scraper gets an IP blocked.
 */
import { load } from 'cheerio'

const CRAWL_DELAY_MS = 10_000
const USER_AGENT =
  'byuh-availability-map/0.1 (personal project; taufat@polynesia.com)'

let lastRequest = 0

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Fetch a page and hand back a loaded cheerio document. */
export async function fetchDoc(url) {
  const since = Date.now() - lastRequest
  if (lastRequest && since < CRAWL_DELAY_MS) {
    await sleep(CRAWL_DELAY_MS - since)
  }
  lastRequest = Date.now()

  const res = await fetch(url, {
    headers: { 'user-agent': USER_AGENT },
    signal: AbortSignal.timeout(20_000),
  })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`)
  return load(await res.text())
}
