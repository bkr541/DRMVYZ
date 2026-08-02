import {
  PIX_GRID_DECK_COMPILE_CONCURRENCY,
  type PixGridDeckCompileError,
  type PixGridPreparedFrame,
} from './PixGridDeckCompilerContracts'
import { createPixGridDeckItemCompilerCacheKey } from './PixGridDeckCompilerCore'
import {
  compilePixGridDeckBlob,
  type PixGridDeckBlobCompileRequest,
  type PixGridDeckCompilerWorkerFactory,
} from './PixGridDeckCompilerExecutor'
import type { PixGridDeckItemDefinition } from './PixGridDeckDomain'
import {
  PixGridDeckPreparedFrameCache,
  pixGridDeckPreparedFrameCache,
} from './PixGridDeckPreparedFrameCache'

type PixGridDeckCompileFunction = (
  request: PixGridDeckBlobCompileRequest,
  workerFactory?: PixGridDeckCompilerWorkerFactory,
) => Promise<PixGridPreparedFrame>

export interface PixGridDeckPreflightEntry {
  item: PixGridDeckItemDefinition
  source: Blob
}

export interface PixGridDeckPreflightFailure {
  itemId: string
  mediaId: string
  error: PixGridDeckCompileError
}

export interface PixGridDeckPreflightResult {
  acceptedItemIds: string[]
  rejected: PixGridDeckPreflightFailure[]
}

export interface PixGridDeckPreflightOptions {
  concurrency?: number
  cache?: PixGridDeckPreparedFrameCache
  compile?: PixGridDeckCompileFunction
  signal?: AbortSignal
  onProgress?: (itemId: string, progress: number) => void
}

function normalizeError(error: unknown): PixGridDeckCompileError {
  if (error && typeof error === 'object' && 'code' in error && 'message' in error) {
    return {
      code: (error as { code: PixGridDeckCompileError['code'] }).code,
      message: String((error as { message: unknown }).message),
      retryable: 'retryable' in error ? Boolean((error as { retryable: unknown }).retryable) : true,
    }
  }
  return {
    code: 'compile-failed',
    message: error instanceof Error ? error.message : 'PixGrid Deck source compilation failed.',
    retryable: true,
  }
}

/**
 * Compiles new uploads before their Deck mutation is committed. Successful
 * frames seed the same runtime cache used by the coordinator; rejected entries
 * can therefore be rolled back without discarding unrelated successful work.
 */
export async function preflightPixGridDeckSources(
  entries: readonly PixGridDeckPreflightEntry[],
  width: number,
  height: number,
  options: PixGridDeckPreflightOptions = {},
): Promise<PixGridDeckPreflightResult> {
  const concurrency = Math.max(1, Math.floor(options.concurrency ?? PIX_GRID_DECK_COMPILE_CONCURRENCY))
  const cache = options.cache ?? pixGridDeckPreparedFrameCache
  const compile = options.compile ?? compilePixGridDeckBlob
  const acceptedItemIds: string[] = []
  const rejected: PixGridDeckPreflightFailure[] = []
  let cursor = 0

  const runEntry = async (entry: PixGridDeckPreflightEntry): Promise<void> => {
    if (options.signal?.aborted) {
      rejected.push({
        itemId: entry.item.id,
        mediaId: entry.item.mediaId,
        error: { code: 'cancelled', message: 'PixGrid Deck compilation was cancelled.', retryable: true },
      })
      return
    }
    const cacheKey = createPixGridDeckItemCompilerCacheKey(entry.item, width, height)
    if (cache.peek(cacheKey)) {
      acceptedItemIds.push(entry.item.id)
      options.onProgress?.(entry.item.id, 1)
      return
    }
    try {
      const frame: PixGridPreparedFrame = await compile({
        jobId: `pix-grid-deck-preflight:${entry.item.id}`,
        cacheKey,
        mediaId: entry.item.mediaId,
        sourceFingerprint: entry.item.source.fingerprint,
        sourceRevision: entry.item.source.mediaRevision,
        width,
        height,
        mimeType: entry.item.source.mimeType,
        hasAlpha: entry.item.source.hasAlpha,
        source: entry.source,
        transparentBackground: entry.item.source.transparentBackground,
        signal: options.signal,
        onProgress: (_phase, progress) => options.onProgress?.(entry.item.id, progress),
      })
      if (options.signal?.aborted) {
        throw { code: 'cancelled', message: 'PixGrid Deck compilation was cancelled.', retryable: true }
      }
      if (frame.cacheKey !== cacheKey) {
        throw { code: 'invalid-result', message: 'A stale preflight compiler result was rejected.', retryable: true }
      }
      cache.set(frame)
      if (!cache.peek(cacheKey)) {
        throw {
          code: 'compile-failed',
          message: 'The bounded PixGrid Deck cache could not retain the prepared frame.',
          retryable: true,
        }
      }
      acceptedItemIds.push(entry.item.id)
      options.onProgress?.(entry.item.id, 1)
    } catch (error) {
      rejected.push({ itemId: entry.item.id, mediaId: entry.item.mediaId, error: normalizeError(error) })
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, entries.length) }, async () => {
    while (cursor < entries.length) {
      const entry = entries[cursor]
      cursor += 1
      await runEntry(entry)
    }
  })
  await Promise.all(workers)
  const acceptedSet = new Set(acceptedItemIds)
  const rejectedByItemId = new Map(rejected.map(failure => [failure.itemId, failure]))
  return {
    acceptedItemIds: entries.filter(entry => acceptedSet.has(entry.item.id)).map(entry => entry.item.id),
    rejected: entries.flatMap(entry => {
      const failure = rejectedByItemId.get(entry.item.id)
      return failure ? [failure] : []
    }),
  }
}
