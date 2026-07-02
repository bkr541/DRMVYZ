import type { MusicIntelligenceFrame } from '../../../../features/musicIntelligence/types'
import type {
  NeonLatticeDiscreteTriggerSource,
  NeonLatticeLineEnvelope,
  NeonLatticeLineOrientation,
  NeonLatticeOrientationWeights,
  NeonLatticePaletteRole,
  NeonLatticePhraseAction,
  NeonLatticePhraseProgram,
  NeonLatticePhraseScale,
  NeonLatticeSettings,
} from '../ReactTypes'
import { normalizeNeonLatticeOrientationWeights } from '../NeonLatticeConfig'

export type NeonLatticeAudioResetReason =
  | 'timingDiscontinuity'
  | 'backwardSeek'
  | 'forwardSeek'
  | 'loopRestart'
  | 'trackReplacement'
  | 'analysisReplacement'
  | 'stop'
  | 'presetChange'
  | 'rendererRemount'

export interface NeonLatticeAudioEvent {
  source: NeonLatticeDiscreteTriggerSource
  identity: string
  strength: number
  frameId: number
  beatIndex: number
  barIndex: number
  phraseScale?: NeonLatticePhraseScale
}

export interface NeonLatticeAudioDiagnostics {
  lastConsumedAudioEvent: string | null
  skippedDuplicateEvent: string | null
  lastPhraseBoundaryConsumed: NeonLatticePhraseScale | null
  boundaryPriorityDecision: string | null
  lastPhraseActionExecuted: string | null
  phraseResetReason: string | null
  currentSequenceStep: number
  activeTemporaryOverrides: string[]
}

export interface NeonLatticeAudioDirectorState {
  sourceIdentity: string | null
  trackIdentity: string | null
  lastFrameId: number
  lastAudioTime: number
  lastBeatIndex: number
  lastBarIndex: number
  lastSectionIdentity: string | null
  previousBass: number
  previousBuild: number
  previousDrop: number
  previousKickHit: boolean
  previousSnareHit: boolean
  previousHatHit: boolean
  wasPlaying: boolean
  lastEventIdentity: Partial<Record<NeonLatticeDiscreteTriggerSource, string>>
  diagnostics: NeonLatticeAudioDiagnostics
}

export type NeonLatticeRuntimeResetReason =
  | 'nextStep'
  | 'nextBar'
  | 'nextPhrase'
  | 'sectionChange'
  | 'presetChange'
  | 'trackReplacement'
  | 'rendererRemount'

interface RuntimeOverride<T> {
  value: T
  resetOn: NeonLatticeRuntimeResetReason | 'explicitRestore'
  persistent: boolean
}

export interface NeonLatticePhraseRuntimeState {
  orientationWeights?: RuntimeOverride<Partial<NeonLatticeOrientationWeights>>
  mirrored?: RuntimeOverride<boolean>
  densityShift?: RuntimeOverride<number>
  envelope?: RuntimeOverride<Partial<NeonLatticeLineEnvelope>>
  laneCount?: RuntimeOverride<number>
  paletteOffset?: RuntimeOverride<number>
  paletteRole?: RuntimeOverride<NeonLatticePaletteRole | undefined>
}

export type NeonLatticePhraseCommand =
  | { type: 'spawnLine'; orientation?: NeonLatticeLineOrientation; lane?: number; paletteRole?: NeonLatticePaletteRole; strength: number }
  | { type: 'spawnLineCluster'; orientation?: NeonLatticeLineOrientation; lanes?: number[]; chordSize: number; paletteRole?: NeonLatticePaletteRole; strength: number }
  | { type: 'lineSweep'; orientation?: NeonLatticeLineOrientation; direction: 1 | -1; durationBeats: number; strength: number }
  | { type: 'patternReseed'; seed?: number }
  | { type: 'clearLines' }
  | { type: 'blackout'; durationBeats: number }
  | { type: 'highlightStrike'; orientation?: NeonLatticeLineOrientation; strength: number }
  | { type: 'blockCascade'; strength: number }

