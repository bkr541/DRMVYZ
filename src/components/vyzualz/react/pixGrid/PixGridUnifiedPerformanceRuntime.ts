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
  type PixGridAudioIntelligenceRuntimeDiagnostics,
  type PixGridRouteActivity,
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
import { ensurePixGridRuntimeAudioRoutes } from "./PixGridStateMigration";

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
  stateSchemaVersion: number;
  presetConfigurationVersion: number;
  layerGraphVersion: number;
  smartGroupConfigurationVersion: number;
  audioRouteConfigurationVersion: number;
  performanceProgramConfigurationVersion: number;
  canonicalMigrationCompleted: boolean;
  migrationApplied: boolean;
  migrationDetectedPresetLineage: string;
  migrationCanonicalLayersAdded: readonly string[];
  migrationLegacyLayersMapped: readonly string[];
  migrationLegacyLayersPreservedAsOverlays: readonly string[];
  migrationSceneReferencesRepaired: number;
  migrationGroupsRepaired: readonly string[];
  migrationEmptyGroups: readonly string[];
  migrationMissingLayerGroups: readonly string[];
  migrationAssignmentsRepaired: readonly string[];
  migrationIneffectiveAssignments: readonly string[];
  migrationEffectiveLiveRouteCount: number;
  migrationSafeRecoveryUsed: boolean;
  migrationGroupsAdded: number;
  migrationGroupsPreserved: number;
  migrationGroupsUpgraded: number;
  migrationAssignmentsAdded: number;
  migrationAssignmentsPreserved: number;
  migrationAssignmentsUpgraded: number;
  migrationProgramsUpgraded: number;
  migrationCustomizationsPreserved: boolean;
  migrationConflicts: readonly string[];
  migrationSkippedUpgrades: readonly string[];
  activeAudioSourceCount: number;
  activeAssignmentCount: number;
  fallbackRoutesActive: boolean;
  effectiveBassReactivityGain: number;
  effectiveMotionMultiplier: number;
  affectedGroupCount: number;
  affectedCellCount: number;
  activeAffectedGroupIds: readonly string[];
  routeActivity: readonly PixGridRouteActivity[];
  currentEnvelopePhase: string;
  currentSceneId: string | null;
  audioInputStatus: 'active' | 'idle' | 'disconnected' | 'bus-fallback' | 'stale';
  analyserActive: boolean;
  sharedPerformanceCoreAvailable: boolean;
  aggregateSourceConfidence: number;
  stemAvailability: readonly PixGridReactionSource[];
  autonomousAnimationCount: number;
  beatSynchronizedAnimationCount: number;
  audioEnvelopeActionCount: number;
  performanceProgramActionCount: number;
  sceneTransitionActionCount: number;
  assignmentExecutionReasons: readonly string[];
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
      const scope = assignment.targetScope ?? "group";
      routes.push({
        assignment,
        routeId: `group:${group.id}:${assignment.id}`,
        displayId: `${group.id}:${assignment.id}`,
        scope,
        targetId: assignment.targetId?.trim() || (scope === "group" || scope === "pixels" ? group.id : null),
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

export function mergePixGridReactionRuntimeDiagnostics(
  base: PixGridUnifiedRuntimeDiagnostics,
  reaction: PixGridAudioIntelligenceRuntimeDiagnostics,
  state: PixGridState,
  groupCellCounts: ReadonlyMap<string, Readonly<{ compiled: number; visible: number }>> = new Map(),
  visibleFrameCellCount?: number,
): PixGridUnifiedRuntimeDiagnostics {
  const routeActivity = reaction.routeActivity.map(route => {
    const wholeFrame = route.targetScope !== 'group' && route.targetScope !== 'pixels'
    const compiledTargetCellCount = wholeFrame
      ? state.matrixWidth * state.matrixHeight
      : route.affectedGroupIds.reduce((sum, groupId) => {
        const group = state.groups.find(candidate => candidate.id === groupId)
        return sum + (groupCellCounts.get(groupId)?.compiled ?? (group
          ? compilePixGridGroupMask(group, state.matrixWidth, state.matrixHeight).cellCount
          : 0))
      }, 0)
    const visibleAffectedCellCount = wholeFrame
      ? visibleFrameCellCount ?? compiledTargetCellCount
      : route.affectedGroupIds.reduce((sum, groupId) => sum + (groupCellCounts.get(groupId)?.visible ?? 0), 0)
    const minimumCells = Math.max(4, Math.round(state.matrixWidth * state.matrixHeight * 0.0015))
    const expectedPerceptible = route.effectiveAmount >= 0.055 && visibleAffectedCellCount >= minimumCells
    const suppressionReason = route.state === 'disabled' || route.state === 'blocked'
      ? route.reason
      : visibleAffectedCellCount === 0
        ? 'compiled target contains no visible cells'
        : route.state === 'idle'
          ? route.reason
          : expectedPerceptible
            ? null
            : `effective amount or target coverage is below the perceptual floor (${minimumCells} cells minimum)`
    return { ...route, compiledTargetCellCount, visibleAffectedCellCount, expectedPerceptible, suppressionReason }
  })
  const activeRoutes = routeActivity.filter(route => route.state === 'active' || route.state === 'fallback')
  const affectedGroups = new Set<string>()
  let affectsWholeFrame = false
  for (const route of activeRoutes) {
    route.affectedGroupIds.forEach(groupId => affectedGroups.add(groupId))
    if (route.targetScope !== 'group' && route.targetScope !== 'pixels') affectsWholeFrame = true
  }
  const affectedCellCount = affectsWholeFrame
    ? state.matrixWidth * state.matrixHeight
    : state.groups.reduce((sum, group) => affectedGroups.has(group.id)
      ? sum + compilePixGridGroupMask(group, state.matrixWidth, state.matrixHeight).cellCount
      : sum, 0)
  const envelope = activeRoutes.find(route => route.envelopePhase !== 'continuous' && route.envelopePhase !== 'idle')?.envelopePhase
    ?? activeRoutes.find(route => route.envelopePhase === 'continuous')?.envelopePhase
    ?? 'idle'
  const reasons = reaction.routeActivity
    .filter(route => route.state !== 'active')
    .map(route => `${route.routeId}: ${route.reason}`)
  return {
    ...base,
    availableSources: reaction.availableSources,
    unavailableSources: reaction.unavailableSources,
    degradedSources: reaction.degradedSources,
    activeCompiledAssignments: reaction.activeCompiledAssignments,
    disabledAssignments: reaction.disabledAssignments,
    assignmentsBlockedByConditions: reaction.assignmentsBlockedByConditions,
    assignmentsBlockedByConfidence: reaction.assignmentsBlockedByConfidence,
    assignmentsUsingFallback: reaction.assignmentsUsingFallback,
    continuousSourceValues: reaction.continuousSourceValues,
    recentDiscreteTriggers: reaction.recentDiscreteTriggers,
    activeEventEnvelopes: reaction.activeEnvelopes,
    compilationWarnings: [...new Set([...base.compilationWarnings, ...reaction.compilationWarnings])],
    compilerGeneration: Math.max(base.compilerGeneration, reaction.compilerGeneration),
    cachedAssignmentCount: Math.max(base.cachedAssignmentCount, reaction.cachedAssignmentCount),
    activeAssignmentCount: activeRoutes.length,
    activeContinuousAssignments: activeRoutes.filter(route => route.envelopePhase === 'continuous').map(route => route.routeId),
    activeDiscreteAssignments: activeRoutes.filter(route => route.envelopePhase !== 'continuous').map(route => route.routeId),
    affectedGroupCount: affectedGroups.size,
    affectedCellCount,
    activeAffectedGroupIds: [...affectedGroups].sort(),
    routeActivity,
    currentEnvelopePhase: envelope,
    assignmentExecutionReasons: [...new Set([...base.assignmentExecutionReasons, ...reasons])],
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
    const runtimeRoutes = ensurePixGridRuntimeAudioRoutes(
      input.authoredState,
      input.audioFrame.capabilities,
    );
    const authoredState = runtimeRoutes.state;
    const performance = resolvePixGridPerformanceFrame(
      authoredState,
      input.context,
      input.presetId,
      {
        runtime: this.performanceRuntime,
        capabilities: input.audioFrame.capabilities,
        bassReactivityGain: input.audioFrame.bassReactivityGain,
        motionMultiplier: input.audioFrame.motionMultiplier,
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
    const compiledMasks = enabledGroups.map((group) => ({
      groupId: group.id,
      mask: compilePixGridGroupMask(
        group,
        cues.state.matrixWidth,
        cues.state.matrixHeight,
      ),
    }));
    const compiledMaskGroups = compiledMasks
      .filter(({ mask }) => mask.cellCount > 0)
      .map(({ groupId }) => groupId);
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
    const affectedGroupIds = new Set(
      groupEffects.map((effect) => effect.groupId).filter(Boolean),
    );
    let affectsWholeFrame = false;

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
      if ((route.scope === "group" || route.scope === "pixels") && route.targetId) {
        affectedGroupIds.add(route.targetId);
      } else {
        affectsWholeFrame = true;
      }
      if (isPixGridContinuousReactionSource(route.assignment.source))
        addUnique(continuousAssignments, route.displayId);
      else addUnique(discreteAssignments, route.displayId);
    }

    const migration = cues.state.configuration.lastMigration;
    const affectedCellCount = affectsWholeFrame
      ? cues.state.matrixWidth * cues.state.matrixHeight
      : compiledMasks.reduce(
          (sum, { groupId, mask }) => sum + (affectedGroupIds.has(groupId) ? mask.cellCount : 0),
          0,
        );
    const activeAudioSourceCount = Object.values(continuousSourceValues)
      .filter((value) => (value ?? 0) > 0.0001).length + recentDiscreteTriggers.length;
    const assignmentExecutionReasons = [
      ...disabledAssignments.map((route) => `${route}: disabled`),
      ...blockedByConditions.map((route) => `${route}: conditions not met`),
      ...blockedByConfidence.map((route) => `${route}: unavailable or below confidence threshold`),
      ...missingTargets.map((route) => `${route}: target missing`),
      ...assignmentsUsingFallback.map((route) => `${route}: capability fallback active`),
    ];

    return {
      state: cues.state,
      groupEffects,
      transition,
      performance,
      cues,
      diagnostics: {
        stateSchemaVersion: cues.state.version,
        presetConfigurationVersion: cues.state.configuration.presetConfigurationVersion,
        layerGraphVersion: cues.state.configuration.layerGraphVersion,
        smartGroupConfigurationVersion: cues.state.configuration.smartGroupConfigurationVersion,
        audioRouteConfigurationVersion: cues.state.configuration.audioRouteConfigurationVersion,
        performanceProgramConfigurationVersion: cues.state.configuration.performanceProgramConfigurationVersion,
        canonicalMigrationCompleted: cues.state.configuration.canonicalMigrationCompleted,
        migrationApplied: migration?.applied === true,
        migrationDetectedPresetLineage: migration?.detectedPresetLineage ?? 'unknown',
        migrationCanonicalLayersAdded: migration?.canonicalLayersAdded ?? [],
        migrationLegacyLayersMapped: migration?.legacyLayersMapped ?? [],
        migrationLegacyLayersPreservedAsOverlays: migration?.legacyLayersPreservedAsOverlays ?? [],
        migrationSceneReferencesRepaired: migration?.sceneReferencesRepaired ?? 0,
        migrationGroupsRepaired: migration?.groupsRepaired ?? [],
        migrationEmptyGroups: migration?.emptyGroups ?? [],
        migrationMissingLayerGroups: migration?.missingLayerGroups ?? [],
        migrationAssignmentsRepaired: migration?.assignmentsRepaired ?? [],
        migrationIneffectiveAssignments: migration?.ineffectiveAssignments ?? [],
        migrationEffectiveLiveRouteCount: migration?.effectiveLiveRouteCount ?? 0,
        migrationSafeRecoveryUsed: migration?.safeRecoveryUsed === true,
        migrationGroupsAdded: migration?.groupsAdded ?? 0,
        migrationGroupsPreserved: migration?.groupsPreserved ?? 0,
        migrationGroupsUpgraded: migration?.groupsUpgraded ?? 0,
        migrationAssignmentsAdded: migration?.assignmentsAdded ?? 0,
        migrationAssignmentsPreserved: migration?.assignmentsPreserved ?? 0,
        migrationAssignmentsUpgraded: migration?.assignmentsUpgraded ?? 0,
        migrationProgramsUpgraded: migration?.programsUpgraded ?? 0,
        migrationCustomizationsPreserved: migration?.customizationsPreserved ?? cues.state.configuration.userCustomized,
        migrationConflicts: migration?.conflicts ?? [],
        migrationSkippedUpgrades: migration?.skippedUpgrades ?? [],
        activeAudioSourceCount,
        activeAssignmentCount: activeCompiledAssignments.length,
        fallbackRoutesActive: runtimeRoutes.fallbackActive,
        effectiveBassReactivityGain: input.audioFrame.bassReactivityGain ?? 1,
        effectiveMotionMultiplier: input.audioFrame.motionMultiplier ?? 1,
        affectedGroupCount: affectedGroupIds.size,
        affectedCellCount,
        activeAffectedGroupIds: [...affectedGroupIds].sort(),
        routeActivity: [],
        currentEnvelopePhase: performance.snapshot.activeEventEnvelopes.length ? 'program' : 'idle',
        currentSceneId: cues.state.selectedSceneId,
        audioInputStatus: input.audioFrame.analyserConnected === false && input.audioFrame.inputSource === 'neutral'
          ? 'disconnected'
          : input.audioFrame.inputSource === 'shared-bus'
            ? 'bus-fallback'
            : input.audioFrame.analyserActive || activeAudioSourceCount > 0
              ? 'active'
              : input.audioFrame.inputFrameAgeMs != null && input.audioFrame.inputFrameAgeMs > 250
                ? 'stale'
                : 'idle',
        analyserActive: input.audioFrame.analyserActive === true,
        sharedPerformanceCoreAvailable: input.audioFrame.sharedPerformanceCoreAvailable !== false,
        aggregateSourceConfidence: input.audioFrame.aggregateSourceConfidence ?? 0,
        stemAvailability: input.audioFrame.stemAvailability ?? [],
        autonomousAnimationCount: cues.state.layers.reduce((count, layer) => count + layer.animations.filter(animation => animation.clock !== 'beat' && animation.clock !== 'cue' && !animation.audioSource).length, 0),
        beatSynchronizedAnimationCount: cues.state.layers.reduce((count, layer) => count + layer.animations.filter(animation => animation.clock === 'beat' || animation.clock === 'cue').length, 0),
        audioEnvelopeActionCount: performance.snapshot.activeEventEnvelopes.length,
        performanceProgramActionCount: performance.snapshot.recentActionTypes.length,
        sceneTransitionActionCount: transition ? 1 : 0,
        assignmentExecutionReasons,
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
