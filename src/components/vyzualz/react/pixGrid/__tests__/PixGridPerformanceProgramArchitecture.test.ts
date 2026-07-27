import { describe, expect, it } from "vitest";
import { DEFAULT_MI_FRAME } from "../../../../../features/musicIntelligence/constants";
import type { MusicIntelligenceFrame } from "../../../../../features/musicIntelligence/types";
import {
  buildSharedPerformanceContext,
  type SharedPerformanceContext,
} from "../../../../../features/performanceCore";
import type { ReactTrackSection } from "../../ReactTypes";
import { createPixGridAudioFrame } from "../PixGridAudioRouting";
import { composePixGridLogicalFrame } from "../PixGridCompositor";
import { createDefaultPixGridState } from "../PixGridDefaults";
import { createDefaultPixGridReactionAssignment } from "../PixGridGroups";
import {
  PixGridPerformanceProgramCompiler,
  resolvePixGridProgramArcState,
  validatePixGridPerformanceProgram,
  validatePixGridPerformanceProgramCollection,
} from "../PixGridPerformanceProgramCompiler";
import {
  BASS_BEACON_PERFORMANCE_PROGRAM,
  PIX_GRID_PERFORMANCE_PROGRAMS,
} from "../PixGridPerformancePrograms";
import {
  PixGridPerformanceExecutionRuntime,
  resolvePixGridPerformanceFrame,
} from "../PixGridPerformanceRuntime";
import { PIX_GRID_PRESET_BY_ID } from "../PixGridPresets";
import { applyPixGridPresetSettings } from "../PixGridState";
import { PixGridUnifiedPerformanceRuntime } from "../PixGridUnifiedPerformanceRuntime";
import type { PixGridActionCue } from "../PixGridActionCues";
import type { PixGridState } from "../PixGridTypes";

const SECTIONS: ReactTrackSection[] = [
  {
    id: "intro",
    label: "Intro",
    type: "intro",
    startSec: 0,
    endSec: 8,
    intensity: 0.3,
    source: "auto",
    confidence: 0.96,
  },
  {
    id: "verse-1",
    label: "Verse 1",
    type: "verse",
    startSec: 8,
    endSec: 24,
    intensity: 0.55,
    source: "auto",
    confidence: 0.96,
    interpretation: { familyId: "verse-family", occurrenceIndex: 1 },
  },
  {
    id: "build-1",
    label: "Build 1",
    type: "build",
    startSec: 24,
    endSec: 32,
    intensity: 0.82,
    source: "auto",
    confidence: 0.96,
    interpretation: { familyId: "build-family", occurrenceIndex: 1 },
  },
  {
    id: "drop-1",
    label: "Drop 1",
    type: "drop",
    startSec: 32,
    endSec: 64,
    intensity: 1,
    source: "auto",
    confidence: 0.96,
    interpretation: { familyId: "drop-family", occurrenceIndex: 1 },
  },
  {
    id: "breakdown",
    label: "Breakdown",
    type: "breakdown",
    startSec: 64,
    endSec: 72,
    intensity: 0.4,
    source: "auto",
    confidence: 0.96,
  },
  {
    id: "verse-2",
    label: "Verse 2",
    type: "verse",
    startSec: 72,
    endSec: 80,
    intensity: 0.62,
    source: "auto",
    confidence: 0.96,
    interpretation: { familyId: "verse-family", occurrenceIndex: 2 },
  },
  {
    id: "build-2",
    label: "Build 2",
    type: "build",
    startSec: 80,
    endSec: 88,
    intensity: 0.9,
    source: "auto",
    confidence: 0.96,
    interpretation: { familyId: "build-family", occurrenceIndex: 2 },
  },
  {
    id: "drop-2",
    label: "Drop 2",
    type: "drop",
    startSec: 88,
    endSec: 120,
    intensity: 1,
    source: "auto",
    confidence: 0.96,
    interpretation: { familyId: "drop-family", occurrenceIndex: 2 },
  },
  {
    id: "outro",
    label: "Outro",
    type: "outro",
    startSec: 120,
    endSec: 136,
    intensity: 0.25,
    source: "auto",
    confidence: 0.96,
  },
];

