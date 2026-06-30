import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BrandAssetPresentation, BrandPalette } from '../BrandKitTypes'
import { normalizeBrandAssetPresentation } from '../brandKitNormalization'
import {
  compositeBrandAsset,
  isBrandAssetVisible,
  resolveBrandAssetPlacement,
  resetBrandAssetCompositorForTests,
  type ActiveBrandOverlay,
  type BrandAssetCompositeFrame,
} from '../brandAssetCompositor'

const PALETTE: BrandPalette = {
  primary: '#FF3366', secondary: '#22CCAA', accent: '#7755FF',
  background: '#05070A', highlight: '#FFFFFF', text: '#FFFFFF',
}

function presentation(patch: Partial<BrandAssetPresentation> = {}): BrandAssetPresentation {
  return {
    enabled: true, placement: 'bottom-right', scale: 0.2, opacity: 0.8, margin: 0.04,
    blendMode: 'source-over', glowMode: 'none', visibility: 'always',
    preserveOriginalColors: true, ...patch,
  }
}

function frame(patch: Partial<BrandAssetCompositeFrame> = {}): BrandAssetCompositeFrame {
  return { width: 1000, height: 500, audioTime: 20, durationSec: 100, audioEnergy: 0.5, ...patch }
}

function overlay(patch: Partial<ActiveBrandOverlay> = {}): ActiveBrandOverlay {
  const image = { width: 400, height: 200 } as unknown as CanvasImageSource
  return {
    assetId: 'asset-1', mediaItemId: 'media-1', image, naturalWidth: 400, naturalHeight: 200,
    presentation: presentation(), palette: PALETTE, ...patch,
  }
}

function fakeContext() {
  const calls: string[] = []
  const ctx = {
    globalCompositeOperation: 'source-over', globalAlpha: 1, shadowColor: '', shadowBlur: 0, fillStyle: '',
    save: vi.fn(() => calls.push('save')),
    drawImage: vi.fn(() => calls.push('drawImage')),
    fillRect: vi.fn(() => calls.push('fillRect')),
    restore: vi.fn(() => calls.push('restore')),
  } as unknown as CanvasRenderingContext2D
  return { ctx, calls }
}

afterEach(() => {
  resetBrandAssetCompositorForTests()
  vi.unstubAllGlobals()
})

describe('Brand asset canvas compositor', () => {
  it('calculates placement and safe-area inset deterministically', () => {
    expect(resolveBrandAssetPlacement(1000, 500, 400, 200, presentation())).toEqual({
      x: 780, y: 380, width: 200, height: 100,
    })
    expect(resolveBrandAssetPlacement(1000, 500, 400, 200, presentation({ placement: 'top-center' }))).toEqual({
      x: 400, y: 20, width: 200, height: 100,
    })
  })

  it('clamps scale, opacity, and inset through presentation normalization', () => {
    const rect = resolveBrandAssetPlacement(1000, 500, 400, 200, presentation({ scale: 4, opacity: 4, margin: 3 }))
    expect(rect).toEqual({ x: 300, y: 100, width: 600, height: 300 })
    expect(normalizeBrandAssetPresentation(presentation({ scale: 4, opacity: 4, margin: 3 }))).toMatchObject({
      scale: 0.6, opacity: 1, margin: 0.2,
    })
  })

  it('supports intro, outro, and always visibility by section or time window', () => {
    expect(isBrandAssetVisible(presentation({ visibility: 'always' }), frame())).toBe(true)
    expect(isBrandAssetVisible(presentation({ visibility: 'introOnly' }), frame({ audioTime: 2 }))).toBe(true)
    expect(isBrandAssetVisible(presentation({ visibility: 'introOnly' }), frame({ audioTime: 50 }))).toBe(false)
    expect(isBrandAssetVisible(presentation({ visibility: 'outroOnly' }), frame({ sectionType: 'outro' }))).toBe(true)
    expect(isBrandAssetVisible(presentation({ visibility: 'outroOnly' }), frame({ audioTime: 96 }))).toBe(true)
  })

  it('draws after the engine frame and applies tint inside an isolated artwork mask', () => {
    const scratchCalls: string[] = []
    const scratchContext = {
      globalCompositeOperation: 'source-over', globalAlpha: 1, shadowBlur: 0, fillStyle: '',
      clearRect: vi.fn(() => scratchCalls.push('clearRect')),
      drawImage: vi.fn(() => scratchCalls.push('drawImage')),
      fillRect: vi.fn(() => scratchCalls.push('fillRect')),
    } as unknown as CanvasRenderingContext2D
    class FakeOffscreenCanvas {
      width: number
      height: number
      constructor(width: number, height: number) { this.width = width; this.height = height }
      getContext() { return scratchContext }
    }
    vi.stubGlobal('OffscreenCanvas', FakeOffscreenCanvas)

    const { ctx, calls } = fakeContext()
    expect(compositeBrandAsset(ctx, overlay({
      presentation: presentation({ preserveOriginalColors: false, glowMode: 'audioReactive' }),
    }), frame({ audioEnergy: 0.9 }))).toBe(true)
    expect(calls).toEqual(['save', 'drawImage', 'restore'])
    expect(scratchCalls).toEqual(['clearRect', 'drawImage', 'fillRect'])
    expect(scratchContext.globalCompositeOperation).toBe('source-over')
    expect(scratchContext.fillStyle).toBe(PALETTE.primary)
    expect(ctx.shadowBlur).toBeGreaterThan(0)
  })

  it('does not draw a missing or disabled asset', () => {
    const { ctx } = fakeContext()
    expect(compositeBrandAsset(ctx, null, frame())).toBe(false)
    expect(compositeBrandAsset(ctx, overlay({ presentation: presentation({ enabled: false }) }), frame())).toBe(false)
    expect(ctx.drawImage).not.toHaveBeenCalled()
  })
})
