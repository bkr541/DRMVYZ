import type { SharedPerformanceContext } from '../../../../../features/performanceCore'
import { resolveSharedPerformanceTransportTransition } from '../../../../../features/performanceCore/transport'
import { createPerformanceDeterministicSeed, selectPerformanceDeterministicIndex } from '../../../../../features/performanceCore/determinism'
import { resolveSharedPerformanceEventEnvelope, smoothSharedPerformanceModulation, type SharedPerformanceSmoothingState } from '../../../../../features/performanceCore/envelopes'
import { MUTAGEN_PATTERNS, type CanvasMutagenSettings, type MutagenPattern, type MutagenTrigger } from './MutagenSettings'

export type MutagenAuthority = 'manual' | 'patternChange' | 'autoPerformance'
export type MutagenMusicalEvents = Record<'beat' | 'kick' | 'snare' | 'downbeat' | 'bar' | 'phrase' | 'section' | 'drop' | 'transient', string | null>
const emptyEvents = (): MutagenMusicalEvents => ({ beat: null, kick: null, snare: null, downbeat: null, bar: null, phrase: null, section: null, drop: null, transient: null })
const clamp = (v: number, low = 0, high = 1) => Math.max(low, Math.min(high, Number.isFinite(v) ? v : 0))
const qualifiedSection = (c: SharedPerformanceContext | null): c is SharedPerformanceContext => Boolean(c?.capabilities.sections && Math.max(c.sectionConfidence, c.confidence.section) > 0.15)

/** MUTAGEN-local adaptation of SHIFTGRID's published-boundary contract. No
 * private grid, beat detector, video timing trigger, or tile state is involved. */
export function resolveMutagenMusicalEvents(c: SharedPerformanceContext | null, previous: SharedPerformanceContext | null, active: boolean): MutagenMusicalEvents {
  const events = emptyEvents()
  if (!active || !c || c.boundaries.timingDiscontinuity || c.seekDetected || c.loopWrapDetected || c.trackReplacementDetected || (previous && c.runtimeIdentity !== previous.runtimeIdentity)) return events
  const id = (kind: string, index: string | number) => `${c.runtimeIdentity}:${kind}:${index}`
  const grid = c.capabilities.beatGrid && c.confidence.grid > 0.15
  const rhythm = c.capabilities.rhythmEvents && c.confidence.rhythm > 0.15
  if (grid && c.boundaries.beatBoundary) events.beat = id('beat', Math.floor(c.absoluteBeat + 1e-6))
  if (grid && c.boundaries.barBoundary) events.bar = id('bar', Math.floor(c.absoluteBar + 1e-6))
  if (grid && c.boundaries.barBoundary && c.downbeat && c.confidence.downbeat > 0.15) events.downbeat = id('downbeat', Math.floor(c.absoluteBar + 1e-6))
  if (grid && c.confidence.phrase > 0.15 && c.boundaries.barBoundary && previous && c.phraseIndex !== previous.phraseIndex) events.phrase = id('phrase', c.phraseIndex)
  if (rhythm && c.kick && !previous?.kick) events.kick = id('kick', Math.round(c.audioTimeSec * 1000))
  if (rhythm && c.snare && !previous?.snare) events.snare = id('snare', Math.round(c.audioTimeSec * 1000))
  if (rhythm && c.transientConfidence > 0.15 && c.transient > 0.55 && (previous?.transient ?? 0) <= 0.55) events.transient = id('transient', Math.round(c.audioTimeSec * 1000))
  const section = qualifiedSection(c)
  if (section && c.boundaries.sectionEntry) events.section = id('section', `${c.sectionId}:${c.sectionOccurrence}`)
  const sectionDrop = section && c.boundaries.sectionEntry && c.sectionType === 'drop'
  const semanticDrop = c.confidence.semantics > 0.15 && c.dropImpact > 0.55 && (previous?.dropImpact ?? 0) <= 0.55
  if (sectionDrop || semanticDrop) events.drop = id('drop', sectionDrop ? `${c.sectionId}:${c.dropOccurrence}` : `impact:${Math.round(c.audioTimeSec * 1000)}`)
  return events
}

export function resolveMutagenTriggerEventIdentity(c: SharedPerformanceContext | null, previous: SharedPerformanceContext | null, trigger: MutagenTrigger, active: boolean): string | null {
  return triggerFromEvents(c, trigger, resolveMutagenMusicalEvents(c, previous, active))
}

