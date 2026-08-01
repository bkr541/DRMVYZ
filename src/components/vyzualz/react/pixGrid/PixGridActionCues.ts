import type { BeatMarkerMI } from '../../../../features/musicIntelligence/types'
import { resolveSharedPerformanceEventEnvelope } from '../../../../features/performanceCore'
import type { PixGridGroupFrameEffect } from './PixGridFrameEffects'
import { clonePixGridLayer } from './PixGridDefaults'
import { normalizePixGridColor, normalizePixGridState } from './PixGridValidation'
import type {
  PixGridAnimationBoundary,
  PixGridAnimationMode,
  PixGridColorMode,
  PixGridLayer,
  PixGridLayerAnimation,
  PixGridPaletteRole,
  PixGridState,
} from './PixGridTypes'
import {
  MAX_PIX_GRID_ACTION_CUES_PER_TRACK,
  MAX_PIX_GRID_ACTION_CUE_TRACKS,
} from './PixGridLimits'

export const PIX_GRID_ACTION_CUE_ENGINE_ID = 'pixGrid' as const
export const PIX_GRID_ACTION_CUE_VERSION = 1 as const

export type PixGridCueQuantization = 'none' | 'beat' | 'bar' | 'fourBars'
export type PixGridCueLoopBehavior = 'retrigger' | 'once'
export type PixGridCueTransition =
  | 'cut'
  | 'crossfade'
  | 'rowWipe'
  | 'columnWipe'
  | 'checkerWipe'
  | 'pixelDissolve'
  | 'radialReveal'
  | 'paletteFade'
  | 'powerOn'
  | 'powerOff'
export type PixGridCueProvenanceKind = 'manual' | 'section' | 'transportCue' | 'rekordboxCue' | 'semanticMoment' | 'phrase'
export type PixGridCueAnimationClock = 'time' | 'beat' | 'bar' | 'cue'
export type PixGridCueTarget = 'all' | { layerId: string } | { groupId: string }

export interface PixGridCueProvenance {
  kind: PixGridCueProvenanceKind
  sourceId?: string
}

export interface PixGridManualOverridePatch {
  visible?: boolean
  opacity?: number
  positionX?: number
  positionY?: number
  scaleX?: number
  scaleY?: number
  rotation?: number
  animationSpeed?: number
  paletteRole?: PixGridPaletteRole
}

export type PixGridActionCueAction =
  | { type: 'selectScene'; sceneId: string }
  | { type: 'setLayerVisible'; layerId: string; visible: boolean }
  | { type: 'setGroupVisible'; groupId: string; visible: boolean }
  | { type: 'flashGroup'; groupId: string; amount: number; paletteRole?: PixGridPaletteRole }
  | { type: 'revealRows'; target: PixGridCueTarget; from: 'top' | 'bottom' | 'center' }
  | { type: 'revealColumns'; target: PixGridCueTarget; from: 'left' | 'right' | 'center' }
  | { type: 'dissolveGroup'; groupId: string; amount: number }
  | { type: 'setPaletteMode'; mode: PixGridColorMode }
  | { type: 'setBackground'; mode: 'preset' | 'black' | 'custom'; color?: string; brightness?: number }
  | { type: 'resetBackground' }
  | {
      type: 'startAnimation'
      target: PixGridCueTarget
      animation: PixGridAnimationMode
      speed: number
      amount: number
      boundary: PixGridAnimationBoundary
      clock: PixGridCueAnimationClock
      axis?: 'x' | 'y'
    }
  | { type: 'stopAnimation'; target: PixGridCueTarget }
  | { type: 'reverseAnimation'; target: PixGridCueTarget }
  | { type: 'setAnimationSpeed'; target: PixGridCueTarget; speed: number }
  | { type: 'jumpAnimationFrame'; target: PixGridCueTarget; frame: number }
  | { type: 'moveTarget'; target: PixGridCueTarget; x?: number; y?: number }
  | { type: 'setTargetScale'; target: PixGridCueTarget; x: number; y: number }
  | { type: 'setTargetRotation'; target: PixGridCueTarget; degrees: number }
  | { type: 'freeze'; active: boolean }
  | { type: 'clearScreen' }
  | { type: 'restoreScene' }
  | { type: 'setAutoPerformance'; enabled: boolean }
  | { type: 'applyManualOverride'; route: string; target: PixGridCueTarget; durationSec: number; patch: PixGridManualOverridePatch }
  | { type: 'clearManualOverride'; route?: string }

export interface PixGridActionCue {
  version: typeof PIX_GRID_ACTION_CUE_VERSION
  id: string
  timeSec: number
  label: string
  enabled: boolean
  engineId: typeof PIX_GRID_ACTION_CUE_ENGINE_ID
  action: PixGridActionCueAction
  quantization: PixGridCueQuantization
  transition: PixGridCueTransition
  transitionDurationSec: number
  oneShotDurationSec: number
  loopBehavior: PixGridCueLoopBehavior
  order: number
  provenance?: PixGridCueProvenance
  color?: string
}

