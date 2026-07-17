import { describe, expect, it } from 'vitest'
import { LASER_DMX_SHOW_DIRECTOR_PERFORMANCE_PRESETS } from '../../LaserDmxShowDirectorPerformancePresets'
import {
  SHOW_DIRECTOR_VISUAL_VALIDATION_FRAMES,
  resolveShowDirectorVisualValidationFrame,
} from '../../LaserDmxShowDirectorVisualValidation'
import { auditLaserDmxPhysicalRealism } from './LaserDmxPhysicalRealismAudit'

function preset(id: string) {
  const value = LASER_DMX_SHOW_DIRECTOR_PERFORMANCE_PRESETS.find(item => item.id === id)
  if (!value) throw new Error(`Missing Performance Show ${id}`)
  return value
}

function representativeFrame() {
  return resolveShowDirectorVisualValidationFrame(
    preset('festival-front-beams-performance'),
    SHOW_DIRECTOR_VISUAL_VALIDATION_FRAMES.find(frame => frame.id === 'drop-2-body')!,
  ).sceneFrame
}

describe('LaserDMX final physical realism audit', () => {
  it.each([
    'prism-cathedral',
    'cardinal-fan-reactor',
    'cyan-mirror-cage',
    'small-club-rig-performance',
    'festival-front-beams-performance',
    'dubstep-drop-lasers-performance',
    'moving-head-sweep-performance',
    'strobe-blinder-hits-performance',
    'led-bar-grid-performance',
    'haze-co2-drops-performance',
  ])('%s passes every representative song-state audit', presetId => {
    for (const definition of SHOW_DIRECTOR_VISUAL_VALIDATION_FRAMES) {
      const frame = resolveShowDirectorVisualValidationFrame(preset(presetId), definition).sceneFrame
      const audit = auditLaserDmxPhysicalRealism(frame)
      expect(audit.issues, `${presetId}:${definition.id}`).toEqual([])
      expect(audit.passed, `${presetId}:${definition.id}`).toBe(true)
      expect(audit.metrics.duplicateLegacyFixtureCount, `${presetId}:${definition.id}`).toBe(0)
      expect(audit.metrics.blankingViolationCount, `${presetId}:${definition.id}`).toBe(0)
      expect(audit.metrics.maximumOpticalEnergy, `${presetId}:${definition.id}`).toBeLessThanOrEqual(1.000001)
    }
  })

  it('proves a normal single-aperture head has at most one instantaneous visible ray', () => {
    const frame = representativeFrame()
    const normalHead = frame.scannerHeads.find(head => (
      (head.physicalApertureCount ?? 1) === 1
      && !frame.opticalCopies.some(copy => copy.scannerHeadId === head.id)
    ))
    expect(normalHead).toBeTruthy()
    const audit = auditLaserDmxPhysicalRealism(frame)
    const visible = frame.scannerInstantaneousRays.filter(ray => (
      ray.scannerHeadId === normalHead!.id && !ray.blanked && ray.intensity > 0
    ))
    expect(visible.length).toBeLessThanOrEqual(1)
    expect(audit.issues.some(issue => issue.fixtureId === normalHead!.fixtureId)).toBe(false)
  })

  it('rejects duplicated instantaneous output, visible blanking, and over-unity optical energy', () => {
    const frame = representativeFrame()
    const head = frame.scannerHeads[0]!
    const directRay = frame.scannerInstantaneousRays.find(ray => ray.scannerHeadId === head.id)!
    const sample = frame.exposureSamples.find(candidate => candidate.scannerHeadId === head.id)!
    const malformed = {
      ...frame,
      scannerHeads: frame.scannerHeads.map(candidate => candidate.id === head.id
        ? { ...candidate, directIntensityScale: 0.9 }
        : candidate),
      opticalCopies: [
        ...frame.opticalCopies,
        {
          id: `${head.id}-audit-overflow`,
          fixtureId: head.fixtureId,
          scannerHeadId: head.id,
          opticalCopyIndex: 99,
          kind: 'prism' as const,
          rotationDeg: 2,
          intensityScale: 0.4,
        },
      ],
      scannerInstantaneousRays: [
        ...frame.scannerInstantaneousRays,
        { ...directRay, sampleTime: directRay.sampleTime + 0.000001 },
        { ...directRay, sampleTime: directRay.sampleTime + 0.000002 },
      ],
      exposureSamples: [
        ...frame.exposureSamples,
        { ...sample, blanked: true, intensity: 0.5, exposureWeight: 0.2 },
      ],
    }
    const audit = auditLaserDmxPhysicalRealism(malformed)
    expect(audit.passed).toBe(false)
    expect(audit.issues.map(issue => issue.code)).toEqual(expect.arrayContaining([
      'scanner-simultaneous-ray-count',
      'scanner-output-index-duplicated',
      'blanked-sample-visible',
      'unbounded-optical-energy',
    ]))
  })

  it('rejects collapsed physical apertures, expired CO2, invalid paths, and Capture selection leakage', () => {
    const frame = representativeFrame()
    const head = frame.scannerHeads[0]!
    const fixture = frame.fixtures.find(candidate => candidate.id === head.fixtureId)!
    const malformed = {
      ...frame,
      presentationMode: 'capture' as const,
      fixtures: frame.fixtures.map(candidate => candidate.id === fixture.id ? { ...candidate, selected: true } : candidate),
      scannerHeads: frame.scannerHeads.map(candidate => candidate.id === head.id
        ? { ...candidate, physicalApertureCount: 2, directOriginOffset: { x: 0, y: 0, z: 0 } }
        : candidate),
      opticalCopies: [
        ...frame.opticalCopies.filter(copy => copy.scannerHeadId !== head.id),
        {
          id: `${head.id}-collapsed-aperture`,
          fixtureId: head.fixtureId,
          scannerHeadId: head.id,
          opticalCopyIndex: 1,
          kind: 'multiEmitter' as const,
          rotationDeg: 0,
          originOffset: { x: 0, y: 0, z: 0 },
          intensityScale: 0.5,
        },
      ],
      scanPaths: frame.scanPaths.map((path, index) => index === 0
        ? { ...path, validationErrors: ['audit invalid path'] }
        : path),
      atmosphereSources: [
        ...frame.atmosphereSources,
        {
          id: 'audit-expired-co2',
          kind: 'co2' as const,
          fixtureId: fixture.id,
          position: fixture.position,
          direction: fixture.orientation,
          color: fixture.color,
          density: 0.5,
          spread: 0.4,
          dissipation: 0.5,
          ageSec: 2,
          lifetimeSec: 1,
          expansion: 1,
          turbulence: 0.5,
          enabled: true,
          depthZone: fixture.depthZone,
          depthSource: fixture.depthSource,
        },
      ],
    }
    const audit = auditLaserDmxPhysicalRealism(malformed, { editorOverlayElementCount: 1 })
    expect(audit.issues.map(issue => issue.code)).toEqual(expect.arrayContaining([
      'multi-aperture-origin-collapse',
      'expired-co2-visible',
      'invalid-ordered-path',
      'capture-editor-overlay-risk',
    ]))
  })
})
