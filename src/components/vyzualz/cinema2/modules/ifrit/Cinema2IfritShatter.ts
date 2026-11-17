import { ifritComponentId, ifritHash, IFRIT_SECTORS, type IfritPattern, type IfritShatterTrigger } from './Cinema2IfritDomain'
import { IFRIT_RADIUS } from './Cinema2IfritGeometry'
import { IFRIT_QUALITY_LIMITS, ifritRingFrame, ifritSectorAngle, ifritToWorld, type IfritQuality } from './Cinema2IfritMechanics'
import { IFRIT_PASSAGE_SPAN, type IfritChannels, type IfritPhases, type IfritRingPose } from './Cinema2IfritMotion'
import { resolveIfritElementPatch, type IfritElementOverrides } from './Cinema2IfritOverrides'

export interface IfritShatterControls {
  readonly enabled: boolean
  readonly trigger: IfritShatterTrigger
  readonly strength: number
  readonly hold: number
  readonly fragmentsPerEdge: number
  readonly spread: number
  readonly spin: number
  /** Reshapes the return curve of the shared envelope: shorter snaps back faster, longer lingers. 0.75 is the authored curve. */
  readonly reassembly: number
  /** 0..1 per sector. */
  readonly sectorBias: readonly number[]
  readonly aperture: number
  readonly spacing: number
  readonly thickness: number
  readonly overrides: IfritElementOverrides
  readonly quality: IfritQuality
}
export interface IfritShardPose {
  readonly id: string
  readonly ringSlot: number
  readonly sector: number
  readonly fragmentIndex: number
  /** Where the piece sits when whole, in world space (the same placement the original edge section has). */
  readonly sourcePosition: readonly [number, number, number]
  readonly position: readonly [number, number, number]
  /** Euler XYZ in radians, applied as Rz·Ry·Rx. */
  readonly rotation: readonly [number, number, number]
  /** Mesh extents: the section's length along the edge, then its cross-section (the beam's own size). */
  readonly scale: readonly [number, number, number]
  readonly fracture: number
  readonly illumination: number
  readonly visible: boolean
  /** Slant of the section's two ends (tiles with its neighbours; 0 at the corners). */
  readonly cutStart: number
  readonly cutEnd: number
  /** Only the first section of an edge carries the corner links. */
  readonly corner: boolean
}

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v))
const smooth = (v: number) => { const t = clamp(v); return t * t * (3 - 2 * t) }
const mix = (a: number, b: number, t: number) => a + (b - a) * t
/** Below this a sector is treated as whole: the original edge shows and no shard is drawn. */
export const IFRIT_FRACTURE_EPSILON = 1e-4

const corner = (side: number): readonly [number, number] => {
  const theta = Math.PI / 2 + side * Math.PI / 3
  return [Math.cos(theta) * IFRIT_RADIUS, Math.sin(theta) * IFRIT_RADIUS]
}

interface PatternShatter { ev: number; swirl: number; radial: number; gather: number; spread: number }
function shatterPattern(pattern: IfritPattern, ringSlot: number, sector: number, depth: number, ev: number, channels: IfritChannels, strength: number): PatternShatter {
  const ch = (key: string) => clamp(channels[key] ?? 0)
  switch (pattern) {
    case 'infernalPassage': return { ev: clamp((ev - depth * 0.35) / 0.65), swirl: 0.3, radial: 1.25, gather: 0, spread: 1 }
    case 'twistedDescent': return { ev, swirl: 2.1, radial: 0.6, gather: 0, spread: 1 }
    case 'counterfire': {
      const parity = (sector + ringSlot) % 2 ? 0.25 : 1
      const backbeat = (sector <= 2 ? ch('snareLeft') : ch('snareRight')) * 0.3 * strength
      return { ev: clamp(ev * parity + backbeat * (ev > 0 ? 1 : 0)), swirl: 0.6, radial: 1, gather: 0, spread: 1 }
    }
    case 'compressionChamber': return { ev, swirl: 0.5, radial: 1, gather: 1, spread: 1 }
    case 'emberRelay': return { ev: clamp(ev * 1.7 - ((sector + ringSlot) % 6) / 6 * 0.9), swirl: 0.5, radial: 1, gather: 0, spread: 0.85 }
    case 'riftLock': return { ev, swirl: 0.5, radial: 1.1, gather: 0, spread: 1.35 }
  }
}
function blendPattern(a: PatternShatter, b: PatternShatter, t: number): PatternShatter {
  return { ev: mix(a.ev, b.ev, t), swirl: mix(a.swirl, b.swirl, t), radial: mix(a.radial, b.radial, t), gather: mix(a.gather, b.gather, t), spread: mix(a.spread, b.spread, t) }
}

