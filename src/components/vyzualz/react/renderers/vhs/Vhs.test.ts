import { describe, expect, it } from 'vitest'
import { createSharedPerformanceFallbackContext, type SharedPerformanceContext } from '../../../../../features/performanceCore'
import { normalizeCanvasPresetSettings } from '../../../../../stores/reactStore'
import { CANVAS_PRESET_BY_ID, CANVAS_VISIBLE_PRESETS } from '../../ReactTypes'
import { resolveCanvasPresetProvenance } from '../../canvasPerformance/CanvasPresetProvenance'
import { VhsPerformance } from './VhsPerformance'
import { DEFAULT_CANVAS_VHS_SETTINGS as defaults, isVhsClean, normalizeCanvasVhsSettings, resolveVhsQuality } from './VhsSettings'

const context = (time: number, patch: Partial<SharedPerformanceContext> = {}) => {
  const base = createSharedPerformanceFallbackContext(time)
  return { ...base, absoluteBeat: time * 3, sectionConfidence: 1,
    capabilities: { ...base.capabilities, liveBands: true, beatGrid: true, rhythmEvents: true, sections: true },
    confidence: { ...base.confidence, overall: 1, rhythm: 1, grid: 1, semantics: 1 },
    boundaries: { ...base.boundaries, timingDiscontinuity: false }, ...patch }
}

describe('VHS', () => {
  it('adds one preset, preserves prior recipes and normalizes the history cap', () => {
    expect(CANVAS_VISIBLE_PRESETS.filter(preset => preset.id === 'canvas-vhs')).toHaveLength(1)
    const saved = normalizeCanvasPresetSettings({ schemaVersion: 20, divinity: { mask: 'alpha' } })
    expect(saved.divinity.mask).toBe('alpha')
    expect(saved.vhs).toEqual(defaults)
    expect(normalizeCanvasVhsSettings({ treatment: 'other', persistence: 9, bleed: Infinity, scanlines: -1, seed: 4.7 }))
      .toEqual({ ...defaults, persistence: 0.85, scanlines: 0, seed: 5 })
    const preset = CANVAS_PRESET_BY_ID['canvas-vhs'], exact = normalizeCanvasPresetSettings(preset.settings)
    expect(resolveCanvasPresetProvenance(preset, exact).status).toBe('exact')
    expect(resolveCanvasPresetProvenance(preset, { ...exact, vhs: { ...defaults, treatment: 'crt' } }).status).toBe('modified')
    expect(isVhsClean({ ...defaults, amount: 0 })).toBe(true)
    expect(isVhsClean({ ...defaults, sourceMix: 1 })).toBe(true)
  })

  it('bounds source treatment work across Auto tiers', () => {
    expect(resolveVhsQuality('auto', 640, 360)).toMatchObject({ chromaTaps: 7, crtLines: 270 })
    expect(resolveVhsQuality('auto', 1920, 1080)).toMatchObject({ outputEdge: 1440, chromaTaps: 5 })
    expect(resolveVhsQuality('auto', 3840, 2160)).toMatchObject({ outputEdge: 960, chromaTaps: 3, crtLines: 144 })
  })

  it('separates beat sync from response and uses manual time when the grid is unavailable', () => {
    const driver = new VhsPerformance(), settings = { ...defaults, bpmSync: true, audioReactivity: 0 }
    const sync = driver.update(settings, context(2, { bass: 1, kick: true, kickStrength: 1 }), 2, 0.05, false, true)
    expect(sync).toMatchObject({ phase: 3, tracking: defaults.tracking, glow: 0, dropout: defaults.dropout })
    expect(driver.update(settings, createSharedPerformanceFallbackContext(2), 2, 0.05, false, true).phase).toBe(2)
  })

  it('shapes kicks, dropouts and drops, then clears accents on seek without replay', () => {
    const driver = new VhsPerformance()
    const tick = (time: number, patch: Partial<SharedPerformanceContext> = {}, paused = false) =>
      driver.update(defaults, context(time, patch), time, 0.05, paused, true)
    expect(tick(0, { kick: true, kickStrength: 1 }).glow).toBe(0)
    tick(0.05)
    const hit = tick(0.1, { kick: true, kickStrength: 1, bass: 1, buildProgress: 1 })
    expect(hit.tracking).toBeGreaterThan(defaults.tracking)
    expect(hit.damage).toBeGreaterThan(defaults.damage)
    const held = tick(0.15, { kick: true, kickStrength: 1, snare: true, snareStrength: 1 })
    expect(held.glow).toBeLessThan(hit.glow)
    expect(held.dropout).toBeGreaterThan(defaults.dropout)
    expect(tick(0.15, {}, true)).toEqual(tick(0.15, {}, true))
    expect(tick(3, { seekIdentity: 'new', dropImpact: 1 }, true)).toMatchObject({ resetHistory: true, glow: 0, dropout: defaults.dropout })
    tick(3.05)
    expect(tick(3.1, { dropImpact: 1 }).roll).toBeGreaterThan(defaults.roll)
  })

  it('restores source readability in Auto breakdowns and caps persistence', () => {
    const driver = new VhsPerformance(), frame = context(2, { sectionType: 'breakdown' })
    const auto = driver.update({ ...defaults, autoPerformance: true }, frame, 2, 0.05, false, true)
    expect(auto.amount).toBeLessThan(defaults.amount)
    expect(auto.persistence).toBeLessThan(defaults.persistence * defaults.amount)
    driver.reset()
    expect(driver.update({ ...defaults, amount: 1, persistence: 0.85 }, context(2, { bass: 1 }), 2, 0.05, false, true).persistence).toBe(0.85)
  })
})
