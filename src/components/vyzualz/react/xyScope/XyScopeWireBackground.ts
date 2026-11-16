// Sound Drawing XY › WIREFRAME: the backgrounds. Shapes that fill the space around and behind the main figure, drawn by the same beam as
// dim lines and moved by the same music: a tunnel of rings rushing toward you, a perspective floor, huge slow shells behind the figure, and a
// field of stars. Each one runs on a "flow" clock that the engine advances in beats (so it is locked to the track's tempo when BPM Sync is on)
// and reacts to a few drivers: a build pulse (rings and shells breathe faster as a build climbs), the bass (the floor lifts and ripples), the
// mids (the tunnel twists), and bursts (stars fly outward on a drop).
//
// Everything here is a pure function of its inputs: no randomness (stars and shells are placed by a hash of their index), and nothing is
// drawn when `amount` is zero.

import { quatFromAxisAngle, quatMul, quatNormalize, quatRotate } from './XyScopeWireProject'
import { routeEdges, type WireRoute } from './XyScopeWireRoute'
import { buildCluster, edgesOfGroups, type WireShape } from './XyScopeWireShape'

export type WireBackgroundId = 'none' | 'tunnel' | 'floor' | 'shells' | 'stars' | 'all'
export const WIRE_BACKGROUND_OPTIONS: readonly { value: WireBackgroundId; label: string }[] = Object.freeze([
  { value: 'none', label: 'None' }, { value: 'tunnel', label: 'Tunnel of rings' }, { value: 'floor', label: 'Horizon floor' },
  { value: 'shells', label: 'Giant shells' }, { value: 'stars', label: 'Star field' }, { value: 'all', label: 'All layers' },
])
/** The layers Auto Performance chooses between (it also picks 'all' at a peak). */
export const WIRE_BACKGROUND_LAYERS: readonly Exclude<WireBackgroundId, 'none' | 'all'>[] = Object.freeze(['tunnel', 'floor', 'shells', 'stars'])

/** What moves the backgrounds this frame. */
export interface WireBackgroundDrive {
  /** The flow clock, in beats (locked to the tempo with BPM Sync). Rings, floor rows and stars advance with it. */
  flow: number
  /** A second clock for slow turns (the shells), in beats. */
  turn: number
  /** The build pulse, 0..1: a repeating swell that speeds up through a build. */
  pulse: number
  /** The bass drive 0..1 (the floor lifts and ripples). */
  bass: number
  /** The mid drive 0..1 (the tunnel twists). */
  mid: number
  /** A burst 0..1 (stars fly outward). */
  burst: number
  /** How bright the background is overall, 0..1. */
  amount: number
  /** The tilt of the camera in radians, so the shells share the figure's view. */
  tilt: number
  perspective: number
}

/** Dim lines in the engine's screen space (x right, y down, about ±1.3 wide). A polyline of `count` points; every point but the last is joined to the next. */
export class WireBackgroundPath {
  x = new Float32Array(768)
  y = new Float32Array(768)
  gain = new Float32Array(768)
  /** 1 on the last point of a polyline (the beam hops to the next one). */
  end = new Uint8Array(768)
  count = 0
  clear(): void { this.count = 0 }
  private ensure(): void {
    if (this.count < this.x.length) return
    const grow = <T extends Float32Array | Uint8Array>(a: T): T => { const b = new (a.constructor as new (n: number) => T)(a.length * 2); b.set(a); return b }
    this.x = grow(this.x); this.y = grow(this.y); this.gain = grow(this.gain); this.end = grow(this.end)
  }
  point(x: number, y: number, gain: number, last: boolean): void {
    this.ensure()
    const i = this.count++
    this.x[i] = x; this.y[i] = y; this.gain[i] = gain; this.end[i] = last ? 1 : 0
  }
}

const TAU = Math.PI * 2
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v))
const fract = (v: number) => v - Math.floor(v)
/** A repeatable number in 0..1 for an index and a salt. */
function unit(index: number, salt: number): number {
  const x = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453
  return x - Math.floor(x)
}

