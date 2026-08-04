/** @vitest-environment jsdom */
import { describe, expect, it, vi } from 'vitest'
import { CANVAS_FRACTURES_EFFECT_MODIFIERS } from './CanvasFracturesEffects'
import { generateCanvasFracturesPlan } from './CanvasFracturesPlan'
import { CanvasFracturesRenderer } from './CanvasFracturesRenderer'
import type {
  CanvasFracturesPlan,
  CanvasFracturesPlanInput,
  CanvasFracturesRenderParams,
} from './CanvasFracturesTypes'

function makeContext() {
  const drawImage = vi.fn()
  const compositeOperations: GlobalCompositeOperation[] = []
  let compositeOperation: GlobalCompositeOperation = 'source-over'
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
    fill: vi.fn(),
    fillRect: vi.fn(),
    getImageData: vi.fn((_x: number, _y: number, width: number, height: number) => ({
      data: new Uint8ClampedArray(width * height * 4),
      width,
      height,
    } as ImageData)),
    putImageData: vi.fn(),
    imageSmoothingEnabled: false,
    imageSmoothingQuality: 'low',
    globalAlpha: 1,
    filter: 'none',
    fillStyle: '#000000',
    shadowColor: '#000000',
    shadowBlur: 0,
  } as unknown as CanvasRenderingContext2D
  Object.defineProperty(context, 'globalCompositeOperation', {
    configurable: true,
    get: () => compositeOperation,
    set: (value: GlobalCompositeOperation) => {
      compositeOperation = value
      compositeOperations.push(value)
    },
  })
  return { context, drawImage, compositeOperations }
}

function makeEffects(patch: Partial<CanvasFracturesRenderParams['effects']> = {}): CanvasFracturesRenderParams['effects'] {
  return {
    intensity: 0.8,
    glow: 0,
    glitch: 0,
    texture: 0,
    trails: 0,
    depth: 0,
    duplication: 0,
    colorTreatment: 0,
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
    flashTrigger: 0,
    reducedMotion: false,
    ...patch,
  }
}

function makePlan(
  anchorMode: CanvasFracturesPlanInput['anchorMode'] = 'fullyFragmented',
  patch: Partial<CanvasFracturesPlanInput> = {},
) {
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
    ...patch,
  })
}

function installCanvasContexts(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D) {
  canvas.getContext = vi.fn((kind: string) => kind === '2d' ? context : null) as typeof canvas.getContext
}

function installAuxiliaryCanvases() {
  const originalCreateElement = document.createElement.bind(document)
  const entries = Array.from({ length: 5 }, () => {
    const canvas = originalCreateElement('canvas')
    const contextState = makeContext()
    installCanvasContexts(canvas, contextState.context)
    return { canvas, ...contextState }
  })
  let canvasIndex = 0
  const createElement = vi.spyOn(document, 'createElement').mockImplementation(((tagName: string, options?: ElementCreationOptions) => {
    if (tagName.toLowerCase() === 'canvas' && canvasIndex < entries.length) {
      return entries[canvasIndex++].canvas
    }
    return originalCreateElement(tagName, options)
  }) as typeof document.createElement)
  return { entries, restore: () => createElement.mockRestore() }
}

function makeImage() {
  const image = document.createElement('img')
  Object.defineProperties(image, {
    complete: { value: true },
    naturalWidth: { value: 1920 },
    naturalHeight: { value: 1080 },
  })
  return image
}

function forceRole(
  plan: CanvasFracturesPlan,
  role: 'outline' | 'luma' | 'glitch',
  modifiers = 0,
  blendMode: 'normal' | 'difference' = 'normal',
): CanvasFracturesPlan {
  return {
    ...plan,
    id: `${plan.id}:${role}:${modifiers}:${blendMode}`,
    fragments: plan.fragments.map(fragment => ({
      ...fragment,
      effectRole: role,
      effectAssignment: {
        ...fragment.effectAssignment,
        role,
        modifiers,
        blendMode,
      },
    })),
  }
}

