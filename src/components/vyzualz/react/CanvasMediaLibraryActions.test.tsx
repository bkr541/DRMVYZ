/** @vitest-environment jsdom */
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useMediaStore, type UploadedMedia } from '../../../stores/mediaStore'
import { useReactStore } from '../../../stores/reactStore'
import { CanvasEnginePanel } from './ReactCanvasEngineShell'
import { clearCanvasLayerAdmissionCacheForTests, setCanvasTransparentPngVerificationForTests } from './canvasLayerAdmission'

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

function admissionMedia(media: UploadedMedia) {
  return {
    id: media.id,
    name: media.title?.trim() || media.name,
    type: 'image' as const,
    objectUrl: media.url ?? '',
    mimeType: media.mimeType,
    mediaRevision: media.revision,
  }
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

async function flushAsyncActions() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

beforeEach(() => {
  clearCanvasLayerAdmissionCacheForTests()
  setCanvasTransparentPngVerificationForTests(admissionMedia(mediaOne), true)
  setCanvasTransparentPngVerificationForTests(admissionMedia(mediaTwo), true)
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

    expect(useMediaStore.getState().ensureMediaSigned).toHaveBeenCalledWith([mediaOne.id], 'visible')
    expect(document.body.querySelector('.vz-app-context-menu__meta')).toBeNull()
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

  it('omits Add as Layer for a verified opaque PNG', () => {
    setCanvasTransparentPngVerificationForTests(admissionMedia(mediaOne), false)
    openMediaActions()
    expect(menuButtons().map(button => button.textContent?.trim())).toEqual(['Make Active', 'Add to Pool'])
  })

  it('keeps Add as Layer absent while PNG transparency verification is pending', () => {
    clearCanvasLayerAdmissionCacheForTests()
    setCanvasTransparentPngVerificationForTests(admissionMedia(mediaTwo), true)
    useMediaStore.setState({ ensureMediaSigned: vi.fn(() => new Promise<void>(() => undefined)) })
    openMediaActions()
    expect(menuButtons().map(button => button.textContent?.trim())).toEqual(['Make Active', 'Add to Pool'])
  })

  it('Make Active switches the single source without consuming an authored-layer slot', () => {
    openMediaActions()
    chooseAction('Make Active')

    const state = useReactStore.getState()
    expect(state.activeCanvasMediaId).toBe(mediaOne.id)
    expect(state.canvasOrchestrationSettings.renderMode).toBe('single')
    expect(state.canvasOrchestrationSettings.authoredLayers).toEqual([])
  })

  it('Make Active retires the previous authored composition without changing pool membership', () => {
    const layer = useReactStore.getState().addCanvasAuthoredLayer(mediaTwo.id)
    if (!layer.ok) throw new Error(layer.message)
    useReactStore.getState().addCanvasLayerEffect(layer.layer.id, 'echo')
    const pool = useReactStore.getState().createCanvasMediaPool('Main')
    if (!pool.ok) throw new Error(pool.message)
    useReactStore.getState().setActiveCanvasMediaPool(pool.pool.id)
    useReactStore.getState().addCanvasMediaToPool(pool.pool.id, mediaTwo.id)
    const beforePools = useReactStore.getState().canvasOrchestrationSettings.mediaPools

    openMediaActions()
    chooseAction('Make Active')

    const state = useReactStore.getState()
    expect(state.activeCanvasMediaId).toBe(mediaOne.id)
    expect(state.canvasEngineSettings.manualMediaOverrideId).toBe(mediaOne.id)
    expect(state.canvasOrchestrationSettings.renderMode).toBe('single')
    expect(state.canvasOrchestrationSettings.authoredLayers).toEqual([])
    expect(state.getCanvasPrimaryLayer()).toMatchObject({ mediaId: mediaOne.id, effects: [] })
    expect(state.canvasOrchestrationSettings.mediaPools).toEqual(beforePools)
    expect(state.canvasOrchestrationSettings.mediaPoolIds).toEqual([mediaTwo.id])
  })

  it('Make Active after four active layers exposes Add as Layer for a verified transparent PNG', () => {
    for (const mediaId of ['capacity-a', 'capacity-b', 'capacity-c', 'capacity-d']) {
      const result = useReactStore.getState().addCanvasAuthoredLayer(mediaId)
      if (!result.ok) throw new Error(result.message)
    }

    openMediaActions(mediaOne.id)
    chooseAction('Make Active')
    expect(useReactStore.getState().canvasOrchestrationSettings.authoredLayers).toEqual([])
    expect(useReactStore.getState().canvasOrchestrationSettings.renderMode).toBe('single')

    openMediaActions(mediaTwo.id)
    expect(menuButton('Add as Layer')).not.toBeNull()
  })

  it('reproduces the recorded Auto Performance → Make Active → Add as Layer handoff', async () => {
    act(() => useReactStore.getState().setCanvasOrchestrationSettings({ enabled: true }))
    expect(useReactStore.getState().canvasOrchestrationSettings.renderMode).toBe('performance')

    openMediaActions(mediaTwo.id)
    chooseAction('Make Active')
    expect(useReactStore.getState().activeCanvasMediaId).toBe(mediaTwo.id)
    expect(useReactStore.getState().canvasOrchestrationSettings).toMatchObject({
      enabled: true,
      renderMode: 'single',
    })

    openMediaActions(mediaOne.id)
    chooseAction('Add as Layer')
    await flushAsyncActions()

    const state = useReactStore.getState()
    expect(state.canvasOrchestrationSettings.renderMode).toBe('layers')
    expect(state.canvasOrchestrationSettings.authoredLayers.map(layer => layer.mediaId)).toEqual([
      mediaTwo.id,
      mediaOne.id,
    ])
    expect(state.selectedCanvasLayerId).toBe(state.canvasOrchestrationSettings.authoredLayers[1]?.id)
    expect(document.body.querySelector('.vz-app-context-menu__meta')).toBeNull()
  })

  it('Add as Layer promotes the visible single source first and appends the new manual pinned layer', async () => {
    act(() => useReactStore.getState().selectCanvasMediaItem(mediaTwo.id))
    expect(useReactStore.getState().canvasOrchestrationSettings.renderMode).toBe('single')

    openMediaActions()
    chooseAction('Add as Layer')
    await flushAsyncActions()

    const state = useReactStore.getState()
    const layers = state.canvasOrchestrationSettings.authoredLayers
    expect(state.canvasOrchestrationSettings.renderMode).toBe('layers')
    expect(layers).toHaveLength(2)
    expect(layers[0]).toMatchObject({
      mediaId: mediaTwo.id,
      order: 0,
      enabled: true,
      solo: false,
      ownership: 'manual',
      pinned: true,
    })
    expect(layers[1]).toMatchObject({
      mediaId: mediaOne.id,
      order: 1,
      enabled: true,
      solo: false,
      ownership: 'manual',
      pinned: true,
    })
    expect(state.selectedCanvasLayerId).toBe(layers[1]?.id)
  })

  it('does not switch out of the visible single-source renderer until layer media signing completes', async () => {
    act(() => useReactStore.getState().selectCanvasMediaItem(mediaTwo.id))
    openMediaActions()

    let finishSigning: (() => void) | null = null
    useMediaStore.setState({
      ensureMediaSigned: vi.fn(() => new Promise<void>(resolve => { finishSigning = resolve })),
    })

    chooseAction('Add as Layer')
    expect(useReactStore.getState().canvasOrchestrationSettings.renderMode).toBe('single')
    expect(useReactStore.getState().canvasOrchestrationSettings.authoredLayers).toEqual([])

    await act(async () => {
      finishSigning?.()
      await Promise.resolve()
      await Promise.resolve()
    })

    const state = useReactStore.getState()
    expect(state.canvasOrchestrationSettings.renderMode).toBe('layers')
    expect(state.canvasOrchestrationSettings.authoredLayers.map(layer => layer.mediaId)).toEqual([
      mediaTwo.id,
      mediaOne.id,
    ])
  })

  it('requires explicit duplicate confirmation, Cancel is inert, and Confirm creates a distinct instance', async () => {
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
    await flushAsyncActions()

    const layers = useReactStore.getState().canvasOrchestrationSettings.authoredLayers
    expect(layers).toHaveLength(2)
    expect(layers.every(layer => layer.mediaId === mediaOne.id)).toBe(true)
    expect(new Set(layers.map(layer => layer.id)).size).toBe(2)
  })

  it('omits Add as Layer at four occupied slots and exposes it again after removal', () => {
    for (const mediaId of [mediaOne.id, 'capacity-b', 'capacity-c', 'capacity-d']) {
      const result = useReactStore.getState().addCanvasAuthoredLayer(mediaId)
      if (!result.ok) throw new Error(result.message)
    }

    openMediaActions(mediaTwo.id)
    expect(menuButton('Add as Layer')).toBeNull()

    const layerToRemove = useReactStore.getState().canvasOrchestrationSettings.authoredLayers[1]
    if (!layerToRemove) throw new Error('Expected removable CANVAS layer')
    act(() => { useReactStore.getState().removeCanvasAuthoredLayer(layerToRemove.id) })
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))

    openMediaActions(mediaTwo.id)
    expect(menuButton('Add as Layer')).not.toBeNull()
  })

  it('does not let a disabled authored layer hide Add as Layer when only three media are rendered', () => {
    const layers = [mediaOne.id, 'capacity-b', 'capacity-c', 'capacity-d'].map(mediaId => {
      const result = useReactStore.getState().addCanvasAuthoredLayer(mediaId)
      if (!result.ok) throw new Error(result.message)
      return result.layer
    })
    expect(useReactStore.getState().updateCanvasAuthoredLayer(layers[1].id, { enabled: false }).ok).toBe(true)

    openMediaActions(mediaTwo.id)
    expect(menuButton('Add as Layer')).not.toBeNull()
  })

  it('Add to Pool fails safely without an active pool and targets the live active pool idempotently', () => {
    openMediaActions()
    chooseAction('Add to Pool')

    expect(host.textContent).toContain('Create or activate a Media Pool first, then add this media again.')
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