// ── Tunnel ───────────────────────────────────────────────────────────────────

const TUNNEL_RINGS = 9
const TUNNEL_NEAR = 1.75
const TUNNEL_FAR = .06

function tunnel(out: WireBackgroundPath, d: WireBackgroundDrive): void {
  const twist = (d.mid - .25) * 1.1
  for (let i = 0; i < TUNNEL_RINGS; i++) {
    const depth = fract((i + d.flow * 1.4) / TUNNEL_RINGS) // 0 far, 1 near
    // Rings far away are close together and small; as they come toward you they spread and grow past the screen.
    let s = TUNNEL_FAR + (TUNNEL_NEAR - TUNNEL_FAR) * Math.pow(depth, 2.2)
    s *= 1 + .16 * d.pulse * (1 - depth)
    const rot = twist * (1 - depth), c = Math.cos(rot), sn = Math.sin(rot)
    const fade = Math.sin(Math.PI * clamp(depth * 1.04)) // faint at both ends of its journey
    const gain = d.amount * (.12 + .5 * Math.pow(depth, .7)) * fade
    if (gain < .01) continue
    const corners: [number, number][] = [[-1, -.72], [1, -.72], [1, .72], [-1, .72], [-1, -.72]]
    corners.forEach(([cx, cy], k) => out.point((cx * c - cy * sn) * s, (cx * sn + cy * c) * s, gain, k === 4))
  }
  // Four rails along the tunnel's corners, from the far ring to the near one.
  const rails = d.amount * .3
  for (const [sx, sy] of [[-1, -.72], [1, -.72], [1, .72], [-1, .72]] as const) {
    out.point(sx * TUNNEL_FAR, sy * TUNNEL_FAR, rails, false)
    out.point(sx * TUNNEL_NEAR, sy * TUNNEL_NEAR, rails, true)
  }
}

// ── Floor ────────────────────────────────────────────────────────────────────

const FLOOR_ROWS = 8
const FLOOR_COLUMNS = 9
const FLOOR_HORIZON = -.08

function floor(out: WireBackgroundPath, d: WireBackgroundDrive): void {
  for (let j = 0; j < FLOOR_ROWS; j++) {
    const z = fract((j + d.flow) / FLOOR_ROWS) // 0 at the horizon, 1 at you
    const y = FLOOR_HORIZON + 1.1 * Math.pow(z, 1.8)
    const half = .12 + 1.5 * z
    const gain = d.amount * (.12 + .7 * z) * Math.sin(Math.PI * clamp(z * 1.03))
    if (gain < .01) continue
    for (let k = 0; k < 9; k++) {
      const u = k / 8 * 2 - 1
      // The bass lifts the floor into a travelling ripple, bigger near you.
      const lift = d.bass * .2 * z * Math.sin(u * 4.2 + j * .9 + d.flow * 1.7)
      out.point(u * half, y - lift, gain, k === 8)
    }
  }
  const lines = d.amount * .45
  for (let k = 0; k < FLOOR_COLUMNS; k++) {
    const u = k / (FLOOR_COLUMNS - 1) * 2 - 1
    out.point(u * .03, FLOOR_HORIZON, lines * .3, false)
    out.point(u * 1.62, 1.02, lines, true)
  }
}

// ── Stars ────────────────────────────────────────────────────────────────────

const STARS = 36

function stars(out: WireBackgroundPath, d: WireBackgroundDrive, flowBurst: number): void {
  for (let i = 0; i < STARS; i++) {
    const angle = unit(i, 1) * TAU, speed = .25 + .75 * unit(i, 2)
    const r = fract(unit(i, 3) + (d.flow * .12 + flowBurst * .5) * speed)
    const radius = 1.75 * Math.pow(r, 1.4)
    const streak = 1 - (.04 + .1 * speed * (.4 + d.burst * 2.2))
    const gain = d.amount * (.2 + .75 * r) * Math.sin(Math.PI * clamp(r * 1.02)) * (.6 + .6 * speed)
    if (gain < .015 || r < .04) continue
    const c = Math.cos(angle), s = Math.sin(angle)
    out.point(c * radius * streak, s * radius * streak * .75, gain, false)
    out.point(c * radius, s * radius * .75, gain, true)
  }
}

