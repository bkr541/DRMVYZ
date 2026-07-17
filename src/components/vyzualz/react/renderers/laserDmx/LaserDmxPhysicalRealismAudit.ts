import type { LaserDmxSceneFrame, LaserDmxSceneVec3 } from './LaserDmxSceneFrame'
import { validateLaserDmxWebGLLaserInputs } from './LaserDmxScannerWebGLPlan'

export type LaserDmxPhysicalRealismIssueCode =
  | 'scanner-simultaneous-ray-count'
  | 'scanner-output-index-duplicated'
  | 'blanked-sample-visible'
  | 'invalid-ordered-path'
  | 'unblanked-open-path-retrace'
  | 'legacy-scanner-duplicate'
  | 'unbounded-optical-energy'
  | 'multi-aperture-origin-collapse'
  | 'uncalibrated-color-channel'
  | 'expired-co2-visible'
  | 'capture-editor-overlay-risk'

export interface LaserDmxPhysicalRealismIssue {
  code: LaserDmxPhysicalRealismIssueCode
  fixtureId: string | null
  detail: string
}

export interface LaserDmxPhysicalRealismMetrics {
  scannerHeadCount: number
  normalSingleApertureHeadCount: number
  instantaneousVisibleRayCount: number
  maximumVisibleRaysPerHead: number
  blankedSampleCount: number
  blankingViolationCount: number
  orderedPathCount: number
  invalidPathCount: number
  opticalCopyCount: number
  maximumOpticalEnergy: number
  duplicateLegacyFixtureCount: number
  distinctPhysicalApertureOriginCount: number
  colorChannelViolationCount: number
  activeCo2SourceCount: number
  expiredCo2SourceCount: number
  editorOverlayRiskCount: number
}

export interface LaserDmxPhysicalRealismAuditOptions {
  editorOverlayElementCount?: number
  canvas2dFallbackDetected?: boolean
}

export interface LaserDmxPhysicalRealismAudit {
  passed: boolean
  issues: LaserDmxPhysicalRealismIssue[]
  metrics: LaserDmxPhysicalRealismMetrics
}

const EPSILON = 1e-6

function finiteUnit(value: number): boolean {
  return Number.isFinite(value) && value >= -EPSILON && value <= 1 + EPSILON
}

function originKey(origin: LaserDmxSceneVec3 | undefined): string {
  const value = origin ?? { x: 0, y: 0, z: 0 }
  return `${value.x.toFixed(5)}:${value.y.toFixed(5)}:${value.z.toFixed(5)}`
}

function addIssue(
  issues: LaserDmxPhysicalRealismIssue[],
  code: LaserDmxPhysicalRealismIssueCode,
  fixtureId: string | null,
  detail: string,
): void {
  issues.push({ code, fixtureId, detail })
}

function hasUnblankedOpenPathRetrace(frame: LaserDmxSceneFrame): string[] {
  const headById = new Map(frame.scannerHeads.map(head => [head.id, head]))
  return frame.scanPaths
    .filter(path => {
      if (path.closed || path.repeatMode !== 'loop' || path.points.length < 2) return false
      const head = headById.get(path.scannerHeadId)
      return head != null && !head.retraceBlanking
    })
    .map(path => path.fixtureId)
}

/**
 * Final production invariant audit for a fully resolved Show Director frame.
 *
 * This deliberately consumes the same scene frame that both renderers receive.
 * It does not infer correctness from a non-black screenshot. The audit checks
 * scanner output cardinality, blanking, ordered-path validity, optical energy,
 * physical aperture origins, calibrated channels, CO2 lifetime, and the final
 * WebGL scanner-versus-legacy suppression contract.
 */
