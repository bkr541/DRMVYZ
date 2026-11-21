// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useNotificationStore } from '../../../stores/notificationStore'

vi.mock('./MediaEditPanel', () => ({
  MediaEditPanel: ({ media }: { media: { id: string } }) => <div data-testid="edit-panel" data-media={media.id} />,
}))
const mocks = vi.hoisted(() => ({
  saveMediaEdits: vi.fn(async () => true),
  removeItem: vi.fn(async () => true),
  updateSavedTrackMetadata: vi.fn(async () => true),
  renameOscillatorFontAsset: vi.fn(async () => true),
  updateOscillatorFontAssetMetadata: vi.fn(async () => true),
}))
vi.mock('../../../stores/mediaStore', () => ({
  useMediaStore: (selector: (state: unknown) => unknown) => selector({
    saveMediaEdits: mocks.saveMediaEdits, removeItem: mocks.removeItem,
    collections: [{ id: 'collection-1', name: 'Show Fonts' }], createCollection: async () => null,
  }),
}))
vi.mock('../../../stores/audioStore', () => ({
  useAudioStore: (selector: (state: unknown) => unknown) => selector({ updateSavedTrackMetadata: mocks.updateSavedTrackMetadata }),
}))
vi.mock('../../../stores/reactStore', () => ({
  useReactStore: (selector: (state: unknown) => unknown) => selector({
    renameOscillatorFontAsset: mocks.renameOscillatorFontAsset,
    updateOscillatorFontAssetMetadata: mocks.updateOscillatorFontAssetMetadata,
  }),
}))

import { MediaManagerInspector, type MediaHeaderActions } from './MediaManagerInspector'
import type { UploadedMedia } from '../../../stores/mediaStore'
import type { SavedAudioTrack } from '../../../stores/audioStore'
import type { OscillatorFontAsset } from '../react/ReactTypes'

const media = {
  id: 'db-1', name: 'a.png', type: 'image', url: 'x', thumbnailUrl: null, meta: '', favorite: false,
  mediaRole: 'other', tags: [], collectionIds: [], metadata: {},
} as UploadedMedia
const track = { id: 't-1', title: 'Song', artist: null, genre: null, bpm: null, musicalKey: null } as unknown as SavedAudioTrack
const font: OscillatorFontAsset = {
  id: 'font-1',
  name: 'Neon Sans',
  fontFamilyName: 'Neon Sans Display',
  fileName: 'neon-sans.otf',
  storagePath: 'user/font-1/font.otf',
  mimeType: 'font/otf',
  fileSize: 245_760,
  createdAt: '2026-07-01T12:00:00.000Z',
  tags: ['headline'],
  collectionIds: ['collection-1'],
}

let container: HTMLDivElement | null = null
let root: ReturnType<typeof createRoot> | null = null

async function renderInspector(props: { media: UploadedMedia | null; track: SavedAudioTrack | null; font?: OscillatorFontAsset | null; onFontRenamed?: (font: OscillatorFontAsset) => void; onHeaderActions?: (actions: MediaHeaderActions | null) => void }) {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => { root?.render(<MediaManagerInspector {...props} onMediaCreated={vi.fn()} />) })
}
const tab = (label: string) =>
  [...container!.querySelectorAll<HTMLElement>('[role="tab"]')].find(node => node.textContent?.trim() === label)!
const choose = (label: string) => act(async () => { tab(label).click() })

const cards = () => useNotificationStore.getState().events['media-manager']
/** Whether an element is on screen: the details form stays mounted behind the Edit tab, hidden, so the toolbar can always act on it. */
const shown = (node: Element) => !node.closest('[style*="display: none"]')
const visible = (selector: string) => [...container!.querySelectorAll(selector)].filter(shown)
const typeInto = (selector: string, value: string) => act(async () => {
  const input = container!.querySelector<HTMLInputElement>(selector)!
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
})
beforeEach(() => {
  useNotificationStore.setState({ events: { ...useNotificationStore.getState().events, 'media-manager': [] } })
  mocks.saveMediaEdits.mockClear()
  mocks.saveMediaEdits.mockResolvedValue(true)
  mocks.updateSavedTrackMetadata.mockResolvedValue(true)
  mocks.updateOscillatorFontAssetMetadata.mockResolvedValue(true)
})

