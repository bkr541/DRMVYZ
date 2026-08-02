import type { SharedPerformanceContext } from '../../../../features/performanceCore'
import type { PixGridActionCue } from './PixGridActionCues'
import type { PixGridDeckConcreteTransitionMode, PixGridPreparedFrameSet } from './PixGridDeckCompilerContracts'
import type { PixGridDeckDefinition } from './PixGridDeckDomain'
import type { PixGridPerformanceSceneOwnership } from './PixGridPerformanceRuntime'
import { applyPixGridBassGainToPerformanceContext } from './PixGridRuntimeControls'
import {
  applyPixGridSelectedScenePreviewFrame,
  resolvePixGridPreviewPerformanceContext,
  resolvePixGridPreviewState,
} from './PixGridScenePreview'
import { applyPixGridPresetSignClock } from './PixGridSignClock'
import {
  createPixGridPreparedSequenceFrames,
  createPixGridSequenceBoundarySignals,
  resolvePixGridDeckSequencePosition,
  resolvePixGridSequencePlan,
  type PixGridSequencePlan,
} from './PixGridSequenceClock'
import { ensurePixGridCanonicalPresetIntegrity } from './PixGridStateMigration'
import { PixGridUnifiedPerformanceRuntime, type PixGridUnifiedFrame } from './PixGridUnifiedPerformanceRuntime'
import type { PixGridAudioFrame, PixGridState } from './PixGridTypes'

export interface ResolvePixGridSurfacePerformanceFrameInput {
  authoredState: PixGridState
  trackSceneId: string | null
  context: SharedPerformanceContext
  audioFrame: PixGridAudioFrame
  presetId: string | null | undefined
  cues: readonly PixGridActionCue[]
  runtime: PixGridUnifiedPerformanceRuntime
  trackId?: string | null
  deck?: PixGridDeckDefinition | null
  preparedFrameSet?: PixGridPreparedFrameSet | null
  transitionModeResolver?: (sourceItemId: string, targetItemId: string) => PixGridDeckConcreteTransitionMode | null
}

export interface PixGridSurfacePerformanceFrame {
  mappedState: PixGridState
  previewAudioFrame: PixGridAudioFrame
  performanceContext: SharedPerformanceContext
  sceneOwnership: PixGridPerformanceSceneOwnership
  deckSequencePlan: PixGridSequencePlan | null
  resolvedRuntime: PixGridUnifiedFrame
}

/**
 * Production orchestration seam shared by PixGridSurface and runtime-level
 * acceptance tests. It keeps the audio frame, Shared Performance Context, and
 * scene-ownership policy aligned before the unified runtime executes.
 */
export function resolvePixGridSurfacePerformanceFrame(
  input: ResolvePixGridSurfacePerformanceFrameInput,
): PixGridSurfacePerformanceFrame {
  const canonicalAuthoredState = ensurePixGridCanonicalPresetIntegrity(
    input.authoredState,
    input.presetId ?? input.authoredState.selectedPresetId,
  )
  const mappedState = resolvePixGridPreviewState(canonicalAuthoredState, input.trackSceneId)
  const projectedPreviewFrame = Number.isFinite(input.audioFrame.previewElapsedBar)
    ? input.audioFrame
    : applyPixGridSelectedScenePreviewFrame(input.audioFrame, mappedState)
  const previewAudioFrame = Number.isFinite(projectedPreviewFrame.signClock)
    || Number.isFinite(projectedPreviewFrame.motionClockSign)
    ? projectedPreviewFrame
    : applyPixGridPresetSignClock(projectedPreviewFrame, input.presetId ?? '')
  const previewContext = resolvePixGridPreviewPerformanceContext(input.context, mappedState, previewAudioFrame)
  const performanceContext = applyPixGridBassGainToPerformanceContext(
    previewContext,
    previewAudioFrame.bassReactivityGain ?? 1,
  )
  const sceneOwnership: PixGridPerformanceSceneOwnership = mappedState.editor.scenePreviewMode === 'selectedScene'
    ? 'editingContext'
    : 'performance'
  const sequencePosition = resolvePixGridDeckSequencePosition(previewAudioFrame, performanceContext)
  const previewTimeline = Number.isFinite(previewAudioFrame.previewElapsedBar)
    ? [{
        id: `editor-preview:${mappedState.selectedSceneId ?? previewAudioFrame.sectionType ?? 'unknown'}`,
        type: previewAudioFrame.sectionType ?? 'unknown',
        startBar: 0,
        endBar: Math.max(sequencePosition.sequenceBar + 1, previewAudioFrame.previewLoopBars ?? 1),
      }]
    : performanceContext.sectionBarTimeline
  const deckSequencePlan = input.deck
    ? resolvePixGridSequencePlan({
        deck: input.deck,
        preparedFrames: createPixGridPreparedSequenceFrames(input.deck, input.preparedFrameSet),
        timeline: {
          absoluteBar: sequencePosition.absoluteBar,
          sequenceBar: sequencePosition.sequenceBar,
          sectionType: previewAudioFrame.sectionType ?? performanceContext.sectionType ?? 'unknown',
          sectionId: sceneOwnership === 'editingContext'
            ? mappedState.selectedSceneId
            : performanceContext.sectionId,
          sectionOccurrence: performanceContext.sectionOccurrence,
          sectionBarTimeline: previewTimeline,
          sceneId: mappedState.selectedSceneId,
          trackIdentity: performanceContext.trackIdentity,
          presetId: input.presetId ?? input.deck.generatedPresetId,
          timelineRevision: performanceContext.timelineRevision,
          phraseIndex: performanceContext.phraseIndex,
          phraseLengthBars: performanceContext.phraseLengthBars,
          phraseProgress: performanceContext.phraseProgress,
        },
        boundarySignals: createPixGridSequenceBoundarySignals(
          performanceContext,
          sceneOwnership === 'editingContext' ? [] : input.cues,
          sceneOwnership === 'editingContext'
            ? { includePhrases: false, includeSections: false, includeTrackMapCues: false }
            : undefined,
        ),
        motion: previewAudioFrame.motionMultiplier,
        transportMode: sequencePosition.transportMode,
        transitionModeResolver: input.transitionModeResolver,
      })
    : null
  const resolvedRuntime = input.runtime.resolve({
    authoredState: mappedState,
    context: performanceContext,
    audioFrame: previewAudioFrame,
    presetId: input.presetId,
    // Manual scene preview owns transition and power state as well as scene ID.
    // Track-map cues resume only when Follow Track restores performance ownership.
    cues: sceneOwnership === 'editingContext' ? [] : input.cues,
    trackId: input.trackId,
    sceneOwnership,
  })
  return {
    mappedState,
    previewAudioFrame,
    performanceContext,
    sceneOwnership,
    deckSequencePlan,
    resolvedRuntime,
  }
}
