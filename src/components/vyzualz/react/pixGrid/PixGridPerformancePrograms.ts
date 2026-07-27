import type { SharedPerformanceProgramValidationIssue } from "../../../../features/performanceCore";
import { validatePixGridPerformanceProgramCollection } from "./PixGridPerformanceProgramCompiler";
import type { PixGridPerformanceProgramId } from "./PixGridTypes";
import {
  PIX_GRID_PERFORMANCE_PROGRAM_SCHEMA_VERSION,
  type PixGridPerformanceAction,
  type PixGridPerformanceProgram,
  type PixGridSectionPlan,
} from "./PixGridPerformanceTypes";

const VISUAL_ROLES = [
  "hero",
  "primary",
  "secondary",
  "accent",
  "outline",
  "background",
  "atmosphere",
  "impact",
  "percussion",
  "bass",
  "vocalFocus",
  "sparkle",
  "transition",
  "typography",
  "character",
  "environment",
] as const;

function transitionFor(
  actions: readonly PixGridPerformanceAction[] | undefined,
) {
  const action = actions?.find(
    (
      candidate,
    ): candidate is Extract<
      PixGridPerformanceAction,
      { type: "setTransition" }
    > => candidate.type === "setTransition",
  );
  if (!action) return undefined;
  const type =
    action.transition === "fade"
      ? "crossfade"
      : action.transition === "wipeRows"
        ? "rowWipe"
        : action.transition === "wipeColumns"
          ? "columnWipe"
          : action.transition === "dissolve"
            ? "pixelDissolve"
            : action.transition;
  return {
    type,
    durationBeats: action.durationBeats,
    interruptible: true,
  } as const;
}

function densityFor(
  actions: readonly PixGridPerformanceAction[] | undefined,
): number | undefined {
  return actions?.find(
    (
      candidate,
    ): candidate is Extract<PixGridPerformanceAction, { type: "setDensity" }> =>
      candidate.type === "setDensity",
  )?.density;
}

function sceneFor(
  actions: readonly PixGridPerformanceAction[] | undefined,
): string[] | undefined {
  const scene = actions?.find(
    (
      candidate,
    ): candidate is Extract<PixGridPerformanceAction, { type: "setScene" }> =>
      candidate.type === "setScene",
  );
  return scene ? [scene.sceneId] : undefined;
}

function completeSectionPlan(
  plan: PixGridSectionPlan,
  program: Pick<PixGridPerformanceProgram, 'continuousRoutes' | 'eventRoutes'>,
): PixGridSectionPlan {
  const section = plan.sectionTypes[0] ?? "unknown";
  const density =
    densityFor(plan.actions) ??
    (section === "drop"
      ? 1
      : section === "build"
        ? 0.78
        : section === "preDrop"
          ? 0.28
          : section === "intro" || section === "outro"
            ? 0.3
            : 0.56);
  const negativeSpace = Math.max(0.08, Math.min(0.88, 1 - density * 0.72));
  return {
    ...plan,
    scenePreference: plan.scenePreference ?? sceneFor(plan.actions),
    continuousRouteIds:
      plan.continuousRouteIds ?? program.continuousRoutes.map((route) => route.id),
    eventRouteIds:
      plan.eventRouteIds ?? program.eventRoutes.map((route) => route.id),
    motionState: plan.motionState ?? {
      amount:
        section === "drop"
          ? 0.92
          : section === "build"
            ? 0.68
            : section === "preDrop"
              ? 0.08
              : section === "breakdown"
                ? 0.28
                : 0.46,
      direction: "alternate",
      grammar: `${plan.id}-motion`,
    },
    paletteState: plan.paletteState ?? {
      intensity:
        section === "drop"
          ? 1
          : section === "build"
            ? 0.82
            : section === "preDrop"
              ? 0.5
              : 0.64,
      primaryRole: "primary",
      accentRole: "accent",
    },
    densityState: plan.densityState ?? {
      value: density,
      minimum: Math.max(0, density - 0.18),
      maximum: Math.min(1, density + 0.12),
    },
    transitionIn: plan.transitionIn ?? transitionFor(plan.actions),
    transitionOut:
      plan.transitionOut ??
      (section === "outro"
        ? { type: "powerOff", durationBeats: 2, interruptible: true }
        : undefined),
    negativeSpaceTarget: plan.negativeSpaceTarget ?? negativeSpace,
    intensityRange: plan.intensityRange ?? [
      Math.max(0.2, density * 0.72),
      Math.min(1.25, density * 1.12),
    ],
    variationPolicy: plan.variationPolicy ?? {
      deterministic: true,
      preserveIdentity: true,
      occurrenceMode: section === "drop" ? "develop" : "alternate",
    },
  };
}

function defineProgram(
  program: PixGridPerformanceProgram,
): PixGridPerformanceProgram {
  return {
    ...program,
    sectionPlans: program.sectionPlans.map((plan) =>
      completeSectionPlan(plan, program),
    ),
  };
}

function sharedRoutes(prefix: "bass" | "reactor" | "parade") {
  const bank = (suffix: string) => `${prefix}-${suffix}`;
  return {
    continuousRoutes: [
      {
        id: "bass-foundation",
        target: { bankId: bank("bass-bank") },
        source: "bass",
        operation: "brightness",
        amount: 0.52,
        curve: "smoothstep",
        blend: "add",
        intensityScale: 0.8,
        capabilityFallback: "energy",
        priority: -240,
      },
      {
        id: "energy-hero",
        target: { bankId: bank("hero-bank") },
        source: "trackRelativeEnergy",
        operation: "brightness",
        amount: 0.16,
        curve: "easeOut",
        blend: "add",
        intensityScale: 0.72,
        capabilityFallback: "energy",
        priority: -230,
      },
      {
        id: "detail-highs",
        target: { bankId: bank("accent-bank") },
        source: "high",
        operation: "sparkleDensity",
        amount: 0.18,
        curve: "exponential",
        blend: "max",
        intensityScale: 0.7,
        capabilityFallback: "midHighActivity",
        priority: -220,
      },
      {
        id: "vocal-focus",
        target: { bankId: bank("hero-bank") },
        source: "vocalEnergy",
        operation: "scale",
        amount: 0.08,
        curve: "easeInOut",
        blend: "add",
        intensityScale: 0.5,
        minimumConfidence: 0.35,
        capabilityFallback: "energy",
        priority: -210,
      },
    ],
    eventRoutes: [
      {
        id: "kick-impact",
        target: { bankId: bank("bass-bank") },
        event: "kick",
        operation: "brightness",
        amount: 0.82,
        envelope: { attack: 0, hold: 0.025, release: 0.14, curve: "easeOut" },
        retrigger: "restart",
        maximumStacking: 2,
        capabilityFallback: "beat",
        blend: "add",
        priority: -150,
      },
      {
        id: "snare-outline",
        target: { bankId: bank("snare-bank") },
        event: "snare",
        operation: "outlineFlash",
        amount: 0.92,
        envelope: { attack: 0, hold: 0.025, release: 0.14, curve: "easeOut" },
        retrigger: "extend",
        maximumStacking: 2,
        capabilityFallback: "transient",
        paletteRole: "highlight",
        blend: "max",
        priority: -140,
      },
      {
        id: "hat-detail",
        target: { bankId: bank("hat-bank") },
        event: "hat",
        operation: "sparkle",
        amount: 0.24,
        envelope: { attack: 0, hold: 0.012, release: 0.07, curve: "easeOut" },
        retrigger: "restart",
        maximumStacking: 3,
        capabilityFallback: "midHighActivity",
        blend: "max",
        priority: -130,
      },
      {
        id: "bar-motif",
        target: { bankId: bank("accent-bank") },
        event: "barEntry",
        operation: "checkerAlternation",
        amount: 0.72,
        envelope: { attack: 0, hold: 0.08, release: 0.18, curve: "step" },
        quantization: "bar",
        capabilityFallback: "beat",
        blend: "replace",
        priority: -125,
      },
      {
        id: "phrase-recruit",
        target: { bankId: bank("recruitment-bank") },
        event: "phraseEntry",
        operation: "maskExpansion",
        amount: 0.82,
        envelope: {
          attack: 0.02,
          hold: 0.08,
          release: 0.38,
          curve: "easeInOut",
        },
        quantization: "bar",
        capabilityFallback: "beat",
        blend: "max",
        priority: -120,
      },
      {
        id: "section-entry-route",
        target: { bankId: bank("transition-bank") },
        event: "sectionEntry",
        operation: "reveal",
        amount: 1,
        envelope: { attack: 0, hold: 0.06, release: 0.42, curve: "easeOut" },
        capabilityFallback: "beat",
        blend: "max",
        priority: -115,
      },
      {
        id: "drop-impact-route",
        target: { bankId: bank("impact-bank") },
        event: "dropImpact",
        operation: "brightness",
        amount: 0.9,
        envelope: { attack: 0, hold: 0.05, release: 0.32, curve: "overshoot" },
        capabilityFallback: "transient",
        paletteRole: "highlight",
        blend: "add",
        priority: -100,
      },
      {
        id: "semantic-accent",
        target: { bankId: bank("accent-bank") },
        event: "semanticMoment",
        operation: "paletteRole",
        amount: 0.9,
        envelope: {
          attack: 0.02,
          hold: 0.12,
          release: 0.45,
          curve: "easeInOut",
        },
        capabilityFallback: "disable",
        paletteRole: "accent",
        blend: "max",
        priority: -90,
      },
      {
        id: "track-map-handoff",
        target: { scope: "transition" },
        event: "trackMapCueEvent",
        operation: "transitionStrength",
        amount: 1,
        envelope: { attack: 0, hold: 0.05, release: 0.24, curve: "easeOut" },
        capabilityFallback: "disable",
        blend: "max",
        priority: -80,
      },
    ],
  } satisfies Pick<
    PixGridPerformanceProgram,
    "continuousRoutes" | "eventRoutes"
  >;
}

