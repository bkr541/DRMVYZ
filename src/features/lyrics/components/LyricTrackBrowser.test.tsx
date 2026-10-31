// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LyricDocumentVersion, LyricManagerTrack } from '../lyricManagerTypes'
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

function version(overrides: Partial<LyricDocumentVersion> = {}): LyricDocumentVersion {
  return {
    id: 'doc-a',
    audioTrackId: 'track-a',
    title: 'Approved Lyrics',
    artist: 'DVYDRM',
    sourceType: 'manual',
    isActive: true,
    cueCount: 12,
    language: 'en',
    documentReviewStatus: 'approved',
    updatedAt: '2026-06-29T12:00:00.000Z',
    ...overrides,
  } as LyricDocumentVersion
}

const versionHandlers = () => ({
  onSelectDocument: vi.fn(),
  onDuplicateDocument: vi.fn(),
  onRenameDocument: vi.fn(),
  onActivateDocument: vi.fn(),
  onDeleteDocument: vi.fn(),
  onNewDocument: vi.fn(),
  onImportDocument: vi.fn(),
})

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
    // Metadata labels remain accessible; inline metadata shows an icon before each value.
    const stats = [...container.querySelectorAll('.vz-track-row-stat')].map(stat => [stat.querySelector('dt')?.textContent, stat.querySelector('dd')?.textContent])
    expect(stats).toEqual([['Duration', '3:13'], ['BPM', '150'], ['Key', 'Bb Major']])
    const metadata = [...container.querySelectorAll('.vz-track-row-stats--icons .lmv-track-stat-value')]
    expect(metadata.map(node => node.querySelector('svg')?.getAttribute('data-app-icon'))).toEqual(['clock', 'rhythm', 'music'])
    expect(metadata.map(node => node.firstElementChild?.tagName)).toEqual(['svg', 'svg', 'svg'])
    expect(container.querySelectorAll('.vz-track-row-stats dt.sr-only')).toHaveLength(3)
    expect(container.querySelector('[role="img"][aria-label="Loaded"]')?.getAttribute('title')).toBe('Loaded')

    const card = container.querySelector('.vz-track-row') as HTMLElement
    await act(async () => card.click())
    expect(onSelectTrack).toHaveBeenCalledWith(expect.objectContaining({ dbId: 'track-a' }))
    expect(baseProps.onLoadTrack).not.toHaveBeenCalled()
  })

  it('renders each track as a list row with no artwork tile and the artist above the title', async () => {
    await render({
      tracks: [track({ title: 'MPH - Raw (UrBoiN8 Remix)', artist: 'UrBoiN8' }), track({ dbId: 'track-b', id: 'audio-track-b', title: 'POP', artist: 'DVYDMR' })],
    })
    const rows = [...container.querySelectorAll<HTMLElement>('.vz-track-row--list')]
    expect(rows).toHaveLength(2)
    expect(container.querySelector('.vz-track-row-art')).toBeNull()
    const lines = [...rows[0]!.querySelector('.vz-track-row-info')!.children].map(line => line.className)
    expect(lines).toEqual(['vz-track-row-artist-line', 'vz-track-row-title-line', 'vz-track-row-stats vz-track-row-stats--icons'])
    expect(rows[0]!.querySelector('.vz-track-row-artist')?.textContent).toBe('UrBoiN8')
    expect(rows[0]!.querySelector('.vz-track-row-title')?.textContent).toBe('MPH - Raw (UrBoiN8 Remix)')
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
  const lyricsIcon = () => container.querySelector<HTMLButtonElement>('button[aria-label="Open active lyrics for Reverie"]')
  const menuItem = (items: HTMLElement[], label: string) => items.find(item => item.textContent?.trim() === label)

  it('puts the state badges on the artist line, right-aligned, and keeps them off the title line', async () => {
    await render({ selectedTrackId: 'track-b', loadedAudioTrackId: 'track-a', playingAudioTrackId: 'track-a' })
    const row = container.querySelector<HTMLElement>('.vz-track-row--list')!
    const artistLine = row.querySelector('.vz-track-row-artist-line')!
    expect(artistLine.querySelector('.vz-track-row-artist')?.textContent).toBe('DVYDRM')
    expect(artistLine.querySelector('.vz-track-row-loaded-dot')?.getAttribute('aria-label')).toBe('Loaded')
    expect(artistLine.querySelector('.vz-track-row-state-badges')?.textContent).toContain('Playing')
    expect(row.querySelector('.vz-track-row-title-line .vz-track-row-state-badges')).toBeNull()
  })

  it('keeps the lyrics icon and the more button on the row, with the other actions as text items in the menu — no inline delete', async () => {
    await render()

    expect(rowActionLabels()).toEqual(['Open active lyrics for Reverie', 'More actions for Reverie'])
    expect(container.querySelector('.vz-track-remove-btn')).toBeNull()
    expect(document.querySelector('[role="menu"]')).toBeNull()
  })

  it('offers the lyrics icon only for tracks with lyric versions, and opens that track\'s active lyrics and versions', async () => {
    const onOpenActiveLyrics = vi.fn()
    const onSelectTrack = vi.fn()
    await render({ onOpenActiveLyrics, onSelectTrack })

    const items = await openOverflowMenu()
    expect(items.map(item => item.textContent?.trim())).toEqual(['Load Track', 'AI Extract Lyrics', 'Delete Track'])
    await act(async () => document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))

    await act(async () => lyricsIcon()!.click())
    expect(onOpenActiveLyrics).toHaveBeenCalledWith(expect.objectContaining({ dbId: 'track-a' }))
    // The parent handler selects the track itself; the card must not also fire a plain selection.
    expect(onSelectTrack).not.toHaveBeenCalled()

    await render({ tracks: [track({ lyricVersionCount: 0, activeLyricDocumentId: null, activeLyricDocumentName: null })] })
    expect(lyricsIcon()).toBeNull()
    // A track with versions but none active still offers it, so its versions stay reachable.
    await render({ tracks: [track({ activeLyricDocumentId: null, activeLyricDocumentName: null })] })
    expect(lyricsIcon()).not.toBeNull()
  })

  it('offers Make Open Version Active only when the parent allows it, and delegates to the parent handler', async () => {
    const onMakeOpenVersionActive = vi.fn()
    const canMakeOpenVersionActive = vi.fn((candidate: LyricManagerTrack) => candidate.dbId === 'track-a')
    await render({ onMakeOpenVersionActive, canMakeOpenVersionActive })

    const items = await openOverflowMenu()
    expect(items.map(item => item.textContent?.trim())).toEqual(['Load Track', 'AI Extract Lyrics', 'Make Open Version Active', 'Delete Track'])
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

  it('loads the saved track without automatically playing from the Load Track menu item', async () => {
    const onLoadTrack = vi.fn()
    const onSelectTrack = vi.fn()
    await render({ onLoadTrack, onSelectTrack })

    const items = await openOverflowMenu()
    await act(async () => menuItem(items, 'Load Track')!.click())

    expect(onLoadTrack).toHaveBeenCalledWith(expect.objectContaining({ dbId: 'track-a' }), false)
    expect(onSelectTrack).not.toHaveBeenCalled()
  })

  it('runs AI extract from the AI Extract Lyrics menu item', async () => {
    const onOpenAiExtract = vi.fn()
    const onSelectTrack = vi.fn()
    await render({ onOpenAiExtract, onSelectTrack })

    const items = await openOverflowMenu()
    await act(async () => menuItem(items, 'AI Extract Lyrics')!.click())

    expect(onOpenAiExtract).toHaveBeenCalledWith(expect.objectContaining({ dbId: 'track-a' }))
    expect(onSelectTrack).not.toHaveBeenCalled()
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
    expect(badges).toEqual(['Selected', 'Playing'])
    const loaded = container.querySelector('.vz-track-row-loaded-dot')
    expect(loaded?.textContent).toBe('')
    expect(loaded?.children).toHaveLength(0)
    expect(loaded?.getAttribute('aria-label')).toBe('Loaded')

    // Selected is dot-only: its label is visually hidden but kept for assistive tech and the tooltip.
    const selected = container.querySelector<HTMLElement>('.vz-track-row-selected-dot')
    expect(selected?.title).toBe('Selected')
    expect(selected?.querySelector('.sr-only')?.textContent).toBe('Selected')
  })

  const openVersions = async () => {
    await act(async () => lyricsIcon()!.click())
  }

  it('selects a track without opening its versions; the lyrics icon then replaces the list with them, under a back row naming the track and artist', async () => {
    const handlers = versionHandlers()
    const onSelectTrack = vi.fn()
    const onOpenActiveLyrics = vi.fn()
    await render({
      tracks: [track(), track({ dbId: 'track-b', id: 'audio-track-b', title: 'POP' })],
      selectedTrackId: 'track-a',
      onSelectTrack,
      onOpenActiveLyrics,
      versions: {
        documents: [version(), version({ id: 'doc-b', title: 'Alternate Lyrics', isActive: false, cueCount: 0 })],
        loading: false,
        openDocumentId: 'doc-b',
        ...handlers,
      },
    })

    // Selected only: the list is still showing.
    expect(container.querySelector('.lmv-versions-back')).toBeNull()
    expect(container.querySelectorAll('.lmv-track-group')).toHaveLength(2)
    const searchRow = container.querySelector('.lmv-track-search-row')!
    expect(searchRow.querySelector('input')?.getAttribute('aria-label')).toBe('Search tracks by title or artist')

    await openVersions()
    // The search/filter row stays in place (the same element) and now searches and filters the versions.
    expect(container.querySelector('.lmv-track-search-row')).toBe(searchRow)
    expect(searchRow.querySelector('input')?.getAttribute('aria-label')).toBe('Search lyric versions')
    expect(searchRow.nextElementSibling?.classList.contains('lmv-track-view')).toBe(true)
    expect(onOpenActiveLyrics).toHaveBeenCalledWith(expect.objectContaining({ dbId: 'track-a' }))

    // The track group is gone, including the other tracks and the track search.
    expect(container.querySelector('.lmv-track-group')).toBeNull()
    expect(container.querySelector('.lmv-track-grid')).toBeNull()
    expect(container.querySelector('input[aria-label="Search tracks by title or artist"]')).toBeNull()
    expect(container.textContent).not.toContain('POP')

    const back = container.querySelector<HTMLButtonElement>('.lmv-versions-back')!
    expect(back.querySelector('svg')).not.toBeNull()
    expect(back.querySelector('.lmv-versions-back-title')?.textContent).toBe('Reverie')
    expect(back.querySelector('.lmv-versions-back-artist')?.textContent).toBe('DVYDRM')

    const cards = [...container.querySelectorAll<HTMLElement>('.lmv-doc-card')]
    expect(cards.map(card => card.querySelector('.lmv-doc-card-title')?.textContent)).toEqual(['Approved Lyrics', 'Alternate Lyrics'])
    expect(cards[0]!.classList.contains('lmv-doc-card--active')).toBe(true)
    expect(cards[1]!.classList.contains('lmv-doc-card--open')).toBe(true)

    await act(async () => cards[1]!.querySelector<HTMLButtonElement>('.lmv-doc-card-main')!.click())
    expect(handlers.onSelectDocument).toHaveBeenCalledWith(expect.objectContaining({ id: 'doc-b' }))

    // Card actions act on the version and never on the track or the back row.
    await act(async () => cards[0]!.querySelector<HTMLButtonElement>('button[aria-label="Duplicate"]')!.click())
    expect(handlers.onDuplicateDocument).toHaveBeenCalledWith(expect.objectContaining({ id: 'doc-a' }))

    await act(async () => (container.querySelector('button[aria-label="New lyric version"]') as HTMLButtonElement).click())
    await act(async () => (container.querySelector('button[aria-label="Import lyric version"]') as HTMLButtonElement).click())
    expect(handlers.onNewDocument).toHaveBeenCalledTimes(1)
    expect(handlers.onImportDocument).toHaveBeenCalledTimes(1)

    // Searching narrows the version cards, and clearing it brings them back.
    const versionSearch = container.querySelector('input[aria-label="Search lyric versions"]') as HTMLInputElement
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    setValue?.call(versionSearch, 'alternate')
    await act(async () => versionSearch.dispatchEvent(new Event('input', { bubbles: true })))
    expect([...container.querySelectorAll('.lmv-doc-card-title')].map(node => node.textContent)).toEqual(['Alternate Lyrics'])

    // Back only returns to the list: the track stays selected and nothing is deselected or re-opened.
    await act(async () => back.click())
    expect(onSelectTrack).not.toHaveBeenCalled()
    expect(container.querySelector('.lmv-versions-back')).toBeNull()
    expect(container.querySelectorAll('.lmv-track-group')).toHaveLength(2)
  })

  it('returns to the track list once the track is deselected, and does not reopen versions if it is selected again', async () => {
    const handlers = versionHandlers()
    const versions = { documents: [version()], loading: false, openDocumentId: null, ...handlers }
    await render({ selectedTrackId: 'track-a', versions })
    await openVersions()
    expect(container.querySelector('.lmv-versions-back')).not.toBeNull()

    await render({ selectedTrackId: null, versions })
    expect(container.querySelector('.lmv-versions-back')).toBeNull()
    expect(container.querySelectorAll('.lmv-track-group')).toHaveLength(1)

    await render({ selectedTrackId: 'track-a', versions })
    expect(container.querySelector('.lmv-versions-back')).toBeNull()
  })

  it('renames a version inline without selecting it', async () => {
    const handlers = versionHandlers()
    await render({
      selectedTrackId: 'track-a',
      versions: { documents: [version()], loading: false, openDocumentId: null, ...handlers },
    })
    await openVersions()
    await act(async () => (container.querySelector('button[aria-label="Rename"]') as HTMLButtonElement).click())
    const input = container.querySelector('input[aria-label="Lyric document name"]') as HTMLInputElement
    expect(input).not.toBeNull()
    await act(async () => (container.querySelector('button[aria-label="Cancel lyric document rename"]') as HTMLButtonElement).click())
    expect(container.querySelector('input[aria-label="Lyric document name"]')).toBeNull()
    expect(handlers.onRenameDocument).not.toHaveBeenCalled()
    expect(handlers.onSelectDocument).not.toHaveBeenCalled()
  })

  it('shows loading and unattached documents in the versions view, and offers the icon on a track without versions only for those documents', async () => {
    const handlers = versionHandlers()
    const empty = track({ lyricVersionCount: 0, activeLyricDocumentId: null, activeLyricDocumentName: null })
    await render({ tracks: [empty], selectedTrackId: 'track-a', versions: { documents: [], loading: false, openDocumentId: null, ...handlers } })
    expect(lyricsIcon()).toBeNull()
    expect(container.querySelector('.lmv-versions-back')).toBeNull()

    // The track is known to have versions that are still being fetched.
    await render({ selectedTrackId: 'track-a', versions: { documents: [], loading: true, openDocumentId: null, ...handlers } })
    await openVersions()
    expect(container.querySelector('.lmv-versions-back')).not.toBeNull()
    expect(container.textContent).toContain('Loading lyric versions')

    const legacyVersions = {
      documents: [version()],
      legacyDocuments: [version({ id: 'legacy-1', title: 'Old Import', audioTrackId: null, isActive: false })],
      loading: false,
      openDocumentId: null,
      ...handlers,
    }
    await render({ selectedTrackId: 'track-a', versions: legacyVersions })
    expect(container.textContent).toContain('Approved Lyrics')
    expect(container.textContent).toContain('LEGACY UNATTACHED DOCUMENTS')
    expect(container.textContent).toContain('Old Import')
    expect(container.textContent).toContain('Unattached')

    // A selected track with no versions of its own still reaches the unattached documents, without asking to open lyrics.
    const onOpenActiveLyrics = vi.fn()
    await render({ tracks: [empty], selectedTrackId: null, versions: legacyVersions, onOpenActiveLyrics })
    await render({ tracks: [empty], selectedTrackId: 'track-a', versions: legacyVersions, onOpenActiveLyrics })
    await openVersions()
    expect(onOpenActiveLyrics).not.toHaveBeenCalled()
    expect(container.textContent).toContain('Old Import')
  })

})
