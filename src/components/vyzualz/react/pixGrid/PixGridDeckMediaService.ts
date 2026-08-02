import { useBrandKitStore } from '../../../../features/personalization/brandKitStore'
import {
  MEDIA_BATCH_CONCURRENCY,
  mapWithConcurrency,
  useMediaStore,
  type CanonicalVisualUploadResult,
  type UploadedMedia,
} from '../../../../stores/mediaStore'
import { useReactStore } from '../../../../stores/reactStore'
import { preflightPixGridDeckSources } from './PixGridDeckCompilerPreflight'
import {
  PIX_GRID_DECK_MAX_ITEMS,
  PIX_GRID_DECK_MIN_ITEMS,
  createPixGridDeckItemId,
  type PixGridDeckDefinition,
  type PixGridDeckItemDefinition,
  type PixGridDeckMutationResult,
  type PixGridDeckValidationError,
} from './PixGridDeckDomain'
import { resolvePixGridDeckTransparentBackground } from './PixGridDeckBrandBackground'
import {
  validatePixGridDeckSourceFile,
  type PixGridDeckMediaValidationError,
  type PixGridDeckValidatedSource,
} from './PixGridDeckMediaValidation'

export type PixGridDeckIngestionErrorCode =
  | PixGridDeckMediaValidationError['code']
  | 'deck-not-found'
  | 'invalid-item-count'
  | 'upload-failed'
  | 'compile-failed'
  | 'deck-mutation-failed'
  | 'rollback-incomplete'
  | 'cancelled'

export interface PixGridDeckIngestionError {
  code: PixGridDeckIngestionErrorCode
  message: string
  fileName?: string
  deckError?: PixGridDeckValidationError
}

export type PixGridDeckIngestionTarget =
  | { kind: 'create'; name: string; id?: string }
  | { kind: 'append'; deckId: string }

export interface PixGridDeckIngestionRequest {
  target: PixGridDeckIngestionTarget
  files: File[]
  signal?: AbortSignal
  onUploadPhase?: (fileName: string, phase: string) => void
}

export type PixGridDeckIngestionResult =
  | { ok: true; deckId: string; mediaIds: string[]; rejected?: Array<{ fileName: string; message: string }> }
  | { ok: false; error: PixGridDeckIngestionError }

interface UploadedDeckSource {
  validated: PixGridDeckValidatedSource
  media: UploadedMedia
}

function validationFailure(error: PixGridDeckMediaValidationError): PixGridDeckIngestionResult {
  return { ok: false, error: { code: error.code, message: error.message, fileName: error.fileName } }
}

async function rollbackUploads(items: readonly UploadedMedia[]): Promise<boolean> {
  const results = await mapWithConcurrency(items, MEDIA_BATCH_CONCURRENCY, item => (
    useMediaStore.getState().removeItem(item.id)
  ))
  return results.every(Boolean)
}

function itemDefinition(source: UploadedDeckSource, order: number, transparentBackground: string): PixGridDeckItemDefinition {
  return {
    id: createPixGridDeckItemId(),
    mediaId: source.media.id,
    enabled: true,
    order,
    revision: 1,
    timingOverrideBeats: null,
    source: {
      mediaRevision: source.media.revision ?? 1,
      fingerprint: source.validated.fingerprint,
      fileName: source.media.name || source.validated.file.name,
      mimeType: source.validated.mimeType,
      width: source.validated.width,
      height: source.validated.height,
      hasAlpha: source.validated.hasAlpha,
      transparentBackground: source.validated.hasAlpha ? transparentBackground : '#000000',
    },
  }
}

function targetDeck(target: PixGridDeckIngestionTarget): PixGridDeckDefinition | null {
  if (target.kind !== 'append') return null
  return useReactStore.getState().pixGridDecks.find(deck => deck.id === target.deckId) ?? null
}

