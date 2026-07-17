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
  return `${sample.scannerHeadId}:${sample.pathId}:${sample.opticalCopyIndex}`;
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

function averageColor(
  a: LaserDmxExposureSample,
  b: LaserDmxExposureSample,
): LaserDmxSceneColor {
  return {
    r: clamp01((a.color.r + b.color.r) * 0.5),
    g: clamp01((a.color.g + b.color.g) * 0.5),
    b: clamp01((a.color.b + b.color.b) * 0.5),
    a: clamp01((a.color.a + b.color.a) * 0.5),
  };
}

function pathById(
  frame: LaserDmxSceneFrame,
): ReadonlyMap<string, LaserDmxScanPath> {
  return new Map(frame.scanPaths.map((path) => [path.id, path]));
}

function pathHasBlankedRetrace(path: LaserDmxScanPath | undefined): boolean {
  return (
    path?.points.some(
      (point) => point.blanked || point.cornerBehavior === "blank",
    ) === true
  );
}

function targetJumpThreshold(path: LaserDmxScanPath | undefined): number {
  if (!path || path.points.length < 2) return 0.42;
  const distances: number[] = [];
  for (let index = 1; index < path.points.length; index += 1) {
    const value = distance(
      path.points[index - 1]!.position,
      path.points[index]!.position,
    );
    if (value > 1e-6) distances.push(value);
  }
  if (path.closed && path.points.length > 2) {
    const value = distance(
      path.points[path.points.length - 1]!.position,
      path.points[0]!.position,
    );
    if (value > 1e-6) distances.push(value);
  }
  if (distances.length === 0) return 0.42;
  distances.sort((a, b) => a - b);
  const median = distances[Math.floor(distances.length * 0.5)] ?? distances[0]!;
  return Math.max(0.04, median * 3.4);
}

function shouldBreakSegment(
  previous: LaserDmxExposureSample,
  current: LaserDmxExposureSample,
  path: LaserDmxScanPath | undefined,
): boolean {
  if (previous.blanked || current.blanked) return true;
  if (current.sampleTime <= previous.sampleTime) return true;
  const jump = distance(previous.targetOrDirection, current.targetOrDirection);
  if (!pathHasBlankedRetrace(path)) return false;
  return jump > targetJumpThreshold(path);
}

function pointCapsule(sample: LaserDmxExposureSample): {
  origin: LaserDmxSceneVec3;
  target: LaserDmxSceneVec3;
} {
  const epsilon = 0.00035;
  return {
    origin: {
      ...sample.targetOrDirection,
      x: sample.targetOrDirection.x - epsilon,
    },
    target: {
      ...sample.targetOrDirection,
      x: sample.targetOrDirection.x + epsilon,
    },
  };
}

