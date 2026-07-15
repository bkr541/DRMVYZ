import type {
  LaserDmxBeamMatrixSettings,
  LaserDmxMatrixBeamColor,
  LaserDmxMatrixBeamVisualRole,
  LaserDmxShowDirectorBeamTarget,
  LaserDmxShowDirectorFixture,
  LaserDmxShowDirectorFixtureSpecificConfig,
  LaserDmxShowDirectorFixtureKind,
  LaserDmxShowDirectorOpticsConfig,
  LaserDmxShowDirectorOpticalPrimitiveType,
  LaserDmxShowDirectorPresentationMode,
  LaserDmxShowDirectorState,
  ReactSectionType,
} from '../../ReactTypes'
import { LASER_DMX_MATRIX_MAX_BEAMS } from '../../ReactTypes'
import {
  createLaserDmxShowDirectorBeamBudgetReport,
  estimateLaserDmxShowDirectorFixtureBeamDemand,
} from '../../LaserDmxShowDirectorBeamBudget'
import type { LaserDmxShowDirectorBeamPriorityRole } from '../../LaserDmxShowDirectorPerformanceProgram'
import { resolveStrobeVisible } from '../LaserDmxModulationEngine'
import {
  createLaserDmxFanRayParameters,
  LASER_DMX_PRIORITY_ROLE_TO_VISUAL_ROLE,
  LASER_DMX_VISUAL_ROLE_PRIORITY,
  resolveLaserDmxBeamOpticalProfile,
  resolveLaserDmxBeamStructure,
  selectDeterministicLaserDmxRayIndices,
  stableLaserDmxPhase,
  type LaserDmxBeamStructure,
  type LaserDmxFanSpacingCurve,
} from './LaserDmxBeamOptics'
import {
  LASER_DMX_SCENE_DEPTH_ZONES,
  laserDmxDepthSortValue,
  normalizeLaserDmxDirection,
  resolveLaserDmxDepthRange,
  resolveLaserDmxFixtureDepth,
  resolveLaserDmxFixtureOrientation,
  resolveLaserDmxTargetDepth,
  stableLaserDmxDepthOrder,
  type LaserDmxDepthAssignmentSource,
  type LaserDmxSceneDepthZone,
  type LaserDmxSceneDepthZoneId,
} from './LaserDmxSpatialModel'
import {
  buildLaserDmxOpticalPrimitivePlan,
  resolveLaserDmxOpticalPrimitiveType,
} from './LaserDmxOpticalPrimitives'

export interface LaserDmxSceneVec3 {
  x: number
  y: number
  z: number
}

export interface LaserDmxSceneColor {
  r: number
  g: number
  b: number
  a: number
}

export interface LaserDmxSceneCamera {
  id: 'frontLocked'
  locked: true
  projection: 'lockedPerspectiveBlend'
  position: LaserDmxSceneVec3
  target: LaserDmxSceneVec3
  up: LaserDmxSceneVec3
  fieldOfViewDeg: number
  elevationDeg: number
  /** Camera-space clipping distances measured forward from the locked camera. */
  nearClipDistance: number
  farClipDistance: number
  /** Restrained blend between orthographic framing and true perspective. */
  perspectiveStrength: number
  referenceAspectRatio: number
  controls: {
    pan: false
    orbit: false
    roll: false
    animate: false
    presetOverride: false
  }
}

export interface LaserDmxSceneTransport {
  audioTimeSec: number
  deltaTimeSec: number
  isPlaying: boolean
  timingDiscontinuity: boolean
  trackKey: string | null
  /** Stable across a single track, preset, rig, and Performance Show identity. */
  historyIdentity: string
  /** Stable occurrence seed supplied by the authoritative performance timeline. */
  occurrenceSeed: number
}

export interface LaserDmxSceneMusicalState {
  bpm: number
  beatIndex: number
  beatPhase: number
  beatHit: boolean
  downbeat: boolean
  barIndex: number
  phraseIndex: number
  section: ReactSectionType | null
  sectionProgress: number
  energy: number
  kickHit: boolean
  kickStrength: number
  snareHit: boolean
  snareStrength: number
  hatHit: boolean
  hatStrength: number
  transient: number
  fourBarBlockIndex: number
  eightBarBlockIndex: number
  sixteenBarBlockIndex: number
}

export interface LaserDmxSceneAtmosphere {
  enabled: boolean
  density: number
  baselineDensity: number
  opacity: number
  beamScatter: number
  turbulence: number
  noiseScale: number
  driftSpeed: number
  driftDirection: number
  diffusion: number
  dissipation: number
  colorAbsorption: number
  foregroundVeil: number
  qualityTier: LaserDmxSceneQuality['qualityTier']
  deterministicSeed: number
}

export interface LaserDmxSceneAtmosphereSource extends LaserDmxSceneSpatialAssignment {
  id: string
  kind: 'haze' | 'co2'
  fixtureId: string
  position: LaserDmxSceneVec3
  direction: LaserDmxSceneVec3
  color: LaserDmxSceneColor
  density: number
  spread: number
  dissipation: number
  ageSec: number
  lifetimeSec: number
  expansion: number
  turbulence: number
  enabled: boolean
}

export interface LaserDmxSceneSpatialAssignment {
  depthZone: LaserDmxSceneDepthZoneId
  depthSource: LaserDmxDepthAssignmentSource
}

export interface LaserDmxSceneFixture extends LaserDmxSceneSpatialAssignment {
  id: string
  semanticKey: string
  kind: LaserDmxShowDirectorFixtureKind
  position: LaserDmxSceneVec3
  orientation: LaserDmxSceneVec3
  rotationDeg: number
  color: LaserDmxSceneColor
  intensity: number
  strobeRate: number
  enabled: boolean
  selected: boolean
  component: LaserDmxShowDirectorFixtureSpecificConfig
  optics: LaserDmxShowDirectorOpticsConfig
}

export interface LaserDmxSceneTarget extends LaserDmxSceneSpatialAssignment {
  id: string
  fixtureId: string
  position: LaserDmxSceneVec3
}

export interface LaserDmxSceneBeamPattern {
  structure: LaserDmxBeamStructure
  primitiveType: Exclude<LaserDmxShowDirectorOpticalPrimitiveType, 'auto'>
  spacingCurve: LaserDmxFanSpacingCurve
  rayIndex: number
  rayCount: number
  spacingT: number
  centerDirection: LaserDmxSceneVec3
  sharedSourceEnergy: number
  phase: number
}

