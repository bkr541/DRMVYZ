// Sound Drawing XY › WIREFRAME: the conductor behind Auto Performance. Where the director (XyScopeWireDirector) chooses how the cluster
// moves and when it breaks apart, the conductor decides how the whole instrument looks and behaves from everything the music says:
// track-relative energy, tension, build, drop impact, complexity, spectral flux, the band balance, the section and phrase the track is in
// (and how far through them), the key and mode, and the tempo.
//
// The user's settings are the baseline. Every driven control is the user's value moved by a bounded, smoothed amount that comes from the
// mood, so turning a slider still moves the whole show up or down, and turning Auto Performance off returns the user's values exactly. A
// few controls are never driven, on purpose: the safety limits (Flash Limit, Readability Floor, Max Displacement, Minimum Readable Time),
// the master controls (Master Intensity, Audio Reactivity, BPM Sync, Attack, Release), how often scenes change, the seed, Scan Frequency
// and the background colour. Everything else (the figure itself, the camera, the beam, the lines, the oscillators, the chaos, the
// responses and the colours) follows the music.
//
// Honesty rules, as everywhere in WIREFRAME: a live microphone has no sections, phrases or key, so none are invented there. The conductor
// then works from the live signal alone (level, flux, band balance), and the discrete choices change only on bars the beat grid vouches for.
// Nothing is random: the same track, seed and boundary always make the same choice.

import { performanceDeterministicUnit } from '../../../../features/performanceCore'
import { Envelope } from './XyScopeWireModulation'
import { WIRE_RANGES, type WireNumberKey, type WireValues } from './XyScopeWireSettings'
import type { WireBoundaries } from './XyScopeWireDirector'
import type { WireFigureId } from './XyScopeWireShape'
import { WIRE_BACKGROUND_LAYERS, type WireBackgroundId } from './XyScopeWireBackground'
import { WIRE_TRANSITION_KINDS, type WireTransitionKind } from './XyScopeWireTransitions'

const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v))
const smoothstep = (t: number) => { const x = clamp(t); return x * x * (3 - 2 * x) }

/** What the music says right now. Every field is 0..1 unless noted; fields the source cannot know are neutral and `structured` says so. */
export interface WireMood {
  /** Track-relative energy (against the track's own range when it is analysed). */
  energy: number
  /** The raw level of the signal. */
  level: number
  tension: number
  /** Progress through a build (0 when none). */
  build: number
  /** How hard a drop is landing (0 between drops). */
  drop: number
  complexity: number
  flux: number
  /** Share of the spectrum in the highs against the lows: 0 dark and heavy, 1 bright and thin. */
  brightness: number
  tempo: number | null
  /** 0..11 from C, or null when the key is not known with confidence. */
  keyIndex: number | null
  minor: boolean | null
  sectionType: string | null
  sectionProgress: number
  phraseIndex: number
  phraseProgress: number
  /** True when an analysed track backs the section and phrase fields. A live microphone never does. */
  structured: boolean
  confidence: number
}

export const NEUTRAL_MOOD: Readonly<WireMood> = Object.freeze({
  energy: 0, level: 0, tension: 0, build: 0, drop: 0, complexity: 0, flux: 0, brightness: .5, tempo: null, keyIndex: null, minor: null,
  sectionType: null, sectionProgress: 0, phraseIndex: 0, phraseProgress: 0, structured: false, confidence: 0,
})

/** The controls Auto Performance may move (each by a bounded amount around the user's own value). */
export const WIRE_DRIVEN_KEYS: readonly (keyof WireValues)[] = Object.freeze([
  'figure', 'background', 'backgroundAmount', 'transition', 'satellites', 'size', 'spread', 'perspective', 'tilt', 'spin', 'hiddenEdges', 'depthCue', 'duplicates', 'outline',
  'width', 'glow', 'trail', 'travel',
  'waveAmount', 'waveDepth', 'waveDetail', 'waveOscillator', 'chaos',
  'bassResponse', 'midResponse', 'lowMidResponse', 'airResponse', 'kickResponse', 'snareResponse',
  'color', 'glowColor',
] as const)
/** The controls it never touches, and why (shown in the inspector). */
export const WIRE_MANUAL_NOTE = 'Never driven: Master Intensity, Audio Reactivity, BPM Sync, Flash Limit, Readability Floor, Max Displacement, Minimum Readable Time, Attack, Release, Scene Change, Variation Seed, Scan Frequency and Background. They are yours, or they are safety limits.'

