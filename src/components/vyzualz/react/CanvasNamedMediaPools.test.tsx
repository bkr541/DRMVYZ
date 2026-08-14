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
  id: 'canvas-pool-media-1',
  dbId: 'db-canvas-pool-media-1',
  storagePath: 'user/canvas-pool-media-1/image.png',
  mimeType: 'image/png',
  name: 'pool-one.png',
  title: 'Pool One',
  description: 'CANVAS pool test visual one',
  type: 'image',
  url: 'https://example.test/pool-one.png',
  thumbnailUrl: 'https://example.test/pool-one-thumb.png',
  meta: 'PNG · 1920×1080',
  favorite: false,
  mediaRole: 'background_image',
  tags: ['canvas'],
  collectionIds: [],
  metadata: { width: 1920, height: 1080 },
}

const mediaTwo: UploadedMedia = {
  ...mediaOne,
  id: 'canvas-pool-media-2',
  dbId: 'db-canvas-pool-media-2',
  storagePath: 'user/canvas-pool-media-2/image.png',
  name: 'pool-two.png',
  title: 'Pool Two',
  url: 'https://example.test/pool-two.png',
  thumbnailUrl: 'https://example.test/pool-two-thumb.png',
}

let host: HTMLDivElement
let root: Root
let mediaStoreBaseline: ReturnType<typeof useMediaStore.getState>

function poolPanel(): HTMLElement {
  const panel = host.querySelector<HTMLElement>('[aria-label="CANVAS Media Pools"]')
  if (!panel) throw new Error('Expected CANVAS Media Pools panel')
  return panel
}

function poolButton(name: string): HTMLButtonElement {
  const button = [...poolPanel().querySelectorAll<HTMLButtonElement>('.rv-canvas-pools__select')]
    .find(candidate => candidate.textContent?.includes(name))
  if (!button) throw new Error(`Expected pool selector ${name}`)
  return button
}

