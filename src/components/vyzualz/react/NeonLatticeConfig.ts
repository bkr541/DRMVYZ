import {
  DEFAULT_NEON_LATTICE_LANE_PATTERN,
  DEFAULT_NEON_LATTICE_LINE_ENVELOPE,
  DEFAULT_NEON_LATTICE_MODULATION_ROUTES,
  DEFAULT_NEON_LATTICE_SETTINGS,
  DEFAULT_NEON_LATTICE_TRIGGER_ROUTES,
} from './ReactTypes'
import type {
  NeonLatticeContinuousModulationRoutes,
  NeonLatticeCustomSegment,
  NeonLatticeDiscreteTriggerSource,
  NeonLatticeLanePattern,
  NeonLatticeLanePatternStep,
  NeonLatticeLineEnvelope,
  NeonLatticeLineOrientation,
  NeonLatticeOrientationWeights,
  NeonLatticePaletteRole,
  NeonLatticePhraseAction,
  NeonLatticePhraseBoundaryPriority,
  NeonLatticePhraseProgram,
  NeonLatticePhraseScale,
  NeonLatticeSettings,
  NeonLatticeSpanMode,
  NeonLatticeTriggerAction,
  NeonLatticeTriggerRoute,
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
const PHRASE_SCALES = new Set<NeonLatticePhraseScale>([4, 8, 16, 32])
const TRIGGER_SOURCES = new Set<NeonLatticeDiscreteTriggerSource>([
  'beat', 'downbeat', 'kick', 'snare', 'hat', 'bassEvent', 'buildStart',
  'buildThreshold', 'dropImpact', 'sectionChange', 'manual',
  'phrase4', 'phrase8', 'phrase16', 'phrase32',
])
const TRIGGER_ACTIONS = new Set<NeonLatticeTriggerAction>([
  'advanceSequence', 'emphasizedStep', 'pillar', 'horizontalStrike', 'thinAccent',
  'fullChord', 'highlightStrike', 'lineSweep', 'blockCascade', 'reseedPattern',
  'runPhraseProgram',
])

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
  let action: NeonLatticePhraseAction | null
  switch (value.type) {
    case 'spawnLine':
      action = { type: 'spawnLine', orientation, lane: value.lane == null ? undefined : integer(value.lane, 0, 31, 0), paletteRole: paletteRoleOr(value.paletteRole), strength }
      break
    case 'spawnLineCluster': {
      const lanes = Array.isArray(value.lanes) ? value.lanes.map(v => integer(v, 0, 31, 0)).slice(0, 16) : undefined
      action = { type: 'spawnLineCluster', orientation, lanes, chordSize: value.chordSize == null ? undefined : integer(value.chordSize, 1, 16, 2), paletteRole: paletteRoleOr(value.paletteRole), strength }
      break
    }
    case 'lineSweep':
      action = { type: 'lineSweep', orientation, direction: value.direction === -1 ? -1 : 1, durationBeats: clamp(value.durationBeats, 0.0625, 128, 4), strength }
      break
    case 'orientationChange':
      action = { type: 'orientationChange', weights: normalizeNeonLatticeOrientationWeights(value.weights), temporary: value.temporary === true }
      break
    case 'mirroredLayout':
      action = { type: 'mirroredLayout', enabled: value.enabled !== false, temporary: value.temporary === true }
      break
    case 'paletteStep':
      action = { type: 'paletteStep', role: paletteRoleOr(value.role), offset: integer(value.offset, -64, 64, 1) }
      break
    case 'densityShift':
      action = { type: 'densityShift', amount: clamp(value.amount, -1, 1, 0), temporary: value.temporary === true }
      break
    case 'patternReseed':
      action = { type: 'patternReseed', seed: value.seed == null ? undefined : integer(value.seed, 1, 0x7fffffff, 1) }
      break
    case 'clearLines': action = { type: 'clearLines' }; break
    case 'blackout': action = { type: 'blackout', durationBeats: clamp(value.durationBeats, 0.0625, 128, 1) }; break
    case 'highlightStrike': action = { type: 'highlightStrike', orientation, strength }; break
    case 'blockCascade': action = { type: 'blockCascade', strength }; break
    case 'temporaryEnvelopeChange': action = { type: 'temporaryEnvelopeChange', envelope: normalizeNeonLatticeEnvelope(value.envelope) }; break
    case 'temporaryLaneCountChange': action = { type: 'temporaryLaneCountChange', laneCount: integer(value.laneCount, 1, 32, 8) }; break
    case 'restoreBaseState': action = { type: 'restoreBaseState' }; break
    default: return null
  }
  const persistence = value.persistence === 'persistent' ? 'persistent' : value.persistence === 'temporary' ? 'temporary' : undefined
  const resetOn = value.resetOn === 'sectionChange' || value.resetOn === 'presetChange' || value.resetOn === 'trackReplacement'
    || value.resetOn === 'rendererRemount' || value.resetOn === 'explicitRestore'
    ? value.resetOn
    : value.resetOn === 'nextPhrase' ? 'nextPhrase' : undefined
  return { ...action, persistence, resetOn } as NeonLatticePhraseAction
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
    phraseBeats: typeof value.phraseBeats === 'number' && PHRASE_SCALES.has(value.phraseBeats as NeonLatticePhraseScale)
      ? value.phraseBeats as NeonLatticePhraseScale
      : undefined,
    stackWithLonger: value.stackWithLonger === true,
    every: integer(value.every, 1, 128, 1),
    actions,
  } as NeonLatticePhraseProgram
}

