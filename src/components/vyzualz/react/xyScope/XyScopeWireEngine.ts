// Sound Drawing XY › WIREFRAME: the engine. One phosphor beam draws a cluster of 3D wireframe cubes (a core and up to four satellites).
// Per frame it: places the cubes (orbit, turn, scale), lets the music deform them within bounds, projects them to the screen, and lays the
// edges out as a continuous beam path that the shared scanner draws. The cubes themselves (the shape) are never changed.
//
// The pieces, each in its own tested module:
//   XyScopeWireShape      the immutable cubes
//   XyScopeWireRoute      one continuous stroke through every edge, with honest hops between cubes
//   XyScopeWireProject    quaternions, perspective, hidden edges
//   XyScopeWireModulation per-feature, bounded, track-relative mappings
//   XyScopeWireDeformer   bounded deformation with a readability guard and exact recovery
//   XyScopeWireDirector   seeded choreography that never invents structure
// This file only composes them.

import type { Osc1ScanStream } from './XyScopeOsc1Renderer'
import type { Osc1Signal } from './XyScopeOsc1Engine'
import { WireDirector, type DirectorOutput, type WireState } from './XyScopeWireDirector'
import { applyField, constrainWeight, displacementField, placeShape, type CubePlacement, type Readability } from './XyScopeWireDeformer'
import { WireModMatrix, NO_TARGETS, type WireModSettings, type WireReading, type WireTargets } from './XyScopeWireModulation'
import { DEFAULT_WIRE_CAMERA, findHiddenEdges, projectPoint, quatFromAxisAngle, quatMul, quatNormalize, quatRotate, type Quat, type WireCamera } from './XyScopeWireProject'
import { routeEdges, type WireRoute } from './XyScopeWireRoute'
import { buildCubeCluster, edgesOfGroups, type WireShape } from './XyScopeWireShape'
import type { WireCue } from './XyScopeWireCues'
import type { WireValues } from './XyScopeWireSettings'

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

export interface WireStream extends Osc1ScanStream { kind: 'wire' }

export interface WireTick {
  dt: number
  reading: WireReading
  cue: WireCue
  values: WireValues
  auto: boolean
  /** A seek, loop or track change: every state starts again from the readable figure. */
  discontinuity: boolean
}

type Kind = 0 | 1 // 0 draws an edge, 1 is a hop

export class WireEngine {
  readonly letters: WireStream[] = [{ kind: 'wire', advance: 0, table: new Float32Array(1), scanPhase: 0, lastLit: false, lastX: 0, lastY: 0, rate: 1 }]
  readonly absolute = true
  readonly fitWidth = 2.6
  readonly anchorY = .5
  beamSamples = 0

  readonly shape: WireShape = buildCubeCluster()
  readonly director = new WireDirector()
  readonly matrix = new WireModMatrix()
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
  /** Corner positions as placed (before the music) and as drawn, three floats per corner. */
  readonly base = new Float32Array(this.shape.vertices.length)
  readonly deformed = new Float32Array(this.shape.vertices.length)
  /** Extra beam width from kicks, as a share of the Beam Width setting. */
  beamWidthBoost = 0
  pointCount = 0
  /** How much the path's length has been compensated for (1 for a short path). Tests divide it out to compare passes. */
  energyScale = 1
  private extent = 0

  private time = 0
  private phase = 0
  private orbitPhase = 0
  private tumblePhase = 0
  private lastFlash = -10
  private readonly field = new Float32Array(this.shape.vertices.length)
  private readonly projected: Float32Array[] = Array.from({ length: MAX_PASSES }, () => new Float32Array(this.shape.vertices.length / 3 * 2))
  private readonly hidden: Uint8Array[] = Array.from({ length: MAX_PASSES }, () => new Uint8Array(this.shape.edges.length / 2))
  private readonly depth: Float32Array[] = Array.from({ length: MAX_PASSES }, () => new Float32Array(this.shape.vertices.length / 3))
  private readonly routes = new Map<number, WireRoute>()
  private values!: WireValues
  private flashBoost = 0
  // The beam path: one point per segment start. kind says what leaves the point; gain scales the beam on that segment.
  private count = 0
  private px = new Float32Array(0)
  private py = new Float32Array(0)
  private kinds: Kind[] = []
  private gain = new Float32Array(0)
  private boost = new Uint8Array(0)
  private clock = new Float32Array(1)
  private rest = new Float32Array(1)
  private cursor = 0

