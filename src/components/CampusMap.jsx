import { useEffect } from 'react'
import L from 'leaflet'
import { MapContainer, TileLayer, CircleMarker, Marker, Tooltip, useMap } from 'react-leaflet'
import { getStatus } from '../lib/hours.js'

export const CAMPUS_CENTER = [21.6425, -157.927]
const DEFAULT_ZOOM = 16

/**
 * Pans the map when the user taps a card in the list below. Has to live inside
 * MapContainer because useMap only works in a child of it.
 */
function PanTo({ facility }) {
  const map = useMap()
  useEffect(() => {
    if (facility?.coords) map.flyTo(facility.coords, 17, { duration: 0.6 })
  }, [facility, map])
  return null
}

/**
 * A marker whose icon is HTML instead of an image file.
 *
 * Leaflet only implements dragging on Marker, not CircleMarker — but Marker's
 * default icon is a PNG loaded by relative URL, which Vite rewrites and breaks
 * (the classic invisible-pins bug). A divIcon gets us a draggable marker with
 * no asset to break, styled entirely in CSS.
 */
function dotIcon(open, selected) {
  const size = selected ? 26 : 20
  return L.divIcon({
    // Setting className replaces Leaflet's default white box and border.
    className: 'pin-wrap',
    html: `<span class="pin-dot ${open ? 'is-open' : 'is-closed'}${selected ? ' is-selected' : ''}"></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

export default function CampusMap({ facilities, selected, onSelect, now, editMode, onMove }) {
  // A facility with no coordinates yet still appears in the list below; it just
  // has no pin. Rendering it at a default position would be a lie.
  const placed = facilities.filter((f) => Array.isArray(f.coords))

  return (
    <MapContainer
      center={CAMPUS_CENTER}
      zoom={DEFAULT_ZOOM}
      scrollWheelZoom={editMode}
      zoomControl={editMode}
      className={`campus-map${editMode ? ' is-editing' : ''}`}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <PanTo facility={editMode ? null : selected} />

      {placed.map((f) => {
        const { open } = getStatus(f, now)
        const isSelected = selected?.id === f.id

        if (editMode) {
          return (
            <Marker
              key={f.id}
              position={f.coords}
              draggable
              icon={dotIcon(open, isSelected)}
              eventHandlers={{
                click: () => onSelect(f),
                dragend: (e) => {
                  const { lat, lng } = e.target.getLatLng()
                  // 6 decimal places is about 11cm — far finer than a building.
                  onMove(f.id, [Number(lat.toFixed(6)), Number(lng.toFixed(6))])
                },
              }}
            >
              <Tooltip direction="top" offset={[0, -12]} permanent={isSelected}>
                {f.name}
              </Tooltip>
            </Marker>
          )
        }

        return (
          <CircleMarker
            key={f.id}
            center={f.coords}
            radius={isSelected ? 13 : 9}
            eventHandlers={{ click: () => onSelect(f) }}
            pathOptions={{
              color: '#0f172a',
              weight: 2,
              fillColor: open ? '#22c55e' : '#ef4444',
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
