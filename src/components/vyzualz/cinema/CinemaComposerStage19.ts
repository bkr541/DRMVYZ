import {
  CINEMA_DEFAULT_CAMERA_SAFE_RANGE,
  CINEMA_CAMERA_PARAMETER_IDS,
  createCinemaCameraParameterSchemas,
} from './CinemaCameraRuntime'
import { createCinemaControlDescriptors, type CinemaControlDescriptor } from './CinemaControlDescriptors'
import {
  CINEMA_PERFORMANCE_ACTION_SCHEMA_VERSION,
  CINEMA_PERFORMANCE_RULE_SCHEMA_VERSION,
  type CinemaCameraAuthoredShotDefinition,
  type CinemaCameraMode,
  type CinemaCameraResourceDefinition,
  type CinemaCompositionDefinition,
  type CinemaJsonObject,
  type CinemaModulationRouteDefinition,
  type CinemaMusicalQuantization,
  type CinemaParameterValue,
  type CinemaPerformanceAction,
  type CinemaPerformanceCondition,
  type CinemaPerformanceRuleDefinition,
} from './CinemaDomain'
import {
  cinemaStableId,
  createCinemaParameterPath,
  type CinemaActionId,
  type CinemaControlPointId,
  type CinemaCameraId,
  type CinemaModulationRouteId,
  type CinemaModulationSourceId,
  type CinemaNodeId,
  type CinemaParameterId,
  type CinemaParameterPath,
  type CinemaPerformanceRuleId,
  type CinemaStableId,
} from './CinemaIdentifiers'
import {
  CINEMA_MODULATION_SOURCE_IDS,
  type CinemaModulationSourceDescriptor,
} from './CinemaModulationSources'
import type { CinemaPersistedDefinition } from './CinemaPersistence'
import type { CinemaCameraCapability, CinemaFrameContext } from './CinemaRendererContracts'
import type { CinemaCompositionEditResult } from './CinemaStore'

export const CINEMA_COMPOSER_STAGE19_VERSION = 1 as const
export const CINEMA_COMPOSER_CAMERA_ASSIGNMENTS_KEY = 'composerAssignedNodeIds' as const

export const CINEMA_COMPOSER_MUSICAL_DIVISIONS: readonly CinemaMusicalQuantization[] = Object.freeze([
  'none', 'beat', '2-beats', 'bar', '4-bars', '8-bars', 'phrase', 'section',
])

export const CINEMA_COMPOSER_PERFORMANCE_EVENTS = Object.freeze([
  'beat', 'bar', 'phrase', 'sectionStart', 'dropStart', 'lyricCue', 'lyricWord', 'manual',
] as const)

export interface CinemaComposerDestinationDescriptor {
  path: CinemaParameterPath
  label: string
  group: string
  type: CinemaControlDescriptor['type']
  modulatable: boolean
  triggerable: boolean
  disabledReason: string | null
}

export interface CinemaComposerRuntimePreview {
  compositionId: string | null
  modulationRouteId: CinemaModulationRouteId | null
  manualActionId: CinemaActionId | null
  manualActionSequence: number
}

export const EMPTY_CINEMA_COMPOSER_RUNTIME_PREVIEW: Readonly<CinemaComposerRuntimePreview> = Object.freeze({
  compositionId: null,
  modulationRouteId: null,
  manualActionId: null,
  manualActionSequence: 0,
})

export interface CinemaComposerTimelineBeat {
  timeSec: number
  isDownbeat: boolean
  beatIndex?: number
  barIndex?: number
}

export interface CinemaComposerTimelineSection {
  id: string
  type: string
  startSec: number
  endSec: number
}

export interface CinemaComposerTimelinePhrase {
  id: string
  timeSec: number
  lengthBars?: number
}

export interface CinemaComposerTimelineLyricCue {
  id: string
  text: string
  startSec: number
  endSec: number
}

export interface CinemaComposerTimelineSource {
  trackId: string | null
  durationSec: number | null
  beatGrid: readonly Readonly<CinemaComposerTimelineBeat>[]
  sections: readonly Readonly<CinemaComposerTimelineSection>[]
  phrases?: readonly Readonly<CinemaComposerTimelinePhrase>[]
  lyrics: readonly Readonly<CinemaComposerTimelineLyricCue>[]
}

