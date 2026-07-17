import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { createPortal } from 'react-dom'
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
  type LaserDmxShowDirectorFixturePatch,
  type LaserDmxShowDirectorSettings,
} from './ReactTypes'
import { SHOW_DIRECTOR_FIXTURE_DRAG_TYPE } from './LaserDmxShowDirectorPalette'
import { scannerPointsToBeamTargets, updateLaserDmxScannerPoint } from './laserDmxScannerAuthoring'
import { triggerPatchForRecipe, type LaserDmxShowDirectorTriggerRecipe } from './laserDmxShowDirectorTriggerRecipes'
import { resolveLaserDmxPresentationVisibility } from './renderers/laserDmx/LaserDmxRendererBackend'

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

type ContextMenuState =
  | {
      kind: 'fixture'
      fixtureId: string
      x: number
      y: number
    }
  | {
      kind: 'stage'
      point: StagePoint
      x: number
      y: number
    }

type QuickActionPopoverState = {
  fixtureId: string
  x: number
  y: number
}

type FixtureClipboardState = {
  source: LaserDmxShowDirectorFixture
}

type ShowDirectorAimPreset =
  | 'center'
  | 'left'
  | 'right'
  | 'crowd'
  | 'upstage'
  | 'downstage'
  | 'crossCenter'
  | 'fanOutward'
  | 'clear'

