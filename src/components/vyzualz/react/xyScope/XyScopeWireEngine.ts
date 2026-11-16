// Sound Drawing XY › WIREFRAME: the engine. One phosphor beam draws a cluster of 3D wireframe solids (a core and up to four satellites:
// cubes, platonic solids or a 4D tesseract). Per frame it: places the figures (orbit, turn, scale), lets the music deform them within
// bounds, projects them to the screen, and lays the edges out as a continuous beam path that the shared scanner draws. The shape is never
// changed. Every edge is also an oscillator: a sine wave with its own pitch, phase and chaos that follows the music, mixed with the live
// captured waveform, drawn as the line's sideways ripple (corners pinned).
//
// The pieces, each in its own tested module:
//   XyScopeWireShape      the immutable solids
//   XyScopeWireConductor  Auto Performance: moves the whole instrument from the audio intelligence
//   XyScopeWireRoute      one continuous stroke through every edge, with honest hops between cubes
//   XyScopeWireProject    quaternions, perspective, hidden edges
//   XyScopeWireModulation per-feature, bounded, track-relative mappings
//   XyScopeWireDeformer   bounded deformation with a readability guard and exact recovery
//   XyScopeWireDirector   seeded choreography that never invents structure
//   XyScopeWireBackground tunnel, floor, shells and stars behind the figure
//   XyScopeWireTransitions shatter, morph, glitch and zoom-through when the figure changes
//   XyScopeWireReactions  rules: when a trigger fires, do a reaction
// This file only composes them.

import type { Osc1ScanStream } from './XyScopeOsc1Renderer'
import type { Osc1Signal } from './XyScopeOsc1Engine'
import { WireDirector, type DirectorOutput, type WireState } from './XyScopeWireDirector'
import { applyField, constrainWeight, displacementField, placeShape, type CubePlacement, type Readability } from './XyScopeWireDeformer'
import { WireModMatrix, NO_TARGETS, type WireModSettings, type WireReading, type WireTargets } from './XyScopeWireModulation'
import { DEFAULT_WIRE_CAMERA, findHiddenEdges, projectPoint, quatFromAxisAngle, quatMul, quatNormalize, quatRotate, type Quat, type WireCamera } from './XyScopeWireProject'
import { routeEdges, type WireRoute } from './XyScopeWireRoute'
import { buildFigure, edgesOfGroups, MAX_GROUP_EDGES, MAX_GROUP_VERTICES, MAX_WIRE_CUBES, verticesOfGroups, type WireFigureId, type WireShape } from './XyScopeWireShape'
import { conductColor, NEUTRAL_MOOD, WireConductor, type WireMood } from './XyScopeWireConductor'
import { emitBackground, emitStars, WireBackgroundPath, type WireBackgroundDrive } from './XyScopeWireBackground'
import { glitchAmount, glitchSlip, morphMix, shatterAmount, shatterDirection, WIRE_TRANSITION_KINDS, WireTransition, zoomAmount, zoomFade, zoomScale, type WireTransitionKind, type WireTransitionStyle } from './XyScopeWireTransitions'
import { DEFAULT_WIRE_RULES, RING_LIFE, WireFx, type WireRule } from './XyScopeWireReactions'
import type { WireCue } from './XyScopeWireCues'
import { WIRE_DEFAULTS, type WireValues } from './XyScopeWireSettings'

const TAU = Math.PI * 2
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v))
const mix = (a: number, b: number, p: number) => a + (b - a) * p
/** The beam's brightness per sample, tuned so the lines read as bright phosphor. */
const BEAM_GAIN = 3.4
/** A path of about this many points is drawn at the base brightness; a longer one is brightened in proportion (one beam shares each scan across all of it). */
const REFERENCE_POINTS = 110
const MAX_COMPENSATION = 3.4
/** How far a satellite's far corner reaches beyond its orbit radius, in world units. */
const SATELLITE_REACH = .8
/** How far the orbit radius is, in cube half-edges, before the Orbit Spread setting. */
const ORBIT_RADIUS = 2.2
const SATELLITE_SCALE = .42
/** Beats per full turn of the figure at full Spin Speed, and the steady tempo it assumes when there is no beat grid or BPM Sync is off. */
const BEATS_PER_TURN = 16
const FREE_TEMPO = 100
const FLASH_REFRACTORY = .25
const FLASH_CAP = .35
const FLASH_CAP_UNLIMITED = .8
const MAX_PASSES = 6
/** The share of the beam's scan the dim background lines get, per segment, against the figure's. */
const BACKGROUND_WEIGHT = .8
/** The background lines are drawn this much brighter than the shapes say, so they read against the figure (they are many and thin). */
const BACKGROUND_GAIN = 2.1
/** Below this level a track that is playing without a beat grid is treated as silent: the figure holds still. */
const ACTIVE_LEVEL = .015
/** Seconds a reaction-requested transition must wait after the last one ended. */
const TRANSITION_GAP = 1.6
/** How far (in world units) a shattered corner flies at full strength. */
const SHATTER_DISTANCE = 2.6

export interface WireStream extends Osc1ScanStream { kind: 'wire' }

export interface WireTick {
  dt: number
  reading: WireReading
  cue: WireCue
  /** The user's values. While Auto Performance is on, the conductor moves them by the music; off, they are used as they are. */
  values: WireValues
  auto: boolean
  /** What the music says about the feel of this passage (see XyScopeWireConductor). Omitted means a neutral one. */
  mood?: Readonly<WireMood>
  /** The reaction rules (when this trigger fires, do that). Omitted means the default rules. */
  rules?: readonly WireRule[]
  /** A seek, loop or track change: every state starts again from the readable figure. */
  discontinuity: boolean
}

type Kind = 0 | 1 | 2 // 0 draws an edge, 1 is a hop between figures, 2 is a hop between background lines (always blank)