export type CinemaComposerTimelineMarkerKind = 'beat' | 'bar' | 'phrase' | 'section' | 'lyric' | 'modulation' | 'performance'

export interface CinemaComposerTimelineMarker {
  id: string
  kind: CinemaComposerTimelineMarkerKind
  timeSec: number
  endSec?: number
  label: string
}

export interface CinemaComposerTimelineModel {
  available: boolean
  disabledReason: string | null
  durationSec: number
  playheadSec: number
  markers: readonly Readonly<CinemaComposerTimelineMarker>[]
}

export function buildCinemaComposerDestinations(
  composition: Readonly<CinemaCompositionDefinition>,
  definitions: readonly Readonly<CinemaPersistedDefinition>[],
): readonly Readonly<CinemaComposerDestinationDescriptor>[] {
  const descriptors: CinemaControlDescriptor[] = []
  descriptors.push(...createCinemaControlDescriptors({
    namespace: 'master',
    schemas: composition.masterParameters,
    values: composition.masterValues,
  }).descriptors)

  for (const node of composition.nodes) {
    const persisted = definitions.find(definition => definition.id === node.typeId)
    if (!persisted) continue
    descriptors.push(...createCinemaControlDescriptors({
      namespace: node.family === 'effect' ? 'effects' : 'nodes',
      ownerId: node.id,
      schemas: persisted.definition.parameters,
      values: node.parameterValues,
    }).descriptors)
  }

  for (const camera of composition.cameras) {
    descriptors.push(...createCinemaControlDescriptors({
      namespace: 'cameras',
      ownerId: camera.id,
      schemas: createCinemaCameraParameterSchemas(camera),
      values: camera.parameterValues,
    }).descriptors)
  }

  return Object.freeze(descriptors.map(descriptor => Object.freeze({
    path: descriptor.path,
    label: descriptor.label,
    group: descriptor.group,
    type: descriptor.type,
    modulatable: descriptor.modulatable,
    triggerable: descriptor.type === 'trigger',
    disabledReason: descriptor.disabledReason ?? null,
  })))
}

export function createCinemaComposerModulationRoute(
  composition: Readonly<CinemaCompositionDefinition>,
  options: {
    sourceId?: CinemaModulationSourceId
    destination: CinemaParameterPath
  },
): CinemaCompositionEditResult {
  const id = nextStableId<CinemaModulationRouteId>(
    composition.modulationRoutes.map(route => String(route.id)),
    'composer-modulation-route',
    'modulation route',
  )
  const destination = options.destination
  const route: CinemaModulationRouteDefinition = {
    id,
    sourceId: options.sourceId ?? CINEMA_MODULATION_SOURCE_IDS.audioBass,
    destination,
    mode: 'add',
    amount: 0.5,
    offset: 0,
    inputRange: [0, 1],
    outputRange: [0, 1],
    attackMs: 40,
    releaseMs: 160,
    smoothing: 0.15,
    curve: [
      { id: cinemaStableId<CinemaControlPointId>(`${id}-curve-start`, 'control point'), position: 0, value: 0, interpolation: 'smooth' },
      { id: cinemaStableId<CinemaControlPointId>(`${id}-curve-end`, 'control point'), position: 1, value: 1, interpolation: 'linear' },
    ],
    quantization: 'none',
    condition: { playing: true },
    clamp: [0, 1],
    enabled: true,
  }
  return {
    composition: {
      ...composition,
      revision: composition.revision + 1,
      modulationRoutes: [...composition.modulationRoutes, route],
    },
  }
}

export function updateCinemaComposerModulationRoute(
  composition: Readonly<CinemaCompositionDefinition>,
  routeId: CinemaModulationRouteId,
  patch: Partial<Omit<CinemaModulationRouteDefinition, 'id'>>,
): CinemaCompositionEditResult {
  if (!composition.modulationRoutes.some(route => route.id === routeId)) throw new Error(`Cinema modulation route "${routeId}" does not exist.`)
  return {
    composition: {
      ...composition,
      revision: composition.revision + 1,
      modulationRoutes: composition.modulationRoutes.map(route => route.id === routeId ? { ...route, ...patch, id: route.id } : route),
    },
  }
}

export function removeCinemaComposerModulationRoute(
  composition: Readonly<CinemaCompositionDefinition>,
  routeId: CinemaModulationRouteId,
): CinemaCompositionEditResult {
  return {
    composition: {
      ...composition,
      revision: composition.revision + 1,
      modulationRoutes: composition.modulationRoutes.filter(route => route.id !== routeId),
    },
  }
}

