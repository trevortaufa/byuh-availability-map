import { useEffect } from 'react'
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from 'react-leaflet'
import { getStatus } from '../lib/hours.js'

const CAMPUS_CENTER = [21.6425, -157.927]
const DEFAULT_ZOOM = 16

const OPEN = '#22c55e'
const CLOSED = '#ef4444'

/**
 * Pans the map when the user taps a card in the list below. Has to live inside
 * MapContainer because useMap only works in a child of it.
 */
function PanTo({ facility }) {
  const map = useMap()
  useEffect(() => {
    if (facility) map.flyTo(facility.coords, 17, { duration: 0.6 })
  }, [facility, map])
  return null
}

/**
 * CircleMarker rather than Marker: Leaflet's default pin is a PNG loaded by
 * relative URL, which Vite rewrites and breaks (the classic invisible-markers
 * bug). CircleMarker is pure SVG, needs no asset, and takes a colour directly.
 */
export default function CampusMap({ facilities, selected, onSelect, now }) {
  return (
    <MapContainer
      center={CAMPUS_CENTER}
      zoom={DEFAULT_ZOOM}
      scrollWheelZoom={false}
      zoomControl={false}
      className="campus-map"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <PanTo facility={selected} />
      {facilities.map((f) => {
        const { open } = getStatus(f, now)
        const isSelected = selected?.id === f.id
        return (
          <CircleMarker
            key={f.id}
            center={f.coords}
            radius={isSelected ? 13 : 9}
            eventHandlers={{ click: () => onSelect(f) }}
            pathOptions={{
              color: '#0f172a',
              weight: 2,
              fillColor: open ? OPEN : CLOSED,
              fillOpacity: 0.95,
            }}
          >
            <Tooltip direction="top" offset={[0, -8]}>
              {f.name}
            </Tooltip>
          </CircleMarker>
        )
      })}
    </MapContainer>
  )
}