  reset(): void {
    this.time = 0; this.phase = 0; this.orbitPhase = 0; this.tumblePhase = 0; this.lastFlash = -10
    this.director.reset(); this.matrix.reset()
    this.state = 'READABLE'; this.sceneId = 'base'; this.lastEvent = '—'; this.abstract = 0; this.readableFraction = 1
    this.weight = 1; this.targets = { ...NO_TARGETS }; this.beamWidthBoost = 0; this.flashBoost = 0
    this.cursor = 0
    this.letters[0].scanPhase = 0; this.letters[0].lastLit = false
  }

  /** The route that draws the first `cubes` cubes, built once per count. */
  private routeFor(cubes: number): WireRoute {
    let route = this.routes.get(cubes)
    if (!route) { route = routeEdges(this.shape.vertices.length / 3, edgesOfGroups(this.shape, cubes)); this.routes.set(cubes, route) }
    return route
  }

  tick(input: WireTick): void {
    const { dt, reading, cue, values, auto } = input
    this.values = values
    this.time += dt

    // Brightness accents are spaced out and capped unless the user turns Flash Limit off.
    let snare = reading.hits.snare
    if (snare > 0 && values.flashLimit) { if (this.time - this.lastFlash < FLASH_REFRACTORY) snare = 0; else this.lastFlash = this.time }
    const gated: WireReading = snare === reading.hits.snare ? reading : { ...reading, hits: { ...reading.hits, snare } }
    const settings: WireModSettings = {
      reactivity: values.audioReactivity, attackMs: values.attack, releaseMs: values.release,
      response: { kick: values.kickResponse, snare: values.snareResponse, bass: values.bassResponse, sub: values.bassResponse, mid: values.midResponse, lowMid: values.lowMidResponse, air: values.airResponse, flux: values.airResponse },
    }
    const targets = this.matrix.resolve(gated, dt, settings, this.targets)
    this.beamWidthBoost = targets.beamWidth
    this.flashBoost = Math.min(targets.brightness, values.flashLimit ? FLASH_CAP : FLASH_CAP_UNLIMITED)

    const director: DirectorOutput = this.director.update({
      dt, playing: reading.playing, auto, cadence: values.sceneEvery, seed: values.seed, minReadable: values.minReadable,
      trackIdentity: cue.trackIdentity, structure: cue.structure, gridConfident: cue.gridConfident, bpm: cue.bpm,
      boundaries: cue.boundaries, drop: cue.drop, hit: Math.max(reading.hits.kick, reading.hits.snare), discontinuity: input.discontinuity,
    })
    this.state = director.state; this.sceneId = director.sceneId; this.lastEvent = director.lastEvent
    this.abstract = director.abstract; this.readableFraction = director.readableFraction
    const scene = director.scene

    // Turn rates: BPM Sync follows the beat grid's tempo; otherwise a steady one.
    const tempo = values.bpmSync && cue.bpmValid && cue.bpm ? cue.bpm : FREE_TEMPO
    const turnsPerSecond = values.spin * tempo / 60 / BEATS_PER_TURN
    this.phase += dt * turnsPerSecond
    this.orbitPhase += dt * turnsPerSecond * 1.5 * scene.orbit
    const tumble = scene.tumble + director.abstract * 1.2
    this.tumblePhase += dt * turnsPerSecond * (.4 + tumble * 1.6)

    const cubes = 1 + values.satellites
    const placements = this.placements(cubes, values, scene.spread, scene.breathe, tumble, director.abstract, targets.rotation)
    placeShape(this.shape, placements, this.base)

    // The music's deformation of the cubes, bounded and guarded.
    displacementField(this.shape, this.base, placements, { cubeScale: targets.cubeScale, expand: targets.expand, shear: targets.shear, wobble: targets.wobble, time: this.time }, values.maxDisplacement, this.field)
    const guarded = constrainWeight(this.shape, this.base, this.field, placements, values.maxDisplacement, values.readableFloor)
    this.weight = guarded.weight
    this.readability = guarded.readability
    applyField(this.shape, this.base, this.field, guarded.weight, cubes, this.deformed)

    this.buildPath(cubes, scene.echo, values)
  }

