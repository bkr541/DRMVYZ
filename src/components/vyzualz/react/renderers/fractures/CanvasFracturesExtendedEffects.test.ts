/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest'
import {
  CANVAS_FRACTURES_EFFECT_MODIFIERS,
  applyCanvasFracturesPixelTreatment,
  canvasFracturesHasModifier,
  resolveCanvasFracturesDissolveSample,
  resolveCanvasFracturesEffectAssignment,
  resolveCanvasFracturesEffectMacros,
  resolveCanvasFracturesFragmentEffects,
  resolveCanvasFracturesQualityBudget,
  resolveCanvasFracturesTrailBufferSize,
  resolveCanvasFracturesUvTransform,
} from './CanvasFracturesEffects'
import type {
  CanvasFractureEffectAssignment,
  CanvasFracturesEffectSettings,
} from './CanvasFracturesTypes'

function makeSettings(patch: Partial<CanvasFracturesEffectSettings> = {}): CanvasFracturesEffectSettings {
  return {
    intensity: 0.8,
    glow: 0.6,
    glitch: 0.55,
    texture: 0.7,
    trails: 0.5,
    depth: 0.65,
    duplication: 0.75,
    colorTreatment: 0.7,
    outlineIntensity: 0.65,
    outlineThickness: 0.5,
    bloomIntensity: 0.6,
    rgbSplit: 0.55,
    lumaMode: 'band',
    lumaThreshold: 0.52,
    displacement: 0.5,
    pixelation: 0.45,
    scanlines: 0.35,
    noise: 0.3,
    quality: 'balanced',
    colorSourceMode: 'manualOverride',
    manualPrimaryColor: '#4AC7DB',
    manualSupportingColor: '#61D6AA',
    flashTrigger: 0.8,
    reducedMotion: false,
    ...patch,
  }
}

function assignment(patch: Partial<CanvasFractureEffectAssignment> = {}): CanvasFractureEffectAssignment {
  return {
    role: 'glitch',
    seed: 42,
    directionX: 1,
    directionY: 0,
    phase: 0.5,
    modifiers: Object.values(CANVAS_FRACTURES_EFFECT_MODIFIERS).reduce((mask, bit) => mask | bit, 0),
    blendMode: 'difference',
    ...patch,
  }
}

