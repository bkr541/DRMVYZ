import { describe, expect, it } from 'vitest'
import {
  CanvasLayerEffectRuntime,
  canvasLayerHasTemporalEffects,
  resolveCanvasLayerEffectRenderPlan,
  type CanvasLayerEffectFrameContext,
} from './CanvasLayerEffectRendering'
import type { CanvasLayerEffectId } from './CanvasPerformanceTypes'

type DrawCall = { source: unknown; args: unknown[] }

class FakeContext {
  readonly drawCalls: DrawCall[] = []
  globalCompositeOperation: GlobalCompositeOperation = 'source-over'
  globalAlpha = 1
  filter = 'none'
  fillStyle: string | CanvasGradient | CanvasPattern = '#000'

  constructor(readonly canvas: FakeCanvas) {}

  setTransform(): void {}
  clearRect(): void {}
  save(): void {}
  restore(): void {}
  translate(): void {}
  scale(): void {}
  rotate(): void {}
  beginPath(): void {}
  rect(): void {}
  clip(): void {}
  fillRect(): void {}

  drawImage(source: unknown, ...args: unknown[]): void {
    this.drawCalls.push({ source, args })
  }
}

class FakeCanvas {
  width = 0
  height = 0
  readonly context = new FakeContext(this)

  constructor(readonly name: string) {}

  getContext(): CanvasRenderingContext2D {
    return this.context as unknown as CanvasRenderingContext2D
  }
}

function frame(patch: Partial<CanvasLayerEffectFrameContext> = {}): CanvasLayerEffectFrameContext {
  return {
    bass: 0.62,
    high: 0.34,
    beat: 0.8,
    transient: 0.55,
    bpm: 128,
    absoluteBeat: 12.25,
    audioTimeSec: 8,
    isPlaying: true,
    isPaused: false,
    ...patch,
  }
}

function render(
  runtime: CanvasLayerEffectRuntime,
  layerId: string,
  sourceIdentity: string,
  effects: readonly CanvasLayerEffectId[],
  source: FakeCanvas,
  scratchA: FakeCanvas,
  scratchB: FakeCanvas,
  context = frame(),
  mediaType: 'image' | 'video' | 'svg' = 'video',
): HTMLCanvasElement {
  return runtime.render({
    layerId,
    sourceIdentity,
    mediaType,
    effects,
    source: source as unknown as HTMLCanvasElement,
    scratchA: scratchA as unknown as HTMLCanvasElement,
    scratchB: scratchB as unknown as HTMLCanvasElement,
    width: 640,
    height: 360,
    context,
  })
}

