// Sound Drawing XY › WIREFRAME: the choreography director. It is a small state machine (the guide's §24, the architecture's lifecycle):
//
//   READABLE ─ hit → ACCENT ─ release → READABLE
//   READABLE ─ rising structure → BUILD ─ confident drop → ABSTRACT ─ time → REASSEMBLE ─ done → READABLE
//   any state ─ silence or stop → REST (settling)
//
// Rules it keeps, because the guide is firm about them:
//   - Nothing is random. A new scene is chosen only on a musical boundary, from the preset's seed, the track and the boundary's identity,
//     so the same track and seed give the same show, and a recency filter keeps it from repeating itself.
//   - It never invents song structure. A live microphone carries no sections or phrases, so there the director has no BUILD or ABSTRACT, and
//     scenes change only on bar boundaries the beat grid vouches for (or not at all).
//   - Abstraction is bounded. It needs structural evidence above a confidence floor, a drop boundary, and enough readable time recently; it
//     lasts a fixed, short time; and it always ends by reassembling to the original figure exactly.

import { selectPerformanceDeterministicIndex } from '../../../../features/performanceCore'

const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v))
const mix = (a: number, b: number, p: number) => a + (b - a) * p
const smooth = (t: number) => { const x = clamp(t); return x * x * (3 - 2 * x) }

export type WireState = 'READABLE' | 'ACCENT' | 'BUILD' | 'ABSTRACT' | 'REASSEMBLE' | 'REST'
export type WireSceneCadence = 'section' | 'phrase' | 'bar8' | 'bar4'

/** A scene is how the cluster moves: all values are multipliers on the user's own settings, so the baseline is always the user's. */
export interface WireScene {
  id: string
  /** How fast the satellites orbit. */
  orbit: number
  /** How far apart the cubes sit. */
  spread: number
  /** How much each cube turns on its own axes. */
  tumble: number
  /** How much the cubes swell and settle. */
  breathe: number
  /** Extra subordinate copies (the duplicator), added to the user's count. */
  echo: number
  /** The kinds of section this scene suits. A scene is chosen from those that suit the section the track is in, when it has one. */
  suits?: readonly string[]
}
export const BASE_SCENE: WireScene = Object.freeze({ id: 'base', orbit: 1, spread: 1, tumble: .2, breathe: 0, echo: 0 })
export const WIRE_SCENES: readonly WireScene[] = Object.freeze([
  { id: 'orbit', orbit: 1, spread: 1, tumble: .15, breathe: 0, echo: 0, suits: ['intro', 'verse', 'outro', 'bridge'] },
  { id: 'tumble', orbit: .45, spread: .92, tumble: 1, breathe: 0, echo: 0, suits: ['drop', 'bridge', 'build'] },
  { id: 'breathe', orbit: .7, spread: 1, tumble: .25, breathe: 1, echo: 0, suits: ['breakdown', 'intro', 'outro', 'verse'] },
  { id: 'split', orbit: .55, spread: 1.35, tumble: .35, breathe: .2, echo: 0, suits: ['build', 'preDrop', 'drop'] },
  { id: 'echo', orbit: .8, spread: 1, tumble: .2, breathe: 0, echo: 1, suits: ['verse', 'build', 'preDrop', 'bridge'] },
])

/** Structural evidence from an analysed track. Null when there is none (a live microphone, or a track not yet analysed). */
export interface WireStructure {
  confidence: number
  build: number
}

export interface WireBoundaries {
  section: boolean
  phrase: boolean
  bar4: boolean
  bar8: boolean
  /** The identity of this frame's boundary, so one event is never counted twice. */
  id: string
}
export const NO_BOUNDARIES: Readonly<WireBoundaries> = Object.freeze({ section: false, phrase: false, bar4: false, bar8: false, id: '' })