export interface NeonLatticePhraseExecution {
  runtime: NeonLatticePhraseRuntimeState
  commands: NeonLatticePhraseCommand[]
  lastAction: string | null
}

export interface NeonLatticePhraseProgressModulation {
  densityDelta: number
  bloomMultiplier: number
  activeLaneBonus: number
  chordSizeBonus: number
  patternRateMultiplier: number
  diagonalWeightDelta: number
  laneSpacingScale: number
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
}

function sourceIdentity(frame: MusicIntelligenceFrame | null, trackKey?: string | null): string | null {
  const identity = trackKey ?? frame?.trackId ?? frame?.sourceId ?? null
  return identity == null ? null : String(identity)
}

function analysisIdentity(frame: MusicIntelligenceFrame | null): string | null {
  if (!frame) return null
  return `${frame.trackId ?? 'none'}|${frame.sourceId ?? 'none'}`
}

function sectionIdentity(frame: MusicIntelligenceFrame): string {
  const section = frame.section
  return `${section.type ?? 'none'}:${section.startSec.toFixed(3)}:${section.endSec.toFixed(3)}:${section.source}`
}

function thresholdFor(settings: NeonLatticeSettings, source: NeonLatticeDiscreteTriggerSource, fallback: number): number {
  const routes = settings.triggerRoutes.filter(route => route.enabled && route.source === source)
  const configured = routes.find(route => route.threshold != null)?.threshold
  return clamp01(configured ?? fallback)
}

export function createNeonLatticeAudioDirectorState(): NeonLatticeAudioDirectorState {
  return {
    sourceIdentity: null,
    trackIdentity: null,
    lastFrameId: -1,
    lastAudioTime: -1,
    lastBeatIndex: -1,
    lastBarIndex: -1,
    lastSectionIdentity: null,
    previousBass: 0,
    previousBuild: 0,
    previousDrop: 0,
    previousKickHit: false,
    previousSnareHit: false,
    previousHatHit: false,
    wasPlaying: false,
    lastEventIdentity: {},
    diagnostics: {
      lastConsumedAudioEvent: null,
      skippedDuplicateEvent: null,
      lastPhraseBoundaryConsumed: null,
      boundaryPriorityDecision: null,
      lastPhraseActionExecuted: null,
      phraseResetReason: null,
      currentSequenceStep: -1,
      activeTemporaryOverrides: [],
    },
  }
}

export function resetNeonLatticeAudioDirector(
  state: NeonLatticeAudioDirectorState,
  reason: NeonLatticeAudioResetReason,
  frame: MusicIntelligenceFrame | null = null,
  trackKey?: string | null,
): void {
  state.sourceIdentity = sourceIdentity(frame, trackKey)
  state.trackIdentity = analysisIdentity(frame)
  state.lastFrameId = frame?.frameId ?? -1
  state.lastAudioTime = frame?.timeSec ?? -1
  state.lastBeatIndex = frame?.rhythm.beatIndex ?? -1
  state.lastBarIndex = frame?.rhythm.barIndex ?? -1
  state.lastSectionIdentity = frame ? sectionIdentity(frame) : null
  state.previousBass = clamp01(frame?.bands.normalizedBass ?? frame?.bands.bass ?? 0)
  state.previousBuild = clamp01(frame?.energy.buildProgress ?? 0)
  state.previousDrop = clamp01(frame?.energy.dropImpact ?? 0)
  state.previousKickHit = Boolean(frame?.rhythm.kickHit)
  state.previousSnareHit = Boolean(frame?.rhythm.snareHit)
  state.previousHatHit = Boolean(frame?.rhythm.hatHit)
  state.lastEventIdentity = {}
  state.diagnostics.skippedDuplicateEvent = null
  state.diagnostics.phraseResetReason = reason
}

