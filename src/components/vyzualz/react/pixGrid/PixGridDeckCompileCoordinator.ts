import {
  PIX_GRID_DECK_COMPILE_CONCURRENCY,
  PIX_GRID_DECK_COMPILER_SCHEMA_VERSION,
  type PixGridDeckCompileError,
  type PixGridDeckCompilePhase,
  type PixGridDeckCompileStatus,
  type PixGridDeckItemCompileStatus,
  type PixGridPreparedFrame,
  type PixGridPreparedFrameSet,
} from './PixGridDeckCompilerContracts'
import { createPixGridDeckItemCompilerCacheKey } from './PixGridDeckCompilerCore'
import {
  compilePixGridDeckBlob,
  type PixGridDeckBlobCompileRequest,
  type PixGridDeckCompilerWorkerFactory,
} from './PixGridDeckCompilerExecutor'
import { type PixGridDeckDefinition, type PixGridDeckItemDefinition } from './PixGridDeckDomain'
import {
  PixGridDeckPreparedFrameCache,
  pixGridDeckPreparedFrameCache,
} from './PixGridDeckPreparedFrameCache'

export type PixGridDeckCompileSourceResolver = (
  item: PixGridDeckItemDefinition,
  signal: AbortSignal,
) => Promise<Blob>

export type PixGridDeckCompileFunction = (
  request: PixGridDeckBlobCompileRequest,
  workerFactory?: PixGridDeckCompilerWorkerFactory,
) => Promise<PixGridPreparedFrame>

export interface PixGridDeckCompileCoordinatorOptions {
  concurrency?: number
  cache?: PixGridDeckPreparedFrameCache
  sourceResolver?: PixGridDeckCompileSourceResolver
  compile?: PixGridDeckCompileFunction
  workerFactory?: PixGridDeckCompilerWorkerFactory
}

export interface PixGridDeckCompilerDiagnostics {
  queuedJobCount: number
  runningJobCount: number
  deduplicatedJobCount: number
  trackedDeckCount: number
  cacheEntryCount: number
  cacheBytes: number
}

interface ConsumerExpectation {
  token: string
  deckId: string
  deckRevision: number
  item: PixGridDeckItemDefinition
  cacheKey: string
}

interface CompileJob {
  key: string
  id: string
  item: PixGridDeckItemDefinition
  controller: AbortController
  consumers: Map<string, ConsumerExpectation>
  phase: Extract<PixGridDeckCompilePhase, 'queued' | 'decoding' | 'compiling'>
  progress: number
  started: boolean
  width: number
  height: number
}

function compileError(
  code: PixGridDeckCompileError['code'],
  message: string,
  retryable = true,
): PixGridDeckCompileError {
  return { code, message, retryable }
}

const missingSourceResolver: PixGridDeckCompileSourceResolver = async () => {
  throw compileError('source-unavailable', 'No PixGrid Deck media source resolver is configured.', false)
}

function statusForDisabled(item: PixGridDeckItemDefinition): PixGridDeckItemCompileStatus {
  return {
    itemId: item.id,
    mediaId: item.mediaId,
    enabled: false,
    cacheKey: null,
    phase: 'cancelled',
    progress: 0,
    error: null,
  }
}

function normalizeError(error: unknown): PixGridDeckCompileError {
  if (error && typeof error === 'object' && 'code' in error && 'message' in error) {
    return {
      code: (error as { code: PixGridDeckCompileError['code'] }).code,
      message: String((error as { message: unknown }).message),
      retryable: 'retryable' in error ? Boolean((error as { retryable: unknown }).retryable) : true,
    }
  }
  return compileError('compile-failed', error instanceof Error ? error.message : 'PixGrid Deck compilation failed.')
}

