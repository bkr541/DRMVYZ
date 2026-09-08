import {
  AFTERHOURS_PATTERNS,
  AFTERHOURS_PATTERN_CHANGES,
  AFTERHOURS_TRIGGERS,
  type AfterhoursPattern,
  type AfterhoursPatternChange,
  type AfterhoursTrigger,
} from '../../../CinematicWorldSettings'
import type { CinematicFrameContext } from '../../CinematicWorldRenderer'
import type { CinematicNormalizedAudioFrame } from '../CinematicAudioModulation'
import { resolveAfterhoursBeamCount } from './AfterhoursBeamGeometry'
import { getAfterhoursSceneDefinition } from './AfterhoursSceneCatalog'

/**
 * Stage 6 hierarchical show-direction owner for Afterhours.
 *
 * This class consumes only the host-prepared Cinema / Music Intelligence frame.
 * It never performs audio analysis, creates a beat clock, or persists derived
 * state. Scene and structure are reconstructed from absolute musical position;
 * short event envelopes are runtime presentation state only.
 */

export interface AfterhoursAudioIntelligenceSettings {
  readonly pattern: AfterhoursPattern
  readonly patternChange: AfterhoursPatternChange
  readonly trigger: AfterhoursTrigger
  readonly bpmSync: boolean
  readonly masterIntensity: number
  readonly pulseAmount: number
  readonly pulseDecay: number
  readonly motionAmount: number
  readonly blackoutAmount: number
  readonly beamCount: number
  readonly spread: number
  readonly sideLasers: boolean
  readonly topLasers: boolean
}

export interface AfterhoursBankWeights {
  readonly bottom: number
  readonly left: number
  readonly right: number
  readonly top: number
}

export type AfterhoursDensityTier = 'sparse' | 'balanced' | 'dense'
export type AfterhoursSceneScale = 'quiet' | 'vocal' | 'build' | 'drop' | 'section'

export interface AfterhoursAudioIntelligenceState {
  readonly pattern: AfterhoursPattern
  readonly previousPattern: AfterhoursPattern
  readonly variation: number
  readonly previousVariation: number
  readonly transition: number
  readonly blackout: number
  readonly intensity: number
  readonly spread: number
  readonly beamCount: number
  readonly sideLasers: boolean
  readonly topLasers: boolean
  readonly motionPhase: number
  readonly motionAuthority: number
  readonly bankWeights: AfterhoursBankWeights
  readonly densityTier: AfterhoursDensityTier
  readonly sceneScale: AfterhoursSceneScale
  readonly structuralOrdinal: number
  readonly majorOrdinal: number
  readonly kickEnvelope: number
  readonly snareEnvelope: number
  readonly downbeatEnvelope: number
  readonly triggerEnvelope: number
}

type CanonicalClockKey = keyof NonNullable<CinematicFrameContext['canonicalMusic']>['clocks']
type CanonicalImpulseKey = keyof NonNullable<CinematicFrameContext['canonicalMusic']>['impulses']

const CLOCK_TRIGGERS: Partial<Record<AfterhoursTrigger, CanonicalClockKey>> = {
  beat: 'beat',
  beat2: 'beat2',
  beat4: 'beat4',
  bar: 'bar',
  bar4: 'bar4',
  bar8: 'bar8',
  phrase: 'phrase',
}

const IMPULSE_TRIGGERS: Partial<Record<AfterhoursTrigger, CanonicalImpulseKey>> = {
  kick: 'kick',
  snare: 'snare',
  downbeat: 'downbeat',
  drop: 'dropStart',
}

const PATTERN_CLOCKS: Partial<Record<AfterhoursPatternChange, CanonicalClockKey>> = {
  bar: 'bar',
  bar4: 'bar4',
  bar8: 'bar8',
  phrase: 'phrase',
}

const SCENE_POOLS: Readonly<Record<AfterhoursSceneScale | 'verse' | 'breakdown', readonly AfterhoursPattern[]>> = Object.freeze({
  quiet: Object.freeze(['sparseArchitecture', 'wideFan', 'splitWings', 'diamondStar'] as const),
  vocal: Object.freeze(['sparseArchitecture', 'wideFan', 'diamondStar', 'splitWings'] as const),
  build: Object.freeze(['chevronRoof', 'radialCrown', 'crossCanopy', 'diamondStar'] as const),
  drop: Object.freeze(['fullRig', 'radialCrown', 'crossCanopy', 'diamondStar'] as const),
  section: Object.freeze(['wideFan', 'splitWings', 'diamondStar', 'chevronRoof'] as const),
  verse: Object.freeze(['wideFan', 'splitWings', 'sparseArchitecture', 'diamondStar'] as const),
  breakdown: Object.freeze(['sparseArchitecture', 'diamondStar', 'wideFan', 'splitWings'] as const),
})

