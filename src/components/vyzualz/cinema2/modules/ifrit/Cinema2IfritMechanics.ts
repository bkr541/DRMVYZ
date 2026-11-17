import {
  IFRIT_MAX_BLADES, IFRIT_MAX_SATELLITES, IFRIT_SECTORS, ifritComponentId, ifritHash,
  type IfritComponentKind, type IfritPattern,
} from './Cinema2IfritDomain'
import { IFRIT_PASSAGE_SPAN, ifritStroke, type IfritChannels, type IfritPhases, type IfritRingPose } from './Cinema2IfritMotion'
import { resolveIfritElementPatch, type IfritElementOverrides } from './Cinema2IfritOverrides'

export type IfritQuality = 'low' | 'medium' | 'high'
export interface IfritSectorControl { readonly enabled: boolean; /** -1..1 */ readonly armOffset: number; /** Radians. */ readonly bladeOffset: number }
export interface IfritMechanicsControls {
  readonly enabled: boolean
  readonly density: number
  readonly spokeExtension: number
  readonly spokePulse: number
  readonly bladeSweep: number
  readonly bladeCount: number
  readonly satelliteCount: number
  readonly satelliteOrbitRadius: number
  readonly satelliteOrbitSpeed: number
  readonly sectors: readonly IfritSectorControl[]
  readonly aperture: number
  readonly spacing: number
  readonly overrides: IfritElementOverrides
  readonly quality: IfritQuality
}
/** One part's final world-space pose (rotation is Euler XYZ in radians, applied as Rz·Ry·Rx; scale is the mesh's own extents). */
export interface IfritComponentPose {
  readonly id: string
  readonly ringSlot: number
  readonly sector: number
  readonly kind: IfritComponentKind
  readonly position: readonly [number, number, number]
  readonly rotation: readonly [number, number, number]
  readonly scale: readonly [number, number, number]
  readonly illumination: number
  readonly visible: boolean
}

const TAU = Math.PI * 2
const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v))
const smooth = (v: number) => { const t = clamp(v); return t * t * (3 - 2 * t) }
const mix = (a: number, b: number, t: number) => a + (b - a) * t
const mod = (v: number, span: number) => ((v % span) + span) % span
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))
const mixAngle = (a: number, b: number, t: number) => a + wrap(b - a) * t

/** Quality tiers keep every kind of part but thin the dense ones; ids of the parts that remain are unchanged. */
export const IFRIT_QUALITY_LIMITS = Object.freeze({
  low: Object.freeze({ blades: 2, satellites: 1, fragments: 2 }),
  medium: Object.freeze({ blades: 4, satellites: 3, fragments: 3 }),
  high: Object.freeze({ blades: IFRIT_MAX_BLADES, satellites: IFRIT_MAX_SATELLITES, fragments: 4 }),
})

/** Geometry placement shared by the mechanics and the shards: ring-local (x, y, z) to world, with the ring's roll, radius and aperture. */
export interface IfritRingFrame { readonly cos: number; readonly sin: number; readonly k: number; readonly z: number; readonly angle: number; readonly fade: number }
export function ifritRingFrame(ring: IfritRingPose, aperture: number, spacing: number): IfritRingFrame {
  const farEnd = IFRIT_PASSAGE_SPAN * spacing - 0.8
  const fade = 1 - smooth((ring.distance - (farEnd - 1.8 * spacing)) / (1.8 * spacing))
  return { cos: Math.cos(ring.angle), sin: Math.sin(ring.angle), k: ring.radius * aperture, z: -ring.distance, angle: ring.angle, fade }
}
export function ifritToWorld(f: IfritRingFrame, x: number, y: number, zLocal: number): [number, number, number] {
  return [(f.cos * x - f.sin * y) * f.k, (f.sin * x + f.cos * y) * f.k, zLocal + f.z]
}
/** Centre of a sector's edge as a ring-local angle: sector 0 is the edge between corners 0 and 1. */
export const ifritSectorAngle = (sector: number) => Math.PI / 2 + (sector + 0.5) * Math.PI / 3

interface MechState { ext: number; open: number; gearTurn: number; gearDir: number; satTurn: number; satRadius: number; glow: number; satGlow: number; lock: number }

