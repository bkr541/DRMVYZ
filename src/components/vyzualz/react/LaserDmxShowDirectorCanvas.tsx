import {
  useEffect,
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
  variant?: 'panel' | 'stage'
}

type StagePoint = { x: number; y: number }

type FixtureDragState = {
  fixtureId: string
  pointerId: number
  offsetX: number
  offsetY: number
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
  const outputBrightness = fixture.enabled ? clamp(fixture.brightness, 0, 1) : 0
  return {
    left: `${((x + 0.5) / columns) * 100}%`,
    top: `${((y + 0.5) / rows) * 100}%`,
    transform: 'translate(-50%, -50%)',
    '--fixture-color': fixture.color,
    '--fixture-rotation': `${fixture.rotation}deg`,
    '--fixture-brightness': `${outputBrightness}`,
    '--fixture-container-brightness': `${fixture.enabled ? clamp(fixture.brightness, 0.35, 1) : 0.74}`,
    '--fixture-output-opacity': `${outputBrightness}`,
  } as CSSProperties
}

function normalizeDegrees(value: number): number {
  const normalized = ((value % 360) + 360) % 360
  return normalized > 180 ? normalized - 360 : normalized
}

function beamStyle(fixture: LaserDmxShowDirectorFixture): CSSProperties {
  const totalAngle = normalizeDegrees(fixture.rotation + fixture.beam.beamAngle)
  const spread = clamp(fixture.beam.beamSpread ?? 12, 0, 110)
  const outputBrightness = fixture.enabled && fixture.beam.beamEnabled ? clamp(fixture.brightness, 0, 1) : 0
  return {
    transform: `translate(18px, -50%) rotate(${totalAngle}deg)`,
    width: `${Math.max(58, 90 + spread * 0.55)}px`,
    opacity: roundTo(outputBrightness * 0.72, 3),
    '--show-director-beam-spread': `${spread}deg`,
    '--show-director-beam-tilt-negative': `${roundTo(spread * -0.24, 2)}deg`,
    '--show-director-beam-tilt-positive': `${roundTo(spread * 0.24, 2)}deg`,
    '--show-director-beam-blur': `${roundTo((1 - clamp(fixture.beam.focus, 0.1, 1)) * 2.8, 2)}px`,
  } as CSSProperties
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

function safelyCapturePointer(element: HTMLButtonElement, pointerId: number): void {
  try {
    element.setPointerCapture?.(pointerId)
  } catch {
    // Some embedded/Electron surfaces can reject capture if the pointer already ended.
  }
}

function safelyReleasePointer(element: HTMLButtonElement, pointerId: number): void {
  try {
    if (element.hasPointerCapture?.(pointerId)) element.releasePointerCapture?.(pointerId)
  } catch {
    // Pointer capture cleanup is best-effort; window listeners still end the drag.
  }
}

export function LaserDmxShowDirectorCanvas({ fixtures, selectedFixtureId, settings, variant = 'panel' }: LaserDmxShowDirectorCanvasProps) {
  const [isDragHot, setIsDragHot] = useState(false)
  const [fixtureDrag, setFixtureDrag] = useState<FixtureDragState | null>(null)
  const stageRef = useRef<HTMLDivElement | null>(null)
  const {
    addFixture,
    selectFixture,
    updateFixture,
    setAuthoringMode,
  } = useReactStore(useShallow(s => ({
    addFixture:       s.addLaserDmxShowDirectorFixture,
    selectFixture:    s.selectLaserDmxShowDirectorFixture,
    updateFixture:    s.updateLaserDmxShowDirectorFixture,
    setAuthoringMode: s.setLaserDmxBeamMatrixAuthoringMode,
  })))

  const { columns, rows } = coerceGridSize(settings)

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
    safelyCapturePointer(event.currentTarget, event.pointerId)
    selectFixture(fixture.id)
    const pointerPoint = stagePointFromClient(event.clientX, event.clientY, stageRef.current, settings)
    setFixtureDrag({
      fixtureId: fixture.id,
      pointerId: event.pointerId,
      offsetX: pointerPoint.x - fixture.x,
      offsetY: pointerPoint.y - fixture.y,
    })
  }

  const handleFixturePointerRelease = (event: ReactPointerEvent<HTMLButtonElement>) => {
    safelyReleasePointer(event.currentTarget, event.pointerId)
    if (fixtureDrag?.pointerId === event.pointerId) setFixtureDrag(null)
  }

  return (
    <section
      className={`rv-show-director-canvas-shell${variant === 'stage' ? ' rv-show-director-canvas-shell--stage' : ''}`}
      aria-label={variant === 'stage' ? 'Show Director visualizer stage canvas' : 'Show Director 2D canvas'}
    >
      {variant !== 'stage' && (
        <div className="rv-show-director-canvas-shell__header">
          <div>
            <span className="rv-show-director-kicker">2D Canvas</span>
            <h4>Stage Layout Editor</h4>
          </div>
        </div>
      )}

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
          className={`rv-show-director-canvas__stage${settings.showGrid ? '' : ' rv-show-director-canvas__stage--grid-hidden'}`}
          style={{
            '--show-director-columns': columns,
            '--show-director-rows': rows,
            '--show-director-zoom': settings.zoom,
          } as CSSProperties}
          onClick={handleCanvasClick}
        >
          <div className="rv-show-director-stage-centerline rv-show-director-stage-centerline--vertical" aria-hidden="true" />
          <div className="rv-show-director-stage-centerline rv-show-director-stage-centerline--horizontal" aria-hidden="true" />

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
                onPointerUp={handleFixturePointerRelease}
                onPointerCancel={handleFixturePointerRelease}
                onLostPointerCapture={handleFixturePointerRelease}
                onClick={event => {
                  event.stopPropagation()
                  selectFixture(fixture.id)
                }}
                aria-pressed={isSelected}
                aria-label={`${fixture.label}, ${label}, ${fixture.enabled ? 'enabled' : 'disabled'}. Drag to move on the stage grid.`}
              >
                {settings.showBeams && fixture.enabled && fixture.beam.beamEnabled && (
                  <span className={`rv-show-director-fixture__beam rv-show-director-fixture__beam--${fixture.kind}`} style={beamStyle(fixture)} aria-hidden="true" />
                )}
                <span className="rv-show-director-fixture__body" aria-hidden="true">
                  {renderFixtureIcon(fixture)}
                </span>
                {settings.showLabels && <span className="rv-show-director-fixture__label">{fixture.label}</span>}
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}
