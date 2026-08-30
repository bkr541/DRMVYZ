import { describe, expect, it } from 'vitest'
import {
  CanvasLayerEffectRuntime,
  canvasLayerHasTemporalEffects,
  resolveCanvasLayerEffectRenderPlan,
  type CanvasLayerEffectFrameContext,
} from './CanvasLayerEffectRendering'
import type { CanvasLayerEffectId } from './CanvasPerformanceTypes'

type DrawCall = {
  source: unknown
  args: unknown[]
  alpha: number
  composite: GlobalCompositeOperation
  filter: string
}

type ContextState = Pick<DrawCall, 'alpha' | 'composite' | 'filter'>

class FakeContext {
  readonly drawCalls: DrawCall[] = []
  globalCompositeOperation: GlobalCompositeOperation = 'source-over'
  globalAlpha = 1
  filter = 'none'
  fillStyle: string | CanvasGradient | CanvasPattern = '#000'
  private readonly states: ContextState[] = []

  constructor(readonly canvas: FakeCanvas) {}

  setTransform(): void {}
  clearRect(): void {}
  save(): void {
    this.states.push({ alpha: this.globalAlpha, composite: this.globalCompositeOperation, filter: this.filter })
  }
  restore(): void {
    const state = this.states.pop()
    if (!state) return
    this.globalAlpha = state.alpha
    this.globalCompositeOperation = state.composite
    this.filter = state.filter
  }
  translate(): void {}
  scale(): void {}
  rotate(): void {}
  beginPath(): void {}
  rect(): void {}
  clip(): void {}
  fillRect(): void {}

  drawImage(source: unknown, ...args: unknown[]): void {
    this.drawCalls.push({
      source,
      args,
      alpha: this.globalAlpha,
      composite: this.globalCompositeOperation,
      filter: this.filter,
    })
  }

  getImageData(_x: number, _y: number, width: number, height: number): ImageData {
    const expected = width * height * 4
    const data = this.canvas.pixelData?.length === expected
      ? this.canvas.pixelData
      : new Uint8ClampedArray(expected)
    return { data, width, height, colorSpace: 'srgb' } as ImageData
  }
}

class FakeCanvas {
  width = 0
  height = 0
  readonly context = new FakeContext(this)