afterEach(() => {
  if (root) act(() => root?.unmount())
  container?.remove()
  root = null
  container = null
})

describe('Media Manager inspector tabs', () => {
  it('keeps Info, Edit and Output, with Info first and unchanged', async () => {
    await renderInspector({ media, track: null })
    expect([...container!.querySelectorAll('[role="tab"]')].map(node => node.textContent?.trim())).toEqual(['Info', 'Edit', 'Output'])
    expect(container!.textContent).toContain('Details')
    expect(container!.textContent).toContain('Tags')
    expect(container!.querySelector('[data-testid="edit-panel"]')).toBeNull()
  })

  it('shows the editor in Edit for a visual item, and keeps the Info groups out of it', async () => {
    await renderInspector({ media, track: null })
    await choose('Edit')
    expect(container!.querySelector('[data-testid="edit-panel"]')?.getAttribute('data-media')).toBe('db-1')
    expect(visible('.mmi-body')).toHaveLength(0)
    expect(visible('.drc-header').map(node => node.textContent)).not.toContain('Tags & Collections')
  })

  it('Output stays empty', async () => {
    await renderInspector({ media, track: null })
    await choose('Output')
    expect(container!.querySelector('[data-testid="edit-panel"]')).toBeNull()
    expect(visible('.mmi-body')).toHaveLength(0)
  })

  it('an audio track gets no image/video edit controls, and its Info editor still works', async () => {
    await renderInspector({ media: null, track })
    expect(container!.textContent).toContain('Track Details')
    await choose('Edit')
    expect(container!.querySelector('[data-testid="edit-panel"]')).toBeNull()
    expect(container!.textContent).not.toContain('Brightness')
    await choose('Info')
    expect(container!.textContent).toContain('Track Details')
  })

  it('shows the selected font metadata in the Info tab', async () => {
    await renderInspector({ media: null, track: null, font })
    expect(container!.textContent).toContain('Font Details')
    expect(container!.querySelector<HTMLInputElement>('#mmi-font-name')?.value).toBe('Neon Sans')
    expect(container!.querySelector('#mmi-font-family')).toBeNull()
    expect(container!.querySelector<HTMLInputElement>('#mmi-font-file-name')?.value).toBe('neon-sans.otf')
    expect(container!.querySelector<HTMLInputElement>('#mmi-font-format')?.value).toBe('font/otf')
    expect(container!.querySelector<HTMLInputElement>('#mmi-font-file-size')?.value).toBe('240 KB')
    expect(container!.querySelector<HTMLInputElement>('#mmi-font-uploaded')?.value).toBe('Jul 1, 2026')
    expect(container!.querySelector('.mmi-font-meta-row')?.querySelectorAll('.rv-ctrl-row')).toHaveLength(3)
    expect(container!.querySelector<HTMLInputElement>('#mmi-font-name')?.readOnly).toBe(false)
    expect([...container!.querySelectorAll<HTMLInputElement>('[id^="mmi-font-"]:not(#mmi-font-name)')].every(input => input.readOnly)).toBe(true)
    expect(container!.textContent).toContain('Tags & Collections')
    expect(container!.textContent).toContain('headline')
    expect(container!.textContent).toContain('Show Fonts')
    expect(container!.querySelector('#mmi-tags')).not.toBeNull()
    expect(container!.querySelector('[aria-label="Collections"]')).not.toBeNull()

    await choose('Edit')
    expect(container!.textContent).toContain('Fonts are viewed from the Info tab.')
  })

  it('nothing selected shows the empty state in Info and a prompt in Edit', async () => {
    await renderInspector({ media: null, track: null })
    expect(container!.textContent).toContain('Select media from the library')
    await choose('Edit')
    expect(container!.textContent).toContain('Select an image or video to edit it.')
  })
})