function normalizeTriggerRoute(value: unknown, index: number): NeonLatticeTriggerRoute | null {
  if (!isRecord(value)) return null
  if (typeof value.source !== 'string' || !TRIGGER_SOURCES.has(value.source as NeonLatticeDiscreteTriggerSource)) return null
  if (typeof value.action !== 'string' || !TRIGGER_ACTIONS.has(value.action as NeonLatticeTriggerAction)) return null
  return {
    id: stringOr(value.id, `route-${index + 1}`),
    source: value.source as NeonLatticeDiscreteTriggerSource,
    action: value.action as NeonLatticeTriggerAction,
    enabled: value.enabled !== false,
    amount: clamp(value.amount, 0, 1, 1),
    threshold: value.threshold == null ? undefined : clamp(value.threshold, 0, 1, 0.5),
    orientation: value.orientation == null ? undefined : orientationOr(value.orientation, 'vertical'),
    chordSize: value.chordSize == null ? undefined : integer(value.chordSize, 1, 16, 1),
    paletteRole: paletteRoleOr(value.paletteRole),
  }
}

export function normalizeNeonLatticeTriggerRoutes(value: unknown): NeonLatticeTriggerRoute[] {
  const source = Array.isArray(value) ? value : DEFAULT_NEON_LATTICE_TRIGGER_ROUTES
  const routes = source.map(normalizeTriggerRoute).filter((route): route is NeonLatticeTriggerRoute => route != null)
  return routes.length > 0 ? routes.slice(0, 64) : DEFAULT_NEON_LATTICE_TRIGGER_ROUTES.map(route => ({ ...route }))
}

