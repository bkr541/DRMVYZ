// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('./MediaEditPanel', () => ({
  MediaEditPanel: ({ media }: { media: { id: string } }) => <div data-testid="edit-panel" data-media={media.id} />,
}))
const mocks = vi.hoisted(() => ({
  saveMediaEdits: vi.fn(async () => true),
  removeItem: vi.fn(async () => true),
  updateSavedTrackMetadata: vi.fn(async () => true),
}))
vi.mock('../../../stores/mediaStore', () => ({
  useMediaStore: (selector: (state: unknown) => unknown) => selector({
    saveMediaEdits: mocks.saveMediaEdits, removeItem: mocks.removeItem, collections: [], createCollection: async () => null,
  }),
}))
vi.mock('../../../stores/audioStore', () => ({
  useAudioStore: (selector: (state: unknown) => unknown) => selector({ updateSavedTrackMetadata: mocks.updateSavedTrackMetadata }),
}))

import { MediaManagerInspector, type MediaHeaderActions } from './MediaManagerInspector'
import type { UploadedMedia } from '../../../stores/mediaStore'
import type { SavedAudioTrack } from '../../../stores/audioStore'

const media = {
  id: 'db-1', name: 'a.png', type: 'image', url: 'x', thumbnailUrl: null, meta: '', favorite: false,
  mediaRole: 'other', tags: [], collectionIds: [], metadata: {},
} as UploadedMedia
const track = { id: 't-1', title: 'Song', artist: null, genre: null, bpm: null, musicalKey: null } as unknown as SavedAudioTrack

let container: HTMLDivElement | null = null
let root: ReturnType<typeof createRoot> | null = null

async function renderInspector(props: { media: UploadedMedia | null; track: SavedAudioTrack | null; onHeaderActions?: (actions: MediaHeaderActions | null) => void }) {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => { root?.render(<MediaManagerInspector {...props} onMediaCreated={vi.fn()} />) })
}
const tab = (label: string) =>
  [...container!.querySelectorAll<HTMLElement>('[role="tab"]')].find(node => node.textContent?.trim() === label)!
const choose = (label: string) => act(async () => { tab(label).click() })

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
    expect(container!.textContent).not.toContain('Tags & Collections')
  })

  it('Output stays empty', async () => {
    await renderInspector({ media, track: null })
    await choose('Output')
    expect(container!.querySelector('[data-testid="edit-panel"]')).toBeNull()
    expect(container!.querySelector('.mmi-body')).toBeNull()
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

  it('publishes save and delete for a visual item on Info, and withdraws them on other tabs and unmount', async () => {
    const published: Array<MediaHeaderActions | null> = []
    await renderInspector({ media, track: null, onHeaderActions: actions => { published.push(actions) } })
    const latest = () => published[published.length - 1]
    expect(latest()).toMatchObject({ saving: false, deleting: false })
    expect(latest()?.onDelete).toBeTypeOf('function')

    await act(async () => { latest()?.onSave() })
    expect(mocks.saveMediaEdits).toHaveBeenCalledTimes(1)
    expect(mocks.saveMediaEdits).toHaveBeenCalledWith('db-1', expect.objectContaining({ title: '' }))

    await act(async () => { latest()?.onDelete?.() })
    expect(document.querySelector('.dv-confirm-dialog')).not.toBeNull()

    await choose('Edit')
    expect(latest()).toBeNull()
    await choose('Info')
    expect(latest()).not.toBeNull()
  })

  it('an audio track publishes Save Changes only, and it saves the track', async () => {
    const published: Array<MediaHeaderActions | null> = []
    await renderInspector({ media: null, track, onHeaderActions: actions => { published.push(actions) } })
    const latest = published[published.length - 1]
    expect(latest?.onDelete).toBeNull()
    await act(async () => { latest?.onSave() })
    expect(mocks.updateSavedTrackMetadata).toHaveBeenCalledWith('t-1', expect.objectContaining({ title: 'Song' }))
  })
})
