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

    expect(container.querySelector('.vz-page-heading')).toBeNull()
    expect(container.querySelector('[data-testid="media-library-browser"]')).not.toBeNull()
    // The library counts and decorative page heading are absent from the header.
    expect(container.querySelector('.mmv-header')?.textContent).not.toMatch(/visual asset|audio track|collection/)
    expect(mocks.browserProps).toHaveBeenCalledWith(expect.objectContaining({
      activeMediaId: null,
      context: 'manager',
      title: 'Media Library',
      capabilities: MEDIA_MANAGER_CAPABILITIES,
    }))
    expect(MEDIA_MANAGER_CAPABILITIES).toEqual(expect.arrayContaining(['select', 'upload', 'edit', 'remove', 'collections']))
  })

  it('keeps the library, preview and Inspector mounted when either rounded rail collapses', () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    act(() => { root?.render(<MediaManagerView onOpenLyricManager={vi.fn()} />) })

    const workspace = container.querySelector('.mmv-content')!
    const library = container.querySelector('[data-testid="media-library-browser"]')
    const stage = container.querySelector('.mmv-stage-area')
    const inspector = container.querySelector('[data-testid="inspector"]')
    expect(container.querySelectorAll('.mmv-content > .fw-surface')).toHaveLength(3)
    expect(workspace.getAttribute('data-left-collapsed')).toBe('false')
    expect(workspace.getAttribute('data-right-collapsed')).toBe('false')

    const leftToggle = container.querySelector<HTMLButtonElement>('[aria-label="Collapse left inspector"]')!
    const rightToggle = container.querySelector<HTMLButtonElement>('[aria-label="Collapse right inspector"]')!
    act(() => { leftToggle.click(); rightToggle.click() })
    expect(workspace.getAttribute('data-left-collapsed')).toBe('true')
    expect(workspace.getAttribute('data-right-collapsed')).toBe('true')
    expect(container.querySelector('[data-testid="media-library-browser"]')).toBe(library)
    expect(container.querySelector('.mmv-stage-area')).toBe(stage)
    expect(container.querySelector('[data-testid="inspector"]')).toBe(inspector)
    expect(container.querySelectorAll('.vz-inspector--collapsed')).toHaveLength(2)
  })

  it('puts New Collection, Add Media, Save Changes and Delete Media in the header control group, wired to what the Info tab publishes', () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    act(() => { root?.render(<MediaManagerView onOpenLyricManager={vi.fn()} />) })

    const group = container.querySelector('.mmv-header .vz-header-group')
    expect(group?.getAttribute('aria-label')).toBe('Media Manager controls')
    const allButtons = () => [...group!.querySelectorAll<HTMLButtonElement>('button')]
    // The two creation keys come first, are always live, and no longer sit in the Media Library window header.
    const buttons = () => allButtons().slice(2)
    expect(container.querySelector('.rw-window-header-actions')).toBeNull()
    // Icon-only keys (like the Show Manager's): the accessible name is the label, there is no visible text.
    expect(allButtons().map(button => button.getAttribute('aria-label'))).toEqual(['New Collection', 'New Media', 'Save Changes', 'Delete Media'])
    expect(allButtons().slice(0, 2).every(button => !button.disabled)).toBe(true)
    expect(buttons().every(button => button.textContent?.trim() === '' && button.querySelector('svg'))).toBe(true)
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
    expect(buttons()[0]!.title).toBe('Saving…')
    expect(buttons().every(button => button.disabled)).toBe(true)
  })
})
