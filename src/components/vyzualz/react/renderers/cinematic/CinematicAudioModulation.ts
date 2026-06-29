import type { MusicIntelligenceFrame } from '../../../../../features/musicIntelligence/types'
import {
  CINEMATIC_AUDIO_CONTINUOUS_SOURCES,
  CINEMATIC_AUDIO_EVENT_SOURCES,
  CINEMATIC_AUDIO_SOURCES,
  CINEMATIC_AUDIO_TARGETS,
  type CinematicAudioEventSource,
  type CinematicAudioRoute,
  type CinematicAudioSource,
  type CinematicAudioTarget,
  type CinematicResponseCurve,
  type CinematicSectionScaleKey,
  type CinematicWorldMode,
} from '../../CinematicWorldConfig'
import type { ReactSectionType } from '../../ReactTypes'

export type CinematicAudioResetReason =
  | 'seek'
  | 'trackReplacement'
  | 'transportRestart'
  | 'worldReplacement'
  | 'presetReplacement'
  | 'manual'

export interface CinematicAudioCapabilityFlags {
  musicIntelligence: boolean
  broadBands: boolean
  detailedBands: boolean
  transientEvents: boolean
  kickEvents: boolean
  snareEvents: boolean
  beatTiming: boolean
  downbeatTiming: boolean
  barTiming: boolean
  phraseTiming: boolean
  sectionTiming: boolean
  buildProgress: boolean
  dropState: boolean
  trackEnergyCurve: boolean
  vocalEnergy: boolean
}

export interface CinematicMusicalTiming {
  bpm: number
  beatPhase: number
  beatIndex: number
  beatInBar: number
  barIndex: number
  barPosition: number
  phraseProgress: number
}

export interface CinematicMusicalSection {
  type: ReactSectionType | null
  label: string
  startSec: number
  endSec: number
  progress: number
  intensity: number
  confidence: number
}

export interface CinematicNormalizedAudioFrame {
  frameId: number
  sourceId: string | null
  trackId: string | null
  transportTimeSec: number
  isPlaying: boolean
  values: Record<CinematicAudioSource, number>
  events: Record<CinematicAudioEventSource, boolean>
  timing: CinematicMusicalTiming
  section: CinematicMusicalSection
  capabilities: CinematicAudioCapabilityFlags
  resetReasons: readonly CinematicAudioResetReason[]
}

export interface CinematicAudioFrameInput {
  frameIndex: number
  deltaTimeSec: number
  transportTimeSec: number
  isPlaying: boolean
  beatHit: boolean
  beatPhase: number
  bpm: number
  broadBands: {
    bass: number
    mid: number
    high: number
    volume: number
  }
  musicIntelligence: MusicIntelligenceFrame | null
  section: {
    type: ReactSectionType | null
    label?: string
    startSec: number
    endSec: number
    progress: number
    intensity?: number
    confidence?: number
  }
  sectionChanged: boolean
  worldId: CinematicWorldMode | string
  presetId: string
}

export interface CinematicMappingValidationIssue {
  routeId: string
  code: 'duplicateRouteId' | 'unknownSource' | 'unknownTarget' | 'unsupportedTarget'
  message: string
}

export interface CinematicCompiledMappingPlan {
  key: string
  routes: readonly CompiledRoute[]
  issues: readonly CinematicMappingValidationIssue[]
}

export interface CinematicModulationSnapshot {
  values: Record<CinematicAudioTarget, number>
  issues: readonly CinematicMappingValidationIssue[]
  planKey: string
}

interface CompiledRoute {
  config: CinematicAudioRoute
  source: CinematicAudioSource
  target: CinematicAudioTarget
  canonicalTarget: CinematicAudioTarget
  event: boolean
}

interface RouteState {
  envelope: number
  smoothed: number
  eventAgeMs: number
}

const EVENT_SOURCE_SET = new Set<string>(CINEMATIC_AUDIO_EVENT_SOURCES)
const SOURCE_SET = new Set<string>(CINEMATIC_AUDIO_SOURCES)
const TARGET_SET = new Set<string>(CINEMATIC_AUDIO_TARGETS)

