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
  | 'project-replaced'
  | 'deck-conflict'
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

export interface PixGridDeckIngestionWarning {
  fileName: string
  message: string
}

export type PixGridDeckIngestionResult =
  | { ok: true; deckId: string; mediaIds: string[]; rejected?: PixGridDeckIngestionWarning[] }
  | { ok: false; error: PixGridDeckIngestionError }

interface UploadedDeckSource {
  validated: PixGridDeckValidatedSource
  media: UploadedMedia
}

interface CandidateDeckSource {
  entry: UploadedDeckSource
  item: PixGridDeckItemDefinition
}

const ingestionQueues = new Map<string, Promise<void>>()

function ingestionQueueKey(target: PixGridDeckIngestionTarget): string {
  return target.kind === 'append'
    ? `append:${target.deckId}`
    : `create:${target.id ?? target.name.trim().toLocaleLowerCase('en-US')}`
}

function enqueueIngestion(
  key: string,
  work: () => Promise<PixGridDeckIngestionResult>,
): Promise<PixGridDeckIngestionResult> {
  const previous = ingestionQueues.get(key) ?? Promise.resolve()
  const run = previous.then(work, work)
  const tail = run.then(() => undefined, () => undefined)
  ingestionQueues.set(key, tail)
  return run.finally(() => {
    if (ingestionQueues.get(key) === tail) ingestionQueues.delete(key)
  })
}

function validationFailure(error: PixGridDeckMediaValidationError): PixGridDeckIngestionResult {
  return { ok: false, error: { code: error.code, message: error.message, fileName: error.fileName } }
}

function projectMediaReferences(): Set<string> {
  const state = useReactStore.getState()
  const references = new Set(state.pixGridDecks.flatMap(deck => deck.items.map(item => item.mediaId)))
  for (const mediaId of [
    ...state.canvasEngineSettings.mediaIds,
    state.canvasEngineSettings.selectedMediaId,
    state.canvasEngineSettings.manualMediaOverrideId,
    ...state.canvasMediaItems.map(item => item.id),
    state.selectedCanvasMediaId,
    state.activeCanvasMediaId,
    ...state.canvasOrchestrationSettings.mediaPoolIds,
    ...Object.values(state.canvasOrchestrationSettings.mediaLocksByLayer),
  ]) {
    if (mediaId) references.add(mediaId)
  }
  return references
}

/**
 * Removes only transaction-created media that is still unowned. A concurrent
 * project feature may legitimately adopt a canonical media record while this
 * transaction is finishing, so a current project reference always wins.
 */
