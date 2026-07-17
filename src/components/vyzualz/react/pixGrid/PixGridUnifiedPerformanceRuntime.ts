import type { SharedPerformanceContext } from "../../../../features/performanceCore";
import {
  PixGridCueExecutionRuntime,
  resolvePixGridActionCueFrame,
  type PixGridActionCue,
  type PixGridResolvedTransition,
} from "./PixGridActionCues";
import {
  evaluatePixGridCompiledConditions,
  PixGridAssignmentCompiler,
} from "./PixGridAssignmentCompiler";
import {
  isPixGridContinuousReactionSource,
  pixGridReactionSourceValue,
} from "./PixGridAudioRouting";
import { PIX_GRID_AUDIO_INTELLIGENCE_SOURCES } from "./PixGridAudioIntelligenceRegistry";
import type { PixGridGroupFrameEffect } from "./PixGridFrameEffects";
import { sortPixGridGroupFrameEffects } from "./PixGridFrameEffects";
import { compilePixGridGroupMask } from "./PixGridGroups";
import {
  PixGridPerformanceExecutionRuntime,
  resolvePixGridPerformanceFrame,
} from "./PixGridPerformanceRuntime";
import type {
  PixGridAudioFrame,
  PixGridReactionAssignment,
  PixGridReactionSource,
  PixGridReactionTargetScope,
  PixGridState,
} from "./PixGridTypes";

export const PIX_GRID_RUNTIME_COMPOSITION_ORDER = Object.freeze([
  "authored-state",
  "scene-and-layers",
  "shared-performance-program",
  "persistent-track-map-cue-overrides",
  "continuous-audio-intelligence",
  "discrete-event-envelopes",
  "temporary-manual-overrides",
  "transition-resolution",
  "compiled-mask-and-framebuffer-instructions",
  "logical-framebuffer-and-led-presentation",
] as const);

export function selectPixGridTransition(
  cueTransition: PixGridResolvedTransition | null,
  performanceTransition: PixGridResolvedTransition | null,
): PixGridResolvedTransition | null {
  return cueTransition ?? performanceTransition;
}

export interface PixGridUnifiedRuntimeDiagnostics {
  enabledGroups: readonly string[];
  compiledMaskGroups: readonly string[];
  availableSources: readonly PixGridReactionSource[];
  unavailableSources: readonly PixGridReactionSource[];
  degradedSources: readonly PixGridReactionSource[];
  activeCompiledAssignments: readonly string[];
  disabledAssignments: readonly string[];
  assignmentsBlockedByConditions: readonly string[];
  assignmentsBlockedByConfidence: readonly string[];
  assignmentsUsingFallback: readonly string[];
  fallbackSources: readonly PixGridReactionSource[];
  confidenceBlockedSources: readonly PixGridReactionSource[];
  missingTargets: readonly string[];
  continuousSourceValues: Readonly<
    Partial<Record<PixGridReactionSource, number>>
  >;
  recentDiscreteTriggers: readonly PixGridReactionSource[];
  compilationWarnings: readonly string[];
  activeContinuousAssignments: readonly string[];
  activeDiscreteAssignments: readonly string[];
  activeEventEnvelopes: readonly string[];
  activePerformanceActions: readonly string[];
  activeSectionPlan: string | null;
  activeVisualRoles: readonly string[];
  resolvedProgramBanks: readonly string[];
  activeProgramContinuousRoutes: readonly string[];
  activeProgramEventRoutes: readonly string[];
  activeProgramMotif: string | null;
  activeProgramRecruitment: string | null;
  activeProgramEvolution: string | null;
  fourBarStage: number;
  eightBarStage: number;
  sixteenBarStage: number;
  sectionName: string;
  sectionPhase: string;
  sectionOccurrence: number;
  dropOccurrence: number;
  programBindingWarnings: readonly string[];
  manualOverridePrecedence: string;
  programCompilerGeneration: number;
  cachedProgramCount: number;
  activeCueActions: readonly string[];
  activeGroupEffects: readonly string[];
  activeTransitions: readonly string[];
  manualOverrides: readonly string[];
  degradedSignals: readonly string[];
  compilerGeneration: number;
  cachedAssignmentCount: number;
}

export interface PixGridUnifiedFrame {
  state: PixGridState;
  groupEffects: readonly PixGridGroupFrameEffect[];
  transition: PixGridResolvedTransition | null;
  performance: ReturnType<typeof resolvePixGridPerformanceFrame>;
  cues: ReturnType<typeof resolvePixGridActionCueFrame>;
  diagnostics: PixGridUnifiedRuntimeDiagnostics;
}

interface DiagnosticRoute {
  assignment: PixGridReactionAssignment;
  routeId: string;
  displayId: string;
  scope: PixGridReactionTargetScope;
  targetId: string | null;
}

