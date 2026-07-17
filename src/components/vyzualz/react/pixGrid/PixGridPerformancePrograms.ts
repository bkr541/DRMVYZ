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

function completeSectionPlan(plan: PixGridSectionPlan): PixGridSectionPlan {
  const section = plan.sectionTypes[0] ?? "unknown";
  const density =
    densityFor(plan.actions) ??
    (section === "drop"
      ? 1
      : section === "build" || section === "preDrop"
        ? 0.82
        : section === "intro" || section === "outro"
          ? 0.32
          : 0.58);
  const negativeSpace = Math.max(0.08, Math.min(0.88, 1 - density * 0.72));
  return {
    ...plan,
    scenePreference: plan.scenePreference ?? sceneFor(plan.actions),
    continuousRouteIds: plan.continuousRouteIds ?? [
      "bass-foundation",
      "energy-hero",
      "detail-highs",
      "vocal-focus",
    ],
    eventRouteIds: plan.eventRouteIds ?? [
      "kick-impact",
      "snare-outline",
      "hat-detail",
      "bar-motif",
      "phrase-recruit",
      "section-entry-route",
      "drop-impact-route",
      "semantic-accent",
      "track-map-handoff",
    ],
    motionState: plan.motionState ?? {
      amount:
        section === "drop"
          ? 1.18
          : section === "build" || section === "preDrop"
            ? 1.08
            : section === "breakdown"
              ? 0.62
              : 0.82,
      direction: "alternate",
      grammar: `${plan.id}-motion`,
    },
    paletteState: plan.paletteState ?? {
      intensity:
        section === "drop"
          ? 1
          : section === "build" || section === "preDrop"
            ? 0.86
            : 0.68,
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
    sectionPlans: program.sectionPlans.map(completeSectionPlan),
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
        amount: 0.34,
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
        amount: 0.24,
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
        amount: 0.28,
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
        amount: 0.52,
        envelope: { attack: 0, hold: 0.03, release: 0.16, curve: "easeOut" },
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
        amount: 0.68,
        envelope: { attack: 0, hold: 0.04, release: 0.2, curve: "easeOut" },
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
        amount: 0.36,
        envelope: { attack: 0, hold: 0.015, release: 0.09, curve: "easeOut" },
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

const COMMON_ARCS = [
  {
    id: "density-arc",
    kind: "density",
    defaultValue: 0.6,
    sectionValues: {
      intro: 0.3,
      verse: 0.55,
      build: 0.78,
      preDrop: 0.86,
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
      preDrop: 0.92,
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
      preDrop: 1.08,
      drop: 1.16,
      breakdown: 0.48,
      outro: 0.32,
    },
    occurrenceDelta: 0.025,
    clamp: [0.2, 1.35],
  },
  {
    id: "contrast-arc",
    kind: "contrast",
    defaultValue: 0.7,
    sectionValues: {
      intro: 0.55,
      verse: 0.68,
      build: 0.82,
      preDrop: 0.92,
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
      preDrop: 0.2,
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
      preDrop: 0.88,
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
      preDrop: 0.9,
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
      preDrop: 0.82,
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
      preDrop: 0.66,
      drop: 0.72,
      breakdown: 0.24,
      outro: 0.12,
    },
  },
] satisfies PixGridPerformanceProgram["musicalArcs"];

const BASS_ARCHITECTURE = {
  visualRoles: VISUAL_ROLES,
  bindings: [
    {
      id: "bass-hero-binding",
      target: { kind: "layer", id: "bass-word" },
      roles: ["hero", "primary", "bass", "typography"],
    },
    {
      id: "bass-outline-binding",
      target: { kind: "layer", id: "bass-outline" },
      roles: ["outline", "secondary", "percussion"],
    },
    {
      id: "bass-impact-binding",
      target: { kind: "layer", id: "bass-burst" },
      roles: ["impact", "transition"],
    },
    {
      id: "bass-sparkle-binding",
      target: { kind: "layer", id: "bass-sparkles" },
      roles: ["sparkle", "accent", "atmosphere"],
    },
    {
      id: "bass-body-group-binding",
      target: { kind: "group", id: "bass-body-group" },
      roles: ["hero", "bass"],
    },
    {
      id: "bass-kick-binding",
      target: { kind: "group", id: "bass-kick-group" },
      roles: ["bass", "impact", "percussion"],
    },
    {
      id: "bass-snare-binding",
      target: { kind: "group", id: "bass-snare-group" },
      roles: ["percussion", "outline", "accent"],
    },
    {
      id: "bass-hat-binding",
      target: { kind: "group", id: "bass-hat-group" },
      roles: ["percussion", "sparkle"],
    },
  ],
  banks: [
    {
      id: "bass-hero-bank",
      roles: ["hero"],
      members: [{ kind: "group", id: "bass-body-group" }],
    },
    {
      id: "bass-bass-bank",
      roles: ["bass"],
      members: [
        { kind: "group", id: "bass-kick-group" },
        { kind: "group", id: "bass-body-group" },
      ],
    },
    {
      id: "bass-snare-bank",
      roles: ["percussion"],
      members: [{ kind: "group", id: "bass-snare-group" }],
    },
    {
      id: "bass-hat-bank",
      roles: ["sparkle"],
      members: [{ kind: "group", id: "bass-hat-group" }],
    },
    {
      id: "bass-accent-bank",
      roles: ["accent"],
      members: [
        { kind: "group", id: "bass-snare-group" },
        { kind: "group", id: "bass-hat-group" },
      ],
    },
    {
      id: "bass-recruitment-bank",
      members: [
        { kind: "group", id: "bass-body-group" },
        { kind: "group", id: "bass-hat-group" },
      ],
    },
    {
      id: "bass-transition-bank",
      roles: ["transition"],
      members: [{ kind: "group", id: "bass-body-group" }],
    },
    {
      id: "bass-impact-bank",
      roles: ["impact"],
      members: [{ kind: "group", id: "bass-kick-group" }],
    },
  ],
  ...sharedRoutes("bass"),
  musicalArcs: COMMON_ARCS,
} satisfies Pick<
  PixGridPerformanceProgram,
  | "visualRoles"
  | "bindings"
  | "banks"
  | "continuousRoutes"
  | "eventRoutes"
  | "musicalArcs"
>;

const REACTOR_ARCHITECTURE = {
  visualRoles: VISUAL_ROLES,
  bindings: [
    {
      id: "reactor-hero-binding",
      target: { kind: "layer", id: "reactor-tunnel" },
      roles: ["hero", "primary", "environment"],
    },
    {
      id: "reactor-secondary-binding",
      target: { kind: "layer", id: "reactor-chevrons" },
      roles: ["secondary", "accent", "transition"],
    },
    {
      id: "reactor-outline-binding",
      target: { kind: "layer", id: "reactor-cross" },
      roles: ["outline", "impact"],
    },
    {
      id: "reactor-atmosphere-binding",
      target: { kind: "layer", id: "reactor-orbits" },
      roles: ["atmosphere", "sparkle"],
    },
    {
      id: "reactor-checker-binding",
      target: { kind: "layer", id: "reactor-checker" },
      roles: ["background", "percussion"],
    },
    {
      id: "reactor-low-binding",
      target: { kind: "group", id: "reactor-low-group" },
      roles: ["bass", "impact"],
    },
    {
      id: "reactor-mid-binding",
      target: { kind: "group", id: "reactor-mid-group" },
      roles: ["percussion", "secondary"],
    },
    {
      id: "reactor-high-binding",
      target: { kind: "group", id: "reactor-high-group" },
      roles: ["percussion", "sparkle", "accent"],
    },
  ],
  banks: [
    {
      id: "reactor-hero-bank",
      roles: ["hero"],
      members: [{ kind: "group", id: "reactor-mid-group" }],
    },
    {
      id: "reactor-bass-bank",
      roles: ["bass"],
      members: [{ kind: "group", id: "reactor-low-group" }],
    },
    {
      id: "reactor-snare-bank",
      roles: ["percussion"],
      members: [{ kind: "group", id: "reactor-mid-group" }],
    },
    {
      id: "reactor-hat-bank",
      roles: ["sparkle"],
      members: [{ kind: "group", id: "reactor-high-group" }],
    },
    {
      id: "reactor-accent-bank",
      roles: ["accent"],
      members: [{ kind: "group", id: "reactor-high-group" }],
    },
    {
      id: "reactor-recruitment-bank",
      members: [
        { kind: "group", id: "reactor-mid-group" },
        { kind: "group", id: "reactor-high-group" },
      ],
    },
    {
      id: "reactor-transition-bank",
      roles: ["transition"],
      members: [{ kind: "group", id: "reactor-mid-group" }],
    },
    {
      id: "reactor-impact-bank",
      roles: ["impact"],
      members: [{ kind: "group", id: "reactor-low-group" }],
    },
  ],
  ...sharedRoutes("reactor"),
  musicalArcs: COMMON_ARCS,
} satisfies Pick<
  PixGridPerformanceProgram,
  | "visualRoles"
  | "bindings"
  | "banks"
  | "continuousRoutes"
  | "eventRoutes"
  | "musicalArcs"
>;

const PARADE_ARCHITECTURE = {
  visualRoles: VISUAL_ROLES,
  bindings: [
    {
      id: "parade-character-binding",
      target: { kind: "layer", id: "parade-pal" },
      roles: ["hero", "character", "primary", "vocalFocus"],
    },
    {
      id: "parade-eq-binding",
      target: { kind: "layer", id: "parade-eq" },
      roles: ["bass", "percussion", "secondary"],
    },
    {
      id: "parade-orbit-binding",
      target: { kind: "layer", id: "parade-orbit" },
      roles: ["accent", "sparkle", "atmosphere"],
    },
    {
      id: "parade-impact-binding",
      target: { kind: "layer", id: "parade-burst" },
      roles: ["impact", "transition"],
    },
    {
      id: "parade-background-binding",
      target: { kind: "group", id: "parade-background-group" },
      roles: ["background", "environment"],
    },
    {
      id: "parade-foreground-binding",
      target: { kind: "group", id: "parade-foreground-group" },
      roles: ["hero", "accent", "percussion"],
    },
    {
      id: "parade-impact-group-binding",
      target: { kind: "group", id: "parade-impact-group" },
      roles: ["impact", "bass"],
    },
  ],
  banks: [
    {
      id: "parade-hero-bank",
      roles: ["hero"],
      members: [{ kind: "group", id: "parade-foreground-group" }],
    },
    {
      id: "parade-bass-bank",
      roles: ["bass"],
      members: [{ kind: "group", id: "parade-impact-group" }],
    },
    {
      id: "parade-snare-bank",
      roles: ["percussion"],
      members: [{ kind: "group", id: "parade-foreground-group" }],
    },
    {
      id: "parade-hat-bank",
      roles: ["sparkle"],
      members: [{ kind: "group", id: "parade-foreground-group" }],
    },
    {
      id: "parade-accent-bank",
      roles: ["accent"],
      members: [{ kind: "group", id: "parade-foreground-group" }],
    },
    {
      id: "parade-recruitment-bank",
      members: [
        { kind: "group", id: "parade-background-group" },
        { kind: "group", id: "parade-foreground-group" },
      ],
    },
    {
      id: "parade-transition-bank",
      roles: ["transition"],
      members: [{ kind: "group", id: "parade-foreground-group" }],
    },
    {
      id: "parade-impact-bank",
      roles: ["impact"],
      members: [{ kind: "group", id: "parade-impact-group" }],
    },
  ],
  ...sharedRoutes("parade"),
  musicalArcs: COMMON_ARCS,
} satisfies Pick<
  PixGridPerformanceProgram,
  | "visualRoles"
  | "bindings"
  | "banks"
  | "continuousRoutes"
  | "eventRoutes"
  | "musicalArcs"
>;

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
        { type: "setLayerActive", layerId: "bass-burst", active: false },
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
        { type: "setLayerActive", layerId: "bass-burst", active: false },
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
          { type: "flashGroup", groupId: "bass-kick-group", amount: 0.36 },
        ],
        snare: [
          {
            type: "flashGroup",
            groupId: "bass-snare-group",
            amount: 0.48,
            paletteRole: "highlight",
          },
        ],
        hat: [{ type: "flashGroup", groupId: "bass-hat-group", amount: 0.18 }],
      },
    },
    {
      id: "bass-build",
      sectionTypes: ["build", "preDrop"],
      priority: 25,
      actions: build("pix-grid-bass-beacon-build", [
        { type: "revealRows", target: "all", progress: 0.68, from: "bottom" },
        { type: "changeAnimationSpeed", target: "all", multiplier: 1.35 },
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
          { type: "flashGroup", groupId: "bass-kick-group", amount: 0.42 },
        ],
        snare: [
          { type: "flashGroup", groupId: "bass-snare-group", amount: 0.56 },
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
        [{ type: "recruitLayer", layerId: "bass-burst", opacity: 0.42 }],
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
        { type: "recruitLayer", layerId: "bass-burst", opacity: 0.62 },
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
        { type: "setLayerActive", layerId: "bass-burst", active: false },
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
        { type: "setLayerActive", layerId: "bass-burst", active: false },
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
          groupId: "reactor-low-group",
          brightness: 0.46,
        },
        {
          type: "setGroupBrightness",
          groupId: "reactor-mid-group",
          brightness: 0.36,
        },
        {
          type: "setGroupActive",
          groupId: "reactor-high-group",
          active: false,
        },
        { type: "changeAnimationSpeed", target: "all", multiplier: 0.58 },
      ]),
      fourBarActions: [
        [
          {
            type: "reverseDirection",
            target: { groupId: "reactor-low-group" },
          },
        ],
        [
          {
            type: "setPaletteRole",
            target: { groupId: "reactor-mid-group" },
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
          groupId: "reactor-low-group",
          brightness: 0.72,
        },
        {
          type: "setGroupBrightness",
          groupId: "reactor-mid-group",
          brightness: 0.62,
        },
        {
          type: "setGroupBrightness",
          groupId: "reactor-high-group",
          brightness: 0.32,
        },
      ]),
      fourBarActions: [
        [
          {
            type: "reverseDirection",
            target: { groupId: "reactor-low-group" },
          },
        ],
        [{ type: "shiftGroup", groupId: "reactor-mid-group", x: 0.014 }],
        [{ type: "shiftGroup", groupId: "reactor-mid-group", x: -0.014 }],
        [
          {
            type: "triggerFrame",
            target: { groupId: "reactor-high-group" },
            step: 0.16,
          },
        ],
      ],
      eventActions: {
        kick: [
          { type: "flashGroup", groupId: "reactor-low-group", amount: 0.42 },
        ],
        snare: [
          { type: "flashGroup", groupId: "reactor-mid-group", amount: 0.38 },
        ],
        hat: [
          { type: "flashGroup", groupId: "reactor-high-group", amount: 0.2 },
        ],
      },
    },
    {
      id: "reactor-build",
      sectionTypes: ["build", "preDrop"],
      priority: 25,
      actions: build("pix-grid-geometric-reactor-build", [
        {
          type: "revealColumns",
          target: "all",
          progress: 0.72,
          from: "center",
        },
        { type: "changeAnimationSpeed", target: "all", multiplier: 1.42 },
        { type: "recruitLayer", layerId: "reactor-cross", opacity: 0.62 },
      ]),
      fourBarActions: [
        [
          {
            type: "setPaletteRole",
            target: { groupId: "reactor-low-group" },
            role: "primary",
          },
        ],
        [
          {
            type: "setPaletteRole",
            target: { groupId: "reactor-mid-group" },
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
      id: "reactor-drop-one",
      sectionTypes: ["drop"],
      dropOccurrence: { occurrences: [1] },
      priority: 40,
      actions: drop("pix-grid-geometric-reactor-drop", [
        {
          type: "setGroupBrightness",
          groupId: "reactor-low-group",
          brightness: 0.95,
        },
        {
          type: "setGroupBrightness",
          groupId: "reactor-mid-group",
          brightness: 0.9,
        },
        {
          type: "setGroupBrightness",
          groupId: "reactor-high-group",
          brightness: 0.72,
        },
      ]),
      entryActions: [{ type: "triggerFrame", target: "all", step: 0.32 }],
      bodyActions: [
        {
          type: "setGroupBrightness",
          groupId: "reactor-mid-group",
          brightness: 0.9,
        },
      ],
      exitActions: [
        { type: "dissolveGroup", groupId: "reactor-high-group", amount: 0.3 },
      ],
      fourBarActions: [
        [
          {
            type: "reverseDirection",
            target: { groupId: "reactor-low-group" },
          },
        ],
        [
          {
            type: "setPaletteRole",
            target: { groupId: "reactor-mid-group" },
            role: "accent",
          },
        ],
        [{ type: "shiftGroup", groupId: "reactor-high-group", y: -0.018 }],
        [{ type: "shiftGroup", groupId: "reactor-high-group", y: 0.018 }],
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
          { type: "flashGroup", groupId: "reactor-low-group", amount: 0.64 },
        ],
        snare: [
          { type: "flashGroup", groupId: "reactor-mid-group", amount: 0.58 },
        ],
        hat: [
          { type: "flashGroup", groupId: "reactor-high-group", amount: 0.3 },
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
        { type: "shiftGroup", groupId: "reactor-mid-group", y: -0.02 },
      ]),
      entryActions: [{ type: "triggerFrame", target: "all", step: 0.4 }],
      bodyActions: [
        {
          type: "setGroupBrightness",
          groupId: "reactor-high-group",
          brightness: 0.88,
        },
      ],
      exitActions: [
        { type: "dissolveGroup", groupId: "reactor-mid-group", amount: 0.22 },
      ],
      fourBarActions: [
        [
          {
            type: "reverseDirection",
            target: { groupId: "reactor-mid-group" },
          },
        ],
        [
          {
            type: "setPaletteRole",
            target: { groupId: "reactor-low-group" },
            role: "accent",
          },
        ],
        [
          {
            type: "changeAnimationSpeed",
            target: { groupId: "reactor-high-group" },
            multiplier: 1.35,
          },
        ],
        [{ type: "triggerFrame", target: "all", step: 0.28 }],
      ],
      eightBarRecruitment: [
        [
          {
            type: "setGroupBrightness",
            groupId: "reactor-high-group",
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
          { type: "flashGroup", groupId: "reactor-low-group", amount: 0.72 },
        ],
        snare: [
          { type: "flashGroup", groupId: "reactor-mid-group", amount: 0.66 },
        ],
        hat: [
          { type: "flashGroup", groupId: "reactor-high-group", amount: 0.36 },
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
          groupId: "reactor-low-group",
          brightness: 0.52,
        },
        {
          type: "setGroupBrightness",
          groupId: "reactor-mid-group",
          brightness: 0.3,
        },
        {
          type: "setGroupActive",
          groupId: "reactor-high-group",
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
          groupId: "reactor-high-group",
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
          groupId: "reactor-low-group",
          brightness: 0.68,
        },
      ]),
      eventActions: {
        beat: [
          { type: "flashGroup", groupId: "reactor-low-group", amount: 0.2 },
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
            groupId: "parade-foreground-group",
            amount: 0.34,
          },
        ],
        snare: [
          {
            type: "flashGroup",
            groupId: "parade-background-group",
            amount: 0.3,
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
      sectionTypes: ["build", "preDrop"],
      priority: 25,
      actions: build("pix-grid-pixel-parade-build", [
        { type: "revealColumns", target: "all", progress: 0.76, from: "left" },
        { type: "changeAnimationSpeed", target: "all", multiplier: 1.36 },
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
            multiplier: 1.35,
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
