/** @vitest-environment jsdom */
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useMediaStore, type UploadedMedia } from '../../../stores/mediaStore'
import { useReactStore } from '../../../stores/reactStore'
import { CanvasEnginePanel } from './ReactCanvasEngineShell'

vi.mock('../../../context/AudioEngineContext', () => ({
  useSharedAudio: () => ({
    tracks: [],
    source: 'none',
    currentAudioTrackId: null,
    currentTrack: null,
    isPlaying: false,
    addTrackUrls: vi.fn(),
    replaceTrackUrls: vi.fn(),
    setSource: vi.fn().mockResolvedValue(undefined),
    removeTrack: vi.fn(),
    play: vi.fn(),
  }),
}))

const mediaOne: UploadedMedia = {
  id: 'canvas-media-1',
  dbId: 'db-canvas-media-1',
  storagePath: 'user/canvas-media-1/image.png',
  mimeType: 'image/png',
  name: 'canvas-one.png',
  title: 'Canvas One',
  description: 'CANVAS test visual one',
  type: 'image',
  url: 'https://example.test/canvas-one.png',
  thumbnailUrl: 'https://example.test/canvas-one-thumb.png',
  meta: 'PNG · 1920×1080',
  favorite: false,
  mediaRole: 'background_image',
  tags: ['canvas'],
  collectionIds: [],
  metadata: { width: 1920, height: 1080 },
}

const mediaTwo: UploadedMedia = {
  ...mediaOne,
  id: 'canvas-media-2',
  dbId: 'db-canvas-media-2',
  storagePath: 'user/canvas-media-2/image.png',
  name: 'canvas-two.png',
  title: 'Canvas Two',
  url: 'https://example.test/canvas-two.png',
  thumbnailUrl: 'https://example.test/canvas-two-thumb.png',
}

let host: HTMLDivElement
let root: Root
let mediaStoreBaseline: ReturnType<typeof useMediaStore.getState>

function menuButtons(): HTMLButtonElement[] {
  return [...document.body.querySelectorAll<HTMLButtonElement>('[role="menu"] button[role="menuitem"]')]
}

function menuButton(label: string): HTMLButtonElement | null {
  return menuButtons().find(button => button.textContent?.trim() === label) ?? null
}

function mediaCard(id: string): HTMLElement {
  const image = host.querySelector<HTMLImageElement>(`img[alt="${id === mediaOne.id ? mediaOne.name : mediaTwo.name}"]`)
  const card = image?.closest<HTMLElement>('.vz-media-card')
  if (!card) throw new Error(`Expected media card ${id}`)
  return card
}

function openMediaActions(id = mediaOne.id) {
  act(() => mediaCard(id).click())
}

function chooseAction(label: string) {
  const button = menuButton(label)
  if (!button) throw new Error(`Expected menu action ${label}`)
  act(() => button.click())
}

beforeEach(() => {
  mediaStoreBaseline = useMediaStore.getState()
  useMediaStore.setState({
    items: [mediaOne, mediaTwo],
    queryItemIds: [mediaOne.id, mediaTwo.id],
    collections: [],
    loading: false,
    nextPageLoading: false,
    refreshing: false,
    hasMore: false,
    queryError: null,
    invalidated: false,
    mutationStates: {},
    setLibraryQuery: vi.fn(),
    ensureLibraryLoaded: vi.fn().mockResolvedValue(undefined),
    ensureMediaSigned: vi.fn().mockResolvedValue(undefined),
    loadNextPage: vi.fn().mockResolvedValue(undefined),
    refreshLibrary: vi.fn().mockResolvedValue(undefined),
    loadCollections: vi.fn().mockResolvedValue(undefined),
  })
  useReactStore.getState().resetReactView()
  useReactStore.getState().selectReactEngine('canvas')
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  act(() => root.render(<CanvasEnginePanel />))
})

afterEach(() => {
  act(() => root.unmount())
  host.remove()
  useMediaStore.setState(mediaStoreBaseline)
  vi.restoreAllMocks()
})

