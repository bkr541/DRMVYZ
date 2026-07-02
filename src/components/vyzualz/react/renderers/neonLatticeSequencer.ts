import type {
  NeonLatticeLanePattern,
  NeonLatticeLanePatternStep,
  NeonLatticeLineOrientation,
  NeonLatticeCustomSegment,
  NeonLatticePaletteRole,
  NeonLatticeSettings,
} from '../ReactTypes'
import type { NeonPaletteRgb, NeonSegment } from './neonLatticeUtils'
import { makeSegmentFromEndpoints, prngNext } from './neonLatticeUtils'

export interface NeonLaneDefinition {
  id: string
  orientation: NeonLatticeLineOrientation
  laneIndex: number
  laneCount: number
  startX: number
  startY: number
  endX: number
  endY: number
}

export interface NeonLatticeSequencerState {
  patternId: string
  patternSeed: number
  currentStep: number
  lastTriggerIndex: number
  reseedGeneration: number
  laneSignature: string
  lanes: NeonLaneDefinition[]
}

export interface NeonLatticeSequenceTrigger {
  stepIndex: number
  step: NeonLatticeLanePatternStep
  lanes: NeonLaneDefinition[]
  strength: number
  paletteRole?: NeonLatticePaletteRole
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
}

function diagonalLaneEndpoints(
  orientation: 'diagonalUp' | 'diagonalDown',
  normalizedOffset: number,
): { startX: number; startY: number; endX: number; endY: number } {
  const offset = (normalizedOffset - 0.5) * 1.5
  if (orientation === 'diagonalDown') {
    // y = x + offset
    const startX = Math.max(0, -offset)
    const startY = Math.max(0, offset)
    const endX = Math.min(1, 1 - offset)
    const endY = Math.min(1, 1 + offset)
    return { startX, startY, endX, endY }
  }
  // y = 1 - x + offset
  const startX = Math.max(0, offset)
  const startY = Math.min(1, 1 + offset)
  const endX = Math.min(1, 1 + offset)
  const endY = Math.max(0, offset)
  return { startX, startY, endX, endY }
}

export function laneGeometryFor(
  orientation: Exclude<NeonLatticeLineOrientation, 'custom'>,
  laneIndex: number,
  laneCount: number,
  mirrored = false,
  margin = 0.08,
): NeonLaneDefinition {
  const count = Math.max(1, Math.round(laneCount))
  const sourceIndex = Math.max(0, Math.min(count - 1, Math.round(laneIndex)))
  const resolvedIndex = mirrored ? count - 1 - sourceIndex : sourceIndex
  const t = count === 1 ? 0.5 : resolvedIndex / (count - 1)
  const position = margin + t * (1 - margin * 2)
  let geometry: { startX: number; startY: number; endX: number; endY: number }
  switch (orientation) {
    case 'vertical':
      geometry = { startX: position, startY: 0, endX: position, endY: 1 }
      break
    case 'horizontal':
      geometry = { startX: 0, startY: position, endX: 1, endY: position }
      break
    case 'diagonalUp':
    case 'diagonalDown':
      geometry = diagonalLaneEndpoints(orientation, position)
      break
  }
  return {
    id: `lane-${orientation}-${sourceIndex}-of-${count}${mirrored ? '-mirrored' : ''}`,
    orientation,
    laneIndex: sourceIndex,
    laneCount: count,
    ...geometry,
  }
}

export function buildStableLaneGeometry(
  pattern: NeonLatticeLanePattern,
  mirrored = pattern.mirrored,
): NeonLaneDefinition[] {
  const orientations = pattern.orientations.filter(
    (orientation): orientation is Exclude<NeonLatticeLineOrientation, 'custom'> => orientation !== 'custom',
  )
  const result: NeonLaneDefinition[] = []
  for (const orientation of orientations.length > 0 ? orientations : ['vertical'] as const) {
    for (let laneIndex = 0; laneIndex < pattern.laneCount; laneIndex++) {
      result.push(laneGeometryFor(orientation, laneIndex, pattern.laneCount, mirrored))
    }
  }
  return result
}

