import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  PIX_GRID_DECK_GENERATED_MASK_NAMES,
  type PixGridDeckWorkerMessage,
  type PixGridDeckWorkerRequest,
  type PixGridPreparedFrame,
} from '../PixGridDeckCompilerContracts'
import {
  compilePixGridDeckBlob,
  compilePixGridDeckTransition,
  type PixGridDeckCompilerWorkerPort,
} from '../PixGridDeckCompilerExecutor'

class FakeWorker implements PixGridDeckCompilerWorkerPort {
  readonly posted: PixGridDeckWorkerRequest[] = []
  readonly transfers: Transferable[][] = []
  terminated = false
  private readonly messageListeners = new Set<(event: MessageEvent<PixGridDeckWorkerMessage>) => void>()
  private readonly errorListeners = new Set<(event: ErrorEvent) => void>()

  constructor(private readonly onPost?: (message: PixGridDeckWorkerRequest, worker: FakeWorker) => void) {}

  postMessage(message: PixGridDeckWorkerRequest, transfer: Transferable[] = []): void {
    this.posted.push(message)
    this.transfers.push(transfer)
    this.onPost?.(message, this)
  }

  addEventListener(type: 'message' | 'error', listener: ((event: MessageEvent<PixGridDeckWorkerMessage>) => void) | ((event: ErrorEvent) => void)): void {
    if (type === 'message') this.messageListeners.add(listener as (event: MessageEvent<PixGridDeckWorkerMessage>) => void)
    else this.errorListeners.add(listener as (event: ErrorEvent) => void)
  }

  removeEventListener(type: 'message' | 'error', listener: ((event: MessageEvent<PixGridDeckWorkerMessage>) => void) | ((event: ErrorEvent) => void)): void {
    if (type === 'message') this.messageListeners.delete(listener as (event: MessageEvent<PixGridDeckWorkerMessage>) => void)
    else this.errorListeners.delete(listener as (event: ErrorEvent) => void)
  }

  terminate(): void { this.terminated = true }

  emit(message: PixGridDeckWorkerMessage): void {
    for (const listener of this.messageListeners) listener({ data: message } as MessageEvent<PixGridDeckWorkerMessage>)
  }
}

function request() {
  return {
    jobId: 'job-1',
    cacheKey: 'cache-key',
    mediaId: 'media-1',
    sourceFingerprint: 'sha256:source',
    sourceRevision: 2,
    width: 2,
    height: 2,
    mimeType: 'image/png',
    hasAlpha: true,
    source: new Blob(['png'], { type: 'image/png' }),
    transparentBackground: '#123456',
  }
}

function resultMessage(): Extract<PixGridDeckWorkerMessage, { type: 'result' }> {
  const masks = Object.fromEntries(
    PIX_GRID_DECK_GENERATED_MASK_NAMES.map(name => [name, new ArrayBuffer(4)]),
  ) as Extract<PixGridDeckWorkerMessage, { type: 'result' }>['masks']
  return {
    type: 'result',
    jobId: 'job-1',
    cacheKey: 'cache-key',
    mediaId: 'media-1',
    sourceFingerprint: 'sha256:source',
    sourceRevision: 2,
    width: 2,
    height: 2,
    pixels: new ArrayBuffer(16),
    masks,
    metrics: {
      cellCount: 4,
      foregroundCellCount: 0,
      backgroundCellCount: 4,
      borderCellCount: 0,
      highlightCellCount: 0,
      shadowCellCount: 0,
      centerCellCount: 0,
      averageLuminance: 0,
      luminanceDeviation: 0,
      averageAlpha: 0,
      bounds: null,
    },
  }
}