export interface LaserDmxSceneBeam {
  id: string
  fixtureId: string
  sourceId: string
  targetId: string
  fixtureKind: LaserDmxShowDirectorFixtureKind
  origin: LaserDmxSceneVec3
  target: LaserDmxSceneVec3
  direction: LaserDmxSceneVec3
  length: number
  startDepth: number
  endDepth: number
  depthRange: { minZ: number; maxZ: number }
  sortDepth: number
  color: LaserDmxSceneColor
  intensity: number
  coreIntensity: number
  focus: number
  spreadDeg: number
  width: number
  divergence: number
  scatterEnvelopeWidth: number
  opacity: number
  visualRole: LaserDmxMatrixBeamVisualRole
  priority: number
  pattern: LaserDmxSceneBeamPattern
  enabled: boolean
}

export interface LaserDmxSceneEmitter extends LaserDmxSceneSpatialAssignment {
  id: string
  fixtureId: string
  position: LaserDmxSceneVec3
  orientation: LaserDmxSceneVec3
  sortDepth: number
  color: LaserDmxSceneColor
  intensity: number
  apertureSize: number
  activeRayCount: number
  totalActiveEnergy: number
  peakRayIntensity: number
  flareSize: number
  glareDirection: LaserDmxSceneVec3
}

export interface LaserDmxSceneTransientEvent {
  id: string
  kind: 'timingDiscontinuity' | 'blackout' | 'strobe' | 'blinder' | 'co2'
  strength: number
}

export interface LaserDmxSceneQuality {
  devicePixelRatio: number
  renderScale: number
  qualityTier: 'low' | 'medium' | 'high' | 'ultra' | 'auto'
}

export interface LaserDmxSceneDepthOrdering {
  bounds: { minZ: number; maxZ: number }
  frontToBackBeamIds: string[]
  backToFrontBeamIds: string[]
}

export interface LaserDmxSceneFrame {
  timestamp: number
  deltaTime: number
  transport: LaserDmxSceneTransport
  musicalState: LaserDmxSceneMusicalState
  camera: LaserDmxSceneCamera
  atmosphere: LaserDmxSceneAtmosphere
  depthZones: readonly LaserDmxSceneDepthZone[]
  depthOrdering: LaserDmxSceneDepthOrdering
  fixtures: LaserDmxSceneFixture[]
  targets: LaserDmxSceneTarget[]
  beams: LaserDmxSceneBeam[]
  emitters: LaserDmxSceneEmitter[]
  atmosphereSources: LaserDmxSceneAtmosphereSource[]
  transientEvents: LaserDmxSceneTransientEvent[]
  quality: LaserDmxSceneQuality
  presentationMode: LaserDmxShowDirectorPresentationMode
  output: {
    blackout: boolean
    masterDimmer: number
    globalGlow: number
    globalBeamWidth: number
    globalStrobeRate: number
    beamPersistence: number
  }
}

export interface CreateLaserDmxSceneFrameInput {
  showDirector: LaserDmxShowDirectorState
  evaluatedBeamMatrix: LaserDmxBeamMatrixSettings
  audioTimeSec: number
  deltaTimeSec: number
  isPlaying: boolean
  timingDiscontinuity: boolean
  trackKey: string | null
  historyIdentity?: string
  occurrenceSeed?: number
  bpm: number
  beatIndex?: number
  beatPhase?: number
  beatHit?: boolean
  downbeat?: boolean
  barIndex?: number
  phraseIndex?: number
  section?: ReactSectionType | null
  sectionProgress?: number
  energy?: number
  kickHit?: boolean
  kickStrength?: number
  snareHit?: boolean
  snareStrength?: number
  hatHit?: boolean
  hatStrength?: number
  transient?: number
  fourBarBlockIndex?: number
  eightBarBlockIndex?: number
  sixteenBarBlockIndex?: number
  devicePixelRatio?: number
  fixturePriorityById?: Readonly<Record<string, number>> | null
  fixturePriorityRoleById?: Readonly<Record<string, LaserDmxShowDirectorBeamPriorityRole>> | null
}

export const LASER_DMX_FRONT_LOCKED_CAMERA: Readonly<LaserDmxSceneCamera> = Object.freeze({
  id: 'frontLocked',
  locked: true,
  projection: 'lockedPerspectiveBlend',
  // A centered, narrow-field recording position. The small elevation is real
  // camera geometry, not a per-point Y offset, and never changes at runtime.
  position: Object.freeze({ x: 0.5, y: 0.44, z: 2.85 }),
  target: Object.freeze({ x: 0.5, y: 0.5, z: 0 }),
  up: Object.freeze({ x: 0, y: 1, z: 0 }),
  fieldOfViewDeg: 20,
  elevationDeg: 1.2,
  nearClipDistance: 1.35,
  farClipDistance: 4.25,
  perspectiveStrength: 0.22,
  referenceAspectRatio: 16 / 9,
  controls: Object.freeze({
    pan: false,
    orbit: false,
    roll: false,
    animate: false,
    presetOverride: false,
  }),
})

const DEFAULT_KIND_COLORS: Record<LaserDmxShowDirectorFixtureKind, string> = {
  laser: '#4ac7db',
  movingHead: '#67f7ff',
  ledBar: '#61d6aa',
  ledTube: '#8be9ff',
  strobe: '#ffffff',
  blinder: '#ffd68a',
  parWash: '#8a7dff',
  videoWall: '#4ac7db',
  haze: '#9cc9d8',
  co2Jet: '#dff8ff',
}

const BEAM_FIXTURE_KINDS = new Set<LaserDmxShowDirectorFixtureKind>([
  'laser',
  'movingHead',
  'parWash',
  'ledBar',
  'ledTube',
  'strobe',
  'blinder',
  'videoWall',
  'co2Jet',
])

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min))
}

function clamp01(value: number): number {
  return clamp(value, 0, 1)
}

function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function stableAtmosphereSeed(value: string | null | undefined): number {
  const text = value?.trim() || 'laser-dmx-atmosphere'
  let hash = 2166136261
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) / 4294967295
}

