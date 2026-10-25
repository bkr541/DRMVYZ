import type { Cinema2ModuleFrameReadContext, Cinema2ModuleParameterReadFacet } from '../Cinema2ModuleContracts'
import { Cinema2BeatClock } from '../Cinema2BeatClock'
import { Cinema2MainframePatternController } from '../mainframe/Cinema2MainframePatternController'
import { selectCinema2MainframeAudio } from '../mainframe/Cinema2MainframeAudioDelivery'
import { resolveCinema2AfterhoursTriggerEventIdentity, type Cinema2AfterhoursTriggerId } from '../Cinema2AfterhoursNativeModule'
import { VACANCY_PATTERNS, type VacancyControls, type VacancyPattern, type VacancyPlacement } from './Cinema2VacancyDomain'

export const VACANCY_RESPONSE_DEFAULTS = {
  audioEnergy: .5, bassPressure: 0, highSparkle: 0, vocalRestraint: 0, buildPressure: 0,
  directorIntensity: 1, directorMomentum: 0, directorBuild: 0,
  kickAccent: 0, snareAccent: 0, downbeatAccent: 0, phraseAccent: 0, dropAccent: 0,
}
export type VacancyResponse = typeof VACANCY_RESPONSE_DEFAULTS
export interface VacancyPerformanceFrame {
  beats: number; timeSec: number; pattern: VacancyPattern; basePattern: VacancyPattern
  override: 'build' | 'drop' | null; coverage: number; level: number; grain: number
  bass: number; kick: number; snare: number; downbeat: number; phrase: number; build: number; drop: number; significance: number
}
export const VACANCY_NEUTRAL_PERFORMANCE: VacancyPerformanceFrame = {
  beats: 0, timeSec: 0, pattern: 'dead-air', basePattern: 'dead-air', override: null,
  coverage: 1, level: 1, grain: 1, bass: 0, kick: 0, snare: 0, downbeat: 0, phrase: 0, build: 0, drop: 0, significance: 1,
}
const clamp = (v: number, min = 0, max = 1) => Math.max(min, Math.min(max, Number.isFinite(v) ? v : 0))
const mod = (v: number, n: number) => ((v % n) + n) % n
const band = (x: number, width: number) => Math.exp(-x * x / (width * width))

/** Distinct native screen programs. The cabinet transforms never depend on pattern selection. */
export function vacancyScreenLevel(p: VacancyPlacement, index: number, count: number, frame: VacancyPerformanceFrame): number {
  const { beats, pattern } = frame
  // A deterministic order gives the coverage slider a strict ceiling, including during white-outs.
  const rank = (index * 3) % count
  if (rank >= Math.floor(clamp(frame.coverage) * count + 1e-6)) return 0
  let gain = 1
  if (pattern === 'channel-hop') gain = index === mod(Math.floor(beats), count) ? 1 : .015
  else if (pattern === 'ascent') gain = .025 + .975 * band(p.tier - mod(beats * .5, 4), .65)
  else if (pattern === 'collapse') gain = .025 + .975 * band(p.tier - (3 - mod(beats * .5, 4)), .65)
  else if (pattern === 'signal-sweep') gain = .025 + .975 * band(p.x - (mod(beats * .5, 4) - 2), .38)
  else if (pattern === 'checker') gain = (p.tier + p.index + Math.floor(beats)) % 2 ? .035 : 1
  else if (pattern === 'vacancy') gain = index === mod(Math.floor(beats * .25), count) ? .8 : 0
  else if (pattern === 'interference') gain = .025 + .975 * Math.pow(.5 + .5 * Math.sin(beats * (.55 + index * .13) + index * 2.4), 3)
  const accent = .22 * frame.kick + .15 * frame.snare + .12 * frame.downbeat + .1 * frame.phrase
  return clamp((gain * frame.level + accent * Math.sqrt(gain)) * (1 - .85 * frame.build) + frame.drop, 0, 1.5)
}

/** Shared beat and trigger consumers, with runtime-only ownership. No detection or authored-state writes. */
export class Cinema2VacancyPerformance {
  private readonly clock = new Cinema2BeatClock()
  private readonly patterns = new Cinema2MainframePatternController<VacancyPattern>(VACANCY_PATTERNS.map(p => p.value), 'dead-air')
  private readonly seen = new Set<string>()
  private lastTimestamp: number | null = null
  private lastTime: number | null = null
  private track: string | null | undefined
  private source: string | undefined
  private generation = -1
  private audioGeneration = -1
  private authored: VacancyPattern | null = null
  private revision = -1
  private auto = false
  private lastCoverage = 1
  private suppressDrop = false
  private lastResponse = .7
  private buildKey: string | null = null
  private active: { kind: 'build' | 'drop'; until: number; key: string } | null = null
  private held = { ...VACANCY_NEUTRAL_PERFORMANCE }