function assignmentRoutes(state: PixGridState): DiagnosticRoute[] {
  const routes: DiagnosticRoute[] = state.audioAssignments.map(
    (assignment) => ({
      assignment,
      routeId: `audio:${assignment.id}`,
      displayId: `audio:${assignment.id}`,
      scope: assignment.targetScope ?? "output",
      targetId: assignment.targetId?.trim() || null,
    }),
  );
  for (const group of state.groups) {
    for (const assignment of group.reactions) {
      routes.push({
        assignment,
        routeId: `group:${group.id}:${assignment.id}`,
        displayId: `${group.id}:${assignment.id}`,
        scope: assignment.targetScope ?? "group",
        targetId: assignment.targetId?.trim() || group.id,
      });
    }
  }
  return routes;
}

function addUnique<T>(array: T[], value: T): void {
  if (!array.includes(value)) array.push(value);
}

function routeTargetExists(route: DiagnosticRoute, state: PixGridState): boolean {
  if (!route.targetId) return true;
  switch (route.scope) {
    case "scene":
      return state.scenes.some((scene) => scene.id === route.targetId);
    case "layer":
    case "animation":
      return state.layers.some((layer) => layer.id === route.targetId);
    case "group":
    case "pixels":
      return state.groups.some((group) => group.id === route.targetId);
    default:
      return true;
  }
}

export class PixGridUnifiedPerformanceRuntime {
  private readonly performanceRuntime =
    new PixGridPerformanceExecutionRuntime();
  private readonly cueRuntime = new PixGridCueExecutionRuntime();
  private readonly assignmentCompiler = new PixGridAssignmentCompiler();

  reset(trackId: string | null = null): void {
    this.performanceRuntime.reset();
    this.cueRuntime.reset(trackId);
    this.assignmentCompiler.clear();
  }

