import { describe, expect, it } from 'vitest'
import { createSharedPerformanceFallbackContext, type SharedPerformanceContext } from '../../../../../features/performanceCore'
import { normalizeCanvasPresetSettings } from '../../../../../stores/reactStore'
import { CANVAS_PRESET_BY_ID, CANVAS_VISIBLE_PRESETS } from '../../ReactTypes'
import { resolveCanvasPresetProvenance } from '../../canvasPerformance/CanvasPresetProvenance'
import { DivinityPerformance } from './DivinityPerformance'
import { DEFAULT_CANVAS_DIVINITY_SETTINGS as defaults, isDivinityClean, normalizeCanvasDivinitySettings, resolveDivinityQuality } from './DivinitySettings'

const context = (time: number, patch: Partial<SharedPerformanceContext> = {}) => {
  const base = createSharedPerformanceFallbackContext(time)
  return { ...base, absoluteBeat: time * 3, sectionConfidence: 1,
    capabilities: { ...base.capabilities, liveBands: true, beatGrid: true, rhythmEvents: true, sections: true },
    confidence: { ...base.confidence, overall: 1, rhythm: 1, grid: 1, semantics: 1 },
    boundaries: { ...base.boundaries, timingDiscontinuity: false }, ...patch }
}

describe('Divinity', () => {
  it('migrates old settings, validates the recipe and tracks modifications', () => {
    expect(CANVAS_VISIBLE_PRESETS.filter(preset => preset.id === 'canvas-divinity')).toHaveLength(1)
    const prior = normalizeCanvasPresetSettings({ schemaVersion: 19, fluidity: { surface: 'lenses' } })
    expect(prior.fluidity.surface).toBe('lenses')
    expect(prior.divinity).toEqual(defaults)
    expect(normalizeCanvasDivinitySettings({ originX: -4, originY: Infinity, mask: 'invalid', colorMode: 'manual', color: '#AACCEE', decay: 4 }))
      .toEqual({ ...defaults, originX: 0, colorMode: 'manual', color: '#aaccee', decay: 1 })
    const preset = CANVAS_PRESET_BY_ID['canvas-divinity']
    const exact = normalizeCanvasPresetSettings(preset.settings)
    expect(resolveCanvasPresetProvenance(preset, exact).status).toBe('exact')
    expect(resolveCanvasPresetProvenance(preset, { ...exact, divinity: { ...defaults, originY: 0.2 } }).status).toBe('modified')
    for (const change of [{ amount: 0 }, { sourceMix: 1 }, { length: 0 }, { density: 0 }]) {
      expect(isDivinityClean({ ...defaults, ...change })).toBe(true)
    }
  })

  it('bounds mask storage and scattering taps across Auto sizes', () => {
    expect(resolveDivinityQuality('auto', 640, 360)).toEqual({ tier: 'high', outputEdge: 2560, maskEdge: 1024, taps: 40 })
    expect(resolveDivinityQuality('auto', 1920, 1080)).toMatchObject({ maskEdge: 640, taps: 24 })
    expect(resolveDivinityQuality('auto', 3840, 2160)).toMatchObject({ outputEdge: 960, maskEdge: 384, taps: 12 })
  })

  it('moves the origin with canonical time and gates BPM Sync separately from audio response', () => {
    const driver = new DivinityPerformance()
    const settings = { ...defaults, bpmSync: true, audioReactivity: 0 }
    const sync = driver.update(settings, context(2, { bass: 1, kick: true, kickStrength: 1 }), 2, 0.05, false, true)
    const fallback = driver.update(settings, createSharedPerformanceFallbackContext(2), 2, 0.05, false, true)
    expect(sync.originX).not.toBe(fallback.originX)
    expect(sync).toMatchObject({ amount: defaults.amount, length: defaults.length, spread: defaults.spread })
    expect(driver.update({ ...settings, motionSpeed: 0 }, null, 2, 0.05, false, true))
      .toMatchObject({ originX: defaults.originX, originY: defaults.originY })
  })

  it('deduplicates held rhythm events and resets accents on a paused seek', () => {
    const driver = new DivinityPerformance()
    const tick = (time: number, patch: Partial<SharedPerformanceContext> = {}, paused = false) =>
      driver.update(defaults, context(time, patch), time, 0.05, paused, true)
    expect(tick(0, { kick: true, kickStrength: 1 }).amount).toBe(defaults.amount)
    tick(0.05)
    const kick = tick(0.1, { kick: true, kickStrength: 1, bass: 1, buildProgress: 1 })
    expect(kick.amount).toBeGreaterThan(defaults.amount)
    expect(kick.length).toBeGreaterThan(defaults.length)
    const held = tick(0.15, { kick: true, kickStrength: 1, snare: true, snareStrength: 1 })
    expect(held.amount).toBeLessThan(kick.amount)
    expect(held.spread).toBeGreaterThan(defaults.spread)
    expect(tick(0.15, {}, true)).toEqual(tick(0.15, {}, true))
    expect(tick(3, { seekIdentity: 'new', dropImpact: 1 }, true)).toMatchObject({ amount: defaults.amount, spread: defaults.spread })
    tick(3.05)
    expect(tick(3.1, { dropImpact: 1 }).amount).toBeGreaterThan(kick.amount)
  })

  it('recovers source readability only when Auto Performance and qualified audio are active', () => {
    const driver = new DivinityPerformance(), frame = context(2, { sectionType: 'breakdown' })
    expect(driver.update(defaults, frame, 2, 0.05, false, true).amount).toBe(defaults.amount)
    driver.reset()
    expect(driver.update({ ...defaults, autoPerformance: true }, frame, 2, 0.05, false, true).amount).toBeLessThan(defaults.amount)
    expect(driver.update({ ...defaults, autoPerformance: true, audioReactivity: 0 }, frame, 2, 0.05, false, true).amount).toBe(defaults.amount)
  })
})
