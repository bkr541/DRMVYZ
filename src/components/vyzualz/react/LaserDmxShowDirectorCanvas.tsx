import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
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

type StagePoint = { x: number; y: number }

type FixtureDragState = {
  fixtureId: string
  pointerId: number
  offsetX: number
  offsetY: number
}

const GRID_PRESETS = [
  { label: '10 × 6', columns: 10, rows: 6 },
  { label: '12 × 8', columns: 12, rows: 8 },
  { label: '15 × 10', columns: 15, rows: 10 },
  { label: '18 × 12', columns: 18, rows: 12 },
  { label: '24 × 14', columns: 24, rows: 14 },
] as const

const MIN_ZOOM = 0.5
const MAX_ZOOM = 2.5
const ZOOM_STEP = 0.15

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function roundTo(value: number, decimals = 2): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

function normalizeDegrees(value: number): number {
  const normalized = ((value % 360) + 360) % 360
  return normalized > 180 ? normalized - 360 : normalized
}

function coerceGridSize(settings: LaserDmxShowDirectorSettings) {
  return {
    columns: Math.max(1, Math.round(settings.gridSize.columns || 1)),
    rows:    Math.max(1, Math.round(settings.gridSize.rows || 1)),
  }
}

function snapStagePoint(point: StagePoint, settings: LaserDmxShowDirectorSettings): StagePoint {
  const { columns, rows } = coerceGridSize(settings)
  const maxX = Math.max(0, columns - 1)
  const maxY = Math.max(0, rows - 1)
  const x = settings.snapEnabled ? Math.round(point.x) : roundTo(point.x, 1)
  const y = settings.snapEnabled ? Math.round(point.y) : roundTo(point.y, 1)
  return {
    x: clamp(x, 0, maxX),
    y: clamp(y, 0, maxY),
  }
}

function stagePointFromClient(clientX: number, clientY: number, stageElement: HTMLDivElement, settings: LaserDmxShowDirectorSettings): StagePoint {
  const rect = stageElement.getBoundingClientRect()
  const { columns, rows } = coerceGridSize(settings)
  const xRatio = clamp((clientX - rect.left) / Math.max(1, rect.width), 0, 0.999)
  const yRatio = clamp((clientY - rect.top) / Math.max(1, rect.height), 0, 0.999)
  return {
    x: xRatio * Math.max(0, columns - 1),
    y: yRatio * Math.max(0, rows - 1),
  }
}

function stagePointFromEvent(event: DragEvent<HTMLDivElement>, stageElement: HTMLDivElement, settings: LaserDmxShowDirectorSettings) {
  return snapStagePoint(stagePointFromClient(event.clientX, event.clientY, stageElement, settings), settings)
}

function fixtureStyle(fixture: LaserDmxShowDirectorFixture, settings: LaserDmxShowDirectorSettings): CSSProperties {
  const { columns, rows } = coerceGridSize(settings)
  const x = clamp(fixture.x, 0, Math.max(0, columns - 1))
  const y = clamp(fixture.y, 0, Math.max(0, rows - 1))
  return {
    left: `${((x + 0.5) / columns) * 100}%`,
    top: `${((y + 0.5) / rows) * 100}%`,
    transform: 'translate(-50%, -50%)',
    '--fixture-color': fixture.color,
    '--fixture-rotation': `${fixture.rotation}deg`,
    '--fixture-brightness': `${clamp(fixture.brightness, 0.1, 1)}`,
  } as CSSProperties
}

function beamStyle(fixture: LaserDmxShowDirectorFixture): CSSProperties {
  const totalAngle = normalizeDegrees(fixture.rotation + fixture.beam.beamAngle)
  const spread = clamp(fixture.beam.beamSpread || 12, 8, 110)
  return {
    transform: `translate(18px, -50%) rotate(${totalAngle}deg)`,
    width: `${Math.max(58, 90 + spread * 0.55)}px`,
    opacity: fixture.enabled && fixture.beam.beamEnabled ? 0.72 : 0.18,
    '--show-director-beam-spread': `${spread}deg`,
    '--show-director-beam-tilt-negative': `${roundTo(spread * -0.24, 2)}deg`,
    '--show-director-beam-tilt-positive': `${roundTo(spread * 0.24, 2)}deg`,
    '--show-director-beam-blur': `${roundTo((1 - clamp(fixture.beam.focus, 0.1, 1)) * 2.8, 2)}px`,
  } as CSSProperties
}

