/**
 * Cinema 2.0 Mood Conductor: the shared "how does this passage feel" layer that Auto Performance builds on.
 *
 * The Visual Director already turns the audio intelligence into a phase, an intensity, a momentum, a build and a section context, and the
 * choreography runtime already turns music events into transient contributions. What a conductor needs beyond them is one coherent, smoothed
 * reading of the whole passage (is this calm, driving, tense or at its peak?) and the impact of a drop that rises at once and decays, so many
 * parameters can be moved together by the same mood instead of by a handful of unrelated accent rules. This module computes exactly that, once
 * per frame, from the frames the runtime already has:
 *
 *   - It reads only the shared audio-intelligence frame and the Visual Director's frame. It analyses no audio, and it detects no drops of its own:
 *     a drop is `cinema2CanonicalDropEvents`, the one definition the choreography `drop` signal uses.
 *   - It is available only when the director is (an analysed track, or live features); with nothing real behind it the frame is null and every
 *     rule or chooser that reads it contributes nothing, so nothing is ever invented. Section evidence is likewise only used when the section
 *     is available; without it the feel comes from the signal alone.
 *   - It is deterministic: no randomness, a pure function of the frames and the time between them. A discontinuity (seek, loop, track change)
 *     starts it again.
 *
 * Presets use the mood two ways, both gated by their own Auto Performance toggle and neither rewriting an authored value:
 *   - Continuously, as choreography sources `mood.*` (see `Cinema2ChoreographyContinuousSourcePath`), through `createCinema2MoodRules`.
 *   - For discrete choices (which pattern or program is on stage), through `Cinema2MoodChooser`, which chooses only on musical boundaries, holds
 *     what it chose, never repeats the current choice, and is a pure function of the seed, the track and the boundary.
 */

import { cinema2CanonicalDropEvents, cinema2CanonicalPhraseEvents } from '../choreography/Cinema2ChoreographyRuntime'
import type { Cinema2AudioIntelligenceFrame, Cinema2AudioSignal } from '../audio/Cinema2AudioIntelligenceBridge'
import type { Cinema2VisualDirectorFrame } from '../director/Cinema2VisualDirector'

const clamp01 = (v: number) => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0))

/** How the passage feels, from its smoothed weights: a drop's peak, tension building toward one, a calm breakdown, or everything in between. */
export type Cinema2MoodFeel = 'calm' | 'driving' | 'tense' | 'peak'

export interface Cinema2MoodFrame {
  readonly version: 1
  /** True when real evidence about the section (an analysed track) backs the feel. False means the feel came from the signal alone. */
  readonly structured: boolean
  /** Smoothed, 0..1. */
  readonly energy: number
  readonly tension: number
  readonly build: number
  readonly momentum: number
  readonly complexity: number
  /** The spectral centroid: 0 dark and heavy, 1 bright and thin. */
  readonly brightness: number
  /** How much is going on, from everything. */
  readonly activity: number
  /** Smoothed weights of how the section feels (they melt from one passage into the next). */
  readonly calm: number
  readonly drive: number
  readonly tense: number
  readonly peak: number
  /** The impact of a drop: jumps to the hit's strength on the frame it lands, then falls over about two seconds. */
  readonly shock: number
  readonly feel: Cinema2MoodFeel
  readonly section: Readonly<{ id: string | null; type: string | null; progress: number }>
  /** A drop landed on this frame (the canonical drop event) and its identity. */
  readonly drop: Readonly<{ occurred: boolean; eventId: string | null }>
  /** The musical boundary of this frame, for choosers: a drop, a section change or a phrase. Null between boundaries. */
  readonly boundary: Readonly<{ id: string; kind: 'drop' | 'section' | 'phrase' }> | null
}

/** The `mood.*` continuous paths, mapped to the frame fields they read. */
export const CINEMA2_MOOD_PATHS = Object.freeze({
  'mood.energy': 'energy',
  'mood.tension': 'tension',
  'mood.build': 'build',
  'mood.momentum': 'momentum',
  'mood.complexity': 'complexity',
  'mood.brightness': 'brightness',
  'mood.activity': 'activity',
  'mood.calm': 'calm',
  'mood.drive': 'drive',
  'mood.tense': 'tense',
  'mood.peak': 'peak',
  'mood.shock': 'shock',
} as const)
export type Cinema2MoodPath = keyof typeof CINEMA2_MOOD_PATHS

