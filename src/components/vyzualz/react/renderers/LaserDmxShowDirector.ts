import type {
  LaserDmxBeamMatrixCue,
  LaserDmxBeamMatrixSettings,
  LaserDmxFixture,
  LaserDmxSettings,
  ReactTrackSection,
} from "../ReactTypes";
import type { TrackIntelligenceAnalysis } from "../../../../features/musicIntelligence/types";
import {
  DEFAULT_PRODUCTION_CHASE,
  DEFAULT_PRODUCTION_GROUP_MOVEMENT,
  DEFAULT_PRODUCTION_FLASH_PATTERN,
  normalizeLaserDmxSettings,
  normalizeProductionChase,
  normalizeProductionFlashPattern,
  normalizeProductionGroupMovement,
  resolveLaserDmxFixtureCapabilities,
  type ProductionCompoundCue,
  type ProductionCueAction,
  type ProductionCueQuantize,
  type ProductionFixturePropertyState,
  type ProductionGroupMovementConfig,
} from "../LaserDmxProductionRig";
import {
  applyProductionLook,
  interpolateProductionLookSettings,
} from "./LaserDmxProductionLookEngine";

export type ShowDirectorDiagnosticCode =
  | "missing-look"
  | "missing-fixture"
  | "missing-group"
  | "missing-target"
  | "unsupported-capability"
  | "property-conflict"
  | "cooldown-violation"
  | "unresolved-timing";

export interface ShowDirectorDiagnostic {
  code: ShowDirectorDiagnosticCode;
  severity: "warning" | "error";
  cueId: string;
  actionId?: string;
  message: string;
}

export interface ResolvedProductionCueAction {
  cue: ProductionCompoundCue;
  action: ProductionCueAction;
  cueTimeSec: number;
  startTimeSec: number;
  endTimeSec: number;
  order: number;
}

export interface ShowDirectorManualRequest {
  cueId: string;
  sequence: number;
}

export interface ShowDirectorEvaluationInput {
  settings: LaserDmxSettings;
  beamMatrix: LaserDmxBeamMatrixSettings;
  audioTimeSec: number;
  isPlaying: boolean;
  timingDiscontinuity?: boolean;
  bpm: number;
  analysis?: TrackIntelligenceAnalysis | null;
  sections?: readonly ReactTrackSection[];
  trackKey?: string | null;
  presetKey?: string | null;
  manualRequest?: ShowDirectorManualRequest | null;
}

export interface ShowDirectorEvaluationResult {
  settings: LaserDmxSettings;
  beamMatrix: LaserDmxBeamMatrixSettings;
  firedCueIds: string[];
  activeCueIds: string[];
  diagnostics: ShowDirectorDiagnostic[];
}

interface ManualRun {
  cueId: string;
  startedAtSec: number;
  sequence: number;
}

export interface ShowDirectorRuntime {
  previousAudioTimeSec: number | null;
  previousTrackKey: string | null;
  previousPresetKey: string | null;
  previousAnalysisKey: string | null;
  previousSectionsKey: string | null;
  transportPass: number;
  lastManualSequence: number;
  manualRuns: ManualRun[];
  firedKeys: Set<string>;
  atmosphericRequestId: number;
  snapRequestId: number;
}

const EPSILON = 0.0005;
const DEFAULT_EFFECT_BPM = 120;

export function createShowDirectorRuntime(): ShowDirectorRuntime {
  return {
    previousAudioTimeSec: null,
    previousTrackKey: null,
    previousPresetKey: null,
    previousAnalysisKey: null,
    previousSectionsKey: null,
    transportPass: 0,
    lastManualSequence: 0,
    manualRuns: [],
    firedKeys: new Set(),
    atmosphericRequestId: 0,
    snapRequestId: 0,
  };
}

export function resetShowDirectorRuntime(runtime: ShowDirectorRuntime): void {
  const next = createShowDirectorRuntime();
  runtime.previousAudioTimeSec = next.previousAudioTimeSec;
  runtime.previousTrackKey = next.previousTrackKey;
  runtime.previousPresetKey = next.previousPresetKey;
  runtime.previousAnalysisKey = next.previousAnalysisKey;
  runtime.previousSectionsKey = next.previousSectionsKey;
  runtime.transportPass = next.transportPass;
  runtime.lastManualSequence = next.lastManualSequence;
  runtime.manualRuns = next.manualRuns;
  runtime.firedKeys = next.firedKeys;
  runtime.atmosphericRequestId = next.atmosphericRequestId;
  runtime.snapRequestId = next.snapRequestId;
}

