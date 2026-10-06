// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveHeadlinerParameters } from './HeadlinerEffectCatalog'
import {
  createHeadlinerEffectProcessor,
  resolveHeadlinerWorkSize,
  type HeadlinerEffectRenderArgs,
} from './HeadlinerEffects'
import { HEADLINER_IDLE_TIMING, type HeadlinerEffectTiming } from './HeadlinerTiming'

interface Draw {
  canvas: HTMLCanvasElement
  operation: string
  alpha: number
  filter: string
}

let draws: Draw[] = []
let pixels = new Uint8ClampedArray(128 * 72 * 4)
const contexts = new WeakMap<HTMLCanvasElement, CanvasRenderingContext2D>()

function setSquare(x0: number) {
  pixels = new Uint8ClampedArray(128 * 72 * 4)
  for (let y = 20; y < 44; y += 1) {
    for (let x = x0; x < x0 + 24; x += 1) {
      const value = 40 + ((((x - x0) * 73856093) ^ ((y - 20) * 19349663)) >>> 0) % 200
      const index = (y * 128 + x) * 4
      pixels[index] = value
      pixels[index + 1] = value
      pixels[index + 2] = value
      pixels[index + 3] = 255
    }
  }
}

beforeEach(() => {
  draws = []
  pixels = new Uint8ClampedArray(128 * 72 * 4)
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function getContext(this: HTMLCanvasElement) {
    const existing = contexts.get(this)
    if (existing) return existing as never
    const context = {
      canvas: this,
      globalAlpha: 1,
      globalCompositeOperation: 'source-over',
      filter: 'none',
      fillStyle: '',
      imageSmoothingEnabled: true,
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      scale: vi.fn(),
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      putImageData: vi.fn(),
      createImageData: (width: number, height: number) => ({ width, height, data: new Uint8ClampedArray(width * height * 4) }),
      getImageData: (_x: number, _y: number, width: number, height: number) => ({ width, height, data: pixels.slice(0, width * height * 4) }),
      createLinearGradient: () => ({ addColorStop: vi.fn() }),
      drawImage: vi.fn(function drawImage(this: CanvasRenderingContext2D) {
        draws.push({ canvas: this.canvas, operation: this.globalCompositeOperation, alpha: this.globalAlpha, filter: this.filter })
      }),
    } as unknown as CanvasRenderingContext2D
    contexts.set(this, context)
    return context as never
  })
})

afterEach(() => vi.restoreAllMocks())

function makeOutput() {
  const canvas = document.createElement('canvas')
  canvas.width = 1280
  canvas.height = 720
  return { canvas, context: canvas.getContext('2d') as CanvasRenderingContext2D }
}

function renderArgs(
  output: ReturnType<typeof makeOutput>,
  overrides: Record<string, number | boolean | string>,
  presetId: Parameters<typeof resolveHeadlinerParameters>[0],
  timing: Partial<HeadlinerEffectTiming> = {},
): HeadlinerEffectRenderArgs {
  return {
    context: output.context,
    canvas: output.canvas,
    video: document.createElement('video'),
    sourceRect: { sx: 0, sy: 0, sw: 1280, sh: 720 },
    parameters: resolveHeadlinerParameters(presetId, overrides),
    timing: { ...HEADLINER_IDLE_TIMING, ...timing },
  }
}

const drawsOnto = (canvas: HTMLCanvasElement) => draws.filter(draw => draw.canvas === canvas)