const MORPH_SEC = 0.5
const MORPH_BEATS = 2
const MIN_MORPH_SEC = 0.18
const MAX_MORPH_SEC = 1.2
const BLACKOUT_RELEASE_HZ = 8
const VARIATION_MODULO = 0x40000000

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min))
}

function clamp01(value: number): number {
  return clamp(value, 0, 1)
}

function hashString(value: string): number {
  let hash = 2166136261 >>> 0
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619) >>> 0
  }
  return hash >>> 0
}

function hashInts(...values: number[]): number {
  let hash = 2166136261 >>> 0
  for (const input of values) {
    let value = Math.trunc(Number.isFinite(input) ? input : 0) >>> 0
    value ^= value >>> 16
    value = Math.imul(value, 0x7feb352d) >>> 0
    value ^= value >>> 15
    value = Math.imul(value, 0x846ca68b) >>> 0
    value ^= value >>> 16
    hash ^= value
    hash = Math.imul(hash, 16777619) >>> 0
  }
  return hash >>> 0
}

function positiveModulo(value: number, modulus: number): number {
  if (modulus <= 0) return 0
  const remainder = value % modulus
  return remainder < 0 ? remainder + modulus : remainder
}

function normalizePattern(value: AfterhoursPattern): AfterhoursPattern {
  return (AFTERHOURS_PATTERNS as readonly string[]).includes(value) ? value : 'wideFan'
}

function normalizePatternChange(value: AfterhoursPatternChange): AfterhoursPatternChange {
  return (AFTERHOURS_PATTERN_CHANGES as readonly string[]).includes(value) ? value : 'off'
}

function normalizeTrigger(value: AfterhoursTrigger): AfterhoursTrigger {
  return (AFTERHOURS_TRIGGERS as readonly string[]).includes(value) ? value : 'beat'
}

function musicalAudio(frame: Readonly<CinematicFrameContext>): Partial<CinematicNormalizedAudioFrame> | undefined {
  return frame.musicalAudio as Partial<CinematicNormalizedAudioFrame> | undefined
}

function normalizedSectionType(frame: Readonly<CinematicFrameContext>): string {
  return String(
    frame.canonicalMusic?.section.type
    ?? musicalAudio(frame)?.section?.type
    ?? frame.section?.type
    ?? 'unknown',
  )
}

function sectionIdentity(frame: Readonly<CinematicFrameContext>, sectionType: string): string {
  const explicit = frame.canonicalMusic?.section.id
  if (explicit) return explicit
  const startSec = Number.isFinite(frame.section?.startSec) ? frame.section.startSec : 0
  return `${sectionType}:${Math.round(startSec * 1000)}`
}

function finiteIndex(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : null
}

function beatIndex(frame: Readonly<CinematicFrameContext>): number | null {
  return finiteIndex(musicalAudio(frame)?.timing?.beatIndex) ?? finiteIndex(frame.beat?.beatIndex)
}

function barIndex(frame: Readonly<CinematicFrameContext>): number | null {
  return finiteIndex(musicalAudio(frame)?.timing?.barIndex) ?? finiteIndex(frame.beat?.barIndex)
}

/**
 * Reconstruct a cadence ordinal from absolute normalized beat/bar position.
 * Canonical clock.index is only the fallback because synthetic harnesses and
 * legacy inputs may not keep that value stable between boundaries.
 */