export interface PixGridResolvedTransition {
  cueId: string
  type: PixGridCueTransition
  progress: number
  startedAtSec: number
  durationSec: number
  seed: number
  fromState: PixGridState
}

export type PixGridCueTransitionStatus = Omit<PixGridResolvedTransition, 'fromState'>

export interface PixGridCueRuntimeSnapshot {
  trackId: string | null
  active: boolean
  activeCueIds: readonly string[]
  mostRecentCueId: string | null
  mostRecentCueLabel: string | null
  activeOneShotCueIds: readonly string[]
  manualOverrideRoutes: readonly string[]
  transition: PixGridCueTransitionStatus | null
  deterministicIdentity: string
}

export interface PixGridResolvedCueFrame {
  state: PixGridState
  snapshot: PixGridCueRuntimeSnapshot
  transition: PixGridResolvedTransition | null
  groupEffects: readonly PixGridGroupFrameEffect[]
}

const ACTION_TYPES = new Set<PixGridActionCueAction['type']>([
  'selectScene', 'setLayerVisible', 'setGroupVisible', 'flashGroup', 'revealRows', 'revealColumns',
  'dissolveGroup', 'setPaletteMode', 'setBackground', 'resetBackground', 'startAnimation',
  'stopAnimation', 'reverseAnimation', 'setAnimationSpeed', 'jumpAnimationFrame', 'moveTarget',
  'setTargetScale', 'setTargetRotation', 'freeze', 'clearScreen', 'restoreScene',
  'setAutoPerformance', 'applyManualOverride', 'clearManualOverride',
])
const QUANTIZATION = new Set<PixGridCueQuantization>(['none', 'beat', 'bar', 'fourBars'])
const TRANSITIONS = new Set<PixGridCueTransition>([
  'cut', 'crossfade', 'rowWipe', 'columnWipe', 'checkerWipe', 'pixelDissolve', 'radialReveal',
  'paletteFade', 'powerOn', 'powerOff',
])
const LOOP_BEHAVIORS = new Set<PixGridCueLoopBehavior>(['retrigger', 'once'])
const CLOCKS = new Set<PixGridCueAnimationClock>(['time', 'beat', 'bar', 'cue'])
const ANIMATIONS = new Set<PixGridAnimationMode>([
  'static', 'pulse', 'bounce', 'horizontalScroll', 'verticalScroll', 'pingPong', 'rotate',
  'paletteCycle', 'blink', 'revealRow', 'revealColumn', 'checkerAlternate', 'columnMeter', 'frameCycle',
  'audioAmplitudeScale', 'beatStepMovement',
])
const BOUNDARIES = new Set<PixGridAnimationBoundary>(['wrap', 'clamp', 'bounce'])
const PALETTE_MODES = new Set<PixGridColorMode>(['original', 'hybrid', 'brand', 'preset'])
const PALETTE_ROLES = new Set<PixGridPaletteRole>(['primary', 'secondary', 'accent', 'highlight', 'background'])
const PROVENANCE = new Set<PixGridCueProvenanceKind>(['manual', 'section', 'transportCue', 'rekordboxCue', 'semanticMoment', 'phrase'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  return Math.max(min, Math.min(max, finite(value, fallback)))
}

function text(value: unknown, fallback: string, maxLength = 128): string {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, maxLength) : fallback
}

function normalizeTarget(value: unknown): PixGridCueTarget {
  if (value === 'all') return 'all'
  if (!isRecord(value)) return 'all'
  if (typeof value.layerId === 'string' && value.layerId.trim()) return { layerId: value.layerId.trim().slice(0, 128) }
  if (typeof value.groupId === 'string' && value.groupId.trim()) return { groupId: value.groupId.trim().slice(0, 128) }
  return 'all'
}

function normalizeOverridePatch(value: unknown): PixGridManualOverridePatch {
  if (!isRecord(value)) return {}
  return {
    ...(typeof value.visible === 'boolean' ? { visible: value.visible } : {}),
    ...(value.opacity != null ? { opacity: clamp(value.opacity, 0, 1, 1) } : {}),
    ...(value.positionX != null ? { positionX: clamp(value.positionX, -1, 2, 0.5) } : {}),
    ...(value.positionY != null ? { positionY: clamp(value.positionY, -1, 2, 0.5) } : {}),
    ...(value.scaleX != null ? { scaleX: clamp(value.scaleX, 0.01, 4, 1) } : {}),
    ...(value.scaleY != null ? { scaleY: clamp(value.scaleY, 0.01, 4, 1) } : {}),
    ...(value.rotation != null ? { rotation: clamp(value.rotation, -3600, 3600, 0) } : {}),
    ...(value.animationSpeed != null ? { animationSpeed: clamp(value.animationSpeed, -20, 20, 1) } : {}),
    ...(PALETTE_ROLES.has(value.paletteRole as PixGridPaletteRole) ? { paletteRole: value.paletteRole as PixGridPaletteRole } : {}),
  }
}

