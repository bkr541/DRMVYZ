import type { Cinema2DepthInstance, Cinema2DepthProofLayout } from './Cinema2DepthLayout'

export const CINEMA2_DEPTH_LIGHT_PROGRAMS = Object.freeze([
  'depthChase',
  'sideOrbit',
  'gatePulse',
  'alternatingFrames',
  'fullPulse',
] as const)

export type Cinema2DepthLightProgram = (typeof CINEMA2_DEPTH_LIGHT_PROGRAMS)[number]

export const CINEMA2_DEPTH_LIGHT_DIRECTIONS = Object.freeze(['forward', 'reverse'] as const)
export type Cinema2DepthLightDirection = (typeof CINEMA2_DEPTH_LIGHT_DIRECTIONS)[number]

export interface Cinema2DepthLightControls {
  program: Cinema2DepthLightProgram
  direction: Cinema2DepthLightDirection
  /** Program advances per second. Zero deliberately freezes the selected state. */
  rate: number
  /** Approximate number of neighboring portals addressed by depth-based programs. */
  activeSpan: number
  seed: number
  centerEnabled: boolean
  centerIntensity: number
}

export interface Cinema2DepthLightFrame {
  readonly emissions: Float32Array
  readonly spills: Float32Array
  readonly portalLevels: Float32Array
}

export function createCinema2DepthLightFrame(instanceCount: number, portalCount = 0): Cinema2DepthLightFrame {
  const count = Math.max(0, Math.floor(instanceCount))
  return {
    emissions: new Float32Array(count),
    spills: new Float32Array(count),
    portalLevels: new Float32Array(Math.max(0, Math.floor(portalCount))),
  }
}

/**
 * Updates reusable arrays from absolute time. No state accumulates between
 * frames, so seeking, pausing and identical time/seed/settings are exact.
 */
export function updateCinema2DepthLightFrame(
  output: Cinema2DepthLightFrame,
  layout: Readonly<Cinema2DepthProofLayout>,
  timeSeconds: number,
  controls: Readonly<Cinema2DepthLightControls>,
): Cinema2DepthLightFrame {
  if (
    output.emissions.length !== layout.instances.length
    || output.spills.length !== layout.instances.length
    || output.portalLevels.length !== layout.portalCount
  ) {
    throw new Error('Cinema 2.0 Depth light-frame buffers must match the layout instance and portal counts.')
  }

  const portalLevels = output.portalLevels
  portalLevels.fill(0)
  for (let index = 0; index < layout.instances.length; index += 1) {
    const instance = layout.instances[index]!
    const emission = instance.kind === 'strip'
      ? resolveCinema2DepthProgramEmission(instance.portalIndex, instance.sideIndex, layout.portalCount, timeSeconds, controls)
      : instance.kind === 'center' && controls.centerEnabled
        ? clamp(controls.centerIntensity, 0, 2)
        : 0
    output.emissions[index] = emission
    if (instance.kind === 'strip') portalLevels[instance.portalIndex] = Math.max(portalLevels[instance.portalIndex]!, emission)
  }

  for (let index = 0; index < layout.instances.length; index += 1) {
    const instance = layout.instances[index]!
    output.spills[index] = resolveSpill(instance, portalLevels, controls)
  }
  return output
}

/** Canonical, independently addressable portal-side program evaluation. */
export function resolveCinema2DepthProgramEmission(
  portalIndex: number,
  sideIndex: number,
  portalCount: number,
  timeSeconds: number,
  controls: Readonly<Cinema2DepthLightControls>,
): number {
  const count = Math.max(1, Math.floor(portalCount))
  const portal = positiveModulo(Math.floor(portalIndex), count)
  const side = positiveModulo(Math.floor(sideIndex), 4)
  const rate = clamp(finite(controls.rate, 1), 0, 8)
  const span = clamp(Math.round(finite(controls.activeSpan, 3)), 1, count)
  const time = finite(timeSeconds, 0)
  const direction = controls.direction === 'reverse' ? -1 : 1
  const seed = Math.round(finite(controls.seed, 0))
  const seedPhase = hash01(seed) * count
  const travel = positiveModulo(seedPhase + direction * time * rate, count)
  const depthDistance = circularDistance(portal, travel, count)
  const depthLevel = movingWindow(depthDistance, span)

  let level: number
  switch (controls.program) {
    case 'sideOrbit': {
      const orbit = positiveModulo(hash01(seed + 101) * 4 + direction * time * rate * 0.9 + portal * 0.23, 4)
      const sideDistance = circularDistance(side, orbit, 4)
      const sideLevel = 1 - smoothstep(0.42, 1.12, sideDistance)
      level = depthLevel * (0.06 + sideLevel * 0.94)
      break
    }
    case 'gatePulse': {
      const gatePulse = 0.54 + 0.46 * Math.cos(Math.min(1, depthDistance / Math.max(0.6, span * 0.5)) * Math.PI)
      level = depthLevel * Math.max(0.08, gatePulse)
      break
    }
    case 'alternatingFrames': {
      const step = Math.floor(Math.abs(time) * rate + hash01(seed + 211) * 2)
      const parity = positiveModulo(portal + step * direction, 2)
      level = parity === 0 ? 1 : 0.035
      break
    }
    case 'fullPulse': {
      const phase = direction * time * rate * Math.PI * 2 + hash01(seed + 307) * Math.PI * 2
      level = 0.16 + (0.5 + 0.5 * Math.sin(phase)) * 0.84
      break
    }
    case 'depthChase':
    default: {
      // A slight side offset lets the chase articulate each face while the
      // four sides still read as one portal at normal playback speed.
      const sideTravel = positiveModulo(travel - direction * side * 0.11, count)
      level = movingWindow(circularDistance(portal, sideTravel, count), span)
      break
    }
  }
  return clamp(level, 0, 1)
}

function resolveSpill(
  instance: Readonly<Cinema2DepthInstance>,
  portalLevels: Float32Array,
  controls: Readonly<Cinema2DepthLightControls>,
): number {
  if (instance.kind === 'strip') return portalLevels[instance.portalIndex] ?? 0
  if (instance.kind === 'frame') return (portalLevels[instance.portalIndex] ?? 0) * 0.72
  if (instance.kind === 'node') return (portalLevels[instance.portalIndex] ?? 0) * 0.5
  if (instance.kind === 'rail') {
    return Math.max(portalLevels[instance.portalIndex] ?? 0, portalLevels[instance.portalIndex + 1] ?? 0) * 0.28
  }
  return controls.centerEnabled ? clamp(controls.centerIntensity, 0, 2) : 0
}

function movingWindow(distance: number, span: number): number {
  const radius = Math.max(0.5, span * 0.5)
  return 1 - smoothstep(Math.max(0, radius - 0.5), radius + 0.5, distance)
}

function circularDistance(a: number, b: number, period: number): number {
  const direct = Math.abs(a - b)
  return Math.min(direct, Math.max(0, period - direct))
}

function positiveModulo(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  if (edge0 === edge1) return value < edge0 ? 0 : 1
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}

function hash01(seed: number): number {
  let value = Math.imul(seed | 0, 0x45d9f3b)
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b)
  value ^= value >>> 16
  return (value >>> 0) / 0x1_0000_0000
}

function finite(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
