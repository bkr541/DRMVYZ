import type {
  SharedPerformanceContext,
  SharedPerformanceProgram,
  SharedPerformanceProgramScene,
} from "../../../../features/performanceCore";
import { getPixGridAudioIntelligenceSource } from "./PixGridAudioIntelligenceRegistry";
import { PixGridAssignmentCompiler } from "./PixGridAssignmentCompiler";
import type {
  PixGridContinuousRoutePlan,
  PixGridEventRoutePlan,
  PixGridGroupRecruitmentPlan,
  PixGridLayerRecruitmentPlan,
  PixGridMusicalArcKind,
  PixGridPerformanceAction,
  PixGridPerformanceArcState,
  PixGridPerformanceProgram,
  PixGridProgramBank,
  PixGridProgramRoleBinding,
  PixGridProgramRouteConditions,
  PixGridProgramRouteTarget,
  PixGridProgramTargetReference,
  PixGridSectionPlan,
  PixGridVisualRole,
} from "./PixGridPerformanceTypes";
import type {
  PixGridReactionAssignment,
  PixGridReactionCapabilityFallback,
  PixGridReactionSource,
  PixGridReactionTargetScope,
  PixGridState,
} from "./PixGridTypes";

export type PixGridProgramValidationSeverity = "error" | "warning" | "info";
export interface PixGridProgramValidationIssue {
  severity: PixGridProgramValidationSeverity;
  code: string;
  message: string;
  programId: string;
  path?: string;
}

export interface PixGridResolvedBank {
  id: string;
  targets: readonly PixGridProgramTargetReference[];
  degraded: boolean;
}

export interface PixGridCompiledPerformanceProgram {
  program: PixGridPerformanceProgram;
  sharedProgram: SharedPerformanceProgram<PixGridPerformanceAction>;
  assignments: readonly PixGridReactionAssignment[];
  resolvedBindings: readonly PixGridProgramRoleBinding[];
  resolvedBanks: readonly PixGridResolvedBank[];
  missingBindings: readonly string[];
  degradedBindings: readonly string[];
  validationIssues: readonly PixGridProgramValidationIssue[];
  compilationWarnings: readonly string[];
  signature: string;
}

const DEFAULT_ARC_STATE: PixGridPerformanceArcState = Object.freeze({
  density: 0.65,
  paletteIntensity: 0.7,
  motion: 0.7,
  contrast: 0.7,
  negativeSpace: 0.35,
  recruitment: 0.6,
  impactStrength: 0.8,
  sparkleDetail: 0.5,
  backgroundActivity: 0.35,
});

const ARC_KINDS: readonly PixGridMusicalArcKind[] = [
  "density",
  "paletteIntensity",
  "motion",
  "contrast",
  "negativeSpace",
  "recruitment",
  "impactStrength",
  "sparkleDetail",
  "backgroundActivity",
];

const TRANSITION_TYPES = new Set([
  "cut",
  "crossfade",
  "rowWipe",
  "columnWipe",
  "checkerWipe",
  "pixelDissolve",
  "radialReveal",
  "paletteFade",
  "powerOn",
  "powerOff",
  "fade",
  "wipeRows",
  "wipeColumns",
  "dissolve",
]);

const EVENT_SOURCES = new Set<PixGridReactionSource>([
  "beat",
  "downbeat",
  "kick",
  "snare",
  "hat",
  "transient",
  "barEntry",
  "fourBarBoundary",
  "eightBarBoundary",
  "sixteenBarBoundary",
  "phraseEntry",
  "sectionEntry",
  "sectionExit",
  "dropImpact",
  "dropOccurrenceChange",
  "semanticMoment",
  "trackMapCueEvent",
]);

function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function targetExists(
  state: PixGridState,
  target: PixGridProgramTargetReference,
): boolean {
  if (target.kind === "scene")
    return state.scenes.some((scene) => scene.id === target.id);
  if (target.kind === "layer")
    return state.layers.some((layer) => layer.id === target.id);
  return state.groups.some((group) => group.id === target.id);
}

function targetScope(
  target: PixGridProgramTargetReference,
): PixGridReactionTargetScope {
  if (target.kind === "layer") return "layer";
  if (target.kind === "group") return "group";
  return "scene";
}

