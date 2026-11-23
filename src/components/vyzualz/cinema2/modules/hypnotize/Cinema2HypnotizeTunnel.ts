/**
 * The Hypnotize ring tunnel: its fixed layout (one array of instances, built once) and the per-frame animation (a few arrays of numbers, computed on the CPU in well under
 * a millisecond). The renderer draws all of it in two instanced draws; nothing here touches WebGL.
 *
 * The picture: round rings receding to a vanishing point, each ring turned a little more than the last so the tunnel spirals; neighbouring rings turn against each other;
 * light strips on every ring, long light lines running to the corners of the frame, one hero ring at a time, and a glow at the far end. The six patterns drive the
 * strips through `resolveCinema2HypnotizeLedDrive` (the same per-segment choreography the preset has always had), addressed by ring layer, sector and segment.
 *
 * Instances come in two groups, global first: the long light lines and the far glow, then the rings, ring after ring in the same order (so a lower quality tier simply draws
 * fewer rings from the front).
 */
import {
  resolveCinema2HypnotizeLedDrive,
  type Cinema2HypnotizeLedSignals,
  type Cinema2HypnotizePatternFrame,
} from './Cinema2HypnotizePatternEngine'

export const CINEMA2_HYPNOTIZE_TUNNEL = Object.freeze({
  /** Ring slots in the tunnel at the highest quality. Lower tiers draw fewer, from the front. */
  ringSlots: 28,
  spacing: 3.1,
  radius: 5.6,
  /** The z of the first ring slot at zero scroll. A ring is gone once it has passed the camera, so this leaves it just in front of it. */
  frontZ: -1.5,
  /** Light strips per ring: `sectors` angular sectors of `segmentsPerSector`, the address space the patterns' LED choreography is written for. */
  sectors: 12,
  segmentsPerSector: 4,
  /** A ring keeps its identity as the tunnel scrolls (its global index), and its pattern layer is that index modulo this. */
  layers: 8,
  lines: 40,
  vanesPerRing: 20,
  /** Rings between hero rings. */
  heroEvery: 9,
})

export const CINEMA2_HYPNOTIZE_INSTANCE_FLOATS = 12
export const CINEMA2_HYPNOTIZE_QUALITY_RINGS = Object.freeze({ low: 16, medium: 22, high: 28 } as const)

/** Instance kinds (the shader reads them). */
export const HYP_KIND = Object.freeze({ frame: 0, strip: 1, accent: 2, line: 3, glow: 4, vane: 5, vaneEdge: 6 } as const)

const TAU = Math.PI * 2
const { sectors: SECTORS, segmentsPerSector: SEGMENTS, radius: R, lines: LINES, vanesPerRing: VANES, ringSlots: RING_SLOTS } = CINEMA2_HYPNOTIZE_TUNNEL
const STRIPS_PER_RING = SECTORS * SEGMENTS
const FRAME_CHORDS = 48
const INNER_DARK_CHORDS = 24
const ACCENT_CHORDS = 48
const VANE_EDGES = VANES / 4
const RING_INSTANCES = FRAME_CHORDS + INNER_DARK_CHORDS + ACCENT_CHORDS + STRIPS_PER_RING + VANES + VANE_EDGES
const GLOBAL_INSTANCES = LINES + 2
const TUNNEL_LENGTH = RING_SLOTS * CINEMA2_HYPNOTIZE_TUNNEL.spacing + 8

/** Where each part of a ring sits inside its block of instances. */
export const CINEMA2_HYPNOTIZE_RING_PARTS = Object.freeze({
  frame: 0,
  innerDark: FRAME_CHORDS,
  accent: FRAME_CHORDS + INNER_DARK_CHORDS,
  strips: FRAME_CHORDS + INNER_DARK_CHORDS + ACCENT_CHORDS,
  vanes: FRAME_CHORDS + INNER_DARK_CHORDS + ACCENT_CHORDS + STRIPS_PER_RING,
  vaneEdges: FRAME_CHORDS + INNER_DARK_CHORDS + ACCENT_CHORDS + STRIPS_PER_RING + VANES,
  perRing: RING_INSTANCES,
  globalCount: GLOBAL_INSTANCES,
  stripsPerRing: STRIPS_PER_RING,
})

