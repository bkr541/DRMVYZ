import { describe, expect, it } from 'vitest'
import {
  AFTERHOURS_DEFAULTS,
  AFTERHOURS_PATTERNS,
  resolveAfterhoursSettings,
  type AfterhoursPattern,
} from '../../../CinematicWorldSettings'
import { AFTERHOURS_SCENE_CATALOG, getAfterhoursSceneDefinition } from './AfterhoursSceneCatalog'
import { generateAfterhoursBeams, isAfterhoursViewportExit } from './AfterhoursBeamGeometry'

const BASE = {
  ...AFTERHOURS_DEFAULTS,
  sideLasers: true,
  topLasers: true,
  beamCount: 12,
  spread: 0.68,
  motionAmount: 0,
}

function signature(pattern: AfterhoursPattern): string {
  return generateAfterhoursBeams({ ...BASE, pattern }, { motionAuthority: 0, variation: 0, seed: 41 })
    .filter(beam => beam.active)
    .map(beam => `${beam.fixtureId}:${beam.role}:${beam.direction.x.toFixed(4)}:${beam.direction.y.toFixed(4)}`)
    .join('|')
}

describe('Afterhours Stage 4 — manual festival laser scenes', () => {
  it('publishes eight stable production scene IDs with authored scene metadata', () => {
    expect(AFTERHOURS_PATTERNS).toHaveLength(8)
    expect(AFTERHOURS_SCENE_CATALOG.map(scene => scene.id)).toEqual(AFTERHOURS_PATTERNS)
    for (const scene of AFTERHOURS_SCENE_CATALOG) {
      expect(scene.fixtureRoles.length).toBeGreaterThan(0)
      expect(scene.colorRoles).toContain('primary')
      expect(scene.centerAperture.minWidth).toBeGreaterThanOrEqual(0)
      expect(scene.density.minBeams).toBeGreaterThanOrEqual(2)
      expect(scene.density.maxBeams).toBeLessThanOrEqual(16)
      expect(scene.staticPose.spreadScale).toBeGreaterThan(0)
    }
    expect(getAfterhoursSceneDefinition('diamondStar').scanPath?.points.length).toBeGreaterThanOrEqual(5)
    expect(getAfterhoursSceneDefinition('sparseArchitecture').density).toMatchObject({ maxBeams: 4, role: 'sparse' })
    expect(getAfterhoursSceneDefinition('fullRig').density.role).toBe('dense')
  })

  it('migrates every legacy persisted Pattern value to the closest stable scene family', () => {
    const migration: Readonly<Record<string, AfterhoursPattern>> = {
      fan: 'wideFan',
      split: 'splitWings',
      cross: 'crossCanopy',
      xWall: 'chevronRoof',
      random: 'radialCrown',
    }
    for (const [legacy, expected] of Object.entries(migration)) {
      expect(resolveAfterhoursSettings({ ...AFTERHOURS_DEFAULTS, pattern: legacy }).pattern).toBe(expected)
    }
  })

  it('keeps all eight Motion-0 silhouettes deterministic and materially distinct', () => {
    const signatures = AFTERHOURS_PATTERNS.map(pattern => signature(pattern))
    expect(new Set(signatures).size).toBe(AFTERHOURS_PATTERNS.length)
    for (const pattern of AFTERHOURS_PATTERNS) expect(signature(pattern)).toBe(signature(pattern))
  })

  it('preserves viewport-exit ray geometry and deliberate sparse/full-rig density', () => {
    for (const pattern of AFTERHOURS_PATTERNS) {
      const beams = generateAfterhoursBeams({ ...BASE, pattern, beamCount: 16 }, { motionAuthority: 0 })
      const active = beams.filter(beam => beam.active)
      expect(active.every(beam => isAfterhoursViewportExit(beam.endpoint))).toBe(true)
      expect(beams).toHaveLength(16)
      if (pattern === 'sparseArchitecture') expect(active.length).toBeGreaterThanOrEqual(2)
      if (pattern === 'sparseArchitecture') expect(active.length).toBeLessThanOrEqual(4)
      else expect(active.length).toBe(16)
    }
  })

  it('enforces the protected centre opening in Wide Fan and Split Wings', () => {
    for (const pattern of ['wideFan', 'splitWings'] as const) {
      const beams = generateAfterhoursBeams({ ...BASE, pattern, beamCount: 10 }, { motionAuthority: 0 }).filter(beam => beam.active)
      const left = beams.filter(beam => beam.origin.x < 0.5)
      const right = beams.filter(beam => beam.origin.x > 0.5)
      expect(left.length).toBeGreaterThan(0)
      expect(right.length).toBeGreaterThan(0)
      if (pattern === 'splitWings') {
        expect(left.every(beam => beam.direction.x < 0)).toBe(true)
        expect(right.every(beam => beam.direction.x > 0)).toBe(true)
      }
    }
  })
})
