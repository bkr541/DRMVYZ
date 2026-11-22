/**
 * The extra elements around and inside Inertia's cage, all dots like the rest of the sculpture, generated on the CPU each frame from one clock (in beats):
 *
 * - three orbit rings of dots at different radii and tilts, each with a bright satellite and a fading comet tail behind it;
 * - a dial: a tilted ring of ticks around the whole cage, with a brighter mark every twelfth tick and a highlight that sweeps round it;
 * - dust: a field of small points drifting round the sculpture at different speeds, twinkling;
 * - an inner shell: a second, smaller dotted sphere inside the core, turning against it.
 *
 * Nothing here decides anything musical: the kick only pushes the rings outward, the same way the cage's displacement does.
 */
export const INERTIA_EXTRA_ROLES = { ring: 3, satellite: 4, dial: 5, dialMajor: 6, dust: 7, inner: 8 } as const
export const INERTIA_EXTRA_STRIDE = 5
const TAU = Math.PI * 2

export interface InertiaExtrasInput {
  /** Beats of ambient motion. */
  clock: number
  /** 0 to 1: brightness of the orbit rings and their satellites. */
  rings: number
  /** 0 to 1: brightness of the outer dial. */
  dial: number
  /** 0 to 1: the share of the dust field that is shown. */
  dust: number
  /** 0 to 1: the inner shell's brightness; 0 hides it. */
  inner: number
  /** The core's size control, so the inner shell stays inside the core. */
  coreSize: number
  /** Outward push on the rings from the shared kick displacement. */
  push: number
}

const RINGS = [
  { radius: .40, tiltX: 1.19, tiltZ: .17, speed: 1, phase: 0 },
  { radius: .53, tiltX: -.56, tiltZ: .70, speed: -.72, phase: 2.1 },
  { radius: .68, tiltX: .21, tiltZ: -1.08, speed: 1.35, phase: 4 },
] as const
const DIAL = { radius: .96, ticks: 144, major: 12, tiltX: 1.15, tiltZ: .2 }

/** A small deterministic generator, so the dust is the same field every time. */
function seeded(seed: number): () => number {
  let state = seed >>> 0
  return () => { state = (state + 0x6d2b79f5) | 0; let t = Math.imul(state ^ state >>> 15, 1 | state); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 }
}

interface Dust { theta: number; phi: number; radius: number; speed: number; bob: number; twinkle: number; offset: number; hash: number }

export class InertiaExtras {
  private readonly ringDots: number
  private readonly dust: Dust[] = []
  private readonly inner: [number, number, number][] = []
  /** The most points `fill` can write; size the output for it. */
  readonly capacity: number

  constructor(quality: 'low' | 'medium' | 'high') {
    this.ringDots = quality === 'low' ? 144 : quality === 'high' ? 256 : 192
    const dustCount = quality === 'low' ? 160 : quality === 'high' ? 380 : 260
    const innerCount = quality === 'low' ? 120 : quality === 'high' ? 300 : 200
    const random = seeded(0x1ce17a)
    for (let i = 0; i < dustCount; i++) {
      this.dust.push({
        theta: Math.acos(1 - 2 * random()), phi: random() * TAU, radius: .58 + .78 * Math.cbrt(random()), speed: (.05 + .2 * random()) * (random() < .5 ? -1 : 1),
        bob: .02 + .06 * random(), twinkle: .45 + .8 * random(), offset: random() * TAU, hash: (i + .5) / dustCount,
      })
    }
    // Evenly spread points on a unit sphere (a golden-angle spiral).
    for (let i = 0; i < innerCount; i++) {
      const y = 1 - 2 * (i + .5) / innerCount, r = Math.sqrt(1 - y * y), a = i * 2.399963229728653
      this.inner.push([r * Math.cos(a), y, r * Math.sin(a)])
    }
    this.capacity = RINGS.length * (this.ringDots + 1) + DIAL.ticks + dustCount + innerCount
  }

