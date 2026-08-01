import type { SharedPerformanceContext, SharedPerformanceSectionPhase } from '../../../../features/performanceCore'
import type { ReactSectionType } from '../ReactTypes'
import { PIX_GRID_NEON_MARQUEE_SIGN_CADENCE } from './PixGridSignClock'
import type { PixGridAudioFrame, PixGridState } from './PixGridTypes'

const SCENE_SUFFIXES: ReadonlyArray<readonly [string, ReactSectionType]> = [
  ['preDrop', 'preDrop'],
  ['breakdown', 'breakdown'],
  ['intro', 'intro'],
  ['verse', 'verse'],
  ['build', 'build'],
  ['drop', 'drop'],
  ['outro', 'outro'],
]

const PREVIEW_CLOCK_EPSILON = 1e-9
const HELD_SCENE_PREVIEW_BARS = 16
const MINIMUM_CYCLING_PREVIEW_BARS = 16
const MARQUEE_SIGN_FRAME_COUNT = 4
const LEGACY_SELECTED_SCENE_PREVIEW_BARS = 4
const MARQUEE_PRESET_ID = 'pix-grid-neon-marquee-cycle'

export const PIX_GRID_FOLLOW_TRACK_SCENE_VALUE = 'followTrack' as const

export function selectPixGridPreviewScene(state: PixGridState, value: string): PixGridState {
  if (value === PIX_GRID_FOLLOW_TRACK_SCENE_VALUE) {
    return { ...state, editor: { ...state.editor, scenePreviewMode: 'followTrack' } }
  }
  if (!state.scenes.some(scene => scene.id === value)) return state
  return {
    ...state,
    selectedSceneId: value,
    editor: { ...state.editor, scenePreviewMode: 'selectedScene' },
  }
}

export function selectPixGridEditingTarget(state: PixGridState, targetId: string | null): PixGridState {
  const selectedLayerId = targetId && state.layers.some(layer => layer.id === targetId) ? targetId : null
  return { ...state, editor: { ...state.editor, selectedLayerId } }
}

export function resolvePixGridPreviewState(
  state: PixGridState,
  trackSceneId: string | null,
): PixGridState {
  if (state.editor.scenePreviewMode === 'selectedScene') return state
  if (!trackSceneId || !state.scenes.some(scene => scene.id === trackSceneId)) return state
  return trackSceneId === state.selectedSceneId ? state : { ...state, selectedSceneId: trackSceneId }
}

export function resolvePixGridSceneSectionType(state: PixGridState): ReactSectionType | null {
  const scene = state.scenes.find(candidate => candidate.id === state.selectedSceneId)
  if (!scene) return null
  const candidates = [scene.id, scene.name].map(value => value.toLowerCase().replace(/[\s_-]+/g, ''))
  for (const [suffix, sectionType] of SCENE_SUFFIXES) {
    const normalized = suffix.toLowerCase()
    if (candidates.some(value => value.endsWith(normalized) || value.includes(normalized))) return sectionType
  }
  return null
}

function positiveModulo(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus
}

function previewSectionPhase(progress: number): SharedPerformanceSectionPhase {
  if (progress < 0.125) return 'entry'
  if (progress > 0.875) return 'exit'
  return 'body'
}

