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
  LASER_DMX_SHOW_DIRECTOR_MAX_BEAM_TARGETS,
  isLaserDmxShowDirectorFixtureKind,
  type LaserDmxShowDirectorBeamTarget,
  type LaserDmxShowDirectorFixture,
  type LaserDmxShowDirectorGroup,
  type LaserDmxShowDirectorFixtureKind,
  type LaserDmxShowDirectorSettings,
} from './ReactTypes'
import { SHOW_DIRECTOR_FIXTURE_DRAG_TYPE } from './LaserDmxShowDirectorPalette'

interface LaserDmxShowDirectorCanvasProps {
  fixtures: LaserDmxShowDirectorFixture[]
  selectedFixtureId: string | null
  selectedFixtureIds?: string[]
  settings: LaserDmxShowDirectorSettings
  variant?: 'panel' | 'stage'
}

type StagePoint = { x: number; y: number }

type FixtureDragState = {
  fixtureId: string
  fixtureIds: string[]
  pointerId: number
  offsetX: number
  offsetY: number
  startX: number
  startY: number
  startClientX: number
  startClientY: number
  lastDeltaX: number
  lastDeltaY: number
}

type EndpointDragState = {
  fixtureId: string
  targetId:  string
  pointerId: number
}

type ContextMenuState = {
  fixtureId: string
  x: number
  y: number
}

type SelectionRectState = {
  pointerId: number
  start: StagePoint
  current: StagePoint
  addToExisting: boolean
  baseSelectedFixtureIds: string[]
  primaryFixtureId: string | null
  didMove: boolean
}


const ENDPOINT_EDITABLE_FIXTURE_KINDS = new Set<LaserDmxShowDirectorFixtureKind>([
  'laser',
  'movingHead',
  'parWash',
])

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function roundTo(value: number, decimals = 2): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

function finite(value: unknown, fallback: number): number {
  const candidate = typeof value === 'number'
    ? value
    : typeof value === 'string' && value.trim().length > 0
      ? Number(value)
      : Number.NaN
  return Number.isFinite(candidate) ? candidate : fallback
}

function coerceGridSize(settings: LaserDmxShowDirectorSettings) {
  return {
    columns: Math.max(1, Math.round(settings.gridSize.columns || 1)),
    rows:    Math.max(1, Math.round(settings.gridSize.rows || 1)),
  }
}

function groupLabelForFixture(fixture: LaserDmxShowDirectorFixture, groupsById: Map<string, LaserDmxShowDirectorGroup>): string | null {
  if (!fixture.groupId) return null
  return groupsById.get(fixture.groupId)?.label ?? fixture.groupId
}