const MAX_VERTICES = MAX_WIRE_CUBES * MAX_GROUP_VERTICES
const MAX_EDGES = MAX_WIRE_CUBES * MAX_GROUP_EDGES
/** How often the chaotic map that drives the lines steps, per second. */
const CHAOS_RATE = 40
/** Past this many cycles along an edge, the wave's depth is eased down so its slope (and so the figure) stays readable. */
const SLOPE_CYCLES = 5
/** How quickly a new figure grows in, in seconds. */
const ENTRANCE_SEC = .55

/** A repeatable pseudo-random number in 0..1 for (index, salt, seed). Used for per-edge constants, never per frame. */
function unit(index: number, salt: number, seed: number): number {
  const x = Math.sin(index * 127.1 + salt * 311.7 + seed * 74.7) * 43758.5453
  return x - Math.floor(x)
}

export class WireEngine {
  readonly letters: WireStream[] = [{ kind: 'wire', advance: 0, table: new Float32Array(1), scanPhase: 0, lastLit: false, lastX: 0, lastY: 0, rate: 1 }]
  readonly absolute = true
  readonly fitWidth = 2.6
  readonly anchorY = .5
  /** Beam samples per second: the waveform's detail along the edges needs more than the 18,000 the other figures use. */
  readonly sampleRate = 54000
  beamSamples = 0

  /** The figure being drawn (an immutable cluster of solids); it changes only when the figure does. */
  shape: WireShape = buildFigure(WIRE_DEFAULTS.figure)
  readonly director = new WireDirector()
  readonly matrix = new WireModMatrix()
  readonly conductor = new WireConductor()
  readonly fx = new WireFx()
  readonly transition = new WireTransition()
  readonly bg = new WireBackgroundPath()
  readonly camera: WireCamera = { ...DEFAULT_WIRE_CAMERA }

  // What the inspector and the tests read.
  state: WireState = 'READABLE'
  sceneId = 'base'
  lastEvent = '—'
  abstract = 0
  readableFraction = 1
  readability: Readability = { score: 1, displacement: 0, stretch: 0 }
  /** The share of the music's deformation that the readability guard let through (1 = all of it). */
  weight = 1
  targets: WireTargets = { ...NO_TARGETS }
  /** The values actually drawn this frame: the user's, moved by the music while Auto Performance is on. */
  effective: WireValues = { ...WIRE_DEFAULTS }
  /** The smoothed mood behind them, and what kind of passage the conductor hears. */
  mood: WireMood = { ...NEUTRAL_MOOD }
  feel: 'CALM' | 'DRIVING' | 'TENSE' | 'PEAK' = 'CALM'
  figure: WireFigureId = WIRE_DEFAULTS.figure
  /** How much the figure is moving: 1 while the music plays, easing to 0 (and holding still) when it stops. */
  motion = 0
  /** True when the figure's motion is locked to the beat grid (BPM Sync with a beat grid), not to a steady tempo. */
  beatLocked = false
  /** The build pulse, 0..1: a repeating swell that speeds up through a build. */
  pulse = 0
  /** The transition running now, and how far through it is. */
  transitionKind: WireTransitionKind | null = null
  transitionProgress = 0
  /** The impact of the last drop (from the conductor), for the inspector. */
  shock = 0
  /** Corner positions as placed (before the music) and as drawn, three floats per corner. */
  readonly base = new Float32Array(MAX_VERTICES * 3)
  readonly deformed = new Float32Array(MAX_VERTICES * 3)
  /** Extra beam width from kicks, as a share of the Beam Width setting. */
  beamWidthBoost = 0
  pointCount = 0
  /** The live triggered waveform (−1…1) that ripples along the edges, and its gain. Set each frame by the runtime from the stereo samples. */
  wave: Float32Array = new Float32Array(512)
  waveGain = 1
  /** True when `wave` is a real capture of the audio. Otherwise the engine draws a stand-in built from the analysed bands. */
  hasWave = false
  /** How hard the oscillators drive the x, y and z edges of each solid this frame (0..1): bass, mids and highs respectively. */
  readonly rippleAxis = new Float32Array(3)
  /** How much the path's length has been compensated for (1 for a short path). Tests divide it out to compare passes. */
  energyScale = 1
  private extent = 0

  private time = 0
  private beatPos = -1
  private lastCueBeat: number | null = null
  /** The beats played so far (the background's flow clock runs on this) and the same in tenths of a minute-ish "seconds at 100 BPM" for slow sine motion. */
  private beatTotal = 0
  private beatTime = 0
  private flowClock = 0
  private starFlow = 0
  private buildPhase = 0
  private pendingFigure: WireFigureId = WIRE_DEFAULTS.figure
  private transitionAmount = 1
  private lastTransitionEnd = -10
  private autoStyle = 0
  private morphFrom = new Float32Array(MAX_VERTICES * 3)
  private morphCount = 0
  private morphOther: WireShape | null = null
  private glitch = 0
  private zoom = 1
  private fade = 1
  private phase = 0
  private orbitPhase = 0
  private tumblePhase = 0
  private hyperPhase = 0
  private lastFlash = -10
  private entrance = 1
  private chaosClock = 0
  private constSeed = -1
  private readonly field = new Float32Array(MAX_VERTICES * 3)
  private readonly dir = new Float32Array(3)
  private readonly synth = new Float32Array(512)
  // Per-edge oscillators: the line's own sine wave. Constants are fixed by the figure and the seed; the rest moves each frame.
  private readonly edgeU = [new Float32Array(MAX_EDGES), new Float32Array(MAX_EDGES), new Float32Array(MAX_EDGES)]
  private readonly edgePhase = new Float32Array(MAX_EDGES)
  private readonly edgeChaos = new Float32Array(MAX_EDGES)
  private readonly edgeCycles = new Float32Array(MAX_EDGES)
  private readonly edgeBeta = new Float32Array(MAX_EDGES)
  private readonly edgeRatio = new Float32Array(MAX_EDGES)
  private readonly edgeHarmonic = new Float32Array(MAX_EDGES)
  private readonly edgeAmp = new Float32Array(MAX_EDGES)
  private readonly projected: Float32Array[] = Array.from({ length: MAX_PASSES }, () => new Float32Array(MAX_VERTICES * 2))
  private readonly hidden: Uint8Array[] = Array.from({ length: MAX_PASSES }, () => new Uint8Array(MAX_EDGES))
  private readonly depth: Float32Array[] = Array.from({ length: MAX_PASSES }, () => new Float32Array(MAX_VERTICES))
  private readonly routes = new Map<string, WireRoute>()
  private values: WireValues = { ...WIRE_DEFAULTS }
  private flashBoost = 0
  // The beam path: one point per segment start. kind says what leaves the point; gain scales the beam on that segment.
  private count = 0
  private px = new Float32Array(0)
  private py = new Float32Array(0)
  private kinds: Kind[] = []
  private share = new Float32Array(0)
  private gain = new Float32Array(0)
  private boost = new Uint8Array(0)
  /** Per point: how far the oscillator may push the segment sideways (screen units), the edge it draws, and whether it is drawn against the edge's own direction. */
  private ripple = new Float32Array(0)
  private edgeOf = new Int16Array(0)
  private reversed = new Uint8Array(0)
  private clock = new Float32Array(1)
  private rest = new Float32Array(1)
  private cursor = 0

