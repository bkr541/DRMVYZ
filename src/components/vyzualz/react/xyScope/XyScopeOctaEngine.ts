// Sound Drawing XY › OCTA: the Reference Video's figure. One phosphor beam draws a plus-shaped cluster of five wireframe octahedra
// (a centre one with one above, below, left and right), each with its three axes, hopping from one to the next. The music's energy
// distorts it the way it would on a real scope: the octahedra spin apart and tangle (tumble), the beam's finite bandwidth rounds the
// corners into overshoot loops (a resonant low-pass on the beam position), the octahedra are pulled toward spheres (every edge bends to a great circle, drawing a cage of rings), and at the top of the range
// the beam dwells at each corner and the lines fall faint, leaving bright dots. Nothing is random: the same input history draws the same picture.

import type { Osc1Features, Osc1Signal } from './XyScopeOsc1Engine'
import type { Osc1ScanStream } from './XyScopeOsc1Renderer'
import type { OctaValues } from './XyScopeOctaSettings'

const TAU = Math.PI * 2
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v))
const mix = (a: number, b: number, p: number) => a + (b - a) * p
const smooth = (edge0: number, edge1: number, x: number) => { const t = clamp((x - edge0) / (edge1 - edge0)); return t * t * (3 - 2 * t) }
const SAMPLE_RATE = 18000
/** The beam's brightness per sample, tuned so the lines read as the Reference Video's bright phosphor. */
const BEAM_GAIN = 2.6

export type OctaState = 'CLEAN' | 'TUMBLE' | 'LOOPS' | 'CAGE' | 'DOTS'

/** Octahedron corners: top, bottom, left, right, front, back. */
const CORNERS: readonly (readonly [number, number, number])[] = [[0, 1, 0], [0, -1, 0], [-1, 0, 0], [1, 0, 0], [0, 0, 1], [0, 0, -1]]
const [T, B, L, R, F, K] = [0, 1, 2, 3, 4, 5]
const EDGES: readonly (readonly [number, number])[] = [[T, L], [T, F], [T, R], [T, K], [B, L], [B, F], [B, R], [B, K], [L, F], [F, R], [R, K], [K, L]]

/** An Eulerian circuit of the octahedron's twelve edges from the top corner (every corner has four edges), found with Hierholzer's walk. */
function edgeCircuit(): number[] {
  const adjacent = CORNERS.map(() => [] as { to: number; edge: number }[])
  EDGES.forEach(([a, b], edge) => { adjacent[a].push({ to: b, edge }); adjacent[b].push({ to: a, edge }) })
  const used = new Set<number>()
  const stack = [T], circuit: number[] = []
  while (stack.length > 0) {
    const v = stack[stack.length - 1]
    const next = adjacent[v].find(entry => !used.has(entry.edge))
    if (next) { used.add(next.edge); stack.push(next.to) } else circuit.push(stack.pop()!)
  }
  return circuit.reverse()
}

type SegmentKind = 'edge' | 'axis' | 'hop'
const CIRCUIT = edgeCircuit()
/** After the circuit the beam walks the three axes (top-bottom, left-right, front-back), joined by edges it retraces. */
const AXIS_WALK = [B, L, R, F, K]
/** The kind of the segment leaving each axis-walk corner: B to L is an edge again, L to R and F to K are axes, and the last one hops to the next octahedron. */
const AXIS_KIND: readonly SegmentKind[] = ['edge', 'axis', 'edge', 'axis', 'hop']

/** Cluster centres in the view plane, in units of the spread: the centre octahedron, then above, right, below, left. */
const CENTRES: readonly (readonly [number, number])[] = [[0, 0], [0, 1], [1, 0], [0, -1], [-1, 0]]
export const OCTA_COUNT = CENTRES.length

export interface OctaStream extends Osc1ScanStream { kind: 'octa' }

export class OctaEngine {
  readonly letters: OctaStream[] = [{ kind: 'octa', advance: 0, table: new Float32Array(1), scanPhase: 0, lastLit: false, lastX: 0, lastY: 0, rate: 1 }]
  readonly absolute = true
  readonly fitWidth = 2.6
  /** Where the figure sits vertically on the stage (the renderer's default sits lower for text). */
  readonly anchorY = .5
  beamSamples = 0
  /** 0..1 smoothed music energy after Audio Reactivity and Distortion Amount. */
  energy = 0
  state: OctaState = 'CLEAN'
  /** The live triggered waveform (−1…1) that ripples along the axis lines. */
  wave: Float32Array = new Float32Array(512)
  waveGain = 1
  level = 0

