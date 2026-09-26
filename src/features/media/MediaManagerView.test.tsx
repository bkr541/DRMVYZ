// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  browserProps: vi.fn(),
  inspectorProps: { current: null as null | { onHeaderActions?: (actions: unknown) => void } },
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

vi.mock('../../components/vyzualz/media/MediaManagerInspector', () => ({
  MediaManagerInspector: (props: { onHeaderActions?: (actions: unknown) => void }) => {
    mocks.inspectorProps.current = props
    return <div data-testid="inspector" />
  },
}))

import { MediaManagerView } from './MediaManagerView'
import { MEDIA_MANAGER_CAPABILITIES } from '../../components/vyzualz/media/mediaLibraryCapabilities'

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
      root?.render(<MediaManagerView onOpenLyricManager={vi.fn()} />)
    })

    expect(container.querySelector('#media-manager-title')?.textContent).toBe('Media Manager')
    expect(container.querySelector('[data-testid="media-library-browser"]')).not.toBeNull()
    // The library counts were removed from the header; the header holds only the heading and the profile control.
    expect(container.querySelector('.mmv-header')?.textContent).not.toMatch(/visual asset|audio track|collection/)
    expect(mocks.browserProps).toHaveBeenCalledWith(expect.objectContaining({
      activeMediaId: null,
      context: 'manager',
      title: 'Media Library',
      capabilities: MEDIA_MANAGER_CAPABILITIES,
    }))
    expect(MEDIA_MANAGER_CAPABILITIES).toEqual(expect.arrayContaining(['select', 'upload', 'edit', 'remove', 'collections']))
  })

  it('puts Save Changes and Delete Media in the header control group, wired to what the Info tab publishes', () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    act(() => { root?.render(<MediaManagerView onOpenLyricManager={vi.fn()} />) })

    const group = container.querySelector('.mmv-header .vz-header-group')
    expect(group?.getAttribute('aria-label')).toBe('Media Manager controls')
    const buttons = () => [...group!.querySelectorAll<HTMLButtonElement>('button')]
    expect(buttons().map(button => button.textContent?.trim())).toEqual(['Save Changes', 'Delete Media'])
    // Nothing published yet (no Info tab showing): both keys are dead.
    expect(buttons().every(button => button.disabled)).toBe(true)

    const onSave = vi.fn()
    const onDelete = vi.fn()
    act(() => { mocks.inspectorProps.current?.onHeaderActions?.({ onSave, saving: false, onDelete, deleting: false }) })
    expect(buttons().every(button => !button.disabled)).toBe(true)
    act(() => { buttons()[0]!.click() })
    act(() => { buttons()[1]!.click() })
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onDelete).toHaveBeenCalledTimes(1)

    act(() => { mocks.inspectorProps.current?.onHeaderActions?.({ onSave, saving: true, onDelete: null, deleting: false }) })
    expect(buttons()[0]!.textContent?.trim()).toBe('Saving…')
    expect(buttons().every(button => button.disabled)).toBe(true)
  })
})