  constructor() { this.seedEdges(this.values.seed) }

  reset(): void {
    this.time = 0; this.phase = 0; this.orbitPhase = 0; this.tumblePhase = 0; this.hyperPhase = 0; this.lastFlash = -10; this.entrance = 1; this.chaosClock = 0
    this.beatPos = -1; this.lastCueBeat = null; this.beatTotal = 0; this.beatTime = 0; this.flowClock = 0; this.starFlow = 0; this.buildPhase = 0
    this.motion = 0; this.pulse = 0; this.shock = 0; this.glitch = 0; this.zoom = 1; this.fade = 1; this.lastTransitionEnd = -10
    this.director.reset(); this.matrix.reset(); this.conductor.reset(); this.fx.reset(); this.transition.reset(); this.transitionKind = null; this.transitionProgress = 0
    this.pendingFigure = this.figure
    this.state = 'READABLE'; this.sceneId = 'base'; this.lastEvent = '—'; this.abstract = 0; this.readableFraction = 1
    this.weight = 1; this.targets = { ...NO_TARGETS }; this.beamWidthBoost = 0; this.flashBoost = 0
    this.edgePhase.fill(0); this.seedEdges(this.values.seed)
    this.cursor = 0
    this.letters[0].scanPhase = 0; this.letters[0].lastLit = false
  }

  /** The constants of each edge's oscillator (pitch spread, phase, chaos start), fixed by the seed and the figure so the same figure always looks the same. */
  private seedEdges(seed: number): void {
    this.constSeed = seed
    for (let e = 0; e < MAX_EDGES; e++) {
      for (let k = 0; k < 3; k++) this.edgeU[k][e] = unit(e, k + 1, seed)
      this.edgePhase[e] = this.edgeU[2][e]
      this.edgeChaos[e] = .1 + .8 * unit(e, 7, seed)
    }
  }

  /** Switches to another figure. The shape is immutable, so this only points at a different one; with `grow` it grows in over about half a second so it never pops. */
  private setFigure(figure: WireFigureId, grow: boolean): void {
    if (figure === this.figure && this.shape.id === figure) return
    this.figure = figure; this.shape = buildFigure(figure)
    this.entrance = grow ? 0 : 1; this.cursor = 0
  }

  /** The route that draws the first `groups` solids, built once per figure and count. */
  private routeFor(groups: number): WireRoute {
    const key = `${this.shape.id}:${groups}`
    let route = this.routes.get(key)
    if (!route) { route = routeEdges(this.shape.vertices.length / 3, edgesOfGroups(this.shape, groups)); this.routes.set(key, route) }
    return route
  }

  private resolveStyle(style: WireTransitionStyle): WireTransitionKind | 'cut' {
    if (style !== 'auto') return style
    return WIRE_TRANSITION_KINDS[this.autoStyle++ % WIRE_TRANSITION_KINDS.length]
  }

  /** Starts a transition toward `target`. A morph starts from the figure being left (or, when the figure is not changing, from the next one in the cycle). */
  private beginTransition(kind: WireTransitionKind, target: WireFigureId, amount: number, vertexCount: number): void {
    if (!this.transition.start(kind)) return
    this.pendingFigure = target; this.transitionAmount = amount
    if (kind !== 'morph') return
    if (target !== this.figure) {
      this.morphFrom.set(this.base.subarray(0, vertexCount * 3)); this.morphCount = vertexCount; this.morphOther = null
      this.setFigure(target, false)
    } else {
      const order: WireFigureId[] = ['cubes', 'solids', 'tesseract']
      this.morphOther = buildFigure(order[(order.indexOf(this.figure) + 1) % order.length])
    }
  }

