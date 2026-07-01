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

describe('MediaDeckPanel compatibility adapter', () => {
  it('keeps the complete pre-refactor deck capability contract', () => {
    expect(MEDIA_DECK_CAPABILITIES).toEqual([
      'select',
      'load-track',
      'preview',
      'favorite',
      'upload',
      'edit',
      'remove',
      'collections',
      'drag-media',
    ])
  })

  it('preserves every existing deck capability in Visualizer', () => {
    const onSelect = vi.fn()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)

    act(() => {
      root?.render(<MediaDeckPanel activeMediaId="media-1" onSelect={onSelect} />)
    })

    expect(mocks.browserProps).toHaveBeenCalledWith(expect.objectContaining({
      activeMediaId: 'media-1',
      onSelect,
      context: 'visualizer',
      title: 'Media Deck',
      capabilities: [
        'select',
        'load-track',
        'preview',
        'favorite',
        'upload',
        'edit',
        'remove',
        'collections',
        'drag-media',
      ],
    }))
  })

  it('preserves the React-specific browsing context', () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)

    act(() => {
      root?.render(<MediaDeckPanel mode="react" activeMediaId={null} onSelect={vi.fn()} />)
    })

    expect(mocks.browserProps).toHaveBeenCalledWith(expect.objectContaining({ context: 'react' }))
  })
})
