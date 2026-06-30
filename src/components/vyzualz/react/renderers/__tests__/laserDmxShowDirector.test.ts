import { describe, expect, it } from "vitest";
import {
  createDefaultLaserDmxBeamMatrixSettings,
  createDefaultLaserDmxSettings,
  type LaserDmxBeamMatrixCue,
  type ReactTrackSection,
} from "../../ReactTypes";
import {
  DEFAULT_PRODUCTION_ATMOSPHERIC_FIXTURE_SETTINGS,
  normalizeLaserDmxSettings,
  normalizeProductionCompoundCue,
  type ProductionCompoundCue,
} from "../../LaserDmxProductionRig";
import {
  createShowDirectorRuntime,
  diagnoseProductionCues,
  evaluateShowDirector,
  migrateLegacyBeamMatrixCues,
  resolveProductionCueActions,
  resolveProductionCueTimeSec,
} from "../LaserDmxShowDirector";
import type { TrackIntelligenceAnalysis } from "../../../../../features/musicIntelligence/types";

function cue(
  overrides: Partial<ProductionCompoundCue> = {},
): ProductionCompoundCue {
  return {
    id: "cue-1",
    label: "Cue 1",
    enabled: true,
    timing: { mode: "absolute", timeSec: 1 },
    quantize: "none",
    priority: 0,
    retriggerPolicy: "oncePerPass",
    cancellationBehavior: "restoreOnExit",
    fixtureGroupIds: [],
    manualOnly: false,
    actions: [{ id: "action-1", type: "blackout", execution: "simultaneous" }],
    ...overrides,
  };
}

function analysis(): TrackIntelligenceAnalysis {
  return {
    analysisVersion: "test",
    createdAt: "2026-06-30T00:00:00.000Z",
    durationMs: 60000,
    bpm: 120,
    bpmConfidence: 1,
    beatGridOffsetSec: 0,
    timeSignature: 4,
    beatGrid: Array.from({ length: 32 }, (_, index) => ({
      timeSec: index * 0.5,
      confidence: 1,
      isDownbeat: index % 4 === 0,
    })),
    downbeats: Array.from({ length: 8 }, (_, index) => ({
      timeSec: index * 2,
      confidence: 1,
      isDownbeat: true,
    })),
    phrases: [
      { timeSec: 0, phraseLength: 16, confidence: 1 },
      { timeSec: 8, phraseLength: 16, confidence: 1 },
    ],
    sections: [],
    energyCurves: { instant: [], shortTerm: [], bass: [], mid: [], high: [] },
    spectralCurves: { centroid: [], flux: [], complexity: [] },
    stemCurves: null,
    harmonic: {
      keyChanges: [],
      chordProgression: [],
      dominantKey: null,
      dominantMode: null,
      keyConfidence: 0,
      pitchCurve: [],
      melodyContourCurve: [],
    },
    lyrics: null,
    semanticMoments: [],
    warnings: [],
    errors: [],
  };
}

function settingsWithFog() {
  const base = createDefaultLaserDmxSettings();
  const source = base.fixtures[0];
  return normalizeLaserDmxSettings({
    ...base,
    productionGroups: [
      { id: "all", name: "All", fixtureIds: [source.id, "fog-1"] },
    ],
    fixtures: [
      source,
      {
        ...source,
        id: "fog-1",
        name: "Fog 1",
        fixtureKind: "fogger",
        dmx: { ...source.dmx, profileId: "genericFogger", startAddress: 100 },
        atmospheric: {
          ...DEFAULT_PRODUCTION_ATMOSPHERIC_FIXTURE_SETTINGS,
          armed: true,
          cooldownSec: 5,
        },
      },
    ],
  });
}