  tick(input: WireTick): void {
    const { dt, reading, cue, auto } = input
    this.time += dt
    const playing = reading.playing

    // Auto Performance: the conductor moves the user's values by the music (and chooses the figure, the background and the transition). Off, they pass through untouched.
    const conducted = this.conductor.update({
      dt, playing, auto, mood: input.mood ?? NEUTRAL_MOOD, base: input.values, boundaries: cue.boundaries, drop: cue.drop,
      gridConfident: cue.gridConfident, trackIdentity: cue.trackIdentity, seed: input.values.seed, discontinuity: input.discontinuity,
    })
    let values = conducted.values
    this.mood = conducted.mood; this.feel = conducted.feel; this.shock = conducted.shock ?? 0
    if (input.discontinuity) { this.beatPos = -1; this.lastCueBeat = null; this.transition.reset(); this.fx.reset() }
    if (values.seed !== this.constSeed) this.seedEdges(values.seed)

    // ── The clocks. With BPM Sync and a beat grid, everything moves in beats of the track (locked to its tempo and to where it is in the
    // bar); otherwise at a steady tempo. With no music playing (or none that is audible) nothing moves at all.
    const locked = values.bpmSync && cue.bpmValid && cue.absoluteBeat != null
    this.beatLocked = locked
    const bpm = cue.bpm && cue.bpm > 0 ? cue.bpm : FREE_TEMPO
    const active = playing && (locked || reading.features.level > ACTIVE_LEVEL)
    this.motion += ((active ? 1 : 0) - this.motion) * (1 - Math.exp(-dt / (active ? .25 : .6)))
    if (!active && this.motion < .003) this.motion = 0
    let dBeat = 0
    if (locked) {
      if (playing) {
        const before = this.beatPos
        let pos = before < 0 ? cue.absoluteBeat! : before + dt * bpm / 60
        // The beat grid updates in steps; between them the clock runs on the tempo and is eased toward the grid when a new position arrives.
        if (cue.absoluteBeat !== this.lastCueBeat) {
          const error = cue.absoluteBeat! - pos
          pos = Math.abs(error) > 2 ? cue.absoluteBeat! : pos + error * .35
          this.lastCueBeat = cue.absoluteBeat
        }
        this.beatPos = pos
        dBeat = before < 0 ? 0 : Math.max(0, pos - before)
      }
    } else { this.beatPos = -1; this.lastCueBeat = null; dBeat = dt * FREE_TEMPO / 60 * this.motion }
    this.beatTotal += dBeat; this.beatTime += dBeat * .6

    // The build pulse: a swell that repeats faster and harder as a build climbs.
    const build = playing ? clamp(this.mood.build) : 0
    this.buildPhase += dBeat * (.5 + 3.5 * build * build)
    const saw = 1 - (this.buildPhase % 1)
    this.pulse = clamp((build - .1) / .7) * saw * saw

    // Brightness accents are spaced out and capped unless the user turns Flash Limit off.
    let snare = reading.hits.snare
    if (snare > 0 && values.flashLimit) { if (this.time - this.lastFlash < FLASH_REFRACTORY) snare = 0; else this.lastFlash = this.time }
    const gated: WireReading = snare === reading.hits.snare ? reading : { ...reading, hits: { ...reading.hits, snare } }
    const settings: WireModSettings = {
      reactivity: values.audioReactivity, attackMs: values.attack, releaseMs: values.release,
      response: { kick: values.kickResponse, snare: values.snareResponse, bass: values.bassResponse, sub: values.bassResponse, mid: values.midResponse, lowMid: values.lowMidResponse, air: values.airResponse, flux: values.airResponse },
    }
    const targets = this.matrix.resolve(gated, dt, settings, this.targets)

    // ── Reactions: the rules watch the music's triggers and fire their reactions.
    const hits = reading.hits
    const events = this.fx.detect({
      kick: hits.kick, snare: hits.snare, hat: hits.hat, beat: cue.beat ? 1 : 0, downbeat: cue.downbeat ? 1 : 0, bar4: cue.boundaries.bar4 ? 1 : 0, bar8: cue.boundaries.bar8 ? 1 : 0,
      phrase: cue.boundaries.phrase ? 1 : 0, section: cue.boundaries.section ? 1 : 0, drop: cue.drop ? 1 : 0, chord: cue.chordChanged ? 1 : 0,
    }, build, this.mood.energy, this.matrix.drive.bass ?? 0)
    if (playing) this.fx.apply(input.rules ?? DEFAULT_WIRE_RULES, events, values.audioReactivity)
    this.beamWidthBoost = targets.beamWidth + this.fx.punch * .3
    this.flashBoost = Math.min(targets.brightness + this.fx.flash * .7, values.flashLimit ? FLASH_CAP : FLASH_CAP_UNLIMITED)
    // A colour pulse turns the hue for a moment, on top of whatever the conductor chose.
    if (Math.abs(this.fx.hue) > 1) values = { ...values, color: conductColor(values.color, this.fx.hue, .5, .3), glowColor: conductColor(values.glowColor, this.fx.hue, .4, .3) }
    this.values = values; this.effective = values

    // ── Figure changes and transitions.
    const groupsNow = Math.min(this.shape.groups.length, 1 + values.satellites)
    const vertexNow = verticesOfGroups(this.shape, groupsNow)
    if (!this.transition.active && this.fx.transitions.length > 0 && this.time - this.lastTransitionEnd > TRANSITION_GAP) {
      const request = this.fx.transitions.shift()!
      this.beginTransition(request.kind, this.figure, request.amount, vertexNow)
    } else if (this.transition.active) this.fx.transitions.length = 0
    if (values.figure !== this.figure) {
      this.pendingFigure = values.figure
      if (!this.transition.active) {
        const style = this.resolveStyle(values.transition)
        if (style === 'cut') this.setFigure(values.figure, true)
        else this.beginTransition(style, values.figure, 1, vertexNow)
      }
    } else if (!this.transition.active) this.pendingFigure = this.figure
    const frame = this.transition.update(dt)
    if (frame.swap && frame.kind !== 'morph') this.setFigure(this.pendingFigure, false)
    this.transitionKind = frame.active ? frame.kind : null; this.transitionProgress = frame.p
    if (frame.active && frame.p >= 1) this.lastTransitionEnd = this.time
    const amount = clamp(this.transitionAmount, 0, 1.2)
    this.glitch = frame.active && frame.kind === 'glitch' ? glitchAmount(frame.p) * Math.min(1, amount) : 0
    this.zoom = frame.active && frame.kind === 'zoom' ? 1 + (zoomScale(frame.p) - 1) * Math.min(1, amount) : 1
    this.fade = frame.active && frame.kind === 'zoom' ? 1 - (1 - zoomFade(frame.p)) * Math.min(1, amount) : 1
    this.entrance = Math.min(1, this.entrance + dt / ENTRANCE_SEC)

    const director: DirectorOutput = this.director.update({
      dt, playing, auto, cadence: values.sceneEvery, seed: values.seed, minReadable: values.minReadable,
      trackIdentity: cue.trackIdentity, structure: cue.structure, gridConfident: cue.gridConfident, bpm: cue.bpm,
      boundaries: cue.boundaries, drop: cue.drop, hit: Math.max(reading.hits.kick, reading.hits.snare), discontinuity: input.discontinuity,
      sectionType: input.mood?.sectionType ?? null,
    })
    this.state = director.state; this.sceneId = director.sceneId; this.lastEvent = director.lastEvent
    this.abstract = director.abstract; this.readableFraction = director.readableFraction
    const scene = director.scene

    // ── Turning: in beats (so it follows the tempo, and the bar, when locked), plus any spin kick from a reaction.
    const turn = values.spin / BEATS_PER_TURN
    this.phase += dBeat * turn + dt * this.fx.spin * this.motion
    const chaos = clamp(values.chaos)
    this.orbitPhase += dBeat * turn * 1.5 * scene.orbit
    const tumble = scene.tumble + director.abstract * 1.2 + chaos * .35
    this.tumblePhase += dBeat * turn * (.4 + tumble * 1.6)
    this.hyperPhase += dBeat * Math.abs(turn) * (.55 + tumble * .9)

    const groups = Math.min(this.shape.groups.length, 1 + values.satellites)
    const placements = this.placements(groups, values, scene.spread, scene.breathe, tumble, director.abstract, targets.rotation, chaos)
    placeShape(this.shape, placements, this.base)
    const vertexCount = verticesOfGroups(this.shape, groups)
    if (frame.active) this.disturb(frame.kind!, frame.p, amount, vertexCount, placements, groups)

    // The music's deformation of the figures, bounded and guarded.
    displacementField(this.shape, this.base, placements, { cubeScale: targets.cubeScale, expand: targets.expand, shear: targets.shear, wobble: targets.wobble, time: this.beatTime, chaos }, values.maxDisplacement, this.field)
    const guarded = constrainWeight(this.shape, this.base, this.field, placements, values.maxDisplacement, values.readableFloor)
    this.weight = guarded.weight
    this.readability = guarded.readability
    applyField(this.shape, this.base, this.field, guarded.weight, groups, this.deformed)
    this.driveOscillators(reading, values, dt, groups)

    // ── The background, the shockwave rings and the star burst: dim lines drawn first.
    this.flowClock += dBeat * (1 + 4 * (frame.active && frame.kind === 'zoom' ? zoomAmount(frame.p) : 0))
    this.starFlow += dt * this.fx.stars * 3
    this.fx.step(dt)
    const drive: WireBackgroundDrive = {
      flow: this.flowClock, turn: this.beatTotal, pulse: Math.max(this.pulse, this.fx.background), bass: this.matrix.drive.bass ?? 0, mid: this.matrix.drive.mid ?? 0,
      burst: this.fx.stars, amount: values.backgroundAmount, tilt: values.tilt * Math.PI / 180, perspective: values.perspective,
    }
    emitBackground(this.bg, values.background, drive, this.starFlow)
    if (this.fx.stars > .05 && values.background !== 'stars' && values.background !== 'all') emitStars(this.bg, { ...drive, amount: Math.max(.5, values.backgroundAmount) * Math.min(1, this.fx.stars) }, this.starFlow)
    this.addRings()

    this.buildPath(groups, scene.echo + this.fx.echo * 2, values)
  }

