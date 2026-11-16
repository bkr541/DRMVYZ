// Sound Drawing XY › standard presets (Converse, Clean Scope, Storm and their TEXT / SVG / OSCILATOR sources): Auto Performance.
//
// What Auto Performance means in Sound Drawing XY, here as everywhere: with it on, the audio intelligence conducts the instrument (the track's
// energy, builds, drops and breakdowns, and where it is in its sections and phrases) instead of leaving every value to the sliders. The
// user's values stay the baseline: each driven value is the user's, moved by a bounded, smoothed amount, and with it off, or with nothing
// playing, the user's values are used exactly. Nothing is random, and a live microphone (which has no sections or phrases) never gets any
// invented: the pattern then stays the one the user chose, and only the signal's own level moves the values.
//
// What it drives: the pattern (chosen at section entries, phrases and drops, from the patterns that suit the passage), Transition Length,
// Motion Amount, Form Response, Line Vibration, Snare Fray, Answer Delay, Glow, Phosphor Trail and Master Intensity.
// What it never touches: Audio Reactivity, BPM Sync, the letters (size, spacing), the response sliders, the colours and the trigger.

import { selectPerformanceDeterministicIndex, type SharedPerformanceContext } from '../../../../features/performanceCore'
import { osc1StructureFromContext } from './XyScopeOsc1Performance'
import type { XyScopePattern } from './XyScopePatterns'
import { getXyScopeParameterDefinition, type XyScopeResolvedParameters } from './XyScopeSettings'

const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v))
const mix = (a: number, b: number, p: number) => a + (b - a) * p

/** The values Auto Performance drives (the others pass through exactly). */
export const STANDARD_AUTO_KEYS = ['intensity', 'motionAmount', 'formResponse', 'vibration', 'dissolveDepth', 'glow', 'trailMs', 'answerDelayMs', 'transitionBeats'] as const
type AutoKey = (typeof STANDARD_AUTO_KEYS)[number]

/** The parameter definition behind each driven value, for its range. */
const RANGE_SOURCE: Readonly<Record<AutoKey, string | null>> = {
  intensity: 'intensity', motionAmount: 'motionAmount', formResponse: 'formResponse', vibration: 'vibration', dissolveDepth: 'dissolveDepth', glow: 'glow',
  trailMs: 'trail', answerDelayMs: 'answerDelay', transitionBeats: null,
}
function rangeOf(key: AutoKey): readonly [number, number] {
  const id = RANGE_SOURCE[key]
  const definition = id ? getXyScopeParameterDefinition(id) : undefined
  return definition?.kind === 'slider' ? [definition.min, definition.max] : [.5, 4]
}

export type StandardFeel = 'LISTENING' | 'CALM' | 'GROOVE' | 'BUILD' | 'DROP'

/** The patterns that suit each kind of passage (the first of a section is chosen from these; the current one is never repeated). */
const POOL: Readonly<Record<Exclude<StandardFeel, 'LISTENING'>, readonly XyScopePattern[]>> = Object.freeze({
  DROP: ['pinwheel', 'rosette', 'scope', 'ring'],
  BUILD: ['ring', 'weave', 'waveform', 'rosette'],
  GROOVE: ['weave', 'ring', 'scope', 'waveform', 'word'],
  CALM: ['word', 'waveform', 'scope'],
})

/** Seconds a pattern is held at least before the next choice, unless a drop lands. */
const MIN_HOLD_SEC = 4

export interface StandardAutoInput {
  dt: number
  playing: boolean
  base: XyScopeResolvedParameters
  context: SharedPerformanceContext | null
  /** The raw level of the signal 0..1 (used when no analysed track backs the structure). */
  level: number
}

export class StandardAutoPerformance {
  private effective: Record<AutoKey, number> | null = null
  private pattern: XyScopePattern | null = null
  private since = 0
  private lastPhrase = -1
  private lastDrops = -1
  private lastSection = ''
  private lastEight = ''
  private time = 0
  /** For the inspector and the tests. */
  feel: StandardFeel = 'LISTENING'
  mapped = false

  reset(): void {
    this.effective = null; this.pattern = null; this.since = 0; this.lastPhrase = -1; this.lastDrops = -1; this.lastSection = ''; this.lastEight = ''; this.time = 0
    this.feel = 'LISTENING'; this.mapped = false
  }

