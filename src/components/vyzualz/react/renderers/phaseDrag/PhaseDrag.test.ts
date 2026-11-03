import { describe, expect, it } from 'vitest'
import { CANVAS_PRESET_BY_ID, CANVAS_VISIBLE_PRESETS } from '../../ReactTypes'
import { resolveCanvasPresetProvenance } from '../../canvasPerformance/CanvasPresetProvenance'
import { normalizeCanvasPresetSettings } from '../../../../../stores/reactStore'
import { createSharedPerformanceFallbackContext } from '../../../../../features/performanceCore'
import { PhaseDragHistory, resolvePhaseDragPlan } from './PhaseDragHistory'
import { PhaseDragPerformance } from './PhaseDragPerformance'
import { DEFAULT_CANVAS_PHASE_DRAG_SETTINGS as defaults, isPhaseDragClean, normalizeCanvasPhaseDragSettings } from './PhaseDragSettings'

describe('Phase Drag', () => {
  it('registers one visible preset, migrates old recipes and normalizes the nested settings', () => {
    expect(CANVAS_VISIBLE_PRESETS.filter(preset => preset.id === 'canvas-phase-drag')).toHaveLength(1)
    expect(normalizeCanvasPresetSettings({ schemaVersion: 15 }).phaseDrag).toEqual(defaults)
    expect(normalizeCanvasPhaseDragSettings({ historySamples: 999, historyWindow: -1, direction: 'invalid', amount: Infinity, scanMode: 'radial' }))
      .toEqual({ ...defaults, historySamples: 12, historyWindow: 0.1, scanMode: 'radial' })
    const preset = CANVAS_PRESET_BY_ID['canvas-phase-drag']
    const exact = normalizeCanvasPresetSettings(preset.settings)
    expect(resolveCanvasPresetProvenance(preset, exact).status).toBe('exact')
    expect(resolveCanvasPresetProvenance(preset, { ...exact, phaseDrag: { ...defaults, slitWidth: 0.5 } }).status).toBe('modified')
    expect(isPhaseDragClean({ ...defaults, stillMovement: 0 }, false)).toBe(true)
    expect(isPhaseDragClean({ ...defaults, stillMovement: 0 }, true)).toBe(false)
  })

  it('bounds Auto history and stores only written frames, newest first after wrap', () => {
    const history = new PhaseDragHistory()
    const plan = resolvePhaseDragPlan({ ...defaults, historySamples: 12 }, 3840, 2160)
    expect(plan).toMatchObject({ tier: 'low', samples: 4, historyEdge: 384, output: { width: 960, height: 540 } })
    expect(history.nextSlot(0, 0.9, 4)).toBe(0)
    expect(history.nextSlot(0.1, 0.9, 4)).toBeNull()
    for (const [time, slot] of [[0.3, 1], [0.6, 2], [0.9, 3], [1.2, 0]]) expect(history.nextSlot(time, 0.9, 4)).toBe(slot)
    expect(history.describe(1.25, 4)).toBe(4)
    expect([0, 2, 4, 6].map(i => history.uniforms[i])).toEqual([0, 3, 2, 1])
    expect(history.uniforms[7]).toBeCloseTo(0.95)
    history.reset()
    expect(history.describe(4, 4)).toBe(0)
    expect(history.nextSlot(4, 0.9, 4)).toBe(0)
    expect(history.describe(4, 4)).toBe(1)
  })

  it('gates accents, deduplicates held kick input and reanchors on paused seek', () => {
    const runtime = new PhaseDragPerformance()
    const base = createSharedPerformanceFallbackContext(0)
    const sample = (timeSec: number, kick: boolean, paused = false, response = 1) => runtime.update({
      settings: { ...defaults, audioReactivity: response }, timeSec, deltaSec: 0.05, paused, audioActive: true,
      context: { ...base, audioTimeSec: timeSec, kick, kickStrength: 1, capabilities: { ...base.capabilities, rhythmEvents: true },
        confidence: { ...base.confidence, rhythm: 1 }, boundaries: { ...base.boundaries, timingDiscontinuity: false } },
    })
    expect(sample(0, false).slitWidth).toBe(defaults.slitWidth)
    const kick = sample(0.05, true)
    expect(kick.slitWidth).toBeGreaterThan(defaults.slitWidth)
    expect(sample(0.1, true).slitWidth).toBeLessThan(kick.slitWidth)
    expect(sample(0.15, false, true)).toMatchObject({ positionReset: true, slitWidth: defaults.slitWidth })
    expect(sample(0.15, false, true).positionReset).toBe(false)
    expect(sample(0.2, true, false, 0).slitWidth).toBe(defaults.slitWidth)
  })
})