/** How each kind of section feels: calm, driving, tense and peak weights. */
const SECTION_FEEL: Readonly<Record<string, readonly [number, number, number, number]>> = Object.freeze({
  intro: [1, 0, 0, 0], verse: [.55, .45, 0, 0], build: [0, .3, .7, 0], preDrop: [0, 0, 1, 0], drop: [0, .25, 0, .75],
  breakdown: [1, 0, .1, 0], bridge: [.3, .5, .2, 0], outro: [.9, .1, 0, 0],
})
const NO_FEEL: readonly [number, number, number, number] = [0, 0, 0, 0]

const SHOCK_RELEASE_SEC = 1.7

/** A one-pole envelope: fast attack, slower release (the guide's α = 1 − e^(−Δt/τ)). */
class Follower {
  value = 0
  step(target: number, dt: number, attackSec: number, releaseSec: number): number {
    const tau = Math.max(.001, target > this.value ? attackSec : releaseSec)
    this.value += (target - this.value) * (1 - Math.exp(-dt / tau))
    return this.value
  }
}

const signal = (s: Readonly<Cinema2AudioSignal<number>> | undefined): number | null => s?.available && s.value != null && Number.isFinite(s.value) ? s.value : null
const directorValue = (s: { readonly available: boolean; readonly value: number | null } | undefined): number | null => s?.available && s.value != null && Number.isFinite(s.value) ? s.value : null

export class Cinema2MoodConductor {
  private readonly energy = new Follower()
  private readonly tension = new Follower()
  private readonly build = new Follower()
  private readonly momentum = new Follower()
  private readonly complexity = new Follower()
  private readonly brightness = new Follower()
  private readonly calm = new Follower()
  private readonly drive = new Follower()
  private readonly tense = new Follower()
  private readonly peak = new Follower()
  private shock = 0
  private previousTimeSec: number | null = null

  reset(): void {
    for (const f of [this.energy, this.tension, this.build, this.momentum, this.complexity, this.brightness, this.calm, this.drive, this.tense, this.peak]) f.value = 0
    this.brightness.value = .5
    this.shock = 0; this.previousTimeSec = null
  }

  /**
   * One frame of mood, or null when the director (and so real evidence) is not available. `deltaTimeSec` is the visual time since the last frame
   * (zero while the transport is paused, so the mood holds).
   */
  capture(audio: Readonly<Cinema2AudioIntelligenceFrame> | null, director: Readonly<Cinema2VisualDirectorFrame> | null, deltaTimeSec: number): Readonly<Cinema2MoodFrame> | null {
    if (!audio || !director) return null
    if (audio.discontinuity.occurred) this.reset()
    const dt = Math.max(0, Math.min(.1, deltaTimeSec))

    const energyNow = directorValue(director.continuous.intensity) ?? signal(audio.features.trackEnergy) ?? signal(audio.features.overallEnergy) ?? 0
    const tensionNow = signal(audio.features.tension) ?? 0
    const buildNow = directorValue(director.context.build) ?? signal(audio.features.buildProgress) ?? 0
    const momentumNow = directorValue(director.continuous.momentum) ?? signal(audio.features.spectralFlux) ?? 0
    const complexityNow = signal(audio.features.complexity) ?? 0
    const brightnessNow = signal(audio.features.spectralCentroid) ?? .5

    const energy = clamp01(this.energy.step(clamp01(energyNow), dt, .14, .8))
    const tension = clamp01(this.tension.step(clamp01(tensionNow), dt, .22, .9))
    const build = clamp01(this.build.step(clamp01(buildNow), dt, .3, .7))
    const momentum = clamp01(this.momentum.step(clamp01(momentumNow), dt, .1, .5))
    const complexity = clamp01(this.complexity.step(clamp01(complexityNow), dt, .4, 1.4))
    const brightness = clamp01(this.brightness.step(clamp01(brightnessNow), dt, .3, .9))

    // How the section feels: a section's own type when the analysis has one, else the signal alone.
    const section = director.context.section
    const structured = section.available && section.value != null && section.value.type != null
    const feelRaw = structured ? SECTION_FEEL[section.value!.type!] ?? NO_FEEL : NO_FEEL
    const calm = clamp01(this.calm.step(structured ? feelRaw[0] : clamp01(1 - energy * 1.4), dt, .6, .9))
    const drive = clamp01(this.drive.step(structured ? feelRaw[1] : clamp01(energy * 1.2 - tension * .4), dt, .5, .8))
    const tense = clamp01(this.tense.step(structured ? feelRaw[2] : tension, dt, .5, .8))

    // Drops: the canonical event. The shock rises at once and falls over about two seconds.
    const drops = cinema2CanonicalDropEvents(audio, director, this.previousTimeSec)
    const drop = drops[0] ?? null
    if (drop) this.shock = Math.max(this.shock, clamp01(Math.max(.75, drop.strength)))
    else this.shock = this.shock * Math.exp(-dt / SHOCK_RELEASE_SEC)
    if (this.shock < 1e-3) this.shock = 0
    const shock = clamp01(this.shock)
    const peakTarget = structured ? feelRaw[3] : clamp01(shock + energy - .9)
    const peak = clamp01(this.peak.step(Math.max(peakTarget, shock * .9), dt, .12, .7))

    const activity = clamp01(.4 * energy + .2 * tension + .15 * build + .15 * momentum + .2 * drive + .3 * peak + .3 * shock - .2 * calm)

    // Boundaries, for choosers: a drop, a section change, or a phrase (in that order of authority).
    const sectionId = section.available && section.value ? section.value.id : null
    const transition = director.context.transition
    let boundary: Cinema2MoodFrame['boundary'] = null
    if (drop) boundary = Object.freeze({ id: `drop:${drop.id}`, kind: 'drop' as const })
    else if (transition.occurred && transition.eventId) boundary = Object.freeze({ id: `section:${transition.eventId}`, kind: 'section' as const })
    else {
      const phrases = cinema2CanonicalPhraseEvents(audio, this.previousTimeSec)
      if (phrases[0]) boundary = Object.freeze({ id: `phrase:${phrases[0].id}`, kind: 'phrase' as const })
    }
    this.previousTimeSec = audio.upstream.timeSec

    const feel: Cinema2MoodFeel = peak > .45 || shock > .45 ? 'peak' : tense > .45 ? 'tense' : calm > .55 ? 'calm' : 'driving'
    return Object.freeze({
      version: 1 as const, structured, energy, tension, build, momentum, complexity, brightness, activity, calm, drive, tense, peak, shock, feel,
      section: Object.freeze({ id: sectionId, type: structured ? section.value!.type : null, progress: section.available && section.value ? clamp01(section.value.progress) : 0 }),
      drop: Object.freeze({ occurred: drop != null, eventId: drop?.id ?? null }),
      boundary,
    })
  }
}