export function createCinemaComposerPerformanceRule(
  composition: Readonly<CinemaCompositionDefinition>,
  destination?: CinemaParameterPath,
): CinemaCompositionEditResult {
  const id = nextStableId<CinemaPerformanceRuleId>(composition.performanceRules.map(rule => String(rule.id)), 'composer-performance-rule', 'performance rule')
  const manualActionId = nextStableId<CinemaActionId>(collectActionIds(composition), `${id}-manual`, 'manual action')
  const actionId = nextStableId<CinemaActionId>([...collectActionIds(composition), manualActionId], `${id}-action`, 'performance action')
  const action: CinemaPerformanceAction = destination
    ? {
        schemaVersion: CINEMA_PERFORMANCE_ACTION_SCHEMA_VERSION,
        id: actionId,
        type: 'set-parameter',
        destination,
        value: 1,
        duration: { value: 1, unit: 'beats' },
      }
    : {
        schemaVersion: CINEMA_PERFORMANCE_ACTION_SCHEMA_VERSION,
        id: actionId,
        type: 'resetNodeState',
        nodeId: composition.nodes.find(node => node.family !== 'output')?.id ?? composition.outputNodeId,
      }
  const rule: CinemaPerformanceRuleDefinition = {
    schemaVersion: CINEMA_PERFORMANCE_RULE_SCHEMA_VERSION,
    id,
    label: `Performance Rule ${composition.performanceRules.length + 1}`,
    priority: 0,
    enabled: true,
    condition: {
      schemaVersion: CINEMA_PERFORMANCE_RULE_SCHEMA_VERSION,
      event: 'manual',
      manualActionIds: [manualActionId],
      playing: true,
    },
    actions: [action],
  }
  return {
    composition: {
      ...composition,
      revision: composition.revision + 1,
      performanceRules: [...composition.performanceRules, rule],
    },
  }
}

export function updateCinemaComposerPerformanceRule(
  composition: Readonly<CinemaCompositionDefinition>,
  ruleId: CinemaPerformanceRuleId,
  patch: Partial<Omit<CinemaPerformanceRuleDefinition, 'id' | 'schemaVersion'>> & { condition?: CinemaPerformanceCondition },
): CinemaCompositionEditResult {
  if (!composition.performanceRules.some(rule => rule.id === ruleId)) throw new Error(`Cinema performance rule "${ruleId}" does not exist.`)
  return {
    composition: {
      ...composition,
      revision: composition.revision + 1,
      performanceRules: composition.performanceRules.map(rule => rule.id === ruleId
        ? { ...rule, ...patch, schemaVersion: CINEMA_PERFORMANCE_RULE_SCHEMA_VERSION, id: rule.id }
        : rule),
    },
  }
}

export function updateCinemaComposerPerformanceAction(
  composition: Readonly<CinemaCompositionDefinition>,
  ruleId: CinemaPerformanceRuleId,
  actionId: CinemaActionId,
  action: CinemaPerformanceAction,
): CinemaCompositionEditResult {
  const rule = composition.performanceRules.find(candidate => candidate.id === ruleId)
  if (!rule || !rule.actions.some(candidate => candidate.id === actionId)) throw new Error(`Cinema performance action "${actionId}" does not exist.`)
  return updateCinemaComposerPerformanceRule(composition, ruleId, {
    actions: rule.actions.map(candidate => candidate.id === actionId ? { ...action, id: candidate.id } : candidate),
  })
}

export function addCinemaComposerPerformanceAction(
  composition: Readonly<CinemaCompositionDefinition>,
  ruleId: CinemaPerformanceRuleId,
  type: CinemaPerformanceAction['type'],
  destination?: CinemaParameterPath,
): CinemaCompositionEditResult {
  const rule = composition.performanceRules.find(candidate => candidate.id === ruleId)
  if (!rule) throw new Error(`Cinema performance rule "${ruleId}" does not exist.`)
  const id = nextStableId<CinemaActionId>(collectActionIds(composition), `${ruleId}-action`, 'performance action')
  const nodeId = composition.nodes.find(node => node.family !== 'output')?.id ?? composition.outputNodeId
  const cameraId = composition.cameras[0]?.id
  const action = defaultPerformanceAction(type, id, nodeId, cameraId, destination)
  return updateCinemaComposerPerformanceRule(composition, ruleId, { actions: [...rule.actions, action] })
}

