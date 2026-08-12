// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mediaDbMocks = vi.hoisted(() => ({
  listMediaItems: vi.fn(),
  listMediaItemsPage: vi.fn(),
  createMediaItem: vi.fn(),
  saveMediaItemAtomic: vi.fn(),
  reorderMediaCollectionAtomic: vi.fn(),
  deleteMediaItem: vi.fn(),
  createSignedMediaUrl: vi.fn(),
  uploadMediaFile: vi.fn(),
  deleteMediaFiles: vi.fn(),
  deleteMediaFile: vi.fn(),
  beginMediaUpload: vi.fn(),
  finalizeMediaUploadAtomic: vi.fn(),
  markMediaUploadCleanupPending: vi.fn(),
  updateMediaCleanupJob: vi.fn(),
  requestMediaDeletion: vi.fn(),
  finalizeMediaDeletion: vi.fn(),
  listPendingMediaCleanup: vi.fn(),
  setMediaItemTags: vi.fn(),
  listMediaItemTagNames: vi.fn(),
  listMediaCollections: vi.fn(),
  createMediaCollection: vi.fn(),
  updateMediaCollection: vi.fn(),
  deleteMediaCollection: vi.fn(),
  listMediaItemCollectionIds: vi.fn(),
  setMediaItemCollections: vi.fn(),
}))

const runtimeMocks = vi.hoisted(() => ({
  visual: {
    activeMediaId: null as string | null,
    setActiveMedia: vi.fn<(id: string | null) => void>(),
    remapMediaId: vi.fn<(from: string, to: string) => void>(),
    removeMediaReferences: vi.fn<(id: string) => void>(),
  },
  audio: {
    loadError: null as string | null,
    uploadAndSaveTrack: vi.fn(),
  },
  analyzeAudioFile: vi.fn(),
  cleanupRemovedSvgMedia: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({
  supabaseConfigured: true,
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
    },
  },
}))
vi.mock('../lib/mediaDb', () => mediaDbMocks)
vi.mock('./visualStore', () => ({ useVisualStore: { getState: () => runtimeMocks.visual } }))
vi.mock('./audioStore', () => ({ useAudioStore: { getState: () => runtimeMocks.audio } }))
vi.mock('../utils/analyzeAudioFile', () => ({ analyzeAudioFile: runtimeMocks.analyzeAudioFile }))
vi.mock('../components/vyzualz/media/generateThumbnail', () => ({
  generateThumbnail: vi.fn().mockResolvedValue({ thumbnailObjectUrl: null, analyzedAt: null }),
  clearFilmstripCache: vi.fn(),
  clearMediaGenerationCaches: vi.fn(),
}))
vi.mock('../components/vyzualz/react/services/svgMediaBridge', () => ({
  cleanupRemovedSvgMedia: runtimeMocks.cleanupRemovedSvgMedia,
  precacheUploadedSvgGlyph: vi.fn(),
}))
vi.mock('../features/personalization/mediaPaletteMetadata', () => ({
  analyzePaletteForMediaFile: vi.fn().mockResolvedValue({}),
  mergeMediaMetadata: (base: Record<string, unknown>, patch: Record<string, unknown>) => ({ ...base, ...patch }),
}))
vi.mock('../components/vyzualz/react/renderers/svgCapabilityAnalysis', () => ({
  analyzeSvgCapabilities: vi.fn().mockReturnValue({ isValidSvg: true }),
}))

import type { SaveMediaItemAtomicInput } from '../lib/mediaDb'
import type { UploadedMedia } from './mediaStore'
import { mediaMutationKey, registerMediaDeletionGuard, useMediaStore } from './mediaStore'
import { createPixGridDeckMediaDeletionGuard } from '../components/vyzualz/react/pixGrid/PixGridDeckMediaDeletion'
import type { PixGridDeckDefinition } from '../components/vyzualz/react/pixGrid/PixGridDeckDomain'
import { supabase } from '../lib/supabase'
import { useReactStore } from './reactStore'

function mediaItem(overrides: Partial<UploadedMedia> = {}): UploadedMedia {
  return {
    id: 'db-media-1',
    dbId: 'media-1',
    storagePath: 'user-1/media-1/image.png',
    mimeType: 'image/png',
    name: 'image.png',
    title: 'Image',
    description: 'Original',
    type: 'image',
    url: 'https://signed.example/image.png',
    thumbnailUrl: 'https://signed.example/image.png',
    meta: 'PNG · 1920×1080',
    favorite: false,
    mediaRole: 'background_image',
    tags: ['original'],
    collectionIds: ['collection-1'],
    metadata: { width: 1920, height: 1080 },
    revision: 1,
    ...overrides,
  }
}

function canonical(input: SaveMediaItemAtomicInput, overrides: Record<string, unknown> = {}) {
  const item = mediaItem({ id: `db-${input.mediaItemId}`, dbId: input.mediaItemId })
  return {
    id: input.mediaItemId,
    user_id: 'user-1',
    name: item.name,
    type: item.type,
    storage_path: item.storagePath,
    thumbnail_path: null,
    width: item.metadata.width ?? null,
    height: item.metadata.height ?? null,
    duration_sec: null,
    file_size: null,
    mime_type: item.mimeType,
    favorite: input.patch.favorite,
    media_role: input.patch.media_role,
    title: input.patch.title,
    description: input.patch.description,
    metadata: input.patch.metadata,
    revision: input.expectedRevision + 1,
    created_at: '2026-07-01T00:00:00.000Z',
    updated_at: '2026-07-11T00:00:00.000Z',
    tags: input.tagNames,
    collection_ids: input.collectionIds,
    ...overrides,
  }
}

function uploadCanonical(operationId: string, overrides: Record<string, unknown> = {}) {
  return {
    id: 'uploaded-media', user_id: 'user-1', name: 'visual.png', type: 'image',
    storage_path: `user-1/uploads/${operationId}/original.png`, thumbnail_path: `user-1/uploads/${operationId}/original.png`,
    width: 640, height: 360, duration_sec: null, file_size: 3, mime_type: 'image/png',
    favorite: false, media_role: 'overlay', title: 'Visual', description: null, metadata: { width: 640, height: 360 },
    revision: 1, upload_operation_id: operationId, lifecycle_status: 'complete', derivative_paths: [],
    created_at: '2026-07-11T00:00:00.000Z', updated_at: '2026-07-11T00:00:00.000Z',
    tags: ['live'], collection_ids: ['collection-1'], ...overrides,
  }
}

