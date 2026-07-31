import {
  resolveSharedPerformanceEventEnvelope,
  resolveSharedPerformanceProgram,
  type SharedPerformanceActionIntent,
  type SharedPerformanceActionReason,
  type SharedPerformanceContext,
} from "../../../../features/performanceCore";
import { clonePixGridLayer } from "./PixGridDefaults";
import type { PixGridGroupFrameEffect } from "./PixGridFrameEffects";
import {
  PIX_GRID_DEFAULT_PROGRAM_BY_PRESET_ID,
  PIX_GRID_PERFORMANCE_PROGRAM_BY_ID,
} from "./PixGridPerformancePrograms";
import {
  PixGridPerformanceProgramCompiler,
  resolvePixGridActiveSectionPlan,
  resolvePixGridProgramArcState,
  type PixGridCompiledPerformanceProgram,
} from "./PixGridPerformanceProgramCompiler";
import type {
  PixGridPerformanceAction,
  PixGridPerformanceArcState,
  PixGridPerformanceRuntimeSnapshot,
  PixGridResolvedPerformanceFrame,
} from "./PixGridPerformanceTypes";
import type { PixGridResolvedTransition } from "./PixGridActionCues";
import type {
  PixGridLayer,
  PixGridPaletteRole,
  PixGridPerformanceProgramId,
  PixGridReactionSource,
  PixGridState,
} from "./PixGridTypes";
import { normalizePixGridState } from "./PixGridValidation";

export const MAX_PIX_GRID_PERFORMANCE_ACTIONS = 96;
const MAX_ACTIVE_PROGRAM_EVENTS = 32;

const EVENT_REASONS = new Set<SharedPerformanceActionReason>([
  "beat",
  "downbeat",
  "kick",
  "snare",
  "hat",
  "transient",
  "semanticMoment",
]);

export function limitPixGridPerformanceIntents(
  intents: readonly SharedPerformanceActionIntent<PixGridPerformanceAction>[],
): {
  intents: readonly SharedPerformanceActionIntent<PixGridPerformanceAction>[];
  decisions: readonly string[];
} {
  const capped = intents.slice(0, MAX_PIX_GRID_PERFORMANCE_ACTIONS);
  return {
    intents: capped,
    decisions:
      intents.length > capped.length
        ? [
            `PixGrid action intents clamped ${intents.length} → ${capped.length}`,
          ]
        : [],
  };
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
}

function cloneState(state: PixGridState): PixGridState {
  return {
    ...state,
    editor: {
      ...state.editor,
      selection: state.editor.selection ? { ...state.editor.selection } : null,
    },
    scenes: state.scenes.map((scene) => ({
      ...scene,
      layerIds: [...scene.layerIds],
      pixelOverrides: [...scene.pixelOverrides],
    })),
    layers: state.layers.map(clonePixGridLayer),
    groups: state.groups.map((group) => ({
      ...group,
      cellRuns: [...group.cellRuns],
      layerScope: group.layerScope ? [...group.layerScope] : null,
      mask:
        group.mask.kind === "runs"
          ? { kind: "runs", runs: [...group.mask.runs] }
          : { ...group.mask },
      reactions: group.reactions.map((reaction) => ({
        ...reaction,
        clamp: [...reaction.clamp] as [number, number],
      })),
    })),
    pixelOverrides: [...state.pixelOverrides],
    performance: {
      ...state.performance,
      lockedRoutes: [...state.performance.lockedRoutes],
    },
    conversion: { ...state.conversion },
    diagnostics: { ...state.diagnostics },
  };
}

function explicitLayerTargetIds(
  state: PixGridState,
  target: "all" | { layerId: string } | { groupId: string },
): string[] {
  if (target === "all") return state.layers.map((layer) => layer.id);
  if ("layerId" in target) return [target.layerId];
  const group = state.groups.find((candidate) => candidate.id === target.groupId);
  if (!group) return [];
  return [...new Set([
    ...(group.layerScope ?? []),
    ...(group.layerId ? [group.layerId] : []),
  ])].filter((layerId) => state.layers.some((layer) => layer.id === layerId));
}

