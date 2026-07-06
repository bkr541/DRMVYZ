import { useMemo, useState, type DragEvent } from 'react'
import {
  LASER_DMX_SHOW_DIRECTOR_FIXTURE_KINDS,
  LASER_DMX_SHOW_DIRECTOR_FIXTURE_KIND_LABELS,
  type LaserDmxShowDirectorFixtureKind,
} from './ReactTypes'

export const SHOW_DIRECTOR_FIXTURE_DRAG_TYPE = 'application/x-drmvyz-show-director-fixture-kind'

const FIXTURE_META: Record<LaserDmxShowDirectorFixtureKind, { icon: string; description: string }> = {
  laser:      { icon: '◇', description: 'Sharp DMX beam projector for drops, sweeps, and gates.' },
  movingHead: { icon: '◉', description: 'Pan/tilt fixture shell for future target and movement control.' },
  ledBar:     { icon: '▰', description: 'Linear LED wash or segmented strip for stage edges.' },
  ledTube:    { icon: '┃', description: 'Vertical tube pixel accent for stacked reactive looks.' },
  strobe:     { icon: '✦', description: 'High-impact flash source for hits and fills.' },
  blinder:    { icon: '●', description: 'Audience-facing warm blast fixture placeholder.' },
  parWash:    { icon: '⬤', description: 'Wide wash light for color fields and stage fill.' },
  videoWall:  { icon: '▦', description: 'Screen or panel element for future visual routing.' },
  haze:       { icon: '≈', description: 'Atmosphere source for fog and haze timing.' },
  co2Jet:     { icon: '↟', description: 'CO2 jet burst marker for impacts and phrase moments.' },
}

function normalizeSearch(value: string): string {
  return value.trim().toLowerCase()
}

export function LaserDmxShowDirectorPalette() {
  const [query, setQuery] = useState('')
  const normalizedQuery = normalizeSearch(query)

  const filteredKinds = useMemo(() => {
    if (!normalizedQuery) return LASER_DMX_SHOW_DIRECTOR_FIXTURE_KINDS
    return LASER_DMX_SHOW_DIRECTOR_FIXTURE_KINDS.filter(kind => {
      const label = LASER_DMX_SHOW_DIRECTOR_FIXTURE_KIND_LABELS[kind]
      const description = FIXTURE_META[kind].description
      return `${label} ${description} ${kind}`.toLowerCase().includes(normalizedQuery)
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
        <span className="rv-show-director-kicker">Palette</span>
        <h4>Lighting Components</h4>
        <p>Drag a component into the stage grid to create a Show Director fixture.</p>
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
          const meta = FIXTURE_META[kind]
          const label = LASER_DMX_SHOW_DIRECTOR_FIXTURE_KIND_LABELS[kind]
          return (
            <button
              key={kind}
              type="button"
              className="rv-show-director-component-card"
              draggable
              onDragStart={event => handleDragStart(event, kind)}
              role="listitem"
              aria-label={`Drag ${label} into the Show Director canvas`}
            >
              <span className="rv-show-director-component-card__icon" aria-hidden="true">{meta.icon}</span>
              <span className="rv-show-director-component-card__body">
                <span className="rv-show-director-component-card__label">{label}</span>
                <span className="rv-show-director-component-card__description">{meta.description}</span>
              </span>
              <span className="rv-show-director-component-card__drag" aria-hidden="true">Drag</span>
            </button>
          )
        })}
      </div>

      {filteredKinds.length === 0 && (
        <div className="rv-show-director-empty rv-show-director-empty--compact">
          No components matched “{query}”. Try “laser”, “bar”, or “haze”.
        </div>
      )}
    </aside>
  )
}
