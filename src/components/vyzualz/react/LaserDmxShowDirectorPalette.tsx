import { type DragEvent } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useReactStore } from '../../../stores/reactStore'
import {
  LASER_DMX_SHOW_DIRECTOR_FIXTURE_KINDS,
  LASER_DMX_SHOW_DIRECTOR_FIXTURE_KIND_LABELS,
  type LaserDmxShowDirectorFixtureKind,
} from './ReactTypes'
import { LaserDmxShowDirectorGlobalControls } from './LaserDmxShowDirectorControls'
import { Collapsible } from './ReactControlRows'

export const SHOW_DIRECTOR_FIXTURE_DRAG_TYPE = 'application/x-drmvyz-show-director-fixture-kind'

export function FixtureIcon({ kind }: { kind: LaserDmxShowDirectorFixtureKind }) {
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
  const { addFixture, setAuthoringMode } = useReactStore(useShallow(s => ({
    addFixture:       s.addLaserDmxShowDirectorFixture,
    setAuthoringMode: s.setLaserDmxBeamMatrixAuthoringMode,
  })))

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
    <aside className="rv-show-director-palette" aria-label="Show Director component palette">
      <Collapsible label="Lighting Components" defaultOpen bodyClassName="rv-show-director-lighting-body">
        <div className="rv-show-director-palette__list" role="list">
          {LASER_DMX_SHOW_DIRECTOR_FIXTURE_KINDS.map(kind => {
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
      </Collapsible>

      <LaserDmxShowDirectorGlobalControls />
    </aside>
  )
}
