import { useMemo, useState, type CSSProperties, type DragEvent, type MouseEvent } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useReactStore } from '../../../stores/reactStore'
import {
  LASER_DMX_SHOW_DIRECTOR_FIXTURE_KIND_LABELS,
  isLaserDmxShowDirectorFixtureKind,
  type LaserDmxShowDirectorFixture,
  type LaserDmxShowDirectorSettings,
} from './ReactTypes'
import { SHOW_DIRECTOR_FIXTURE_DRAG_TYPE } from './LaserDmxShowDirectorPalette'

interface LaserDmxShowDirectorCanvasProps {
  fixtures: LaserDmxShowDirectorFixture[]
  selectedFixtureId: string | null
  settings: LaserDmxShowDirectorSettings
}

const FIXTURE_SYMBOLS: Record<LaserDmxShowDirectorFixture['kind'], string> = {
  laser:      '◇',
  movingHead: '◉',
  ledBar:     '▰',
  ledTube:    '┃',
  strobe:     '✦',
  blinder:    '●',
  parWash:    '⬤',
  videoWall:  '▦',
  haze:       '≈',
  co2Jet:     '↟',
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function roundTo(value: number, decimals = 2): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

function coerceGridSize(settings: LaserDmxShowDirectorSettings) {
  return {
    columns: Math.max(1, Math.round(settings.gridSize.columns || 1)),
    rows:    Math.max(1, Math.round(settings.gridSize.rows || 1)),
  }
}

function stagePointFromEvent(event: DragEvent<HTMLDivElement>, settings: LaserDmxShowDirectorSettings) {
  const rect = event.currentTarget.getBoundingClientRect()
  const { columns, rows } = coerceGridSize(settings)
  const xRatio = clamp((event.clientX - rect.left) / Math.max(1, rect.width), 0, 0.999)
  const yRatio = clamp((event.clientY - rect.top) / Math.max(1, rect.height), 0, 0.999)
  const x = xRatio * Math.max(0, columns - 1)
  const y = yRatio * Math.max(0, rows - 1)

  return settings.snapEnabled
    ? { x: Math.round(x), y: Math.round(y) }
    : { x: roundTo(x), y: roundTo(y) }
}

function fixtureStyle(fixture: LaserDmxShowDirectorFixture, settings: LaserDmxShowDirectorSettings): CSSProperties {
  const { columns, rows } = coerceGridSize(settings)
  const x = clamp(fixture.x, 0, Math.max(0, columns - 1))
  const y = clamp(fixture.y, 0, Math.max(0, rows - 1))
  return {
    left: `${((x + 0.5) / columns) * 100}%`,
    top: `${((y + 0.5) / rows) * 100}%`,
    transform: `translate(-50%, -50%) rotate(${fixture.rotation}deg)`,
    '--fixture-color': fixture.color,
  } as CSSProperties
}

function beamStyle(fixture: LaserDmxShowDirectorFixture): CSSProperties {
  return {
    transform: `translateY(-50%) rotate(${fixture.beam.beamAngle}deg)`,
    width: `${Math.max(42, 78 + fixture.beam.beamSpread)}px`,
    opacity: fixture.enabled && fixture.beam.beamEnabled ? 0.74 : 0.2,
  }
}

export function LaserDmxShowDirectorCanvas({ fixtures, selectedFixtureId, settings }: LaserDmxShowDirectorCanvasProps) {
  const [isDragHot, setIsDragHot] = useState(false)
  const {
    addFixture,
    selectFixture,
    updateSettings,
  } = useReactStore(useShallow(s => ({
    addFixture:     s.addLaserDmxShowDirectorFixture,
    selectFixture:  s.selectLaserDmxShowDirectorFixture,
    updateSettings: s.updateLaserDmxShowDirectorSettings,
  })))

  const { columns, rows } = useMemo(() => coerceGridSize(settings), [settings])

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer.types.includes(SHOW_DIRECTOR_FIXTURE_DRAG_TYPE)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
    setIsDragHot(true)
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    const payload = event.dataTransfer.getData(SHOW_DIRECTOR_FIXTURE_DRAG_TYPE)
    if (!isLaserDmxShowDirectorFixtureKind(payload)) return
    event.preventDefault()
    const point = stagePointFromEvent(event, settings)
    addFixture(payload, point)
    setIsDragHot(false)
  }

  const handleCanvasClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.currentTarget === event.target) selectFixture(null)
  }

  return (
    <section className="rv-show-director-canvas-shell" aria-label="Show Director 2D canvas">
      <div className="rv-show-director-canvas-shell__header">
        <div>
          <span className="rv-show-director-kicker">2D Canvas</span>
          <h4>Stage Grid</h4>
        </div>
        <div className="rv-show-director-canvas-toolbar" aria-label="Show Director canvas options">
          <button
            type="button"
            className={`rv-ctrl-toggle${settings.snapEnabled ? ' rv-ctrl-toggle--on' : ''}`}
            aria-pressed={settings.snapEnabled}
            onClick={() => updateSettings({ snapEnabled: !settings.snapEnabled })}
          >
            Snap {settings.snapEnabled ? 'On' : 'Off'}
          </button>
          <button
            type="button"
            className={`rv-ctrl-toggle${settings.showLabels ? ' rv-ctrl-toggle--on' : ''}`}
            aria-pressed={settings.showLabels}
            onClick={() => updateSettings({ showLabels: !settings.showLabels })}
          >
            Labels
          </button>
          <button
            type="button"
            className={`rv-ctrl-toggle${settings.showBeams ? ' rv-ctrl-toggle--on' : ''}`}
            aria-pressed={settings.showBeams}
            onClick={() => updateSettings({ showBeams: !settings.showBeams })}
          >
            Beams
          </button>
        </div>
      </div>

      <div
        className={`rv-show-director-canvas${isDragHot ? ' rv-show-director-canvas--drag-hot' : ''}`}
        style={{ '--show-director-columns': columns, '--show-director-rows': rows } as CSSProperties}
        onDragOver={handleDragOver}
        onDragEnter={event => {
          if (event.dataTransfer.types.includes(SHOW_DIRECTOR_FIXTURE_DRAG_TYPE)) setIsDragHot(true)
        }}
        onDragLeave={event => {
          if (event.currentTarget === event.target) setIsDragHot(false)
        }}
        onDrop={handleDrop}
        onClick={handleCanvasClick}
      >
        <div className="rv-show-director-canvas__drop-copy" aria-hidden="true">
          Drop fixtures here
        </div>
        <div className="rv-show-director-canvas__front-edge" aria-hidden="true">Front Edge</div>

        {fixtures.map(fixture => {
          const label = LASER_DMX_SHOW_DIRECTOR_FIXTURE_KIND_LABELS[fixture.kind]
          const isSelected = fixture.id === selectedFixtureId
          return (
            <button
              key={fixture.id}
              type="button"
              className={`rv-show-director-fixture${isSelected ? ' rv-show-director-fixture--selected' : ''}${fixture.enabled ? '' : ' rv-show-director-fixture--disabled'}`}
              style={fixtureStyle(fixture, settings)}
              onClick={event => {
                event.stopPropagation()
                selectFixture(fixture.id)
              }}
              aria-pressed={isSelected}
              aria-label={`${fixture.label}, ${label}, ${fixture.enabled ? 'enabled' : 'disabled'}`}
            >
              {settings.showBeams && fixture.beam.beamEnabled && (
                <span className="rv-show-director-fixture__beam" style={beamStyle(fixture)} aria-hidden="true" />
              )}
              <span className="rv-show-director-fixture__symbol" aria-hidden="true">{FIXTURE_SYMBOLS[fixture.kind]}</span>
              {settings.showLabels && <span className="rv-show-director-fixture__label">{fixture.label}</span>}
            </button>
          )
        })}

        {fixtures.length === 0 && (
          <div className="rv-show-director-canvas__empty">
            <strong>Build your rig.</strong>
            <span>Drag Laser, Strobe, LED Bar, Haze, or any palette component into the grid.</span>
          </div>
        )}
      </div>

      <div className="rv-show-director-canvas-shell__footer">
        <span>{columns} × {rows} grid</span>
        <span>{fixtures.length} fixture{fixtures.length === 1 ? '' : 's'}</span>
        <span>Authoring only · Beam Matrix output unchanged</span>
      </div>
    </section>
  )
}