export function defaultPixGridCueAction(type: PixGridActionCueAction['type'] = 'selectScene'): PixGridActionCueAction {
  switch (type) {
    case 'selectScene': return { type, sceneId: 'pix-grid-scene-1' }
    case 'setLayerVisible': return { type, layerId: '', visible: true }
    case 'setGroupVisible': return { type, groupId: '', visible: true }
    case 'flashGroup': return { type, groupId: '', amount: 1, paletteRole: 'highlight' }
    case 'revealRows': return { type, target: 'all', from: 'top' }
    case 'revealColumns': return { type, target: 'all', from: 'left' }
    case 'dissolveGroup': return { type, groupId: '', amount: 1 }
    case 'setPaletteMode': return { type, mode: 'preset' }
    case 'setBackground': return { type, mode: 'black', brightness: 0 }
    case 'resetBackground': return { type }
    case 'startAnimation': return { type, target: 'all', animation: 'pulse', speed: 1, amount: 0.25, boundary: 'wrap', clock: 'time' }
    case 'stopAnimation': return { type, target: 'all' }
    case 'reverseAnimation': return { type, target: 'all' }
    case 'setAnimationSpeed': return { type, target: 'all', speed: 1 }
    case 'jumpAnimationFrame': return { type, target: 'all', frame: 0 }
    case 'moveTarget': return { type, target: 'all', x: 0.5, y: 0.5 }
    case 'setTargetScale': return { type, target: 'all', x: 1, y: 1 }
    case 'setTargetRotation': return { type, target: 'all', degrees: 0 }
    case 'freeze': return { type, active: true }
    case 'clearScreen': return { type }
    case 'restoreScene': return { type }
    case 'setAutoPerformance': return { type, enabled: true }
    case 'applyManualOverride': return { type, route: 'manual', target: 'all', durationSec: 4, patch: { opacity: 1 } }
    case 'clearManualOverride': return { type }
  }
}

export function normalizePixGridCueAction(value: unknown): PixGridActionCueAction {
  if (!isRecord(value) || !ACTION_TYPES.has(value.type as PixGridActionCueAction['type'])) return defaultPixGridCueAction()
  const type = value.type as PixGridActionCueAction['type']
  switch (type) {
    case 'selectScene': return { type, sceneId: text(value.sceneId, 'pix-grid-scene-1') }
    case 'setLayerVisible': return { type, layerId: text(value.layerId, ''), visible: value.visible !== false }
    case 'setGroupVisible': return { type, groupId: text(value.groupId, ''), visible: value.visible !== false }
    case 'flashGroup': return {
      type,
      groupId: text(value.groupId, ''),
      amount: clamp(value.amount, 0, 2, 1),
      ...(PALETTE_ROLES.has(value.paletteRole as PixGridPaletteRole) ? { paletteRole: value.paletteRole as PixGridPaletteRole } : {}),
    }
    case 'revealRows': return {
      type,
      target: normalizeTarget(value.target),
      from: value.from === 'bottom' || value.from === 'center' ? value.from : 'top',
    }
    case 'revealColumns': return {
      type,
      target: normalizeTarget(value.target),
      from: value.from === 'right' || value.from === 'center' ? value.from : 'left',
    }
    case 'dissolveGroup': return { type, groupId: text(value.groupId, ''), amount: clamp(value.amount, 0, 1, 1) }
    case 'setPaletteMode': return { type, mode: PALETTE_MODES.has(value.mode as PixGridColorMode) ? value.mode as PixGridColorMode : 'preset' }
    case 'setBackground': return {
      type,
      mode: value.mode === 'preset' || value.mode === 'custom' ? value.mode : 'black',
      ...(value.color != null ? { color: normalizePixGridColor(value.color, '#000000') } : {}),
      ...(value.brightness != null ? { brightness: clamp(value.brightness, 0, 1, 0) } : {}),
    }
    case 'resetBackground': return { type }
    case 'startAnimation': return {
      type,
      target: normalizeTarget(value.target),
      animation: ANIMATIONS.has(value.animation as PixGridAnimationMode) ? value.animation as PixGridAnimationMode : 'pulse',
      speed: clamp(value.speed, -20, 20, 1),
      amount: clamp(value.amount, -4, 4, 0.25),
      boundary: BOUNDARIES.has(value.boundary as PixGridAnimationBoundary) ? value.boundary as PixGridAnimationBoundary : 'wrap',
      clock: CLOCKS.has(value.clock as PixGridCueAnimationClock) ? value.clock as PixGridCueAnimationClock : 'time',
      ...(value.axis === 'x' || value.axis === 'y' ? { axis: value.axis } : {}),
    }
    case 'stopAnimation': return { type, target: normalizeTarget(value.target) }
    case 'reverseAnimation': return { type, target: normalizeTarget(value.target) }
    case 'setAnimationSpeed': return { type, target: normalizeTarget(value.target), speed: clamp(value.speed, -20, 20, 1) }
    case 'jumpAnimationFrame': return { type, target: normalizeTarget(value.target), frame: Math.round(clamp(value.frame, 0, 4096, 0)) }
    case 'moveTarget': return {
      type,
      target: normalizeTarget(value.target),
      ...(value.x != null ? { x: clamp(value.x, -1, 2, 0.5) } : {}),
      ...(value.y != null ? { y: clamp(value.y, -1, 2, 0.5) } : {}),
    }
    case 'setTargetScale': return { type, target: normalizeTarget(value.target), x: clamp(value.x, 0.01, 4, 1), y: clamp(value.y, 0.01, 4, 1) }
    case 'setTargetRotation': return { type, target: normalizeTarget(value.target), degrees: clamp(value.degrees, -3600, 3600, 0) }
    case 'freeze': return { type, active: value.active !== false }
    case 'clearScreen': return { type }
    case 'restoreScene': return { type }
    case 'setAutoPerformance': return { type, enabled: value.enabled !== false }
    case 'applyManualOverride': return {
      type,
      route: text(value.route, 'manual'),
      target: normalizeTarget(value.target),
      durationSec: clamp(value.durationSec, 0.05, 3600, 4),
      patch: normalizeOverridePatch(value.patch),
    }
    case 'clearManualOverride': return { type, ...(typeof value.route === 'string' && value.route.trim() ? { route: value.route.trim().slice(0, 128) } : {}) }
  }
}