function cadenceOrdinal(frame: Readonly<CinematicFrameContext>, cadence: CanonicalClockKey): number {
  const beat = beatIndex(frame)
  const bar = barIndex(frame)
  switch (cadence) {
    case 'beat': return beat ?? finiteIndex(frame.canonicalMusic?.clocks.beat.index) ?? 0
    case 'beat2': return beat != null ? Math.floor(beat / 2) : finiteIndex(frame.canonicalMusic?.clocks.beat2.index) ?? 0
    case 'beat4': return beat != null ? Math.floor(beat / 4) : finiteIndex(frame.canonicalMusic?.clocks.beat4.index) ?? 0
    case 'bar': return bar ?? finiteIndex(frame.canonicalMusic?.clocks.bar.index) ?? 0
    case 'bar4': return bar != null ? Math.floor(bar / 4) : finiteIndex(frame.canonicalMusic?.clocks.bar4.index) ?? 0
    case 'bar8': return bar != null ? Math.floor(bar / 8) : finiteIndex(frame.canonicalMusic?.clocks.bar8.index) ?? 0
    case 'phrase': {
      const phraseSpan = Math.max(1, Math.floor((frame.canonicalMusic?.clocks.phrase.spanBeats ?? 32) / 4))
      return bar != null ? Math.floor(bar / phraseSpan) : finiteIndex(frame.canonicalMusic?.clocks.phrase.index) ?? 0
    }
  }
}

function uniqueScenePool(anchor: AfterhoursPattern, pool: readonly AfterhoursPattern[]): readonly AfterhoursPattern[] {
  return Object.freeze([anchor, ...pool.filter(candidate => candidate !== anchor)])
}

function sceneScaleFor(
  sectionType: string,
  energy: number,
  build: number,
  drop: number,
  vocal: number,
): AfterhoursSceneScale {
  if (drop >= 0.5 || sectionType === 'drop') return 'drop'
  if (build >= 0.42 || sectionType === 'build' || sectionType === 'preDrop') return 'build'
  if (vocal >= 0.58 && energy < 0.68) return 'vocal'
  if (energy < 0.28 || sectionType === 'intro' || sectionType === 'outro') return 'quiet'
  return 'section'
}

function baseScenePool(scale: AfterhoursSceneScale, sectionType: string): readonly AfterhoursPattern[] {
  if (scale !== 'section') return SCENE_POOLS[scale]
  if (sectionType === 'verse' || sectionType === 'bridge') return SCENE_POOLS.verse
  if (sectionType === 'breakdown') return SCENE_POOLS.breakdown
  return SCENE_POOLS.section
}

function fullPatternPool(anchor: AfterhoursPattern): readonly AfterhoursPattern[] {
  const index = AFTERHOURS_PATTERNS.indexOf(anchor)
  if (index < 0) return AFTERHOURS_PATTERNS
  return Object.freeze(Array.from({ length: AFTERHOURS_PATTERNS.length }, (_, offset) => (
    AFTERHOURS_PATTERNS[(index + offset) % AFTERHOURS_PATTERNS.length]
  )))
}

function selectedPatternOrdinal(
  frame: Readonly<CinematicFrameContext>,
  cadence: AfterhoursPatternChange,
  sectionId: string,
): number {
  if (cadence === 'drop') return hashString(`${sectionId}:${normalizedSectionType(frame)}`)
  const clock = PATTERN_CLOCKS[cadence]
  return clock ? cadenceOrdinal(frame, clock) : 0
}

function boundaryActive(frame: Readonly<CinematicFrameContext>, cadence: AfterhoursPatternChange): boolean {
  if (cadence === 'drop') return frame.canonicalMusic?.impulses.dropStart.active === true
  const clock = PATTERN_CLOCKS[cadence]
  return clock ? frame.canonicalMusic?.clocks[clock].hit === true : false
}

function eventStrength(frame: Readonly<CinematicFrameContext>, kind: 'kick' | 'snare'): number {
  const values = musicalAudio(frame)?.values
  if (kind === 'kick') return clamp01(values?.kickStrength ?? frame.beat?.kick ?? 0)
  return clamp01(values?.snareStrength ?? frame.beat?.snare ?? 0)
}

function densityTier(value: number): AfterhoursDensityTier {
  if (value < 0.42) return 'sparse'
  if (value > 0.72) return 'dense'
  return 'balanced'
}

export class AfterhoursAudioIntelligenceDirector {
  private pattern: AfterhoursPattern | null = null
  private previousPattern: AfterhoursPattern = 'wideFan'
  private variation = 0
  private previousVariation = 0
  private transition = 1
  private logicalKey: string | null = null
  private blackoutEnvelope = 0
  private blackoutHoldSec = 0
  private kickEnvelope = 0
  private snareEnvelope = 0
  private downbeatEnvelope = 0
  private beatEnvelope = 0
  private dropEnvelope = 0
  private triggerEnvelope = 0
  private readonly lastEventIds = new Map<string, string>()
  private readonly edgeStates = new Map<string, boolean>()

