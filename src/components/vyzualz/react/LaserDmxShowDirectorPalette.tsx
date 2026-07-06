import { useMemo, useState, type DragEvent } from 'react'
import {
  LASER_DMX_SHOW_DIRECTOR_FIXTURE_KINDS,
  LASER_DMX_SHOW_DIRECTOR_FIXTURE_KIND_LABELS,
  type LaserDmxShowDirectorFixtureKind,
} from './ReactTypes'

export const SHOW_DIRECTOR_FIXTURE_DRAG_TYPE = 'application/x-drmvyz-show-director-fixture-kind'

const FIXTURE_SEARCH_TEXT: Record<LaserDmxShowDirectorFixtureKind, string> = {
  laser:      'laser dmx beam projector fan sweep drop',
  movingHead: 'moving head pan tilt beam spot wash',
  ledBar:     'led bar light strip row cells wash',
  ledTube:    'led tube pixel vertical tube accent',
  strobe:     'strobe flash hit white burst',
  blinder:    'blinder audience warm blast four light',
  parWash:    'par wash color fill can circular',
  videoWall:  'video wall screen panel visual',
  haze:       'haze fog atmosphere smoke',
  co2Jet:     'co2 cryo jet plume burst impact',
}

function normalizeSearch(value: string): string {
  return value.trim().toLowerCase()
}

function FixtureIcon({ kind }: { kind: LaserDmxShowDirectorFixtureKind }) {
  switch (kind) {
    case 'laser':
      return (
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <path d="M5 19h8l4-5v10l-4-5" />
          <path d="M17 15 29 7M17 19h12M17 23l12 7" />
        </svg>
      )
    case 'movingHead':
      return (
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <path d="M9 26h14M12 21h8l3-7-7-5-7 5Z" />
          <path d="M16 9V4M8 16c-2 2-2 5 0 7M24 16c2 2 2 5 0 7" />
        </svg>
      )
    case 'ledBar':
      return (
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <path d="M5 12h22v8H5Z" />
          <path d="M9 12v8M13.5 12v8M18.5 12v8M23 12v8" />
        </svg>
      )
    case 'ledTube':
      return (
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <path d="M14 5h4M14 27h4M16 6v20" />
          <path d="M10 9c4 2 8 2 12 0M10 23c4-2 8-2 12 0" />
        </svg>
      )
    case 'strobe':
      return (
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <path d="m16 4 2.4 7 6.8-3-3 6.8 7 2.2-7 2.4 3 6.8-6.8-3L16 30l-2.4-6.8-6.8 3 3-6.8-7-2.4 7-2.2-3-6.8 6.8 3Z" />
          <circle cx="16" cy="17" r="3" />
        </svg>
      )
    case 'blinder':
      return (
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <path d="M8 8h16v16H8Z" />
          <circle cx="13" cy="13" r="2.5" />
          <circle cx="19" cy="13" r="2.5" />
          <circle cx="13" cy="19" r="2.5" />
          <circle cx="19" cy="19" r="2.5" />
        </svg>
      )
    case 'parWash':
      return (
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <circle cx="16" cy="16" r="8" />
          <path d="M8 23h16M11 24l-3 4M21 24l3 4" />
          <path d="M12 16h8M16 12v8" />
        </svg>
      )
    case 'videoWall':
      return (
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <path d="M5 7h22v18H5Z" />
          <path d="M12.3 7v18M19.7 7v18M5 16h22" />
        </svg>
      )
    case 'haze':
      return (
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <path d="M7 20h14a5 5 0 0 0-4-8 7 7 0 0 0-13 3" />
          <path d="M5 24h18M10 27h14M21 13c3 0 5 2 5 5" />
        </svg>
      )
    case 'co2Jet':
      return (
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <path d="M14 27h4l1-6h-6Z" />
          <path d="M16 4c4 4 5 8 2 13M16 4c-4 4-5 8-2 13M16 4v15" />
          <path d="M9 10c2 1 4 1 7-6 3 7 5 7 7 6" />
        </svg>
      )
    default:
      return null
  }
}

export function LaserDmxShowDirectorPalette() {
  const [query, setQuery] = useState('')
  const normalizedQuery = normalizeSearch(query)

  const filteredKinds = useMemo(() => {
    if (!normalizedQuery) return LASER_DMX_SHOW_DIRECTOR_FIXTURE_KINDS
    return LASER_DMX_SHOW_DIRECTOR_FIXTURE_KINDS.filter(kind => {
      const label = LASER_DMX_SHOW_DIRECTOR_FIXTURE_KIND_LABELS[kind]
      return `${label} ${FIXTURE_SEARCH_TEXT[kind]} ${kind}`.toLowerCase().includes(normalizedQuery)
    })
  }, [normalizedQuery])

  const handleDragStart = (event: DragEvent<HTMLButtonElement>, kind: LaserDmxShowDirectorFixtureKind) => {
    event.dataTransfer.effectAllowed = 'copy'
    event.dataTransfer.setData(SHOW_DIRECTOR_FIXTURE_DRAG_TYPE, kind)
    event.dataTransfer.setData('text/plain', LASER_DMX_SHOW_DIRECTOR_FIXTURE_KIND_LABELS[kind])
  }

  return (
    <aside className="rv-show-director-panel rv-show-director-palette" aria-label="Show Director component palette">
      <div className="rv-show-director-panel__header">
        <h4>Lighting Components</h4>
      </div>

      <label className="rv-show-director-search">
        <span>Search components</span>
        <input
          type="search"
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="Laser, strobe, CO2..."
          spellCheck={false}
        />
      </label>

      <div className="rv-show-director-palette__list" role="list">
        {filteredKinds.map(kind => {
          const label = LASER_DMX_SHOW_DIRECTOR_FIXTURE_KIND_LABELS[kind]
          return (
            <button
              key={kind}
              type="button"
              className="rv-show-director-component-card"
              draggable
              onDragStart={event => handleDragStart(event, kind)}
              role="listitem"
              aria-label={`Add ${label} to the Show Director canvas`}
            >
              <span className="rv-show-director-component-card__icon" aria-hidden="true"><FixtureIcon kind={kind} /></span>
              <span className="rv-show-director-component-card__label">{label}</span>
            </button>
          )
        })}
      </div>

      {filteredKinds.length === 0 && (
        <div className="rv-show-director-empty rv-show-director-empty--compact">
          No components matched “{query}”.
        </div>
      )}
    </aside>
  )
}