/** Each original pattern has its own mechanical arrangement. */
function mechPattern(pattern: IfritPattern, ringSlot: number, sector: number, depth: number, phases: IfritPhases, twist: number): MechState {
  const score = phases.score
  const gear = (phases.gear ?? 0) * TAU
  const ringParity = ringSlot % 2 ? -1 : 1
  const sectorParity = sector % 2 ? -1 : 1
  const stroke = ifritStroke(score / 4 - depth * 0.08)
  switch (pattern) {
    case 'infernalPassage':
      return { ext: Math.pow(1 - depth, 1.2), open: stroke, gearTurn: gear + ringSlot * 0.4, gearDir: sectorParity, satTurn: score * 0.8, satRadius: 1, glow: 0.65 + 0.35 * (1 - depth), satGlow: 1, lock: 0 }
    case 'twistedDescent':
      return { ext: 0.45 + 0.25 * Math.sin(depth * TAU - score + sector), open: ifritStroke(score / 4 - depth * 0.2 - sector * 0.12), gearTurn: gear + depth * 2.4 * (0.4 + twist), gearDir: ringParity * sectorParity,
        satTurn: score * 0.9 + depth * 3, satRadius: 1 + 0.2 * Math.sin(depth * TAU + score), glow: 0.7 + 0.3 * Math.cos(depth * Math.PI + score * 0.4) ** 2, satGlow: 1, lock: 0 }
    case 'counterfire': {
      const s = ifritStroke(score / 4)
      const alt = (ringSlot + sector) % 2 ? s : 1 - s
      return { ext: alt, open: alt, gearTurn: gear, gearDir: (ringSlot + sector) % 2 ? -1 : 1, satTurn: score * 0.8, satRadius: 1, glow: (ringSlot + sector) % 2 ? 0.65 + 0.35 * s : 1 - 0.35 * s, satGlow: 1, lock: 0 }
    }
    case 'compressionChamber': {
      const pressure = ifritStroke(score / 6)
      return { ext: 0.8 - 0.65 * pressure, open: 1 - pressure, gearTurn: gear, gearDir: ringParity, satTurn: score * 0.8, satRadius: 1 - 0.55 * pressure, glow: 0.55 + 0.45 * pressure, satGlow: 1, lock: 0 }
    }
    case 'emberRelay': {
      const wave = mod(score / 5, 1)
      const d = Math.min(Math.abs(depth - wave), 1 - Math.abs(depth - wave))
      const sw = mod(score / 3 - sector / IFRIT_SECTORS, 1)
      const sd = Math.min(sw, 1 - sw)
      const relay = 1 - smooth(sd / 0.22)
      return { ext: 0.3 + 0.5 * relay, open: relay, gearTurn: gear, gearDir: sectorParity, satTurn: score * 0.8 + sector * 0.9, satRadius: 1, glow: 0.22 + 0.95 * (1 - smooth(d / 0.3)), satGlow: 0.35 + 1.1 * relay, lock: 0 }
    }
    case 'riftLock': {
      const lock = ifritStroke(score / 4)
      return { ext: lock, open: lock, gearTurn: gear, gearDir: sectorParity, satTurn: score * 0.8, satRadius: 1, glow: 0.55 + 0.55 * lock, satGlow: 1, lock }
    }
  }
}
function blendState(a: MechState, b: MechState, t: number): MechState {
  return { ext: mix(a.ext, b.ext, t), open: mix(a.open, b.open, t), gearTurn: mixAngle(a.gearTurn, b.gearTurn, t), gearDir: mix(a.gearDir, b.gearDir, t), satTurn: mixAngle(a.satTurn, b.satTurn, t),
    satRadius: mix(a.satRadius, b.satRadius, t), glow: mix(a.glow, b.glow, t), satGlow: mix(a.satGlow, b.satGlow, t), lock: mix(a.lock, b.lock, t) }
}

/** Counts after density and quality. Density 0 removes every part; the default density keeps the authored counts. */
export function ifritEffectiveCounts(c: Pick<IfritMechanicsControls, 'density' | 'bladeCount' | 'satelliteCount' | 'quality'>) {
  const limits = IFRIT_QUALITY_LIMITS[c.quality]
  const share = c.density <= 0 ? 0 : Math.min(1, c.density / 0.7)
  return {
    blades: Math.min(limits.blades, Math.round(Math.max(0, c.bladeCount) * share)),
    satellites: Math.min(limits.satellites, Math.round(Math.max(0, c.satelliteCount) * share)),
    spokesAndGears: c.density > 0,
  }
}

export const IFRIT_SPOKE_BASE_RADIUS = 2.86
export const IFRIT_GEAR_RADIUS = 3.58
const GEAR_TEETH = 12

/**
 * Pure, reproducible kinematics for every sector's spoke, gear, blades and satellites on every active ring. The same canonical phases, authored
 * controls and shared channel values always give the same poses, whatever the frame history. A ring's near/middle/far role comes from its current
 * distance, never its slot. With `controls.enabled` false (or density 0) nothing is produced.
 */
