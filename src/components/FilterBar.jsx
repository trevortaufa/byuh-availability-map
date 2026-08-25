const FILTERS = [
  { id: 'open', label: 'Open now' },
  { id: 'all', label: 'All' },
  { id: 'dining', label: 'Dining' },
  { id: 'library', label: 'Library' },
  { id: 'fitness', label: 'Fitness' },
  { id: 'services', label: 'Services' },
]

/** Horizontally scrollable chips — the standard mobile pattern for filters. */
export default function FilterBar({ active, onChange }) {
  return (
    <div className="filter-bar" role="tablist" aria-label="Filter facilities">
      {FILTERS.map((f) => (
        <button
          key={f.id}
          type="button"
          role="tab"
          aria-selected={active === f.id}
          className={`chip${active === f.id ? ' is-active' : ''}`}
          onClick={() => onChange(f.id)}
        >
          {f.label}
        </button>
      ))}
    </div>
  )
}
