import type {
  LaserDmxMatrixBeamVisualRole,
  LaserDmxShowDirectorWebGLQuality,
  ReactSectionType,
} from '../../ReactTypes'
import type {
  LaserDmxSceneBeam,
  LaserDmxSceneFrame,
  LaserDmxSceneVec3,
} from './LaserDmxSceneFrame'

export type LaserDmxTemporalClearReason =
  | 'initialMount'
  | 'timingDiscontinuity'
  | 'identityChange'
  | 'qualityChange'
  | 'captureEntry'
  | 'scannerTopologyChange'
  | 'blackout'
  | 'strobeDarkPhase'
  | 'manualReset'
  | 'dispose'

export interface LaserDmxTemporalQualityPolicy {
  resolutionScale: number
  maximumRetention: number
  temporalStrength: number
  instabilityLayers: number
}

export interface LaserDmxBeamMotionSample {
  beamId: string
  angularSpeed: number
  targetSpeed: number
  normalizedMotion: number
  persistenceWeight: number
}

export interface LaserDmxTemporalMotionSummary {
  score: number
  peak: number
  average: number
  movingBeamCount: number
  samples: LaserDmxBeamMotionSample[]
}

export interface LaserDmxTemporalHistoryPlan {
  enabled: boolean
  resolutionScale: number
  retention: number
  motionScore: number
  clearHistory: boolean
  clearReason: LaserDmxTemporalClearReason | null
  strobeSegmented: boolean
  historyIdentity: string
}

export interface LaserDmxTemporalFramePlan {
  history: LaserDmxTemporalHistoryPlan
  motion: LaserDmxTemporalMotionSummary
}

export interface LaserDmxBeamInstability {
  angularOffsetRad: number
  intensityMultiplier: number
  widthMultiplier: number
  apertureMultiplier: number
  phaseOffset: number
}

export interface LaserDmxAtmosphereFlutter {
  densityMultiplier: number
  intensityMultiplier: number
  driftMultiplier: number
}

export interface LaserDmxTemporalBeamSnapshot {
  direction: LaserDmxSceneVec3
  target: LaserDmxSceneVec3
  fixtureKind: LaserDmxSceneBeam['fixtureKind']
  visualRole: LaserDmxMatrixBeamVisualRole
  structure: LaserDmxSceneBeam['pattern']['structure']
}

const QUALITY_POLICIES: Readonly<Record<LaserDmxShowDirectorWebGLQuality, LaserDmxTemporalQualityPolicy>> = Object.freeze({
  low: { resolutionScale: 0.46, maximumRetention: 0.26, temporalStrength: 0.56, instabilityLayers: 1 },
  medium: { resolutionScale: 0.66, maximumRetention: 0.32, temporalStrength: 0.68, instabilityLayers: 2 },
  high: { resolutionScale: 0.84, maximumRetention: 0.38, temporalStrength: 0.78, instabilityLayers: 3 },
  ultra: { resolutionScale: 1, maximumRetention: 0.42, temporalStrength: 0.84, instabilityLayers: 4 },
  auto: { resolutionScale: 0.76, maximumRetention: 0.35, temporalStrength: 0.74, instabilityLayers: 3 },
})

function finite(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, finite(value, min)))
}

function clamp01(value: number): number {
  return clamp(value, 0, 1)
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  if (edge0 === edge1) return value >= edge1 ? 1 : 0
  const t = clamp01((value - edge0) / (edge1 - edge0))
  return t * t * (3 - 2 * t)
}

function stableHash(...parts: Array<string | number | null | undefined>): number {
  let hash = 2166136261
  for (const part of parts) {
    const text = String(part ?? '')
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index)
      hash = Math.imul(hash, 16777619)
    }
    hash ^= 124
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function hash01(...parts: Array<string | number | null | undefined>): number {
  return stableHash(...parts) / 0xffffffff
}

function seededWave(seed: number, timeSec: number, frequency: number, phaseOffset = 0): number {
  return Math.sin((timeSec * frequency + phaseOffset + hash01(seed, frequency) * 17.31) * Math.PI * 2)
}

function vectorDistance(a: LaserDmxSceneVec3, b: LaserDmxSceneVec3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
}

function angularDistance(a: LaserDmxSceneVec3, b: LaserDmxSceneVec3): number {
  const aLength = Math.max(1e-6, Math.hypot(a.x, a.y, a.z))
  const bLength = Math.max(1e-6, Math.hypot(b.x, b.y, b.z))
  const dot = clamp((a.x * b.x + a.y * b.y + a.z * b.z) / (aLength * bLength), -1, 1)
  return Math.acos(dot)
}

