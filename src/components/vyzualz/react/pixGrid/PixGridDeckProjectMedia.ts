import {
  MEDIA_BATCH_CONCURRENCY,
  mapWithConcurrency,
  useMediaStore,
  type UploadedMedia,
} from '../../../../stores/mediaStore'
import {
  normalizePixGridDeckCollection,
  type PixGridDeckDefinition,
  type PixGridDeckSourceSnapshot,
} from './PixGridDeckDomain'
import { validatePixGridDeckSourceFile } from './PixGridDeckMediaValidation'

export const PIX_GRID_DECK_PROJECT_MEDIA_MANIFEST_VERSION = 1 as const

export interface PixGridDeckProjectMediaManifestEntry {
  mediaId: string
  databaseId: string | null
  fileName: string
  mimeType: string
  storagePath: string | null
  mediaRevision: number
  fingerprint: string
  deckIds: string[]
}

export interface PixGridDeckProjectMediaManifest {
  schemaVersion: typeof PIX_GRID_DECK_PROJECT_MEDIA_MANIFEST_VERSION
  decks: PixGridDeckDefinition[]
  sources: PixGridDeckProjectMediaManifestEntry[]
  missingMediaIds: string[]
  conflictingMediaIds: string[]
}

export interface PixGridDeckProjectSourceFile {
  mediaId: string
  file: File
}

export interface PixGridDeckProjectMediaBundle {
  manifest: PixGridDeckProjectMediaManifest
  files: PixGridDeckProjectSourceFile[]
}

export interface PixGridDeckProjectExportOptions {
  mediaItems?: readonly UploadedMedia[]
  readSource?: (item: UploadedMedia) => Promise<File>
}

export interface PixGridDeckProjectImportResult {
  decks: PixGridDeckDefinition[]
  mediaIdMap: Record<string, string>
  missingMediaIds: string[]
  errors: Array<{ mediaId: string; message: string }>
}

function sourceByMediaId(decks: readonly PixGridDeckDefinition[]): Map<string, {
  source: PixGridDeckSourceSnapshot
  deckIds: string[]
  conflicted: boolean
}> {
  const sources = new Map<string, { source: PixGridDeckSourceSnapshot; deckIds: string[]; conflicted: boolean }>()
  for (const deck of decks) {
    for (const item of deck.items) {
      const existing = sources.get(item.mediaId)
      if (existing) {
        if (!existing.deckIds.includes(deck.id)) existing.deckIds.push(deck.id)
        if (existing.source.fingerprint !== item.source.fingerprint) existing.conflicted = true
      } else {
        sources.set(item.mediaId, { source: item.source, deckIds: [deck.id], conflicted: false })
      }
    }
  }
  return sources
}

async function defaultReadSource(item: UploadedMedia): Promise<File> {
  await useMediaStore.getState().ensureMediaSigned([item.id], 'visible')
  item = useMediaStore.getState().items.find(candidate => candidate.id === item.id) ?? item
  if (!item.url) throw new Error('The source media URL is unavailable.')
  const response = await fetch(item.url)
  if (!response.ok) throw new Error(`Source media download failed with status ${response.status}.`)
  const blob = await response.blob()
  return new File([blob], item.name, { type: item.mimeType ?? blob.type })
}

/** Builds the project-owned Deck manifest and packages only source files. */
export async function exportPixGridDeckProjectMediaBundle(
  decksInput: readonly PixGridDeckDefinition[],
  options: PixGridDeckProjectExportOptions = {},
): Promise<PixGridDeckProjectMediaBundle> {
  const decks = normalizePixGridDeckCollection(decksInput)
  const references = sourceByMediaId(decks)
  const items: readonly UploadedMedia[] = options.mediaItems ?? useMediaStore.getState().items
  const mediaById = new Map<string, UploadedMedia>(items.map(item => [item.id, item]))
  const missingMediaIds: string[] = []
  const conflictingMediaIds: string[] = []
  const sources: PixGridDeckProjectMediaManifestEntry[] = []
  const readable: Array<{ entry: PixGridDeckProjectMediaManifestEntry; item: UploadedMedia }> = []

  for (const [mediaId, reference] of references) {
    const item = mediaById.get(mediaId)
    const entry: PixGridDeckProjectMediaManifestEntry = {
      mediaId,
      databaseId: item?.dbId ?? null,
      fileName: reference.source.fileName ?? item?.name ?? `${mediaId}.source`,
      mimeType: reference.source.mimeType ?? item?.mimeType ?? 'application/octet-stream',
      storagePath: item?.storagePath ?? null,
      mediaRevision: reference.source.mediaRevision,
      fingerprint: reference.source.fingerprint,
      deckIds: [...reference.deckIds].sort(),
    }
    sources.push(entry)

    const canonicalFingerprint = item?.metadata.contentFingerprint
    if (reference.conflicted || (canonicalFingerprint && canonicalFingerprint !== reference.source.fingerprint)) {
      missingMediaIds.push(mediaId)
      conflictingMediaIds.push(mediaId)
      continue
    }
    if (!item || item.lifecycleStatus === 'deletion_pending') {
      missingMediaIds.push(mediaId)
      continue
    }
    readable.push({ entry, item })
  }

  const readSource = options.readSource ?? defaultReadSource
  const fileResults = await mapWithConcurrency(readable, MEDIA_BATCH_CONCURRENCY, async ({ entry, item }) => {
    try {
      const file = await readSource(item)
      const validated = await validatePixGridDeckSourceFile(file)
      if (!validated.ok || validated.source.fingerprint !== entry.fingerprint) {
        return { ok: false as const, mediaId: entry.mediaId, conflicted: true }
      }
      return { ok: true as const, mediaId: entry.mediaId, file }
    } catch {
      return { ok: false as const, mediaId: entry.mediaId, conflicted: false }
    }
  })
  const files = fileResults.flatMap(result => result.ok ? [{ mediaId: result.mediaId, file: result.file }] : [])
  for (const result of fileResults) {
    if (!result.ok && !missingMediaIds.includes(result.mediaId)) missingMediaIds.push(result.mediaId)
    if (!result.ok && result.conflicted && !conflictingMediaIds.includes(result.mediaId)) conflictingMediaIds.push(result.mediaId)
  }

  return {
    manifest: {
      schemaVersion: PIX_GRID_DECK_PROJECT_MEDIA_MANIFEST_VERSION,
      decks,
      sources,
      missingMediaIds: missingMediaIds.sort(),
      conflictingMediaIds: conflictingMediaIds.sort(),
    },
    files,
  }
}