  reset(): void {
    this.pattern = null
    this.previousPattern = 'wideFan'
    this.variation = 0
    this.previousVariation = 0
    this.transition = 1
    this.logicalKey = null
    this.blackoutEnvelope = 0
    this.blackoutHoldSec = 0
    this.kickEnvelope = 0
    this.snareEnvelope = 0
    this.downbeatEnvelope = 0
    this.beatEnvelope = 0
    this.dropEnvelope = 0
    this.triggerEnvelope = 0
    this.lastEventIds.clear()
    this.edgeStates.clear()
  }

  update(input: {
    frame: Readonly<CinematicFrameContext>
    settings: Readonly<AfterhoursAudioIntelligenceSettings>
  }): AfterhoursAudioIntelligenceState {
    const { frame } = input
    const settings = input.settings
    const selectedPattern = normalizePattern(settings.pattern)
    const patternChange = normalizePatternChange(settings.patternChange)
    const trigger = normalizeTrigger(settings.trigger)
    const dt = clamp(frame.deltaTimeSec, 0, 0.1)
    const normalizedAudio = musicalAudio(frame)
    const playing = normalizedAudio ? normalizedAudio.isPlaying !== false : (frame.isPlaying ?? true)
    const capabilities = normalizedAudio?.capabilities
    const intelligenceAvailable = capabilities?.musicIntelligence === true
    const continuousAvailable = capabilities?.broadBands === true || intelligenceAvailable
    const structureAvailable = capabilities?.barTiming === true
      || capabilities?.phraseTiming === true
      || frame.canonicalMusic?.clocks.bar.available === true
    const sectionAvailable = capabilities?.sectionTiming === true || frame.canonicalMusic?.section.type != null

    if (frame.timingDiscontinuity) {
      this.blackoutEnvelope = 0
      this.blackoutHoldSec = 0
      this.kickEnvelope = 0
      this.snareEnvelope = 0
      this.downbeatEnvelope = 0
      this.beatEnvelope = 0
      this.dropEnvelope = 0
      this.triggerEnvelope = 0
      this.lastEventIds.clear()
      this.edgeStates.clear()
    }

    const values = normalizedAudio?.values
    const energy = continuousAvailable ? clamp01(values?.overallEnergy ?? frame.audio?.smoothed?.volume ?? 0) : 0.5
    const build = capabilities?.buildProgress === true ? clamp01(values?.buildProgress ?? 0) : 0
    const drop = capabilities?.dropState === true || sectionAvailable
      ? clamp01(Math.max(values?.dropState ?? 0, frame.canonicalMusic?.section.type === 'drop' ? 1 : 0))
      : 0
    const vocal = capabilities?.vocalEnergy === true ? clamp01(values?.vocalEnergy ?? 0) : 0
    const highs = continuousAvailable ? clamp01(values?.highs ?? values?.high ?? frame.audio?.smoothed?.high ?? 0) : 0
    const sectionType = normalizedSectionType(frame)
    const sectionId = sectionIdentity(frame, sectionType)
    const sceneScale = sceneScaleFor(sectionType, energy, build, drop, vocal)

    const majorOrdinal = structureAvailable ? cadenceOrdinal(frame, 'phrase') : 0
    const structuralOrdinal = structureAvailable ? cadenceOrdinal(frame, 'bar4') : 0
    const patternOrdinal = selectedPatternOrdinal(frame, patternChange, sectionId)
    const sectionHash = hashString(sectionId)

    let targetPattern = selectedPattern
    const dropScene = drop >= 0.5 || sectionType === 'drop'
    if (patternChange !== 'off' && (patternChange !== 'drop' || dropScene)) {
      const sceneAware = intelligenceAvailable || sectionAvailable || structureAvailable
      const authoredPool = sceneAware
        ? baseScenePool(sceneScale, sectionType)
        : fullPatternPool(selectedPattern)
      // A user-selected Drop cadence is an explicit request for a topology hit at
      // the drop. Do not hash back to the same manual anchor on that boundary.
      const dropPool = authoredPool.filter(candidate => candidate !== selectedPattern)
      const pool = patternChange === 'drop' && dropPool.length > 0
        ? dropPool
        : uniqueScenePool(selectedPattern, authoredPool)
      const ordinal = patternChange === 'drop'
        ? patternOrdinal
        : patternOrdinal + majorOrdinal + positiveModulo(sectionHash, pool.length)
      targetPattern = pool[positiveModulo(ordinal, pool.length)] ?? selectedPattern
    }

    // Variation is always reconstructed from absolute canonical structure when
    // it is available, even when Pattern Change is Off. This lets a
    // manual scene breathe in authored 4/8-bar variants without secretly cycling
    // to a different user-selected topology family.
    const variation = structureAvailable
      ? hashInts(sectionHash, structuralOrdinal, majorOrdinal, AFTERHOURS_PATTERNS.indexOf(targetPattern)) % VARIATION_MODULO
      : 0
    const targetKey = `${targetPattern}:${variation}`

    const bpm = settings.bpmSync !== false && (normalizedAudio?.timing?.bpm ?? frame.beat?.bpm ?? 0) > 0
      ? (normalizedAudio?.timing?.bpm ?? frame.beat?.bpm ?? 0)
      : 0
    const morphSec = bpm > 0 ? clamp((MORPH_BEATS * 60) / bpm, MIN_MORPH_SEC, MAX_MORPH_SEC) : MORPH_SEC

    const firstFrame = this.pattern == null
    const snap = firstFrame || frame.timingDiscontinuity
    const topologyChanged = !snap && this.logicalKey !== targetKey
    if (snap) {
      this.pattern = targetPattern
      this.previousPattern = targetPattern
      this.variation = variation
      this.previousVariation = variation
      this.transition = 1
      this.logicalKey = targetKey
    } else if (topologyChanged) {
      this.previousPattern = this.pattern ?? targetPattern
      this.previousVariation = this.variation
      this.pattern = targetPattern
      this.variation = variation
      this.transition = 0
      this.logicalKey = targetKey
    } else {
      this.pattern = targetPattern
      this.variation = variation
      this.transition = Math.min(1, this.transition + dt / morphSec)
      this.logicalKey = targetKey
    }

    const kickFired = playing && this.consumeImpulse(frame, 'kick', 'kick')
    const snareFired = playing && this.consumeImpulse(frame, 'snare', 'snare')
    const downbeatFired = playing && this.consumeImpulse(frame, 'downbeat', 'downbeat')
    const beatFired = playing && this.consumeClock(frame, 'beat', 'beat')
    const dropFired = playing && this.consumeImpulse(frame, 'drop', 'dropStart')
    const sectionFired = playing && this.consumeImpulse(frame, 'section', 'sectionStart')
    const triggerFired = playing && this.consumeSelectedTrigger(frame, trigger)

    this.kickEnvelope = this.advanceEnvelope(this.kickEnvelope, kickFired, 12, dt, playing)
    this.snareEnvelope = this.advanceEnvelope(this.snareEnvelope, snareFired, 9, dt, playing)
    this.downbeatEnvelope = this.advanceEnvelope(this.downbeatEnvelope, downbeatFired, 5, dt, playing)
    this.beatEnvelope = this.advanceEnvelope(this.beatEnvelope, beatFired, 14, dt, playing)
    this.dropEnvelope = this.advanceEnvelope(this.dropEnvelope, dropFired, 3.5, dt, playing)
    const triggerRelease = 0.6 + (1 - clamp01(settings.pulseDecay)) * (1 - clamp01(settings.pulseDecay)) * 7.4
    this.triggerEnvelope = this.advanceEnvelope(this.triggerEnvelope, triggerFired, triggerRelease, dt, playing)

    const patternBoundary = patternChange !== 'off' && boundaryActive(frame, patternChange)
    const majorBoundary = frame.canonicalMusic?.clocks.phrase.hit === true || frame.canonicalMusic?.clocks.bar8.hit === true
    const blackoutCue = playing && (dropFired || sectionFired || (topologyChanged && (patternBoundary || majorBoundary)))
    const blackoutAmount = clamp01(settings.blackoutAmount)
    if (blackoutAmount <= 0 || !playing) {
      this.blackoutEnvelope = 0
      this.blackoutHoldSec = 0
    } else if (blackoutCue) {
      this.blackoutEnvelope = blackoutAmount
      this.blackoutHoldSec = 0.05 + blackoutAmount * 0.16
    } else if (this.blackoutHoldSec > 0) {
      this.blackoutHoldSec = Math.max(0, this.blackoutHoldSec - dt)
    } else if (this.blackoutEnvelope > 0) {
      this.blackoutEnvelope *= Math.exp(-BLACKOUT_RELEASE_HZ * dt)
      if (this.blackoutEnvelope < 1e-4) this.blackoutEnvelope = 0
    }

    const scene = getAfterhoursSceneDefinition(targetPattern)
    const requestedBeamCount = resolveAfterhoursBeamCount(settings.beamCount)
    const maxBeamCount = Math.min(requestedBeamCount, scene.density.maxBeams)
    const minBeamCount = Math.min(maxBeamCount, scene.density.minBeams)
    const structurePulse = structureAvailable ? [-0.12, 0, 0.12][positiveModulo(structuralOrdinal + sectionHash, 3)]! : 0
    const vocalSimplify = vocal * (energy < 0.72 ? 0.32 : 0.12)
    const sectionLift = sceneScale === 'drop' ? 0.24 : sceneScale === 'build' ? 0.11 : sceneScale === 'quiet' ? -0.18 : 0
    const choreographyAvailable = continuousAvailable || structureAvailable || sectionAvailable
    const densityAmount = choreographyAvailable
      ? clamp01(0.30 + energy * 0.52 + build * 0.08 + sectionLift + structurePulse - vocalSimplify)
      : 1
    const beamCount = choreographyAvailable
      ? Math.max(minBeamCount, Math.min(maxBeamCount, minBeamCount + Math.round((maxBeamCount - minBeamCount) * densityAmount)))
      : maxBeamCount
    const density = densityTier(densityAmount)

    // Optional fixture families remain user-authorized. Choreography may recruit
    // an enabled family later, but it never turns on a bank the user disabled.
    const sideLasers = settings.sideLasers && (!choreographyAvailable || densityAmount >= 0.38 || sceneScale === 'drop')
    const topLasers = settings.topLasers && (!choreographyAvailable || densityAmount >= 0.62 || sceneScale === 'build' || sceneScale === 'drop')

    const spreadBase = clamp01(settings.spread)
    const structuralSpread = structureAvailable ? structurePulse * 0.22 : 0
    const buildCompression = capabilities?.buildProgress === true ? build * 0.24 : 0
    const dropOpen = drop > 0 ? drop * 0.13 : 0
    const quietCompression = choreographyAvailable && sceneScale === 'quiet' ? 0.08 : 0
    const eventSpread = this.downbeatEnvelope * 0.09 + this.kickEnvelope * 0.06 - this.snareEnvelope * 0.025
    const spread = clamp01(spreadBase + structuralSpread - buildCompression + dropOpen - quietCompression + eventSpread)

    const masterIntensity = clamp01(settings.masterIntensity)
    const selectedPulse = this.triggerEnvelope * clamp01(settings.pulseAmount)
    const energyFloor = continuousAvailable ? 0.72 + energy * 0.28 : 1
    const eventBoost = this.kickEnvelope * (0.10 + eventStrength(frame, 'kick') * 0.10)
      + this.snareEnvelope * (0.07 + eventStrength(frame, 'snare') * 0.07)
      + this.downbeatEnvelope * 0.16
      + this.dropEnvelope * 0.22
      + selectedPulse * 0.36
    const intensity = masterIntensity * clamp(energyFloor + eventBoost, 0, 2.1)

    const motionAmount = clamp01(settings.motionAmount)
    const motionRange = choreographyAvailable
      ? clamp01(0.38 + energy * 0.46 + drop * 0.16 - vocal * 0.10)
      : 1
    const motionAuthority = motionAmount * motionRange
    const barClock = frame.canonicalMusic?.clocks.bar
    const bar = barIndex(frame)
    const musicalPhase = barClock?.available
      ? (bar ?? finiteIndex(barClock.index) ?? 0) + clamp01(barClock.phase)
      : frame.transportTimeSec * 0.5
    const motionPhase = settings.bpmSync !== false
      ? musicalPhase + this.beatEnvelope * ((beatIndex(frame) ?? 0) % 2 === 0 ? 0.025 : -0.025)
      : (Number.isFinite(frame.transportTimeSec) ? frame.transportTimeSec * 0.5 : 0)

    const highResponse = clamp01(Math.max(highs, eventStrength(frame, 'snare')))
    const lowerBase = continuousAvailable ? 0.76 + energy * 0.18 : 1
    const upperBase = continuousAvailable ? 0.72 + energy * 0.14 + highResponse * 0.08 : 1
    const bottom = clamp(lowerBase + this.kickEnvelope * 0.18 + this.downbeatEnvelope * 0.08 - this.snareEnvelope * 0.08, 0.5, 1)
    const wings = clamp(upperBase + this.snareEnvelope * 0.18 + this.downbeatEnvelope * 0.04 - this.kickEnvelope * 0.05, 0.5, 1)
    const top = clamp(upperBase + this.snareEnvelope * 0.22 + highResponse * 0.04 - this.kickEnvelope * 0.07, 0.5, 1)

    return {
      pattern: this.pattern ?? targetPattern,
      previousPattern: this.previousPattern,
      variation: this.variation,
      previousVariation: this.previousVariation,
      transition: this.transition,
      blackout: clamp01(this.blackoutEnvelope),
      intensity,
      spread,
      beamCount,
      sideLasers,
      topLasers,
      motionPhase,
      motionAuthority,
      bankWeights: Object.freeze({ bottom, left: wings, right: wings, top }),
      densityTier: density,
      sceneScale,
      structuralOrdinal,
      majorOrdinal,
      kickEnvelope: this.kickEnvelope,
      snareEnvelope: this.snareEnvelope,
      downbeatEnvelope: this.downbeatEnvelope,
      triggerEnvelope: this.triggerEnvelope,
    }
  }