function bassBeaconRoutes() {
  const shared = sharedRoutes('bass')
  return {
    continuousRoutes: [
      ...shared.continuousRoutes,
      {
        id: 'bass-sub-pressure',
        target: { bankId: 'bass-impact-bank' },
        source: 'sub',
        operation: 'brightness',
        amount: 0.28,
        curve: 'logarithmic',
        blend: 'add',
        capabilityFallback: 'energy',
        priority: -205,
      },
      {
        id: 'bass-tension-outline',
        target: { bankId: 'bass-snare-bank' },
        source: 'tension',
        operation: 'outlineIntensity',
        amount: 0.34,
        curve: 'exponential',
        blend: 'max',
        capabilityFallback: 'energy',
        priority: -200,
      },
      {
        id: 'bass-build-row-recruitment',
        target: { bankId: 'bass-row-bank' },
        source: 'buildProgress',
        operation: 'rowRecruitment',
        amount: 1,
        curve: 'easeInOut',
        blend: 'replace',
        clamp: [0, 1],
        conditions: { sectionTypes: ['build', 'preDrop'] },
        priority: -195,
      },
      {
        id: 'bass-phrase-highlight-travel',
        target: { bankId: 'bass-highlight-bank' },
        source: 'phraseProgress',
        operation: 'columnRecruitment',
        amount: 1,
        curve: 'linear',
        blend: 'replace',
        clamp: [0, 1],
        priority: -190,
      },
      {
        id: 'bass-air-detail',
        target: { bankId: 'bass-hat-bank' },
        source: 'air',
        operation: 'sparkleDensity',
        amount: 0.26,
        curve: 'exponential',
        blend: 'max',
        capabilityFallback: 'midHighActivity',
        priority: -185,
      },
    ],
    eventRoutes: [
      ...shared.eventRoutes,
      {
        id: 'bass-downbeat-hero',
        target: { bankId: 'bass-hero-bank' },
        event: 'downbeat',
        operation: 'brightness',
        amount: 0.42,
        envelope: { attack: 0, hold: 0.045, release: 0.24, curve: 'overshoot' },
        capabilityFallback: 'beat',
        blend: 'add',
        paletteRole: 'highlight',
        priority: -128,
      },
      {
        id: 'bass-four-bar-letter-motif',
        target: { bankId: 'bass-letter-bank' },
        event: 'fourBarBoundary',
        operation: 'paletteRole',
        amount: 0.86,
        envelope: { attack: 0, hold: 0.1, release: 0.42, curve: 'easeOut' },
        quantization: 'fourBars',
        capabilityFallback: 'beat',
        blend: 'max',
        paletteRole: 'secondary',
        priority: -118,
      },
      {
        id: 'bass-eight-bar-accent-recruitment',
        target: { bankId: 'bass-side-bank' },
        event: 'eightBarBoundary',
        operation: 'reveal',
        amount: 1,
        envelope: { attack: 0, hold: 0.16, release: 0.5, curve: 'easeOut' },
        quantization: 'eightBars',
        capabilityFallback: 'beat',
        blend: 'max',
        priority: -108,
      },
      {
        id: 'bass-sixteen-bar-layout-evolution',
        target: { bankId: 'bass-letter-bank' },
        event: 'sixteenBarBoundary',
        operation: 'maskExpansion',
        amount: 0.16,
        envelope: { attack: 0.02, hold: 0.14, release: 0.54, curve: 'easeInOut' },
        quantization: 'sixteenBars',
        capabilityFallback: 'beat',
        blend: 'max',
        priority: -98,
      },
    ],
  } satisfies Pick<PixGridPerformanceProgram, 'continuousRoutes' | 'eventRoutes'>
}

function geometricReactorRoutes() {
  const shared = sharedRoutes('reactor')
  return {
    continuousRoutes: [
      ...shared.continuousRoutes,
      { id: 'reactor-sub-core', target: { bankId: 'reactor-core-bank' }, source: 'sub', operation: 'brightness', amount: 0.42, curve: 'logarithmic', blend: 'add', capabilityFallback: 'energy', priority: -208 },
      { id: 'reactor-bass-inner-ring', target: { bankId: 'reactor-inner-ring-bank' }, source: 'bass', operation: 'scale', amount: 0.09, curve: 'easeOut', blend: 'add', clamp: [0, 0.2], capabilityFallback: 'energy', priority: -204 },
      { id: 'reactor-low-mid-outer-motion', target: { bankId: 'reactor-outer-ring-bank' }, source: 'lowMid', operation: 'pixelDisplacement', amount: 0.08, curve: 'easeInOut', blend: 'add', clamp: [-0.14, 0.14], capabilityFallback: 'energy', priority: -200 },
      { id: 'reactor-mid-chevron-motion', target: { bankId: 'reactor-chevron-bank' }, source: 'mid', operation: 'positionX', amount: 0.04, polarity: 'bipolar', curve: 'easeInOut', blend: 'add', clamp: [-0.08, 0.08], capabilityFallback: 'energy', priority: -196 },
      { id: 'reactor-high-node-density', target: { bankId: 'reactor-node-bank' }, source: 'high', operation: 'sparkleDensity', amount: 0.38, curve: 'exponential', blend: 'max', capabilityFallback: 'midHighActivity', priority: -192 },
      { id: 'reactor-air-cross-detail', target: { bankId: 'reactor-cross-bank' }, source: 'air', operation: 'brightness', amount: 0.28, curve: 'exponential', blend: 'add', capabilityFallback: 'midHighActivity', priority: -188 },
      { id: 'reactor-flux-ripple', target: { bankId: 'reactor-mid-band-bank' }, source: 'spectralFlux', operation: 'pixelDisplacement', amount: 0.09, curve: 'exponential', blend: 'add', clamp: [-0.15, 0.15], capabilityFallback: 'transient', priority: -184 },
      { id: 'reactor-complexity-checker', target: { bankId: 'reactor-checker-bank' }, source: 'complexity', operation: 'checkerAlternation', amount: 1, curve: 'stepped', blend: 'replace', capabilityFallback: 'energy', priority: -180 },
      { id: 'reactor-tension-convergence', target: { bankId: 'reactor-outer-ring-bank' }, source: 'tension', operation: 'maskContraction', amount: 0.14, curve: 'exponential', blend: 'max', capabilityFallback: 'energy', priority: -176 },
      { id: 'reactor-build-recruitment', target: { bankId: 'reactor-recruitment-bank' }, source: 'buildProgress', operation: 'rowRecruitment', amount: 1, curve: 'easeInOut', blend: 'replace', clamp: [0, 1], conditions: { sectionTypes: ['build', 'preDrop'] }, priority: -172 },
      { id: 'reactor-phrase-phase', target: { bankId: 'reactor-chevron-bank' }, source: 'phraseProgress', operation: 'columnRecruitment', amount: 1, curve: 'linear', blend: 'replace', clamp: [0, 1], priority: -168 },
    ],
    eventRoutes: [
      ...shared.eventRoutes,
      { id: 'reactor-downbeat-ring', target: { bankId: 'reactor-inner-ring-bank' }, event: 'downbeat', operation: 'maskContraction', amount: 0.18, envelope: { attack: 0, hold: 0.04, release: 0.2, curve: 'easeOut' }, capabilityFallback: 'beat', blend: 'max', priority: -128 },
      { id: 'reactor-four-bar-direction', target: { bankId: 'reactor-chevron-bank' }, event: 'fourBarBoundary', operation: 'directionReverse', amount: 1, envelope: { attack: 0, hold: 0.08, release: 0.16, curve: 'step' }, quantization: 'fourBars', capabilityFallback: 'beat', blend: 'replace', priority: -118 },
      { id: 'reactor-eight-bar-geometry', target: { bankId: 'reactor-recruitment-bank' }, event: 'eightBarBoundary', operation: 'maskExpansion', amount: 0.18, envelope: { attack: 0.02, hold: 0.14, release: 0.48, curve: 'easeInOut' }, quantization: 'eightBars', capabilityFallback: 'beat', blend: 'max', priority: -108 },
      { id: 'reactor-sixteen-bar-structure', target: { bankId: 'reactor-impact-bank' }, event: 'sixteenBarBoundary', operation: 'discreteRotation', amount: 1, envelope: { attack: 0, hold: 0.12, release: 0.42, curve: 'stepped' }, quantization: 'sixteenBars', capabilityFallback: 'beat', blend: 'replace', priority: -98 },
    ],
  } satisfies Pick<PixGridPerformanceProgram, 'continuousRoutes' | 'eventRoutes'>
}

