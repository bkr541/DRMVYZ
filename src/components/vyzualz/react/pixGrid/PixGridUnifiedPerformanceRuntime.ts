import type { SharedPerformanceContext } from '../../../../features/performanceCore'
import {
  PixGridCueExecutionRuntime,
  resolvePixGridActionCueFrame,
  type PixGridActionCue,
  type PixGridResolvedTransition,
} from './PixGridActionCues'
import { isPixGridContinuousReactionSource } from './PixGridAudioRouting'
import type { PixGridGroupFrameEffect } from './PixGridFrameEffects'
import { sortPixGridGroupFrameEffects } from './PixGridFrameEffects'
import { compilePixGridGroupMask } from './PixGridGroups'
import {
  PixGridPerformanceExecutionRuntime,
  resolvePixGridPerformanceFrame,
} from './PixGridPerformanceRuntime'
import type { PixGridAudioFrame, PixGridState } from './PixGridTypes'

export const PIX_GRID_RUNTIME_COMPOSITION_ORDER = Object.freeze([
  'authored-state',
  'scene-and-layers',
  'shared-performance-program',
  'persistent-track-map-cue-overrides',
  'continuous-audio-intelligence',
  'discrete-event-envelopes',
  'temporary-manual-overrides',
  'transition-resolution',
  'compiled-mask-and-framebuffer-instructions',
  'logical-framebuffer-and-led-presentation',
] as const)

export function selectPixGridTransition(
  cueTransition: PixGridResolvedTransition | null,
  performanceTransition: PixGridResolvedTransition | null,
): PixGridResolvedTransition | null {
  return cueTransition ?? performanceTransition
}

export interface PixGridUnifiedRuntimeDiagnostics {
  enabledGroups: readonly string[]
  compiledMaskGroups: readonly string[]
  activeContinuousAssignments: readonly string[]
  activeDiscreteAssignments: readonly string[]
  activeEventEnvelopes: readonly string[]
  activePerformanceActions: readonly string[]
  activeCueActions: readonly string[]
  activeGroupEffects: readonly string[]
  activeTransitions: readonly string[]
  manualOverrides: readonly string[]
  degradedSignals: readonly string[]
}

export interface PixGridUnifiedFrame {
  state: PixGridState
  groupEffects: readonly PixGridGroupFrameEffect[]
  transition: PixGridResolvedTransition | null
  performance: ReturnType<typeof resolvePixGridPerformanceFrame>
  cues: ReturnType<typeof resolvePixGridActionCueFrame>
  diagnostics: PixGridUnifiedRuntimeDiagnostics
}

export class PixGridUnifiedPerformanceRuntime {
  private readonly performanceRuntime = new PixGridPerformanceExecutionRuntime()
  private readonly cueRuntime = new PixGridCueExecutionRuntime()

  reset(trackId: string | null = null): void {
    this.performanceRuntime.reset()
    this.cueRuntime.reset(trackId)
  }

  resolve(input: {
    authoredState: PixGridState
    context: SharedPerformanceContext
    audioFrame: PixGridAudioFrame
    presetId: string | null | undefined
    cues: readonly PixGridActionCue[]
    trackId?: string | null
  }): PixGridUnifiedFrame {
    const performance = resolvePixGridPerformanceFrame(
      input.authoredState,
      input.context,
      input.presetId,
      { runtime: this.performanceRuntime },
    )
    const cues = resolvePixGridActionCueFrame(
      performance.state,
      input.cues,
      input.context.audioTimeSec,
      { trackId: input.trackId ?? input.context.trackIdentity, runtime: this.cueRuntime },
    )
    const groupEffects = sortPixGridGroupFrameEffects([
      ...performance.groupEffects,
      ...cues.groupEffects,
    ])

    // Transition ownership is explicit and stable: an active Track Map cue
    // (including manual cue actions), then Performance Program, then cut.
    const transition = selectPixGridTransition(cues.transition, performance.transition)
    const enabledGroups = cues.state.groups.filter(group => group.enabled)
    const compiledMaskGroups = enabledGroups
      .filter(group => compilePixGridGroupMask(group, cues.state.matrixWidth, cues.state.matrixHeight).cellCount > 0)
      .map(group => group.id)
    const continuousAssignments: string[] = []
    const discreteAssignments: string[] = []
    const degradedSignals: string[] = []
    for (const group of enabledGroups) {
      for (const assignment of group.reactions) {
        if (!assignment.enabled) continue
        const route = `${group.id}:${assignment.id}`
        if (isPixGridContinuousReactionSource(assignment.source)) continuousAssignments.push(route)
        else discreteAssignments.push(route)
        if (input.audioFrame.capabilities?.[assignment.source] === false) degradedSignals.push(route)
        else if ((input.audioFrame.confidence?.[assignment.source] ?? 1) < assignment.minimumConfidence) degradedSignals.push(route)
      }
    }

    return {
      state: cues.state,
      groupEffects,
      transition,
      performance,
      cues,
      diagnostics: {
        enabledGroups: enabledGroups.map(group => group.id),
        compiledMaskGroups,
        activeContinuousAssignments: continuousAssignments,
        activeDiscreteAssignments: discreteAssignments,
        activeEventEnvelopes: performance.snapshot.activeEventEnvelopes,
        activePerformanceActions: performance.snapshot.recentActionTypes,
        activeCueActions: cues.snapshot.activeCueIds,
        activeGroupEffects: groupEffects.map(effect => `${effect.source}:${effect.groupId}:${effect.kind}`),
        activeTransitions: transition ? [`${transition.cueId}:${transition.type}`] : [],
        manualOverrides: cues.snapshot.manualOverrideRoutes,
        degradedSignals: [...new Set(degradedSignals)],
      },
    }
  }
}
