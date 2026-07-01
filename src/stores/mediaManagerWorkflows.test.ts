import { beforeEach, describe, expect, it, vi } from 'vitest'

const mediaDbMocks = vi.hoisted(() => ({
  listMediaItems: vi.fn(),
  createMediaItem: vi.fn(),
  updateMediaItem: vi.fn(),
  updateMediaItemRole: vi.fn(),
  updateMediaItemFavorite: vi.fn(),
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
  reorderCollectionItems: vi.fn(),
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
vi.mock('./visualStore', () => ({
  useVisualStore: { getState: () => runtimeMocks.visual },
}))
vi.mock('./audioStore', () => ({
  useAudioStore: { getState: () => runtimeMocks.audio },
}))
vi.mock('../utils/analyzeAudioFile', () => ({
  analyzeAudioFile: runtimeMocks.analyzeAudioFile,
}))
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

import type { UploadedMedia } from './mediaStore'
import { useMediaStore } from './mediaStore'

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
    ...overrides,
  }
}

function resetStore() {
  useMediaStore.setState({
    items: [],
    collections: [],
    loading: false,
    collectionsLoading: false,
    loadError: null,
    deleteError: null,
    authRequired: false,
    storageAvailable: true,
    lastRestored: null,
    activeFilter: 'all',
    importModalOpen: false,
    uploadQueue: [],
    uploadDraft: {
      role: 'other',
      title: '',
      description: '',
      tags: [],
      collectionIds: [],
      metadata: {},
      audioArtist: '',
      audioGenre: '',
      audioBpm: '',
      audioMusicalKey: '',
    },
  })
}

describe('Media Manager canonical workflows', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
    mediaDbMocks.updateMediaItem.mockResolvedValue({ error: null })
    mediaDbMocks.setMediaItemTags.mockResolvedValue({ error: null })
    mediaDbMocks.setMediaItemCollections.mockResolvedValue({ error: null })
    mediaDbMocks.deleteMediaItem.mockResolvedValue({ error: null })
    mediaDbMocks.deleteMediaFiles.mockResolvedValue({ error: null })
    mediaDbMocks.uploadMediaFile.mockResolvedValue({ error: null })
    mediaDbMocks.createMediaItem.mockResolvedValue({ id: 'media-retried', error: null })
    mediaDbMocks.updateMediaCollection.mockResolvedValue({ error: null })
    mediaDbMocks.deleteMediaCollection.mockResolvedValue({ error: null })
  })

  it('removes a selected item only after persistence succeeds and selects a safe fallback', async () => {
    const selected = mediaItem()
    const fallback = mediaItem({ id: 'db-media-2', dbId: 'media-2', name: 'fallback.png' })
    useMediaStore.setState({ items: [selected, fallback] })
    runtimeMocks.visual.activeMediaId = selected.id

    const removed = await useMediaStore.getState().removeItem(selected.id)

    expect(removed).toBe(true)
    expect(mediaDbMocks.deleteMediaItem).toHaveBeenCalledWith(selected.dbId)
    expect(useMediaStore.getState().items).toEqual([fallback])
    expect(runtimeMocks.visual.removeMediaReferences).toHaveBeenCalledWith(selected.id)
    expect(runtimeMocks.visual.setActiveMedia).toHaveBeenCalledWith(fallback.id)
  })

  it('keeps the selected item intact when deletion fails', async () => {
    const selected = mediaItem()
    useMediaStore.setState({ items: [selected] })
    runtimeMocks.visual.activeMediaId = selected.id
    mediaDbMocks.deleteMediaItem.mockResolvedValue({ error: 'row-level security violation' })

    const removed = await useMediaStore.getState().removeItem(selected.id)

    expect(removed).toBe(false)
    expect(useMediaStore.getState().items).toEqual([selected])
    expect(runtimeMocks.visual.setActiveMedia).not.toHaveBeenCalled()
    expect(useMediaStore.getState().deleteError).toContain('permission denied')
  })

  it('drops records removed by another session while preserving retryable local uploads', async () => {
    const staleRemote = mediaItem()
    const failedLocal = mediaItem({
      id: 'local-failed',
      dbId: undefined,
      storagePath: undefined,
      url: 'blob:failed',
      thumbnailUrl: null,
      uploadError: 'network error',
    })
    useMediaStore.setState({ items: [staleRemote, failedLocal] })
    runtimeMocks.visual.activeMediaId = staleRemote.id

    await useMediaStore.getState().loadFromSupabase()

    expect(useMediaStore.getState().items).toEqual([failedLocal])
    expect(runtimeMocks.visual.removeMediaReferences).toHaveBeenCalledWith(staleRemote.id)
    expect(runtimeMocks.visual.setActiveMedia).toHaveBeenCalledWith(failedLocal.id)
  })

  it('persists visual metadata, tags, and collections before updating local state', async () => {
    const item = mediaItem()
    useMediaStore.setState({ items: [item] })

    const saved = await useMediaStore.getState().saveMediaEdits(item.id, {
      role: 'overlay',
      title: ' Updated Overlay ',
      description: ' New description ',
      tags: ['live', 'cyan'],
      collectionIds: ['collection-2'],
      metadata: { hasAlpha: true, loopable: true },
    })

    expect(saved).toBe(true)
    expect(mediaDbMocks.updateMediaItem).toHaveBeenCalledWith(item.dbId, expect.objectContaining({
      media_role: 'overlay',
      title: 'Updated Overlay',
      description: 'New description',
      metadata: expect.objectContaining({ width: 1920, hasAlpha: true, loopable: true }),
    }))
    expect(mediaDbMocks.setMediaItemTags).toHaveBeenCalledWith(item.dbId, 'user-1', ['live', 'cyan'])
    expect(mediaDbMocks.setMediaItemCollections).toHaveBeenCalledWith(item.dbId, ['collection-2'])
    expect(useMediaStore.getState().items[0]).toMatchObject({
      mediaRole: 'overlay',
      title: 'Updated Overlay',
      description: 'New description',
      tags: ['live', 'cyan'],
      collectionIds: ['collection-2'],
    })
  })

  it('keeps failed files in the queue and reports partial audio upload failures', async () => {
    const first = new File(['one'], 'one.wav', { type: 'audio/wav' })
    const second = new File(['two'], 'two.wav', { type: 'audio/wav' })
    runtimeMocks.audio.uploadAndSaveTrack
      .mockResolvedValueOnce({ id: 'audio-one', dbId: 'one' })
      .mockImplementationOnce(async () => {
        runtimeMocks.audio.loadError = 'Storage quota exceeded'
        return null
      })

    expect(useMediaStore.getState().addFilesToUploadQueue([first, second])).toBe(2)
    const events: string[] = []
    const result = await useMediaStore.getState().uploadQueuedMedia({
      onProgress: event => events.push(`${event.fileName}:${event.status}`),
    })

    expect(result).toMatchObject({ total: 2, succeeded: 1 })
    expect(result.failures).toEqual([
      expect.objectContaining({ fileName: 'two.wav', error: 'Storage quota exceeded' }),
    ])
    expect(useMediaStore.getState().uploadQueue.map(item => item.file.name)).toEqual(['two.wav'])
    expect(events).toContain('one.wav:done')
    expect(events).toContain('two.wav:error')
  })

  it('retries a failed visual upload with the original file and remaps runtime references', async () => {
    const file = new File(['image'], 'retry.png', { type: 'image/png' })
    const failed = mediaItem({
      id: 'local-retry',
      dbId: undefined,
      storagePath: undefined,
      url: 'blob:retry',
      thumbnailUrl: 'blob:retry',
      uploadError: 'Network error',
      uploadSourceFile: file,
    })
    useMediaStore.setState({ items: [failed] })

    const retried = await useMediaStore.getState().retryUpload(failed.id)

    expect(retried).toBe(true)
    expect(mediaDbMocks.uploadMediaFile).toHaveBeenCalled()
    expect(useMediaStore.getState().items[0]).toMatchObject({
      id: 'db-media-retried',
      dbId: 'media-retried',
      uploadError: undefined,
      uploadSourceFile: undefined,
    })
    expect(runtimeMocks.visual.remapMediaId).toHaveBeenCalledWith('local-retry', 'db-media-retried')
  })

  it('updates and deletes collections without deleting their media', async () => {
    const item = mediaItem({ collectionIds: ['collection-1', 'collection-2'] })
    useMediaStore.setState({
      items: [item],
      collections: [{ id: 'collection-1', name: 'Old' }],
    })

    expect(await useMediaStore.getState().updateCollection('collection-1', 'New', 'Description')).toBe(true)
    expect(mediaDbMocks.updateMediaCollection).toHaveBeenCalledWith('collection-1', {
      name: 'New',
      description: 'Description',
    })
    expect(await useMediaStore.getState().removeCollection('collection-1')).toBe(true)
    expect(mediaDbMocks.deleteMediaCollection).toHaveBeenCalledWith('collection-1')
    expect(useMediaStore.getState().items[0].collectionIds).toEqual(['collection-2'])
    expect(useMediaStore.getState().items).toHaveLength(1)
  })
})