function pixelParadeRoutes() {
  const shared = sharedRoutes('parade')
  return {
    continuousRoutes: [
      ...shared.continuousRoutes,
      { id: 'parade-bass-hero-bounce', target: { bankId: 'parade-hero-bank' }, source: 'bass', operation: 'positionY', amount: 0.04, polarity: 'bipolar', curve: 'smoothstep', blend: 'add', clamp: [-0.07, 0.07], capabilityFallback: 'energy', priority: -208 },
      { id: 'parade-low-mid-travel', target: { bankId: 'parade-travel-bank' }, source: 'lowMid', operation: 'positionX', amount: 0.045, curve: 'easeInOut', blend: 'add', clamp: [-0.08, 0.08], capabilityFallback: 'energy', priority: -204 },
      { id: 'parade-mid-support-motion', target: { bankId: 'parade-primary-bank' }, source: 'mid', operation: 'positionY', amount: 0.035, polarity: 'bipolar', curve: 'easeInOut', blend: 'add', clamp: [-0.06, 0.06], capabilityFallback: 'energy', priority: -200 },
      { id: 'parade-high-star-detail', target: { bankId: 'parade-star-bank' }, source: 'high', operation: 'sparkleDensity', amount: 0.4, curve: 'exponential', blend: 'max', capabilityFallback: 'midHighActivity', priority: -196 },
      { id: 'parade-complexity-pattern', target: { bankId: 'parade-background-bank' }, source: 'complexity', operation: 'checkerAlternation', amount: 1, curve: 'stepped', blend: 'replace', capabilityFallback: 'energy', priority: -192 },
      { id: 'parade-tension-spacing', target: { bankId: 'parade-cast-bank' }, source: 'tension', operation: 'maskContraction', amount: 0.12, curve: 'exponential', blend: 'max', capabilityFallback: 'energy', priority: -188 },
      { id: 'parade-build-cast-recruitment', target: { bankId: 'parade-recruitment-bank' }, source: 'buildProgress', operation: 'columnRecruitment', amount: 1, curve: 'easeInOut', blend: 'replace', clamp: [0, 1], conditions: { sectionTypes: ['build', 'preDrop'] }, priority: -184 },
      { id: 'parade-phrase-staging', target: { bankId: 'parade-cast-bank' }, source: 'phraseProgress', operation: 'columnRecruitment', amount: 1, curve: 'linear', blend: 'replace', clamp: [0, 1], priority: -180 },
      { id: 'parade-section-motion-arc', target: { bankId: 'parade-background-bank' }, source: 'sectionProgress', operation: 'rowRecruitment', amount: 1, curve: 'easeInOut', blend: 'replace', clamp: [0, 1], priority: -176 },
      { id: 'parade-vocal-hero-focus', target: { bankId: 'parade-hero-bank' }, source: 'vocalEnergy', operation: 'outlineIntensity', amount: 0.44, curve: 'easeInOut', blend: 'max', minimumConfidence: 0.35, capabilityFallback: 'energy', priority: -172 },
    ],
    eventRoutes: [
      ...shared.eventRoutes,
      { id: 'parade-downbeat-step', target: { bankId: 'parade-cast-bank' }, event: 'downbeat', operation: 'positionX', amount: 0.035, envelope: { attack: 0, hold: 0.04, release: 0.2, curve: 'overshoot' }, capabilityFallback: 'beat', blend: 'add', priority: -128 },
      { id: 'parade-four-bar-call-response', target: { bankId: 'parade-prop-bank' }, event: 'fourBarBoundary', operation: 'directionReverse', amount: 1, envelope: { attack: 0, hold: 0.08, release: 0.16, curve: 'step' }, quantization: 'fourBars', capabilityFallback: 'beat', blend: 'replace', priority: -118 },
      { id: 'parade-eight-bar-participants', target: { bankId: 'parade-recruitment-bank' }, event: 'eightBarBoundary', operation: 'reveal', amount: 1, envelope: { attack: 0, hold: 0.18, release: 0.52, curve: 'easeOut' }, quantization: 'eightBars', capabilityFallback: 'beat', blend: 'max', priority: -108 },
      { id: 'parade-sixteen-bar-cast', target: { bankId: 'parade-alternate-bank' }, event: 'sixteenBarBoundary', operation: 'maskExpansion', amount: 0.2, envelope: { attack: 0.02, hold: 0.16, release: 0.56, curve: 'easeInOut' }, quantization: 'sixteenBars', capabilityFallback: 'beat', blend: 'max', priority: -98 },
      { id: 'parade-semantic-hero-action', target: { bankId: 'parade-hero-bank' }, event: 'semanticMoment', operation: 'scale', amount: 0.12, envelope: { attack: 0.02, hold: 0.12, release: 0.44, curve: 'overshoot' }, capabilityFallback: 'disable', blend: 'max', priority: -88 },
    ],
  } satisfies Pick<PixGridPerformanceProgram, 'continuousRoutes' | 'eventRoutes'>
}

const COMMON_ARCS = [
  {
    id: "density-arc",
    kind: "density",
    defaultValue: 0.6,
    sectionValues: {
      intro: 0.3,
      verse: 0.55,
      build: 0.78,
      preDrop: 0.3,
      drop: 1,
      breakdown: 0.4,
      outro: 0.26,
    },
    occurrenceDelta: 0.025,
    clamp: [0.18, 1],
  },
  {
    id: "palette-arc",
    kind: "paletteIntensity",
    defaultValue: 0.66,
    sectionValues: {
      intro: 0.44,
      verse: 0.62,
      build: 0.84,
      preDrop: 0.52,
      drop: 1,
      breakdown: 0.5,
      outro: 0.36,
    },
    occurrenceDelta: 0.02,
  },
  {
    id: "motion-arc",
    kind: "motion",
    defaultValue: 0.72,
    sectionValues: {
      intro: 0.42,
      verse: 0.68,
      build: 0.96,
      preDrop: 0.08,
      drop: 0.92,
      breakdown: 0.48,
      outro: 0.32,
    },
    occurrenceDelta: 0.025,
    clamp: [0.04, 1.1],
  },
  {
    id: "contrast-arc",
    kind: "contrast",
    defaultValue: 0.7,
    sectionValues: {
      intro: 0.55,
      verse: 0.68,
      build: 0.82,
      preDrop: 0.52,
      drop: 1,
      breakdown: 0.58,
      outro: 0.46,
    },
  },
  {
    id: "negative-space-arc",
    kind: "negativeSpace",
    defaultValue: 0.34,
    sectionValues: {
      intro: 0.64,
      verse: 0.42,
      build: 0.28,
      preDrop: 0.78,
      drop: 0.12,
      breakdown: 0.58,
      outro: 0.72,
    },
    occurrenceDelta: -0.015,
  },
  {
    id: "recruitment-arc",
    kind: "recruitment",
    defaultValue: 0.58,
    sectionValues: {
      intro: 0.22,
      verse: 0.48,
      build: 0.76,
      preDrop: 0.24,
      drop: 1,
      breakdown: 0.38,
      outro: 0.2,
    },
    occurrenceDelta: 0.03,
  },
  {
    id: "impact-arc",
    kind: "impactStrength",
    defaultValue: 0.72,
    sectionValues: {
      intro: 0.35,
      verse: 0.62,
      build: 0.78,
      preDrop: 0.34,
      drop: 1,
      breakdown: 0.46,
      outro: 0.28,
    },
    occurrenceDelta: 0.02,
  },
  {
    id: "detail-arc",
    kind: "sparkleDetail",
    defaultValue: 0.52,
    sectionValues: {
      intro: 0.24,
      verse: 0.54,
      build: 0.72,
      preDrop: 0.18,
      drop: 0.88,
      breakdown: 0.42,
      outro: 0.2,
    },
    occurrenceDelta: 0.015,
  },
  {
    id: "background-arc",
    kind: "backgroundActivity",
    defaultValue: 0.38,
    sectionValues: {
      intro: 0.16,
      verse: 0.34,
      build: 0.56,
      preDrop: 0.12,
      drop: 0.72,
      breakdown: 0.24,
      outro: 0.12,
    },
  },
] satisfies PixGridPerformanceProgram["musicalArcs"];

const BASS_ARCHITECTURE = {
  visualRoles: VISUAL_ROLES,
  bindings: [
    { id: 'bass-hero-binding', target: { kind: 'layer', id: 'bass-word' }, roles: ['hero', 'primary', 'bass', 'typography'] },
    { id: 'bass-outline-binding', target: { kind: 'group', id: 'bass-snare-group' }, roles: ['outline', 'secondary', 'percussion'] },
    { id: 'bass-impact-binding', target: { kind: 'group', id: 'bass-kick-group' }, roles: ['impact', 'bass', 'transition'] },
    { id: 'bass-sparkle-binding', target: { kind: 'group', id: 'bass-hat-group' }, roles: ['sparkle', 'accent', 'atmosphere', 'percussion'] },
    { id: 'bass-body-group-binding', target: { kind: 'group', id: 'bass-body-group' }, roles: ['hero', 'primary', 'bass', 'typography'] },
    { id: 'bass-letter-b-binding', target: { kind: 'group', id: 'bass-letter-b-group' }, roles: ['accent', 'typography'] },
    { id: 'bass-letter-a-binding', target: { kind: 'group', id: 'bass-letter-a-group' }, roles: ['accent', 'vocalFocus', 'typography'] },
    { id: 'bass-letter-s-left-binding', target: { kind: 'group', id: 'bass-letter-s-left-group' }, roles: ['accent', 'typography'] },
    { id: 'bass-letter-s-right-binding', target: { kind: 'group', id: 'bass-letter-s-right-group' }, roles: ['accent', 'typography'] },
    { id: 'bass-highlight-binding', target: { kind: 'group', id: 'bass-highlight-travel-group' }, roles: ['accent', 'transition', 'typography'] },
    { id: 'bass-side-binding', target: { kind: 'group', id: 'bass-side-accent-group' }, roles: ['secondary', 'percussion', 'transition'] },
    { id: 'bass-row-binding', target: { kind: 'group', id: 'bass-row-recruitment-group' }, roles: ['transition', 'typography'] },
    { id: 'bass-center-impact-binding', target: { kind: 'group', id: 'bass-center-impact-group' }, roles: ['impact', 'bass', 'primary'] },
    { id: 'bass-edge-snare-binding', target: { kind: 'group', id: 'bass-edge-snare-group' }, roles: ['outline', 'percussion', 'secondary'] },
  ],
  banks: [
    { id: 'bass-hero-bank', roles: ['hero'], members: [{ kind: 'group', id: 'bass-body-group' }] },
    { id: 'bass-bass-bank', roles: ['bass'], members: [{ kind: 'group', id: 'bass-center-impact-group' }, { kind: 'group', id: 'bass-kick-group' }, { kind: 'group', id: 'bass-body-group' }] },
    { id: 'bass-snare-bank', roles: ['percussion', 'outline'], members: [{ kind: 'group', id: 'bass-edge-snare-group' }, { kind: 'group', id: 'bass-snare-group' }, { kind: 'group', id: 'bass-side-accent-group' }] },
    { id: 'bass-hat-bank', roles: ['sparkle'], members: [{ kind: 'group', id: 'bass-hat-group' }] },
    { id: 'bass-accent-bank', roles: ['accent'], members: [{ kind: 'group', id: 'bass-highlight-travel-group' }, { kind: 'group', id: 'bass-side-accent-group' }] },
    { id: 'bass-letter-bank', roles: ['typography'], members: [{ kind: 'group', id: 'bass-letter-b-group' }, { kind: 'group', id: 'bass-letter-a-group' }, { kind: 'group', id: 'bass-letter-s-left-group' }, { kind: 'group', id: 'bass-letter-s-right-group' }] },
    { id: 'bass-highlight-bank', roles: ['accent'], members: [{ kind: 'group', id: 'bass-highlight-travel-group' }] },
    { id: 'bass-side-bank', roles: ['secondary'], members: [{ kind: 'group', id: 'bass-side-accent-group' }] },
    { id: 'bass-row-bank', roles: ['transition'], members: [{ kind: 'group', id: 'bass-row-recruitment-group' }] },
    { id: 'bass-recruitment-bank', members: [{ kind: 'group', id: 'bass-row-recruitment-group' }, { kind: 'group', id: 'bass-side-accent-group' }, { kind: 'group', id: 'bass-hat-group' }] },
    { id: 'bass-transition-bank', roles: ['transition'], members: [{ kind: 'group', id: 'bass-row-recruitment-group' }, { kind: 'group', id: 'bass-body-group' }] },
    { id: 'bass-impact-bank', roles: ['impact'], members: [{ kind: 'group', id: 'bass-center-impact-group' }, { kind: 'group', id: 'bass-kick-group' }] },
  ],
  ...bassBeaconRoutes(),
  musicalArcs: COMMON_ARCS,
} satisfies Pick<PixGridPerformanceProgram, 'visualRoles' | 'bindings' | 'banks' | 'continuousRoutes' | 'eventRoutes' | 'musicalArcs'>;