function sceneAtmosphereFromFog(
  fog: LaserDmxBeamMatrixSettings['fog'],
  qualityTier: LaserDmxSceneQuality['qualityTier'],
  trackKey: string | null,
  hasActiveBeams: boolean,
): LaserDmxSceneAtmosphere {
  const authored = fog.enabled
  const density = clamp01(fog.density)
  const baselineDensity = hasActiveBeams
    ? clamp((authored ? 0.035 + density * 0.16 : 0.026), 0, 0.22)
    : 0
  return {
    enabled: authored || baselineDensity > 0,
    density,
    baselineDensity,
    opacity: authored ? clamp01(fog.opacity) : 0.2,
    beamScatter: authored ? clamp(Math.max(0.16, fog.beamScatter), 0, 1) : 0.2,
    turbulence: clamp01(fog.turbulence),
    noiseScale: clamp(fog.noiseScale, 0.1, 4),
    driftSpeed: clamp01(fog.driftSpeed),
    driftDirection: clamp01(fog.driftDirection),
    diffusion: clamp01(fog.diffusion),
    dissipation: clamp01(fog.dissipation),
    colorAbsorption: clamp01(fog.colorAbsorption),
    foregroundVeil: authored ? clamp01(fog.diffusion * (0.35 + fog.opacity * 0.65)) : 0.08,
    qualityTier,
    deterministicSeed: stableAtmosphereSeed(trackKey),
  }
}

function normalizedStagePoint(
  point: Pick<LaserDmxShowDirectorFixture, 'x' | 'y'> | Pick<LaserDmxShowDirectorBeamTarget, 'x' | 'y'>,
  columns: number,
  rows: number,
): Pick<LaserDmxSceneVec3, 'x' | 'y'> {
  return {
    x: clamp(finite(point.x, 0), 0, Math.max(1, columns - 1)) / Math.max(1, columns - 1),
    y: clamp(finite(point.y, 0), 0, Math.max(1, rows - 1)) / Math.max(1, rows - 1),
  }
}

function defaultTarget(fixture: LaserDmxShowDirectorFixture, columns: number, rows: number): LaserDmxShowDirectorBeamTarget {
  const distance = Math.max(2, Math.min(columns, rows) * 0.32)
  const radians = (finite(fixture.rotation, 0) + finite(fixture.beam?.beamAngle, 0)) * Math.PI / 180
  return {
    id: `${fixture.id}-target-1`,
    x: clamp(finite(fixture.x, 0) + Math.cos(radians) * distance, 0, Math.max(1, columns - 1)),
    y: clamp(finite(fixture.y, 0) + Math.sin(radians) * distance, 0, Math.max(1, rows - 1)),
  }
}

interface LaserDmxSceneTargetSeed extends LaserDmxShowDirectorBeamTarget {
  rayIndex: number
  rayCount: number
  spacingT: number
  spacingCurve: LaserDmxFanSpacingCurve
}

function authoredTargetsForFixture(
  fixture: LaserDmxShowDirectorFixture,
  columns: number,
  rows: number,
): LaserDmxSceneTargetSeed[] {
  const fallback = defaultTarget(fixture, columns, rows)
  const raw = Array.isArray(fixture.beam?.targets) && fixture.beam.targets.length > 0
    ? fixture.beam.targets
    : [fallback]
  const targets = raw.map((target, index) => ({
    ...target,
    id: typeof target.id === 'string' && target.id.length > 0 ? target.id : `${fixture.id}-target-${index + 1}`,
    x: finite(target.x, fallback.x),
    y: finite(target.y, fallback.y),
  }))
  const primary = {
    ...targets[0],
    x: finite(fixture.beam?.targetX, targets[0]?.x ?? fallback.x),
    y: finite(fixture.beam?.targetY, targets[0]?.y ?? fallback.y),
  }
  const resolved = [primary, ...targets.slice(1)]
  return resolved.map((target, rayIndex) => ({
    ...target,
    rayIndex,
    rayCount: resolved.length,
    spacingT: resolved.length === 1 ? 0 : rayIndex / (resolved.length - 1) - 0.5,
    spacingCurve: 'linear',
  }))
}

function legacyPatternTargets(
  fixture: LaserDmxShowDirectorFixture,
  columns: number,
  rows: number,
): LaserDmxSceneTargetSeed[] {
  const maxX = Math.max(1, columns - 1)
  const maxY = Math.max(1, rows - 1)
  const origin = normalizedStagePoint(fixture, columns, rows)
  const angle = finite(fixture.rotation, 0) + finite(fixture.beam.beamAngle, 0)
  const spread = clamp(finite(fixture.beam.beamSpread, fixture.kind === 'laser' ? 18 : 0), 0, 180)
  const mode = fixture.beam.targetMode
  const count = mode === 'fan'
    ? clamp(Math.round(spread / 9), 3, 9)
    : mode === 'cross' || mode === 'mirror'
      ? 2
      : 1
  const spacingCurve: LaserDmxFanSpacingCurve = 'linear'
  const rays = createLaserDmxFanRayParameters(count, spread, spacingCurve)

  return rays.map(ray => {
    const radians = (angle + ray.offsetDeg) * Math.PI / 180
    const dx = Math.cos(radians) * 0.62
    const dy = Math.sin(radians) * 0.62
    let visibleScale = 1
    if (dx > 0) visibleScale = Math.min(visibleScale, (1 - origin.x) / dx)
    if (dx < 0) visibleScale = Math.min(visibleScale, (0 - origin.x) / dx)
    if (dy > 0) visibleScale = Math.min(visibleScale, (1 - origin.y) / dy)
    if (dy < 0) visibleScale = Math.min(visibleScale, (0 - origin.y) / dy)
    return {
      id: `${fixture.id}-${mode}-target-${ray.index + 1}`,
      x: (origin.x + dx * clamp(visibleScale, 0, 1)) * maxX,
      y: (origin.y + dy * clamp(visibleScale, 0, 1)) * maxY,
      rayIndex: ray.index,
      rayCount: count,
      spacingT: ray.spacingT,
      spacingCurve,
    }
  })
}