  /** What a running transition does to the placed corners (a shatter flings them apart, a morph carries them from the old figure's places). */
  private disturb(kind: WireTransitionKind, p: number, amount: number, vertexCount: number, placements: readonly CubePlacement[], groups: number): void {
    if (kind === 'shatter') {
      const distance = shatterAmount(p) * SHATTER_DISTANCE * amount, dir = this.dir
      for (let i = 0; i < vertexCount; i++) {
        shatterDirection(i, dir)
        this.base[i * 3] += dir[0] * distance; this.base[i * 3 + 1] += dir[1] * distance; this.base[i * 3 + 2] += dir[2] * distance
      }
    } else if (kind === 'morph') {
      if (this.morphOther) {
        placeShape(this.morphOther, placements.slice(0, Math.min(groups, this.morphOther.groups.length)), this.morphFrom)
        this.morphCount = verticesOfGroups(this.morphOther, Math.min(groups, this.morphOther.groups.length)); this.morphOther = null
      }
      const m = morphMix(p) ** (1 / Math.max(.4, Math.min(1, amount)))
      for (let i = 0; i < vertexCount; i++) {
        const from = (i % Math.max(1, this.morphCount)) * 3
        for (let k = 0; k < 3; k++) this.base[i * 3 + k] = mix(this.morphFrom[from + k], this.base[i * 3 + k], m)
      }
    }
  }

  /** The shockwave rings: each expands from the middle and fades, drawn with the background. */
  private addRings(): void {
    for (const ring of this.fx.rings) {
      const life = ring.age / RING_LIFE, radius = 2 * (1 - (1 - life) ** 2.2), gain = Math.min(1.2, ring.strength) * .8 * (1 - life) ** 1.3
      if (gain < .01) continue
      const points = 36
      for (let k = 0; k <= points; k++) {
        const a = k / points * TAU
        this.bg.point(Math.cos(a) * radius, Math.sin(a) * radius * .82, gain, k === points)
      }
    }
  }