type FrameOptions = {
  bass?: number;
  beat?: boolean;
  downbeat?: boolean;
  kick?: boolean;
  snare?: boolean;
  hat?: boolean;
  transient?: number;
  semantic?: boolean;
  trackId?: string;
};

function frameAt(
  timeSec: number,
  options: FrameOptions = {},
): MusicIntelligenceFrame {
  const absoluteBeat = timeSec * 2;
  const beatIndex = Math.floor(absoluteBeat);
  const bass = options.bass ?? 0.75;
  return {
    ...DEFAULT_MI_FRAME,
    timeSec,
    frameId: Math.max(1, Math.round(timeSec * 60)),
    sourceId: options.trackId ?? "track-a",
    trackId: options.trackId ?? "track-a",
    bands: {
      ...DEFAULT_MI_FRAME.bands,
      bass,
      mid: 0.58,
      high: 0.62,
      normalizedBass: bass,
      normalizedMid: 0.58,
      normalizedHigh: 0.62,
      volume: 0.8,
    },
    rhythm: {
      ...DEFAULT_MI_FRAME.rhythm,
      bpm: 120,
      bpmConfidence: 0.98,
      beatIndex,
      beatPhase: absoluteBeat - beatIndex,
      beatInBar: beatIndex % 4,
      barIndex: Math.floor(beatIndex / 4),
      beatHit: options.beat ?? false,
      downbeatHit: options.downbeat ?? false,
      kickHit: options.kick ?? false,
      kickStrength: options.kick ? 1 : 0,
      snareHit: options.snare ?? false,
      snareStrength: options.snare ? 1 : 0,
      hatHit: options.hat ?? false,
      hatStrength: options.hat ? 1 : 0,
      transient: options.transient ?? 0,
      transientConfidence: options.transient ? 1 : 0,
    },
    energy: {
      ...DEFAULT_MI_FRAME.energy,
      instant: 0.84,
      shortTerm: 0.8,
      longTerm: 0.62,
      percentile: 0.86,
      buildProgress: timeSec >= 24 && timeSec < 32 ? (timeSec - 24) / 8 : 0,
      dropImpact: options.kick ? 0.9 : 0,
      tension: 0.62,
      complexity: 0.66,
      spectralFlux: options.transient ?? 0.32,
    },
    semanticMoments: options.semantic
      ? [
          {
            id: `semantic-${timeSec}`,
            timeSec,
            durationSec: 0.2,
            type: "major_impact",
            confidence: 0.96,
            source: "structural_analysis",
          },
        ]
      : [],
    capabilities: {
      ...DEFAULT_MI_FRAME.capabilities!,
      liveBands: true,
      rhythmEvents: true,
      beatGrid: true,
      sections: true,
      trackEnergyCurve: true,
    },
    confidence: {
      ...DEFAULT_MI_FRAME.confidence,
      overall: 0.96,
      rhythm: 0.98,
      section: 0.96,
    },
  };
}

function contextAt(
  timeSec: number,
  options: FrameOptions & {
    previous?: SharedPerformanceContext | null;
    seekIdentity?: string;
    loopIdentity?: string;
    trackChangeIdentity?: string;
  } = {},
): SharedPerformanceContext {
  const trackId = options.trackId ?? "track-a";
  return buildSharedPerformanceContext({
    audioTimeSec: timeSec,
    frame: frameAt(timeSec, options),
    resolvedSections: SECTIONS,
    durationSec: 136,
    trackIdentity: trackId,
    seekIdentity: options.seekIdentity ?? "seek-0",
    loopIdentity: options.loopIdentity ?? "loop-0",
    trackChangeIdentity: options.trackChangeIdentity ?? trackId,
    previous: options.previous ?? null,
  });
}