async function rollbackUploads(items: readonly UploadedMedia[]): Promise<boolean> {
  if (items.length === 0) return true
  const referenced = projectMediaReferences()
  const removable = items.filter(item => !referenced.has(item.id))
  const results = await mapWithConcurrency(removable, MEDIA_BATCH_CONCURRENCY, item => (
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

function cancelledResult(message: string, rolledBack: boolean): PixGridDeckIngestionResult {
  return {
    ok: false,
    error: {
      code: rolledBack ? 'cancelled' : 'rollback-incomplete',
      message: rolledBack
        ? message
        : `${message} One or more uploaded media items still require cleanup.`,
    },
  }
}

function operationStartDeck(target: PixGridDeckIngestionTarget): PixGridDeckDefinition | null {
  if (target.kind !== 'append') return null
  return useReactStore.getState().pixGridDecks.find(deck => deck.id === target.deckId) ?? null
}

function availableSlots(target: PixGridDeckIngestionTarget, deck: PixGridDeckDefinition | null): number {
  return target.kind === 'create'
    ? PIX_GRID_DECK_MAX_ITEMS
    : Math.max(0, PIX_GRID_DECK_MAX_ITEMS - (deck?.items.length ?? PIX_GRID_DECK_MAX_ITEMS))
}

function capacityWarning(fileName: string): PixGridDeckIngestionWarning {
  return {
    fileName,
    message: `The Deck already has the maximum of ${PIX_GRID_DECK_MAX_ITEMS} images for this upload.`,
  }
}

function duplicateWarning(fileName: string): PixGridDeckIngestionWarning {
  return {
    fileName,
    message: 'This source is already present in the latest Deck state.',
  }
}

/**
 * Validates source files, uploads through the canonical media store, compiles
 * transient candidates, and finally merges only those new items into the
 * latest Deck state. No operation-start Deck snapshot is ever written back.
 */
export function ingestPixGridDeckSourceFiles(
  request: PixGridDeckIngestionRequest,
): Promise<PixGridDeckIngestionResult> {
  const requestedProjectEpoch = useReactStore.getState().pixGridDeckProjectEpoch
  return enqueueIngestion(ingestionQueueKey(request.target), () => (
    ingestPixGridDeckSourceFilesTransaction(request, requestedProjectEpoch)
  ))
}

async function ingestPixGridDeckSourceFilesTransaction(
  request: PixGridDeckIngestionRequest,
  requestedProjectEpoch: number,
): Promise<PixGridDeckIngestionResult> {
  if (request.files.length === 0) {
    return {
      ok: false,
      error: {
        code: 'invalid-item-count',
        message: `A committed PixGrid Deck requires ${PIX_GRID_DECK_MIN_ITEMS}–${PIX_GRID_DECK_MAX_ITEMS} images.`,
      },
    }
  }
  if (request.signal?.aborted) {
    return { ok: false, error: { code: 'cancelled', message: 'Deck image upload was cancelled.' } }
  }

  const startState = useReactStore.getState()
  if (startState.pixGridDeckProjectEpoch !== requestedProjectEpoch) {
    return {
      ok: false,
      error: {
        code: 'project-replaced',
        message: 'The active project changed before this Deck upload could start.',
      },
    }
  }
  const startProjectEpoch = requestedProjectEpoch
  const startDeck = operationStartDeck(request.target)
  if (request.target.kind === 'append' && !startDeck) {
    return { ok: false, error: { code: 'deck-not-found', message: `PixGrid Deck "${request.target.deckId}" was not found.` } }
  }
  const slotsAtStart = availableSlots(request.target, startDeck)
  if (slotsAtStart === 0) {
    return {
      ok: false,
      error: {
        code: 'invalid-item-count',
        message: `A PixGrid Deck cannot contain more than ${PIX_GRID_DECK_MAX_ITEMS} images.`,
      },
    }
  }

  const validationResults = await mapWithConcurrency(
    request.files,
    MEDIA_BATCH_CONCURRENCY,
    validatePixGridDeckSourceFile,
  )
  if (request.signal?.aborted) {
    return { ok: false, error: { code: 'cancelled', message: 'Deck image upload was cancelled.' } }
  }

  const warnings: PixGridDeckIngestionWarning[] = []
  const validated: PixGridDeckValidatedSource[] = []
  let firstValidationError: PixGridDeckMediaValidationError | null = null
  for (const result of validationResults) {
    if (result.ok) {
      validated.push(result.source)
    } else {
      firstValidationError ??= result.error
      warnings.push({ fileName: result.error.fileName, message: result.error.message })
    }
  }

  const selected = validated.slice(0, slotsAtStart)
  for (const source of validated.slice(slotsAtStart)) warnings.push(capacityWarning(source.file.name))
  if (selected.length === 0 && firstValidationError) return validationFailure(firstValidationError)
  if (request.target.kind === 'create' && selected.length < PIX_GRID_DECK_MIN_ITEMS) {
    return {
      ok: false,
      error: {
        code: 'invalid-item-count',
        message: `At least ${PIX_GRID_DECK_MIN_ITEMS} valid images are required to create a PixGrid Deck.`,
      },
    }
  }

  const activeKit = useBrandKitStore.getState().activeKit
  const transparentBackground = resolvePixGridDeckTransparentBackground(activeKit)
  const uploaded: UploadedDeckSource[] = []

  for (const source of selected) {
    if (request.signal?.aborted) {
      return cancelledResult(
        'Deck image upload was cancelled.',
        await rollbackUploads(uploaded.map(entry => entry.media)),
      )
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
    return cancelledResult(
      'Deck image upload was cancelled.',
      await rollbackUploads(uploaded.map(entry => entry.media)),
    )
  }

  const preflightState = useReactStore.getState()
  const candidates: CandidateDeckSource[] = uploaded.map((entry, index) => ({
    entry,
    item: itemDefinition(entry, index, transparentBackground),
  }))
  const preflight = await preflightPixGridDeckSources(
    candidates.map(candidate => ({ item: candidate.item, source: candidate.entry.validated.file })),
    preflightState.pixGridState.matrixWidth,
    preflightState.pixGridState.matrixHeight,
    {
      signal: request.signal,
      onProgress: itemId => {
        const candidate = candidates.find(value => value.item.id === itemId)
        if (candidate) request.onUploadPhase?.(candidate.entry.validated.file.name, 'compiling')
      },
    },
  )
  if (request.signal?.aborted) {
    return cancelledResult(
      'Deck image preparation was cancelled.',
      await rollbackUploads(uploaded.map(entry => entry.media)),
    )
  }

  const acceptedIds = new Set(preflight.acceptedItemIds)
  const compiled = candidates.filter(candidate => acceptedIds.has(candidate.item.id))
  const compileRejected = candidates.filter(candidate => !acceptedIds.has(candidate.item.id))
  for (const failure of preflight.rejected) {
    const candidate = compileRejected.find(value => value.item.id === failure.itemId)
    warnings.push({
      fileName: candidate?.entry.validated.file.name ?? failure.mediaId,
      message: failure.error.message,
    })
  }
  if (compileRejected.length > 0) {
    const rejectedCleaned = await rollbackUploads(compileRejected.map(candidate => candidate.entry.media))
    if (!rejectedCleaned) {
      await rollbackUploads(compiled.map(candidate => candidate.entry.media))
      return {
        ok: false,
        error: {
          code: 'rollback-incomplete',
          message: 'One or more failed Deck sources could not be removed from the media library.',
          fileName: compileRejected[0]?.entry.validated.file.name,
        },
      }
    }
  }

  if (compiled.length === 0) {
    const firstFailure = preflight.rejected[0]
    return {
      ok: false,
      error: {
        code: firstFailure?.error.code === 'cancelled' ? 'cancelled' : 'compile-failed',
        message: firstFailure?.error.message ?? 'The Deck images could not be prepared for PixGrid.',
        fileName: compileRejected[0]?.entry.validated.file.name,
      },
    }
  }

  // This is the concurrency boundary. Re-read the project and Deck immediately
  // before the synchronous Zustand mutation, then merge only transaction-owned
  // candidates. There is deliberately no await between this read and mutation.
  const latestState = useReactStore.getState()
  if (latestState.pixGridDeckProjectEpoch !== startProjectEpoch) {
    const rolledBack = await rollbackUploads(compiled.map(candidate => candidate.entry.media))
    return {
      ok: false,
      error: {
        code: rolledBack ? 'project-replaced' : 'rollback-incomplete',
        message: rolledBack
          ? 'The active project changed while Deck images were being prepared. The upload was not committed.'
          : 'The active project changed and uploaded media cleanup is incomplete.',
      },
    }
  }

  let mutation: PixGridDeckMutationResult
  let deckId: string
  let committed: CandidateDeckSource[]
  let rejectedAtCommit: CandidateDeckSource[] = []
  if (request.target.kind === 'create') {
    if (compiled.length < PIX_GRID_DECK_MIN_ITEMS) {
      await rollbackUploads(compiled.map(candidate => candidate.entry.media))
      return {
        ok: false,
        error: {
          code: 'compile-failed',
          message: `At least ${PIX_GRID_DECK_MIN_ITEMS} prepared images are required to create a PixGrid Deck.`,
        },
      }
    }
    committed = compiled.map((candidate, order) => ({
      ...candidate,
      item: { ...candidate.item, order },
    }))
    mutation = latestState.createPixGridDeck({
      id: request.target.id,
      name: request.target.name,
      items: committed.map(candidate => candidate.item),
    })
    deckId = mutation.ok ? mutation.deckId : request.target.id ?? ''
  } else {
    const targetDeckId = request.target.deckId
    const latestDeck = latestState.pixGridDecks.find(deck => deck.id === targetDeckId) ?? null
    if (!latestDeck) {
      const rolledBack = await rollbackUploads(compiled.map(candidate => candidate.entry.media))
      return {
        ok: false,
        error: {
          code: rolledBack ? 'deck-not-found' : 'rollback-incomplete',
          message: rolledBack
            ? `PixGrid Deck "${targetDeckId}" was deleted before the upload completed.`
            : 'The Deck was deleted and uploaded media cleanup is incomplete.',
        },
      }
    }

    const existingMediaIds = new Set(latestDeck.items.map(item => item.mediaId))
    const existingFingerprints = new Set(latestDeck.items.map(item => item.source.fingerprint))
    const unique: CandidateDeckSource[] = []
    const duplicates: CandidateDeckSource[] = []
    for (const candidate of compiled) {
      if (
        existingMediaIds.has(candidate.item.mediaId)
        || existingFingerprints.has(candidate.item.source.fingerprint)
      ) {
        duplicates.push(candidate)
        warnings.push(duplicateWarning(candidate.entry.validated.file.name))
        continue
      }
      existingMediaIds.add(candidate.item.mediaId)
      existingFingerprints.add(candidate.item.source.fingerprint)
      unique.push(candidate)
    }

    const latestSlots = Math.max(0, PIX_GRID_DECK_MAX_ITEMS - latestDeck.items.length)
    committed = unique.slice(0, latestSlots).map((candidate, index) => ({
      ...candidate,
      item: { ...candidate.item, order: latestDeck.items.length + index },
    }))
    const overflow = unique.slice(latestSlots)
    for (const candidate of overflow) warnings.push(capacityWarning(candidate.entry.validated.file.name))
    rejectedAtCommit = [...duplicates, ...overflow]
    if (committed.length === 0) {
      const rolledBack = await rollbackUploads(rejectedAtCommit.map(candidate => candidate.entry.media))
      return {
        ok: false,
        error: {
          code: rolledBack ? 'deck-conflict' : 'rollback-incomplete',
          message: rolledBack
            ? 'No uploaded images could be merged into the latest Deck state.'
            : 'No uploaded images could be merged and media cleanup is incomplete.',
        },
      }
    }

    const currentItems = [...latestDeck.items]
      .sort((left, right) => left.order - right.order)
      .map((item, order) => ({ ...item, order }))
    mutation = latestState.updatePixGridDeck(latestDeck.id, {
      items: [...currentItems, ...committed.map(candidate => candidate.item)],
    })
    deckId = latestDeck.id
  }

  if (!mutation.ok) {
    const rolledBack = await rollbackUploads(compiled.map(candidate => candidate.entry.media))
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

  if (rejectedAtCommit.length > 0) {
    const cleaned = await rollbackUploads(rejectedAtCommit.map(candidate => candidate.entry.media))
    if (!cleaned) {
      for (const candidate of rejectedAtCommit) {
        warnings.push({
          fileName: candidate.entry.validated.file.name,
          message: 'The source was not committed and its automatic media cleanup is incomplete.',
        })
      }
    }
  }

  return {
    ok: true,
    deckId,
    mediaIds: committed.map(candidate => candidate.entry.media.id),
    ...(warnings.length > 0 ? { rejected: warnings } : {}),
  }
}