function preparedFrame(id: string): PixGridPreparedFrame {
  const foreground = new Uint8Array([1, 0, 0, 1])
  const empty = () => new Uint8Array(4)
  return {
    schemaVersion: 1,
    cacheKey: `frame:${id}`,
    mediaId: `media:${id}`,
    sourceFingerprint: `sha256:${id}`,
    sourceRevision: 1,
    width: 2,
    height: 2,
    pixels: new Uint8Array([
      0, 217, 255, 255,
      0, 0, 0, 0,
      0, 0, 0, 0,
      0, 217, 130, 255,
    ]),
    masks: {
      foreground,
      border: foreground.slice(),
      highlights: empty(),
      shadows: empty(),
      center: empty(),
      background: new Uint8Array([0, 1, 1, 0]),
    },
    metrics: {
      cellCount: 4,
      foregroundCellCount: 2,
      backgroundCellCount: 2,
      borderCellCount: 2,
      highlightCellCount: 0,
      shadowCellCount: 0,
      centerCellCount: 0,
      averageLuminance: 0.5,
      luminanceDeviation: 0.25,
      averageAlpha: 0.5,
      bounds: { minX: 0, minY: 0, maxX: 1, maxY: 1 },
    },
    approximateBytes: 128,
  }
}

function transitionResultMessage(): Extract<PixGridDeckWorkerMessage, { type: 'transition-result' }> {
  return {
    type: 'transition-result',
    jobId: 'transition-job',
    cacheKey: 'transition-cache',
    requestedMode: 'pixelTransport',
    mode: 'pixelTransport',
    automaticReason: null,
    fallbackReason: null,
    sourceFrameCacheKey: 'frame:source',
    targetFrameCacheKey: 'frame:target',
    width: 2,
    height: 2,
    matchedSourceIndices: Uint32Array.from([0, 3]).buffer,
    matchedTargetIndices: Uint32Array.from([0, 3]).buffer,
    deathSourceIndices: new ArrayBuffer(0),
    birthTargetIndices: new ArrayBuffer(0),
    diagnostics: {
      sourceForegroundCount: 2,
      targetForegroundCount: 2,
      matchedCount: 2,
      birthCount: 0,
      deathCount: 0,
      sourceComponentCount: 2,
      targetComponentCount: 2,
      sourceColorEntropy: 0,
      targetColorEntropy: 0,
      candidateComparisons: 2,
      maxCandidatesPerSource: 64,
    },
  }
}