  /**
   * What the lines do. Every edge is an oscillator: a sine wave along the edge with its own pitch (spread by the seed, raised by bright
   * music), a phase that runs at a speed set by the band that drives the edge's direction (bass on x, mids on y, highs on z, every kick on all),
   * and, with Chaos, a logistic map per edge (coupled to its neighbour) that drifts the pitch, frequency-modulates the wave and adds a harmonic.
   * The sine is mixed with the live captured waveform. With no real capture the waveform is built from the analysed bands. Silence leaves
   * exactly straight lines, and the corners are always pinned, so the figures stay readable.
   */
  private driveOscillators(reading: WireReading, values: WireValues, dt: number, groups: number): void {
    const d = this.matrix.drive
    // The oscillators have their own bound (Wave Depth, with the corners pinned), so they are not eased back by the deformation guard.
    const gate = reading.playing ? values.audioReactivity * values.waveAmount : 0
    const level = reading.playing ? reading.features.level : 0
    const kick = d.kick ?? 0
    const axisDrive = [d.bass ?? 0, d.mid ?? 0, d.air ?? 0]
    for (let a = 0; a < 3; a++) this.rippleAxis[a] = clamp((.22 * level + .8 * axisDrive[a] + .6 * kick) * gate)
    if (!this.hasWave) this.buildSynthWave(reading)

    const chaos = clamp(values.chaos), edgeEnd = this.shape.groups[groups - 1].edgeStart + this.shape.groups[groups - 1].edgeCount
    // The chaotic map steps at a fixed rate, whatever the frame rate.
    this.chaosClock += dt
    let steps = 0
    while (this.chaosClock >= 1 / CHAOS_RATE && steps < 4) { this.chaosClock -= 1 / CHAOS_RATE; steps++ }
    if (this.chaosClock > 1 / CHAOS_RATE) this.chaosClock = 0
    const r = 3.2 + .78 * chaos
    for (let step = 0; step < steps; step++) {
      let carry = this.edgeChaos[edgeEnd - 1]
      for (let e = 0; e < edgeEnd; e++) {
        const own = this.edgeChaos[e]
        // Coupled maps: each edge also feels the edge before it, so the wildness spreads along the figure.
        const next = .72 * r * own * (1 - own) + .28 * r * carry * (1 - carry)
        carry = own
        this.edgeChaos[e] = Math.min(.999, Math.max(.001, next))
      }
    }
    const pitch = this.mood.brightness
    for (let e = 0; e < edgeEnd; e++) {
      const axis = this.shape.edgeAxis[e], u1 = this.edgeU[0][e], u2 = this.edgeU[1][e]
      const jit = (this.edgeChaos[e] - .5) * 2
      // Pitch: the seed's spread, raised for the upper bands and bright music, and pushed around by chaos.
      const cycles = Math.max(.5, values.waveDetail * (.5 + .9 * u1) * (.8 + .35 * axis * .5 + .5 * pitch) * (1 + chaos * .8 * jit))
      this.edgeCycles[e] = cycles
      // Phase speed (cycles a second): faster with the band that drives the edge and with chaos.
      const speed = (.5 + 4.5 * axisDrive[axis] + 2 * kick) * (.7 + .6 * u2) * (1 + chaos * .8 * jit)
      this.edgePhase[e] = (this.edgePhase[e] + dt * speed * this.motion) % 1
      this.edgeBeta[e] = chaos * 2.6 * (.35 + .65 * Math.abs(jit))
      this.edgeRatio[e] = 1.5 + 1.5 * u2
      this.edgeHarmonic[e] = chaos * .55 * (.5 + .5 * Math.abs(jit))
      // Chaos only ever takes amplitude away from the bound, so the lines never go past Wave Depth.
      this.edgeAmp[e] = 1 - chaos * .55 * (1 - jit) * .5
    }
  }

  /** A stand-in waveform made of four sines whose strengths follow the sub-bass, bass, mids and highs and whose phases move with time. */
  private buildSynthWave(reading: WireReading): void {
    const f = reading.features, n = this.synth.length
    const amp = reading.playing ? [f.sub + f.bass * .8, f.mid, f.air, f.flux] : [0, 0, 0, 0]
    const total = Math.max(1e-6, amp[0] + amp[1] + amp[2] + amp[3])
    const cycles = [2, 5, 11, 23], rate = [.7, 1.3, 2.1, 3.4]
    for (let i = 0; i < n; i++) {
      const x = i / (n - 1)
      let v = 0
      for (let k = 0; k < 4; k++) v += amp[k] * Math.sin(TAU * (cycles[k] * x + rate[k] * this.time + k * .37))
      this.synth[i] = clamp(v / (total * .55) * Math.min(1, total), -1, 1)
    }
    this.wave = this.synth; this.waveGain = 1
  }

  /** Where each solid sits and how it is turned this frame, as a rigid placement (the orbit and the turns are never counted as deformation). */
  private placements(groups: number, v: WireValues, spread: number, breathe: number, tumble: number, abstract: number, lean: number, chaos: number): CubePlacement[] {
    const view = quatNormalize(quatMul(quatFromAxisAngle(1, 0, 0, v.tilt * Math.PI / 180), quatFromAxisAngle(0, 1, 0, this.phase * TAU)))
    const out: CubePlacement[] = []
    const radius = ORBIT_RADIUS * v.spread * spread * (1 + abstract * .7)
    this.extent = groups > 1 ? radius * (1 + chaos * .12) : 0
    // Slow motion (breathing, wandering, tumbling) runs on the beat clock, so it holds still with the music and follows its tempo.
    const t = this.beatTime
    const grow = .2 + .8 * this.entrance * this.entrance * (3 - 2 * this.entrance)
    // A kick's camera punch and the build pulse swell the whole figure.
    const swell0 = grow * (1 + .3 * this.fx.punch + .09 * this.pulse)
    const centre = new Float32Array(3)
    for (let k = 0; k < groups; k++) {
      const sign = k % 2 === 0 ? 1 : -1
      const swell = 1 + breathe * .1 * Math.sin(TAU * t * .35 + k * 1.7)
      const scale = (k === 0 ? 1 : SATELLITE_SCALE) * swell * swell0
      // Each solid turns on its own axes, at a slightly different rate, plus the mid band's lean against its neighbour.
      const own = quatNormalize(quatMul(
        quatFromAxisAngle(0, 1, 0, this.tumblePhase * TAU * (1 + .3 * k) + k + lean * sign),
        quatMul(quatFromAxisAngle(1, 0, 0, .5 + tumble * .9 * Math.sin(.37 * t + k * 2.1)), quatFromAxisAngle(0, 0, 1, tumble * .7 * Math.sin(.29 * t + k * 3.3))),
      ))
      let x = 0, y = 0, z = 0
      if (k > 0) {
        // Chaos loosens the orbit: the radius and the height wander on two incommensurate beats.
        const wander = 1 + chaos * .12 * Math.sin(2.3 * t + 1.9 * k) * Math.sin(1.1 * t + k)
        const angle = this.orbitPhase * TAU + TAU * (k - 1) / Math.max(1, groups - 1) + chaos * .25 * Math.sin(1.7 * t + k)
        x = radius * wander * Math.cos(angle); z = radius * wander * Math.sin(angle)
        y = .7 * Math.sin(angle * .5 + k) * (1 + abstract + chaos)
      }
      quatRotate(view, x, y, z, centre)
      out.push({
        cx: centre[0], cy: centre[1], cz: centre[2], q: quatNormalize(quatMul(view, own)), scale,
        // The tesseract turns through the fourth dimension: two planes steadily, and the third with the mid band's lean.
        hyper: [this.hyperPhase * TAU * (1 + .17 * k) + lean, this.hyperPhase * TAU * .62 + k, .5 * Math.sin(.31 * t + k) + lean * .5],
      })
    }
    return out
  }

