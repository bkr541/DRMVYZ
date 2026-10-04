// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LyricManagerTrack } from '../lyricManagerTypes'
import { filterLyricManagerTracks, LyricTrackBrowser } from './LyricTrackBrowser'

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
    transcriptionAssets: overrides.transcriptionAssets ?? null,
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
  onLoadTrack: vi.fn(),
  onOpenActiveLyrics: vi.fn(),
  onOpenAiExtract: vi.fn(),
  onMakeOpenVersionActive: vi.fn(),
  canMakeOpenVersionActive: vi.fn(() => false),
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
  it('renders practical track metadata via the shared AudioTrackCard and selects a track without starting playback', async () => {
    const onSelectTrack = vi.fn()
    await render({ onSelectTrack, loadedAudioTrackId: 'track-a' })

    expect(container.textContent).toContain('Reverie')
    expect(container.textContent).toContain('DVYDRM')
    expect(container.textContent).toContain('3:13')
    expect(container.textContent).toContain('150 BPM')
    expect(container.textContent).toContain('Bb Major')
    expect(container.textContent).toContain('Loaded')

    const card = container.querySelector('.vz-track-row') as HTMLElement
    await act(async () => card.click())
    expect(onSelectTrack).toHaveBeenCalledWith(expect.objectContaining({ dbId: 'track-a' }))
    expect(baseProps.onLoadTrack).not.toHaveBeenCalled()
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

  const rowActionLabels = () => [...container.querySelectorAll<HTMLButtonElement>('.vz-track-action-btn')]
    .map(button => button.getAttribute('aria-label'))
  const openOverflowMenu = async () => {
    const more = container.querySelector<HTMLButtonElement>('button[aria-label="More actions for Reverie"]')!
    await act(async () => more.click())
    return [...document.querySelectorAll<HTMLElement>('[role="menu"] [role="menuitem"]')]
  }
  const menuItem = (items: HTMLElement[], label: string) => items.find(item => item.textContent?.trim() === label)

  it('keeps Load and AI Extract on the row and moves the other actions into a more menu — no inline delete', async () => {
    await render()

    expect(rowActionLabels()).toEqual(['Load Reverie', 'AI extract lyrics for Reverie', 'More actions for Reverie'])
    expect(container.querySelector('.vz-track-remove-btn')).toBeNull()
    expect(document.querySelector('[role="menu"]')).toBeNull()
  })

  it('offers Open Active Lyrics only for tracks with an active lyric version, and opens that track', async () => {
    const onOpenActiveLyrics = vi.fn()
    const onSelectTrack = vi.fn()
    await render({ onOpenActiveLyrics, onSelectTrack })

    const items = await openOverflowMenu()
    expect(items.map(item => item.textContent?.trim())).toEqual(['Open Active Lyrics', 'Delete Track'])
    await act(async () => menuItem(items, 'Open Active Lyrics')!.click())

    expect(onOpenActiveLyrics).toHaveBeenCalledWith(expect.objectContaining({ dbId: 'track-a' }))
    // The parent handler selects the track itself; the card must not also fire a plain selection.
    expect(onSelectTrack).not.toHaveBeenCalled()

    await render({ tracks: [track({ activeLyricDocumentId: null, activeLyricDocumentName: null })] })
    const withoutActive = await openOverflowMenu()
    expect(withoutActive.map(item => item.textContent?.trim())).toEqual(['Delete Track'])
  })

  it('offers Make Open Version Active only when the parent allows it, and delegates to the parent handler', async () => {
    const onMakeOpenVersionActive = vi.fn()
    const canMakeOpenVersionActive = vi.fn((candidate: LyricManagerTrack) => candidate.dbId === 'track-a')
    await render({ onMakeOpenVersionActive, canMakeOpenVersionActive })

    const items = await openOverflowMenu()
    expect(items.map(item => item.textContent?.trim())).toEqual(['Open Active Lyrics', 'Make Open Version Active', 'Delete Track'])
    await act(async () => menuItem(items, 'Make Open Version Active')!.click())
    expect(onMakeOpenVersionActive).toHaveBeenCalledWith(expect.objectContaining({ dbId: 'track-a' }))

    await render({ canMakeOpenVersionActive: () => false })
    const hidden = await openOverflowMenu()
    expect(menuItem(hidden, 'Make Open Version Active')).toBeUndefined()
  })

  it('routes Delete Track to the parent confirmation flow without deleting on the click itself', async () => {
    const onDeleteTrack = vi.fn()
    await render({ onDeleteTrack })

    const items = await openOverflowMenu()
    await act(async () => menuItem(items, 'Delete Track')!.click())

    expect(onDeleteTrack).toHaveBeenCalledOnce()
    expect(onDeleteTrack).toHaveBeenCalledWith(expect.objectContaining({ dbId: 'track-a' }))
    // No second, card-owned confirmation: the Lyric Manager's ConfirmTrackDeleteDialog is the single gate.
    expect(document.querySelector('[role="alertdialog"], [role="dialog"]')).toBeNull()
  })

  it('shows empty-search, loading, and recoverable error states', async () => {
    await render({ tracks: [], search: 'missing' })
    expect(container.textContent).toContain('No stored tracks match the current search and filter.')

    await render({ tracks: [], search: '', loading: true })
    expect(container.textContent).toContain('Loading tracks…')

    const onRetry = vi.fn()
    await render({ tracks: [], loading: false, error: 'Network unavailable', onRetry })
    expect(container.textContent).toContain('Network unavailable')
    await act(async () => ([...container.querySelectorAll('button')].find(button => button.textContent === 'Retry') as HTMLButtonElement).click())
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('loads the saved track without automatically playing from the card action button', async () => {
    const onLoadTrack = vi.fn()
    const onSelectTrack = vi.fn()
    await render({ onLoadTrack, onSelectTrack })

    const loadBtn = [...container.querySelectorAll<HTMLButtonElement>('.vz-track-action-btn')]
      .find(button => button.getAttribute('aria-label') === 'Load Reverie')!
    await act(async () => loadBtn.click())

    expect(onLoadTrack).toHaveBeenCalledWith(expect.objectContaining({ dbId: 'track-a' }), false)
    expect(onSelectTrack).not.toHaveBeenCalled()
  })

  it('runs AI extract directly from the card action button', async () => {
    const onOpenAiExtract = vi.fn()
    const onSelectTrack = vi.fn()
    await render({ onOpenAiExtract, onSelectTrack })

    const aiBtn = [...container.querySelectorAll<HTMLButtonElement>('.vz-track-action-btn')]
      .find(button => button.getAttribute('aria-label') === 'AI extract lyrics for Reverie')!
    await act(async () => aiBtn.click())

    expect(onOpenAiExtract).toHaveBeenCalledWith(expect.objectContaining({ dbId: 'track-a' }))
    expect(onSelectTrack).not.toHaveBeenCalled()
    expect(document.querySelector('[role="menu"]')).toBeNull()
  })

  it('combines repository-native filters with search and loaded-track identity', () => {
    const tracks = [
      track({ dbId: 'active', title: 'Active Song', activeLyricDocumentId: 'doc-1', lyricVersionCount: 2 }),
      track({ dbId: 'review', title: 'Review Song', activeLyricDocumentId: null, activeLyricDocumentName: null, lyricVersionCount: 1, needsReview: true }),
      track({ dbId: 'empty', title: 'Empty Song', activeLyricDocumentId: null, activeLyricDocumentName: null, lyricVersionCount: 0 }),
    ]
    expect(filterLyricManagerTracks(tracks, 'has-active', null).map(item => item.dbId)).toEqual(['active'])
    expect(filterLyricManagerTracks(tracks, 'needs-review', null).map(item => item.dbId)).toEqual(['review'])
    expect(filterLyricManagerTracks(tracks, 'loaded', 'empty').map(item => item.dbId)).toEqual(['empty'])
    expect(filterLyricManagerTracks(tracks, 'no-active', null, 'review').map(item => item.dbId)).toEqual(['review'])
  })

  it('renders selected, loaded, and playing as independent simultaneous states', async () => {
    await render({
      selectedTrackId: 'track-a',
      loadedAudioTrackId: 'track-a',
      playingAudioTrackId: 'track-a',
    })

    const badges = [...container.querySelectorAll('.vz-track-row-state-badges .dv-badge')].map(node => node.textContent)
    expect(badges).toEqual(['Selected', 'Loaded', 'Playing'])
  })

})