function validateRequestedCount(target: PixGridDeckIngestionTarget, fileCount: number): PixGridDeckIngestionResult | null {
  const existing = targetDeck(target)
  if (target.kind === 'append' && !existing) {
    return { ok: false, error: { code: 'deck-not-found', message: `PixGrid Deck "${target.deckId}" was not found.` } }
  }
  const total = (existing?.items.length ?? 0) + fileCount
  const minimum = target.kind === 'create' ? PIX_GRID_DECK_MIN_ITEMS : existing?.items.length ?? PIX_GRID_DECK_MIN_ITEMS
  if (fileCount <= 0 || total < minimum || total > PIX_GRID_DECK_MAX_ITEMS) {
    return {
      ok: false,
      error: {
        code: 'invalid-item-count',
        message: `A committed PixGrid Deck requires ${PIX_GRID_DECK_MIN_ITEMS}–${PIX_GRID_DECK_MAX_ITEMS} images.`,
      },
    }
  }
  return null
}

/**
 * Validates every source before upload, then uses mediaStore as the sole byte
 * owner, preflights new sources through the compiler, and commits one Deck
 * mutation containing only successfully prepared images.
 */
export async function ingestPixGridDeckSourceFiles(
  request: PixGridDeckIngestionRequest,
): Promise<PixGridDeckIngestionResult> {
  const countFailure = validateRequestedCount(request.target, request.files.length)
  if (countFailure) return countFailure
  if (request.signal?.aborted) return { ok: false, error: { code: 'cancelled', message: 'Deck image upload was cancelled.' } }

  const validationResults = await mapWithConcurrency(
    request.files,
    MEDIA_BATCH_CONCURRENCY,
    validatePixGridDeckSourceFile,
  )
  const invalid = validationResults.find(result => !result.ok)
  if (invalid && !invalid.ok) return validationFailure(invalid.error)
  const validated = validationResults.flatMap(result => result.ok ? [result.source] : [])

  const activeKit = useBrandKitStore.getState().activeKit
  const transparentBackground = resolvePixGridDeckTransparentBackground(activeKit)
  const uploaded: UploadedDeckSource[] = []

  for (const source of validated) {
    if (request.signal?.aborted) {
      const rolledBack = await rollbackUploads(uploaded.map(entry => entry.media))
      return {
        ok: false,
        error: {
          code: rolledBack ? 'cancelled' : 'rollback-incomplete',
          message: rolledBack
            ? 'Deck image upload was cancelled.'
            : 'Deck image upload was cancelled, but one or more uploaded media items still require cleanup.',
        },
      }
    }

    const upload: CanonicalVisualUploadResult = await useMediaStore.getState().uploadCanonicalVisualFile(source.file, {
      metadata: {
        width: source.width ?? undefined,
        height: source.height ?? undefined,
        hasAlpha: source.hasAlpha,
        contentFingerprint: source.fingerprint,
        detectedMimeType: source.mimeType,
      },
      signal: request.signal,
      onPhase: phase => request.onUploadPhase?.(source.file.name, phase),
    })
    if (!upload.ok) {
      const rolledBack = await rollbackUploads(uploaded.map(entry => entry.media))
      return {
        ok: false,
        error: {
          code: rolledBack
            ? (upload.phase === 'cancelled' ? 'cancelled' : 'upload-failed')
            : 'rollback-incomplete',
          message: rolledBack
            ? upload.error
            : `${upload.error} Previously uploaded Deck sources could not all be cleaned up.`,
          fileName: source.file.name,
        },
      }
    }
    uploaded.push({ validated: source, media: upload.item })
  }

  if (request.signal?.aborted) {
    const rolledBack = await rollbackUploads(uploaded.map(entry => entry.media))
    return {
      ok: false,
      error: {
        code: rolledBack ? 'cancelled' : 'rollback-incomplete',
        message: rolledBack
          ? 'Deck image upload was cancelled.'
          : 'Deck image upload was cancelled, but one or more uploaded media items still require cleanup.',
      },
    }
  }

  const state = useReactStore.getState()
  const appendDeckId = request.target.kind === 'append' ? request.target.deckId : null
  const existingDeck = appendDeckId
    ? state.pixGridDecks.find(candidate => candidate.id === appendDeckId) ?? null
    : null
  if (request.target.kind === 'append' && !existingDeck) {
    await rollbackUploads(uploaded.map(entry => entry.media))
    return { ok: false, error: { code: 'deck-not-found', message: `PixGrid Deck "${request.target.deckId}" was not found.` } }
  }

  const baseOrder = existingDeck?.items.length ?? 0
  const candidates = uploaded.map((entry, index) => ({
    entry,
    item: itemDefinition(entry, baseOrder + index, transparentBackground),
  }))
  const preflight = await preflightPixGridDeckSources(
    candidates.map(candidate => ({ item: candidate.item, source: candidate.entry.validated.file })),
    state.pixGridState.matrixWidth,
    state.pixGridState.matrixHeight,
    {
      signal: request.signal,
      onProgress: itemId => {
        const candidate = candidates.find(value => value.item.id === itemId)
        if (candidate) request.onUploadPhase?.(candidate.entry.validated.file.name, 'compiling')
      },
    },
  )
  if (request.signal?.aborted) {
    const rolledBack = await rollbackUploads(uploaded.map(entry => entry.media))
    return {
      ok: false,
      error: {
        code: rolledBack ? 'cancelled' : 'rollback-incomplete',
        message: rolledBack
          ? 'Deck image preparation was cancelled.'
          : 'Deck image preparation was cancelled, but uploaded media cleanup is incomplete.',
      },
    }
  }
  const acceptedIds = new Set(preflight.acceptedItemIds)
  const accepted = candidates.filter(candidate => acceptedIds.has(candidate.item.id))
  const rejected = candidates.filter(candidate => !acceptedIds.has(candidate.item.id))
  if (rejected.length > 0) {
    const rejectedCleaned = await rollbackUploads(rejected.map(candidate => candidate.entry.media))
    if (!rejectedCleaned) {
      await rollbackUploads(accepted.map(candidate => candidate.entry.media))
      return {
        ok: false,
        error: {
          code: 'rollback-incomplete',
          message: 'One or more failed Deck sources could not be removed from the media library.',
          fileName: rejected[0]?.entry.validated.file.name,
        },
      }
    }
  }

  const committedCount = (existingDeck?.items.length ?? 0) + accepted.length
  if (accepted.length === 0 || (request.target.kind === 'create' && committedCount < PIX_GRID_DECK_MIN_ITEMS)) {
    await rollbackUploads(accepted.map(candidate => candidate.entry.media))
    const firstFailure = preflight.rejected[0]
    const firstRejected = rejected[0]
    return {
      ok: false,
      error: {
        code: firstFailure?.error.code === 'cancelled' ? 'cancelled' : 'compile-failed',
        message: firstFailure?.error.message ?? 'The Deck images could not be prepared for PixGrid.',
        fileName: firstRejected?.entry.validated.file.name,
      },
    }
  }

  let mutation: PixGridDeckMutationResult
  let deckId: string
  if (request.target.kind === 'create') {
    mutation = state.createPixGridDeck({
      id: request.target.id,
      name: request.target.name,
      items: accepted.map(candidate => candidate.item),
    })
    deckId = mutation.ok ? mutation.deckId : request.target.id ?? ''
  } else {
    const deck = existingDeck!
    mutation = state.updatePixGridDeck(deck.id, {
      items: [...deck.items, ...accepted.map(candidate => candidate.item)],
    })
    deckId = deck.id
  }

  if (!mutation.ok) {
    const rolledBack = await rollbackUploads(accepted.map(candidate => candidate.entry.media))
    return {
      ok: false,
      error: {
        code: rolledBack ? 'deck-mutation-failed' : 'rollback-incomplete',
        message: rolledBack
          ? mutation.error.message
          : `${mutation.error.message} Uploaded media cleanup is incomplete.`,
        deckError: mutation.error,
      },
    }
  }

  const warnings = preflight.rejected.map(failure => {
    const candidate = rejected.find(value => value.item.id === failure.itemId)
    return {
      fileName: candidate?.entry.validated.file.name ?? failure.mediaId,
      message: failure.error.message,
    }
  })
  return {
    ok: true,
    deckId,
    mediaIds: accepted.map(candidate => candidate.entry.media.id),
    ...(warnings.length > 0 ? { rejected: warnings } : {}),
  }
}
