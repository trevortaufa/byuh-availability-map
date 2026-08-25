/**
 * Runs every scraper and writes src/data/facilities.json.
 *
 * Failure rule: a broken source must never blank out good data. If one scraper
 * throws, we keep whatever that source produced last time and mark it stale,
 * rather than dropping those facilities off the map. A map that quietly loses
 * the library is worse than one showing yesterday's library hours.
 *
 *   node scripts/scrape/index.js
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import * as library from './library.js'
import * as seasider from './seasider.js'
import * as banyan from './banyan.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = join(HERE, '..', '..', 'src', 'data', 'facilities.json')
const COORDS = JSON.parse(readFileSync(join(HERE, 'coords.json'), 'utf8'))

const SOURCES = [
  { name: 'library', mod: library },
  { name: 'seasider', mod: seasider },
  { name: 'banyan', mod: banyan },
]

function readPrevious() {
  try {
    return JSON.parse(readFileSync(OUT, 'utf8'))
  } catch {
    return { facilities: [] }
  }
}

/** Reject anything malformed before it reaches the app. */
function validate(f) {
  const problems = []
  if (!f.id) problems.push('missing id')
  if (!f.name) problems.push('missing name')
  if (!['library', 'dining', 'fitness', 'services'].includes(f.category)) {
    problems.push(`bad category "${f.category}"`)
  }
  if (!Array.isArray(f.coords) || f.coords.length !== 2) problems.push('missing coords')
  for (const [day, intervals] of Object.entries(f.hours ?? {})) {
    for (const iv of intervals) {
      if (!/^\d{2}:\d{2}$/.test(iv[0]) || !/^\d{2}:\d{2}$/.test(iv[1])) {
        problems.push(`bad interval on ${day}: ${JSON.stringify(iv)}`)
      }
    }
  }
  return problems
}

async function main() {
  const previous = readPrevious()
  const byId = new Map()
  let failures = 0

  for (const { name, mod } of SOURCES) {
    try {
      const facilities = await mod.scrape()
      for (const f of facilities) byId.set(f.id, { ...f, stale: false })
      console.log(`  ok    ${name.padEnd(10)} ${facilities.length} facilities`)
    } catch (err) {
      failures++
      const kept = previous.facilities.filter((f) => f.sourceUrl === mod.SOURCE_URL)
      for (const f of kept) byId.set(f.id, { ...f, stale: true })
      console.error(`  FAIL  ${name.padEnd(10)} ${err.message}`)
      console.error(`        kept ${kept.length} previous entries, marked stale`)
    }
  }

  const facilities = []
  for (const f of byId.values()) {
    const coord = COORDS[f.id]
    if (!coord) {
      console.error(`  SKIP  ${f.id} — no entry in coords.json, add one`)
      continue
    }
    const merged = { ...f, coords: coord.coords, coordsVerified: coord.verified }
    const problems = validate(merged)
    if (problems.length) {
      console.error(`  SKIP  ${f.id} — ${problems.join('; ')}`)
      continue
    }
    facilities.push(merged)
  }

  if (facilities.length === 0) {
    console.error('\nNothing valid to write. Leaving the existing file alone.')
    process.exit(1)
  }

  facilities.sort((a, b) => a.name.localeCompare(b.name))
  writeFileSync(
    OUT,
    JSON.stringify(
      { generatedAt: new Date().toISOString(), source: 'scripts/scrape', facilities },
      null,
      2,
    ) + '\n',
  )

  console.log(`\nWrote ${facilities.length} facilities to src/data/facilities.json`)
  if (failures) console.log(`${failures} source(s) failed — those entries are marked stale.`)
}

main()