function roleMotionWeight(role: LaserDmxMatrixBeamVisualRole): number {
  switch (role) {
    case 'hero': return 0.62
    case 'impact': return 0.72
    case 'primary': return 0.76
    case 'secondary': return 0.94
    case 'texture': return 1.08
    default: return 0.8
  }
}

function structureMotionWeight(structure: LaserDmxSceneBeam['pattern']['structure']): number {
  switch (structure) {
    case 'single': return 0.42
    case 'parallelBank': return 0.58
    case 'narrowFan': return 0.74
    case 'wideFan': return 1
    case 'mirroredFan': return 0.9
    case 'crossBank': return 0.88
    case 'layeredFan': return 0.96
    default: return 0.7
  }
}

function fixtureMotionWeight(kind: LaserDmxSceneBeam['fixtureKind']): number {
  if (kind === 'laser') return 1
  if (kind === 'movingHead') return 0.34
  return 0.12
}

function sectionPersistenceWeight(section: ReactSectionType | null): number {
  switch (section) {
    case 'drop': return 1.16
    case 'preDrop': return 1.02
    case 'build': return 0.98
    case 'verse': return 0.8
    case 'breakdown': return 0.52
    case 'intro': return 0.68
    case 'outro': return 0.62
    case 'bridge': return 0.72
    default: return 0.78
  }
}


function resolveEffectiveStrobeRate(frame: LaserDmxSceneFrame): number {
  return frame.fixtures.reduce(
    (maximum, fixture) => fixture.enabled
      ? Math.max(maximum, clamp01(fixture.strobeRate))
      : maximum,
    clamp01(frame.output.globalStrobeRate),
  )
}

function instabilityRoleAmount(role: LaserDmxMatrixBeamVisualRole): number {
  switch (role) {
    case 'hero': return 0.22
    case 'impact': return 0.28
    case 'primary': return 0.38
    case 'secondary': return 0.72
    case 'texture': return 1
    default: return 0.5
  }
}

export function resolveLaserDmxTemporalQualityPolicy(
  quality: LaserDmxShowDirectorWebGLQuality,
): LaserDmxTemporalQualityPolicy {
  return QUALITY_POLICIES[quality]
}

export function resolveLaserDmxTemporalTargetSize(
  backingWidth: number,
  backingHeight: number,
  quality: LaserDmxShowDirectorWebGLQuality,
): { width: number; height: number } {
  const policy = resolveLaserDmxTemporalQualityPolicy(quality)
  return {
    width: Math.max(32, Math.round(Math.max(1, backingWidth) * policy.resolutionScale)),
    height: Math.max(18, Math.round(Math.max(1, backingHeight) * policy.resolutionScale)),
  }
}

export function resolveLaserDmxInstabilityGroupKey(semanticKey: string, fallbackId: string): {
  key: string
  mirrorSign: number
} {
  const raw = (semanticKey || fallbackId || 'fixture').trim().toLowerCase()
  const left = /(^|[-_\s])(left|lhs|stageleft|l)(?=$|[-_\s])/.test(raw)
  const right = /(^|[-_\s])(right|rhs|stageright|r)(?=$|[-_\s])/.test(raw)
  const key = raw
    .replace(/(^|[-_\s])(left|right|lhs|rhs|stageleft|stageright|l|r)(?=$|[-_\s])/g, '$1side')
    .replace(/[-_\s]+/g, '-')
    .replace(/^-|-$/g, '')
  return { key: key || fallbackId || 'fixture', mirrorSign: left ? -1 : right ? 1 : 1 }
}

function beatEnvelope(frame: LaserDmxSceneFrame): number {
  const phase = clamp01(frame.musicalState.beatPhase)
  const deterministicPulse = Math.exp(-phase * 8.5)
  return clamp01(Math.max(frame.musicalState.beatHit ? 1 : 0, deterministicPulse))
}