describe('Canvas Fractures extended effects', () => {
  it('uses one macro resolver to disable and scale every treatment family', () => {
    const disabled = resolveCanvasFracturesEffectMacros(makeSettings({ intensity: 0 }))
    expect(disabled).toMatchObject({
      intensity: 0,
      outlineIntensity: 0,
      bloomIntensity: 0,
      rgbSplit: 0,
      displacement: 0,
      pixelation: 0,
      scanlines: 0,
      noise: 0,
      trailOpacity: 0,
      depth: 0,
      duplication: 0,
      hueShift: 0,
      duotone: 0,
      dissolve: 0,
    })

    const maximum = resolveCanvasFracturesEffectMacros(makeSettings({
      intensity: 1,
      glow: 1,
      glitch: 1,
      texture: 1,
      trails: 1,
      depth: 1,
      duplication: 1,
      colorTreatment: 1,
      flashTrigger: 1,
    }))
    expect(maximum.bloomIntensity).toBeGreaterThan(0)
    expect(maximum.posterization).toBeGreaterThan(0)
    expect(maximum.trailPersistence).toBeLessThanOrEqual(0.9)
    expect(maximum.flash).toBeLessThanOrEqual(0.52)
    expect(maximum.posterizeLevels).toBeGreaterThanOrEqual(2)
  })

  it('keeps modifier and blend assignment deterministic without role explosion', () => {
    const input = {
      presetId: 'canvas-fractures',
      sourceIdentity: 'extended-source',
      topologyIdentity: 'topology:9',
      fragmentId: 'fragment:4',
      variationSeed: 87,
      roleWeights: { clean: 0, glow: 0, outline: 0, glitch: 1, luma: 0, displacement: 0, texture: 0 },
    }
    const first = resolveCanvasFracturesEffectAssignment(input)
    const second = resolveCanvasFracturesEffectAssignment(input)
    expect(second).toEqual(first)
    expect(first.role).toBe('glitch')
    expect(first.modifiers).toBeGreaterThan(0)
    expect(canvasFracturesHasModifier(first.modifiers, 'dissolve')).toBe(true)
    expect(['screen', 'difference', 'exclusion']).toContain(first.blendMode)
  })

  it('keeps clean fragments untreated at moderate global intensity', () => {
    const resolved = resolveCanvasFracturesEffectMacros(makeSettings({ intensity: 0.6 }))
    expect(resolveCanvasFracturesFragmentEffects({
      assignment: assignment({ role: 'clean', modifiers: 0, blendMode: 'normal' }),
      settings: resolved,
      fragmentOrdinal: 0,
    })).toMatchObject({
      blendMode: 'normal',
      duplicateCount: 0,
      posterization: 0,
      hueShift: 0,
      duotone: 0,
      shadow: 0,
      flash: 0,
      blur: 0,
      sharpen: 0,
      dissolve: 0,
    })
  })

  it('caps duplicate and expensive effects by quality budget', () => {
    for (const quality of ['low', 'balanced', 'high'] as const) {
      const resolved = resolveCanvasFracturesEffectMacros(makeSettings({ quality, intensity: 1, duplication: 1, texture: 1 }))
      const budget = resolveCanvasFracturesQualityBudget(quality)
      const first = resolveCanvasFracturesFragmentEffects({ assignment: assignment(), settings: resolved, fragmentOrdinal: 0 })
      const beyondBudget = resolveCanvasFracturesFragmentEffects({
        assignment: assignment(),
        settings: resolved,
        fragmentOrdinal: budget.maxExpensiveFragments + 1,
      })
      expect(first.duplicateCount).toBeLessThanOrEqual(budget.maxDuplicateCopies)
      expect(beyondBudget.blur).toBe(0)
      expect(beyondBudget.sharpen).toBe(0)
      expect(beyondBudget.shadow).toBe(0)
    }
    expect(resolveCanvasFracturesFragmentEffects({
      assignment: assignment(),
      settings: resolveCanvasFracturesEffectMacros(makeSettings({ quality: 'low', intensity: 1, duplication: 1 })),
      fragmentOrdinal: 0,
    }).duplicateCount).toBe(1)
  })

  it('resolves bounded feedback buffer sizes for each static quality budget', () => {
    const low = resolveCanvasFracturesTrailBufferSize({
      pixelWidth: 3840,
      pixelHeight: 2160,
      budget: resolveCanvasFracturesQualityBudget('low'),
    })
    const high = resolveCanvasFracturesTrailBufferSize({
      pixelWidth: 3840,
      pixelHeight: 2160,
      budget: resolveCanvasFracturesQualityBudget('high'),
    })
    expect(low).toEqual({ width: 640, height: 360 })
    expect(high).toEqual({ width: 1280, height: 720 })
  })

  it('mirrors and flips source coordinates without changing geometry dimensions', () => {
    expect(resolveCanvasFracturesUvTransform(0.2, 0.7, false, false)).toEqual({ x: 0.2, y: 0.7 })
    expect(resolveCanvasFracturesUvTransform(0.2, 0.7, true, false)).toEqual({ x: 0.8, y: 0.7 })
    expect(resolveCanvasFracturesUvTransform(0.2, 0.7, false, true)).toEqual({ x: 0.2, y: 0.30000000000000004 })
    expect(resolveCanvasFracturesUvTransform(0.2, 0.7, true, true)).toEqual({ x: 0.8, y: 0.30000000000000004 })
  })

  it('keeps dissolve sampling stable for seek reconstruction', () => {
    const first = resolveCanvasFracturesDissolveSample(991, 14, 7)
    expect(resolveCanvasFracturesDissolveSample(991, 14, 7)).toBe(first)
    expect(resolveCanvasFracturesDissolveSample(991, 15, 7)).not.toBe(first)
  })

  it('preserves source alpha through posterization, hue shift, and duotone', () => {
    const treated = applyCanvasFracturesPixelTreatment({
      rgba: [120, 80, 200, 137],
      posterization: 1,
      posterizeLevels: 4,
      hueShift: 0.25,
      duotone: 0.8,
      primary: [0, 0.5, 1],
      supporting: [0.2, 1, 0.4],
    })
    expect(treated[3]).toBe(137)
    expect(applyCanvasFracturesPixelTreatment({
      rgba: [120, 80, 200, 137],
      posterization: 0,
      posterizeLevels: 4,
      hueShift: 0,
      duotone: 0,
      primary: [0, 0, 0],
      supporting: [1, 1, 1],
      dissolveMask: 0.5,
    })[3]).toBe(69)
  })

  it('disables flash under reduced-motion safety settings', () => {
    const resolved = resolveCanvasFracturesEffectMacros(makeSettings({
      intensity: 1,
      glitch: 1,
      flashTrigger: 1,
      reducedMotion: true,
    }))
    expect(resolved.flash).toBe(0)
  })
})