function aggregateStatus(
  deck: PixGridDeckDefinition,
  width: number,
  height: number,
  items: readonly PixGridDeckItemCompileStatus[],
): PixGridDeckCompileStatus {
  const enabled = items.filter(item => item.enabled)
  const readyItemCount = enabled.filter(item => item.phase === 'ready').length
  const failedItemCount = enabled.filter(item => item.phase === 'failed').length
  const ready = enabled.length >= 2 && readyItemCount === enabled.length
  const progress = enabled.length > 0
    ? enabled.reduce((sum, item) => sum + item.progress, 0) / enabled.length
    : 0
  let phase: PixGridDeckCompilePhase = 'cancelled'
  if (failedItemCount > 0) phase = 'failed'
  else if (ready) phase = 'ready'
  else if (enabled.some(item => item.phase === 'compiling')) phase = 'compiling'
  else if (enabled.some(item => item.phase === 'decoding')) phase = 'decoding'
  else if (enabled.some(item => item.phase === 'queued')) phase = 'queued'
  return {
    deckId: deck.id,
    deckRevision: deck.revision,
    width,
    height,
    phase,
    progress: ready ? 1 : progress,
    ready,
    enabledItemCount: enabled.length,
    readyItemCount,
    failedItemCount,
    items,
  }
}

export class PixGridDeckCompileCoordinator {
  private readonly concurrency: number
  private readonly cache: PixGridDeckPreparedFrameCache
  private readonly sourceResolver: PixGridDeckCompileSourceResolver
  private readonly compile: PixGridDeckCompileFunction
  private readonly workerFactory?: PixGridDeckCompilerWorkerFactory
  private readonly jobs = new Map<string, CompileJob>()
  private readonly queue: CompileJob[] = []
  private readonly expectations = new Map<string, ConsumerExpectation>()
  private readonly statuses = new Map<string, PixGridDeckCompileStatus>()
  private readonly failures = new Map<string, PixGridDeckCompileError>()
  private readonly decks = new Map<string, PixGridDeckDefinition>()
  private readonly listeners = new Set<(statuses: ReadonlyMap<string, PixGridDeckCompileStatus>) => void>()
  private running = 0
  private sequence = 0
  private disposed = false
  private deduplicated = 0
  private width = 1
  private height = 1

  constructor(options: PixGridDeckCompileCoordinatorOptions = {}) {
    this.concurrency = Math.max(1, Math.floor(options.concurrency ?? PIX_GRID_DECK_COMPILE_CONCURRENCY))
    this.cache = options.cache ?? pixGridDeckPreparedFrameCache
    this.sourceResolver = options.sourceResolver ?? missingSourceResolver
    this.compile = options.compile ?? compilePixGridDeckBlob
    this.workerFactory = options.workerFactory
  }

  subscribe(listener: (statuses: ReadonlyMap<string, PixGridDeckCompileStatus>) => void): () => void {
    this.listeners.add(listener)
    listener(this.statuses)
    return () => this.listeners.delete(listener)
  }

  getStatus(deckId: string): PixGridDeckCompileStatus | null {
    return this.statuses.get(deckId) ?? null
  }

  getStatuses(): ReadonlyMap<string, PixGridDeckCompileStatus> {
    return this.statuses
  }

  getPreparedFrameSet(deckId: string): PixGridPreparedFrameSet | null {
    const deck = this.decks.get(deckId)
    const status = this.statuses.get(deckId)
    if (!deck || !status?.ready) return null
    const enabled = deck.items.filter(item => item.enabled).sort((a, b) => a.order - b.order)
    const frameCacheKeys = enabled.map(item => createPixGridDeckItemCompilerCacheKey(item, this.width, this.height))
    const frames = frameCacheKeys.map(key => this.cache.get(key))
    if (frames.some(frame => frame == null)) return null
    return {
      schemaVersion: PIX_GRID_DECK_COMPILER_SCHEMA_VERSION,
      deckId: deck.id,
      deckRevision: deck.revision,
      width: this.width,
      height: this.height,
      frameCacheKeys,
      frames: frames as PixGridPreparedFrame[],
    }
  }

  getDiagnostics(): PixGridDeckCompilerDiagnostics {
    return {
      queuedJobCount: this.queue.filter(job => !job.started && job.consumers.size > 0).length,
      runningJobCount: this.running,
      deduplicatedJobCount: this.deduplicated,
      trackedDeckCount: this.decks.size,
      cacheEntryCount: this.cache.size,
      cacheBytes: this.cache.approximateBytes,
    }
  }

