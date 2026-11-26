import { describe, expect, it } from 'vitest'
import { createSharedPerformanceFallbackContext, type SharedPerformanceContext } from '../../../../../features/performanceCore'
import { normalizeCanvasPresetSettings } from '../../../../../stores/reactStore'
import { CANVAS_PRESET_BY_ID, CANVAS_VISIBLE_PRESETS } from '../../ReactTypes'
import { resolveCanvasPresetProvenance } from '../../canvasPerformance/CanvasPresetProvenance'
import { MorphPerformance } from './MorphPerformance'
import { MORPH_DEFAULT_SOURCE, resolveMorphPoolItem } from './MorphSource'
import { DEFAULT_CANVAS_MORPH_SETTINGS as defaults, isMorphClean, normalizeCanvasMorphSettings, morphOutputEdge, MORPH_PATTERNS } from './MorphSettings'
const context = (time: number, patch: Partial<SharedPerformanceContext> = {}) => {
  const base = createSharedPerformanceFallbackContext(time)
  return { ...base, bpm: 180, absoluteBeat: time * 3, sectionConfidence: 1,
    capabilities: { ...base.capabilities, liveBands: true, beatGrid: true, rhythmEvents: true, sections: true },
    confidence: { ...base.confidence, overall: 1, rhythm: 1, grid: 1, semantics: 1, phrase: 1 },
    boundaries: { ...base.boundaries, timingDiscontinuity: false }, ...patch }
}
describe('MORPH', () => {
  it('registers once and migrates old settings without changing existing recipes', () => {
    expect(CANVAS_VISIBLE_PRESETS.filter(p => p.id === 'canvas-morph')).toHaveLength(1)
    const saved = normalizeCanvasPresetSettings({ schemaVersion: 21, fluidity: { surface: 'lenses' } })
    expect(saved.fluidity.surface).toBe('lenses')
    expect(saved.morph).toEqual(defaults)
    const preset = CANVAS_PRESET_BY_ID['canvas-morph']
    const exact = normalizeCanvasPresetSettings(preset.settings)
    expect(resolveCanvasPresetProvenance(preset, exact).status).toBe('exact')
    expect(resolveCanvasPresetProvenance(preset, { ...exact, morph: { ...defaults, mode: 'droste' } }).status).toBe('modified')
    expect(normalizeCanvasMorphSettings({ mode: 'invalid', feedback: 9, amount: Infinity, identity: -2 })).toEqual({ ...defaults, feedback: 1, identity: 0 })
    expect(isMorphClean({ ...defaults, identity: 1 })).toBe(true)
    expect(isMorphClean({ ...defaults, sourceMix: 1 })).toBe(true)
    expect(morphOutputEdge('auto', 3840, 2160)).toBe(1280)
  })
  it('reacts to new hits, decays held hits, and clears history on seek', () => {
    const driver = new MorphPerformance()
    const tick = (t: number, patch: Partial<SharedPerformanceContext> = {}) => driver.update(defaults, context(t, patch), t, 0.05, false, true)
    const idle = tick(0)
    expect(idle.hit).toBe(0)
    const hit = tick(0.05, { kick: true, kickStrength: 1, bass: 1 })
    expect(hit.hit).toBeGreaterThan(0)
    expect(hit.amount).toBeGreaterThan(idle.amount)
    expect(tick(0.1, { kick: true, kickStrength: 1 }).hit).toBeLessThan(hit.hit)
    expect(tick(4, { seekIdentity: 'seek', kick: true, kickStrength: 1 })).toMatchObject({ reset: true, hit: 0 })
  })
  it('uses manual mode when audio is disabled, with independent beat sync', () => {
    const driver = new MorphPerformance()
    const settings = { ...defaults, mode: 'droste' as const, bpmSync: true, audioReactivity: 0 }
    expect(driver.update(settings, context(2), 2, 0.05, false, true)).toMatchObject({ mode: 2, motion: 3 * defaults.speed, hit: 0, energy: 0 })
  })
  it('rotates available media in pool order without changing the shared library', () => {
    const a = { ...MORPH_DEFAULT_SOURCE, id: 'a' }, b = { ...MORPH_DEFAULT_SOURCE, id: 'b' }
    expect(resolveMorphPoolItem(['missing', 'a', 'b'], [a,b], 1)).toBe(b)
    expect(resolveMorphPoolItem(['a','b'], [a,b], 2)).toBe(a)
    expect(resolveMorphPoolItem(['missing'], [a,b], 0)).toBeNull()
    expect(MORPH_DEFAULT_SOURCE.objectUrl.startsWith('data:image/svg+xml,')).toBe(true)
  })
  it('normalizes all eight patterns and migrates V2 aliases with exclusive authority', () => {
    expect(MORPH_PATTERNS).toHaveLength(8)
    expect(normalizeCanvasMorphSettings({ pattern: 'flow' }).pattern).toBe('undertow')
    expect(normalizeCanvasMorphSettings({ pattern: 'cycle' }).pattern).toBe('metamorphosis')
    expect(normalizeCanvasMorphSettings({ patternChange: true, autoPerformance: true })).toMatchObject({ patternChange: true, autoPerformance: false })
  })
  it('crossfades metamorphosis modes on qualified four-bar positions and reconstructs calm sections', () => {
    const driver = new MorphPerformance()
    const settings = { ...defaults, pattern: 'metamorphosis' as const }
    expect(driver.update(settings, context(0, { performanceFourBarBlockIndex: 0 }), 0, .05, false, true).mode).toBe(0)
    const transition = driver.update(settings, context(.05, { performanceFourBarBlockIndex: 2 }), .05, .05, false, true)
    expect(transition).toMatchObject({ mode: 2, fromMode: 0 })
    expect(transition.blend).toBeGreaterThan(0)
    expect(transition.blend).toBeLessThan(1)
    const auto = { ...defaults, autoPerformance: true }
    const calm = new MorphPerformance().update(auto, context(2, { sectionType: 'breakdown' }), 2, .05, false, true)
    expect(calm.pattern).toBe(MORPH_PATTERNS.indexOf('rebirth'))
    expect(calm.amount).toBeLessThan(transition.amount)
  })
  it('advances once per canonical trigger and leaves authored settings untouched', () => {
    const driver = new MorphPerformance(), settings = { ...defaults, patternChange: true, trigger: 'beat' as const }
    driver.update(settings, context(0), 0, .05, false, true)
    const c = context(.4, { absoluteBeat: 1, boundaries: { ...context(.4).boundaries, beatBoundary: true, timingDiscontinuity: false } })
    expect(driver.update(settings, c, .4, .05, false, true).pattern).toBe(1)
    expect(driver.update(settings, c, .41, .01, false, true).pattern).toBe(1)
    expect(settings.pattern).toBe('impact')
  })
})