/** The ring/sector-level event amount (0..1) for the chosen trigger, before the pattern and the per-piece threshold. Manual never invents an event. */
export function ifritShatterEvent(trigger: IfritShatterTrigger, ringSlot: number, sector: number, depth: number, phases: IfritPhases, channels: IfritChannels, hold: number): number {
  const ch = (key: string) => clamp(channels[key] ?? 0)
  if (trigger === 'manual') return clamp(hold)
  let ev = 0
  // The recall rises half a shared beat after the burst and pulls the scatter back in proportion: the pieces read for a moment, then rebuild.
  if (trigger === 'drop') ev = clamp(ch('shatterBurst') * (1 - 0.85 * ch('shatterRecall')))
  else if (trigger === 'kick') {
    const near = 1 - smooth((depth - 0.15) / 0.45), far = smooth((depth - 0.4) / 0.5), middle = Math.max(0, 1 - Math.abs(depth - 0.5) * 2)
    const bankParity = Math.floor(phases.score) % 2
    const gate = (sector + ringSlot + bankParity) % 2 === 0 ? 1 : 0.2
    ev = 0.55 * (ch('kickNear') * near + ch('kickMiddle') * middle + ch('kickFar') * far) * gate
  } else {
    // A fracture wave travels from the near frames to the far ones as the shared phrase envelope decays.
    const front = 1 - ch('shatterPhrase')
    const weight = Math.exp(-(((depth - front) / 0.28) ** 2))
    ev = 0.8 * ch('shatterPhrase') * weight
  }
  // The authored hold keeps a fracture lingering while an event is live.
  return clamp(Math.max(ev, hold * smooth(ev * 6)))
}

/** A piece's fracture: small cues move only the pieces whose own threshold they exceed, and nearer frames separate a little more readily. */
function pieceFracture(ev: number, strength: number, bias: number, depth: number, hash: number, manual: boolean, reassembly: number): number {
  const exponent = 0.75 / clamp(reassembly, 0.15, 2)
  const shaped = Math.pow(clamp(ev), exponent)
  const amount = manual ? shaped * bias : shaped * strength * bias * (0.65 + 0.35 * (1 - depth))
  return clamp((amount - 0.5 * hash) / (1 - 0.5 * hash))
}

export function ifritFragmentCount(c: Pick<IfritShatterControls, 'fragmentsPerEdge' | 'quality'>): number {
  return Math.max(1, Math.min(IFRIT_QUALITY_LIMITS[c.quality].fragments, Math.round(c.fragmentsPerEdge)))
}
/** Boundary positions along an edge (0..1) with deterministic jitter; both ends stay on the corners. */
export function ifritFragmentBoundaries(ringSlot: number, sector: number, count: number): number[] {
  return Array.from({ length: count + 1 }, (_, j) => j === 0 ? 0 : j === count ? 1 : clamp(j / count + (ifritHash(ringSlot, sector, j, 11) - 0.5) * 0.18 / count, 0.02, 0.98))
}
/** Slant at each boundary (0 at the two corners): adjacent sections share it, so whole they tile exactly. */
export const ifritCut = (ringSlot: number, sector: number, boundary: number, count: number) => boundary <= 0 || boundary >= count ? 0 : (ifritHash(ringSlot, sector, boundary, 7) - 0.5) * 1.4

/**
 * Every active portal's six edges become addressable sections. A section's pose is a pure function of its fracture amount, so it leaves its source
 * point along a deterministic path (radial, tangential and axial parts, plus its own tumble) and returns along the same path, reaching the source
 * position and orientation exactly when the fracture is 0. Only sectors with any fracture emit poses; the original edge is hidden for exactly those.
 */
