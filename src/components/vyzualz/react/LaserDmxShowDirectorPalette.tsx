import { useMemo, useState, type DragEvent } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useReactStore } from '../../../stores/reactStore'
import {
  LASER_DMX_SHOW_DIRECTOR_FIXTURE_KINDS,
  LASER_DMX_SHOW_DIRECTOR_FIXTURE_KIND_LABELS,
  type LaserDmxShowDirectorFixtureKind,
} from './ReactTypes'
import { LaserDmxShowDirectorGlobalControls } from './LaserDmxShowDirectorControls'

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
      return <img src="/laser-dmx-icons/Laser.svg" alt="" />
    case 'movingHead':
      return <img src="/laser-dmx-icons/OverheadLight.svg" alt="" />
    case 'ledBar':
      return <img src="/laser-dmx-icons/LEDBar.svg" alt="" />
    case 'blinder':
      return <img src="/laser-dmx-icons/BlinderLight.svg" alt="" />
    case 'ledTube':
      return <img src="/laser-dmx-icons/LEDTube.svg" alt="" />
    case 'strobe':
      return <img src="/laser-dmx-icons/Strobe.svg" alt="" />
    case 'parWash':
      return <img src="/laser-dmx-icons/ParWash.svg" alt="" />
    case 'videoWall':
      return <img src="/laser-dmx-icons/VideoWall.svg" alt="" />
    case 'haze':
      return <img src="/laser-dmx-icons/Hazer.svg" alt="" />
    case 'co2Jet':
      return <img src="/laser-dmx-icons/CO2.svg" alt="" />
    default:
      return null
  }
}

export function LaserDmxShowDirectorPalette() {
  const [query, setQuery] = useState('')
  const { addFixture, setAuthoringMode } = useReactStore(useShallow(s => ({
    addFixture:       s.addLaserDmxShowDirectorFixture,
    setAuthoringMode: s.setLaserDmxBeamMatrixAuthoringMode,
  })))
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

  const handleAddFixture = (kind: LaserDmxShowDirectorFixtureKind) => {
    addFixture(kind)
    setAuthoringMode('showDirector')
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
              onClick={() => handleAddFixture(kind)}
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

      <div className="rv-show-director-palette__design">
        <LaserDmxShowDirectorGlobalControls />
      </div>
    </aside>
  )
}