export function removeCinemaComposerPerformanceAction(
  composition: Readonly<CinemaCompositionDefinition>,
  ruleId: CinemaPerformanceRuleId,
  actionId: CinemaActionId,
): CinemaCompositionEditResult {
  const rule = composition.performanceRules.find(candidate => candidate.id === ruleId)
  if (!rule) throw new Error(`Cinema performance rule "${ruleId}" does not exist.`)
  return updateCinemaComposerPerformanceRule(composition, ruleId, { actions: rule.actions.filter(action => action.id !== actionId) })
}

export function removeCinemaComposerPerformanceRule(
  composition: Readonly<CinemaCompositionDefinition>,
  ruleId: CinemaPerformanceRuleId,
): CinemaCompositionEditResult {
  return {
    composition: {
      ...composition,
      revision: composition.revision + 1,
      performanceRules: composition.performanceRules.filter(rule => rule.id !== ruleId),
    },
  }
}

export function createCinemaComposerCamera(
  composition: Readonly<CinemaCompositionDefinition>,
): CinemaCompositionEditResult {
  const id = nextStableId<CinemaCameraId>(composition.cameras.map(camera => String(camera.id)), 'composer-camera', 'camera')
  const camera: CinemaCameraResourceDefinition = {
    id,
    label: `Camera ${composition.cameras.length + 1}`,
    mode: 'locked',
    parameterValues: {
      [CINEMA_CAMERA_PARAMETER_IDS.position]: [0, 0, 2],
      [CINEMA_CAMERA_PARAMETER_IDS.rotation]: [0, 0, 0],
      [CINEMA_CAMERA_PARAMETER_IDS.target]: [0, 0, 0],
      [CINEMA_CAMERA_PARAMETER_IDS.fovDegrees]: 58,
      [CINEMA_CAMERA_PARAMETER_IDS.near]: 0.1,
      [CINEMA_CAMERA_PARAMETER_IDS.far]: 1000,
    },
    safeRange: CINEMA_DEFAULT_CAMERA_SAFE_RANGE,
    authoredShots: [],
  }
  return {
    composition: {
      ...composition,
      revision: composition.revision + 1,
      cameras: [...composition.cameras, camera],
    },
  }
}

export function updateCinemaComposerCamera(
  composition: Readonly<CinemaCompositionDefinition>,
  cameraId: CinemaCameraId,
  patch: Partial<Omit<CinemaCameraResourceDefinition, 'id'>>,
): CinemaCompositionEditResult {
  if (!composition.cameras.some(camera => camera.id === cameraId)) throw new Error(`Cinema camera "${cameraId}" does not exist.`)
  return {
    composition: {
      ...composition,
      revision: composition.revision + 1,
      cameras: composition.cameras.map(camera => camera.id === cameraId ? { ...camera, ...patch, id: camera.id } : camera),
    },
  }
}

export function removeCinemaComposerCamera(
  composition: Readonly<CinemaCompositionDefinition>,
  cameraId: CinemaCameraId,
): CinemaCompositionEditResult {
  return {
    composition: {
      ...composition,
      revision: composition.revision + 1,
      cameras: composition.cameras.filter(camera => camera.id !== cameraId),
      performanceRules: composition.performanceRules.map(rule => ({
        ...rule,
        actions: rule.actions.filter(action => action.type !== 'select-camera' || action.cameraId !== cameraId),
      })),
    },
  }
}

export function addCinemaComposerCameraShot(
  composition: Readonly<CinemaCompositionDefinition>,
  cameraId: CinemaCameraId,
): CinemaCompositionEditResult {
  const camera = composition.cameras.find(candidate => candidate.id === cameraId)
  if (!camera) throw new Error(`Cinema camera "${cameraId}" does not exist.`)
  const existing = (camera.authoredShots ?? []).map(shot => shot.id)
  const shotId = nextPlainId(existing, `${cameraId}-shot`)
  const shot: CinemaCameraAuthoredShotDefinition = {
    id: shotId,
    label: `Shot ${(camera.authoredShots?.length ?? 0) + 1}`,
    mode: camera.mode === 'auto-director' ? 'locked' : camera.mode,
    sections: [],
    weight: 1,
    minimumDurationSec: 1,
    position: vector3(camera.parameterValues[CINEMA_CAMERA_PARAMETER_IDS.position], [0, 0, 2]),
    rotation: vector3(camera.parameterValues[CINEMA_CAMERA_PARAMETER_IDS.rotation], [0, 0, 0]),
    target: vector3(camera.parameterValues[CINEMA_CAMERA_PARAMETER_IDS.target], [0, 0, 0]),
    fovDegrees: numberValue(camera.parameterValues[CINEMA_CAMERA_PARAMETER_IDS.fovDegrees], 58),
  }
  return updateCinemaComposerCamera(composition, cameraId, { authoredShots: [...(camera.authoredShots ?? []), shot] })
}