  private time = 0
  private spin = 0
  private rawPeak = .25
  private values!: OctaValues
  private tumble = 0
  private loops = 0
  private cage = 0
  private dots = 0
  private tumbleAmount = 0
  private count = 0
  private px = new Float32Array(0)
  private py = new Float32Array(0)
  private kinds: SegmentKind[] = []
  private clock = new Float32Array(1)
  /** Share of each segment's time the beam rests at its two ends (a corner dwell). */
  private rest = new Float32Array(1)
  /** Per octahedron: its 3 × 3 turn, centre and radius, and per segment the corners it joins, for the cage's spherical interpolation. */
  private turn = new Float32Array(OCTA_COUNT * 9)
  private centre = new Float32Array(OCTA_COUNT * 2)
  private from = new Uint8Array(0)
  private to = new Uint8Array(0)
  private owner = new Uint8Array(0)
  private radius = 0
  private sphere = 0
  private cursor = 0
  // Resonant low-pass on the beam position (biquad), one state set per axis.
  private b0 = 1; private b1 = 0; private b2 = 0; private a1 = 0; private a2 = 0
  private zx1 = 0; private zx2 = 0; private zy1 = 0; private zy2 = 0
  private slewing = false

  reset(): void {
    this.time = 0; this.spin = 0; this.energy = 0; this.rawPeak = .25; this.state = 'CLEAN'
    this.tumble = 0; this.loops = 0; this.cage = 0; this.dots = 0
    this.zx1 = this.zx2 = this.zy1 = this.zy2 = 0
    this.cursor = 0
    this.letters[0].scanPhase = 0; this.letters[0].lastLit = false
  }

  /**
   * One frame. `bias` is added to the energy (Auto Performance's builds and drops). The energy is normalised to the track's own recent
   * range so every distortion is reachable on any material, then eased by Energy Response.
   */
  tick(dt: number, features: Osc1Features, playing: boolean, values: OctaValues, bias = 0, clock: { motionDt: number; tempoScale: number } = { motionDt: dt, tempoScale: 1 }): void {
    this.values = values
    const raw = playing ? clamp(.65 * features.level + .35 * Math.max(features.bass, features.mid)) : 0
    this.rawPeak = Math.max(.25, raw, this.rawPeak * Math.exp(-dt / 10))
    this.level = clamp(features.level)
    const target = clamp((raw / this.rawPeak + bias) * values.audioReactivity * values.distortion)
    // Energy Response is a musical time: with BPM Sync it scales with the tempo (a fast track is followed faster).
    const tau = mix(.7, .05, values.energyResponse) * clock.tempoScale
    this.energy += (target - this.energy) * (1 - Math.exp(-dt / tau))
    const e = this.energy
    // The distortion ladder: tumble first, then the beam's inertia rounds it into loops, the cluster folds into a cage, and dots last.
    // Each stage rises and gives way to the next, so the figure passes through them in order as the energy climbs.
    this.dots = smooth(.86, .95, e) * values.dots
    this.tumbleAmount = (smooth(.12, .35, e) * (1 - smooth(.42, .5, e)) + this.dots * .35) * values.tumble
    this.loops = smooth(.38, .5, e) * (1 - smooth(.56, .66, e)) * values.slew
    this.cage = smooth(.6, .7, e) * (1 - smooth(.78, .86, e)) * values.slew
    this.state = this.dots > .3 ? 'DOTS' : this.cage > .3 ? 'CAGE' : this.loops > .3 ? 'LOOPS' : this.tumbleAmount > .25 ? 'TUMBLE' : 'CLEAN'
    this.time += clock.motionDt
    // The loops and the cage hold the figure still so the beam retraces the same path each scan.
    this.spin += clock.motionDt * values.spin * .25 * (1 + this.tumbleAmount * 2) * (1 - clamp(this.loops + this.cage + this.dots * .8))
    this.letters[0].rate = 1 + this.dots * 1.6
    this.buildPath(values)
    this.setBeamFilter()
  }