const SHOW_DIRECTOR_AIM_PRESET_LABELS: Record<ShowDirectorAimPreset, string> = {
  center: 'Aim Center',
  left: 'Aim Left',
  right: 'Aim Right',
  crowd: 'Aim Crowd',
  upstage: 'Aim Upstage',
  downstage: 'Aim Downstage',
  crossCenter: 'Cross Center',
  fanOutward: 'Fan Outward',
  clear: 'Clear Aim',
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
  const x = settings.snapEnabled ? Math.round(point.x) : roundTo(point.x, 3)
  const y = settings.snapEnabled ? Math.round(point.y) : roundTo(point.y, 3)
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
  const highlightFixtures = settings.highlightFixtures !== false
  const mutedFixtureColor = '#4f5960'
  const outputBrightness = highlightFixtures
    ? fixture.enabled ? clamp(fixture.brightness, 0, 1) : 0
    : 0.28
  return {
    left: `${((x + 0.5) / columns) * 100}%`,
    top: `${((y + 0.5) / rows) * 100}%`,
    transform: 'translate(-50%, -50%)',
    '--fixture-color': highlightFixtures ? fixture.color : mutedFixtureColor,
    '--fixture-rotation': `${fixture.rotation}deg`,
    '--fixture-brightness': `${outputBrightness}`,
    '--fixture-container-brightness': `${highlightFixtures ? fixture.enabled ? clamp(fixture.brightness, 0.35, 1) : 0.74 : 0.58}`,
    '--fixture-output-opacity': `${outputBrightness}`,
    '--fixture-group-color': highlightFixtures ? groupAccent ?? fixture.color : mutedFixtureColor,
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
  const rawTargets = fixture.kind === 'laser' && fixture.scanner?.path.points.length
    ? scannerPointsToBeamTargets(fixture.scanner)
    : Array.isArray(fixture.beam?.targets) ? fixture.beam.targets : []
  const targets = rawTargets
    .filter((target): target is LaserDmxShowDirectorBeamTarget => target != null && typeof target === 'object')
    .slice(0, LASER_DMX_SHOW_DIRECTOR_MAX_BEAM_TARGETS)
    .map((target, index) => ({
      ...target,
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


function centerStagePoint(settings: LaserDmxShowDirectorSettings): StagePoint {
  const { columns, rows } = coerceGridSize(settings)
  return snapStagePoint({
    x: Math.max(0, columns - 1) / 2,
    y: Math.max(0, rows - 1) / 2,
  }, settings)
}

function pointTarget(fixture: LaserDmxShowDirectorFixture, point: StagePoint, settings: LaserDmxShowDirectorSettings, index = 0): LaserDmxShowDirectorBeamTarget {
  return {
    id: beamTargetsForFixture(fixture, settings)[index]?.id ?? `${fixture.id}-target-${index + 1}`,
    ...snapStagePoint(point, settings),
  }
}

function createCrossCenterTargets(fixture: LaserDmxShowDirectorFixture, settings: LaserDmxShowDirectorSettings): LaserDmxShowDirectorBeamTarget[] {
  const { columns, rows } = coerceGridSize(settings)
  const maxX = Math.max(0, columns - 1)
  const maxY = Math.max(0, rows - 1)
  const center = centerStagePoint(settings)
  const horizontalDirection = fixture.x <= center.x ? 1 : -1
  const xOffset = Math.max(1, columns * 0.16)
  const yOffset = Math.max(1, rows * 0.18)
  const rawTargets: StagePoint[] = [
    center,
    { x: center.x + horizontalDirection * xOffset, y: center.y - yOffset },
    { x: center.x + horizontalDirection * xOffset, y: center.y + yOffset },
  ]
  return rawTargets
    .slice(0, LASER_DMX_SHOW_DIRECTOR_MAX_BEAM_TARGETS)
    .map((point, index) => pointTarget(fixture, { x: clamp(point.x, 0, maxX), y: clamp(point.y, 0, maxY) }, settings, index))
}

function createOutwardFanTargets(fixture: LaserDmxShowDirectorFixture, settings: LaserDmxShowDirectorSettings): LaserDmxShowDirectorBeamTarget[] {
  const { columns, rows } = coerceGridSize(settings)
  const maxX = Math.max(0, columns - 1)
  const maxY = Math.max(0, rows - 1)
  const center = centerStagePoint(settings)
  const existingTargets = beamTargetsForFixture(fixture, settings)
  const targetCount = Math.min(5, LASER_DMX_SHOW_DIRECTOR_MAX_BEAM_TARGETS)
  const isCentered = Math.abs(fixture.x - center.x) < Math.max(1, columns * 0.08)
  const aimDownstage = fixture.y <= center.y
  const edgeX = fixture.x < center.x ? 0 : maxX
  const edgeY = aimDownstage ? maxY : 0

  return Array.from({ length: targetCount }, (_, index) => {
    const t = targetCount === 1 ? 0.5 : index / (targetCount - 1)
    const point = isCentered
      ? { x: t * maxX, y: edgeY }
      : { x: edgeX, y: t * maxY }
    return {
      id: existingTargets[index]?.id ?? `${fixture.id}-fan-out-${index + 1}`,
      ...snapStagePoint(point, settings),
    }
  })
}

function createAimPresetTargets(
  fixture: LaserDmxShowDirectorFixture,
  settings: LaserDmxShowDirectorSettings,
  preset: ShowDirectorAimPreset,
): LaserDmxShowDirectorBeamTarget[] {
  const { columns, rows } = coerceGridSize(settings)
  const maxX = Math.max(0, columns - 1)
  const maxY = Math.max(0, rows - 1)
  const center = centerStagePoint(settings)
  switch (preset) {
    case 'left':
      return [pointTarget(fixture, { x: 0, y: center.y }, settings)]
    case 'right':
      return [pointTarget(fixture, { x: maxX, y: center.y }, settings)]
    case 'crowd':
    case 'downstage':
      return [pointTarget(fixture, { x: center.x, y: maxY }, settings)]
    case 'upstage':
      return [pointTarget(fixture, { x: center.x, y: 0 }, settings)]
    case 'crossCenter':
      return createCrossCenterTargets(fixture, settings)
    case 'fanOutward':
      return createOutwardFanTargets(fixture, settings)
    case 'clear': {
      const endpoint = defaultEndpointForFixture(fixture, settings)
      return [{ id: `${fixture.id}-target-1`, ...endpoint }]
    }
    case 'center':
    default:
      return [pointTarget(fixture, center, settings)]
  }
}

function targetModeForAimPreset(preset: ShowDirectorAimPreset): LaserDmxShowDirectorFixture['beam']['targetMode'] {
  if (preset === 'fanOutward') return 'fan'
  if (preset === 'crossCenter') return 'cross'
  return 'fixed'
}

function cloneFixturePatchAtPoint(
  source: LaserDmxShowDirectorFixture,
  point: StagePoint,
  settings: LaserDmxShowDirectorSettings,
): LaserDmxShowDirectorFixturePatch {
  const sourceTargets = beamTargetsForFixture(source, settings)
  const deltaX = point.x - source.x
  const deltaY = point.y - source.y
  const targets = sourceTargets.map((target, index) => ({
    id: `${source.id}-paste-target-${index + 1}`,
    ...snapStagePoint({ x: target.x + deltaX, y: target.y + deltaY }, settings),
  }))
  const primary = targets[0]
  return {
    label: `${source.label} Copy`,
    enabled: source.enabled,
    x: point.x,
    y: point.y,
    z: source.z,
    rotation: source.rotation,
    groupId: null,
    color: source.color,
    colorMode: source.colorMode,
    brightness: source.brightness,
    beam: {
      ...source.beam,
      targetX: primary?.x ?? point.x,
      targetY: primary?.y ?? point.y,
      targets,
    },
    trigger: { ...source.trigger, sectionTypes: [...source.trigger.sectionTypes], cuePointIds: [...source.trigger.cuePointIds] },
    component: { ...source.component },
    ...(source.scanner ? {
      scanner: {
        ...source.scanner,
        path: {
          ...source.scanner.path,
          points: source.scanner.path.points.map((point, index) => ({
            ...point,
            id: `${source.id}-paste-scan-point-${index + 1}`,
            ...snapStagePoint({ x: point.x + deltaX, y: point.y + deltaY }, settings),
          })),
        },
        migration: {
          ...source.scanner.migration,
          sourceTargetIds: [...source.scanner.migration.sourceTargetIds],
          warnings: [...source.scanner.migration.warnings],
        },
      },
    } : {}),
  }
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

const SHOW_DIRECTOR_FLOATING_MENU_MARGIN = 12

function bottomDockReserve(stageElement: HTMLDivElement | null): number {
  if (typeof window === 'undefined') return 0
  const shell = stageElement?.closest('.rv-shell')
  if (!shell) return 0
  const value = window.getComputedStyle(shell).getPropertyValue('--rv-react-dock-height')
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function clampFloatingMenuPosition(
  element: HTMLElement,
  point: { x: number; y: number },
  stageElement: HTMLDivElement | null,
): { x: number; y: number } {
  if (typeof window === 'undefined') return point
  const rect = element.getBoundingClientRect()
  const margin = SHOW_DIRECTOR_FLOATING_MENU_MARGIN
  const dockReserve = bottomDockReserve(stageElement)
  const maxX = Math.max(margin, window.innerWidth - rect.width - margin)
  const maxY = Math.max(margin, window.innerHeight - rect.height - margin - dockReserve)
  return {
    x: Math.round(clamp(point.x, margin, maxX)),
    y: Math.round(clamp(point.y, margin, maxY)),
  }
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
  const [quickActionPopover, setQuickActionPopover] = useState<QuickActionPopoverState | null>(null)
  const [fixtureClipboard, setFixtureClipboard] = useState<FixtureClipboardState | null>(null)
  const [targetingFixtureId, setTargetingFixtureId] = useState<string | null>(null)
  const [selectedEndpointId, setSelectedEndpointId] = useState<string | null>(null)
  const stageRef = useRef<HTMLDivElement | null>(null)
  const contextMenuRef = useRef<HTMLDivElement | null>(null)
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
    deleteFixture,
    deleteSelectedFixtures,
    moveSelectedFixtures,
    duplicateFixture,
    duplicateSelectedFixtures,
    mirrorFixture,
    createMirrorPair,
    unlinkMirrorPair,
    groupSelectedFixtures,
    ungroupSelectedFixtures,
    selectGroup,
    renameGroup,
    duplicateGroup,
    ungroupGroup,
    updateFixture,
    updateSettings,
    setAuthoringMode,
    undoShowDirectorEdit,
    redoShowDirectorEdit,
    beginHistoryTransaction,
    commitHistoryTransaction,
    groups,
  } = useReactStore(useShallow(s => ({
    addFixture:                s.addLaserDmxShowDirectorFixture,
    selectFixture:             s.selectLaserDmxShowDirectorFixture,
    toggleFixtureSelection:    s.toggleLaserDmxShowDirectorFixtureSelection,
    selectFixtures:            s.selectLaserDmxShowDirectorFixtures,
    clearSelection:            s.clearLaserDmxShowDirectorSelection,
    deleteFixture:             s.deleteLaserDmxShowDirectorFixture,
    deleteSelectedFixtures:    s.deleteSelectedLaserDmxShowDirectorFixtures,
    moveSelectedFixtures:      s.moveSelectedLaserDmxShowDirectorFixtures,
    duplicateFixture:          s.duplicateLaserDmxShowDirectorFixture,
    duplicateSelectedFixtures: s.duplicateSelectedLaserDmxShowDirectorFixtures,
    mirrorFixture:             s.mirrorLaserDmxShowDirectorFixture,
    createMirrorPair:          s.createLinkedLaserDmxShowDirectorMirrorPair,
    unlinkMirrorPair:          s.unlinkLaserDmxShowDirectorMirrorPair,
    groupSelectedFixtures:     s.groupSelectedLaserDmxShowDirectorFixtures,
    ungroupSelectedFixtures:   s.ungroupSelectedLaserDmxShowDirectorFixtures,
    selectGroup:               s.selectLaserDmxShowDirectorGroup,
    renameGroup:               s.renameLaserDmxShowDirectorGroup,
    duplicateGroup:            s.duplicateLaserDmxShowDirectorGroup,
    ungroupGroup:              s.ungroupLaserDmxShowDirectorGroup,
    updateFixture:             s.updateLaserDmxShowDirectorFixture,
    updateSettings:            s.updateLaserDmxShowDirectorSettings,
    setAuthoringMode:          s.setLaserDmxBeamMatrixAuthoringMode,
    undoShowDirectorEdit:      s.undoLaserDmxShowDirectorEdit,
    redoShowDirectorEdit:      s.redoLaserDmxShowDirectorEdit,
    beginHistoryTransaction:   s.beginLaserDmxShowDirectorHistoryTransaction,
    commitHistoryTransaction:  s.commitLaserDmxShowDirectorHistoryTransaction,
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
  const presentationVisibility = useMemo(
    () => resolveLaserDmxPresentationVisibility(settings.presentationMode),
    [settings.presentationMode],
  )
  const editorFixtures = useMemo(() => (
    presentationVisibility.showAllFixtures
      ? fixtures
      : fixtures.filter(fixture => selectedFixtureSet.has(fixture.id))
  ), [fixtures, presentationVisibility.showAllFixtures, selectedFixtureSet])
  const groupsById = useMemo(() => new Map(groups.map(group => [group.id, group])), [groups])
  const contextFixture = contextMenu?.kind === 'fixture' ? fixtures.find(fixture => fixture.id === contextMenu.fixtureId) ?? null : null
  const contextGroup = contextFixture?.groupId ? groupsById.get(contextFixture.groupId) ?? null : null
  const contextStagePoint = contextMenu?.kind === 'stage' ? contextMenu.point : null
  const quickActionFixture = quickActionPopover ? fixtures.find(fixture => fixture.id === quickActionPopover.fixtureId) ?? null : null
  const targetingFixture = targetingFixtureId ? fixtures.find(fixture => fixture.id === targetingFixtureId) : null

  const fixturesRef = useRef(fixtures)
  const settingsRef = useRef(settings)
  fixturesRef.current = fixtures
  settingsRef.current = settings

  const updateSelectionRect = useCallback((nextRect: SelectionRectState | null) => {
    selectionRectRef.current = nextRect
    setSelectionRect(nextRect)
  }, [])

  const closeTransientUi = useCallback(() => {
    updateSelectionRect(null)
    setContextMenu(null)
    setQuickActionPopover(null)
    setTargetingFixtureId(null)
    setEndpointDrag(null)
    setSelectedEndpointId(null)
  }, [updateSelectionRect])

  const stageHasKeyboardFocus = () => {
    const activeElement = typeof document !== 'undefined' ? document.activeElement : null
    return Boolean(stageRef.current && activeElement && stageRef.current.contains(activeElement))
  }

  const focusStage = () => {
    stageRef.current?.focus({ preventScroll: true })
  }

  useEffect(() => {
    const fixtureIds = new Set(fixtures.map(fixture => fixture.id))
    if (targetingFixtureId && !fixtureIds.has(targetingFixtureId)) setTargetingFixtureId(null)
    if (endpointDrag && !fixtureIds.has(endpointDrag.fixtureId)) setEndpointDrag(null)
    if (quickActionPopover && !fixtureIds.has(quickActionPopover.fixtureId)) setQuickActionPopover(null)
    if (contextMenu?.kind === 'fixture' && !fixtureIds.has(contextMenu.fixtureId)) setContextMenu(null)
    if (fixtures.length === 0) {
      updateSelectionRect(null)
      setTargetingFixtureId(null)
      setEndpointDrag(null)
      setSelectedEndpointId(null)
      setQuickActionPopover(null)
      setContextMenu(null)
    }
  }, [contextMenu, endpointDrag, fixtures, quickActionPopover, targetingFixtureId, updateSelectionRect])

  const setFixtureEndpoint = useCallback((fixtureId: string, point: StagePoint, targetId?: string) => {
    const currentSettings = settingsRef.current
    const fixture = fixturesRef.current.find(item => item.id === fixtureId)
    if (!fixture) return
    const targets = beamTargetsForFixture(fixture, currentSettings)
    const selectedTargetId = targetId ?? targets[0]?.id ?? `${fixtureId}-target-1`
    const nextTargets = replaceBeamTarget(targets, selectedTargetId, point, currentSettings)
    const primary = nextTargets[0] ?? snapStagePoint(point, currentSettings)
    setSelectedEndpointId(selectedTargetId)
    if (fixture.kind === 'laser' && fixture.scanner) {
      const nextScanner = updateLaserDmxScannerPoint(fixture.scanner, selectedTargetId, snapStagePoint(point, currentSettings))
      const scannerTargets = scannerPointsToBeamTargets(nextScanner)
      const scannerPrimary = scannerTargets[0] ?? primary
      updateFixture(fixtureId, {
        scanner: nextScanner,
        beam: {
          targetMode: 'fixed',
          targetX: scannerPrimary.x,
          targetY: scannerPrimary.y,
          targets: scannerTargets,
        },
      })
      return
    }
    updateFixture(fixtureId, {
      beam: {
        targetMode: 'fixed',
        targetX: primary.x,
        targetY: primary.y,
        targets: nextTargets,
      },
    })
  }, [updateFixture])

  const updateFixtureTargets = (
    fixture: LaserDmxShowDirectorFixture,
    targets: LaserDmxShowDirectorBeamTarget[],
    selectedTargetId?: string | null,
    targetMode: LaserDmxShowDirectorFixture['beam']['targetMode'] = 'fixed',
  ) => {
    const nextTargets = targets.slice(0, LASER_DMX_SHOW_DIRECTOR_MAX_BEAM_TARGETS)
    const primary = nextTargets[0] ?? endpointForFixture(fixture, settings)
    setSelectedEndpointId(selectedTargetId ?? nextTargets[0]?.id ?? null)
    updateFixture(fixture.id, {
      beam: {
        targetMode,
        targetX: primary.x,
        targetY: primary.y,
        targets: nextTargets,
      },
    })
  }

  const applyAimPresetToFixture = (fixture: LaserDmxShowDirectorFixture, preset: ShowDirectorAimPreset) => {
    if (!isEndpointEditableFixture(fixture)) return
    const targets = createAimPresetTargets(fixture, settings, preset)
    updateFixtureTargets(fixture, targets, targets[0]?.id ?? null, targetModeForAimPreset(preset))
  }

  const applyTriggerRecipeToFixture = (fixtureId: string, recipe: LaserDmxShowDirectorTriggerRecipe, patch?: LaserDmxShowDirectorFixturePatch['trigger']) => {
    updateFixture(fixtureId, { trigger: { ...triggerPatchForRecipe(recipe), ...patch } })
  }

  const showQuickActionsForFixture = (fixtureId: string, clientX: number, clientY: number) => {
    setQuickActionPopover({ fixtureId, x: clientX + 12, y: clientY + 12 })
  }

  useLayoutEffect(() => {
    if (!contextMenu || !contextMenuRef.current) return
    const nextPosition = clampFloatingMenuPosition(contextMenuRef.current, contextMenu, stageRef.current)
    if (nextPosition.x === contextMenu.x && nextPosition.y === contextMenu.y) return
    setContextMenu(current => current ? { ...current, ...nextPosition } : current)
  }, [contextMenu])

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
      commitHistoryTransaction()
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
  }, [commitHistoryTransaction, fixtureDrag, moveSelectedFixtures, settings])

  useEffect(() => {
    if (!endpointDrag) return undefined

    const handlePointerMove = (event: globalThis.PointerEvent) => {
      if (event.pointerId !== endpointDrag.pointerId || !stageRef.current) return
      const point = stagePointFromClient(event.clientX, event.clientY, stageRef.current, settings)
      setFixtureEndpoint(endpointDrag.fixtureId, point, endpointDrag.targetId)
    }

    const handlePointerUp = (event: globalThis.PointerEvent) => {
      if (event.pointerId === endpointDrag.pointerId) {
        commitHistoryTransaction()
        setEndpointDrag(null)
      }
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerUp)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
    }
  }, [commitHistoryTransaction, endpointDrag, setFixtureEndpoint, settings])

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
  }, [clearSelection, fixtures, selectFixtures, selectionRect, settings, updateSelectionRect])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableKeyboardTarget(event.target)) return
      const hasCanvasFocus = stageHasKeyboardFocus()
      const hasCanvasTransientUi = Boolean(selectionRectRef.current || contextMenu || quickActionPopover || targetingFixtureId || endpointDrag)
      if (!hasCanvasFocus && !hasCanvasTransientUi) return

      const key = event.key.toLowerCase()
      const commandKey = event.metaKey || event.ctrlKey

      if (commandKey && key === 'z') {
        if (event.shiftKey) redoShowDirectorEdit()
        else undoShowDirectorEdit()
        setContextMenu(null)
        setQuickActionPopover(null)
        event.preventDefault()
        return
      }

      if (commandKey && key === 'a') {
        const fixtureIds = fixtures.map(fixture => fixture.id)
        selectFixtures(fixtureIds, fixtureIds[0] ?? null)
        setSelectedEndpointId(null)
        setContextMenu(null)
        event.preventDefault()
        return
      }

      if (event.key === 'Escape') {
        const hadSomethingToCancel = Boolean(selectionRectRef.current || contextMenu || quickActionPopover || targetingFixtureId || endpointDrag || selectedEndpointId || selectedFixtureCount > 0)
        if (!hadSomethingToCancel) return
        closeTransientUi()
        if (selectedFixtureCount > 0) clearSelection()
        event.preventDefault()
        return
      }

      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedFixtureCount > 0) {
        deleteSelectedFixtures()
        closeTransientUi()
        event.preventDefault()
        return
      }

      if (!commandKey && key === 'g' && selectedFixtureCount > 1) {
        groupSelectedFixtures()
        setContextMenu(null)
        setQuickActionPopover(null)
        event.preventDefault()
        return
      }

      if (!commandKey && key === 'e' && selectedFixtureId) {
        const primary = fixtures.find(fixture => fixture.id === selectedFixtureId)
        if (primary && isEndpointEditableFixture(primary)) {
          setTargetingFixtureId(primary.id)
          setSelectedEndpointId(beamTargetsForFixture(primary, settings)[0]?.id ?? null)
          setContextMenu(null)
          setQuickActionPopover(null)
          event.preventDefault()
          return
        }
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

    const handleWindowPointerDown = (event: globalThis.PointerEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null
      if (target?.closest('.rv-show-director-context-menu, .rv-show-director-quick-popover')) return
      setContextMenu(null)
      setQuickActionPopover(null)
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('pointerdown', handleWindowPointerDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('pointerdown', handleWindowPointerDown)
    }
  }, [clearSelection, closeTransientUi, contextMenu, deleteSelectedFixtures, endpointDrag, fixtures, groupSelectedFixtures, moveSelectedFixtures, quickActionPopover, redoShowDirectorEdit, selectFixtures, selectedEndpointId, selectedFixtureCount, selectedFixtureId, settings, targetingFixtureId, undoShowDirectorEdit])

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer.types.includes(SHOW_DIRECTOR_FIXTURE_DRAG_TYPE)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
    setIsDragHot(true)
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    focusStage()
    const payload = event.dataTransfer.getData(SHOW_DIRECTOR_FIXTURE_DRAG_TYPE)
    if (!isLaserDmxShowDirectorFixtureKind(payload) || !stageRef.current) return
    event.preventDefault()
    const point = stagePointFromEvent(event, stageRef.current, settings)
    const fixtureId = addFixture(payload, point)
    setAuthoringMode('showDirector')
    showQuickActionsForFixture(fixtureId, event.clientX, event.clientY)
    setContextMenu(null)
    setIsDragHot(false)
  }

  const handleCanvasClick = (event: MouseEvent<HTMLDivElement>) => {
    focusStage()
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
    setQuickActionPopover(null)
    if (!target?.closest('.rv-show-director-fixture')) {
      clearSelection()
      setSelectedEndpointId(null)
    }
  }

  const handleStagePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    focusStage()
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
    setQuickActionPopover(null)
    setSelectedEndpointId(null)
  }

  const handleStageContextMenu = (event: MouseEvent<HTMLDivElement>) => {
    if (!stageRef.current) return
    const target = event.target as HTMLElement | null
    if (target?.closest('.rv-show-director-fixture') || target?.closest('.rv-show-director-beam-overlay__endpoint')) return
    event.preventDefault()
    event.stopPropagation()
    focusStage()
    const point = snapStagePoint(stagePointFromClient(event.clientX, event.clientY, stageRef.current, settings), settings)
    setContextMenu({ kind: 'stage', point, x: event.clientX, y: event.clientY })
    setQuickActionPopover(null)
    setTargetingFixtureId(null)
    setSelectedEndpointId(null)
  }

  const handleFixtureContextMenu = (event: MouseEvent<HTMLButtonElement>, fixture: LaserDmxShowDirectorFixture) => {
    event.preventDefault()
    event.stopPropagation()
    focusStage()
    const isSelected = selectedFixtureSet.has(fixture.id)
    const hasFixtureEndpointActions = isEndpointEditableFixture(fixture)
    if (!isSelected) selectFixture(fixture.id)
    setTargetingFixtureId(null)
    setQuickActionPopover(null)
    setSelectedEndpointId(hasFixtureEndpointActions ? beamTargetsForFixture(fixture, settings)[0]?.id ?? null : null)
    setContextMenu({ kind: 'fixture', fixtureId: fixture.id, x: event.clientX, y: event.clientY })
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
    if (contextMenu?.kind !== 'fixture') return
    selectFixture(contextMenu.fixtureId)
    setTargetingFixtureId(contextMenu.fixtureId)
    setContextMenu(null)
  }

  const handleAddEndpointFromMenu = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    if (contextMenu?.kind !== 'fixture') return
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
    if (contextMenu?.kind !== 'fixture') return
    const fixture = fixtures.find(item => item.id === contextMenu.fixtureId)
    if (!fixture) return
    selectFixture(fixture.id)
    const targets = createFanTargets(fixture, settings)
    updateFixtureTargets(fixture, targets, targets[0]?.id ?? null, 'fan')
    setContextMenu(null)
  }

  const handleAimPresetFromMenu = (event: MouseEvent<HTMLButtonElement>, preset: ShowDirectorAimPreset) => {
    event.preventDefault()
    event.stopPropagation()
    if (!contextFixture) return
    selectFixture(contextFixture.id)
    applyAimPresetToFixture(contextFixture, preset)
    setContextMenu(null)
  }

  const handleCopyFixtureFromMenu = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    if (!contextFixture) return
    setFixtureClipboard({ source: contextFixture })
    setContextMenu(null)
  }

  const handleDuplicateFixtureFromMenu = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    if (!contextFixture) return
    if (selectedFixtureSet.has(contextFixture.id) && selectedFixtureCount > 1) duplicateSelectedFixtures()
    else duplicateFixture(contextFixture.id)
    setContextMenu(null)
  }

  const handleMirrorFixtureFromMenu = (event: MouseEvent<HTMLButtonElement>, axis: 'horizontal' | 'vertical') => {
    event.preventDefault()
    event.stopPropagation()
    if (!contextFixture) return
    const fixtureIds = selectedFixtureSet.has(contextFixture.id) && selectedFixtureCount > 1
      ? canvasSelectedFixtureIds
      : [contextFixture.id]
    fixtureIds.forEach(fixtureId => mirrorFixture(fixtureId, axis))
    setContextMenu(null)
  }

  const handleCreateMirrorPairFromMenu = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    if (contextFixture) createMirrorPair(contextFixture.id, 'horizontal')
    setContextMenu(null)
  }

  const handleUnlinkMirrorPairFromMenu = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    if (contextFixture) unlinkMirrorPair(contextFixture.id)
    setContextMenu(null)
  }

  const handleDeleteFixtureFromMenu = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    if (!contextFixture) return
    if (selectedFixtureSet.has(contextFixture.id) && selectedFixtureCount > 1) deleteSelectedFixtures()
    else deleteFixture(contextFixture.id)
    setContextMenu(null)
    setSelectedEndpointId(null)
  }

  const handleAddFixtureAtContextPoint = (event: MouseEvent<HTMLButtonElement>, kind: LaserDmxShowDirectorFixtureKind) => {
    event.preventDefault()
    event.stopPropagation()
    if (!contextStagePoint) return
    const fixtureId = addFixture(kind, contextStagePoint)
    setAuthoringMode('showDirector')
    showQuickActionsForFixture(fixtureId, event.clientX, event.clientY)
    setContextMenu(null)
  }

  const handlePasteAtContextPoint = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    if (!contextStagePoint || !fixtureClipboard) return
    const fixtureId = addFixture(fixtureClipboard.source.kind, cloneFixturePatchAtPoint(fixtureClipboard.source, contextStagePoint, settings))
    setAuthoringMode('showDirector')
    showQuickActionsForFixture(fixtureId, event.clientX, event.clientY)
    setContextMenu(null)
  }

  const handleSelectAllFromMenu = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    const fixtureIds = fixtures.map(fixture => fixture.id)
    selectFixtures(fixtureIds, fixtureIds[0] ?? null)
    setContextMenu(null)
  }

  const handleClearSelectionFromMenu = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    clearSelection()
    setSelectedEndpointId(null)
    setContextMenu(null)
  }

  const handleResetViewFromMenu = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    updateSettings({ zoom: 1 })
    setContextMenu(null)
  }

  const handleQuickAimPreset = (event: MouseEvent<HTMLButtonElement>, fixture: LaserDmxShowDirectorFixture, preset: ShowDirectorAimPreset) => {
    event.preventDefault()
    event.stopPropagation()
    selectFixture(fixture.id)
    applyAimPresetToFixture(fixture, preset)
    setQuickActionPopover(null)
  }

  const handleQuickTriggerRecipe = (
    event: MouseEvent<HTMLButtonElement>,
    fixture: LaserDmxShowDirectorFixture,
    recipe: LaserDmxShowDirectorTriggerRecipe,
    patch?: LaserDmxShowDirectorFixturePatch['trigger'],
  ) => {
    event.preventDefault()
    event.stopPropagation()
    selectFixture(fixture.id)
    applyTriggerRecipeToFixture(fixture.id, recipe, patch)
    setQuickActionPopover(null)
  }

  const handleFixturePointerDown = (event: ReactPointerEvent<HTMLButtonElement>, fixture: LaserDmxShowDirectorFixture) => {
    if (!stageRef.current || event.button !== 0 || targetingFixtureId) return
    event.stopPropagation()
    setSelectedEndpointId(null)
    setContextMenu(null)
    setQuickActionPopover(null)

    if (isSelectionModifier(event)) {
      event.preventDefault()
      toggleFixtureSelection(fixture.id)
      suppressNextFixtureClickRef.current = true
      return
    }

    didPointerDragRef.current = false
    beginHistoryTransaction()
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
      commitHistoryTransaction()
      setFixtureDrag(null)
    }
  }

  const handleEndpointPointerDown = (event: ReactPointerEvent<SVGCircleElement>, fixture: LaserDmxShowDirectorFixture, targetId: string) => {
    if (!stageRef.current || event.button !== 0 || !isEndpointEditableFixture(fixture)) return
    event.preventDefault()
    event.stopPropagation()
    beginHistoryTransaction()
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
    if (endpointDrag?.pointerId === event.pointerId) {
      commitHistoryTransaction()
      setEndpointDrag(null)
    }
  }

  const quickActionsForFixture = (fixture: LaserDmxShowDirectorFixture): Array<{ key: string; label: string; onClick: (event: MouseEvent<HTMLButtonElement>) => void }> => {
    const actions: Array<{ key: string; label: string; onClick: (event: MouseEvent<HTMLButtonElement>) => void }> = []
    const addAim = (key: string, label: string, preset: ShowDirectorAimPreset) => {
      if (isEndpointEditableFixture(fixture)) {
        actions.push({ key, label, onClick: event => handleQuickAimPreset(event, fixture, preset) })
      }
    }
    const addRecipe = (key: string, label: string, recipe: LaserDmxShowDirectorTriggerRecipe, patch?: LaserDmxShowDirectorFixturePatch['trigger']) => {
      actions.push({ key, label, onClick: event => handleQuickTriggerRecipe(event, fixture, recipe, patch) })
    }

    switch (fixture.kind) {
      case 'laser':
        addAim('aim-center', 'Aim Center', 'center')
        addAim('create-fan', 'Create Fan', 'fanOutward')
        addRecipe('drop-hit', 'Drop Hit', 'fireAtDrop')
        break
      case 'movingHead':
        addAim('aim-center', 'Aim Center', 'center')
        addAim('fan-outward', 'Fan Outward', 'fanOutward')
        addRecipe('every-bar', 'Every Bar', 'pulseEveryBar')
        break
      case 'strobe':
        addRecipe('snare-hits', 'Snare Hits', 'hitOnSnareTransient')
        addRecipe('every-4-bars', 'Every 4 Bars', 'flashEvery4Bars')
        break
      case 'co2Jet':
        addRecipe('fire-at-drop', 'Fire at Drop', 'fireAtDrop')
        break
      case 'haze':
        addRecipe('always-on', 'Always On', 'alwaysOn')
        addRecipe('build-drop', 'Build + Drop', 'turnOnDuringBuild', { sectionTypes: ['build', 'drop'], quantize: 'section', retrigger: 'allow', fadeInMs: 450, fadeOutMs: 900 })
        break
      case 'ledBar':
      case 'ledTube':
        addRecipe('pulse-beat', 'Pulse Beat', 'pulseEveryBeat')
        addRecipe('react-bass', 'React Bass', 'reactToBass')
        break
      case 'blinder':
        addRecipe('every-4-bars', 'Every 4 Bars', 'flashEvery4Bars')
        addRecipe('drop-hit', 'Drop Hit', 'fireAtDrop')
        break
      case 'parWash':
        addAim('aim-center', 'Aim Center', 'center')
        addRecipe('react-energy', 'React Energy', 'reactToEnergy')
        addRecipe('build-drop', 'Build + Drop', 'turnOnDuringBuild', { sectionTypes: ['build', 'drop'], quantize: 'section', retrigger: 'allow', fadeInMs: 300, fadeOutMs: 620 })
        break
      case 'videoWall':
        addRecipe('drop-visual', 'Drop Visual', 'turnOnDuringDrop')
        break
      default:
        addRecipe('always-on', 'Always On', 'alwaysOn')
    }

    return actions
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
        className={`rv-show-director-canvas${isDragHot ? ' rv-show-director-canvas--drag-hot' : ''}${fixtureDrag ? ' rv-show-director-canvas--fixture-dragging' : ''}${endpointDrag ? ' rv-show-director-canvas--endpoint-dragging' : ''}${selectionRect ? ' rv-show-director-canvas--box-selecting' : ''}${targetingFixtureId ? ' rv-show-director-canvas--targeting' : ''}${settings.highlightFixtures === false ? ' rv-show-director-canvas--fixtures-muted' : ''}`}
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
          className={`rv-show-director-canvas__stage${settings.showGrid && presentationVisibility.showGrid ? '' : ' rv-show-director-canvas__stage--grid-hidden'}`}
          style={{
            '--show-director-columns': columns,
            '--show-director-rows': rows,
            '--show-director-zoom': settings.zoom,
          } as CSSProperties}
          onClick={handleCanvasClick}
          onPointerDown={handleStagePointerDown}
          onContextMenu={handleStageContextMenu}
          tabIndex={0}
        >
          {presentationVisibility.showAxes && (
            <>
              <div className="rv-show-director-stage-centerline rv-show-director-stage-centerline--vertical" aria-hidden="true" />
              <div className="rv-show-director-stage-centerline rv-show-director-stage-centerline--horizontal" aria-hidden="true" />
            </>
          )}

          {presentationVisibility.showSelection && selectedFixtureCount > 1 && (
            <div className="rv-show-director-selection-badge" role="status">
              {selectedFixtureCount} selected
            </div>
          )}

          {presentationVisibility.showSelection && selectionRect && (
            <div className="rv-show-director-selection-rect" style={selectionRectStyle(selectionRect, settings)} aria-hidden="true" />
          )}

          {settings.showBeams && presentationVisibility.showBeamHandles && editorFixtures.some(isEndpointEditableFixture) && (
            <svg className="rv-show-director-beam-overlay" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              {editorFixtures.filter(isEndpointEditableFixture).map(fixture => {
                const isSelectedFixture = fixture.id === selectedFixtureId && selectedFixtureCount === 1
                const isDraggingEndpoint = endpointDrag?.fixtureId === fixture.id
                const origin = stagePointToPercent({ x: fixture.x, y: fixture.y }, settings)
                const targets = beamTargetsForFixture(fixture, settings)
                const selectedTargetId = isSelectedFixture
                  ? selectedEndpointId ?? targets[0]?.id ?? null
                  : null
                if (fixture.kind === 'laser' && fixture.scanner?.path.points.length) {
                  const scannerPoints = fixture.scanner.path.points
                  const segments = scannerPoints.flatMap((point, pointIndex) => {
                    const nextIndex = pointIndex + 1 < scannerPoints.length
                      ? pointIndex + 1
                      : fixture.scanner?.path.closed && scannerPoints.length > 1 ? 0 : -1
                    if (nextIndex < 0) return []
                    const next = scannerPoints[nextIndex]!
                    const from = stagePointToPercent(point, settings)
                    const to = stagePointToPercent(next, settings)
                    const blanked = point.blanked || next.blanked
                    return [(
                      <g
                        key={`${fixture.id}-scanner-segment-${pointIndex}-${nextIndex}`}
                        className={`rv-show-director-scanner-overlay__segment${blanked ? ' rv-show-director-scanner-overlay__segment--blanked' : ''}`}
                        style={{ '--show-director-beam-color': fixture.color } as CSSProperties}
                      >
                        <line className="rv-show-director-scanner-overlay__glow" x1={from.x} y1={from.y} x2={to.x} y2={to.y} />
                        <line className="rv-show-director-scanner-overlay__core" x1={from.x} y1={from.y} x2={to.x} y2={to.y} />
                        {isSelectedFixture && (
                          <text
                            className="rv-show-director-scanner-overlay__direction"
                            x={(from.x + to.x) / 2}
                            y={(from.y + to.y) / 2 - 0.7}
                          >
                            {blanked ? '×' : fixture.scanner?.direction === 'alternating' ? '↔' : fixture.scanner?.direction === 'reverse' || fixture.scanner?.reversePath ? '‹' : '›'}
                          </text>
                        )}
                      </g>
                    )]
                  })
                  const handles = scannerPoints.map((point, pointIndex) => {
                    const endpoint = stagePointToPercent(point, settings)
                    const isSelectedTarget = isSelectedFixture && (selectedTargetId === point.id || (!selectedTargetId && pointIndex === 0))
                    return (
                      <g key={`${fixture.id}-${point.id}`} className="rv-show-director-scanner-overlay__point">
                        <circle
                          className={`rv-show-director-beam-overlay__endpoint${pointIndex === 0 ? ' rv-show-director-beam-overlay__endpoint--primary' : ''}${point.blanked ? ' rv-show-director-scanner-overlay__point--blanked' : ''}`}
                          cx={endpoint.x}
                          cy={endpoint.y}
                          r={isSelectedTarget ? 1.34 : isSelectedFixture ? 1.08 : 0.72}
                          onPointerDown={isSelectedFixture ? event => handleEndpointPointerDown(event, fixture, point.id) : undefined}
                          onPointerUp={isSelectedFixture ? handleEndpointPointerRelease : undefined}
                          onPointerCancel={isSelectedFixture ? handleEndpointPointerRelease : undefined}
                          onLostPointerCapture={isSelectedFixture ? handleEndpointPointerRelease : undefined}
                        />
                        {isSelectedFixture && <text className="rv-show-director-scanner-overlay__order" x={endpoint.x + 1.2} y={endpoint.y - 1.2}>{pointIndex + 1}</text>}
                        {isSelectedFixture && (point.depthLayer || point.dwellMicros > 24) && <text className="rv-show-director-scanner-overlay__badge" x={endpoint.x + 1.2} y={endpoint.y + 2.2}>{point.depthLayer ?? `${point.dwellMicros}µs`}</text>}
                      </g>
                    )
                  })
                  const previewIndex = Math.min(scannerPoints.length - 1, Math.floor(fixture.scanner.phase * scannerPoints.length))
                  const preview = scannerPoints[previewIndex]
                  const previewPercent = preview ? stagePointToPercent(preview, settings) : null
                  return (
                    <g key={`${fixture.id}-authored-scanner-path`} className="rv-show-director-scanner-overlay">
                      {segments}
                      {handles}
                      {isSelectedFixture && previewPercent && <circle className="rv-show-director-scanner-overlay__preview" cx={previewPercent.x} cy={previewPercent.y} r={1.65} />}
                    </g>
                  )
                }
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

          {editorFixtures.map(fixture => {
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
                {settings.showBeams && fixture.enabled && fixture.beam.beamEnabled && !fixture.scanner && (
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

      {contextMenu && typeof document !== 'undefined' && createPortal((
        <div
          ref={contextMenuRef}
          className="rv-show-director-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y } as CSSProperties}
          role="menu"
          onPointerDown={event => event.stopPropagation()}
        >
          {contextMenu.kind === 'stage' ? (
            <>
              <button type="button" role="menuitem" onClick={event => handleAddFixtureAtContextPoint(event, 'laser')}>Add Laser Here</button>
              <button type="button" role="menuitem" onClick={event => handleAddFixtureAtContextPoint(event, 'movingHead')}>Add Moving Head Here</button>
              <button type="button" role="menuitem" onClick={event => handleAddFixtureAtContextPoint(event, 'strobe')}>Add Strobe Here</button>
              <button type="button" role="menuitem" onClick={event => handleAddFixtureAtContextPoint(event, 'ledBar')}>Add LED Bar Here</button>
              {fixtureClipboard && <button type="button" role="menuitem" onClick={handlePasteAtContextPoint}>Paste</button>}
              <span className="rv-show-director-context-menu__divider" role="separator" />
              <button type="button" role="menuitem" onClick={handleSelectAllFromMenu}>Select All</button>
              <button type="button" role="menuitem" onClick={handleClearSelectionFromMenu}>Clear Selection</button>
              <button type="button" role="menuitem" onClick={handleResetViewFromMenu}>Reset View</button>
            </>
          ) : (
            <>
              {contextFixture && selectedFixtureSet.has(contextFixture.id) && selectedFixtureCount > 1 && (
                <>
                  <button type="button" role="menuitem" onClick={handleGroupSelectedFromMenu}>Group Selected</button>
                  <button type="button" role="menuitem" onClick={handleUngroupSelectedFromMenu}>Ungroup Selected</button>
                  <span className="rv-show-director-context-menu__divider" role="separator" />
                </>
              )}
              {contextFixture && isEndpointEditableFixture(contextFixture) && (
                <>
                  <button type="button" role="menuitem" onClick={handleSetEndpointFromMenu}>Set Endpoint</button>
                  <button type="button" role="menuitem" onClick={handleAddEndpointFromMenu}>Add Beam Endpoint</button>
                  <button type="button" role="menuitem" onClick={handleCreateFanFromMenu}>Create Fan</button>
                  <span className="rv-show-director-context-menu__divider" role="separator" />
                  {(['center', 'left', 'right', 'crowd', 'upstage', 'downstage', 'crossCenter', 'fanOutward', 'clear'] as ShowDirectorAimPreset[]).map(preset => (
                    <button key={preset} type="button" role="menuitem" onClick={event => handleAimPresetFromMenu(event, preset)}>
                      {SHOW_DIRECTOR_AIM_PRESET_LABELS[preset]}
                    </button>
                  ))}
                  <span className="rv-show-director-context-menu__divider" role="separator" />
                </>
              )}
              {contextFixture?.groupId && (
                <>
                  <button type="button" role="menuitem" onClick={handleSelectGroupFromMenu}>Select Group</button>
                  <button type="button" role="menuitem" onClick={handleRenameGroupFromMenu}>Rename Group</button>
                  <button type="button" role="menuitem" onClick={handleDuplicateGroupFromMenu}>Duplicate Group</button>
                  <button type="button" role="menuitem" onClick={handleUngroupGroupFromMenu}>Ungroup</button>
                  <span className="rv-show-director-context-menu__divider" role="separator" />
                </>
              )}
              {contextFixture && (
                <>
                  <button type="button" role="menuitem" onClick={handleCopyFixtureFromMenu}>Copy</button>
                  <button type="button" role="menuitem" onClick={handleDuplicateFixtureFromMenu}>Duplicate</button>
                  <button type="button" role="menuitem" onClick={handleCreateMirrorPairFromMenu}>Create Mirror Pair</button>
                  {contextFixture.linkedPairId && <button type="button" role="menuitem" onClick={handleUnlinkMirrorPairFromMenu}>Unlink Mirror Pair</button>}
                  <button type="button" role="menuitem" onClick={event => handleMirrorFixtureFromMenu(event, 'horizontal')}>Mirror Horizontally</button>
                  <button type="button" role="menuitem" onClick={event => handleMirrorFixtureFromMenu(event, 'vertical')}>Mirror Vertically</button>
                  <button type="button" role="menuitem" className="rv-show-director-context-menu__danger" onClick={handleDeleteFixtureFromMenu}>Delete</button>
                </>
              )}
            </>
          )}
        </div>
      ), document.body)}

      {quickActionPopover && quickActionFixture && (
        <div
          className="rv-show-director-quick-popover"
          style={{ left: quickActionPopover.x, top: quickActionPopover.y } as CSSProperties}
          role="dialog"
          aria-label={`${quickActionFixture.label} quick actions`}
          onPointerDown={event => event.stopPropagation()}
        >
          <div className="rv-show-director-quick-popover__header">
            <span>Quick Actions</span>
            <strong>{quickActionFixture.label}</strong>
          </div>
          <div className="rv-show-director-quick-popover__actions">
            {quickActionsForFixture(quickActionFixture).map(action => (
              <button key={action.key} type="button" onClick={action.onClick}>{action.label}</button>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