describe('Canvas Fractures Canvas2D renderer', () => {

  it('can force a fresh Canvas2D context after WebGL becomes unusable', () => {
    const canvas = document.createElement('canvas')
    const { context } = makeContext()
    const getContext = vi.fn((kind: string) => kind === '2d' ? context : null)
    canvas.getContext = getContext as typeof canvas.getContext
    const result = CanvasFracturesRenderer.create(canvas, { forceCanvas2D: true })
    expect(result.renderer?.backend).toBe('canvas2d')
    expect(result.renderer?.health).toBe('ready')
    expect(getContext.mock.calls.some((call: unknown[]) => call[0] === 'webgl2')).toBe(false)
  })
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
    const image = makeImage()

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

  it('uses reusable pixel readback for core outline and luma fallback effects', () => {
    const canvas = document.createElement('canvas')
    const { context, drawImage } = makeContext()
    installCanvasContexts(canvas, context)
    const auxiliary = installAuxiliaryCanvases()
    const effectContext = auxiliary.entries[1].context
    effectContext.getImageData = vi.fn((_x: number, _y: number, width: number, height: number) => {
      const pixels = new Uint8ClampedArray(width * height * 4)
      for (let index = 0; index < pixels.length; index += 4) {
        pixels[index] = index % 17 === 0 ? 255 : 32
        pixels[index + 1] = 96
        pixels[index + 2] = 192
        pixels[index + 3] = index % 29 === 0 ? 0 : 255
      }
      return { data: pixels, width, height } as ImageData
    })
    const result = CanvasFracturesRenderer.create(canvas)
    auxiliary.restore()
    if (!result.renderer) throw new Error(result.error)

    const image = makeImage()
    const base = makePlan('fullyFragmented')
    result.renderer.resize(640, 360, 1)
    result.renderer.setPlan(forceRole(base, 'outline'))
    expect(result.renderer.render({
      source: image,
      fitMode: 'contain',
      sourceTransform: { scale: 1, positionX: 0, positionY: 0, rotation: 0 },
      effects: makeEffects({ glow: 1 }),
    })).toBe(true)
    result.renderer.setPlan(forceRole(base, 'luma'))
    expect(result.renderer.render({
      source: image,
      fitMode: 'contain',
      sourceTransform: { scale: 1, positionX: 0, positionY: 0, rotation: 0 },
      effects: makeEffects(),
    })).toBe(true)
    expect(effectContext.getImageData).toHaveBeenCalled()
    expect(effectContext.putImageData).toHaveBeenCalled()
    expect(drawImage.mock.calls.some((call: unknown[]) => call[0] === auxiliary.entries[1].canvas)).toBe(true)
  })

  it('bounds Canvas2D trails and clears history on explicit, resize, and topology invalidation', () => {
    const canvas = document.createElement('canvas')
    const { context } = makeContext()
    installCanvasContexts(canvas, context)
    const auxiliary = installAuxiliaryCanvases()
    const result = CanvasFracturesRenderer.create(canvas)
    auxiliary.restore()
    if (!result.renderer) throw new Error(result.error)
    result.renderer.setPlan(makePlan())
    result.renderer.resize(1280, 720, 1)
    const source = makeImage()
    const trailParams: CanvasFracturesRenderParams = {
      source,
      fitMode: 'cover',
      sourceTransform: { scale: 1, positionX: 0, positionY: 0, rotation: 0 },
      framePositionSec: 10,
      effects: makeEffects({ intensity: 1, trails: 1, quality: 'low' }),
    }
    expect(result.renderer.render(trailParams)).toBe(true)

    const historyA = auxiliary.entries[3]
    const historyB = auxiliary.entries[4]
    const lowWidth = historyA.canvas.width
    expect(lowWidth).toBeLessThanOrEqual(640)
    expect(historyA.canvas.height).toBeLessThanOrEqual(360)
    let clearHistoryA = vi.fn()
    let clearHistoryB = vi.fn()
    historyA.context.clearRect = clearHistoryA
    historyB.context.clearRect = clearHistoryB

    expect(result.renderer.render({ ...trailParams, framePositionSec: 10.02 })).toBe(true)
    expect(clearHistoryA.mock.calls.length + clearHistoryB.mock.calls.length).toBe(1)
    clearHistoryA = vi.fn()
    clearHistoryB = vi.fn()
    historyA.context.clearRect = clearHistoryA
    historyB.context.clearRect = clearHistoryB
    expect(result.renderer.render({ ...trailParams, framePositionSec: 5 })).toBe(true)
    expect(clearHistoryA.mock.calls.length + clearHistoryB.mock.calls.length).toBe(3)

    expect(result.renderer.render({
      ...trailParams,
      framePositionSec: 5.02,
      effects: makeEffects({ intensity: 1, trails: 1, quality: 'high' }),
    })).toBe(true)
    expect(historyA.canvas.width).toBeGreaterThan(lowWidth)

    clearHistoryA = vi.fn()
    clearHistoryB = vi.fn()
    historyA.context.clearRect = clearHistoryA
    historyB.context.clearRect = clearHistoryB
    result.renderer.invalidateFeedback()
    expect(clearHistoryA).toHaveBeenCalledTimes(1)
    expect(clearHistoryB).toHaveBeenCalledTimes(1)

    result.renderer.resize(960, 540, 1)
    expect(clearHistoryA).toHaveBeenCalledTimes(2)
    expect(clearHistoryB).toHaveBeenCalledTimes(2)

    result.renderer.setPlan(makePlan('fullyFragmented', { topologyRevision: 1 }))
    expect(clearHistoryA).toHaveBeenCalledTimes(3)
    expect(clearHistoryB).toHaveBeenCalledTimes(3)
  })

  it('isolates Difference blend state per fragment and resets the context after rendering', () => {
    const canvas = document.createElement('canvas')
    const { context, compositeOperations } = makeContext()
    installCanvasContexts(canvas, context)
    const result = CanvasFracturesRenderer.create(canvas)
    if (!result.renderer) throw new Error(result.error)
    result.renderer.setPlan(forceRole(
      makePlan(),
      'glitch',
      CANVAS_FRACTURES_EFFECT_MODIFIERS.dissolve,
      'difference',
    ))
    result.renderer.resize(640, 360, 1)
    expect(result.renderer.render({
      source: makeImage(),
      fitMode: 'cover',
      sourceTransform: { scale: 1, positionX: 0, positionY: 0, rotation: 0 },
      effects: makeEffects({ intensity: 1, glitch: 1 }),
    })).toBe(true)
    expect(compositeOperations).toContain('difference')
    expect(compositeOperations[compositeOperations.length - 1]).toBe('source-over')
  })
})
