import type { SharedPerformanceContext } from '../../../../features/performanceCore'
import type { PixGridActionCue } from './PixGridActionCues'
import type { PixGridPerformanceSceneOwnership } from './PixGridPerformanceRuntime'
import { applyPixGridBassGainToPerformanceContext } from './PixGridRuntimeControls'
import {
  applyPixGridSelectedScenePreviewFrame,
  resolvePixGridPreviewPerformanceContext,
  resolvePixGridPreviewState,
} from './PixGridScenePreview'
import { applyPixGridPresetSignClock } from './PixGridSignClock'
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
}

export interface PixGridSurfacePerformanceFrame {
  mappedState: PixGridState
  previewAudioFrame: PixGridAudioFrame
  performanceContext: SharedPerformanceContext
  sceneOwnership: PixGridPerformanceSceneOwnership
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
  const projectedPreviewFrame = applyPixGridSelectedScenePreviewFrame(input.audioFrame, mappedState)
  const previewAudioFrame = applyPixGridPresetSignClock(
    projectedPreviewFrame,
    input.presetId ?? '',
    projectedPreviewFrame.motionMultiplier ?? 1,
  )
  const previewContext = resolvePixGridPreviewPerformanceContext(input.context, mappedState, previewAudioFrame)
  const performanceContext = applyPixGridBassGainToPerformanceContext(
    previewContext,
    previewAudioFrame.bassReactivityGain ?? 1,
  )
  const sceneOwnership: PixGridPerformanceSceneOwnership = mappedState.editor.scenePreviewMode === 'selectedScene'
    ? 'editingContext'
    : 'performance'
  const resolvedRuntime = input.runtime.resolve({
    authoredState: mappedState,
    context: performanceContext,
    audioFrame: previewAudioFrame,
    presetId: input.presetId,
    cues: input.cues,
    trackId: input.trackId,
    sceneOwnership,
  })
  return {
    mappedState,
    previewAudioFrame,
    performanceContext,
    sceneOwnership,
    resolvedRuntime,
  }
}
