// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { UploadedMedia } from '../../../stores/mediaStore'
import type { SavedAudioTrack } from '../../../stores/audioStore'

const mocks = vi.hoisted(() => ({
  mediaState: {} as Record<string, unknown>,
  audioState: {} as Record<string, unknown>,
  engine: {} as Record<string, unknown>,
}))

vi.mock('../../../stores/mediaStore', () => ({
  useMediaStore: () => mocks.mediaState,
}))

vi.mock('../../../stores/audioStore', () => ({
  useAudioStore: () => mocks.audioState,
}))

vi.mock('../../../context/AudioEngineContext', () => ({
  useSharedAudio: () => mocks.engine,
}))

vi.mock('../MediaUploadModal', () => ({
  MediaUploadModal: ({ editItem }: { editItem?: { id: string } }) => (
    <div data-testid={editItem ? 'media-edit-modal' : 'media-upload-modal'} />
  ),
}))

vi.mock('./MediaPreviewModal', () => ({
  MediaPreviewModal: () => <div data-testid="media-preview-modal" />,
}))

vi.mock('./AudioTrackEditModal', () => ({
  AudioTrackEditModal: () => <div data-testid="audio-edit-modal" />,
}))

vi.mock('./AudioTrackPreviewModal', () => ({
  AudioTrackPreviewModal: () => <div data-testid="audio-preview-modal" />,
}))

vi.mock('./CollectionEditorModal', () => ({
  CollectionEditorModal: () => <div data-testid="collection-editor-modal" />,
}))

vi.mock('./MediaStatusBar', () => ({
  MediaStatusBar: () => <div data-testid="media-status-bar" />,
}))

import { MediaLibraryBrowser } from './MediaLibraryBrowser'
import { MEDIA_DECK_CAPABILITIES, MEDIA_MANAGER_CAPABILITIES } from './mediaLibraryCapabilities'

let container: HTMLDivElement | null = null
let root: ReturnType<typeof createRoot> | null = null

const visual: UploadedMedia = {
  id: 'media-1',
  dbId: 'db-media-1',
  storagePath: 'user/media-1/image.png',
  mimeType: 'image/png',
  name: 'image.png',
  title: 'Stage Image',
  description: 'Performance visual',
  type: 'image',
  url: 'https://example.test/image.png',
  thumbnailUrl: 'https://example.test/thumb.png',
  meta: 'PNG · 1920×1080',
  favorite: false,
  mediaRole: 'background_image',
  tags: ['stage'],
  collectionIds: [],
  metadata: { width: 1920, height: 1080 },
}

const track: SavedAudioTrack = {
  id: 'audio-track-1',
  dbId: 'track-1',
  title: 'Performance Track',
  fileName: 'performance.wav',
  storagePath: 'user/track-1/performance.wav',
  durationSec: 180,
  sampleRate: 48000,
  channels: 2,
  fileSizeByte: 1024,
  mimeType: 'audio/wav',
  transcriptionAssets: null,
  artist: 'DVYDRM',
  genre: 'Electronic',
  bpm: 150,
  musicalKey: 'Bb',
  createdAt: '2026-07-01T00:00:00.000Z',
}

function resetMocks() {
  mocks.mediaState = {
    items: [visual],
    addFilesToUploadQueue: vi.fn().mockReturnValue(1),
    clearUploadQueue: vi.fn(),
    removeItem: vi.fn().mockResolvedValue(true),
    retryUpload: vi.fn().mockResolvedValue(true),
    toggleFavorite: vi.fn(),
    loadFromSupabase: vi.fn(),
    loading: false,
    collections: [],
    collectionsLoading: false,
    loadCollections: vi.fn(),
    removeCollection: vi.fn().mockResolvedValue(true),
    importModalOpen: false,
    openImportMediaModal: vi.fn(),
    closeImportMediaModal: vi.fn(),
  }
  mocks.audioState = {
    savedTracks: [track],
    loading: false,
    loadSavedTracks: vi.fn(),
    removeSavedTrack: vi.fn().mockResolvedValue(true),
    getSignedUrl: vi.fn().mockResolvedValue('https://example.test/performance.wav'),
  }
  mocks.engine = {
    tracks: [],
    source: 'none',
    addTrackUrls: vi.fn(),
    replaceTrackUrls: vi.fn(),
    setSource: vi.fn(),
    removeTrack: vi.fn(),
  }
}

async function renderBrowser(props: React.ComponentProps<typeof MediaLibraryBrowser>) {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => {
    root?.render(<MediaLibraryBrowser {...props} />)
    await Promise.resolve()
  })
}

function findButton(text: string): HTMLButtonElement | null {
  return (Array.from(container?.querySelectorAll('button') ?? [])
    .find(button => button.textContent?.trim() === text) as HTMLButtonElement | undefined) ?? null
}

beforeEach(() => {
  resetMocks()
})

afterEach(() => {
  if (root) act(() => root?.unmount())
  container?.remove()
  root = null
  container = null
  vi.restoreAllMocks()
})

