import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CanvasMediaItem } from '../ReactTypes'
import {
  clearCanvasMediaTransparencyCacheForTests,
  hasTransparentCanvasPixels,
  prepareCanvasCaptureBackground,
  resolveCanvasBackgroundModeWithoutInspection,
  resolveCanvasMediaBackgroundMode,
} from '../canvasMediaTransparency'

function makeItem(patch: Partial<CanvasMediaItem> = {}): CanvasMediaItem {
  return {
    id: 'canvas-media',
    name: 'Canvas media',
    type: 'image',
    objectUrl: 'blob:canvas-media',
    createdAt: '2026-07-10T00:00:00.000Z',
    ...patch,
  }
}

describe('CANVAS media transparency', () => {
  beforeEach(() => clearCanvasMediaTransparencyCacheForTests())

  it('keeps video on the stage and requires decoded-pixel inspection for still media', () => {
    expect(resolveCanvasBackgroundModeWithoutInspection(makeItem({ type: 'video' }))).toBe('stage')
    expect(resolveCanvasBackgroundModeWithoutInspection(makeItem({ type: 'svg' }))).toBeNull()
    expect(resolveCanvasBackgroundModeWithoutInspection(makeItem({ type: 'image' }))).toBeNull()
  })

  it('detects transparent pixels without relying on a file extension', () => {
    expect(hasTransparentCanvasPixels(new Uint8ClampedArray([
      10, 20, 30, 255,
      40, 50, 60, 192,
    ]))).toBe(true)
    expect(hasTransparentCanvasPixels(new Uint8ClampedArray([
      10, 20, 30, 255,
      40, 50, 60, 255,
    ]))).toBe(false)
  })

  it('samples unknown still media once and caches the result by media revision', async () => {
    const detector = vi.fn(() => true)
    const image = {} as HTMLImageElement
    const item = makeItem({ type: 'svg' })

    await expect(resolveCanvasMediaBackgroundMode(item, image, detector)).resolves.toBe('transparent')
    await expect(resolveCanvasMediaBackgroundMode(item, image, vi.fn(() => false))).resolves.toBe('transparent')
    expect(detector).toHaveBeenCalledOnce()

    const updatedItem = makeItem({ type: 'svg', objectUrl: 'blob:canvas-media-v2' })
    const updatedDetector = vi.fn(() => false)
    await expect(resolveCanvasMediaBackgroundMode(updatedItem, image, updatedDetector)).resolves.toBe('stage')
    expect(updatedDetector).toHaveBeenCalledOnce()
  })

  it('fails closed to the normal stage when alpha inspection is unavailable', async () => {
    await expect(resolveCanvasMediaBackgroundMode(
      makeItem({ type: 'svg' }),
      {} as HTMLImageElement,
      () => null,
    )).resolves.toBe('stage')
  })

  it('clears alpha without painting the dark stage in transparent mode', () => {
    const context = {
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      fillStyle: '',
    }

    prepareCanvasCaptureBackground(context, 1280, 720, 'transparent')
    expect(context.clearRect).toHaveBeenCalledWith(0, 0, 1280, 720)
    expect(context.fillRect).not.toHaveBeenCalled()

    prepareCanvasCaptureBackground(context, 1280, 720, 'stage')
    expect(context.fillStyle).toBe('#02070a')
    expect(context.fillRect).toHaveBeenCalledWith(0, 0, 1280, 720)
  })
})