function triggerFromEvents(c: SharedPerformanceContext | null, trigger: MutagenTrigger, e: MutagenMusicalEvents): string | null {
  if (!c) return null
  if (trigger === 'beat2' || trigger === 'beat4') {
    const divisor = trigger === 'beat2' ? 2 : 4
    return e.beat && Math.floor(c.absoluteBeat + 1e-6) % divisor === 0 ? `${e.beat}:${trigger}` : null
  }
  if (trigger === 'bar4' || trigger === 'bar8') {
    const divisor = trigger === 'bar4' ? 4 : 8
    return e.bar && Math.floor(c.absoluteBar + 1e-6) % divisor === 0 ? `${e.bar}:${trigger}` : null
  }
  return e[trigger]
}

export function createMutagenPerformancePatternCycle(seed: number): readonly MutagenPattern[] {
  const cycle = [...MUTAGEN_PATTERNS]
  for (let i = cycle.length - 1; i > 0; i--) {
    const swap = selectPerformanceDeterministicIndex(i + 1, 'mutagen-cycle', seed, i)
    ;[cycle[i], cycle[swap]] = [cycle[swap], cycle[i]]
  }
  return Object.freeze(cycle)
}

export function nextMutagenPerformancePattern(cycle: readonly MutagenPattern[], current: MutagenPattern): MutagenPattern {
  return cycle[(cycle.indexOf(current) + 1) % cycle.length] ?? current
}

/** Stateless structural selection, independent of seek/loop identity and poll count. */
export function resolveMutagenAutoPattern(c: SharedPerformanceContext, seed: number): MutagenPattern {
  const section = c.sectionType ?? c.macroSectionType
  if (section === 'intro' || section === 'breakdown' || section === 'outro') return 'morph'
  if (section === 'verse') return selectPerformanceDeterministicIndex(2, seed, c.trackIdentity, c.sectionId, c.performanceFourBarBlockIndex) ? 'terraform' : 'liquify'
  if (section === 'build') {
    const progress = Math.max(c.buildProgress, c.sectionProgress)
    return progress > 0.66 ? 'vortex' : progress > 0.33 ? 'liquify' : 'morph'
  }
  if (section === 'preDrop') return 'vortex'
  if (section === 'drop') {
    const drops: readonly MutagenPattern[] = ['liquify', 'fracture', 'vortex']
    const first = selectPerformanceDeterministicIndex(drops.length, seed, c.trackIdentity, 'drops')
    return drops[(first + Math.max(0, c.dropOccurrence - 1)) % drops.length]
  }
  const cycle = createMutagenPerformancePatternCycle(createPerformanceDeterministicSeed(seed, c.trackIdentity, c.sectionId))
  return cycle[Math.abs(c.performanceFourBarBlockIndex) % cycle.length]
}

/** 120 BPM is 1x. Interpolate only from the supplied canonical audio position. */
export function resolveMutagenMotionPosition(c: SharedPerformanceContext | null, bpmSync: boolean, timeSec: number): number {
  return bpmSync && c?.capabilities.beatGrid && c.confidence.grid > 0.15 && c.bpm > 0
    ? c.absoluteBeat * 0.5 + (timeSec - c.audioTimeSec) * clamp(c.bpm / 120, 0.5, 2)
    : timeSec
}

export interface MutagenAudioRouting {
  mutationGain: number
  velocity: number
  expansion: number
  kickImpulse: number
  tearAccent: number
  density: number
  edgeDetail: number
  reconstruction: number
  preDropHold: boolean
}

export interface MutagenPerformanceDecision {
  authority: MutagenAuthority
  activePattern: MutagenPattern
  patternChanged: boolean
  triggerEventId: string | null
  events: MutagenMusicalEvents
  routing: MutagenAudioRouting
  reset: boolean
  positionReset: boolean
  motionTimeSec: number
  transitionTimeSec: number
}

export const MUTAGEN_NEUTRAL_ROUTING: Readonly<MutagenAudioRouting> = Object.freeze({ mutationGain: 1, velocity: 1, expansion: 1, kickImpulse: 0, tearAccent: 0, density: 0, edgeDetail: 0, reconstruction: 0, preDropHold: false })

type SmoothKey = 'bass' | 'mid' | 'high' | 'build' | 'reconstruction' | 'gain'
const smoothKeys: SmoothKey[] = ['bass', 'mid', 'high', 'build', 'reconstruction', 'gain']

/** Volatile engine program. Never writes authored Pattern or any store state. */
export class MutagenPerformanceController {
  private previous: SharedPerformanceContext | null = null
  private settings: CanvasMutagenSettings | null = null
  private paused: boolean | null = null
  private wasActive: boolean | null = null
  private activePattern: MutagenPattern = 'liquify'
  private lastTrigger: string | null = null
  private seenEvents: Partial<MutagenMusicalEvents> = {}
  private suppressedSample = ''
  private lastClock: number | null = null
  private phase = 0
  private transitionTime = 0
  private kickAt = -Infinity
  private tearAt = -Infinity
  private dropAt = -Infinity
  private kickStrength = 0
  private tearStrength = 0
  private dropStrength = 0
  private routing: MutagenAudioRouting = { ...MUTAGEN_NEUTRAL_ROUTING }
  private smooth = Object.fromEntries(smoothKeys.map(key => [key, { value: 0, initialized: false }])) as Record<SmoothKey, SharedPerformanceSmoothingState>