export function resolveLaserDmxBeamInstability(
  frame: LaserDmxSceneFrame,
  beam: LaserDmxSceneBeam,
  fixtureSemanticKey: string,
): LaserDmxBeamInstability {
  const policy = resolveLaserDmxTemporalQualityPolicy(frame.quality.qualityTier)
  const relationship = resolveLaserDmxInstabilityGroupKey(fixtureSemanticKey, beam.fixtureId)
  const groupSeed = stableHash(
    frame.transport.trackKey,
    frame.transport.historyIdentity,
    frame.transport.occurrenceSeed,
    relationship.key,
  )
  const raySeed = stableHash(groupSeed, beam.pattern.rayIndex, beam.id)
  const timeSec = Math.max(0, finite(frame.transport.audioTimeSec))
  const roleAmount = instabilityRoleAmount(beam.visualRole)
  const layerScale = 0.72 + policy.instabilityLayers * 0.09
  const sectionScale = frame.musicalState.section === 'breakdown' ? 0.62 : frame.musicalState.section === 'drop' ? 1.06 : 0.84

  let groupWave = seededWave(groupSeed, timeSec, 1.72, 0.13)
  let rayWave = seededWave(raySeed, timeSec, 4.43, beam.pattern.phase)
  let flutterWave = seededWave(raySeed, timeSec, 7.21, 0.41)
  if (policy.instabilityLayers >= 3) {
    groupWave = groupWave * 0.78 + seededWave(groupSeed, timeSec, 0.41, 0.73) * 0.22
    rayWave = rayWave * 0.74 + seededWave(raySeed, timeSec, 9.37, 0.19) * 0.26
  }
  if (policy.instabilityLayers >= 4) {
    flutterWave = flutterWave * 0.8 + seededWave(raySeed, timeSec, 13.17, 0.37) * 0.2
  }

  const angularAmplitude = 0.00165 * roleAmount * layerScale * sectionScale
  const angularOffsetRad = (
    groupWave * relationship.mirrorSign * 0.72
    + rayWave * 0.28
  ) * angularAmplitude

  const beat = beatEnvelope(frame)
  const kickLift = (beam.visualRole === 'hero' || beam.visualRole === 'primary')
    ? frame.musicalState.kickStrength * 0.055
    : frame.musicalState.kickStrength * 0.012
  const snareLift = beam.visualRole === 'secondary'
    ? frame.musicalState.snareStrength * 0.038
    : 0
  const hatLift = beam.visualRole === 'texture'
    ? frame.musicalState.hatStrength * 0.032
    : 0
  const flutterAmount = (0.004 + roleAmount * 0.014) * layerScale
  const intensityMultiplier = clamp(
    1 + flutterWave * flutterAmount + beat * 0.009 + kickLift + snareLift + hatLift,
    0.94,
    1.1,
  )
  const widthMultiplier = clamp(
    1 + seededWave(raySeed, timeSec, 2.63, 0.57) * (0.003 + roleAmount * 0.011) * layerScale,
    0.976,
    1.024,
  )
  const apertureMultiplier = clamp(
    1
      + seededWave(groupSeed, timeSec, 2.13, 0.29) * (0.006 + roleAmount * 0.012)
      + beat * 0.012
      + frame.musicalState.kickStrength * 0.048,
    0.96,
    1.1,
  )
  const phaseOffset = clamp(rayWave * 0.012 + beam.pattern.spacingT * 0.006, -0.02, 0.02)

  return {
    angularOffsetRad,
    intensityMultiplier,
    widthMultiplier,
    apertureMultiplier,
    phaseOffset,
  }
}

export function resolveLaserDmxAtmosphereFlutter(frame: LaserDmxSceneFrame): LaserDmxAtmosphereFlutter {
  const policy = resolveLaserDmxTemporalQualityPolicy(frame.quality.qualityTier)
  const seed = stableHash(
    frame.transport.trackKey,
    frame.transport.historyIdentity,
    frame.transport.occurrenceSeed,
    frame.atmosphere.deterministicSeed,
    'haze-flutter',
  )
  const timeSec = Math.max(0, finite(frame.transport.audioTimeSec))
  const slow = seededWave(seed, timeSec, 0.19, 0.31)
  const medium = policy.instabilityLayers >= 2 ? seededWave(seed, timeSec, 0.63, 0.67) : 0
  const fine = policy.instabilityLayers >= 3 ? seededWave(seed, timeSec, 1.37, 0.11) : 0
  const sectionAmount = frame.musicalState.section === 'breakdown' ? 0.58 : frame.musicalState.section === 'drop' ? 1 : 0.76
  const wave = slow * 0.62 + medium * 0.28 + fine * 0.1
  const amount = (0.009 + policy.instabilityLayers * 0.0035) * sectionAmount
  return {
    densityMultiplier: clamp(1 + wave * amount, 0.972, 1.028),
    intensityMultiplier: clamp(1 + wave * amount * 0.8, 0.978, 1.022),
    driftMultiplier: clamp(1 + slow * amount * 1.4, 0.965, 1.035),
  }
}