function phraseHits(frame: MusicIntelligenceFrame): NeonLatticePhraseScale[] {
  const result: NeonLatticePhraseScale[] = []
  if (frame.rhythm.phrase4Hit) result.push(4)
  if (frame.rhythm.phrase8Hit) result.push(8)
  if (frame.rhythm.phrase16Hit) result.push(16)
  if (frame.rhythm.phrase32Hit) result.push(32)
  return result
}

export function resolvePhraseBoundaryPriority(
  hits: readonly NeonLatticePhraseScale[],
  settings: Pick<NeonLatticeSettings, 'phraseStackingPolicy' | 'phrasePrograms'>,
): NeonLatticePhraseScale[] {
  if (hits.length <= 1) return [...hits]
  const descending = [...hits].sort((a, b) => b - a)
  if (settings.phraseStackingPolicy === 'stackAll') return descending
  if (settings.phraseStackingPolicy === 'presetDefined') {
    const longest = descending[0]
    return descending.filter(scale => scale === longest || settings.phrasePrograms.some(program => program.phraseBeats === scale && program.stackWithLonger === true))
  }
  return [descending[0]]
}

function eventIdentity(source: NeonLatticeDiscreteTriggerSource, frame: MusicIntelligenceFrame, phraseScale?: NeonLatticePhraseScale): string {
  const track = frame.trackId ?? frame.sourceId ?? 'unbound'
  if (phraseScale) return `${track}:${source}:${Math.floor(frame.rhythm.beatIndex / phraseScale)}`
  switch (source) {
    case 'beat': return `${track}:beat:${frame.rhythm.beatIndex}`
    case 'downbeat': return `${track}:bar:${frame.rhythm.barIndex}`
    case 'kick':
    case 'snare':
    case 'hat': return `${track}:${source}:${frame.rhythm.beatIndex}:${frame.frameId}`
    case 'sectionChange': return `${track}:section:${sectionIdentity(frame)}`
    default: return `${track}:${source}:${frame.frameId}`
  }
}

function pushEvent(
  state: NeonLatticeAudioDirectorState,
  events: NeonLatticeAudioEvent[],
  frame: MusicIntelligenceFrame,
  source: NeonLatticeDiscreteTriggerSource,
  strength: number,
  phraseScale?: NeonLatticePhraseScale,
): void {
  const identity = eventIdentity(source, frame, phraseScale)
  if (state.lastEventIdentity[source] === identity) {
    state.diagnostics.skippedDuplicateEvent = identity
    return
  }
  state.lastEventIdentity[source] = identity
  const event: NeonLatticeAudioEvent = {
    source,
    identity,
    strength: clamp01(strength),
    frameId: frame.frameId,
    beatIndex: frame.rhythm.beatIndex,
    barIndex: frame.rhythm.barIndex,
    phraseScale,
  }
  events.push(event)
  state.diagnostics.lastConsumedAudioEvent = identity
  if (phraseScale) state.diagnostics.lastPhraseBoundaryConsumed = phraseScale
}

export interface ConsumeNeonLatticeAudioInput {
  frame: MusicIntelligenceFrame | null
  settings: NeonLatticeSettings
  isPlaying: boolean
  isPaused?: boolean
  timingDiscontinuity?: boolean
  audioTime: number
  trackKey?: string | null
}

export interface ConsumeNeonLatticeAudioResult {
  events: NeonLatticeAudioEvent[]
  resetReason: NeonLatticeAudioResetReason | null
}

