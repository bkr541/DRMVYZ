import type { BrandKitAssetWithMedia } from './BrandKitTypes'
import { createSignedMediaUrl } from '../../lib/mediaDb'

export type BrandAssetLoadStatus = 'idle' | 'loading' | 'ready' | 'stale' | 'missing' | 'error'

export interface BrandAssetRuntimeEntry {
  key: string
  userId: string
  mediaItemId: string
  image: CanvasImageSource | null
  status: BrandAssetLoadStatus
  source: 'local' | 'signed' | 'none'
  lastError: string | null
  updatedAt: number
}

interface CacheRecord extends BrandAssetRuntimeEntry {
  pending: Promise<BrandAssetRuntimeEntry> | null
  ownedObjectUrl: string | null
  sourceUrl: string | null
  signedExpiresAt: number
}

interface RuntimeDependencies {
  now: () => number
  sign: (storagePath: string, expiresIn: number) => Promise<{ url: string | null; error: string | null }>
  fetchBlob: (url: string) => Promise<Blob>
  decode: (url: string) => Promise<CanvasImageSource>
  createObjectUrl: (blob: Blob) => string
  revokeObjectUrl: (url: string) => void
}

const SIGNED_URL_TTL_SECONDS = 3600
const SIGNED_URL_REFRESH_BUFFER_MS = 5 * 60 * 1000
const cache = new Map<string, CacheRecord>()
const listeners = new Set<() => void>()
let snapshot: BrandAssetRuntimeEntry[] = []

function defaultDecode(url: string): Promise<CanvasImageSource> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.decoding = 'async'
    image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Brand asset image could not be decoded'))
    image.src = url
  })
}

const dependencies: RuntimeDependencies = {
  now: () => Date.now(),
  sign: createSignedMediaUrl,
  fetchBlob: async url => {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`Brand asset request failed (${response.status})`)
    return response.blob()
  },
  decode: defaultDecode,
  createObjectUrl: blob => URL.createObjectURL(blob),
  revokeObjectUrl: url => URL.revokeObjectURL(url),
}

function notify(): void {
  snapshot = [...cache.values()].map(publicEntry)
  for (const listener of listeners) listener()
}

function cacheKey(userId: string, mediaItemId: string): string {
  return `${userId}:${mediaItemId}`
}

function publicEntry(record: CacheRecord): BrandAssetRuntimeEntry {
  return {
    key: record.key,
    userId: record.userId,
    mediaItemId: record.mediaItemId,
    image: record.image,
    status: record.status,
    source: record.source,
    lastError: record.lastError,
    updatedAt: record.updatedAt,
  }
}

function releaseOwnedUrl(record: CacheRecord): void {
  if (!record.ownedObjectUrl) return
  dependencies.revokeObjectUrl(record.ownedObjectUrl)
  record.ownedObjectUrl = null
}

async function decodeSignedStorage(record: CacheRecord, storagePath: string): Promise<CanvasImageSource> {
  const signed = await dependencies.sign(storagePath, SIGNED_URL_TTL_SECONDS)
  if (!signed.url) throw new Error(signed.error ?? 'Brand asset signed URL is unavailable')
  const blob = await dependencies.fetchBlob(signed.url)
  const objectUrl = dependencies.createObjectUrl(blob)
  try {
    const image = await dependencies.decode(objectUrl)
    releaseOwnedUrl(record)
    record.ownedObjectUrl = objectUrl
    record.signedExpiresAt = dependencies.now() + SIGNED_URL_TTL_SECONDS * 1000
    return image
  } catch (error) {
    dependencies.revokeObjectUrl(objectUrl)
    throw error
  }
}

/**
 * Resolve and decode one linked Brand Kit asset. Runtime objects and URLs live
 * only in this module-level, account-keyed cache and are never persisted.
 */