function actionRoute(action: PixGridPerformanceAction): string {
  switch (action.type) {
    case "setScene":
      return "scene";
    case "setLayerActive":
    case "setLayerOpacity":
    case "recruitLayer":
    case "changeAnimation":
      return `layer:${action.layerId}`;
    case "setGroupActive":
    case "setGroupBrightness":
    case "flashGroup":
    case "dissolveGroup":
    case "shiftGroup":
      return `group:${action.groupId}`;
    case "setPaletteRole":
    case "revealRows":
    case "revealColumns":
    case "changeAnimationSpeed":
    case "reverseDirection":
    case "triggerFrame":
      return action.target === "all"
        ? action.type
        : "layerId" in action.target
          ? `layer:${action.target.layerId}`
          : `group:${action.target.groupId}`;
    case "freeze":
      return "freeze";
    case "clear":
    case "restore":
      return "clear";
    case "setTransition":
      return "transition";
    case "setDensity":
      return "density";
    case "setBackgroundState":
      return "background";
  }
}

function isLocked(
  state: PixGridState,
  action: PixGridPerformanceAction,
): boolean {
  const route = actionRoute(action);
  if (
    state.performance.lockedRoutes.includes(route) ||
    state.performance.lockedRoutes.includes(action.type)
  )
    return true;
  if (route.startsWith("layer:")) {
    const layerId = route.slice("layer:".length);
    return state.layers.find((layer) => layer.id === layerId)?.locked === true;
  }
  return false;
}

function manualOverrideRoutes(state: PixGridState): string[] {
  return [
    ...new Set([
      ...state.performance.lockedRoutes,
      ...state.layers
        .filter((layer) => layer.locked)
        .map((layer) => `layer:${layer.id}`),
    ]),
  ];
}

function updateLayers(
  state: PixGridState,
  layerIds: readonly string[],
  updater: (layer: PixGridLayer) => PixGridLayer,
): PixGridState {
  if (!layerIds.length) return state;
  const ids = new Set(layerIds);
  return {
    ...state,
    layers: state.layers.map((layer) =>
      ids.has(layer.id) ? updater(layer) : layer,
    ),
  };
}

function applyPalette(
  layer: PixGridLayer,
  from: PixGridPaletteRole | undefined,
  role: PixGridPaletteRole,
): PixGridLayer {
  if (from)
    return { ...layer, paletteMap: { ...layer.paletteMap, [from]: role } };
  return {
    ...layer,
    paletteMap: {
      primary: role,
      secondary: role,
      accent: role,
      highlight: role,
      background: layer.paletteMap.background ?? "background",
    },
  };
}

function revealLayer(
  layer: PixGridLayer,
  axis: "x" | "y",
  progress: number,
  from: string,
): PixGridLayer {
  const safe = clamp(progress, 0.02, 1);
  const position = { ...layer.position };
  const scale = { ...layer.scale };
  if (axis === "x") {
    scale.x *= safe;
    if (from === "left") position.x -= layer.scale.x * (1 - safe) * 0.5;
    else if (from === "right") position.x += layer.scale.x * (1 - safe) * 0.5;
  } else {
    scale.y *= safe;
    if (from === "top") position.y -= layer.scale.y * (1 - safe) * 0.5;
    else if (from === "bottom") position.y += layer.scale.y * (1 - safe) * 0.5;
  }
  return { ...layer, scale, position, opacity: layer.opacity * safe };
}

function scaleTowardAuthored(
  value: number,
  neutral: number,
  intensity: number,
): number {
  return neutral + (value - neutral) * intensity;
}

function isGroupScopedAction(action: PixGridPerformanceAction): boolean {
  if (
    action.type === "setGroupActive" ||
    action.type === "setGroupBrightness" ||
    action.type === "flashGroup" ||
    action.type === "dissolveGroup" ||
    action.type === "shiftGroup"
  )
    return true;
  return (
    (action.type === "setPaletteRole" ||
      action.type === "revealRows" ||
      action.type === "revealColumns") &&
    action.target !== "all" &&
    "groupId" in action.target
  );
}

function groupIdForTarget(
  target: "all" | { layerId: string } | { groupId: string },
): string | null {
  return target !== "all" && "groupId" in target ? target.groupId : null;
}