function stateForPreset(presetId = "pix-grid-bass-beacon"): PixGridState {
  const preset = PIX_GRID_PRESET_BY_ID.get(presetId);
  if (!preset) throw new Error(`Missing PixGrid preset ${presetId}`);
  return applyPixGridPresetSettings(
    createDefaultPixGridState(),
    presetId,
    preset.pixGridSettings,
  );
}

function pixelEnergy(pixels: Uint8Array): number {
  let total = 0;
  for (let index = 0; index < pixels.length; index += 4)
    total += pixels[index] + pixels[index + 1] + pixels[index + 2];
  return total;
}

function render(timeSec: number, options: FrameOptions = {}) {
  const context = contextAt(timeSec, options);
  return resolvePixGridPerformanceFrame(
    stateForPreset(),
    context,
    "pix-grid-bass-beacon",
    {
      capabilities: createPixGridAudioFrame(context, {
        isPlaying: true,
        deltaTimeSec: 1 / 60,
        autoPerformanceEnabled: true,
      }).capabilities,
    },
  );
}

function cue(timeSec: number): PixGridActionCue {
  return {
    version: 1,
    id: "architecture-track-map-cue",
    timeSec,
    label: "Architecture handoff",
    enabled: true,
    engineId: "pixGrid",
    action: { type: "setBackground", mode: "black", brightness: 0 },
    quantization: "none",
    transition: "rowWipe",
    transitionDurationSec: 1,
    oneShotDurationSec: 0,
    loopBehavior: "retrigger",
    order: 0,
  };
}