  update(input: StandardAutoInput): XyScopeResolvedParameters {
    const { dt, base, context } = input
    this.time += dt
    if (!input.playing) {
      // Nothing playing: the user's values, exactly, and a clean start next time.
      this.reset()
      return base
    }
    const structure = osc1StructureFromContext(context)
    this.mapped = structure != null
    const energy = structure ? structure.energy : clamp(input.level * 1.4)
    const build = structure ? structure.build : 0
    const drop = structure ? structure.drop : 0
    const calm = structure ? structure.breakdown : clamp(1 - energy * 1.6)
    this.feel = drop > .35 ? 'DROP' : build > .4 ? 'BUILD' : calm > .55 ? 'CALM' : energy > .12 ? 'GROOVE' : 'LISTENING'

    // ── The values: the user's, moved by the music within each control's own range.
    const target: Record<AutoKey, number> = {
      intensity: base.intensity * (.85 + .25 * energy + .2 * drop),
      motionAmount: base.motionAmount * (.6 + .8 * energy + .5 * drop - .2 * calm),
      formResponse: base.formResponse * (.7 + .6 * energy + .5 * drop),
      vibration: base.vibration * (.7 + .4 * energy + .6 * drop),
      dissolveDepth: base.dissolveDepth * (.6 + .5 * build + .7 * drop - .2 * calm),
      glow: base.glow * (.75 + .4 * energy + .7 * drop),
      trailMs: base.trailMs * (1.3 - .5 * energy + .4 * calm),
      answerDelayMs: base.answerDelayMs * (1.25 - .5 * drop - .2 * energy),
      transitionBeats: base.transitionBeats * (1.5 - .8 * drop - .3 * energy + .6 * calm),
    }
    if (!this.effective) this.effective = { intensity: base.intensity, motionAmount: base.motionAmount, formResponse: base.formResponse, vibration: base.vibration, dissolveDepth: base.dissolveDepth, glow: base.glow, trailMs: base.trailMs, answerDelayMs: base.answerDelayMs, transitionBeats: base.transitionBeats }
    const eff = this.effective
    for (const key of STANDARD_AUTO_KEYS) {
      const [lo, hi] = rangeOf(key)
      const wanted = clamp(target[key], lo, hi)
      // Rises are quick (a drop opens the scene at once) and falls are slower.
      const tau = wanted > eff[key] ? .14 : .5
      eff[key] = mix(eff[key], wanted, 1 - Math.exp(-dt / tau))
    }

    // ── The pattern: chosen on musical boundaries only, from those that suit the passage.
    if (this.pattern == null) this.pattern = base.pattern
    const boundary = this.boundary(context)
    if (boundary && (this.time - this.since >= MIN_HOLD_SEC || boundary.drop)) {
      const feel = this.feel === 'LISTENING' ? 'GROOVE' : this.feel
      const pool = POOL[feel].filter(p => p !== this.pattern)
      const pick = pool[selectPerformanceDeterministicIndex(pool.length, 'xy-standard', context?.deterministicVariationSeed ?? 0, context?.sectionIdentity ?? '', boundary.id)]
      if (pick) { this.pattern = pick; this.since = this.time }
    }

    return {
      ...base,
      pattern: this.pattern, patternChange: false,
      intensity: eff.intensity, motionAmount: eff.motionAmount, formResponse: eff.formResponse, vibration: eff.vibration, dissolveDepth: eff.dissolveDepth,
      glow: eff.glow, trailMs: eff.trailMs, answerDelayMs: eff.answerDelayMs, transitionBeats: eff.transitionBeats,
    }
  }

  /**
   * A musical boundary this frame, or null: a section entry, a new phrase, a drop, and with no section structure only the eight-bar boundaries the
   * beat grid vouches for. A live microphone gives none, so the pattern never changes on its own there.
   */
  private boundary(context: SharedPerformanceContext | null): { id: string; drop: boolean } | null {
    if (!context) return null
    let found: { id: string; drop: boolean } | null = null
    const drops = context.dropOccurrence
    if (this.lastDrops >= 0 && drops > this.lastDrops) found = { id: `drop:${drops}`, drop: true }
    this.lastDrops = drops
    const phrase = context.phraseIndex
    if (!found && this.lastPhrase >= 0 && phrase !== this.lastPhrase) found = { id: `phrase:${phrase}`, drop: false }
    this.lastPhrase = phrase
    const section = context.sectionIdentity
    if (!found && this.lastSection !== '' && section !== this.lastSection && context.boundaries.sectionEntry) found = { id: `section:${section}`, drop: false }
    this.lastSection = section
    if (!found && !context.capabilities.sections && context.capabilities.beatGrid && context.boundaries.eightBarBoundary) {
      const id = `bar8:${context.barIndex}`
      if (id !== this.lastEight) found = { id, drop: false }
      this.lastEight = id
    }
    return found
  }
}