export function measureLaserDmxTemporalMotion(
  frame: LaserDmxSceneFrame,
  previous: ReadonlyMap<string, LaserDmxTemporalBeamSnapshot>,
): LaserDmxTemporalMotionSummary {
  const deltaTimeSec = clamp(frame.transport.deltaTimeSec, 1 / 240, 0.1)
  const samples: LaserDmxBeamMotionSample[] = []
  let weightedTotal = 0
  let totalWeight = 0
  let peak = 0

  for (const beam of frame.beams) {
    if (!beam.enabled || beam.intensity <= 0.001) continue
    const before = previous.get(beam.id)
    if (!before) continue
    const angularSpeed = angularDistance(before.direction, beam.direction) / deltaTimeSec
    const targetSpeed = vectorDistance(before.target, beam.target) / deltaTimeSec
    const rawMotion = clamp01(targetSpeed * 0.72 + angularSpeed * 0.16)
    const persistenceWeight = fixtureMotionWeight(beam.fixtureKind)
      * roleMotionWeight(beam.visualRole)
      * structureMotionWeight(beam.pattern.structure)
    const normalizedMotion = clamp01(rawMotion * persistenceWeight)
    samples.push({
      beamId: beam.id,
      angularSpeed,
      targetSpeed,
      normalizedMotion,
      persistenceWeight,
    })
    weightedTotal += normalizedMotion * Math.max(0.05, persistenceWeight)
    totalWeight += Math.max(0.05, persistenceWeight)
    peak = Math.max(peak, normalizedMotion)
  }

  const visibleScannerSamples = frame.exposureSamples.filter(sample => !sample.blanked && sample.intensity > 0.001)
  if (visibleScannerSamples.length > 0) {
    const byHead = new Map<string, typeof visibleScannerSamples>()
    for (const sample of visibleScannerSamples) {
      const group = byHead.get(sample.scannerHeadId) ?? []
      group.push(sample)
      byHead.set(sample.scannerHeadId, group)
    }
    for (const [headId, headSamples] of byHead) {
      const averageVelocity = headSamples.reduce((sum, sample) => sum + clamp01(sample.velocityRatio), 0) / headSamples.length
      const normalizedMotion = clamp01(averageVelocity * 0.72)
      const persistenceWeight = 0.58
      samples.push({
        beamId: `scanner:${headId}`,
        angularSpeed: averageVelocity,
        targetSpeed: averageVelocity,
        normalizedMotion,
        persistenceWeight,
      })
      weightedTotal += normalizedMotion * persistenceWeight
      totalWeight += persistenceWeight
      peak = Math.max(peak, normalizedMotion)
    }
  }

  const average = totalWeight > 0 ? weightedTotal / totalWeight : 0
  return {
    score: clamp01(peak * 0.68 + average * 0.32),
    peak,
    average,
    movingBeamCount: samples.filter(sample => sample.normalizedMotion > 0.015).length,
    samples,
  }
}

export function resolveLaserDmxTemporalHistoryPlan(
  frame: LaserDmxSceneFrame,
  motion: LaserDmxTemporalMotionSummary,
  input: {
    clearReason: LaserDmxTemporalClearReason | null
    historyAvailable: boolean
    strobeVisible: boolean
  },
): LaserDmxTemporalHistoryPlan {
  const policy = resolveLaserDmxTemporalQualityPolicy(frame.quality.qualityTier)
  const clearHistory = input.clearReason != null
  const strobeRate = resolveEffectiveStrobeRate(frame)
  const movement = smoothstep(0.012, 0.72, motion.score)
  const authoredPersistence = clamp01(frame.output.beamPersistence)
  const energy = clamp01(frame.musicalState.energy)
  const sectionWeight = sectionPersistenceWeight(frame.musicalState.section)
  const beatLift = beatEnvelope(frame) * 0.008
  const kickLift = frame.musicalState.kickStrength * 0.012
  const hatLift = frame.musicalState.hatStrength * Math.min(0.008, motion.average * 0.02)
  const snareSegmentation = frame.musicalState.snareHit ? 0.64 : 1
  const strobeSegmentation = strobeRate > 0.001 ? (input.strobeVisible ? 0.34 : 0) : 1
  const sensorPersistence = frame.presentationMode === 'capture' ? 0.72 : 1
  const baseRetention = (0.018 + authoredPersistence * 0.24)
    * movement
    * sectionWeight
    * policy.temporalStrength
  const retention = clearHistory
    ? 0
    : clamp(
        (baseRetention + movement * (energy * 0.035 + beatLift + kickLift + hatLift))
          * snareSegmentation
          * strobeSegmentation
          * sensorPersistence,
        0,
        policy.maximumRetention,
      )

  return {
    enabled: input.historyAvailable && retention > 0.015,
    resolutionScale: policy.resolutionScale,
    retention,
    motionScore: motion.score,
    clearHistory,
    clearReason: input.clearReason,
    strobeSegmented: strobeRate > 0.001 || frame.musicalState.snareHit,
    historyIdentity: frame.transport.historyIdentity,
  }
}

