/**
 * The visible half of src/lib/freshness.js.
 *
 * Renders nothing while the data is fresh — a banner that is always on screen
 * stops being read. It appears only once the hours are old enough that the user
 * should double-check them.
 */
export default function FreshnessNotice({ freshness }) {
  if (!freshness?.warning) return null

  return (
    <div className={`freshness-notice is-${freshness.level}`} role="status">
      <span className="freshness-icon" aria-hidden="true">
        {freshness.level === 'fresh' ? '✓' : '⚠'}
      </span>
      <span>{freshness.warning}</span>
    </div>
  )
}