function previewSeed(seed: number, sceneId: string): number {
  let hash = seed >>> 0
  for (let index = 0; index < sceneId.length; index += 1) {
    hash ^= sceneId.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function finiteNonNegative(value: number | undefined): number {
  return Math.max(0, Number.isFinite(value) ? value! : 0)
}

function rawAbsoluteBar(frame: PixGridAudioFrame): number {
  if (Number.isFinite(frame.absoluteBar)) return finiteNonNegative(frame.absoluteBar)
  if (Number.isFinite(frame.barIndex)) return finiteNonNegative(frame.barIndex) + finiteNonNegative(frame.barProgress)
  const beatIndex = finiteNonNegative(frame.beatIndex)
  return (beatIndex + Math.max(0, Math.min(1, Number.isFinite(frame.beatPhase) ? frame.beatPhase : 0))) / 4
}

/**
 * Selected Scene loops are aligned to a complete four-sign cycle. That makes
 * the final sign transition naturally return to the first sign instead of
 * fabricating a previous frame when the authored section animation repeats.
 */
export function resolvePixGridSelectedScenePreviewLoopBars(
  sectionType: ReactSectionType,
  motionMultiplier = 1,
): number {
  const cadence = Math.max(0, PIX_GRID_NEON_MARQUEE_SIGN_CADENCE[sectionType] ?? 0)
  const motion = Math.max(0, Number.isFinite(motionMultiplier) ? motionMultiplier : 1)
  if (cadence <= PREVIEW_CLOCK_EPSILON || motion <= PREVIEW_CLOCK_EPSILON) return HELD_SCENE_PREVIEW_BARS
  const barsPerSign = 1 / (cadence * motion)
  return Math.max(MINIMUM_CYCLING_PREVIEW_BARS, barsPerSign * MARQUEE_SIGN_FRAME_COUNT)
}

function isMarqueeSelectedScene(state: PixGridState): boolean {
  return state.selectedPresetId === MARQUEE_PRESET_ID
    || (state.selectedSceneId ?? '').startsWith(`${MARQUEE_PRESET_ID}-`)
}

function resolveSelectedScenePreviewLoopBars(
  state: PixGridState,
  sectionType: ReactSectionType,
  motionMultiplier = 1,
): number {
  return isMarqueeSelectedScene(state)
    ? resolvePixGridSelectedScenePreviewLoopBars(sectionType, motionMultiplier)
    : LEGACY_SELECTED_SCENE_PREVIEW_BARS
}

function selectedScenePreviewLoops(
  state: PixGridState,
  sectionType: ReactSectionType,
  motionMultiplier = 1,
): boolean {
  if (!isMarqueeSelectedScene(state)) return true
  return (PIX_GRID_NEON_MARQUEE_SIGN_CADENCE[sectionType] ?? 0) > PREVIEW_CLOCK_EPSILON
    && motionMultiplier > PREVIEW_CLOCK_EPSILON
}

interface ApplyPixGridSelectedScenePreviewFrameOptions {
  elapsedBar?: number
  loopBoundary?: boolean
}

/**
 * Projects a frame onto the deterministic timeline for its manually selected
 * scene. The authoritative transport position is projected directly onto the
 * preview timeline so seeks reconstruct without prior rendered-frame history.
 */
export function applyPixGridSelectedScenePreviewFrame(
  frame: PixGridAudioFrame,
  state: PixGridState,
  options: ApplyPixGridSelectedScenePreviewFrameOptions = {},
): PixGridAudioFrame {
  if (state.editor.scenePreviewMode !== 'selectedScene') return frame
  const sectionType = resolvePixGridSceneSectionType(state)
  if (!sectionType) return frame

  const elapsedBar = finiteNonNegative(
    options.elapsedBar
      ?? frame.previewElapsedBar
      ?? rawAbsoluteBar(frame),
  )
  const motionMultiplier = Math.max(0, Number.isFinite(frame.motionMultiplier) ? frame.motionMultiplier! : 1)
  const loopBars = resolveSelectedScenePreviewLoopBars(state, sectionType, motionMultiplier)
  const previewLoops = selectedScenePreviewLoops(state, sectionType, motionMultiplier)
  const loopIndex = previewLoops ? Math.floor(elapsedBar / loopBars + PREVIEW_CLOCK_EPSILON) : 0
  const sectionBar = previewLoops
    ? positiveModulo(elapsedBar, loopBars)
    : Math.min(elapsedBar, loopBars)
  const sectionProgress = Math.max(0, Math.min(1, sectionBar / loopBars))
  const loopBoundary = options.loopBoundary === true
    || (options.loopBoundary === undefined && sectionBar <= PREVIEW_CLOCK_EPSILON)
  const previewBeat = elapsedBar * 4
  const beatIndex = Math.floor(previewBeat + PREVIEW_CLOCK_EPSILON)
  const beatPhase = positiveModulo(previewBeat, 1)
  const barIndex = Math.floor(elapsedBar + PREVIEW_CLOCK_EPSILON)
  const barProgress = positiveModulo(elapsedBar, 1)
  const barBoundary = barProgress <= PREVIEW_CLOCK_EPSILON
  const phraseBar = positiveModulo(sectionBar, 4)
  const phraseProgress = phraseBar / 4

  return {
    ...frame,
    absoluteBar: elapsedBar,
    barIndex,
    barProgress,
    beatIndex,
    beatPhase,
    sectionBarTimeline: [{
      id: `editor-preview:${state.selectedSceneId ?? sectionType}`,
      type: sectionType,
      startBar: 0,
      endBar: Math.max(loopBars, elapsedBar + 1),
    }],
    sectionType,
    motionClockSectionType: undefined,
    sectionProgress,
    motionClockSectionProgress: undefined,
    barsSinceSectionStart: sectionBar,
    beatsSinceSectionStart: sectionBar * 4,
    motionClockSectionBar: undefined,
    motionClockSectionBeat: undefined,
    sectionOccurrence: loopIndex,
    dropOccurrence: sectionType === 'drop' ? loopIndex : 0,
    phraseIndex: Math.floor(sectionBar / 4),
    phraseProgress,
    phraseSegment: phraseProgress < 0.125
      ? 'entry'
      : phraseProgress > 0.875
        ? 'exit'
        : phraseProgress < 0.375
          ? 'early'
          : phraseProgress > 0.625
            ? 'late'
            : 'middle',
    sectionPhase: previewSectionPhase(sectionProgress),
    sectionEntry: loopBoundary,
    sectionExit: false,
    barEntry: barBoundary,
    fourBarBoundary: barBoundary && Math.floor(sectionBar + PREVIEW_CLOCK_EPSILON) % 4 === 0,
    eightBarBoundary: barBoundary && Math.floor(sectionBar + PREVIEW_CLOCK_EPSILON) % 8 === 0,
    sixteenBarBoundary: barBoundary && Math.floor(sectionBar + PREVIEW_CLOCK_EPSILON) % 16 === 0,
    phraseEntry: barBoundary && phraseBar <= PREVIEW_CLOCK_EPSILON,
    dropImpactHit: sectionType === 'drop' && loopBoundary,
    dropOccurrenceChange: sectionType === 'drop' && loopBoundary,
    semanticMomentHit: false,
    trackMapCueEvent: false,
    trackMapCueIdentity: null,
    previewElapsedBar: elapsedBar,
    previewLoopBars: loopBars,
    previewLoopIndex: loopIndex,
    previewLoops,
    previewLoopBoundary: loopBoundary,
    inputSource: 'editor-preview',
    sourceValues: { ...frame.sourceValues, sectionProgress },
    unscaledSourceValues: { ...frame.unscaledSourceValues, sectionProgress },
    signClock: undefined,
    signTransitionClock: undefined,
    signTransitionRate: undefined,
    signTransitionSourceFrame: undefined,
    signTransitionTargetFrame: undefined,
    motionClockTime: undefined,
    motionClockBeat: undefined,
    motionClockBar: undefined,
    motionClockSign: undefined,
    motionClockSignTransition: undefined,
    motionClockSignTransitionSourceFrame: undefined,
    motionClockSignTransitionTargetFrame: undefined,
    restoringFromTransparency: false,
    restorationElapsedBar: undefined,
  }
}

/**
 * Stateless production preview projection. The transport bar is converted into
 * the selected scene's deterministic preview timeline on every frame, including
 * direct seeks, so no previous source, target, transition, or power state survives.
 */
export class PixGridSelectedScenePreviewClock {
  reset(): void {}

  apply(frame: PixGridAudioFrame, state: PixGridState): PixGridAudioFrame {
    if (state.editor.scenePreviewMode !== 'selectedScene') return frame
    return applyPixGridSelectedScenePreviewFrame(frame, state, {
      elapsedBar: rawAbsoluteBar(frame),
    })
  }
}

/**
 * Builds the Shared Performance view used by Selected Scene preview. Track
 * rhythm and transport identities remain intact, while section ownership and
 * section-local cadence are projected onto the manually selected scene.
 */
export function resolvePixGridPreviewPerformanceContext(
  context: SharedPerformanceContext,
  state: PixGridState,
  frame: PixGridAudioFrame,
): SharedPerformanceContext {
  if (state.editor.scenePreviewMode !== 'selectedScene') return context
  const scene = state.scenes.find(candidate => candidate.id === state.selectedSceneId)
  const sectionType = resolvePixGridSceneSectionType(state)
  if (!scene || !sectionType) return context

  const timeSignature = Math.max(1, context.timeSignature || 4)
  const barDurationSec = context.bpm > 0 ? (60 / context.bpm) * timeSignature : 2
  const elapsedBar = finiteNonNegative(frame.previewElapsedBar ?? frame.barsSinceSectionStart)
  const loopBars = Math.max(1, finiteNonNegative(frame.previewLoopBars) || resolveSelectedScenePreviewLoopBars(state, sectionType))
  const previewLoops = frame.previewLoops ?? selectedScenePreviewLoops(state, sectionType)
  const loopIndex = previewLoops ? Math.floor(elapsedBar / loopBars + PREVIEW_CLOCK_EPSILON) : 0
  const sectionBar = previewLoops
    ? positiveModulo(elapsedBar, loopBars)
    : Math.min(elapsedBar, loopBars)
  const sectionProgress = Math.max(0, Math.min(1,
    frame.sectionProgress ?? sectionBar / loopBars,
  ))
  const occurrenceElapsedBar = previewLoops ? sectionBar : elapsedBar
  const sectionStartSec = Math.max(0, context.audioTimeSec - occurrenceElapsedBar * barDurationSec)
  const sectionEndSec = sectionStartSec + loopBars * barDurationSec
  const previewRootId = `editor-preview:${scene.id}`
  const previewId = `${previewRootId}:loop-${loopIndex}`
  const previousPreviewId = `${previewRootId}:loop-${Math.max(0, loopIndex - 1)}`
  const phase = previewSectionPhase(sectionProgress)
  const sectionOccurrence = loopIndex + 1
  const dropOccurrence = sectionType === 'drop' ? sectionOccurrence : 0
  const performanceFourBarBlockIndex = Math.floor(sectionBar / 4)
  const performanceEightBarBlockIndex = Math.floor(sectionBar / 8)
  const performanceSixteenBarBlockIndex = Math.floor(sectionBar / 16)
  const capabilities = { ...context.capabilities, sections: true }
  const resolvedSection = {
    id: previewId,
    label: scene.name,
    type: sectionType,
    startSec: sectionStartSec,
    endSec: sectionEndSec,
    intensity: context.resolvedSection?.intensity ?? 1,
    confidence: 1,
    source: 'manual' as const,
    familyId: null,
    occurrenceIndex: loopIndex,
    dropConfidence: sectionType === 'drop' ? 1 : 0,
  }
  const resolvedMacroSection = {
    id: `${previewId}:macro`,
    label: scene.name,
    type: sectionType,
    startSec: sectionStartSec,
    endSec: sectionEndSec,
    intensity: resolvedSection.intensity,
    confidence: 1,
    source: 'manual' as const,
    sectionIds: [previewId],
  }
  const sectionIdentity = previewId
  const macroSectionIdentity = resolvedMacroSection.id
  const loopBoundary = frame.previewLoopBoundary === true

  return {
    ...context,
    deterministicVariationSeed: previewSeed(context.deterministicVariationSeed, scene.id),
    sectionIdentity,
    macroSectionIdentity,
    timelineRevision: `${context.timelineRevision}::${previewRootId}`,
    runtimeIdentity: `${context.runtimeIdentity}::${previewId}`,
    sections: [resolvedSection],
    macroSections: [resolvedMacroSection],
    resolvedSection,
    resolvedMacroSection,
    sectionType,
    sectionId: previewId,
    sectionFamily: null,
    sectionPhase: phase,
    macroSectionType: sectionType,
    macroSectionProgress: sectionProgress,
    macroSectionPhase: phase,
    sectionProgress,
    sectionConfidence: 1,
    fineSectionOccurrence: sectionOccurrence,
    sectionOccurrence,
    dropOccurrence,
    macroSectionOccurrence: sectionOccurrence,
    macroDropOccurrence: dropOccurrence,
    boundaryClassification: 'none',
    barWithinSection: Math.floor(sectionBar),
    barWithinMacroSection: Math.floor(sectionBar),
    barsSinceSectionStart: sectionBar,
    barsUntilSectionEnd: Math.max(0, loopBars - sectionBar),
    barsSinceMacroSectionStart: sectionBar,
    barsUntilMacroSectionEnd: Math.max(0, loopBars - sectionBar),
    performanceFourBarBlockIndex,
    performanceEightBarBlockIndex,
    performanceSixteenBarBlockIndex,
    fourBarProgress: positiveModulo(sectionBar, 4) / 4,
    eightBarProgress: positiveModulo(sectionBar, 8) / 8,
    sixteenBarProgress: positiveModulo(sectionBar, 16) / 16,
    phraseIndex: Math.floor(sectionBar / 4),
    phraseLengthBars: 4,
    phraseProgress: positiveModulo(sectionBar, 4) / 4,
    sceneLocalVariationIndex: performanceFourBarBlockIndex % 4,
    capabilities,
    confidence: { ...context.confidence, section: 1, phrase: Math.max(context.confidence.phrase, 0.95) },
    boundaries: {
      ...context.boundaries,
      sectionEntry: loopBoundary,
      sectionExit: false,
      previousSectionId: loopBoundary ? previousPreviewId : previewId,
      currentSectionId: previewId,
      macroSectionEntry: loopBoundary,
      macroSectionExit: false,
      previousMacroSectionId: loopBoundary ? `${previousPreviewId}:macro` : resolvedMacroSection.id,
      currentMacroSectionId: resolvedMacroSection.id,
      boundaryClassification: 'none',
      hardMusicalReset: false,
      microSectionContinuation: false,
      variationBoundary: false,
    },
    intelligence: {
      ...context.intelligence,
      capabilities,
      section: {
        ...context.intelligence.section,
        type: sectionType,
        confidence: 1,
        progress: sectionProgress,
      },
    },
  }
}