function clone<T>(value: T): T {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

function analysisKey(
  analysis?: TrackIntelligenceAnalysis | null,
): string | null {
  if (!analysis) return null;
  const grid = analysis.beatGrid ?? [];
  const first = grid[0]?.timeSec ?? "";
  const second = grid[1]?.timeSec ?? "";
  const last = grid[grid.length - 1]?.timeSec ?? "";
  return [
    analysis.analysisVersion,
    analysis.createdAt,
    analysis.bpmUsedForGrid ?? analysis.bpm ?? "",
    analysis.beatGridOffsetSec ?? "",
    grid.length,
    first,
    second,
    last,
    analysis.downbeats?.length ?? 0,
    analysis.sections.length,
  ].join(":");
}

function sectionsKey(sections: readonly ReactTrackSection[] = []): string {
  return sections
    .map(
      (section) =>
        `${section.id}:${section.type}:${section.startSec}:${section.endSec}:${section.source}`,
    )
    .join("|");
}

/** Returns only real timing data. Authored musical placement never assumes 120 BPM. */
function knownBpm(
  input: number,
  analysis?: TrackIntelligenceAnalysis | null,
): number | null {
  const candidate =
    input > 0
      ? input
      : (analysis?.bpmUsedForGrid ?? 0) > 0
        ? analysis!.bpmUsedForGrid!
        : (analysis?.bpm ?? 0);
  return Number.isFinite(candidate) && candidate > 0 ? candidate : null;
}

/** Local duration fallback for manual effects only; it never places an authored cue. */
function effectBpm(
  input: number,
  analysis?: TrackIntelligenceAnalysis | null,
): number {
  return knownBpm(input, analysis) ?? DEFAULT_EFFECT_BPM;
}

function beatDuration(bpm: number): number {
  return 60 / Math.max(1, bpm);
}

function timeSignature(analysis?: TrackIntelligenceAnalysis | null): number {
  return Math.max(1, Math.round(analysis?.timeSignature || 4));
}

function beatTimeAtIndex(
  index: number,
  bpm: number | null,
  analysis?: TrackIntelligenceAnalysis | null,
): number | null {
  const beatIndex = Math.max(0, index);
  const grid = analysis?.beatGrid ?? [];
  if (grid.length > 0) {
    if (beatIndex < grid.length) return grid[beatIndex].timeSec;
    if (bpm == null) return null;
    return (
      grid[grid.length - 1].timeSec +
      (beatIndex - grid.length + 1) * beatDuration(bpm)
    );
  }
  if (bpm == null) return null;
  return (
    Math.max(0, analysis?.beatGridOffsetSec ?? 0) +
    beatIndex * beatDuration(bpm)
  );
}

function nearestGridTime(
  timeSec: number,
  values: readonly number[],
): number | null {
  return (
    values
      .filter(Number.isFinite)
      .sort((a, b) => Math.abs(a - timeSec) - Math.abs(b - timeSec))[0] ?? null
  );
}

function quantizeTime(
  timeSec: number,
  quantize: ProductionCueQuantize,
  bpm: number | null,
  analysis?: TrackIntelligenceAnalysis | null,
  sections: readonly ReactTrackSection[] = [],
): number | null {
  if (quantize === "none") return Math.max(0, timeSec);
  if (quantize === "section") {
    const candidate = nearestGridTime(
      timeSec,
      sections.map((section) => section.startSec),
    );
    return candidate == null ? null : candidate;
  }
  if (quantize === "phrase") {
    const candidate = nearestGridTime(
      timeSec,
      (analysis?.phrases ?? []).map((phrase) => phrase.timeSec),
    );
    return candidate == null ? null : candidate;
  }
  if (quantize === "beat") {
    const candidate = nearestGridTime(
      timeSec,
      (analysis?.beatGrid ?? []).map((marker) => marker.timeSec),
    );
    if (candidate != null) return candidate;
  }
  if (quantize === "bar") {
    const downbeats =
      analysis?.downbeats?.map((marker) => marker.timeSec) ?? [];
    const candidate = nearestGridTime(
      timeSec,
      downbeats.length
        ? downbeats
        : (analysis?.beatGrid ?? [])
            .filter((marker) => marker.isDownbeat)
            .map((marker) => marker.timeSec),
    );
    if (candidate != null) return candidate;
  }
  if (bpm == null) return null;
  const division =
    quantize === "bar"
      ? timeSignature(analysis)
      : quantize === "beat"
        ? 1
        : quantize === "eighth"
          ? 0.5
          : 0.25;
  const seconds = beatDuration(bpm) * division;
  const origin = Math.max(0, analysis?.beatGridOffsetSec ?? 0);
  return Math.max(
    0,
    origin + Math.round((timeSec - origin) / seconds) * seconds,
  );
}

export function resolveProductionCueTimeSec(
  cue: ProductionCompoundCue,
  bpmInput: number,
  analysis?: TrackIntelligenceAnalysis | null,
  sections: readonly ReactTrackSection[] = [],
): number | null {
  const bpm = knownBpm(bpmInput, analysis);
  const timing = cue.timing;
  if (timing.mode === "manual") return null;
  let rawTime = 0;
  if (timing.mode === "absolute") {
    rawTime = timing.timeSec;
  } else if (timing.mode === "musical") {
    const beatsPerBar = timeSignature(analysis);
    const beatIndex =
      (Math.max(1, timing.bar) - 1) * beatsPerBar +
      (Math.max(1, timing.beat) - 1);
    const subdivisionOffset =
      Math.max(0, timing.subdivisionIndex) / Math.max(1, timing.subdivision);
    const a = beatTimeAtIndex(beatIndex, bpm, analysis);
    const b = beatTimeAtIndex(beatIndex + 1, bpm, analysis);
    if (a == null || b == null) return null;
    rawTime = a + (b - a) * subdivisionOffset;
  } else {
    const candidates = sections
      .filter((section) =>
        timing.sectionId
          ? section.id === timing.sectionId
          : !timing.sectionType || section.type === timing.sectionType,
      )
      .sort((a, b) => a.startSec - b.startSec);
    const section = candidates[Math.max(0, timing.occurrence - 1)];
    if (!section) return null;
    const beatOffset =
      timing.offsetBars * timeSignature(analysis) +
      timing.offsetBeats +
      Math.max(0, timing.subdivisionIndex) / Math.max(1, timing.subdivision);
    if (beatOffset !== 0 && bpm == null) return null;
    rawTime =
      section.startSec +
      beatOffset * (bpm == null ? 0 : beatDuration(bpm)) +
      timing.offsetSec;
  }
  return quantizeTime(rawTime, cue.quantize, bpm, analysis, sections);
}

function actionDurationSec(
  action: ProductionCueAction,
  cue: ProductionCompoundCue,
  bpm: number,
): number {
  if (action.durationMs != null) return Math.max(0, action.durationMs / 1000);
  if (cue.durationMs != null) return Math.max(0, cue.durationMs / 1000);
  if (action.type === "pulse" || action.type === "blinderHit")
    return beatDuration(bpm) * 0.5;
  if (action.type === "strobeBurst") return beatDuration(bpm);
  if (action.type === "fogBurst") return 2.2;
  if (action.type === "cryoBurst") return 0.9;
  if (action.type === "fadeToLook")
    return Math.max(0, (action.transitionMs ?? cue.transitionMs ?? 600) / 1000);
  if (action.type === "triggerLegacyBeamAction" && action.legacyDurationBeats != null)
    return Math.max(0, action.legacyDurationBeats) * beatDuration(bpm);
  return 0;
}

export function resolveProductionCueActions(
  cues: readonly ProductionCompoundCue[],
  bpmInput: number,
  analysis?: TrackIntelligenceAnalysis | null,
  sections: readonly ReactTrackSection[] = [],
): ResolvedProductionCueAction[] {
  const bpm = effectBpm(bpmInput, analysis);
  const result: ResolvedProductionCueAction[] = [];
  for (const cue of cues) {
    if (!cue.enabled || cue.manualOnly || cue.timing.mode === "manual")
      continue;
    const cueTimeSec = resolveProductionCueTimeSec(
      cue,
      bpmInput,
      analysis,
      sections,
    );
    if (cueTimeSec == null) continue;
    let sequentialCursor = cueTimeSec;
    cue.actions.forEach((action, actionIndex) => {
      const delaySec = Math.max(0, action.delayMs ?? 0) / 1000;
      const startTimeSec =
        (action.execution === "sequential" ? sequentialCursor : cueTimeSec) +
        delaySec;
      const durationSec = actionDurationSec(action, cue, bpm);
      const endTimeSec = startTimeSec + durationSec;
      result.push({
        cue,
        action,
        cueTimeSec,
        startTimeSec,
        endTimeSec,
        order: actionIndex,
      });
      if (action.execution === "sequential") sequentialCursor = endTimeSec;
    });
  }
  return result.sort(
    (a, b) =>
      a.startTimeSec - b.startTimeSec ||
      a.cue.priority - b.cue.priority ||
      a.order - b.order ||
      a.cue.id.localeCompare(b.cue.id),
  );
}

function targetFixtureIds(
  settings: LaserDmxSettings,
  action: ProductionCueAction,
  cue?: ProductionCompoundCue,
): string[] {
  const fixtureId = "fixtureId" in action ? action.fixtureId : undefined;
  const groupId = "groupId" in action ? action.groupId : undefined;
  if (fixtureId)
    return settings.fixtures.some((fixture) => fixture.id === fixtureId)
      ? [fixtureId]
      : [];
  if (groupId)
    return (
      settings.productionGroups?.find((group) => group.id === groupId)
        ?.fixtureIds ?? []
    );
  const cueTargets = (cue?.fixtureGroupIds ?? []).flatMap(
    (id) =>
      settings.productionGroups?.find((group) => group.id === id)?.fixtureIds ??
      [],
  );
  if (cueTargets.length) return [...new Set(cueTargets)];
  if (action.type === "strobeBurst")
    return settings.fixtures
      .filter((fixture) => resolveLaserDmxFixtureCapabilities(fixture)?.strobe)
      .map((fixture) => fixture.id);
  if (action.type === "blinderHit")
    return settings.fixtures
      .filter((fixture) => fixture.fixtureKind === "blinder")
      .map((fixture) => fixture.id);
  if (action.type === "fogBurst")
    return settings.fixtures
      .filter(
        (fixture) =>
          resolveLaserDmxFixtureCapabilities(fixture)?.atmosphericOutput
            ?.medium === "fog",
      )
      .map((fixture) => fixture.id);
  if (action.type === "cryoBurst")
    return settings.fixtures
      .filter(
        (fixture) =>
          resolveLaserDmxFixtureCapabilities(fixture)?.atmosphericOutput
            ?.medium === "cryo",
      )
      .map((fixture) => fixture.id);
  return [];
}

function updateFixtures(
  settings: LaserDmxSettings,
  ids: readonly string[],
  update: (fixture: LaserDmxFixture) => LaserDmxFixture,
): LaserDmxSettings {
  const selected = new Set(ids);
  return {
    ...settings,
    fixtures: settings.fixtures.map((fixture) =>
      selected.has(fixture.id) ? update(clone(fixture)) : fixture,
    ),
  };
}

function applyFixtureProperties(
  fixture: LaserDmxFixture,
  properties: ProductionFixturePropertyState,
): LaserDmxFixture {
  if (properties.dimmer != null) fixture.beam.dimmer = properties.dimmer;
  if (properties.shutterOpen != null)
    fixture.beam.shutterOpen = properties.shutterOpen;
  if (properties.strobeRate != null)
    fixture.beam.strobeRate = properties.strobeRate;
  if (properties.zoom != null) fixture.beam.zoom = properties.zoom;
  if (properties.focus != null) fixture.beam.focus = properties.focus;
  if (properties.panDeg != null) {
    fixture.position.pan = properties.panDeg;
    if (fixture.movingHead) fixture.movingHead.panDeg = properties.panDeg;
  }
  if (properties.tiltDeg != null) {
    fixture.position.tilt = properties.tiltDeg;
    if (fixture.movingHead) fixture.movingHead.tiltDeg = properties.tiltDeg;
  }
  if (properties.color) {
    fixture.color = {
      ...fixture.color,
      ...(properties.color.red != null ? { red: properties.color.red } : {}),
      ...(properties.color.green != null
        ? { green: properties.color.green }
        : {}),
      ...(properties.color.blue != null ? { blue: properties.color.blue } : {}),
      ...(properties.color.white != null
        ? { white: properties.color.white }
        : {}),
    };
  }
  if (fixture.movingHead) {
    if (properties.colorWheelSlot != null)
      fixture.movingHead.colorWheelSlot = properties.colorWheelSlot;
    if (properties.iris != null) fixture.movingHead.iris = properties.iris;
    if (properties.frost != null) fixture.movingHead.frost = properties.frost;
    if (properties.goboIndex != null)
      fixture.movingHead.goboIndex = properties.goboIndex;
    if (properties.goboRotation != null)
      fixture.movingHead.goboRotation = properties.goboRotation;
    if (properties.prismFacets != null)
      fixture.movingHead.prismFacets = properties.prismFacets;
    if (properties.prismRotation != null)
      fixture.movingHead.prismRotation = properties.prismRotation;
  }
  if (properties.atmosphericOutput != null && fixture.atmospheric)
    fixture.atmospheric.outputLevel = properties.atmosphericOutput;
  return fixture;
}

function applyGroupMovement(
  settings: LaserDmxSettings,
  groupId: string,
  movement: ProductionGroupMovementConfig,
): LaserDmxSettings {
  return {
    ...settings,
    productionGroups: (settings.productionGroups ?? []).map((group) =>
      group.id === groupId ? { ...group, movement } : group,
    ),
  };
}

function applyPersistentAction(
  settingsInput: LaserDmxSettings,
  item: ResolvedProductionCueAction,
  now: number,
): LaserDmxSettings {
  let settings = settingsInput;
  const { action, cue, startTimeSec, endTimeSec } = item;
  const ids = targetFixtureIds(settings, action, cue);
  switch (action.type) {
    case "activateLook": {
      const look = settings.productionLooks?.find(
        (candidate) => candidate.id === action.lookId,
      );
      return look ? applyProductionLook(settings, look).settings : settings;
    }
    case "fadeToLook": {
      const look = settings.productionLooks?.find(
        (candidate) => candidate.id === action.lookId,
      );
      if (!look) return settings;
      const target = applyProductionLook(settings, look).settings;
      const duration = Math.max(EPSILON, endTimeSec - startTimeSec);
      return interpolateProductionLookSettings(
        settings,
        target,
        {
          ...look.transition,
          durationMs: duration * 1000,
        },
        Math.max(0, now - startTimeSec) * 1000,
      );
    }
    case "blackout":
      return { ...settings, blackout: true };
    case "reveal":
      return { ...settings, blackout: false };
    case "setFixtureProperty":
      return updateFixtures(settings, ids, (fixture) =>
        applyFixtureProperties(fixture, action.properties),
      );
    case "moveToTarget":
      return updateFixtures(settings, ids, (fixture) => ({
        ...fixture,
        targetId: action.targetId,
        ...(fixture.movingHead
          ? { movingHead: { ...fixture.movingHead, targetTracking: true } }
          : {}),
      }));
    case "runMovementEffect":
      return applyGroupMovement(
        settings,
        action.groupId,
        normalizeProductionGroupMovement({ ...action.movement, enabled: true }),
      );
    case "stopMovementEffect": {
      const current = settings.productionGroups?.find(
        (group) => group.id === action.groupId,
      )?.movement;
      return applyGroupMovement(
        settings,
        action.groupId,
        normalizeProductionGroupMovement({
          ...(current ?? DEFAULT_PRODUCTION_GROUP_MOVEMENT),
          enabled: false,
        }),
      );
    }
    case "startChase":
      return {
        ...settings,
        productionGroups: (settings.productionGroups ?? []).map((group) =>
          group.id === action.groupId
            ? {
                ...group,
                chase: normalizeProductionChase({
                  ...action.chase,
                  enabled: true,
                }),
              }
            : group,
        ),
      };
    case "stopChase":
      return {
        ...settings,
        productionGroups: (settings.productionGroups ?? []).map((group) =>
          group.id === action.groupId
            ? {
                ...group,
                chase: normalizeProductionChase({
                  ...(group.chase ?? DEFAULT_PRODUCTION_CHASE),
                  enabled: false,
                }),
              }
            : group,
        ),
      };
    case "paletteChange":
      return updateFixtures(settings, ids, (fixture) => ({
        ...fixture,
        color: {
          ...fixture.color,
          ...(action.paletteId
            ? { mode: "palette" as const, paletteId: action.paletteId }
            : {}),
          ...(action.color?.red != null ? { red: action.color.red } : {}),
          ...(action.color?.green != null ? { green: action.color.green } : {}),
          ...(action.color?.blue != null ? { blue: action.color.blue } : {}),
          ...(action.color?.white != null ? { white: action.color.white } : {}),
        },
      }));
    case "fanOpen":
      return applyGroupMovement(
        settings,
        action.groupId,
        normalizeProductionGroupMovement({
          ...DEFAULT_PRODUCTION_GROUP_MOVEMENT,
          ...(action.movement ?? {}),
          generator: "fanOpen",
          enabled: true,
        }),
      );
    case "fanClose":
      return applyGroupMovement(
        settings,
        action.groupId,
        normalizeProductionGroupMovement({
          ...DEFAULT_PRODUCTION_GROUP_MOVEMENT,
          ...(action.movement ?? {}),
          generator: "fanClose",
          enabled: true,
        }),
      );
    case "gateFixtureGroup":
      return updateFixtures(settings, ids, (fixture) => ({
        ...fixture,
        beam: { ...fixture.beam, shutterOpen: action.open },
      }));
    case "pulse": {
      if (now < startTimeSec || now >= endTimeSec) return settings;
      const duration = Math.max(EPSILON, endTimeSec - startTimeSec);
      const phase = (now - startTimeSec) / duration;
      const envelope = Math.sin(Math.PI * Math.max(0, Math.min(1, phase)));
      return updateFixtures(settings, ids, (fixture) => ({
        ...fixture,
        beam: {
          ...fixture.beam,
          dimmer: Math.max(fixture.beam.dimmer, action.intensity * envelope),
        },
      }));
    }
    case "strobeBurst":
    case "blinderHit": {
      if (now < startTimeSec || now >= endTimeSec) return settings;
      const pattern =
        action.type === "strobeBurst" ? action.pattern : "singleHit";
      const intensity = action.intensity ?? 1;
      return updateFixtures(settings, ids, (fixture) => ({
        ...fixture,
        beam: {
          ...fixture.beam,
          shutterOpen: true,
          dimmer: Math.max(fixture.beam.dimmer, intensity),
        },
        flashPattern: normalizeProductionFlashPattern({
          ...(fixture.flashPattern ?? DEFAULT_PRODUCTION_FLASH_PATTERN),
          enabled: true,
          pattern,
          triggerTimeSec: startTimeSec,
          rateHz: action.type === "strobeBurst" ? action.rateHz : undefined,
          intensity,
        }),
      }));
    }
    default:
      return settings;
  }
}

function actionCrossed(
  previous: number | null,
  current: number,
  time: number,
): boolean {
  return (
    previous != null && current >= time - EPSILON && previous < time - EPSILON
  );
}

function addLegacyCue(
  beamMatrix: LaserDmxBeamMatrixSettings,
  item: ResolvedProductionCueAction,
): LaserDmxBeamMatrixSettings {
  if (item.action.type !== "triggerLegacyBeamAction") return beamMatrix;
  const action = item.action;
  if (
    action.legacyCueId &&
    beamMatrix.cues?.some((cue) => cue.id === action.legacyCueId)
  )
    return beamMatrix;
  const id = `show-director:${item.cue.id}:${action.id}`;
  const cue: LaserDmxBeamMatrixCue = {
    id,
    name: item.cue.label,
    enabled: true,
    targetType: action.targetType,
    targetId: action.targetId,
    timingMode: "absolute",
    action: action.action,
    startMs: Math.round(item.startTimeSec * 1000),
    ...(action.action === "gate" && item.endTimeSec > item.startTimeSec
      ? { endMs: Math.round(item.endTimeSec * 1000) }
      : {}),
  };
  return {
    ...beamMatrix,
    cues: [
      ...(beamMatrix.cues ?? []).filter((existing) => existing.id !== id),
      cue,
    ],
  };
}

function applyMomentaryCrossing(
  settingsInput: LaserDmxSettings,
  item: ResolvedProductionCueAction,
  runtime: ShowDirectorRuntime,
  crossed: boolean,
): LaserDmxSettings {
  if (!crossed) return settingsInput;
  const action = item.action;
  if (
    action.type !== "fogBurst" &&
    action.type !== "cryoBurst" &&
    action.type !== "moveToTarget"
  )
    return settingsInput;
  const ids = targetFixtureIds(settingsInput, action, item.cue);
  if (action.type === "moveToTarget" && action.snap) {
    runtime.snapRequestId += 1;
    return updateFixtures(settingsInput, ids, (fixture) => ({
      ...fixture,
      targetId: action.targetId,
      ...(fixture.movingHead
        ? {
            movingHead: {
              ...fixture.movingHead,
              targetTracking: true,
              snapRequestId: runtime.snapRequestId,
            },
          }
        : {}),
    }));
  }
  if (action.type === "fogBurst" || action.type === "cryoBurst") {
    runtime.atmosphericRequestId += 1;
    return updateFixtures(settingsInput, ids, (fixture) => ({
      ...fixture,
      ...(fixture.atmospheric
        ? {
            atmospheric: {
              ...fixture.atmospheric,
              armed: true,
              outputLevel: action.intensity,
              triggerRequestId: runtime.atmosphericRequestId,
            },
          }
        : {}),
    }));
  }
  return settingsInput;
}

function actionWriteKeys(
  settings: LaserDmxSettings,
  action: ProductionCueAction,
  cue?: ProductionCompoundCue,
): string[] {
  const ids = targetFixtureIds(settings, action, cue);
  if (
    action.type === "activateLook" ||
    action.type === "fadeToLook" ||
    action.type === "blackout" ||
    action.type === "reveal"
  )
    return ["global:look-output"];
  if (
    action.type === "runMovementEffect" ||
    action.type === "stopMovementEffect" ||
    action.type === "fanOpen" ||
    action.type === "fanClose"
  )
    return [`group:${action.groupId}:movement`];
  if (action.type === "startChase" || action.type === "stopChase")
    return [`group:${action.groupId}:chase`];
  if (action.type === "triggerLegacyBeamAction")
    return [`legacy:${action.targetType}:${action.targetId}:${action.action}`];
  if (action.type === "setFixtureProperty")
    return ids.flatMap((id) =>
      Object.keys(action.properties).map(
        (property) => `fixture:${id}:${property}`,
      ),
    );
  if (action.type === "moveToTarget")
    return ids.map((id) => `fixture:${id}:target`);
  if (action.type === "paletteChange")
    return ids.map((id) => `fixture:${id}:color`);
  if (action.type === "gateFixtureGroup")
    return ids.map((id) => `fixture:${id}:shutter`);
  if (
    action.type === "pulse" ||
    action.type === "strobeBurst" ||
    action.type === "blinderHit"
  )
    return ids.map((id) => `fixture:${id}:dimmer-flash`);
  if (action.type === "fogBurst" || action.type === "cryoBurst")
    return ids.map((id) => `fixture:${id}:atmosphere-trigger`);
  return [];
}

function capabilitiesSupport(
  properties: ProductionFixturePropertyState,
  fixture: LaserDmxFixture,
): string[] {
  const caps = resolveLaserDmxFixtureCapabilities(fixture);
  if (!caps) return ["profile capabilities"];
  const missing: string[] = [];
  if (properties.dimmer != null && !caps.dimmer) missing.push("dimmer");
  if (properties.shutterOpen != null && !caps.shutter) missing.push("shutter");
  if (properties.strobeRate != null && !caps.strobe) missing.push("strobe");
  if (properties.color && !caps.color) missing.push("color");
  if (
    (properties.panDeg != null || properties.tiltDeg != null) &&
    !caps.panTilt
  )
    missing.push("pan/tilt");
  if (properties.zoom != null && !caps.zoom) missing.push("zoom");
  if (properties.focus != null && !caps.focus) missing.push("focus");
  if (properties.iris != null && !caps.iris) missing.push("iris");
  if (
    (properties.goboIndex != null || properties.goboRotation != null) &&
    !caps.gobo
  )
    missing.push("gobo");
  if (
    (properties.prismFacets != null || properties.prismRotation != null) &&
    !caps.prism
  )
    missing.push("prism");
  if (properties.frost != null && !caps.frost) missing.push("frost");
  if (properties.atmosphericOutput != null && !caps.atmosphericOutput)
    missing.push("atmospheric output");
  return missing;
}

export function diagnoseProductionCues(
  settingsInput: LaserDmxSettings,
  beamMatrix: LaserDmxBeamMatrixSettings,
  bpm: number,
  analysis?: TrackIntelligenceAnalysis | null,
  sections: readonly ReactTrackSection[] = [],
): ShowDirectorDiagnostic[] {
  const settings = normalizeLaserDmxSettings(settingsInput);
  const cues = settings.productionCues ?? [];
  const diagnostics: ShowDirectorDiagnostic[] = [];
  const fixtures = new Map(
    settings.fixtures.map((fixture) => [fixture.id, fixture]),
  );
  const groups = new Map(
    (settings.productionGroups ?? []).map((group) => [group.id, group]),
  );
  const looks = new Set(
    (settings.productionLooks ?? []).map((look) => look.id),
  );
  const targets = new Set(
    (settings.productionTargets ?? []).map((target) => target.id),
  );
  const legacyBeamIds = new Set((beamMatrix.cues ?? []).map((cue) => cue.id));
  for (const cue of cues) {
    if (
      cue.timing.mode !== "manual" &&
      !cue.manualOnly &&
      resolveProductionCueTimeSec(cue, bpm, analysis, sections) == null
    ) {
      diagnostics.push({
        code: "unresolved-timing",
        severity: "error",
        cueId: cue.id,
        message: `${cue.label} cannot resolve its authored placement.`,
      });
    }
    for (const action of cue.actions) {
      const fixtureId = "fixtureId" in action ? action.fixtureId : undefined;
      const groupId = "groupId" in action ? action.groupId : undefined;
      if (fixtureId && !fixtures.has(fixtureId))
        diagnostics.push({
          code: "missing-fixture",
          severity: "error",
          cueId: cue.id,
          actionId: action.id,
          message: `Missing fixture ${fixtureId}.`,
        });
      if (groupId && !groups.has(groupId))
        diagnostics.push({
          code: "missing-group",
          severity: "error",
          cueId: cue.id,
          actionId: action.id,
          message: `Missing fixture group ${groupId}.`,
        });
      if (
        (action.type === "activateLook" || action.type === "fadeToLook") &&
        !looks.has(action.lookId)
      )
        diagnostics.push({
          code: "missing-look",
          severity: "error",
          cueId: cue.id,
          actionId: action.id,
          message: `Missing production Look ${action.lookId}.`,
        });
      if (action.type === "moveToTarget" && !targets.has(action.targetId))
        diagnostics.push({
          code: "missing-target",
          severity: "error",
          cueId: cue.id,
          actionId: action.id,
          message: `Missing stage target ${action.targetId}.`,
        });
      if (
        action.type === "triggerLegacyBeamAction" &&
        action.legacyCueId &&
        !legacyBeamIds.has(action.legacyCueId)
      )
        diagnostics.push({
          code: "missing-fixture",
          severity: "warning",
          cueId: cue.id,
          actionId: action.id,
          message: `Legacy beam cue ${action.legacyCueId} is no longer present; its compatibility action remains executable.`,
        });
      const targetIds = targetFixtureIds(settings, action, cue);
      for (const id of targetIds) {
        const fixture = fixtures.get(id);
        if (!fixture) continue;
        let missing: string[] = [];
        if (action.type === "setFixtureProperty")
          missing = capabilitiesSupport(action.properties, fixture);
        else {
          const caps = resolveLaserDmxFixtureCapabilities(fixture);
          if (action.type === "moveToTarget" && !caps?.panTilt)
            missing = ["pan/tilt"];
          if (action.type === "strobeBurst" && !caps?.strobe)
            missing = ["strobe"];
          if (action.type === "blinderHit" && fixture.fixtureKind !== "blinder")
            missing = ["blinder output"];
          if (
            action.type === "fogBurst" &&
            caps?.atmosphericOutput?.medium !== "fog"
          )
            missing = ["fog output"];
          if (
            action.type === "cryoBurst" &&
            caps?.atmosphericOutput?.medium !== "cryo"
          )
            missing = ["cryo output"];
        }
        if (missing.length)
          diagnostics.push({
            code: "unsupported-capability",
            severity: "error",
            cueId: cue.id,
            actionId: action.id,
            message: `${fixture.name} does not support ${missing.join(", ")}.`,
          });
      }
    }
  }

  const resolved = resolveProductionCueActions(cues, bpm, analysis, sections);
  const writes = new Map<string, ResolvedProductionCueAction[]>();
  for (const item of resolved) {
    for (const key of actionWriteKeys(settings, item.action, item.cue)) {
      const bucket = writes.get(key) ?? [];
      const collision = bucket.find(
        (existing) =>
          Math.abs(existing.startTimeSec - item.startTimeSec) <= EPSILON &&
          existing.cue.id !== item.cue.id,
      );
      if (collision)
        diagnostics.push({
          code: "property-conflict",
          severity: "warning",
          cueId: item.cue.id,
          actionId: item.action.id,
          message: `${item.cue.label} conflicts with ${collision.cue.label} on ${key}; higher priority then stable action order wins.`,
        });
      bucket.push(item);
      writes.set(key, bucket);
    }
  }

  const atmospheric = resolved.filter(
    (item) =>
      item.action.type === "fogBurst" || item.action.type === "cryoBurst",
  );
  for (let i = 0; i < atmospheric.length; i += 1) {
    const current = atmospheric[i];
    const ids = targetFixtureIds(settings, current.action, current.cue);
    for (let j = i + 1; j < atmospheric.length; j += 1) {
      const next = atmospheric[j];
      const shared = ids.filter((id) =>
        targetFixtureIds(settings, next.action, next.cue).includes(id),
      );
      for (const id of shared) {
        const cooldown = fixtures.get(id)?.atmospheric?.cooldownSec ?? 0;
        if (next.startTimeSec - current.startTimeSec < cooldown - EPSILON)
          diagnostics.push({
            code: "cooldown-violation",
            severity: "warning",
            cueId: next.cue.id,
            actionId: next.action.id,
            message: `${fixtures.get(id)?.name ?? id} is retriggered before its ${cooldown.toFixed(1)}s cooldown expires.`,
          });
      }
    }
  }
  return diagnostics;
}

export function migrateLegacyBeamMatrixCues(
  legacyCues: readonly LaserDmxBeamMatrixCue[],
  existing: readonly ProductionCompoundCue[] = [],
): ProductionCompoundCue[] {
  const existingIds = new Set(existing.map((cue) => cue.id));
  const migrated = legacyCues.flatMap((legacy): ProductionCompoundCue[] => {
    const id = `production-cue:legacy:${legacy.id}`;
    if (existingIds.has(id)) return [];
    const timing =
      legacy.timingMode === "absolute"
        ? {
            mode: "absolute" as const,
            timeSec: Math.max(0, (legacy.startMs ?? 0) / 1000),
          }
        : {
            mode: "musical" as const,
            bar: Math.max(1, legacy.startBar ?? 1),
            beat: Math.max(1, legacy.startBeat ?? 1),
            subdivision: 1 as const,
            subdivisionIndex: 0,
          };
    let durationMs: number | undefined;
    let legacyDurationBeats: number | undefined;
    if (legacy.action === "gate") {
      if (legacy.timingMode === "absolute" && legacy.endMs != null)
        durationMs = Math.max(0, legacy.endMs - (legacy.startMs ?? 0));
      if (legacy.timingMode === "musical" && legacy.endBar != null) {
        const startBeat =
          (Math.max(1, legacy.startBar ?? 1) - 1) * 4 +
          Math.max(1, legacy.startBeat ?? 1) -
          1;
        const endBeat =
          (Math.max(1, legacy.endBar) - 1) * 4 +
          Math.max(1, legacy.endBeat ?? 1) -
          1;
        legacyDurationBeats = Math.max(0, endBeat - startBeat);
      }
    }
    return [
      {
        schemaVersion: 1,
        id,
        label: legacy.name,
        description: "Migrated from the Beam Matrix gate/trigger cue list.",
        enabled: legacy.enabled,
        timing,
        quantize: "none",
        ...(durationMs != null ? { durationMs } : {}),
        priority: 0,
        retriggerPolicy:
          legacy.action === "trigger" ? "oncePerPass" : "restart",
        cancellationBehavior: "restoreOnExit",
        fixtureGroupIds: [],
        manualOnly: false,
        source: "legacyBeamMigration",
        actions: [
          {
            id: `${id}:action:1`,
            type: "triggerLegacyBeamAction",
            execution: "simultaneous",
            legacyCueId: legacy.id,
            targetType: legacy.targetType,
            targetId: legacy.targetId,
            action: legacy.action,
            ...(legacyDurationBeats != null ? { legacyDurationBeats } : {}),
          },
        ],
      },
    ];
  });
  return [...existing, ...migrated];
}

function manualSchedule(
  cue: ProductionCompoundCue,
  start: number,
  bpm: number,
): ResolvedProductionCueAction[] {
  let cursor = start;
  return cue.actions.map((action, order) => {
    const actionStart =
      (action.execution === "sequential" ? cursor : start) +
      Math.max(0, action.delayMs ?? 0) / 1000;
    const duration = actionDurationSec(action, cue, bpm);
    const item = {
      cue,
      action,
      cueTimeSec: start,
      startTimeSec: actionStart,
      endTimeSec: actionStart + duration,
      order,
    };
    if (action.execution === "sequential") cursor = item.endTimeSec;
    return item;
  });
}

export function evaluateShowDirector(
  runtime: ShowDirectorRuntime,
  input: ShowDirectorEvaluationInput,
): ShowDirectorEvaluationResult {
  const settingsBase = normalizeLaserDmxSettings(input.settings);
  const bpm = effectBpm(input.bpm, input.analysis);
  const current = Math.max(
    0,
    Number.isFinite(input.audioTimeSec) ? input.audioTimeSec : 0,
  );
  const currentAnalysisKey = analysisKey(input.analysis);
  const currentSectionsKey = sectionsKey(input.sections);
  const firstEvaluation = runtime.previousAudioTimeSec == null;
  const identityChanged =
    runtime.previousTrackKey !== (input.trackKey ?? null) ||
    runtime.previousPresetKey !== (input.presetKey ?? null);
  const analysisChanged =
    !firstEvaluation && !identityChanged && runtime.previousAnalysisKey !== currentAnalysisKey;
  const sectionsChanged =
    !firstEvaluation && !identityChanged && runtime.previousSectionsKey !== currentSectionsKey;
  const wentBackward =
    runtime.previousAudioTimeSec != null &&
    current < runtime.previousAudioTimeSec - EPSILON;
  const jumpedForward =
    runtime.previousAudioTimeSec != null &&
    current - runtime.previousAudioTimeSec > 0.75;
  const freshStart =
    firstEvaluation && current <= 0.25 && !input.timingDiscontinuity;
  const discontinuity = Boolean(
    input.timingDiscontinuity ||
    (identityChanged && !freshStart) ||
    analysisChanged ||
    sectionsChanged ||
    wentBackward ||
    jumpedForward,
  );

  if (identityChanged) {
    runtime.transportPass = 0;
    runtime.firedKeys.clear();
    runtime.manualRuns = [];
  } else if (wentBackward) {
    runtime.transportPass += 1;
    runtime.firedKeys.clear();
    runtime.manualRuns = [];
  } else if (analysisChanged || sectionsChanged) {
    runtime.firedKeys.clear();
  }

  const request = input.manualRequest;
  if (request && request.sequence > runtime.lastManualSequence) {
    runtime.lastManualSequence = request.sequence;
    runtime.manualRuns = [
      ...runtime.manualRuns.filter((run) => run.cueId !== request.cueId),
      {
        cueId: request.cueId,
        sequence: request.sequence,
        startedAtSec: current,
      },
    ];
  }

  const cues = settingsBase.productionCues ?? [];
  const scheduled = resolveProductionCueActions(
    cues,
    input.bpm,
    input.analysis,
    input.sections ?? [],
  );
  const manual = runtime.manualRuns.flatMap((run) => {
    const cue = cues.find(
      (candidate) => candidate.id === run.cueId && candidate.enabled,
    );
    return cue ? manualSchedule(cue, run.startedAtSec, bpm) : [];
  });
  const allItems = [...scheduled, ...manual].sort(
    (a, b) =>
      a.startTimeSec - b.startTimeSec ||
      a.cue.priority - b.cue.priority ||
      a.order - b.order ||
      a.cue.id.localeCompare(b.cue.id),
  );

  let settings = settingsBase;
  let beamMatrix = input.beamMatrix;
  const activeCueIds = new Set<string>();
  const firedCueIds = new Set<string>();

  for (const item of allItems) {
    if (item.startTimeSec > current + EPSILON) continue;
    const isActive =
      item.endTimeSec > item.startTimeSec &&
      current < item.endTimeSec - EPSILON;
    if (isActive) activeCueIds.add(item.cue.id);
    const durationExpired =
      item.endTimeSec > item.startTimeSec &&
      current >= item.endTimeSec - EPSILON &&
      (item.cue.cancellationBehavior === "restoreOnExit" ||
        item.cue.cancellationBehavior === "cancelOnSeek");
    if (!durationExpired)
      settings = applyPersistentAction(settings, item, current);
    if (!durationExpired && item.action.type === "blackout")
      beamMatrix = {
        ...beamMatrix,
        output: { ...beamMatrix.output, blackout: true },
      };
    if (!durationExpired && item.action.type === "reveal")
      beamMatrix = {
        ...beamMatrix,
        output: { ...beamMatrix.output, blackout: false },
      };
    beamMatrix = addLegacyCue(beamMatrix, item);

    const previousForCrossing = freshStart
      ? -EPSILON * 2
      : runtime.previousAudioTimeSec;
    const crossed =
      !discontinuity &&
      input.isPlaying &&
      actionCrossed(previousForCrossing, current, item.startTimeSec);
    const key = `${runtime.transportPass}:${item.cue.id}:${item.action.id}:${item.startTimeSec}`;
    const canRetrigger =
      item.cue.retriggerPolicy === "allow" ||
      item.cue.retriggerPolicy === "restart" ||
      !runtime.firedKeys.has(key);
    if (crossed && canRetrigger) {
      settings = applyMomentaryCrossing(settings, item, runtime, true);
      firedCueIds.add(item.cue.id);
      if (item.cue.retriggerPolicy !== "allow") runtime.firedKeys.add(key);
    }
  }

  runtime.manualRuns = runtime.manualRuns.filter((run) => {
    const cue = cues.find((candidate) => candidate.id === run.cueId);
    if (!cue) return false;
    const end = Math.max(
      run.startedAtSec,
      ...manualSchedule(cue, run.startedAtSec, bpm).map(
        (item) => item.endTimeSec,
      ),
    );
    return (
      current <= end + 0.1 || cue.cancellationBehavior === "holdUntilChanged"
    );
  });
  runtime.previousAudioTimeSec = current;
  runtime.previousTrackKey = input.trackKey ?? null;
  runtime.previousPresetKey = input.presetKey ?? null;
  runtime.previousAnalysisKey = currentAnalysisKey;
  runtime.previousSectionsKey = currentSectionsKey;

  return {
    settings: normalizeLaserDmxSettings(settings),
    beamMatrix,
    firedCueIds: [...firedCueIds],
    activeCueIds: [...activeCueIds],
    diagnostics: diagnoseProductionCues(
      settingsBase,
      input.beamMatrix,
      input.bpm,
      input.analysis,
      input.sections ?? [],
    ),
  };
}