  /** Writes x, y, z, role, gain for each point into `out` and returns how many points it wrote. */
  fill(out: Float32Array, input: InertiaExtrasInput): number {
    let count = 0
    const put = (x: number, y: number, z: number, role: number, gain: number) => {
      if (gain <= .002) return
      const at = count * INERTIA_EXTRA_STRIDE
      out[at] = x; out[at + 1] = y; out[at + 2] = z; out[at + 3] = role; out[at + 4] = gain
      count++
    }
    const { clock } = input
    // A point in a ring's plane turned by the ring's own tilt (about X, then Z), which drifts a little so the rings precess.
    const tilted = (x: number, z: number, tiltX: number, tiltZ: number): [number, number, number] => {
      const y1 = -Math.sin(tiltX) * z, z1 = Math.cos(tiltX) * z
      return [Math.cos(tiltZ) * x - Math.sin(tiltZ) * y1, Math.sin(tiltZ) * x + Math.cos(tiltZ) * y1, z1]
    }
    for (const [index, ring] of RINGS.entries()) {
      const spin = clock * ring.speed * TAU / 16 + ring.phase
      const wobble = .1 * Math.sin(clock * .21 + index * 2)
      const radius = ring.radius * (1 + input.push * 2.5)
      for (let i = 0; i < this.ringDots; i++) {
        const angle = i / this.ringDots * TAU, behind = ((spin - angle) % TAU + TAU) % TAU
        // The tail is brightest at the satellite and fades the further behind it a dot is, in the direction the ring turns.
        const tail = ring.speed > 0 ? 1 - behind / TAU : behind / TAU
        const [x, y, z] = tilted(Math.cos(angle) * radius, Math.sin(angle) * radius, ring.tiltX + wobble, ring.tiltZ)
        put(x, y, z, INERTIA_EXTRA_ROLES.ring, input.rings * (.3 + .9 * tail ** 2.2))
      }
      const [x, y, z] = tilted(Math.cos(spin) * radius, Math.sin(spin) * radius, ring.tiltX + wobble, ring.tiltZ)
      put(x, y, z, INERTIA_EXTRA_ROLES.satellite, input.rings * 1.4)
    }
    const sweep = clock * TAU / 16, turn = clock * TAU / 64
    for (let i = 0; i < DIAL.ticks; i++) {
      const angle = i / DIAL.ticks * TAU + turn, major = i % DIAL.major === 0
      const lit = (.5 + .5 * Math.cos(angle - sweep)) ** 4
      const [x, y, z] = tilted(Math.cos(angle) * DIAL.radius, Math.sin(angle) * DIAL.radius, DIAL.tiltX + .08 * Math.sin(clock * .05), DIAL.tiltZ)
      put(x, y, z, major ? INERTIA_EXTRA_ROLES.dialMajor : INERTIA_EXTRA_ROLES.dial, input.dial * ((major ? .95 : .4) + .6 * lit))
    }
    for (const dust of this.dust) {
      if (dust.hash > input.dust) continue
      const phi = dust.phi + clock * dust.speed * TAU / 8, sin = Math.sin(dust.theta)
      // The field is stretched sideways so it fills a wide frame; the vertical spread stays inside the frame.
      const x = dust.radius * sin * Math.cos(phi) * 1.55, y = dust.radius * Math.cos(dust.theta) * .85 + dust.bob * Math.sin(clock * .3 + dust.offset), z = dust.radius * sin * Math.sin(phi)
      put(x, y, z, INERTIA_EXTRA_ROLES.dust, .22 + .9 * (.5 + .5 * Math.sin(clock * dust.twinkle + dust.offset)) ** 3)
    }
    if (input.inner > 0) {
      const angle = -clock * .9, c = Math.cos(angle), s = Math.sin(angle), radius = .155 * input.coreSize
      // Turned about a tilted axis (through x and z as well as y), counter to the core's own spin.
      const axis = [-.3, 1, .4], length = Math.hypot(axis[0]!, axis[1]!, axis[2]!), ax = axis[0]! / length, ay = axis[1]! / length, az = axis[2]! / length
      for (const [px, py, pz] of this.inner) {
        const dot = ax * px + ay * py + az * pz
        const x = px * c + (ay * pz - az * py) * s + ax * dot * (1 - c), y = py * c + (az * px - ax * pz) * s + ay * dot * (1 - c), z = pz * c + (ax * py - ay * px) * s + az * dot * (1 - c)
        put(x * radius, y * radius, z * radius, INERTIA_EXTRA_ROLES.inner, input.inner * (.55 + .6 * (.5 + .5 * Math.sin(y * 9 + clock * 1.6))))
      }
    }
    return count
  }
}
