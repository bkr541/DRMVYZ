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
    resolvedRuntime,
  }
}
