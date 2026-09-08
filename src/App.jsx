import { useEffect, useMemo, useState } from 'react'
import { getFacilities } from './data/source.js'
import { getStatus, sortByStatus } from './lib/hours.js'
import { getFreshness } from './lib/freshness.js'
import CampusMap, { CAMPUS_CENTER } from './components/CampusMap.jsx'
import FacilityList from './components/FacilityList.jsx'
import FilterBar from './components/FilterBar.jsx'
import EditPanel from './components/EditPanel.jsx'
import FreshnessNotice from './components/FreshnessNotice.jsx'

/**
 * The admin panel is reachable on the live site at ?edit=1.
 *
 * It is deliberately not secret. Anyone can open it and drag a pin around their
 * own screen; nothing persists without the admin token, which is checked on the
 * server. Hiding the UI would be security theatre — the API is the boundary.
 */
const EDIT_MODE = new URLSearchParams(window.location.search).has('edit')

export default function App() {
  const [data, setData] = useState(null)
  const [filter, setFilter] = useState(EDIT_MODE ? 'all' : 'open')
  const [selected, setSelected] = useState(null)
  const [overrides, setOverrides] = useState({})

  // A clock the UI re-reads, so a place that closes at 10 PM flips to Closed
  // without the user pulling to refresh. 30s is well under the granularity of
  // any published opening time.
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    getFacilities().then(setData)
  }, [])

  // Dragged positions win over the file until they're copied back into it.
  const facilities = useMemo(() => {
    const base = data?.facilities ?? []
    if (!EDIT_MODE) return base
    return base.map((f) => (overrides[f.id] ? { ...f, coords: overrides[f.id] } : f))
  }, [data, overrides])

  const visible = useMemo(() => {
    const matching = facilities.filter((f) => {
      if (filter === 'all') return true
      if (filter === 'open') return getStatus(f, now).open
      return f.category === filter
    })
    return sortByStatus(matching, now)
  }, [facilities, filter, now])

  const openCount = facilities.filter((f) => getStatus(f, now).open).length

  // Recomputed against the same ticking clock as the statuses, so the page
  // ages in place rather than only on reload.
  const freshness = useMemo(() => getFreshness(data?.generatedAt, now), [data, now])

  const handleMove = (id, coords) => setOverrides((o) => ({ ...o, [id]: coords }))
  // An unplaced facility has no pin to drag, so drop one at campus centre first.
  const handlePlace = (id) => handleMove(id, CAMPUS_CENTER)

  return (
    <div className="app">
      <header className="app-header">
        <h1>{EDIT_MODE ? 'Pin editor' : 'What\u2019s open'}</h1>
        <p className="subtitle">
          {data
            ? EDIT_MODE
              ? 'Drag any pin to reposition it'
              : `${openCount} of ${facilities.length} open right now on campus`
            : 'BYU\u2013Hawaii'}
        </p>
      </header>

      {data ? (
        <>
          <CampusMap
            facilities={facilities}
            selected={selected}
            onSelect={setSelected}
            now={now}
            editMode={EDIT_MODE}
            onMove={handleMove}
          />

          {EDIT_MODE ? (
            <EditPanel
              facilities={facilities}
              overrides={overrides}
              onPlace={handlePlace}
              onReset={() => setOverrides({})}
              onSaved={() => {
                // Re-read from the server so what is on screen is what is
                // stored, rather than what we hoped we stored.
                setOverrides({})
                getFacilities().then(setData)
              }}
            />
          ) : (
            <>
              <FreshnessNotice freshness={freshness} />
              <FilterBar active={filter} onChange={setFilter} />
              <FacilityList
                facilities={visible}
                selected={selected}
                onSelect={setSelected}
                now={now}
              />
              <footer className="app-footer">
                {freshness.label} from byuh.edu. Locations approximate. Always check
                the official page before making the walk.
              </footer>
            </>
          )}
        </>
      ) : (
        <p className="loading">Loading&hellip;</p>
      )}
    </div>
  )
}