  /** The cluster's corner positions for this frame, in stage units (the figure spans about ±1), plus each segment's kind. */
  private buildPath(v: OctaValues): void {
    const perOcta = CIRCUIT.length + (v.axes ? AXIS_WALK.length : 0)
    const total = perOcta * OCTA_COUNT
    if (total !== this.count) { this.count = total; this.px = new Float32Array(total); this.py = new Float32Array(total); this.kinds = new Array(total); this.clock = new Float32Array(total + 1); this.rest = new Float32Array(total); this.from = new Uint8Array(total); this.to = new Uint8Array(total); this.owner = new Uint8Array(total) }
    const r = .43 * v.size, d = 1.38 * r * v.spread
    const tilt = v.tilt * Math.PI / 180, t = this.time, tum = this.tumbleAmount
    // In the cage the cluster draws in, and every edge bends toward a sphere.
    const pull = 1 - this.cage * .4
    this.radius = r; this.sphere = this.cage
    const cos = Math.cos, sin = Math.sin
    let n = 0
    for (let o = 0; o < OCTA_COUNT; o++) {
      const ry = this.spin * (1 + .25 * o * tum) + tum * Math.PI * sin(.7 * t + o * 1.9)
      const rx = tilt + tum * 1.2 * sin(.53 * t + o * 2.3)
      const rz = tum * 1.4 * sin(.41 * t + o * 3.1)
      const cx = (CENTRES[o][0] * d * (1 - .3 * tum) + tum * .3 * r * sin(.37 * t + o * 1.3)) * pull
      const cy = (CENTRES[o][1] * d * (1 - .3 * tum) + tum * .3 * r * cos(.29 * t + o * 2.1)) * pull
      const sequence = v.axes ? [...CIRCUIT, ...AXIS_WALK] : CIRCUIT
      // This octahedron's turn: spin about the vertical, then tilt, then roll.
      const [cy1, sy1, cx1, sx1, cz1, sz1] = [cos(ry), sin(ry), cos(rx), sin(rx), cos(rz), sin(rz)]
      const m = this.turn, mo = o * 9
      // The rows of Rz · Rx · Ry.
      m[mo] = cz1 * cy1 - sz1 * sx1 * sy1; m[mo + 1] = -sz1 * cx1; m[mo + 2] = cz1 * sy1 + sz1 * sx1 * cy1
      m[mo + 3] = sz1 * cy1 + cz1 * sx1 * sy1; m[mo + 4] = cz1 * cx1; m[mo + 5] = sz1 * sy1 - cz1 * sx1 * cy1
      m[mo + 6] = -cx1 * sy1; m[mo + 7] = sx1; m[mo + 8] = cx1 * cy1
      this.centre[o * 2] = cx; this.centre[o * 2 + 1] = cy
      for (let k = 0; k < sequence.length; k++) {
        const c = CORNERS[sequence[k]]
        const [x0, y0, z0] = [c[0] * r, c[1] * r, c[2] * r]
        const x = m[mo] * x0 + m[mo + 1] * y0 + m[mo + 2] * z0 + cx
        const y = m[mo + 3] * x0 + m[mo + 4] * y0 + m[mo + 5] * z0 + cy
        const z = m[mo + 6] * x0 + m[mo + 7] * y0 + m[mo + 8] * z0
        const perspective = 1 / (1 - z * .12)
        this.px[n] = x * perspective
        this.py[n] = -y * perspective
        this.owner[n] = o; this.from[n] = sequence[k]; this.to[n] = sequence[(k + 1) % sequence.length]
        // The segment leaving this corner: circuit edges, then (with axes) T to B, then the axis walk; the last one hops to the next octahedron.
        this.kinds[n] = k < CIRCUIT.length - 1 ? 'edge' : k === CIRCUIT.length - 1 ? (v.axes ? 'axis' : 'hop') : AXIS_KIND[k - CIRCUIT.length]
        n++
      }
    }
    // Time on each segment: roughly its length (so every edge is equally bright), a short dwell at each corner (so corners glow), and hops quick (so they stay faint).
    let mean = 0
    for (let s = 0; s < total; s++) { const j = (s + 1) % total; mean += Math.hypot(this.px[j] - this.px[s], this.py[j] - this.py[s]) }
    mean /= total
    // In the dot scan the beam rests at each corner far longer than it spends on the lines, so the lines fall faint and the corners flare.
    const dwell = (.1 + this.dots * 5) * Math.pow(mean, .7)
    let sum = 0
    this.clock[0] = 0
    for (let s = 0; s < total; s++) {
      const j = (s + 1) % total, len = Math.hypot(this.px[j] - this.px[s], this.py[j] - this.py[s])
      const travel = Math.pow(len, .7) * (this.kinds[s] === 'hop' ? .35 : 1)
      this.rest[s] = dwell / (travel + dwell) / 2
      sum += travel + dwell
      this.clock[s + 1] = sum
    }
    for (let s = 1; s <= total; s++) this.clock[s] /= sum
  }