export function consumeNeonLatticeAudioFrame(
  state: NeonLatticeAudioDirectorState,
  input: ConsumeNeonLatticeAudioInput,
): ConsumeNeonLatticeAudioResult {
  const { frame, settings } = input
  const events: NeonLatticeAudioEvent[] = []
  const nextSource = sourceIdentity(frame, input.trackKey)
  const nextAnalysis = analysisIdentity(frame)
  let resetReason: NeonLatticeAudioResetReason | null = null

  if (state.sourceIdentity != null && nextSource !== state.sourceIdentity) resetReason = 'trackReplacement'
  else if (state.trackIdentity != null && nextAnalysis !== state.trackIdentity) resetReason = 'analysisReplacement'
  else if (frame && state.lastFrameId >= 0 && frame.frameId < state.lastFrameId) resetReason = 'analysisReplacement'
  else if (state.wasPlaying && !input.isPlaying && !input.isPaused) resetReason = 'stop'
  else if (input.timingDiscontinuity) {
    resetReason = input.audioTime + 0.05 < state.lastAudioTime
      ? input.audioTime < 0.5 ? 'loopRestart' : 'backwardSeek'
      : input.audioTime > state.lastAudioTime + 1 ? 'forwardSeek' : 'timingDiscontinuity'
  } else if (state.lastAudioTime >= 0 && input.audioTime + 0.05 < state.lastAudioTime) {
    resetReason = input.audioTime < 0.5 ? 'loopRestart' : 'backwardSeek'
  }

  if (resetReason) {
    resetNeonLatticeAudioDirector(state, resetReason, frame, input.trackKey)
    // A loop restart or genuinely new track may begin exactly on a canonical
    // beat/phrase boundary. Re-arm only discrete boundary flags so that first
    // valid event can fire, while keeping continuous thresholds rebased to the
    // current frame and avoiding a replay storm.
    if (frame && (resetReason === 'loopRestart' || resetReason === 'trackReplacement')) {
      state.lastFrameId = -1
      state.lastBeatIndex = frame.rhythm.beatIndex - 1
      state.lastBarIndex = frame.rhythm.barIndex - 1
      state.previousKickHit = false
      state.previousSnareHit = false
      state.previousHatHit = false
    }
  }
  state.sourceIdentity = nextSource
  state.trackIdentity = nextAnalysis

  if (!frame) {
    state.lastAudioTime = input.audioTime
    state.wasPlaying = input.isPlaying
    return { events, resetReason }
  }

  if (!input.isPlaying || input.isPaused) {
    state.lastFrameId = frame.frameId
    state.lastBeatIndex = frame.rhythm.beatIndex
    state.lastBarIndex = frame.rhythm.barIndex
    state.lastSectionIdentity = sectionIdentity(frame)
    state.previousBass = clamp01(frame.bands.normalizedBass || frame.bands.bass)
    state.previousBuild = clamp01(frame.energy.buildProgress)
    state.previousDrop = clamp01(frame.energy.dropImpact)
    state.previousKickHit = frame.rhythm.kickHit
    state.previousSnareHit = frame.rhythm.snareHit
    state.previousHatHit = frame.rhythm.hatHit
    state.lastAudioTime = input.audioTime
    state.wasPlaying = input.isPlaying
    return { events, resetReason }
  }

  if (!resetReason && frame.frameId === state.lastFrameId) {
    state.diagnostics.skippedDuplicateEvent = `frame:${frame.frameId}`
    state.lastAudioTime = input.audioTime
    state.wasPlaying = true
    return { events, resetReason }
  }

  const currentSectionIdentity = sectionIdentity(frame)
  const bass = clamp01(frame.bands.normalizedBass || frame.bands.bass)
  const build = clamp01(frame.energy.buildProgress)
  const drop = clamp01(frame.energy.dropImpact)
  const bassThreshold = thresholdFor(settings, 'bassEvent', 0.72)
  const buildStartThreshold = thresholdFor(settings, 'buildStart', 0.18)
  const buildThreshold = thresholdFor(settings, 'buildThreshold', 0.68)
  const dropThreshold = thresholdFor(settings, 'dropImpact', 0.65)

  if (frame.rhythm.beatHit && frame.rhythm.beatIndex !== state.lastBeatIndex) pushEvent(state, events, frame, 'beat', Math.max(0.35, frame.energy.instant))
  if (frame.rhythm.downbeatHit && frame.rhythm.barIndex !== state.lastBarIndex) pushEvent(state, events, frame, 'downbeat', Math.max(0.55, frame.energy.instant))
  if (frame.rhythm.kickHit && (!state.previousKickHit || frame.rhythm.beatIndex !== state.lastBeatIndex)) {
    pushEvent(state, events, frame, 'kick', frame.rhythm.kickStrength)
  }
  if (frame.rhythm.snareHit && (!state.previousSnareHit || frame.rhythm.beatIndex !== state.lastBeatIndex)) {
    pushEvent(state, events, frame, 'snare', frame.rhythm.snareStrength)
  }
  if (frame.rhythm.hatHit && (!state.previousHatHit || frame.rhythm.beatIndex !== state.lastBeatIndex)) {
    pushEvent(state, events, frame, 'hat', frame.rhythm.hatStrength)
  }
  if (state.previousBass < bassThreshold && bass >= bassThreshold) pushEvent(state, events, frame, 'bassEvent', bass)
  if (state.previousBuild < buildStartThreshold && build >= buildStartThreshold) pushEvent(state, events, frame, 'buildStart', build)
  if (state.previousBuild < buildThreshold && build >= buildThreshold) pushEvent(state, events, frame, 'buildThreshold', build)
  if (state.previousDrop < dropThreshold && drop >= dropThreshold) pushEvent(state, events, frame, 'dropImpact', drop)
  if (state.lastSectionIdentity != null && currentSectionIdentity !== state.lastSectionIdentity) pushEvent(state, events, frame, 'sectionChange', frame.section.intensity)

  const rawPhraseHits = phraseHits(frame)
  const selectedPhraseHits = resolvePhraseBoundaryPriority(rawPhraseHits, settings)
  if (rawPhraseHits.length > 0) {
    state.diagnostics.boundaryPriorityDecision = `${settings.phraseStackingPolicy}:${rawPhraseHits.join('+')}=>${selectedPhraseHits.join('+')}`
  }
  for (const scale of selectedPhraseHits) {
    pushEvent(state, events, frame, `phrase${scale}` as NeonLatticeDiscreteTriggerSource, 1, scale)
  }

  state.lastFrameId = frame.frameId
  state.lastBeatIndex = frame.rhythm.beatIndex
  state.lastBarIndex = frame.rhythm.barIndex
  state.lastSectionIdentity = currentSectionIdentity
  state.previousBass = bass
  state.previousBuild = build
  state.previousDrop = drop
  state.previousKickHit = frame.rhythm.kickHit
  state.previousSnareHit = frame.rhythm.snareHit
  state.previousHatHit = frame.rhythm.hatHit
  state.lastAudioTime = input.audioTime
  state.wasPlaying = true
  return { events, resetReason }
}