function generatedPatternTargets(
  fixture: LaserDmxShowDirectorFixture,
  columns: number,
  rows: number,
  requestedDemand: number,
  input: Pick<CreateLaserDmxSceneFrameInput, 'audioTimeSec' | 'beatIndex' | 'phraseIndex' | 'occurrenceSeed'>,
): LaserDmxSceneTargetSeed[] {
  const origin = normalizedStagePoint(fixture, columns, rows)
  const fixtureDepth = resolveLaserDmxFixtureDepth(fixture, origin.y)
  const plan = buildLaserDmxOpticalPrimitivePlan({
    fixture,
    origin: { ...origin, z: fixtureDepth.z },
    allocatedRayCount: requestedDemand,
    audioTimeSec: Math.max(0, finite(input.audioTimeSec, 0)),
    beatIndex: Math.max(0, Math.floor(finite(input.beatIndex, 0))),
    phraseIndex: Math.max(0, Math.floor(finite(input.phraseIndex, 0))),
    occurrenceSeed: Math.max(0, Math.floor(finite(input.occurrenceSeed, 0))),
  })
  const maxX = Math.max(1, columns - 1)
  const maxY = Math.max(1, rows - 1)
  return plan.rays.map(ray => {
    return {
      id: `${fixture.id}-${plan.primitiveType}-target-${ray.index + 1}`,
      x: ray.target.x * maxX,
      y: ray.target.y * maxY,
      z: ray.target.z,
      ...(ray.target.depthLayer ? { depthLayer: ray.target.depthLayer } : {}),
      rayIndex: ray.index,
      rayCount: ray.count,
      spacingT: ray.spacingT,
      spacingCurve: ray.spacingCurve,
    }
  })
}

function targetsForFixture(
  fixture: LaserDmxShowDirectorFixture,
  columns: number,
  rows: number,
  allocatedDemand: number,
  requestedDemand: number,
  input: Pick<CreateLaserDmxSceneFrameInput, 'audioTimeSec' | 'beatIndex' | 'phraseIndex' | 'occurrenceSeed'>,
): LaserDmxSceneTargetSeed[] {
  const authored = authoredTargetsForFixture(fixture, columns, rows)
  const hasMultipleAuthoredTargets = authored.length > 1
  const explicitPrimitive = fixture.optics.primitiveType !== 'auto'
  const candidates = explicitPrimitive
    ? generatedPatternTargets(fixture, columns, rows, requestedDemand, input)
    : fixture.beam.targetMode === 'fixed' || hasMultipleAuthoredTargets
      ? authored
      : legacyPatternTargets(fixture, columns, rows)
  const selectedIndices = selectDeterministicLaserDmxRayIndices(candidates.length, allocatedDemand)
  return selectedIndices.map(index => candidates[index]).filter((target): target is LaserDmxSceneTargetSeed => target != null)
}

function colorFromHex(value: string, fallback: string): LaserDmxSceneColor {
  const match = /^#?([0-9a-f]{6})$/i.exec(value.trim()) ?? /^#?([0-9a-f]{6})$/i.exec(fallback)
  const hex = match?.[1] ?? '4ac7db'
  return {
    r: parseInt(hex.slice(0, 2), 16) / 255,
    g: parseInt(hex.slice(2, 4), 16) / 255,
    b: parseInt(hex.slice(4, 6), 16) / 255,
    a: 1,
  }
}

function colorFromMatrix(color: LaserDmxMatrixBeamColor | undefined, fallback: LaserDmxSceneColor): LaserDmxSceneColor {
  if (!color) return fallback
  const white = clamp01(finite(color.white, 0) / 255)
  return {
    r: clamp01(finite(color.red, fallback.r * 255) / 255 + white),
    g: clamp01(finite(color.green, fallback.g * 255) / 255 + white),
    b: clamp01(finite(color.blue, fallback.b * 255) / 255 + white),
    a: clamp01(finite(color.alpha, fallback.a)),
  }
}

function safeIdPart(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 96) || 'fixture'
}

function matrixBeamsForFixture(settings: LaserDmxBeamMatrixSettings, fixtureId: string) {
  const prefix = `sd-${safeIdPart(fixtureId)}-`
  return settings.beams.filter(beam => beam.id.startsWith(prefix))
}

function roleForFixture(
  fixture: LaserDmxShowDirectorFixture,
  priorityRoles: Readonly<Record<string, LaserDmxShowDirectorBeamPriorityRole>> | null | undefined,
): LaserDmxMatrixBeamVisualRole {
  return fixture.runtimeBeamVisualRole
    ?? (priorityRoles?.[fixture.id] ? LASER_DMX_PRIORITY_ROLE_TO_VISUAL_ROLE[priorityRoles[fixture.id]] : null)
    ?? (fixture.kind === 'laser' ? 'primary' : 'secondary')
}

function createFixtureBeamAllocations(input: CreateLaserDmxSceneFrameInput): Map<string, number> {
  const fixtures = input.showDirector.fixtures
  if (input.fixturePriorityById || input.fixturePriorityRoleById) {
    const report = createLaserDmxShowDirectorBeamBudgetReport(
      fixtures,
      input.fixturePriorityRoleById ?? {},
      LASER_DMX_MATRIX_MAX_BEAMS,
    )
    return new Map(report.fixtures.map(item => [item.fixtureId, item.allocatedDemand]))
  }

  // Static/authored compilation preserves the repository's legacy fixture order.
  // Performance Shows supply priority maps and therefore use the role-aware path.
  let remaining = LASER_DMX_MATRIX_MAX_BEAMS
  return new Map(fixtures.map(fixture => {
    const demand = estimateLaserDmxShowDirectorFixtureBeamDemand(fixture)
    const allocated = Math.min(demand, remaining)
    remaining -= allocated
    return [fixture.id, allocated]
  }))
}

function normalizedDirectionSum(directions: readonly LaserDmxSceneVec3[], fallback: LaserDmxSceneVec3): LaserDmxSceneVec3 {
  if (directions.length === 0) return fallback
  const sum = directions.reduce((acc, direction) => ({
    x: acc.x + direction.x,
    y: acc.y + direction.y,
    z: acc.z + direction.z,
  }), { x: 0, y: 0, z: 0 })
  const length = Math.hypot(sum.x, sum.y, sum.z)
  return length > 1e-6
    ? { x: sum.x / length, y: sum.y / length, z: sum.z / length }
    : fallback
}