export function updateCinemaComposerCameraShot(
  composition: Readonly<CinemaCompositionDefinition>,
  cameraId: CinemaCameraId,
  shotId: string,
  patch: Partial<Omit<CinemaCameraAuthoredShotDefinition, 'id'>>,
): CinemaCompositionEditResult {
  const camera = composition.cameras.find(candidate => candidate.id === cameraId)
  if (!camera || !(camera.authoredShots ?? []).some(shot => shot.id === shotId)) throw new Error(`Cinema camera shot "${shotId}" does not exist.`)
  return updateCinemaComposerCamera(composition, cameraId, {
    authoredShots: (camera.authoredShots ?? []).map(shot => shot.id === shotId ? { ...shot, ...patch, id: shot.id } : shot),
  })
}

export function removeCinemaComposerCameraShot(
  composition: Readonly<CinemaCompositionDefinition>,
  cameraId: CinemaCameraId,
  shotId: string,
): CinemaCompositionEditResult {
  const camera = composition.cameras.find(candidate => candidate.id === cameraId)
  if (!camera) throw new Error(`Cinema camera "${cameraId}" does not exist.`)
  return updateCinemaComposerCamera(composition, cameraId, { authoredShots: (camera.authoredShots ?? []).filter(shot => shot.id !== shotId) })
}

export function getCinemaComposerCameraAssignedNodeIds(
  camera: Readonly<CinemaCameraResourceDefinition>,
): readonly CinemaNodeId[] | null {
  const value = camera.metadata?.[CINEMA_COMPOSER_CAMERA_ASSIGNMENTS_KEY]
  if (!Array.isArray(value)) return null
  return Object.freeze(value.filter(item => typeof item === 'string').map(item => cinemaStableId<CinemaNodeId>(item, 'node')))
}

export function isCinemaComposerCameraAssignedToNode(
  camera: Readonly<CinemaCameraResourceDefinition>,
  nodeId: CinemaNodeId,
): boolean {
  const assigned = getCinemaComposerCameraAssignedNodeIds(camera)
  return assigned == null || assigned.includes(nodeId)
}

export function setCinemaComposerCameraNodeAssignment(
  composition: Readonly<CinemaCompositionDefinition>,
  cameraId: CinemaCameraId,
  nodeId: CinemaNodeId,
  assigned: boolean,
  compatibleNodeIds: readonly CinemaNodeId[],
): CinemaCompositionEditResult {
  const camera = composition.cameras.find(candidate => candidate.id === cameraId)
  if (!camera) throw new Error(`Cinema camera "${cameraId}" does not exist.`)
  const current = getCinemaComposerCameraAssignedNodeIds(camera) ?? compatibleNodeIds
  const next = new Set(current.map(String))
  if (assigned) next.add(String(nodeId)); else next.delete(String(nodeId))
  const metadata: CinemaJsonObject = {
    ...(camera.metadata ?? {}),
    [CINEMA_COMPOSER_CAMERA_ASSIGNMENTS_KEY]: compatibleNodeIds.filter(id => next.has(String(id))).map(String),
  }
  return updateCinemaComposerCamera(composition, cameraId, { metadata })
}

export function isCinemaCameraCapabilityCompatible(capability: CinemaCameraCapability): boolean {
  return capability === 'uniform' || capability === 'world' || capability === 'uniformCamera' || capability === 'worldCamera'
}