const REACTOR_ARCHITECTURE = {
  visualRoles: VISUAL_ROLES,
  bindings: [
    { id: 'reactor-core-binding', target: { kind: 'group', id: 'reactor-core-group' }, roles: ['hero', 'primary', 'bass', 'impact'] },
    { id: 'reactor-inner-ring-binding', target: { kind: 'group', id: 'reactor-inner-ring-group' }, roles: ['primary', 'bass'] },
    { id: 'reactor-outer-ring-binding', target: { kind: 'group', id: 'reactor-outer-ring-group' }, roles: ['hero', 'environment', 'transition'] },
    { id: 'reactor-chevron-binding', target: { kind: 'group', id: 'reactor-chevron-group' }, roles: ['secondary', 'accent'] },
    { id: 'reactor-mid-band-binding', target: { kind: 'group', id: 'reactor-mid-band-group' }, roles: ['secondary', 'environment'] },
    { id: 'reactor-node-binding', target: { kind: 'group', id: 'reactor-node-group' }, roles: ['sparkle', 'atmosphere', 'percussion'] },
    { id: 'reactor-cross-binding', target: { kind: 'group', id: 'reactor-cross-group' }, roles: ['outline', 'accent', 'percussion'] },
    { id: 'reactor-checker-binding', target: { kind: 'group', id: 'reactor-checker-group' }, roles: ['background', 'environment'] },
    { id: 'reactor-impact-binding', target: { kind: 'group', id: 'reactor-impact-group' }, roles: ['impact', 'transition'] },
    { id: 'reactor-recruitment-binding', target: { kind: 'group', id: 'reactor-recruitment-group' }, roles: ['transition', 'background'] },
    { id: 'reactor-center-impact-binding', target: { kind: 'group', id: 'reactor-center-impact-group' }, roles: ['impact', 'bass', 'primary'] },
    { id: 'reactor-edge-snare-binding', target: { kind: 'group', id: 'reactor-edge-snare-group' }, roles: ['outline', 'percussion', 'secondary'] },
  ],
  banks: [
    { id: 'reactor-hero-bank', roles: ['hero'], members: [{ kind: 'group', id: 'reactor-core-group' }, { kind: 'group', id: 'reactor-outer-ring-group' }] },
    { id: 'reactor-bass-bank', roles: ['bass'], members: [{ kind: 'group', id: 'reactor-center-impact-group' }, { kind: 'group', id: 'reactor-core-group' }, { kind: 'group', id: 'reactor-inner-ring-group' }] },
    { id: 'reactor-snare-bank', roles: ['percussion'], members: [{ kind: 'group', id: 'reactor-edge-snare-group' }, { kind: 'group', id: 'reactor-cross-group' }] },
    { id: 'reactor-hat-bank', roles: ['sparkle'], members: [{ kind: 'group', id: 'reactor-node-group' }] },
    { id: 'reactor-accent-bank', roles: ['accent'], members: [{ kind: 'group', id: 'reactor-cross-group' }, { kind: 'group', id: 'reactor-chevron-group' }] },
    { id: 'reactor-core-bank', members: [{ kind: 'group', id: 'reactor-core-group' }] },
    { id: 'reactor-inner-ring-bank', members: [{ kind: 'group', id: 'reactor-inner-ring-group' }] },
    { id: 'reactor-outer-ring-bank', members: [{ kind: 'group', id: 'reactor-outer-ring-group' }] },
    { id: 'reactor-chevron-bank', members: [{ kind: 'group', id: 'reactor-chevron-group' }] },
    { id: 'reactor-mid-band-bank', members: [{ kind: 'group', id: 'reactor-mid-band-group' }] },
    { id: 'reactor-node-bank', members: [{ kind: 'group', id: 'reactor-node-group' }] },
    { id: 'reactor-cross-bank', members: [{ kind: 'group', id: 'reactor-cross-group' }] },
    { id: 'reactor-checker-bank', members: [{ kind: 'group', id: 'reactor-checker-group' }] },
    { id: 'reactor-recruitment-bank', members: [{ kind: 'group', id: 'reactor-recruitment-group' }] },
    { id: 'reactor-transition-bank', roles: ['transition'], members: [{ kind: 'group', id: 'reactor-outer-ring-group' }, { kind: 'group', id: 'reactor-chevron-group' }] },
    { id: 'reactor-impact-bank', roles: ['impact'], members: [{ kind: 'group', id: 'reactor-center-impact-group' }, { kind: 'group', id: 'reactor-impact-group' }, { kind: 'group', id: 'reactor-core-group' }] },
  ],
  ...geometricReactorRoutes(),
  musicalArcs: COMMON_ARCS,
} satisfies Pick<PixGridPerformanceProgram, 'visualRoles' | 'bindings' | 'banks' | 'continuousRoutes' | 'eventRoutes' | 'musicalArcs'>;

const PARADE_ARCHITECTURE = {
  visualRoles: VISUAL_ROLES,
  bindings: [
    { id: 'parade-hero-binding', target: { kind: 'group', id: 'parade-hero-group' }, roles: ['hero', 'character', 'primary', 'vocalFocus'] },
    { id: 'parade-primary-binding', target: { kind: 'group', id: 'parade-foreground-group' }, roles: ['primary', 'character', 'percussion'] },
    { id: 'parade-secondary-binding', target: { kind: 'group', id: 'parade-secondary-group' }, roles: ['secondary', 'character', 'accent'] },
    { id: 'parade-ground-binding', target: { kind: 'group', id: 'parade-ground-group' }, roles: ['environment', 'bass'] },
    { id: 'parade-background-binding', target: { kind: 'group', id: 'parade-background-group' }, roles: ['background', 'environment'] },
    { id: 'parade-star-binding', target: { kind: 'group', id: 'parade-star-group' }, roles: ['sparkle', 'atmosphere', 'percussion'] },
    { id: 'parade-prop-binding', target: { kind: 'group', id: 'parade-prop-group' }, roles: ['accent', 'percussion'] },
    { id: 'parade-impact-binding', target: { kind: 'group', id: 'parade-impact-group' }, roles: ['impact', 'bass', 'transition'] },
    { id: 'parade-recruitment-binding', target: { kind: 'group', id: 'parade-recruitment-group' }, roles: ['transition', 'character'] },
    { id: 'parade-alternate-binding', target: { kind: 'group', id: 'parade-alternate-layout-group' }, roles: ['transition', 'environment'] },
    { id: 'parade-lower-kick-binding', target: { kind: 'group', id: 'parade-lower-kick-lane-group' }, roles: ['impact', 'bass', 'primary'] },
    { id: 'parade-upper-snare-binding', target: { kind: 'group', id: 'parade-upper-snare-lane-group' }, roles: ['outline', 'percussion', 'secondary'] },
  ],
  banks: [
    { id: 'parade-hero-bank', roles: ['hero'], members: [{ kind: 'group', id: 'parade-hero-group' }] },
    { id: 'parade-bass-bank', roles: ['bass'], members: [{ kind: 'group', id: 'parade-lower-kick-lane-group' }, { kind: 'group', id: 'parade-impact-group' }, { kind: 'group', id: 'parade-ground-group' }] },
    { id: 'parade-snare-bank', roles: ['percussion'], members: [{ kind: 'group', id: 'parade-upper-snare-lane-group' }, { kind: 'group', id: 'parade-prop-group' }] },
    { id: 'parade-hat-bank', roles: ['sparkle'], members: [{ kind: 'group', id: 'parade-star-group' }] },
    { id: 'parade-accent-bank', roles: ['accent'], members: [{ kind: 'group', id: 'parade-prop-group' }, { kind: 'group', id: 'parade-secondary-group' }] },
    { id: 'parade-primary-bank', members: [{ kind: 'group', id: 'parade-foreground-group' }] },
    { id: 'parade-travel-bank', members: [{ kind: 'group', id: 'parade-secondary-group' }, { kind: 'group', id: 'parade-ground-group' }] },
    { id: 'parade-star-bank', members: [{ kind: 'group', id: 'parade-star-group' }] },
    { id: 'parade-background-bank', members: [{ kind: 'group', id: 'parade-background-group' }] },
    { id: 'parade-cast-bank', members: [{ kind: 'group', id: 'parade-hero-group' }, { kind: 'group', id: 'parade-foreground-group' }, { kind: 'group', id: 'parade-secondary-group' }] },
    { id: 'parade-prop-bank', members: [{ kind: 'group', id: 'parade-prop-group' }] },
    { id: 'parade-recruitment-bank', members: [{ kind: 'group', id: 'parade-recruitment-group' }] },
    { id: 'parade-alternate-bank', members: [{ kind: 'group', id: 'parade-alternate-layout-group' }] },
    { id: 'parade-transition-bank', roles: ['transition'], members: [{ kind: 'group', id: 'parade-alternate-layout-group' }, { kind: 'group', id: 'parade-hero-group' }] },
    { id: 'parade-impact-bank', roles: ['impact'], members: [{ kind: 'group', id: 'parade-lower-kick-lane-group' }, { kind: 'group', id: 'parade-impact-group' }] },
  ],
  ...pixelParadeRoutes(),
  musicalArcs: COMMON_ARCS,
} satisfies Pick<PixGridPerformanceProgram, 'visualRoles' | 'bindings' | 'banks' | 'continuousRoutes' | 'eventRoutes' | 'musicalArcs'>;

