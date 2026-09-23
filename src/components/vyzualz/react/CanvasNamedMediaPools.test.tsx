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

function findButton(container: ParentNode, label: string): HTMLButtonElement {
  const button = [...container.querySelectorAll<HTMLButtonElement>('button')]
    .find(candidate => candidate.textContent?.trim() === label)
  if (!button) throw new Error(`Expected button ${label}`)
  return button
}

function openPoolsTab() {
  act(() => findButton(host, 'Pools').click())
}

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  act(() => {
    setter?.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

function createPool(name: string) {
  const input = host.querySelector<HTMLInputElement>('[aria-label="New pool name"]')
  if (!input) throw new Error('Expected new pool name input')
  setInputValue(input, name)
  act(() => findButton(host, 'Add Pool').click())
}

function mediaCard(media: UploadedMedia): HTMLElement {
  const image = host.querySelector<HTMLImageElement>(`img[alt="${media.name}"]`)
  const card = image?.closest<HTMLElement>('.vz-media-card')
  if (!card) throw new Error(`Expected media card ${media.id}`)
  return card
}

function addMediaToPool(media: UploadedMedia, poolName: string) {
  act(() => mediaCard(media).click())
  const add = [...document.body.querySelectorAll<HTMLButtonElement>('[role="menu"] button[role="menuitem"]')]
    .find(button => button.textContent?.trim() === 'Add to Pool')
  if (!add) throw new Error('Expected Add to Pool action')
  expect(add.getAttribute('aria-haspopup')).toBe('menu')
  act(() => add.click())
  const option = [...document.body.querySelectorAll<HTMLButtonElement>('.vz-add-to-picker__option')]
    .find(candidate => candidate.textContent?.includes(poolName))
  if (!option) throw new Error(`Expected pool option ${poolName}`)
  act(() => option.click())
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

describe('CANVAS Media Library Pools', () => {
  it('no longer renders the standalone Media Pools group under the library', () => {
    expect(host.querySelector('[aria-label="CANVAS Media Pools"]')).toBeNull()
    expect(host.textContent).not.toContain('Media Pools')
  })

  it('creates named Pools from the Pools tab and lists them as groups with count and thumbnails', () => {
    openPoolsTab()
    expect(host.textContent).toContain('No Pools yet.')
    createPool('Warmup')
    createPool('Drop')
    expect(useReactStore.getState().canvasOrchestrationSettings.mediaPools.map(pool => pool.name)).toEqual(['Warmup', 'Drop'])

    const folders = [...host.querySelectorAll<HTMLElement>('.vz-coll-folder')]
    expect(folders).toHaveLength(2)
    expect(folders[0].textContent).toContain('Warmup')
    expect(folders[0].textContent).toContain('0 items')
  })

  it('Add to Pool flyout lists Pools and adds the right-clicked media to the chosen Pool', () => {
    openPoolsTab()
    createPool('Warmup')
    createPool('Drop')
    act(() => findButton(host, 'All').click())

    addMediaToPool(mediaOne, 'Warmup')
    const pools = useReactStore.getState().canvasOrchestrationSettings.mediaPools
    expect(pools.find(pool => pool.name === 'Warmup')?.mediaIds).toEqual([mediaOne.id])
    expect(pools.find(pool => pool.name === 'Drop')?.mediaIds).toEqual([])

    addMediaToPool(mediaTwo, 'Warmup')
    expect(useReactStore.getState().canvasOrchestrationSettings.mediaPools.find(pool => pool.name === 'Warmup')?.mediaIds)
      .toEqual([mediaOne.id, mediaTwo.id])

    addMediaToPool(mediaTwo, 'Warmup')
    expect(useReactStore.getState().canvasOrchestrationSettings.mediaPools.find(pool => pool.name === 'Warmup')?.mediaIds)
      .toEqual([mediaOne.id, mediaTwo.id])

    openPoolsTab()
    const warmup = [...host.querySelectorAll<HTMLElement>('.vz-coll-folder')].find(folder => folder.textContent?.includes('Warmup'))
    expect(warmup?.textContent).toContain('2 items')
    expect(warmup?.querySelectorAll('.vz-coll-thumb img')).toHaveLength(2)
  })

  it('sets and clears the active Pool from the Pools tab and deletes a Pool with confirmation', () => {
    openPoolsTab()
    createPool('Warmup')
    createPool('Drop')

    const activate = host.querySelector<HTMLButtonElement>('[aria-label="Activate pool Drop"]')
    if (!activate) throw new Error('Expected Drop activation')
    act(() => activate.click())
    const dropId = useReactStore.getState().canvasOrchestrationSettings.activeMediaPoolId
    expect(useReactStore.getState().canvasOrchestrationSettings.mediaPools.find(pool => pool.id === dropId)?.name).toBe('Drop')

    const dropFolder = [...host.querySelectorAll<HTMLElement>('.vz-coll-folder')].find(folder => folder.textContent?.includes('Drop'))
    const remove = dropFolder?.querySelector<HTMLButtonElement>('button[title="Delete pool"]')
    if (!remove) throw new Error('Expected Drop delete button')
    act(() => remove.click())
    act(() => findButton(document.body, 'Delete').click())

    const state = useReactStore.getState().canvasOrchestrationSettings
    expect(state.mediaPools.map(pool => pool.name)).toEqual(['Warmup'])
    expect(state.activeMediaPoolId).toBeNull()
  })
})