export function resolveBrandAssetRuntime(input: {
  userId: string
  asset: BrandKitAssetWithMedia
  localUrl?: string | null
}): Promise<BrandAssetRuntimeEntry> {
  const { userId, asset } = input
  const key = cacheKey(userId, asset.mediaItemId)
  const current = cache.get(key)
  if (!input.localUrl && !asset.media?.storagePath) {
    if (current) {
      releaseOwnedUrl(current)
      cache.delete(key)
    }
    const missing: CacheRecord = {
      key, userId, mediaItemId: asset.mediaItemId, image: null, status: 'missing', source: 'none',
      lastError: 'Linked media is missing or was deleted', updatedAt: dependencies.now(), pending: null,
      ownedObjectUrl: null, sourceUrl: null, signedExpiresAt: 0,
    }
    cache.set(key, missing)
    notify()
    return Promise.resolve(publicEntry(missing))
  }
  if (current?.pending) return current.pending
  if (current?.image && input.localUrl && current.sourceUrl === input.localUrl) {
    return Promise.resolve(publicEntry(current))
  }
  if (current?.image && !input.localUrl && current.signedExpiresAt - dependencies.now() > SIGNED_URL_REFRESH_BUFFER_MS) {
    return Promise.resolve(publicEntry(current))
  }

  const record: CacheRecord = current ?? {
    key,
    userId,
    mediaItemId: asset.mediaItemId,
    image: null,
    status: 'idle',
    source: 'none',
    lastError: null,
    updatedAt: dependencies.now(),
    pending: null,
    ownedObjectUrl: null,
    sourceUrl: null,
    signedExpiresAt: 0,
  }
  cache.set(key, record)
  record.status = 'loading'
  record.lastError = null
  notify()

  record.pending = (async () => {
    try {
      let image: CanvasImageSource
      if (input.localUrl) {
        try {
          image = await dependencies.decode(input.localUrl)
          record.source = 'local'
          record.sourceUrl = input.localUrl
        } catch (localError) {
          if (!asset.media?.storagePath) throw localError
          image = await decodeSignedStorage(record, asset.media.storagePath)
          record.source = 'signed'
          record.sourceUrl = null
        }
      } else if (asset.media?.storagePath) {
        image = await decodeSignedStorage(record, asset.media.storagePath)
        record.source = 'signed'
        record.sourceUrl = null
      } else {
        releaseOwnedUrl(record)
        record.image = null
        record.status = 'missing'
        record.source = 'none'
        record.lastError = 'Linked media is missing or was deleted'
        record.updatedAt = dependencies.now()
        return publicEntry(record)
      }
      // Account changes and sign-out may clear this record while decode is in
      // flight. Do not retain an orphaned object URL or resurrect stale state.
      if (cache.get(key) !== record) {
        releaseOwnedUrl(record)
        return { ...publicEntry(record), image: null, status: 'idle', source: 'none' }
      }
      record.image = image
      record.status = 'ready'
      record.lastError = null
      record.updatedAt = dependencies.now()
      return publicEntry(record)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      // Preserve the last decoded active mark through a temporary outage.
      record.status = record.image ? 'stale' : 'error'
      record.lastError = message
      record.updatedAt = dependencies.now()
      return publicEntry(record)
    } finally {
      record.pending = null
      notify()
    }
  })()
  return record.pending
}

export function preloadBrandAssets(input: {
  userId: string
  assets: readonly BrandKitAssetWithMedia[]
  localUrls?: ReadonlyMap<string, string>
}): void {
  for (const asset of input.assets) {
    if (!asset.media) continue
    void resolveBrandAssetRuntime({
      userId: input.userId,
      asset,
      localUrl: input.localUrls?.get(asset.mediaItemId) ?? null,
    })
  }
}

export function getBrandAssetCacheSnapshot(): BrandAssetRuntimeEntry[] {
  return snapshot
}

export function subscribeBrandAssetRuntime(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function clearBrandAssetRuntimeForUser(userId: string): void {
  for (const [key, record] of cache) {
    if (record.userId !== userId) continue
    releaseOwnedUrl(record)
    cache.delete(key)
  }
  notify()
}

export function clearAllBrandAssetRuntime(): void {
  for (const record of cache.values()) releaseOwnedUrl(record)
  cache.clear()
  notify()
}

/** Test-only dependency seam. */
export function configureBrandAssetRuntimeForTests(patch: Partial<RuntimeDependencies>): () => void {
  const previous = { ...dependencies }
  Object.assign(dependencies, patch)
  return () => Object.assign(dependencies, previous)
}