export function normalizePixGridActionCue(value: unknown, fallbackIndex = 0): PixGridActionCue | null {
  if (!isRecord(value)) return null
  if (value.engineId != null && value.engineId !== PIX_GRID_ACTION_CUE_ENGINE_ID) return null
  const id = text(value.id, `pix-grid-cue-${fallbackIndex + 1}`)
  const provenance = isRecord(value.provenance) && PROVENANCE.has(value.provenance.kind as PixGridCueProvenanceKind)
    ? {
        kind: value.provenance.kind as PixGridCueProvenanceKind,
        ...(typeof value.provenance.sourceId === 'string' && value.provenance.sourceId.trim()
          ? { sourceId: value.provenance.sourceId.trim().slice(0, 128) }
          : {}),
      }
    : undefined
  return {
    version: PIX_GRID_ACTION_CUE_VERSION,
    id,
    timeSec: Math.max(0, finite(value.timeSec, 0)),
    label: text(value.label, 'PixGrid Action', 96),
    enabled: value.enabled !== false,
    engineId: PIX_GRID_ACTION_CUE_ENGINE_ID,
    action: normalizePixGridCueAction(value.action),
    quantization: QUANTIZATION.has(value.quantization as PixGridCueQuantization) ? value.quantization as PixGridCueQuantization : 'beat',
    transition: TRANSITIONS.has(value.transition as PixGridCueTransition) ? value.transition as PixGridCueTransition : 'cut',
    transitionDurationSec: clamp(value.transitionDurationSec, 0, 60, 0),
    oneShotDurationSec: clamp(value.oneShotDurationSec, 0.02, 60, 0.5),
    loopBehavior: LOOP_BEHAVIORS.has(value.loopBehavior as PixGridCueLoopBehavior) ? value.loopBehavior as PixGridCueLoopBehavior : 'retrigger',
    order: Math.max(0, Math.round(finite(value.order, fallbackIndex))),
    ...(provenance ? { provenance } : {}),
    ...(value.color != null ? { color: normalizePixGridColor(value.color, '#4ac7db') } : {}),
  }
}

export function sortPixGridActionCues(cues: readonly PixGridActionCue[]): PixGridActionCue[] {
  return [...cues].sort((a, b) => a.timeSec - b.timeSec || a.order - b.order || a.id.localeCompare(b.id))
}