export function createIfritMechanicalFrame(
  phases: IfritPhases, rings: readonly IfritRingPose[], controls: IfritMechanicsControls, channels: IfritChannels,
  pattern: IfritPattern, previous: IfritPattern = pattern, transition = 1,
): readonly IfritComponentPose[] {
  if (!controls.enabled) return []
  const counts = ifritEffectiveCounts(controls)
  if (!counts.spokesAndGears) return []
  const ch = (key: string) => clamp(channels[key] ?? 0)
  const t = smooth(transition)
  const out: IfritComponentPose[] = []
  const span = IFRIT_PASSAGE_SPAN * controls.spacing
  const impact = 0.7 + 0.3 * ch('directorImpact')
  for (let ringSlot = 0; ringSlot < rings.length; ringSlot++) {
    const ring = rings[ringSlot]!
    const frame = ifritRingFrame(ring, controls.aperture, controls.spacing)
    if (frame.fade <= 0.001) continue
    const depth = clamp(ring.distance / span)
    const near = 1 - smooth((depth - 0.15) / 0.45), far = smooth((depth - 0.4) / 0.5), middle = Math.max(0, 1 - Math.abs(depth - 0.5) * 2)
    for (let sector = 0; sector < IFRIT_SECTORS; sector++) {
      const sectorControl = controls.sectors[sector] ?? { enabled: true, armOffset: 0, bladeOffset: 0 }
      if (!sectorControl.enabled) continue
      const sectorPatch = resolveIfritElementPatch(controls.overrides, `ring-${String(ringSlot).padStart(2, '0')}/sector-${sector}`)
      if (sectorPatch.enabled === false) continue
      const state = blendState(mechPattern(previous, ringSlot, sector, depth, phases, 0.45), mechPattern(pattern, ringSlot, sector, depth, phases, 0.45), t)
      const phi = ifritSectorAngle(sector)
      const radial: [number, number] = [Math.cos(phi), Math.sin(phi)]
      const tangent: [number, number] = [-radial[1], radial[0]]
      const leftBank = sector <= 2
      const bank = (sector % 2 ? 0.55 : 1)
      const lit = clamp(ring.illumination * state.glow * frame.fade * (0.75 + ch('energy') * 0.3 + ch('directorIntensity') * 0.2 + ch('drop') * 0.25 * impact), 0, 2)
      const push = (kind: IfritComponentKind, index: number | undefined, localXY: readonly [number, number], zLocal: number, rotZ: number, rotX: number, rotY: number, scale: readonly [number, number, number], glow: number) => {
        const id = ifritComponentId(ringSlot, sector, kind, index)
        const patch = resolveIfritElementPatch(controls.overrides, id)
        if (patch.enabled === false) return null
        const k = patch.scaleMultiplier ?? 1
        out.push(Object.freeze({
          id, ringSlot, sector, kind,
          position: ifritToWorld(frame, localXY[0], localXY[1], zLocal),
          rotation: [rotX, rotY, rotZ + frame.angle] as const,
          scale: [scale[0] * k * frame.k, scale[1] * k * frame.k, scale[2] * k] as const,
          illumination: glow, visible: true,
        }))
        return patch
      }
      // Spoke: telescopes radially out of the portal edge into the mechanical wall.
      const spokeId = ifritComponentId(ringSlot, sector, 'spoke')
      const spokePatch = resolveIfritElementPatch(controls.overrides, spokeId)
      const kickBoost = ch('kickNear') * near * 0.5 + ch('kickMiddle') * middle * 0.4 + ch('kickFar') * far * 0.3 + ch('spokeKick') * 0.35 * bank + ch('dropExpand') * 0.3 * impact - ch('dropRecover') * 0.1 + ch('bass') * 0.08
      const ext = clamp(controls.spokeExtension * 0.7 + controls.spokePulse * state.ext * 0.55 + kickBoost + sectorControl.armOffset * 0.5 + (spokePatch.extensionOffset ?? 0) * 0.5)
      const spokeLength = 0.18 + 0.86 * ext
      push('spoke', undefined, [radial[0] * IFRIT_SPOKE_BASE_RADIUS, radial[1] * IFRIT_SPOKE_BASE_RADIUS], 0.04, phi + (spokePatch.rotationOffset ?? 0) * 0.15, 0, 0, [spokeLength, 0.15, 0.16], lit)
      // Gear: an independent toothed rotor with its own rate and direction; a downbeat snaps it a short angular stroke, a drop aligns its teeth.
      const gearId = ifritComponentId(ringSlot, sector, 'gear')
      const gearPatch = resolveIfritElementPatch(controls.overrides, gearId)
      const dir = Math.sign(state.gearDir || 1) * Math.min(1, Math.abs(state.gearDir))
      let gearAngle = state.gearTurn * dir * (gearPatch.angularVelocityMultiplier ?? 1) + (gearPatch.phaseOffset ?? 0) + (gearPatch.rotationOffset ?? 0) + ch('gearDownbeat') * (Math.PI / GEAR_TEETH) * (state.gearDir >= 0 ? 1 : -1) + ifritHash(ringSlot, sector, 0, 1) * 0.5
      const toothStep = TAU / GEAR_TEETH
      gearAngle = mixAngle(gearAngle, Math.round(gearAngle / toothStep) * toothStep, clamp(ch('dropAlign') * 0.85 + state.lock * 0.9))
      const gearRadius = 0.36
      push('gear', undefined, [radial[0] * IFRIT_GEAR_RADIUS, radial[1] * IFRIT_GEAR_RADIUS], -0.3, gearAngle, 0, 0, [gearRadius, gearRadius, 0.16], lit * 0.85)
      // Blades: articulated, each pivoting about its own base and fanned across the sector; snares strike alternate banks.
      for (let i = 0; i < counts.blades; i++) {
        const id = ifritComponentId(ringSlot, sector, 'blade', i)
        const patch = resolveIfritElementPatch(controls.overrides, id)
        const fan = (i - (counts.blades - 1) / 2) * 0.17
        const strike = ch('bladeSnare') * 0.55 + (leftBank ? ch('snareLeft') : ch('snareRight')) * 0.8
        const alternate = i % 2 ? -1 : 1
        const sweepAmount = clamp(controls.bladeSweep + (patch.extensionOffset ?? 0) * 0.5, 0, 1.5)
        const sweep = ((state.open * 2 - 1) * 0.9 * sweepAmount + strike * 0.9 * alternate * Math.max(0.3, controls.bladeSweep)) * (patch.angularVelocityMultiplier ?? 1) + (patch.phaseOffset ?? 0)
        let angle = phi + fan * 1.6 + sweep + sectorControl.bladeOffset + (patch.rotationOffset ?? 0)
        angle = mixAngle(angle, Math.round(angle / (Math.PI / 3)) * (Math.PI / 3), clamp(ch('dropAlign') * 0.6 + state.lock * 0.85))
        const pivotRadius = 3.28
        push('blade', i, [radial[0] * pivotRadius + tangent[0] * fan, radial[1] * pivotRadius + tangent[1] * fan], 0.2 + i * 0.012, angle, 0, 0, [0.5 * (0.85 + 0.3 * state.open), 0.13, 0.05], lit)
      }
      // Satellites orbit in the plane of the tangent and the axis, so they sweep through depth and never enter the central opening.
      for (let j = 0; j < counts.satellites; j++) {
        const id = ifritComponentId(ringSlot, sector, 'satellite', j)
        const patch = resolveIfritElementPatch(controls.overrides, id)
        const speed = controls.satelliteOrbitSpeed * (patch.angularVelocityMultiplier ?? 1)
        const orbit = (state.satTurn * 0.6 * speed) + j * TAU / Math.max(1, counts.satellites) + (patch.phaseOffset ?? 0) + ch('satellitePhrase') * Math.PI * 0.9 * Math.sign(controls.satelliteOrbitSpeed || 1)
        const snappedOrbit = mixAngle(orbit, Math.round(orbit / (Math.PI / 3)) * (Math.PI / 3), state.lock * 0.9)
        const rho = clamp((controls.satelliteOrbitRadius * state.satRadius * (patch.spreadMultiplier ?? 1) + (patch.extensionOffset ?? 0) * 0.5) * (1 + ch('satellitePhrase') * 0.25), 0.05, 1.5)
        const anchorRadius = 3.78
        const lateral = Math.cos(snappedOrbit) * rho
        const axial = Math.sin(snappedOrbit) * rho
        push('satellite', j, [radial[0] * anchorRadius + tangent[0] * lateral, radial[1] * anchorRadius + tangent[1] * lateral], axial, snappedOrbit * 0.6, snappedOrbit * 1.3, snappedOrbit * 0.8, [0.1, 0.1, 0.1], lit * state.satGlow * (0.8 + 0.4 * ifritHash(ringSlot, sector, j, 4)))
      }
    }
  }
  return out
}