export interface Cinema2HypnotizeTunnelLayout {
  readonly instanceCount: number
  readonly globalCount: number
  readonly ringCount: number
  readonly perRing: number
  /** Static per-instance data: 3 vec4s per instance (see the vertex shader). */
  readonly packed: Float32Array
  readonly tunnelLength: number
}

/**
 * Packs one instance. `a` = (centre x, centre y, centre z, kind); `b` = (size x, size y, size z, rotation about z); `c` = (ring slot or -1, sector, segment, reserved).
 * A chord along a ring is a box whose x axis lies along the tangent; a radial vane is a box whose y axis runs outward.
 */
function put(packed: Float32Array, index: number, values: readonly number[]): void {
  packed.set(values, index * CINEMA2_HYPNOTIZE_INSTANCE_FLOATS)
}

export function buildCinema2HypnotizeTunnelLayout(): Readonly<Cinema2HypnotizeTunnelLayout> {
  const total = GLOBAL_INSTANCES + RING_SLOTS * RING_INSTANCES
  const packed = new Float32Array(total * CINEMA2_HYPNOTIZE_INSTANCE_FLOATS)
  let next = 0

  // The long light lines run the length of the tunnel on its wall: the perspective lines that carry the eye to the corners of the frame.
  for (let line = 0; line < LINES; line += 1) {
    const angle = (line / LINES) * TAU
    const bright = line % 10 === 0
    put(packed, next, [Math.cos(angle) * (R + 0.05), Math.sin(angle) * (R + 0.05), -TUNNEL_LENGTH / 2 + 1, HYP_KIND.line, bright ? 0.1 : 0.05, 0.05, TUNNEL_LENGTH, angle, -1, line, 0, 0])
    next += 1
  }
  // The far glow: a soft disc at the end of the tunnel (the shader makes it round).
  put(packed, next, [0, 0, -TUNNEL_LENGTH + 2, HYP_KIND.glow, 4.4, 4.4, 0.05, 0, -1, 0, 0, 0]); next += 1
  put(packed, next, [0, 0, -TUNNEL_LENGTH + 2.1, HYP_KIND.glow, 1.4, 1.4, 0.05, 0, -1, 1, 0, 0]); next += 1

  for (let slot = 0; slot < RING_SLOTS; slot += 1) {
    const chord = (count: number, radius: number, thick: number, depth: number, kind: number, sectorOf: (k: number) => number, segmentOf: (k: number) => number, gap = 1.02) => {
      for (let k = 0; k < count; k += 1) {
        const angle = ((k + 0.5) / count) * TAU
        const length = 2 * radius * Math.sin(Math.PI / count) * gap
        put(packed, next, [Math.cos(angle) * radius, Math.sin(angle) * radius, 0, kind, length, thick, depth, angle + Math.PI / 2, slot, sectorOf(k), segmentOf(k), 0])
        next += 1
      }
    }
    chord(FRAME_CHORDS, R, 0.36, 0.34, HYP_KIND.frame, () => 0, () => 0)
    chord(INNER_DARK_CHORDS, R * 0.72, 0.2, 0.2, HYP_KIND.frame, () => 0, () => 0)
    chord(ACCENT_CHORDS, R * 0.9, 0.07, 0.07, HYP_KIND.accent, k => Math.floor(k / (ACCENT_CHORDS / SECTORS)), () => 0, 1.0)
    chord(STRIPS_PER_RING, R, 0.22, 0.42, HYP_KIND.strip, k => Math.floor(k / SEGMENTS), k => k % SEGMENTS, 0.97)
    for (let v = 0; v < VANES; v += 1) {
      const angle = (v / VANES) * TAU
      put(packed, next, [Math.cos(angle) * R * 0.78, Math.sin(angle) * R * 0.78, 0, HYP_KIND.vane, 0.16, R * 0.3, 0.3, angle - Math.PI / 2 + 0.45, slot, Math.floor((v / VANES) * SECTORS), 0, 0])
      next += 1
    }
    for (let e = 0; e < VANE_EDGES; e += 1) {
      const angle = ((e * 4) / VANES) * TAU
      put(packed, next, [Math.cos(angle) * R * 0.78, Math.sin(angle) * R * 0.78, 0.17, HYP_KIND.vaneEdge, 0.035, R * 0.28, 0.03, angle - Math.PI / 2 + 0.45, slot, Math.floor(((e * 4) / VANES) * SECTORS), 0, 0])
      next += 1
    }
  }
  return Object.freeze({ instanceCount: total, globalCount: GLOBAL_INSTANCES, ringCount: RING_SLOTS, perRing: RING_INSTANCES, packed, tunnelLength: TUNNEL_LENGTH })
}