export function normalizePixGridActionCueMap(value: unknown): Record<string, PixGridActionCue[]> {
  if (!isRecord(value)) return {}
  const result: Record<string, PixGridActionCue[]> = {}
  for (const [trackId, bucket] of Object.entries(value).slice(0, MAX_PIX_GRID_ACTION_CUE_TRACKS)) {
    if (!Array.isArray(bucket)) continue
    const seen = new Set<string>()
    const normalized = bucket.slice(0, MAX_PIX_GRID_ACTION_CUES_PER_TRACK).flatMap((cue, index) => {
      const safe = normalizePixGridActionCue(cue, index)
      if (!safe || seen.has(safe.id)) return []
      seen.add(safe.id)
      return [safe]
    })
    result[trackId] = sortPixGridActionCues(normalized)
  }
  return result
}

export function nextPixGridCueOrder(cues: readonly PixGridActionCue[], timeSec: number): number {
  return cues
    .filter(cue => Math.abs(cue.timeSec - timeSec) <= 0.0005)
    .reduce((maximum, cue) => Math.max(maximum, cue.order + 1), 0)
}

function nearestMarker(timeSec: number, markers: readonly BeatMarkerMI[]): BeatMarkerMI | null {
  let nearest: BeatMarkerMI | null = null
  let nearestDistance = Number.POSITIVE_INFINITY
  for (const marker of markers) {
    if (!Number.isFinite(marker.timeSec)) continue
    const distance = Math.abs(marker.timeSec - timeSec)
    if (distance < nearestDistance) {
      nearest = marker
      nearestDistance = distance
    }
  }
  return nearest
}

export function snapPixGridCueTime(
  timeSec: number,
  quantization: PixGridCueQuantization,
  beatGrid: readonly BeatMarkerMI[] | null | undefined,
): number {
  const authored = Math.max(0, Number.isFinite(timeSec) ? timeSec : 0)
  if (quantization === 'none' || !beatGrid?.length) return authored
  const candidates = quantization === 'beat'
    ? beatGrid
    : quantization === 'bar'
      ? beatGrid.filter(marker => marker.isDownbeat)
      : beatGrid.filter(marker => marker.isDownbeat && (((marker.barIndex ?? 0) % 4) === 0))
  return Math.max(0, nearestMarker(authored, candidates)?.timeSec ?? authored)
}

function cloneState(state: PixGridState): PixGridState {
  return {
    ...state,
    editor: { ...state.editor, selection: state.editor.selection ? { ...state.editor.selection } : null },
    scenes: state.scenes.map(scene => ({ ...scene, layerIds: [...scene.layerIds], pixelOverrides: [...scene.pixelOverrides] })),
    layers: state.layers.map(clonePixGridLayer),
    groups: state.groups.map(group => ({
      ...group,
      cellRuns: [...group.cellRuns],
      layerScope: group.layerScope ? [...group.layerScope] : null,
      mask: group.mask.kind === 'runs' ? { kind: 'runs', runs: [...group.mask.runs] } : { ...group.mask },
      reactions: group.reactions.map(reaction => ({ ...reaction, clamp: [...reaction.clamp] as [number, number] })),
    })),
    pixelOverrides: [...state.pixelOverrides],
    performance: { ...state.performance, lockedRoutes: [...state.performance.lockedRoutes] },
    conversion: { ...state.conversion },
    diagnostics: { ...state.diagnostics },
  }
}

function layerIdsForTarget(state: PixGridState, target: PixGridCueTarget): string[] {
  if (target === 'all') return state.layers.map(layer => layer.id)
  return 'layerId' in target ? [target.layerId] : []
}

function updateLayers(state: PixGridState, target: PixGridCueTarget, updater: (layer: PixGridLayer, authored: PixGridLayer | undefined) => PixGridLayer, authoredState = state): PixGridState {
  const ids = new Set(layerIdsForTarget(state, target))
  if (!ids.size) return state
  return {
    ...state,
    layers: state.layers.map(layer => ids.has(layer.id)
      ? updater(layer, authoredState.layers.find(candidate => candidate.id === layer.id))
      : layer),
  }
}

function replaceAnimation(layer: PixGridLayer, animation: PixGridLayerAnimation): PixGridLayer {
  return { ...layer, animations: [animation, ...layer.animations.slice(1)] }
}

function animationClock(action: Extract<PixGridActionCueAction, { type: 'startAnimation' }>): PixGridLayerAnimation['clock'] {
  return action.clock
}

function applyOverridePatch(layer: PixGridLayer, patch: PixGridManualOverridePatch): PixGridLayer {
  return {
    ...layer,
    ...(patch.visible != null ? { visible: patch.visible } : {}),
    ...(patch.opacity != null ? { opacity: patch.opacity } : {}),
    position: {
      x: patch.positionX ?? layer.position.x,
      y: patch.positionY ?? layer.position.y,
    },
    scale: {
      x: patch.scaleX ?? layer.scale.x,
      y: patch.scaleY ?? layer.scale.y,
    },
    rotation: patch.rotation ?? layer.rotation,
    paletteMap: patch.paletteRole ? {
      ...layer.paletteMap,
      primary: patch.paletteRole,
      secondary: patch.paletteRole,
      accent: patch.paletteRole,
      highlight: patch.paletteRole,
    } : layer.paletteMap,
    animations: patch.animationSpeed == null
      ? layer.animations
      : layer.animations.map(animation => ({ ...animation, speed: patch.animationSpeed! })),
  }
}

