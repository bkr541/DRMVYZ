import { describe, expect, it } from 'vitest'
import {
  DEFAULT_CANVAS_ENGINE_SETTINGS,
  DEFAULT_CANVAS_PRESET_SETTINGS,
  type CanvasEngineSettings,
  type CanvasPresetSettings,
} from '../ReactTypes'
import {
  hasCanvasSourceAnimation,
  hasCanvasSourceFilter,
  hasCanvasSourceTransform,
  makeCanvasCaptureFilter,
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
    expect(hasCanvasSourceTransform(engine, clean)).toBe(false)
    expect(makeCanvasCaptureFilter(clean, 0.8, 0.6)).toBe('none')
  })

  it('activates processing only when a source effect needs it', () => {
    expect(hasCanvasSourceFilter(makePresetSettings({ glow: 0.2 }))).toBe(true)
    expect(hasCanvasSourceFilter(makePresetSettings({ rgbSplit: 0.2 }))).toBe(true)
    expect(hasCanvasSourceAnimation(makePresetSettings({ stutterRate: 4 }))).toBe(true)
    expect(hasCanvasSourceTransform(makeEngineSettings({ scale: 1.1 }), makePresetSettings())).toBe(true)
    expect(hasCanvasSourceTransform(
      makeEngineSettings(),
      makePresetSettings({ bassReactivity: 0.6, intensity: 0.8 }),
    )).toBe(true)
  })

  it('prefers the original media URL and uses a proxy only as a fallback', () => {
    expect(resolveCanvasPlaybackUrl({ url: 'original.mp4', proxyUrl: 'proxy.mp4' })).toBe('original.mp4')
    expect(resolveCanvasPlaybackUrl({ proxyUrl: 'proxy.mp4' })).toBe('proxy.mp4')
    expect(resolveCanvasPlaybackUrl({})).toBe('')
  })
})