  /** Where each cube sits and how it is turned this frame, as a rigid placement (the orbit and the turns are never counted as deformation). */
  private placements(cubes: number, v: WireValues, spread: number, breathe: number, tumble: number, abstract: number, lean: number): CubePlacement[] {
    const view = quatNormalize(quatMul(quatFromAxisAngle(1, 0, 0, v.tilt * Math.PI / 180), quatFromAxisAngle(0, 1, 0, this.phase * TAU)))
    const out: CubePlacement[] = []
    const radius = ORBIT_RADIUS * v.spread * spread * (1 + abstract * .7)
    this.extent = cubes > 1 ? radius : 0
    const t = this.time
    const centre = new Float32Array(3)
    for (let k = 0; k < cubes; k++) {
      const sign = k % 2 === 0 ? 1 : -1
      const swell = 1 + breathe * .1 * Math.sin(TAU * t * .35 + k * 1.7)
      const scale = (k === 0 ? 1 : SATELLITE_SCALE) * swell
      // Each cube turns on its own axes, at a slightly different rate, plus the mid band's lean against its neighbour.
      const own = quatNormalize(quatMul(
        quatFromAxisAngle(0, 1, 0, this.tumblePhase * TAU * (1 + .3 * k) + k + lean * sign),
        quatMul(quatFromAxisAngle(1, 0, 0, .5 + tumble * .9 * Math.sin(.37 * t + k * 2.1)), quatFromAxisAngle(0, 0, 1, tumble * .7 * Math.sin(.29 * t + k * 3.3))),
      ))
      let x = 0, y = 0, z = 0
      if (k > 0) {
        const angle = this.orbitPhase * TAU + TAU * (k - 1) / Math.max(1, cubes - 1)
        x = radius * Math.cos(angle); z = radius * Math.sin(angle)
        y = .7 * Math.sin(angle * .5 + k) * (1 + abstract)
      }
      quatRotate(view, x, y, z, centre)
      out.push({ cx: centre[0], cy: centre[1], cz: centre[2], q: quatNormalize(quatMul(view, own)), scale })
    }
    return out
  }