const intro = (
  sceneId: string,
  extra: readonly PixGridPerformanceAction[] = [],
): readonly PixGridPerformanceAction[] => [
  { type: "setScene", sceneId },
  { type: "setTransition", transition: "fade", durationBeats: 2 },
  { type: "setDensity", density: 0.34 },
  ...extra,
];
const verse = (
  sceneId: string,
  extra: readonly PixGridPerformanceAction[] = [],
): readonly PixGridPerformanceAction[] => [
  { type: "setScene", sceneId },
  { type: "setTransition", transition: "fade", durationBeats: 1 },
  { type: "setDensity", density: 0.58 },
  ...extra,
];
const build = (
  sceneId: string,
  extra: readonly PixGridPerformanceAction[] = [],
): readonly PixGridPerformanceAction[] => [
  { type: "setScene", sceneId },
  { type: "setTransition", transition: "wipeRows", durationBeats: 1 },
  { type: "setDensity", density: 0.82 },
  ...extra,
];
const preDrop = (
  sceneId: string,
  extra: readonly PixGridPerformanceAction[] = [],
): readonly PixGridPerformanceAction[] => [
  { type: "setScene", sceneId },
  { type: "setTransition", transition: "wipeColumns", durationBeats: 0.5 },
  { type: "setDensity", density: 0.28 },
  ...extra,
];
const drop = (
  sceneId: string,
  extra: readonly PixGridPerformanceAction[] = [],
): readonly PixGridPerformanceAction[] => [
  { type: "setScene", sceneId },
  { type: "setTransition", transition: "cut" },
  { type: "setDensity", density: 1 },
  ...extra,
];
const breakdown = (
  sceneId: string,
  extra: readonly PixGridPerformanceAction[] = [],
): readonly PixGridPerformanceAction[] => [
  { type: "setScene", sceneId },
  { type: "setTransition", transition: "dissolve", durationBeats: 2 },
  { type: "setDensity", density: 0.42 },
  ...extra,
];
const outro = (
  sceneId: string,
  extra: readonly PixGridPerformanceAction[] = [],
): readonly PixGridPerformanceAction[] => [
  { type: "setScene", sceneId },
  { type: "setTransition", transition: "wipeColumns", durationBeats: 2 },
  { type: "setDensity", density: 0.26 },
  ...extra,
];

export const BASS_BEACON_PERFORMANCE_PROGRAM = defineProgram({
  schemaVersion: PIX_GRID_PERFORMANCE_PROGRAM_SCHEMA_VERSION,
  id: "pix-grid-bass-beacon-performance",
  metadata: {
    name: "Bass Beacon Full-Song Performance",
    description:
      "Readable BASS typography with separated kick, snare, and hat roles across a complete song arc.",
    engine: "pixGrid",
    version: 1,
    visualIdentity: "typographic beacon",
  },
  ...BASS_ARCHITECTURE,
  fallbackOrder: ["verse", "intro", "breakdown", "drop", "outro"],
  fallbackSectionPlanId: "bass-fallback",
  sectionPlans: [
    {
      id: "bass-intro",
      sectionTypes: ["intro"],
      priority: 20,
      actions: intro("pix-grid-bass-beacon-intro", [
        { type: "setLayerActive", layerId: "bass-word", active: true },
        { type: "setLayerOpacity", layerId: "bass-word", opacity: 0.34 },
        { type: "setLayerActive", layerId: "bass-outline", active: true },
        { type: "setLayerOpacity", layerId: "bass-outline", opacity: 0.22 },
        { type: "setLayerOpacity", layerId: "bass-rings", opacity: 0.18 },
        { type: "setLayerActive", layerId: "bass-sparkles", active: false },
        { type: "setBackgroundState", state: "dim", brightness: 0.06 },
      ]),
      fourBarActions: [
        [
          {
            type: "setPaletteRole",
            target: { layerId: "bass-outline" },
            role: "primary",
          },
        ],
        [
          {
            type: "setPaletteRole",
            target: { layerId: "bass-outline" },
            role: "secondary",
          },
        ],
      ],
      eventActions: {
        downbeat: [
          { type: "flashGroup", groupId: "bass-body-group", amount: 0.18 },
        ],
      },
    },
    {
      id: "bass-verse",
      sectionTypes: ["verse", "bridge"],
      priority: 20,
      actions: verse("pix-grid-bass-beacon-verse", [
        {
          type: "setGroupBrightness",
          groupId: "bass-body-group",
          brightness: 0.78,
        },
        {
          type: "setGroupBrightness",
          groupId: "bass-snare-group",
          brightness: 0.55,
        },
        {
          type: "setGroupBrightness",
          groupId: "bass-hat-group",
          brightness: 0.28,
        },
        { type: "setLayerOpacity", layerId: "bass-rings", opacity: 0.24 },
      ]),
      fourBarActions: [
        [{ type: "shiftGroup", groupId: "bass-snare-group", x: -0.012 }],
        [{ type: "shiftGroup", groupId: "bass-snare-group", x: 0.012 }],
        [
          {
            type: "changeAnimationSpeed",
            target: { groupId: "bass-hat-group" },
            multiplier: 0.82,
          },
        ],
        [
          {
            type: "changeAnimationSpeed",
            target: { groupId: "bass-hat-group" },
            multiplier: 1.12,
          },
        ],
      ],
      eventActions: {
        kick: [
          { type: "flashGroup", groupId: "bass-center-impact-group", amount: 0.58 },
        ],
        snare: [
          {
            type: "flashGroup",
            groupId: "bass-edge-snare-group",
            amount: 0.68,
            paletteRole: "highlight",
          },
        ],
        hat: [{ type: "flashGroup", groupId: "bass-hat-group", amount: 0.18 }],
      },
    },
    {
      id: "bass-build",
      sectionTypes: ["build"],
      priority: 25,
      actions: build("pix-grid-bass-beacon-build", [
        { type: "revealRows", target: "all", progress: 0.68, from: "bottom" },
        { type: "changeAnimationSpeed", target: "all", multiplier: 1.12 },
        { type: "setPaletteRole", target: "all", role: "secondary" },
      ]),
      fourBarActions: [
        [{ type: "revealRows", target: "all", progress: 0.74, from: "bottom" }],
        [
          {
            type: "revealColumns",
            target: "all",
            progress: 0.84,
            from: "center",
          },
        ],
        [
          {
            type: "recruitLayer",
            layerId: "bass-side-chevrons-left",
            opacity: 0.65,
          },
          {
            type: "recruitLayer",
            layerId: "bass-side-chevrons-right",
            opacity: 0.65,
          },
        ],
        [{ type: "recruitLayer", layerId: "bass-sparkles", opacity: 0.52 }],
      ],
      eventActions: {
        kick: [
          { type: "flashGroup", groupId: "bass-center-impact-group", amount: 0.64 },
        ],
        snare: [
          { type: "flashGroup", groupId: "bass-edge-snare-group", amount: 0.72 },
        ],
        transient: [
          {
            type: "triggerFrame",
            target: { groupId: "bass-hat-group" },
            step: 0.12,
          },
        ],
      },
    },
    {
      id: "bass-pre-drop",
      sectionTypes: ["preDrop"],
      priority: 36,
      continuousRouteIds: ["energy-hero"],
      eventRouteIds: ["bar-motif", "section-entry-route"],
      motionState: { amount: 0.06, direction: "alternate", grammar: "bass-pre-drop-freeze" },
      negativeSpaceTarget: 0.82,
      intensityRange: [0.22, 0.52],
      actions: preDrop("pix-grid-bass-beacon-preDrop", [
        { type: "setLayerActive", layerId: "bass-rings", active: false },
        { type: "setLayerActive", layerId: "bass-sparkles", active: false },
        { type: "setLayerActive", layerId: "bass-side-chevrons-left", active: false },
        { type: "setLayerActive", layerId: "bass-side-chevrons-right", active: false },
        { type: "setLayerOpacity", layerId: "bass-word", opacity: 0.46 },
        { type: "setLayerOpacity", layerId: "bass-outline", opacity: 0.14 },
        { type: "changeAnimationSpeed", target: "all", multiplier: 0.05 },
      ]),
      fourBarActions: [
        [{ type: "revealColumns", target: { groupId: "bass-body-group" }, progress: 0.25, from: "left" }],
        [{ type: "revealColumns", target: { groupId: "bass-body-group" }, progress: 0.5, from: "left" }],
        [{ type: "revealColumns", target: { groupId: "bass-body-group" }, progress: 0.75, from: "left" }],
        [{ type: "revealColumns", target: { groupId: "bass-body-group" }, progress: 1, from: "left" }],
      ],
      entryActions: [{ type: "dissolveGroup", groupId: "bass-kick-group", amount: 0.65 }],
    },
    {
      id: "bass-drop-one",
      sectionTypes: ["drop"],
      dropOccurrence: { occurrences: [1] },
      priority: 40,
      actions: drop("pix-grid-bass-beacon-drop", [
        {
          type: "setGroupBrightness",
          groupId: "bass-body-group",
          brightness: 1,
        },
        {
          type: "setGroupBrightness",
          groupId: "bass-kick-group",
          brightness: 0.76,
        },
        {
          type: "setGroupBrightness",
          groupId: "bass-snare-group",
          brightness: 0.82,
        },
        {
          type: "setGroupBrightness",
          groupId: "bass-hat-group",
          brightness: 0.5,
        },
      ]),
      entryActions: [
        { type: "flashGroup", groupId: "bass-body-group", amount: 0.64 },
      ],
      bodyActions: [
        {
          type: "setGroupBrightness",
          groupId: "bass-body-group",
          brightness: 0.94,
        },
      ],
      exitActions: [
        { type: "dissolveGroup", groupId: "bass-hat-group", amount: 0.28 },
      ],
      variations: [
        {
          id: "cyan-core",
          weight: 2,
          actions: [
            {
              type: "setPaletteRole",
              target: { groupId: "bass-body-group" },
              role: "primary",
            },
          ],
        },
        {
          id: "emerald-core",
          weight: 1,
          actions: [
            {
              type: "setPaletteRole",
              target: { groupId: "bass-body-group" },
              role: "secondary",
            },
          ],
        },
      ],
      fourBarActions: [
        [{ type: "reverseDirection", target: { groupId: "bass-snare-group" } }],
        [{ type: "shiftGroup", groupId: "bass-kick-group", y: -0.018 }],
        [{ type: "shiftGroup", groupId: "bass-kick-group", y: 0.018 }],
        [
          {
            type: "triggerFrame",
            target: { groupId: "bass-hat-group" },
            step: 0.2,
          },
        ],
      ],
      eightBarRecruitment: [
        [{ type: "recruitLayer", layerId: "bass-rings", opacity: 0.42 }],
        [
          { type: "recruitLayer", layerId: "bass-sparkles", opacity: 0.62 },
          {
            type: "setGroupBrightness",
            groupId: "bass-snare-group",
            brightness: 0.92,
          },
        ],
      ],
      sixteenBarEvolution: [
        [{ type: "changeAnimationSpeed", target: "all", multiplier: 1.08 }],
        [
          { type: "setPaletteRole", target: "all", role: "accent" },
          { type: "changeAnimationSpeed", target: "all", multiplier: 1.18 },
        ],
      ],
      eventActions: {
        kick: [{ type: "flashGroup", groupId: "bass-kick-group", amount: 0.7 }],
        snare: [
          {
            type: "flashGroup",
            groupId: "bass-snare-group",
            amount: 0.78,
            paletteRole: "highlight",
          },
        ],
        hat: [{ type: "flashGroup", groupId: "bass-hat-group", amount: 0.28 }],
        semanticMoment: [
          { type: "flashGroup", groupId: "bass-body-group", amount: 0.58 },
        ],
      },
    },
    {
      id: "bass-drop-evolved",
      sectionTypes: ["drop"],
      dropOccurrence: { minOccurrence: 2 },
      priority: 45,
      actions: drop("pix-grid-bass-beacon-drop", [
        { type: "setPaletteRole", target: "all", role: "secondary" },
        { type: "recruitLayer", layerId: "bass-rings", opacity: 0.62 },
        { type: "recruitLayer", layerId: "bass-sparkles", opacity: 0.72 },
        {
          type: "setGroupBrightness",
          groupId: "bass-body-group",
          brightness: 1,
        },
        { type: "shiftGroup", groupId: "bass-snare-group", y: -0.02 },
      ]),
      entryActions: [
        { type: "flashGroup", groupId: "bass-body-group", amount: 0.72 },
      ],
      bodyActions: [
        {
          type: "setGroupBrightness",
          groupId: "bass-hat-group",
          brightness: 0.72,
        },
      ],
      exitActions: [
        { type: "dissolveGroup", groupId: "bass-snare-group", amount: 0.24 },
      ],
      fourBarActions: [
        [{ type: "reverseDirection", target: "all" }],
        [
          {
            type: "setPaletteRole",
            target: { groupId: "bass-body-group" },
            role: "accent",
          },
        ],
        [{ type: "shiftGroup", groupId: "bass-kick-group", x: -0.022 }],
        [{ type: "shiftGroup", groupId: "bass-kick-group", x: 0.022 }],
      ],
      eightBarRecruitment: [
        [
          {
            type: "setGroupBrightness",
            groupId: "bass-hat-group",
            brightness: 0.68,
          },
        ],
        [{ type: "changeAnimationSpeed", target: "all", multiplier: 1.24 }],
      ],
      sixteenBarEvolution: [
        [
          {
            type: "changeAnimation",
            layerId: "bass-sparkles",
            animation: "checkerAlternate",
            speed: 8,
            amount: 1,
          },
        ],
        [
          { type: "setPaletteRole", target: "all", role: "highlight" },
          { type: "setBackgroundState", state: "lifted", brightness: 0.18 },
        ],
      ],
      eventActions: {
        kick: [
          { type: "flashGroup", groupId: "bass-kick-group", amount: 0.78 },
        ],
        snare: [
          {
            type: "flashGroup",
            groupId: "bass-snare-group",
            amount: 0.82,
            paletteRole: "highlight",
          },
        ],
        hat: [{ type: "flashGroup", groupId: "bass-hat-group", amount: 0.34 }],
        semanticMoment: [{ type: "triggerFrame", target: "all", step: 0.35 }],
      },
    },
    {
      id: "bass-breakdown",
      sectionTypes: ["breakdown"],
      priority: 20,
      actions: breakdown("pix-grid-bass-beacon-breakdown", [
        {
          type: "setGroupBrightness",
          groupId: "bass-body-group",
          brightness: 0.48,
        },
        { type: "setLayerActive", layerId: "bass-rings", active: false },
        { type: "setLayerActive", layerId: "bass-sparkles", active: false },
        { type: "changeAnimationSpeed", target: "all", multiplier: 0.42 },
        { type: "setPaletteRole", target: "all", role: "highlight" },
      ]),
    },
    {
      id: "bass-outro",
      sectionTypes: ["outro"],
      priority: 20,
      actions: outro("pix-grid-bass-beacon-outro", [
        { type: "revealRows", target: "all", progress: 0.38, from: "top" },
        {
          type: "setGroupBrightness",
          groupId: "bass-body-group",
          brightness: 0.42,
        },
        { type: "setLayerActive", layerId: "bass-rings", active: false },
        { type: "setLayerActive", layerId: "bass-sparkles", active: false },
      ]),
      exitActions: [{ type: "clear" }],
    },
    {
      id: "bass-fallback",
      sectionTypes: ["unknown"],
      priority: 1,
      actions: verse("pix-grid-bass-beacon-verse", [
        {
          type: "setGroupBrightness",
          groupId: "bass-body-group",
          brightness: 0.68,
        },
      ]),
      eventActions: {
        beat: [
          { type: "flashGroup", groupId: "bass-body-group", amount: 0.22 },
        ],
      },
    },
  ],
});

