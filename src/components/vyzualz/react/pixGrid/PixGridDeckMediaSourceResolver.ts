import { useMediaStore, type UploadedMedia } from '../../../../stores/mediaStore'
import type { PixGridDeckCompileError } from './PixGridDeckCompilerContracts'
import type { PixGridDeckItemDefinition } from './PixGridDeckDomain'
import { PIX_GRID_DECK_MAX_SOURCE_BYTES } from './PixGridDeckMediaValidation'

const SOURCE_EXPIRY_MARGIN_MS = 60_000

function compileError(
  code: PixGridDeckCompileError['code'],
  message: string,
  retryable = true,
): PixGridDeckCompileError {
  return { code, message, retryable }
}

function assertSourceSnapshot(item: PixGridDeckItemDefinition, media: UploadedMedia): void {
  const currentFingerprint = media.metadata.contentFingerprint
  if (currentFingerprint && currentFingerprint !== item.source.fingerprint) {
    throw compileError(
      'source-unavailable',
      `Deck media "${media.name}" no longer matches its validated source snapshot.`,
      false,
    )
  }
}

function expired(item: UploadedMedia): boolean {
  return Boolean(item.urlExpiresAt && item.urlExpiresAt - Date.now() <= SOURCE_EXPIRY_MARGIN_MS)
}

async function fetchMediaBlob(item: UploadedMedia, signal: AbortSignal): Promise<Response> {
  if (!item.url) throw compileError('source-unavailable', `Media source "${item.name}" does not have a loadable URL.`)
  try {
    return await fetch(item.url, { signal, cache: 'force-cache' })
  } catch (error) {
    if (signal.aborted) throw compileError('cancelled', 'PixGrid Deck compilation was cancelled.')
    throw compileError(
      'source-load-failed',
      error instanceof Error ? error.message : `Media source "${item.name}" could not be loaded.`,
    )
  }
}

export async function resolvePixGridDeckMediaSource(
  item: PixGridDeckItemDefinition,
  signal: AbortSignal,
): Promise<Blob> {
  let media = useMediaStore.getState().items.find(candidate => candidate.id === item.mediaId)
  if (!media) throw compileError('source-unavailable', `Deck media "${item.mediaId}" is not loaded yet.`, true)
  assertSourceSnapshot(item, media)

  if ((!media.url || expired(media)) && media.storagePath) {
    await useMediaStore.getState().ensureMediaSigned([media.id], 'visible')
    media = useMediaStore.getState().items.find(candidate => candidate.id === item.mediaId) ?? media
    assertSourceSnapshot(item, media)
  }

  let response = await fetchMediaBlob(media, signal)
  if ((response.status === 401 || response.status === 403) && media.storagePath) {
    const refreshed = await useMediaStore.getState().retryMediaAsset(media.id, 'original')
    if (refreshed) {
      media = useMediaStore.getState().items.find(candidate => candidate.id === item.mediaId) ?? media
      assertSourceSnapshot(item, media)
      response = await fetchMediaBlob(media, signal)
    }
  }
  if (!response.ok) {
    throw compileError('source-load-failed', `Deck media "${media.name}" returned HTTP ${response.status}.`)
  }

  const declaredBytes = Number(response.headers.get('content-length'))
  if (Number.isFinite(declaredBytes) && declaredBytes > PIX_GRID_DECK_MAX_SOURCE_BYTES) {
    throw compileError('source-too-large', `Deck media "${media.name}" exceeds the 25 MiB compiler limit.`, false)
  }

  let blob: Blob
  try {
    blob = await response.blob()
  } catch (error) {
    if (signal.aborted) throw compileError('cancelled', 'PixGrid Deck compilation was cancelled.')
    throw compileError(
      'source-load-failed',
      error instanceof Error ? error.message : `Deck media "${media.name}" could not be read.`,
    )
  }
  if (blob.size > PIX_GRID_DECK_MAX_SOURCE_BYTES) {
    throw compileError('source-too-large', `Deck media "${media.name}" exceeds the 25 MiB compiler limit.`, false)
  }
  return blob
}