export function auditLaserDmxPhysicalRealism(
  frame: LaserDmxSceneFrame,
  options: LaserDmxPhysicalRealismAuditOptions = {},
): LaserDmxPhysicalRealismAudit {
  const issues: LaserDmxPhysicalRealismIssue[] = []
  const visibleRays = frame.scannerInstantaneousRays.filter(ray => !ray.blanked && ray.intensity > EPSILON)
  let maximumVisibleRaysPerHead = 0
  let normalSingleApertureHeadCount = 0
  let maximumOpticalEnergy = 0
  let distinctPhysicalApertureOriginCount = 0

  for (const head of frame.scannerHeads) {
    const copies = frame.opticalCopies.filter(copy => copy.scannerHeadId === head.id)
    const headVisibleRays = visibleRays.filter(ray => ray.scannerHeadId === head.id)
    const expectedOutputCount = 1 + copies.length
    maximumVisibleRaysPerHead = Math.max(maximumVisibleRaysPerHead, headVisibleRays.length)

    const outputIndices = new Set(headVisibleRays.map(ray => ray.opticalCopyIndex))
    if (headVisibleRays.length > expectedOutputCount) {
      addIssue(
        issues,
        'scanner-simultaneous-ray-count',
        head.fixtureId,
        `Scanner head ${head.id} emitted ${headVisibleRays.length} visible rays for ${expectedOutputCount} physical/optical outputs.`,
      )
    }
    if (outputIndices.size !== headVisibleRays.length) {
      addIssue(
        issues,
        'scanner-output-index-duplicated',
        head.fixtureId,
        `Scanner head ${head.id} emitted more than one instantaneous ray for the same optical output.`,
      )
    }

    const physicalApertureCount = Math.max(1, Math.round(head.physicalApertureCount ?? 1))
    if (physicalApertureCount === 1 && copies.length === 0) {
      normalSingleApertureHeadCount += 1
      if (headVisibleRays.length > 1) {
        addIssue(
          issues,
          'scanner-simultaneous-ray-count',
          head.fixtureId,
          `Normal single-aperture scanner head ${head.id} has ${headVisibleRays.length} simultaneous visible rays.`,
        )
      }
    }

    const directEnergy = Math.max(0, head.directIntensityScale ?? 1)
    const copyEnergy = copies.reduce((sum, copy) => sum + Math.max(0, copy.intensityScale), 0)
    const totalEnergy = directEnergy + copyEnergy
    maximumOpticalEnergy = Math.max(maximumOpticalEnergy, totalEnergy)
    if (totalEnergy > 1 + EPSILON) {
      addIssue(
        issues,
        'unbounded-optical-energy',
        head.fixtureId,
        `Scanner head ${head.id} distributes ${totalEnergy.toFixed(5)} energy across direct, prism, diffraction, or aperture outputs.`,
      )
    }

    if (physicalApertureCount > 1 || copies.some(copy => copy.kind === 'multiEmitter')) {
      const origins = new Set<string>([
        originKey(head.directOriginOffset),
        ...copies.map(copy => originKey(copy.originOffset)),
      ])
      distinctPhysicalApertureOriginCount += origins.size
      if (origins.size < physicalApertureCount) {
        addIssue(
          issues,
          'multi-aperture-origin-collapse',
          head.fixtureId,
          `Scanner head ${head.id} declares ${physicalApertureCount} apertures but resolves only ${origins.size} distinct origins.`,
        )
      }
    }
  }

  const blankedSamples = frame.exposureSamples.filter(sample => sample.blanked)
  const blankingViolations = blankedSamples.filter(sample => sample.intensity > EPSILON || sample.exposureWeight > EPSILON)
  for (const sample of blankingViolations) {
    addIssue(
      issues,
      'blanked-sample-visible',
      sample.fixtureId,
      `Blanked sample ${sample.pathId}:${sample.pointIndex} retained intensity or exposure weight.`,
    )
  }

  for (const path of frame.scanPaths.filter(path => path.validationErrors.length > 0)) {
    addIssue(
      issues,
      'invalid-ordered-path',
      path.fixtureId,
      `${path.id}: ${path.validationErrors.join('; ')}`,
    )
  }
  for (const fixtureId of hasUnblankedOpenPathRetrace(frame)) {
    addIssue(
      issues,
      'unblanked-open-path-retrace',
      fixtureId,
      'An open looping path can return from its terminal point without retrace blanking.',
    )
  }

  const webglInputValidation = validateLaserDmxWebGLLaserInputs(frame)
  for (const fixtureId of webglInputValidation.duplicateFixtureIds) {
    addIssue(
      issues,
      'legacy-scanner-duplicate',
      fixtureId,
      'The same fixture remains present in authoritative scanner samples and the rendered legacy laser input.',
    )
  }

  let colorChannelViolationCount = 0
  const colors = [
    ...frame.fixtures.map(fixture => ({ fixtureId: fixture.id, color: fixture.color })),
    ...frame.beams.map(beam => ({ fixtureId: beam.fixtureId, color: beam.color })),
    ...frame.scannerInstantaneousRays.map(ray => ({ fixtureId: ray.fixtureId, color: ray.color })),
    ...frame.exposureSamples.map(sample => ({ fixtureId: sample.fixtureId, color: sample.color })),
  ]
  for (const entry of colors) {
    if ([entry.color.r, entry.color.g, entry.color.b, entry.color.a].every(finiteUnit)) continue
    colorChannelViolationCount += 1
    addIssue(
      issues,
      'uncalibrated-color-channel',
      entry.fixtureId,
      'A resolved linear-light color contains a non-finite or out-of-range channel.',
    )
  }

  const activeCo2Sources = frame.atmosphereSources.filter(source => source.kind === 'co2' && source.enabled && source.density > EPSILON)
  const expiredCo2Sources = activeCo2Sources.filter(source => source.ageSec >= source.lifetimeSec + EPSILON)
  for (const source of expiredCo2Sources) {
    addIssue(
      issues,
      'expired-co2-visible',
      source.fixtureId,
      `${source.id} remains active at ${source.ageSec.toFixed(3)}s after a ${source.lifetimeSec.toFixed(3)}s lifetime.`,
    )
  }

  // Selection is legitimate scene metadata and is not itself an overlay.
  // The browser visual harness supplies the actual DOM overlay count so Capture
  // failures are based on rendered UI, not on a selected fixture flag.
  const editorOverlayRiskCount = frame.presentationMode === 'capture'
    ? Math.max(0, Math.round(options.editorOverlayElementCount ?? 0))
    : 0
  if (editorOverlayRiskCount > 0) {
    addIssue(
      issues,
      'capture-editor-overlay-risk',
      null,
      `${editorOverlayRiskCount} editor overlay elements were present during Capture validation.`,
    )
  }

  return {
    passed: issues.length === 0,
    issues,
    metrics: {
      scannerHeadCount: frame.scannerHeads.length,
      normalSingleApertureHeadCount,
      instantaneousVisibleRayCount: visibleRays.length,
      maximumVisibleRaysPerHead,
      blankedSampleCount: blankedSamples.length,
      blankingViolationCount: blankingViolations.length,
      orderedPathCount: frame.scanPaths.length,
      invalidPathCount: frame.scanPaths.filter(path => path.validationErrors.length > 0).length,
      opticalCopyCount: frame.opticalCopies.length,
      maximumOpticalEnergy,
      duplicateLegacyFixtureCount: webglInputValidation.duplicateFixtureIds.length,
      distinctPhysicalApertureOriginCount,
      colorChannelViolationCount,
      activeCo2SourceCount: activeCo2Sources.length,
      expiredCo2SourceCount: expiredCo2Sources.length,
      editorOverlayRiskCount,
    },
  }
}