  reset(): void {
    this.previous = null; this.settings = null; this.paused = null; this.wasActive = null
    this.lastClock = null; this.lastTrigger = null; this.seenEvents = {}; this.suppressedSample = ''; this.transitionTime = 0
    this.clearEnvelopes()
  }

  private clearEnvelopes(): void {
    this.kickAt = this.tearAt = this.dropAt = -Infinity
    for (const state of Object.values(this.smooth)) state.initialized = false
    this.routing = { ...MUTAGEN_NEUTRAL_ROUTING }
  }

  update(input: { settings: CanvasMutagenSettings; context: SharedPerformanceContext | null; audioActive: boolean; paused: boolean; timeSec: number; deltaSec: number }): MutagenPerformanceDecision {
    const { settings: s, context: c } = input
    const before = this.activePattern
    const authority: MutagenAuthority = s.patternChange ? 'patternChange' : s.autoPerformance ? 'autoPerformance' : 'manual'
    const oldAuthority = this.settings?.patternChange ? 'patternChange' : this.settings?.autoPerformance ? 'autoPerformance' : 'manual'
    const first = this.settings === null
    const seedChanged = this.settings !== null && s.deterministicSeed !== this.settings.deterministicSeed
    const authoredChanged = this.settings !== null && s.pattern !== this.settings.pattern
    const authorityChanged = !first && oldAuthority !== authority
    const triggerChanged = this.settings !== null && s.trigger !== this.settings.trigger
    const pauseChanged = this.paused !== null && this.paused !== input.paused
    const activeChanged = this.wasActive !== null && this.wasActive !== input.audioActive
    const newContext = c !== this.previous
    const transport = newContext && c ? resolveSharedPerformanceTransportTransition(this.previous, c) : null
    const transportReset = Boolean(newContext && c && (c.seekDetected || c.loopWrapDetected || c.trackReplacementDetected || c.boundaries.timingDiscontinuity || transport?.seekDetected || transport?.loopWrapDetected || transport?.trackReplacementDetected || transport?.timingDiscontinuity || (this.previous && c.timingDiscontinuityIdentity !== this.previous.timingDiscontinuityIdentity)))
    const reset = first || seedChanged || transportReset || pauseChanged || activeChanged
    const sample = c ? `${c.runtimeIdentity}:${c.audioTimeSec}` : 'none'
    const consume = reset || authoredChanged || authorityChanged || triggerChanged
    if (consume || input.paused) this.suppressedSample = sample
    const eventActive = input.audioActive && !input.paused && newContext && !consume && sample !== this.suppressedSample
    if (first || seedChanged || transportReset) this.seenEvents = {}
    const events = resolveMutagenMusicalEvents(c, this.previous, eventActive)
    for (const key of Object.keys(events) as Array<keyof MutagenMusicalEvents>) {
      const id = events[key]
      if (id && this.seenEvents[key] === id) events[key] = null
      else if (id) this.seenEvents[key] = id
    }
    const triggerEventId = triggerFromEvents(c, s.trigger, events)

    if (first || seedChanged || transportReset || authoredChanged || authorityChanged) {
      this.activePattern = s.pattern
      this.lastTrigger = null
    }
    if (!input.paused || transportReset || first || seedChanged) {
      if (authority === 'autoPerformance') this.activePattern = input.audioActive && qualifiedSection(c) ? resolveMutagenAutoPattern(c, s.deterministicSeed) : s.pattern
      else if (authority === 'manual') this.activePattern = s.pattern
      else if (triggerEventId && triggerEventId !== this.lastTrigger) {
        this.activePattern = nextMutagenPerformancePattern(createMutagenPerformancePatternCycle(s.deterministicSeed), this.activePattern)
        this.lastTrigger = triggerEventId
      }
    }
    if (reset && (!input.paused || transportReset || first || seedChanged)) this.clearEnvelopes()
    const clock = resolveMutagenMotionPosition(c, s.bpmSync && input.audioActive, input.timeSec)
    if (first || seedChanged || transportReset) { this.phase = clock; this.lastClock = clock }
    if (pauseChanged || activeChanged) this.lastClock = clock
    if (!input.paused) {
      const dt = clamp(input.deltaSec, 0, 0.1)
      const response = input.audioActive && c ? s.audioReactivity : 0
      const bands = Boolean(c?.capabilities.liveBands && c.confidence.overall > 0.05)
      const section = input.audioActive && qualifiedSection(c) ? c.sectionType ?? c.macroSectionType : null
      const structural = Boolean(section)
      const build = structural && c ? clamp(Math.max(c.buildProgress, section === 'build' ? c.sectionProgress : 0)) : 0
      const reconstruction = section === 'intro' ? 0.72 : section === 'breakdown' || section === 'outro' ? 0.25 + 0.7 * clamp(c?.sectionProgress ?? 0) : 0
      const gain = section === 'intro' ? 0.45 : section === 'verse' ? 0.78 : section === 'drop' ? 1.35 + Math.min(0.25, Math.max(0, (c?.dropOccurrence ?? 1) - 1) * 0.2) : 1
      const smooth = (key: SmoothKey, target: number) => smoothSharedPerformanceModulation(this.smooth[key], target, dt, key === 'reconstruction' ? 0.6 : 0.1, key === 'reconstruction' ? 0.08 : 0.4)
      const sub = c?.intelligence.bands.normalized.normalizedSub ?? 0
      const bass = smooth('bass', bands && c ? clamp(c.bass * 0.65 + sub * 0.35) * response : 0)
      const mid = smooth('mid', bands && c ? clamp(c.mid) * response : 0)
      const high = smooth('high', bands && c ? clamp(c.high) * response : 0)
      const buildAmount = smooth('build', build * response)
      if (events.kick) { this.kickAt = input.timeSec; this.kickStrength = clamp(c?.kickStrength ?? 0) }
      if (events.snare || events.transient) { this.tearAt = input.timeSec; this.tearStrength = clamp(Math.max(c?.snareStrength ?? 0, c?.transient ?? 0)) }
      if (events.drop) { this.dropAt = input.timeSec; this.dropStrength = clamp(Math.max(c?.dropImpact ?? 0, 0.8)) }
      const pulse = (at: number, release: number) => Number.isFinite(at) ? resolveSharedPerformanceEventEnvelope(input.timeSec - at, { attack: 0, hold: 0.025, release, curve: 'easeOut' }) : 0
      const kick = pulse(this.kickAt, 0.22) * this.kickStrength * response
      const tear = pulse(this.tearAt, 0.34) * this.tearStrength * response
      const drop = pulse(this.dropAt, 0.8) * this.dropStrength * response
      const preDropHold = section === 'preDrop' && (c?.sectionProgress ?? 0) > 0.65 && response > 0
      const dropTwo = section === 'drop' && (c?.dropOccurrence ?? 0) >= 2
      // Reserve an occurrence-dependent intensity range: a late build must not
      // saturate Drop 1 at the same ceiling reserved for the later drop.
      const ceiling = section === 'drop' && !dropTwo ? 1 + response * 0.7 : 2.2
      const floor = dropTwo ? 1 + response * 1.05 : 0.2
      this.routing = {
        mutationGain: clamp(smooth('gain', 1 + (gain - 1) * response) + bass * 0.45 + buildAmount * 0.6 + kick * 0.25 + drop * 0.65, floor, ceiling),
        velocity: clamp((1 + bass * 1.2 + buildAmount * 0.4) * (preDropHold ? 0.2 : 1), 0.15, 2.6),
        expansion: 1 + bass * 0.1 + kick * 0.035 + drop * 0.06,
        kickImpulse: kick + drop * 0.5,
        tearAccent: tear + drop * 0.3,
        density: mid,
        edgeDetail: high * 0.25,
        reconstruction: smooth('reconstruction', reconstruction * response),
        preDropHold,
      }
      // Response 0 is an exact neutral manual path, including after a loud frame.
      if (response === 0) this.routing = { ...MUTAGEN_NEUTRAL_ROUTING }
      const elapsed = this.lastClock === null ? 0 : clamp(clock - this.lastClock, 0, 0.25)
      this.phase += elapsed * this.routing.velocity
      this.transitionTime += dt
    }
    this.lastClock = clock
    this.previous = c; this.settings = s; this.paused = input.paused; this.wasActive = input.audioActive
    return { authority, activePattern: this.activePattern, patternChanged: before !== this.activePattern, reset, positionReset: first || seedChanged || transportReset, triggerEventId, events, routing: { ...this.routing }, motionTimeSec: this.phase, transitionTimeSec: this.transitionTime }
  }
}

/** Derive a volatile recipe; the source identity and authored object are untouched. */
export function resolveMutagenReactiveSettings(authored: CanvasMutagenSettings, decision?: MutagenPerformanceDecision): CanvasMutagenSettings {
  if (!decision) return authored
  return {
    ...authored,
    pattern: decision.activePattern,
    mutation: clamp(authored.mutation * decision.routing.mutationGain),
    sourceMix: 1 - (1 - authored.sourceMix) * (1 - clamp(decision.routing.reconstruction)),
    morphScale: clamp(authored.morphScale + decision.routing.density * 0.25),
  }
}
