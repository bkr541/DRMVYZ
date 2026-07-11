// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mediaDbMocks = vi.hoisted(() => ({
  listMediaItems: vi.fn(),
  createMediaItem: vi.fn(),
  saveMediaItemAtomic: vi.fn(),
  reorderMediaCollectionAtomic: vi.fn(),
  deleteMediaItem: vi.fn(),
  createSignedMediaUrl: vi.fn(),
  uploadMediaFile: vi.fn(),
  deleteMediaFiles: vi.fn(),
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
import { mediaMutationKey, useMediaStore } from './mediaStore'

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

function resetStore() {
  useMediaStore.setState({
    items: [], collections: [], loading: false, collectionsLoading: false,
    loadError: null, deleteError: null, authRequired: false, storageAvailable: true,
    lastRestored: null, activeFilter: 'all', mutationStates: {}, collectionOrderMutations: {},
    importModalOpen: false, uploadQueue: [],
    uploadDraft: {
      role: 'other', title: '', description: '', tags: [], collectionIds: [], metadata: {},
      audioArtist: '', audioGenre: '', audioBpm: '', audioMusicalKey: '',
    },
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
    mediaDbMocks.listMediaItemTagNames.mockResolvedValue({ tagMap: new Map(), error: null })
    mediaDbMocks.listMediaItemCollectionIds.mockResolvedValue({ collMap: new Map(), error: null })
    mediaDbMocks.listMediaCollections.mockResolvedValue({ rows: [], error: null })
    mediaDbMocks.saveMediaItemAtomic.mockImplementation(async (input: SaveMediaItemAtomicInput) => ({
      ok: true, kind: 'success', mediaItem: canonical(input),
    }))
    mediaDbMocks.reorderMediaCollectionAtomic.mockResolvedValue({ ok: true, kind: 'success', orderedMediaIds: [] })
    mediaDbMocks.deleteMediaItem.mockResolvedValue({ error: null })
    mediaDbMocks.deleteMediaFiles.mockResolvedValue({ error: null })
    mediaDbMocks.uploadMediaFile.mockResolvedValue({ error: null })
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
    expect(mediaDbMocks.deleteMediaItem).toHaveBeenCalledWith(selected.dbId)
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
})