  /** The passes the beam draws, in order: the figure itself, its fainter echoes, and a faint outline of where the cubes sit unmoved. */
  private buildPath(cubes: number, echo: number, v: WireValues): void {
    const route = this.routeFor(cubes)
    const copies = Math.max(1, Math.min(4, Math.round(v.duplicates + echo * 2)))
    const outline = v.outline
    const passCount = copies + (outline ? 1 : 0)
    // Fit the figure to the stage: the default cluster fills about 1.1 stage units either side, and a wider orbit pulls the view back.
    const stage = v.size / Math.max(2.6, .9 * (this.extent + SATELLITE_REACH))
    const edgeCount = cubes * 12
    const capacity = passCount * (route.length + 2)
    if (capacity > this.px.length) {
      this.px = new Float32Array(capacity); this.py = new Float32Array(capacity); this.gain = new Float32Array(capacity)
      this.boost = new Uint8Array(capacity); this.kinds = new Array(capacity); this.clock = new Float32Array(capacity + 1); this.rest = new Float32Array(capacity)
    }
    const camera = this.camera
    camera.perspective = v.perspective
    let n = 0
    const point = new Float32Array(3)
    for (let pass = 0; pass < passCount; pass++) {
      const isOutline = outline && pass === passCount - 1
      const copy = isOutline ? 0 : pass
      const source = isOutline ? this.base : this.deformed
      const projected = this.projected[pass], depth = this.depth[pass]
      // Echoes are the figure turned a little more about the vertical and drawn smaller; the first copy is the figure itself.
      const turn = copy * .22, shrink = Math.pow(.95, copy)
      const q = quatFromAxisAngle(0, 1, 0, turn)
      const vertexCount = this.shape.groups[cubes - 1].vertexStart + 8
      for (let i = 0; i < vertexCount; i++) {
        quatRotate(q, source[i * 3] * shrink, source[i * 3 + 1] * shrink, source[i * 3 + 2] * shrink, point)
        depth[i] = point[2]
        projectPoint(point[0], point[1], point[2], camera, projected, i * 2)
      }
      findHiddenEdges(this.shape.faces, this.shape.edgeFaces, projected, 0, edgeCount, this.hidden[pass])
      const passGain = isOutline ? .12 : copy === 0 ? 1 : .34 / copy
      const lastStep = route.length - 1
      for (let s = 0; s < route.length; s++) {
        const a = route.from[s], edge = route.edge[s]
        this.px[n] = projected[a * 2] * stage; this.py[n] = -projected[a * 2 + 1] * stage
        if (edge < 0) { this.kinds[n] = 1; this.gain[n] = 0 } else {
          this.kinds[n] = 0
          const b = route.to[s]
          // Fade the edges that are farther away, and the ones hidden behind the figure.
          const far = clamp(1 - ((depth[a] + depth[b]) / 2 + 3) / 6)
          this.gain[n] = passGain / route.multiplicity[s] * (1 - v.depthCue * .55 * far) * (v.hiddenEdges === 'dim' && this.hidden[pass][edge] ? .35 : 1)
        }
        this.boost[n] = isOutline ? 0 : 1
        n++
        if (s === lastStep && route.edge[s] >= 0) {
          // A route that closes on itself still needs its end point, so the beam can hop on to the next pass.
          const b = route.to[s]
          this.px[n] = projected[b * 2] * stage; this.py[n] = -projected[b * 2 + 1] * stage
          this.kinds[n] = 1; this.gain[n] = 0; this.boost[n] = 0; n++
        }
      }
    }
    this.count = n; this.pointCount = n
    this.energyScale = clamp(n / REFERENCE_POINTS, 1, MAX_COMPENSATION)
    // Time on each segment: roughly its length (so every edge gets the same brightness), a short dwell at each corner (so corners glow),
    // and hops quick. Brightness follows dwell, not how many points a line was cut into (the guide's §18.2).
    let mean = 0
    for (let s = 0; s < n; s++) { const j = (s + 1) % n; mean += Math.hypot(this.px[j] - this.px[s], this.py[j] - this.py[s]) }
    mean /= Math.max(1, n)
    const dwell = .1 * Math.pow(Math.max(mean, 1e-4), .7)
    let sum = 0
    this.clock[0] = 0
    for (let s = 0; s < n; s++) {
      const j = (s + 1) % n, len = Math.hypot(this.px[j] - this.px[s], this.py[j] - this.py[s])
      const travel = Math.pow(len, .7) * (this.kinds[s] === 1 ? .35 : 1)
      this.rest[s] = dwell / (travel + dwell) / 2
      sum += travel + dwell
      this.clock[s + 1] = sum
    }
    for (let s = 1; s <= n; s++) this.clock[s] /= sum
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
    const hop = this.kinds[s] === 1
    const travel = this.values.travel
    out.z = hop && travel === 'blank' ? 0 : 1
    const hopGain = travel === 'dim' ? .1 : 1
    const accent = this.boost[s] ? 1 + this.flashBoost : 1
    out.energy = BEAM_GAIN * this.energyScale * this.values.intensity * (hop ? hopGain : this.gain[s]) * accent
    out.q = 0
    this.beamSamples++
    return out
  }
}
