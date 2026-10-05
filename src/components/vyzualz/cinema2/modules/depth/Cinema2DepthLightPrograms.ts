import type { Cinema2DepthInstance, Cinema2DepthProofLayout } from './Cinema2DepthLayout'

export const CINEMA2_DEPTH_LIGHT_PROGRAMS = Object.freeze([
  'architecturalSparse',
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
  beatAccent?: number
  downbeatAccent?: number
  phraseAccent?: number
  buildAmount?: number
  dropAccent?: number
}

export interface Cinema2DepthLightFrame {
  readonly emissions: Float32Array
  readonly spills: Float32Array
  readonly portalLevels: Float32Array
  readonly segmentLevels: Float32Array
}

export function createCinema2DepthLightFrame(instanceCount: number, portalCount = 0): Cinema2DepthLightFrame {
  const count = Math.max(0, Math.floor(instanceCount))
  return {
    emissions: new Float32Array(count),
    spills: new Float32Array(count),
    portalLevels: new Float32Array(Math.max(0, Math.floor(portalCount))),
    segmentLevels: new Float32Array(Math.max(0, Math.floor(portalCount)) * 4),
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
    || output.segmentLevels.length !== layout.portalCount * 4
  ) {
    throw new Error('Cinema 2.0 Depth light-frame buffers must match the layout instance and portal counts.')
  }

  const portalLevels = output.portalLevels
  const segmentLevels = output.segmentLevels
  portalLevels.fill(0)
  segmentLevels.fill(0)
  for (let index = 0; index < layout.instances.length; index += 1) {
    const instance = layout.instances[index]!
    const emission = instance.kind === 'strip'
      ? resolveCinema2DepthProgramEmission(instance.portalIndex, instance.sideIndex, layout.portalCount, timeSeconds, controls)
      : instance.kind === 'center' && controls.centerEnabled
        ? clamp(controls.centerIntensity, 0, 2)
        : 0
    output.emissions[index] = emission
    if (instance.kind === 'strip') {
      portalLevels[instance.portalIndex] = Math.max(portalLevels[instance.portalIndex]!, emission)
      segmentLevels[instance.portalIndex * 4 + instance.sideIndex] = emission
    }
  }

  for (let index = 0; index < layout.instances.length; index += 1) {
    const instance = layout.instances[index]!
    output.spills[index] = resolveSpill(instance, segmentLevels, controls)
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
    case 'architecturalSparse': {
      level = sparseArchitecturalLevel(portal, side, count, time, rate, span, direction, seed)
      break
    }
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
      level = parity === 0 ? 1 : 0
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
  const beat = clamp(controls.beatAccent ?? 0, 0, 1)
  const downbeat = clamp(controls.downbeatAccent ?? 0, 0, 1)
  const phrase = clamp(controls.phraseAccent ?? 0, 0, 1)
  const build = clamp(controls.buildAmount ?? 0, 0, 1)
  const drop = clamp(controls.dropAccent ?? 0, 0, 1)
  // Musical energy enhances the authored state instead of lifting every dark
  // strip. Only a small deterministic selection can become newly emissive.
  level *= 1 + beat * 0.12 + build * 0.2 + drop * 0.28
  const accentEpoch = Math.floor(time * Math.max(0.25, rate * 0.5) + hash01(seed + 401) * 7)
  const downbeatSegment = accentSegment(seed + 503, accentEpoch, count)
  const phraseSegment = relatedSegment(downbeatSegment, count, seed + accentEpoch)
  const dropSegment = accentSegment(seed + 809, accentEpoch + 3, count)
  const segment = portal * 4 + side
  if (segment === downbeatSegment) level = Math.max(level, downbeat * 0.68)
  if (segment === phraseSegment) level = Math.max(level, phrase * 0.56)
  if (segment === dropSegment) level = Math.max(level, drop * 0.92)
  return clamp(level, 0, 1)
}

/**
 * Slowly changing bar tracks form the reference-style default. One track
 * crossfades at a time, so motion stays smooth without filling the tunnel. A
 * low-frequency related bar occasionally creates an L or opposite-side pair.
 */
function sparseArchitecturalLevel(
  portal: number,
  side: number,
  portalCount: number,
  time: number,
  rate: number,
  requestedCount: number,
  direction: number,
  seed: number,
): number {
  const trackCount = clamp(Math.round(requestedCount), 3, 6)
  const timeline = Math.max(0, time) * rate * 0.55 + hash01(seed + 17) * trackCount * 2
  const step = Math.floor(timeline)
  const phase = timeline - step
  const changingTrack = positiveModulo(step, trackCount)
  const fade = smoothstep(0.12, 0.88, phase)
  const segment = portal * 4 + side
  let level = 0

  for (let track = 0; track < trackCount; track += 1) {
    const generation = Math.floor((step - track) / trackCount)
    const current = sparseTrackSegment(track, generation, trackCount, portalCount, direction, seed)
    if (track === changingTrack) {
      const previous = sparseTrackSegment(track, generation - 1, trackCount, portalCount, direction, seed)
      if (segment === previous) level = Math.max(level, 1 - fade)
      if (segment === current) level = Math.max(level, fade)
    } else if (segment === current) {
      level = 1
    }
  }

  const relationshipPhase = positiveModulo(timeline / trackCount + hash01(seed + 233), 1)
  const relationshipEnvelope = smoothstep(0.4, 0.5, relationshipPhase)
    * (1 - smoothstep(0.78, 0.9, relationshipPhase))
  if (relationshipEnvelope > 0) {
    const motifRound = Math.floor(timeline / trackCount)
    const anchorTrack = positiveModulo(motifRound + seed, trackCount)
    const anchorGeneration = Math.floor((step - anchorTrack) / trackCount)
    const anchor = sparseTrackSegment(anchorTrack, anchorGeneration, trackCount, portalCount, direction, seed)
    const relationship = relatedSegment(anchor, portalCount, seed + motifRound * 31)
    if (segment === relationship) level = Math.max(level, relationshipEnvelope * 0.78)
  }

  return level
}

function sparseTrackSegment(
  track: number,
  generation: number,
  trackCount: number,
  portalCount: number,
  direction: number,
  seed: number,
): number {
  const depthStride = Math.max(1, Math.floor(portalCount / trackCount))
  const seedPortal = Math.floor(hash01(seed + 71) * portalCount)
  const portal = positiveModulo(seedPortal + track * depthStride + generation * direction, portalCount)
  const side = Math.floor(hash01(seed + track * 131 + generation * 977) * 4)
  return portal * 4 + side
}

function accentSegment(seed: number, epoch: number, portalCount: number): number {
  return Math.floor(hash01(seed + epoch * 619) * portalCount * 4)
}

function relatedSegment(segment: number, portalCount: number, seed: number): number {
  const portal = Math.floor(positiveModulo(segment, portalCount * 4) / 4)
  const side = positiveModulo(segment, 4)
  const sideOffset = hash01(seed + 919) < 0.68 ? 1 : 2
  return portal * 4 + positiveModulo(side + sideOffset, 4)
}

function resolveSpill(
  instance: Readonly<Cinema2DepthInstance>,
  segmentLevels: Float32Array,
  controls: Readonly<Cinema2DepthLightControls>,
): number {
  const portalCount = Math.max(1, Math.floor(segmentLevels.length / 4))
  const segmentLevel = (portal: number, side: number) => segmentLevels[
    positiveModulo(portal, portalCount) * 4 + positiveModulo(side, 4)
  ] ?? 0
  if (instance.kind === 'strip') {
    const own = segmentLevel(instance.portalIndex, instance.sideIndex)
    const aroundCorner = Math.max(
      segmentLevel(instance.portalIndex, instance.sideIndex - 1),
      segmentLevel(instance.portalIndex, instance.sideIndex + 1),
    ) * 0.42
    const alongTunnel = Math.max(
      segmentLevel(instance.portalIndex - 1, instance.sideIndex),
      segmentLevel(instance.portalIndex + 1, instance.sideIndex),
    ) * 0.2
    const acrossGate = segmentLevel(instance.portalIndex, instance.sideIndex + 2) * 0.08
    return Math.max(own, aroundCorner, alongTunnel, acrossGate)
  }
  if (instance.kind === 'frame') return segmentLevel(instance.portalIndex, instance.sideIndex) * 0.34
  if (instance.kind === 'node') {
    const first = segmentLevel(instance.portalIndex, instance.sideIndex)
    const second = segmentLevel(instance.portalIndex, instance.sideIndex + 1)
    return Math.max(first, second) * 0.22
  }
  if (instance.kind === 'rail') {
    const sides = [instance.sideIndex, instance.sideIndex + 1]
    return Math.max(...sides.flatMap(segmentSide => [
      segmentLevel(instance.portalIndex, segmentSide),
      segmentLevel(instance.portalIndex + 1, segmentSide),
    ])) * 0.14
  }
  return 0
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