function buildGroupSegments(
  samples: readonly LaserDmxExposureSample[],
  path: LaserDmxScanPath | undefined,
): { segments: LaserDmxScannerExposureSegment[]; blankedBreakCount: number } {
  const ordered = [...samples].sort(stableSampleSort);
  const segments: LaserDmxScannerExposureSegment[] = [];
  let previous: LaserDmxExposureSample | null = null;
  let blankedBreakCount = 0;
  let segmentOrdinal = 0;
  for (const current of ordered) {
    if (
      current.blanked ||
      current.intensity <= 0 ||
      current.exposureWeight <= 0
    ) {
      previous = null;
      blankedBreakCount += 1;
      continue;
    }
    if (!previous) {
      previous = current;
      continue;
    }
    if (shouldBreakSegment(previous, current, path)) {
      previous = current;
      blankedBreakCount += 1;
      continue;
    }
    const span = distance(
      previous.targetOrDirection,
      current.targetOrDirection,
    );
    const pointDwell = span < 0.0008;
    const endpoints = pointDwell
      ? pointCapsule(current)
      : {
          origin: { ...previous.targetOrDirection },
          target: { ...current.targetOrDirection },
        };
    const exposureContribution = clamp(
      (previous.exposureWeight * previous.intensity +
        current.exposureWeight * current.intensity) *
        0.5,
      0,
      1,
    );
    segments.push({
      id: `${current.scannerHeadId}:${current.pathId}:copy-${current.opticalCopyIndex}:sample-${segmentOrdinal}`,
      scannerHeadId: current.scannerHeadId,
      fixtureId: current.fixtureId,
      pathId: current.pathId,
      opticalCopyIndex: current.opticalCopyIndex,
      origin: endpoints.origin,
      target: endpoints.target,
      color: averageColor(previous, current),
      exposureContribution,
      intensity: clamp01((previous.intensity + current.intensity) * 0.5),
      velocityRatio: clamp01(
        (previous.velocityRatio + current.velocityRatio) * 0.5,
      ),
      pointDwell,
      sampleTimeStart: previous.sampleTime,
      sampleTimeEnd: current.sampleTime,
    });
    segmentOrdinal += 1;
    previous = current;
  }

  if (segments.length === 0) {
    const visible = ordered.filter(
      (sample) =>
        !sample.blanked && sample.intensity > 0 && sample.exposureWeight > 0,
    );
    const sample = visible[visible.length - 1];
    if (sample) {
      const held =
        path?.conversionKind === "held" ||
        visible.every(
          (candidate) =>
            distance(candidate.targetOrDirection, sample.targetOrDirection) <
            0.0008,
        );
      const endpoints = held
        ? {
            origin: { ...sample.origin },
            target: { ...sample.targetOrDirection },
          }
        : pointCapsule(sample);
      segments.push({
        id: `${sample.scannerHeadId}:${sample.pathId}:copy-${sample.opticalCopyIndex}:held`,
        scannerHeadId: sample.scannerHeadId,
        fixtureId: sample.fixtureId,
        pathId: sample.pathId,
        opticalCopyIndex: sample.opticalCopyIndex,
        origin: endpoints.origin,
        target: endpoints.target,
        color: { ...sample.color },
        exposureContribution: clamp01(sample.exposureWeight * sample.intensity),
        intensity: clamp01(sample.intensity),
        velocityRatio: clamp01(sample.velocityRatio),
        pointDwell: !held,
        sampleTimeStart: sample.sampleTime,
        sampleTimeEnd: sample.sampleTime,
      });
    }
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
 * Converts shutter samples into ordered screen-trace segments. Laser fixtures with
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
  const duplicateFixtureIds: string[] = [];

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
  const path = frame.scanPaths.find((candidate) => candidate.id === segment.pathId);
  let pathLength = 0;
  if (path && path.points.length >= 2) {
    for (let index = 1; index < path.points.length; index += 1) {
      pathLength += distance(path.points[index - 1]!.position, path.points[index]!.position);
    }
    if (path.closed && path.points.length > 2) {
      pathLength += distance(path.points[path.points.length - 1]!.position, path.points[0]!.position);
    }
  }
  const segmentLength = distance(segment.origin, segment.target);
  const referenceLength = Math.max(
    pathLength,
    segment.pointDwell ? 0.003 : segmentLength,
  );
  return clamp(
    segment.exposureContribution * referenceLength / Math.max(0.0007, segmentLength),
    0.015,
    segment.pointDwell ? 3.4 : 1.8,
  );
}

function scannerSegmentGroupKey(segment: LaserDmxScannerExposureSegment): string {
  return `${segment.scannerHeadId}:${segment.pathId}:${segment.opticalCopyIndex}`;
}

function scannerSegmentsAreContinuous(
  previous: LaserDmxScannerExposureSegment,
  current: LaserDmxScannerExposureSegment,
): boolean {
  return current.sampleTimeStart >= previous.sampleTimeEnd
    && distance(previous.target, current.origin) <= 0.025;
}

function aggregateScannerRun(
  run: readonly LaserDmxScannerExposureSegment[],
  chunkCount: number,
): LaserDmxScannerExposureSegment[] {
  if (run.length <= chunkCount) return [...run];
  const aggregated: LaserDmxScannerExposureSegment[] = [];
  for (let chunkIndex = 0; chunkIndex < chunkCount; chunkIndex += 1) {
    const startIndex = Math.floor(chunkIndex * run.length / chunkCount);
    const endIndex = Math.max(startIndex + 1, Math.floor((chunkIndex + 1) * run.length / chunkCount));
    const chunk = run.slice(startIndex, endIndex);
    const first = chunk[0]!;
    const last = chunk[chunk.length - 1]!;
    const totalExposure = chunk.reduce((sum, segment) => sum + segment.exposureContribution, 0);
    const weight = Math.max(1e-6, totalExposure);
    aggregated.push({
      ...first,
      id: `${first.id}-aggregate-${chunkIndex}`,
      origin: { ...first.origin },
      target: { ...last.target },
      color: {
        r: chunk.reduce((sum, segment) => sum + segment.color.r * segment.exposureContribution, 0) / weight,
        g: chunk.reduce((sum, segment) => sum + segment.color.g * segment.exposureContribution, 0) / weight,
        b: chunk.reduce((sum, segment) => sum + segment.color.b * segment.exposureContribution, 0) / weight,
        a: chunk.reduce((sum, segment) => sum + segment.color.a * segment.exposureContribution, 0) / weight,
      },
      exposureContribution: totalExposure,
      intensity: chunk.reduce((sum, segment) => sum + segment.intensity * segment.exposureContribution, 0) / weight,
      velocityRatio: chunk.reduce((sum, segment) => sum + segment.velocityRatio * segment.exposureContribution, 0) / weight,
      pointDwell: chunk.every((segment) => segment.pointDwell),
      sampleTimeStart: first.sampleTimeStart,
      sampleTimeEnd: last.sampleTimeEnd,
    });
  }
  return aggregated;
}

/**
 * Reduces atmosphere work by combining only contiguous scanner segments. Runs
 * separated by blanking remain separate, and scanner heads / optical copies are
 * never merged together.
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
    const group = grouped.get(scannerSegmentGroupKey(segment)) ?? [];
    group.push(segment);
    grouped.set(scannerSegmentGroupKey(segment), group);
  }
  const runs: LaserDmxScannerExposureSegment[][] = [];
  for (const key of [...grouped.keys()].sort()) {
    let run: LaserDmxScannerExposureSegment[] = [];
    for (const segment of grouped.get(key)!) {
      const previous = run[run.length - 1];
      if (previous && !scannerSegmentsAreContinuous(previous, segment)) {
        runs.push(run);
        run = [];
      }
      run.push(segment);
    }
    if (run.length > 0) runs.push(run);
  }
  if (runs.length >= boundedLimit) {
    return runs
      .sort((a, b) => b.reduce((sum, segment) => sum + segment.exposureContribution, 0)
        - a.reduce((sum, segment) => sum + segment.exposureContribution, 0)
        || a[0]!.sampleTimeStart - b[0]!.sampleTimeStart)
      .slice(0, boundedLimit)
      .map((run) => aggregateScannerRun(run, 1)[0]!)
      .sort((a, b) => a.sampleTimeStart - b.sampleTimeStart || a.id.localeCompare(b.id));
  }

  const chunks = runs.map(() => 1);
  let remaining = boundedLimit - runs.length;
  while (remaining > 0) {
    let selectedIndex = -1;
    let selectedScore = -1;
    for (let index = 0; index < runs.length; index += 1) {
      if (chunks[index]! >= runs[index]!.length) continue;
      const score = runs[index]!.length / chunks[index]!;
      if (score > selectedScore) {
        selectedScore = score;
        selectedIndex = index;
      }
    }
    if (selectedIndex < 0) break;
    chunks[selectedIndex]! += 1;
    remaining -= 1;
  }
  return runs
    .flatMap((run, index) => aggregateScannerRun(run, chunks[index]!))
    .sort((a, b) => a.sampleTimeStart - b.sampleTimeStart || a.id.localeCompare(b.id));
}