function internalResetOn(action: NeonLatticePhraseAction, settings: NeonLatticeSettings): NeonLatticeRuntimeResetReason | 'explicitRestore' {
  if (action.resetOn) return action.resetOn as NeonLatticeRuntimeResetReason | 'explicitRestore'
  const persistent = action.persistence === 'persistent'
  if (persistent) return 'presetChange'
  switch (settings.temporaryOverrideResetPolicy) {
    case 'nextStep': return 'nextStep'
    case 'nextBar': return 'nextBar'
    case 'explicitRestore': return 'explicitRestore'
    default: return 'nextPhrase'
  }
}

function makeOverride<T>(value: T, action: NeonLatticePhraseAction, settings: NeonLatticeSettings): RuntimeOverride<T> {
  return {
    value,
    resetOn: internalResetOn(action, settings),
    persistent: action.persistence === 'persistent',
  }
}

export function resetNeonLatticePhraseOverrides(
  runtime: NeonLatticePhraseRuntimeState,
  reason: NeonLatticeRuntimeResetReason,
): NeonLatticePhraseRuntimeState {
  const next: NeonLatticePhraseRuntimeState = { ...runtime }
  for (const key of Object.keys(next) as Array<keyof NeonLatticePhraseRuntimeState>) {
    const override = next[key]
    if (!override) continue
    const terminalReset = reason === 'presetChange' || reason === 'trackReplacement' || reason === 'rendererRemount'
    if (terminalReset || override.resetOn === reason) delete next[key]
  }
  return next
}