export function createNeonLatticeSequencerState(pattern: NeonLatticeLanePattern): NeonLatticeSequencerState {
  const lanes = buildStableLaneGeometry(pattern)
  return {
    patternId: pattern.id,
    patternSeed: pattern.seed,
    currentStep: -1,
    lastTriggerIndex: -1,
    reseedGeneration: 0,
    laneSignature: `${pattern.id}:${pattern.seed}:${pattern.laneCount}:${pattern.sequenceLength}:${pattern.orientations.join(',')}:${pattern.mirrored}`,
    lanes,
  }
}

export function resetNeonLatticeSequencerState(
  state: NeonLatticeSequencerState,
  pattern: NeonLatticeLanePattern,
): void {
  const next = createNeonLatticeSequencerState(pattern)
  Object.assign(state, next)
}

export function reseedNeonLatticePattern(
  state: NeonLatticeSequencerState,
  pattern: NeonLatticeLanePattern,
  seed?: number,
): void {
  state.patternSeed = Math.max(1, Math.round(seed ?? state.patternSeed + 1))
  state.reseedGeneration += 1
  state.currentStep = -1
  state.lastTriggerIndex = -1
  state.laneSignature = `${pattern.id}:${pattern.seed}:${pattern.laneCount}:${pattern.sequenceLength}:${pattern.orientations.join(',')}:${pattern.mirrored}`
  state.lanes = buildStableLaneGeometry({ ...pattern, seed: state.patternSeed })
}

function seededLaneRotation(seed: number, stepIndex: number, laneCount: number): number {
  if (laneCount <= 1) return 0
  const [, next] = prngNext(seed ^ ((stepIndex + 1) * 0x9e3779b1))
  return next % laneCount
}

export function resolvePatternStepLanes(
  pattern: NeonLatticeLanePattern,
  state: NeonLatticeSequencerState,
  stepIndex: number,
  step: NeonLatticeLanePatternStep,
): number[] {
  if (step.rest || step.lanes.length === 0) return []
  const rotation = state.reseedGeneration > 0
    ? seededLaneRotation(state.patternSeed, stepIndex, pattern.laneCount)
    : 0
  const base = step.lanes.map(lane => (lane + rotation) % pattern.laneCount)
  const expanded = [...base]
  if (step.chordSize && step.chordSize > expanded.length) {
    for (let offset = 1; expanded.length < step.chordSize; offset++) {
      expanded.push((base[0] + offset) % pattern.laneCount)
    }
  }
  if (step.mirrored || pattern.mirrored) {
    for (const lane of [...expanded]) expanded.push(pattern.laneCount - 1 - lane)
  }
  return [...new Set(expanded)].sort((a, b) => a - b)
}

export function resolveSequenceTrigger(
  pattern: NeonLatticeLanePattern,
  state: NeonLatticeSequencerState,
  triggerIndex: number,
  customSegments: readonly NeonLatticeCustomSegment[] = [],
): NeonLatticeSequenceTrigger | null {
  if (triggerIndex === state.lastTriggerIndex) return null
  const stepIndex = ((triggerIndex % pattern.sequenceLength) + pattern.sequenceLength) % pattern.sequenceLength
  const step = pattern.steps[stepIndex] ?? { lanes: [], rest: true }
  state.lastTriggerIndex = triggerIndex
  state.currentStep = stepIndex
  const laneIndexes = resolvePatternStepLanes(pattern, state, stepIndex, step)
  if (step.rest || laneIndexes.length === 0) return { stepIndex, step, lanes: [], strength: 0 }
  const authoredOrientation = pattern.orientations[stepIndex % Math.max(1, pattern.orientations.length)]
  const requestedOrientation = step.orientation ?? authoredOrientation ?? 'vertical'
  const lanes = requestedOrientation === 'custom' && customSegments.length > 0
    ? laneIndexes.map((laneIndex) => {
      const custom = customSegments[laneIndex % customSegments.length]
      return {
        id: `lane-custom-${custom.id}`,
        orientation: 'custom' as const,
        laneIndex,
        laneCount: pattern.laneCount,
        startX: custom.startX,
        startY: custom.startY,
        endX: custom.endX,
        endY: custom.endY,
      }
    })
    : laneIndexes.map((laneIndex) => {
      const orientation: Exclude<NeonLatticeLineOrientation, 'custom'> = requestedOrientation === 'custom'
        ? 'vertical'
        : requestedOrientation
      return laneGeometryFor(orientation, laneIndex, pattern.laneCount, step.mirrored || pattern.mirrored)
    })
  return {
    stepIndex,
    step,
    lanes,
    strength: clamp01(step.triggerStrength ?? 1),
    paletteRole: step.paletteRole,
  }
}