  private advanceEnvelope(current: number, fired: boolean, releaseHz: number, dt: number, playing: boolean): number {
    if (fired) return 1
    const rate = playing ? releaseHz : Math.max(4, releaseHz)
    const next = current * Math.exp(-rate * dt)
    return next < 1e-4 ? 0 : clamp01(next)
  }

  private consumeSelectedTrigger(frame: Readonly<CinematicFrameContext>, trigger: AfterhoursTrigger): boolean {
    const clock = CLOCK_TRIGGERS[trigger]
    if (clock) return this.consumeClock(frame, `trigger:${trigger}`, clock)
    const impulse = IMPULSE_TRIGGERS[trigger]
    if (impulse) return this.consumeImpulse(frame, `trigger:${trigger}`, impulse)
    return false
  }

  private consumeClock(frame: Readonly<CinematicFrameContext>, channel: string, key: CanonicalClockKey): boolean {
    const clock = frame.canonicalMusic?.clocks[key]
    if (clock?.available) return this.consumeIdentity(channel, clock.hit, clock.eventId)

    // Capability-safe fallback only to already-normalized host events. There is
    // deliberately no local onset detector or synthesized beat counter here.
    const fallback = musicalAudio(frame)?.events
    if (key === 'beat') return this.consumeIdentity(channel, fallback?.beat === true, null)
    if (key === 'bar') return this.consumeIdentity(channel, fallback?.barStart === true, null)
    return false
  }

  private consumeImpulse(frame: Readonly<CinematicFrameContext>, channel: string, key: CanonicalImpulseKey): boolean {
    const impulse = frame.canonicalMusic?.impulses[key]
    if (impulse) return this.consumeIdentity(channel, impulse.active, impulse.eventId)
    const events = musicalAudio(frame)?.events
    const fallback = key === 'kick'
      ? events?.kick
      : key === 'snare'
        ? events?.snare
        : key === 'downbeat'
          ? events?.downbeat
          : key === 'dropStart'
            ? events?.dropEntry
            : key === 'beat'
              ? events?.beat
              : key === 'sectionStart'
                ? events?.sectionChange
                : false
    return this.consumeIdentity(channel, fallback === true, null)
  }

  private consumeIdentity(channel: string, active: boolean, eventId: string | null): boolean {
    if (eventId != null) {
      if (!active || this.lastEventIds.get(channel) === eventId) return false
      this.lastEventIds.set(channel, eventId)
      this.edgeStates.set(channel, active)
      return true
    }
    const previous = this.edgeStates.get(channel) ?? false
    this.edgeStates.set(channel, active)
    return active && !previous
  }
}
