import type { LaserDmxShowDirectorWebGLQuality } from "../../ReactTypes";
import type {
  LaserDmxExposureSample,
  LaserDmxScanPath,
} from "./LaserDmxScannerDomain";
import type {
  LaserDmxSceneColor,
  LaserDmxSceneFrame,
  LaserDmxSceneVec3,
} from "./LaserDmxSceneFrame";

export interface LaserDmxScannerExposureSegment {
  id: string;
  scannerHeadId: string;
  fixtureId: string;
  pathId: string;
  opticalCopyIndex: number;
  intendedRaySlotId?: string;
  rawSampleCount: number;
  origin: LaserDmxSceneVec3;
  target: LaserDmxSceneVec3;
  color: LaserDmxSceneColor;
  exposureContribution: number;
  intensity: number;
  velocityRatio: number;
  pointDwell: boolean;
  sampleTimeStart: number;
  sampleTimeEnd: number;
}

export interface LaserDmxScannerWebGLInputValidation {
  authoritativeFixtureIds: string[];
  scannerSampleCount: number;
  visibleScannerSampleCount: number;
  legacyLaserBeamCount: number;
  suppressedLegacyBeamIds: string[];
  duplicateFixtureIds: string[];
  blankedBreakCount: number;
  invalidSampleCount: number;
  rawExposureSampleCount: number;
  aggregatedRayCount: number;
  energyBeforeAggregation: number;
  energyAfterAggregation: number;
  filledWedgeRiskCount: number;
}

export interface LaserDmxScannerExposurePlan {
  segments: LaserDmxScannerExposureSegment[];
  validation: LaserDmxScannerWebGLInputValidation;
}

const QUALITY_SEGMENT_LIMITS: Readonly<
  Record<LaserDmxShowDirectorWebGLQuality, number>
> = Object.freeze({
  low: 120,
  medium: 260,
  high: 520,
  ultra: 860,
  auto: 360,
});

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

function distance(a: LaserDmxSceneVec3, b: LaserDmxSceneVec3): number {
  return Math.hypot(b.x - a.x, b.y - a.y, (b.z - a.z) * 0.7);
}

function finiteVec3(value: LaserDmxSceneVec3): boolean {
  return (
    Number.isFinite(value.x) &&
    Number.isFinite(value.y) &&
    Number.isFinite(value.z)
  );
}

function finiteSample(sample: LaserDmxExposureSample): boolean {
  return (
    finiteVec3(sample.origin) &&
    finiteVec3(sample.targetOrDirection) &&
    Number.isFinite(sample.sampleTime) &&
    Number.isFinite(sample.exposureWeight) &&
    Number.isFinite(sample.intensity) &&
    Number.isFinite(sample.velocityRatio)
  );
}

function groupKey(sample: LaserDmxExposureSample): string {
  return `${sample.scannerHeadId}:${sample.pathId}:${sample.opticalCopyIndex}:${sample.intendedRaySlotId ?? 'unassigned'}`;
}

function stableSampleSort(
  a: LaserDmxExposureSample,
  b: LaserDmxExposureSample,
): number {
  return (
    a.sampleTime - b.sampleTime ||
    a.pointIndex - b.pointIndex ||
    a.fixtureId.localeCompare(b.fixtureId) ||
    a.scannerHeadId.localeCompare(b.scannerHeadId) ||
    a.opticalCopyIndex - b.opticalCopyIndex
  );
}

function pathById(
  frame: LaserDmxSceneFrame,
): ReadonlyMap<string, LaserDmxScanPath> {
  return new Map(frame.scanPaths.map((path) => [path.id, path]));
}