export function createSequencedLaneSegment(
  lane: NeonLaneDefinition,
  settings: NeonLatticeSettings,
  palette: NeonPaletteRgb,
  audioTime: number,
  bpm: number,
  strength: number,
  paletteRole?: NeonLatticePaletteRole,
  stackIndex = 0,
): NeonSegment {
  const beatSec = 60 / Math.max(1, bpm || 120)
  const envelope = settings.lineEnvelope
  const totalBeats = envelope.attackBeats + Math.max(envelope.holdBeats, envelope.gateLengthBeats) + envelope.releaseBeats
  const segment = makeSegmentFromEndpoints(
    `${lane.id}-env-${Math.round(audioTime * 1000)}-${stackIndex}`,
    lane,
    settings,
    audioTime,
    palette,
    clamp01(strength * envelope.triggerStrengthScale),
    { spanMode: 'fullCanvas', paletteRole: paletteRole ?? 'primary', laneId: lane.id },
  )
  segment.envelope = { ...envelope }
  segment.envelopeStrength = clamp01(strength * envelope.triggerStrengthScale)
  segment.lifetime = Math.max(0.01, totalBeats * beatSec)
  segment.laneId = lane.id
  return segment
}

export function sequencedEnvelopeAlpha(segment: NeonSegment, audioTime: number, bpm: number): number {
  if (!segment.envelope) return 1
  const beatSec = 60 / Math.max(1, bpm || 120)
  const attack = segment.envelope.attackBeats * beatSec
  const hold = Math.max(segment.envelope.holdBeats, segment.envelope.gateLengthBeats) * beatSec
  const release = Math.max(0.001, segment.envelope.releaseBeats * beatSec)
  const age = audioTime - segment.birthSec
  if (age < 0) return 0
  if (attack > 0 && age < attack) return clamp01(age / attack) * segment.envelopeStrength
  if (age < attack + hold) return segment.envelopeStrength
  const releaseAge = age - attack - hold
  if (releaseAge >= release) return 0
  return clamp01(1 - releaseAge / release) * segment.envelopeStrength
}

export function retriggerSequencedLane(
  activeSegments: NeonSegment[],
  lane: NeonLaneDefinition,
  settings: NeonLatticeSettings,
  palette: NeonPaletteRgb,
  audioTime: number,
  bpm: number,
  strength: number,
  paletteRole?: NeonLatticePaletteRole,
): NeonSegment[] {
  const matching = activeSegments.filter(segment => segment.laneId === lane.id)
  if (settings.retriggerBehavior === 'restart' && matching.length > 0) {
    const target = matching[matching.length - 1]
    const replacement = createSequencedLaneSegment(lane, settings, palette, audioTime, bpm, strength, paletteRole)
    Object.assign(target, replacement, { id: target.id })
    return activeSegments
  }
  if (settings.retriggerBehavior === 'extend' && matching.length > 0) {
    const target = matching[matching.length - 1]
    const replacement = createSequencedLaneSegment(lane, settings, palette, audioTime, bpm, strength, paletteRole)
    target.lifetime = Math.max(target.lifetime, audioTime - target.birthSec + replacement.lifetime)
    target.envelopeStrength = Math.max(target.envelopeStrength, replacement.envelopeStrength)
    return activeSegments
  }
  const stackCount = Math.min(3, matching.length)
  if (settings.retriggerBehavior === 'stack' && matching.length >= 3) {
    const oldest = matching.slice().sort((a, b) => a.birthSec - b.birthSec)[0]
    const index = activeSegments.indexOf(oldest)
    if (index >= 0) activeSegments.splice(index, 1)
  }
  activeSegments.push(createSequencedLaneSegment(lane, settings, palette, audioTime, bpm, strength, paletteRole, stackCount))
  return activeSegments
}
