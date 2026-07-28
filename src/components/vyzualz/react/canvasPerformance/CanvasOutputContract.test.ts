import { describe, expect, it } from 'vitest'
import { DEFAULT_CANVAS_PRESET_SETTINGS } from '../ReactTypes'
import { makeCanvasCaptureFilter, resolveCanvasEffectOpacity } from '../canvasMediaFidelity'
import { normalizeCanvasPresetSettings } from '../../../../stores/reactStore'
import { resolveCanvasLayerAlphaHierarchy, resolveCanvasOutputContract } from './CanvasOutputContract'

describe('CANVAS output ownership contract', () => {
  it('migrates legacy Source Visibility exactly once into Dry Source Mix', () => {
    const migrated = normalizeCanvasPresetSettings({ sourceVisibility: 0.37 })
    expect(migrated.schemaVersion).toBe(2)
    expect(migrated.sourceMixMode).toBe('legacyComposite')
    expect(migrated.drySourceMix).toBeCloseTo(0.37)
    expect(migrated.sourceVisibility).toBeCloseTo(0.37)
    expect(normalizeCanvasPresetSettings(migrated)).toEqual(migrated)
  })

  it('keeps output opacity outside layer composition', () => {
    const contract = resolveCanvasOutputContract({
      canvasOutputOpacity: 0.4,
      presetSettings: { sourceMixMode: 'dryOnly', drySourceMix: 0.25, sourceVisibility: 0.25 },
    })
    expect(contract.canvasOutputOpacity).toBeCloseTo(0.4)
    expect(contract.drySourceMix).toBeCloseTo(0.25)
  })

  it('reduces dry source without suppressing a processed pass', () => {
    const untreated = resolveCanvasLayerAlphaHierarchy({
      layer: { opacity: 0.8, effectChain: [] },
      transitionOpacity: 0.5,
      drySourceMix: 0.25,
      sourceMixMode: 'dryOnly',
    })
    const treated = resolveCanvasLayerAlphaHierarchy({
      layer: { opacity: 0.8, effectChain: [{ id: 'glow-1', effect: 'glow', enabled: true, amount: 1, params: {}, modulationRoutes: [], eventBindings: [] }] },
      transitionOpacity: 0.5,
      drySourceMix: 0.25,
      sourceMixMode: 'dryOnly',
    })
    expect(untreated.drySourceAlpha).toBeCloseTo(0.1)
    expect(untreated.processedAlpha).toBe(0)
    expect(treated.drySourceAlpha).toBeCloseTo(0.1)
    expect(treated.processedAlpha).toBeCloseTo(0.4)
  })

  it('keeps Visual Intensity distinct from output opacity, dry mix, and individual effects', () => {
    const lowIntensity = normalizeCanvasPresetSettings({
      ...DEFAULT_CANVAS_PRESET_SETTINGS,
      intensity: 0.1,
      bassReactivity: 1,
      glow: 0.4,
      drySourceMix: 0.3,
      sourceVisibility: 0.3,
    })
    const highIntensity = normalizeCanvasPresetSettings({ ...lowIntensity, intensity: 0.9 })
    const lowContract = resolveCanvasOutputContract({ canvasOutputOpacity: 0.55, presetSettings: lowIntensity })
    const highContract = resolveCanvasOutputContract({ canvasOutputOpacity: 0.55, presetSettings: highIntensity })

    expect(highContract).toEqual(lowContract)
    expect(resolveCanvasEffectOpacity(highIntensity)).toBeGreaterThan(resolveCanvasEffectOpacity(lowIntensity))
    expect(makeCanvasCaptureFilter(highIntensity, 1, 0.5)).not.toBe(makeCanvasCaptureFilter(lowIntensity, 1, 0.5))
  })

  it('preserves the legacy composite product behind the schema boundary', () => {
    const treated = resolveCanvasLayerAlphaHierarchy({
      layer: { opacity: 0.8, effectChain: [{ id: 'glow-1', effect: 'glow', enabled: true, amount: 1, params: {}, modulationRoutes: [], eventBindings: [] }] },
      transitionOpacity: 0.5,
      drySourceMix: 0.25,
      sourceMixMode: 'legacyComposite',
    })
    expect(treated.drySourceAlpha).toBeCloseTo(0.1)
    expect(treated.processedAlpha).toBeCloseTo(0.1)
  })
})