function buildGroupSegments(
  samples: readonly LaserDmxExposureSample[],
  _path: LaserDmxScanPath | undefined,
): { segments: LaserDmxScannerExposureSegment[]; blankedBreakCount: number } {
  const ordered = [...samples].sort(stableSampleSort);
  const segments: LaserDmxScannerExposureSegment[] = [];
  let blankedBreakCount = 0;
  let segmentOrdinal = 0;

  for (const current of ordered) {
    if (
      current.blanked ||
      current.intensity <= 0 ||
      current.exposureWeight <= 0
    ) {
      blankedBreakCount += 1;
      continue;
    }

    // Scanner points describe where the physical projector is aimed. The
    // visible aerial laser is always the ray from the projector aperture to
    // that instantaneous aim point. Earlier versions incorrectly connected
    // consecutive aim points to one another, which drew floating line
    // fragments and polygon outlines with no physical light source.
    const contribution = clamp01(current.exposureWeight * current.intensity);
    const previous = segments[segments.length - 1];
    if (
      previous
      && distance(previous.origin, current.origin) < 1e-7
      && distance(previous.target, current.targetOrDirection) < 0.0008
    ) {
      const previousWeight = previous.exposureContribution;
      const combinedWeight = Math.max(1e-9, previousWeight + contribution);
      previous.color = {
        r: clamp01((previous.color.r * previousWeight + current.color.r * contribution) / combinedWeight),
        g: clamp01((previous.color.g * previousWeight + current.color.g * contribution) / combinedWeight),
        b: clamp01((previous.color.b * previousWeight + current.color.b * contribution) / combinedWeight),
        a: clamp01((previous.color.a * previousWeight + current.color.a * contribution) / combinedWeight),
      };
      previous.exposureContribution = clamp01(combinedWeight);
      previous.intensity = Math.max(previous.intensity, clamp01(current.intensity));
      previous.velocityRatio = Math.min(previous.velocityRatio, clamp01(current.velocityRatio));
      previous.pointDwell = true;
      previous.sampleTimeEnd = current.sampleTime;
      continue;
    }

    segments.push({
      id: `${current.scannerHeadId}:${current.pathId}:copy-${current.opticalCopyIndex}:${current.intendedRaySlotId ?? `sample-${segmentOrdinal}`}`,
      scannerHeadId: current.scannerHeadId,
      fixtureId: current.fixtureId,
      pathId: current.pathId,
      opticalCopyIndex: current.opticalCopyIndex,
      intendedRaySlotId: current.intendedRaySlotId,
      rawSampleCount: Math.max(1, current.sampleCount ?? 1),
      origin: { ...current.origin },
      target: { ...current.targetOrDirection },
      color: { ...current.color },
      exposureContribution: contribution,
      intensity: clamp01(current.intensity),
      velocityRatio: clamp01(current.velocityRatio),
      pointDwell: current.velocityRatio < 0.035,
      sampleTimeStart: current.sampleTime,
      sampleTimeEnd: current.sampleTime,
    });
    segmentOrdinal += 1;
  }

  return { segments, blankedBreakCount };
}

function deterministicThin<T>(items: readonly T[], limit: number): T[] {
  if (items.length <= limit) return [...items];
  if (limit <= 0) return [];
  const selected: T[] = [];
  for (let index = 0; index < limit; index += 1) {
    const sourceIndex = Math.min(
      items.length - 1,
      Math.round((index * (items.length - 1)) / Math.max(1, limit - 1)),
    );
    selected.push(items[sourceIndex]!);
  }
  return selected;
}

/**
 * Converts shutter samples into physical projector-origin aerial rays. Laser fixtures with
 * valid scanner heads are authoritative here; their legacy source-to-target rays
 * are deliberately suppressed by the WebGL beam and atmosphere planners.
 */
export function buildLaserDmxScannerExposurePlan(
  frame: LaserDmxSceneFrame,
): LaserDmxScannerExposurePlan {
  const validHeadIds = new Set(frame.scannerHeads.map((head) => head.id));
  const validPaths = frame.scanPaths.filter(
    (path) =>
      path.validationErrors.length === 0 &&
      validHeadIds.has(path.scannerHeadId),
  );
  const validPathIds = new Set(validPaths.map((path) => path.id));
  const authoritativeFixtureIds = [
    ...new Set(validPaths.map((path) => path.fixtureId)),
  ].sort();
  const authoritativeFixtures = new Set(authoritativeFixtureIds);
  const invalidSamples = frame.exposureSamples.filter(
    (sample) => !finiteSample(sample) || !validPathIds.has(sample.pathId),
  );
  const usableSamples = frame.exposureSamples.filter(
    (sample) => finiteSample(sample) && validPathIds.has(sample.pathId),
  );
  const groups = new Map<string, LaserDmxExposureSample[]>();
  for (const sample of usableSamples) {
    const group = groups.get(groupKey(sample)) ?? [];
    group.push(sample);
    groups.set(groupKey(sample), group);
  }
  const paths = pathById(frame);
  const allSegments: LaserDmxScannerExposureSegment[] = [];
  let blankedBreakCount = 0;
  for (const key of [...groups.keys()].sort()) {
    const group = groups.get(key)!;
    const built = buildGroupSegments(group, paths.get(group[0]!.pathId));
    allSegments.push(...built.segments);
    blankedBreakCount += built.blankedBreakCount;
  }
  allSegments.sort(
    (a, b) => a.sampleTimeStart - b.sampleTimeStart || a.id.localeCompare(b.id),
  );
  const segmentLimit = QUALITY_SEGMENT_LIMITS[frame.quality.qualityTier];
  const segments = deterministicThin(allSegments, segmentLimit);
  const legacyLaserBeams = frame.beams.filter(
    (beam) => beam.fixtureKind === "laser",
  );
  const suppressedLegacyBeamIds = legacyLaserBeams
    .filter((beam) => authoritativeFixtures.has(beam.fixtureId))
    .map((beam) => beam.id)
    .sort();
  // The final WebGL beam planner rechecks the rendered legacy set after
  // suppression. At this stage every overlapping legacy ray is declaratively
  // suppressed, so any non-empty duplicate list later is a planner regression.
  const duplicateFixtureIds = [...frame.scannerDiagnostics.duplicateRenderingFixtureIds];
  const filledWedgeRiskCount = segments.filter((segment) => {
    const matching = segments.filter((candidate) => candidate.scannerHeadId === segment.scannerHeadId
      && candidate.pathId === segment.pathId
      && candidate.opticalCopyIndex === segment.opticalCopyIndex);
    if (matching.length < 3) return false;
    const nearest = matching
      .filter((candidate) => candidate.id !== segment.id)
      .reduce((minimum, candidate) => Math.min(minimum, distance(candidate.target, segment.target)), Number.POSITIVE_INFINITY);
    return nearest < 0.00025 && segment.rawSampleCount > 1;
  }).length;

  return {
    segments,
    validation: {
      authoritativeFixtureIds,
      scannerSampleCount: frame.exposureSamples.length,
      visibleScannerSampleCount: usableSamples.filter(
        (sample) =>
          !sample.blanked && sample.intensity > 0 && sample.exposureWeight > 0,
      ).length,
      legacyLaserBeamCount: legacyLaserBeams.length,
      suppressedLegacyBeamIds,
      duplicateFixtureIds,
      blankedBreakCount,
      invalidSampleCount: invalidSamples.length,
      rawExposureSampleCount: frame.exposureAggregation.rawSampleCount,
      aggregatedRayCount: frame.exposureAggregation.aggregatedRayCount,
      energyBeforeAggregation: frame.exposureAggregation.energyBeforeAggregation,
      energyAfterAggregation: frame.exposureAggregation.energyAfterAggregation,
      filledWedgeRiskCount,
    },
  };
}

