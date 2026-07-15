// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Track } from '../../../types'
import type { SavedTrackLinkCandidate } from '../services/savedTrackLinking'
import { LinkSavedTrackDialog } from './LinkSavedTrackDialog'

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>

const runtimeTrack = {
  id: 'local-track',
  name: 'reverie.wav',
  displayName: 'Reverie',
  url: 'blob:local',
  duration: 193,
  sourceKind: 'file',
  analysisRuntime: {},
} as Track

const candidate = {
  score: 80,
  signals: ['Same normalized filename', 'Duration within 0.75 seconds'],
  durationMismatch: false,
  track: {
    id: 'audio-track-a',
    dbId: 'track-a',
    title: 'Reverie',
    fileName: 'reverie.wav',
    storagePath: 'user/track-a/reverie.wav',
    durationSec: 193.2,
    sampleRate: 48_000,
    channels: 2,
    fileSizeByte: 100,
    mimeType: 'audio/wav',
    transcriptionAssets: null,
    artist: 'DVYDRM',
    genre: null,
    bpm: 150,
    musicalKey: null,
    createdAt: '2026-07-01T00:00:00.000Z',
    lyricVersionCount: 0,
    activeLyricDocumentId: null,
    activeLyricDocumentName: null,
  },
} satisfies SavedTrackLinkCandidate

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

describe('LinkSavedTrackDialog', () => {
  it('shows possible matches but requires explicit user selection before confirmation', async () => {
    const onSelect = vi.fn()
    const onConfirm = vi.fn()
    await act(async () => root.render(
      <LinkSavedTrackDialog
        runtimeTrack={runtimeTrack}
        candidates={[candidate]}
        selectedTrackId={null}
        loading={false}
        confirming={false}
        error={null}
        onSelect={onSelect}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    ))

    expect(container.textContent).toContain('Suggestions are possible matches only')
    expect(container.textContent).toContain('will not link a filename automatically')
    const confirm = [...container.querySelectorAll<HTMLButtonElement>('button')]
      .find(button => button.textContent?.includes('Confirm and Reload'))!
    expect(confirm.disabled).toBe(true)
    expect(onConfirm).not.toHaveBeenCalled()

    await act(async () => (container.querySelector('input[type="radio"]') as HTMLInputElement).click())
    expect(onSelect).toHaveBeenCalledWith('track-a')
  })

  it('supports cancellation without changing track identity', async () => {
    const onCancel = vi.fn()
    await act(async () => root.render(
      <LinkSavedTrackDialog
        runtimeTrack={runtimeTrack}
        candidates={[candidate]}
        selectedTrackId="track-a"
        loading={false}
        confirming={false}
        error={null}
        onSelect={vi.fn()}
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    ))

    const cancel = [...container.querySelectorAll<HTMLButtonElement>('button')]
      .find(button => button.textContent === 'Cancel')!
    await act(async () => cancel.click())
    expect(onCancel).toHaveBeenCalledOnce()
  })
})