  update(input: Readonly<Cinema2ModuleFrameReadContext>, c: VacancyControls, parameters: Cinema2ModuleParameterReadFacet): VacancyPerformanceFrame {
    const audio = input.transport?.sourcePresent === false ? null : selectCinema2MainframeAudio(input.audio, input.transport?.trackId)
    const fresh = audio && (!input.transport || Math.abs(audio.upstream.timeSec - input.transport.timeSec) <= .5) ? audio : null
    const director = fresh && input.director?.visualFrameId === fresh.visualFrameId && input.director.discontinuityGeneration === fresh.discontinuity.generation ? input.director : null
    const frame = { ...input, audio: fresh, director }
    const now = input.transport?.timeSec ?? fresh?.upstream.timeSec ?? input.elapsedTimeSec
    const source = fresh ? JSON.stringify([fresh.upstream.sourceId, fresh.upstream.publisherId, fresh.upstream.analysisRevision]) : this.source
    const audioGeneration = fresh?.discontinuity.generation ?? this.audioGeneration
    const reset = this.generation !== input.contextGeneration || (this.track !== undefined && this.track !== input.transport?.trackId)
      || (this.source !== undefined && source !== this.source) || (this.audioGeneration !== -1 && audioGeneration !== this.audioGeneration)
      || (this.lastTime != null && (now < this.lastTime - .05 || now > this.lastTime + 1))
    const revision = parameters.getEditRevision?.('pattern') ?? 0
    const manual = this.authored !== c.pattern || this.revision !== revision
    const paused = input.transport?.paused === true
    const playing = input.transport ? input.transport.playing && !paused : fresh != null
    const idle = !input.transport || (!paused && (!input.transport.sourcePresent || input.transport.playing))
    const dt = this.lastTimestamp == null || reset || !idle ? 0 : clamp((input.timestampMs - this.lastTimestamp) / 1000, 0, .1)
    if (reset) { this.clock.reset(); this.patterns.reset(); this.seen.clear(); this.active = null; this.buildKey = null }
    if (manual) this.patterns.reset()
    const clockFrame = { ...frame, elapsedTimeSec: 0, deltaTimeSec: dt,
      transport: input.transport ? { ...input.transport, animationActive: idle, bpm: input.transport.sourcePresent ? input.transport.bpm : null } : undefined }
    const beats = this.clock.update(clockFrame, c.bpmSync, 100).beats
    // Latch held identities without firing them when playback resumes.
    const eventFrame = frame.transport && !playing ? { ...frame, transport: { ...frame.transport, paused: false, playing: true } } : frame
    const eventIdentity = (trigger: Cinema2AfterhoursTriggerId) => {
      if (!fresh) return null
      const e = trigger === 'kick' ? fresh.rhythm.kick : trigger === 'snare' ? fresh.rhythm.snare : trigger === 'downbeat' ? fresh.rhythm.downbeat
        : trigger.startsWith('bar') ? fresh.rhythm.fixedClocks[4].boundary : trigger.startsWith('beat') ? fresh.rhythm.beat : null
      if (e && (e.timeSec < fresh.upstream.timeSec - .25 || e.timeSec > fresh.upstream.timeSec + .05)) return null
      return resolveCinema2AfterhoursTriggerEventIdentity(eventFrame, trigger, reset ? null : this.lastTime)
    }
    const rawEvent = eventIdentity(c.trigger)
    const key = rawEvent ? `${c.trigger}:${rawEvent}` : null
    const unseen = key != null && !this.seen.has(key)
    if (key) this.seen.add(key)
    const base = this.patterns.update({ authoredPattern: c.pattern, patternChange: c.patternChange,
      trigger: c.trigger, triggerEventId: ((playing && unseen) || manual || reset) ? rawEvent : null, absoluteBeat: beats, reset: reset || manual }).activePattern
    const dropId = eventIdentity('drop'), dropKey = dropId ? `performance-drop:${dropId}` : null
    const newDrop = dropKey != null && !this.seen.has(dropKey)
    if (dropKey) this.seen.add(dropKey)
    while (this.seen.size > 256) this.seen.delete(this.seen.values().next().value!)
    const building = director?.context.build.available && (director.context.build.confidence ?? 0) >= .45 && (director.context.build.value ?? 0) >= (this.buildKey ? .42 : .56)
    const buildKey = building && fresh ? JSON.stringify([fresh.discontinuity.generation, fresh.upstream.analysisRevision, director?.context.section.value?.id ?? 'build']) : null
    const newBuild = buildKey != null && buildKey !== this.buildKey
    if (reset || manual || this.auto !== c.autoPerformance || !c.autoPerformance || !fresh || (!playing && !paused)) this.active = null
    else if (!paused) {
      if (this.active && (beats >= this.active.until || (this.active.kind === 'build' && this.active.key !== buildKey))) this.active = null
      if (newDrop) this.active = { kind: 'drop', key: dropKey!, until: beats + 4 }
      else if (newBuild && this.active?.kind !== 'drop') this.active = { kind: 'build', key: buildKey!, until: beats + 8 }
    }
    const channels = { ...VACANCY_RESPONSE_DEFAULTS }
    for (const name of Object.keys(channels) as (keyof VacancyResponse)[]) {
      const value = parameters.get(name)
      if (typeof value === 'number') channels[name] = clamp(value)
    }
    const available = (signal: { available: boolean; value: unknown } | undefined) => signal?.available && typeof signal.value === 'number' && Number.isFinite(signal.value)
    const response = fresh && playing ? c.musicResponse : 0
    const energy = available(fresh?.features.overallEnergy) ? channels.audioEnergy : .5
    const build = available(fresh?.features.buildProgress) && (fresh?.structure.buildConfidence.value ?? 0) >= .45 ? channels.buildPressure : 0
    const significance = director && director.continuous.intensity.available ? channels.directorIntensity : 1
    if (manual || reset) this.suppressDrop = true
    else if (newDrop || channels.dropAccent === 0) this.suppressDrop = false
    const next: VacancyPerformanceFrame = {
      beats, timeSec: beats * .6, basePattern: base,
      pattern: this.active?.kind === 'build' ? 'vacancy' : this.active?.kind === 'drop' ? 'dead-air' : base,
      override: this.active?.kind ?? null,
      coverage: c.screensLit * (1 - .3 * response * channels.vocalRestraint),
      level: 1 + response * ((energy - .5) * .65 - .15 * (1 - significance)),
      grain: 1 + response * channels.highSparkle * .75,
      bass: response * channels.bassPressure, kick: response * channels.kickAccent, snare: response * channels.snareAccent,
      downbeat: response * channels.downbeatAccent, phrase: response * channels.phraseAccent,
      build: response * Math.max(build, director ? channels.directorBuild : 0), drop: this.suppressDrop ? 0 : response * channels.dropAccent,
      significance: 1 + response * .2 * (director ? channels.directorMomentum : 0),
    }
    if (paused && !manual && !reset) {
      // Hold motion and envelopes, but manual intensity, palette, coverage and toggles still resolve immediately.
      const ratio = this.lastResponse > 0 ? c.musicResponse / this.lastResponse : 0
      next.level = 1 + (this.held.level - 1) * ratio; next.grain = 1 + (this.held.grain - 1) * ratio
      next.kick = this.held.kick * ratio; next.snare = this.held.snare * ratio; next.downbeat = this.held.downbeat * ratio
      next.phrase = this.held.phrase * ratio; next.build = this.held.build * ratio; next.drop = this.held.drop * ratio
      const previousCoverage = this.lastCoverage > 0 ? this.held.coverage / this.lastCoverage : 1
      next.coverage = c.screensLit * clamp(1 - (1 - previousCoverage) * ratio)
      next.bass = this.held.bass * ratio; next.significance = 1 + (this.held.significance - 1) * ratio
    }
    if (c.musicResponse === 0 || !fresh) {
      next.level = 1; next.grain = 1; next.bass = next.kick = next.snare = next.downbeat = next.phrase = next.build = next.drop = 0; next.coverage = c.screensLit; next.significance = 1
    }
    if (this.suppressDrop) next.drop = 0
    this.lastCoverage = c.screensLit; this.lastResponse = c.musicResponse
    this.held = next; this.lastTimestamp = input.timestampMs; this.lastTime = now; this.track = input.transport?.trackId
    this.source = source; this.generation = input.contextGeneration; this.audioGeneration = audioGeneration
    this.authored = c.pattern; this.revision = revision; this.auto = c.autoPerformance; this.buildKey = buildKey
    return next
  }
}
