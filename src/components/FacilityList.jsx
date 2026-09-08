import { getStatus } from '../lib/hours.js'

const CATEGORY_ICONS = {
  library: '📚',
  dining: '🍽️',
  fitness: '🏋️',
  services: '🏢',
}

export default function FacilityList({ facilities, selected, onSelect, now }) {
  if (facilities.length === 0) {
    return <p className="empty">Nothing matches that filter.</p>
  }

  return (
    <ul className="facility-list">
      {facilities.map((f) => {
        const { open, label, detail } = getStatus(f, now)
        return (
          <li key={f.id}>
            <button
              type="button"
              className={`facility-card${selected?.id === f.id ? ' is-selected' : ''}`}
              onClick={() => onSelect(f)}
            >
              <span className="facility-icon" aria-hidden="true">
                {CATEGORY_ICONS[f.category] ?? '📍'}
              </span>
              <span className="facility-body">
                <span className="facility-name">
                  {f.name}
                  {/* This source failed its last scrape, so these hours are
                      older than the rest of the page. */}
                  {f.stale && <span className="stale-badge">old</span>}
                </span>
                <span className={`facility-status ${open ? 'is-open' : 'is-closed'}`}>
                  {label}
                  {detail && <span className="facility-detail"> · {detail}</span>}
                </span>
              </span>
              <span className={`status-dot ${open ? 'is-open' : 'is-closed'}`} aria-hidden="true" />
              <span className="sr-only">{open ? 'Open' : 'Closed'}</span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