export const GEOMETRIC_REACTOR_PERFORMANCE_PROGRAM = defineProgram({
  schemaVersion: PIX_GRID_PERFORMANCE_PROGRAM_SCHEMA_VERSION,
  id: "pix-grid-geometric-reactor-performance",
  metadata: {
    name: "Geometric Reactor Full-Song Performance",
    engine: "pixGrid",
    version: 1,
    visualIdentity: "coherent geometric reactor",
  },
  ...REACTOR_ARCHITECTURE,
  fallbackOrder: ["verse", "intro", "breakdown", "drop", "outro"],
  fallbackSectionPlanId: "reactor-fallback",
  sectionPlans: [
    {
      id: "reactor-intro",
      sectionTypes: ["intro"],
      priority: 20,
      actions: intro("pix-grid-geometric-reactor-intro", [
        {
          type: "setGroupBrightness",
          groupId: "reactor-core-group",
          brightness: 0.46,
        },
        {
          type: "setGroupBrightness",
          groupId: "reactor-chevron-group",
          brightness: 0.36,
        },
        {
          type: "setGroupActive",
          groupId: "reactor-node-group",
          active: false,
        },
        { type: "changeAnimationSpeed", target: "all", multiplier: 0.58 },
      ]),
      fourBarActions: [
        [
          {
            type: "reverseDirection",
            target: { groupId: "reactor-core-group" },
          },
        ],
        [
          {
            type: "setPaletteRole",
            target: { groupId: "reactor-chevron-group" },
            role: "secondary",
          },
        ],
      ],
    },
    {
      id: "reactor-verse",
      sectionTypes: ["verse", "bridge"],
      priority: 20,
      actions: verse("pix-grid-geometric-reactor-verse", [
        {
          type: "setGroupBrightness",
          groupId: "reactor-core-group",
          brightness: 0.72,
        },
        {
          type: "setGroupBrightness",
          groupId: "reactor-chevron-group",
          brightness: 0.62,
        },
        {
          type: "setGroupBrightness",
          groupId: "reactor-node-group",
          brightness: 0.32,
        },
      ]),
      fourBarActions: [
        [
          {
            type: "reverseDirection",
            target: { groupId: "reactor-core-group" },
          },
        ],
        [{ type: "shiftGroup", groupId: "reactor-chevron-group", x: 0.014 }],
        [{ type: "shiftGroup", groupId: "reactor-chevron-group", x: -0.014 }],
        [
          {
            type: "triggerFrame",
            target: { groupId: "reactor-node-group" },
            step: 0.16,
          },
        ],
      ],
      eventActions: {
        kick: [
          { type: "flashGroup", groupId: "reactor-center-impact-group", amount: 0.62 },
        ],
        snare: [
          { type: "flashGroup", groupId: "reactor-edge-snare-group", amount: 0.68 },
        ],
        hat: [
          { type: "flashGroup", groupId: "reactor-node-group", amount: 0.2 },
        ],
      },
    },
    {
      id: "reactor-build",
      sectionTypes: ["build"],
      priority: 25,
      actions: build("pix-grid-geometric-reactor-build", [
        {
          type: "revealColumns",
          target: "all",
          progress: 0.72,
          from: "center",
        },
        { type: "changeAnimationSpeed", target: "all", multiplier: 1.14 },
        { type: "recruitLayer", layerId: "reactor-cross", opacity: 0.62 },
      ]),
      fourBarActions: [
        [
          {
            type: "setPaletteRole",
            target: { groupId: "reactor-core-group" },
            role: "primary",
          },
        ],
        [
          {
            type: "setPaletteRole",
            target: { groupId: "reactor-chevron-group" },
            role: "secondary",
          },
        ],
        [{ type: "recruitLayer", layerId: "reactor-checker", opacity: 0.28 }],
        [{ type: "recruitLayer", layerId: "reactor-orbits", opacity: 0.72 }],
      ],
      eventActions: {
        transient: [{ type: "triggerFrame", target: "all", step: 0.16 }],
      },
    },
    {
      id: "reactor-pre-drop",
      sectionTypes: ["preDrop"],
      priority: 36,
      continuousRouteIds: ["energy-hero"],
      eventRouteIds: ["bar-motif", "section-entry-route"],
      motionState: { amount: 0.05, direction: "alternate", grammar: "reactor-pre-drop-lock" },
      negativeSpaceTarget: 0.84,
      intensityRange: [0.2, 0.5],
      actions: preDrop("pix-grid-geometric-reactor-preDrop", [
        { type: "setLayerActive", layerId: "reactor-checker", active: false },
        { type: "setLayerActive", layerId: "reactor-chevrons", active: false },
        { type: "setLayerActive", layerId: "reactor-cross", active: false },
        { type: "setLayerActive", layerId: "reactor-orbits", active: false },
        { type: "setLayerOpacity", layerId: "reactor-tunnel", opacity: 0.18 },
        { type: "setLayerOpacity", layerId: "reactor-rings", opacity: 0.24 },
        { type: "setLayerOpacity", layerId: "reactor-diamond", opacity: 0.52 },
        { type: "changeAnimationSpeed", target: "all", multiplier: 0.04 },
      ]),
      fourBarActions: [
        [{ type: "setPaletteRole", target: { groupId: "reactor-core-group" }, role: "primary" }],
        [{ type: "setPaletteRole", target: { groupId: "reactor-core-group" }, role: "secondary" }],
        [{ type: "revealRows", target: { groupId: "reactor-core-group" }, progress: 0.5, from: "center" }],
        [{ type: "revealRows", target: { groupId: "reactor-core-group" }, progress: 1, from: "center" }],
      ],
      entryActions: [{ type: "dissolveGroup", groupId: "reactor-outer-ring-group", amount: 0.7 }],
    },
    {
      id: "reactor-drop-one",
      sectionTypes: ["drop"],
      dropOccurrence: { occurrences: [1] },
      priority: 40,
      actions: drop("pix-grid-geometric-reactor-drop", [
        {
          type: "setGroupBrightness",
          groupId: "reactor-core-group",
          brightness: 0.95,
        },
        {
          type: "setGroupBrightness",
          groupId: "reactor-chevron-group",
          brightness: 0.9,
        },
        {
          type: "setGroupBrightness",
          groupId: "reactor-node-group",
          brightness: 0.72,
        },
      ]),
      entryActions: [{ type: "triggerFrame", target: "all", step: 0.32 }],
      bodyActions: [
        {
          type: "setGroupBrightness",
          groupId: "reactor-chevron-group",
          brightness: 0.9,
        },
      ],
      exitActions: [
        { type: "dissolveGroup", groupId: "reactor-node-group", amount: 0.3 },
      ],
      fourBarActions: [
        [
          {
            type: "reverseDirection",
            target: { groupId: "reactor-core-group" },
          },
        ],
        [
          {
            type: "setPaletteRole",
            target: { groupId: "reactor-chevron-group" },
            role: "accent",
          },
        ],
        [{ type: "shiftGroup", groupId: "reactor-node-group", y: -0.018 }],
        [{ type: "shiftGroup", groupId: "reactor-node-group", y: 0.018 }],
      ],
      eightBarRecruitment: [
        [{ type: "recruitLayer", layerId: "reactor-checker", opacity: 0.3 }],
        [{ type: "recruitLayer", layerId: "reactor-orbits", opacity: 0.88 }],
      ],
      sixteenBarEvolution: [
        [{ type: "changeAnimationSpeed", target: "all", multiplier: 1.12 }],
        [
          {
            type: "changeAnimation",
            layerId: "reactor-chevrons",
            animation: "pingPong",
            speed: 0.65,
            amount: 0.08,
          },
        ],
      ],
      eventActions: {
        kick: [
          { type: "flashGroup", groupId: "reactor-core-group", amount: 0.64 },
        ],
        snare: [
          { type: "flashGroup", groupId: "reactor-chevron-group", amount: 0.58 },
        ],
        hat: [
          { type: "flashGroup", groupId: "reactor-node-group", amount: 0.3 },
        ],
        semanticMoment: [{ type: "reverseDirection", target: "all" }],
      },
    },
    {
      id: "reactor-drop-evolved",
      sectionTypes: ["drop"],
      dropOccurrence: { minOccurrence: 2 },
      priority: 45,
      actions: drop("pix-grid-geometric-reactor-drop", [
        { type: "setPaletteRole", target: "all", role: "secondary" },
        { type: "recruitLayer", layerId: "reactor-checker", opacity: 0.38 },
        { type: "recruitLayer", layerId: "reactor-orbits", opacity: 0.94 },
        { type: "shiftGroup", groupId: "reactor-chevron-group", y: -0.02 },
      ]),
      entryActions: [{ type: "triggerFrame", target: "all", step: 0.4 }],
      bodyActions: [
        {
          type: "setGroupBrightness",
          groupId: "reactor-node-group",
          brightness: 0.88,
        },
      ],
      exitActions: [
        { type: "dissolveGroup", groupId: "reactor-chevron-group", amount: 0.22 },
      ],
      fourBarActions: [
        [
          {
            type: "reverseDirection",
            target: { groupId: "reactor-chevron-group" },
          },
        ],
        [
          {
            type: "setPaletteRole",
            target: { groupId: "reactor-core-group" },
            role: "accent",
          },
        ],
        [
          {
            type: "changeAnimationSpeed",
            target: { groupId: "reactor-node-group" },
            multiplier: 1.12,
          },
        ],
        [{ type: "triggerFrame", target: "all", step: 0.28 }],
      ],
      eightBarRecruitment: [
        [
          {
            type: "setGroupBrightness",
            groupId: "reactor-node-group",
            brightness: 0.84,
          },
        ],
        [
          {
            type: "changeAnimation",
            layerId: "reactor-tunnel",
            animation: "frameCycle",
            speed: 3.6,
            amount: 1,
          },
        ],
      ],
      sixteenBarEvolution: [
        [{ type: "changeAnimationSpeed", target: "all", multiplier: 1.22 }],
        [
          { type: "setPaletteRole", target: "all", role: "highlight" },
          { type: "reverseDirection", target: "all" },
        ],
      ],
      eventActions: {
        kick: [
          { type: "flashGroup", groupId: "reactor-core-group", amount: 0.72 },
        ],
        snare: [
          { type: "flashGroup", groupId: "reactor-chevron-group", amount: 0.66 },
        ],
        hat: [
          { type: "flashGroup", groupId: "reactor-node-group", amount: 0.36 },
        ],
      },
    },
    {
      id: "reactor-breakdown",
      sectionTypes: ["breakdown"],
      priority: 20,
      actions: breakdown("pix-grid-geometric-reactor-breakdown", [
        {
          type: "setGroupBrightness",
          groupId: "reactor-core-group",
          brightness: 0.52,
        },
        {
          type: "setGroupBrightness",
          groupId: "reactor-chevron-group",
          brightness: 0.3,
        },
        {
          type: "setGroupActive",
          groupId: "reactor-node-group",
          active: false,
        },
        { type: "changeAnimationSpeed", target: "all", multiplier: 0.38 },
      ]),
    },
    {
      id: "reactor-outro",
      sectionTypes: ["outro"],
      priority: 20,
      actions: outro("pix-grid-geometric-reactor-outro", [
        {
          type: "revealColumns",
          target: "all",
          progress: 0.34,
          from: "center",
        },
        {
          type: "setGroupActive",
          groupId: "reactor-node-group",
          active: false,
        },
        { type: "changeAnimationSpeed", target: "all", multiplier: 0.28 },
      ]),
      exitActions: [{ type: "clear" }],
    },
    {
      id: "reactor-fallback",
      sectionTypes: ["unknown"],
      priority: 1,
      actions: verse("pix-grid-geometric-reactor-verse", [
        {
          type: "setGroupBrightness",
          groupId: "reactor-core-group",
          brightness: 0.68,
        },
      ]),
      eventActions: {
        beat: [
          { type: "flashGroup", groupId: "reactor-core-group", amount: 0.2 },
        ],
      },
    },
  ],
});

