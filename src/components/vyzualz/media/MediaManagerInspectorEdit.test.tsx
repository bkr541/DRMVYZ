// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('./MediaEditPanel', () => ({
  MediaEditPanel: ({ media }: { media: { id: string } }) => <div data-testid="edit-panel" data-media={media.id} />,
}))
vi.mock('../../../stores/mediaStore', () => ({
  useMediaStore: (selector: (state: unknown) => unknown) => selector({
    saveMediaEdits: async () => true, removeItem: async () => true, collections: [], createCollection: async () => null,
  }),
}))
vi.mock('../../../stores/audioStore', () => ({
  useAudioStore: (selector: (state: unknown) => unknown) => selector({ updateSavedTrackMetadata: async () => true }),
}))

import { MediaManagerInspector } from './MediaManagerInspector'
import type { UploadedMedia } from '../../../stores/mediaStore'
import type { SavedAudioTrack } from '../../../stores/audioStore'

const media = {
  id: 'db-1', name: 'a.png', type: 'image', url: 'x', thumbnailUrl: null, meta: '', favorite: false,
  mediaRole: 'other', tags: [], collectionIds: [], metadata: {},
} as UploadedMedia
const track = { id: 't-1', title: 'Song', artist: null, genre: null, bpm: null, musicalKey: null } as unknown as SavedAudioTrack

let container: HTMLDivElement | null = null
let root: ReturnType<typeof createRoot> | null = null

async function renderInspector(props: { media: UploadedMedia | null; track: SavedAudioTrack | null }) {
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