  synchronize(decks: readonly PixGridDeckDefinition[], width: number, height: number): void {
    if (this.disposed) return
    this.width = Math.max(1, Math.floor(width))
    this.height = Math.max(1, Math.floor(height))
    this.decks.clear()
    for (const deck of decks) this.decks.set(deck.id, deck)

    const nextExpectations = new Map<string, ConsumerExpectation>()
    for (const deck of decks) {
      for (const item of deck.items) {
        if (!item.enabled) continue
        const cacheKey = createPixGridDeckItemCompilerCacheKey(item, this.width, this.height)
        const token = `${deck.id}\u0000${item.id}`
        nextExpectations.set(token, { token, deckId: deck.id, deckRevision: deck.revision, item, cacheKey })
      }
    }

    for (const [token, expectation] of this.expectations) {
      const next = nextExpectations.get(token)
      if (next && next.cacheKey === expectation.cacheKey) {
        this.jobs.get(expectation.cacheKey)?.consumers.set(token, next)
        continue
      }
      const job = this.jobs.get(expectation.cacheKey)
      job?.consumers.delete(token)
      if (job && job.consumers.size === 0) job.controller.abort()
    }
    this.expectations.clear()
    for (const [token, expectation] of nextExpectations) this.expectations.set(token, expectation)
    const expectedKeys = new Set([...nextExpectations.values()].map(expectation => expectation.cacheKey))
    for (const key of this.failures.keys()) if (!expectedKeys.has(key)) this.failures.delete(key)
    this.cache.retain(expectedKeys)

    for (const expectation of nextExpectations.values()) {
      if (this.cache.peek(expectation.cacheKey) || this.failures.has(expectation.cacheKey)) continue
      let job = this.jobs.get(expectation.cacheKey)
      if (job?.controller.signal.aborted) job = undefined
      if (!job) {
        job = {
          key: expectation.cacheKey,
          id: `pix-grid-deck-job-${++this.sequence}`,
          item: expectation.item,
          controller: new AbortController(),
          consumers: new Map(),
          phase: 'queued',
          progress: 0,
          started: false,
          width: this.width,
          height: this.height,
        }
        this.jobs.set(job.key, job)
        this.queue.push(job)
      } else if (!job.consumers.has(expectation.token)) {
        this.deduplicated += 1
      }
      job.consumers.set(expectation.token, expectation)
    }

    this.rebuildStatuses()
    this.pump()
  }

  notifyMediaSourcesChanged(): void {
    for (const [key, error] of this.failures) {
      if (error.retryable && (error.code === 'source-unavailable' || error.code === 'source-load-failed')) {
        this.failures.delete(key)
      }
    }
    this.synchronize([...this.decks.values()], this.width, this.height)
  }

  retryDeck(deckId: string): void {
    const deck = this.decks.get(deckId)
    if (!deck) return
    for (const item of deck.items) {
      if (!item.enabled) continue
      this.failures.delete(createPixGridDeckItemCompilerCacheKey(item, this.width, this.height))
    }
    this.synchronize([...this.decks.values()], this.width, this.height)
  }

  cancelDeck(deckId: string): void {
    for (const [token, expectation] of this.expectations) {
      if (expectation.deckId !== deckId) continue
      this.expectations.delete(token)
      const job = this.jobs.get(expectation.cacheKey)
      job?.consumers.delete(token)
      if (job && job.consumers.size === 0) job.controller.abort()
    }
    this.decks.delete(deckId)
    this.statuses.delete(deckId)
    const retainedKeys = new Set([...this.expectations.values()].map(expectation => expectation.cacheKey))
    for (const key of this.failures.keys()) if (!retainedKeys.has(key)) this.failures.delete(key)
    this.cache.retain(retainedKeys)
    this.emit()
  }

  dispose(): void {
    this.disposed = true
    for (const job of this.jobs.values()) job.controller.abort()
    this.jobs.clear()
    this.queue.length = 0
    this.expectations.clear()
    this.statuses.clear()
    this.failures.clear()
    this.decks.clear()
    this.cache.clear()
    this.listeners.clear()
  }