describe('CANVAS Media Library Stage 2 actions', () => {
  it('opens exactly the three required primary actions and Escape dismisses without mutation', () => {
    openMediaActions()

    expect(menuButtons().map(button => button.textContent?.trim())).toEqual([
      'Make Active',
      'Add as Layer',
      'Add to Pool',
    ])
    expect(useReactStore.getState().activeCanvasMediaId).toBeNull()
    expect(useReactStore.getState().canvasOrchestrationSettings.authoredLayers).toEqual([])

    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))

    expect(document.body.querySelector('[role="menu"]')).toBeNull()
    expect(useReactStore.getState().activeCanvasMediaId).toBeNull()
    expect(useReactStore.getState().canvasOrchestrationSettings.authoredLayers).toEqual([])
  })

  it('Make Active preserves single-source behavior without changing layer or pool membership', () => {
    const layer = useReactStore.getState().addCanvasAuthoredLayer(mediaTwo.id)
    if (!layer.ok) throw new Error(layer.message)
    const pool = useReactStore.getState().createCanvasMediaPool('Main')
    if (!pool.ok) throw new Error(pool.message)
    useReactStore.getState().setActiveCanvasMediaPool(pool.pool.id)
    useReactStore.getState().addCanvasMediaToPool(pool.pool.id, mediaTwo.id)
    const before = useReactStore.getState().canvasOrchestrationSettings

    openMediaActions()
    chooseAction('Make Active')

    const state = useReactStore.getState()
    expect(state.activeCanvasMediaId).toBe(mediaOne.id)
    expect(state.canvasEngineSettings.manualMediaOverrideId).toBe(mediaOne.id)
    expect(state.canvasOrchestrationSettings.renderMode).toBe('single')
    expect(state.canvasOrchestrationSettings.authoredLayers).toEqual(before.authoredLayers)
    expect(state.canvasOrchestrationSettings.mediaPools).toEqual(before.mediaPools)
    expect(state.canvasOrchestrationSettings.mediaPoolIds).toEqual([mediaTwo.id])
  })

  it('Add as Layer creates a topmost manual pinned layer through the canonical store action', () => {
    const existing = useReactStore.getState().addCanvasAuthoredLayer(mediaTwo.id)
    if (!existing.ok) throw new Error(existing.message)

    openMediaActions()
    chooseAction('Add as Layer')

    const layers = useReactStore.getState().canvasOrchestrationSettings.authoredLayers
    expect(useReactStore.getState().canvasOrchestrationSettings.renderMode).toBe('layers')
    expect(layers).toHaveLength(2)
    expect(layers[0]).toMatchObject({
      mediaId: mediaOne.id,
      order: 0,
      ownership: 'manual',
      pinned: true,
    })
    expect(layers[1]).toMatchObject({ mediaId: mediaTwo.id, order: 1 })
  })

  it('requires explicit duplicate confirmation, Cancel is inert, and Confirm creates a distinct instance', () => {
    const initial = useReactStore.getState().addCanvasAuthoredLayer(mediaOne.id)
    if (!initial.ok) throw new Error(initial.message)

    openMediaActions()
    chooseAction('Add as Layer')

    expect(document.body.querySelector('[aria-label^="Confirm duplicate CANVAS layer"]')).not.toBeNull()
    expect(menuButtons().map(button => button.textContent?.trim())).toEqual(['Confirm', 'Cancel'])
    expect(useReactStore.getState().canvasOrchestrationSettings.authoredLayers).toHaveLength(1)

    chooseAction('Cancel')
    expect(useReactStore.getState().canvasOrchestrationSettings.authoredLayers).toHaveLength(1)

    openMediaActions()
    chooseAction('Add as Layer')
    chooseAction('Confirm')

    const layers = useReactStore.getState().canvasOrchestrationSettings.authoredLayers
    expect(layers).toHaveLength(2)
    expect(layers.every(layer => layer.mediaId === mediaOne.id)).toBe(true)
    expect(new Set(layers.map(layer => layer.id)).size).toBe(2)
  })

  it('lets the four-layer capacity guard win over duplicate confirmation and leaves state unchanged', () => {
    for (const mediaId of [mediaOne.id, 'capacity-b', 'capacity-c', 'capacity-d']) {
      const result = useReactStore.getState().addCanvasAuthoredLayer(mediaId)
      if (!result.ok) throw new Error(result.message)
    }
    const before = JSON.stringify(useReactStore.getState().canvasOrchestrationSettings.authoredLayers)

    openMediaActions()
    chooseAction('Add as Layer')

    expect(document.body.querySelector('[aria-label^="Confirm duplicate CANVAS layer"]')).toBeNull()
    expect(host.textContent).toContain('All four CANVAS layer slots are in use. Remove a layer before adding another.')
    expect(JSON.stringify(useReactStore.getState().canvasOrchestrationSettings.authoredLayers)).toBe(before)
  })

  it('Add to Pool fails safely without an active pool and targets the live active pool idempotently', () => {
    openMediaActions()
    chooseAction('Add to Pool')

    expect(host.textContent).toContain('Create or select a Media Pool first, then add this media again.')
    expect(useReactStore.getState().canvasOrchestrationSettings.mediaPools).toEqual([])

    const first = useReactStore.getState().createCanvasMediaPool('First')
    const second = useReactStore.getState().createCanvasMediaPool('Second')
    if (!first.ok || !second.ok) throw new Error('Expected two CANVAS pools')
    useReactStore.getState().setActiveCanvasMediaPool(first.pool.id)

    openMediaActions()
    act(() => {
      useReactStore.getState().setActiveCanvasMediaPool(second.pool.id)
    })
    chooseAction('Add to Pool')

    let pools = useReactStore.getState().canvasOrchestrationSettings.mediaPools
    expect(pools.find(pool => pool.id === first.pool.id)?.mediaIds).toEqual([])
    expect(pools.find(pool => pool.id === second.pool.id)?.mediaIds).toEqual([mediaOne.id])

    openMediaActions()
    chooseAction('Add to Pool')
    pools = useReactStore.getState().canvasOrchestrationSettings.mediaPools
    expect(pools.find(pool => pool.id === second.pool.id)?.mediaIds).toEqual([mediaOne.id])
  })
})