describe('Media Manager inspector header actions', () => {
  it('no longer draws Save Changes or Delete Media inside the panel; the header owns them', async () => {
    await renderInspector({ media, track: null })
    expect(container!.querySelector('.mmi-actions')).toBeNull()
    expect(container!.textContent).not.toContain('Save Changes')
    expect(container!.textContent).not.toContain('Delete Media')
  })

  it('publishes Save, Save As, Revert and Delete for a visual item on every tab, and withdraws them on unmount', async () => {
    const published: Array<MediaHeaderActions | null> = []
    await renderInspector({ media, track: null, onHeaderActions: actions => { published.push(actions) } })
    const latest = () => published[published.length - 1]
    expect(latest()).toMatchObject({ saving: false, deleting: false, canSave: false, canRevert: false })
    expect(latest()?.onDelete).toBeTypeOf('function')
    expect(latest()?.onRevert).toBeTypeOf('function')
    // Nothing is edited yet, so there is nothing to copy.
    expect(latest()?.saveAs?.unavailable).toMatch(/Make an edit/)
    expect(latest()?.saveAs?.initial).toEqual({ name: 'a (edited)', tags: [], collectionIds: [] })

    await typeInto('#mmi-title', 'Sunset')
    expect(latest()).toMatchObject({ canSave: true, canRevert: true })
    await act(async () => { latest()?.onSave() })
    expect(mocks.saveMediaEdits).toHaveBeenCalledTimes(1)
    expect(mocks.saveMediaEdits).toHaveBeenCalledWith('db-1', expect.objectContaining({ title: 'Sunset' }))
    expect(cards()).toHaveLength(1)
    expect(cards()[0]).toMatchObject({ tone: 'success', title: 'Media saved', message: 'Changes to "Sunset" were saved.' })

    await act(async () => { latest()?.onDelete?.() })
    expect(document.querySelector('.dv-confirm-dialog')).not.toBeNull()
    document.querySelector('.dv-confirm-backdrop')?.remove()

    // The same actions stay available on the Edit tab: the toolbar acts on the whole item, whichever tab is showing.
    await choose('Edit')
    expect(latest()).not.toBeNull()
    expect(latest()?.onSave).toBeTypeOf('function')
    act(() => root?.unmount()); container?.remove(); root = null
    expect(latest()).toBeNull()
  })

  it('Revert throws away the drafted details', async () => {
    const published: Array<MediaHeaderActions | null> = []
    await renderInspector({ media, track: null, onHeaderActions: actions => { published.push(actions) } })
    const latest = () => published[published.length - 1]
    await typeInto('#mmi-title', 'Draft title')
    expect(container!.querySelector<HTMLInputElement>('#mmi-title')!.value).toBe('Draft title')
    expect(latest()?.canRevert).toBe(true)
    await act(async () => { latest()?.onRevert?.() })
    expect(container!.querySelector<HTMLInputElement>('#mmi-title')!.value).toBe('')
    expect(latest()).toMatchObject({ canRevert: false, canSave: false })
    expect(mocks.saveMediaEdits).not.toHaveBeenCalled()
  })

  it('Save As starts from the drafted title, tags and collections', async () => {
    const published: Array<MediaHeaderActions | null> = []
    await renderInspector({ media: { ...media, title: 'Sunset', tags: ['warm'], collectionIds: ['collection-1'] } as UploadedMedia, track: null, onHeaderActions: actions => { published.push(actions) } })
    expect(published[published.length - 1]?.saveAs?.initial).toEqual({ name: 'Sunset (edited)', tags: ['warm'], collectionIds: ['collection-1'] })
    await typeInto('#mmi-title', 'Golden hour')
    expect(published[published.length - 1]?.saveAs?.initial.name).toBe('Golden hour (edited)')
  })

  it('an audio track publishes Save Changes only, and it saves the track', async () => {
    const published: Array<MediaHeaderActions | null> = []
    await renderInspector({ media: null, track, onHeaderActions: actions => { published.push(actions) } })
    const latest = published[published.length - 1]
    expect(latest?.onDelete).toBeNull()
    // Only images, videos and 3D models can be copied or reverted from the toolbar.
    expect(latest?.saveAs).toBeNull()
    expect(latest?.onRevert).toBeNull()
    await act(async () => { latest?.onSave() })
    expect(mocks.updateSavedTrackMetadata).toHaveBeenCalledWith('t-1', expect.objectContaining({ title: 'Song' }))
    expect(cards()[0]).toMatchObject({ tone: 'success', title: 'Track saved', message: 'Changes to "Song" were saved.' })
  })

  it('publishes font details through Save Changes while keeping Delete disabled', async () => {
    const published: Array<MediaHeaderActions | null> = []
    const onFontRenamed = vi.fn()
    await renderInspector({ media: null, track: null, font, onFontRenamed, onHeaderActions: actions => { published.push(actions) } })
    const nameInput = container!.querySelector<HTMLInputElement>('#mmi-font-name')!
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(nameInput, 'My Headline Font')
      nameInput.dispatchEvent(new Event('input', { bubbles: true }))
    })
    const tagInput = container!.querySelector<HTMLInputElement>('#mmi-tags')!
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(tagInput, 'poster')
      tagInput.dispatchEvent(new Event('input', { bubbles: true }))
      tagInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    })
    const latest = published[published.length - 1]
    expect(latest?.onDelete).toBeNull()
    await act(async () => { latest?.onSave(); await Promise.resolve() })
    expect(mocks.updateOscillatorFontAssetMetadata).toHaveBeenCalledWith('font-1', {
      name: 'My Headline Font',
      tags: ['headline', 'poster'],
      collectionIds: ['collection-1'],
    })
    expect(cards()[0]).toMatchObject({ tone: 'success', title: 'Font saved', message: 'Changes to "My Headline Font" were saved.' })
    expect(onFontRenamed).toHaveBeenCalledWith(expect.objectContaining({
      id: 'font-1', name: 'My Headline Font', tags: ['headline', 'poster'], collectionIds: ['collection-1'],
    }))
  })
})

