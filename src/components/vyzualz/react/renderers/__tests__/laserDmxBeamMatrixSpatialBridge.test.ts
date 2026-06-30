import { describe, expect, it } from 'vitest'
import {
  DEFAULT_BEAM_MOTION,
  createDefaultLaserDmxBeamMatrixSettings,
  createDefaultLaserDmxSettings,
  type LaserDmxMatrixBeam,
} from '../../ReactTypes'
import {
  beamMatrixAnchorToStageVector,
  beamMatrixTargetToStageVector,
  convertBeamMatrixToSpatialRig,
} from '../../laserDmxBeamMatrixSpatialBridge'

function makeBeam(): LaserDmxMatrixBeam {
  return {
    id: 'beam-1',
    name: 'Bridge Beam',
    enabled: true,
    sequenceIndex: 0,
    origin: { column: 1, row: 10, z: -1 },
    target: { kind: 'grid', column: 15, row: 1, z: 1 },
    groupId: 'grp-bass',
    useGroupColor: false,
    color: { red: 12, green: 34, blue: 56, white: 78, alpha: 0.8 },
    appearance: {
      dimmer: 0.7,
      shutterOpen: true,
      width: 1.2,
      focus: 0.9,
      strobeRate: 0.1,
      flickerAmount: 0.2,
      divergence: 0.25,
      glow: 0.6,
      geometry: 'line',
    },
    motion: { ...DEFAULT_BEAM_MOTION, phaseOffset: 0.3 },
    modulationRoutes: [],
  }
}

describe('Beam Matrix to spatial-stage compatibility bridge', () => {
  it('converts grid depth and cell positions into stage metres', () => {
    const stage = createDefaultLaserDmxSettings().productionStage!
    const origin = beamMatrixAnchorToStageVector({ column: 1, row: 10, z: -1 }, stage)
    const target = beamMatrixTargetToStageVector({ kind: 'grid', column: 15, row: 1, z: 1 }, stage)

    expect(origin.x).toBeLessThan(0)
    expect(origin.y).toBeGreaterThanOrEqual(0)
    expect(origin.z).toBe(0)
    expect(target.x).toBeGreaterThan(0)
    expect(target.y).toBeGreaterThan(origin.y)
    expect(target.z).toBe(stage.dimensions.depth)
  })

  it('creates editable fixtures, targets, and groups without mutating Beam Matrix', () => {
    const matrix = createDefaultLaserDmxBeamMatrixSettings()
    matrix.beams = [makeBeam()]
    const before = structuredClone(matrix)
    const stage = createDefaultLaserDmxSettings().productionStage!
    const conversion = convertBeamMatrixToSpatialRig(matrix, stage)

    expect(matrix).toEqual(before)
    expect(conversion.fixtures).toHaveLength(1)
    expect(conversion.targets).toHaveLength(1)
    expect(conversion.fixtures[0]).toMatchObject({
      id: 'matrix-fixture:beam-1',
      targetId: 'matrix-target:beam-1',
      dmx: { profileId: 'genericRgbwLaser' },
      color: { red: 12, green: 34, blue: 56, white: 78 },
    })
    expect(conversion.groups.find(group => group.id === 'matrix-group:grp-bass')?.fixtureIds)
      .toEqual(['matrix-fixture:beam-1'])
  })
})