/**
 * Restores bundle files through mediaStore and reconnects only successfully
 * restored references. Missing sources remain explicit and do not damage other
 * project assets or silently invalidate a Deck.
 */
export async function importPixGridDeckProjectMediaBundle(
  bundle: PixGridDeckProjectMediaBundle,
): Promise<PixGridDeckProjectImportResult> {
  if (bundle.manifest.schemaVersion !== PIX_GRID_DECK_PROJECT_MEDIA_MANIFEST_VERSION) {
    return {
      decks: normalizePixGridDeckCollection(bundle.manifest.decks),
      mediaIdMap: {},
      missingMediaIds: bundle.manifest.sources.map(source => source.mediaId),
      errors: [{ mediaId: '*', message: 'Unsupported PixGrid Deck source-media manifest version.' }],
    }
  }

  const fileByMediaId = new Map(bundle.files.map(entry => [entry.mediaId, entry.file]))
  const mediaIdMap: Record<string, string> = {}
  const restoredSources = new Map<string, Omit<PixGridDeckSourceSnapshot, 'transparentBackground'>>()
  const conflictingMediaIds = new Set(bundle.manifest.conflictingMediaIds ?? [])
  const missingMediaIds = new Set([
    ...bundle.manifest.missingMediaIds,
    ...(bundle.manifest.conflictingMediaIds ?? []),
  ])
  const errors: Array<{ mediaId: string; message: string }> = []

  for (const entry of bundle.manifest.sources) {
    if (conflictingMediaIds.has(entry.mediaId)) {
      errors.push({ mediaId: entry.mediaId, message: 'The project contains conflicting source snapshots for this media ID.' })
      continue
    }
    const file = fileByMediaId.get(entry.mediaId)
    if (!file) {
      missingMediaIds.add(entry.mediaId)
      continue
    }
    const validated = await validatePixGridDeckSourceFile(file)
    if (!validated.ok) {
      missingMediaIds.add(entry.mediaId)
      errors.push({ mediaId: entry.mediaId, message: validated.error.message })
      continue
    }
    if (validated.source.fingerprint !== entry.fingerprint) {
      missingMediaIds.add(entry.mediaId)
      errors.push({ mediaId: entry.mediaId, message: 'The packaged source fingerprint does not match the project manifest.' })
      continue
    }

    const uploaded = await useMediaStore.getState().uploadCanonicalVisualFile(file, {
      metadata: {
        width: validated.source.width ?? undefined,
        height: validated.source.height ?? undefined,
        hasAlpha: validated.source.hasAlpha,
        contentFingerprint: validated.source.fingerprint,
        detectedMimeType: validated.source.mimeType,
      },
    })
    if (!uploaded.ok) {
      missingMediaIds.add(entry.mediaId)
      errors.push({ mediaId: entry.mediaId, message: uploaded.error })
      continue
    }
    mediaIdMap[entry.mediaId] = uploaded.item.id
    restoredSources.set(entry.mediaId, {
      mediaRevision: uploaded.item.revision ?? 1,
      fingerprint: validated.source.fingerprint,
      fileName: uploaded.item.name,
      mimeType: validated.source.mimeType,
      width: validated.source.width,
      height: validated.source.height,
      hasAlpha: validated.source.hasAlpha,
    })
    missingMediaIds.delete(entry.mediaId)
  }

  const decks = normalizePixGridDeckCollection(bundle.manifest.decks.map(deck => ({
    ...deck,
    items: deck.items.map(item => {
      const mediaId = mediaIdMap[item.mediaId]
      if (!mediaId) return item
      const restoredSource = restoredSources.get(item.mediaId)
      return {
        ...item,
        mediaId,
        source: restoredSource
          ? { ...restoredSource, transparentBackground: item.source.transparentBackground }
          : item.source,
      }
    }),
  })))

  return {
    decks,
    mediaIdMap,
    missingMediaIds: [...missingMediaIds].sort(),
    errors,
  }
}