function guideIndexes(count: number): number[] {
  if (count <= 1) return [0]
  const step = Math.max(1, Math.ceil((count - 1) / 6))
  const values = new Set<number>([0, count - 1])
  for (let index = step; index < count - 1; index += step) values.add(index)
  return [...values].sort((a, b) => a - b)
}

function renderFixtureIcon(fixture: LaserDmxShowDirectorFixture) {
  switch (fixture.kind) {
    case 'laser':
      return (
        <span className="rv-show-director-fixture-icon rv-show-director-fixture-icon--laser" aria-hidden="true">
          <span className="rv-show-director-fixture-icon__fan" />
          <span className="rv-show-director-fixture-icon__body" />
          <span className="rv-show-director-fixture-icon__lens" />
        </span>
      )
    case 'movingHead':
      return (
        <span className="rv-show-director-fixture-icon rv-show-director-fixture-icon--moving-head" aria-hidden="true">
          <span className="rv-show-director-fixture-icon__cone" />
          <span className="rv-show-director-fixture-icon__yoke" />
          <span className="rv-show-director-fixture-icon__head" />
          <span className="rv-show-director-fixture-icon__base" />
        </span>
      )
    case 'ledBar':
      return (
        <span className="rv-show-director-fixture-icon rv-show-director-fixture-icon--led-bar" aria-hidden="true">
          {Array.from({ length: 6 }, (_, index) => <span key={index} />)}
        </span>
      )
    case 'ledTube':
      return (
        <span className="rv-show-director-fixture-icon rv-show-director-fixture-icon--led-tube" aria-hidden="true">
          <span />
        </span>
      )
    case 'strobe':
      return (
        <span className="rv-show-director-fixture-icon rv-show-director-fixture-icon--strobe" aria-hidden="true">
          <span className="rv-show-director-fixture-icon__burst" />
          <span className="rv-show-director-fixture-icon__plate" />
        </span>
      )
    case 'blinder':
      return (
        <span className="rv-show-director-fixture-icon rv-show-director-fixture-icon--blinder" aria-hidden="true">
          {Array.from({ length: 4 }, (_, index) => <span key={index} />)}
        </span>
      )
    case 'parWash':
      return (
        <span className="rv-show-director-fixture-icon rv-show-director-fixture-icon--par-wash" aria-hidden="true">
          <span className="rv-show-director-fixture-icon__wash" />
          <span className="rv-show-director-fixture-icon__can" />
        </span>
      )
    case 'videoWall':
      return (
        <span className="rv-show-director-fixture-icon rv-show-director-fixture-icon--video-wall" aria-hidden="true">
          {Array.from({ length: 6 }, (_, index) => <span key={index} />)}
        </span>
      )
    case 'haze':
      return (
        <span className="rv-show-director-fixture-icon rv-show-director-fixture-icon--haze" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      )
    case 'co2Jet':
      return (
        <span className="rv-show-director-fixture-icon rv-show-director-fixture-icon--co2" aria-hidden="true">
          <span className="rv-show-director-fixture-icon__plume" />
          <span className="rv-show-director-fixture-icon__jet" />
        </span>
      )
    default:
      return null
  }
}

