import { describe, expect, it } from 'vitest'
import { createSharedPerformanceFallbackContext, type SharedPerformanceContext } from '../../../../../features/performanceCore'
import { normalizeCanvasPresetSettings } from '../../../../../stores/reactStore'
import { CANVAS_PRESET_BY_ID, CANVAS_VISIBLE_PRESETS } from '../../ReactTypes'
import { resolveCanvasPresetProvenance } from '../../canvasPerformance/CanvasPresetProvenance'
import { FluidityPerformance } from './FluidityPerformance'
import { DEFAULT_CANVAS_FLUIDITY_SETTINGS as defaults, FLUIDITY_SURFACES, isFluidityClean, normalizeCanvasFluiditySettings, resolveFluidityQuality } from './FluiditySettings'

const context = (time: number, patch: Partial<SharedPerformanceContext> = {}) => {
  const base = createSharedPerformanceFallbackContext(time)
  return { ...base, absoluteBeat: time * 3, sectionConfidence: 1,
    capabilities: { ...base.capabilities, liveBands: true, beatGrid: true, rhythmEvents: true, sections: true },
    confidence: { ...base.confidence, overall: 1, rhythm: 1, grid: 1, semantics: 1 },
    boundaries: { ...base.boundaries, timingDiscontinuity: false }, ...patch }
}

describe('Fluidity', () => {
  it('registers the four surfaces, migrates older settings, and tracks recipe changes', () => {
    expect(CANVAS_VISIBLE_PRESETS.filter(preset => preset.id === 'canvas-fluidity')).toHaveLength(1)
    const saved = normalizeCanvasPresetSettings({ schemaVersion: 18, terminal: { family: 'numbers' } })
    expect(saved.terminal.family).toBe('numbers')
    expect(saved.fluidity).toEqual(defaults)
    for (const surface of FLUIDITY_SURFACES) expect(normalizeCanvasFluiditySettings({ surface }).surface).toBe(surface)
    expect(normalizeCanvasFluiditySettings({ surface: 'noise', bevel: 2, lightAngle: -200, refraction: Infinity, preserveColors: 'false' }))
      .toEqual({ ...defaults, bevel: 1, lightAngle: -180 })
    const preset = CANVAS_PRESET_BY_ID['canvas-fluidity']
    const recipe = normalizeCanvasPresetSettings(preset.settings)
    expect(resolveCanvasPresetProvenance(preset, recipe).status).toBe('exact')
    expect(resolveCanvasPresetProvenance(preset, { ...recipe, fluidity: { ...defaults, surface: 'ribs' } }).status).toBe('modified')
    expect(isFluidityClean({ ...defaults, amount: 0, frost: 1 })).toBe(true)
    expect(isFluidityClean({ ...defaults, sourceMix: 1 })).toBe(true)
  })

  it('reduces resolution and frost samples at larger logical stage sizes', () => {
    expect(resolveFluidityQuality('auto', 720, 405)).toMatchObject({ tier: 'high', frostTaps: 9 })
    expect(resolveFluidityQuality('auto', 1920, 1080)).toMatchObject({ tier: 'balanced', frostTaps: 5 })
    expect(resolveFluidityQuality('auto', 3840, 2160)).toMatchObject({ tier: 'low', frostTaps: 3, outputEdge: 960 })
  })

  it('keeps an authored surface and separates beat sync from audio response', () => {
    const driver = new FluidityPerformance(), sample = context(2, { bass: 1 })
    const settings = { ...defaults, surface: 'ribs' as const, audioReactivity: 0, bpmSync: true }
    expect(driver.update(settings, sample, 2, 0.02, false, true)).toMatchObject({
      surface: 3, motion: 3 * defaults.flowSpeed, refraction: defaults.refraction, pressure: 0,
    })
    const fallback = createSharedPerformanceFallbackContext(2)
    expect(driver.update(settings, fallback, 2, 0.02, false, true).motion).toBe(2 * defaults.flowSpeed)
  })

  it('launches bounded pressure rings, deduplicates held hits, and suppresses seek accents', () => {
    const driver = new FluidityPerformance()
    const update = (time: number, patch: Partial<SharedPerformanceContext> = {}, paused = false) =>
      driver.update(defaults, context(time, patch), time, 0.05, paused, true)
    expect(update(0, { kick: true, kickStrength: 1 }).pressure).toBe(0)
    update(0.05)
    const hit = update(0.1, { bass: 1, buildProgress: 1, kick: true, kickStrength: 1 })
    expect(hit.pressure).toBeGreaterThan(0)
    expect(hit.refraction).toBeGreaterThan(defaults.refraction)
    expect(hit.pressureAge).toBe(0)
    const held = update(0.15, { kick: true, kickStrength: 1, snare: true, snareStrength: 1 })
    expect(held.pressure).toBeLessThan(hit.pressure)
    expect(held.highlight).toBeGreaterThan(hit.highlight)
    expect(held.pressureAge).toBeGreaterThan(0)
    expect(update(0.15, {}, true)).toEqual(update(0.15, {}, true))
    expect(update(3, { seekIdentity: 'new-seek', dropImpact: 1 }, true).pressure).toBe(0)
    update(3.05)
    expect(update(3.1, { dropImpact: 1 }).pressure).toBeGreaterThan(hit.pressure)
  })

  it('recovers the source during a qualified breakdown while retaining the authored surface', () => {
    const driver = new FluidityPerformance()
    const section = context(3, { sectionType: 'breakdown' })
    expect(driver.update({ ...defaults, autoPerformance: true }, section, 3, 0.05, false, true).amount).toBeLessThan(defaults.amount)
    expect(driver.update({ ...defaults, autoPerformance: true, audioReactivity: 0 }, section, 3, 0.05, false, true)).toMatchObject({ amount: defaults.amount, surface: 1 })
  })
})