function groupEffectForAction(
  action: PixGridPerformanceAction,
  reason: SharedPerformanceActionReason,
  intensity: number,
  identity: string,
  context: SharedPerformanceContext,
  motionMultiplier: number,
): PixGridGroupFrameEffect | null {
  if (!isGroupScopedAction(action)) return null;
  const stage: PixGridGroupFrameEffect["stage"] = EVENT_REASONS.has(reason)
    ? "event"
    : "persistent";
  const autonomousMotionGain = stage === "persistent"
    ? clamp(motionMultiplier)
    : 1;
  const base = {
    id: `performance:${identity}:${action.type}`,
    source: "performance" as const,
    stage,
    priority: stage === "event" ? 420 : 220,
  };
  switch (action.type) {
    case "setGroupActive":
      return {
        ...base,
        groupId: action.groupId,
        kind: "visibility",
        amount: action.active ? 1 : 0,
        blend: "replace",
      };
    case "setGroupBrightness":
      return {
        ...base,
        groupId: action.groupId,
        kind: "brightness",
        amount: clamp(
          scaleTowardAuthored(action.brightness, 1, intensity),
          0,
          4,
        ),
        blend: "multiply",
      };
    case "flashGroup":
      return {
        ...base,
        groupId: action.groupId,
        kind: "flash",
        amount: clamp(action.amount * intensity, 0, 2),
        paletteRole: action.paletteRole,
      };
    case "dissolveGroup":
      return {
        ...base,
        groupId: action.groupId,
        kind: "dissolve",
        amount: clamp(action.amount * intensity),
        seed: context.deterministicVariationSeed,
      };
    case "shiftGroup":
      return {
        ...base,
        groupId: action.groupId,
        kind: "shift",
        amount: 1,
        x: (action.x ?? 0) * intensity * autonomousMotionGain,
        y: (action.y ?? 0) * intensity * autonomousMotionGain,
      };
    case "setPaletteRole":
      return {
        ...base,
        groupId: groupIdForTarget(action.target) ?? "",
        kind: "color",
        amount: clamp(intensity),
        paletteRole: action.role,
      };
    case "revealRows":
      return {
        ...base,
        groupId: groupIdForTarget(action.target) ?? "",
        kind: "revealRows",
        amount: clamp(scaleTowardAuthored(action.progress, 1, intensity)),
        from:
          action.from === "bottom"
            ? "end"
            : action.from === "center"
              ? "center"
              : "start",
      };
    case "revealColumns":
      return {
        ...base,
        groupId: groupIdForTarget(action.target) ?? "",
        kind: "revealColumns",
        amount: clamp(scaleTowardAuthored(action.progress, 1, intensity)),
        from:
          action.from === "right"
            ? "end"
            : action.from === "center"
              ? "center"
              : "start",
      };
    default:
      return null;
  }
}

