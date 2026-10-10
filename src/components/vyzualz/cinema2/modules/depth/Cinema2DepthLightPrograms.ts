import type { Cinema2DepthInstance, Cinema2DepthProofLayout } from './Cinema2DepthLayout'
import type { Cinema2DepthOrchestrationFrame } from './Cinema2DepthOrchestration'

export const CINEMA2_DEPTH_LIGHT_PROGRAMS = Object.freeze([
  'architecturalSparse',
  'depthChase',
  'sideOrbit',
  'gatePulse',
  'alternatingFrames',
  'fullPulse',
  'depthDischarge',
  'portalRelay',
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
  orchestration?: Readonly<Cinema2DepthOrchestrationFrame>
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
  const orchestration = controls.orchestration
  const programTime = orchestration ? orchestration.beats * 0.5 : time
  const direction = controls.direction === 'reverse' ? -1 : 1
  const seed = Math.round(finite(controls.seed, 0))
  const seedPhase = hash01(seed) * count
  const travel = positiveModulo(seedPhase + direction * programTime * rate, count)
  const depthDistance = circularDistance(portal, travel, count)
  const depthLevel = movingWindow(depthDistance, span)

  const evaluate = (program: Cinema2DepthLightProgram): number => {
    let programLevel: number
    switch (program) {
    case 'architecturalSparse': {
      const requested = orchestration ? 3 + Math.round(orchestration.routeDensity * 3) : span
      programLevel = sparseArchitecturalLevel(portal, side, count, programTime, rate, requested, direction, seed)
      break
    }
    case 'sideOrbit': {
      const depthPhase = orchestration ? portal * 0.72 : portal * 0.23
      const orbit = positiveModulo(hash01(seed + 101) * 4 + direction * programTime * rate * 0.9 + depthPhase, 4)
      const sideDistance = circularDistance(side, orbit, 4)
      const sideWidth = orchestration ? 0.34 + orchestration.pulseWidth * 0.48 : 0.42
      const sideLevel = 1 - smoothstep(sideWidth, sideWidth + 0.7, sideDistance)
      programLevel = depthLevel * (0.04 + sideLevel * 0.96)
      break
    }
    case 'gatePulse': {
      const gatePulse = 0.54 + 0.46 * Math.cos(Math.min(1, depthDistance / Math.max(0.6, span * 0.5)) * Math.PI)
      const kick = orchestration?.accents[0] ?? 0
      programLevel = depthLevel * Math.max(0.08, gatePulse) * (0.62 + kick * 0.38)
      break
    }
    case 'alternatingFrames': {
      // Eight subdivisions per four-beat bar keep the gates trading places
      // throughout the bar instead of holding one block for multiple beats.
      const step = orchestration
        ? Math.floor(orchestration.beats * 2)
        : Math.floor(Math.abs(programTime) * rate + hash01(seed + 211) * 2)
      const parity = positiveModulo(portal + step * direction, 2)
      const pair = orchestration ? positiveModulo(side + Math.floor(step / 2), 2) === 0 : true
      programLevel = parity === 0 && pair ? 1 : 0
      break
    }
    case 'fullPulse': {
      const phase = direction * programTime * rate * Math.PI * 2 + hash01(seed + 307) * Math.PI * 2
      const quietCeiling = orchestration ? 1 - orchestration.quiet * 0.72 : 1
      programLevel = (0.1 + (0.5 + 0.5 * Math.sin(phase)) * 0.9) * quietCeiling
      break
    }
    case 'depthDischarge': {
      programLevel = orchestration
        ? depthDischargeLevel(portal, side, count, orchestration)
        : movingWindow(circularDistance(portal, travel, count), span)
      break
    }
    case 'portalRelay': {
      programLevel = orchestration
        ? portalRelayLevel(portal, side, count, orchestration)
        : sparseArchitecturalLevel(portal, side, count, time, rate, span, direction, seed)
      break
    }
    case 'depthChase':
    default: {
      // A slight side offset lets the chase articulate each face while the
      // four sides still read as one portal at normal playback speed.
      const sideTravel = positiveModulo(travel - direction * side * 0.11, count)
      const laneGate = orchestration
        ? side === positiveModulo(Math.floor(orchestration.beats / 2) + seed, 4) ? 1 : 0.06
        : 1
      programLevel = movingWindow(circularDistance(portal, sideTravel, count), span) * laneGate
      break
    }
    }
    return programLevel
  }
  let level = orchestration
    ? CINEMA2_DEPTH_LIGHT_PROGRAMS.reduce((sum, program, index) => sum + evaluate(program) * (orchestration.weights[index] ?? 0), 0)
    : evaluate(controls.program)
  if (orchestration && !isDepthDischargeActive(orchestration)) {
    level = applyDepthCounterpoint(level, portal, side, count, orchestration, seed)
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

function depthDischargeLevel(
  portal: number,
  side: number,
  portalCount: number,
  frame: Readonly<Cinema2DepthOrchestrationFrame>,
): number {
  if (frame.dropElapsed < 0.09) return 0
  if (frame.dropDischarge > 0 && frame.dropDischarge < 1) {
    const front = (portalCount - 1) * (1 - frame.dropDischarge)
    const width = 0.38 + frame.pulseWidth * 1.55
    const distance = Math.abs(portal - front)
    const ring = Math.exp(-(distance * distance) / Math.max(0.08, width * width))
    const groupedSide = side % 2 === Math.floor(frame.dropDischarge * 8) % 2 ? 1 : 0.72
    return ring * groupedSide * frame.dropIntensity
  }
  if (frame.dropAfterglow > 0) {
    const lane = side === positiveModulo(portal + Math.floor(frame.beats), 4) ? 1 : 0.12
    return frame.dropAfterglow * lane * 0.36 * frame.dropIntensity
  }
  if (frame.build <= 0.01) return 0
  const helicalSide = positiveModulo(side - portal, 4)
  // Recruit alternating near/far gates first, then work toward the middle.
  // Each helical side traverses the full depth before the next side joins.
  const rank = helicalSide * portalCount + alternatingEdgeRank(portal, portalCount)
  const recruited = Math.floor(frame.build * portalCount * 4)
  let level = rank < recruited ? 0.28 + frame.build * 0.48 : 0
  if (frame.countdown > 0) {
      const countdownGate = clamp(portalCount - frame.countdown, 0, portalCount - 1)
    if (portal === countdownGate) level = Math.max(level, 0.72 + (5 - frame.countdown) * 0.07)
  }
  return level
}

/**
 * Adds bar-scale counterpoint to every musical program. Three of the eight
 * subdivisions pair near and far gates with an intentionally dark middle;
 * two invert that shape around the tunnel center; the others preserve the
 * authored chase, orbit, or relay. Opposing faces at opposite depths prevent
 * the selected portals from reading as one solid ring.
 */
function applyDepthCounterpoint(
  authoredLevel: number,
  portal: number,
  side: number,
  portalCount: number,
  frame: Readonly<Cinema2DepthOrchestrationFrame>,
  seed: number,
): number {
  const subdivision = positiveModulo(Math.floor(frame.beats * 2), 8)
  const endsSubdivision = subdivision === 0 || subdivision === 2 || subdivision === 4
  const middleSubdivision = subdivision === 3 || subdivision === 6
  if (!endsSubdivision && !middleSubdivision) return authoredLevel

  const edgeWidth = Math.max(1, Math.floor(portalCount / 4))
  const middleLeft = Math.max(0, Math.floor((portalCount - 1) / 2))
  const middleRight = Math.min(portalCount - 1, Math.ceil((portalCount - 1) / 2))
  const atEnds = portal < edgeWidth || portal >= portalCount - edgeWidth
  const atMiddle = portal === middleLeft || portal === middleRight
  const selectedDepth = endsSubdivision ? atEnds : atMiddle
  const lane = positiveModulo(seed + subdivision + Math.floor(frame.beats / 4), 4)
  const targetSide = portal < portalCount / 2 ? lane : positiveModulo(lane + 2, 4)
  const sideLevel = side === targetSide
    ? 1
    : side === positiveModulo(targetSide + 2, 4)
      ? 0.3
      : 0
  const retained = authoredLevel * (selectedDepth ? 0.92 : 0.16)
  if (!selectedDepth || sideLevel === 0) return retained
  const accent = (0.46 + frame.level * 0.28 + frame.routeDensity * 0.12) * sideLevel
  return Math.max(retained, accent)
}

function isDepthDischargeActive(frame: Readonly<Cinema2DepthOrchestrationFrame>): boolean {
  return Number.isFinite(frame.dropElapsed) && frame.dropElapsed < 1.54
}

function alternatingEdgeRank(portal: number, portalCount: number): number {
  const fromNear = portal
  const fromFar = portalCount - 1 - portal
  return fromNear <= fromFar ? fromNear * 2 : fromFar * 2 + 1
}

function portalRelayLevel(
  portal: number,
  side: number,
  portalCount: number,
  frame: Readonly<Cinema2DepthOrchestrationFrame>,
): number {
  const memberships = [
    side,
    4 + positiveModulo(portal, 2),
    6 + (positiveModulo(side - portal, 4) === 0 || positiveModulo(side - portal, 4) === 2 ? positiveModulo(side - portal, 4) / 2 : -8),
  ].filter(group => group >= 0 && group < 8)
  const reach = Math.floor(frame.routeDensity * 2.5)
  const active = memberships.some(group => circularDistance(group, frame.relayGroup, 8) <= reach)
  if (!active) return 0
  const pulseFront = positiveModulo(frame.beats * 2, portalCount)
  const width = 0.45 + frame.pulseWidth * 2.2
  const pulse = 1 - smoothstep(width, width + 0.8, circularDistance(portal, pulseFront, portalCount))
  const [kick, snare, transient, downbeat] = frame.accents
  const accent = Math.max(kick, snare * 0.88, transient * 0.72, downbeat)
  return pulse * (0.5 + accent * 0.5)
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
  if (instance.kind === 'connector') {
    const cornerSides = [instance.sideIndex, instance.sideIndex + 1]
    return Math.max(...cornerSides.flatMap(side => [
      segmentLevel(instance.portalIndex, side),
      segmentLevel(instance.portalIndex + 1, side),
    ])) * 0.55
  }
  if (instance.kind === 'frame') return segmentLevel(instance.portalIndex, instance.sideIndex) * 0.34
  if (instance.kind === 'node' || instance.kind === 'collar') {
    const first = segmentLevel(instance.portalIndex, instance.sideIndex)
    const second = segmentLevel(instance.portalIndex, instance.sideIndex + 1)
    return Math.max(first, second) * (instance.kind === 'collar' ? 0.3 : 0.22)
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
