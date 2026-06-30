import type {
  LaserDmxBeamMatrixSettings,
  LaserDmxFixture,
  LaserDmxMatrixGridAnchor,
  LaserDmxMatrixTarget,
} from './ReactTypes'
import { gridCellToNormalized } from './laserDmxBeamMatrixCoordinates'
import {
  LASER_DMX_FIXTURE_SCHEMA_VERSION,
  legacyNormalizedToStageVector,
  normalizeProductionStageModel,
  type ProductionFixtureGroup,
  type ProductionStageModel,
  type ProductionStageVector3,
  type ProductionTarget,
} from './LaserDmxProductionRig'

/**
 * Beam Matrix remains a normalized 15×10 authoring surface. This bridge is the
 * single compatibility boundary into the metre-based production stage.
 */
export function beamMatrixAnchorToStageVector(
  anchor: LaserDmxMatrixGridAnchor,
  stageInput: unknown,
): ProductionStageVector3 {
  const normalized = gridCellToNormalized(anchor.column, anchor.row)
  return legacyNormalizedToStageVector({ x: normalized.x, y: normalized.y, z: anchor.z }, stageInput)
}

export function beamMatrixTargetToStageVector(
  target: LaserDmxMatrixTarget,
  stageInput: unknown,
): ProductionStageVector3 {
  if (target.kind === 'grid') {
    const normalized = gridCellToNormalized(target.column, target.row)
    return legacyNormalizedToStageVector({ x: normalized.x, y: normalized.y, z: target.z }, stageInput)
  }
  return legacyNormalizedToStageVector({ x: target.x, y: target.y, z: target.z }, stageInput)
}

function targetNormalized(target: LaserDmxMatrixTarget): { x: number; y: number; z: number } {
  if (target.kind === 'grid') {
    const normalized = gridCellToNormalized(target.column, target.row)
    return { x: normalized.x, y: normalized.y, z: target.z }
  }
  return { x: target.x, y: target.y, z: target.z }
}

export interface BeamMatrixSpatialConversion {
  stage: ProductionStageModel
  fixtures: LaserDmxFixture[]
  groups: ProductionFixtureGroup[]
  targets: ProductionTarget[]
}

/**
 * Creates an editable Spatial Fixtures rig without mutating Beam Matrix data.
 * The caller decides whether to replace/merge the spatial rig, making conversion
 * an explicit action rather than a side effect of switching workspaces.
 */
export function convertBeamMatrixToSpatialRig(
  matrix: LaserDmxBeamMatrixSettings,
  stageInput: unknown,
): BeamMatrixSpatialConversion {
  const stage = normalizeProductionStageModel(stageInput)
  const fixtures: LaserDmxFixture[] = matrix.beams.map((beam, index) => {
    const originNorm = gridCellToNormalized(beam.origin.column, beam.origin.row)
    const targetNorm = targetNormalized(beam.target)
    const origin = beamMatrixAnchorToStageVector(beam.origin, stage)
    const targetId = `matrix-target:${beam.id}`
    const profileId = beam.color.white > 0 ? 'genericRgbwLaser' as const : 'genericRgbLaser' as const
    return {
      schemaVersion: LASER_DMX_FIXTURE_SCHEMA_VERSION,
      fixtureKind: 'laserProjector',
      id: `matrix-fixture:${beam.id}`,
      name: beam.name || `Matrix Beam ${index + 1}`,
      enabled: beam.enabled,
      targetId,
      stageTransform: {
        position: origin,
        orientation: { yawDeg: 0, pitchDeg: 0, rollDeg: 0, panDeg: 0, tiltDeg: 0 },
      },
      dmx: { universe: 1, startAddress: Math.min(497, 1 + index * 16), profileId, channelMode: profileId === 'genericRgbwLaser' ? 'extended' : 'basic' },
      position: {
        originX: originNorm.x,
        originY: originNorm.y,
        originZ: beam.origin.z,
        targetX: targetNorm.x,
        targetY: targetNorm.y,
        targetZ: targetNorm.z,
        pan: 0,
        tilt: 0,
        rotation: 0,
        mirrorX: false,
        mirrorY: false,
      },
      color: {
        mode: 'fixed',
        red: beam.color.red,
        green: beam.color.green,
        blue: beam.color.blue,
        white: beam.color.white,
        alpha: beam.color.alpha,
        paletteId: '',
        colorCycleSpeed: 0.5,
      },
      beam: {
        dimmer: beam.appearance.dimmer,
        shutterOpen: beam.appearance.shutterOpen,
        width: beam.appearance.width,
        zoom: Math.max(0, Math.min(1, 1 - beam.appearance.divergence)),
        focus: beam.appearance.focus,
        strobeRate: beam.appearance.strobeRate,
        flickerAmount: beam.appearance.flickerAmount,
      },
      path: {
        kind: beam.appearance.geometry === 'volumetricCone' ? 'cone' : 'staticBeam',
        scale: 1,
        rotation: 0,
        offsetX: 0,
        offsetY: 0,
        scanSpeed: 0,
        phaseOffset: beam.motion.phaseOffset,
        pointCount: 1,
        spread: beam.appearance.divergence,
        radius: 0,
        complexity: 0,
        smoothing: 0,
        pathProgress: 1,
      },
      modulationRoutes: beam.modulationRoutes.map(route => ({ ...route, id: `${route.id}:matrix:${beam.id}` })),
    }
  })

  const targets: ProductionTarget[] = matrix.beams.map(beam => ({
    id: `matrix-target:${beam.id}`,
    name: `${beam.name} target`,
    kind: 'point',
    position: beamMatrixTargetToStageVector(beam.target, stage),
  }))

  const groups: ProductionFixtureGroup[] = matrix.groups.map(group => ({
    id: `matrix-group:${group.id}`,
    name: group.name,
    fixtureIds: matrix.beams
      .filter(beam => beam.groupId === group.id)
      .map(beam => `matrix-fixture:${beam.id}`),
    tags: ['beamMatrix'],
  }))

  return { stage, fixtures, groups, targets }
}
