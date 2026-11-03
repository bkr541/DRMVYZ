import { describe, expect, it } from 'vitest'
import { createSharedPerformanceFallbackContext } from '../../../../../features/performanceCore'
import { normalizeCanvasPresetSettings } from '../../../../../stores/reactStore'
import { CANVAS_PRESET_BY_ID, CANVAS_VISIBLE_PRESETS } from '../../ReactTypes'
import { resolveCanvasPresetProvenance } from '../../canvasPerformance/CanvasPresetProvenance'
import { CellularPerformance } from './CellularPerformance'
import { DEFAULT_CANVAS_CELLULAR_SETTINGS as defaults, normalizeCanvasCellularSettings, resolveCellularPlan } from './CellularSettings'

describe('Cellular', () => {
  it('registers the preset and migrates the recipe without changing prior settings', () => {
    expect(CANVAS_VISIBLE_PRESETS.filter(preset => preset.id === 'canvas-cellular')).toHaveLength(1)
    const prior = normalizeCanvasPresetSettings({ schemaVersion: 16, phaseDrag: { amount: 0.2 } })
    expect(prior.phaseDrag.amount).toBe(0.2)
    expect(prior.cellular).toEqual(defaults)
    expect(normalizeCanvasCellularSettings({ feed: Infinity, kill: 9, cellScale: 1, colorA: 'bad', colorB: '#FF00FF', quality: 'invalid' }))
      .toEqual({ ...defaults, kill: 0.1, cellScale: 2, colorB: '#ff00ff' })
    const preset = CANVAS_PRESET_BY_ID['canvas-cellular']
    const exact = normalizeCanvasPresetSettings(preset.settings)
    expect(resolveCanvasPresetProvenance(preset, exact).status).toBe('exact')
    expect(resolveCanvasPresetProvenance(preset, { ...exact, cellular: { ...defaults, seed: 11 } }).status).toBe('modified')
  })

  it('bounds the field by quality and caps the timestep even at high speed', () => {
    expect(resolveCellularPlan(defaults, 3840, 2160)).toMatchObject({ tier: 'low', fieldEdge: 256, output: { width: 960, height: 540 } })
    expect(resolveCellularPlan({ ...defaults, quality: 'high' }, 3840, 2160, 2)).toMatchObject({ fieldEdge: 768, output: { width: 2560, height: 1440 } })
    const controller = new CellularPerformance()
    const run = (settings = defaults, deltaSec = 0.1) => controller.update({ settings, context: null, timeSec: 0, deltaSec, audioActive: false, paused: false })
    expect(run({ ...defaults, speed: 2 }).step).toBe(1)
    expect(run({ ...defaults, speed: 0 }).step).toBe(0)
    expect(run(defaults, 1 / 60).step).toBeCloseTo(0.6)
  })

  it('gates source injection pulses, holds on pause, and cold-reseeds once after a seek', () => {
    const controller = new CellularPerformance()
    const base = createSharedPerformanceFallbackContext(0)
    const run = (timeSec: number, kick = false, paused = false, response = 1) => controller.update({
      settings: { ...defaults, audioReactivity: response }, timeSec, deltaSec: 0.05, paused, audioActive: true,
      context: { ...base, audioTimeSec: timeSec, kick, kickStrength: 1, capabilities: { ...base.capabilities, rhythmEvents: true },
        confidence: { ...base.confidence, rhythm: 1 }, boundaries: { ...base.boundaries, timingDiscontinuity: false } },
    })
    expect(run(0, true).pulse).toBe(0)
    run(0.01)
    const hit = run(0.05, true)
    expect(hit.pulse).toBeGreaterThan(0)
    expect(run(0.1, true).pulse).toBeLessThan(hit.pulse)
    expect(run(0.1, false, true).step).toBe(0)
    expect(run(0.15, true, true)).toMatchObject({ positionReset: true, pulse: 0, step: 0 })
    expect(run(0.15, true, true).positionReset).toBe(false)
    expect(run(0.2, true, false, 0)).toMatchObject({ reset: true, pulse: 0 })
  })
})