function applyLaserDmxSourceEnergy(
  beams: LaserDmxSceneBeam[],
  emitters: LaserDmxSceneEmitter[],
): { beams: LaserDmxSceneBeam[]; emitters: LaserDmxSceneEmitter[] } {
  const activeBySource = new Map<string, LaserDmxSceneBeam[]>()
  for (const beam of beams) {
    if (!beam.enabled || beam.intensity <= 0.001) continue
    const group = activeBySource.get(beam.sourceId) ?? []
    group.push(beam)
    activeBySource.set(beam.sourceId, group)
  }

  const sourceEnergy = new Map<string, number>()
  for (const [sourceId, sourceBeams] of activeBySource) {
    sourceEnergy.set(sourceId, sourceBeams.reduce((sum, beam) => sum + beam.intensity * Math.max(0.35, beam.opacity), 0))
  }

  return {
    beams: beams.map(beam => ({
      ...beam,
      pattern: {
        ...beam.pattern,
        sharedSourceEnergy: sourceEnergy.get(beam.sourceId) ?? 0,
      },
    })),
    emitters: emitters.map(emitter => {
      const sourceBeams = activeBySource.get(emitter.id) ?? []
      const totalActiveEnergy = sourceEnergy.get(emitter.id) ?? 0
      const peakRayIntensity = sourceBeams.reduce((peak, beam) => Math.max(peak, beam.intensity), 0)
      const glareDirection = normalizedDirectionSum(
        sourceBeams.map(beam => beam.direction),
        emitter.orientation,
      )
      const normalizedEnergy = sourceBeams.length > 0
        ? clamp(totalActiveEnergy / Math.sqrt(sourceBeams.length), 0, 2.5)
        : 0
      return {
        ...emitter,
        orientation: glareDirection,
        glareDirection,
        activeRayCount: sourceBeams.length,
        totalActiveEnergy,
        peakRayIntensity,
        intensity: normalizedEnergy,
        flareSize: emitter.apertureSize * (0.72 + Math.sqrt(totalActiveEnergy) * 0.42),
      }
    }),
  }
}

function createSceneTransientEvents(input: {
  timestamp: number
  timingDiscontinuity: boolean
  blackout: boolean
  fixtures: readonly LaserDmxSceneFixture[]
  atmosphereSources: readonly LaserDmxSceneAtmosphereSource[]
  globalStrobeRate: number
}): LaserDmxSceneTransientEvent[] {
  const events: LaserDmxSceneTransientEvent[] = []
  if (input.timingDiscontinuity) {
    events.push({
      id: `timing-${input.timestamp.toFixed(4)}`,
      kind: 'timingDiscontinuity',
      strength: 1,
    })
  }
  if (input.blackout) {
    events.push({ id: `blackout-${input.timestamp.toFixed(4)}`, kind: 'blackout', strength: 1 })
    return events
  }
  const globalStrobeRate = clamp01(input.globalStrobeRate)
  const effectiveStrobeRate = input.fixtures.reduce(
    (maximum, fixture) => fixture.enabled && BEAM_FIXTURE_KINDS.has(fixture.kind)
      ? Math.max(maximum, fixture.strobeRate)
      : maximum,
    globalStrobeRate,
  )
  const strobeStrength = effectiveStrobeRate > 0.001
    && resolveStrobeVisible(effectiveStrobeRate, input.timestamp)
    ? input.fixtures.reduce(
        (maximum, fixture) => fixture.enabled
          && BEAM_FIXTURE_KINDS.has(fixture.kind)
          && (globalStrobeRate > 0.001 || fixture.strobeRate > 0.001)
            ? Math.max(maximum, fixture.intensity)
            : maximum,
        0,
      )
    : 0
  const blinderStrength = input.fixtures.reduce(
    (maximum, fixture) => fixture.kind === 'blinder' && fixture.enabled
      ? Math.max(maximum, fixture.intensity)
      : maximum,
    0,
  )
  const co2Strength = input.atmosphereSources.reduce(
    (maximum, source) => source.kind === 'co2' && source.enabled
      ? Math.max(maximum, source.density)
      : maximum,
    0,
  )
  if (strobeStrength > 0.001) {
    events.push({
      id: `strobe-${input.timestamp.toFixed(4)}`,
      kind: 'strobe',
      strength: clamp01(strobeStrength),
    })
  }
  if (blinderStrength > 0.001) {
    events.push({
      id: `blinder-${input.timestamp.toFixed(4)}`,
      kind: 'blinder',
      strength: clamp01(blinderStrength),
    })
  }
  if (co2Strength > 0.001) {
    events.push({
      id: `co2-${input.timestamp.toFixed(4)}`,
      kind: 'co2',
      strength: clamp01(co2Strength),
    })
  }
  return events
}

function depthBounds(fixtures: readonly LaserDmxSceneFixture[], targets: readonly LaserDmxSceneTarget[]): { minZ: number; maxZ: number } {
  const values = [...fixtures.map(fixture => fixture.position.z), ...targets.map(target => target.position.z)]
  if (values.length === 0) return { minZ: 0, maxZ: 0 }
  return {
    minZ: Math.min(...values),
    maxZ: Math.max(...values),
  }
}