export interface DirectorInput {
  dt: number
  playing: boolean
  auto: boolean
  cadence: WireSceneCadence
  seed: number
  /** Share of the recent musical window that must have been readable before the figure may abstract (0..1). */
  minReadable: number
  trackIdentity: string | null
  structure: WireStructure | null
  /** True when the beat grid is reliable enough to count bars. */
  gridConfident: boolean
  bpm: number | null
  boundaries: Readonly<WireBoundaries>
  /** A confident drop began this frame. */
  drop: boolean
  /** The strongest kick or snare hit this frame (0 when none). */
  hit: number
  /** A seek, loop or track change: start again from the readable figure. */
  discontinuity: boolean
  /** The kind of section the track is in (null on a live microphone, which has none). */
  sectionType?: string | null
}

export interface DirectorOutput {
  state: WireState
  scene: WireScene
  sceneId: string
  /** 0 = the figure's own placement, 1 = fully abstracted (the cubes drifting apart and tumbling). */
  abstract: number
  readableFraction: number
  lastEvent: string
}

/** Seconds of the recent past that the readable fraction averages over when the tempo is unknown. */
const WINDOW_FALLBACK_SEC = 16
const ACCENT_SEC = .14
const MIN_STRUCTURE_CONFIDENCE = .55
const BUILD_ENTER = .35
const BUILD_EXIT = .15
const RECENT_SCENES = 2

export class WireDirector {
  private state: WireState = 'READABLE'
  private stateTime = 0
  private abstractAmount = 0
  private readable = 1
  private scene: WireScene = { ...BASE_SCENE }
  private target: WireScene = BASE_SCENE
  private readonly recent: string[] = []
  private lastEvent = '—'
  private lastBoundary = ''
  private abstractSec = 3
  private reassembleSec = 1

  reset(): void {
    this.state = 'READABLE'; this.stateTime = 0; this.abstractAmount = 0; this.readable = 1
    this.scene = { ...BASE_SCENE }; this.target = BASE_SCENE; this.recent.length = 0; this.lastEvent = '—'; this.lastBoundary = ''
  }

