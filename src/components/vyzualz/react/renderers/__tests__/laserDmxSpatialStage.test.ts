import { describe, expect, it } from 'vitest'
import {
  PRODUCTION_STAGE_COORDINATE_CONVENTION,
  applyProductionVenueTemplate,
  createDefaultProductionStageModel,
  deserializeLaserDmxSettings,
  diagnoseProductionRig,
  legacyNormalizedToStageVector,
  normalizeProductionStageModel,
  serializeLaserDmxSettings,
  stageVectorToLegacyNormalized,
} from '../../LaserDmxProductionRig'
import { createDefaultLaserDmxSettings } from '../../ReactTypes'
import { projectProductionStagePoint } from '../LaserDmxSpatialStageRenderer'

describe('LaserDMX spatial stage model', () => {
  it('normalizes dimensions and keeps the documented coordinate convention', () => {
    const stage = normalizeProductionStageModel({
      dimensions: { width: -4, height: Number.NaN, depth: 0 },
      floor: { width: -1, depth: 0 },
      editor: { qualityTier: 'medium' },
    })

    expect(stage.originConvention).toBe(PRODUCTION_STAGE_COORDINATE_CONVENTION)
    expect(stage.schemaVersion).toBe(1)
    expect(stage.dimensions.width).toBe(1)
    expect(stage.dimensions.height).toBeGreaterThan(0)
    expect(stage.dimensions.depth).toBe(1)
    expect(stage.floor.width).toBe(1)
    expect(stage.floor.depth).toBe(1)
    expect(stage.mountingSurfaces.length).toBeGreaterThan(0)
    expect(stage.savedCameraViews.length).toBeGreaterThan(0)
    expect(stage.editor.qualityTier).toBe('medium')
  })

  it('round-trips legacy normalized coordinates through metre-based stage space', () => {
    const stage = normalizeProductionStageModel({ dimensions: { width: 20, height: 10, depth: 12 } })
    const legacy = { x: 0.2, y: 0.7, z: -0.25 }
    const world = legacyNormalizedToStageVector(legacy, stage)
    const restored = stageVectorToLegacyNormalized(world, stage)

    expect(world.x).toBeCloseTo(-6)
    expect(world.y).toBeCloseTo(3)
    expect(world.z).toBeCloseTo(4.5)
    expect(restored.x).toBeCloseTo(legacy.x)
    expect(restored.y).toBeCloseTo(legacy.y)
    expect(restored.z).toBeCloseTo(legacy.z)
  })

  it('uses perspective so deeper points project at a smaller scale', () => {
    const stage = createDefaultProductionStageModel()
    const near = projectProductionStagePoint({ x: 2, y: 3, z: 1 }, stage.camera, 1280, 720)
    const far = projectProductionStagePoint({ x: 2, y: 3, z: 8 }, stage.camera, 1280, 720)

    expect(near.visible).toBe(true)
    expect(far.visible).toBe(true)
    expect(near.scale).toBeGreaterThan(far.scale)
  })

  it('applies an editable venue template only when explicitly requested', () => {
    const original = createDefaultLaserDmxSettings()
    const originalWidth = original.productionStage?.dimensions.width
    const applied = applyProductionVenueTemplate(original, 'wideFestivalStage')

    expect(original.productionStage?.dimensions.width).toBe(originalWidth)
    expect(applied.productionStage?.dimensions).toEqual({ width: 28, height: 14, depth: 15 })
    expect(applied.productionTargets?.some(target => target.kind === 'zone')).toBe(true)
    expect(applied.fixtures.every(fixture => fixture.stageTransform != null)).toBe(true)
  })

  it('persists the stage, camera, transforms, targets, and zones through serialization', () => {
    const settings = applyProductionVenueTemplate(createDefaultLaserDmxSettings(), 'compactClub')
    const saved = deserializeLaserDmxSettings(serializeLaserDmxSettings(settings))

    expect(saved.productionStage?.dimensions).toEqual({ width: 8, height: 5, depth: 5 })
    expect(saved.productionStage?.activeCameraViewId).toBe('camera:front-house')
    expect(saved.productionStage?.spatialZones.length).toBeGreaterThan(0)
    expect(saved.fixtures[0].stageTransform).toEqual(settings.fixtures[0].stageTransform)
    expect(saved.productionTargets).toEqual(settings.productionTargets)
  })

  it('reports invalid, duplicate, missing-profile, out-of-bounds, and unresolved fixtures', () => {
    const defaults = createDefaultLaserDmxSettings()
    const fixture = defaults.fixtures[0]
    const settings = {
      ...defaults,
      productionTargets: [],
      fixtures: [
        {
          ...fixture,
          id: 'duplicate',
          targetId: 'missing-target',
          stageTransform: {
            position: { x: Number.NaN, y: 2, z: 1 },
            orientation: { yawDeg: 0, pitchDeg: 0, rollDeg: 0, panDeg: 0, tiltDeg: 0 },
          },
        },
        {
          ...fixture,
          id: 'duplicate',
          name: 'Outside Fixture',
          dmx: { ...fixture.dmx, profileId: 'missing-profile' },
          stageTransform: {
            position: { x: 999, y: 2, z: 1 },
            orientation: { yawDeg: 0, pitchDeg: 0, rollDeg: 0, panDeg: 0, tiltDeg: 0 },
          },
        },
      ],
    }

    const codes = diagnoseProductionRig(settings).map(diagnostic => diagnostic.code)
    expect(codes).toEqual(expect.arrayContaining([
      'invalidPosition',
      'duplicateFixtureId',
      'missingProfile',
      'fixtureOutsideStageBounds',
      'unresolvedTarget',
    ]))
  })
})
