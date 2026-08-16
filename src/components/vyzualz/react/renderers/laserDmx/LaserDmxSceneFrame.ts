import type {
  LaserDmxBeamMatrixSettings,
  LaserDmxMatrixBeam,
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
import { LASER_DMX_MATRIX_MAX_BEAMS, LASER_DMX_SHOW_DIRECTOR_MAX_BEAM_TARGETS } from '../../ReactTypes'
import {
  createLaserDmxShowDirectorBeamBudgetReport,
  estimateLaserDmxShowDirectorFixtureBeamDemand,
} from '../../LaserDmxShowDirectorBeamBudget'
import type { LaserDmxShowDirectorBeamPriorityRole } from '../../LaserDmxShowDirectorPerformanceProgram'
import { applyLaserDmxScannerRuntimeOverrides } from '../../laserDmxScannerAuthoring'
import { resolveStrobeVisible } from '../LaserDmxModulationEngine'
import type {
  CompiledLaserDmxBeamMatrixResult,
  CompiledLaserDmxMatrixBeam,
} from '../LaserDmxBeamMatrixCompiler'
import { gridAnchorToCanvas, targetToCanvas, zDepthFactors } from '../LaserDmxBeamGeometry'
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
import {
  calibrateLaserDmxChannels,
  parseLaserDmxSrgbHex,
  resolveLaserDmxFixtureCalibration,
} from './LaserDmxColorScience'
import {
  aggregateLaserDmxScannerExposureSamples,
  createLaserDmxAuthoredScannerPlan,
  createLaserDmxLegacyScannerPlan,
  createLaserDmxScannerDiagnostics,
  solveLaserDmxScannerExposure,
  type LaserDmxExposureSample,
  type LaserDmxExposureAggregationDiagnostics,
  type LaserDmxScanPath,
  type LaserDmxScannerDiagnostics,
  type LaserDmxScannerHead,
  type LaserDmxScannerInstantaneousRay,
  type LaserDmxScannerOpticalCopy,
} from './LaserDmxScannerDomain'
import { createLaserDmxMacroScannerPlan } from './LaserDmxMacroScannerPlanner'

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
  /** Canonical Show Director beam-output gate. Kept separate from trigger/runtime enable state. */
  beamEnabled: boolean
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
  scannerHeads: LaserDmxScannerHead[]
  scanPaths: LaserDmxScanPath[]
  scannerInstantaneousRays: LaserDmxScannerInstantaneousRay[]
  exposureSamples: LaserDmxExposureSample[]
  exposureAggregation: LaserDmxExposureAggregationDiagnostics
  opticalCopies: LaserDmxScannerOpticalCopy[]
  legacyCompatibilityBeamIds: string[]
  scannerDiagnostics: LaserDmxScannerDiagnostics
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
    /** Preview-only React trim, resolved before backend selection. */
    previewOutputTrim?: number
    /** Preview-only glow trim, resolved before backend selection. */
    previewGlowTrim?: number
    safetyClamp?: number
    resolvedPreviewIntensity?: number
    resolvedHardwareIntensity?: number
    resolvedPreviewGlow?: number
    resolvedHardwareGlow?: number
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
  requestedDemand: number,
): LaserDmxSceneTargetSeed[] {
  const maxX = Math.max(1, columns - 1)
  const maxY = Math.max(1, rows - 1)
  const origin = normalizedStagePoint(fixture, columns, rows)
  const angle = finite(fixture.rotation, 0) + finite(fixture.beam.beamAngle, 0)
  const spread = clamp(finite(fixture.beam.beamSpread, fixture.kind === 'laser' ? 18 : 0), 0, 180)
  const mode = fixture.beam.targetMode
  const count = mode === 'fan'
    ? clamp(requestedDemand, 1, LASER_DMX_SHOW_DIRECTOR_MAX_BEAM_TARGETS)
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
      : legacyPatternTargets(fixture, columns, rows, requestedDemand)
  const selectedIndices = selectDeterministicLaserDmxRayIndices(candidates.length, allocatedDemand)
  return selectedIndices.map(index => candidates[index]).filter((target): target is LaserDmxSceneTargetSeed => target != null)
}

