/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { CANVAS_PRESET_BY_ID, DEFAULT_CANVAS_PRESET_SETTINGS } from '../ReactTypes'
import {
  CanvasParticleAuraRenderer,
  compositeCanvasParticleLayerToCapture,
  resolveCanvasParticleAdaptiveQuality,
  resolveCanvasParticleGrid,
  resolveCanvasParticleQualityProfile,
  sampleCanvasParticleSource,
} from './CanvasParticleAuraRenderer'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('CanvasParticleAuraRenderer fallback and capture contract', () => {
  it('returns a useful error when WebGL2 is unavailable so the shell can enter compatibility mode', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    const result = CanvasParticleAuraRenderer.create(document.createElement('canvas'))

    expect(result.renderer).toBeNull()
    expect(result.error).toContain('WebGL2')
  })

  it('keeps a bounded procedural particle source when media pixels are not readable yet', () => {
    const points = sampleCanvasParticleSource({
      source: null,
      settings: DEFAULT_CANVAS_PRESET_SETTINGS,
      sampleCanvas: document.createElement('canvas'),
      profile: resolveCanvasParticleQualityProfile('low'),
      targetCount: 48,
    })

    expect(points).toHaveLength(48)
    expect(points.every(point => Number.isFinite(point.baseX) && Number.isFinite(point.baseY))).toBe(true)
  })

  it('composites the live particle canvas into the recorder output', () => {
    const particleCanvas = document.createElement('canvas')
    particleCanvas.width = 640
    particleCanvas.height = 360
    const drawImage = vi.fn()
    const context = {
      save: vi.fn(),
      restore: vi.fn(),
      drawImage,
      globalCompositeOperation: 'source-over',
      globalAlpha: 1,
      filter: 'none',
    } as unknown as CanvasRenderingContext2D

    const composited = compositeCanvasParticleLayerToCapture({
      context,
      particleCanvas,
      settings: {
        ...DEFAULT_CANVAS_PRESET_SETTINGS,
        particleDensity: 0.72,
        intensity: 0.82,
        glow: 0.86,
      },
      width: 1280,
      height: 720,
    })

    expect(composited).toBe(true)
    expect(drawImage).toHaveBeenCalledWith(particleCanvas, 0, 0, 1280, 720)
    expect(context.save).toHaveBeenCalledTimes(1)
    expect(context.restore).toHaveBeenCalledTimes(1)
  })
  it('uses a dense reconstruction grid that scales with authored density', () => {
    const profile = resolveCanvasParticleQualityProfile('balanced')
    const sparse = resolveCanvasParticleGrid({
      ...DEFAULT_CANVAS_PRESET_SETTINGS,
      particleDensity: 0.2,
    }, profile, 1280, 720)
    const dense = resolveCanvasParticleGrid({
      ...DEFAULT_CANVAS_PRESET_SETTINGS,
      particleDensity: 0.94,
    }, profile, 1280, 720)

    expect(dense.width).toBeGreaterThan(sparse.width)
    expect(dense.height).toBeGreaterThan(sparse.height)
    expect(dense.width).toBeGreaterThanOrEqual(200)
  })

  it('recovers adaptive quality after sustained healthy frame rate', () => {
    let state: ReturnType<typeof resolveCanvasParticleAdaptiveQuality> = {
      quality: 'low',
      lowFpsWindows: 0,
      highFpsWindows: 0,
    }

    for (let index = 0; index < 3; index += 1) {
      state = resolveCanvasParticleAdaptiveQuality({
        requested: 'high',
        current: state.quality,
        fps: 60,
        lowFpsWindows: state.lowFpsWindows,
        highFpsWindows: state.highFpsWindows,
      })
    }

    expect(state.quality).toBe('balanced')
  })

  it('ships Particle Aura as a reconstruction-first hologram recipe', () => {
    const preset = CANVAS_PRESET_BY_ID['canvas-particle-aura']

    expect(preset.settings.sourceVisibility).toBeLessThan(0.1)
    expect(preset.settings.particleDensity).toBeGreaterThan(0.9)
    expect(preset.settings.particleColorMode).toBe('audioReactive')
    expect(preset.controls).toEqual(expect.arrayContaining(['rgbSplit', 'glitchAmount', 'trailAmount', 'motionAmount']))
  })

})
