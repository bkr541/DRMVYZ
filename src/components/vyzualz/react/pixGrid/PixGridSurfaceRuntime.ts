import type { SharedPerformanceContext } from '../../../../features/performanceCore'
import type { PixGridActionCue } from './PixGridActionCues'
import type { PixGridDeckConcreteTransitionMode, PixGridPreparedFrameSet } from './PixGridDeckCompilerContracts'
import { PIX_GRID_DECK_PERFORMANCE_PROGRAM_ID, type PixGridDeckDefinition } from './PixGridDeckDomain'
import { applyPixGridDeckManualAudioReactions, createPixGridDeckPerformanceProgram } from './PixGridDeckPerformanceProgram'
import { withPixGridDeckGeneratedGroups } from './PixGridDeckRuntime'
import type { PixGridPerformanceSceneOwnership } from './PixGridPerformanceRuntime'
import { applyPixGridBassGainToPerformanceContext } from './PixGridRuntimeControls'
import {
  applyPixGridSelectedScenePreviewFrame,
  resolvePixGridPreviewPerformanceContext,
  resolvePixGridPreviewState,
} from './PixGridScenePreview'
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

const canonicalStateCache = new WeakMap<PixGridState, Readonly<{ presetId: string | null; state: PixGridState }>>()

function resolveCanonicalRuntimeState(state: PixGridState, presetId: string | null): PixGridState {
  const cached = canonicalStateCache.get(state)
  if (cached?.presetId === presetId) return cached.state
  const canonical = ensurePixGridCanonicalPresetIntegrity(state, presetId)
  canonicalStateCache.set(state, { presetId, state: canonical })
  return canonical
}

/**
 * Production orchestration seam shared by PixGridSurface and runtime-level
 * acceptance tests. It keeps the audio frame, Shared Performance Context, and
 * scene-ownership policy aligned before the unified runtime executes.
 */
export function resolvePixGridSurfacePerformanceFrame(
  input: ResolvePixGridSurfacePerformanceFrameInput,
): PixGridSurfacePerformanceFrame {
  const canonicalPresetId = input.presetId ?? input.authoredState.selectedPresetId
  const canonicalAuthoredState = resolveCanonicalRuntimeState(input.authoredState, canonicalPresetId)
  const previewMappedState = resolvePixGridPreviewState(canonicalAuthoredState, input.trackSceneId)
  const deckState = input.deck
    ? withPixGridDeckGeneratedGroups(previewMappedState, input.deck.id)
    : previewMappedState
  const deckProgramState = input.deck
    ? {
        ...deckState,
        performance: {
          ...deckState.performance,
          sharedPerformanceProgramId: PIX_GRID_DECK_PERFORMANCE_PROGRAM_ID,
        },
      }
    : deckState
  const mappedState = input.deck && !deckProgramState.performance.enabled
    ? applyPixGridDeckManualAudioReactions(deckProgramState, input.deck.id)
    : deckProgramState
  const deckPerformanceProgram = input.deck && mappedState.performance.enabled
    ? createPixGridDeckPerformanceProgram(mappedState, input.deck)
    : null
  const projectedPreviewFrame = Number.isFinite(input.audioFrame.previewElapsedBar)
    ? input.audioFrame
    : applyPixGridSelectedScenePreviewFrame(input.audioFrame, mappedState)
  const previewAudioFrame = projectedPreviewFrame
  const previewContext = resolvePixGridPreviewPerformanceContext(input.context, mappedState, previewAudioFrame)
  const performanceContext = applyPixGridBassGainToPerformanceContext(
    previewContext,
    previewAudioFrame.bassReactivityGain ?? 1,
  )
  const sceneOwnership: PixGridPerformanceSceneOwnership = mappedState.editor.scenePreviewMode === 'selectedScene'
    ? 'editingContext'
    : 'performance'
  const sequencePosition = resolvePixGridDeckSequencePosition(previewAudioFrame, performanceContext)
  const rawPreviewTimeline = Number.isFinite(previewAudioFrame.previewElapsedBar)
    ? [{
        id: `editor-preview:${mappedState.selectedSceneId ?? previewAudioFrame.sectionType ?? 'unknown'}`,
        type: previewAudioFrame.sectionType ?? 'unknown',
        startBar: 0,
        endBar: Math.max(sequencePosition.sequenceBar + 1, previewAudioFrame.previewLoopBars ?? 1),
      }]
    : performanceContext.sectionBarTimeline
  const previewTimeline = input.deck
    ? rawPreviewTimeline.map(span => {
        const barsPerSecond = performanceContext.bpm / (60 * Math.max(1, performanceContext.timeSignature))
        const gridOffsetBars = performanceContext.absoluteBar - performanceContext.audioTimeSec * barsPerSecond
        const historicalSceneCue = input.cues
          .filter(cue => cue.enabled && cue.action.type === 'selectScene')
          .map(cue => ({ cue, bar: cue.timeSec * barsPerSecond + gridOffsetBars }))
          .filter(entry => entry.bar <= span.startBar + 1e-8)
          .sort((left, right) => right.bar - left.bar || right.cue.order - left.cue.order)[0]
        const matchingSceneId = Object.keys(input.deck!.configuration.sceneItemAssignments ?? {})
          .find(sceneId => sceneId.endsWith(`:${span.type}`))
        return {
          ...span,
          sceneId: historicalSceneCue?.cue.action.type === 'selectScene'
            ? historicalSceneCue.cue.action.sceneId
            : matchingSceneId ?? null,
        }
      })
    : rawPreviewTimeline
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
          beatsPerBar: performanceContext.timeSignature,
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
          sceneOwnership === 'editingContext' || !mappedState.performance.enabled
            ? { includePhrases: false, includeSections: false, includeTrackMapCues: false }
            : { includeTrackMapCues: false },
        ),
        autoPerformanceEnabled: mappedState.performance.enabled,
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
    performanceProgram: deckPerformanceProgram,
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
