// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LyricManagerTrack } from '../lyricManagerTypes'
import { LyricTrackBrowser } from './LyricTrackBrowser'

let container: HTMLElement
let root: ReturnType<typeof createRoot>

function track(overrides: Partial<LyricManagerTrack> = {}): LyricManagerTrack {
  return {
    id: 'audio-track-a',
    dbId: 'track-a',
    title: 'Reverie',
    fileName: 'reverie.mp3',
    storagePath: 'user/reverie.mp3',
    durationSec: 193,
    sampleRate: 48_000,
    channels: 2,
    fileSizeByte: 1000,
    mimeType: 'audio/mpeg',
    artist: 'DVYDRM',
    genre: 'Melodic Bass',
    bpm: 150,
    musicalKey: 'Bb Major',
    createdAt: '2026-06-29T12:00:00.000Z',
    lyricVersionCount: 2,
    activeLyricDocumentId: 'doc-a',
    activeLyricDocumentName: 'Approved Lyrics',
    ...overrides,
  }
}

const baseProps = {
  tracks: [track()],
  selectedTrackId: null,
  loadedAudioTrackId: null,
  playingAudioTrackId: null,
  search: '',
  loading: false,
  error: null,
  hasMore: false,
  onSearchChange: vi.fn(),
  onSelectTrack: vi.fn(),
  onDeleteTrack: vi.fn(),
  onLoadMore: vi.fn(),
  onUpload: vi.fn(),
  onRetry: vi.fn(),
}

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.clearAllMocks()
})

async function render(props: Partial<React.ComponentProps<typeof LyricTrackBrowser>> = {}) {
  await act(async () => root.render(<LyricTrackBrowser {...baseProps} {...props} />))
}

describe('LyricTrackBrowser', () => {
  it('renders practical track and lyric metadata and selects a track without starting playback', async () => {
    const onSelectTrack = vi.fn()
    await render({ onSelectTrack, loadedAudioTrackId: 'track-a' })

    expect(container.textContent).toContain('Reverie')
    expect(container.textContent).toContain('DVYDRM')
    expect(container.textContent).toContain('3:13')
    expect(container.textContent).toContain('150 BPM')
    expect(container.textContent).toContain('Bb Major')
    expect(container.textContent).toContain('2 lyric versions')
    expect(container.textContent).toContain('Active: Approved Lyrics')
    expect(container.textContent).toContain('Loaded')

    const card = container.querySelector('.lmv-track-card') as HTMLButtonElement
    await act(async () => card.click())
    expect(onSelectTrack).toHaveBeenCalledWith(expect.objectContaining({ dbId: 'track-a' }))
  })

  it('forwards title-or-artist search and incremental loading actions', async () => {
    const onSearchChange = vi.fn()
    const onLoadMore = vi.fn()
    await render({ onSearchChange, onLoadMore, hasMore: true })

    const search = container.querySelector('input[type="search"]') as HTMLInputElement
    const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    valueSetter?.call(search, 'grace')
    await act(async () => search.dispatchEvent(new Event('input', { bubbles: true })))
    await act(async () => (container.querySelector('.lmv-load-more') as HTMLButtonElement).click())

    expect(onSearchChange).toHaveBeenCalledWith('grace')
    expect(onLoadMore).toHaveBeenCalledOnce()
  })

  it('calls onDeleteTrack without triggering onSelectTrack when the trash button is clicked', async () => {
    const onSelectTrack = vi.fn()
    const onDeleteTrack = vi.fn()
    await render({ onSelectTrack, onDeleteTrack })

    const deleteBtn = container.querySelector('.lmv-track-delete-btn') as HTMLButtonElement
    expect(deleteBtn).toBeTruthy()
    await act(async () => deleteBtn.click())
    expect(onDeleteTrack).toHaveBeenCalledWith(expect.objectContaining({ dbId: 'track-a' }))
    expect(onSelectTrack).not.toHaveBeenCalled()
  })

  it('shows no-lyrics, empty-search, loading, and recoverable error states', async () => {
    await render({ tracks: [track({ lyricVersionCount: 0, activeLyricDocumentName: null })] })
    expect(container.textContent).toContain('No lyrics')
    expect(container.textContent).toContain('No active version')

    await render({ tracks: [], search: 'missing' })
    expect(container.textContent).toContain('No stored tracks match that title or artist.')

    await render({ tracks: [], search: '', loading: true })
    expect(container.textContent).toContain('Loading tracks…')

    const onRetry = vi.fn()
    await render({ tracks: [], loading: false, error: 'Network unavailable', onRetry })
    expect(container.textContent).toContain('Network unavailable')
    await act(async () => ([...container.querySelectorAll('button')].find(button => button.textContent === 'Retry') as HTMLButtonElement).click())
    expect(onRetry).toHaveBeenCalledOnce()
  })
})