describe('MediaLibraryBrowser capability boundaries', () => {
  it('keeps Media Deck performance-only and ignores upload drops', async () => {
    const onSelect = vi.fn()
    await renderBrowser({
      activeMediaId: 'media-1',
      onSelect,
      context: 'visualizer',
      capabilities: MEDIA_DECK_CAPABILITIES,
    })

    expect(findButton('Import')).toBeNull()
    expect(findButton('New Collection')).toBeNull()
    expect(container?.querySelector('[title="Edit media"]')).toBeNull()
    expect(container?.querySelector('.vz-media-remove')).toBeNull()
    expect(container?.querySelector('[title="Preview media"]')).not.toBeNull()
    expect(container?.querySelector('.vz-media-star')).not.toBeNull()
    expect(container?.querySelector('.vz-media-card--active')).not.toBeNull()
    expect(container?.querySelector<HTMLElement>('.vz-media-card')?.draggable).toBe(true)

    const dropEvent = new Event('drop', { bubbles: true, cancelable: true })
    Object.defineProperty(dropEvent, 'dataTransfer', {
      value: { files: [new File(['image'], 'new.png', { type: 'image/png' })] },
    })
    act(() => {
      container?.querySelector('.vz-media-browser')?.dispatchEvent(dropEvent)
    })

    expect(dropEvent.defaultPrevented).toBe(false)
    expect(mocks.mediaState.addFilesToUploadQueue).not.toHaveBeenCalled()
    expect(mocks.mediaState.openImportMediaModal).not.toHaveBeenCalled()

    act(() => {
      container?.querySelector<HTMLElement>('.vz-media-card')?.click()
    })
    expect(onSelect).toHaveBeenCalledWith('media-1')
  })

  it('keeps audio loading while hiding audio edit and delete actions in Media Deck', async () => {
    await renderBrowser({
      activeMediaId: null,
      onSelect: vi.fn(),
      context: 'visualizer',
      capabilities: MEDIA_DECK_CAPABILITIES,
    })

    act(() => findButton('Tracks')?.click())

    expect(container?.textContent).toContain('Performance Track')
    expect(container?.querySelector('[title="Edit track metadata"]')).toBeNull()
    expect(container?.querySelector('.vz-track-remove-btn')).toBeNull()

    await act(async () => {
      findButton('Load Track')?.click()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(mocks.audioState.getSignedUrl).toHaveBeenCalledWith(track.storagePath)
    expect(mocks.engine.addTrackUrls).toHaveBeenCalledWith([
      expect.objectContaining({
        title: track.title,
        artist: track.artist,
        url: 'https://example.test/performance.wav',
        dbId: track.dbId,
      }),
    ])
    expect(mocks.engine.setSource).toHaveBeenCalledWith('file')
  })

  it('retains upload, edit, delete, and drop workflows in Media Manager', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const onSelect = vi.fn()
    await renderBrowser({
      activeMediaId: null,
      onSelect,
      context: 'manager',
      capabilities: MEDIA_MANAGER_CAPABILITIES,
    })

    expect(findButton('Import')).not.toBeNull()
    expect(findButton('New Collection')).not.toBeNull()
    expect(container?.querySelector('[title="Edit media"]')).not.toBeNull()
    expect(container?.querySelector('.vz-media-remove')).not.toBeNull()

    act(() => {
      container?.querySelector<HTMLElement>('.vz-media-card')?.click()
    })
    expect(onSelect).toHaveBeenCalledWith('media-1')

    act(() => {
      container?.querySelector<HTMLButtonElement>('[title="Edit media"]')?.click()
    })
    expect(container?.querySelector('[data-testid="media-edit-modal"]')).not.toBeNull()

    act(() => {
      container?.querySelector<HTMLButtonElement>('.vz-media-remove')?.click()
    })
    expect(mocks.mediaState.removeItem).toHaveBeenCalledWith('media-1')

    const dropEvent = new Event('drop', { bubbles: true, cancelable: true })
    Object.defineProperty(dropEvent, 'dataTransfer', {
      value: { files: [new File(['image'], 'manager.png', { type: 'image/png' })] },
    })
    act(() => {
      container?.querySelector('.vz-media-browser')?.dispatchEvent(dropEvent)
    })
    expect(dropEvent.defaultPrevented).toBe(true)
    expect(mocks.mediaState.clearUploadQueue).toHaveBeenCalledTimes(1)
    expect(mocks.mediaState.addFilesToUploadQueue).toHaveBeenCalledTimes(1)
    expect(mocks.mediaState.openImportMediaModal).toHaveBeenCalledTimes(1)

    act(() => findButton('Audio Tracks')?.click())
    expect(container?.querySelector('[title="Edit track metadata"]')).not.toBeNull()
    expect(container?.querySelector('.vz-track-remove-btn')).not.toBeNull()

    act(() => {
      container?.querySelector<HTMLButtonElement>('[title="Edit track metadata"]')?.click()
    })
    expect(container?.querySelector('[data-testid="audio-edit-modal"]')).not.toBeNull()

    await act(async () => {
      container?.querySelector<HTMLButtonElement>('.vz-track-remove-btn')?.click()
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(mocks.audioState.removeSavedTrack).toHaveBeenCalledWith('audio-track-1')
    expect(mocks.engine.removeTrack).toHaveBeenCalledWith('audio-track-1')
  })

  it('navigates to Media Manager from the performance empty state', async () => {
    mocks.mediaState.items = []
    const onOpenMediaManager = vi.fn()
    await renderBrowser({
      activeMediaId: null,
      onSelect: vi.fn(),
      onOpenMediaManager,
      context: 'react',
      capabilities: MEDIA_DECK_CAPABILITIES,
    })

    expect(container?.textContent).toContain('No media available. Add files from Media Manager.')
    act(() => findButton('Open Media Manager')?.click())
    expect(onOpenMediaManager).toHaveBeenCalledTimes(1)
  })
})