function revealProgress(elapsed: number, duration: number): number {
  return Math.max(0, Math.min(1, elapsed / Math.max(0.001, duration)))
}

function applyCueAction(
  current: PixGridState,
  authored: PixGridState,
  cue: PixGridActionCue,
  audioTime: number,
): PixGridState {
  const action = cue.action
  const elapsed = Math.max(0, audioTime - cue.timeSec)
  switch (action.type) {
    case 'selectScene':
      return current.scenes.some(scene => scene.id === action.sceneId) ? { ...current, selectedSceneId: action.sceneId } : current
    case 'setLayerVisible':
      return updateLayers(current, { layerId: action.layerId }, layer => ({ ...layer, visible: action.visible }))
    case 'setGroupVisible':
      return current
    case 'flashGroup':
      return current
    case 'revealRows': {
      const progress = revealProgress(elapsed, cue.oneShotDurationSec)
      return updateLayers(current, action.target, layer => ({
        ...layer,
        animations: [{ mode: 'revealRow', speed: 0, amount: 1, phase: progress, boundary: 'clamp', clock: 'cue', revealFrom: action.from === 'bottom' ? 'end' : action.from === 'center' ? 'center' : 'start' }, ...layer.animations.slice(1)],
      }))
    }
    case 'revealColumns': {
      const progress = revealProgress(elapsed, cue.oneShotDurationSec)
      return updateLayers(current, action.target, layer => ({
        ...layer,
        animations: [{ mode: 'revealColumn', speed: 0, amount: 1, phase: progress, boundary: 'clamp', clock: 'cue', revealFrom: action.from === 'right' ? 'end' : action.from === 'center' ? 'center' : 'start' }, ...layer.animations.slice(1)],
      }))
    }
    case 'dissolveGroup':
      return current
    case 'setPaletteMode':
      return { ...current, conversion: { ...current.conversion, colorMode: action.mode } }
    case 'setBackground':
      return {
        ...current,
        backgroundMode: action.mode,
        backgroundColor: action.color ?? current.backgroundColor,
        backgroundBrightness: action.brightness ?? current.backgroundBrightness,
      }
    case 'resetBackground':
      return {
        ...current,
        backgroundMode: authored.backgroundMode,
        backgroundColor: authored.backgroundColor,
        backgroundBrightness: authored.backgroundBrightness,
      }
    case 'startAnimation':
      return updateLayers(current, action.target, layer => replaceAnimation(layer, {
        mode: action.animation,
        speed: action.speed,
        amount: action.amount,
        phase: 0,
        boundary: action.boundary,
        clock: animationClock(action),
        ...(action.axis ? { axis: action.axis } : {}),
      }))
    case 'stopAnimation':
      return updateLayers(current, action.target, layer => ({ ...layer, animations: layer.animations.map(animation => ({ ...animation, speed: 0 })) }))
    case 'reverseAnimation':
      return updateLayers(current, action.target, layer => ({ ...layer, animations: layer.animations.map(animation => ({ ...animation, speed: animation.speed === 0 ? -1 : -animation.speed })) }))
    case 'setAnimationSpeed':
      return updateLayers(current, action.target, layer => ({ ...layer, animations: layer.animations.map(animation => ({ ...animation, speed: action.speed })) }))
    case 'jumpAnimationFrame':
      return updateLayers(current, action.target, layer => ({ ...layer, animations: layer.animations.map(animation => ({ ...animation, phase: action.frame, clock: 'cue' })) }))
    case 'moveTarget':
      return updateLayers(current, action.target, layer => ({ ...layer, position: { x: action.x ?? layer.position.x, y: action.y ?? layer.position.y } }))
    case 'setTargetScale':
      return updateLayers(current, action.target, layer => ({ ...layer, scale: { x: action.x, y: action.y } }))
    case 'setTargetRotation':
      return updateLayers(current, action.target, layer => ({ ...layer, rotation: action.degrees }))
    case 'freeze':
      return updateLayers(current, 'all', (layer, authoredLayer) => ({
        ...layer,
        animations: layer.animations.map((animation, index) => ({
          ...animation,
          speed: action.active ? 0 : (authoredLayer?.animations[index]?.speed ?? (animation.speed || 1)),
        })),
      }), authored)
    case 'clearScreen':
      return { ...current, layers: current.layers.map(layer => ({ ...layer, visible: false })), backgroundMode: 'black', backgroundBrightness: 0 }
    case 'restoreScene':
      return cloneState(authored)
    case 'setAutoPerformance':
      return { ...current, performance: { ...current.performance, enabled: action.enabled } }
    case 'applyManualOverride':
      if (audioTime > cue.timeSec + action.durationSec) return current
      return {
        ...updateLayers(current, action.target, layer => applyOverridePatch(layer, action.patch)),
        performance: {
          ...current.performance,
          lockedRoutes: [...new Set([...current.performance.lockedRoutes, action.route])],
        },
      }
    case 'clearManualOverride':
      return {
        ...current,
        performance: {
          ...current.performance,
          lockedRoutes: action.route
            ? current.performance.lockedRoutes.filter(route => route !== action.route)
            : [],
        },
      }
  }
}


