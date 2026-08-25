/**
 * Dev-only pin placer.
 *
 * Drag the markers on the map, then copy the result into src/data/coords.json.
 * There is no save endpoint — this is a static site, so the "database" is a
 * file in the repo and you are the write API. That is the honest version of an
 * admin panel at this stage; a real one needs auth and somewhere to write to.
 */
const round = (n) => Number(n.toFixed(6))

export default function EditPanel({ facilities, coordsFile, overrides, onPlace, onReset }) {
  const moved = Object.keys(overrides)
  const unplaced = facilities.filter((f) => !Array.isArray(f.coords))

  // Rebuild the whole file so it can be pasted over the existing one wholesale,
  // rather than hand-merging a few changed lines.
  const merged = { ...coordsFile }
  for (const f of facilities) {
    const override = overrides[f.id]
    if (override) {
      merged[f.id] = { coords: [round(override[0]), round(override[1])], verified: true }
    }
  }
  const json = JSON.stringify(merged, null, 2) + '\n'

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(json)
    } catch {
      // Clipboard needs a secure context. localhost counts, but just in case.
      window.prompt('Copy this into src/data/coords.json', json)
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

      <p className="edit-hint">
        Anything you drag is marked <code>verified: true</code>. Copy the file,
        paste it over <code>src/data/coords.json</code>, and the map hot-reloads.
      </p>

      <div className="edit-actions">
        <button type="button" className="chip is-active" onClick={copy} disabled={moved.length === 0}>
          Copy coords.json
        </button>
        <button type="button" className="chip" onClick={onReset} disabled={moved.length === 0}>
          Reset
        </button>
      </div>

      {moved.length > 0 && <pre className="edit-json">{json}</pre>}
    </section>
  )
}