export interface ConductorInput {
  dt: number
  playing: boolean
  auto: boolean
  mood: Readonly<WireMood>
  base: Readonly<WireValues>
  boundaries: Readonly<WireBoundaries>
  /** A confident drop began this frame. */
  drop: boolean
  gridConfident: boolean
  trackIdentity: string | null
  seed: number
  /** A seek, loop or track change: choices start again. */
  discontinuity: boolean
}

export interface ConductorOutput {
  /** The values to draw with: the user's, moved by the music while Auto Performance is on; exactly the user's when it is off. */
  values: WireValues
  figure: WireFigureId
  /** The smoothed mood the values came from (for the inspector). */
  mood: WireMood
  /** What kind of passage the conductor thinks this is. */
  feel: 'CALM' | 'DRIVING' | 'TENSE' | 'PEAK'
  driving: boolean
  /** The impact of a drop landing, 1 at the hit, falling over about two seconds (0 otherwise). */
  shock?: number
}

// ── Colour ───────────────────────────────────────────────────────────────────

function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255, g = parseInt(hex.slice(3, 5), 16) / 255, b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min
  if (d === 0) return [0, 0, l]
  const s = d / (1 - Math.abs(2 * l - 1))
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  h = (h * 60 + 360) % 360
  return [h, s, l]
}

function hslToHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s, hp = ((h % 360) + 360) % 360 / 60, x = c * (1 - Math.abs(hp % 2 - 1)), m = l - c / 2
  const [r, g, b] = hp < 1 ? [c, x, 0] : hp < 2 ? [x, c, 0] : hp < 3 ? [0, c, x] : hp < 4 ? [0, x, c] : hp < 5 ? [x, 0, c] : [c, 0, x]
  const to = (v: number) => Math.round(clamp(v + m) * 255).toString(16).padStart(2, '0')
  return `#${to(r)}${to(g)}${to(b)}`
}

/** The user's colour, its hue turned by the key (and a little by the mode), its lightness raised by energy and its colour deepened by tension. */
export function conductColor(hex: string, shiftDeg: number, energy: number, tension: number): string {
  const [h, s, l] = hexToHsl(hex)
  return hslToHex(h + shiftDeg, clamp(s + .18 * (tension - .3), 0, 1), clamp(l + .1 * (energy - .5), .08, .9))
}

// ── Sections ─────────────────────────────────────────────────────────────────

/** How each kind of section feels: calm, driving, tense and peak weights. */
const SECTION_FEEL: Readonly<Record<string, readonly [calm: number, drive: number, tense: number, peak: number]>> = Object.freeze({
  intro: [1, 0, 0, 0], verse: [.55, .45, 0, 0], build: [0, .3, .7, 0], preDrop: [0, 0, 1, 0], drop: [0, .25, 0, .75],
  breakdown: [1, 0, .1, 0], bridge: [.3, .5, .2, 0], outro: [.9, .1, 0, 0],
})
const NO_FEEL: readonly [number, number, number, number] = [0, 0, 0, 0]

/** Which figure suits a passage, as a score per figure from the smoothed mood. */
function figureScores(calm: number, activity: number, tension: number, complexity: number, peak: number): Record<WireFigureId, number> {
  return {
    cubes: .35 + .9 * calm + .4 * (1 - activity) - .3 * peak,
    solids: .45 + .5 * complexity + .35 * activity + .2 * tension,
    tesseract: .1 + .85 * peak + .7 * tension + .35 * complexity + .2 * activity - .4 * calm,
  }
}