  /** A resonant low-pass on the beam: wide open while calm, and as the energy climbs the beam can no longer keep up with its corners and loops past them. */
  private setBeamFilter(): void {
    const open = 7800, closed = 1700
    const fc = mix(open, closed, Math.pow(clamp(this.loops), .8))
    const q = mix(.62, 1.5, clamp(this.loops))
    const w = TAU * fc / SAMPLE_RATE, alpha = Math.sin(w) / (2 * q), c = Math.cos(w)
    const a0 = 1 + alpha
    this.b0 = (1 - c) / 2 / a0; this.b1 = (1 - c) / a0; this.b2 = this.b0
    this.a1 = -2 * c / a0; this.a2 = (1 - alpha) / a0
    this.slewing = this.loops > .02
  }

  /** The beam at phase `u` of its path (called in order, once per sample, by the shared scanner). */
  signal(_l: OctaStream, _i: number, u: number, _pass = 0, _offset = 0, out: Osc1Signal = { x: 0, y: 0, z: 0, energy: 0, q: 0 }): Osc1Signal {
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
    let x = mix(this.px[s], this.px[j], p), y = mix(this.py[s], this.py[j], p)
    if (this.sphere > .001 && this.kinds[s] !== 'hop') {
      // The cage: walk the edge in the octahedron's own space and push each point out to the sphere, so edges bend to great circles.
      const a = CORNERS[this.from[s]], b = CORNERS[this.to[s]]
      let lx = mix(a[0], b[0], p), ly = mix(a[1], b[1], p), lz = mix(a[2], b[2], p)
      const norm = mix(1, 1 / (Math.hypot(lx, ly, lz) || 1), this.sphere)
      lx *= norm * this.radius; ly *= norm * this.radius; lz *= norm * this.radius
      const o = this.owner[s] * 9, m = this.turn
      const wx = m[o] * lx + m[o + 1] * ly + m[o + 2] * lz + this.centre[this.owner[s] * 2]
      const wy = m[o + 3] * lx + m[o + 4] * ly + m[o + 5] * lz + this.centre[this.owner[s] * 2 + 1]
      const wz = m[o + 6] * lx + m[o + 7] * ly + m[o + 8] * lz
      const perspective = 1 / (1 - wz * .12)
      x = wx * perspective; y = -wy * perspective
    }
    // The live waveform rides on the beam, mostly along the axis lines.
    const dx = this.px[j] - this.px[s], dy = this.py[j] - this.py[s], len = Math.hypot(dx, dy) || 1
    const sample = this.wave[Math.min(this.wave.length - 1, Math.floor(u * (this.wave.length - 1)))] * this.waveGain
    const amplitude = this.values.wiggle * (this.kinds[s] === 'axis' ? .035 * (.3 + this.level) : .003)
    x += -dy / len * sample * amplitude
    y += dx / len * sample * amplitude
    if (this.slewing) {
      const fx = this.b0 * x + this.zx1, fy = this.b0 * y + this.zy1
      this.zx1 = this.b1 * x - this.a1 * fx + this.zx2; this.zx2 = this.b2 * x - this.a2 * fx
      this.zy1 = this.b1 * y - this.a1 * fy + this.zy2; this.zy2 = this.b2 * y - this.a2 * fy
      x = fx; y = fy
    } else { this.zx1 = this.zx2 = this.zy1 = this.zy2 = 0 }
    out.x = x; out.y = y
    out.z = 1
    out.energy = BEAM_GAIN * this.values.intensity
    out.q = 0
    this.beamSamples++
    return out
  }
}
