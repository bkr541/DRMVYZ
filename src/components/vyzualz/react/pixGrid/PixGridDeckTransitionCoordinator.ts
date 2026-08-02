import {
  type PixGridDeckCompileError,
  type PixGridDeckTransitionPlan,
  type PixGridPreparedFrame,
  type PixGridPreparedFrameSet,
} from './PixGridDeckCompilerContracts'
import {
  type PixGridDeckDefinition,
  type PixGridDeckItemDefinition,
  resolvePixGridDeckTransitionPairPolicy,
} from './PixGridDeckDomain'
import {
  compilePixGridDeckTransition,
  type PixGridDeckCompilerWorkerFactory,
  type PixGridDeckTransitionCompileRequest,
} from './PixGridDeckCompilerExecutor'
import {
  createPixGridDeckTransitionCacheKey,
} from './PixGridDeckTransitionPlanner'
import {
  PixGridDeckTransitionPlanCache,
  pixGridDeckTransitionPlanCache,
} from './PixGridDeckTransitionPlanCache'

export type PixGridDeckTransitionCompileFunction = (
  request: PixGridDeckTransitionCompileRequest,
  workerFactory?: PixGridDeckCompilerWorkerFactory,
) => Promise<PixGridDeckTransitionPlan>

export interface PixGridDeckTransitionCoordinatorOptions {
  concurrency?: number
  cache?: PixGridDeckTransitionPlanCache
  compile?: PixGridDeckTransitionCompileFunction
  workerFactory?: PixGridDeckCompilerWorkerFactory
}

export interface PixGridDeckTransitionPairStatus {
  sourceItemId: string
  targetItemId: string
  cacheKey: string
  phase: 'queued' | 'compiling' | 'ready' | 'failed' | 'cancelled'
  progress: number
  error: PixGridDeckCompileError | null
}

export interface PixGridDeckTransitionStatus {
  deckId: string
  deckRevision: number
  ready: boolean
  progress: number
  pairCount: number
  readyPairCount: number
  failedPairCount: number
  pairs: readonly PixGridDeckTransitionPairStatus[]
}

export interface PixGridDeckTransitionCoordinatorDiagnostics {
  queuedJobCount: number
  runningJobCount: number
  deduplicatedJobCount: number
  trackedDeckCount: number
  expectedPairCount: number
  cacheEntryCount: number
  cacheBytes: number
}

interface PairExpectation {
  token: string
  deckId: string
  deckRevision: number
  sourceItem: PixGridDeckItemDefinition
  targetItem: PixGridDeckItemDefinition
  sourceFrame: PixGridPreparedFrame
  targetFrame: PixGridPreparedFrame
  cacheKey: string
  requestedMode: ReturnType<typeof resolvePixGridDeckTransitionPairPolicy>['mode']
  durationFraction: number
}

interface TransitionJob {
  id: string
  key: string
  expectation: PairExpectation
  controller: AbortController
  consumers: Map<string, PairExpectation>
  phase: 'queued' | 'compiling'
  progress: number
  started: boolean
}

function transitionError(
  code: PixGridDeckCompileError['code'],
  message: string,
  retryable = true,
): PixGridDeckCompileError {
  return { code, message, retryable }
}

function normalizeError(error: unknown): PixGridDeckCompileError {
  if (error && typeof error === 'object' && 'code' in error && 'message' in error) {
    return {
      code: (error as { code: PixGridDeckCompileError['code'] }).code,
      message: String((error as { message: unknown }).message),
      retryable: 'retryable' in error ? Boolean((error as { retryable: unknown }).retryable) : true,
    }
  }
  return transitionError(
    'transition-failed',
    error instanceof Error ? error.message : 'PixGrid Deck transition compilation failed.',
  )
}

function pairToken(deckId: string, sourceItemId: string, targetItemId: string): string {
  return `${deckId}\u0000${sourceItemId}\u0000${targetItemId}`
}

function adjacentPairs(items: readonly PixGridDeckItemDefinition[], loop: boolean): Array<readonly [PixGridDeckItemDefinition, PixGridDeckItemDefinition]> {
  if (items.length <= 1) return []
  const pairs: Array<readonly [PixGridDeckItemDefinition, PixGridDeckItemDefinition]> = []
  for (let index = 0; index < items.length - 1; index += 1) pairs.push([items[index]!, items[index + 1]!])
  if (loop) pairs.push([items[items.length - 1]!, items[0]!])
  return pairs
}