export function LaserDmxShowDirectorCanvas({ fixtures, selectedFixtureId, settings }: LaserDmxShowDirectorCanvasProps) {
  const [isDragHot, setIsDragHot] = useState(false)
  const [fixtureDrag, setFixtureDrag] = useState<FixtureDragState | null>(null)
  const stageRef = useRef<HTMLDivElement | null>(null)
  const {
    addFixture,
    selectFixture,
    updateFixture,
    deleteFixture,
    duplicateFixture,
    mirrorFixture,
    updateSettings,
    setAuthoringMode,
  } = useReactStore(useShallow(s => ({
    addFixture:       s.addLaserDmxShowDirectorFixture,
    selectFixture:    s.selectLaserDmxShowDirectorFixture,
    updateFixture:    s.updateLaserDmxShowDirectorFixture,
    deleteFixture:    s.deleteLaserDmxShowDirectorFixture,
    duplicateFixture: s.duplicateLaserDmxShowDirectorFixture,
    mirrorFixture:    s.mirrorLaserDmxShowDirectorFixture,
    updateSettings:   s.updateLaserDmxShowDirectorSettings,
    setAuthoringMode: s.setLaserDmxBeamMatrixAuthoringMode,
  })))

  const { columns, rows } = useMemo(() => coerceGridSize(settings), [settings])
  const selectedFixture = useMemo(
    () => fixtures.find(fixture => fixture.id === selectedFixtureId) ?? null,
    [fixtures, selectedFixtureId],
  )
  const columnGuides = useMemo(() => guideIndexes(columns), [columns])
  const rowGuides = useMemo(() => guideIndexes(rows), [rows])
  const currentGridKey = `${columns}x${rows}`
  const gridOptions = useMemo(() => {
    const hasCurrent = GRID_PRESETS.some(option => `${option.columns}x${option.rows}` === currentGridKey)
    return hasCurrent
      ? GRID_PRESETS
      : [{ label: `${columns} × ${rows}`, columns, rows }, ...GRID_PRESETS]
  }, [columns, currentGridKey, rows])

  useEffect(() => {
    if (!fixtureDrag) return undefined

    const handlePointerMove = (event: globalThis.PointerEvent) => {
      if (event.pointerId !== fixtureDrag.pointerId || !stageRef.current) return
      const point = stagePointFromClient(event.clientX, event.clientY, stageRef.current, settings)
      updateFixture(fixtureDrag.fixtureId, snapStagePoint({
        x: point.x - fixtureDrag.offsetX,
        y: point.y - fixtureDrag.offsetY,
      }, settings))
    }

    const handlePointerUp = (event: globalThis.PointerEvent) => {
      if (event.pointerId === fixtureDrag.pointerId) setFixtureDrag(null)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerUp)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
    }
  }, [fixtureDrag, settings, updateFixture])

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer.types.includes(SHOW_DIRECTOR_FIXTURE_DRAG_TYPE)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
    setIsDragHot(true)
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    const payload = event.dataTransfer.getData(SHOW_DIRECTOR_FIXTURE_DRAG_TYPE)
    if (!isLaserDmxShowDirectorFixtureKind(payload) || !stageRef.current) return
    event.preventDefault()
    const point = stagePointFromEvent(event, stageRef.current, settings)
    addFixture(payload, point)
    setAuthoringMode('showDirector')
    setIsDragHot(false)
  }

  const handleCanvasClick = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null
    if (!target?.closest('.rv-show-director-fixture')) selectFixture(null)
  }

  const handleFixturePointerDown = (event: ReactPointerEvent<HTMLButtonElement>, fixture: LaserDmxShowDirectorFixture) => {
    if (!stageRef.current || event.button !== 0) return
    event.stopPropagation()
    selectFixture(fixture.id)
    const pointerPoint = stagePointFromClient(event.clientX, event.clientY, stageRef.current, settings)
    setFixtureDrag({
      fixtureId: fixture.id,
      pointerId: event.pointerId,
      offsetX: pointerPoint.x - fixture.x,
      offsetY: pointerPoint.y - fixture.y,
    })
  }

  const setZoom = (zoom: number) => updateSettings({ zoom: roundTo(clamp(zoom, MIN_ZOOM, MAX_ZOOM), 2) })

  const handleGridPreset = (value: string) => {
    const option = gridOptions.find(item => `${item.columns}x${item.rows}` === value)
    if (!option) return
    updateSettings({ gridSize: { columns: option.columns, rows: option.rows } })
  }

  const handleDuplicateSelected = () => {
    if (selectedFixtureId) duplicateFixture(selectedFixtureId)
  }

  const handleDeleteSelected = () => {
    if (selectedFixtureId) deleteFixture(selectedFixtureId)
  }

  const handleRotateSelected = () => {
    if (!selectedFixture) return
    updateFixture(selectedFixture.id, { rotation: normalizeDegrees(selectedFixture.rotation + 90) })
  }

  const handleMirrorHorizontal = () => {
    if (selectedFixture) mirrorFixture(selectedFixture.id, 'horizontal')
  }

  const handleMirrorVertical = () => {
    if (selectedFixture) mirrorFixture(selectedFixture.id, 'vertical')
  }

  const toolDisabled = !selectedFixture

  return (
    <section className="rv-show-director-canvas-shell" aria-label="Show Director 2D canvas">
      <div className="rv-show-director-canvas-shell__header">
        <div>
          <span className="rv-show-director-kicker">2D Canvas</span>
          <h4>Stage Layout Editor</h4>
        </div>
        <div className="rv-show-director-canvas-toolbar" aria-label="Show Director canvas options">
          <button
            type="button"
            className="rv-ctrl-toggle rv-ctrl-toggle--on"
            aria-pressed="true"
            title="Select and move fixtures by dragging them on the stage grid."
          >
            Select / Move
          </button>
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
          <label className="rv-show-director-grid-select">
            <span>Grid</span>
            <select value={currentGridKey} onChange={event => handleGridPreset(event.target.value)}>
              {gridOptions.map(option => (
                <option key={`${option.columns}x${option.rows}`} value={`${option.columns}x${option.rows}`}>{option.label}</option>
              ))}
            </select>
          </label>
          <div className="rv-show-director-tool-group" aria-label="Show Director fixture tools">
            <button type="button" className="rv-ctrl-toggle" disabled={toolDisabled} onClick={handleDuplicateSelected}>Duplicate</button>
            <button type="button" className="rv-ctrl-toggle" disabled={toolDisabled} onClick={handleRotateSelected}>Rotate 90°</button>
            <button type="button" className="rv-ctrl-toggle" disabled={toolDisabled} onClick={handleMirrorHorizontal}>Mirror H</button>
            <button type="button" className="rv-ctrl-toggle" disabled={toolDisabled} onClick={handleMirrorVertical}>Mirror V</button>
            <button type="button" className="rv-ctrl-toggle rv-ctrl-toggle--danger" disabled={toolDisabled} onClick={handleDeleteSelected}>Delete</button>
          </div>
          <div className="rv-show-director-tool-group rv-show-director-tool-group--zoom" aria-label="Show Director zoom controls">
            <button type="button" className="rv-ctrl-toggle" disabled={settings.zoom <= MIN_ZOOM} onClick={() => setZoom(settings.zoom - ZOOM_STEP)}>−</button>
            <span>{Math.round(settings.zoom * 100)}%</span>
            <button type="button" className="rv-ctrl-toggle" disabled={settings.zoom >= MAX_ZOOM} onClick={() => setZoom(settings.zoom + ZOOM_STEP)}>+</button>
            <button type="button" className="rv-ctrl-toggle" onClick={() => setZoom(1)}>Fit</button>
          </div>
        </div>
      </div>

      <div
        className={`rv-show-director-canvas${isDragHot ? ' rv-show-director-canvas--drag-hot' : ''}${fixtureDrag ? ' rv-show-director-canvas--fixture-dragging' : ''}`}
        onDragOver={handleDragOver}
        onDragEnter={event => {
          if (event.dataTransfer.types.includes(SHOW_DIRECTOR_FIXTURE_DRAG_TYPE)) setIsDragHot(true)
        }}
        onDragLeave={event => {
          if (event.currentTarget === event.target) setIsDragHot(false)
        }}
        onDrop={handleDrop}
      >
        <div
          ref={stageRef}
          className="rv-show-director-canvas__stage"
          style={{
            '--show-director-columns': columns,
            '--show-director-rows': rows,
            '--show-director-zoom': settings.zoom,
          } as CSSProperties}
          onClick={handleCanvasClick}
        >
          <div className="rv-show-director-canvas__drop-copy" aria-hidden="true">
            Drop fixtures here · select a fixture to edit beam, color, and timing
          </div>
          <div className="rv-show-director-stage-guides rv-show-director-stage-guides--columns" aria-hidden="true">
            {columnGuides.map(index => <span key={index} style={{ left: `${((index + 0.5) / columns) * 100}%` }}>X{index}</span>)}
          </div>
          <div className="rv-show-director-stage-guides rv-show-director-stage-guides--rows" aria-hidden="true">
            {rowGuides.map(index => <span key={index} style={{ top: `${((index + 0.5) / rows) * 100}%` }}>Y{index}</span>)}
          </div>
          <div className="rv-show-director-stage-centerline rv-show-director-stage-centerline--vertical" aria-hidden="true" />
          <div className="rv-show-director-stage-centerline rv-show-director-stage-centerline--horizontal" aria-hidden="true" />
          <div className="rv-show-director-canvas__backline" aria-hidden="true">Back / Upstage</div>
          <div className="rv-show-director-canvas__front-edge" aria-hidden="true">Front Edge / Audience</div>

          {fixtures.map(fixture => {
            const label = LASER_DMX_SHOW_DIRECTOR_FIXTURE_KIND_LABELS[fixture.kind]
            const isSelected = fixture.id === selectedFixtureId
            const isDragging = fixtureDrag?.fixtureId === fixture.id
            return (
              <button
                key={fixture.id}
                type="button"
                className={`rv-show-director-fixture rv-show-director-fixture--${fixture.kind}${isSelected ? ' rv-show-director-fixture--selected' : ''}${isDragging ? ' rv-show-director-fixture--dragging' : ''}${fixture.enabled ? '' : ' rv-show-director-fixture--disabled'}`}
                style={fixtureStyle(fixture, settings)}
                onPointerDown={event => handleFixturePointerDown(event, fixture)}
                onClick={event => {
                  event.stopPropagation()
                  selectFixture(fixture.id)
                }}
                aria-pressed={isSelected}
                aria-label={`${fixture.label}, ${label}, ${fixture.enabled ? 'enabled' : 'disabled'}. Drag to move on the stage grid.`}
              >
                {settings.showBeams && fixture.beam.beamEnabled && (
                  <span className={`rv-show-director-fixture__beam rv-show-director-fixture__beam--${fixture.kind}`} style={beamStyle(fixture)} aria-hidden="true" />
                )}
                <span className="rv-show-director-fixture__body" aria-hidden="true">
                  {renderFixtureIcon(fixture)}
                </span>
                {settings.showLabels && <span className="rv-show-director-fixture__label">{fixture.label}</span>}
              </button>
            )
          })}

          {fixtures.length === 0 && (
            <div className="rv-show-director-canvas__empty">
              <strong>Drag a light component onto the Show Director canvas</strong>
              <span>Start with a template above, or drag Laser, Strobe, LED Bar, Haze, or any palette component into the grid.</span>
            </div>
          )}
        </div>
      </div>

      <div className="rv-show-director-canvas-shell__footer">
        <span>{columns} × {rows} grid</span>
        <span>{fixtures.length} fixture{fixtures.length === 1 ? '' : 's'}</span>
        <span>{selectedFixture ? `${selectedFixture.label} · X${roundTo(selectedFixture.x, 1)} Y${roundTo(selectedFixture.y, 1)} R${Math.round(selectedFixture.rotation)}°` : 'No fixture selected'}</span>
        <span>Show Director compiles to Beam Matrix when selected as the preview source</span>
      </div>
    </section>
  )
}