describe("LaserDMX Show Director", () => {
  it("resolves musical and section-relative placement from analysis without creating a clock", () => {
    const a = analysis();
    const sections: ReactTrackSection[] = [
      {
        id: "drop-1",
        type: "drop",
        label: "Drop 1",
        startSec: 10,
        endSec: 18,
        intensity: 1,
        source: "auto",
      },
    ];
    expect(
      resolveProductionCueTimeSec(
        cue({
          timing: {
            mode: "musical",
            bar: 2,
            beat: 3,
            subdivision: 2,
            subdivisionIndex: 1,
          },
        }),
        120,
        a,
      ),
    ).toBeCloseTo(3.25);
    expect(
      resolveProductionCueTimeSec(
        cue({
          timing: {
            mode: "sectionRelative",
            sectionType: "drop",
            occurrence: 1,
            offsetBars: 1,
            offsetBeats: 1,
            subdivision: 1,
            subdivisionIndex: 0,
            offsetSec: 0.25,
          },
        }),
        120,
        a,
        sections,
      ),
    ).toBeCloseTo(12.75);
  });

  it("preserves simultaneous starts and advances sequential actions deterministically", () => {
    const actions = resolveProductionCueActions(
      [
        cue({
          durationMs: 100,
          actions: [
            { id: "a", type: "blackout", execution: "simultaneous" },
            {
              id: "b",
              type: "reveal",
              execution: "sequential",
              durationMs: 200,
            },
            { id: "c", type: "blackout", execution: "sequential", delayMs: 50 },
          ],
        }),
      ],
      120,
    );
    expect(actions.map((item) => item.startTimeSec)).toEqual([1, 1, 1.25]);
  });

  it("uses priority and stable action order for simultaneous writes", () => {
    const settings = normalizeLaserDmxSettings({
      ...createDefaultLaserDmxSettings(),
      productionCues: [
        cue({
          id: "low",
          priority: 1,
          actions: [
            { id: "low-a", type: "blackout", execution: "simultaneous" },
          ],
        }),
        cue({
          id: "high",
          priority: 10,
          actions: [
            { id: "high-a", type: "reveal", execution: "simultaneous" },
          ],
        }),
      ],
    });
    const result = evaluateShowDirector(createShowDirectorRuntime(), {
      settings,
      beamMatrix: createDefaultLaserDmxBeamMatrixSettings(),
      audioTimeSec: 2,
      isPlaying: true,
      bpm: 120,
      trackKey: "track",
      presetKey: "preset",
    });
    expect(result.settings.blackout).toBe(false);
    expect(
      result.diagnostics.some((item) => item.code === "property-conflict"),
    ).toBe(true);
  });

  it("reconstructs persistent state after seeks while suppressing momentary seek triggers", () => {
    const base = settingsWithFog();
    const settings = normalizeLaserDmxSettings({
      ...base,
      productionCues: [
        cue({
          id: "blackout",
          actions: [
            { id: "blackout-a", type: "blackout", execution: "simultaneous" },
          ],
        }),
        cue({
          id: "fog",
          actions: [
            {
              id: "fog-a",
              type: "fogBurst",
              execution: "simultaneous",
              fixtureId: "fog-1",
              intensity: 1,
            },
          ],
        }),
      ],
    });
    const result = evaluateShowDirector(createShowDirectorRuntime(), {
      settings,
      beamMatrix: createDefaultLaserDmxBeamMatrixSettings(),
      audioTimeSec: 4,
      isPlaying: true,
      timingDiscontinuity: true,
      bpm: 120,
      trackKey: "track",
      presetKey: "preset",
    });
    expect(result.settings.blackout).toBe(true);
    expect(
      result.settings.fixtures.find((fixture) => fixture.id === "fog-1")
        ?.atmospheric?.triggerRequestId,
    ).toBe(0);
  });

  it("fires momentary actions once per crossing, ignores duplicate frames, and rearms on loop-back", () => {
    const base = settingsWithFog();
    const settings = normalizeLaserDmxSettings({
      ...base,
      productionCues: [
        cue({
          id: "fog",
          actions: [
            {
              id: "fog-a",
              type: "fogBurst",
              execution: "simultaneous",
              fixtureId: "fog-1",
              intensity: 1,
            },
          ],
        }),
      ],
    });
    const runtime = createShowDirectorRuntime();
    const input = {
      settings,
      beamMatrix: createDefaultLaserDmxBeamMatrixSettings(),
      isPlaying: true,
      bpm: 120,
      trackKey: "track",
      presetKey: "preset",
    };
    evaluateShowDirector(runtime, { ...input, audioTimeSec: 0.8 });
    const first = evaluateShowDirector(runtime, {
      ...input,
      audioTimeSec: 1.1,
    });
    expect(
      first.settings.fixtures.find((fixture) => fixture.id === "fog-1")
        ?.atmospheric?.triggerRequestId,
    ).toBe(1);
    const duplicate = evaluateShowDirector(runtime, {
      ...input,
      audioTimeSec: 1.1,
    });
    expect(
      duplicate.settings.fixtures.find((fixture) => fixture.id === "fog-1")
        ?.atmospheric?.triggerRequestId,
    ).toBe(0);
    evaluateShowDirector(runtime, { ...input, audioTimeSec: 0.8 });
    const second = evaluateShowDirector(runtime, {
      ...input,
      audioTimeSec: 1.1,
    });
    expect(
      second.settings.fixtures.find((fixture) => fixture.id === "fog-1")
        ?.atmospheric?.triggerRequestId,
    ).toBe(2);
  });

  it("reports missing references, capability conflicts, simultaneous writes, and cooldown violations", () => {
    const base = settingsWithFog();
    const settings = normalizeLaserDmxSettings({
      ...base,
      productionCues: [
        cue({
          id: "bad-look",
          actions: [
            {
              id: "a",
              type: "activateLook",
              execution: "simultaneous",
              lookId: "missing",
            },
          ],
        }),
        cue({
          id: "bad-capability",
          actions: [
            {
              id: "b",
              type: "cryoBurst",
              execution: "simultaneous",
              fixtureId: "fog-1",
              intensity: 1,
            },
          ],
        }),
        cue({
          id: "fog-1-cue",
          timing: { mode: "absolute", timeSec: 1 },
          actions: [
            {
              id: "c",
              type: "fogBurst",
              execution: "simultaneous",
              fixtureId: "fog-1",
              intensity: 1,
            },
          ],
        }),
        cue({
          id: "fog-2-cue",
          timing: { mode: "absolute", timeSec: 2 },
          actions: [
            {
              id: "d",
              type: "fogBurst",
              execution: "simultaneous",
              fixtureId: "fog-1",
              intensity: 1,
            },
          ],
        }),
      ],
    });
    const codes = new Set(
      diagnoseProductionCues(
        settings,
        createDefaultLaserDmxBeamMatrixSettings(),
        120,
      ).map((item) => item.code),
    );
    expect(codes).toEqual(
      expect.objectContaining(
        new Set([
          "missing-look",
          "unsupported-capability",
          "cooldown-violation",
        ]),
      ),
    );
  });

  it("migrates legacy gate and trigger cues with stable compatibility IDs", () => {
    const legacy: LaserDmxBeamMatrixCue[] = [
      {
        id: "legacy-1",
        name: "Legacy Gate",
        enabled: true,
        targetType: "group",
        targetId: "grp-bass",
        timingMode: "absolute",
        action: "gate",
        startMs: 1000,
        endMs: 3000,
      },
    ];
    const once = migrateLegacyBeamMatrixCues(legacy);
    const twice = migrateLegacyBeamMatrixCues(legacy, once);
    expect(once).toHaveLength(1);
    expect(twice).toHaveLength(1);
    expect(once[0].id).toBe("production-cue:legacy:legacy-1");
    expect(once[0].actions[0]).toMatchObject({
      type: "triggerLegacyBeamAction",
      legacyCueId: "legacy-1",
    });
    expect(once[0].durationMs).toBe(2000);
  });

  it("fires a selected cue manually without changing authored timing", () => {
    const authored = cue({
      id: "manual",
      timing: { mode: "absolute", timeSec: 30 },
      actions: [
        { id: "manual-a", type: "blackout", execution: "simultaneous" },
      ],
    });
    const settings = normalizeLaserDmxSettings({
      ...createDefaultLaserDmxSettings(),
      productionCues: [authored],
    });
    const result = evaluateShowDirector(createShowDirectorRuntime(), {
      settings,
      beamMatrix: createDefaultLaserDmxBeamMatrixSettings(),
      audioTimeSec: 5,
      isPlaying: true,
      bpm: 120,
      trackKey: "track",
      presetKey: "preset",
      manualRequest: { cueId: "manual", sequence: 1 },
    });
    expect(result.settings.blackout).toBe(true);
    expect(result.settings.productionCues?.[0].timing).toEqual({
      mode: "absolute",
      timeSec: 30,
    });
  });

  it("waits for real BPM or grid data instead of placing musical cues at a fallback tempo", () => {
    const musical = cue({
      timing: {
        mode: "musical",
        bar: 2,
        beat: 1,
        subdivision: 1,
        subdivisionIndex: 0,
      },
    });
    expect(resolveProductionCueTimeSec(musical, 0, null)).toBeNull();
    const effective = {
      ...analysis(),
      bpm: 0,
      bpmUsedForGrid: 150,
      beatGrid: Array.from({ length: 16 }, (_, index) => ({
        timeSec: index * 0.4,
        confidence: 1,
        isDownbeat: index % 4 === 0,
      })),
    };
    expect(resolveProductionCueTimeSec(musical, 0, effective)).toBeCloseTo(1.6);
  });

  it("uses cue-level fixture groups and family defaults for compound action targeting", () => {
    const base = settingsWithFog();
    const settings = normalizeLaserDmxSettings({
      ...base,
      productionCues: [
        cue({
          id: "group-fog",
          fixtureGroupIds: ["all"],
          actions: [
            {
              id: "fog-a",
              type: "fogBurst",
              execution: "simultaneous",
              intensity: 0.8,
            },
          ],
        }),
      ],
    });
    const runtime = createShowDirectorRuntime();
    evaluateShowDirector(runtime, {
      settings,
      beamMatrix: createDefaultLaserDmxBeamMatrixSettings(),
      audioTimeSec: 0.8,
      isPlaying: true,
      bpm: 120,
      trackKey: "track",
      presetKey: "preset",
    });
    const fired = evaluateShowDirector(runtime, {
      settings,
      beamMatrix: createDefaultLaserDmxBeamMatrixSettings(),
      audioTimeSec: 1.1,
      isPlaying: true,
      bpm: 120,
      trackKey: "track",
      presetKey: "preset",
    });
    expect(
      fired.settings.fixtures.find((fixture) => fixture.id === "fog-1")
        ?.atmospheric?.triggerRequestId,
    ).toBe(1);
  });

  it("fires a momentary cue authored at track start on the first normal playback frame", () => {
    const base = settingsWithFog();
    const settings = normalizeLaserDmxSettings({
      ...base,
      productionCues: [
        cue({
          id: "zero",
          timing: { mode: "absolute", timeSec: 0 },
          actions: [
            {
              id: "fog-a",
              type: "fogBurst",
              execution: "simultaneous",
              fixtureId: "fog-1",
              intensity: 1,
            },
          ],
        }),
      ],
    });
    const result = evaluateShowDirector(createShowDirectorRuntime(), {
      settings,
      beamMatrix: createDefaultLaserDmxBeamMatrixSettings(),
      audioTimeSec: 0.05,
      isPlaying: true,
      bpm: 120,
      trackKey: "track",
      presetKey: "preset",
    });
    expect(
      result.settings.fixtures.find((fixture) => fixture.id === "fog-1")
        ?.atmospheric?.triggerRequestId,
    ).toBe(1);
  });

  it("restores finite actions after their authored duration", () => {
    const settings = normalizeLaserDmxSettings({
      ...createDefaultLaserDmxSettings(),
      productionCues: [
        cue({
          durationMs: 500,
          cancellationBehavior: "restoreOnExit",
          actions: [
            { id: "blackout-a", type: "blackout", execution: "simultaneous" },
          ],
        }),
      ],
    });
    const runtime = createShowDirectorRuntime();
    const input = {
      settings,
      beamMatrix: createDefaultLaserDmxBeamMatrixSettings(),
      isPlaying: true,
      bpm: 120,
      trackKey: "track",
      presetKey: "preset",
    };
    evaluateShowDirector(runtime, { ...input, audioTimeSec: 0.9 });
    expect(
      evaluateShowDirector(runtime, { ...input, audioTimeSec: 1.1 }).settings
        .blackout,
    ).toBe(true);
    expect(
      evaluateShowDirector(runtime, { ...input, audioTimeSec: 1.6 }).settings
        .blackout,
    ).toBe(false);
  });

  it("reconstructs persistent state and suppresses momentary effects when the track or preset identity changes", () => {
    const base = settingsWithFog();
    const settings = normalizeLaserDmxSettings({
      ...base,
      productionCues: [
        cue({
          id: "identity-blackout",
          actions: [
            { id: "blackout-a", type: "blackout", execution: "simultaneous" },
          ],
        }),
        cue({
          id: "identity-fog",
          actions: [
            {
              id: "fog-a",
              type: "fogBurst",
              execution: "simultaneous",
              fixtureId: "fog-1",
              intensity: 1,
            },
          ],
        }),
      ],
    });
    const beamMatrix = createDefaultLaserDmxBeamMatrixSettings();

    const trackRuntime = createShowDirectorRuntime();
    evaluateShowDirector(trackRuntime, {
      settings,
      beamMatrix,
      audioTimeSec: 0.8,
      isPlaying: true,
      bpm: 120,
      trackKey: "track-a",
      presetKey: "preset-a",
    });
    const replacedTrack = evaluateShowDirector(trackRuntime, {
      settings,
      beamMatrix,
      audioTimeSec: 1.1,
      isPlaying: true,
      bpm: 120,
      trackKey: "track-b",
      presetKey: "preset-a",
    });
    expect(replacedTrack.settings.blackout).toBe(true);
    expect(
      replacedTrack.settings.fixtures.find((fixture) => fixture.id === "fog-1")
        ?.atmospheric?.triggerRequestId,
    ).toBe(0);

    const presetRuntime = createShowDirectorRuntime();
    evaluateShowDirector(presetRuntime, {
      settings,
      beamMatrix,
      audioTimeSec: 0.8,
      isPlaying: true,
      bpm: 120,
      trackKey: "track-a",
      presetKey: "preset-a",
    });
    const replacedPreset = evaluateShowDirector(presetRuntime, {
      settings,
      beamMatrix,
      audioTimeSec: 1.1,
      isPlaying: true,
      bpm: 120,
      trackKey: "track-a",
      presetKey: "preset-b",
    });
    expect(replacedPreset.settings.blackout).toBe(true);
    expect(
      replacedPreset.settings.fixtures.find((fixture) => fixture.id === "fog-1")
        ?.atmospheric?.triggerRequestId,
    ).toBe(0);
  });

  it("reconstructs musical persistent actions without firing momentary effects when analysis arrives late", () => {
    const base = settingsWithFog();
    const musicalTiming = {
      mode: "musical" as const,
      bar: 2,
      beat: 1,
      subdivision: 1 as const,
      subdivisionIndex: 0,
    };
    const settings = normalizeLaserDmxSettings({
      ...base,
      productionCues: [
        cue({
          id: "late-blackout",
          timing: musicalTiming,
          actions: [
            { id: "blackout-a", type: "blackout", execution: "simultaneous" },
          ],
        }),
        cue({
          id: "late-fog",
          timing: musicalTiming,
          actions: [
            {
              id: "fog-a",
              type: "fogBurst",
              execution: "simultaneous",
              fixtureId: "fog-1",
              intensity: 1,
            },
          ],
        }),
      ],
    });
    const runtime = createShowDirectorRuntime();
    const input = {
      settings,
      beamMatrix: createDefaultLaserDmxBeamMatrixSettings(),
      isPlaying: true,
      bpm: 0,
      trackKey: "track",
      presetKey: "preset",
    };
    evaluateShowDirector(runtime, {
      ...input,
      audioTimeSec: 1.8,
      analysis: null,
    });
    const loaded = evaluateShowDirector(runtime, {
      ...input,
      audioTimeSec: 2.1,
      analysis: analysis(),
    });
    expect(loaded.settings.blackout).toBe(true);
    expect(
      loaded.settings.fixtures.find((fixture) => fixture.id === "fog-1")
        ?.atmospheric?.triggerRequestId,
    ).toBe(0);
  });

  it("suppresses momentary triggers when section timing is replaced during playback", () => {
    const base = settingsWithFog();
    const settings = normalizeLaserDmxSettings({
      ...base,
      productionCues: [
        cue({
          id: "section-fog",
          timing: {
            mode: "sectionRelative",
            sectionType: "drop",
            occurrence: 1,
            offsetBars: 0,
            offsetBeats: 0,
            subdivision: 1,
            subdivisionIndex: 0,
            offsetSec: 0,
          },
          actions: [
            {
              id: "fog-a",
              type: "fogBurst",
              execution: "simultaneous",
              fixtureId: "fog-1",
              intensity: 1,
            },
          ],
        }),
      ],
    });
    const runtime = createShowDirectorRuntime();
    const input = {
      settings,
      beamMatrix: createDefaultLaserDmxBeamMatrixSettings(),
      isPlaying: true,
      bpm: 120,
      trackKey: "track",
      presetKey: "preset",
    };
    const before: ReactTrackSection[] = [
      {
        id: "drop",
        type: "drop",
        label: "Drop",
        startSec: 2,
        endSec: 8,
        intensity: 1,
        source: "auto",
      },
    ];
    const replaced: ReactTrackSection[] = [{ ...before[0], startSec: 0.75 }];
    evaluateShowDirector(runtime, {
      ...input,
      audioTimeSec: 0.5,
      sections: before,
    });
    const changed = evaluateShowDirector(runtime, {
      ...input,
      audioTimeSec: 0.8,
      sections: replaced,
    });
    expect(
      changed.settings.fixtures.find((fixture) => fixture.id === "fog-1")
        ?.atmospheric?.triggerRequestId,
    ).toBe(0);
  });

  it("preserves musical legacy gate length in beats rather than baking in 120 BPM", () => {
    const migrated = migrateLegacyBeamMatrixCues([
      {
        id: "musical-gate",
        name: "Musical Gate",
        enabled: true,
        targetType: "group",
        targetId: "grp-bass",
        timingMode: "musical",
        action: "gate",
        startBar: 1,
        startBeat: 1,
        endBar: 2,
        endBeat: 1,
      },
    ]);
    expect(migrated[0].durationMs).toBeUndefined();
    const actions = resolveProductionCueActions(migrated, 100);
    expect(actions[0].endTimeSec - actions[0].startTimeSec).toBeCloseTo(2.4);
  });

  it("migrates Patch 6 compound actions and waits into stable ordered actions", () => {
    const migrated = normalizeProductionCompoundCue({
      id: "patch-6",
      name: "Patch 6 Cue",
      enabled: true,
      actions: [
        { type: "blackout", enabled: true },
        { type: "wait", durationMs: 250 },
        {
          type: "setGroupProperties",
          groupId: "all",
          properties: { dimmer: 0.5 },
        },
      ],
      quantize: "beat",
    });
    expect(migrated.label).toBe("Patch 6 Cue");
    expect(migrated.actions).toHaveLength(2);
    expect(migrated.actions[0]).toMatchObject({
      type: "blackout",
      execution: "simultaneous",
    });
    expect(migrated.actions[1]).toMatchObject({
      type: "setFixtureProperty",
      groupId: "all",
      execution: "sequential",
      delayMs: 250,
    });
  });
});