export function filterCinemaFrameCameraForNode(
  frame: Readonly<CinemaFrameContext>,
  composition: Readonly<CinemaCompositionDefinition> | null,
  nodeId: CinemaNodeId,
  capability: CinemaCameraCapability,
): Readonly<CinemaFrameContext> {
  if (!isCinemaCameraCapabilityCompatible(capability)) return stripCamera(frame)
  if (!composition || !frame.activeCameraId) return frame
  const camera = composition.cameras.find(candidate => candidate.id === frame.activeCameraId)
  if (!camera || isCinemaComposerCameraAssignedToNode(camera, nodeId)) return frame
  return stripCamera(frame)
}

export function applyCinemaComposerPerformancePreview(
  frame: Readonly<CinemaFrameContext>,
  preview: Readonly<CinemaComposerRuntimePreview>,
  compositionId: string | null,
  consumedManualActionSequence = 0,
): Readonly<CinemaFrameContext> {
  if (!compositionId || preview.compositionId !== compositionId || !preview.manualActionId || preview.manualActionSequence <= consumedManualActionSequence) return frame
  const events = frame.performance.events ?? []
  if (events.some(event => event.actionId === preview.manualActionId && event.sequence === preview.manualActionSequence)) return frame
  return Object.freeze({
    ...frame,
    performance: Object.freeze({
      ...frame.performance,
      events: Object.freeze([...events, Object.freeze({ actionId: preview.manualActionId, sequence: preview.manualActionSequence })]),
      actionIds: Object.freeze([...frame.performance.actionIds, preview.manualActionId]),
    }),
  })
}

export function buildCinemaComposerTimelineModel(
  composition: Readonly<CinemaCompositionDefinition>,
  source: Readonly<CinemaComposerTimelineSource> | null,
  playheadSec: number,
): Readonly<CinemaComposerTimelineModel> {
  if (!source || source.trackId == null) {
    return Object.freeze({ available: false, disabledReason: 'Load a track to view authoritative musical and lyric timing.', durationSec: 0, playheadSec: 0, markers: Object.freeze([]) })
  }
  const durationSec = positiveDuration(source)
  const markers: CinemaComposerTimelineMarker[] = []
  const beats = [...source.beatGrid].sort((left, right) => left.timeSec - right.timeSec)
  const downbeats = beats.filter(beat => beat.isDownbeat)
  const phrases = (source.phrases ?? []).length > 0
    ? [...(source.phrases ?? [])].sort((left, right) => left.timeSec - right.timeSec)
    : downbeats.filter((_beat, index) => index % 4 === 0).map((beat, index) => ({ id: `fallback-${index}`, timeSec: beat.timeSec, lengthBars: 4 }))
  beats.forEach((beat, index) => markers.push({ id: `beat:${index}`, kind: 'beat', timeSec: beat.timeSec, label: `Beat ${beat.beatIndex ?? index + 1}` }))
  downbeats.forEach((beat, index) => markers.push({ id: `bar:${index}`, kind: 'bar', timeSec: beat.timeSec, label: `Bar ${beat.barIndex ?? index + 1}` }))
  phrases.forEach((phrase, index) => markers.push({ id: `phrase:${phrase.id || index}`, kind: 'phrase', timeSec: phrase.timeSec, label: phrase.lengthBars ? `Phrase · ${phrase.lengthBars} bars` : 'Phrase' }))
  source.sections.forEach(section => markers.push({ id: `section:${section.id}`, kind: 'section', timeSec: section.startSec, endSec: section.endSec, label: section.type }))
  source.lyrics.forEach(cue => markers.push({ id: `lyric:${cue.id}`, kind: 'lyric', timeSec: cue.startSec, endSec: cue.endSec, label: cue.text }))
  for (const route of composition.modulationRoutes) markers.push(...timelineMarkersForModulation(route, beats, downbeats, phrases, source))
  for (const rule of composition.performanceRules) markers.push(...timelineMarkersForPerformance(rule, beats, downbeats, phrases, source))
  markers.sort((left, right) => left.timeSec - right.timeSec || left.kind.localeCompare(right.kind) || left.id.localeCompare(right.id))
  return Object.freeze({
    available: true,
    disabledReason: null,
    durationSec,
    playheadSec: clamp(playheadSec, 0, durationSec),
    markers: Object.freeze(markers.map(marker => Object.freeze(marker))),
  })
}

export function sourceDisabledReason(
  source: Readonly<CinemaModulationSourceDescriptor>,
  frame: Readonly<CinemaFrameContext> | null,
): string | null {
  if (!frame) return 'Runtime frame is unavailable.'
  if (source.capability === 'audio' || source.capability === 'transport') return null
  return frame.capabilities[source.capability] ? null : `${source.label} requires ${source.capability}.`
}