export function activeNeonLatticeOverrideNames(runtime: NeonLatticePhraseRuntimeState): string[] {
  return (Object.keys(runtime) as Array<keyof NeonLatticePhraseRuntimeState>).filter(key => runtime[key] != null)
}

export function executeNeonLatticePhraseActions(
  runtime: NeonLatticePhraseRuntimeState,
  actions: readonly NeonLatticePhraseAction[],
  settings: NeonLatticeSettings,
): NeonLatticePhraseExecution {
  let next: NeonLatticePhraseRuntimeState = { ...runtime }
  const commands: NeonLatticePhraseCommand[] = []
  let lastAction: string | null = null

  for (const action of actions) {
    lastAction = action.type
    switch (action.type) {
      case 'spawnLine':
        commands.push({ type: 'spawnLine', orientation: action.orientation, lane: action.lane, paletteRole: action.paletteRole, strength: clamp01(action.strength ?? 1) })
        break
      case 'spawnLineCluster':
        commands.push({ type: 'spawnLineCluster', orientation: action.orientation, lanes: action.lanes, chordSize: Math.max(1, Math.min(16, Math.round(action.chordSize ?? 3))), paletteRole: action.paletteRole, strength: clamp01(action.strength ?? 1) })
        break
      case 'lineSweep':
        commands.push({ type: 'lineSweep', orientation: action.orientation, direction: action.direction ?? 1, durationBeats: Math.max(0.0625, action.durationBeats ?? 4), strength: clamp01(action.strength ?? 1) })
        break
      case 'orientationChange':
        next.orientationWeights = makeOverride(action.weights, action, settings)
        break
      case 'mirroredLayout':
        next.mirrored = makeOverride(action.enabled, action, settings)
        break
      case 'paletteStep':
        next.paletteOffset = makeOverride(action.offset ?? 1, action, settings)
        next.paletteRole = makeOverride(action.role, action, settings)
        break
      case 'densityShift':
        next.densityShift = makeOverride(Math.max(-1, Math.min(1, action.amount)), action, settings)
        break
      case 'patternReseed':
        commands.push({ type: 'patternReseed', seed: action.seed })
        break
      case 'clearLines':
        commands.push({ type: 'clearLines' })
        break
      case 'blackout':
        commands.push({ type: 'blackout', durationBeats: Math.max(0.0625, action.durationBeats ?? 1) })
        break
      case 'highlightStrike':
        commands.push({ type: 'highlightStrike', orientation: action.orientation, strength: clamp01(action.strength ?? 1) })
        break
      case 'blockCascade':
        commands.push({ type: 'blockCascade', strength: clamp01(action.strength ?? 1) })
        break
      case 'temporaryEnvelopeChange':
        next.envelope = makeOverride(action.envelope, action, settings)
        break
      case 'temporaryLaneCountChange':
        next.laneCount = makeOverride(Math.max(1, Math.min(32, Math.round(action.laneCount))), action, settings)
        break
      case 'restoreBaseState':
        next = {}
        break
    }
  }

  return { runtime: next, commands, lastAction }
}

export function programsForPhraseScale(
  programs: readonly NeonLatticePhraseProgram[],
  scale: NeonLatticePhraseScale,
  phraseIndex: number,
): NeonLatticePhraseProgram[] {
  return programs.filter(program => program.phraseBeats === scale && phraseIndex % Math.max(1, program.every) === 0)
}

