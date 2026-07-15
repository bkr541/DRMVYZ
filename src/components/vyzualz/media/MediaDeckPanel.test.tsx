// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  browserProps: vi.fn(),
}))

vi.mock('./MediaLibraryBrowser', () => ({
  MediaLibraryBrowser: (props: unknown) => {
    mocks.browserProps(props)
    return <div data-testid="media-deck-browser" />
  },
}))

import { MediaDeckPanel } from './MediaDeckPanel'
import { MEDIA_DECK_CAPABILITIES } from './mediaLibraryCapabilities'

let container: HTMLDivElement | null = null
let root: ReturnType<typeof createRoot> | null = null

afterEach(() => {
  if (root) act(() => root?.unmount())
  container?.remove()
  root = null
  container = null
  vi.clearAllMocks()
})

describe('MediaDeckPanel performance adapter', () => {
  it('exposes only performance-focused deck capabilities', () => {
    expect(MEDIA_DECK_CAPABILITIES).toEqual([
      'select',
      'load-track',
      'lyrics',
      'preview',
      'favorite',
      'collections',
      'drag-media',
    ])
    expect(MEDIA_DECK_CAPABILITIES).not.toContain('upload')
    expect(MEDIA_DECK_CAPABILITIES).not.toContain('edit')
    expect(MEDIA_DECK_CAPABILITIES).not.toContain('remove')
  })

  it('uses the shared performance-only contract in Visualizer', () => {
    const onSelect = vi.fn()
    const onOpenMediaManager = vi.fn()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)

    act(() => {
      root?.render(
        <MediaDeckPanel
          activeMediaId="media-1"
          onSelect={onSelect}
          onOpenMediaManager={onOpenMediaManager}
        />,
      )
    })

    expect(mocks.browserProps).toHaveBeenCalledWith(expect.objectContaining({
      activeMediaId: 'media-1',
      onSelect,
      onOpenMediaManager,
      context: 'visualizer',
      title: 'Media Deck',
      capabilities: MEDIA_DECK_CAPABILITIES,
    }))
  })

  it('uses the same capability contract in React View', () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)

    act(() => {
      root?.render(<MediaDeckPanel mode="react" activeMediaId={null} onSelect={vi.fn()} />)
    })

    expect(mocks.browserProps).toHaveBeenCalledWith(expect.objectContaining({
      context: 'react',
      capabilities: MEDIA_DECK_CAPABILITIES,
    }))
  })
})