function cueGroupEffects(cue: PixGridActionCue, audioTime: number): PixGridGroupFrameEffect[] {
  const action = cue.action
  const elapsed = Math.max(0, audioTime - cue.timeSec)
  const base = {
    source: 'cue' as const,
    priority: action.type === 'applyManualOverride' ? 620 : 520,
  }
  const targetGroupId = 'target' in action && action.target !== 'all' && 'groupId' in action.target
    ? action.target.groupId
    : null
  switch (action.type) {
    case 'setGroupVisible':
      return [{ ...base, id: `cue:${cue.id}:visibility`, groupId: action.groupId, kind: 'visibility', stage: 'persistent', amount: action.visible ? 1 : 0, blend: 'replace' }]
    case 'flashGroup': {
      const duration = Math.max(0.02, cue.oneShotDurationSec)
      const envelope = resolveSharedPerformanceEventEnvelope(elapsed, {
        attack: Math.min(0.02, duration * 0.1),
        hold: duration * 0.2,
        release: duration * 0.7,
        curve: 'easeOut',
      })
      return envelope > 0 ? [{ ...base, id: `cue:${cue.id}:flash`, groupId: action.groupId, kind: 'flash', stage: 'event', amount: action.amount * envelope, paletteRole: action.paletteRole }] : []
    }
    case 'dissolveGroup':
      return [{ ...base, id: `cue:${cue.id}:dissolve`, groupId: action.groupId, kind: 'dissolve', stage: 'event', amount: revealProgress(elapsed, cue.oneShotDurationSec) * action.amount, seed: stableHash(cue.id) }]
    case 'revealRows':
      return targetGroupId ? [{ ...base, id: `cue:${cue.id}:rows`, groupId: targetGroupId, kind: 'revealRows', stage: 'event', amount: revealProgress(elapsed, cue.oneShotDurationSec), from: action.from === 'bottom' ? 'end' : action.from === 'center' ? 'center' : 'start' }] : []
    case 'revealColumns':
      return targetGroupId ? [{ ...base, id: `cue:${cue.id}:columns`, groupId: targetGroupId, kind: 'revealColumns', stage: 'event', amount: revealProgress(elapsed, cue.oneShotDurationSec), from: action.from === 'right' ? 'end' : action.from === 'center' ? 'center' : 'start' }] : []
    case 'moveTarget':
      return targetGroupId ? [{ ...base, id: `cue:${cue.id}:move`, groupId: targetGroupId, kind: 'shift', stage: 'persistent', amount: 1, x: action.x ?? 0, y: action.y ?? 0 }] : []
    case 'applyManualOverride': {
      if (!targetGroupId || elapsed > action.durationSec) return []
      const effects: PixGridGroupFrameEffect[] = []
      if (action.patch.visible != null) effects.push({ ...base, id: `cue:${cue.id}:manual-visible`, groupId: targetGroupId, kind: 'visibility', stage: 'manual', amount: action.patch.visible ? 1 : 0, blend: 'replace' })
      if (action.patch.opacity != null) effects.push({ ...base, id: `cue:${cue.id}:manual-opacity`, groupId: targetGroupId, kind: 'opacity', stage: 'manual', amount: action.patch.opacity, blend: 'replace' })
      if (action.patch.paletteRole) effects.push({ ...base, id: `cue:${cue.id}:manual-color`, groupId: targetGroupId, kind: 'color', stage: 'manual', amount: 1, paletteRole: action.patch.paletteRole })
      if (action.patch.positionX != null || action.patch.positionY != null) effects.push({ ...base, id: `cue:${cue.id}:manual-move`, groupId: targetGroupId, kind: 'shift', stage: 'manual', amount: 1, x: action.patch.positionX ?? 0, y: action.patch.positionY ?? 0 })
      return effects
    }
    default:
      return []
  }
}

function isOneShot(action: PixGridActionCueAction): boolean {
  return action.type === 'flashGroup' || action.type === 'revealRows' || action.type === 'revealColumns' || action.type === 'dissolveGroup'
}

