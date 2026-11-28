import { describe, expect, it } from 'vitest'
import { createSharedPerformanceFallbackContext, type SharedPerformanceContext } from '../../../../../features/performanceCore'
import { normalizeCanvasPresetSettings } from '../../../../../stores/reactStore'
import { CANVAS_PRESET_BY_ID, CANVAS_VISIBLE_PRESETS } from '../../ReactTypes'
import { resolveCanvasPresetProvenance } from '../../canvasPerformance/CanvasPresetProvenance'
import { SingularityPerformance } from './SingularityPerformance'
import { SINGULARITY_DEFAULT_SOURCE, resolveSingularityPoolItem } from './SingularitySource'
import { DEFAULT_CANVAS_SINGULARITY_SETTINGS as defaults, SINGULARITY_PATTERNS, normalizeCanvasSingularitySettings, singularityBudget } from './SingularitySettings'
const context = (time: number, patch: Partial<SharedPerformanceContext> = {}) => {
  const base = createSharedPerformanceFallbackContext(time)
  return { ...base, bpm: 180, absoluteBeat: time * 3, sectionConfidence: 1,
    capabilities: { ...base.capabilities, liveBands: true, beatGrid: true, rhythmEvents: true, sections: true },
    confidence: { ...base.confidence, overall: 1, rhythm: 1, grid: 1, semantics: 1, phrase: 1 },
    boundaries: { ...base.boundaries, timingDiscontinuity: false }, ...patch }
}
describe('SINGULARITY', () => {
  it('registers once, migrates existing settings and tracks recipe changes', () => {
    expect(CANVAS_VISIBLE_PRESETS.filter(p => p.id === 'canvas-singularity')).toHaveLength(1)
    expect(normalizeCanvasPresetSettings({ morph: { amount: .4 } }).morph.amount).toBe(.4)
    expect(normalizeCanvasPresetSettings({}).singularity).toEqual(defaults)
    const preset = CANVAS_PRESET_BY_ID['canvas-singularity'], exact = normalizeCanvasPresetSettings(preset.settings)
    expect(resolveCanvasPresetProvenance(preset, exact).status).toBe('exact')
    expect(resolveCanvasPresetProvenance(preset, { ...exact, singularity: { ...defaults, glow: .2 } }).status).toBe('modified')
  })
  it('bounds input, quality and exclusive choreography authority', () => {
    expect(normalizeCanvasSingularitySettings({ fragmentDensity: 2, camera: -1, glow: Infinity, patternChange: true, autoPerformance: true })).toMatchObject({ fragmentDensity: 1, camera: 0, glow: defaults.glow, autoPerformance: false })
    expect(singularityBudget('low', 4000, 2000).particles).toBe(8000)
    expect(singularityBudget('auto', 3840, 2160).edge).toBe(1280)
    expect(SINGULARITY_PATTERNS).toHaveLength(10)
  })
  it('responds to qualified hits, avoids held event repeats, freezes on pause and clears on seek', () => {
    const d = new SingularityPerformance(), s = { ...defaults, autoPerformance: false }
    d.update(s, context(0), 0, .05, false, true)
    const hit = d.update(s, context(.05, { kick: true, kickStrength: 1, bass: 1 }), .05, .05, false, true)
    expect(hit.hit).toBeGreaterThan(0)
    const held = d.update(s, context(.1, { kick: true, kickStrength: 1 }), .1, .05, false, true)
    expect(held.hit).toBeLessThan(hit.hit)
    expect(d.update(s, context(.1), .1, .05, true, true).motion).toBe(held.motion)
    expect(d.update(s, context(4), 4, .05, false, true)).toMatchObject({ reset: true, hit: 0 })
  })
  it('keeps manual selection and rotates once on a qualified beat', () => {
    const d = new SingularityPerformance(), s = { ...defaults, patternChange: true, autoPerformance: false, trigger: 'beat' as const }
    d.update(s, context(0), 0, .05, false, true)
    const beat = context(.4, { absoluteBeat: 1, boundaries: { ...context(.4).boundaries, beatBoundary: true, timingDiscontinuity: false } })
    expect(d.update(s, beat, .4, .05, false, true).pattern).toBe(1)
    expect(d.update(s, beat, .41, .01, false, true).pattern).toBe(1)
    expect(s.pattern).toBe('origin')
    expect(new SingularityPerformance().update(defaults, context(1, { sectionType: 'breakdown' }), 1, .05, false, true).pattern).toBe(9)
  })
  it('uses available pool entries and preserves the default source', () => {
    const a = { ...SINGULARITY_DEFAULT_SOURCE, id: 'a' }, b = { ...a, id: 'b' }
    expect(resolveSingularityPoolItem(['missing','a','b'], [a,b], 1)).toBe(b)
    expect(resolveSingularityPoolItem(['missing'], [a,b], 1)).toBeNull()
    expect(SINGULARITY_DEFAULT_SOURCE.hasAlpha).toBe(true)
  })
})