describe('CANVAS per-layer effect rendering runtime', () => {
  it('resolves all five user effects in canonical stack order with deterministic decisions', () => {
    const effects: CanvasLayerEffectId[] = ['bloom', 'echo', 'glitch', 'melt', 'stutter']
    const first = resolveCanvasLayerEffectRenderPlan('layer-a', effects, frame())
    const second = resolveCanvasLayerEffectRenderPlan('layer-a', effects, frame())

    expect(first.map(step => step.id)).toEqual(effects)
    expect(second).toEqual(first)
    expect(first[4]?.stutterBucket).toBe(Math.floor(12.25 * 6))
    expect(canvasLayerHasTemporalEffects(effects)).toBe(true)
    expect(canvasLayerHasTemporalEffects(['bloom', 'glitch'])).toBe(false)
  })

  it('keeps Echo and Stutter temporal canvases bounded and independent per stable layer ID', () => {
    const created: FakeCanvas[] = []
    const runtime = new CanvasLayerEffectRuntime(() => {
      const canvas = new FakeCanvas(`temporal-${created.length}`)
      created.push(canvas)
      return canvas as unknown as HTMLCanvasElement
    })
    const scratchA = new FakeCanvas('scratch-a')
    const scratchB = new FakeCanvas('scratch-b')

    render(runtime, 'layer-a', 'source-a', ['echo', 'stutter'], new FakeCanvas('source-a'), scratchA, scratchB)
    render(runtime, 'layer-b', 'source-b', ['echo', 'stutter'], new FakeCanvas('source-b'), scratchA, scratchB)

    expect(runtime.size).toBe(2)
    expect(runtime.getTemporalAllocationCount('layer-a')).toBe(2)
    expect(runtime.getTemporalAllocationCount('layer-b')).toBe(2)
    expect(created).toHaveLength(4)
    expect(new Set(created).size).toBe(4)
  })

  it('invalidates temporal ownership on source replacement, effect removal, resize, and layer removal', () => {
    const created: FakeCanvas[] = []
    const runtime = new CanvasLayerEffectRuntime(() => {
      const canvas = new FakeCanvas(`temporal-${created.length}`)
      created.push(canvas)
      return canvas as unknown as HTMLCanvasElement
    })
    const scratchA = new FakeCanvas('scratch-a')
    const scratchB = new FakeCanvas('scratch-b')
    const source = new FakeCanvas('source')

    render(runtime, 'layer-a', 'source:v1', ['echo'], source, scratchA, scratchB)
    expect(runtime.getTemporalAllocationCount('layer-a')).toBe(1)
    expect(created).toHaveLength(1)

    render(runtime, 'layer-a', 'source:v2', ['echo'], source, scratchA, scratchB)
    expect(runtime.getTemporalAllocationCount('layer-a')).toBe(1)
    expect(created).toHaveLength(2)

    render(runtime, 'layer-a', 'source:v2', ['bloom'], source, scratchA, scratchB)
    expect(runtime.getTemporalAllocationCount('layer-a')).toBe(0)

    runtime.render({
      layerId: 'layer-a',
      sourceIdentity: 'source:v2',
      mediaType: 'video',
      effects: ['echo'],
      source: source as unknown as HTMLCanvasElement,
      scratchA: scratchA as unknown as HTMLCanvasElement,
      scratchB: scratchB as unknown as HTMLCanvasElement,
      width: 800,
      height: 450,
      context: frame(),
    })
    expect(runtime.getTemporalAllocationCount('layer-a')).toBe(1)
    expect(created).toHaveLength(3)

    runtime.reconcile([])
    expect(runtime.size).toBe(0)
  })

  it('holds only the owning video layer while a sibling stutter runtime advances independently', () => {
    const created: FakeCanvas[] = []
    const runtime = new CanvasLayerEffectRuntime(() => {
      const canvas = new FakeCanvas(`held-${created.length}`)
      created.push(canvas)
      return canvas as unknown as HTMLCanvasElement
    })
    const scratchA = new FakeCanvas('scratch-a')
    const scratchB = new FakeCanvas('scratch-b')
    const firstA = new FakeCanvas('layer-a-frame-1')
    const secondA = new FakeCanvas('layer-a-frame-2')
    const firstB = new FakeCanvas('layer-b-frame-1')

    render(runtime, 'layer-a', 'video-a', ['stutter'], firstA, scratchA, scratchB, frame({ absoluteBeat: 4.01 }))
    const heldA = created[0]
    const capturesAfterFirstA = heldA?.context.drawCalls.length ?? 0

    render(runtime, 'layer-a', 'video-a', ['stutter'], secondA, scratchA, scratchB, frame({ absoluteBeat: 4.04 }))
    expect(heldA?.context.drawCalls.length).toBe(capturesAfterFirstA)

    render(runtime, 'layer-b', 'video-b', ['stutter'], firstB, scratchA, scratchB, frame({ absoluteBeat: 4.04 }))
    const heldB = created[1]
    expect(heldB).not.toBe(heldA)
    expect(heldB?.context.drawCalls.some(call => call.source === firstB)).toBe(true)
    expect(heldA?.context.drawCalls.some(call => call.source === firstB)).toBe(false)
  })

  it('bounds temporal state to the four active authored layers under multi-effect load', () => {
    const created: FakeCanvas[] = []
    const runtime = new CanvasLayerEffectRuntime(() => {
      const canvas = new FakeCanvas(`temporal-${created.length}`)
      created.push(canvas)
      return canvas as unknown as HTMLCanvasElement
    })
    const scratchA = new FakeCanvas('scratch-a')
    const scratchB = new FakeCanvas('scratch-b')

    for (let index = 0; index < 4; index += 1) {
      render(
        runtime,
        `layer-${index}`,
        `source-${index}`,
        ['bloom', 'echo', 'glitch', 'melt', 'stutter'],
        new FakeCanvas(`source-${index}`),
        scratchA,
        scratchB,
      )
    }

    expect(runtime.size).toBe(4)
    expect(created).toHaveLength(8)
    for (let index = 0; index < 4; index += 1) {
      expect(runtime.getTemporalAllocationCount(`layer-${index}`)).toBe(2)
    }
  })

  it('keeps a dry layer pristine and allocates no temporal runtime state', () => {
    const runtime = new CanvasLayerEffectRuntime(() => new FakeCanvas('unexpected') as unknown as HTMLCanvasElement)
    const source = new FakeCanvas('dry-source')
    const result = render(runtime, 'dry-layer', 'dry-source', [], source, new FakeCanvas('a'), new FakeCanvas('b'), frame(), 'image')

    expect(result).toBe(source)
    expect(runtime.size).toBe(0)
  })

  it('runs five stacked passes without allocating a per-effect full-resolution canvas', () => {
    const created: FakeCanvas[] = []
    const runtime = new CanvasLayerEffectRuntime(() => {
      const canvas = new FakeCanvas(`temporal-${created.length}`)
      created.push(canvas)
      return canvas as unknown as HTMLCanvasElement
    })
    const source = new FakeCanvas('source')
    const scratchA = new FakeCanvas('scratch-a')
    const scratchB = new FakeCanvas('scratch-b')

    const result = render(
      runtime,
      'layer-all',
      'source-all',
      ['bloom', 'echo', 'glitch', 'melt', 'stutter'],
      source,
      scratchA,
      scratchB,
    )

    expect([scratchA, scratchB]).toContain(result as unknown as FakeCanvas)
    expect(created).toHaveLength(2)
    expect(runtime.getTemporalAllocationCount('layer-all')).toBe(2)
  })
})