  update(input: DirectorInput): DirectorOutput {
    const { dt, playing, auto } = input
    if (input.discontinuity) { this.reset(); this.lastEvent = 'RESET' }
    const beat = input.bpm && input.bpm > 0 ? 60 / input.bpm : .5
    this.abstractSec = clamp(beat * 4, 1.2, 3.5)
    this.reassembleSec = clamp(beat * 2, .5, 1.5)
    this.stateTime += dt

    const evidence = input.structure != null && input.structure.confidence >= MIN_STRUCTURE_CONFIDENCE
    // Without Auto Performance, a stopped track, or evidence that has gone, the figure settles back to its own placement.
    if (!auto || !playing || !evidence) {
      if (this.state === 'ABSTRACT') this.enter('REASSEMBLE', 'EVIDENCE LOST')
      if (this.state === 'BUILD') this.enter('READABLE', 'BUILD ENDED')
    }
    const settling = !playing

    switch (this.state) {
      case 'READABLE':
      case 'ACCENT': {
        if (this.state === 'ACCENT' && this.stateTime >= ACCENT_SEC) this.enter('READABLE', '')
        else if (this.state === 'READABLE' && input.hit >= .5 && playing) this.enter('ACCENT', 'HIT')
        if (auto && playing && evidence && this.state === 'READABLE' && input.structure!.build > BUILD_ENTER) this.enter('BUILD', 'BUILD')
        break
      }
      case 'BUILD': {
        if (!(auto && evidence) || input.structure!.build < BUILD_EXIT) this.enter('READABLE', 'BUILD ENDED')
        else if (input.drop && this.readable >= input.minReadable + .08) this.enter('ABSTRACT', 'DROP')
        else if (input.drop) this.lastEvent = 'DROP (HELD READABLE)'
        break
      }
      case 'ABSTRACT': {
        if (this.stateTime >= this.abstractSec) this.enter('REASSEMBLE', 'REASSEMBLE')
        break
      }
      case 'REASSEMBLE': {
        if (this.abstractAmount <= 0) this.enter('READABLE', 'READABLE')
        break
      }
      case 'REST': break
    }
    if (settling && (this.state === 'READABLE' || this.state === 'ACCENT')) this.state = 'REST'
    else if (!settling && this.state === 'REST') this.enter('READABLE', '')

    // The abstraction amount follows the state: it rises quickly in ABSTRACT and eases back over the reassembly time.
    if (this.state === 'ABSTRACT') this.abstractAmount = clamp(this.abstractAmount + dt / .15)
    else if (this.state === 'REASSEMBLE' || this.abstractAmount > 0) {
      const stepDown = dt / this.reassembleSec
      this.abstractAmount = Math.max(0, this.abstractAmount - stepDown)
    }
    if (this.abstractAmount < 1e-4) this.abstractAmount = 0

    // A new scene is chosen on a musical boundary, never between them.
    if (auto && playing && (this.state === 'READABLE' || this.state === 'ACCENT')) this.chooseScene(input)
    else if (!auto) this.target = BASE_SCENE
    const tau = clamp(beat, .25, 1.5)
    const k = 1 - Math.exp(-dt / tau)
    this.scene = {
      id: this.target.id,
      orbit: mix(this.scene.orbit, this.target.orbit, k), spread: mix(this.scene.spread, this.target.spread, k), tumble: mix(this.scene.tumble, this.target.tumble, k),
      breathe: mix(this.scene.breathe, this.target.breathe, k), echo: mix(this.scene.echo, this.target.echo, k),
    }

    // The share of the last few bars the figure has been readable, as an exponential average.
    const window = input.bpm && input.bpm > 0 ? 8 * 4 * beat : WINDOW_FALLBACK_SEC
    const isReadable = this.state !== 'ABSTRACT' && this.state !== 'REASSEMBLE'
    this.readable += ((isReadable ? 1 : 0) - this.readable) * (1 - Math.exp(-dt / window))

    return { state: this.state, scene: this.scene, sceneId: this.target.id, abstract: smooth(this.abstractAmount), readableFraction: this.readable, lastEvent: this.lastEvent }
  }

  private enter(next: WireState, event: string): void {
    this.state = next; this.stateTime = 0
    if (event) this.lastEvent = event
  }

  private chooseScene(input: DirectorInput): void {
    const b = input.boundaries
    if (b.id === '' || b.id === this.lastBoundary) return
    // Structural cadences need real structure. A live microphone has none, so it never changes scene on a section or a phrase.
    const structured = input.structure != null
    const fired = input.cadence === 'section' ? structured && b.section
      : input.cadence === 'phrase' ? structured && b.phrase
      : input.cadence === 'bar8' ? input.gridConfident && b.bar8
      : input.gridConfident && b.bar4
    // With no structure the structural cadences fall back to the eight-bar grid, but only while the grid is reliable.
    const fallback = !structured && (input.cadence === 'section' || input.cadence === 'phrase') && input.gridConfident && b.bar8
    if (!fired && !fallback) return
    this.lastBoundary = b.id
    // The scenes that suit this kind of section come first; with no section (a live microphone) every scene is a candidate.
    const suited = input.sectionType ? WIRE_SCENES.filter(scene => scene.suits?.includes(input.sectionType!)) : []
    const field = suited.length > 0 ? suited : WIRE_SCENES
    const candidates = field.filter(scene => !this.recent.includes(scene.id))
    const pool = candidates.length > 0 ? candidates : field
    const picked = pool[selectPerformanceDeterministicIndex(pool.length, 'wire', input.seed, input.trackIdentity ?? 'live', b.id)]
    this.target = picked
    this.recent.push(picked.id)
    while (this.recent.length > RECENT_SCENES) this.recent.shift()
    this.lastEvent = `SCENE ${picked.id.toUpperCase()}`
  }
}