function applyStateAction(
  current: PixGridState,
  base: PixGridState,
  action: PixGridPerformanceAction,
  intensity: number,
): PixGridState {
  if (isLocked(current, action) || isGroupScopedAction(action)) return current;
  const strength = clamp(intensity);
  switch (action.type) {
    case "setScene":
      return current.scenes.some((scene) => scene.id === action.sceneId)
        ? { ...current, selectedSceneId: action.sceneId }
        : current;
    case "setLayerActive":
      return updateLayers(current, [action.layerId], (layer) => ({
        ...layer,
        visible: action.active,
      }));
    case "setLayerOpacity": {
      const opacity = clamp(action.opacity);
      return updateLayers(current, [action.layerId], (layer) => ({
        ...layer,
        opacity:
          action.mode === "blend"
            ? clamp(layer.opacity + (opacity - layer.opacity) * strength)
            : clamp(scaleTowardAuthored(opacity, layer.opacity, strength)),
      }));
    }
    case "setPaletteRole":
      return updateLayers(
        current,
        explicitLayerTargetIds(current, action.target),
        (layer) => applyPalette(layer, action.from, action.role),
      );
    case "revealRows":
      return updateLayers(
        current,
        explicitLayerTargetIds(current, action.target),
        (layer) =>
          revealLayer(
            layer,
            "y",
            scaleTowardAuthored(action.progress, 1, strength),
            action.from ?? "center",
          ),
      );
    case "revealColumns":
      return updateLayers(
        current,
        explicitLayerTargetIds(current, action.target),
        (layer) =>
          revealLayer(
            layer,
            "x",
            scaleTowardAuthored(action.progress, 1, strength),
            action.from ?? "center",
          ),
      );
    case "recruitLayer":
      return updateLayers(current, [action.layerId], (layer) => ({
        ...layer,
        visible: true,
        opacity:
          action.opacity == null
            ? layer.opacity
            : clamp(
                scaleTowardAuthored(action.opacity, layer.opacity, strength),
              ),
      }));
    case "changeAnimation":
      return updateLayers(current, [action.layerId], (layer) => ({
        ...layer,
        animations: [
          {
            mode: action.animation,
            speed: action.speed ?? layer.animations[0]?.speed ?? 1,
            amount: action.amount ?? layer.animations[0]?.amount ?? 1,
            phase: layer.animations[0]?.phase ?? 0,
            boundary: layer.animations[0]?.boundary ?? "wrap",
          },
          ...layer.animations.slice(1),
        ],
      }));
    case "changeAnimationSpeed": {
      const multiplier = Math.max(
        0,
        scaleTowardAuthored(action.multiplier, 1, strength),
      );
      return updateLayers(
        current,
        explicitLayerTargetIds(current, action.target),
        (layer) => ({
          ...layer,
          animations: layer.animations.map((animation) => ({
            ...animation,
            speed: animation.speed * multiplier,
          })),
        }),
      );
    }
    case "reverseDirection":
      return updateLayers(
        current,
        explicitLayerTargetIds(current, action.target),
        (layer) => ({
          ...layer,
          animations: layer.animations.map((animation) => ({
            ...animation,
            speed: -animation.speed,
            amount: -animation.amount,
          })),
        }),
      );
    case "triggerFrame": {
      const step = (action.step ?? 0.1) * strength;
      return updateLayers(
        current,
        explicitLayerTargetIds(current, action.target),
        (layer) => ({
          ...layer,
          animations: layer.animations.map((animation) => ({
            ...animation,
            phase: animation.phase + step,
          })),
        }),
      );
    }
    case "freeze":
      return action.active
        ? updateLayers(
            current,
            current.layers.map((layer) => layer.id),
            (layer) => ({
              ...layer,
              animations: layer.animations.map((animation) => ({
                ...animation,
                speed: 0,
              })),
            }),
          )
        : current;
    case "clear":
      return {
        ...current,
        layers: current.layers.map((layer) => ({ ...layer, visible: false })),
        backgroundMode: "black",
        backgroundBrightness: 0,
      };
    case "restore":
      return cloneState(base);
    case "setDensity": {
      const density = clamp(scaleTowardAuthored(action.density, 1, strength));
      return {
        ...current,
        layers: current.layers.map((layer) => ({
          ...layer,
          visible: layer.visible && layer.densityRank <= density,
        })),
      };
    }
    case "setBackgroundState": {
      const brightness =
        action.brightness ??
        (action.state === "black"
          ? 0
          : action.state === "dim"
            ? 0.06
            : action.state === "lifted"
              ? 0.2
              : current.backgroundBrightness);
      return {
        ...current,
        backgroundMode:
          action.state === "black" ? "black" : current.backgroundMode,
        backgroundBrightness: clamp(
          scaleTowardAuthored(
            brightness,
            current.backgroundBrightness,
            strength,
          ),
        ),
      };
    }
    case "setTransition":
    case "setGroupActive":
    case "setGroupBrightness":
    case "flashGroup":
    case "dissolveGroup":
    case "shiftGroup":
      return current;
  }
}

/** Applies a state-mutating Performance Program action through the same runtime path used during playback. */
export function applyPixGridPerformanceStateAction(
  rawState: PixGridState,
  action: PixGridPerformanceAction,
  intensity = 1,
): PixGridState {
  const base = normalizePixGridState(rawState);
  return normalizePixGridState(applyStateAction(base, base, action, intensity));
}

interface ProgramEventRecord {
  id: string;
  route: string;
  startSec: number;
  attack: number;
  hold: number;
  release: number;
  effect: PixGridGroupFrameEffect;
}

function eventEnvelope(
  reason: SharedPerformanceActionReason,
): Pick<ProgramEventRecord, "attack" | "hold" | "release"> {
  switch (reason) {
    case "hat":
      return { attack: 0.005, hold: 0.015, release: 0.08 };
    case "kick":
      return { attack: 0.008, hold: 0.035, release: 0.18 };
    case "snare":
      return { attack: 0.008, hold: 0.05, release: 0.24 };
    case "semanticMoment":
      return { attack: 0.02, hold: 0.1, release: 0.45 };
    default:
      return { attack: 0.005, hold: 0.025, release: 0.12 };
  }
}