export function createLaserDmxSceneFrame(input: CreateLaserDmxSceneFrameInput): LaserDmxSceneFrame {
  const showDirector = input.showDirector
  const evaluated = input.evaluatedBeamMatrix
  const columns = Math.max(1, Math.round(showDirector.settings.gridSize.columns || 1))
  const rows = Math.max(1, Math.round(showDirector.settings.gridSize.rows || 1))
  const masterDimmer = clamp01(evaluated.output.masterDimmer)
  const blackout = evaluated.output.blackout === true
  const selected = new Set(showDirector.selectedFixtureIds)
  if (showDirector.selectedFixtureId) selected.add(showDirector.selectedFixtureId)
  const allocations = createFixtureBeamAllocations(input)

  const fixtures: LaserDmxSceneFixture[] = []
  const targets: LaserDmxSceneTarget[] = []
  const beams: LaserDmxSceneBeam[] = []
  const emitters: LaserDmxSceneEmitter[] = []
  const atmosphereSources: LaserDmxSceneAtmosphereSource[] = []

  for (const fixture of showDirector.fixtures) {
    const fallbackColor = DEFAULT_KIND_COLORS[fixture.kind]
    const authoredColor = colorFromHex(
      fixture.colorMode === 'fixtureDefault' ? fallbackColor : fixture.color,
      fallbackColor,
    )
    // Geometry is captured before the Beam Matrix compatibility compiler. Grid
    // dimensions define the authoring bounds only; fixture and target values are
    // never rounded or converted into matrix cells on the WebGL path.
    const fixtureEnabled = fixture.enabled
    const intensity = fixtureEnabled ? clamp01(fixture.brightness) : 0
    const xy = normalizedStagePoint(fixture, columns, rows)
    const fixtureDepth = resolveLaserDmxFixtureDepth(fixture, xy.y)
    const position: LaserDmxSceneVec3 = { ...xy, z: fixtureDepth.z }
    const color = authoredColor
    const allocatedDemand = allocations.get(fixture.id) ?? 0
    const requestedDemand = estimateLaserDmxShowDirectorFixtureBeamDemand(fixture)
    const targetSeeds = targetsForFixture(fixture, columns, rows, allocatedDemand, requestedDemand, input)
    const resolvedTargets = targetSeeds.map(seed => {
      const targetXy = normalizedStagePoint(seed, columns, rows)
      const targetDepth = resolveLaserDmxTargetDepth({
        fixture,
        target: seed,
        targetIndex: seed.rayIndex,
        origin: position,
        normalizedTarget: targetXy,
      })
      const sceneTarget: LaserDmxSceneTarget = {
        id: seed.id,
        fixtureId: fixture.id,
        position: { ...targetXy, z: targetDepth.z },
        depthZone: targetDepth.zoneId,
        depthSource: targetDepth.source,
      }
      targets.push(sceneTarget)
      return { seed, sceneTarget }
    })
    const orientation = resolveLaserDmxFixtureOrientation(fixture, position, resolvedTargets[0]?.sceneTarget.position)

    fixtures.push({
      id: fixture.id,
      semanticKey: fixture.semanticKey ?? fixture.id,
      kind: fixture.kind,
      position,
      orientation,
      rotationDeg: finite(fixture.rotation, 0),
      color,
      intensity,
      strobeRate: clamp01(fixture.component.strobeRate),
      enabled: fixtureEnabled,
      selected: selected.has(fixture.id),
      component: { ...fixture.component },
      optics: { ...fixture.optics },
      depthZone: fixtureDepth.zoneId,
      depthSource: fixtureDepth.source,
    })

    if (fixture.kind === 'haze') {
      const hazeIntensity = clamp01(fixture.component.hazeIntensity)
      atmosphereSources.push({
        id: `${fixture.id}-haze-source`,
        kind: 'haze',
        fixtureId: fixture.id,
        position,
        direction: orientation,
        color,
        density: fixtureEnabled ? clamp01(fixture.brightness * hazeIntensity) : 0,
        spread: clamp(0.12 + hazeIntensity * 0.42, 0.08, 0.7),
        dissipation: clamp01(evaluated.fog.dissipation * (0.55 + (1 - hazeIntensity) * 0.45)),
        ageSec: 0,
        lifetimeSec: Number.POSITIVE_INFINITY,
        expansion: 0,
        turbulence: clamp01(evaluated.fog.turbulence),
        enabled: fixtureEnabled && hazeIntensity > 0.001,
        depthZone: fixtureDepth.zoneId,
        depthSource: fixtureDepth.source,
      })
    }
    if (fixture.kind === 'co2Jet') {
      const burstDuration = clamp(fixture.component.co2BurstDurationMs / 1000, 0.05, 10)
      const co2Seed = stableAtmosphereSeed(`${input.trackKey ?? 'track'}:${fixture.semanticKey ?? fixture.id}:${input.occurrenceSeed ?? 0}`)
      const burstCycle = burstDuration + 0.18
      const burstAge = ((Math.max(0, input.audioTimeSec) + co2Seed * burstCycle) % burstCycle)
      const normalizedAge = clamp01(burstAge / burstDuration)
      const attack = clamp01(burstAge / Math.min(0.12, burstDuration * 0.28))
      const decay = Math.pow(1 - normalizedAge, 1.35)
      const plumeEnvelope = attack * decay
      atmosphereSources.push({
        id: `${fixture.id}-co2-source`,
        kind: 'co2',
        fixtureId: fixture.id,
        position,
        direction: orientation,
        color,
        density: fixtureEnabled ? clamp01(fixture.brightness * plumeEnvelope) : 0,
        spread: clamp(0.065 + normalizedAge * 0.24 + burstDuration * 0.012, 0.06, 0.36),
        dissipation: clamp01(0.28 + normalizedAge * 0.5),
        ageSec: burstAge,
        lifetimeSec: burstDuration,
        expansion: normalizedAge,
        turbulence: clamp01(0.42 + normalizedAge * 0.46),
        enabled: fixtureEnabled && fixture.brightness > 0.001 && burstAge <= burstDuration && plumeEnvelope > 0.001,
        depthZone: fixtureDepth.zoneId,
        depthSource: fixtureDepth.source,
      })
    }

    const sourceId = `${fixture.id}-emitter`
    if (fixtureEnabled && BEAM_FIXTURE_KINDS.has(fixture.kind)) {
      const apertureSize = fixture.kind === 'laser' ? 1 : fixture.kind === 'movingHead' ? 1.4 : 1.8
      emitters.push({
        id: sourceId,
        fixtureId: fixture.id,
        position,
        orientation,
        sortDepth: position.z,
        color,
        intensity: 0,
        apertureSize,
        activeRayCount: 0,
        totalActiveEnergy: 0,
        peakRayIntensity: 0,
        flareSize: apertureSize,
        glareDirection: orientation,
        depthZone: fixtureDepth.zoneId,
        depthSource: fixtureDepth.source,
      })
    }

    if (!fixture.beam?.beamEnabled || !BEAM_FIXTURE_KINDS.has(fixture.kind) || resolvedTargets.length === 0) continue
    const visualRole = roleForFixture(fixture, input.fixturePriorityRoleById)
    const priority = input.fixturePriorityById?.[fixture.id] ?? LASER_DMX_VISUAL_ROLE_PRIORITY[visualRole]
    const directions = resolvedTargets.map(({ sceneTarget }) => normalizeLaserDmxDirection(position, sceneTarget.position))
    const centerDirection = normalizedDirectionSum(directions, orientation)
    const distinctDepthPlanes = new Set(resolvedTargets.map(({ sceneTarget }) => sceneTarget.position.z.toFixed(4))).size
    const structure = resolveLaserDmxBeamStructure({
      targetMode: fixture.beam.targetMode,
      spreadDeg: fixture.beam.beamSpread,
      rayCount: resolvedTargets.length,
      distinctDepthPlanes,
      semanticKey: fixture.semanticKey,
    })
    const appearance = fixture.runtimeBeamAppearance ?? {}

    for (let index = 0; index < resolvedTargets.length; index += 1) {
      const { seed, sceneTarget: target } = resolvedTargets[index]
      const enabled = fixtureEnabled
      const beamIntensity = enabled ? clamp01(fixture.brightness) : 0
      const direction = directions[index] ?? centerDirection
      const depthRange = resolveLaserDmxDepthRange(position, target.position)
      const optical = resolveLaserDmxBeamOpticalProfile({
        fixtureKind: fixture.kind,
        intensity: beamIntensity,
        focus: clamp01(fixture.beam.focus),
        spreadDeg: clamp(finite(fixture.beam.beamSpread, 0), 0, 180),
        width: appearance.width,
        divergence: appearance.divergence,
        glow: appearance.glow,
        opacity: color.a,
        opticalSoftness: fixture.optics.opticalSoftness,
        zoom: fixture.optics.zoom,
        iris: fixture.optics.iris,
        frost: fixture.optics.frost,
        visualRole,
      })
      beams.push({
        id: `${fixture.id}-beam-${seed.rayIndex + 1}`,
        fixtureId: fixture.id,
        sourceId,
        targetId: target.id,
        fixtureKind: fixture.kind,
        origin: position,
        target: target.position,
        direction,
        length: Math.hypot(
          target.position.x - position.x,
          target.position.y - position.y,
          target.position.z - position.z,
        ),
        startDepth: position.z,
        endDepth: target.position.z,
        depthRange,
        sortDepth: laserDmxDepthSortValue(position, target.position),
        color,
        intensity: beamIntensity,
        coreIntensity: optical.coreIntensity,
        focus: clamp01(fixture.beam.focus),
        spreadDeg: clamp(finite(fixture.beam.beamSpread, 0), 0, 180),
        width: optical.width,
        divergence: optical.divergence,
        scatterEnvelopeWidth: optical.scatterEnvelopeWidth,
        opacity: optical.opacity,
        visualRole,
        priority,
        pattern: {
          structure,
          primitiveType: resolveLaserDmxOpticalPrimitiveType(fixture),
          spacingCurve: seed.spacingCurve,
          rayIndex: seed.rayIndex,
          rayCount: seed.rayCount,
          spacingT: seed.spacingT,
          centerDirection,
          sharedSourceEnergy: 0,
          phase: stableLaserDmxPhase(`${fixture.id}:${seed.rayIndex}:${seed.rayCount}`),
        },
        enabled,
      })
    }
  }

  const energized = applyLaserDmxSourceEnergy(beams, emitters)
  const transientEvents = createSceneTransientEvents({
    timestamp: Math.max(0, finite(input.audioTimeSec, 0)),
    timingDiscontinuity: input.timingDiscontinuity,
    blackout,
    fixtures,
    atmosphereSources,
    globalStrobeRate: evaluated.output.globalStrobeRate,
  })

  return {
    timestamp: Math.max(0, finite(input.audioTimeSec, 0)),
    deltaTime: clamp(finite(input.deltaTimeSec, 1 / 60), 0, 0.1),
    transport: {
      audioTimeSec: Math.max(0, finite(input.audioTimeSec, 0)),
      deltaTimeSec: clamp(finite(input.deltaTimeSec, 1 / 60), 0, 0.1),
      isPlaying: input.isPlaying,
      timingDiscontinuity: input.timingDiscontinuity,
      trackKey: input.trackKey,
      historyIdentity: input.historyIdentity?.trim()
        || `${input.trackKey ?? 'track:none'}:${showDirector.sourceTemplateId ?? 'rig'}:${showDirector.settings.rendererMode}`,
      occurrenceSeed: Math.max(0, Math.floor(finite(input.occurrenceSeed, 0))),
    },
    musicalState: {
      bpm: Math.max(0, finite(input.bpm, 0)),
      beatIndex: Math.max(0, Math.floor(finite(input.beatIndex, 0))),
      beatPhase: clamp01(finite(input.beatPhase, 0)),
      beatHit: input.beatHit === true,
      downbeat: input.downbeat === true,
      barIndex: Math.max(0, Math.floor(finite(input.barIndex, 0))),
      phraseIndex: Math.max(0, Math.floor(finite(input.phraseIndex, 0))),
      section: input.section ?? null,
      sectionProgress: clamp01(finite(input.sectionProgress, 0)),
      energy: clamp01(finite(input.energy, 0)),
      kickHit: input.kickHit === true,
      kickStrength: clamp01(finite(input.kickStrength, 0)),
      snareHit: input.snareHit === true,
      snareStrength: clamp01(finite(input.snareStrength, 0)),
      hatHit: input.hatHit === true,
      hatStrength: clamp01(finite(input.hatStrength, 0)),
      transient: clamp01(finite(input.transient, 0)),
      fourBarBlockIndex: Math.max(0, Math.floor(finite(input.fourBarBlockIndex, 0))),
      eightBarBlockIndex: Math.max(0, Math.floor(finite(input.eightBarBlockIndex, 0))),
      sixteenBarBlockIndex: Math.max(0, Math.floor(finite(input.sixteenBarBlockIndex, 0))),
    },
    camera: LASER_DMX_FRONT_LOCKED_CAMERA,
    atmosphere: sceneAtmosphereFromFog(
      evaluated.fog,
      showDirector.settings.webglAtmosphereQuality ?? 'auto',
      input.trackKey,
      energized.beams.some(beam => beam.enabled && beam.intensity > 0.001),
    ),
    depthZones: LASER_DMX_SCENE_DEPTH_ZONES,
    depthOrdering: {
      bounds: depthBounds(fixtures, targets),
      frontToBackBeamIds: stableLaserDmxDepthOrder(energized.beams, 'frontToBack'),
      backToFrontBeamIds: stableLaserDmxDepthOrder(energized.beams, 'backToFront'),
    },
    fixtures,
    targets,
    beams: energized.beams,
    emitters: energized.emitters,
    atmosphereSources,
    transientEvents,
    quality: {
      devicePixelRatio: clamp(finite(input.devicePixelRatio, 1), 0.5, 4),
      renderScale: clamp(showDirector.settings.webglRenderScale, 0.25, 1),
      qualityTier: showDirector.settings.webglQuality,
    },
    presentationMode: showDirector.settings.presentationMode,
    output: {
      blackout,
      masterDimmer,
      globalGlow: clamp01(evaluated.output.globalGlow),
      globalBeamWidth: clamp(evaluated.output.globalBeamWidth, 0.1, 6),
      globalStrobeRate: clamp01(evaluated.output.globalStrobeRate),
      beamPersistence: clamp01(evaluated.output.beamPersistence),
    },
  }
}