// ── Discrete choices ─────────────────────────────────────────────────────────

export interface Cinema2MoodChooserConfig<T extends string> {
  /** The choices that suit each feel. The current choice is never repeated while another is available. */
  readonly options: Readonly<Record<Cinema2MoodFeel, readonly T[]>>
  /** Seconds a choice is held before the next boundary may change it (a drop always may). */
  readonly minHoldSec?: number
}

/**
 * Chooses among a preset's own options (patterns, programs, looks) by the passage's feel. It changes only on a musical boundary the mood reports,
 * holds a choice for a minimum time unless a drop lands, never repeats the current one, and picks by a pure hash of the seed, the track and the
 * boundary, so the same track and seed always give the same show. It does nothing without a mood frame, so it never invents structure.
 */
export class Cinema2MoodChooser<T extends string> {
  private clock = 0
  private since = -Infinity

  constructor(private readonly config: Readonly<Cinema2MoodChooserConfig<T>>) {}

  reset(): void { this.clock = 0; this.since = -Infinity }

  /** The new choice on this frame, or null when nothing changes. `current` is what is on stage now. */
  update(mood: Readonly<Cinema2MoodFrame> | null, current: T | null, deltaTimeSec: number, seed: string): T | null {
    this.clock += Math.max(0, deltaTimeSec)
    if (!mood || !mood.boundary) return null
    const isDrop = mood.boundary.kind === 'drop'
    if (!isDrop && this.clock - this.since < (this.config.minHoldSec ?? 4)) return null
    const pool = this.config.options[mood.feel].filter(option => option !== current)
    if (pool.length === 0) return null
    const picked = pool[hashIndex(pool.length, `${seed}|${mood.boundary.id}|${mood.feel}`)]
    this.since = this.clock
    return picked ?? null
  }
}

/** A stable index in [0, length) from a string (FNV-1a), the same hash everywhere so a given seed always gives the same choice. */
export function hashIndex(length: number, text: string): number {
  if (length <= 1) return 0
  let hash = 2166136261
  for (let i = 0; i < text.length; i++) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 16777619) }
  return (hash >>> 0) % length
}