function allDirectedPairs(items: readonly PixGridDeckItemDefinition[]): Array<readonly [PixGridDeckItemDefinition, PixGridDeckItemDefinition]> {
  const pairs: Array<readonly [PixGridDeckItemDefinition, PixGridDeckItemDefinition]> = []
  for (const source of items) for (const target of items) if (source.id !== target.id) pairs.push([source, target])
  return pairs
}

export function resolveReachablePixGridDeckTransitionPairs(
  deck: PixGridDeckDefinition,
): Array<readonly [PixGridDeckItemDefinition, PixGridDeckItemDefinition]> {
  const items = deck.items.filter(item => item.enabled).sort((left, right) => left.order - right.order)
  if (items.length <= 1) return []
  const hasScopedAssignments = Object.keys(deck.configuration.sectionItemAssignments).length > 0
    || Object.keys(deck.configuration.sceneItemAssignments ?? {}).length > 0
  if (deck.configuration.playbackOrder === 'shuffle'
    || deck.configuration.playbackOrder === 'sectionAssigned'
    || hasScopedAssignments) return allDirectedPairs(items)
  if (deck.configuration.playbackOrder === 'reverse') {
    return adjacentPairs([...items].reverse(), deck.configuration.loop)
  }
  if (deck.configuration.playbackOrder === 'pingPong') {
    const forward = adjacentPairs(items, false)
    const reverse = forward.map(([source, target]) => [target, source] as const)
    return [...forward, ...reverse]
  }
  return adjacentPairs(items, deck.configuration.loop)
}

export class PixGridDeckTransitionCoordinator {
  private readonly concurrency: number
  private readonly cache: PixGridDeckTransitionPlanCache
  private readonly compile: PixGridDeckTransitionCompileFunction
  private readonly workerFactory?: PixGridDeckCompilerWorkerFactory
  private readonly expectations = new Map<string, PairExpectation>()
  private readonly jobs = new Map<string, TransitionJob>()
  private readonly queue: TransitionJob[] = []
  private readonly failures = new Map<string, PixGridDeckCompileError>()
  private readonly decks = new Map<string, PixGridDeckDefinition>()
  private readonly frameSets = new Map<string, PixGridPreparedFrameSet>()
  private readonly statuses = new Map<string, PixGridDeckTransitionStatus>()
  private readonly listeners = new Set<(statuses: ReadonlyMap<string, PixGridDeckTransitionStatus>) => void>()
  private running = 0
  private sequence = 0
  private deduplicated = 0
  private disposed = false

  constructor(options: PixGridDeckTransitionCoordinatorOptions = {}) {
    this.concurrency = Math.max(1, Math.floor(options.concurrency ?? 2))
    this.cache = options.cache ?? pixGridDeckTransitionPlanCache
    this.compile = options.compile ?? compilePixGridDeckTransition
    this.workerFactory = options.workerFactory
  }

  subscribe(listener: (statuses: ReadonlyMap<string, PixGridDeckTransitionStatus>) => void): () => void {
    this.listeners.add(listener)
    listener(this.statuses)
    return () => this.listeners.delete(listener)
  }

  getStatus(deckId: string): PixGridDeckTransitionStatus | null {
    return this.statuses.get(deckId) ?? null
  }

  getPlan(deckId: string, sourceItemId: string, targetItemId: string): PixGridDeckTransitionPlan | null {
    const expectation = this.expectations.get(pairToken(deckId, sourceItemId, targetItemId))
    const deck = this.decks.get(deckId)
    const frameSet = this.frameSets.get(deckId)
    if (
      !expectation
      || !deck
      || !frameSet
      || expectation.deckRevision !== deck.revision
      || frameSet.deckRevision !== deck.revision
    ) return null
    return this.cache.get(expectation.cacheKey)
  }

  getDiagnostics(): PixGridDeckTransitionCoordinatorDiagnostics {
    return {
      queuedJobCount: this.queue.filter(job => !job.started && job.consumers.size > 0).length,
      runningJobCount: this.running,
      deduplicatedJobCount: this.deduplicated,
      trackedDeckCount: this.decks.size,
      expectedPairCount: this.expectations.size,
      cacheEntryCount: this.cache.size,
      cacheBytes: this.cache.approximateBytes,
    }
  }