function transitionType(
  type: Extract<PixGridPerformanceAction, { type: "setTransition" }>,
): PixGridResolvedTransition["type"] {
  switch (type.transition) {
    case "fade":
      return "crossfade";
    case "wipeRows":
      return "rowWipe";
    case "wipeColumns":
      return "columnWipe";
    case "dissolve":
      return "pixelDissolve";
    default:
      return type.transition;
  }
}

function applyProgramArcState(
  state: PixGridState,
  arc: PixGridPerformanceArcState,
): PixGridState {
  const densityLimit = clamp(
    Math.min(arc.density, Math.max(0.08, 1 - arc.negativeSpace * 0.55)),
  );
  const motion = Math.max(0.1, Math.min(1.5, arc.motion));
  return {
    ...state,
    globalIntensity: clamp(
      state.globalIntensity * (0.82 + arc.paletteIntensity * 0.22),
    ),
    cellBrightness: clamp(state.cellBrightness * (0.82 + arc.contrast * 0.24)),
    glowAmount: clamp(state.glowAmount + arc.sparkleDetail * 0.08),
    backgroundBrightness: clamp(
      state.backgroundBrightness * (0.45 + arc.backgroundActivity * 0.72),
    ),
    layers: state.layers.map((layer) => ({
      ...layer,
      visible:
        layer.visible &&
        layer.densityRank <= Math.max(densityLimit, arc.recruitment * 0.9),
      animations: layer.animations.map((animation) => ({
        ...animation,
        speed: animation.speed * motion,
      })),
    })),
  };
}

function reasonStartSec(
  reason: SharedPerformanceActionReason,
  context: SharedPerformanceContext,
): number {
  if (
    reason === "sectionEntry" ||
    reason === "sectionBody" ||
    reason === "sectionExit" ||
    reason === "scene"
  ) {
    return (
      context.resolvedMacroSection?.startSec ??
      context.resolvedSection?.startSec ??
      context.audioTimeSec
    );
  }
  const beatDuration = context.bpm > 0 ? 60 / context.bpm : 0.5;
  const blockBars =
    reason === "sixteenBarEvolution"
      ? 16
      : reason === "eightBarRecruitment"
        ? 8
        : 4;
  if (
    reason === "fourBarMotif" ||
    reason === "eightBarRecruitment" ||
    reason === "sixteenBarEvolution" ||
    reason === "barStage"
  ) {
    const blockBeats = blockBars * Math.max(1, context.timeSignature);
    return Math.max(
      0,
      context.audioTimeSec - (context.absoluteBeat % blockBeats) * beatDuration,
    );
  }
  return Math.max(0, context.audioTimeSec - context.beatPhase * beatDuration);
}

export class PixGridPerformanceExecutionRuntime {
  private readonly programCompiler = new PixGridPerformanceProgramCompiler();
  private events: ProgramEventRecord[] = [];
  private transition: {
    identity: string;
    value: PixGridResolvedTransition;
  } | null = null;
  private trackIdentity: string | null = null;
  private lastAudioTime = 0;

  compileProgram(
    program: Parameters<PixGridPerformanceProgramCompiler["compile"]>[0],
    state: PixGridState,
    capabilities: Partial<Record<PixGridReactionSource, boolean>> = {},
  ): PixGridCompiledPerformanceProgram {
    return this.programCompiler.compile(program, state, capabilities);
  }

  get programCompilationCount(): number {
    return this.programCompiler.compilationCount;
  }
  get cachedProgramCount(): number {
    return this.programCompiler.cachedProgramCount;
  }

  reset(): void {
    this.events = [];
    this.transition = null;
    this.trackIdentity = null;
    this.lastAudioTime = 0;
  }

  synchronize(context: SharedPerformanceContext): void {
    const trackChanged =
      this.trackIdentity !== null &&
      this.trackIdentity !== context.trackIdentity;
    if (trackChanged || context.trackReplacementDetected) this.reset();
    if (context.loopWrapDetected) {
      this.events = [];
      this.transition = null;
    } else if (
      context.seekDetected ||
      context.audioTimeSec + 0.001 < this.lastAudioTime
    ) {
      this.events = this.events.filter(
        (event) => event.startSec <= context.audioTimeSec + 0.001,
      );
      if (
        this.transition &&
        this.transition.value.startedAtSec > context.audioTimeSec + 0.001
      )
        this.transition = null;
    }
    this.trackIdentity = context.trackIdentity;
    this.lastAudioTime = context.audioTimeSec;
  }