function groupAccentForId(groupId: string | null | undefined): string | null {
  if (!groupId) return null
  let hash = 0
  for (let index = 0; index < groupId.length; index += 1) hash = ((hash << 5) - hash + groupId.charCodeAt(index)) | 0
  const hue = Math.abs(hash) % 360
  return `hsl(${hue} 82% 62%)`
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

function fixtureStyle(fixture: LaserDmxShowDirectorFixture, settings: LaserDmxShowDirectorSettings, groupAccent?: string | null): CSSProperties {
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
    '--fixture-group-color': groupAccent ?? fixture.color,
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

function isEndpointEditableFixture(fixture: LaserDmxShowDirectorFixture): boolean {
  return ENDPOINT_EDITABLE_FIXTURE_KINDS.has(fixture.kind)
    && typeof fixture.beam === 'object'
    && fixture.beam !== null
    && fixture.beam.beamEnabled === true
}

function defaultEndpointForFixture(fixture: LaserDmxShowDirectorFixture, settings: LaserDmxShowDirectorSettings): StagePoint {
  const { columns, rows } = coerceGridSize(settings)
  const maxX = Math.max(0, columns - 1)
  const maxY = Math.max(0, rows - 1)
  const distance = Math.max(2, Math.min(columns, rows) * 0.32)
  const radians = (finite(fixture.rotation, 0) + finite(fixture.beam?.beamAngle, 0)) * Math.PI / 180
  return snapStagePoint({
    x: clamp(finite(fixture.x, 0) + Math.cos(radians) * distance, 0, maxX),
    y: clamp(finite(fixture.y, 0) + Math.sin(radians) * distance, 0, maxY),
  }, settings)
}

function endpointForFixture(fixture: LaserDmxShowDirectorFixture, settings: LaserDmxShowDirectorSettings): StagePoint {
  const fallback = defaultEndpointForFixture(fixture, settings)
  return snapStagePoint({
    x: finite(fixture.beam?.targetX, fallback.x),
    y: finite(fixture.beam?.targetY, fallback.y),
  }, settings)
}

function beamTargetsForFixture(fixture: LaserDmxShowDirectorFixture, settings: LaserDmxShowDirectorSettings): LaserDmxShowDirectorBeamTarget[] {
  const primary = endpointForFixture(fixture, settings)
  const rawTargets = Array.isArray(fixture.beam?.targets) ? fixture.beam.targets : []
  const targets = rawTargets
    .filter((target): target is LaserDmxShowDirectorBeamTarget => target != null && typeof target === 'object')
    .slice(0, LASER_DMX_SHOW_DIRECTOR_MAX_BEAM_TARGETS)
    .map((target, index) => ({
      id: typeof target.id === 'string' && target.id.trim().length > 0 ? target.id : `${fixture.id}-target-${index + 1}`,
      ...snapStagePoint({
        x: finite(target.x, primary.x),
        y: finite(target.y, primary.y),
      }, settings),
    }))

  if (targets.length === 0) return [{ id: `${fixture.id}-target-1`, ...primary }]
  return [{ ...targets[0], ...primary }, ...targets.slice(1)]
}

function createBeamTargetId(fixtureId: string): string {
  const randomPart = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10)
  return `${fixtureId}-target-${Date.now().toString(36)}-${randomPart}`
}

function replaceBeamTarget(
  targets: LaserDmxShowDirectorBeamTarget[],
  targetId: string,
  point: StagePoint,
  settings: LaserDmxShowDirectorSettings,
): LaserDmxShowDirectorBeamTarget[] {
  const endpoint = snapStagePoint(point, settings)
  const index = Math.max(0, targets.findIndex(target => target.id === targetId))
  return targets.map((target, targetIndex) => targetIndex === index ? { ...target, ...endpoint } : target)
}

function createAdditionalEndpoint(fixture: LaserDmxShowDirectorFixture, settings: LaserDmxShowDirectorSettings): LaserDmxShowDirectorBeamTarget[] {
  const targets = beamTargetsForFixture(fixture, settings)
  if (targets.length >= LASER_DMX_SHOW_DIRECTOR_MAX_BEAM_TARGETS) return targets
  const anchor = targets[targets.length - 1] ?? targets[0] ?? { id: `${fixture.id}-target-1`, ...endpointForFixture(fixture, settings) }
  const direction = targets.length % 2 === 0 ? -1 : 1
  const spreadStep = settings.snapEnabled ? 1 : 0.8
  const point = snapStagePoint({
    x: anchor.x + spreadStep * direction,
    y: anchor.y + Math.max(0.5, spreadStep * 0.65),
  }, settings)
  return [...targets, { id: createBeamTargetId(fixture.id), ...point }]
}

function createFanTargets(fixture: LaserDmxShowDirectorFixture, settings: LaserDmxShowDirectorSettings): LaserDmxShowDirectorBeamTarget[] {
  const { columns, rows } = coerceGridSize(settings)
  const maxX = Math.max(0, columns - 1)
  const maxY = Math.max(0, rows - 1)
  const targetCount = Math.min(5, LASER_DMX_SHOW_DIRECTOR_MAX_BEAM_TARGETS)
  const spread = Math.max(34, finite(fixture.beam?.beamSpread, fixture.kind === 'laser' ? 42 : 34))
  const distance = Math.max(2.5, Math.min(columns, rows) * 0.45)
  const baseAngle = finite(fixture.rotation, 0) + finite(fixture.beam?.beamAngle, 0)

  return Array.from({ length: targetCount }, (_, index) => {
    const t = targetCount === 1 ? 0.5 : index / (targetCount - 1)
    const radians = (baseAngle + (t - 0.5) * spread) * Math.PI / 180
    const point = snapStagePoint({
      x: clamp(finite(fixture.x, 0) + Math.cos(radians) * distance, 0, maxX),
      y: clamp(finite(fixture.y, 0) + Math.sin(radians) * distance, 0, maxY),
    }, settings)
    return { id: `${fixture.id}-fan-${index + 1}`, ...point }
  })
}

function stagePointToPercent(point: StagePoint, settings: LaserDmxShowDirectorSettings): StagePoint {
  const { columns, rows } = coerceGridSize(settings)
  const x = clamp(point.x, 0, Math.max(0, columns - 1))
  const y = clamp(point.y, 0, Math.max(0, rows - 1))
  return {
    x: ((x + 0.5) / columns) * 100,
    y: ((y + 0.5) / rows) * 100,
  }
}

function rawStagePointToPercent(point: StagePoint, settings: LaserDmxShowDirectorSettings): StagePoint {
  const { columns, rows } = coerceGridSize(settings)
  const maxX = Math.max(0, columns - 1)
  const maxY = Math.max(0, rows - 1)
  return {
    x: maxX === 0 ? 0 : (clamp(point.x, 0, maxX) / maxX) * 100,
    y: maxY === 0 ? 0 : (clamp(point.y, 0, maxY) / maxY) * 100,
  }
}

function selectionRectBounds(rect: SelectionRectState) {
  return {
    minX: Math.min(rect.start.x, rect.current.x),
    maxX: Math.max(rect.start.x, rect.current.x),
    minY: Math.min(rect.start.y, rect.current.y),
    maxY: Math.max(rect.start.y, rect.current.y),
  }
}

function selectionRectStyle(rect: SelectionRectState, settings: LaserDmxShowDirectorSettings): CSSProperties {
  const bounds = selectionRectBounds(rect)
  const start = rawStagePointToPercent({ x: bounds.minX, y: bounds.minY }, settings)
  const end = rawStagePointToPercent({ x: bounds.maxX, y: bounds.maxY }, settings)
  return {
    left: `${start.x}%`,
    top: `${start.y}%`,
    width: `${Math.max(0.2, end.x - start.x)}%`,
    height: `${Math.max(0.2, end.y - start.y)}%`,
  }
}

function fixtureIsInsideSelectionRect(fixture: LaserDmxShowDirectorFixture, rect: SelectionRectState): boolean {
  const bounds = selectionRectBounds(rect)
  return fixture.x >= bounds.minX
    && fixture.x <= bounds.maxX
    && fixture.y >= bounds.minY
    && fixture.y <= bounds.maxY
}

function isSelectionModifier(event: { metaKey: boolean; ctrlKey: boolean }): boolean {
  return event.metaKey || event.ctrlKey
}

function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  const element = target instanceof HTMLElement ? target : null
  if (!element) return false
  if (element.isContentEditable) return true
  return element.closest('input, textarea, select, [contenteditable="true"]') !== null
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

function safelyCapturePointer(element: Element, pointerId: number): void {
  try {
    element.setPointerCapture?.(pointerId)
  } catch {
    // Some embedded/Electron surfaces can reject capture if the pointer already ended.
  }
}

function safelyReleasePointer(element: Element, pointerId: number): void {
  try {
    if (element.hasPointerCapture?.(pointerId)) element.releasePointerCapture?.(pointerId)
  } catch {
    // Pointer capture cleanup is best-effort; window listeners still end the drag.
  }
}

export function LaserDmxShowDirectorCanvas({ fixtures, selectedFixtureId, selectedFixtureIds = [], settings, variant = 'panel' }: LaserDmxShowDirectorCanvasProps) {
  const [isDragHot, setIsDragHot] = useState(false)
  const [fixtureDrag, setFixtureDrag] = useState<FixtureDragState | null>(null)
  const [endpointDrag, setEndpointDrag] = useState<EndpointDragState | null>(null)
  const [selectionRect, setSelectionRect] = useState<SelectionRectState | null>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [targetingFixtureId, setTargetingFixtureId] = useState<string | null>(null)
  const [selectedEndpointId, setSelectedEndpointId] = useState<string | null>(null)
  const stageRef = useRef<HTMLDivElement | null>(null)
  const selectionRectRef = useRef<SelectionRectState | null>(null)
  const didPointerDragRef = useRef(false)
  const suppressNextFixtureClickRef = useRef(false)
  const suppressNextStageClickRef = useRef(false)
  const {
    addFixture,
    selectFixture,
    toggleFixtureSelection,
    selectFixtures,
    clearSelection,
    deleteSelectedFixtures,
    moveSelectedFixtures,
    duplicateSelectedFixtures,
    groupSelectedFixtures,
    ungroupSelectedFixtures,
    selectGroup,
    renameGroup,
    duplicateGroup,
    ungroupGroup,
    updateFixture,
    setAuthoringMode,
    groups,
  } = useReactStore(useShallow(s => ({
    addFixture:                s.addLaserDmxShowDirectorFixture,
    selectFixture:             s.selectLaserDmxShowDirectorFixture,
    toggleFixtureSelection:    s.toggleLaserDmxShowDirectorFixtureSelection,
    selectFixtures:            s.selectLaserDmxShowDirectorFixtures,
    clearSelection:            s.clearLaserDmxShowDirectorSelection,
    deleteSelectedFixtures:    s.deleteSelectedLaserDmxShowDirectorFixtures,
    moveSelectedFixtures:      s.moveSelectedLaserDmxShowDirectorFixtures,
    duplicateSelectedFixtures: s.duplicateSelectedLaserDmxShowDirectorFixtures,
    groupSelectedFixtures:     s.groupSelectedLaserDmxShowDirectorFixtures,
    ungroupSelectedFixtures:   s.ungroupSelectedLaserDmxShowDirectorFixtures,
    selectGroup:               s.selectLaserDmxShowDirectorGroup,
    renameGroup:               s.renameLaserDmxShowDirectorGroup,
    duplicateGroup:            s.duplicateLaserDmxShowDirectorGroup,
    ungroupGroup:              s.ungroupLaserDmxShowDirectorGroup,
    updateFixture:             s.updateLaserDmxShowDirectorFixture,
    setAuthoringMode:          s.setLaserDmxBeamMatrixAuthoringMode,
    groups:                    s.laserDmxShowDirector.groups,
  })))

  const { columns, rows } = coerceGridSize(settings)
  const canvasSelectedFixtureIds = useMemo(() => {
    const validFixtureIds = new Set(fixtures.map(fixture => fixture.id))
    const ids = selectedFixtureIds.filter(id => validFixtureIds.has(id))
    if (selectedFixtureId && validFixtureIds.has(selectedFixtureId)) {
      return [selectedFixtureId, ...ids.filter(id => id !== selectedFixtureId)]
    }
    return ids
  }, [fixtures, selectedFixtureId, selectedFixtureIds])
  const selectedFixtureSet = useMemo(() => new Set(canvasSelectedFixtureIds), [canvasSelectedFixtureIds])
  const selectedFixtureCount = canvasSelectedFixtureIds.length
  const groupsById = useMemo(() => new Map(groups.map(group => [group.id, group])), [groups])
  const contextFixture = contextMenu ? fixtures.find(fixture => fixture.id === contextMenu.fixtureId) ?? null : null
  const contextGroup = contextFixture?.groupId ? groupsById.get(contextFixture.groupId) ?? null : null
  const targetingFixture = targetingFixtureId ? fixtures.find(fixture => fixture.id === targetingFixtureId) : null

  const updateSelectionRect = (nextRect: SelectionRectState | null) => {
    selectionRectRef.current = nextRect
    setSelectionRect(nextRect)
  }

  const setFixtureEndpoint = (fixtureId: string, point: StagePoint, targetId?: string) => {
    const fixture = fixtures.find(item => item.id === fixtureId)
    if (!fixture) return
    const targets = beamTargetsForFixture(fixture, settings)
    const selectedTargetId = targetId ?? targets[0]?.id ?? `${fixtureId}-target-1`
    const nextTargets = replaceBeamTarget(targets, selectedTargetId, point, settings)
    const primary = nextTargets[0] ?? snapStagePoint(point, settings)
    setSelectedEndpointId(selectedTargetId)
    updateFixture(fixtureId, {
      beam: {
        targetMode: 'fixed',
        targetX: primary.x,
        targetY: primary.y,
        targets: nextTargets,
      },
    })
  }

  const updateFixtureTargets = (fixture: LaserDmxShowDirectorFixture, targets: LaserDmxShowDirectorBeamTarget[], selectedTargetId?: string | null) => {
    const nextTargets = targets.slice(0, LASER_DMX_SHOW_DIRECTOR_MAX_BEAM_TARGETS)
    const primary = nextTargets[0] ?? endpointForFixture(fixture, settings)
    setSelectedEndpointId(selectedTargetId ?? nextTargets[0]?.id ?? null)
    updateFixture(fixture.id, {
      beam: {
        targetMode: 'fixed',
        targetX: primary.x,
        targetY: primary.y,
        targets: nextTargets,
      },
    })
  }

  useEffect(() => {
    if (!fixtureDrag) return undefined

    const handlePointerMove = (event: globalThis.PointerEvent) => {
      if (event.pointerId !== fixtureDrag.pointerId || !stageRef.current) return
      if (Math.hypot(event.clientX - fixtureDrag.startClientX, event.clientY - fixtureDrag.startClientY) > 3) {
        didPointerDragRef.current = true
      }
      const point = stagePointFromClient(event.clientX, event.clientY, stageRef.current, settings)
      const nextPoint = snapStagePoint({
        x: point.x - fixtureDrag.offsetX,
        y: point.y - fixtureDrag.offsetY,
      }, settings)
      const nextDeltaX = nextPoint.x - fixtureDrag.startX
      const nextDeltaY = nextPoint.y - fixtureDrag.startY
      const moveDeltaX = nextDeltaX - fixtureDrag.lastDeltaX
      const moveDeltaY = nextDeltaY - fixtureDrag.lastDeltaY
      if (moveDeltaX !== 0 || moveDeltaY !== 0) {
        moveSelectedFixtures(moveDeltaX, moveDeltaY)
        setFixtureDrag({
          ...fixtureDrag,
          lastDeltaX: nextDeltaX,
          lastDeltaY: nextDeltaY,
        })
      }
    }

    const handlePointerUp = (event: globalThis.PointerEvent) => {
      if (event.pointerId !== fixtureDrag.pointerId) return
      if (didPointerDragRef.current) suppressNextFixtureClickRef.current = true
      setFixtureDrag(null)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerUp)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
    }
  }, [fixtureDrag, moveSelectedFixtures, settings])

  useEffect(() => {
    if (!endpointDrag) return undefined

    const handlePointerMove = (event: globalThis.PointerEvent) => {
      if (event.pointerId !== endpointDrag.pointerId || !stageRef.current) return
      const point = stagePointFromClient(event.clientX, event.clientY, stageRef.current, settings)
      setFixtureEndpoint(endpointDrag.fixtureId, point, endpointDrag.targetId)
    }

    const handlePointerUp = (event: globalThis.PointerEvent) => {
      if (event.pointerId === endpointDrag.pointerId) setEndpointDrag(null)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerUp)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
    }
  }, [endpointDrag, settings, updateFixture])

  useEffect(() => {
    if (!selectionRect) return undefined

    const handlePointerMove = (event: globalThis.PointerEvent) => {
      const current = selectionRectRef.current
      if (!current || event.pointerId !== current.pointerId || !stageRef.current) return
      const currentPoint = stagePointFromClient(event.clientX, event.clientY, stageRef.current, settings)
      updateSelectionRect({
        ...current,
        current: currentPoint,
        didMove: current.didMove || Math.abs(currentPoint.x - current.start.x) > 0.12 || Math.abs(currentPoint.y - current.start.y) > 0.12,
      })
    }

    const handlePointerUp = (event: globalThis.PointerEvent) => {
      const current = selectionRectRef.current
      if (!current || event.pointerId !== current.pointerId) return
      if (stageRef.current) safelyReleasePointer(stageRef.current, event.pointerId)
      updateSelectionRect(null)
      suppressNextStageClickRef.current = true

      if (!current.didMove) {
        if (!current.addToExisting) clearSelection()
        return
      }

      const selectedByRect = fixtures.filter(fixture => fixtureIsInsideSelectionRect(fixture, current)).map(fixture => fixture.id)
      const nextSelectedFixtureIds = current.addToExisting
        ? Array.from(new Set([...current.baseSelectedFixtureIds, ...selectedByRect]))
        : selectedByRect
      selectFixtures(nextSelectedFixtureIds, current.addToExisting ? current.primaryFixtureId : selectedByRect[0] ?? null)
      setSelectedEndpointId(null)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerUp)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
    }
  }, [clearSelection, fixtures, selectFixtures, selectionRect, settings])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableKeyboardTarget(event.target)) return

      if (event.key === 'Escape') {
        const hadSomethingToCancel = Boolean(selectionRectRef.current || contextMenu || targetingFixtureId || endpointDrag || selectedEndpointId || selectedFixtureCount > 0)
        if (!hadSomethingToCancel) return
        updateSelectionRect(null)
        setContextMenu(null)
        setTargetingFixtureId(null)
        setEndpointDrag(null)
        setSelectedEndpointId(null)
        if (selectedFixtureCount > 0) clearSelection()
        event.preventDefault()
        return
      }

      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedFixtureCount > 0) {
        deleteSelectedFixtures()
        setContextMenu(null)
        setTargetingFixtureId(null)
        setSelectedEndpointId(null)
        event.preventDefault()
        return
      }

      const arrowDelta = event.shiftKey ? (settings.snapEnabled ? 5 : 1) : (settings.snapEnabled ? 1 : 0.25)
      if (selectedFixtureCount > 0 && event.key === 'ArrowLeft') {
        moveSelectedFixtures(-arrowDelta, 0)
        event.preventDefault()
      } else if (selectedFixtureCount > 0 && event.key === 'ArrowRight') {
        moveSelectedFixtures(arrowDelta, 0)
        event.preventDefault()
      } else if (selectedFixtureCount > 0 && event.key === 'ArrowUp') {
        moveSelectedFixtures(0, -arrowDelta)
        event.preventDefault()
      } else if (selectedFixtureCount > 0 && event.key === 'ArrowDown') {
        moveSelectedFixtures(0, arrowDelta)
        event.preventDefault()
      }
    }

    const handleWindowPointerDown = () => setContextMenu(null)

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('pointerdown', handleWindowPointerDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('pointerdown', handleWindowPointerDown)
    }
  }, [clearSelection, contextMenu, deleteSelectedFixtures, endpointDrag, moveSelectedFixtures, selectedEndpointId, selectedFixtureCount, settings.snapEnabled, targetingFixtureId])

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
    if (suppressNextStageClickRef.current) {
      suppressNextStageClickRef.current = false
      return
    }

    const target = event.target as HTMLElement | null
    if (targetingFixtureId && stageRef.current && target?.closest('.rv-show-director-canvas__stage')) {
      event.preventDefault()
      event.stopPropagation()
      setFixtureEndpoint(targetingFixtureId, stagePointFromClient(event.clientX, event.clientY, stageRef.current, settings))
      setTargetingFixtureId(null)
      setContextMenu(null)
      return
    }
    setContextMenu(null)
    if (!target?.closest('.rv-show-director-fixture')) {
      clearSelection()
      setSelectedEndpointId(null)
    }
  }

  const handleStagePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!stageRef.current || event.button !== 0 || targetingFixtureId || fixtureDrag || endpointDrag) return
    const target = event.target as HTMLElement | null
    if (target?.closest('.rv-show-director-fixture') || target?.closest('.rv-show-director-beam-overlay__endpoint')) return
    event.preventDefault()
    safelyCapturePointer(event.currentTarget, event.pointerId)
    const point = stagePointFromClient(event.clientX, event.clientY, stageRef.current, settings)
    updateSelectionRect({
      pointerId: event.pointerId,
      start: point,
      current: point,
      addToExisting: isSelectionModifier(event),
      baseSelectedFixtureIds: canvasSelectedFixtureIds,
      primaryFixtureId: selectedFixtureId,
      didMove: false,
    })
    setContextMenu(null)
    setSelectedEndpointId(null)
  }

  const handleFixtureContextMenu = (event: MouseEvent<HTMLButtonElement>, fixture: LaserDmxShowDirectorFixture) => {
    event.preventDefault()
    event.stopPropagation()
    const isSelected = selectedFixtureSet.has(fixture.id)
    const hasFixtureEndpointActions = isEndpointEditableFixture(fixture)
    const hasBulkActions = isSelected && selectedFixtureCount > 1
    if (!isSelected) selectFixture(fixture.id)
    setTargetingFixtureId(null)
    setSelectedEndpointId(hasFixtureEndpointActions ? beamTargetsForFixture(fixture, settings)[0]?.id ?? null : null)
    if (!hasBulkActions && !fixture.groupId && !hasFixtureEndpointActions) {
      setContextMenu(null)
      return
    }
    setContextMenu({ fixtureId: fixture.id, x: event.clientX, y: event.clientY })
  }

  const handleGroupSelectedFromMenu = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    groupSelectedFixtures()
    setContextMenu(null)
  }

  const handleUngroupSelectedFromMenu = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    ungroupSelectedFixtures()
    setContextMenu(null)
  }

  const handleDuplicateSelectedFromMenu = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    duplicateSelectedFixtures()
    setContextMenu(null)
  }

  const handleDeleteSelectedFromMenu = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    deleteSelectedFixtures()
    setContextMenu(null)
  }

  const handleSelectGroupFromMenu = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    if (contextFixture?.groupId) selectGroup(contextFixture.groupId)
    setContextMenu(null)
  }

  const handleRenameGroupFromMenu = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    if (!contextFixture?.groupId) return
    const currentLabel = contextGroup?.label ?? contextFixture.groupId
    const nextLabel = window.prompt('Rename Show Director group', currentLabel)
    if (nextLabel && nextLabel.trim()) renameGroup(contextFixture.groupId, nextLabel.trim())
    setContextMenu(null)
  }

  const handleDuplicateGroupFromMenu = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    if (contextFixture?.groupId) duplicateGroup(contextFixture.groupId)
    setContextMenu(null)
  }

  const handleUngroupGroupFromMenu = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    if (contextFixture?.groupId) ungroupGroup(contextFixture.groupId)
    setContextMenu(null)
  }

  const handleSetEndpointFromMenu = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    if (!contextMenu) return
    selectFixture(contextMenu.fixtureId)
    setTargetingFixtureId(contextMenu.fixtureId)
    setContextMenu(null)
  }

  const handleAddEndpointFromMenu = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    if (!contextMenu) return
    const fixture = fixtures.find(item => item.id === contextMenu.fixtureId)
    if (!fixture) return
    selectFixture(fixture.id)
    const targets = createAdditionalEndpoint(fixture, settings)
    updateFixtureTargets(fixture, targets, targets[targets.length - 1]?.id ?? null)
    setContextMenu(null)
  }

  const handleCreateFanFromMenu = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    if (!contextMenu) return
    const fixture = fixtures.find(item => item.id === contextMenu.fixtureId)
    if (!fixture) return
    selectFixture(fixture.id)
    const targets = createFanTargets(fixture, settings)
    updateFixtureTargets(fixture, targets, targets[0]?.id ?? null)
    setContextMenu(null)
  }

  const handleClearEndpointsFromMenu = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    if (!contextMenu) return
    const fixture = fixtures.find(item => item.id === contextMenu.fixtureId)
    if (!fixture) return
    selectFixture(fixture.id)
    const endpoint = defaultEndpointForFixture(fixture, settings)
    const target = { id: `${fixture.id}-target-1`, ...endpoint }
    updateFixtureTargets(fixture, [target], target.id)
    setContextMenu(null)
  }

  const handleFixturePointerDown = (event: ReactPointerEvent<HTMLButtonElement>, fixture: LaserDmxShowDirectorFixture) => {
    if (!stageRef.current || event.button !== 0 || targetingFixtureId) return
    event.stopPropagation()
    setSelectedEndpointId(null)
    setContextMenu(null)

    if (isSelectionModifier(event)) {
      event.preventDefault()
      toggleFixtureSelection(fixture.id)
      suppressNextFixtureClickRef.current = true
      return
    }

    didPointerDragRef.current = false
    safelyCapturePointer(event.currentTarget, event.pointerId)
    const isAlreadySelected = selectedFixtureSet.has(fixture.id)
    const dragFixtureIds = isAlreadySelected ? canvasSelectedFixtureIds : [fixture.id]
    if (!isAlreadySelected) selectFixture(fixture.id)
    const pointerPoint = stagePointFromClient(event.clientX, event.clientY, stageRef.current, settings)
    setFixtureDrag({
      fixtureId: fixture.id,
      fixtureIds: dragFixtureIds,
      pointerId: event.pointerId,
      offsetX: pointerPoint.x - fixture.x,
      offsetY: pointerPoint.y - fixture.y,
      startX: fixture.x,
      startY: fixture.y,
      startClientX: event.clientX,
      startClientY: event.clientY,
      lastDeltaX: 0,
      lastDeltaY: 0,
    })
  }

  const handleFixturePointerRelease = (event: ReactPointerEvent<HTMLButtonElement>) => {
    safelyReleasePointer(event.currentTarget, event.pointerId)
    if (fixtureDrag?.pointerId === event.pointerId) {
      if (didPointerDragRef.current) suppressNextFixtureClickRef.current = true
      setFixtureDrag(null)
    }
  }

  const handleEndpointPointerDown = (event: ReactPointerEvent<SVGCircleElement>, fixture: LaserDmxShowDirectorFixture, targetId: string) => {
    if (!stageRef.current || event.button !== 0 || !isEndpointEditableFixture(fixture)) return
    event.preventDefault()
    event.stopPropagation()
    safelyCapturePointer(event.currentTarget, event.pointerId)
    selectFixture(fixture.id)
    setContextMenu(null)
    setTargetingFixtureId(null)
    setSelectedEndpointId(targetId)
    setEndpointDrag({ fixtureId: fixture.id, targetId, pointerId: event.pointerId })
    setFixtureEndpoint(fixture.id, stagePointFromClient(event.clientX, event.clientY, stageRef.current, settings), targetId)
  }

  const handleEndpointPointerRelease = (event: ReactPointerEvent<SVGCircleElement>) => {
    safelyReleasePointer(event.currentTarget, event.pointerId)
    if (endpointDrag?.pointerId === event.pointerId) setEndpointDrag(null)
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
        className={`rv-show-director-canvas${isDragHot ? ' rv-show-director-canvas--drag-hot' : ''}${fixtureDrag ? ' rv-show-director-canvas--fixture-dragging' : ''}${endpointDrag ? ' rv-show-director-canvas--endpoint-dragging' : ''}${selectionRect ? ' rv-show-director-canvas--box-selecting' : ''}${targetingFixtureId ? ' rv-show-director-canvas--targeting' : ''}`}
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
          onPointerDown={handleStagePointerDown}
        >
          <div className="rv-show-director-stage-centerline rv-show-director-stage-centerline--vertical" aria-hidden="true" />
          <div className="rv-show-director-stage-centerline rv-show-director-stage-centerline--horizontal" aria-hidden="true" />

          {selectedFixtureCount > 1 && (
            <div className="rv-show-director-selection-badge" role="status">
              {selectedFixtureCount} selected
            </div>
          )}

          {selectionRect && (
            <div className="rv-show-director-selection-rect" style={selectionRectStyle(selectionRect, settings)} aria-hidden="true" />
          )}

          {settings.showBeams && fixtures.some(isEndpointEditableFixture) && (
            <svg className="rv-show-director-beam-overlay" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              {fixtures.filter(isEndpointEditableFixture).map(fixture => {
                const isSelectedFixture = fixture.id === selectedFixtureId
                const isDraggingEndpoint = endpointDrag?.fixtureId === fixture.id
                const origin = stagePointToPercent({ x: fixture.x, y: fixture.y }, settings)
                const targets = beamTargetsForFixture(fixture, settings)
                const selectedTargetId = isSelectedFixture
                  ? selectedEndpointId ?? targets[0]?.id ?? null
                  : null
                return targets.map((target, targetIndex) => {
                  const endpoint = stagePointToPercent(target, settings)
                  const isPrimaryTarget = targetIndex === 0
                  const isSelectedTarget = isSelectedFixture && (selectedTargetId === target.id || (!selectedTargetId && isPrimaryTarget))
                  return (
                    <g
                      key={`${fixture.id}-${target.id}`}
                      className={`rv-show-director-beam-overlay__path${isSelectedTarget ? ' rv-show-director-beam-overlay__path--selected' : ''}${isSelectedFixture && !isSelectedTarget ? ' rv-show-director-beam-overlay__path--secondary' : ''}${isDraggingEndpoint && endpointDrag?.targetId === target.id ? ' rv-show-director-beam-overlay__path--dragging' : ''}`}
                      style={{ '--show-director-beam-color': fixture.color } as CSSProperties}
                    >
                      <line className="rv-show-director-beam-overlay__glow" x1={origin.x} y1={origin.y} x2={endpoint.x} y2={endpoint.y} />
                      <line className="rv-show-director-beam-overlay__core" x1={origin.x} y1={origin.y} x2={endpoint.x} y2={endpoint.y} />
                      {targetIndex === 0 && <circle className="rv-show-director-beam-overlay__source" cx={origin.x} cy={origin.y} r={isSelectedFixture ? 0.86 : 0.62} />}
                      <circle
                        className={`rv-show-director-beam-overlay__endpoint${isPrimaryTarget ? ' rv-show-director-beam-overlay__endpoint--primary' : ''}`}
                        cx={endpoint.x}
                        cy={endpoint.y}
                        r={isSelectedTarget ? 1.34 : isSelectedFixture ? 1.08 : 0.72}
                        onPointerDown={isSelectedFixture ? event => handleEndpointPointerDown(event, fixture, target.id) : undefined}
                        onPointerUp={isSelectedFixture ? handleEndpointPointerRelease : undefined}
                        onPointerCancel={isSelectedFixture ? handleEndpointPointerRelease : undefined}
                        onLostPointerCapture={isSelectedFixture ? handleEndpointPointerRelease : undefined}
                      />
                    </g>
                  )
                })
              })}
            </svg>
          )}

          {targetingFixture && (
            <div className="rv-show-director-targeting-banner" role="status">
              <strong>Set Endpoint</strong>
              <span>Click the grid to aim {targetingFixture.label}. Press Esc to cancel.</span>
            </div>
          )}

          {fixtures.map(fixture => {
            const label = LASER_DMX_SHOW_DIRECTOR_FIXTURE_KIND_LABELS[fixture.kind]
            const groupLabel = groupLabelForFixture(fixture, groupsById)
            const groupAccent = groupAccentForId(fixture.groupId)
            const isSelected = selectedFixtureSet.has(fixture.id)
            const isPrimarySelected = fixture.id === selectedFixtureId
            const isMultiSelected = isSelected && selectedFixtureCount > 1
            const isDragging = fixtureDrag?.fixtureIds.includes(fixture.id) ?? false
            return (
              <button
                key={fixture.id}
                type="button"
                className={`rv-show-director-fixture rv-show-director-fixture--${fixture.kind}${isSelected ? ' rv-show-director-fixture--selected' : ''}${isPrimarySelected ? ' rv-show-director-fixture--primary-selected' : ''}${isMultiSelected ? ' rv-show-director-fixture--multi-selected' : ''}${fixture.groupId ? ' rv-show-director-fixture--grouped' : ''}${isDragging ? ' rv-show-director-fixture--dragging' : ''}${fixture.enabled ? '' : ' rv-show-director-fixture--disabled'}`}
                style={fixtureStyle(fixture, settings, groupAccent)}
                onPointerDown={event => handleFixturePointerDown(event, fixture)}
                onPointerUp={handleFixturePointerRelease}
                onPointerCancel={handleFixturePointerRelease}
                onLostPointerCapture={handleFixturePointerRelease}
                onContextMenu={event => handleFixtureContextMenu(event, fixture)}
                onClick={event => {
                  event.stopPropagation()
                  if (suppressNextFixtureClickRef.current) {
                    suppressNextFixtureClickRef.current = false
                    return
                  }
                  if (isSelectionModifier(event)) return
                  setContextMenu(null)
                  setSelectedEndpointId(null)
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
                {groupLabel && <span className="rv-show-director-fixture__group-tag">{groupLabel}</span>}
                {settings.showLabels && <span className="rv-show-director-fixture__label">{fixture.label}</span>}
              </button>
            )
          })}
        </div>
      </div>

      {contextMenu && (
        <div
          className="rv-show-director-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y } as CSSProperties}
          role="menu"
          onPointerDown={event => event.stopPropagation()}
        >
          {selectedFixtureCount > 1 && (
            <>
              <button type="button" role="menuitem" onClick={handleGroupSelectedFromMenu}>Group Selected</button>
              <button type="button" role="menuitem" onClick={handleUngroupSelectedFromMenu}>Ungroup Selected</button>
              <button type="button" role="menuitem" onClick={handleDuplicateSelectedFromMenu}>Duplicate Selected</button>
              <button type="button" role="menuitem" className="rv-show-director-context-menu__danger" onClick={handleDeleteSelectedFromMenu}>Delete Selected</button>
            </>
          )}
          {contextFixture?.groupId && (
            <>
              <span className="rv-show-director-context-menu__divider" role="separator" />
              <button type="button" role="menuitem" onClick={handleSelectGroupFromMenu}>Select Group</button>
              <button type="button" role="menuitem" onClick={handleRenameGroupFromMenu}>Rename Group</button>
              <button type="button" role="menuitem" onClick={handleDuplicateGroupFromMenu}>Duplicate Group</button>
              <button type="button" role="menuitem" onClick={handleUngroupGroupFromMenu}>Ungroup</button>
            </>
          )}
          {contextFixture && isEndpointEditableFixture(contextFixture) && (
            <>
              <span className="rv-show-director-context-menu__divider" role="separator" />
              <button type="button" role="menuitem" onClick={handleSetEndpointFromMenu}>Set Endpoint</button>
              <button type="button" role="menuitem" onClick={handleAddEndpointFromMenu}>Add Beam Endpoint</button>
              <button type="button" role="menuitem" onClick={handleCreateFanFromMenu}>Create Fan</button>
              <button type="button" role="menuitem" onClick={handleClearEndpointsFromMenu}>Clear Endpoints</button>
            </>
          )}
        </div>
      )}
    </section>
  )
}
