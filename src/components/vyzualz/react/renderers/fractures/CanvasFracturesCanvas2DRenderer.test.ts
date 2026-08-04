/** @vitest-environment jsdom */
import { describe, expect, it, vi } from 'vitest'
import { generateCanvasFracturesPlan } from './CanvasFracturesPlan'
import { CanvasFracturesRenderer } from './CanvasFracturesRenderer'
import type { CanvasFracturesPlanInput } from './CanvasFracturesTypes'

function makeContext() {
  const drawImage = vi.fn()
  const context = {
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
    drawImage,
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    clip: vi.fn(),
    imageSmoothingEnabled: false,
    imageSmoothingQuality: 'low',
    globalCompositeOperation: 'source-over',
    globalAlpha: 1,
    filter: 'none',
  } as unknown as CanvasRenderingContext2D
  return { context, drawImage }
}

function makePlan(anchorMode: CanvasFracturesPlanInput['anchorMode'] = 'fullyFragmented') {
  return generateCanvasFracturesPlan({
    presetId: 'canvas-fractures',
    sourceIdentity: 'renderer-source',
    mediaType: 'image',
    mediaRevision: 1,
    trackIdentity: 'track:test',
    transportPositionSec: 0,
    variationSeed: 22,
    topologyRevision: 0,
    layoutRevision: 0,
    mode: 'mixed',
    intensity: 0,
    focusProtection: 0.7,
    focusX: 0.5,
    focusY: 0.5,
    composition: 0.4,
    placementMode: 'editorialGrid',
    quality: 'low',
    anchorMode,
  })
}

describe('Canvas Fractures Canvas2D renderer', () => {
  it('reuses one decoded image source across every independent fragment draw', () => {
    const canvas = document.createElement('canvas')
    const { context, drawImage } = makeContext()
    canvas.getContext = vi.fn(() => context) as typeof canvas.getContext
    const result = CanvasFracturesRenderer.create(canvas)
    expect(result.renderer).not.toBeNull()
    if (!result.renderer) return

    const plan = makePlan('fullyFragmented')
    result.renderer.setPlan(plan)
    result.renderer.resize(960, 540, 2)
    const image = document.createElement('img')
    Object.defineProperties(image, {
      complete: { value: true },
      naturalWidth: { value: 1920 },
      naturalHeight: { value: 1080 },
    })

    expect(result.renderer.render({
      source: image,
      fitMode: 'contain',
      sourceTransform: { scale: 1, positionX: 0, positionY: 0, rotation: 0 },
    })).toBe(true)
    expect(drawImage).toHaveBeenCalledTimes(plan.fragments.length)
    expect(drawImage.mock.calls.every((call: unknown[]) => call[0] === image)).toBe(true)
    expect(canvas.width).toBe(1920)
    expect(canvas.height).toBe(1080)
  })

  it('samples one synchronized current video element and does not regenerate its plan on resize', () => {
    const canvas = document.createElement('canvas')
    const { context, drawImage } = makeContext()
    canvas.getContext = vi.fn(() => context) as typeof canvas.getContext
    const result = CanvasFracturesRenderer.create(canvas)
    if (!result.renderer) throw new Error(result.error)

    const plan = makePlan('reactive')
    result.renderer.setPlan(plan)
    const identityBeforeResize = result.renderer.planIdentity
    result.renderer.resize(640, 360, 1)
    result.renderer.resize(1280, 720, 2)
    expect(result.renderer.planIdentity).toBe(identityBeforeResize)

    const video = document.createElement('video')
    Object.defineProperties(video, {
      readyState: { value: HTMLMediaElement.HAVE_CURRENT_DATA },
      videoWidth: { value: 1280 },
      videoHeight: { value: 720 },
      currentTime: { value: 14.25 },
    })
    expect(result.renderer.render({
      source: video,
      fitMode: 'cover',
      sourceTransform: { scale: 1, positionX: 0, positionY: 0, rotation: 0 },
    })).toBe(true)
    expect(drawImage.mock.calls.every((call: unknown[]) => call[0] === video)).toBe(true)
  })
})