function timelineMarkersForModulation(
  route: Readonly<CinemaModulationRouteDefinition>,
  beats: readonly Readonly<CinemaComposerTimelineBeat>[],
  downbeats: readonly Readonly<CinemaComposerTimelineBeat>[],
  phrases: readonly Readonly<CinemaComposerTimelinePhrase>[],
  source: Readonly<CinemaComposerTimelineSource>,
): CinemaComposerTimelineMarker[] {
  if (!route.enabled) return []
  const prefix = `modulation:${route.id}`
  const label = `Mod · ${String(route.sourceId).split('.').slice(-1)[0] ?? route.sourceId}`
  const quantization = route.quantization ?? 'none'
  if (quantization === 'beat') return beats.map((beat, index) => ({ id: `${prefix}:beat:${index}`, kind: 'modulation', timeSec: beat.timeSec, label }))
  if (quantization === '2-beats') return beats.filter((_beat, index) => index % 2 === 0).map((beat, index) => ({ id: `${prefix}:2beat:${index}`, kind: 'modulation', timeSec: beat.timeSec, label }))
  if (quantization === 'bar') return downbeats.map((beat, index) => ({ id: `${prefix}:bar:${index}`, kind: 'modulation', timeSec: beat.timeSec, label }))
  if (quantization === '4-bars') return downbeats.filter((_beat, index) => index % 4 === 0).map((beat, index) => ({ id: `${prefix}:4bar:${index}`, kind: 'modulation', timeSec: beat.timeSec, label }))
  if (quantization === '8-bars') return downbeats.filter((_beat, index) => index % 8 === 0).map((beat, index) => ({ id: `${prefix}:8bar:${index}`, kind: 'modulation', timeSec: beat.timeSec, label }))
  if (quantization === 'phrase') return phrases.map((phrase, index) => ({ id: `${prefix}:phrase:${phrase.id || index}`, kind: 'modulation', timeSec: phrase.timeSec, label }))
  if (quantization === 'section') return source.sections.map(section => ({ id: `${prefix}:section:${section.id}`, kind: 'modulation', timeSec: section.startSec, label }))
  if (route.sourceId === CINEMA_MODULATION_SOURCE_IDS.impulseSectionStart) return source.sections.map(section => ({ id: `${prefix}:section:${section.id}`, kind: 'modulation', timeSec: section.startSec, label }))
  if (route.sourceId === CINEMA_MODULATION_SOURCE_IDS.impulseDropStart) return source.sections.filter(section => section.type.toLowerCase().includes('drop')).map(section => ({ id: `${prefix}:drop:${section.id}`, kind: 'modulation', timeSec: section.startSec, label }))
  if (route.sourceId === CINEMA_MODULATION_SOURCE_IDS.impulseLyricCue || route.sourceId === CINEMA_MODULATION_SOURCE_IDS.impulseLyricWord) return source.lyrics.map(cue => ({ id: `${prefix}:lyric:${cue.id}`, kind: 'modulation', timeSec: cue.startSec, label }))
  return []
}

function timelineMarkersForPerformance(
  rule: Readonly<CinemaPerformanceRuleDefinition>,
  beats: readonly Readonly<CinemaComposerTimelineBeat>[],
  downbeats: readonly Readonly<CinemaComposerTimelineBeat>[],
  phrases: readonly Readonly<CinemaComposerTimelinePhrase>[],
  source: Readonly<CinemaComposerTimelineSource>,
): CinemaComposerTimelineMarker[] {
  if (!rule.enabled || !rule.condition.event || rule.condition.event === 'manual') return []
  const prefix = `performance:${rule.id}`
  const label = `Cue · ${rule.label}`
  switch (rule.condition.event) {
    case 'beat': return beats.map((beat, index) => ({ id: `${prefix}:beat:${index}`, kind: 'performance', timeSec: beat.timeSec, label }))
    case 'bar': return downbeats.map((beat, index) => ({ id: `${prefix}:bar:${index}`, kind: 'performance', timeSec: beat.timeSec, label }))
    case 'phrase': return phrases.map((phrase, index) => ({ id: `${prefix}:phrase:${phrase.id || index}`, kind: 'performance', timeSec: phrase.timeSec, label }))
    case 'sectionStart': return source.sections.map(section => ({ id: `${prefix}:section:${section.id}`, kind: 'performance', timeSec: section.startSec, label }))
    case 'dropStart': return source.sections.filter(section => section.type.toLowerCase().includes('drop')).map(section => ({ id: `${prefix}:drop:${section.id}`, kind: 'performance', timeSec: section.startSec, label }))
    case 'lyricCue':
    case 'lyricWord': return source.lyrics.map(cue => ({ id: `${prefix}:lyric:${cue.id}`, kind: 'performance', timeSec: cue.startSec, label }))
    default: return []
  }
}