export function normalizeNeonLatticeModulationRoutes(value: unknown): NeonLatticeContinuousModulationRoutes {
  const raw = isRecord(value) ? value : {}
  const fallback = DEFAULT_NEON_LATTICE_MODULATION_ROUTES
  return {
    bassToBloom: clamp(raw.bassToBloom, 0, 1, fallback.bassToBloom),
    bassToWidth: clamp(raw.bassToWidth, 0, 1, fallback.bassToWidth),
    energyToChordSize: clamp(raw.energyToChordSize, 0, 1, fallback.energyToChordSize),
    energyToActiveLanes: clamp(raw.energyToActiveLanes, 0, 1, fallback.energyToActiveLanes),
    buildToPatternRate: clamp(raw.buildToPatternRate, 0, 1, fallback.buildToPatternRate),
    buildToDensity: clamp(raw.buildToDensity, 0, 1, fallback.buildToDensity),
    phrase4ProgressToDensity: clamp(raw.phrase4ProgressToDensity, -1, 1, fallback.phrase4ProgressToDensity),
    phrase8ProgressToBloom: clamp(raw.phrase8ProgressToBloom, -1, 1, fallback.phrase8ProgressToBloom),
    phrase16ProgressToSpacing: clamp(raw.phrase16ProgressToSpacing, -1, 1, fallback.phrase16ProgressToSpacing),
    phrase32ProgressToDiagonalWeight: clamp(raw.phrase32ProgressToDiagonalWeight, -1, 1, fallback.phrase32ProgressToDiagonalWeight),
  }
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
    laneAssignmentMode: raw.laneAssignmentMode === 'random' || raw.laneAssignmentMode === 'centerOut'
      || raw.laneAssignmentMode === 'outsideIn' || raw.laneAssignmentMode === 'presetDefined'
      ? raw.laneAssignmentMode
      : 'sequence',
    chordSize: integer(raw.chordSize, 1, 16, DEFAULT_NEON_LATTICE_SETTINGS.chordSize),
    triggerRoutes: normalizeNeonLatticeTriggerRoutes(raw.triggerRoutes),
    modulationRoutes: normalizeNeonLatticeModulationRoutes(raw.modulationRoutes),
    phrasePrograms,
    phraseStackingPolicy: raw.phraseStackingPolicy === 'stackAll' || raw.phraseStackingPolicy === 'presetDefined'
      ? raw.phraseStackingPolicy
      : 'longestOnly',
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
    cyanStrikePaletteRole: paletteRoleOr(raw.cyanStrikePaletteRole, DEFAULT_NEON_LATTICE_SETTINGS.cyanStrikePaletteRole)!,
    bloom: clamp(raw.bloom, 0, 2, DEFAULT_NEON_LATTICE_SETTINGS.bloom),
    coreWidth: clamp(raw.coreWidth, 0.1, 8, DEFAULT_NEON_LATTICE_SETTINGS.coreWidth),
    bodyWidth: clamp(raw.bodyWidth, 0.1, 16, DEFAULT_NEON_LATTICE_SETTINGS.bodyWidth),
    haloWidth: clamp(raw.haloWidth, 0, 32, DEFAULT_NEON_LATTICE_SETTINGS.haloWidth),
    coreIntensity: clamp(raw.coreIntensity, 0, 2, DEFAULT_NEON_LATTICE_SETTINGS.coreIntensity),
    bodyIntensity: clamp(raw.bodyIntensity, 0, 2, DEFAULT_NEON_LATTICE_SETTINGS.bodyIntensity),
    haloIntensity: clamp(raw.haloIntensity, 0, 1, DEFAULT_NEON_LATTICE_SETTINGS.haloIntensity),
    haloFalloff: clamp(raw.haloFalloff, 0, 1, DEFAULT_NEON_LATTICE_SETTINGS.haloFalloff),
    bloomSpread: clamp(raw.bloomSpread, 0.25, 2, DEFAULT_NEON_LATTICE_SETTINGS.bloomSpread),
    bloomGain: clamp(raw.bloomGain, 0, 2, DEFAULT_NEON_LATTICE_SETTINGS.bloomGain),
    lineFlicker: clamp(raw.lineFlicker, 0, 1, DEFAULT_NEON_LATTICE_SETTINGS.lineFlicker),
    chordBloomBoost: clamp(raw.chordBloomBoost, 0, 1, DEFAULT_NEON_LATTICE_SETTINGS.chordBloomBoost),
    phraseFlashStrength: clamp(raw.phraseFlashStrength, 0, 1, DEFAULT_NEON_LATTICE_SETTINGS.phraseFlashStrength),
    highlightCenterHot: raw.highlightCenterHot !== false,
    qualityTier: raw.qualityTier === 'low' || raw.qualityTier === 'medium' ? raw.qualityTier : 'high',
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