describe('Headliner effect processors', () => {
  it('sizes work surfaces to at most 720 px wide, keeping the aspect ratio', () => {
    expect(resolveHeadlinerWorkSize(1920, 1080)).toEqual({ width: 720, height: 405 })
    expect(resolveHeadlinerWorkSize(400, 300)).toEqual({ width: 400, height: 300 })
  })

  it.each(['motion-echo', 'ghost-trails', 'velocity-smear'] as const)('%s at Master Intensity 0 is the clean camera', presetId => {
    const processor = createHeadlinerEffectProcessor(presetId)
    const output = makeOutput()
    setSquare(30)
    processor.render(renderArgs(output, { masterIntensity: 0 }, presetId))
    setSquare(36)
    processor.render(renderArgs(output, { masterIntensity: 0 }, presetId, { beat: 1, timeSec: 1 }))
    expect(drawsOnto(output.canvas)).toHaveLength(2)
    processor.dispose()
  })

  it('Motion Echo captures a clone on each beat division with BPM Sync on and layers them with the chosen blend', () => {
    const processor = createHeadlinerEffectProcessor('motion-echo')
    const output = makeOutput()
    const overrides = { echoCount: 3, echoSpacingBeats: '0.25', blendMode: 'screen' }
    for (let frame = 0; frame < 4; frame += 1) {
      draws = []
      processor.render(renderArgs(output, overrides, 'motion-echo', { beat: frame * 0.25, timeSec: frame * 0.1 }))
    }
    const onOutput = drawsOnto(output.canvas)
    expect(onOutput).toHaveLength(2)
    expect(onOutput[1]).toMatchObject({ operation: 'screen' })
    // Three clones were drawn into the echo layer on the last frame.
    const layerDraws = draws.filter(draw => draw.canvas !== output.canvas).filter(draw => draw.canvas.width === 720)
    expect(layerDraws.length).toBeGreaterThanOrEqual(3)
    processor.dispose()
  })

  it('Motion Echo follows the beat grid with BPM Sync on and the clock with it off', () => {
    const cloneCount = (overrides: Record<string, number | boolean | string>) => {
      const processor = createHeadlinerEffectProcessor('motion-echo')
      const output = makeOutput()
      for (let frame = 0; frame < 6; frame += 1) {
        draws = []
        // The beat never advances, but time does.
        processor.render(renderArgs(output, { echoCount: 6, ...overrides }, 'motion-echo', { beat: 2, timeSec: frame * 0.2 }))
      }
      const clones = draws.filter(draw => draw.canvas !== output.canvas && draw.canvas.width === 720).length
      processor.dispose()
      return clones
    }
    const onGrid = cloneCount({ bpmSync: true, echoSpacingBeats: '0.25' })
    const onClock = cloneCount({ bpmSync: false, echoDelayMs: 100 })
    expect(onGrid).toBeLessThan(onClock)
  })

  it('Ghost Trails ages its trail, deposits the moving picture and composites with the chosen blend', () => {
    const processor = createHeadlinerEffectProcessor('ghost-trails')
    const output = makeOutput()
    setSquare(30)
    processor.render(renderArgs(output, {}, 'ghost-trails', { timeSec: 0 }))
    draws = []
    setSquare(38)
    processor.render(renderArgs(output, {}, 'ghost-trails', { timeSec: 0.016 }))
    // Live frame, then the trail layer on top.
    const onOutput = drawsOnto(output.canvas)
    expect(onOutput).toHaveLength(2)
    expect(onOutput[1]).toMatchObject({ operation: 'screen' })
    // The existing trail was redrawn (aged) and the moving picture was deposited into it.
    expect(draws.filter(draw => draw.canvas !== output.canvas).length).toBeGreaterThanOrEqual(3)
    processor.dispose()
  })

  it('Velocity Smear stretches only moving cells, and does nothing while the picture is still', () => {
    const processor = createHeadlinerEffectProcessor('velocity-smear')
    const output = makeOutput()
    setSquare(30)
    processor.render(renderArgs(output, {}, 'velocity-smear', { timeSec: 0 }))
    draws = []
    processor.render(renderArgs(output, {}, 'velocity-smear', { timeSec: 0.016 }))
    expect(drawsOnto(output.canvas)).toHaveLength(1)

    draws = []
    setSquare(34)
    processor.render(renderArgs(output, {}, 'velocity-smear', { timeSec: 0.032 }))
    const composite = drawsOnto(output.canvas)
    expect(composite).toHaveLength(2)
    expect(composite[1].filter).toContain('blur')
    expect(draws.filter(draw => draw.canvas !== output.canvas).length).toBeGreaterThan(10)
    processor.dispose()
  })
})
