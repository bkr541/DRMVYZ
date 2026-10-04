// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LyricCue, LyricDocument } from '../../types/lyrics'

const engineMocks = vi.hoisted(() => ({
  setActiveLyrics: vi.fn(),
  resolveLyricsAt: vi.fn(),
}))

vi.mock('../../lib/supabase', () => ({ supabaseConfigured: false }))
vi.mock('../../lib/lyricsDb', () => ({}))
vi.mock('../musicIntelligence/MusicIntelligenceEngine', () => ({ musicIntelligenceEngine: engineMocks }))
vi.mock('../../context/AudioEngineContext', () => ({
  useSharedAudio: () => ({ currentAudioTrackId: 'track-1', getCurrentTime: () => 0 }),
}))

import { ActiveTrackLyricsBridge } from './ActiveTrackLyricsBridge'
import { useLyricsStore } from '../../stores/lyricsStore'

function doc(id: string, isActive: boolean): LyricDocument {
  return {
    id,
    userId: 'user-1',
    audioTrackId: 'track-1',
    visualSessionId: null,
    title: id,
    artist: '',
    sourceType: 'manual',
    sourceFormat: 'json',
    rawSourceText: null,
    defaultStyle: {},
    defaultAnimation: {},
    defaultEffects: {},
    globalOffsetMs: 0,
    isActive,
    metadata: {},
    revision: 1,
    createdAt: '2026-06-29T00:00:00.000Z',
    updatedAt: '2026-06-29T00:00:00.000Z',
  }
}

const cue = (id: string): LyricCue => ({ id, startMs: 0, endMs: 1_000, text: id, source: 'manual' })

describe('ActiveTrackLyricsBridge preview override', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>

  beforeEach(() => {
    vi.clearAllMocks()
    useLyricsStore.getState().clearLyrics()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  it('feeds the engine the preview version, then the persisted active version once the preview ends', async () => {
    const docA = doc('doc-a', true)
    const docB = doc('doc-b', false)
    const cuesA = [cue('a')]
    const cuesB = [cue('b')]
    // Version A is the persisted ACTIVE runtime version; Version B is open in the editor.
    useLyricsStore.setState({
      runtimeAudioTrackId: 'track-1',
      runtimeActiveDocumentId: docA.id,
      runtimeActiveDocument: docA,
      runtimeCues: cuesA,
      runtimeLyricsStatus: 'active-version',
    })
    useLyricsStore.getState().setEditorDocument(docB, cuesB)

    await act(async () => { root.render(<ActiveTrackLyricsBridge />) })
    expect(engineMocks.setActiveLyrics).toHaveBeenLastCalledWith(expect.objectContaining({ documentId: docA.id, cues: cuesA }))

    await act(async () => { useLyricsStore.getState().beginRuntimeLyricPreview('track-1') })
    expect(engineMocks.setActiveLyrics).toHaveBeenLastCalledWith(
      expect.objectContaining({ documentId: docB.id, cues: cuesB, sourceIdentity: 'track-1:doc-b:preview' }),
    )
    expect(useLyricsStore.getState().runtimeActiveDocumentId).toBe(docA.id)

    await act(async () => { useLyricsStore.getState().endRuntimeLyricPreview() })
    expect(engineMocks.setActiveLyrics).toHaveBeenLastCalledWith(
      expect.objectContaining({ documentId: docA.id, cues: cuesA, sourceIdentity: 'track-1:doc-a' }),
    )
  })
})
