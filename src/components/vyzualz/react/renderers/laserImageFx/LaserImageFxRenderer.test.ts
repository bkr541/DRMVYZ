import { describe, expect, it } from 'vitest'
import {
  LaserImageFxRenderer,
  laserColorEffectToUniform,
  laserImageEffectToUniform,
  resolveLaserImageFxFitScale,
  resolveLaserImageFxPhase,
} from './LaserImageFxRenderer'

describe('Laser Image FX deterministic render plan', () => {
  it('fails locally without WebGL2 instead of throwing through the Canvas tree', () => {
    const canvas = { getContext: () => null } as unknown as HTMLCanvasElement
    const result = LaserImageFxRenderer.create(canvas)

    expect(result.renderer).toBeNull()
    expect(result.error).toContain('WebGL2 unavailable')
  })

  it('maps every required image effect to a stable, distinct shader branch', () => {
    const effects = ['none', 'cubeA', 'flipB', 'spin3d', 'twistB', 'rubber', 'stripe', 'vignette', 'warpDiamond', 'warpSquare'] as const
    const branches = effects.map(laserImageEffectToUniform)
    expect(new Set(branches).size).toBe(effects.length)
    expect(laserImageEffectToUniform('warpDiamond')).not.toBe(laserImageEffectToUniform('warpSquare'))
  })

  it('maps color treatments independently from geometry', () => {
    const effects = ['source', 'beatSaturateA', 'beatSaturateB', 'colorBlobsA', 'colorBlobsB'] as const
    expect(new Set(effects.map(laserColorEffectToUniform)).size).toBe(effects.length)
  })

  it('uses musical beat position for BPM sync and deterministic time otherwise', () => {
    const syncedA = resolveLaserImageFxPhase({ timeSec: 100, bpmSync: true, speed: 1, bpm: 120, absoluteBeat: 8 })
    const syncedB = resolveLaserImageFxPhase({ timeSec: 999, bpmSync: true, speed: 1, bpm: 120, absoluteBeat: 8 })
    const manual = resolveLaserImageFxPhase({ timeSec: 10, bpmSync: true, speed: 1, bpm: 0, absoluteBeat: 0 })
    expect(syncedA).toBeCloseTo(4 * Math.PI)
    expect(syncedB).toBe(syncedA)
    expect(manual).toBeCloseTo(9)
  })

  it('preserves contain/cover/stretch aspect behavior for the GPU plane', () => {
    expect(resolveLaserImageFxFitScale('stretch', 16 / 9, 4 / 3)).toEqual({ x: 1, y: 1 })
    const contain = resolveLaserImageFxFitScale('contain', 16 / 9, 4 / 3)
    const cover = resolveLaserImageFxFitScale('cover', 16 / 9, 4 / 3)
    expect(contain.x).toBe(1)
    expect(contain.y).toBeLessThan(1)
    expect(cover.x).toBeGreaterThan(1)
    expect(cover.y).toBe(1)
  })
})
