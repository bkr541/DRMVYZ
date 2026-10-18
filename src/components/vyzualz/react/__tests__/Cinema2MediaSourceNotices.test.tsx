// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ replace: vi.fn() }))
const snapshot = {
  slotCount: 1, readyResourceCount: 0, loadingCount: 0, errorCount: 0, missingRequiredCount: 0,
  slots: [{
    id: 'hero', label: 'Hero image', accepts: ['image'], required: false, status: 'empty', source: null,
    presentation: {}, error: null, readyWidth: null, readyHeight: null, playback: null,
  }],
}
const mediaRuntime = { subscribe: () => () => undefined, getSnapshot: () => snapshot, replace: mocks.replace }

vi.mock('../../media/MediaLibraryBrowser', () => ({
  MediaLibraryBrowser: ({ onSelect }: { onSelect: (id: string) => void }) => <button data-testid="pick" onClick={() => onSelect('media-1')}>pick</button>,
}))
vi.mock('../../../../stores/mediaStore', () => ({
  useMediaStore: Object.assign(() => undefined, {
    getState: () => ({ items: [{ id: 'media-1', name: 'poster.png', type: 'image', url: 'https://example.test/poster.png', metadata: {}, mimeType: 'image/png' }] }),
  }),
}))

import { Cinema2MediaSourcePanel } from '../Cinema2MediaSourcePanel'
import { useNotificationStore } from '../../../../stores/notificationStore'

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>
const cards = () => useNotificationStore.getState().events['react']

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  mocks.replace.mockReset()
  useNotificationStore.setState({ events: { ...useNotificationStore.getState().events, react: [] } })
})
afterEach(() => { act(() => root.unmount()); container.remove() })

async function pick() {
  const runtime = { getMediaSlotRuntime: () => mediaRuntime } as never
  await act(async () => { root.render(<Cinema2MediaSourcePanel runtime={runtime} />) })
  await act(async () => { container.querySelector<HTMLButtonElement>('[data-testid="pick"]')!.click(); await Promise.resolve(); await Promise.resolve() })
}

describe('Cinema 2.0 media slot load failures', () => {
  it('tells the user when the chosen media could not be loaded', async () => {
    mocks.replace.mockResolvedValue({ label: 'Hero image', error: 'Image failed to decode' })
    await pick()
    expect(cards()).toHaveLength(1)
    expect(cards()[0]).toMatchObject({ tone: 'error', title: 'Media could not be loaded', message: 'Hero image: Image failed to decode' })
  })

  it('reports a slot that rejects the media outright', async () => {
    mocks.replace.mockRejectedValue(new Error('Slot does not accept video media.'))
    await pick()
    expect(cards()[0]).toMatchObject({ tone: 'error', title: 'Media could not be loaded' })
    expect(cards()[0]!.message).toContain('does not accept video')
  })

  it('stays quiet when the media loads', async () => {
    mocks.replace.mockResolvedValue({ label: 'Hero image', error: null })
    await pick()
    expect(mocks.replace).toHaveBeenCalledWith('hero', expect.objectContaining({ id: 'media-1', kind: 'image' }))
    expect(cards()).toHaveLength(0)
  })
})
