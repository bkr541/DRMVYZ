// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act, useLayoutEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  browserProps: vi.fn(),
  onBrowserCommit: vi.fn(),
  inspectorProps: { current: null as null | { onHeaderActions?: (actions: unknown) => void } },
}))

vi.mock('../../context/AudioEngineContext', () => ({ useSharedAudio: () => ({ source: 'file' }) }))
vi.mock('../../lib/adminAccess', () => ({ useAdminAccess: () => false, useAdminAccessStatus: () => 'denied', hasAdminAccess: () => false }))

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
    useLayoutEffect(() => { mocks.onBrowserCommit() })
    return <div data-testid="media-library-browser">Shared media browser</div>
  },
}))

vi.mock('../../components/vyzualz/media/MediaManagerInspector', () => ({
  MediaManagerInspector: (props: { onHeaderActions?: (actions: unknown) => void }) => {
    mocks.inspectorProps.current = props
    return <div data-testid="inspector" />
  },
  // The Save As popover reuses the Info tab's tag and collection pickers.
  TagsCollectionsGroup: () => <div data-testid="tags-collections" />,
}))

import { MediaManagerView } from './MediaManagerView'
import { MEDIA_MANAGER_CAPABILITIES } from '../../components/vyzualz/media/mediaLibraryCapabilities'
import { ApplicationWorkspaceFrame } from '../../components/vyzualz/layout/ApplicationWorkspaceFrame'

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
  it('keeps the real page header out of the workspace body throughout the first commit', async () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    const inlineHeaders: number[] = []
    mocks.onBrowserCommit.mockImplementation(() => {
      inlineHeaders.push(container!.querySelectorAll('.fw-app-content .mmv-header').length)
    })

    await act(async () => root?.render(
      <ApplicationWorkspaceFrame appView="media" onAppViewChange={vi.fn()}>
        <MediaManagerView onOpenLyricManager={vi.fn()} />
      </ApplicationWorkspaceFrame>,
    ))

    expect(inlineHeaders.length).toBeGreaterThan(0)
    expect(inlineHeaders.every(count => count === 0)).toBe(true)
    expect(container.querySelectorAll('.vz-header-brand-name')).toHaveLength(1)
    expect(container.querySelectorAll('[data-react-header-status]')).toHaveLength(1)
    const header = container.querySelector('.fw-app-header-controls > .mmv-header')!
    expect(header.querySelector('.vz-header-brand-name')?.textContent).toBe('Media Manager')
    expect(header.querySelector('[aria-label="New Collection"]')).not.toBeNull()
    expect(header.querySelector('.rv-header-search input')).not.toBeNull()
  })

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
    const stage = container.querySelector('.mmv-stage-area')!
    const previewHeader = stage.firstElementChild!
    expect(previewHeader.matches('.rw-window-header.rw-window-header--left')).toBe(true)
    expect(previewHeader.querySelector('.rw-window-header-label')?.textContent).toBe('Media Preview')
    expect(previewHeader.nextElementSibling).not.toBeNull()
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
    expect(stage.firstElementChild).toBe(previewHeader)
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
    // The two creation keys come first, are always live, and no longer sit in the Media Library window header. There is one plus: New Media.
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
    act(() => { mocks.inspectorProps.current?.onHeaderActions?.({ onSave, saving: false, canSave: true, onRevert: null, canRevert: false, saveAs: null, onDelete, deleting: false }) })
    expect(buttons().every(button => !button.disabled)).toBe(true)
    act(() => { buttons()[0]!.click() })
    act(() => { buttons()[1]!.click() })
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onDelete).toHaveBeenCalledTimes(1)

    act(() => { mocks.inspectorProps.current?.onHeaderActions?.({ onSave, saving: true, canSave: true, onRevert: null, canRevert: false, saveAs: null, onDelete: null, deleting: false }) })
    expect(buttons()[0]!.title).toBe('Saving…')
    expect(buttons().every(button => button.disabled)).toBe(true)
  })

  describe('Save, Save As and Revert', () => {
    const open = () => {
      container = document.createElement('div')
      document.body.appendChild(container)
      root = createRoot(container)
      act(() => { root?.render(<MediaManagerView onOpenLyricManager={vi.fn()} />) })
    }
    const key = (label: string) => container!.querySelector<HTMLButtonElement>(`.mmv-header button[aria-label="${label}"]`)
    const publish = (overrides: Record<string, unknown> = {}) => {
      const actions = {
        onSave: vi.fn(), saving: false, canSave: true, onRevert: vi.fn(), canRevert: true, onDelete: vi.fn(), deleting: false,
        saveAs: {
          unavailable: null as string | null, initial: { name: 'Sunset (edited)', tags: ['warm'], collectionIds: ['collection-1'] }, busy: false, error: null as string | null,
          validateName: vi.fn((name: string) => name.trim() ? null : 'Enter a name.'), clearError: vi.fn(), submit: vi.fn(async () => true),
        },
        ...overrides,
      }
      act(() => { mocks.inspectorProps.current?.onHeaderActions?.(actions) })
      return actions
    }
    const popover = () => document.querySelector<HTMLElement>('.dv-confirm-dialog')

    it('puts all three as icon-only keys in the toolbar, in the order Save, Save As, Revert, and none of them in the inspector', () => {
      open()
      publish()
      const labels = [...container!.querySelectorAll('.mmv-header .vz-header-group button')].map(button => button.getAttribute('aria-label'))
      expect(labels).toEqual(['New Collection', 'New Media', 'Save Changes', 'Save As', 'Revert', 'Delete Media'])
      for (const label of ['Save Changes', 'Save As', 'Revert']) {
        expect(key(label)!.textContent?.trim(), label).toBe('')
        expect(key(label)!.querySelector('svg'), label).not.toBeNull()
      }
      expect(container!.querySelector('[data-testid="inspector"]')!.textContent).toBe('')
    })

    it('Save As is not offered for an item that cannot be copied (an audio track or a font), and neither is Revert', () => {
      open()
      publish({ saveAs: null, onRevert: null, canRevert: false })
      expect(key('Save As')).toBeNull()
      expect(key('Revert')).toBeNull()
      expect(key('Save Changes')).not.toBeNull()
    })

    it('Revert calls the item\'s revert and is disabled when there is nothing to revert', () => {
      open()
      const actions = publish()
      act(() => { key('Revert')!.click() })
      expect(actions.onRevert).toHaveBeenCalledTimes(1)
      publish({ canRevert: false })
      expect(key('Revert')!.disabled).toBe(true)
    })

    it('Save is disabled when there is nothing to save, and a copy needs an edit first', () => {
      open()
      publish({ canSave: false })
      expect(key('Save Changes')!.disabled).toBe(true)
      const actions = publish()
      actions.saveAs.unavailable = 'Make an edit in the Edit tab first.'
      publish({ saveAs: { ...actions.saveAs, unavailable: 'Make an edit in the Edit tab first.' } })
      expect(key('Save As')!.disabled).toBe(true)
      expect(key('Save As')!.title).toBe('Make an edit in the Edit tab first.')
    })

    it('Save As opens the standard centered popover with Title, Tags and Collections, starting from the current item', () => {
      open()
      publish()
      expect(popover()).toBeNull()
      act(() => { key('Save As')!.click() })
      expect(popover()!.querySelector('h2')!.textContent).toBe('Save As')
      expect(popover()!.querySelector<HTMLInputElement>('input')!.value).toBe('Sunset (edited)')
      expect(popover()!.querySelector('[data-testid="tags-collections"]')).not.toBeNull()
      expect([...popover()!.querySelectorAll('button')].map(button => button.textContent?.trim()).filter(Boolean)).toEqual(expect.arrayContaining(['Cancel', 'Save As']))
      act(() => { [...popover()!.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent?.trim() === 'Cancel')!.click() })
      expect(popover()).toBeNull()
    })

    it('submits the new title with its tags and collections, then closes; a blank title is refused', async () => {
      open()
      const actions = publish()
      act(() => { key('Save As')!.click() })
      const input = popover()!.querySelector<HTMLInputElement>('input')!
      await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '   ')
        input.dispatchEvent(new Event('input', { bubbles: true }))
      })
      const submit = () => [...popover()!.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent?.trim() === 'Save As')!
      await act(async () => { submit().click() })
      expect(actions.saveAs.submit).not.toHaveBeenCalled()
      expect(popover()!.querySelector('[role="alert"]')!.textContent).toBe('Enter a name.')
      await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'Sunset warm')
        input.dispatchEvent(new Event('input', { bubbles: true }))
      })
      await act(async () => { submit().click(); await Promise.resolve() })
      expect(actions.saveAs.submit).toHaveBeenCalledWith({ name: 'Sunset warm', tags: ['warm'], collectionIds: ['collection-1'] })
      expect(popover()).toBeNull()
    })

    it('stays open with the error when the copy fails, and Cancel closes it without saving', async () => {
      open()
      const actions = publish()
      actions.saveAs.submit.mockResolvedValueOnce(false)
      publish({ saveAs: { ...actions.saveAs, error: 'Storage permission denied' } })
      act(() => { key('Save As')!.click() })
      await act(async () => { [...popover()!.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent?.trim() === 'Save As')!.click(); await Promise.resolve() })
      expect(popover()).not.toBeNull()
      expect(popover()!.textContent).toContain('Storage permission denied')
      act(() => { [...popover()!.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent?.trim() === 'Cancel')!.click() })
      expect(popover()).toBeNull()
    })
  })
})