describe('PixGrid Deck compiler executor', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('publishes a serializable request and reconstructs transferable buffers', async () => {
    const progress = vi.fn()
    const worker = new FakeWorker((message, current) => {
      if (message.type !== 'compile') return
      queueMicrotask(() => {
        current.emit({ type: 'progress', jobId: 'job-1', phase: 'compiling', progress: 0.5 })
        current.emit(resultMessage())
      })
    })
    const prepared = await compilePixGridDeckBlob({ ...request(), onProgress: progress }, () => worker)
    expect(worker.posted[0]).toMatchObject({
      type: 'compile', sourceKind: 'blob', hasAlpha: true, transparentBackground: '#123456',
    })
    expect(progress).toHaveBeenCalledWith('compiling', 0.5)
    expect(prepared.pixels).toHaveLength(16)
    expect(prepared.masks.foreground).toHaveLength(4)
    expect(worker.terminated).toBe(true)
  })

  it('cancels and terminates a live worker without accepting a late result', async () => {
    const worker = new FakeWorker()
    const controller = new AbortController()
    const promise = compilePixGridDeckBlob({ ...request(), signal: controller.signal }, () => worker)
    controller.abort()
    await expect(promise).rejects.toMatchObject({ code: 'cancelled' })
    expect(worker.posted).toContainEqual({ type: 'cancel', jobId: 'job-1' })
    expect(worker.terminated).toBe(true)
  })

  it('publishes transferable transition inputs and reconstructs a worker plan', async () => {
    const source = preparedFrame('source')
    const target = preparedFrame('target')
    const sourceBefore = source.pixels.slice()
    const worker = new FakeWorker((message, current) => {
      if (message.type !== 'compile-transition') return
      queueMicrotask(() => {
        current.emit({ type: 'progress', jobId: 'transition-job', phase: 'compiling', progress: 0.6 })
        current.emit(transitionResultMessage())
      })
    })
    const progress = vi.fn()
    const plan = await compilePixGridDeckTransition({
      jobId: 'transition-job',
      cacheKey: 'transition-cache',
      source,
      target,
      settings: {
        requestedMode: 'pixelTransport',
        sourceItemId: 'item-source',
        targetItemId: 'item-target',
        durationFraction: 0.25,
      },
      onProgress: progress,
    }, () => worker)
    const posted = worker.posted[0]
    expect(posted).toMatchObject({
      type: 'compile-transition',
      sourceFrameCacheKey: 'frame:source',
      targetFrameCacheKey: 'frame:target',
      width: 2,
      height: 2,
    })
    expect(worker.transfers[0]).toHaveLength(4)
    expect(progress).toHaveBeenCalledWith(0.6)
    expect(plan.matchedSourceIndices).toEqual(Uint32Array.from([0, 3]))
    expect(plan.matchedTargetIndices).toEqual(Uint32Array.from([0, 3]))
    expect(source.pixels).toEqual(sourceBefore)
    expect(worker.terminated).toBe(true)
  })

  it('cancels a live transition worker and ignores late plans', async () => {
    const worker = new FakeWorker()
    const controller = new AbortController()
    const promise = compilePixGridDeckTransition({
      jobId: 'transition-job',
      cacheKey: 'transition-cache',
      source: preparedFrame('source'),
      target: preparedFrame('target'),
      settings: {
        requestedMode: 'auto',
        sourceItemId: 'item-source',
        targetItemId: 'item-target',
        durationFraction: 0.25,
      },
      signal: controller.signal,
    }, () => worker)
    controller.abort()
    worker.emit(transitionResultMessage())
    await expect(promise).rejects.toMatchObject({ code: 'cancelled' })
    expect(worker.posted).toContainEqual({ type: 'cancel', jobId: 'transition-job' })
    expect(worker.terminated).toBe(true)
  })

  it('rejects malformed transition mapping content from a worker', async () => {
    const worker = new FakeWorker((message, current) => {
      if (message.type !== 'compile-transition') return
      queueMicrotask(() => current.emit({
        ...transitionResultMessage(),
        deathSourceIndices: Uint32Array.from([0]).buffer,
        diagnostics: { ...transitionResultMessage().diagnostics, deathCount: 1, sourceForegroundCount: 3 },
      }))
    })
    await expect(compilePixGridDeckTransition({
      jobId: 'transition-job',
      cacheKey: 'transition-cache',
      source: preparedFrame('source'),
      target: preparedFrame('target'),
      settings: {
        requestedMode: 'pixelTransport',
        sourceItemId: 'item-source',
        targetItemId: 'item-target',
        durationFraction: 0.25,
      },
    }, () => worker)).rejects.toMatchObject({ code: 'invalid-result' })
  })

  it('cancels during bounded SVG rasterization before a worker is started', async () => {
    let markDecodeStarted!: () => void
    const decodeStarted = new Promise<void>(resolve => { markDecodeStarted = resolve })
    class DeferredImage {
      decoding = 'auto'
      src = ''
      naturalWidth = 2
      naturalHeight = 2
      decode(): Promise<void> {
        markDecodeStarted()
        return new Promise(() => {})
      }
    }
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('Image', DeferredImage)
    vi.stubGlobal('document', { createElement: vi.fn() })
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:deck-svg'), revokeObjectURL })
    const workerFactory = vi.fn()
    const controller = new AbortController()
    const promise = compilePixGridDeckBlob({
      ...request(),
      mimeType: 'image/svg+xml',
      source: new Blob(['<svg/>'], { type: 'image/svg+xml' }),
      signal: controller.signal,
    }, workerFactory)
    await decodeStarted
    controller.abort()

    await expect(promise).rejects.toMatchObject({ code: 'cancelled' })
    expect(workerFactory).not.toHaveBeenCalled()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:deck-svg')
  })

  it('rejects a mismatched worker result shape', async () => {
    const worker = new FakeWorker((message, current) => {
      if (message.type !== 'compile') return
      queueMicrotask(() => current.emit({ ...resultMessage(), width: 3 }))
    })
    await expect(compilePixGridDeckBlob(request(), () => worker)).rejects.toMatchObject({ code: 'invalid-result' })
  })
})