/** The most Auto Performance takes these to while a passage is sustained at its peak. A drop's impact (the shock below) briefly goes past them, up to each control's own maximum. */
const PEAK_DEPTH = .42
const PEAK_DETAIL = 10
const PEAK_CHAOS = .9

const FIGURES: readonly WireFigureId[] = ['cubes', 'solids', 'tesseract']

export class WireConductor {
  private readonly env = new Map<string, Envelope>()
  private figure: WireFigureId = 'cubes'
  private figureSince = 0
  private background: WireBackgroundId = 'floor'
  private backgroundSince = 0
  private transition: WireTransitionKind = 'glitch'
  private lastTransition: WireTransitionKind | null = null
  private shock = new Envelope()
  private lastBoundary = ''
  private lastPhrase = -1
  private satellites = -1
  private duplicates = -1
  private hidden: WireValues['hiddenEdges'] = 'dim'
  private travel: WireValues['travel'] = 'blank'
  private outline = true
  private hue = 0
  private tilt = 0
  private tiltTarget = 0
  private spinSign = 1
  private spinDir = 1
  private wasAuto = false
  private time = 0

  reset(): void {
    this.env.clear(); this.figure = 'cubes'; this.figureSince = 0; this.backgroundSince = 0; this.shock.reset(); this.lastBoundary = ''; this.lastPhrase = -1
    this.satellites = -1; this.duplicates = -1; this.hue = 0; this.tilt = 0; this.tiltTarget = 0; this.spinSign = 1; this.spinDir = 1; this.time = 0
  }

  private smooth(id: string, target: number, dt: number, attackMs: number, releaseMs: number): number {
    const e = this.env.get(id) ?? this.env.set(id, new Envelope()).get(id)!
    return e.step(target, dt, attackMs, releaseMs)
  }