export const PIXEL_PARADE_PERFORMANCE_PROGRAM = defineProgram({
  schemaVersion: PIX_GRID_PERFORMANCE_PROGRAM_SCHEMA_VERSION,
  id: "pix-grid-pixel-parade-performance",
  metadata: {
    name: "Pixel Parade Full-Song Performance",
    engine: "pixGrid",
    version: 1,
    visualIdentity: "progressive pixel cast",
  },
  ...PARADE_ARCHITECTURE,
  fallbackOrder: ["verse", "intro", "breakdown", "drop", "outro"],
  fallbackSectionPlanId: "parade-fallback",
  sectionPlans: [
    {
      id: "parade-intro",
      sectionTypes: ["intro"],
      priority: 20,
      actions: intro("pix-grid-pixel-parade-intro", [
        {
          type: "setGroupBrightness",
          groupId: "parade-foreground-group",
          brightness: 0.54,
        },
        {
          type: "setGroupBrightness",
          groupId: "parade-background-group",
          brightness: 0.34,
        },
        {
          type: "setGroupActive",
          groupId: "parade-impact-group",
          active: false,
        },
        { type: "setLayerActive", layerId: "parade-orbit", active: false },
      ]),
      fourBarActions: [
        [{ type: "shiftGroup", groupId: "parade-foreground-group", x: 0.018 }],
        [{ type: "shiftGroup", groupId: "parade-foreground-group", x: -0.018 }],
      ],
    },
    {
      id: "parade-verse",
      sectionTypes: ["verse", "bridge"],
      priority: 20,
      actions: verse("pix-grid-pixel-parade-verse", [
        {
          type: "setGroupBrightness",
          groupId: "parade-foreground-group",
          brightness: 0.76,
        },
        {
          type: "setGroupBrightness",
          groupId: "parade-background-group",
          brightness: 0.48,
        },
        { type: "setLayerActive", layerId: "parade-burst", active: false },
      ]),
      fourBarActions: [
        [
          {
            type: "reverseDirection",
            target: { groupId: "parade-background-group" },
          },
        ],
        [{ type: "shiftGroup", groupId: "parade-foreground-group", y: -0.012 }],
        [{ type: "shiftGroup", groupId: "parade-foreground-group", y: 0.012 }],
        [
          {
            type: "triggerFrame",
            target: { groupId: "parade-background-group" },
            step: 0.14,
          },
        ],
      ],
      eightBarRecruitment: [
        [{ type: "recruitLayer", layerId: "parade-orbit", opacity: 0.58 }],
        [{ type: "recruitLayer", layerId: "parade-eq", opacity: 0.52 }],
      ],
      eventActions: {
        kick: [
          {
            type: "flashGroup",
            groupId: "parade-lower-kick-lane-group",
            amount: 0.58,
          },
        ],
        snare: [
          {
            type: "flashGroup",
            groupId: "parade-upper-snare-lane-group",
            amount: 0.64,
          },
        ],
        hat: [
          {
            type: "triggerFrame",
            target: { groupId: "parade-background-group" },
            step: 0.08,
          },
        ],
      },
    },
    {
      id: "parade-build",
      sectionTypes: ["build"],
      priority: 25,
      actions: build("pix-grid-pixel-parade-build", [
        { type: "revealColumns", target: "all", progress: 0.76, from: "left" },
        { type: "changeAnimationSpeed", target: "all", multiplier: 1.12 },
        { type: "recruitLayer", layerId: "parade-eq", opacity: 0.82 },
      ]),
      fourBarActions: [
        [
          {
            type: "reverseDirection",
            target: { groupId: "parade-background-group" },
          },
        ],
        [{ type: "recruitLayer", layerId: "parade-orbit", opacity: 0.7 }],
        [{ type: "shiftGroup", groupId: "parade-foreground-group", x: 0.03 }],
        [{ type: "shiftGroup", groupId: "parade-foreground-group", x: -0.03 }],
      ],
      eventActions: {
        transient: [{ type: "triggerFrame", target: "all", step: 0.14 }],
      },
    },
    {
      id: "parade-pre-drop",
      sectionTypes: ["preDrop"],
      priority: 36,
      continuousRouteIds: ["energy-hero"],
      eventRouteIds: ["bar-motif", "section-entry-route"],
      motionState: { amount: 0.05, direction: "alternate", grammar: "parade-pre-drop-hold" },
      negativeSpaceTarget: 0.86,
      intensityRange: [0.2, 0.48],
      actions: preDrop("pix-grid-pixel-parade-preDrop", [
        { type: "setLayerActive", layerId: "parade-stars", active: false },
        { type: "setLayerActive", layerId: "parade-wave-bottom", active: false },
        { type: "setLayerActive", layerId: "parade-star-left", active: false },
        { type: "setLayerActive", layerId: "parade-orbit", active: false },
        { type: "setLayerActive", layerId: "parade-eq", active: false },
        { type: "setLayerActive", layerId: "parade-burst", active: false },
        { type: "setLayerOpacity", layerId: "parade-pal", opacity: 0.48 },
        { type: "setLayerOpacity", layerId: "parade-wave-top", opacity: 0.14 },
        { type: "changeAnimationSpeed", target: "all", multiplier: 0.04 },
      ]),
      fourBarActions: [
        [{ type: "shiftGroup", groupId: "parade-hero-group", x: -0.02 }],
        [{ type: "shiftGroup", groupId: "parade-hero-group", x: 0.02 }],
        [{ type: "revealColumns", target: { groupId: "parade-hero-group" }, progress: 0.5, from: "center" }],
        [{ type: "revealColumns", target: { groupId: "parade-hero-group" }, progress: 1, from: "center" }],
      ],
      entryActions: [{ type: "dissolveGroup", groupId: "parade-background-group", amount: 0.72 }],
    },
    {
      id: "parade-drop-one",
      sectionTypes: ["drop"],
      dropOccurrence: { occurrences: [1] },
      priority: 40,
      actions: drop("pix-grid-pixel-parade-drop", [
        {
          type: "setGroupBrightness",
          groupId: "parade-foreground-group",
          brightness: 0.96,
        },
        {
          type: "setGroupBrightness",
          groupId: "parade-background-group",
          brightness: 0.74,
        },
        {
          type: "setGroupBrightness",
          groupId: "parade-impact-group",
          brightness: 0.7,
        },
      ]),
      entryActions: [
        { type: "flashGroup", groupId: "parade-impact-group", amount: 0.66 },
      ],
      bodyActions: [
        {
          type: "setGroupBrightness",
          groupId: "parade-foreground-group",
          brightness: 0.96,
        },
      ],
      exitActions: [
        {
          type: "dissolveGroup",
          groupId: "parade-background-group",
          amount: 0.26,
        },
      ],
      variations: [
        {
          id: "left-lead",
          weight: 1,
          actions: [
            {
              type: "shiftGroup",
              groupId: "parade-foreground-group",
              x: -0.026,
            },
          ],
        },
        {
          id: "right-lead",
          weight: 1,
          actions: [
            {
              type: "shiftGroup",
              groupId: "parade-foreground-group",
              x: 0.026,
            },
          ],
        },
      ],
      fourBarActions: [
        [
          {
            type: "reverseDirection",
            target: { groupId: "parade-background-group" },
          },
        ],
        [
          {
            type: "setPaletteRole",
            target: { groupId: "parade-foreground-group" },
            role: "secondary",
          },
        ],
        [{ type: "shiftGroup", groupId: "parade-foreground-group", y: -0.02 }],
        [{ type: "shiftGroup", groupId: "parade-foreground-group", y: 0.02 }],
      ],
      eightBarRecruitment: [
        [{ type: "recruitLayer", layerId: "parade-orbit", opacity: 0.84 }],
        [{ type: "recruitLayer", layerId: "parade-burst", opacity: 0.48 }],
      ],
      sixteenBarEvolution: [
        [{ type: "changeAnimationSpeed", target: "all", multiplier: 1.12 }],
        [
          { type: "setPaletteRole", target: "all", role: "accent" },
          {
            type: "reverseDirection",
            target: { groupId: "parade-foreground-group" },
          },
        ],
      ],
      eventActions: {
        kick: [
          { type: "flashGroup", groupId: "parade-impact-group", amount: 0.62 },
        ],
        snare: [
          {
            type: "flashGroup",
            groupId: "parade-foreground-group",
            amount: 0.54,
          },
        ],
        hat: [
          {
            type: "flashGroup",
            groupId: "parade-background-group",
            amount: 0.22,
          },
        ],
        semanticMoment: [
          { type: "recruitLayer", layerId: "parade-burst", opacity: 0.62 },
        ],
      },
    },
    {
      id: "parade-drop-evolved",
      sectionTypes: ["drop"],
      dropOccurrence: { minOccurrence: 2 },
      priority: 45,
      actions: drop("pix-grid-pixel-parade-drop", [
        { type: "setPaletteRole", target: "all", role: "secondary" },
        { type: "recruitLayer", layerId: "parade-orbit", opacity: 0.94 },
        { type: "recruitLayer", layerId: "parade-burst", opacity: 0.68 },
        { type: "shiftGroup", groupId: "parade-foreground-group", x: 0.02 },
      ]),
      entryActions: [
        { type: "flashGroup", groupId: "parade-impact-group", amount: 0.74 },
      ],
      bodyActions: [
        {
          type: "setGroupBrightness",
          groupId: "parade-impact-group",
          brightness: 0.88,
        },
      ],
      exitActions: [
        {
          type: "dissolveGroup",
          groupId: "parade-foreground-group",
          amount: 0.2,
        },
      ],
      fourBarActions: [
        [{ type: "reverseDirection", target: "all" }],
        [
          {
            type: "setPaletteRole",
            target: { groupId: "parade-foreground-group" },
            role: "highlight",
          },
        ],
        [
          {
            type: "changeAnimationSpeed",
            target: { groupId: "parade-background-group" },
            multiplier: 1.12,
          },
        ],
        [{ type: "triggerFrame", target: "all", step: 0.28 }],
      ],
      eightBarRecruitment: [
        [
          {
            type: "setGroupBrightness",
            groupId: "parade-impact-group",
            brightness: 0.84,
          },
        ],
        [
          {
            type: "changeAnimation",
            layerId: "parade-pal",
            animation: "bounce",
            speed: 1.25,
            amount: 0.08,
          },
        ],
      ],
      sixteenBarEvolution: [
        [{ type: "changeAnimationSpeed", target: "all", multiplier: 1.2 }],
        [
          { type: "setPaletteRole", target: "all", role: "highlight" },
          { type: "shiftGroup", groupId: "parade-background-group", y: -0.025 },
        ],
      ],
      eventActions: {
        kick: [
          { type: "flashGroup", groupId: "parade-impact-group", amount: 0.7 },
        ],
        snare: [
          {
            type: "flashGroup",
            groupId: "parade-foreground-group",
            amount: 0.62,
          },
        ],
        hat: [
          {
            type: "flashGroup",
            groupId: "parade-background-group",
            amount: 0.28,
          },
        ],
        semanticMoment: [
          {
            type: "reverseDirection",
            target: { groupId: "parade-foreground-group" },
          },
        ],
      },
    },
    {
      id: "parade-breakdown",
      sectionTypes: ["breakdown"],
      priority: 20,
      actions: breakdown("pix-grid-pixel-parade-breakdown", [
        {
          type: "setGroupBrightness",
          groupId: "parade-foreground-group",
          brightness: 0.54,
        },
        {
          type: "setGroupBrightness",
          groupId: "parade-background-group",
          brightness: 0.24,
        },
        {
          type: "setGroupActive",
          groupId: "parade-impact-group",
          active: false,
        },
        { type: "changeAnimationSpeed", target: "all", multiplier: 0.42 },
      ]),
    },
    {
      id: "parade-outro",
      sectionTypes: ["outro"],
      priority: 20,
      actions: outro("pix-grid-pixel-parade-outro", [
        { type: "revealRows", target: "all", progress: 0.32, from: "bottom" },
        {
          type: "setGroupActive",
          groupId: "parade-impact-group",
          active: false,
        },
        { type: "setLayerActive", layerId: "parade-orbit", active: false },
        { type: "changeAnimationSpeed", target: "all", multiplier: 0.28 },
      ]),
      exitActions: [{ type: "clear" }],
    },
    {
      id: "parade-fallback",
      sectionTypes: ["unknown"],
      priority: 1,
      actions: verse("pix-grid-pixel-parade-verse", [
        {
          type: "setGroupBrightness",
          groupId: "parade-foreground-group",
          brightness: 0.68,
        },
      ]),
      eventActions: {
        beat: [
          {
            type: "flashGroup",
            groupId: "parade-foreground-group",
            amount: 0.2,
          },
        ],
      },
    },
  ],
});