function defaultPerformanceAction(
  type: CinemaPerformanceAction['type'],
  id: CinemaActionId,
  nodeId: CinemaNodeId,
  cameraId: CinemaCameraId | undefined,
  destination?: CinemaParameterPath,
): CinemaPerformanceAction {
  const parameterDestination = destination ?? ('master.intensity' as CinemaParameterPath)
  switch (type) {
    case 'set-parameter': return { schemaVersion: 1, id, type, destination: parameterDestination, value: 1, duration: { value: 1, unit: 'beats' } }
    case 'trigger-parameter': return { schemaVersion: 1, id, type, destination: parameterDestination }
    case 'set-node-enabled': return { schemaVersion: 1, id, type, nodeId, enabled: true, duration: { value: 1, unit: 'beats' } }
    case 'set-effect-enabled': return { schemaVersion: 1, id, type, nodeId, enabled: true, duration: { value: 1, unit: 'beats' } }
    case 'select-camera': {
      if (!cameraId) throw new Error('Cannot add a Cinema select-camera action before a camera resource exists.')
      return { schemaVersion: 1, id, type, cameraId, duration: { value: 1, unit: 'beats' } }
    }
    case 'set-palette': return { schemaVersion: 1, id, type, colors: {}, duration: { value: 1, unit: 'beats' } }
    case 'resetNodeState': return { schemaVersion: 1, id, type, nodeId }
    case 'resetFeedback': return { schemaVersion: 1, id, type, nodeId }
    case 'reseedSimulation': return { schemaVersion: 1, id, type, nodeId }
    case 'clearTrailHistory': return { schemaVersion: 1, id, type, nodeId }
    case 'emit-event': return { schemaVersion: 1, id, type, eventId: cinemaStableId('composer-event', 'event') }
  }
}

function collectActionIds(composition: Readonly<CinemaCompositionDefinition>): string[] {
  return composition.performanceRules.flatMap(rule => [
    ...(rule.condition.manualActionIds ?? []).map(String),
    ...(rule.condition.toggleActionId ? [String(rule.condition.toggleActionId)] : []),
    ...rule.actions.map(action => String(action.id)),
  ])
}

function stripCamera(frame: Readonly<CinemaFrameContext>): Readonly<CinemaFrameContext> {
  if (frame.camera == null && frame.activeCameraId == null) return frame
  return Object.freeze({ ...frame, activeCameraId: null, camera: null })
}

function positiveDuration(source: Readonly<CinemaComposerTimelineSource>): number {
  if (source.durationSec != null && Number.isFinite(source.durationSec) && source.durationSec > 0) return source.durationSec
  return Math.max(
    1,
    ...source.beatGrid.map(beat => beat.timeSec),
    ...source.sections.map(section => section.endSec),
    ...(source.phrases ?? []).map(phrase => phrase.timeSec),
    ...source.lyrics.map(cue => cue.endSec),
  )
}

function vector3(value: CinemaParameterValue | undefined, fallback: readonly [number, number, number]): readonly [number, number, number] {
  if (Array.isArray(value) && value.length >= 3 && value.slice(0, 3).every(item => typeof item === 'number' && Number.isFinite(item))) {
    return [Number(value[0]), Number(value[1]), Number(value[2])]
  }
  return fallback
}

function numberValue(value: CinemaParameterValue | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, Number.isFinite(value) ? value : minimum))
}

function nextPlainId(existing: readonly string[], base: string): string {
  const ids = new Set(existing)
  if (!ids.has(base)) return base
  let suffix = 2
  while (ids.has(`${base}-${suffix}`)) suffix += 1
  return `${base}-${suffix}`
}

function nextStableId<Id extends CinemaStableId>(existing: readonly string[], base: string, kind: string): Id {
  return cinemaStableId<Id>(nextPlainId(existing, base), kind)
}