const SOURCE_CAPABILITY: Partial<Record<CinematicAudioSource, keyof CinematicAudioCapabilityFlags>> = {
  subBass: 'detailedBands',
  lowMid: 'detailedBands',
  highMid: 'detailedBands',
  transientIntensity: 'transientEvents',
  kickStrength: 'kickEvents',
  snareStrength: 'snareEvents',
  beatPhase: 'beatTiming',
  barPosition: 'barTiming',
  phraseProgress: 'phraseTiming',
  sectionProgress: 'sectionTiming',
  sectionEnergy: 'sectionTiming',
  buildProgress: 'buildProgress',
  dropState: 'dropState',
  trackEnergy: 'trackEnergyCurve',
  vocalEnergy: 'vocalEnergy',
  beat: 'beatTiming',
  kick: 'kickEvents',
  snare: 'snareEvents',
  downbeat: 'downbeatTiming',
  barStart: 'barTiming',
  sectionChange: 'sectionTiming',
  dropEntry: 'dropState',
}

const TARGET_ALIASES: Partial<Record<CinematicAudioTarget, CinematicAudioTarget>> = {
  fog: 'fogDensity',
  debris: 'particleEmission',
  atmosphere: 'environmentBrightness',
  glow: 'environmentBrightness',
  cameraMotion: 'cameraPunch',
  portalPulse: 'impact',
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return value < min ? min : value > max ? max : value
}

function clamp01(value: number): number {
  return clamp(value, 0, 1)
}

function safeIndex(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : -1
}

function safeUnit(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? clamp01(value) : 0
}

function makeSourceValues(): Record<CinematicAudioSource, number> {
  return Object.fromEntries(CINEMATIC_AUDIO_SOURCES.map(source => [source, 0])) as Record<CinematicAudioSource, number>
}

function makeEventValues(): Record<CinematicAudioEventSource, boolean> {
  return Object.fromEntries(CINEMATIC_AUDIO_EVENT_SOURCES.map(source => [source, false])) as Record<CinematicAudioEventSource, boolean>
}

function makeTargetValues(): Record<CinematicAudioTarget, number> {
  return Object.fromEntries(CINEMATIC_AUDIO_TARGETS.map(target => [target, 0])) as Record<CinematicAudioTarget, number>
}

function sectionIntensity(type: ReactSectionType | null): number {
  switch (type) {
    case 'intro': return 0.35
    case 'verse': return 0.60
    case 'build':
    case 'preDrop': return 0.82
    case 'drop': return 1
    case 'breakdown': return 0.48
    case 'bridge': return 0.58
    case 'outro': return 0.28
    default: return 0.65
  }
}

function frameCapabilities(mi: MusicIntelligenceFrame | null, input: CinematicAudioFrameInput): CinematicAudioCapabilityFlags {
  const active = Boolean(mi && mi.frameId > 0)
  const declared = mi?.capabilities
  const beatBpm = active ? mi?.rhythm.bpm ?? 0 : input.bpm
  const beatTiming = beatBpm > 0
  const preciseGrid = active && (declared?.beatGrid ?? (
    safeIndex(mi?.rhythm.beatIndex) >= 0
    && safeIndex(mi?.rhythm.beatInBar) >= 0
    && safeIndex(mi?.rhythm.barIndex) >= 0
  ))
  const sectionProgress = input.section.progress
  const sectionTiming = input.section.type != null && sectionProgress >= 0 && sectionProgress <= 1
  const rhythmEvents = active && (declared?.rhythmEvents ?? Boolean(mi?.raw.freqData))
  const detailedBands = active && (declared?.liveBands ?? Boolean(mi?.raw.freqData))
  const sections = sectionTiming || Boolean(declared?.sections)
  return {
    musicIntelligence: active,
    broadBands: true,
    detailedBands,
    transientEvents: rhythmEvents,
    kickEvents: rhythmEvents,
    snareEvents: rhythmEvents,
    beatTiming,
    downbeatTiming: preciseGrid,
    barTiming: preciseGrid,
    phraseTiming: preciseGrid,
    sectionTiming: sections,
    buildProgress: active,
    dropState: sections,
    trackEnergyCurve: active && Boolean(declared?.trackEnergyCurve && mi?.energy.trackCurve != null),
    vocalEnergy: active && Boolean(declared?.stemCurves || declared?.lyrics),
  }
}

function canonicalTarget(target: CinematicAudioTarget): CinematicAudioTarget {
  return TARGET_ALIASES[target] ?? target
}

export function canonicalCinematicAudioTarget(target: CinematicAudioTarget): CinematicAudioTarget {
  return canonicalTarget(target)
}

function sourceAvailable(source: CinematicAudioSource, flags: CinematicAudioCapabilityFlags): boolean {
  const capability = SOURCE_CAPABILITY[source]
  return capability ? flags[capability] : true
}

