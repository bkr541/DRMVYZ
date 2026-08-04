/** @vitest-environment jsdom */
import { describe, expect, it, vi } from 'vitest'
import { generateCanvasFracturesPlan } from './CanvasFracturesPlan'
import { CanvasFracturesRenderer } from './CanvasFracturesRenderer'
import type { CanvasFracturesPlanInput, CanvasFracturesRenderParams } from './CanvasFracturesTypes'

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
    fillRect: vi.fn(),
    imageSmoothingEnabled: false,
    imageSmoothingQuality: 'low',
    globalCompositeOperation: 'source-over',
    globalAlpha: 1,
    filter: 'none',
    fillStyle: '#000000',
    shadowColor: '#000000',
    shadowBlur: 0,
  } as unknown as CanvasRenderingContext2D
  return { context, drawImage }
}

function makeEffects(): CanvasFracturesRenderParams['effects'] {
  return {
    intensity: 0.8,
    outlineIntensity: 0.6,
    outlineThickness: 0.4,
    bloomIntensity: 0.5,
    rgbSplit: 0.4,
    lumaMode: 'highlights',
    lumaThreshold: 0.6,
    displacement: 0.4,
    pixelation: 0.3,
    scanlines: 0.2,
    noise: 0.2,
    quality: 'low',
    colorSourceMode: 'manualOverride',
    manualPrimaryColor: '#4AC7DB',
    manualSupportingColor: '#61D6AA',
  }
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
    placementMode: 'balanced',
    quality: 'low',
    anchorMode,
    effectRoleWeights: { clean: 1, glow: 0, outline: 0, glitch: 0, luma: 0, displacement: 0, texture: 0 },
  })
}

function installCanvasContexts(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D) {
  canvas.getContext = vi.fn((kind: string) => kind === '2d' ? context : null) as typeof canvas.getContext
}

describe('Canvas Fractures Canvas2D renderer', () => {
  it('reuses one decoded image source across every independent fragment draw', () => {
    const canvas = document.createElement('canvas')
    const { context, drawImage } = makeContext()
    installCanvasContexts(canvas, context)
    const result = CanvasFracturesRenderer.create(canvas)
    expect(result.renderer?.backend).toBe('canvas2d')
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
      effects: makeEffects(),
    })).toBe(true)
    expect(drawImage).toHaveBeenCalledTimes(plan.fragments.length)
    expect(drawImage.mock.calls.every((call: unknown[]) => call[0] === image)).toBe(true)
    expect(canvas.width).toBe(1920)
    expect(canvas.height).toBe(1080)
  })

  it('samples one synchronized current video element and does not regenerate its plan on resize', () => {
    const canvas = document.createElement('canvas')
    const { context, drawImage } = makeContext()
    installCanvasContexts(canvas, context)
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
      effects: makeEffects(),
    })).toBe(true)
    expect(drawImage.mock.calls.every((call: unknown[]) => call[0] === video)).toBe(true)
  })

  it('uses reusable pixel readback for content-derived outline and luma fallback effects', () => {
    const canvas = document.createElement('canvas')
    const scratchCanvas = document.createElement('canvas')
    const { context, drawImage } = makeContext()
    const scratchPixels = new Uint8ClampedArray(64 * 64 * 4)
    for (let index = 0; index < scratchPixels.length; index += 4) {
      scratchPixels[index] = index % 17 === 0 ? 255 : 32
      scratchPixels[index + 1] = 96
      scratchPixels[index + 2] = 192
      scratchPixels[index + 3] = index % 29 === 0 ? 0 : 255
    }
    const scratchContext = {
      ...makeContext().context,
      getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(scratchPixels) })),
      putImageData: vi.fn(),
    } as unknown as CanvasRenderingContext2D
    installCanvasContexts(canvas, context)
    scratchCanvas.getContext = vi.fn((kind: string) => kind === '2d' ? scratchContext : null) as typeof scratchCanvas.getContext
    const originalCreateElement = document.createElement.bind(document)
    const createElement = vi.spyOn(document, 'createElement').mockImplementation(((tagName: string, options?: ElementCreationOptions) => {
      if (tagName.toLowerCase() === 'canvas') return scratchCanvas
      return originalCreateElement(tagName, options)
    }) as typeof document.createElement)
    const result = CanvasFracturesRenderer.create(canvas)
    createElement.mockRestore()
    if (!result.renderer) throw new Error(result.error)

    const image = document.createElement('img')
    Object.defineProperties(image, {
      complete: { value: true },
      naturalWidth: { value: 640 },
      naturalHeight: { value: 360 },
    })
    const base = makePlan('fullyFragmented')
    const forceRole = (role: 'outline' | 'luma') => ({
      ...base,
      id: `${base.id}:${role}`,
      fragments: base.fragments.map(fragment => ({
        ...fragment,
        effectRole: role,
        effectAssignment: { ...fragment.effectAssignment, role },
      })),
    })
    result.renderer.resize(640, 360, 1)
    result.renderer.setPlan(forceRole('outline'))
    expect(result.renderer.render({
      source: image,
      fitMode: 'contain',
      sourceTransform: { scale: 1, positionX: 0, positionY: 0, rotation: 0 },
      effects: makeEffects(),
    })).toBe(true)
    result.renderer.setPlan(forceRole('luma'))
    expect(result.renderer.render({
      source: image,
      fitMode: 'contain',
      sourceTransform: { scale: 1, positionX: 0, positionY: 0, rotation: 0 },
      effects: makeEffects(),
    })).toBe(true)
    expect(scratchContext.getImageData).toHaveBeenCalled()
    expect(scratchContext.putImageData).toHaveBeenCalled()
    expect(drawImage.mock.calls.some((call: unknown[]) => call[0] === scratchCanvas)).toBe(true)
  })

})
