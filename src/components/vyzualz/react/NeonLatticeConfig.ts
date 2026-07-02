import {
  DEFAULT_NEON_LATTICE_LANE_PATTERN,
  DEFAULT_NEON_LATTICE_LINE_ENVELOPE,
  DEFAULT_NEON_LATTICE_SETTINGS,
} from './ReactTypes'
import type {
  NeonLatticeCustomSegment,
  NeonLatticeLanePattern,
  NeonLatticeLanePatternStep,
  NeonLatticeLineEnvelope,
  NeonLatticeLineOrientation,
  NeonLatticeOrientationWeights,
  NeonLatticePaletteRole,
  NeonLatticePhraseAction,
  NeonLatticePhraseBoundaryPriority,
  NeonLatticePhraseProgram,
  NeonLatticeSettings,
  NeonLatticeSpanMode,
} from './ReactTypes'

const ORIENTATIONS = new Set<NeonLatticeLineOrientation>([
  'vertical', 'horizontal', 'diagonalUp', 'diagonalDown', 'custom',
])
const SPAN_MODES = new Set<NeonLatticeSpanMode>([
  'fullCanvas', 'long', 'short', 'random', 'presetDefined',
])
const PALETTE_ROLES = new Set<NeonLatticePaletteRole>([
  'primary', 'secondary', 'accent', 'highlight', 'background',
])
const BOUNDARIES = new Set<NeonLatticePhraseBoundaryPriority>(['step', 'bar', 'phrase', 'section'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  return Math.max(min, Math.min(max, finite(value, fallback)))
}

function integer(value: unknown, min: number, max: number, fallback: number): number {
  return Math.round(clamp(value, min, max, fallback))
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback
}

function orientationOr(value: unknown, fallback: NeonLatticeLineOrientation): NeonLatticeLineOrientation {
  return typeof value === 'string' && ORIENTATIONS.has(value as NeonLatticeLineOrientation)
    ? value as NeonLatticeLineOrientation
    : fallback
}

function spanOr(value: unknown, fallback: NeonLatticeSpanMode): NeonLatticeSpanMode {
  return typeof value === 'string' && SPAN_MODES.has(value as NeonLatticeSpanMode)
    ? value as NeonLatticeSpanMode
    : fallback
}

function paletteRoleOr(value: unknown, fallback?: NeonLatticePaletteRole): NeonLatticePaletteRole | undefined {
  return typeof value === 'string' && PALETTE_ROLES.has(value as NeonLatticePaletteRole)
    ? value as NeonLatticePaletteRole
    : fallback
}

export function orientationWeightsFromVerticalBias(verticalBias: unknown): NeonLatticeOrientationWeights {
  const vertical = clamp(verticalBias, 0, 1, DEFAULT_NEON_LATTICE_SETTINGS.verticalBias)
  return { vertical, horizontal: 1 - vertical, diagonalUp: 0, diagonalDown: 0 }
}

export function normalizeNeonLatticeOrientationWeights(
  value: unknown,
  verticalBias: unknown = DEFAULT_NEON_LATTICE_SETTINGS.verticalBias,
): NeonLatticeOrientationWeights {
  const fallback = orientationWeightsFromVerticalBias(verticalBias)
  const raw = isRecord(value) ? value : {}
  const weights: NeonLatticeOrientationWeights = {
    vertical: clamp(raw.vertical, 0, 1000, fallback.vertical),
    horizontal: clamp(raw.horizontal, 0, 1000, fallback.horizontal),
    diagonalUp: clamp(raw.diagonalUp, 0, 1000, fallback.diagonalUp),
    diagonalDown: clamp(raw.diagonalDown, 0, 1000, fallback.diagonalDown),
  }
  const total = weights.vertical + weights.horizontal + weights.diagonalUp + weights.diagonalDown
  if (total <= 1e-9) return fallback
  return {
    vertical: weights.vertical / total,
    horizontal: weights.horizontal / total,
    diagonalUp: weights.diagonalUp / total,
    diagonalDown: weights.diagonalDown / total,
  }
}

export function normalizeNeonLatticeEnvelope(value: unknown): NeonLatticeLineEnvelope {
  const raw = isRecord(value) ? value : {}
  return {
    attackBeats: clamp(raw.attackBeats, 0, 16, DEFAULT_NEON_LATTICE_LINE_ENVELOPE.attackBeats),
    holdBeats: clamp(raw.holdBeats, 0, 64, DEFAULT_NEON_LATTICE_LINE_ENVELOPE.holdBeats),
    releaseBeats: clamp(raw.releaseBeats, 0.001, 64, DEFAULT_NEON_LATTICE_LINE_ENVELOPE.releaseBeats),
    gateLengthBeats: clamp(raw.gateLengthBeats, 0.0625, 128, DEFAULT_NEON_LATTICE_LINE_ENVELOPE.gateLengthBeats),
    triggerStrengthScale: clamp(raw.triggerStrengthScale, 0, 4, DEFAULT_NEON_LATTICE_LINE_ENVELOPE.triggerStrengthScale),
  }
}

function normalizeCustomSegment(value: unknown, index: number): NeonLatticeCustomSegment | null {
  if (!isRecord(value)) return null
  const startX = clamp(value.startX, 0, 1, 0)
  const startY = clamp(value.startY, 0, 1, 0)
  const endX = clamp(value.endX, 0, 1, 1)
  const endY = clamp(value.endY, 0, 1, 1)
  if (Math.hypot(endX - startX, endY - startY) < 1e-4) return null
  return {
    ...value,
    id: stringOr(value.id, `custom-${index + 1}`),
    startX,
    startY,
    endX,
    endY,
    orientation: orientationOr(value.orientation, 'custom'),
    paletteRole: paletteRoleOr(value.paletteRole),
  } as NeonLatticeCustomSegment
}

function normalizePatternStep(value: unknown, laneCount: number): NeonLatticeLanePatternStep {
  const raw = isRecord(value) ? value : {}
  const lanes = Array.isArray(raw.lanes)
    ? [...new Set(raw.lanes.map(v => integer(v, 0, Math.max(0, laneCount - 1), 0)))].slice(0, Math.min(16, laneCount))
    : []
  const rest = raw.rest === true || lanes.length === 0
  const normalized = { ...raw, lanes: rest ? [] : lanes } as NeonLatticeLanePatternStep & Record<string, unknown>

  // Keep the canonical shape stable: optional fields are omitted unless they
  // carry semantic information. Unknown future fields remain untouched.
  delete normalized.rest
  delete normalized.orientation
  delete normalized.mirrored
  delete normalized.paletteRole
  delete normalized.triggerStrength
  delete normalized.chordSize
  if (rest) normalized.rest = true
  if (raw.orientation != null) normalized.orientation = orientationOr(raw.orientation, 'vertical')
  if (raw.mirrored === true) normalized.mirrored = true
  if (raw.paletteRole != null) normalized.paletteRole = paletteRoleOr(raw.paletteRole)
  if (raw.triggerStrength != null) normalized.triggerStrength = clamp(raw.triggerStrength, 0, 4, 1)
  if (raw.chordSize != null) normalized.chordSize = integer(raw.chordSize, 1, Math.min(16, laneCount), 1)
  return normalized
}

export function normalizeNeonLatticeLanePattern(value: unknown): NeonLatticeLanePattern {
  const raw = isRecord(value) ? value : {}
  const laneCount = integer(raw.laneCount, 1, 32, DEFAULT_NEON_LATTICE_LANE_PATTERN.laneCount)
  const sequenceLength = integer(raw.sequenceLength, 1, 128, DEFAULT_NEON_LATTICE_LANE_PATTERN.sequenceLength)
  const rawOrientations = Array.isArray(raw.orientations) ? raw.orientations : DEFAULT_NEON_LATTICE_LANE_PATTERN.orientations
  const orientations = [...new Set(rawOrientations.map(v => orientationOr(v, 'vertical')).filter(v => v !== 'custom'))]
  const sourceSteps = Array.isArray(raw.steps) ? raw.steps : DEFAULT_NEON_LATTICE_LANE_PATTERN.steps
  const steps = Array.from({ length: sequenceLength }, (_, index) => normalizePatternStep(sourceSteps[index % Math.max(1, sourceSteps.length)], laneCount))
  return {
    ...raw,
    id: stringOr(raw.id, DEFAULT_NEON_LATTICE_LANE_PATTERN.id),
    name: stringOr(raw.name, DEFAULT_NEON_LATTICE_LANE_PATTERN.name),
    laneCount,
    sequenceLength,
    orientations: orientations.length > 0 ? orientations : ['vertical'],
    mirrored: raw.mirrored === true,
    seed: integer(raw.seed, 1, 0x7fffffff, DEFAULT_NEON_LATTICE_LANE_PATTERN.seed),
    steps,
  } as NeonLatticeLanePattern
}

export function normalizeNeonLatticePhraseAction(value: unknown): NeonLatticePhraseAction | null {
  if (!isRecord(value) || typeof value.type !== 'string') return null
  const strength = value.strength == null ? undefined : clamp(value.strength, 0, 4, 1)
  const orientation = value.orientation == null ? undefined : orientationOr(value.orientation, 'vertical')
  switch (value.type) {
    case 'spawnLine':
      return { type: 'spawnLine', orientation, lane: value.lane == null ? undefined : integer(value.lane, 0, 31, 0), paletteRole: paletteRoleOr(value.paletteRole), strength }
    case 'spawnLineCluster': {
      const lanes = Array.isArray(value.lanes) ? value.lanes.map(v => integer(v, 0, 31, 0)).slice(0, 16) : undefined
      return { type: 'spawnLineCluster', orientation, lanes, chordSize: value.chordSize == null ? undefined : integer(value.chordSize, 1, 16, 2), paletteRole: paletteRoleOr(value.paletteRole), strength }
    }
    case 'lineSweep':
      return { type: 'lineSweep', orientation, direction: value.direction === -1 ? -1 : 1, durationBeats: clamp(value.durationBeats, 0.0625, 128, 4), strength }
    case 'orientationChange':
      return { type: 'orientationChange', weights: normalizeNeonLatticeOrientationWeights(value.weights), temporary: value.temporary === true }
    case 'mirroredLayout':
      return { type: 'mirroredLayout', enabled: value.enabled !== false, temporary: value.temporary === true }
    case 'paletteStep':
      return { type: 'paletteStep', role: paletteRoleOr(value.role), offset: integer(value.offset, -64, 64, 1) }
    case 'densityShift':
      return { type: 'densityShift', amount: clamp(value.amount, -1, 1, 0), temporary: value.temporary === true }
    case 'patternReseed':
      return { type: 'patternReseed', seed: value.seed == null ? undefined : integer(value.seed, 1, 0x7fffffff, 1) }
    case 'clearLines': return { type: 'clearLines' }
    case 'blackout': return { type: 'blackout', durationBeats: clamp(value.durationBeats, 0.0625, 128, 1) }
    case 'highlightStrike': return { type: 'highlightStrike', orientation, strength }
    case 'blockCascade': return { type: 'blockCascade', strength }
    case 'temporaryEnvelopeChange': return { type: 'temporaryEnvelopeChange', envelope: normalizeNeonLatticeEnvelope(value.envelope) }
    case 'temporaryLaneCountChange': return { type: 'temporaryLaneCountChange', laneCount: integer(value.laneCount, 1, 32, 8) }
    case 'restoreBaseState': return { type: 'restoreBaseState' }
    default: return null
  }
}

function normalizePhraseProgram(value: unknown, index: number): NeonLatticePhraseProgram | null {
  if (!isRecord(value)) return null
  const actions = Array.isArray(value.actions)
    ? value.actions.map(normalizeNeonLatticePhraseAction).filter((action): action is NeonLatticePhraseAction => action != null)
    : []
  return {
    ...value,
    id: stringOr(value.id, `phrase-${index + 1}`),
    name: stringOr(value.name, `Phrase ${index + 1}`),
    boundary: typeof value.boundary === 'string' && BOUNDARIES.has(value.boundary as NeonLatticePhraseBoundaryPriority)
      ? value.boundary as NeonLatticePhraseBoundaryPriority
      : 'phrase',
    every: integer(value.every, 1, 128, 1),
    actions,
  } as NeonLatticePhraseProgram
}

/** Canonical, idempotent compatibility layer for persisted, preset, and live settings. */
export function normalizeNeonLatticeSettings(value: unknown): NeonLatticeSettings {
  const raw = isRecord(value) ? value : {}
  const verticalBias = clamp(raw.verticalBias, 0, 1, DEFAULT_NEON_LATTICE_SETTINGS.verticalBias)
  const orientationWeights = normalizeNeonLatticeOrientationWeights(raw.orientationWeights, verticalBias)
  const customSegments = Array.isArray(raw.customSegments)
    ? raw.customSegments.map(normalizeCustomSegment).filter((segment): segment is NeonLatticeCustomSegment => segment != null).slice(0, 64)
    : []
  const phrasePrograms = Array.isArray(raw.phrasePrograms)
    ? raw.phrasePrograms.map(normalizePhraseProgram).filter((program): program is NeonLatticePhraseProgram => program != null).slice(0, 32)
    : []

  return {
    ...DEFAULT_NEON_LATTICE_SETTINGS,
    ...raw,
    railDensity: clamp(raw.railDensity, 0, 1, DEFAULT_NEON_LATTICE_SETTINGS.railDensity),
    verticalBias,
    orientationWeights,
    compositionMode: raw.compositionMode === 'laneSequencer' || raw.compositionMode === 'hybrid' ? raw.compositionMode : 'legacyLattice',
    verticalSpanMode: spanOr(raw.verticalSpanMode, DEFAULT_NEON_LATTICE_SETTINGS.verticalSpanMode),
    horizontalSpanMode: spanOr(raw.horizontalSpanMode, DEFAULT_NEON_LATTICE_SETTINGS.horizontalSpanMode),
    diagonalSpanMode: spanOr(raw.diagonalSpanMode, DEFAULT_NEON_LATTICE_SETTINGS.diagonalSpanMode),
    diagonalAngleDegrees: clamp(raw.diagonalAngleDegrees, 10, 80, DEFAULT_NEON_LATTICE_SETTINGS.diagonalAngleDegrees),
    customSegments,
    lineEnvelope: normalizeNeonLatticeEnvelope(raw.lineEnvelope),
    retriggerBehavior: raw.retriggerBehavior === 'extend' || raw.retriggerBehavior === 'stack' ? raw.retriggerBehavior : 'restart',
    lanePattern: normalizeNeonLatticeLanePattern(raw.lanePattern),
    phrasePrograms,
    phraseBoundaryPriority: typeof raw.phraseBoundaryPriority === 'string' && BOUNDARIES.has(raw.phraseBoundaryPriority as NeonLatticePhraseBoundaryPriority)
      ? raw.phraseBoundaryPriority as NeonLatticePhraseBoundaryPriority
      : DEFAULT_NEON_LATTICE_SETTINGS.phraseBoundaryPriority,
    temporaryOverrideResetPolicy: raw.temporaryOverrideResetPolicy === 'nextStep' || raw.temporaryOverrideResetPolicy === 'nextBar' || raw.temporaryOverrideResetPolicy === 'explicitRestore'
      ? raw.temporaryOverrideResetPolicy
      : 'nextPhrase',
    centerBias: clamp(raw.centerBias, 0, 1, DEFAULT_NEON_LATTICE_SETTINGS.centerBias),
    railLifetime: clamp(raw.railLifetime, 0.05, 120, DEFAULT_NEON_LATTICE_SETTINGS.railLifetime),
    pulseSpeed: clamp(raw.pulseSpeed, 0, 4, DEFAULT_NEON_LATTICE_SETTINGS.pulseSpeed),
    flareAmount: clamp(raw.flareAmount, 0, 1, DEFAULT_NEON_LATTICE_SETTINGS.flareAmount),
    snapDivision: ([1, 2, 4, 8, 16] as const).includes(raw.snapDivision as 1 | 2 | 4 | 8 | 16) ? raw.snapDivision as 1 | 2 | 4 | 8 | 16 : DEFAULT_NEON_LATTICE_SETTINGS.snapDivision,
    blockDensity: clamp(raw.blockDensity, 0, 1, DEFAULT_NEON_LATTICE_SETTINGS.blockDensity),
    blockHold: clamp(raw.blockHold, 0.02, 30, DEFAULT_NEON_LATTICE_SETTINGS.blockHold),
    cyanAccentChance: clamp(raw.cyanAccentChance, 0, 1, DEFAULT_NEON_LATTICE_SETTINGS.cyanAccentChance),
    bloom: clamp(raw.bloom, 0, 2, DEFAULT_NEON_LATTICE_SETTINGS.bloom),
    depth: clamp(raw.depth, 0, 1, DEFAULT_NEON_LATTICE_SETTINGS.depth),
    parallax: clamp(raw.parallax, 0, 1, DEFAULT_NEON_LATTICE_SETTINGS.parallax),
    cameraMotion: clamp(raw.cameraMotion, 0, 1, DEFAULT_NEON_LATTICE_SETTINGS.cameraMotion),
    shockwaveAmount: clamp(raw.shockwaveAmount, 0, 1, DEFAULT_NEON_LATTICE_SETTINGS.shockwaveAmount),
    reseedInterval: integer(raw.reseedInterval, 0, 1024, DEFAULT_NEON_LATTICE_SETTINGS.reseedInterval),
    blackoutMode: raw.blackoutMode === 'instant' || raw.blackoutMode === 'fadeOut' || raw.blackoutMode === 'strobe' ? raw.blackoutMode : 'none',
    decayStyle: raw.decayStyle === 'linear' || raw.decayStyle === 'hold' || raw.decayStyle === 'pulse' ? raw.decayStyle : 'exponential',
    trigger: raw.trigger === 'none' || raw.trigger === 'downbeat' || raw.trigger === 'kick' || raw.trigger === 'snare' || raw.trigger === 'drop' ? raw.trigger : 'beat',
    audioReactive: raw.audioReactive !== false,
    bassBrightnessResponse: clamp(raw.bassBrightnessResponse, 0, 1, DEFAULT_NEON_LATTICE_SETTINGS.bassBrightnessResponse),
    kickRailResponse: clamp(raw.kickRailResponse, 0, 1, DEFAULT_NEON_LATTICE_SETTINGS.kickRailResponse),
    snareRailResponse: clamp(raw.snareRailResponse, 0, 1, DEFAULT_NEON_LATTICE_SETTINGS.snareRailResponse),
    beatPulseResponse: clamp(raw.beatPulseResponse, 0, 1, DEFAULT_NEON_LATTICE_SETTINGS.beatPulseResponse),
    midBlockResponse: clamp(raw.midBlockResponse, 0, 1, DEFAULT_NEON_LATTICE_SETTINGS.midBlockResponse),
    highFlareResponse: clamp(raw.highFlareResponse, 0, 1, DEFAULT_NEON_LATTICE_SETTINGS.highFlareResponse),
    energyDensityResponse: clamp(raw.energyDensityResponse, 0, 1, DEFAULT_NEON_LATTICE_SETTINGS.energyDensityResponse),
    buildMotionResponse: clamp(raw.buildMotionResponse, 0, 1, DEFAULT_NEON_LATTICE_SETTINGS.buildMotionResponse),
    dropImpactResponse: clamp(raw.dropImpactResponse, 0, 1, DEFAULT_NEON_LATTICE_SETTINGS.dropImpactResponse),
    sectionDynamics: clamp(raw.sectionDynamics, 0, 1, DEFAULT_NEON_LATTICE_SETTINGS.sectionDynamics),
    audioSmoothing: clamp(raw.audioSmoothing, 0, 1, DEFAULT_NEON_LATTICE_SETTINGS.audioSmoothing),
    audioGate: clamp(raw.audioGate, 0, 0.98, DEFAULT_NEON_LATTICE_SETTINGS.audioGate),
  } as NeonLatticeSettings
}