function scannerTopologyIdentity(frame: LaserDmxSceneFrame): string {
  return frame.scanPaths
    .map(path => `${path.id}:${path.scannerHeadId}:${path.closed ? 1 : 0}:${path.points.map(point => `${point.position.x.toFixed(5)},${point.position.y.toFixed(5)},${point.position.z.toFixed(5)},${point.blanked ? 1 : 0}`).join(';')}`)
    .sort()
    .join('|')
}

export class LaserDmxTemporalOpticsController {
  private previousBeams = new Map<string, LaserDmxTemporalBeamSnapshot>()
  private lastHistoryIdentity: string | null = null
  private lastQuality: LaserDmxShowDirectorWebGLQuality | null = null
  private lastPresentationMode: LaserDmxSceneFrame['presentationMode'] | null = null
  private lastScannerTopologyIdentity: string | null = null
  private disposed = false

  get isDisposed(): boolean {
    return this.disposed
  }

  update(frame: LaserDmxSceneFrame): LaserDmxTemporalFramePlan {
    if (this.disposed) {
      return {
        motion: { score: 0, peak: 0, average: 0, movingBeamCount: 0, samples: [] },
        history: {
          enabled: false,
          resolutionScale: resolveLaserDmxTemporalQualityPolicy(frame.quality.qualityTier).resolutionScale,
          retention: 0,
          motionScore: 0,
          clearHistory: true,
          clearReason: 'dispose',
          strobeSegmented: false,
          historyIdentity: frame.transport.historyIdentity,
        },
      }
    }

    const topologyIdentity = scannerTopologyIdentity(frame)
    const strobeVisible = frame.transientEvents.some(event => event.kind === 'strobe' && event.strength > 0.001)
    const strobeDarkPhase = resolveEffectiveStrobeRate(frame) > 0.001 && !strobeVisible
    let clearReason: LaserDmxTemporalClearReason | null = null
    if (this.lastHistoryIdentity == null) clearReason = 'initialMount'
    else if (frame.transport.timingDiscontinuity) clearReason = 'timingDiscontinuity'
    else if (frame.transport.historyIdentity !== this.lastHistoryIdentity) clearReason = 'identityChange'
    else if (topologyIdentity !== this.lastScannerTopologyIdentity) clearReason = 'scannerTopologyChange'
    else if (frame.quality.qualityTier !== this.lastQuality) clearReason = 'qualityChange'
    else if (frame.presentationMode === 'capture' && this.lastPresentationMode !== 'capture') clearReason = 'captureEntry'
    if (frame.output.blackout) clearReason = 'blackout'
    else if (strobeDarkPhase) clearReason = 'strobeDarkPhase'

    const hadHistory = this.previousBeams.size > 0 && clearReason == null
    const motion = clearReason == null
      ? measureLaserDmxTemporalMotion(frame, this.previousBeams)
      : { score: 0, peak: 0, average: 0, movingBeamCount: 0, samples: [] }
    const history = resolveLaserDmxTemporalHistoryPlan(frame, motion, {
      clearReason,
      historyAvailable: hadHistory,
      strobeVisible,
    })

    if (clearReason != null) this.previousBeams.clear()
    if (!frame.output.blackout && !strobeDarkPhase) {
      for (const beam of frame.beams) {
        if (!beam.enabled || beam.intensity <= 0.001) continue
        this.previousBeams.set(beam.id, {
          direction: { ...beam.direction },
          target: { ...beam.target },
          fixtureKind: beam.fixtureKind,
          visualRole: beam.visualRole,
          structure: beam.pattern.structure,
        })
      }
      const currentIds = new Set(frame.beams.map(beam => beam.id))
      for (const id of this.previousBeams.keys()) if (!currentIds.has(id)) this.previousBeams.delete(id)
    }

    this.lastHistoryIdentity = frame.transport.historyIdentity
    this.lastQuality = frame.quality.qualityTier
    this.lastPresentationMode = frame.presentationMode
    this.lastScannerTopologyIdentity = topologyIdentity
    return { history, motion }
  }

  reset(_reason: LaserDmxTemporalClearReason = 'manualReset'): void {
    if (this.disposed) return
    this.previousBeams.clear()
    this.lastHistoryIdentity = null
    this.lastQuality = null
    this.lastPresentationMode = null
    this.lastScannerTopologyIdentity = null
  }

  dispose(): void {
    if (this.disposed) return
    this.reset('dispose')
    this.disposed = true
  }
}
