// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  setActiveMedia: vi.fn(),
  browserProps: vi.fn(),
}))

vi.mock('../../stores/visualStore', () => ({
  useVisualStore: (selector: (state: unknown) => unknown) => selector({
    activeMediaId: 'media-1',
    setActiveMedia: mocks.setActiveMedia,
  }),
}))

vi.mock('../../stores/mediaStore', () => ({
  useMediaStore: (selector: (state: unknown) => unknown) => selector({
    items: [{ id: 'media-1' }, { id: 'media-2' }],
    collections: [{ id: 'collection-1' }],
  }),
}))

vi.mock('../../stores/audioStore', () => ({
  useAudioStore: (selector: (state: unknown) => unknown) => selector({
    savedTracks: [{ id: 'track-1' }],
  }),
}))

vi.mock('../../components/vyzualz/media/MediaLibraryBrowser', () => ({
  MediaLibraryBrowser: (props: unknown) => {
    mocks.browserProps(props)
    return <div data-testid="media-library-browser">Shared media browser</div>
  },
}))

import { MediaManagerView } from './MediaManagerView'

let container: HTMLDivElement | null = null
let root: ReturnType<typeof createRoot> | null = null

afterEach(() => {
  if (root) act(() => root?.unmount())
  container?.remove()
  root = null
  container = null
  vi.clearAllMocks()
})

describe('MediaManagerView', () => {
  it('renders a real management workspace without requiring a loaded track', () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)

    act(() => {
      root?.render(<MediaManagerView returnView="react" onBack={vi.fn()} />)
    })

    expect(container.querySelector('#media-manager-title')?.textContent).toBe('Media Manager')
    expect(container.querySelector('[data-testid="media-library-browser"]')).not.toBeNull()
    expect(container.textContent).toContain('2 visual assets')
    expect(container.textContent).toContain('1 audio track')
    expect(mocks.browserProps).toHaveBeenCalledWith(expect.objectContaining({
      activeMediaId: 'media-1',
      context: 'manager',
      title: 'Media Library',
      onSelect: mocks.setActiveMedia,
    }))
  })

  it('returns to the prior performance view', () => {
    const onBack = vi.fn()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)

    act(() => {
      root?.render(<MediaManagerView returnView="visualizer" onBack={onBack} />)
    })

    const backButton = container.querySelector<HTMLButtonElement>('[aria-label="Return to Visualizer"]')
    expect(backButton).not.toBeNull()
    act(() => backButton?.click())
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})