/** Everything the animation reads, already clamped by the module. */
export interface Cinema2HypnotizeTunnelInputs {
  patternFrame: Readonly<Cinema2HypnotizePatternFrame>
  signals: Readonly<Cinema2HypnotizeLedSignals>
  ledPowerGatingEnabled: boolean
  /** How far the tunnel has scrolled, in ring spacings (monotonic; the fractional part is the position between two rings). */
  scroll: number
  /** The rotation of even and odd rings, in radians, accumulated by the module so a change of speed never makes a ring jump. */
  rotationEven: number
  rotationOdd: number
  twist: number
  intensity: number
  ledGain: number
  pulseDepth: number
  vocalRestraint: number
  beatAccent: number
  kickAccent: number
  downbeatAccent: number
  dropAccent: number
  overallEnergy: number
  /** Rings to draw (a quality tier). */
  ringsVisible: number
  /** Line brightness from the Spectral detail control. */
  lineGain: number
}

/** The per-frame results: small arrays the renderer uploads. */
export interface Cinema2HypnotizeTunnelFrame {
  /** Per ring slot. */
  readonly ringAngle: Float32Array
  readonly ringZ: Float32Array
  readonly ringHero: Float32Array
  readonly ringVane: Float32Array
  readonly ringGlow: Float32Array
  /** Per instance, 4 floats: emission, tint (0 = light A, 1 = light B), hot (toward the core colour), spare. */
  readonly dynamic: Float32Array
  /** How many ring slots to draw. */
  ringsVisible: number
}

export function createCinema2HypnotizeTunnelFrame(layout: Readonly<Cinema2HypnotizeTunnelLayout>): Cinema2HypnotizeTunnelFrame {
  const frame: Cinema2HypnotizeTunnelFrame = {
    ringAngle: new Float32Array(layout.ringCount), ringZ: new Float32Array(layout.ringCount), ringHero: new Float32Array(layout.ringCount),
    ringVane: new Float32Array(layout.ringCount), ringGlow: new Float32Array(layout.ringCount),
    dynamic: new Float32Array(layout.instanceCount * 4), ringsVisible: layout.ringCount,
  }
  // The parts that never change with the music: the dim accent ring, the vane edges and the far glow keep these values and are only rescaled in the shader.
  for (let slot = 0; slot < layout.ringCount; slot += 1) {
    const base = layout.globalCount + slot * layout.perRing
    for (let k = 0; k < ACCENT_CHORDS; k += 1) frame.dynamic[(base + CINEMA2_HYPNOTIZE_RING_PARTS.accent + k) * 4] = 0.55
    for (let e = 0; e < VANE_EDGES; e += 1) { frame.dynamic[(base + CINEMA2_HYPNOTIZE_RING_PARTS.vaneEdges + e) * 4] = 1.3; frame.dynamic[(base + CINEMA2_HYPNOTIZE_RING_PARTS.vaneEdges + e) * 4 + 1] = e % 2 }
  }
  return frame
}

const smoothstep = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t) }
const mod = (value: number, modulus: number) => ((value % modulus) + modulus) % modulus

/** The drive table is the same for every ring with the same layer, so the 384 distinct addresses are computed once a frame, not once per strip. */
const driveTable = new Float32Array(CINEMA2_HYPNOTIZE_TUNNEL.layers * STRIPS_PER_RING)