function uniqueByTarget(
  targets: readonly PixGridProgramTargetReference[],
): PixGridProgramTargetReference[] {
  const seen = new Set<string>();
  return targets.filter((target) => {
    const key = `${target.kind}:${target.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function resolveBinding(
  binding: PixGridProgramRoleBinding,
  state: PixGridState,
): {
  binding: PixGridProgramRoleBinding | null;
  degraded: boolean;
  missing: string | null;
} {
  if (targetExists(state, binding.target))
    return { binding, degraded: false, missing: null };
  if (binding.fallback && targetExists(state, binding.fallback)) {
    return {
      binding: { ...binding, target: binding.fallback },
      degraded: true,
      missing: `${binding.id}:${binding.target.kind}:${binding.target.id}`,
    };
  }
  return {
    binding: null,
    degraded: false,
    missing: `${binding.id}:${binding.target.kind}:${binding.target.id}`,
  };
}

function resolveBank(
  bank: PixGridProgramBank,
  state: PixGridState,
): PixGridResolvedBank {
  const primary = uniqueByTarget(
    bank.members.filter((target) => targetExists(state, target)),
  );
  if (primary.length > 0)
    return {
      id: bank.id,
      targets: primary,
      degraded: primary.length !== bank.members.length,
    };
  const fallback = uniqueByTarget(
    (bank.fallbackMembers ?? []).filter((target) =>
      targetExists(state, target),
    ),
  );
  return {
    id: bank.id,
    targets: fallback,
    degraded: fallback.length > 0 || bank.members.length > 0,
  };
}

function conditionIntersection(
  route: PixGridProgramRouteConditions | undefined,
  plan: PixGridSectionPlan,
  occurrence?: number,
): PixGridReactionAssignment["conditions"] {
  const planPhases = plan.sectionPhases?.filter((phase) => phase !== "none") as
    Array<"entry" | "body" | "exit"> | undefined;
  return {
    includeSectionTypes: [
      ...new Set([...(route?.sectionTypes ?? plan.sectionTypes)]),
    ],
    ...(route?.excludeSectionTypes?.length
      ? { excludeSectionTypes: [...route.excludeSectionTypes] }
      : {}),
    ...(route?.sectionPhases?.length || planPhases?.length
      ? {
          sectionPhases: [...new Set(route?.sectionPhases ?? planPhases ?? [])],
        }
      : {}),
    ...(occurrence != null ||
    route?.sectionOccurrences?.length ||
    plan.occurrence?.occurrences?.length
      ? {
          sectionOccurrences:
            occurrence != null
              ? [occurrence]
              : [
                  ...new Set(
                    route?.sectionOccurrences ??
                      plan.occurrence?.occurrences ??
                      [],
                  ),
                ],
        }
      : {}),
    ...(route?.dropOccurrences?.length ||
    plan.dropOccurrence?.occurrences?.length
      ? {
          dropOccurrences: [
            ...new Set(
              route?.dropOccurrences ?? plan.dropOccurrence?.occurrences ?? [],
            ),
          ],
        }
      : {}),
    ...(route?.minimumEnergy != null
      ? { minimumEnergy: route.minimumEnergy }
      : {}),
    ...(route?.maximumEnergy != null
      ? { maximumEnergy: route.maximumEnergy }
      : {}),
    autoPerformanceOnly: true,
  };
}

function targetsForRoute(
  target: PixGridProgramRouteTarget,
  bindings: readonly PixGridProgramRoleBinding[],
  banks: readonly PixGridResolvedBank[],
  state: PixGridState,
): Array<{
  scope: PixGridReactionTargetScope;
  targetId: string | null;
  identity: string;
}> {
  if ("scope" in target)
    return [{ scope: target.scope, targetId: null, identity: target.scope }];
  if ("target" in target)
    return targetExists(state, target.target)
      ? [
          {
            scope: targetScope(target.target),
            targetId: target.target.id,
            identity: `${target.target.kind}:${target.target.id}`,
          },
        ]
      : [];
  if ("role" in target) {
    return bindings
      .filter((binding) => binding.roles.includes(target.role))
      .map((binding) => ({
        scope: targetScope(binding.target),
        targetId: binding.target.id,
        identity: `role:${target.role}:${binding.target.id}`,
      }));
  }
  const bank = banks.find((candidate) => candidate.id === target.bankId);
  return (bank?.targets ?? []).map((member) => ({
    scope: targetScope(member),
    targetId: member.id,
    identity: `bank:${target.bankId}:${member.id}`,
  }));
}

function routeFallback(
  source: PixGridReactionSource,
  fallback?: PixGridReactionCapabilityFallback,
): PixGridReactionCapabilityFallback {
  return (
    fallback ?? getPixGridAudioIntelligenceSource(source).capabilityFallback
  );
}

interface PixGridRouteOccurrenceVariant {
  occurrence: number;
  amountScale: number;
  seedOffset: number;
}

function occurrenceVariants(
  route: PixGridContinuousRoutePlan,
  plan: PixGridSectionPlan,
): readonly PixGridRouteOccurrenceVariant[] | null {
  const variation = route.occurrenceVariation;
  if (!variation) return null;
  const explicit =
    route.conditions?.sectionOccurrences ?? plan.occurrence?.occurrences;
  const maximum = Math.max(
    1,
    Math.min(16, Math.round(variation.maxOccurrences ?? 8)),
  );
  const occurrences = explicit?.length
    ? [...new Set(explicit.filter((value) => value > 0))]
    : Array.from({ length: maximum }, (_, index) => index + 1);
  const every = Math.max(1, Math.round(variation.every ?? 1));
  return occurrences.map((occurrence) => {
    const varied = occurrence % every === 0;
    return {
      occurrence,
      amountScale: varied ? (variation.amountScale ?? 1) : 1,
      seedOffset: varied ? (variation.seedOffset ?? 0) * occurrence : 0,
    };
  });
}

function assignmentForContinuous(
  route: PixGridContinuousRoutePlan,
  plan: PixGridSectionPlan,
  target: {
    scope: PixGridReactionTargetScope;
    targetId: string | null;
    identity: string;
  },
  intensity: number,
  occurrenceVariant?: PixGridRouteOccurrenceVariant,
): PixGridReactionAssignment {
  return {
    id: `program:${plan.id}:${route.id}:${target.identity}${
      occurrenceVariant ? `:occurrence:${occurrenceVariant.occurrence}` : ""
    }`,
    name: `${plan.id} · ${route.id}`,
    enabled: true,
    source: route.source,
    target: route.operation,
    targetScope: target.scope,
    targetId: target.targetId,
    amount:
      route.amount *
      (route.intensityScale ?? 1) *
      intensity *
      (occurrenceVariant?.amountScale ?? 1),
    polarity: route.polarity ?? "positive",
    invert: route.polarity === "negative",
    inputRange: route.inputRange ?? [0, 1],
    outputRange: route.outputRange ?? [0, 1],
    curve: route.curve ?? "linear",
    threshold: route.threshold ?? 0,
    hysteresis: route.hysteresis ?? 0,
    attack: route.attack ?? 0.03,
    hold: route.hold ?? 0,
    release: route.release ?? 0.12,
    cooldown: route.cooldown ?? 0,
    bassReactivityEnabled: route.bassReactivityEnabled !== false,
    decayCurve: "easeOut",
    smoothing: route.smoothing ?? 0.08,
    quantization: "none",
    retrigger: "restart",
    maximumStacking: 1,
    minimumConfidence: route.minimumConfidence ?? 0,
    capabilityFallback: routeFallback(route.source, route.capabilityFallback),
    conditions: conditionIntersection(
      route.conditions,
      plan,
      occurrenceVariant?.occurrence,
    ),
    priority: route.priority ?? -200,
    eventPriority: 0,
    clamp: route.clamp ?? [0, 1],
    blend: route.blend ?? "add",
    ...(route.paletteRole ? { paletteRole: route.paletteRole } : {}),
    ...(route.color ? { color: route.color } : {}),
    seedOffset: occurrenceVariant?.seedOffset ?? 0,
  };
}

function assignmentForEvent(
  route: PixGridEventRoutePlan,
  plan: PixGridSectionPlan,
  target: {
    scope: PixGridReactionTargetScope;
    targetId: string | null;
    identity: string;
  },
  intensity: number,
): PixGridReactionAssignment {
  return {
    id: `program:${plan.id}:${route.id}:${target.identity}`,
    name: `${plan.id} · ${route.id}`,
    enabled: true,
    source: route.event,
    target: route.operation,
    targetScope: target.scope,
    targetId: target.targetId,
    amount: route.amount * (route.intensityScale ?? 1) * intensity,
    polarity: "positive",
    invert: false,
    inputRange: route.inputRange ?? [0, 1],
    outputRange: route.outputRange ?? [0, 1],
    curve: "gate",
    threshold: route.threshold ?? 0.01,
    hysteresis: route.hysteresis ?? 0,
    attack: route.envelope.attack,
    hold: route.envelope.hold,
    release: route.envelope.release,
    cooldown: route.cooldown ?? 0,
    bassReactivityEnabled: route.bassReactivityEnabled !== false,
    decayCurve:
      route.envelope.curve === "step"
        ? "step"
        : (route.envelope.curve ?? "easeOut"),
    smoothing: route.smoothing ?? 0,
    quantization: route.quantization ?? "none",
    retrigger: route.retrigger ?? "restart",
    maximumStacking: route.maximumStacking ?? 1,
    minimumConfidence: route.minimumConfidence ?? 0,
    capabilityFallback: routeFallback(route.event, route.capabilityFallback),
    conditions: conditionIntersection(route.conditions, plan),
    priority: route.priority ?? -120,
    eventPriority: route.priority ?? 0,
    clamp: route.clamp ?? [0, 1],
    blend: route.blend ?? "add",
    ...(route.paletteRole ? { paletteRole: route.paletteRole } : {}),
    ...(route.color ? { color: route.color } : {}),
    seedOffset: 0,
  };
}

function inferredScenePreference(plan: PixGridSectionPlan): readonly string[] {
  if (plan.scenePreference?.length) return plan.scenePreference;
  const scene = plan.actions?.find(
    (
      action,
    ): action is Extract<PixGridPerformanceAction, { type: "setScene" }> =>
      action.type === "setScene",
  );
  return scene ? [scene.sceneId] : [];
}

function transitionAction(
  transition:
    PixGridSectionPlan["transitionIn"] | PixGridSectionPlan["transitionOut"],
): PixGridPerformanceAction | null {
  return transition
    ? {
        type: "setTransition",
        transition: transition.type,
        durationBeats: transition.durationBeats,
      }
    : null;
}

function planTransitionIn(
  plan: PixGridSectionPlan,
): PixGridPerformanceAction | null {
  return (
    plan.actions?.find(
      (
        action,
      ): action is Extract<
        PixGridPerformanceAction,
        { type: "setTransition" }
      > => action.type === "setTransition",
    ) ?? transitionAction(plan.transitionIn)
  );
}

function resolveScenePreference(
  plan: PixGridSectionPlan,
  state: PixGridState,
  missingBindings: string[],
  degradedBindings: string[],
): string | null {
  const preferences = inferredScenePreference(plan);
  if (!preferences.length) return null;
  const index = preferences.findIndex((id) =>
    state.scenes.some((scene) => scene.id === id),
  );
  if (index < 0) {
    missingBindings.push(`section:${plan.id}:scene:${preferences.join("|")}`);
    return null;
  }
  if (index > 0)
    degradedBindings.push(`section:${plan.id}:scene:${preferences[0]}`);
  return preferences[index];
}

function resolveLayerRecruitment(
  recruitment: PixGridLayerRecruitmentPlan,
  plan: PixGridSectionPlan,
  state: PixGridState,
  missingBindings: string[],
  degradedBindings: string[],
): PixGridPerformanceAction | null {
  const primaryExists = state.layers.some(
    (layer) => layer.id === recruitment.layerId,
  );
  const fallbackExists = recruitment.fallbackLayerId
    ? state.layers.some((layer) => layer.id === recruitment.fallbackLayerId)
    : false;
  const layerId = primaryExists
    ? recruitment.layerId
    : fallbackExists
      ? recruitment.fallbackLayerId!
      : null;
  if (!layerId) {
    missingBindings.push(
      `section:${plan.id}:layer-recruitment:${recruitment.layerId}`,
    );
    return null;
  }
  if (!primaryExists)
    degradedBindings.push(
      `section:${plan.id}:layer-recruitment:${recruitment.layerId}`,
    );
  return { type: "recruitLayer", layerId, opacity: recruitment.opacity };
}

function resolveGroupRecruitment(
  recruitment: PixGridGroupRecruitmentPlan,
  plan: PixGridSectionPlan,
  state: PixGridState,
  missingBindings: string[],
  degradedBindings: string[],
): PixGridPerformanceAction[] {
  const primaryExists = state.groups.some(
    (group) => group.id === recruitment.groupId,
  );
  const fallbackExists = recruitment.fallbackGroupId
    ? state.groups.some((group) => group.id === recruitment.fallbackGroupId)
    : false;
  const groupId = primaryExists
    ? recruitment.groupId
    : fallbackExists
      ? recruitment.fallbackGroupId!
      : null;
  if (!groupId) {
    missingBindings.push(
      `section:${plan.id}:group-recruitment:${recruitment.groupId}`,
    );
    return [];
  }
  if (!primaryExists)
    degradedBindings.push(
      `section:${plan.id}:group-recruitment:${recruitment.groupId}`,
    );
  const actions: PixGridPerformanceAction[] = [
    { type: "setGroupActive", groupId, active: recruitment.active ?? true },
  ];
  if (recruitment.brightness != null)
    actions.push({
      type: "setGroupBrightness",
      groupId,
      brightness: recruitment.brightness,
    });
  return actions;
}

interface ResolvedSectionRecruitment {
  entry: readonly PixGridPerformanceAction[];
  body: readonly PixGridPerformanceAction[];
  eightBar: readonly (readonly PixGridPerformanceAction[])[];
}

function resolveSectionRecruitment(
  plan: PixGridSectionPlan,
  state: PixGridState,
  missingBindings: string[],
  degradedBindings: string[],
): ResolvedSectionRecruitment {
  const entry: PixGridPerformanceAction[] = [];
  const body: PixGridPerformanceAction[] = [];
  const eightBar = (plan.eightBarRecruitment ?? []).map((actions) => [
    ...actions,
  ]);
  const append = (
    stage:
      | PixGridLayerRecruitmentPlan["stage"]
      | PixGridGroupRecruitmentPlan["stage"],
    actions: readonly PixGridPerformanceAction[],
  ) => {
    if (!actions.length) return;
    if (stage === "entry") entry.push(...actions);
    else if (stage === "body") body.push(...actions);
    else {
      const index = Math.max(
        0,
        Number(stage?.replace("eightBar", "") || 1) - 1,
      );
      while (eightBar.length <= index) eightBar.push([]);
      eightBar[index].push(...actions);
    }
  };
  for (const recruitment of plan.layerRecruitment ?? []) {
    const action = resolveLayerRecruitment(
      recruitment,
      plan,
      state,
      missingBindings,
      degradedBindings,
    );
    if (action) append(recruitment.stage ?? "eightBar1", [action]);
  }
  for (const recruitment of plan.groupRecruitment ?? []) {
    append(
      recruitment.stage ?? "eightBar1",
      resolveGroupRecruitment(
        recruitment,
        plan,
        state,
        missingBindings,
        degradedBindings,
      ),
    );
  }
  return { entry, body, eightBar };
}

function actionReferences(
  action: PixGridPerformanceAction,
): readonly PixGridProgramTargetReference[] {
  switch (action.type) {
    case "setScene":
      return [{ kind: "scene", id: action.sceneId }];
    case "setLayerActive":
    case "setLayerOpacity":
    case "recruitLayer":
    case "changeAnimation":
      return [{ kind: "layer", id: action.layerId }];
    case "setGroupActive":
    case "setGroupBrightness":
    case "flashGroup":
    case "dissolveGroup":
    case "shiftGroup":
      return [{ kind: "group", id: action.groupId }];
    case "setPaletteRole":
    case "revealRows":
    case "revealColumns":
    case "changeAnimationSpeed":
    case "reverseDirection":
    case "triggerFrame":
      return action.target === "all"
        ? []
        : "layerId" in action.target
          ? [{ kind: "layer", id: action.target.layerId }]
          : [{ kind: "group", id: action.target.groupId }];
    default:
      return [];
  }
}

function safeActions(
  actions: readonly PixGridPerformanceAction[] | undefined,
  state: PixGridState,
): readonly PixGridPerformanceAction[] {
  return (actions ?? []).filter((action) =>
    actionReferences(action).every((target) => targetExists(state, target)),
  );
}

function planActions(
  plan: PixGridSectionPlan,
): readonly PixGridPerformanceAction[] {
  return [
    ...(plan.actions ?? []),
    ...(plan.entryActions ?? []),
    ...(plan.bodyActions ?? []),
    ...(plan.exitActions ?? []),
    ...(plan.fourBarActions?.flatMap((actions) => actions) ?? []),
    ...(plan.eightBarRecruitment?.flatMap((actions) => actions) ?? []),
    ...(plan.sixteenBarEvolution?.flatMap((actions) => actions) ?? []),
    ...(plan.variations?.flatMap((variation) => variation.actions) ?? []),
    ...Object.values(plan.eventActions ?? {}).flatMap(
      (actions) => actions ?? [],
    ),
  ];
}

function reportMissingActionTargets(
  plan: PixGridSectionPlan,
  state: PixGridState,
  missingBindings: string[],
): void {
  for (const action of planActions(plan)) {
    if (action.type === "setScene") continue;
    for (const target of actionReferences(action))
      if (!targetExists(state, target))
        missingBindings.push(
          `section:${plan.id}:action:${target.kind}:${target.id}`,
        );
  }
}

function sceneActions(
  plan: PixGridSectionPlan,
  state: PixGridState,
  resolvedSceneId: string | null,
): readonly PixGridPerformanceAction[] {
  const actions: PixGridPerformanceAction[] = safeActions(
    plan.actions,
    state,
  ).filter(
    (action) => action.type !== "setTransition" && action.type !== "setScene",
  );
  if (resolvedSceneId)
    actions.unshift({ type: "setScene", sceneId: resolvedSceneId });
  if (
    plan.densityState &&
    !actions.some((action) => action.type === "setDensity")
  )
    actions.push({ type: "setDensity", density: plan.densityState.value });
  if (
    plan.backgroundState &&
    !actions.some((action) => action.type === "setBackgroundState")
  ) {
    actions.push({
      type: "setBackgroundState",
      state: plan.backgroundState.state,
      brightness: plan.backgroundState.brightness,
    });
  }
  if (
    plan.motionState &&
    !actions.some((action) => action.type === "changeAnimationSpeed")
  ) {
    actions.push({
      type: "changeAnimationSpeed",
      target: "all",
      multiplier: plan.motionState.amount,
    });
  }
  if (
    plan.paletteState?.primaryRole &&
    !actions.some((action) => action.type === "setPaletteRole")
  ) {
    actions.push({
      type: "setPaletteRole",
      target: "all",
      role: plan.paletteState.primaryRole,
    });
  }
  return actions;
}

function sharedScene(
  plan: PixGridSectionPlan,
  state: PixGridState,
  resolvedSceneId: string | null,
  recruitment: ResolvedSectionRecruitment,
): SharedPerformanceProgramScene<PixGridPerformanceAction> {
  const entryTransition = planTransitionIn(plan);
  const exitTransition = transitionAction(plan.transitionOut);
  return {
    id: plan.id,
    sectionTypes: plan.sectionTypes,
    sectionFamilies: plan.sectionFamilies,
    occurrence: plan.occurrence,
    dropOccurrence: plan.dropOccurrence,
    minConfidence: plan.minConfidence,
    priority: plan.priority,
    sectionPhases: plan.sectionPhases,
    actions: sceneActions(plan, state, resolvedSceneId),
    entryActions: [
      ...(entryTransition ? [entryTransition] : []),
      ...safeActions(plan.entryActions, state),
      ...recruitment.entry,
    ],
    bodyActions: [...safeActions(plan.bodyActions, state), ...recruitment.body],
    exitActions: [
      ...safeActions(plan.exitActions, state),
      ...(exitTransition &&
      !plan.exitActions?.some((action) => action.type === "setTransition")
        ? [exitTransition]
        : []),
    ],
    fourBarActions: plan.fourBarActions?.map((actions) =>
      safeActions(actions, state),
    ),
    eightBarRecruitment: recruitment.eightBar.map((actions) =>
      safeActions(actions, state),
    ),
    sixteenBarEvolution: plan.sixteenBarEvolution?.map((actions) =>
      safeActions(actions, state),
    ),
    eventActions: Object.fromEntries(
      Object.entries(plan.eventActions ?? {}).map(([event, actions]) => [
        event,
        safeActions(actions, state),
      ]),
    ),
    variations: plan.variations?.map((variation) => ({
      ...variation,
      actions: safeActions(variation.actions, state),
    })),
  };
}

function overriddenRouteTarget(
  original: PixGridProgramRouteTarget,
  override: PixGridState['performance']['programOverrides']['routes'][string] | undefined,
): PixGridProgramRouteTarget {
  const scope = override?.targetScope
  if (!scope) return original
  if (scope === 'output' || scope === 'background' || scope === 'transition' || scope === 'palette') return { scope }
  if (scope === 'scene' || scope === 'layer' || scope === 'group') return { target: { kind: scope, id: override.targetId ?? '' } }
  return original
}

function overriddenRouteConditions(
  original: PixGridProgramRouteConditions | undefined,
  override: PixGridState['performance']['programOverrides']['routes'][string] | undefined,
): PixGridProgramRouteConditions | undefined {
  const hasOverride = override?.sectionTypes != null
    || override?.excludeSectionTypes != null
    || override?.sectionPhases != null
    || override?.sectionOccurrences != null
    || override?.dropOccurrences != null
    || override?.minimumEnergy != null
    || override?.maximumEnergy != null
  if (!hasOverride) return original
  return {
    ...(original ?? {}),
    ...(override?.sectionTypes != null ? { sectionTypes: override.sectionTypes } : {}),
    ...(override?.excludeSectionTypes != null ? { excludeSectionTypes: override.excludeSectionTypes } : {}),
    ...(override?.sectionPhases != null ? { sectionPhases: override.sectionPhases } : {}),
    ...(override?.sectionOccurrences != null ? { sectionOccurrences: override.sectionOccurrences } : {}),
    ...(override?.dropOccurrences != null ? { dropOccurrences: override.dropOccurrences } : {}),
    ...(override?.minimumEnergy != null ? { minimumEnergy: override.minimumEnergy } : {}),
    ...(override?.maximumEnergy != null ? { maximumEnergy: override.maximumEnergy } : {}),
  }
}

function effectivePixGridProgram(
  program: PixGridPerformanceProgram,
  state: PixGridState,
): PixGridPerformanceProgram {
  const overrides = state.performance.programOverrides
  const continuousRoutes = program.continuousRoutes.flatMap((route) => {
    const override = overrides.routes[route.id]
    if (override?.enabled === false) return []
    const conditions = overriddenRouteConditions(route.conditions, override)
    return [{
      ...route,
      target: overriddenRouteTarget(route.target, override),
      ...(override?.source ? { source: override.source } : {}),
      ...(override?.operation ? { operation: override.operation } : {}),
      ...(override?.amount != null ? { amount: override.amount } : {}),
      ...(override?.priority != null ? { priority: override.priority } : {}),
      ...(override?.inputRange ? { inputRange: override.inputRange } : {}),
      ...(override?.outputRange ? { outputRange: override.outputRange } : {}),
      ...(override?.polarity ? { polarity: override.polarity } : {}),
      ...(override?.curve ? { curve: override.curve } : {}),
      ...(override?.smoothing != null ? { smoothing: override.smoothing } : {}),
      ...(override?.threshold != null ? { threshold: override.threshold } : {}),
      ...(override?.hysteresis != null ? { hysteresis: override.hysteresis } : {}),
      ...(override?.attack != null ? { attack: override.attack } : {}),
      ...(override?.hold != null ? { hold: override.hold } : {}),
      ...(override?.release != null ? { release: override.release } : {}),
      ...(override?.cooldown != null ? { cooldown: override.cooldown } : {}),
      ...(override?.bassReactivityEnabled != null ? { bassReactivityEnabled: override.bassReactivityEnabled } : {}),
      ...(override?.minimumConfidence != null ? { minimumConfidence: override.minimumConfidence } : {}),
      ...(override?.capabilityFallback ? { capabilityFallback: override.capabilityFallback } : {}),
      ...(override?.blend ? { blend: override.blend } : {}),
      ...(conditions ? { conditions } : {}),
    }]
  })
  const eventRoutes = program.eventRoutes.flatMap((route) => {
    const override = overrides.routes[route.id]
    if (override?.enabled === false) return []
    const conditions = overriddenRouteConditions(route.conditions, override)
    return [{
      ...route,
      target: overriddenRouteTarget(route.target, override),
      ...(override?.source ? { event: override.source } : {}),
      ...(override?.operation ? { operation: override.operation } : {}),
      ...(override?.amount != null ? { amount: override.amount } : {}),
      ...(override?.priority != null ? { priority: override.priority } : {}),
      ...(override?.inputRange ? { inputRange: override.inputRange } : {}),
      ...(override?.outputRange ? { outputRange: override.outputRange } : {}),
      ...(override?.threshold != null ? { threshold: override.threshold } : {}),
      ...(override?.hysteresis != null ? { hysteresis: override.hysteresis } : {}),
      ...(override?.smoothing != null ? { smoothing: override.smoothing } : {}),
      ...(override?.attack != null || override?.hold != null || override?.release != null || override?.decayCurve
        ? { envelope: {
            ...route.envelope,
            ...(override.attack != null ? { attack: override.attack } : {}),
            ...(override.hold != null ? { hold: override.hold } : {}),
            ...(override.release != null ? { release: override.release } : {}),
            ...(override.decayCurve ? { curve: override.decayCurve } : {}),
          } }
        : {}),
      ...(override?.quantization ? { quantization: override.quantization } : {}),
      ...(override?.retrigger ? { retrigger: override.retrigger } : {}),
      ...(override?.cooldown != null ? { cooldown: override.cooldown } : {}),
      ...(override?.bassReactivityEnabled != null ? { bassReactivityEnabled: override.bassReactivityEnabled } : {}),
      ...(override?.minimumConfidence != null ? { minimumConfidence: override.minimumConfidence } : {}),
      ...(override?.capabilityFallback ? { capabilityFallback: override.capabilityFallback } : {}),
      ...(override?.blend ? { blend: override.blend } : {}),
      ...(conditions ? { conditions } : {}),
    }]
  })
  const sectionPlans = program.sectionPlans.flatMap((plan) => {
    const override = overrides.sections[plan.id]
    if (override?.enabled === false) return []
    return [{
      ...plan,
      ...(override?.density != null ? { densityState: { ...(plan.densityState ?? { value: override.density }), value: override.density } } : {}),
      ...(override?.motion != null ? { motionState: { ...(plan.motionState ?? { amount: override.motion }), amount: override.motion } } : {}),
      ...(override?.paletteIntensity != null ? { paletteState: { ...(plan.paletteState ?? { intensity: override.paletteIntensity }), intensity: override.paletteIntensity } } : {}),
      ...(override?.negativeSpace != null ? { negativeSpaceTarget: override.negativeSpace } : {}),
      ...(override?.fourBarEnabled === false ? { fourBarActions: [] } : {}),
      ...(override?.eightBarEnabled === false ? { eightBarRecruitment: [] } : {}),
      ...(override?.sixteenBarEnabled === false ? { sixteenBarEvolution: [] } : {}),
      ...(override?.transitionIn ? { transitionIn: { ...(plan.transitionIn ?? {}), type: override.transitionIn } } : {}),
      ...(override?.transitionOut ? { transitionOut: { ...(plan.transitionOut ?? {}), type: override.transitionOut } } : {}),
    }]
  })
  return {
    ...program,
    continuousRoutes,
    eventRoutes,
    sectionPlans: sectionPlans.length ? sectionPlans : program.sectionPlans,
  }
}

function programSignature(
  state: PixGridState,
  capabilities: Partial<Record<PixGridReactionSource, boolean>>,
): string {
  return JSON.stringify({
    presetId: state.selectedPresetId,
    scenes: state.scenes.map((scene) => [scene.id, scene.layerIds]),
    layers: state.layers.map((layer) => layer.id),
    groups: state.groups.map((group) => [
      group.id,
      group.layerId,
      group.layerScope,
    ]),
    programOverrides: state.performance.programOverrides,
    capabilities: Object.keys(capabilities)
      .sort()
      .map((key) => [
        key,
        capabilities[key as PixGridReactionSource] !== false,
      ]),
  });
}

function issue(
  program: PixGridPerformanceProgram,
  severity: PixGridProgramValidationSeverity,
  code: string,
  message: string,
  path?: string,
): PixGridProgramValidationIssue {
  return {
    severity,
    code,
    message,
    programId: program.id,
    ...(path ? { path } : {}),
  };
}

export function validatePixGridPerformanceProgram(
  program: PixGridPerformanceProgram,
): PixGridProgramValidationIssue[] {
  const issues: PixGridProgramValidationIssue[] = [];
  if (program.schemaVersion !== 2)
    issues.push(
      issue(
        program,
        "error",
        "invalid-schema-version",
        "PixGrid Performance Program schemaVersion must be 2.",
      ),
    );
  if (!program.sectionPlans.length)
    issues.push(
      issue(
        program,
        "error",
        "missing-section-plans",
        "Program must define at least one section plan.",
      ),
    );
  if (program.metadata.engine !== "pixGrid")
    issues.push(
      issue(
        program,
        "error",
        "invalid-engine",
        "Program metadata engine must be pixGrid.",
      ),
    );
  const roleSet = new Set(program.visualRoles);
  const bindingIds = new Set<string>();
  for (const binding of program.bindings) {
    if (bindingIds.has(binding.id))
      issues.push(
        issue(
          program,
          "error",
          "duplicate-binding",
          `Duplicate binding ${binding.id}.`,
          `bindings.${binding.id}`,
        ),
      );
    bindingIds.add(binding.id);
    for (const role of binding.roles)
      if (!roleSet.has(role))
        issues.push(
          issue(
            program,
            "error",
            "undeclared-role",
            `Binding ${binding.id} uses undeclared role ${role}.`,
            `bindings.${binding.id}`,
          ),
        );
  }
  const bankIds = new Set<string>();
  for (const bank of program.banks) {
    if (bankIds.has(bank.id))
      issues.push(
        issue(
          program,
          "error",
          "duplicate-bank",
          `Duplicate bank ${bank.id}.`,
          `banks.${bank.id}`,
        ),
      );
    bankIds.add(bank.id);
    if (!bank.members.length && !bank.fallbackMembers?.length)
      issues.push(
        issue(
          program,
          "warning",
          "empty-bank",
          `Bank ${bank.id} has no members.`,
          `banks.${bank.id}`,
        ),
      );
    for (const role of bank.roles ?? [])
      if (!roleSet.has(role))
        issues.push(
          issue(
            program,
            "error",
            "undeclared-bank-role",
            `Bank ${bank.id} uses undeclared role ${role}.`,
            `banks.${bank.id}`,
          ),
        );
  }
  const validateRouteTarget = (
    routeId: string,
    target: PixGridProgramRouteTarget,
    path: string,
  ) => {
    if ("role" in target && !roleSet.has(target.role))
      issues.push(
        issue(
          program,
          "error",
          "missing-route-role",
          `Route ${routeId} references undeclared role ${target.role}.`,
          path,
        ),
      );
    if ("bankId" in target && !bankIds.has(target.bankId))
      issues.push(
        issue(
          program,
          "error",
          "missing-route-bank",
          `Route ${routeId} references missing bank ${target.bankId}.`,
          path,
        ),
      );
  };
  const continuousIds = new Set<string>();
  for (const route of program.continuousRoutes) {
    validateRouteTarget(route.id, route.target, `continuousRoutes.${route.id}`);
    if (continuousIds.has(route.id))
      issues.push(
        issue(
          program,
          "error",
          "duplicate-continuous-route",
          `Duplicate continuous route ${route.id}.`,
          `continuousRoutes.${route.id}`,
        ),
      );
    continuousIds.add(route.id);
    if (EVENT_SOURCES.has(route.source))
      issues.push(
        issue(
          program,
          "error",
          "event-source-in-continuous-route",
          `${route.source} is discrete and cannot be used as a continuous route.`,
          `continuousRoutes.${route.id}`,
        ),
      );
  }
  const eventIds = new Set<string>();
  for (const route of program.eventRoutes) {
    validateRouteTarget(route.id, route.target, `eventRoutes.${route.id}`);
    if (eventIds.has(route.id))
      issues.push(
        issue(
          program,
          "error",
          "duplicate-event-route",
          `Duplicate event route ${route.id}.`,
          `eventRoutes.${route.id}`,
        ),
      );
    eventIds.add(route.id);
    if (!EVENT_SOURCES.has(route.event))
      issues.push(
        issue(
          program,
          "error",
          "continuous-source-in-event-route",
          `${route.event} is continuous and cannot be used as an event route.`,
          `eventRoutes.${route.id}`,
        ),
      );
  }
  const planIds = new Set<string>();
  for (const plan of program.sectionPlans) {
    if (planIds.has(plan.id))
      issues.push(
        issue(
          program,
          "error",
          "duplicate-section-plan",
          `Duplicate section plan ${plan.id}.`,
          `sectionPlans.${plan.id}`,
        ),
      );
    planIds.add(plan.id);
    if (!plan.sectionTypes.length)
      issues.push(
        issue(
          program,
          "error",
          "missing-section-types",
          `Section plan ${plan.id} has no section types.`,
          `sectionPlans.${plan.id}`,
        ),
      );
    for (const id of plan.continuousRouteIds ?? [])
      if (!continuousIds.has(id))
        issues.push(
          issue(
            program,
            "error",
            "missing-continuous-route",
            `Section plan ${plan.id} references missing continuous route ${id}.`,
            `sectionPlans.${plan.id}`,
          ),
        );
    for (const id of plan.eventRouteIds ?? [])
      if (!eventIds.has(id))
        issues.push(
          issue(
            program,
            "error",
            "missing-event-route",
            `Section plan ${plan.id} references missing event route ${id}.`,
            `sectionPlans.${plan.id}`,
          ),
        );
    for (const action of planActions(plan))
      if (
        action.type === "setTransition" &&
        !TRANSITION_TYPES.has(action.transition)
      )
        issues.push(
          issue(
            program,
            "error",
            "invalid-action-transition",
            `Section plan ${plan.id} has invalid transition action ${action.transition}.`,
            `sectionPlans.${plan.id}.actions`,
          ),
        );
    for (const [label, transition] of [
      ["transitionIn", plan.transitionIn],
      ["transitionOut", plan.transitionOut],
    ] as const)
      if (transition && !TRANSITION_TYPES.has(transition.type))
        issues.push(
          issue(
            program,
            "error",
            "invalid-transition",
            `Section plan ${plan.id} has invalid ${label} type ${transition.type}.`,
            `sectionPlans.${plan.id}.${label}`,
          ),
        );
    if (
      plan.intensityRange &&
      (!Number.isFinite(plan.intensityRange[0]) ||
        !Number.isFinite(plan.intensityRange[1]) ||
        plan.intensityRange[0] < 0 ||
        plan.intensityRange[0] > plan.intensityRange[1])
    )
      issues.push(
        issue(
          program,
          "error",
          "invalid-intensity-range",
          `Section plan ${plan.id} has an invalid intensity range.`,
          `sectionPlans.${plan.id}.intensityRange`,
        ),
      );
    if (
      plan.densityState &&
      (plan.densityState.value < 0 || plan.densityState.value > 1)
    )
      issues.push(
        issue(
          program,
          "error",
          "invalid-density-state",
          `Section plan ${plan.id} density must be between 0 and 1.`,
          `sectionPlans.${plan.id}.densityState`,
        ),
      );
    if (
      plan.negativeSpaceTarget != null &&
      (plan.negativeSpaceTarget < 0 || plan.negativeSpaceTarget > 1)
    )
      issues.push(
        issue(
          program,
          "error",
          "invalid-negative-space",
          `Section plan ${plan.id} negativeSpaceTarget must be between 0 and 1.`,
          `sectionPlans.${plan.id}`,
        ),
      );
  }
  if (
    program.fallbackSectionPlanId &&
    !planIds.has(program.fallbackSectionPlanId)
  )
    issues.push(
      issue(
        program,
        "error",
        "missing-fallback-plan",
        `Fallback section plan ${program.fallbackSectionPlanId} does not exist.`,
      ),
    );
  for (const arc of program.musicalArcs)
    if (!ARC_KINDS.includes(arc.kind))
      issues.push(
        issue(
          program,
          "error",
          "invalid-arc-kind",
          `Unknown arc kind ${arc.kind}.`,
          `musicalArcs.${arc.id}`,
        ),
      );
  return issues;
}

export function validatePixGridPerformanceProgramCollection(
  programs: readonly PixGridPerformanceProgram[],
): PixGridProgramValidationIssue[] {
  const issues = programs.flatMap(validatePixGridPerformanceProgram);
  const ids = new Set<string>();
  for (const program of programs) {
    if (ids.has(program.id))
      issues.push(
        issue(
          program,
          "error",
          "duplicate-program-id",
          `Duplicate program ID ${program.id}.`,
        ),
      );
    ids.add(program.id);
  }
  return issues;
}

export function resolvePixGridProgramArcState(
  compiled: Pick<PixGridCompiledPerformanceProgram, "program">,
  context: SharedPerformanceContext,
): PixGridPerformanceArcState {
  const section = context.macroSectionType ?? context.sectionType ?? "unknown";
  const result = { ...DEFAULT_ARC_STATE };
  for (const arc of compiled.program.musicalArcs) {
    const base = arc.sectionValues[section] ?? arc.defaultValue;
    const occurrence = Math.max(0, context.sectionOccurrence - 1);
    const value = base + occurrence * (arc.occurrenceDelta ?? 0);
    const [min, max] = arc.clamp ?? [0, 1];
    result[arc.kind] = clamp(value, min, max);
  }
  return result;
}

export function resolvePixGridActiveSectionPlan(
  program: PixGridPerformanceProgram,
  sharedSceneId: string | null | undefined,
): PixGridSectionPlan | null {
  return sharedSceneId
    ? (program.sectionPlans.find((plan) => plan.id === sharedSceneId) ?? null)
    : null;
}

export class PixGridPerformanceProgramCompiler {
  private readonly cache = new Map<string, PixGridCompiledPerformanceProgram>();
  private readonly assignmentCompiler = new PixGridAssignmentCompiler();
  private compileCountValue = 0;

  get compilationCount(): number {
    return this.compileCountValue;
  }
  get cachedProgramCount(): number {
    return this.cache.size;
  }

  clear(): void {
    this.cache.clear();
    this.assignmentCompiler.clear();
  }

  compile(
    program: PixGridPerformanceProgram,
    state: PixGridState,
    capabilities: Partial<Record<PixGridReactionSource, boolean>> = {},
  ): PixGridCompiledPerformanceProgram {
    const rawSignature = programSignature(state, capabilities);
    const signature = `${stableHash(rawSignature).toString(16)}:${rawSignature.length}`;
    const cached = this.cache.get(program.id);
    if (cached?.signature === signature) return cached;

    const validationIssues = validatePixGridPerformanceProgram(program);
    const effectiveProgram = effectivePixGridProgram(program, state);
    const missingBindings: string[] = [];
    const degradedBindings: string[] = [];
    const resolvedBindings: PixGridProgramRoleBinding[] = [];
    for (const binding of effectiveProgram.bindings) {
      const resolved = resolveBinding(binding, state);
      if (resolved.missing) missingBindings.push(resolved.missing);
      if (resolved.degraded) degradedBindings.push(binding.id);
      if (resolved.binding) resolvedBindings.push(resolved.binding);
    }
    const resolvedBanks = effectiveProgram.banks.map((bank) => resolveBank(bank, state));
    for (const bank of resolvedBanks) {
      if (!bank.targets.length) missingBindings.push(`bank:${bank.id}`);
      else if (bank.degraded) degradedBindings.push(`bank:${bank.id}`);
    }

    const resolvedScenes = new Map<string, string | null>();
    const resolvedRecruitment = new Map<string, ResolvedSectionRecruitment>();
    for (const plan of effectiveProgram.sectionPlans) {
      resolvedScenes.set(
        plan.id,
        resolveScenePreference(plan, state, missingBindings, degradedBindings),
      );
      resolvedRecruitment.set(
        plan.id,
        resolveSectionRecruitment(
          plan,
          state,
          missingBindings,
          degradedBindings,
        ),
      );
      reportMissingActionTargets(plan, state, missingBindings);
    }

    const assignments: PixGridReactionAssignment[] = [];
    const compilationWarnings: string[] = [];
    for (const plan of effectiveProgram.sectionPlans) {
      const intensity = clamp(
        plan.intensityRange
          ? (plan.intensityRange[0] + plan.intensityRange[1]) * 0.5
          : 1,
        0,
        2,
      );
      const continuousIds = new Set(
        plan.continuousRouteIds ??
          effectiveProgram.continuousRoutes.map((route) => route.id),
      );
      const eventIds = new Set(
        plan.eventRouteIds ?? effectiveProgram.eventRoutes.map((route) => route.id),
      );
      for (const route of effectiveProgram.continuousRoutes) {
        if (!continuousIds.has(route.id)) continue;
        const targets = targetsForRoute(
          route.target,
          resolvedBindings,
          resolvedBanks,
          state,
        );
        if (!targets.length) {
          degradedBindings.push(`route:${route.id}`);
          continue;
        }
        const variants = occurrenceVariants(route, plan);
        for (const target of targets) {
          if (variants?.length)
            for (const variant of variants)
              assignments.push(
                assignmentForContinuous(
                  route,
                  plan,
                  target,
                  intensity,
                  variant,
                ),
              );
          else
            assignments.push(
              assignmentForContinuous(route, plan, target, intensity),
            );
        }
      }
      for (const route of effectiveProgram.eventRoutes) {
        if (!eventIds.has(route.id)) continue;
        const targets = targetsForRoute(
          route.target,
          resolvedBindings,
          resolvedBanks,
          state,
        );
        if (!targets.length) {
          degradedBindings.push(`route:${route.id}`);
          continue;
        }
        for (const target of targets)
          assignments.push(assignmentForEvent(route, plan, target, intensity));
      }
    }

    const uniqueAssignments = [
      ...new Map(
        assignments.map((assignment) => [assignment.id, assignment]),
      ).values(),
    ];
    for (const assignment of uniqueAssignments) {
      const compiledAssignment = this.assignmentCompiler.compile(
        assignment,
        capabilities,
        assignment.targetScope,
        assignment.id,
      );
      for (const warning of compiledAssignment.warnings)
        compilationWarnings.push(`${assignment.id}: ${warning}`);
      if (!compiledAssignment.enabled)
        degradedBindings.push(`assignment:${assignment.id}`);
    }

    const sharedProgram: SharedPerformanceProgram<PixGridPerformanceAction> = {
      id: effectiveProgram.id,
      metadata: effectiveProgram.metadata,
      scenes: effectiveProgram.sectionPlans.map((plan) =>
        sharedScene(
          plan,
          state,
          resolvedScenes.get(plan.id) ?? null,
          resolvedRecruitment.get(plan.id) ?? {
            entry: [],
            body: [],
            eightBar: [],
          },
        ),
      ),
      fallbackOrder: effectiveProgram.fallbackOrder,
      fallbackSceneId: effectiveProgram.fallbackSectionPlanId,
    };
    const compiled: PixGridCompiledPerformanceProgram = Object.freeze({
      program: effectiveProgram,
      sharedProgram,
      assignments: Object.freeze(uniqueAssignments),
      resolvedBindings: Object.freeze(resolvedBindings),
      resolvedBanks: Object.freeze(resolvedBanks),
      missingBindings: Object.freeze([...new Set(missingBindings)]),
      degradedBindings: Object.freeze([...new Set(degradedBindings)]),
      validationIssues: Object.freeze(validationIssues),
      compilationWarnings: Object.freeze([...new Set(compilationWarnings)]),
      signature,
    });
    this.cache.set(program.id, compiled);
    this.compileCountValue += 1;
    return compiled;
  }
}