  resolve(input: {
    authoredState: PixGridState;
    context: SharedPerformanceContext;
    audioFrame: PixGridAudioFrame;
    presetId: string | null | undefined;
    cues: readonly PixGridActionCue[];
    trackId?: string | null;
  }): PixGridUnifiedFrame {
    const performance = resolvePixGridPerformanceFrame(
      input.authoredState,
      input.context,
      input.presetId,
      {
        runtime: this.performanceRuntime,
        capabilities: input.audioFrame.capabilities,
      },
    );
    const cues = resolvePixGridActionCueFrame(
      performance.state,
      input.cues,
      input.context.audioTimeSec,
      {
        trackId: input.trackId ?? input.context.trackIdentity,
        runtime: this.cueRuntime,
      },
    );
    const groupEffects = sortPixGridGroupFrameEffects([
      ...performance.groupEffects,
      ...cues.groupEffects,
    ]);

    const transition = selectPixGridTransition(
      cues.transition,
      performance.transition,
    );
    const enabledGroups = cues.state.groups.filter((group) => group.enabled);
    const compiledMaskGroups = enabledGroups
      .filter(
        (group) =>
          compilePixGridGroupMask(
            group,
            cues.state.matrixWidth,
            cues.state.matrixHeight,
          ).cellCount > 0,
      )
      .map((group) => group.id);
    const activeLayerIds = new Set(
      cues.state.layers
        .filter((layer) => layer.visible)
        .map((layer) => layer.id),
    );
    const activeGroupIds = new Set(enabledGroups.map((group) => group.id));

    const availableSources: PixGridReactionSource[] = [];
    const unavailableSources: PixGridReactionSource[] = [];
    const degradedSources: PixGridReactionSource[] = [];
    const recentDiscreteTriggers: PixGridReactionSource[] = [];
    const continuousSourceValues: Partial<
      Record<PixGridReactionSource, number>
    > = {};
    const cueTriggered = cues.snapshot.activeCueIds.length > 0;
    for (const definition of PIX_GRID_AUDIO_INTELLIGENCE_SOURCES) {
      const available =
        definition.id === "trackMapCueEvent"
          ? cueTriggered
          : input.audioFrame.capabilities?.[definition.id] !== false;
      const confidence =
        definition.id === "trackMapCueEvent"
          ? cueTriggered
            ? 1
            : 0
          : (input.audioFrame.confidence?.[definition.id] ??
            (available ? 1 : 0));
      const value =
        definition.id === "trackMapCueEvent"
          ? cueTriggered
            ? 1
            : 0
          : pixGridReactionSourceValue(input.audioFrame, definition.id);
      addUnique(
        available ? availableSources : unavailableSources,
        definition.id,
      );
      if (!available || confidence < 0.35)
        addUnique(degradedSources, definition.id);
      if (isPixGridContinuousReactionSource(definition.id))
        continuousSourceValues[definition.id] = value;
      else if (value > 0) addUnique(recentDiscreteTriggers, definition.id);
    }

    const activeCompiledAssignments: string[] = [];
    const disabledAssignments: string[] = [];
    const blockedByConditions: string[] = [];
    const blockedByConfidence: string[] = [];
    const assignmentsUsingFallback: string[] = [];
    const fallbackSources: PixGridReactionSource[] = [];
    const confidenceBlockedSources: PixGridReactionSource[] = [];
    const missingTargets: string[] = [];
    const compilationWarnings: string[] = [];
    const continuousAssignments: string[] = [];
    const discreteAssignments: string[] = [];
    const degradedSignals: string[] = [];

    for (const route of assignmentRoutes(cues.state)) {
      const capabilities =
        route.assignment.source === "trackMapCueEvent"
          ? { ...input.audioFrame.capabilities, trackMapCueEvent: cueTriggered }
          : input.audioFrame.capabilities;
      const compiled = this.assignmentCompiler.compile(
        route.assignment,
        capabilities,
        route.scope,
        route.routeId,
      );
      for (const warning of compiled.warnings)
        addUnique(compilationWarnings, `${route.routeId}: ${warning}`);
      if (!compiled.enabled) {
        addUnique(disabledAssignments, route.routeId);
        continue;
      }
      if (!routeTargetExists(route, cues.state)) {
        addUnique(missingTargets, route.routeId);
        addUnique(compilationWarnings, `${route.routeId}: missing target ${route.targetId}`);
        continue;
      }
      if (
        !evaluatePixGridCompiledConditions(compiled, input.audioFrame, {
          activeLayerIds,
          activeGroupIds,
        })
      ) {
        addUnique(blockedByConditions, route.routeId);
        continue;
      }
      const available =
        route.assignment.source === "trackMapCueEvent"
          ? cueTriggered
          : input.audioFrame.capabilities?.[route.assignment.source] !== false;
      const confidence =
        route.assignment.source === "trackMapCueEvent"
          ? cueTriggered
            ? 1
            : 0
          : (input.audioFrame.confidence?.[route.assignment.source] ??
            (available ? 1 : 0));
      const needsFallback =
        !available || confidence < compiled.minimumConfidence;
      if (needsFallback && compiled.capabilityFallback === "disable") {
        addUnique(blockedByConfidence, route.routeId);
        addUnique(confidenceBlockedSources, route.assignment.source);
        addUnique(degradedSignals, route.routeId);
        continue;
      }
      if (needsFallback) {
        addUnique(assignmentsUsingFallback, route.routeId);
        addUnique(fallbackSources, route.assignment.source);
        addUnique(degradedSignals, route.routeId);
      }
      addUnique(activeCompiledAssignments, route.routeId);
      if (isPixGridContinuousReactionSource(route.assignment.source))
        addUnique(continuousAssignments, route.displayId);
      else addUnique(discreteAssignments, route.displayId);
    }

    return {
      state: cues.state,
      groupEffects,
      transition,
      performance,
      cues,
      diagnostics: {
        enabledGroups: enabledGroups.map((group) => group.id),
        compiledMaskGroups,
        availableSources,
        unavailableSources,
        degradedSources,
        activeCompiledAssignments,
        disabledAssignments,
        assignmentsBlockedByConditions: blockedByConditions,
        assignmentsBlockedByConfidence: blockedByConfidence,
        assignmentsUsingFallback,
        fallbackSources,
        confidenceBlockedSources,
        missingTargets,
        continuousSourceValues,
        recentDiscreteTriggers,
        compilationWarnings,
        activeContinuousAssignments: continuousAssignments,
        activeDiscreteAssignments: discreteAssignments,
        activeEventEnvelopes: performance.snapshot.activeEventEnvelopes,
        activePerformanceActions: performance.snapshot.recentActionTypes,
        activeSectionPlan: performance.snapshot.activeSectionPlanId,
        activeVisualRoles: performance.snapshot.activeVisualRoles,
        resolvedProgramBanks: performance.snapshot.resolvedBanks,
        activeProgramContinuousRoutes:
          performance.snapshot.activeContinuousRoutes,
        activeProgramEventRoutes: performance.snapshot.activeEventRoutes,
        activeProgramMotif: performance.snapshot.currentFourBarMotif,
        activeProgramRecruitment:
          performance.snapshot.currentEightBarRecruitment,
        activeProgramEvolution: performance.snapshot.currentSixteenBarEvolution,
        fourBarStage: performance.snapshot.fourBarStage,
        eightBarStage: performance.snapshot.eightBarStage,
        sixteenBarStage: performance.snapshot.sixteenBarStage,
        sectionName: performance.snapshot.section,
        sectionPhase: performance.snapshot.sectionPhase,
        sectionOccurrence: performance.snapshot.sectionOccurrence,
        dropOccurrence: performance.snapshot.dropOccurrence,
        programBindingWarnings: [
          ...performance.snapshot.missingBindings,
          ...performance.snapshot.degradedBindings,
        ],
        manualOverridePrecedence: performance.snapshot.manualOverridePrecedence,
        programCompilerGeneration:
          this.performanceRuntime.programCompilationCount,
        cachedProgramCount: this.performanceRuntime.cachedProgramCount,
        activeCueActions: cues.snapshot.activeCueIds,
        activeGroupEffects: groupEffects.map(
          (effect) => `${effect.source}:${effect.groupId}:${effect.kind}`,
        ),
        activeTransitions: transition
          ? [`${transition.cueId}:${transition.type}`]
          : [],
        manualOverrides: cues.snapshot.manualOverrideRoutes,
        degradedSignals: [...new Set(degradedSignals)],
        compilerGeneration: this.assignmentCompiler.compilationCount,
        cachedAssignmentCount: this.assignmentCompiler.cachedAssignmentCount,
      },
    };
  }
}