function colorFromHex(value: string, fallback: string): LaserDmxSceneColor {
  return parseLaserDmxSrgbHex(value, fallback)
}

function colorFromMatrix(
  color: LaserDmxMatrixBeamColor | undefined,
  fallback: LaserDmxSceneColor,
  fixtureKind: LaserDmxShowDirectorFixtureKind,
): LaserDmxSceneColor {
  if (!color) return fallback
  const calibrated = calibrateLaserDmxChannels({
    red: finite(color.red, 0),
    green: finite(color.green, 0),
    blue: finite(color.blue, 0),
    white: finite(color.white, 0),
  }, resolveLaserDmxFixtureCalibration(fixtureKind))
  return { ...calibrated, a: clamp01(finite(color.alpha, fallback.a)) }
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
  const fixtures = input.showDirector.fixtures.map(fixture => (
    fixture.runtimeOutputGate?.open === false ? { ...fixture, enabled: false } : fixture
  ))
  if (input.fixturePriorityById || input.fixturePriorityRoleById) {
    const report = createLaserDmxShowDirectorBeamBudgetReport(
      fixtures,
      input.fixturePriorityRoleById ?? {},
      LASER_DMX_MATRIX_MAX_BEAMS,
      input.showDirector.settings.webglQuality,
    )
    return new Map(report.fixtures.map(item => [item.fixtureId, item.allocatedDemand]))
  }

  // Static/authored compilation preserves the repository's legacy fixture order.
  // Performance Shows supply priority maps and therefore use the role-aware path.
  let remaining = LASER_DMX_MATRIX_MAX_BEAMS
  return new Map(fixtures.map(fixture => {
    const demand = estimateLaserDmxShowDirectorFixtureBeamDemand(fixture, {
      quality: input.showDirector.settings.webglQuality,
      role: input.fixturePriorityRoleById?.[fixture.id],
    })
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
      const averageRayEnergy = sourceBeams.length > 0 ? totalActiveEnergy / sourceBeams.length : 0
      // Dense professional fans should read as a coherent aperture, not as a
      // source whose flare grows without bound with every added ray. A small,
      // capped density lift keeps 16-24 ray banks present while preserving HDR
      // headroom and the authored per-ray beam energy.
      const densityLift = sourceBeams.length > 1
        ? 1 + Math.min(0.28, Math.log2(sourceBeams.length) * 0.055)
        : 1
      const normalizedEnergy = clamp(Math.max(averageRayEnergy, peakRayIntensity * 0.72) * densityLift, 0, 2.5)
      return {
        ...emitter,
        orientation: glareDirection,
        glareDirection,
        activeRayCount: sourceBeams.length,
        totalActiveEnergy,
        peakRayIntensity,
        intensity: normalizedEnergy,
        flareSize: emitter.apertureSize * (0.72 + Math.sqrt(normalizedEnergy) * 0.48),
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
  const finiteCueGates = showDirector.fixtures.map(fixture => fixture.runtimeOutputGate).filter((gate): gate is NonNullable<typeof gate> => Boolean(gate))
  const finiteCueBlackout = finiteCueGates.length > 0 && finiteCueGates.every(gate => !gate.open)
  const blackout = evaluated.output.blackout === true || finiteCueBlackout
  const selected = new Set(showDirector.selectedFixtureIds)
  if (showDirector.selectedFixtureId) selected.add(showDirector.selectedFixtureId)
  const allocations = createFixtureBeamAllocations(input)

  const fixtures: LaserDmxSceneFixture[] = []
  const targets: LaserDmxSceneTarget[] = []
  const scannerHeads: LaserDmxScannerHead[] = []
  const scanPaths: LaserDmxScanPath[] = []
  const opticalCopies: LaserDmxScannerOpticalCopy[] = []
  const scannerOriginByFixtureId = new Map<string, LaserDmxSceneVec3>()
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
    const fixtureEnabled = fixture.enabled && fixture.runtimeOutputGate?.open !== false
    const intensity = fixtureEnabled ? clamp01(fixture.brightness) : 0
    const xy = normalizedStagePoint(fixture, columns, rows)
    const fixtureDepth = resolveLaserDmxFixtureDepth(fixture, xy.y)
    const position: LaserDmxSceneVec3 = { ...xy, z: fixtureDepth.z }
    const color = authoredColor
    if (fixture.kind === 'laser' && fixtureEnabled) scannerOriginByFixtureId.set(fixture.id, position)
    const allocatedDemand = allocations.get(fixture.id) ?? 0
    const requestedDemand = estimateLaserDmxShowDirectorFixtureBeamDemand(fixture, {
      quality: showDirector.settings.webglQuality,
      role: input.fixturePriorityRoleById?.[fixture.id],
    })
    const targetSeeds = fixtureEnabled
      ? targetsForFixture(fixture, columns, rows, allocatedDemand, requestedDemand, input)
      : []
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
    const macroPlan = fixture.kind === 'laser'
      && fixture.runtimeScanner?.authoritativeSource === 'macro'
      && fixture.runtimeScanner.macroPlan?.authoritative
      ? fixture.runtimeScanner.macroPlan
      : null
    const authoredScanner = fixture.kind === 'laser' && fixture.scanner && !macroPlan
      ? applyLaserDmxScannerRuntimeOverrides(fixture.scanner, fixture.runtimeScanner, {
        fixture,
        bounds: { columns, rows },
      })
      : null
    const authoredScannerTargets = fixtureEnabled ? authoredScanner?.path.points.map((point, pointIndex) => {
      const targetXy = normalizedStagePoint(point, columns, rows)
      const targetDepth = resolveLaserDmxTargetDepth({
        fixture,
        target: {
          id: point.id,
          x: point.x,
          y: point.y,
          ...(point.z == null ? {} : { z: point.z }),
          depthLayer: point.depthLayer ?? authoredScanner.depthLayer,
        },
        targetIndex: pointIndex,
        origin: position,
        normalizedTarget: targetXy,
      })
      return {
        id: point.id,
        position: { ...targetXy, z: targetDepth.z },
        blanked: point.blanked,
        dwellMicros: point.dwellMicros,
        cornerDwellMicros: point.cornerDwellMicros,
        intensity: point.intensity,
        color: point.color ? colorFromHex(point.color, fixture.color) : color,
        sourceTargetId: point.id,
      }
    }) ?? [] : []
    const authoredScannerDemand = clamp(
      Math.max(fixture.beam.targets?.length ?? 0, fixture.optics.rayCount, 1),
      1,
      LASER_DMX_SHOW_DIRECTOR_MAX_BEAM_TARGETS,
    )
    const scannerTargetSeeds = fixtureEnabled && fixture.kind === 'laser' && !authoredScanner && !macroPlan
      ? targetsForFixture(fixture, columns, rows, authoredScannerDemand, authoredScannerDemand, input)
      : []
    const scannerTargets = scannerTargetSeeds.map(seed => {
      const targetXy = normalizedStagePoint(seed, columns, rows)
      const targetDepth = resolveLaserDmxTargetDepth({
        fixture,
        target: seed,
        targetIndex: seed.rayIndex,
        origin: position,
        normalizedTarget: targetXy,
      })
      return {
        id: seed.id,
        position: { ...targetXy, z: targetDepth.z },
      }
    })
    if (fixture.kind === 'laser' && fixtureEnabled && fixture.beam.beamEnabled) {
      const scannerPlan = macroPlan
        ? createLaserDmxMacroScannerPlan({
          fixture,
          macro: macroPlan,
          origin: position,
          primitiveType: resolveLaserDmxOpticalPrimitiveType(fixture),
          color,
        })
        : authoredScanner && authoredScannerTargets.length > 0
        ? createLaserDmxAuthoredScannerPlan({
          fixture,
          scanner: authoredScanner,
          origin: position,
          points: authoredScannerTargets,
          primitiveType: resolveLaserDmxOpticalPrimitiveType(fixture),
          color,
          occurrenceSeed: Math.max(0, Math.floor(finite(input.occurrenceSeed, 0))),
        })
        : scannerTargets.length > 0
          ? createLaserDmxLegacyScannerPlan({
            fixture,
            origin: position,
            targets: scannerTargets,
            primitiveType: resolveLaserDmxOpticalPrimitiveType(fixture),
            color,
            shutterExposureSeconds: (1 / 60) * (0.35 + clamp01(evaluated.output.beamPersistence) * 0.9),
            occurrenceSeed: Math.max(0, Math.floor(finite(input.occurrenceSeed, 0))),
          })
          : { heads: [], paths: [], opticalCopies: [] }
      scannerHeads.push(...scannerPlan.heads)
      scanPaths.push(...scannerPlan.paths)
      opticalCopies.push(...scannerPlan.opticalCopies)
    }
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
      // Fixture-specific strobe authoring stores rate in Hz (0-30), while the
      // scene/Beam Matrix runtime uses a normalized 0-1 strobe domain. Other
      // fixture kinds carry the shared component shape but do not own this field.
      strobeRate: fixture.kind === 'strobe' ? clamp01(fixture.component.strobeRate / 30) : 0,
      beamEnabled: fixture.beam.beamEnabled,
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
  const scannerExposure = solveLaserDmxScannerExposure({
    heads: scannerHeads,
    paths: scanPaths,
    opticalCopies,
    originByFixtureId: scannerOriginByFixtureId,
    audioTimeSec: Math.max(0, finite(input.audioTimeSec, 0)),
    bpm: Math.max(0, finite(input.bpm, 0)),
    quality: showDirector.settings.webglQuality,
  })
  const exposureAggregation = aggregateLaserDmxScannerExposureSamples({
    samples: scannerExposure.exposureSamples,
    paths: scanPaths,
  })
  const scannerDiagnostics = createLaserDmxScannerDiagnostics({
    heads: scannerHeads,
    paths: scanPaths,
    opticalCopies,
    exposureSamples: exposureAggregation.exposureSamples,
    blankedSampleCount: scannerExposure.blankedSampleCount,
    selectedFixtureIds: selected,
    exposureAggregation: exposureAggregation.diagnostics,
  })
  const scannerHistoryReset = scanPaths.some(path => path.clearTemporalHistory)
    || showDirector.fixtures.some(fixture => fixture.runtimeOutputGate?.clearTemporalHistory === true && fixture.runtimeOutputGate.open === false)
  const timingDiscontinuity = input.timingDiscontinuity || scannerHistoryReset
  const transientEvents = createSceneTransientEvents({
    timestamp: Math.max(0, finite(input.audioTimeSec, 0)),
    timingDiscontinuity,
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
      timingDiscontinuity,
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
    scannerHeads,
    scanPaths,
    scannerInstantaneousRays: scannerExposure.instantaneousRays,
    exposureSamples: exposureAggregation.exposureSamples,
    exposureAggregation: exposureAggregation.diagnostics,
    opticalCopies,
    legacyCompatibilityBeamIds: energized.beams
      .filter(beam => beam.fixtureKind === 'laser')
      .map(beam => beam.id),
    scannerDiagnostics,
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
      safetyClamp: clamp01(evaluated.output.safetyClamp),
      globalGlow: clamp01(evaluated.output.globalGlow),
      globalBeamWidth: clamp(evaluated.output.globalBeamWidth, 0.1, 6),
      globalStrobeRate: clamp01(evaluated.output.globalStrobeRate),
      beamPersistence: clamp01(evaluated.output.beamPersistence),
    },
  }
}


export interface LaserDmxCompiledSceneOutputInput {
  compiled: CompiledLaserDmxBeamMatrixResult
  canvasWidth: number
  canvasHeight: number
}

interface LaserDmxCompiledBeamPair {
  matrixBeam: LaserDmxMatrixBeam
  compiledBeam: CompiledLaserDmxMatrixBeam | null
}

interface LaserDmxCompiledGeometryDelta {
  origin: LaserDmxSceneVec3
  target: LaserDmxSceneVec3
}

function colorFromCompiledBeam(
  beam: CompiledLaserDmxMatrixBeam | undefined,
  fallback: LaserDmxSceneColor,
  fixtureKind: LaserDmxShowDirectorFixtureKind,
): LaserDmxSceneColor {
  if (!beam) return fallback
  const calibrated = calibrateLaserDmxChannels({
    red: finite(beam.rgba.r, 0),
    green: finite(beam.rgba.g, 0),
    blue: finite(beam.rgba.b, 0),
    white: 0,
  }, resolveLaserDmxFixtureCalibration(fixtureKind))
  return { ...calibrated, a: clamp01(finite(beam.rgba.a, fallback.a)) }
}

function compiledGeometryDelta(
  matrixBeam: LaserDmxMatrixBeam,
  compiledBeam: CompiledLaserDmxMatrixBeam,
  canvasWidth: number,
  canvasHeight: number,
): LaserDmxCompiledGeometryDelta {
  const width = Math.max(1, finite(canvasWidth, 1))
  const height = Math.max(1, finite(canvasHeight, 1))
  const baseOrigin = gridAnchorToCanvas(
    matrixBeam.origin.column,
    matrixBeam.origin.row,
    matrixBeam.origin.z,
    width,
    height,
  )
  const baseTarget = targetToCanvas(matrixBeam.target, width, height)
  return {
    origin: {
      x: (compiledBeam.origin.x - baseOrigin.x) / width,
      y: (compiledBeam.origin.y - baseOrigin.y) / height,
      z: compiledBeam.origin.z - baseOrigin.z,
    },
    target: {
      x: (compiledBeam.target.x - baseTarget.x) / width,
      y: (compiledBeam.target.y - baseTarget.y) / height,
      z: compiledBeam.target.z - baseTarget.z,
    },
  }
}

function addSceneDelta(point: LaserDmxSceneVec3, delta: LaserDmxSceneVec3): LaserDmxSceneVec3 {
  return {
    x: point.x + delta.x,
    y: point.y + delta.y,
    z: point.z + delta.z,
  }
}

function compiledLocalBeamWidth(
  matrixBeam: LaserDmxMatrixBeam,
  compiledBeam: CompiledLaserDmxMatrixBeam,
  compiled: CompiledLaserDmxBeamMatrixResult,
): number {
  const globalWidth = clamp(compiled.output.globalBeamWidth, 0.1, 6)
  const originScale = zDepthFactors(matrixBeam.origin.z).widthScale
  const targetScale = zDepthFactors(matrixBeam.target.z).widthScale
  const matrixDepthScale = Math.max(0.001, (originScale + targetScale) * 0.5)
  return clamp(compiledBeam.beamWidth / (globalWidth * matrixDepthScale), 0.1, 8)
}

function compiledLocalGlow(
  compiledBeam: CompiledLaserDmxMatrixBeam,
  compiled: CompiledLaserDmxBeamMatrixResult,
): number {
  const globalGlow = clamp01(compiled.output.globalGlow)
  return globalGlow > 0.001 ? clamp01(compiledBeam.glow / globalGlow) : 0
}

export function resolveLaserDmxSceneFrameOutput(
  frame: LaserDmxSceneFrame,
  evaluated: LaserDmxBeamMatrixSettings,
  compiledInput?: LaserDmxCompiledSceneOutputInput,
): LaserDmxSceneFrame {
  const compiled = compiledInput?.compiled ?? null
  const resolvedOutput = compiled?.output ?? evaluated.output
  const resolvedFog = compiled?.fog ?? evaluated.fog
  const masterDimmer = clamp01(resolvedOutput.masterDimmer)
  const safetyClamp = clamp01(resolvedOutput.safetyClamp)
  // Compiled beam intensity already contains authored master dimmer + safety.
  // The settings-only compatibility path still needs to apply those here.
  const settingsOutputDimmer = masterDimmer * safetyClamp
  const blackout = resolvedOutput.blackout === true
  const matrixByFixture = new Map<string, ReturnType<typeof matrixBeamsForFixture>>()
  const compiledById = new Map<string, CompiledLaserDmxMatrixBeam>()
  for (const beam of compiled?.beams ?? []) compiledById.set(beam.beamId, beam)

  const pairsByFixture = new Map<string, LaserDmxCompiledBeamPair[]>()
  const geometryDeltaByFixture = new Map<string, LaserDmxCompiledGeometryDelta>()
  for (const fixture of frame.fixtures) {
    const matrixBeams = matrixBeamsForFixture(evaluated, fixture.id)
    matrixByFixture.set(fixture.id, matrixBeams)
    if (!compiled) continue
    const pairs = matrixBeams.map(matrixBeam => ({
      matrixBeam,
      compiledBeam: compiledById.get(matrixBeam.id) ?? null,
    }))
    pairsByFixture.set(fixture.id, pairs)
    const geometryPair = pairs.find(pair => pair.compiledBeam != null)
    if (geometryPair?.compiledBeam && compiledInput) {
      geometryDeltaByFixture.set(fixture.id, compiledGeometryDelta(
        geometryPair.matrixBeam,
        geometryPair.compiledBeam,
        compiledInput.canvasWidth,
        compiledInput.canvasHeight,
      ))
    }
  }

  const fixtures = frame.fixtures.map(fixture => {
    const matrixBeams = matrixByFixture.get(fixture.id) ?? []
    const compiledPairs = pairsByFixture.get(fixture.id) ?? []
    const compiledBeams = compiledPairs
      .map(pair => pair.compiledBeam)
      .filter((beam): beam is CompiledLaserDmxMatrixBeam => beam != null)
    const visibleCompiledBeams = compiledBeams.filter(beam => beam.strobeVisible && beam.intensity > 0.001)
    const strongestCompiledBeam = visibleCompiledBeams.reduce<CompiledLaserDmxMatrixBeam | undefined>(
      (strongest, beam) => !strongest || beam.intensity > strongest.intensity ? beam : strongest,
      undefined,
    )
    const matrixDriven = BEAM_FIXTURE_KINDS.has(fixture.kind)

    if (compiled && matrixDriven) {
      const intensity = visibleCompiledBeams.reduce(
        (maximum, beam) => Math.max(maximum, clamp01(beam.intensity)),
        0,
      )
      const strobeRate = compiledBeams.reduce(
        (maximum, beam) => Math.max(maximum, clamp01(beam.strobeRate)),
        fixture.strobeRate,
      )
      const enabled = fixture.enabled
        && fixture.beamEnabled
        && !blackout
        && visibleCompiledBeams.length > 0
      return {
        ...fixture,
        color: colorFromCompiledBeam(strongestCompiledBeam ?? compiledBeams[0], fixture.color, fixture.kind),
        strobeRate,
        enabled,
        intensity: enabled ? intensity : 0,
      }
    }

    const matrixIntensity = matrixBeams.length > 0
      ? Math.max(...matrixBeams.map(beam => clamp01(beam.appearance.dimmer)))
      : fixture.intensity
    const color = colorFromMatrix(matrixBeams.find(beam => beam.enabled)?.color, fixture.color, fixture.kind)
    const matrixStrobeRate = matrixBeams.reduce(
      (maximum, beam) => Math.max(maximum, clamp01(beam.appearance.strobeRate)),
      0,
    )
    return {
      ...fixture,
      color,
      strobeRate: Math.max(fixture.strobeRate, matrixStrobeRate),
      enabled: fixture.enabled && !blackout,
      intensity: fixture.enabled && !blackout ? clamp01(matrixIntensity * settingsOutputDimmer) : 0,
    }
  })
  const fixtureById = new Map(fixtures.map(fixture => [fixture.id, fixture]))
  const originalFixtureById = new Map(frame.fixtures.map(fixture => [fixture.id, fixture]))
  const beamIndexByFixture = new Map<string, number>()
  const beams = frame.beams.map(beam => {
    const matrixBeams = matrixByFixture.get(beam.fixtureId) ?? []
    const index = beamIndexByFixture.get(beam.fixtureId) ?? 0
    beamIndexByFixture.set(beam.fixtureId, index + 1)
    const matrixBeam = matrixBeams[index] ?? matrixBeams[0]
    const compiledBeam = matrixBeam ? compiledById.get(matrixBeam.id) : undefined
    const fixture = fixtureById.get(beam.fixtureId)

    const enabled = compiled
      ? Boolean(
          fixture?.enabled
          && compiledBeam
          && compiledBeam.strobeVisible
          && compiledBeam.intensity > 0.001,
        )
      : Boolean(
          fixture?.enabled
          && (matrixBeam?.enabled ?? beam.enabled)
          && (matrixBeam?.appearance.shutterOpen ?? true),
        )
    const intensity = compiled
      ? enabled ? clamp01(compiledBeam?.intensity ?? 0) : 0
      : enabled ? clamp01((matrixBeam?.appearance.dimmer ?? beam.intensity) * settingsOutputDimmer) : 0
    const focus = clamp01(compiledBeam?.focus ?? matrixBeam?.appearance.focus ?? beam.focus)
    const visualRole = compiledBeam?.visualRole ?? matrixBeam?.visualRole ?? beam.visualRole
    const color = compiledBeam
      ? colorFromCompiledBeam(compiledBeam, fixture?.color ?? beam.color, beam.fixtureKind)
      : colorFromMatrix(matrixBeam?.color, fixture?.color ?? beam.color, beam.fixtureKind)

    let origin = beam.origin
    let target = beam.target
    if (compiled && matrixBeam && compiledBeam && compiledInput) {
      const delta = compiledGeometryDelta(
        matrixBeam,
        compiledBeam,
        compiledInput.canvasWidth,
        compiledInput.canvasHeight,
      )
      origin = addSceneDelta(beam.origin, delta.origin)
      target = addSceneDelta(beam.target, delta.target)
    }
    const direction = normalizeLaserDmxDirection(origin, target)
    const depthRange = resolveLaserDmxDepthRange(origin, target)
    const localWidth = compiled && matrixBeam && compiledBeam
      ? compiledLocalBeamWidth(matrixBeam, compiledBeam, compiled)
      : matrixBeam?.appearance.width ?? beam.width
    const localGlow = compiled && compiledBeam
      ? compiledLocalGlow(compiledBeam, compiled)
      : matrixBeam?.appearance.glow ?? Math.min(1, beam.scatterEnvelopeWidth / 6)
    const optical = resolveLaserDmxBeamOpticalProfile({
      fixtureKind: beam.fixtureKind,
      intensity,
      focus,
      spreadDeg: beam.spreadDeg,
      width: localWidth,
      divergence: compiledBeam?.divergence ?? matrixBeam?.appearance.divergence ?? beam.divergence,
      glow: localGlow,
      opacity: color.a,
      opticalSoftness: fixture?.optics.opticalSoftness,
      zoom: fixture?.optics.zoom,
      iris: fixture?.optics.iris,
      frost: fixture?.optics.frost,
      visualRole,
    })
    return {
      ...beam,
      id: compiledBeam?.beamId ?? matrixBeam?.id ?? beam.id,
      origin,
      target,
      direction,
      length: Math.hypot(
        target.x - origin.x,
        target.y - origin.y,
        target.z - origin.z,
      ),
      startDepth: origin.z,
      endDepth: target.z,
      depthRange,
      sortDepth: laserDmxDepthSortValue(origin, target),
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

  const targetPositionById = new Map<string, LaserDmxSceneVec3>()
  for (const beam of beams) targetPositionById.set(beam.targetId, beam.target)
  const targets = frame.targets.map(target => {
    const fromBeam = targetPositionById.get(target.id)
    if (fromBeam) return { ...target, position: fromBeam }
    const delta = geometryDeltaByFixture.get(target.fixtureId)
    return delta ? { ...target, position: addSceneDelta(target.position, delta.target) } : target
  })

  const emitters = frame.emitters.map(emitter => {
    const fixture = fixtureById.get(emitter.fixtureId)
    return {
      ...emitter,
      color: fixture?.color ?? emitter.color,
    }
  })

  const resolveScannerOutput = <T extends LaserDmxScannerInstantaneousRay | LaserDmxExposureSample>(sample: T): T => {
    const fixture = fixtureById.get(sample.fixtureId)
    const originalFixture = originalFixtureById.get(sample.fixtureId)
    const intensityRatio = originalFixture && originalFixture.intensity > 0.001
      ? clamp01((fixture?.intensity ?? 0) / originalFixture.intensity)
      : 0
    const delta = geometryDeltaByFixture.get(sample.fixtureId)
    return {
      ...sample,
      origin: delta ? addSceneDelta(sample.origin, delta.origin) : sample.origin,
      targetOrDirection: delta ? addSceneDelta(sample.targetOrDirection, delta.target) : sample.targetOrDirection,
      color: fixture?.color ?? sample.color,
      intensity: fixture?.enabled && !sample.blanked
        ? clamp01(sample.intensity * intensityRatio)
        : 0,
      blanked: sample.blanked || !fixture?.enabled,
    }
  }
  const scannerInstantaneousRays = frame.scannerInstantaneousRays.map(resolveScannerOutput)
  const exposureSamples = frame.exposureSamples.map(resolveScannerOutput)
  const scanPaths = frame.scanPaths.map(path => {
    const delta = geometryDeltaByFixture.get(path.fixtureId)
    if (!delta) return path
    return {
      ...path,
      points: path.points.map(point => ({
        ...point,
        position: addSceneDelta(point.position, delta.target),
      })),
      intendedRaySlots: path.intendedRaySlots?.map(slot => ({
        ...slot,
        target: addSceneDelta(slot.target, delta.target),
      })),
    }
  })

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
        ? clamp01(resolvedFog.dissipation * (0.55 + (1 - hazeRatio) * 0.45))
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
    globalStrobeRate: resolvedOutput.globalStrobeRate,
  })

  return {
    ...frame,
    atmosphere: {
      ...sceneAtmosphereFromFog(
        resolvedFog,
        frame.atmosphere.qualityTier,
        frame.transport.trackKey,
        energized.beams.some(beam => beam.enabled && beam.intensity > 0.001),
      ),
      deterministicSeed: frame.atmosphere.deterministicSeed,
    },
    depthOrdering: {
      ...frame.depthOrdering,
      bounds: depthBounds(fixtures, targets),
      frontToBackBeamIds: stableLaserDmxDepthOrder(energized.beams, 'frontToBack'),
      backToFrontBeamIds: stableLaserDmxDepthOrder(energized.beams, 'backToFront'),
    },
    fixtures,
    targets,
    scanPaths,
    scannerInstantaneousRays,
    exposureSamples,
    beams: energized.beams,
    emitters: energized.emitters,
    atmosphereSources,
    transientEvents,
    output: {
      blackout,
      masterDimmer,
      safetyClamp,
      globalGlow: clamp01(resolvedOutput.globalGlow),
      globalBeamWidth: clamp(resolvedOutput.globalBeamWidth, 0.1, 6),
      globalStrobeRate: clamp01(resolvedOutput.globalStrobeRate),
      beamPersistence: clamp01(resolvedOutput.beamPersistence),
    },
  }
}