export function validateLaserDmxWebGLLaserInputs(
  frame: LaserDmxSceneFrame,
): LaserDmxScannerWebGLInputValidation {
  return buildLaserDmxScannerExposurePlan(frame).validation;
}


export function resolveLaserDmxScannerExposureDensity(
  frame: LaserDmxSceneFrame,
  segment: LaserDmxScannerExposureSegment,
): number {
  // Aggregation already sums raw shutter samples into a programmed slot.
  // Multiplying by sample count here would make brightness frame-rate and
  // quality dependent, recreating the filled-wedge failure mode.
  const qualityNormalizedExposure = segment.exposureContribution;
  const motionResponse = 0.68 + (1 - clamp01(segment.velocityRatio)) * 0.18;
  const dwellResponse = segment.pointDwell ? 1.22 : 1;
  return clamp(
    qualityNormalizedExposure * motionResponse * dwellResponse,
    0.035,
    segment.pointDwell ? 1.55 : 1.15,
  );
}

function scannerSegmentGroupKey(segment: LaserDmxScannerExposureSegment): string {
  return `${segment.scannerHeadId}:${segment.pathId}:${segment.opticalCopyIndex}`;
}

function allocateGroupBudgets(
  groups: readonly LaserDmxScannerExposureSegment[][],
  limit: number,
): number[] {
  const budgets = groups.map(() => 0);
  if (limit <= 0 || groups.length === 0) return budgets;

  const ranked = groups
    .map((group, index) => ({
      index,
      energy: group.reduce((sum, segment) => sum + segment.exposureContribution, 0),
      length: group.length,
    }))
    .sort((a, b) => b.energy - a.energy || b.length - a.length || a.index - b.index);

  let remaining = limit;
  for (const entry of ranked) {
    if (remaining <= 0) break;
    budgets[entry.index] = 1;
    remaining -= 1;
  }
  while (remaining > 0) {
    let selected = -1;
    let selectedScore = -1;
    for (let index = 0; index < groups.length; index += 1) {
      if (budgets[index]! >= groups[index]!.length) continue;
      const score = groups[index]!.length / Math.max(1, budgets[index]!);
      if (score > selectedScore) {
        selected = index;
        selectedScore = score;
      }
    }
    if (selected < 0) break;
    budgets[selected]! += 1;
    remaining -= 1;
  }
  return budgets;
}

/**
 * Reduces atmosphere work without inventing geometry between scanner aim
 * points. Every retained item remains a projector-origin ray, so thinning can
 * lower density but can never turn an aerial fan into a floating path segment.
 */
export function aggregateLaserDmxScannerExposureSegments(
  segments: readonly LaserDmxScannerExposureSegment[],
  limit: number,
): LaserDmxScannerExposureSegment[] {
  const boundedLimit = Math.max(0, Math.round(limit));
  if (boundedLimit === 0 || segments.length === 0) return [];
  if (segments.length <= boundedLimit) return [...segments];

  const grouped = new Map<string, LaserDmxScannerExposureSegment[]>();
  for (const segment of [...segments].sort(
    (a, b) => a.sampleTimeStart - b.sampleTimeStart || a.id.localeCompare(b.id),
  )) {
    const key = scannerSegmentGroupKey(segment);
    const group = grouped.get(key) ?? [];
    group.push(segment);
    grouped.set(key, group);
  }

  const groups = [...grouped.keys()].sort().map(key => grouped.get(key)!);
  const budgets = allocateGroupBudgets(groups, boundedLimit);
  return groups
    .flatMap((group, index) => deterministicThin(group, budgets[index]!))
    .sort((a, b) => a.sampleTimeStart - b.sampleTimeStart || a.id.localeCompare(b.id));
}