function responseCurve(value: number, curve: CinematicResponseCurve): number {
  const x = clamp01(value)
  switch (curve) {
    case 'smoothstep': return x * x * (3 - 2 * x)
    case 'easeIn': return x * x
    case 'easeOut': return 1 - (1 - x) * (1 - x)
    case 'exponential': return x <= 0 ? 0 : (Math.exp(x * 4) - 1) / (Math.exp(4) - 1)
    default: return x
  }
}

function alphaFor(ms: number, deltaTimeSec: number): number {
  if (ms <= 0) return 1
  return 1 - Math.exp(-(Math.max(0, deltaTimeSec) * 1000) / Math.max(1, ms))
}

function hashString(value: string): number {
  let hash = 2166136261
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function seededUnit(seed: number): number {
  let value = seed >>> 0
  value += 0x6d2b79f5
  value = Math.imul(value ^ (value >>> 15), value | 1)
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296
}

export function validateCinematicMappings(
  routes: readonly CinematicAudioRoute[],
  supportedTargets: readonly CinematicAudioTarget[],
): CinematicMappingValidationIssue[] {
  const issues: CinematicMappingValidationIssue[] = []
  const ids = new Set<string>()
  const supported = new Set(supportedTargets.map(canonicalTarget))
  for (const route of routes) {
    if (ids.has(route.id)) {
      issues.push({
        routeId: route.id,
        code: 'duplicateRouteId',
        message: `Cinematic modulation route "${route.id}" is duplicated`,
      })
    }
    ids.add(route.id)
    if (!SOURCE_SET.has(route.source)) {
      issues.push({ routeId: route.id, code: 'unknownSource', message: `Unknown cinematic audio source "${String(route.source)}"` })
      continue
    }
    if (!TARGET_SET.has(route.target)) {
      issues.push({ routeId: route.id, code: 'unknownTarget', message: `Unknown cinematic modulation target "${String(route.target)}"` })
      continue
    }
    if (!supported.has(canonicalTarget(route.target))) {
      issues.push({
        routeId: route.id,
        code: 'unsupportedTarget',
        message: `Cinematic target "${route.target}" is not supported by the selected world`,
      })
    }
  }
  return issues
}

function mappingKey(routes: readonly CinematicAudioRoute[], supportedTargets: readonly CinematicAudioTarget[]): string {
  return JSON.stringify({ routes, supportedTargets: [...supportedTargets].sort() })
}

export function compileCinematicMappingPlan(
  routes: readonly CinematicAudioRoute[],
  supportedTargets: readonly CinematicAudioTarget[],
): CinematicCompiledMappingPlan {
  const issues = validateCinematicMappings(routes, supportedTargets)
  const rejectedIds = new Set(issues.map(issue => issue.routeId))
  const compiled: CompiledRoute[] = []
  for (const config of routes) {
    if (!config.enabled || rejectedIds.has(config.id)) continue
    compiled.push({
      config,
      source: config.source,
      target: config.target,
      canonicalTarget: canonicalTarget(config.target),
      event: EVENT_SOURCE_SET.has(config.source),
    })
  }
  return { key: mappingKey(routes, supportedTargets), routes: compiled, issues }
}

export class CinematicAudioFrameNormalizer {
  private previousTransport = 0
  private previousPlaying = false
  private previousTrackIdentity: string | null = null
  private previousWorldId: string | null = null
  private previousPresetId: string | null = null
  private previousSectionKey: string | null = null
  private previousSectionType: ReactSectionType | null = null
  private readonly eventTokens = new Map<CinematicAudioEventSource, string | number>()
  private readonly eventActive = new Map<CinematicAudioEventSource, boolean>()
  private initialized = false

  reset(): void {
    this.eventTokens.clear()
    this.eventActive.clear()
    this.previousSectionKey = null
    this.previousSectionType = null
    this.initialized = false
  }

  update(input: CinematicAudioFrameInput): CinematicNormalizedAudioFrame {
    const mi = input.musicIntelligence && input.musicIntelligence.frameId > 0
      ? input.musicIntelligence
      : null
    const trackIdentity = mi?.trackId ?? mi?.sourceId ?? null
    const reasons: CinematicAudioResetReason[] = []

    if (this.initialized) {
      if (trackIdentity && this.previousTrackIdentity && trackIdentity !== this.previousTrackIdentity) {
        reasons.push('trackReplacement')
      }
      if (input.worldId !== this.previousWorldId) reasons.push('worldReplacement')
      if (input.presetId !== this.previousPresetId) reasons.push('presetReplacement')
      if (!this.previousPlaying && input.isPlaying) reasons.push('transportRestart')
      const expectedAdvance = this.previousPlaying ? Math.max(0, input.deltaTimeSec) : 0
      const actualAdvance = input.transportTimeSec - this.previousTransport
      const seekTolerance = Math.max(0.35, expectedAdvance * 4 + 0.08)
      if (actualAdvance < -0.05 || Math.abs(actualAdvance - expectedAdvance) > seekTolerance) {
        reasons.push('seek')
      }
    }

    const resetThisFrame = reasons.length > 0
    if (resetThisFrame) {
      this.eventTokens.clear()
      this.eventActive.clear()
    }

    const capabilities = frameCapabilities(mi, input)
    const values = makeSourceValues()
    const events = makeEventValues()
    const detailed = capabilities.detailedBands ? mi?.bands : null
    const broad = input.broadBands
    const rhythm = mi?.rhythm
    const overallEnergy = capabilities.musicIntelligence
      ? safeUnit(mi?.energy.shortTerm)
      : safeUnit(broad.volume)
    const type = input.section.type
    const progress = input.section.progress >= 0 && input.section.progress <= 1
      ? clamp01(input.section.progress)
      : 0
    const intensity = input.section.intensity != null
      ? safeUnit(input.section.intensity)
      : sectionIntensity(type)

    values.overallEnergy = overallEnergy
    values.subBass = detailed ? safeUnit(detailed.normalizedSub || detailed.sub) : 0
    values.bass = detailed ? safeUnit(detailed.normalizedBass || detailed.bass) : safeUnit(broad.bass)
    values.lowMid = detailed ? safeUnit(detailed.normalizedLowMid || detailed.lowMid) : 0
    values.mid = detailed ? safeUnit(detailed.normalizedMid || detailed.mid) : safeUnit(broad.mid)
    values.highMid = detailed ? safeUnit(detailed.normalizedHigh || detailed.high) : 0
    values.highs = detailed ? safeUnit(detailed.normalizedAir || detailed.air) : safeUnit(broad.high)
    values.transientIntensity = capabilities.transientEvents ? safeUnit(rhythm?.transient) : 0
    values.kickStrength = capabilities.kickEvents ? safeUnit(rhythm?.kickStrength) : 0
    values.snareStrength = capabilities.snareEvents ? safeUnit(rhythm?.snareStrength) : 0
    values.beatPhase = capabilities.beatTiming ? safeUnit(rhythm?.beatPhase ?? input.beatPhase) : 0
    const beatInBar = capabilities.barTiming ? safeIndex(rhythm?.beatInBar) : -1
    const beatIndex = capabilities.barTiming ? safeIndex(rhythm?.beatIndex) : -1
    const barIndex = capabilities.barTiming ? safeIndex(rhythm?.barIndex) : -1
    values.barPosition = beatInBar >= 0 ? clamp01((beatInBar + values.beatPhase) / 4) : 0
    values.phraseProgress = capabilities.phraseTiming ? safeUnit(rhythm?.phrase16Progress) : 0
    values.sectionProgress = capabilities.sectionTiming ? progress : 0
    values.buildProgress = capabilities.buildProgress ? safeUnit(mi?.energy.buildProgress) : 0
    values.dropState = capabilities.dropState && type === 'drop' ? 1 : 0
    values.trackEnergy = capabilities.trackEnergyCurve ? safeUnit(mi?.energy.trackCurve) : 0
    values.vocalEnergy = capabilities.vocalEnergy
      ? safeUnit(Math.max(mi?.stems.vocalEnergy ?? 0, mi?.lyrics.vocalActivity ?? 0))
      : 0
    // Compatibility aliases.
    values.volume = overallEnergy
    values.high = values.highs
    values.sectionEnergy = capabilities.sectionTiming ? intensity : 0

    const sectionKey = type == null ? null : `${type}:${input.section.startSec}:${input.section.endSec}`
    const suppressEvents = resetThisFrame || !this.initialized
    const once = (
      event: CinematicAudioEventSource,
      active: boolean,
      token: string | number,
      requireRisingEdge = false,
    ): boolean => {
      const wasActive = this.eventActive.get(event) ?? false
      this.eventActive.set(event, active)
      if (!active) return false
      if (suppressEvents) {
        this.eventTokens.set(event, token)
        return false
      }
      if ((requireRisingEdge && wasActive) || this.eventTokens.get(event) === token) return false
      this.eventTokens.set(event, token)
      return true
    }

    const miToken = mi?.frameId ?? input.frameIndex
    events.kick = once('kick', capabilities.kickEvents && Boolean(rhythm?.kickHit), miToken, true)
    events.snare = once('snare', capabilities.snareEvents && Boolean(rhythm?.snareHit), miToken, true)
    const beatHit = capabilities.beatTiming && Boolean(rhythm?.beatHit ?? input.beatHit)
    events.beat = once('beat', beatHit, beatIndex >= 0 ? beatIndex : input.frameIndex, beatIndex < 0)
    const downbeatHit = capabilities.downbeatTiming && Boolean(rhythm?.downbeatHit)
    events.downbeat = once('downbeat', downbeatHit, barIndex >= 0 ? barIndex : miToken)
    events.barStart = once('barStart', downbeatHit, barIndex >= 0 ? barIndex : miToken)
    const sectionChanged = capabilities.sectionTiming && sectionKey != null && (
      input.sectionChanged || (this.previousSectionKey != null && sectionKey !== this.previousSectionKey)
    )
    events.sectionChange = once('sectionChange', sectionChanged, sectionKey ?? miToken)
    const dropEntry = capabilities.dropState && type === 'drop' && this.previousSectionType !== 'drop'
    events.dropEntry = once('dropEntry', dropEntry, sectionKey ?? miToken)

    for (const event of CINEMATIC_AUDIO_EVENT_SOURCES) values[event] = events[event] ? 1 : 0

    const frame: CinematicNormalizedAudioFrame = {
      frameId: mi?.frameId ?? input.frameIndex,
      sourceId: mi?.sourceId ?? null,
      trackId: mi?.trackId ?? null,
      transportTimeSec: input.transportTimeSec,
      isPlaying: input.isPlaying,
      values,
      events,
      timing: {
        bpm: capabilities.beatTiming ? Math.max(0, rhythm?.bpm ?? input.bpm) : 0,
        beatPhase: values.beatPhase,
        beatIndex,
        beatInBar,
        barIndex,
        barPosition: values.barPosition,
        phraseProgress: values.phraseProgress,
      },
      section: {
        type,
        label: input.section.label ?? mi?.section.label ?? '',
        startSec: input.section.startSec,
        endSec: input.section.endSec,
        progress: capabilities.sectionTiming ? progress : 0,
        intensity,
        confidence: safeUnit(input.section.confidence ?? mi?.section.confidence),
      },
      capabilities,
      resetReasons: reasons,
    }

    this.previousTransport = input.transportTimeSec
    this.previousPlaying = input.isPlaying
    if (trackIdentity) this.previousTrackIdentity = trackIdentity
    this.previousWorldId = input.worldId
    this.previousPresetId = input.presetId
    this.previousSectionKey = sectionKey
    this.previousSectionType = type
    this.initialized = true
    return frame
  }
}

export class CinematicModulationEngine {
  private plan: CinematicCompiledMappingPlan | null = null
  private readonly states = new Map<string, RouteState>()
  private readonly targetValues = makeTargetValues()
  private readonly smoothedSources = makeSourceValues()
  private readonly initializedSources = new Set<CinematicAudioSource>()
  private routesIdentity: readonly CinematicAudioRoute[] | null = null
  private targetsIdentity: readonly CinematicAudioTarget[] | null = null
  private snapshot: CinematicModulationSnapshot = {
    values: this.targetValues,
    issues: [],
    planKey: '',
  }

  reset(_reason: CinematicAudioResetReason = 'manual'): void {
    this.states.clear()
    this.initializedSources.clear()
    for (const source of CINEMATIC_AUDIO_SOURCES) this.smoothedSources[source] = 0
    for (const target of CINEMATIC_AUDIO_TARGETS) this.targetValues[target] = 0
  }

  update(
    audio: CinematicNormalizedAudioFrame,
    routes: readonly CinematicAudioRoute[],
    supportedTargets: readonly CinematicAudioTarget[],
    deltaTimeSec: number,
    globalSmoothingMs: number,
    seed: number,
  ): CinematicModulationSnapshot {
    if (!this.plan || this.routesIdentity !== routes || this.targetsIdentity !== supportedTargets) {
      this.plan = compileCinematicMappingPlan(routes, supportedTargets)
      this.routesIdentity = routes
      this.targetsIdentity = supportedTargets
      this.states.clear()
      this.initializedSources.clear()
    }
    if (audio.resetReasons.length > 0) {
      this.states.clear()
      this.initializedSources.clear()
    }
    for (const target of CINEMATIC_AUDIO_TARGETS) this.targetValues[target] = 0

    if (this.plan.routes.length === 0) {
      this.snapshot.issues = this.plan.issues
      this.snapshot.planKey = this.plan.key
      return this.snapshot
    }

    const bucket = audio.timing.beatIndex >= 0
      ? audio.timing.beatIndex
      : Math.floor(audio.transportTimeSec * 4)
    const sourceAlpha = alphaFor(globalSmoothingMs, deltaTimeSec)
    for (const source of CINEMATIC_AUDIO_CONTINUOUS_SOURCES) {
      if (!sourceAvailable(source, audio.capabilities)) continue
      const sourceValue = audio.values[source]
      if (!this.initializedSources.has(source)) {
        this.smoothedSources[source] = sourceValue
        this.initializedSources.add(source)
      } else {
        this.smoothedSources[source] += (sourceValue - this.smoothedSources[source]) * sourceAlpha
      }
    }

    for (const route of this.plan.routes) {
      const config = route.config
      let state = this.states.get(config.id)
      if (!state) {
        state = { envelope: 0, smoothed: 0, eventAgeMs: Number.POSITIVE_INFINITY }
        this.states.set(config.id, state)
      }

      let raw = 0
      const available = sourceAvailable(route.source, audio.capabilities)
      if (available) {
        if (route.event) {
          if (audio.events[route.source as CinematicAudioEventSource]) state.eventAgeMs = 0
          else state.eventAgeMs += Math.max(0, deltaTimeSec) * 1000
          const holdMs = config.beatHoldMs ?? 0
          const decayMs = config.decayMs ?? 180
          if (state.eventAgeMs <= holdMs) raw = 1
          else if (Number.isFinite(state.eventAgeMs) && decayMs > 0) {
            raw = Math.exp(-(state.eventAgeMs - holdMs) / decayMs)
          }
        } else {
          raw = this.smoothedSources[route.source]
        }
      }

      let transformed = 0
      if (available) {
        const gain = config.gain ?? 1
        const bias = config.bias ?? 0
        const threshold = config.threshold ?? 0
        const invert = config.invert ?? false
        transformed = clamp01(raw * gain + bias)
        if (invert) transformed = 1 - transformed
        transformed = transformed <= threshold
          ? 0
          : (threshold >= 1 ? 0 : (transformed - threshold) / (1 - threshold))
        transformed = responseCurve(transformed, config.responseCurve ?? 'linear')
        const clampMin = config.clampMin ?? 0
        const clampMax = Math.max(clampMin, config.clampMax ?? 1)
        transformed = clamp(transformed, clampMin, clampMax)
      }

      const randomization = config.randomizationAmount ?? 0
      if (randomization > 0 && transformed !== 0) {
        const random = seededUnit((seed ^ hashString(config.id) ^ Math.imul(bucket + 1, 0x9e3779b1)) >>> 0)
        transformed *= 1 + (random * 2 - 1) * randomization
      }

      const attackMs = config.attackMs ?? 0
      const releaseMs = config.releaseMs ?? 0
      const envelopeAlpha = alphaFor(transformed > state.envelope ? attackMs : releaseMs, deltaTimeSec)
      state.envelope += (transformed - state.envelope) * envelopeAlpha
      const smoothAlpha = alphaFor(config.smoothingMs ?? 0, deltaTimeSec)
      state.smoothed += (state.envelope - state.smoothed) * smoothAlpha

      const sectionKey = (audio.section.type ?? 'unknown') as CinematicSectionScaleKey
      const sectionScale = config.sectionScale?.[sectionKey] ?? 1
      const amount = config.amount ?? 1
      const contribution = state.smoothed * amount * sectionScale
      this.targetValues[route.canonicalTarget] = clamp(
        this.targetValues[route.canonicalTarget] + contribution,
        -1,
        1,
      )
    }

    this.snapshot.issues = this.plan.issues
    this.snapshot.planKey = this.plan.key
    return this.snapshot
  }
}

export function cinematicModulationValue(
  snapshot: CinematicModulationSnapshot | null | undefined,
  target: CinematicAudioTarget,
): number {
  if (!snapshot) return 0
  return snapshot.values[canonicalTarget(target)] ?? 0
}


export function applyCinematicModulation(
  base: number,
  snapshot: CinematicModulationSnapshot | null | undefined,
  target: CinematicAudioTarget,
  scale = 1,
  min = 0,
  max = 1,
): number {
  return clamp(base + cinematicModulationValue(snapshot, target) * scale, min, max)
}