export function createIfritShatterFrame(
  phases: IfritPhases, rings: readonly IfritRingPose[], controls: IfritShatterControls, channels: IfritChannels,
  pattern: IfritPattern, previous: IfritPattern = pattern, transition = 1,
): readonly IfritShardPose[] {
  if (!controls.enabled || controls.strength <= 0 && controls.trigger !== 'manual') return []
  const t = smooth(transition)
  const count = ifritFragmentCount(controls)
  const span = IFRIT_PASSAGE_SPAN * controls.spacing
  const manual = controls.trigger === 'manual'
  const out: IfritShardPose[] = []
  for (let ringSlot = 0; ringSlot < rings.length; ringSlot++) {
    const ring = rings[ringSlot]!
    const frame = ifritRingFrame(ring, controls.aperture, controls.spacing)
    if (frame.fade <= 0.001) continue
    const depth = clamp(ring.distance / span)
    for (let sector = 0; sector < IFRIT_SECTORS; sector++) {
      const bias = clamp(controls.sectorBias[sector] ?? 1)
      if (bias <= 0) continue
      const rawEvent = ifritShatterEvent(controls.trigger, ringSlot, sector, depth, phases, channels, controls.hold)
      const params = blendPattern(
        shatterPattern(previous, ringSlot, sector, depth, rawEvent, channels, controls.strength),
        shatterPattern(pattern, ringSlot, sector, depth, rawEvent, channels, controls.strength), t)
      const boundaries = ifritFragmentBoundaries(ringSlot, sector, count)
      const c0 = corner(sector), c1 = corner(sector + 1)
      const edge: [number, number] = [c1[0] - c0[0], c1[1] - c0[1]]
      const edgeLength = Math.hypot(edge[0], edge[1])
      const dir: [number, number] = [edge[0] / edgeLength, edge[1] / edgeLength]
      const phi = ifritSectorAngle(sector)
      const radial: [number, number] = [Math.cos(phi), Math.sin(phi)]
      const srcAngle = Math.atan2(dir[1], dir[0])
      const pieces: IfritShardPose[] = []
      let any = false
      for (let j = 0; j < count; j++) {
        const id = ifritComponentId(ringSlot, sector, 'shard', j)
        const patch = resolveIfritElementPatch(controls.overrides, id)
        if (patch.enabled === false) continue
        const h = ifritHash(ringSlot, sector, j, 21)
        const delay = (patch.phaseOffset ?? 0) / (Math.PI * 2) * 0.5
        const f = pieceFracture(clamp(params.ev - delay), controls.strength, bias, depth, h, manual, controls.reassembly)
        const e = smooth(f)
        any ||= f > IFRIT_FRACTURE_EPSILON
        const mid = (boundaries[j]! + boundaries[j + 1]!) / 2
        const length = (boundaries[j + 1]! - boundaries[j]!) * edgeLength
        const source: [number, number] = [c0[0] + edge[0] * mid, c0[1] + edge[1] * mid]
        const wR = 0.55 + 0.45 * ifritHash(ringSlot, sector, j, 22)
        const wT = (ifritHash(ringSlot, sector, j, 23) - 0.5) * 2 * params.swirl
        // Mostly away from the lens: pieces of the nearest frames must not fly through the camera.
        const wZ = (ifritHash(ringSlot, sector, j, 24) - 0.62) * 1.6
        const radialTerm = params.gather > 0
          ? mix(e, e < 0.25 ? -0.6 * e / 0.25 : -0.6 + 1.9 * smooth((e - 0.25) / 0.75), params.gather)
          : e
        const reach = controls.spread * 1.05 * params.spread * (patch.spreadMultiplier ?? 1)
        const crack = Math.min(e, 0.2) / 0.2 * 0.04
        const disp: [number, number, number] = [
          reach * (wR * params.radial * radial[0] * radialTerm + wT * dir[0] * e) + crack * dir[0] * (ifritHash(ringSlot, sector, j, 25) - 0.5),
          reach * (wR * params.radial * radial[1] * radialTerm + wT * dir[1] * e) + crack * dir[1] * (ifritHash(ringSlot, sector, j, 25) - 0.5),
          reach * wZ * 0.9 * e,
        ]
        const spin = controls.spin * (patch.angularVelocityMultiplier ?? 1) * e
        const fx = (ifritHash(ringSlot, sector, j, 26) - 0.5) * 2 * 2.4 * spin + (patch.rotationOffset ?? 0) * e
        const fy = (ifritHash(ringSlot, sector, j, 27) - 0.5) * 2 * 2.4 * spin
        const fz = (ifritHash(ringSlot, sector, j, 28) - 0.5) * 2 * 3.1 * spin
        const k = (patch.scaleMultiplier ?? 1)
        const thick = controls.thickness
        pieces.push(Object.freeze({
          id, ringSlot, sector, fragmentIndex: j,
          sourcePosition: ifritToWorld(frame, source[0], source[1], 0),
          position: ifritToWorld(frame, source[0] + disp[0], source[1] + disp[1], disp[2]),
          rotation: [fx, fy, srcAngle + frame.angle + fz] as const,
          scale: [length * frame.k * k, frame.k * thick * k, thick * k] as const,
          fracture: f,
          illumination: clamp(ring.illumination * frame.fade * (1 + 0.35 * e + clamp(channels.drop ?? 0) * 0.2), 0, 2),
          visible: true,
          cutStart: ifritCut(ringSlot, sector, j, count), cutEnd: ifritCut(ringSlot, sector, j + 1, count),
          corner: j === 0,
        }))
      }
      if (any) out.push(...pieces)
    }
  }
  return out
}

/** Per ring and sector, 0 where the original edge is gone (it has fragments in flight), else 1. Always 72 long. Shatter off is all ones. */
export function ifritOriginalSurvival(shards: readonly IfritShardPose[], target?: Float32Array): Float32Array {
  const out = target ?? new Float32Array(12 * IFRIT_SECTORS)
  out.fill(1)
  for (const shard of shards) out[shard.ringSlot * IFRIT_SECTORS + shard.sector] = 0
  return out
}
