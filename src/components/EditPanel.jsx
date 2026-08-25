import { useState } from 'react'
import { saveCoords } from '../data/source.js'

/**
 * Admin panel for facility locations.
 *
 * Drag a pin on the map, press Save, and it persists for everyone. The token
 * lives in localStorage so you enter it once per device — it is never bundled
 * into the app, and the server rejects any write without it.
 */
const TOKEN_KEY = 'byuh-admin-token'

export default function EditPanel({ facilities, overrides, onPlace, onReset, onSaved }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) ?? '')
  const [status, setStatus] = useState(null)
  const [saving, setSaving] = useState(false)

  const moved = Object.keys(overrides)
  const unplaced = facilities.filter((f) => !Array.isArray(f.coords))

  // Send the whole map, not just what moved — the server replaces the document,
  // so anything omitted would be deleted.
  const payload = {}
  for (const f of facilities) {
    if (!Array.isArray(f.coords)) continue
    payload[f.id] = {
      coords: f.coords,
      verified: overrides[f.id] ? true : f.coordsVerified,
    }
  }

  const save = async () => {
    setSaving(true)
    setStatus(null)
    try {
      localStorage.setItem(TOKEN_KEY, token)
      const result = await saveCoords(payload, token)
      setStatus({ ok: true, text: `Saved ${Object.keys(payload).length} pins` })
      onSaved?.(result)
    } catch (err) {
      setStatus({ ok: false, text: err.message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="edit-panel">
      <header className="edit-head">
        <strong>Pin editor</strong>
        <span className="edit-count">
          {moved.length === 0 ? 'drag a pin to start' : `${moved.length} moved`}
        </span>
      </header>

      {unplaced.length > 0 && (
        <div className="edit-unplaced">
          <span>No pin yet:</span>
          {unplaced.map((f) => (
            <button key={f.id} type="button" className="chip" onClick={() => onPlace(f.id)}>
              + {f.name}
            </button>
          ))}
        </div>
      )}

      <label className="edit-field">
        <span>Admin token</span>
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="paste once, this device remembers it"
          autoComplete="off"
          spellCheck="false"
        />
      </label>

      <div className="edit-actions">
        <button
          type="button"
          className="chip is-active"
          onClick={save}
          disabled={saving || !token || moved.length === 0}
        >
          {saving ? 'Saving\u2026' : 'Save to live site'}
        </button>
        <button type="button" className="chip" onClick={onReset} disabled={moved.length === 0}>
          Discard
        </button>
      </div>

      {status && (
        <p className={`edit-status ${status.ok ? 'is-ok' : 'is-bad'}`}>{status.text}</p>
      )}

      <p className="edit-hint">
        Saving replaces every pin position on the live site immediately. Hours are
        still scraped and deployed separately.
      </p>
    </section>
  )
}