  update(input: ConductorInput): ConductorOutput {
    const { dt, base, mood } = input
    if (input.discontinuity) this.reset()
    // Off: the user's values exactly, and the next time it is switched on it starts from a clean state.
    if (!input.auto) {
      this.wasAuto = false
      this.figure = base.figure
      return { values: base as WireValues, figure: base.figure, mood: { ...mood }, feel: 'CALM', driving: false }
    }
    if (!this.wasAuto) {
      this.reset(); this.wasAuto = true; this.figure = base.figure; this.background = base.background
      this.transition = base.transition === 'auto' || base.transition === 'cut' ? 'glitch' : base.transition
    }
    this.time += dt
    const playing = input.playing

    // ── The smoothed mood. Rises are quick, falls are slower, and a drop's impact is nearly instant.
    const m: WireMood = { ...mood }
    m.energy = this.smooth('energy', playing ? mood.energy : 0, dt, 140, 800)
    m.tension = this.smooth('tension', playing ? mood.tension : 0, dt, 220, 900)
    m.build = this.smooth('build', playing ? mood.build : 0, dt, 300, 700)
    m.drop = this.smooth('drop', playing ? mood.drop : 0, dt, 30, 500)
    m.complexity = this.smooth('complexity', playing ? mood.complexity : 0, dt, 400, 1400)
    m.flux = this.smooth('flux', playing ? mood.flux : 0, dt, 40, 260)
    m.brightness = this.smooth('brightness', playing ? mood.brightness : .5, dt, 300, 900)

    // How the section feels, smoothed so one section melts into the next. Without section evidence the feel comes from the signal alone.
    const feelRaw = mood.sectionType ? SECTION_FEEL[mood.sectionType] ?? NO_FEEL : NO_FEEL
    const live = !mood.structured || !mood.sectionType
    const calm = this.smooth('calm', live ? clamp(1 - m.energy * 1.4) : feelRaw[0], dt, 600, 900)
    const drive = this.smooth('drive', live ? clamp(m.energy * 1.2 - m.tension * .4) : feelRaw[1], dt, 500, 800)
    const tense = this.smooth('tense', live ? m.tension : feelRaw[2], dt, 500, 800)
    const peak = this.smooth('peak', live ? clamp(m.drop + m.energy - .9) : feelRaw[3], dt, 120, 700)
    // Within a phrase the tension climbs toward its end and resets at the next one (only where phrases are real).
    const arc = mood.structured || mood.phraseProgress > 0 ? smoothstep(mood.phraseProgress) : 0
    // Activity: how much is going on, from everything.
    const activity = clamp(.4 * m.energy + .2 * m.tension + .15 * m.build + .3 * m.drop + .15 * m.flux + .2 * drive + .3 * peak - .2 * calm)
    const tens = clamp(m.tension + .25 * tense + .15 * arc * (1 - calm))

    // ── Discrete choices happen on musical boundaries (a drop is one), never between them.
    const fired = input.boundaries.id !== '' && input.boundaries.id !== this.lastBoundary
    const boundary = fired && (input.boundaries.section || input.boundaries.phrase || (input.gridConfident && input.boundaries.bar8))
    // The shock of a drop landing (or a drop section beginning): everything jumps well past its sustained level, then falls back over a couple of seconds.
    if (input.drop || (boundary && input.boundaries.section && mood.sectionType === 'drop')) this.shock.hit(clamp(Math.max(mood.drop, .75)))
    const shock = this.shock.step(0, dt, 10, 1700)
    if (boundary || input.drop) {
      this.lastBoundary = input.boundaries.id
      // A drop is a moment the smoothed mood has not caught up with yet, so the choice reads the music as it is on that frame.
      const now = input.drop
      const [c, a, t, p] = [now ? 0 : calm, now ? Math.max(activity, mood.energy, mood.drop) : activity, now ? Math.max(tens, mood.tension) : tens, now ? Math.max(peak, mood.drop) : peak]
      this.chooseTransition(input, c, a, t, p)
      this.chooseFigure(input, m, c, a, t, p)
      this.chooseBackground(input, c, a, t, p)
    }
    if (mood.phraseIndex !== this.lastPhrase) {
      this.lastPhrase = mood.phraseIndex
      // A new phrase picks a new view angle and turning direction (seeded: the same track and phrase always make the same choice).
      const unit = (k: string) => performanceDeterministicUnit('wire-conductor', input.seed, input.trackIdentity ?? 'live', mood.phraseIndex, k)
      this.tiltTarget = (unit('tilt') - .5) * 44
      // The turn reverses on some phrases, but never as a drop lands: easing through a stop would take the force out of the hit.
      if (shock < .15) this.spinSign = unit('spin') < .22 ? -1 : 1
    }
    this.tilt += (this.tiltTarget - this.tilt) * (1 - Math.exp(-dt / 1.6))

    // ── The values. Sustained levels come from the smoothed mood; the shock adds a short, much bigger jump on a drop (up to each control's own maximum).
    const out: WireValues = { ...base }
    const set = (key: WireNumberKey, value: number) => {
      const [lo, hi] = WIRE_RANGES[key]
      const clamped = Math.min(hi, Math.max(lo, value))
      ;(out as unknown as Record<string, number>)[key] = clamped
    }
    const b = base
    const lowHeavy = 1 - m.brightness
    // The turning direction eases through a stop to reverse at a new phrase, never jumping.
    this.spinDir += (this.spinSign - this.spinDir) * (1 - Math.exp(-dt / .9))
    set('spin', b.spin * (.4 + 1.3 * activity + .8 * m.drop) * (1 + 1.6 * shock))
    out.spin *= this.spinDir
    set('spread', b.spread * (.8 + .35 * m.build + .4 * activity + .4 * m.drop + .35 * shock))
    set('size', b.size * (.94 + .08 * m.energy + .1 * shock))
    set('perspective', b.perspective + .3 * (tens - .3) + .2 * m.drop + .25 * shock)
    set('tilt', b.tilt + this.tilt + 14 * m.build - 8 * calm + 14 * shock)
    set('depthCue', b.depthCue + .2 * calm - .1 * m.drop)
    set('waveAmount', b.waveAmount * (.5 + 1 * activity + .6 * m.drop) + .3 * shock)
    // Sustained peaks are capped below the control's own maximum so the figures stay readable; only the brief shock goes past the cap.
    set('waveDepth', Math.min(PEAK_DEPTH, b.waveDepth * (.55 + .6 * tens + .5 * m.drop + .2 * m.flux)) + .2 * shock)
    set('waveDetail', Math.min(PEAK_DETAIL, b.waveDetail * (.6 + .8 * m.complexity + .5 * m.brightness)) + 3 * shock)
    out.waveDetail = Math.round(out.waveDetail)
    set('waveOscillator', b.waveOscillator + .35 * (m.brightness - .5) + .15 * calm)
    set('chaos', Math.min(PEAK_CHAOS, b.chaos * (.4 + .8 * tens) + .3 * m.drop + .15 * m.flux + .15 * arc - .3 * calm) + .5 * shock)
    set('width', b.width * (.85 + .55 * m.drop + .2 * m.energy + .6 * shock))
    set('glow', b.glow * (.7 + .6 * m.energy + .9 * m.drop + 1 * shock))
    set('trail', b.trail * (1.3 - .6 * activity + .5 * calm))
    set('kickResponse', b.kickResponse * (.7 + .7 * activity + .8 * m.drop + .5 * shock))
    set('snareResponse', b.snareResponse * (.7 + .5 * m.flux + .5 * activity + .3 * shock))
    set('bassResponse', b.bassResponse * (.6 + .8 * lowHeavy + .4 * shock))
    set('lowMidResponse', b.lowMidResponse * (.7 + .6 * lowHeavy))
    set('midResponse', b.midResponse * (.7 + .6 * m.complexity))
    set('airResponse', b.airResponse * (.6 + .9 * m.brightness))
    set('backgroundAmount', b.backgroundAmount * (.5 + .9 * activity + .5 * m.drop) + .3 * shock)

    // Whole-number choices change only when the wanted value moves a full step away (so a figure never flickers between two counts).
    // On the frame a drop lands the smoothed mood has not caught up, so the count reads the music as it is.
    const cx = input.drop ? Math.max(m.complexity, mood.complexity) : m.complexity, ax = input.drop ? Math.max(activity, mood.energy) : activity
    const wantSatellites = b.satellites + (cx - .5) * 2.4 + (ax - .5) * 1.2 + 2 * shock
    if (this.satellites < 0) this.satellites = Math.round(b.satellites)
    if (Math.abs(wantSatellites - this.satellites) >= 1.15 && (boundary || input.drop || this.satellites < 0)) this.satellites = Math.round(wantSatellites)
    out.satellites = Math.round(clamp(this.satellites, WIRE_RANGES.satellites[0], WIRE_RANGES.satellites[1]))
    // At most one or two extra echoes: more than that blurs the figures into each other.
    const wantDuplicates = b.duplicates + (m.build > .45 || m.drop > .35 ? 1 : 0) + (shock > .4 ? 1 : 0)
    if (this.duplicates < 0) this.duplicates = Math.round(b.duplicates)
    if (Math.abs(wantDuplicates - this.duplicates) >= .9) this.duplicates = Math.round(wantDuplicates)
    out.duplicates = Math.round(clamp(this.duplicates, WIRE_RANGES.duplicates[0], WIRE_RANGES.duplicates[1]))

    // Switches, with a gap between on and off (a Schmitt trigger) so they do not chatter.
    if (m.drop > .5 || (chaosActive(out.chaos) && activity > .7)) this.hidden = 'show'; else if (activity < .5) this.hidden = 'dim'
    if (m.drop > .55) this.travel = 'visible'; else if (calm > .6 && activity < .35) this.travel = 'dim'; else if (m.drop < .2) this.travel = 'blank'
    if (activity > .65) this.outline = false; else if (activity < .45) this.outline = true
    out.hiddenEdges = this.hidden; out.travel = this.travel; out.outline = this.outline
    out.figure = this.figure; out.background = this.background; out.transition = this.transition

    // Colour: the user's hue turned by the key (up to 60° either way, a minor key a little cooler), and its lightness and depth by the music.
    const shiftTarget = mood.keyIndex != null ? ((mood.keyIndex / 12) - .5) * 120 - (mood.minor ? 18 : 0) : 0
    this.hue += (shiftTarget - this.hue) * (1 - Math.exp(-dt / 1.2))
    out.color = conductColor(b.color, this.hue, m.energy, tens)
    out.glowColor = conductColor(b.glowColor, this.hue, m.energy * .8, tens)

    const feel: ConductorOutput['feel'] = peak > .45 ? 'PEAK' : tense > .45 ? 'TENSE' : calm > .55 ? 'CALM' : 'DRIVING'
    return { values: out, figure: this.figure, mood: m, feel, driving: true, shock }
  }