function resetStore() {
  useMediaStore.setState({
    items: [], queryItemIds: [], collections: [], loading: false, nextPageLoading: false, refreshing: false,
    hasMore: true, cursor: null, libraryQuery: { search: '', filter: 'all', scope: 'all', collectionId: null, sort: 'created_desc' },
    libraryQueryKey: JSON.stringify({ search: '', filter: 'all', scope: 'all', collectionId: null, sort: 'created_desc' }),
    queryError: null, lastSuccessfulLoad: null, invalidated: true, accountId: null, collectionsLoading: false,
    loadError: null, deleteError: null, pendingDeletionWarning: null, authRequired: false, storageAvailable: true,
    lastRestored: null, activeFilter: 'all', mutationStates: {}, collectionOrderMutations: {}, deletionStates: {}, uploadCleanupStates: {},
    importModalOpen: false, uploadQueue: [],
    uploadDrafts: {}, activeUploadDraftKey: null, analyzingAudioTempIds: new Set(),
  })
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(res => { resolve = res })
  return { promise, resolve }
}

describe('Media Manager canonical workflows', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:test'), revokeObjectURL: vi.fn() })
    vi.stubGlobal('Image', class {
      naturalWidth = 640
      naturalHeight = 360
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      set src(_value: string) { queueMicrotask(() => this.onload?.()) }
    })
    resetStore()
    runtimeMocks.visual.activeMediaId = null
    runtimeMocks.visual.setActiveMedia.mockImplementation(id => { runtimeMocks.visual.activeMediaId = id })
    runtimeMocks.visual.removeMediaReferences.mockImplementation(id => {
      if (runtimeMocks.visual.activeMediaId === id) runtimeMocks.visual.activeMediaId = null
    })
    runtimeMocks.audio.loadError = null
    runtimeMocks.audio.uploadAndSaveTrack.mockReset()
    runtimeMocks.analyzeAudioFile.mockResolvedValue(null)

    mediaDbMocks.listMediaItems.mockResolvedValue({ rows: [], error: null })
    mediaDbMocks.listMediaItemsPage.mockResolvedValue({ ok: true, page: { items: [], nextCursor: null, hasMore: false } })
    mediaDbMocks.listMediaItemTagNames.mockResolvedValue({ tagMap: new Map(), error: null })
    mediaDbMocks.listMediaItemCollectionIds.mockResolvedValue({ collMap: new Map(), error: null })
    mediaDbMocks.listMediaCollections.mockResolvedValue({ rows: [], error: null })
    mediaDbMocks.saveMediaItemAtomic.mockImplementation(async (input: SaveMediaItemAtomicInput) => ({
      ok: true, kind: 'success', mediaItem: canonical(input),
    }))
    mediaDbMocks.reorderMediaCollectionAtomic.mockResolvedValue({ ok: true, kind: 'success', orderedMediaIds: [] })
    mediaDbMocks.deleteMediaItem.mockResolvedValue({ error: null })
    mediaDbMocks.deleteMediaFiles.mockResolvedValue({ error: null })
    mediaDbMocks.deleteMediaFile.mockResolvedValue({ error: null })
    mediaDbMocks.uploadMediaFile.mockResolvedValue({ error: null, reused: false })
    mediaDbMocks.listPendingMediaCleanup.mockResolvedValue({ rows: [], error: null })
    mediaDbMocks.requestMediaDeletion.mockResolvedValue({
      ok: true,
      reconciled: false,
      cleanupJob: {
        id: 'cleanup-1', user_id: 'user-1', media_item_id: 'media-1', upload_operation_id: null,
        kind: 'media_deletion', status: 'pending', storage_paths: ['user-1/media-1/image.png'],
        completed_paths: [], last_error: null, created_at: '2026-07-11T00:00:00.000Z',
        updated_at: '2026-07-11T00:00:00.000Z', completed_at: null,
      },
    })
    mediaDbMocks.updateMediaCleanupJob.mockImplementation(async (_id: string, completed: string[], status: string, error: string | null) => ({
      ok: true,
      cleanupJob: {
        id: 'cleanup-1', user_id: 'user-1', media_item_id: 'media-1', upload_operation_id: null,
        kind: 'media_deletion', status, storage_paths: ['user-1/media-1/image.png'],
        completed_paths: completed, last_error: error, created_at: '2026-07-11T00:00:00.000Z',
        updated_at: '2026-07-11T00:00:00.000Z', completed_at: null,
      },
    }))
    mediaDbMocks.finalizeMediaDeletion.mockResolvedValue({ ok: true, mediaItemId: 'media-1' })
    mediaDbMocks.beginMediaUpload.mockResolvedValue({ ok: true, mediaItem: null, operationStatus: 'uploading', phase: 'uploading_original' })
    mediaDbMocks.finalizeMediaUploadAtomic.mockImplementation(async (input: { operationId: string }) => ({
      ok: true, mediaItem: uploadCanonical(input.operationId), reconciled: false,
    }))
    mediaDbMocks.markMediaUploadCleanupPending.mockImplementation(async (operationId: string, paths: string[], error: string) => ({
      ok: true,
      cleanupJob: {
        id: 'upload-cleanup-1', user_id: 'user-1', media_item_id: null, upload_operation_id: operationId,
        kind: 'upload_rollback', status: 'pending', storage_paths: paths, completed_paths: [], last_error: error,
        created_at: '2026-07-11T00:00:00.000Z', updated_at: '2026-07-11T00:00:00.000Z', completed_at: null,
      },
    }))
    mediaDbMocks.createMediaItem.mockResolvedValue({ id: 'media-retried', revision: 1, error: null })
    mediaDbMocks.updateMediaCollection.mockResolvedValue({ error: null })
    mediaDbMocks.deleteMediaCollection.mockResolvedValue({ error: null })
  })

  it('commits metadata, tags, and collections from one canonical server result', async () => {
    const item = mediaItem()
    useMediaStore.setState({ items: [item] })
    mediaDbMocks.saveMediaItemAtomic.mockImplementationOnce(async (input: SaveMediaItemAtomicInput) => ({
      ok: true,
      kind: 'success',
      mediaItem: canonical(input, {
        title: 'SERVER NORMALIZED', tags: ['cyan', 'live'], collection_ids: ['collection-2'], revision: 2,
      }),
    }))

    const saved = await useMediaStore.getState().saveMediaEdits(item.id, {
      role: 'overlay', title: ' Updated Overlay ', description: ' New description ',
      tags: ['live', 'cyan'], collectionIds: ['collection-2'], metadata: { hasAlpha: true, loopable: true },
    })

    expect(saved).toBe(true)
    expect(mediaDbMocks.saveMediaItemAtomic).toHaveBeenCalledTimes(1)
    expect(mediaDbMocks.saveMediaItemAtomic).toHaveBeenCalledWith(expect.objectContaining({
      mediaItemId: 'media-1', expectedRevision: 1,
      patch: expect.objectContaining({ media_role: 'overlay', title: 'Updated Overlay' }),
      tagNames: ['live', 'cyan'], collectionIds: ['collection-2'],
    }))
    expect(useMediaStore.getState().items[0]).toMatchObject({
      title: 'SERVER NORMALIZED', tags: ['cyan', 'live'], collectionIds: ['collection-2'], revision: 2,
    })
  })

  it('surfaces a stale revision conflict and preserves the attempted edit', async () => {
    const item = mediaItem()
    useMediaStore.setState({ items: [item] })
    mediaDbMocks.saveMediaItemAtomic.mockResolvedValueOnce({
      ok: false, kind: 'conflict', message: 'Changed elsewhere', currentRevision: 4,
      mediaItem: canonical({
        mediaItemId: 'media-1', expectedRevision: 3,
        patch: { media_role: 'background_image', title: 'Server title', description: 'Server', favorite: false, metadata: item.metadata },
        tagNames: ['server'], collectionIds: ['collection-1'],
      }, { revision: 4 }),
    })

    const saved = await useMediaStore.getState().saveMediaEdits(item.id, {
      role: 'overlay', title: 'My attempted title', description: 'Mine', tags: ['mine'],
      collectionIds: ['collection-2'], metadata: { hasAlpha: true },
    })

    expect(saved).toBe(false)
    expect(useMediaStore.getState().items[0]).toMatchObject({ title: 'Server title', tags: ['server'], revision: 4 })
    const conflict = useMediaStore.getState().mutationStates[mediaMutationKey(item.id, 'edit')]
    expect(conflict).toMatchObject({ status: 'conflict', attempted: { title: 'My attempted title', tags: ['mine'] } })
  })

  it('reapplies the preserved attempt using the refreshed canonical revision', async () => {
    const item = mediaItem()
    useMediaStore.setState({ items: [item] })
    mediaDbMocks.saveMediaItemAtomic
      .mockResolvedValueOnce({
        ok: false, kind: 'conflict', message: 'Changed elsewhere', currentRevision: 4,
        mediaItem: canonical({
          mediaItemId: 'media-1', expectedRevision: 3,
          patch: { media_role: 'background_image', title: 'Server title', description: null, favorite: false, metadata: item.metadata },
          tagNames: ['server'], collectionIds: ['collection-1'],
        }, { revision: 4 }),
      })
      .mockImplementationOnce(async (input: SaveMediaItemAtomicInput) => ({ ok: true, kind: 'success', mediaItem: canonical(input) }))

    await useMediaStore.getState().saveMediaEdits(item.id, {
      role: 'overlay', title: 'My attempted title', description: 'Mine', tags: ['mine'],
      collectionIds: ['collection-2'], metadata: { hasAlpha: true },
    })
    const reapplied = await useMediaStore.getState().reapplyMediaMutation(item.id, 'edit')

    expect(reapplied).toBe(true)
    expect(mediaDbMocks.saveMediaItemAtomic).toHaveBeenLastCalledWith(expect.objectContaining({ expectedRevision: 4 }))
    expect(useMediaStore.getState().items[0]).toMatchObject({ title: 'My attempted title', tags: ['mine'], revision: 5 })
    expect(useMediaStore.getState().mutationStates[mediaMutationKey(item.id, 'edit')]).toBeUndefined()
  })

  it.each([
    ['role', async (id: string) => useMediaStore.getState().setMediaRole(id, 'overlay')],
    ['favorite', async (id: string) => useMediaStore.getState().toggleFavorite(id)],
  ] as const)('keeps a failed %s mutation visibly unapplied', async (operation, mutate) => {
    const item = mediaItem()
    useMediaStore.setState({ items: [item] })
    mediaDbMocks.saveMediaItemAtomic.mockResolvedValueOnce({ ok: false, kind: 'transport', message: 'Network rejected' })

    expect(await mutate(item.id)).toBe(false)
    expect(useMediaStore.getState().items[0]).toEqual(item)
    expect(useMediaStore.getState().mutationStates[mediaMutationKey(item.id, operation)]).toMatchObject({
      status: 'failed', message: 'Network rejected',
    })
  })

  it('rebases an operation retry without overwriting newer unrelated canonical fields', async () => {
    const item = mediaItem()
    useMediaStore.setState({ items: [item] })
    mediaDbMocks.saveMediaItemAtomic
      .mockResolvedValueOnce({ ok: false, kind: 'transport', message: 'Offline' })
      .mockImplementationOnce(async (input: SaveMediaItemAtomicInput) => ({ ok: true, kind: 'success', mediaItem: canonical(input) }))

    expect(await useMediaStore.getState().toggleFavorite(item.id)).toBe(false)
    useMediaStore.setState({
      items: [{ ...useMediaStore.getState().items[0], mediaRole: 'overlay', revision: 2 }],
    })

    expect(await useMediaStore.getState().retryMediaMutation(item.id, 'favorite')).toBe(true)
    expect(mediaDbMocks.saveMediaItemAtomic).toHaveBeenLastCalledWith(expect.objectContaining({
      expectedRevision: 2,
      patch: expect.objectContaining({ favorite: true, media_role: 'overlay' }),
    }))
  })

  it('does not leave a failed add-to-collection falsely applied', async () => {
    const item = mediaItem({ collectionIds: [] })
    useMediaStore.setState({ items: [item] })
    mediaDbMocks.saveMediaItemAtomic.mockResolvedValueOnce({ ok: false, kind: 'validation', message: 'Foreign collection' })

    await useMediaStore.getState().addMediaToCollection('collection-2', [item.id])

    expect(useMediaStore.getState().items[0].collectionIds).toEqual([])
    expect(useMediaStore.getState().mutationStates[mediaMutationKey(item.id, 'add-to-collection')]).toMatchObject({ status: 'failed' })
  })

  it('restores canonical membership after a failed remove-from-collection', async () => {
    const item = mediaItem({ collectionIds: ['collection-1'] })
    useMediaStore.setState({ items: [item] })
    mediaDbMocks.saveMediaItemAtomic.mockResolvedValueOnce({ ok: false, kind: 'transport', message: 'Offline' })

    await useMediaStore.getState().removeMediaFromCollection('collection-1', [item.id])

    expect(useMediaStore.getState().items[0].collectionIds).toEqual(['collection-1'])
    expect(useMediaStore.getState().mutationStates[mediaMutationKey(item.id, 'remove-from-collection')]).toMatchObject({ status: 'failed' })
  })

  it('tracks independent pending operations on separate items without global blocking', async () => {
    const first = mediaItem()
    const second = mediaItem({ id: 'db-media-2', dbId: 'media-2', revision: 7 })
    useMediaStore.setState({ items: [first, second] })
    const firstResult = deferred<unknown>()
    const secondResult = deferred<unknown>()
    mediaDbMocks.saveMediaItemAtomic.mockImplementation((input: SaveMediaItemAtomicInput) =>
      input.mediaItemId === 'media-1' ? firstResult.promise : secondResult.promise)

    const firstPromise = useMediaStore.getState().toggleFavorite(first.id)
    const secondPromise = useMediaStore.getState().setMediaRole(second.id, 'overlay')
    await Promise.resolve(); await Promise.resolve()

    expect(useMediaStore.getState().mutationStates[mediaMutationKey(first.id, 'favorite')]?.status).toBe('pending')
    expect(useMediaStore.getState().mutationStates[mediaMutationKey(second.id, 'role')]?.status).toBe('pending')

    firstResult.resolve({ ok: true, kind: 'success', mediaItem: canonical({
      mediaItemId: 'media-1', expectedRevision: 1,
      patch: { media_role: first.mediaRole, title: first.title ?? null, description: first.description ?? null, favorite: true, metadata: first.metadata },
      tagNames: first.tags, collectionIds: first.collectionIds,
    }) })
    await firstPromise
    expect(useMediaStore.getState().mutationStates[mediaMutationKey(second.id, 'role')]?.status).toBe('pending')

    secondResult.resolve({ ok: false, kind: 'transport', message: 'Second failed' })
    await secondPromise
    expect(useMediaStore.getState().mutationStates[mediaMutationKey(second.id, 'role')]?.status).toBe('failed')
  })

  it('reconciles collection ordering from the canonical returned order', async () => {
    const a = mediaItem({ id: 'db-a', dbId: 'a' })
    const b = mediaItem({ id: 'db-b', dbId: 'b' })
    const c = mediaItem({ id: 'db-c', dbId: 'c' })
    useMediaStore.setState({ items: [a, b, c] })
    mediaDbMocks.reorderMediaCollectionAtomic.mockResolvedValueOnce({ ok: true, kind: 'success', orderedMediaIds: ['c', 'a', 'b'] })

    expect(await useMediaStore.getState().reorderCollectionItems('collection-1', ['db-c', 'db-a', 'db-b'])).toBe(true)
    expect(useMediaStore.getState().items.map(item => item.id)).toEqual(['db-c', 'db-a', 'db-b'])
    expect(useMediaStore.getState().collectionOrderMutations['collection-1']).toBeUndefined()
  })

  it('rejects duplicate reorder entries before contacting the server', async () => {
    const a = mediaItem({ id: 'db-a', dbId: 'a' })
    const b = mediaItem({ id: 'db-b', dbId: 'b' })
    useMediaStore.setState({ items: [a, b] })

    expect(await useMediaStore.getState().reorderCollectionItems('collection-1', ['db-a', 'db-a'])).toBe(false)
    expect(mediaDbMocks.reorderMediaCollectionAtomic).not.toHaveBeenCalled()
    expect(useMediaStore.getState().collectionOrderMutations['collection-1']).toMatchObject({ status: 'failed' })
  })

  it('preserves the complete prior order when the atomic reorder is rejected', async () => {
    const a = mediaItem({ id: 'db-a', dbId: 'a' })
    const b = mediaItem({ id: 'db-b', dbId: 'b' })
    const c = mediaItem({ id: 'db-c', dbId: 'c' })
    useMediaStore.setState({ items: [a, b, c] })
    mediaDbMocks.reorderMediaCollectionAtomic.mockResolvedValueOnce({ ok: false, kind: 'validation', message: 'Foreign media item' })

    expect(await useMediaStore.getState().reorderCollectionItems('collection-1', ['db-c', 'db-b', 'db-a'])).toBe(false)
    expect(useMediaStore.getState().items.map(item => item.id)).toEqual(['db-a', 'db-b', 'db-c'])
    expect(useMediaStore.getState().collectionOrderMutations['collection-1']).toMatchObject({
      status: 'failed', attemptedOrder: ['db-c', 'db-b', 'db-a'], previousOrder: ['db-a', 'db-b', 'db-c'],
    })
  })

  it('removes a selected item only after persistence succeeds and selects a safe fallback', async () => {
    const selected = mediaItem()
    const fallback = mediaItem({ id: 'db-media-2', dbId: 'media-2', name: 'fallback.png' })
    useMediaStore.setState({ items: [selected, fallback] })
    runtimeMocks.visual.activeMediaId = selected.id

    expect(await useMediaStore.getState().removeItem(selected.id)).toBe(true)
    expect(mediaDbMocks.requestMediaDeletion).toHaveBeenCalledWith(selected.dbId)
    expect(mediaDbMocks.deleteMediaFile).toHaveBeenCalledWith(selected.storagePath)
    expect(mediaDbMocks.finalizeMediaDeletion).toHaveBeenCalledWith('cleanup-1')
    expect(useMediaStore.getState().items).toEqual([fallback])
    expect(runtimeMocks.visual.setActiveMedia).toHaveBeenCalledWith(fallback.id)
  })

  it('keeps failed files in the queue and reports partial audio upload failures', async () => {
    const first = new File(['one'], 'one.wav', { type: 'audio/wav' })
    const second = new File(['two'], 'two.wav', { type: 'audio/wav' })
    runtimeMocks.audio.uploadAndSaveTrack
      .mockResolvedValueOnce({ id: 'audio-one', dbId: 'one' })
      .mockImplementationOnce(async () => { runtimeMocks.audio.loadError = 'Storage quota exceeded'; return null })

    expect(useMediaStore.getState().addFilesToUploadQueue([first, second])).toBe(2)
    const result = await useMediaStore.getState().uploadQueuedMedia()

    expect(result).toMatchObject({ total: 2, succeeded: 1 })
    expect(useMediaStore.getState().uploadQueue.map(item => item.file.name)).toEqual(['two.wav'])
  })

  it('exposes the canonical visual upload/finalization path for Deck ingestion without a second uploader', async () => {
    const file = new File(['png'], 'deck-source.png', { type: 'image/png' })
    const result = await useMediaStore.getState().uploadCanonicalVisualFile(file, {
      metadata: {
        width: 640,
        height: 360,
        hasAlpha: true,
        contentFingerprint: 'sha256:deck-source',
        detectedMimeType: 'image/png',
      },
    })

    expect(result).toMatchObject({ ok: true, item: { id: 'db-uploaded-media', revision: 1 } })
    expect(mediaDbMocks.finalizeMediaUploadAtomic).toHaveBeenCalledWith(expect.objectContaining({
      media: expect.objectContaining({
        name: 'deck-source.png',
        metadata: expect.objectContaining({ contentFingerprint: 'sha256:deck-source', detectedMimeType: 'image/png' }),
      }),
    }))
    expect(useMediaStore.getState().items).toHaveLength(1)
  })

  it('creates one canonical visual item with role, tags, collections, and stable upload identity', async () => {
    const file = new File(['png'], 'visual.png', { type: 'image/png' })
    expect(useMediaStore.getState().addFilesToUploadQueue([file])).toBe(1)
    const queued = useMediaStore.getState().uploadQueue[0]
    useMediaStore.setState(state => ({
      uploadDrafts: {
        ...state.uploadDrafts,
        [queued.tempId]: { ...state.uploadDrafts[queued.tempId], role: 'overlay', title: 'Visual', tags: ['live'], collectionIds: ['collection-1'] },
      },
    }))

    const result = await useMediaStore.getState().uploadQueuedMedia()

    expect(result).toEqual({ total: 1, succeeded: 1, failures: [] })
    expect(mediaDbMocks.finalizeMediaUploadAtomic).toHaveBeenCalledWith(expect.objectContaining({
      operationId: queued.operationId,
      media: expect.objectContaining({ media_role: 'overlay', storage_path: `user-1/uploads/${queued.operationId}/original.png` }),
      tagNames: ['live'], collectionIds: ['collection-1'],
    }))
    expect(useMediaStore.getState().items).toHaveLength(1)
    expect(useMediaStore.getState().items[0]).toMatchObject({
      id: 'db-uploaded-media', dbId: 'uploaded-media', uploadOperationId: queued.operationId,
      tags: ['live'], collectionIds: ['collection-1'], mediaRole: 'overlay', revision: 1,
    })
  })

  it('does not report relationship failure as success and durably cleans the uploaded object', async () => {
    const file = new File(['png'], 'visual.png', { type: 'image/png' })
    useMediaStore.getState().addFilesToUploadQueue([file])
    const queued = useMediaStore.getState().uploadQueue[0]
    mediaDbMocks.finalizeMediaUploadAtomic.mockResolvedValueOnce({
      ok: false, kind: 'validation', message: 'Selected collection is unavailable.',
    })

    const result = await useMediaStore.getState().uploadQueuedMedia()

    expect(result).toMatchObject({ total: 1, succeeded: 0, failures: [{ error: 'Selected collection is unavailable.' }] })
    expect(useMediaStore.getState().items).toEqual([])
    expect(useMediaStore.getState().uploadQueue).toHaveLength(1)
    expect(mediaDbMocks.markMediaUploadCleanupPending).toHaveBeenCalledWith(
      queued.operationId,
      [`user-1/uploads/${queued.operationId}/original.png`],
      'Selected collection is unavailable.',
    )
    expect(mediaDbMocks.deleteMediaFile).toHaveBeenCalledWith(`user-1/uploads/${queued.operationId}/original.png`)
  })

  it('reconciles an ambiguous retry without re-uploading or creating a duplicate row', async () => {
    const file = new File(['png'], 'visual.png', { type: 'image/png' })
    useMediaStore.getState().addFilesToUploadQueue([file])
    const queued = useMediaStore.getState().uploadQueue[0]
    mediaDbMocks.beginMediaUpload.mockResolvedValueOnce({
      ok: true, operationStatus: 'complete', phase: 'complete', mediaItem: uploadCanonical(queued.operationId),
    })

    const result = await useMediaStore.getState().uploadQueuedMedia()

    expect(result.succeeded).toBe(1)
    expect(mediaDbMocks.uploadMediaFile).not.toHaveBeenCalled()
    expect(mediaDbMocks.finalizeMediaUploadAtomic).not.toHaveBeenCalled()
    expect(useMediaStore.getState().items.map(item => item.dbId)).toEqual(['uploaded-media'])
  })

  it('enters Deck reference protection through the real media-store deletion action', async () => {
    const source = mediaItem()
    useMediaStore.setState({ items: [source] })
    const makeItem = (id: string, mediaId: string, order: number) => ({
      id, mediaId, enabled: true, order, revision: 1, timingOverrideBeats: null,
      source: {
        mediaRevision: 1, fingerprint: `sha256:${id.padEnd(64, '0').slice(0, 64)}`,
        fileName: `${id}.png`, mimeType: 'image/png', width: 2, height: 2,
        hasAlpha: false, transparentBackground: '#000000',
      },
    })
    let decks: PixGridDeckDefinition[] = [{
      schemaVersion: 1, id: 'deck-1', name: 'Deck One', revision: 1,
      generatedPresetId: 'pix-grid-deck:deck-1',
      items: [makeItem('a', source.id, 0), makeItem('b', 'db-other-1', 1), makeItem('c', 'db-other-2', 2)],
      configuration: {
        playbackOrder: 'forward', reactionProfileId: 'balanced',
        transitionPolicy: { style: 'cut', durationBeats: 0 }, defaultItemDurationBeats: 4,
        sectionTimingBeats: {}, sectionItemAssignments: {}, sceneItemAssignments: {}, loop: true, preDropBehavior: 'hold',
      },
    }]
    let transaction: PixGridDeckDefinition[] | null = null
    const undo: PixGridDeckDefinition[][] = []
    let commits = 0
    const fakeStore = () => ({
      pixGridDecks: decks,
      pixGridDeckHistoryTransaction: transaction,
      beginPixGridDeckHistoryTransaction() { transaction = structuredClone(decks) },
      commitPixGridDeckHistoryTransaction() { if (transaction) undo.push(transaction); transaction = null; commits += 1 },
      cancelPixGridDeckHistoryTransaction() { if (transaction) decks = transaction; transaction = null },
      undoPixGridDeckEdit() { const previous = undo.pop(); if (previous) decks = previous },
      updatePixGridDeck(deckId: string, patch: { items: PixGridDeckDefinition['items'] }) {
        decks = decks.map(deck => deck.id === deckId ? { ...deck, revision: deck.revision + 1, items: patch.items } : deck)
        return { ok: true as const, deckId }
      },
      deletePixGridDeck(deckId: string) {
        decks = decks.filter(deck => deck.id !== deckId)
        return { ok: true as const, deckId }
      },
    })
    const unregister = registerMediaDeletionGuard(createPixGridDeckMediaDeletionGuard(fakeStore))
    try {
      expect(await useMediaStore.getState().removeItem(source.id)).toBe(false)
      expect(useMediaStore.getState().pendingDeletionWarning).toMatchObject({
        action: 'confirm-reference-removal', affectedDecks: [{ id: 'deck-1', remainingItemCount: 2 }],
      })
      expect(mediaDbMocks.requestMediaDeletion).not.toHaveBeenCalled()

      expect(await useMediaStore.getState().removeItem(source.id, { confirmation: 'remove-deck-references' })).toBe(true)
      expect(decks[0].items.map(item => item.mediaId)).toEqual(['db-other-1', 'db-other-2'])
      expect(commits).toBe(1)
      expect(mediaDbMocks.requestMediaDeletion).toHaveBeenCalledWith(source.dbId)
    } finally {
      unregister()
    }
  })

  it('rolls back the complete production Deck graph when the canonical media delete request fails', async () => {
    useReactStore.getState().resetReactView()
    localStorage.clear()
    const source = mediaItem()
    useMediaStore.setState({ items: [source] })
    const deckItems = ['source', 'other'].map((suffix, order) => ({
      id: `rollback-${suffix}`,
      mediaId: order === 0 ? source.id : 'db-other-media',
      enabled: true,
      order,
      revision: 1,
      timingOverrideBeats: null,
      source: {
        mediaRevision: 1,
        fingerprint: `sha256:${String(order + 1).padStart(64, '0')}`,
        fileName: `${suffix}.png`,
        mimeType: 'image/png',
        width: 640,
        height: 360,
        hasAlpha: false,
        transparentBackground: '#000000',
      },
    }))
    expect(useReactStore.getState().createPixGridDeck({
      id: 'media-request-rollback',
      name: 'Media Request Rollback',
      items: deckItems,
    })).toEqual({ ok: true, deckId: 'media-request-rollback' })
    const deck = useReactStore.getState().pixGridDecks[0]!
    expect(useReactStore.getState().createPixGridDeckPreset(deck.id, {
      deckId: deck.id,
      deckRevision: deck.revision,
      enabledItemCount: 2,
      frameProgress: 1,
      transitionProgress: 1,
      ready: true,
      errorCount: 0,
      message: 'Ready to create Preset.',
    })).toEqual({ ok: true, deckId: deck.id })
    useReactStore.getState().selectReactPreset(deck.generatedPresetId)
    localStorage.setItem('drmvyz.reactPresetFavorites.v1', JSON.stringify([deck.generatedPresetId]))
    useReactStore.setState(state => ({
      performancePads: state.performancePads.map((pad, index) => index < 2
        ? { ...pad, presetId: deck.generatedPresetId, label: deck.name, color: '#abcdef' }
        : pad),
      presetAutomationCuesByTrackId: {
        track: [
          { id: 'request-rollback-1', label: 'Rollback 1', timeSec: 1, presetId: deck.generatedPresetId, enabled: true, transitionMs: 0 },
          { id: 'request-rollback-2', label: 'Rollback 2', timeSec: 2, presetId: deck.generatedPresetId, enabled: true, transitionMs: 0 },
        ],
      },
    }))
    const before = {
      decks: useReactStore.getState().pixGridDecks,
      presets: useReactStore.getState().reactPresets.filter(preset => preset.pixGridDeck),
      pads: useReactStore.getState().performancePads,
      cues: useReactStore.getState().presetAutomationCuesByTrackId,
      activePresetId: useReactStore.getState().activeReactPresetId,
      pixGridState: useReactStore.getState().pixGridState,
      favorites: localStorage.getItem('drmvyz.reactPresetFavorites.v1'),
      undo: useReactStore.getState().pixGridDeckUndoStack,
      redo: useReactStore.getState().pixGridDeckRedoStack,
    }
    mediaDbMocks.requestMediaDeletion.mockResolvedValueOnce({ ok: false, message: 'database refused deletion' })
    const unregister = registerMediaDeletionGuard(createPixGridDeckMediaDeletionGuard(() => useReactStore.getState()))
    try {
      expect(await useMediaStore.getState().removeItem(source.id, { confirmation: 'delete-affected-decks' })).toBe(false)
      expect(useMediaStore.getState().items).toEqual([source])
      expect({
        decks: useReactStore.getState().pixGridDecks,
        presets: useReactStore.getState().reactPresets.filter(preset => preset.pixGridDeck),
        pads: useReactStore.getState().performancePads,
        cues: useReactStore.getState().presetAutomationCuesByTrackId,
        activePresetId: useReactStore.getState().activeReactPresetId,
        pixGridState: useReactStore.getState().pixGridState,
        favorites: localStorage.getItem('drmvyz.reactPresetFavorites.v1'),
        undo: useReactStore.getState().pixGridDeckUndoStack,
        redo: useReactStore.getState().pixGridDeckRedoStack,
      }).toEqual(before)
    } finally {
      unregister()
    }
  })

  it('escalates a two-image Deck to explicit Deck deletion confirmation', async () => {
    const source = mediaItem()
    useMediaStore.setState({ items: [source] })
    const baseItem = (id: string, mediaId: string, order: number) => ({
      id, mediaId, enabled: true, order, revision: 1, timingOverrideBeats: null,
      source: { mediaRevision: 1, fingerprint: `legacy:${id}`, fileName: `${id}.png`, mimeType: 'image/png', width: 2, height: 2, hasAlpha: false, transparentBackground: '#000000' },
    })
    const configuration = { playbackOrder: 'forward' as const, reactionProfileId: 'balanced' as const, transitionPolicy: { style: 'cut' as const, durationBeats: 0 }, defaultItemDurationBeats: 4, sectionTimingBeats: {}, sectionItemAssignments: {}, sceneItemAssignments: {}, loop: true, preDropBehavior: 'hold' as const }
    let decks: PixGridDeckDefinition[] = [{
      schemaVersion: 1, id: 'minimum-deck', name: 'Minimum Deck', revision: 1,
      generatedPresetId: 'pix-grid-deck:minimum-deck',
      items: [baseItem('a', source.id, 0), baseItem('b', 'db-other', 1)],
      configuration,
    }, {
      schemaVersion: 1, id: 'shared-deck', name: 'Shared Deck', revision: 1,
      generatedPresetId: 'pix-grid-deck:shared-deck',
      items: [baseItem('c', source.id, 0), baseItem('d', 'db-other-2', 1), baseItem('e', 'db-other-3', 2)],
      configuration,
    }]
    let transaction: PixGridDeckDefinition[] | null = null
    const fakeStore = () => ({
      pixGridDecks: decks, pixGridDeckHistoryTransaction: transaction,
      beginPixGridDeckHistoryTransaction() { transaction = structuredClone(decks) },
      commitPixGridDeckHistoryTransaction() { transaction = null },
      cancelPixGridDeckHistoryTransaction() { if (transaction) decks = transaction; transaction = null },
      undoPixGridDeckEdit() {},
      updatePixGridDeck(deckId: string, patch: { items: PixGridDeckDefinition['items'] }) { decks = decks.map(deck => deck.id === deckId ? { ...deck, items: patch.items } : deck); return { ok: true as const, deckId } },
      deletePixGridDeck(deckId: string) { decks = decks.filter(deck => deck.id !== deckId); return { ok: true as const, deckId } },
    })
    const unregister = registerMediaDeletionGuard(createPixGridDeckMediaDeletionGuard(fakeStore))
    try {
      expect(await useMediaStore.getState().removeItem(source.id, { confirmation: 'remove-deck-references' })).toBe(false)
      expect(useMediaStore.getState().pendingDeletionWarning).toMatchObject({
        action: 'confirm-deck-deletion',
        confirmationCopy: 'Deleting this Deck will delete the Preset too. Are you sure?',
      })
      expect(useMediaStore.getState().pendingDeletionWarning?.affectedDecks).toHaveLength(2)
      expect(decks).toHaveLength(2)

      expect(await useMediaStore.getState().removeItem(source.id, { confirmation: 'delete-affected-decks' })).toBe(true)
      expect(decks.map(deck => deck.id)).toEqual(['shared-deck'])
      expect(decks[0].items.map(item => item.mediaId)).toEqual(['db-other-2', 'db-other-3'])
    } finally {
      unregister()
    }
  })

  it('keeps partial deletion cleanup visible and retries only unfinished exact paths', async () => {
    const selected = mediaItem({
      type: 'video', storagePath: 'user-1/uploads/op-1/original.mp4', thumbnailUrl: null,
      derivativePaths: [
        { kind: 'thumbnail', path: 'user-1/uploads/op-1/thumbnail.jpg', required: false, status: 'ready' },
        { kind: 'filmstrip', path: 'user-1/uploads/op-1/filmstrip.jpg', required: false, status: 'ready' },
      ],
    })
    const paths = selected.derivativePaths!.map(path => path.path)
    const allPaths = [selected.storagePath!, ...paths]
    mediaDbMocks.requestMediaDeletion.mockResolvedValueOnce({
      ok: true, reconciled: false,
      cleanupJob: {
        id: 'cleanup-video', user_id: 'user-1', media_item_id: selected.dbId, upload_operation_id: 'op-1',
        kind: 'media_deletion', status: 'pending', storage_paths: allPaths, completed_paths: [], last_error: null,
        created_at: '2026-07-11T00:00:00.000Z', updated_at: '2026-07-11T00:00:00.000Z', completed_at: null,
      },
    })
    mediaDbMocks.deleteMediaFile
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: 'network offline' })
    useMediaStore.setState({ items: [selected] })

    expect(await useMediaStore.getState().removeItem(selected.id)).toBe(false)
    expect(useMediaStore.getState().items).toEqual([])
    expect(useMediaStore.getState().deletionStates[selected.id]).toMatchObject({
      status: 'failed', completedPaths: [allPaths[0]], storagePaths: allPaths,
    })

    mediaDbMocks.deleteMediaFile.mockReset().mockResolvedValue({ error: null })
    mediaDbMocks.finalizeMediaDeletion.mockResolvedValueOnce({ ok: true, mediaItemId: selected.dbId })
    expect(await useMediaStore.getState().retryDeletion(selected.id)).toBe(true)
    expect(mediaDbMocks.deleteMediaFile.mock.calls.map(call => call[0])).toEqual(allPaths.slice(1))
    expect(useMediaStore.getState().deletionStates[selected.id]).toBeUndefined()
  })

  it('blocks foreign cleanup paths before storage deletion and clears account-scoped operation state', async () => {
    useMediaStore.setState({
      deletionStates: {
        'db-media-1': {
          itemId: 'db-media-1', dbId: 'media-1', jobId: 'cleanup-foreign', status: 'failed', message: 'retry',
          storagePaths: ['user-2/uploads/op-1/original.mp4'], completedPaths: [], updatedAt: Date.now(),
        },
      },
    })

    expect(await useMediaStore.getState().retryDeletion('db-media-1')).toBe(false)
    expect(mediaDbMocks.deleteMediaFile).not.toHaveBeenCalled()
    expect(useMediaStore.getState().deletionStates['db-media-1']).toMatchObject({ status: 'failed' })

    useMediaStore.getState().clear()
    expect(useMediaStore.getState()).toMatchObject({ items: [], collections: [], uploadQueue: [], deletionStates: {} })
  })


  it('loads multiple stable pages without duplicate items and preserves selection state', async () => {
    const first = uploadCanonical('page-a', { id: 'page-a', title: 'A' })
    const equalTimestamp = uploadCanonical('page-b', { id: 'page-b', title: 'B' })
    const third = uploadCanonical('page-c', { id: 'page-c', title: 'C', created_at: '2026-07-10T00:00:00.000Z' })
    mediaDbMocks.listMediaItemsPage
      .mockResolvedValueOnce({ ok: true, page: { items: [first, equalTimestamp], nextCursor: { createdAt: first.created_at, id: equalTimestamp.id }, hasMore: true } })
      .mockResolvedValueOnce({ ok: true, page: { items: [equalTimestamp, third], nextCursor: null, hasMore: false } })

    runtimeMocks.visual.activeMediaId = 'db-page-a'
    await useMediaStore.getState().refreshLibrary()
    await useMediaStore.getState().loadNextPage()

    expect(useMediaStore.getState().queryItemIds).toEqual(['db-page-a', 'db-page-b', 'db-page-c'])
    expect(new Set(useMediaStore.getState().queryItemIds).size).toBe(3)
    expect(runtimeMocks.visual.activeMediaId).toBe('db-page-a')
    expect(mediaDbMocks.listMediaItemsPage.mock.calls[1][1]).toEqual({ createdAt: first.created_at, id: equalTimestamp.id })
  })

  it('does not append a stale next-page response after the query changes', async () => {
    const oldPage = uploadCanonical('old', { id: 'old', title: 'Old' })
    const staleItem = uploadCanonical('stale', { id: 'stale', title: 'Stale' })
    const newItem = uploadCanonical('new', { id: 'new', title: 'DJ Visual' })
    const pending = deferred<{ ok: true; page: { items: ReturnType<typeof uploadCanonical>[]; nextCursor: null; hasMore: false } }>()
    mediaDbMocks.listMediaItemsPage
      .mockResolvedValueOnce({ ok: true, page: { items: [oldPage], nextCursor: { createdAt: oldPage.created_at, id: oldPage.id }, hasMore: true } })
      .mockImplementationOnce(() => pending.promise)
      .mockResolvedValueOnce({ ok: true, page: { items: [newItem], nextCursor: null, hasMore: false } })

    await useMediaStore.getState().refreshLibrary()
    const oldRequest = useMediaStore.getState().loadNextPage()
    useMediaStore.getState().setLibraryQuery({ search: 'DJ', filter: 'all', scope: 'all', collectionId: null, sort: 'created_desc' })
    await useMediaStore.getState().refreshLibrary()
    pending.resolve({ ok: true, page: { items: [staleItem], nextCursor: null, hasMore: false } })
    await oldRequest

    expect(useMediaStore.getState().queryItemIds).toEqual(['db-new'])
    expect(useMediaStore.getState().queryItemIds).not.toContain('db-stale')
  })

  it('sends one- and two-character searches to the complete server query and reuses a fresh page', async () => {
    const dj = uploadCanonical('dj', { id: 'dj', title: 'DJ' })
    mediaDbMocks.listMediaItemsPage.mockResolvedValue({ ok: true, page: { items: [dj], nextCursor: null, hasMore: false } })
    const oneCharacter = { search: 'D', filter: 'all' as const, scope: 'all' as const, collectionId: null, sort: 'created_desc' as const }
    await useMediaStore.getState().ensureLibraryLoaded(oneCharacter)
    await useMediaStore.getState().ensureLibraryLoaded(oneCharacter)
    expect(mediaDbMocks.listMediaItemsPage).toHaveBeenCalledTimes(1)
    expect(mediaDbMocks.listMediaItemsPage).toHaveBeenCalledWith(oneCharacter, null, 48)

    const twoCharacters = { ...oneCharacter, search: 'DJ' }
    await useMediaStore.getState().ensureLibraryLoaded(twoCharacters)
    expect(mediaDbMocks.listMediaItemsPage).toHaveBeenLastCalledWith(twoCharacters, null, 48)
  })


  it('coalesces repeated near-end requests into one next-page RPC', async () => {
    const page = uploadCanonical('next-once', { id: 'next-once' })
    const pending = deferred<{ ok: true; page: { items: ReturnType<typeof uploadCanonical>[]; nextCursor: null; hasMore: false } }>()
    mediaDbMocks.listMediaItemsPage.mockImplementationOnce(() => pending.promise)
    useMediaStore.setState({
      accountId: 'user-1', hasMore: true, cursor: { createdAt: '2026-07-11T00:00:00.000Z', id: 'cursor' },
      loading: false, refreshing: false, nextPageLoading: false,
    })
    const first = useMediaStore.getState().loadNextPage()
    const second = useMediaStore.getState().loadNextPage()
    expect(mediaDbMocks.listMediaItemsPage).toHaveBeenCalledTimes(1)
    pending.resolve({ ok: true, page: { items: [page], nextCursor: null, hasMore: false } })
    await Promise.all([first, second])
    expect(useMediaStore.getState().queryItemIds).toEqual(['db-next-once'])
  })

  it('refreshes an expired asset once, stops a repeated failure loop, and permits a later healthy cycle', async () => {
    const asset = mediaItem({ id: 'db-expiry', dbId: 'expiry', storagePath: 'user-1/expiry/original.mp4', type: 'video', url: 'https://expired.test/one' })
    useMediaStore.setState({ items: [asset], accountId: 'user-1' })
    mediaDbMocks.createSignedMediaUrl
      .mockResolvedValueOnce({ url: 'https://signed.test/two', error: null })
      .mockResolvedValueOnce({ url: 'https://signed.test/three', error: null })

    expect(await useMediaStore.getState().retryMediaAsset(asset.id, 'original')).toBe(true)
    expect(await useMediaStore.getState().retryMediaAsset(asset.id, 'original')).toBe(false)
    expect(mediaDbMocks.createSignedMediaUrl).toHaveBeenCalledTimes(1)

    useMediaStore.getState().markMediaAssetLoaded(asset.id, 'original')
    expect(await useMediaStore.getState().retryMediaAsset(asset.id, 'original')).toBe(true)
    expect(mediaDbMocks.createSignedMediaUrl).toHaveBeenCalledTimes(2)
  })

  it('clears private rows and reloads when the authenticated account changes', async () => {
    const privateItem = mediaItem({ id: 'db-private', dbId: 'private', url: 'blob:private', localObjectUrlKey: 'local:private:original' })
    const nextAccountItem = uploadCanonical('user-2-item', { id: 'user-2-item', user_id: 'user-2', storage_path: 'user-2/item/original.png' })
    useMediaStore.setState({
      items: [privateItem], queryItemIds: [privateItem.id], accountId: 'user-1', invalidated: false,
      lastSuccessfulLoad: Date.now(), hasMore: false,
    })
    vi.mocked(supabase.auth.getUser).mockResolvedValue({ data: { user: { id: 'user-2' } }, error: null } as never)
    mediaDbMocks.listMediaItemsPage.mockResolvedValueOnce({ ok: true, page: { items: [nextAccountItem], nextCursor: null, hasMore: false } })

    await useMediaStore.getState().ensureLibraryLoaded()
    expect(useMediaStore.getState().accountId).toBe('user-2')
    expect(useMediaStore.getState().queryItemIds).toEqual(['db-user-2-item'])
    expect(useMediaStore.getState().items.some(item => item.id === privateItem.id)).toBe(false)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:private')
  })

})