function poolRow(name: string): HTMLElement {
  const row = poolButton(name).closest<HTMLElement>('.rv-canvas-pools__row')
  if (!row) throw new Error(`Expected pool row ${name}`)
  return row
}

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  act(() => {
    setter?.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

function clickButton(container: ParentNode, label: string) {
  const button = [...container.querySelectorAll<HTMLButtonElement>('button')]
    .find(candidate => candidate.textContent?.trim() === label)
  if (!button) throw new Error(`Expected button ${label}`)
  act(() => button.click())
}

function createPool(name: string) {
  const input = poolPanel().querySelector<HTMLInputElement>('[aria-label="New CANVAS Media Pool name"]')
  if (!input) throw new Error('Expected new pool name input')
  setInputValue(input, name)
  clickButton(poolPanel(), 'Create')
}

function mediaCard(media: UploadedMedia): HTMLElement {
  const image = host.querySelector<HTMLImageElement>(`img[alt="${media.name}"]`)
  const card = image?.closest<HTMLElement>('.vz-media-card')
  if (!card) throw new Error(`Expected media card ${media.id}`)
  return card
}

function addMediaToPool(media: UploadedMedia) {
  act(() => mediaCard(media).click())
  const add = [...document.body.querySelectorAll<HTMLButtonElement>('[role="menu"] button[role="menuitem"]')]
    .find(button => button.textContent?.trim() === 'Add to Pool')
  if (!add) throw new Error('Expected Add to Pool action')
  act(() => add.click())
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

describe('CANVAS Stage 5 named Media Pools', () => {
  it('authors multiple Pools while keeping inspected, active, Make Active, and manual-layer state independent', () => {
    act(() => {
      useReactStore.getState().selectCanvasMediaItem(mediaTwo.id)
      const layer = useReactStore.getState().addCanvasAuthoredLayer(mediaTwo.id)
      if (!layer.ok) throw new Error(layer.message)
    })
    const originalLayerIds = useReactStore.getState().canvasOrchestrationSettings.authoredLayers.map(layer => layer.id)

    createPool('Warmup')
    createPool('Drop')
    expect(useReactStore.getState().canvasOrchestrationSettings.mediaPools.map(pool => pool.name)).toEqual(['Warmup', 'Drop'])

    act(() => poolButton('Warmup').click())
    const warmupRow = poolRow('Warmup')
    const activateWarmup = warmupRow.querySelector<HTMLButtonElement>('[aria-label="Activate CANVAS Media Pool Warmup"]')
    if (!activateWarmup) throw new Error('Expected Warmup activation')
    act(() => activateWarmup.click())
    const warmupId = useReactStore.getState().canvasOrchestrationSettings.activeMediaPoolId
    expect(warmupId).not.toBeNull()

    addMediaToPool(mediaOne)
    expect(useReactStore.getState().canvasOrchestrationSettings.mediaPools.find(pool => pool.id === warmupId)?.mediaIds).toEqual([mediaOne.id])

    act(() => poolButton('Drop').click())
    expect(useReactStore.getState().canvasOrchestrationSettings.activeMediaPoolId).toBe(warmupId)
    expect(poolPanel().querySelector('[aria-label="Inspect CANVAS Media Pool Drop"]')).not.toBeNull()

    const dropRow = poolRow('Drop')
    const activateDrop = dropRow.querySelector<HTMLButtonElement>('[aria-label="Activate CANVAS Media Pool Drop"]')
    if (!activateDrop) throw new Error('Expected Drop activation')
    act(() => activateDrop.click())
    const dropId = useReactStore.getState().canvasOrchestrationSettings.activeMediaPoolId
    expect(dropId).not.toBe(warmupId)

    addMediaToPool(mediaTwo)
    expect(useReactStore.getState().canvasOrchestrationSettings.mediaPools.find(pool => pool.id === dropId)?.mediaIds).toEqual([mediaTwo.id])

    act(() => poolButton('Warmup').click())
    const removeWarmup = poolPanel().querySelector<HTMLButtonElement>(`[aria-label="Remove Pool One from CANVAS Media Pool Warmup"]`)
    if (!removeWarmup) throw new Error('Expected Warmup membership removal')
    act(() => removeWarmup.click())
    expect(useReactStore.getState().canvasOrchestrationSettings.mediaPools.find(pool => pool.id === warmupId)?.mediaIds).toEqual([])

    expect(useReactStore.getState().activeCanvasMediaId).toBe(mediaTwo.id)
    expect(useReactStore.getState().canvasOrchestrationSettings.authoredLayers.map(layer => layer.id)).toEqual(originalLayerIds)
  })

  it('renames and deletes inspected Pools with confirmation and clears an active Pool without random replacement', () => {
    createPool('Warmup')
    createPool('Drop')

    const dropRow = poolRow('Drop')
    const activateDrop = dropRow.querySelector<HTMLButtonElement>('[aria-label="Activate CANVAS Media Pool Drop"]')
    if (!activateDrop) throw new Error('Expected Drop activation')
    act(() => activateDrop.click())
    const activeDropId = useReactStore.getState().canvasOrchestrationSettings.activeMediaPoolId

    clickButton(poolPanel(), 'Rename')
    const rename = poolPanel().querySelector<HTMLInputElement>('[aria-label="Rename CANVAS Media Pool Drop"]')
    if (!rename) throw new Error('Expected rename input')
    setInputValue(rename, 'Drop Rotation')
    clickButton(poolPanel(), 'Save')
    expect(useReactStore.getState().canvasOrchestrationSettings.mediaPools.find(pool => pool.id === activeDropId)?.name).toBe('Drop Rotation')

    clickButton(poolPanel(), 'Delete')
    expect(poolPanel().textContent).toContain('Confirm Delete')
    clickButton(poolPanel(), 'Confirm Delete')

    const state = useReactStore.getState().canvasOrchestrationSettings
    expect(state.mediaPools.map(pool => pool.name)).toEqual(['Warmup'])
    expect(state.activeMediaPoolId).toBeNull()
    expect(state.mediaPoolIds).toEqual([])
    expect(poolPanel().textContent).toContain('None active')
  })
})