  /** The passes the beam draws, in order: the background (and rings), the figure itself, its fainter echoes, and a faint outline of where the figures sit unmoved. */
  private buildPath(groups: number, echo: number, v: WireValues): void {
    const route = this.routeFor(groups)
    const shape = this.shape
    const copies = Math.max(1, Math.min(4, Math.round(v.duplicates + echo)))
    const outline = v.outline
    const passCount = copies + (outline ? 1 : 0)
    // Fit the figure to the stage: the default cluster fills about 1.1 stage units either side, and a wider orbit pulls the view back.
    const stage = v.size / Math.max(2.6, .9 * (this.extent + SATELLITE_REACH)) * this.zoom
    const last = shape.groups[groups - 1]
    const edgeCount = last.edgeStart + last.edgeCount
    const vertexCount = verticesOfGroups(shape, groups)
    const bgCount = this.bg.count
    const capacity = bgCount + passCount * (route.length + 2)
    if (capacity > this.px.length) {
      this.px = new Float32Array(capacity); this.py = new Float32Array(capacity); this.gain = new Float32Array(capacity); this.share = new Float32Array(capacity)
      this.boost = new Uint8Array(capacity); this.ripple = new Float32Array(capacity); this.edgeOf = new Int16Array(capacity); this.reversed = new Uint8Array(capacity); this.kinds = new Array(capacity); this.clock = new Float32Array(capacity + 1); this.rest = new Float32Array(capacity)
    }
    const camera = this.camera
    camera.perspective = v.perspective
    let n = 0
    // The background first: dim lines, each polyline ending in a blank hop.
    for (let i = 0; i < bgCount; i++) {
      this.px[n] = this.bg.x[i]; this.py[n] = this.bg.y[i]
      this.kinds[n] = this.bg.end[i] ? 2 : 0; this.gain[n] = this.bg.end[i] ? 0 : this.bg.gain[i] * BACKGROUND_GAIN
      this.boost[n] = 0; this.ripple[n] = 0; this.share[n] = BACKGROUND_WEIGHT
      n++
    }
    const figureStart = n
    const point = new Float32Array(3)
    for (let pass = 0; pass < passCount; pass++) {
      const isOutline = outline && pass === passCount - 1
      const copy = isOutline ? 0 : pass
      const source = isOutline ? this.base : this.deformed
      const projected = this.projected[pass], depth = this.depth[pass]
      // Echoes are the figure turned a little more about the vertical and drawn smaller; the first copy is the figure itself.
      const turn = copy * .22, shrink = Math.pow(.95, copy)
      const q = quatFromAxisAngle(0, 1, 0, turn)
      for (let i = 0; i < vertexCount; i++) {
        quatRotate(q, source[i * 3] * shrink, source[i * 3 + 1] * shrink, source[i * 3 + 2] * shrink, point)
        depth[i] = point[2]
        projectPoint(point[0], point[1], point[2], camera, projected, i * 2)
      }
      findHiddenEdges(shape.faces, shape.faceOffsets, shape.edgeFaces, projected, 0, edgeCount, this.hidden[pass])
      const passGain = isOutline ? .12 : copy === 0 ? 1 : .34 / copy
      const lastStep = route.length - 1
      for (let s = 0; s < route.length; s++) {
        const a = route.from[s], edge = route.edge[s]
        this.px[n] = projected[a * 2] * stage; this.py[n] = -projected[a * 2 + 1] * stage
        this.share[n] = 1
        if (edge < 0) { this.kinds[n] = 1; this.gain[n] = 0 } else {
          this.kinds[n] = 0
          const b = route.to[s]
          // Fade the edges that are farther away, and the ones hidden behind the figure.
          const far = clamp(1 - ((depth[a] + depth[b]) / 2 + 3) / 6)
          this.gain[n] = passGain / route.multiplicity[s] * (1 - v.depthCue * .55 * far) * (v.hiddenEdges === 'dim' && this.hidden[pass][edge] ? .35 : 1)
        }
        this.boost[n] = isOutline ? 0 : 1
        this.ripple[n] = 0
        if (edge >= 0 && copy === 0 && !isOutline) {
          const b = route.to[s]
          const length = Math.hypot((projected[b * 2] - projected[a * 2]) * stage, (projected[b * 2 + 1] - projected[a * 2 + 1]) * stage)
          // A busy wave is shallower than a slow one (its slope stays readable): amplitude eases down once an edge carries more than five cycles.
          this.ripple[n] = v.waveDepth * length * this.rippleAxis[shape.edgeAxis[edge]] * this.edgeAmp[edge] * Math.min(1, SLOPE_CYCLES / this.edgeCycles[edge])
          this.edgeOf[n] = edge; this.reversed[n] = a > b ? 1 : 0
        }
        n++
        if (s === lastStep && route.edge[s] >= 0) {
          // A route that closes on itself still needs its end point, so the beam can hop on to the next pass.
          const b = route.to[s]
          this.px[n] = projected[b * 2] * stage; this.py[n] = -projected[b * 2 + 1] * stage
          this.kinds[n] = 1; this.gain[n] = 0; this.boost[n] = 0; this.ripple[n] = 0; this.share[n] = 1; n++
        }
      }
    }
    this.count = n; this.pointCount = n
    // Time on each segment: roughly its length (so every edge gets the same brightness), a short dwell at each corner (so corners glow),
    // and hops quick. Brightness follows dwell, not how many points a line was cut into (the guide's §18.2). The dim background lines
    // take less of each scan than the figure.
    let mean = 0
    for (let s = figureStart; s < n; s++) { const j = (s + 1) % n; mean += Math.hypot(this.px[j] - this.px[s], this.py[j] - this.py[s]) }
    mean /= Math.max(1, n - figureStart)
    const dwell = .1 * Math.pow(Math.max(mean, 1e-4), .7)
    let sum = 0, figureTime = 0
    this.clock[0] = 0
    for (let s = 0; s < n; s++) {
      const j = (s + 1) % n, len = Math.hypot(this.px[j] - this.px[s], this.py[j] - this.py[s])
      const isBackground = s < figureStart
      // A segment that carries a wave is given more of the scan, so its detail is drawn rather than skipped.
      const travel = Math.pow(len, .7) * (this.kinds[s] !== 0 ? .35 : 1 + (this.ripple[s] > 0 ? 2.2 : 0)) * this.share[s]
      const d = isBackground ? dwell * .3 : dwell
      this.rest[s] = d / (travel + d) / 2
      sum += travel + d
      if (!isBackground) figureTime += travel + d
      this.clock[s + 1] = sum
    }
    for (let s = 1; s <= n; s++) this.clock[s] /= sum
    // A longer path is brightened to compensate (one beam shares each scan across all of it), and so is the share the background takes.
    this.energyScale = clamp((n - figureStart) / REFERENCE_POINTS, 1, MAX_COMPENSATION) * clamp(sum / Math.max(1e-9, figureTime), 1, 2.2)
  }