export function applyNeonLatticePhraseRuntime(
  settings: NeonLatticeSettings,
  runtime: NeonLatticePhraseRuntimeState,
): NeonLatticeSettings {
  const laneCount = runtime.laneCount?.value ?? settings.lanePattern.laneCount
  const mirrored = runtime.mirrored?.value ?? settings.lanePattern.mirrored
  const orientationWeights = runtime.orientationWeights
    ? normalizeNeonLatticeOrientationWeights({ ...settings.orientationWeights, ...runtime.orientationWeights.value }, settings.verticalBias)
    : settings.orientationWeights
  return {
    ...settings,
    railDensity: clamp01(settings.railDensity + (runtime.densityShift?.value ?? 0)),
    orientationWeights,
    lineEnvelope: { ...settings.lineEnvelope, ...(runtime.envelope?.value ?? {}) },
    lanePattern: {
      ...settings.lanePattern,
      laneCount,
      mirrored,
      steps: settings.lanePattern.steps.map(step => ({
        ...step,
        lanes: step.lanes.map(lane => Math.max(0, Math.min(laneCount - 1, lane))),
      })),
    },
  }
}

export function computeNeonLatticePhraseProgressModulation(
  frame: MusicIntelligenceFrame | null,
  settings: NeonLatticeSettings,
): NeonLatticePhraseProgressModulation {
  if (!frame) {
    return { densityDelta: 0, bloomMultiplier: 1, activeLaneBonus: 0, chordSizeBonus: 0, patternRateMultiplier: 1, diagonalWeightDelta: 0, laneSpacingScale: 1 }
  }
  const routes = settings.modulationRoutes
  const energy = clamp01(frame.energy.instant)
  const build = clamp01(frame.energy.buildProgress)
  return {
    densityDelta: clamp01(frame.rhythm.phrase4Progress) * routes.phrase4ProgressToDensity * 0.25 + build * routes.buildToDensity * 0.25,
    bloomMultiplier: Math.max(0.25, 1 + clamp01(frame.rhythm.phrase8Progress) * routes.phrase8ProgressToBloom * 0.4),
    activeLaneBonus: Math.round(energy * routes.energyToActiveLanes * Math.max(1, settings.lanePattern.laneCount * 0.5)),
    chordSizeBonus: Math.round(energy * routes.energyToChordSize * 4),
    patternRateMultiplier: Math.max(0.25, 1 + build * routes.buildToPatternRate),
    diagonalWeightDelta: clamp01(frame.rhythm.phrase32Progress) * routes.phrase32ProgressToDiagonalWeight * 0.35,
    laneSpacingScale: Math.max(0.5, 1 - clamp01(frame.rhythm.phrase16Progress) * routes.phrase16ProgressToSpacing * 0.35),
  }
}

export interface NeonLatticePhraseCompletenessValidation {
  valid: boolean
  exempt: boolean
  missing: NeonLatticePhraseScale[]
  duplicateActionSignatures: NeonLatticePhraseScale[]
}

export function validateNeonLatticePhraseCompleteness(settings: NeonLatticeSettings): NeonLatticePhraseCompletenessValidation {
  if (settings.compositionMode === 'legacyLattice') return { valid: true, exempt: true, missing: [], duplicateActionSignatures: [] }
  const scales: NeonLatticePhraseScale[] = [4, 8, 16, 32]
  const missing = scales.filter(scale => !settings.phrasePrograms.some(program => program.phraseBeats === scale && program.actions.length > 0))
  const signatures = new Map<string, NeonLatticePhraseScale[]>()
  for (const scale of scales) {
    const signature = settings.phrasePrograms
      .filter(program => program.phraseBeats === scale)
      .flatMap(program => program.actions.map(action => action.type))
      .join('|')
    if (!signature) continue
    const list = signatures.get(signature) ?? []
    list.push(scale)
    signatures.set(signature, list)
  }
  const duplicateActionSignatures = [...signatures.values()].filter(group => group.length > 1).flat()
  return { valid: missing.length === 0 && duplicateActionSignatures.length === 0, exempt: false, missing, duplicateActionSignatures }
}