  triggerEvent(
    effect: PixGridGroupFrameEffect,
    intent: SharedPerformanceActionIntent<PixGridPerformanceAction>,
    context: SharedPerformanceContext,
  ): void {
    const triggerIdentity = `${intent.identity}:${intent.reason}:${context.beatIndex}:${context.sectionOccurrence}`;
    if (
      this.events.some(
        (event) =>
          event.id === triggerIdentity &&
          event.route === actionRoute(intent.action),
      )
    )
      return;
    const envelope = eventEnvelope(intent.reason);
    this.events.push({
      id: triggerIdentity,
      route: actionRoute(intent.action),
      startSec: context.audioTimeSec,
      effect,
      ...envelope,
    });
    if (this.events.length > MAX_ACTIVE_PROGRAM_EVENTS)
      this.events.splice(0, this.events.length - MAX_ACTIVE_PROGRAM_EVENTS);
  }

  activeEventEffects(audioTimeSec: number): {
    effects: PixGridGroupFrameEffect[];
    ids: string[];
  } {
    const effects: PixGridGroupFrameEffect[] = [];
    const ids: string[] = [];
    this.events = this.events.filter((event) => {
      if (event.startSec > audioTimeSec + 0.001) return true;
      const elapsed = Math.max(0, audioTimeSec - event.startSec);
      const value = resolveSharedPerformanceEventEnvelope(elapsed, {
        attack: event.attack,
        hold: event.hold,
        release: event.release,
        curve: "easeOut",
      });
      if (value <= 0 && elapsed > event.attack + event.hold + event.release)
        return false;
      if (value > 0) {
        effects.push({
          ...event.effect,
          id: `${event.effect.id}:${event.id}`,
          amount: event.effect.amount * value,
        });
        ids.push(event.id);
      }
      return true;
    });
    return { effects, ids };
  }

  resolveTransition(
    intent: SharedPerformanceActionIntent<PixGridPerformanceAction>,
    action: Extract<PixGridPerformanceAction, { type: "setTransition" }>,
    context: SharedPerformanceContext,
    fromState: PixGridState,
  ): PixGridResolvedTransition | null {
    const type = transitionType(action);
    if (type === "cut") return null;
    const durationSec = Math.max(
      0.02,
      (action.durationBeats ?? 1) * (context.bpm > 0 ? 60 / context.bpm : 0.5),
    );
    const identity = `${intent.identity}:${action.transition}:${durationSec.toFixed(4)}`;
    if (!this.transition || this.transition.identity !== identity) {
      const startedAtSec = reasonStartSec(intent.reason, context);
      this.transition = {
        identity,
        value: {
          cueId: `performance:${identity}`,
          type,
          progress: 0,
          startedAtSec,
          durationSec,
          seed: context.deterministicVariationSeed,
          fromState: cloneState(fromState),
        },
      };
    }
    const progress = clamp(
      (context.audioTimeSec - this.transition.value.startedAtSec) /
        this.transition.value.durationSec,
    );
    if (progress >= 1) return null;
    return { ...this.transition.value, progress };
  }
}

function inactiveSnapshot(
  state: PixGridState,
  context: SharedPerformanceContext,
  fallbackState: string | null,
): PixGridPerformanceRuntimeSnapshot {
  return {
    active: false,
    programId: state.performance.sharedPerformanceProgramId,
    programName: null,
    sceneId: null,
    activeSectionPlanId: null,
    variationId: null,
    section: context.macroSectionType ?? context.sectionType ?? "unknown",
    sectionPhase: context.macroSectionPhase,
    sectionOccurrence: context.sectionOccurrence,
    dropOccurrence: context.dropOccurrence,
    fourBarStage: context.performanceFourBarBlockIndex + 1,
    eightBarStage: context.performanceEightBarBlockIndex + 1,
    sixteenBarStage: context.performanceSixteenBarBlockIndex + 1,
    currentFourBarMotif: null,
    currentEightBarRecruitment: null,
    currentSixteenBarEvolution: null,
    activeVisualRoles: [],
    resolvedBanks: [],
    activeContinuousRoutes: [],
    activeEventRoutes: [],
    arcState: {
      density: 0,
      paletteIntensity: 0,
      motion: 0,
      contrast: 0,
      negativeSpace: 1,
      recruitment: 0,
      impactStrength: 0,
      sparkleDetail: 0,
      backgroundActivity: 0,
    },
    recentActionReasons: [],
    recentActionTypes: [],
    manualOverrideRoutes: manualOverrideRoutes(state),
    manualOverridePrecedence:
      "Track Map cue/manual locks > user-authored assignments > program routes > program choreography.",
    missingBindings: [],
    degradedBindings: [],
    fallbackState,
    transition: null,
    activeEventEnvelopes: [],
    activeGroupEffects: [],
    deterministicIdentity: `${context.runtimeIdentity}:pix-grid-inactive`,
  };
}