  constructor(readonly name: string, readonly pixelData: Uint8ClampedArray | null = null) {}

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
    expect(first[4]?.amount).toBeGreaterThan(0)
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
    expect(runtime.has('layer-a')).toBe(false)
    expect(runtime.getTemporalAllocationCount('layer-a')).toBe(0)
  })

  it('keeps near-zero Stutter close to live playback and strengthens deterministic holds at high amount', () => {
    const created: FakeCanvas[] = []
    const runtime = new CanvasLayerEffectRuntime(() => {
      const canvas = new FakeCanvas(`held-${created.length}`)
      created.push(canvas)
      return canvas as unknown as HTMLCanvasElement
    })
    const scratchA = new FakeCanvas('scratch-a')
    const scratchB = new FakeCanvas('scratch-b')
    const quietFrameOne = new FakeCanvas('quiet-frame-1')
    const quietFrameTwo = new FakeCanvas('quiet-frame-2')

    render(runtime, 'layer-quiet', 'video-quiet', ['stutter'], quietFrameOne, scratchA, scratchB, frame({
      bass: 0, beat: 0, transient: 0, absoluteBeat: 4.04,
    }))
    render(runtime, 'layer-quiet', 'video-quiet', ['stutter'], quietFrameTwo, scratchA, scratchB, frame({
      bass: 0, beat: 0, transient: 0, absoluteBeat: 4.05,
    }))

    expect(runtime.getTemporalAllocationCount('layer-quiet')).toBe(0)
    expect(scratchA.context.drawCalls.some(call => call.source === quietFrameTwo)).toBe(true)

    const strongFrameOne = new FakeCanvas('strong-frame-1')
    const strongFrameTwo = new FakeCanvas('strong-frame-2')
    const strongContext = { bass: 1, beat: 1, transient: 1, absoluteBeat: 4.04 }
    render(runtime, 'layer-strong', 'video-strong', ['stutter'], strongFrameOne, scratchA, scratchB, frame(strongContext))
    const held = created[0]
    const captures = held?.context.drawCalls.length ?? 0
    render(runtime, 'layer-strong', 'video-strong', ['stutter'], strongFrameTwo, scratchA, scratchB, frame({
      ...strongContext,
      absoluteBeat: 4.05,
    }))

    expect(runtime.getTemporalAllocationCount('layer-strong')).toBe(1)
    expect(held?.context.drawCalls.length).toBe(captures)
    expect(held?.context.drawCalls.some(call => call.source === strongFrameTwo)).toBe(false)
  })

  it('holds only the owning Stutter layer while a dry sibling keeps advancing independently', () => {
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
    const sibling = new FakeCanvas('layer-b-live-frame')
    const strong = { bass: 1, beat: 1, transient: 1 }

    render(runtime, 'layer-a', 'video-a', ['stutter'], firstA, scratchA, scratchB, frame({ ...strong, absoluteBeat: 4.04 }))
    const heldA = created[0]
    const capturesAfterFirstA = heldA?.context.drawCalls.length ?? 0
    render(runtime, 'layer-a', 'video-a', ['stutter'], secondA, scratchA, scratchB, frame({ ...strong, absoluteBeat: 4.05 }))
    expect(heldA?.context.drawCalls.length).toBe(capturesAfterFirstA)

    const siblingResult = render(runtime, 'layer-b', 'video-b', [], sibling, scratchA, scratchB, frame({ ...strong, absoluteBeat: 4.05 }))
    expect(siblingResult).toBe(sibling)
    expect(runtime.has('layer-b')).toBe(false)
    expect(heldA?.context.drawCalls.some(call => call.source === sibling)).toBe(false)
  })

  it('makes Melt displacement luminance-sensitive while leaving transparent and dry sibling regions untouched', () => {
    const samplePixels = new Uint8ClampedArray(16 * 6 * 4)
    for (let row = 0; row < 6; row += 1) {
      for (let column = 0; column < 16; column += 1) {
        const offset = (row * 16 + column) * 4
        const value = column < 8 ? 128 : 255
        samplePixels[offset] = value
        samplePixels[offset + 1] = value
        samplePixels[offset + 2] = value
        samplePixels[offset + 3] = row === 0 && column === 0 ? 0 : 255
      }
    }

    const created: FakeCanvas[] = []
    const runtime = new CanvasLayerEffectRuntime(() => {
      const canvas = new FakeCanvas(`runtime-${created.length}`, samplePixels)
      created.push(canvas)
      return canvas as unknown as HTMLCanvasElement
    })
    const source = new FakeCanvas('melt-source')
    const scratchA = new FakeCanvas('melt-a')
    const scratchB = new FakeCanvas('melt-b')
    const sibling = new FakeCanvas('dry-sibling')

    render(runtime, 'melt-layer', 'melt-source', ['melt'], source, scratchA, scratchB, frame({ audioTimeSec: 0 }))
    const smears = scratchA.context.drawCalls.filter(call => call.source === source && call.args.length === 8)
    const medium = smears.filter(call => Number(call.args[0]) < 320 && Number(call.args[1]) < 300)
    const bright = smears.filter(call => Number(call.args[0]) >= 320 && Number(call.args[1]) < 300)
    const extension = (call: DrawCall) => Number(call.args[7]) - Number(call.args[3])

    expect(created).toHaveLength(1)
    expect(medium.length).toBeGreaterThan(0)
    expect(bright.length).toBeGreaterThan(0)
    expect(Math.min(...bright.map(extension))).toBeGreaterThan(Math.max(...medium.map(extension)))
    expect(smears.some(call => Number(call.args[0]) === 0 && Number(call.args[1]) === 0)).toBe(false)

    render(runtime, 'melt-layer', 'melt-source', [], source, scratchA, scratchB)
    expect(created[0]).toMatchObject({ width: 0, height: 0 })

    const siblingResult = render(runtime, 'dry-layer', 'dry-source', [], sibling, scratchA, scratchB)
    expect(siblingResult).toBe(sibling)
    expect(runtime.has('dry-layer')).toBe(false)
  })

  it('keeps Bloom and Echo processing isolated from sibling layer outputs and history', () => {
    const created: FakeCanvas[] = []
    const runtime = new CanvasLayerEffectRuntime(() => {
      const canvas = new FakeCanvas(`history-${created.length}`)
      created.push(canvas)
      return canvas as unknown as HTMLCanvasElement
    })
    const bloomSource = new FakeCanvas('bloom-source')
    const drySource = new FakeCanvas('dry-source')
    const bloomA = new FakeCanvas('bloom-a')
    const bloomB = new FakeCanvas('bloom-b')

    render(runtime, 'bloom-layer', 'bloom-source', ['bloom'], bloomSource, bloomA, bloomB)
    expect(render(runtime, 'dry-bloom-sibling', 'dry-source', [], drySource, bloomA, bloomB)).toBe(drySource)
    expect(bloomA.context.drawCalls.some(call => call.source === drySource)).toBe(false)

    const echoSourceA = new FakeCanvas('echo-source-a')
    const echoSourceB = new FakeCanvas('echo-source-b')
    const echoA1 = new FakeCanvas('echo-a1')
    const echoA2 = new FakeCanvas('echo-a2')
    const echoB1 = new FakeCanvas('echo-b1')
    const echoB2 = new FakeCanvas('echo-b2')
    render(runtime, 'echo-layer-a', 'echo-source-a', ['echo'], echoSourceA, echoA1, echoA2)
    render(runtime, 'echo-layer-b', 'echo-source-b', ['echo'], echoSourceB, echoB1, echoB2)

    const historyA = created[0]
    const historyB = created[1]
    expect(historyA).not.toBe(historyB)
    expect(historyA?.context.drawCalls.some(call => call.source === echoA1)).toBe(true)
    expect(historyA?.context.drawCalls.some(call => call.source === echoB1)).toBe(false)
    expect(historyB?.context.drawCalls.some(call => call.source === echoB1)).toBe(true)
  })

  it('clears obsolete runtime resources on effect removal/order changes and never transfers them after layer compaction', () => {
    const created: FakeCanvas[] = []
    const runtime = new CanvasLayerEffectRuntime(() => {
      const canvas = new FakeCanvas(`resource-${created.length}`)
      created.push(canvas)
      return canvas as unknown as HTMLCanvasElement
    })
    const scratchA = new FakeCanvas('scratch-a')
    const scratchB = new FakeCanvas('scratch-b')

    render(runtime, 'layer-a', 'source-a', ['echo', 'stutter'], new FakeCanvas('source-a'), scratchA, scratchB, frame({ bass: 1, beat: 1, transient: 1, absoluteBeat: 4.04 }))
    render(runtime, 'layer-b', 'source-b', ['stutter'], new FakeCanvas('source-b'), scratchA, scratchB, frame({ bass: 1, beat: 1, transient: 1, absoluteBeat: 4.04 }))
    expect(runtime.getTemporalAllocationCount('layer-a')).toBe(2)
    expect(runtime.getTemporalAllocationCount('layer-b')).toBe(1)
    const createdBeforeCompaction = created.length
    const removedLayerCanvases = created.slice(0, 2)

    runtime.reconcile([{ id: 'layer-b', sourceIdentity: 'source-b', effects: ['stutter'] }])
    expect(removedLayerCanvases).toEqual([
      expect.objectContaining({ width: 0, height: 0 }),
      expect.objectContaining({ width: 0, height: 0 }),
    ])
    expect(runtime.has('layer-a')).toBe(false)
    expect(runtime.has('layer-b')).toBe(true)
    render(runtime, 'layer-b', 'source-b', ['stutter'], new FakeCanvas('source-b-next'), scratchA, scratchB, frame({ bass: 1, beat: 1, transient: 1, absoluteBeat: 4.05 }))
    expect(created).toHaveLength(createdBeforeCompaction)

    const retainedStutter = created[2]
    render(runtime, 'layer-b', 'source-b', ['bloom'], new FakeCanvas('source-b-clean'), scratchA, scratchB)
    expect(retainedStutter).toMatchObject({ width: 0, height: 0 })
    expect(runtime.getTemporalAllocationCount('layer-b')).toBe(0)

    render(runtime, 'layer-c', 'source-c', ['echo', 'stutter'], new FakeCanvas('source-c'), scratchA, scratchB, frame({ bass: 1, beat: 1, transient: 1, absoluteBeat: 4.04 }))
    const beforeReorder = created.length
    render(runtime, 'layer-c', 'source-c', ['stutter', 'echo'], new FakeCanvas('source-c-next'), scratchA, scratchB, frame({ bass: 1, beat: 1, transient: 1, absoluteBeat: 4.04 }))
    expect(created.length).toBe(beforeReorder + 2)
    expect(runtime.getTemporalAllocationCount('layer-c')).toBe(2)
  })

  it('keeps multiple effects on one layer from processing an unaffected sibling', () => {
    const created: FakeCanvas[] = []
    const runtime = new CanvasLayerEffectRuntime(() => {
      const canvas = new FakeCanvas(`runtime-${created.length}`)
      created.push(canvas)
      return canvas as unknown as HTMLCanvasElement
    })
    const effected = new FakeCanvas('effected')
    const sibling = new FakeCanvas('sibling')
    const scratchA = new FakeCanvas('scratch-a')
    const scratchB = new FakeCanvas('scratch-b')

    render(runtime, 'effected-layer', 'effected-source', ['bloom', 'echo', 'glitch', 'melt', 'stutter'], effected, scratchA, scratchB, frame({ bass: 1, beat: 1, transient: 1, absoluteBeat: 4.04 }))
    const siblingResult = render(runtime, 'sibling-layer', 'sibling-source', [], sibling, scratchA, scratchB)

    expect(siblingResult).toBe(sibling)
    expect(runtime.has('sibling-layer')).toBe(false)
    expect(created).toHaveLength(3)
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
    expect(created).toHaveLength(12)
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
    expect(created).toHaveLength(3)
    expect(created.map(canvas => [canvas.width, canvas.height])).toEqual([
      [640, 360],
      [16, 6],
      [640, 360],
    ])
    expect(runtime.getTemporalAllocationCount('layer-all')).toBe(2)
  })
})