// ── Shells ───────────────────────────────────────────────────────────────────

/** The giant slow solids: an icosahedron, an octahedron and a dodecahedron, drawn at different sizes and turning on different axes. */
export const SHELL_SHAPE: WireShape = buildCluster(['icosa', 'octa', 'dodeca'], 'shells')
const SHELL_SCALE = [1.25, 1.0, 1.6] as const
let shellRoute: WireRoute | null = null
const shellPoint = new Float32Array(3)
const shellScreen = new Float32Array(SHELL_SHAPE.vertices.length / 3 * 2)

function shells(out: WireBackgroundPath, d: WireBackgroundDrive): void {
  const shape = SHELL_SHAPE
  shellRoute ??= routeEdges(shape.vertices.length / 3, edgesOfGroups(shape, shape.groups.length))
  const breathe = 1 + .1 * d.pulse
  shape.groups.forEach((g, k) => {
    const q = quatNormalize(quatMul(
      quatFromAxisAngle(1, 0, 0, d.tilt + .6 + .4 * Math.sin(d.turn * .21 + k)),
      quatMul(quatFromAxisAngle(0, 1, 0, d.turn * (.07 + .035 * k) * TAU * (k % 2 ? -1 : 1)), quatFromAxisAngle(0, 0, 1, d.turn * .03 * TAU * (k + 1)))))
    for (let i = 0; i < g.vertexCount; i++) {
      const v = (g.vertexStart + i) * 3
      quatRotate(q, shape.vertices[v], shape.vertices[v + 1], shape.vertices[v + 2], shellPoint)
      const depth = 8 - shellPoint[2] * SHELL_SCALE[k]
      const persp = 1 + (8 / Math.max(2, depth) - 1) * d.perspective
      const scale = SHELL_SCALE[k] * breathe * .5 * persp
      shellScreen[(g.vertexStart + i) * 2] = shellPoint[0] * scale
      shellScreen[(g.vertexStart + i) * 2 + 1] = shellPoint[1] * scale * .85
    }
  })
  // One continuous stroke through every edge of every shell (retraced edges are half as bright, so each is as bright as the others).
  const route = shellRoute
  for (let s = 0; s < route.length; s++) {
    const a = route.from[s], b = route.to[s]
    if (route.edge[s] < 0) continue
    const gain = d.amount * .34 / route.multiplicity[s]
    const joined = s > 0 && route.edge[s - 1] >= 0 && route.to[s - 1] === a
    if (!joined) out.point(shellScreen[a * 2], shellScreen[a * 2 + 1], gain, false)
    const next = route.edge[s + 1 < route.length ? s + 1 : 0]
    out.point(shellScreen[b * 2], shellScreen[b * 2 + 1], gain, !(s + 1 < route.length && next >= 0 && route.from[s + 1] === b))
  }
}

/** Draws the chosen background into `out` (cleared first). `flowBurst` is the stars' accumulated outward flight. */
export function emitBackground(out: WireBackgroundPath, id: WireBackgroundId, drive: WireBackgroundDrive, flowBurst: number): void {
  out.clear()
  if (id === 'none' || drive.amount <= 0) return
  const all = id === 'all'
  // Together the layers share the screen, so each is dimmer than it would be alone.
  const mixed: WireBackgroundDrive = all ? { ...drive, amount: drive.amount * .6 } : drive
  if (all || id === 'shells') shells(out, mixed)
  if (all || id === 'tunnel') tunnel(out, mixed)
  if (all || id === 'floor') floor(out, mixed)
  if (all || id === 'stars') stars(out, mixed, flowBurst)
}

/** Adds the star layer without clearing (a star-burst reaction draws stars over whatever background is chosen). */
export function emitStars(out: WireBackgroundPath, drive: WireBackgroundDrive, flowBurst: number): void {
  if (drive.amount > 0) stars(out, drive, flowBurst)
}