export const PIX_GRID_PERFORMANCE_PROGRAMS: readonly PixGridPerformanceProgram[] =
  [
    BASS_BEACON_PERFORMANCE_PROGRAM,
    GEOMETRIC_REACTOR_PERFORMANCE_PROGRAM,
    PIXEL_PARADE_PERFORMANCE_PROGRAM,
  ];

export const PIX_GRID_PERFORMANCE_PROGRAM_BY_ID = new Map<
  PixGridPerformanceProgramId,
  PixGridPerformanceProgram
>(
  PIX_GRID_PERFORMANCE_PROGRAMS.map((program) => [
    program.id as PixGridPerformanceProgramId,
    program,
  ]),
);

export const PIX_GRID_DEFAULT_PROGRAM_BY_PRESET_ID: Readonly<
  Record<string, PixGridPerformanceProgramId>
> = {
  "pix-grid-bass-beacon": "pix-grid-bass-beacon-performance",
  "pix-grid-geometric-reactor": "pix-grid-geometric-reactor-performance",
  "pix-grid-pixel-parade": "pix-grid-pixel-parade-performance",
};

export const PIX_GRID_PRESET_ID_BY_PROGRAM: Readonly<
  Record<PixGridPerformanceProgramId, string>
> = {
  "pix-grid-bass-beacon-performance": "pix-grid-bass-beacon",
  "pix-grid-geometric-reactor-performance": "pix-grid-geometric-reactor",
  "pix-grid-pixel-parade-performance": "pix-grid-pixel-parade",
};

export function validatePixGridPerformancePrograms(): SharedPerformanceProgramValidationIssue[] {
  return validatePixGridPerformanceProgramCollection(
    PIX_GRID_PERFORMANCE_PROGRAMS,
  ).map((issue) => ({
    severity: issue.severity,
    code: issue.code,
    message: issue.message,
    programId: issue.programId,
    ...(issue.path ? { actionPath: issue.path } : {}),
  }));
}
