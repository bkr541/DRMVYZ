import { describe, expect, it } from 'vitest'
import {
  DEFAULT_CANVAS_ENGINE_SETTINGS,
  DEFAULT_CANVAS_PRESET_SETTINGS,
  type CanvasEngineSettings,
  type CanvasPresetSettings,
} from '../ReactTypes'
import {
  hasCanvasBaseTransform,
  hasCanvasEffectPass,
  hasCanvasReactiveTransform,
  hasCanvasSourceAnimation,
  hasCanvasSourceFilter,
  hasCanvasSourceTransform,
  makeCanvasCaptureFilter,
  resolveCanvasEffectOpacity,
  resolveCanvasPlaybackUrl,
} from '../canvasMediaFidelity'

function makeEngineSettings(patch: Partial<CanvasEngineSettings> = {}): CanvasEngineSettings {
  return { ...DEFAULT_CANVAS_ENGINE_SETTINGS, ...patch }
}

function makePresetSettings(patch: Partial<CanvasPresetSettings> = {}): CanvasPresetSettings {
  return { ...DEFAULT_CANVAS_PRESET_SETTINGS, ...patch }
}

describe('CANVAS media fidelity guards', () => {
  it('keeps clean playback on the original unfiltered and untransformed source path', () => {
    const engine = makeEngineSettings()
    const clean = makePresetSettings()

    expect(hasCanvasSourceFilter(clean)).toBe(false)
    expect(hasCanvasSourceAnimation(clean)).toBe(false)
    expect(hasCanvasBaseTransform(engine)).toBe(false)
    expect(hasCanvasReactiveTransform(clean)).toBe(false)
    expect(hasCanvasSourceTransform(engine, clean)).toBe(false)
    expect(hasCanvasEffectPass(clean)).toBe(false)
    expect(resolveCanvasEffectOpacity(clean)).toBe(0)
    expect(makeCanvasCaptureFilter(clean, 0.8, 0.6)).toBe('none')
  })

  it('moves preset processing into a separate additive effect pass', () => {
    const glow = makePresetSettings({ glow: 0.2 })
    const rgb = makePresetSettings({ rgbSplit: 0.2 })
    const reactive = makePresetSettings({ bassReactivity: 0.6, intensity: 0.8 })

    expect(hasCanvasSourceFilter(glow)).toBe(true)
    expect(hasCanvasSourceFilter(rgb)).toBe(true)
    expect(hasCanvasEffectPass(glow)).toBe(true)
    expect(hasCanvasEffectPass(rgb)).toBe(true)
    expect(hasCanvasReactiveTransform(reactive)).toBe(true)
    expect(hasCanvasEffectPass(reactive)).toBe(true)
    expect(resolveCanvasEffectOpacity(glow)).toBeGreaterThan(0)
    expect(resolveCanvasEffectOpacity(glow)).toBeLessThanOrEqual(0.72)
  })

  it('keeps manual layout transforms separate from preset reactive transforms', () => {
    const engine = makeEngineSettings({ scale: 1.1 })
    const clean = makePresetSettings()
    const reactive = makePresetSettings({ motionAmount: 0.4 })

    expect(hasCanvasBaseTransform(engine)).toBe(true)
    expect(hasCanvasReactiveTransform(clean)).toBe(false)
    expect(hasCanvasSourceTransform(engine, clean)).toBe(true)
    expect(hasCanvasReactiveTransform(reactive)).toBe(true)
  })

  it('retains timing-based stutter without authorizing source-element filters', () => {
    const stutter = makePresetSettings({ stutterRate: 4 })
    expect(hasCanvasSourceAnimation(stutter)).toBe(true)
    expect(hasCanvasSourceFilter(stutter)).toBe(false)
  })

  it('prefers the original media URL and uses a proxy only as a fallback', () => {
    expect(resolveCanvasPlaybackUrl({ url: 'original.mp4', proxyUrl: 'proxy.mp4' })).toBe('original.mp4')
    expect(resolveCanvasPlaybackUrl({ proxyUrl: 'proxy.mp4' })).toBe('proxy.mp4')
    expect(resolveCanvasPlaybackUrl({})).toBe('')
  })
})