  synchronize(
    decks: readonly PixGridDeckDefinition[],
    preparedFrameSets: ReadonlyMap<string, PixGridPreparedFrameSet>,
  ): void {
    if (this.disposed) return
    this.decks.clear()
    for (const deck of decks) this.decks.set(deck.id, deck)
    this.frameSets.clear()
    for (const [deckId, frameSet] of preparedFrameSets) this.frameSets.set(deckId, frameSet)
    const nextExpectations = new Map<string, PairExpectation>()
    const preparedDeckIds = new Set<string>()

    for (const deck of decks) {
      const frameSet = preparedFrameSets.get(deck.id)
      if (!frameSet || frameSet.deckRevision !== deck.revision) continue
      preparedDeckIds.add(deck.id)
      const enabled = deck.items.filter(item => item.enabled).sort((left, right) => left.order - right.order)
      if (enabled.length !== frameSet.frames.length) continue
      const framesByItemId = new Map(enabled.map((item, index) => [item.id, frameSet.frames[index]!] as const))
      for (const [sourceItem, targetItem] of resolveReachablePixGridDeckTransitionPairs(deck)) {
        const sourceFrame = framesByItemId.get(sourceItem.id)
        const targetFrame = framesByItemId.get(targetItem.id)
        if (!sourceFrame || !targetFrame) continue
        const pairPolicy = resolvePixGridDeckTransitionPairPolicy(
          deck.configuration.transitionPolicy,
          sourceItem.id,
          targetItem.id,
        )
        const settings = {
          requestedMode: pairPolicy.mode,
          sourceItemId: sourceItem.id,
          targetItemId: targetItem.id,
          durationFraction: pairPolicy.durationFraction,
        }
        const cacheKey = createPixGridDeckTransitionCacheKey({
          sourceFrameCacheKey: sourceFrame.cacheKey,
          targetFrameCacheKey: targetFrame.cacheKey,
          settings,
        })
        const token = pairToken(deck.id, sourceItem.id, targetItem.id)
        nextExpectations.set(token, {
          token,
          deckId: deck.id,
          deckRevision: deck.revision,
          sourceItem,
          targetItem,
          sourceFrame,
          targetFrame,
          cacheKey,
          requestedMode: pairPolicy.mode,
          durationFraction: pairPolicy.durationFraction,
        })
      }
    }

    // A revised source temporarily makes the Stage 3 frame set unavailable.
    // Retain already-cached plans so unchanged pair keys can be reused when the
    // replacement set arrives, but never expose or finish them as current work.
    for (const [token, expectation] of this.expectations) {
      if (!this.decks.has(expectation.deckId) || preparedDeckIds.has(expectation.deckId)) continue
      if (this.cache.peek(expectation.cacheKey)) nextExpectations.set(token, expectation)
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
    this.cache.retain(expectedKeys)
    for (const key of this.failures.keys()) if (!expectedKeys.has(key)) this.failures.delete(key)

    for (const expectation of nextExpectations.values()) {
      if (this.cache.peek(expectation.cacheKey) || this.failures.has(expectation.cacheKey)) continue
      let job = this.jobs.get(expectation.cacheKey)
      if (job?.controller.signal.aborted) job = undefined
      if (!job) {
        job = {
          id: `pix-grid-deck-transition-job-${++this.sequence}`,
          key: expectation.cacheKey,
          expectation,
          controller: new AbortController(),
          consumers: new Map(),
          phase: 'queued',
          progress: 0,
          started: false,
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

  retryDeck(deckId: string): void {
    for (const expectation of this.expectations.values()) {
      if (expectation.deckId === deckId) this.failures.delete(expectation.cacheKey)
    }
    this.synchronize([...this.decks.values()], new Map(this.frameSets))
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
    this.frameSets.delete(deckId)
    this.statuses.delete(deckId)
    this.retainExpectedCacheEntries()
    this.emit()
  }

  dispose(): void {
    this.disposed = true
    for (const job of this.jobs.values()) job.controller.abort()
    this.jobs.clear()
    this.queue.length = 0
    this.expectations.clear()
    this.failures.clear()
    this.decks.clear()
    this.frameSets.clear()
    this.statuses.clear()
    this.listeners.clear()
  }

  private retainExpectedCacheEntries(): void {
    this.cache.retain(new Set([...this.expectations.values()].map(expectation => expectation.cacheKey)))
  }

  private expectationsHaveKey(cacheKey: string): boolean {
    for (const expectation of this.expectations.values()) {
      if (expectation.cacheKey === cacheKey) return true
    }
    return false
  }

  private rebuildStatuses(failure?: { key: string; error: PixGridDeckCompileError }): void {
    if (failure) this.failures.set(failure.key, failure.error)
    const grouped = new Map<string, PixGridDeckTransitionPairStatus[]>()
    for (const expectation of this.expectations.values()) {
      const deck = this.decks.get(expectation.deckId)
      const frameSet = this.frameSets.get(expectation.deckId)
      const current = Boolean(
        deck
        && frameSet
        && expectation.deckRevision === deck.revision
        && frameSet.deckRevision === deck.revision,
      )
      const cached = current ? this.cache.peek(expectation.cacheKey) : null
      const failed = current ? this.failures.get(expectation.cacheKey) : null
      const job = current ? this.jobs.get(expectation.cacheKey) : null
      const status: PixGridDeckTransitionPairStatus = !current
        ? {
            sourceItemId: expectation.sourceItem.id,
            targetItemId: expectation.targetItem.id,
            cacheKey: expectation.cacheKey,
            phase: 'cancelled', progress: 0, error: null,
          }
        : cached
          ? {
              sourceItemId: expectation.sourceItem.id,
              targetItemId: expectation.targetItem.id,
              cacheKey: expectation.cacheKey,
              phase: 'ready', progress: 1, error: null,
            }
          : failed
            ? {
                sourceItemId: expectation.sourceItem.id,
                targetItemId: expectation.targetItem.id,
                cacheKey: expectation.cacheKey,
                phase: 'failed', progress: 0, error: failed,
              }
            : job
              ? {
                  sourceItemId: expectation.sourceItem.id,
                  targetItemId: expectation.targetItem.id,
                  cacheKey: expectation.cacheKey,
                  phase: job.phase, progress: job.progress, error: null,
                }
              : {
                  sourceItemId: expectation.sourceItem.id,
                  targetItemId: expectation.targetItem.id,
                  cacheKey: expectation.cacheKey,
                  phase: 'cancelled', progress: 0, error: null,
                }
      const pairs = grouped.get(expectation.deckId) ?? []
      pairs.push(status)
      grouped.set(expectation.deckId, pairs)
    }
    this.statuses.clear()
    for (const [deckId, deck] of this.decks) {
      const pairs = (grouped.get(deckId) ?? []).sort((left, right) => (
        left.sourceItemId.localeCompare(right.sourceItemId)
        || left.targetItemId.localeCompare(right.targetItemId)
      ))
      const readyPairCount = pairs.filter(pair => pair.phase === 'ready').length
      const failedPairCount = pairs.filter(pair => pair.phase === 'failed').length
      const currentFrameSet = this.frameSets.get(deckId)
      const frameSetReady = currentFrameSet?.deckRevision === deck.revision
      this.statuses.set(deckId, {
        deckId,
        deckRevision: deck.revision,
        ready: frameSetReady && (pairs.length === 0 || readyPairCount === pairs.length),
        progress: frameSetReady
          ? (pairs.length > 0 ? pairs.reduce((sum, pair) => sum + pair.progress, 0) / pairs.length : 1)
          : 0,
        pairCount: pairs.length,
        readyPairCount,
        failedPairCount,
        pairs,
      })
    }
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

  private async run(job: TransitionJob): Promise<void> {
    try {
      job.phase = 'compiling'
      job.progress = 0.02
      this.rebuildStatuses()
      const expectation = job.expectation
      const plan = await this.compile({
        jobId: job.id,
        cacheKey: job.key,
        source: expectation.sourceFrame,
        target: expectation.targetFrame,
        settings: {
          requestedMode: expectation.requestedMode,
          sourceItemId: expectation.sourceItem.id,
          targetItemId: expectation.targetItem.id,
          durationFraction: expectation.durationFraction,
        },
        signal: job.controller.signal,
        onProgress: progress => {
          if (job.controller.signal.aborted) return
          job.progress = progress
          this.rebuildStatuses()
        },
      }, this.workerFactory)
      if (job.controller.signal.aborted || job.consumers.size === 0) return
      if (plan.cacheKey !== job.key) throw transitionError('invalid-result', 'A stale Deck transition plan was rejected.')
      const stillExpected = [...job.consumers.values()].some(consumer => (
        this.expectations.get(consumer.token)?.cacheKey === job.key
      ))
      if (!stillExpected) return
      this.failures.delete(job.key)
      const evicted = this.cache.set(plan)
      for (const key of evicted) {
        if (!this.expectationsHaveKey(key)) continue
        this.failures.set(key, transitionError(
          'transition-failed',
          'The bounded PixGrid Deck transition-plan cache could not retain this active pair.',
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