/** Fills `frame` for one frame. Allocation-free. */
export function updateCinema2HypnotizeTunnelFrame(
  layout: Readonly<Cinema2HypnotizeTunnelLayout>,
  frame: Cinema2HypnotizeTunnelFrame,
  input: Readonly<Cinema2HypnotizeTunnelInputs>,
): void {
  const { spacing, frontZ, layers, heroEvery } = CINEMA2_HYPNOTIZE_TUNNEL
  const whole = Math.floor(input.scroll)
  const fraction = input.scroll - whole
  frame.ringsVisible = Math.max(1, Math.min(layout.ringCount, Math.round(input.ringsVisible)))

  for (let layer = 0; layer < layers; layer += 1) {
    for (let sector = 0; sector < SECTORS; sector += 1) {
      for (let segment = 0; segment < SEGMENTS; segment += 1) {
        driveTable[layer * STRIPS_PER_RING + sector * SEGMENTS + segment] = resolveCinema2HypnotizeLedDrive(
          input.patternFrame, { family: 'collar', layer, sector, segment }, input.signals, input.ledPowerGatingEnabled,
        )
      }
    }
  }

  const pulse = 1 + input.pulseDepth * (input.signals.bassPressure * 0.05 + input.kickAccent * 0.12 + input.dropAccent * 0.1)
  const gain = input.intensity * input.ledGain * input.vocalRestraint * pulse
  const dynamic = frame.dynamic

  for (let slot = 0; slot < frame.ringsVisible; slot += 1) {
    const global = slot + whole
    const layer = mod(global, layers)
    const even = global % 2 === 0
    const hero = mod(global, heroEvery) === 0
    frame.ringZ[slot] = frontZ - (slot - fraction) * spacing
    frame.ringAngle[slot] = global * input.twist + (even ? input.rotationEven : input.rotationOdd)
    frame.ringHero[slot] = hero ? 1 : 0
    frame.ringVane[slot] = even ? 1 : 0
    const base = layout.globalCount + slot * layout.perRing + CINEMA2_HYPNOTIZE_RING_PARTS.strips
    let sum = 0
    for (let sector = 0; sector < SECTORS; sector += 1) {
      const tint = (global + sector) & 1
      for (let segment = 0; segment < SEGMENTS; segment += 1) {
        const drive = driveTable[layer * STRIPS_PER_RING + sector * SEGMENTS + segment]!
        // A hero ring is the one moment of light: brighter and whiter, lifted again on a downbeat or a drop.
        const emission = drive * gain * (hero ? 1.55 + input.downbeatAccent * 0.6 + input.dropAccent * 0.8 : 1)
        const offset = (base + sector * SEGMENTS + segment) * 4
        dynamic[offset] = emission
        dynamic[offset + 1] = tint
        dynamic[offset + 2] = smoothstep(0.85, 1.4, drive * (hero ? 1.5 : 1)) * 0.85
        sum += drive
      }
    }
    frame.ringGlow[slot] = (sum / STRIPS_PER_RING) * gain
  }

  // The long wall lines: dim, with every tenth bright, breathing a little with the beat and the energy.
  const breath = 0.8 + input.overallEnergy * 0.35 + input.beatAccent * 0.4 + input.downbeatAccent * 0.3
  for (let line = 0; line < LINES; line += 1) {
    const bright = line % 10 === 0, mid = line % 5 === 0
    const offset = line * 4
    dynamic[offset] = (bright ? 2.8 : mid ? 1.0 : 0.26) * breath * input.lineGain * input.intensity
    dynamic[offset + 1] = line % 10 === 5 ? 0 : 1
    dynamic[offset + 2] = bright ? 1 : 0
  }
  // The far glow: brightens with the energy and lifts on a downbeat.
  const glowBase = LINES * 4
  dynamic[glowBase] = (0.9 + input.overallEnergy * 0.8 + input.downbeatAccent * 0.9) * input.intensity
  dynamic[glowBase + 1] = 0
  dynamic[glowBase + 4] = (5 + input.dropAccent * 5 + input.kickAccent * 1.5) * input.intensity
  dynamic[glowBase + 5] = 0
  dynamic[glowBase + 6] = 1
}