describe('Media Manager inspector: tags and collections are normalised', () => {
  const typeTag = (input: HTMLInputElement, value: string) => act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
  })
  it('stores a tag as its lowercase hyphenated key, and never adds the same tag twice in another case or spacing', async () => {
    const published: Array<MediaHeaderActions | null> = []
    await renderInspector({ media: null, track: null, font, onHeaderActions: actions => { published.push(actions) } })
    const tagInput = container!.querySelector<HTMLInputElement>('#mmi-tags')!
    typeTag(tagInput, 'Open Decks')
    typeTag(tagInput, 'OPEN-DECKS')
    typeTag(tagInput, 'open   decks!')
    typeTag(tagInput, '!!!')
    await act(async () => { published[published.length - 1]?.onSave(); await Promise.resolve() })
    expect(mocks.updateOscillatorFontAssetMetadata).toHaveBeenCalledWith('font-1', expect.objectContaining({ tags: ['headline', 'open-decks'] }))
  })
  it('shows a space as the hyphen it will be stored as while the tag is typed', async () => {
    await renderInspector({ media: null, track: null, font })
    const tagInput = container!.querySelector<HTMLInputElement>('#mmi-tags')!
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(tagInput, 'open decks')
      tagInput.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(tagInput.value).toBe('open-decks')
  })
})

describe('Media Manager inspector: no success card when a save fails', () => {
  it('keeps the inline error and posts nothing for media, tracks and fonts', async () => {
    mocks.saveMediaEdits.mockResolvedValue(false)
    mocks.updateSavedTrackMetadata.mockResolvedValue(false)
    mocks.updateOscillatorFontAssetMetadata.mockResolvedValue(false)
    for (const props of [{ media, track: null }, { media: null, track }, { media: null, track: null, font }] as const) {
      const published: Array<MediaHeaderActions | null> = []
      await renderInspector({ ...props, onHeaderActions: actions => { published.push(actions) } })
      // A visual item only saves what changed, so give it something to save.
      if (props.media) await typeInto('#mmi-title', 'Changed')
      await act(async () => { published[published.length - 1]?.onSave(); await Promise.resolve() })
      expect(container!.textContent).toMatch(/Could not save/)
      act(() => root?.unmount()); container?.remove(); root = null
    }
    expect(cards()).toHaveLength(0)
  })
})