  private statusForExpectation(expectation: ConsumerExpectation): PixGridDeckItemCompileStatus {
    const cached = this.cache.peek(expectation.cacheKey)
    if (cached) {
      return {
        itemId: expectation.item.id,
        mediaId: expectation.item.mediaId,
        enabled: true,
        cacheKey: expectation.cacheKey,
        phase: 'ready',
        progress: 1,
        error: null,
      }
    }
    const failure = this.failures.get(expectation.cacheKey)
    if (failure) {
      return {
        itemId: expectation.item.id,
        mediaId: expectation.item.mediaId,
        enabled: true,
        cacheKey: expectation.cacheKey,
        phase: 'failed',
        progress: 0,
        error: failure,
      }
    }
    const job = this.jobs.get(expectation.cacheKey)
    return {
      itemId: expectation.item.id,
      mediaId: expectation.item.mediaId,
      enabled: true,
      cacheKey: expectation.cacheKey,
      phase: job?.phase ?? 'queued',
      progress: job?.progress ?? 0,
      error: null,
    }
  }

  private expectationsHasKey(key: string): boolean {
    for (const expectation of this.expectations.values()) if (expectation.cacheKey === key) return true
    return false
  }

  private rebuildStatuses(failure?: { key: string; error: PixGridDeckCompileError }): void {
    if (failure) this.failures.set(failure.key, failure.error)
    const retained = new Set<string>()
    for (const deck of this.decks.values()) {
      retained.add(deck.id)
      const items = [...deck.items]
        .sort((a, b) => a.order - b.order)
        .map(item => {
          if (!item.enabled) return statusForDisabled(item)
          const expectation = this.expectations.get(`${deck.id}\u0000${item.id}`)
          if (!expectation) return {
            itemId: item.id,
            mediaId: item.mediaId,
            enabled: true,
            cacheKey: null,
            phase: 'cancelled' as const,
            progress: 0,
            error: null,
          }
          return this.statusForExpectation(expectation)
        })
      this.statuses.set(deck.id, aggregateStatus(deck, this.width, this.height, items))
    }
    for (const deckId of this.statuses.keys()) if (!retained.has(deckId)) this.statuses.delete(deckId)
    this.emit()
  }

  private emit(): void {
    for (const listener of this.listeners) listener(this.statuses)
  }

  private pump(): void {
    if (this.disposed) return
    while (this.running < this.concurrency) {
      const job = this.queue.shift()
      if (!job) break
      if (job.started || job.consumers.size === 0 || job.controller.signal.aborted) {
        if (this.jobs.get(job.key) === job) this.jobs.delete(job.key)
        continue
      }
      job.started = true
      this.running += 1
      void this.run(job)
    }
  }

  private async run(job: CompileJob): Promise<void> {
    try {
      job.phase = 'decoding'
      job.progress = 0.02
      this.rebuildStatuses()
      const source = await this.sourceResolver(job.item, job.controller.signal)
      if (job.controller.signal.aborted || job.consumers.size === 0) return
      const frame = await this.compile({
        jobId: job.id,
        cacheKey: job.key,
        mediaId: job.item.mediaId,
        sourceFingerprint: job.item.source.fingerprint,
        sourceRevision: job.item.source.mediaRevision,
        width: job.width,
        height: job.height,
        mimeType: job.item.source.mimeType,
        hasAlpha: job.item.source.hasAlpha,
        source,
        transparentBackground: job.item.source.transparentBackground,
        signal: job.controller.signal,
        onProgress: (phase, progress) => {
          if (job.controller.signal.aborted) return
          job.phase = phase
          job.progress = progress
          this.rebuildStatuses()
        },
      }, this.workerFactory)
      if (job.controller.signal.aborted || job.consumers.size === 0) return
      if (job.key !== frame.cacheKey) throw compileError('invalid-result', 'A stale Deck compiler result was rejected.')
      this.failures.delete(job.key)
      const evicted = this.cache.set(frame)
      for (const key of evicted) {
        if (!this.expectationsHasKey(key)) continue
        this.failures.set(key, compileError(
          'compile-failed',
          'The bounded PixGrid Deck prepared-frame cache could not retain this active frame.',
          true,
        ))
      }
    } catch (error) {
      if (!job.controller.signal.aborted) this.rebuildStatuses({ key: job.key, error: normalizeError(error) })
    } finally {
      if (this.jobs.get(job.key) === job) this.jobs.delete(job.key)
      this.running = Math.max(0, this.running - 1)
      this.rebuildStatuses()
      this.pump()
    }
  }

}
