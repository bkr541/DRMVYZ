import { describe, expect, it, vi } from 'vitest'
import type { OutputAspectRatio } from '../../../../native/outputBridge'
import { copyPerformanceFrame, matchesPerformanceAspect, measurePerformanceSurface, performanceOutputSize, performancePreviewScale, performanceRenderDpr, performanceTransitionSize } from './performanceOutputGeometry'

const profiles = [
  ['16:9', 1920, 1080, 1280, 720],
  ['16:10', 1728, 1080, 1152, 720],
  ['4:3', 1440, 1080, 960, 720],
  ['3:2', 1620, 1080, 1080, 720],
  ['1:1', 1080, 1080, 720, 720],
  ['9:16', 1080, 1920, 720, 1280],
] as const

describe('performance output geometry', () => {
  it.each(profiles)('locks %s on both transports and in transitions', (aspect, w, h, gw, gh) => {
    expect(performanceOutputSize(aspect)).toEqual({ width: w, height: h })
    expect(performanceOutputSize(aspect, 'google-cast-webm')).toEqual({ width: gw, height: gh })
    const transition = performanceTransitionSize(aspect, 1600)
    expect(transition.width * h).toBe(transition.height * w)
    expect(Math.max(transition.width, transition.height)).toBeLessThanOrEqual(1600)
  })
  it('scales preview only, leaving the selected output and render dimensions unchanged', () => {
    const aspect: OutputAspectRatio = '16:9'
    const output = performanceOutputSize(aspect)
    const views = [{ width: 1600, height: 900 }, { width: 1200, height: 900 }, { width: 850, height: 900 }, { width: 850, height: 300 }]
    const element = { closest: () => ({}), clientWidth: output.width, clientHeight: output.height,
      getBoundingClientRect: () => ({ width: 850, height: 478 }) } as unknown as HTMLElement
    for (const available of views) {
      const scale = performancePreviewScale(available, output)
      expect(output.width * scale).toBeLessThanOrEqual(available.width + 0.001)
      expect(output.height * scale).toBeLessThanOrEqual(available.height + 0.001)
      expect(measurePerformanceSurface(element)).toEqual(output)
      expect(performanceRenderDpr(element, 2)).toBe(1)
    }
    const unlocked = { ...element, closest: () => null } as unknown as HTMLElement
    expect(measurePerformanceSurface(unlocked)).toEqual({ width: 850, height: 478 })
    expect(performanceRenderDpr(unlocked, 2)).toBe(2)
  })
  it('rejects a mismatched canvas, and accepts rounded same-format quality changes', () => {
    const output = performanceOutputSize('9:16')
    const context = { drawImage: vi.fn() } as unknown as CanvasRenderingContext2D
    const source = { width: 1920, height: 1080 } as HTMLCanvasElement
    expect(copyPerformanceFrame(context, source, output)).toBe(false)
    expect(context.drawImage).not.toHaveBeenCalled()
    expect(matchesPerformanceAspect({ width: 0, height: 0 }, output)).toBe(false)
    const portrait = { width: 719, height: 1280 } as HTMLCanvasElement
    expect(copyPerformanceFrame(context, portrait, output)).toBe(true)
    expect(context.drawImage).toHaveBeenCalledWith(portrait, 0, 0, 1080, 1920)
  })
})
