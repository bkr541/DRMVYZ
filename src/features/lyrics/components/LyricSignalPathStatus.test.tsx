// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import { LyricSignalPathStatus } from './LyricSignalPathStatus'
import type { LyricDocumentVersion, LyricManagerTrack } from '../lyricManagerTypes'

;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

const track: LyricManagerTrack = {
  id: 'audio-track-1',
  dbId: 'track-1',
  title: 'Reverie',
  fileName: 'reverie.wav',
  storagePath: 'user/reverie.wav',
  durationSec: 180,
  sampleRate: 48_000,
  channels: 2,
  fileSizeByte: 1_000,
  mimeType: 'audio/wav',
  transcriptionAssets: null,
  artist: 'DVYDRM',
  genre: null,
  bpm: 150,
  musicalKey: 'Bb Major',
  createdAt: '2026-07-14T00:00:00.000Z',
  lyricVersionCount: 1,
  activeLyricDocumentId: 'doc-1',
  activeLyricDocumentName: 'Approved',
}

const activeVersion: LyricDocumentVersion = {
  id: 'doc-1',
  userId: 'user-1',
  audioTrackId: 'track-1',
  visualSessionId: null,
  title: 'Approved',
  artist: 'DVYDRM',
  sourceType: 'manual',
  sourceFormat: 'json',
  rawSourceText: null,
  defaultStyle: {},
  defaultAnimation: {},
  defaultEffects: {},
  globalOffsetMs: 0,
  isActive: true,
  metadata: {},
  revision: 1,
  createdAt: '2026-07-14T00:00:00.000Z',
  updatedAt: '2026-07-14T00:00:00.000Z',
  cueCount: 12,
  language: 'en',
  documentReviewStatus: 'approved',
}

let container: HTMLDivElement | null = null
let root: ReturnType<typeof createRoot> | null = null

afterEach(async () => {
  if (root) await act(async () => root?.unmount())
  container?.remove()
  root = null
  container = null
})

async function renderStatus(overrides: Partial<React.ComponentProps<typeof LyricSignalPathStatus>> = {}) {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => root?.render(<LyricSignalPathStatus
    selectedTrack={track}
    deckTrackPresent
    deckTrackLoaded
    deckHasPersistedIdentity
    activeVersion={activeVersion}
    lyricsDisplayEnabled
    runtimeStatus="active-version"
    runtimeAudioTrackId="track-1"
    {...overrides}
  />))
  return container
}

describe('LyricSignalPathStatus', () => {
  it('reports a fully matched saved track and actual active cue count', async () => {
    const view = await renderStatus()
    expect(view.textContent).toContain('Saved track and active lyric version matched')
    expect(view.textContent).toContain('Approved')
    expect(view.textContent).toContain('12')
    expect(view.textContent).toContain('On')
  })

  it('explains a saved track with no active lyric version', async () => {
    const view = await renderStatus({ activeVersion: null, runtimeStatus: 'no-active-version' })
    expect(view.textContent).toContain('no active lyric version exists')
    expect(view.textContent).toContain('None')
    expect(view.textContent).toContain('0')
  })

  it('distinguishes local files, paused editor synchronization, and lookup failures', async () => {
    let view = await renderStatus({
      deckTrackLoaded: false,
      deckHasPersistedIdentity: false,
      runtimeAudioTrackId: null,
    })
    expect(view.textContent).toContain('Local file is not linked to User Media')

    await act(async () => root?.unmount())
    root = null
    view.remove()
    container = null
    view = await renderStatus({ runtimeAudioTrackId: 'other-track' })
    expect(view.textContent).toContain('Runtime lyric sync is paused while the editor is open')

    await act(async () => root?.unmount())
    root = null
    view.remove()
    container = null
    view = await renderStatus({ activeVersion: null, runtimeStatus: 'error' })
    expect(view.textContent).toContain('lyric resolution failed')
  })
})
