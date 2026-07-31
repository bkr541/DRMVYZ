import type { SharedPerformanceContext, SharedPerformanceSectionPhase } from '../../../../features/performanceCore'
import type { ReactSectionType } from '../ReactTypes'
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
  const sectionBar = positiveModulo(
    frame.motionClockSectionBar ?? frame.barsSinceSectionStart ?? context.absoluteBar,
    4,
  )
  const sectionProgress = Math.max(0, Math.min(1,
    frame.motionClockSectionProgress ?? frame.sectionProgress ?? sectionBar / 4,
  ))
  const sixteenBarCycle = positiveModulo(context.absoluteBar, 16)
  const sectionStartSec = Math.max(0, context.audioTimeSec - sectionBar * barDurationSec)
  const sectionEndSec = sectionStartSec + 4 * barDurationSec
  const previewId = `editor-preview:${scene.id}`
  const phase = previewSectionPhase(sectionProgress)
  const sectionOccurrence = 1
  const dropOccurrence = sectionType === 'drop' ? 1 : 0
  const performanceFourBarBlockIndex = Math.floor(sixteenBarCycle / 4)
  const performanceEightBarBlockIndex = Math.floor(sixteenBarCycle / 8)
  const performanceSixteenBarBlockIndex = 0
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
    occurrenceIndex: 0,
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

  return {
    ...context,
    deterministicVariationSeed: previewSeed(context.deterministicVariationSeed, scene.id),
    sectionIdentity,
    macroSectionIdentity,
    timelineRevision: `${context.timelineRevision}::${previewId}`,
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
    barsUntilSectionEnd: Math.max(0, 4 - sectionBar),
    barsSinceMacroSectionStart: sectionBar,
    barsUntilMacroSectionEnd: Math.max(0, 4 - sectionBar),
    performanceFourBarBlockIndex,
    performanceEightBarBlockIndex,
    performanceSixteenBarBlockIndex,
    fourBarProgress: sectionProgress,
    eightBarProgress: positiveModulo(sixteenBarCycle, 8) / 8,
    sixteenBarProgress: sixteenBarCycle / 16,
    phraseIndex: Math.floor(context.absoluteBar / 4),
    phraseLengthBars: 4,
    phraseProgress: sectionProgress,
    sceneLocalVariationIndex: performanceFourBarBlockIndex % 4,
    capabilities,
    confidence: { ...context.confidence, section: 1, phrase: Math.max(context.confidence.phrase, 0.95) },
    boundaries: {
      ...context.boundaries,
      sectionEntry: context.boundaries.performanceFourBarBoundary,
      sectionExit: false,
      previousSectionId: previewId,
      currentSectionId: previewId,
      macroSectionEntry: context.boundaries.performanceSixteenBarBoundary,
      macroSectionExit: false,
      previousMacroSectionId: resolvedMacroSection.id,
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

/**
 * Manual scene preview keeps the transport's beat clock but gives the selected
 * scene a deterministic four-bar local timeline. This allows authored motion
 * to remain visible without permitting track analysis to reclaim scene ownership.
 */
export function applyPixGridSelectedScenePreviewFrame(
  frame: PixGridAudioFrame,
  state: PixGridState,
): PixGridAudioFrame {
  if (state.editor.scenePreviewMode !== 'selectedScene') return frame
  const sectionType = resolvePixGridSceneSectionType(state)
  if (!sectionType) return frame
  const absoluteBar = frame.motionClockBar ?? ((frame.barIndex ?? 0) + (((frame.beatIndex ?? 0) % 4) + frame.beatPhase) / 4)
  const sectionBar = positiveModulo(absoluteBar, 4)
  const sectionProgress = sectionBar / 4
  return {
    ...frame,
    sectionType,
    motionClockSectionType: sectionType,
    sectionProgress,
    motionClockSectionProgress: sectionProgress,
    barsSinceSectionStart: sectionBar,
    beatsSinceSectionStart: sectionBar * 4,
    motionClockSectionBar: sectionBar,
    motionClockSectionBeat: sectionBar * 4,
    sectionPhase: previewSectionPhase(sectionProgress),
    inputSource: 'editor-preview',
    sourceValues: { ...frame.sourceValues, sectionProgress },
    unscaledSourceValues: { ...frame.unscaledSourceValues, sectionProgress },
  }
}