export function resolvePixGridPerformanceFrame(
  rawState: PixGridState,
  context: SharedPerformanceContext,
  presetId: string | null | undefined,
  options: {
    runtime?: PixGridPerformanceExecutionRuntime;
    capabilities?: Partial<Record<PixGridReactionSource, boolean>>;
    bassReactivityGain?: number;
    motionMultiplier?: number;
  } = {},
): PixGridResolvedPerformanceFrame {
  const base = normalizePixGridState(rawState);
  const runtime = options.runtime ?? new PixGridPerformanceExecutionRuntime();
  runtime.synchronize(context);
  const attachedProgramId = presetId
    ? PIX_GRID_DEFAULT_PROGRAM_BY_PRESET_ID[presetId]
    : null;
  const configuredId =
    attachedProgramId ?? base.performance.sharedPerformanceProgramId;
  const program = configuredId
    ? PIX_GRID_PERFORMANCE_PROGRAM_BY_ID.get(configuredId)
    : null;
  if (!base.performance.enabled || !program) {
    return {
      state: base,
      snapshot: inactiveSnapshot(
        base,
        context,
        program ? null : "No PixGrid performance program is selected.",
      ),
      appliedActions: [],
      groupEffects: [],
      transition: null,
      actionLimitDecisions: [],
    };
  }

  const compiledProgram = runtime.compileProgram(
    program,
    base,
    options.capabilities,
  );
  const shouldUseSafeFallback =
    !context.capabilities.sections || context.sectionConfidence < 0.35;
  const resolutionContext: SharedPerformanceContext = {
    ...context,
    ...(shouldUseSafeFallback
      ? {
          sectionType: "unknown" as const,
          macroSectionType: "unknown" as const,
          sectionFamily: null,
        }
      : {}),
    deterministicVariationSeed:
      context.deterministicVariationSeed ^ base.performance.seed,
  };
  const resolution = resolveSharedPerformanceProgram(
    compiledProgram.sharedProgram,
    resolutionContext,
  );
  const activePlan = resolvePixGridActiveSectionPlan(
    compiledProgram.program,
    resolution.scene?.id,
  );
  const planAssignmentPrefix = activePlan ? `program:${activePlan.id}:` : "";
  const programAssignments = planAssignmentPrefix
    ? compiledProgram.assignments.filter((assignment) =>
        assignment.id.startsWith(planAssignmentPrefix),
      )
    : [];
  const limited = limitPixGridPerformanceIntents(resolution.intents);
  const resolvedArcState = resolvePixGridProgramArcState(
    compiledProgram,
    resolutionContext,
  );
  const arcState = activePlan?.negativeSpaceTarget != null
    ? {
        ...resolvedArcState,
        negativeSpace: clamp(activePlan.negativeSpaceTarget),
      }
    : resolvedArcState;
  let state = applyProgramArcState(
    cloneState({
      ...base,
      audioAssignments: [...programAssignments, ...base.audioAssignments],
    }),
    arcState,
  );
  let transition: PixGridResolvedTransition | null = null;
  let transitionLabel: PixGridPerformanceRuntimeSnapshot["transition"] = null;
  const appliedActions: PixGridPerformanceAction[] = [];
  const groupEffects: PixGridGroupFrameEffect[] = [];

  for (const intent of limited.intents) {
    if (isLocked(state, intent.action)) continue;
    const intentIntensity = base.performance.intensity
      * (EVENT_REASONS.has(intent.reason) ? arcState.impactStrength : 1)
      * (intent.reason === "kick" ? clamp(options.bassReactivityGain ?? 1) : 1);
    if (intent.action.type === "setTransition") {
      transitionLabel = intent.action.transition;
      transition =
        runtime.resolveTransition(intent, intent.action, context, base) ??
        transition;
      appliedActions.push(intent.action);
      continue;
    }
    const groupEffect = groupEffectForAction(
      intent.action,
      intent.reason,
      intentIntensity,
      intent.identity,
      context,
      options.motionMultiplier ?? 1,
    );
    if (groupEffect) {
      if (EVENT_REASONS.has(intent.reason))
        runtime.triggerEvent(groupEffect, intent, context);
      else groupEffects.push(groupEffect);
    } else {
      state = applyStateAction(
        state,
        base,
        intent.action,
        intentIntensity,
      );
    }
    appliedActions.push(intent.action);
  }

  const activeEvents = runtime.activeEventEffects(context.audioTimeSec);
  groupEffects.push(...activeEvents.effects);
  state = normalizePixGridState(state);
  const fallbackState = !context.capabilities.sections
    ? "Section analysis unavailable; Shared Performance BPM/grid fallback is active."
    : context.sectionConfidence < 0.35
      ? "Low-confidence section analysis; safe PixGrid fallback choreography is active."
      : resolution.scene == null
        ? "No authored scene matched; the program fallback scene is active."
        : null;
  const programId = program.id as PixGridPerformanceProgramId;
  return {
    state,
    appliedActions,
    groupEffects,
    transition,
    actionLimitDecisions: limited.decisions,
    snapshot: {
      active: resolution.scene != null,
      programId,
      programName: program.metadata?.name ?? program.id,
      sceneId: resolution.scene?.id ?? null,
      activeSectionPlanId: activePlan?.id ?? null,
      variationId: resolution.variation?.id ?? null,
      section: context.macroSectionType ?? context.sectionType ?? "unknown",
      sectionPhase: resolution.sectionPhase,
      sectionOccurrence: context.sectionOccurrence,
      dropOccurrence: context.dropOccurrence,
      fourBarStage: context.performanceFourBarBlockIndex + 1,
      eightBarStage: context.performanceEightBarBlockIndex + 1,
      sixteenBarStage: context.performanceSixteenBarBlockIndex + 1,
      currentFourBarMotif: activePlan?.fourBarActions?.length
        ? `${activePlan.id}:motif:${context.performanceFourBarBlockIndex % activePlan.fourBarActions.length}`
        : null,
      currentEightBarRecruitment: activePlan?.eightBarRecruitment?.length
        ? `${activePlan.id}:recruitment:${Math.min(activePlan.eightBarRecruitment.length, context.performanceEightBarBlockIndex + 1)}`
        : null,
      currentSixteenBarEvolution: activePlan?.sixteenBarEvolution?.length
        ? `${activePlan.id}:evolution:${Math.min(activePlan.sixteenBarEvolution.length, context.performanceSixteenBarBlockIndex + 1)}`
        : null,
      activeVisualRoles: [
        ...new Set(
          compiledProgram.resolvedBindings.flatMap((binding) => binding.roles),
        ),
      ],
      resolvedBanks: compiledProgram.resolvedBanks
        .filter((bank) => bank.targets.length > 0)
        .map((bank) => `${bank.id}:${bank.targets.length}`),
      activeContinuousRoutes:
        activePlan?.continuousRouteIds ??
        program.continuousRoutes.map((route) => route.id),
      activeEventRoutes:
        activePlan?.eventRouteIds ??
        program.eventRoutes.map((route) => route.id),
      arcState,
      recentActionReasons: limited.intents
        .map((intent) => intent.reason)
        .slice(-12),
      recentActionTypes: appliedActions.map((action) => action.type).slice(-12),
      manualOverrideRoutes: manualOverrideRoutes(base),
      manualOverridePrecedence:
        "Track Map cue/manual locks > user-authored assignments > program routes > program choreography.",
      missingBindings: compiledProgram.missingBindings,
      degradedBindings: [
        ...new Set([
          ...compiledProgram.degradedBindings,
          ...compiledProgram.compilationWarnings,
        ]),
      ],
      fallbackState,
      transition: transitionLabel,
      activeEventEnvelopes: activeEvents.ids,
      activeGroupEffects: groupEffects.map(
        (effect) => `${effect.groupId}:${effect.kind}`,
      ),
      deterministicIdentity: resolution.deterministicIdentity,
    },
  };
}