export function resolveLaserDmxSceneFrameOutput(
  frame: LaserDmxSceneFrame,
  evaluated: LaserDmxBeamMatrixSettings,
): LaserDmxSceneFrame {
  const masterDimmer = clamp01(evaluated.output.masterDimmer)
  const blackout = evaluated.output.blackout === true
  const matrixByFixture = new Map<string, ReturnType<typeof matrixBeamsForFixture>>()
  for (const fixture of frame.fixtures) {
    matrixByFixture.set(fixture.id, matrixBeamsForFixture(evaluated, fixture.id))
  }

  const fixtures = frame.fixtures.map(fixture => {
    const matrixBeams = matrixByFixture.get(fixture.id) ?? []
    const matrixIntensity = matrixBeams.length > 0
      ? Math.max(...matrixBeams.map(beam => clamp01(beam.appearance.dimmer)))
      : fixture.intensity
    const color = colorFromMatrix(matrixBeams.find(beam => beam.enabled)?.color, fixture.color)
    const matrixStrobeRate = matrixBeams.reduce(
      (maximum, beam) => Math.max(maximum, clamp01(beam.appearance.strobeRate)),
      0,
    )
    return {
      ...fixture,
      color,
      strobeRate: Math.max(fixture.strobeRate, matrixStrobeRate),
      enabled: fixture.enabled && !blackout,
      intensity: fixture.enabled && !blackout ? clamp01(matrixIntensity * masterDimmer) : 0,
    }
  })
  const fixtureById = new Map(fixtures.map(fixture => [fixture.id, fixture]))
  const beamIndexByFixture = new Map<string, number>()
  const beams = frame.beams.map(beam => {
    const matrixBeams = matrixByFixture.get(beam.fixtureId) ?? []
    const index = beamIndexByFixture.get(beam.fixtureId) ?? 0
    beamIndexByFixture.set(beam.fixtureId, index + 1)
    const matrixBeam = matrixBeams[index] ?? matrixBeams[0]
    const fixture = fixtureById.get(beam.fixtureId)
    const enabled = Boolean(fixture?.enabled && (matrixBeam?.enabled ?? beam.enabled) && (matrixBeam?.appearance.shutterOpen ?? true))
    const intensity = enabled ? clamp01((matrixBeam?.appearance.dimmer ?? beam.intensity) * masterDimmer) : 0
    const focus = clamp01(matrixBeam?.appearance.focus ?? beam.focus)
    const visualRole = matrixBeam?.visualRole ?? beam.visualRole
    const color = colorFromMatrix(matrixBeam?.color, fixture?.color ?? beam.color)
    const optical = resolveLaserDmxBeamOpticalProfile({
      fixtureKind: beam.fixtureKind,
      intensity,
      focus,
      spreadDeg: beam.spreadDeg,
      width: matrixBeam?.appearance.width ?? beam.width,
      divergence: matrixBeam?.appearance.divergence ?? beam.divergence,
      glow: matrixBeam?.appearance.glow ?? Math.min(1, beam.scatterEnvelopeWidth / 6),
      opacity: color.a,
      opticalSoftness: fixture?.optics.opticalSoftness,
      zoom: fixture?.optics.zoom,
      iris: fixture?.optics.iris,
      frost: fixture?.optics.frost,
      visualRole,
    })
    return {
      ...beam,
      id: matrixBeam?.id ?? beam.id,
      color,
      intensity,
      coreIntensity: optical.coreIntensity,
      focus,
      width: optical.width,
      divergence: optical.divergence,
      scatterEnvelopeWidth: optical.scatterEnvelopeWidth,
      opacity: optical.opacity,
      visualRole,
      priority: LASER_DMX_VISUAL_ROLE_PRIORITY[visualRole],
      enabled,
    }
  })
  const emitters = frame.emitters.map(emitter => {
    const fixture = fixtureById.get(emitter.fixtureId)
    return {
      ...emitter,
      color: fixture?.color ?? emitter.color,
    }
  })
  const originalFixtureById = new Map(frame.fixtures.map(fixture => [fixture.id, fixture]))
  const atmosphereSources = frame.atmosphereSources.map(source => {
    const originalFixture = originalFixtureById.get(source.fixtureId)
    const fixture = fixtureById.get(source.fixtureId)
    const hazeRatio = originalFixture && originalFixture.intensity > 0.001
      ? clamp01(source.density / originalFixture.intensity)
      : 0
    return {
      ...source,
      color: fixture?.color ?? source.color,
      density: fixture?.enabled ? clamp01((fixture.intensity ?? 0) * hazeRatio) : 0,
      dissipation: source.kind === 'haze'
        ? clamp01(evaluated.fog.dissipation * (0.55 + (1 - hazeRatio) * 0.45))
        : source.dissipation,
      enabled: Boolean(fixture?.enabled && hazeRatio > 0.001),
    }
  })
  const energized = applyLaserDmxSourceEnergy(beams, emitters)
  const transientEvents = createSceneTransientEvents({
    timestamp: frame.timestamp,
    timingDiscontinuity: frame.transport.timingDiscontinuity,
    blackout,
    fixtures,
    atmosphereSources,
    globalStrobeRate: evaluated.output.globalStrobeRate,
  })

  return {
    ...frame,
    atmosphere: {
      ...sceneAtmosphereFromFog(
        evaluated.fog,
        frame.atmosphere.qualityTier,
        frame.transport.trackKey,
        energized.beams.some(beam => beam.enabled && beam.intensity > 0.001),
      ),
      deterministicSeed: frame.atmosphere.deterministicSeed,
    },
    depthOrdering: {
      ...frame.depthOrdering,
      frontToBackBeamIds: stableLaserDmxDepthOrder(energized.beams, 'frontToBack'),
      backToFrontBeamIds: stableLaserDmxDepthOrder(energized.beams, 'backToFront'),
    },
    fixtures,
    beams: energized.beams,
    emitters: energized.emitters,
    atmosphereSources,
    transientEvents,
    output: {
      blackout,
      masterDimmer,
      globalGlow: clamp01(evaluated.output.globalGlow),
      globalBeamWidth: clamp(evaluated.output.globalBeamWidth, 0.1, 6),
      globalStrobeRate: clamp01(evaluated.output.globalStrobeRate),
      beamPersistence: clamp01(evaluated.output.beamPersistence),
    },
  }
}