describe("PixGrid native Performance Program architecture", () => {
  it("1. validates every schema-v3 program", () => {
    expect(
      validatePixGridPerformanceProgramCollection(
        PIX_GRID_PERFORMANCE_PROGRAMS,
      ),
    ).toEqual([]);
    expect(
      PIX_GRID_PERFORMANCE_PROGRAMS.every(
        (program) => program.schemaVersion === 3,
      ),
    ).toBe(true);
    const invalid = {
      ...BASS_BEACON_PERFORMANCE_PROGRAM,
      continuousRoutes: [
        {
          ...BASS_BEACON_PERFORMANCE_PROGRAM.continuousRoutes[0],
          target: { bankId: "missing-bank" },
        },
        ...BASS_BEACON_PERFORMANCE_PROGRAM.continuousRoutes.slice(1),
      ],
    };
    expect(
      validatePixGridPerformanceProgram(invalid).some(
        (issue) => issue.code === "missing-route-bank",
      ),
    ).toBe(true);
  });

  it("2. resolves explicit visual-role bindings", () => {
    const compiled = new PixGridPerformanceProgramCompiler().compile(
      BASS_BEACON_PERFORMANCE_PROGRAM,
      stateForPreset(),
    );
    expect(
      compiled.resolvedBindings.some(
        (binding) =>
          binding.roles.includes("hero") && binding.target.id === "bass-word",
      ),
    ).toBe(true);
    expect(
      compiled.resolvedBindings.some((binding) =>
        binding.roles.includes("percussion"),
      ),
    ).toBe(true);
  });

  it("3. resolves banks without bypassing group IDs", () => {
    const compiled = new PixGridPerformanceProgramCompiler().compile(
      BASS_BEACON_PERFORMANCE_PROGRAM,
      stateForPreset(),
    );
    const bassBank = compiled.resolvedBanks.find(
      (bank) => bank.id === "bass-bass-bank",
    );
    expect(bassBank?.targets.map((target) => target.id)).toEqual([
      "bass-kick-group",
      "bass-body-group",
    ]);
    expect(bassBank?.targets.every((target) => target.kind === "group")).toBe(
      true,
    );
  });

  it("4. compiles continuous routes through the assignment compiler and changes pixels", () => {
    const preset = PIX_GRID_PRESET_BY_ID.get("pix-grid-bass-beacon")!;
    const lowContext = contextAt(40, { bass: 0 });
    const highContext = contextAt(40, { bass: 1 });
    const low = resolvePixGridPerformanceFrame(
      stateForPreset(),
      lowContext,
      preset.id,
    );
    const high = resolvePixGridPerformanceFrame(
      stateForPreset(),
      highContext,
      preset.id,
    );
    expect(
      high.state.audioAssignments.some(
        (assignment) =>
          assignment.id.includes("bass-foundation") &&
          assignment.source === "bass",
      ),
    ).toBe(true);
    const lowPixels = composePixGridLogicalFrame(
      preset,
      low.state,
      createPixGridAudioFrame(lowContext, {
        isPlaying: true,
        deltaTimeSec: 1 / 60,
        autoPerformanceEnabled: true,
      }),
    ).pixels;
    const highPixels = composePixGridLogicalFrame(
      preset,
      high.state,
      createPixGridAudioFrame(highContext, {
        isPlaying: true,
        deltaTimeSec: 1 / 60,
        autoPerformanceEnabled: true,
      }),
    ).pixels;
    expect(pixelEnergy(highPixels)).not.toBe(pixelEnergy(lowPixels));

    const occurrenceProgram = {
      ...BASS_BEACON_PERFORMANCE_PROGRAM,
      continuousRoutes: BASS_BEACON_PERFORMANCE_PROGRAM.continuousRoutes.map(
        (route) =>
          route.id === "bass-foundation"
            ? {
                ...route,
                occurrenceVariation: {
                  every: 2,
                  amountScale: 1.5,
                  seedOffset: 7,
                  maxOccurrences: 4,
                },
              }
            : route,
      ),
    };
    const occurrenceAssignments = new PixGridPerformanceProgramCompiler()
      .compile(occurrenceProgram, stateForPreset())
      .assignments.filter((assignment) =>
        assignment.id.includes(
          "program:bass-drop-one:bass-foundation:bank:bass-bass-bank",
        ),
      );
    const occurrenceOne = occurrenceAssignments.find((assignment) =>
      assignment.id.endsWith("occurrence:1"),
    );
    const occurrenceTwo = occurrenceAssignments.find((assignment) =>
      assignment.id.endsWith("occurrence:2"),
    );
    expect(occurrenceAssignments).toHaveLength(8);
    expect(occurrenceOne?.conditions?.sectionOccurrences).toEqual([1]);
    expect(occurrenceTwo?.amount).toBeGreaterThan(occurrenceOne?.amount ?? 0);
    expect(occurrenceTwo?.seedOffset).toBe(14);
  });

  it("5. compiles event routes with authored envelopes", () => {
    const compiled = new PixGridPerformanceProgramCompiler().compile(
      BASS_BEACON_PERFORMANCE_PROGRAM,
      stateForPreset(),
    );
    const kick = compiled.assignments.find((assignment) =>
      assignment.id.includes("kick-impact"),
    );
    const phrase = compiled.assignments.find((assignment) =>
      assignment.id.includes("phrase-recruit"),
    );
    expect(kick).toMatchObject({
      source: "kick",
      retrigger: "restart",
      release: 0.16,
    });
    expect(phrase).toMatchObject({
      source: "phraseEntry",
      quantization: "bar",
    });
  });

  it("6. distinguishes section entry, body, and exit", () => {
    expect(render(32.1).snapshot.sectionPhase).toBe("entry");
    expect(render(44).snapshot.sectionPhase).toBe("body");
    expect(render(63.7).snapshot.sectionPhase).toBe("exit");
  });

  it("7. changes intentional four-bar motifs", () => {
    const first = render(34).snapshot;
    const second = render(42).snapshot;
    expect(first.currentFourBarMotif).not.toBe(second.currentFourBarMotif);
    expect(first.currentFourBarMotif).toMatch(/bass-drop-one:motif:/);
  });

  it("8. advances deterministic eight-bar recruitment", () => {
    const early = render(34).snapshot;
    const late = render(54).snapshot;
    expect(early.currentEightBarRecruitment).not.toBeNull();
    expect(late.eightBarStage).toBeGreaterThan(early.eightBarStage);

    const recruitmentProgram = {
      ...BASS_BEACON_PERFORMANCE_PROGRAM,
      sectionPlans: BASS_BEACON_PERFORMANCE_PROGRAM.sectionPlans.map((plan) =>
        plan.id === "bass-drop-one"
          ? {
              ...plan,
              layerRecruitment: [
                {
                  layerId: "bass-sparkles",
                  opacity: 0.64,
                  stage: "eightBar2" as const,
                },
              ],
              groupRecruitment: [
                {
                  groupId: "bass-hat-group",
                  brightness: 0.48,
                  stage: "eightBar2" as const,
                },
              ],
            }
          : plan,
      ),
    };
    const compiled = new PixGridPerformanceProgramCompiler().compile(
      recruitmentProgram,
      stateForPreset(),
    );
    const recruitment = compiled.sharedProgram.scenes.find(
      (scene) => scene.id === "bass-drop-one",
    )?.eightBarRecruitment?.[1];
    expect(recruitment).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "recruitLayer",
          layerId: "bass-sparkles",
        }),
        expect.objectContaining({
          type: "setGroupActive",
          groupId: "bass-hat-group",
        }),
      ]),
    );
  });

  it("9. advances sixteen-bar evolution", () => {
    const early = render(34).snapshot;
    const late = render(62).snapshot;
    expect(early.currentSixteenBarEvolution).not.toBeNull();
    expect(late.sixteenBarStage).toBeGreaterThanOrEqual(early.sixteenBarStage);
  });

  it("10. resolves Drop 1 and Drop 2 to different occurrence plans", () => {
    expect(render(40).snapshot.activeSectionPlanId).toBe("bass-drop-one");
    expect(render(96).snapshot.activeSectionPlanId).toBe("bass-drop-evolved");
  });

  it("11. reports repeated-section occurrence without changing identity", () => {
    const first = render(16).snapshot;
    const repeated = render(76).snapshot;
    expect(first.sectionOccurrence).toBe(1);
    expect(repeated.sectionOccurrence).toBe(2);
    expect(repeated.programId).toBe(first.programId);
  });

  it("12. resolves a rising density arc into bounded state", () => {
    const compiler = new PixGridPerformanceProgramCompiler();
    const compiled = compiler.compile(
      BASS_BEACON_PERFORMANCE_PROGRAM,
      stateForPreset(),
    );
    expect(
      resolvePixGridProgramArcState(compiled, contextAt(40)).density,
    ).toBeGreaterThan(
      resolvePixGridProgramArcState(compiled, contextAt(2)).density,
    );
    expect(render(40).snapshot.arcState.density).toBeLessThanOrEqual(1);
  });

  it("13. resolves palette intensity by song structure", () => {
    expect(render(40).snapshot.arcState.paletteIntensity).toBeGreaterThan(
      render(68).snapshot.arcState.paletteIntensity,
    );
  });

  it("14. resolves motion amount by song structure", () => {
    expect(render(40).snapshot.arcState.motion).toBeGreaterThan(
      render(2).snapshot.arcState.motion,
    );
  });

  it("15. preserves an explicit negative-space target", () => {
    const intro = render(2).snapshot;
    const drop = render(40).snapshot;
    expect(intro.arcState.negativeSpace).toBeGreaterThan(
      drop.arcState.negativeSpace,
    );
    expect(
      BASS_BEACON_PERFORMANCE_PROGRAM.sectionPlans.every(
        (plan) => plan.negativeSpaceTarget != null,
      ),
    ).toBe(true);
  });

  it("16. compiles deterministic transition plans through the unified transition type", () => {
    const entry = render(32.1);
    expect(
      BASS_BEACON_PERFORMANCE_PROGRAM.sectionPlans.every(
        (plan) => plan.transitionIn != null,
      ),
    ).toBe(true);
    expect(entry.snapshot.transition).toBe("cut");
    expect(
      BASS_BEACON_PERFORMANCE_PROGRAM.sectionPlans.find(
        (plan) => plan.id === "bass-outro",
      )?.transitionOut?.type,
    ).toBe("powerOff");
    const exit = render(135.7).snapshot;
    expect(exit.sectionPhase).toBe("exit");
    expect(exit.transition).toBe("powerOff");
  });

  it("17. skips a missing group without targeting unrelated output", () => {
    const state = stateForPreset();
    const missing = {
      ...state,
      groups: state.groups.filter((group) => group.id !== "bass-snare-group"),
    };
    const compiled = new PixGridPerformanceProgramCompiler().compile(
      BASS_BEACON_PERFORMANCE_PROGRAM,
      missing,
    );
    expect(compiled.missingBindings).not.toContain("bank:bass-snare-bank");
    expect(
      compiled.missingBindings.some((binding) =>
        binding.endsWith("action:group:bass-snare-group"),
      ),
    ).toBe(true);
    const snareActions = compiled.sharedProgram.scenes.flatMap(
      (scene) => scene.eventActions?.snare ?? [],
    );
    expect(
      snareActions.some(
        (action) =>
          action.type === "flashGroup" && action.groupId === "bass-snare-group",
      ),
    ).toBe(false);
    expect(
      compiled.assignments.some((assignment) =>
        assignment.id.includes("snare-outline") &&
        assignment.targetId === "bass-side-accent-group",
      ),
    ).toBe(true);
    expect(
      compiled.assignments.some(
        (assignment) =>
          assignment.id.includes("snare-outline") &&
          assignment.targetId === "bass-body-group",
      ),
    ).toBe(false);
  });

  it("18. preserves explicit missing-source fallback policy", () => {
    const compiled = new PixGridPerformanceProgramCompiler().compile(
      BASS_BEACON_PERFORMANCE_PROGRAM,
      stateForPreset(),
      { vocalEnergy: false, semanticMoment: false },
    );
    expect(
      compiled.assignments.find((assignment) =>
        assignment.id.includes("vocal-focus"),
      )?.capabilityFallback,
    ).toBe("energy");
    expect(
      compiled.compilationWarnings.some(
        (warning) =>
          warning.includes("semanticMoment") && warning.includes("disabled"),
      ),
    ).toBe(true);
  });

  it("19. produces deterministic variation at the same musical position", () => {
    const first = render(40);
    const second = render(40);
    expect(second.snapshot.deterministicIdentity).toBe(
      first.snapshot.deterministicIdentity,
    );
    expect(second.snapshot.currentFourBarMotif).toBe(
      first.snapshot.currentFourBarMotif,
    );
    expect(second.state.layers).toEqual(first.state.layers);
  });

  it("20. reconstructs deterministically after seeking", () => {
    const base = stateForPreset();
    const late = contextAt(60);
    const seek = contextAt(12, { previous: late, seekIdentity: "seek-back" });
    const fresh = contextAt(12, { seekIdentity: "seek-back" });
    expect(seek.seekDetected).toBe(true);
    expect(
      resolvePixGridPerformanceFrame(base, seek, "pix-grid-bass-beacon").state
        .layers,
    ).toEqual(
      resolvePixGridPerformanceFrame(base, fresh, "pix-grid-bass-beacon").state
        .layers,
    );
  });

  it("21. reconstructs deterministically after loop wrapping", () => {
    const base = stateForPreset();
    const late = contextAt(63.8);
    const loop = contextAt(32.1, { previous: late, loopIdentity: "loop-new" });
    expect(loop.loopWrapDetected).toBe(true);
    const first = resolvePixGridPerformanceFrame(
      base,
      loop,
      "pix-grid-bass-beacon",
    );
    const second = resolvePixGridPerformanceFrame(
      base,
      loop,
      "pix-grid-bass-beacon",
    );
    expect(second.state.layers).toEqual(first.state.layers);
  });

  it("22. reconstructs cleanly on track replacement", () => {
    const state = stateForPreset();
    const prior = contextAt(40);
    const replaced = contextAt(40, {
      previous: prior,
      trackId: "track-b",
      trackChangeIdentity: "track-b",
    });
    const freshReplacement = contextAt(40, {
      trackId: "track-b",
      trackChangeIdentity: "track-b",
    });
    const reusedRuntime = new PixGridPerformanceExecutionRuntime();
    resolvePixGridPerformanceFrame(state, prior, "pix-grid-bass-beacon", {
      runtime: reusedRuntime,
    });
    const rebuilt = resolvePixGridPerformanceFrame(
      state,
      replaced,
      "pix-grid-bass-beacon",
      { runtime: reusedRuntime },
    );
    const fresh = resolvePixGridPerformanceFrame(
      state,
      freshReplacement,
      "pix-grid-bass-beacon",
      { runtime: new PixGridPerformanceExecutionRuntime() },
    );
    expect(replaced.trackReplacementDetected).toBe(true);
    expect(rebuilt.state.layers).toEqual(fresh.state.layers);
    expect(rebuilt.snapshot.deterministicIdentity).toBe(
      fresh.snapshot.deterministicIdentity,
    );
  });

  it("23. gives manual locks and user assignments explicit precedence", () => {
    const state = stateForPreset();
    const user = {
      ...createDefaultPixGridReactionAssignment(),
      id: "user-route",
      priority: 900,
      targetScope: "output" as const,
    };
    const resolved = resolvePixGridPerformanceFrame(
      {
        ...state,
        audioAssignments: [user],
        performance: {
          ...state.performance,
          lockedRoutes: ["group:bass-body-group"],
        },
      },
      contextAt(40),
      "pix-grid-bass-beacon",
    );
    expect(resolved.snapshot.manualOverrideRoutes).toContain(
      "group:bass-body-group",
    );
    expect(resolved.snapshot.manualOverridePrecedence).toMatch(
      /user-authored assignments > program routes/,
    );
    expect(
      resolved.state.audioAssignments[
        resolved.state.audioAssignments.length - 1
      ]?.id,
    ).toBe("user-route");
  });

  it("24. keeps Track Map cue handoff and transition precedence compatible", () => {
    const context = contextAt(40);
    const audioFrame = createPixGridAudioFrame(context, {
      isPlaying: true,
      deltaTimeSec: 1 / 60,
      autoPerformanceEnabled: true,
    });
    const resolved = new PixGridUnifiedPerformanceRuntime().resolve({
      authoredState: stateForPreset(),
      context,
      audioFrame,
      presetId: "pix-grid-bass-beacon",
      cues: [cue(39.9)],
      trackId: "track-a",
    });
    expect(resolved.cues.snapshot.activeCueIds).toContain(
      "architecture-track-map-cue",
    );
    expect(resolved.transition?.type).toBe("rowWipe");
    expect(resolved.performance.snapshot.activeEventRoutes).toContain(
      "track-map-handoff",
    );
  });

  it("25. keeps one compiled PixGrid Performance Program runtime active", () => {
    const runtime = new PixGridPerformanceExecutionRuntime();
    const state = stateForPreset();
    resolvePixGridPerformanceFrame(
      state,
      contextAt(34),
      "pix-grid-bass-beacon",
      { runtime },
    );
    resolvePixGridPerformanceFrame(
      state,
      contextAt(42),
      "pix-grid-bass-beacon",
      { runtime },
    );
    expect(runtime.programCompilationCount).toBe(1);
    expect(runtime.cachedProgramCount).toBe(1);
  });
});