  /** Picks the transition for the change that is starting (all four styles are in play; the previous one is disfavoured so it never repeats by accident). */
  private chooseTransition(input: ConductorInput, calm: number, activity: number, tension: number, peak: number): void {
    const scores: Record<WireTransitionKind, number> = {
      shatter: .3 + .9 * peak + .3 * tension, zoom: .3 + .7 * peak + .4 * activity, glitch: .3 + .8 * tension + .2 * activity, morph: .35 + .9 * calm + .3 * (1 - activity),
    }
    let best = this.transition, bestScore = -Infinity
    for (const kind of WIRE_TRANSITION_KINDS) {
      const nudge = performanceDeterministicUnit('wire-transition', input.seed, input.trackIdentity ?? 'live', input.boundaries.id, kind)
      const score = scores[kind] + (kind === this.lastTransition ? -.25 : 0) + nudge * .2
      if (score > bestScore) { bestScore = score; best = kind }
    }
    this.transition = best; this.lastTransition = best
  }

  /** Picks the background (all four layers, or all of them at a peak). It holds for at least four seconds unless a drop lands. */
  private chooseBackground(input: ConductorInput, calm: number, activity: number, tension: number, peak: number): void {
    if (this.time - this.backgroundSince < 4 && !input.drop) return
    const scores: Record<Exclude<WireBackgroundId, 'none'>, number> = {
      tunnel: .3 + .7 * (tension + peak) / 2 + .3 * activity, floor: .4 + .5 * activity + .3 * calm, shells: .3 + .8 * calm + .2 * (1 - activity), stars: .2 + .6 * peak + .3 * activity,
      all: .1 + 1.1 * peak,
    }
    let best: WireBackgroundId = this.background, bestScore = -Infinity
    for (const id of [...WIRE_BACKGROUND_LAYERS, 'all'] as const) {
      const nudge = performanceDeterministicUnit('wire-background', input.seed, input.trackIdentity ?? 'live', input.boundaries.id, id)
      const score = scores[id] + (id === this.background ? -.15 : 0) + nudge * .15
      if (score > bestScore) { bestScore = score; best = id }
    }
    if (best !== this.background) { this.background = best; this.backgroundSince = this.time }
  }

  /** Picks the figure for the passage that is starting. It holds for at least one phrase's worth of boundaries and never repeats by accident. */
  private chooseFigure(input: ConductorInput, m: WireMood, calm: number, activity: number, tension: number, peak: number): void {
    const since = this.time - this.figureSince
    if (since < 6 && !input.drop) return
    const scores = figureScores(calm, activity, tension, m.complexity, peak)
    // A seeded nudge breaks ties (the same track, seed and boundary always give the same one); the previous choice is slightly disfavoured.
    let best = this.figure, bestScore = -Infinity
    FIGURES.forEach(figure => {
      const nudge = performanceDeterministicUnit('wire-figure-nudge', input.seed, input.trackIdentity ?? 'live', input.boundaries.id, figure)
      const score = scores[figure] + (figure === this.figure ? -.12 : 0) + nudge * .12
      if (score > bestScore) { bestScore = score; best = figure }
    })
    if (best !== this.figure) { this.figure = best; this.figureSince = this.time }
  }
}

function chaosActive(chaos: number): boolean { return chaos > .6 }