function stableHash(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export class PixGridCueExecutionRuntime {
  private trackId: string | null = null
  private completedOnce = new Set<string>()

  reset(trackId: string | null = null): void {
    this.trackId = trackId
    this.completedOnce.clear()
  }

  beginFrame(trackId: string | null, audioTime: number): void {
    if (trackId !== this.trackId) this.reset(trackId)
    void audioTime
  }

  allows(cue: PixGridActionCue, audioTime: number): boolean {
    if (cue.loopBehavior === 'retrigger') return true
    if (this.completedOnce.has(cue.id) && audioTime >= cue.timeSec) return false
    if (audioTime > cue.timeSec + cue.oneShotDurationSec) this.completedOnce.add(cue.id)
    return !this.completedOnce.has(cue.id)
  }
}

export function resolvePixGridActionCueFrame(
  rawState: PixGridState,
  rawCues: readonly PixGridActionCue[],
  audioTime: number,
  options: {
    trackId?: string | null
    runtime?: PixGridCueExecutionRuntime
  } = {},
): PixGridResolvedCueFrame {
  const authored = normalizePixGridState(rawState)
  const cues = sortPixGridActionCues(rawCues.map((cue, index) => normalizePixGridActionCue(cue, index)).filter((cue): cue is PixGridActionCue => cue != null))
    .filter(cue => cue.engineId === PIX_GRID_ACTION_CUE_ENGINE_ID && cue.enabled && cue.timeSec <= audioTime + 0.000001)
  const runtime = options.runtime
  runtime?.beginFrame(options.trackId ?? null, audioTime)
  let state = cloneState(authored)
  let transition: PixGridResolvedTransition | null = null
  let mostRecentCue: PixGridActionCue | null = null
  const activeCueIds: string[] = []
  const activeOneShotCueIds: string[] = []
  let appliedCues: PixGridActionCue[] = []
  let groupEffects: PixGridGroupFrameEffect[] = []

  const replayAppliedCues = () => {
    let replayed = cloneState(authored)
    for (const applied of appliedCues) replayed = applyCueAction(replayed, authored, applied, audioTime)
    return replayed
  }

  for (const cue of cues) {
    const elapsed = audioTime - cue.timeSec
    const oneShot = isOneShot(cue.action)
    const runtimeAllowed = runtime?.allows(cue, audioTime) ?? true
    if (oneShot && (elapsed > cue.oneShotDurationSec || !runtimeAllowed)) continue
    if (cue.action.type === 'applyManualOverride' && elapsed > cue.action.durationSec) continue
    const before = cloneState(state)
    if (cue.action.type === 'clearManualOverride') {
      const route = cue.action.route
      appliedCues = appliedCues.filter(applied => applied.action.type !== 'applyManualOverride' || (
        route != null && applied.action.route !== route
      ))
      appliedCues.push(cue)
      state = replayAppliedCues()
      groupEffects = appliedCues.flatMap(applied => cueGroupEffects(applied, audioTime))
    } else {
      state = applyCueAction(state, authored, cue, audioTime)
      appliedCues.push(cue)
      groupEffects.push(...cueGroupEffects(cue, audioTime))
    }
    activeCueIds.push(cue.id)
    if (oneShot) activeOneShotCueIds.push(cue.id)
    mostRecentCue = cue
    if (
      cue.transition !== 'cut'
      && cue.transitionDurationSec > 0
      && elapsed >= 0
      && elapsed < cue.transitionDurationSec
    ) {
      transition = {
        cueId: cue.id,
        type: cue.transition,
        progress: Math.max(0, Math.min(1, elapsed / cue.transitionDurationSec)),
        startedAtSec: cue.timeSec,
        durationSec: cue.transitionDurationSec,
        seed: stableHash(cue.id),
        fromState: before,
      }
    }
  }

  state = normalizePixGridState(state)
  const manualOverrideRoutes = [...state.performance.lockedRoutes]
  const trackId = options.trackId ?? null
  const transitionStatus: PixGridCueTransitionStatus | null = transition ? {
    cueId: transition.cueId,
    type: transition.type,
    progress: transition.progress,
    startedAtSec: transition.startedAtSec,
    durationSec: transition.durationSec,
    seed: transition.seed,
  } : null
  return {
    state,
    transition,
    groupEffects,
    snapshot: {
      trackId,
      active: cues.length > 0,
      activeCueIds,
      mostRecentCueId: mostRecentCue?.id ?? null,
      mostRecentCueLabel: mostRecentCue?.label ?? null,
      activeOneShotCueIds,
      manualOverrideRoutes,
      transition: transitionStatus,
      deterministicIdentity: `${trackId ?? 'no-track'}:${Math.round(audioTime * 1000)}:${activeCueIds.join(',') || 'none'}`,
    },
  }
}