  /** The beam at phase `u` of its path (called in order, once per sample, by the shared scanner). */
  signal(_l: WireStream, _i: number, u: number, _pass = 0, _offset = 0, out: Osc1Signal = { x: 0, y: 0, z: 0, energy: 0, q: 0 }): Osc1Signal {
    const n = this.count
    if (n === 0) { out.x = 0; out.y = 0; out.z = 0; out.energy = 0; out.q = 0; return out }
    const clock = this.clock
    if (this.cursor >= n || u < clock[this.cursor] || u >= clock[this.cursor + 1]) {
      let lo = 0, hi = n - 1
      while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (clock[mid] <= u) lo = mid; else hi = mid - 1 }
      this.cursor = lo
    }
    const s = this.cursor, j = (s + 1) % n
    const raw = clamp((u - clock[s]) / Math.max(1e-9, clock[s + 1] - clock[s])), h = this.rest[s]
    const p = clamp((raw - h) / Math.max(1e-6, 1 - 2 * h))
    out.x = mix(this.px[s], this.px[j], p); out.y = mix(this.py[s], this.py[j], p)
    const amp = this.ripple[s]
    if (amp > 0) {
      // The edge's own signal. Seen from the edge's lower corner (so a retraced edge draws the same curve both times), it is zero at both
      // corners, so the corners never move. It is the edge's sine oscillator (with chaotic frequency modulation and a harmonic) mixed with the
      // live captured waveform.
      const reversed = this.reversed[s] === 1
      let dx = this.px[j] - this.px[s], dy = this.py[j] - this.py[s]
      const length = Math.hypot(dx, dy) || 1
      if (reversed) { dx = -dx; dy = -dy }
      const q = reversed ? 1 - p : p
      const e = this.edgeOf[s]
      const theta = TAU * (this.edgeCycles[e] * q + this.edgePhase[e])
      const modulated = Math.sin(theta + this.edgeBeta[e] * Math.sin(TAU * (this.edgeRatio[e] * this.edgeCycles[e] * q - this.edgePhase[e] * 1.3)))
      const harmonic = this.edgeHarmonic[e]
      const sine = (modulated + harmonic * Math.sin(2.71 * theta + 1)) / (1 + harmonic)
      const wave = this.wave, at = (q * this.values.waveDetail + e * .173) % 1
      const live = clamp(wave[Math.min(wave.length - 1, Math.floor(at * (wave.length - 1)))] * this.waveGain, -1, 1)
      const mixOsc = this.values.waveOscillator
      const sample = sine * mixOsc + live * (1 - mixOsc)
      const offset = amp * sample * Math.sin(Math.PI * q)
      out.x += -dy / length * offset
      out.y += dx / length * offset
    }
    // A glitch tears the picture into horizontal bands and slips some of them sideways.
    if (this.glitch > 0) out.x += glitchSlip(Math.floor(out.y * 7 + 30), Math.floor(this.time * 16)) * .3 * this.glitch
    const kind = this.kinds[s], hop = kind !== 0
    const travel = this.values.travel
    out.z = kind === 2 || (hop && travel === 'blank') ? 0 : 1
    const hopGain = travel === 'dim' ? .1 : 1
    const accent = this.boost[s] ? 1 + this.flashBoost : 1
    out.energy = BEAM_GAIN * this.energyScale * this.values.intensity * (kind === 2 ? 0 : hop ? hopGain : this.gain[s]) * accent * this.fade
    out.q = 0
    this.beamSamples++
    return out
  }
}
