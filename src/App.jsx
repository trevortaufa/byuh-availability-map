import { useEffect, useMemo, useState } from 'react'
import { getFacilities } from './data/source.js'
import { getStatus, sortByStatus } from './lib/hours.js'
import CampusMap from './components/CampusMap.jsx'
import FacilityList from './components/FacilityList.jsx'
import FilterBar from './components/FilterBar.jsx'

export default function App() {
  const [data, setData] = useState(null)
  const [filter, setFilter] = useState('open')
  const [selected, setSelected] = useState(null)

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

  const facilities = data?.facilities ?? []

  const visible = useMemo(() => {
    const matching = facilities.filter((f) => {
      if (filter === 'all') return true
      if (filter === 'open') return getStatus(f, now).open
      return f.category === filter
    })
    return sortByStatus(matching, now)
  }, [facilities, filter, now])

  const openCount = facilities.filter((f) => getStatus(f, now).open).length

  return (
    <div className="app">
      <header className="app-header">
        <h1>What&rsquo;s open</h1>
        <p className="subtitle">
          {data
            ? `${openCount} of ${facilities.length} open right now on campus`
            : 'BYU–Hawaii'}
        </p>
      </header>

      {data ? (
        <>
          <CampusMap
            facilities={facilities}
            selected={selected}
            onSelect={setSelected}
            now={now}
          />
          <FilterBar active={filter} onChange={setFilter} />
          <FacilityList
            facilities={visible}
            selected={selected}
            onSelect={setSelected}
            now={now}
          />
          <footer className="app-footer">
            Hours scraped from byuh.edu. Locations approximate. Always check the
            official page before making the walk.
          </footer>
        </>
      ) : (
        <p className="loading">Loading&hellip;</p>
      )}
    </div>
  )
}
