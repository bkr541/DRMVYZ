// @vitest-environment jsdom
;(globalThis as Record<string, unknown>)['IS_REACT_ACT_ENVIRONMENT'] = true

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import type { LyricDocument, LyricTranscriptionJob } from '../../../types/lyrics'
import type { LyricDocumentVersion, LyricManagerTrack } from '../lyricManagerTypes'
import { LyricWorkflowStatus } from './LyricWorkflowStatus'

let root: ReturnType<typeof createRoot> | null = null
let container: HTMLDivElement | null = null

afterEach(async () => {
  if (root) await act(async () => root?.unmount())
  container?.remove()
  root = null
  container = null
})

const track = {
  id: 'runtime-1', dbId: 'track-1', title: 'Reverie', fileName: 'reverie.wav', storagePath: 'private/reverie.wav',
  durationSec: 180, sampleRate: 48_000, channels: 2, fileSizeByte: 1000, mimeType: 'audio/wav', transcriptionAssets: null,
  artist: 'DVYDRM', genre: null, bpm: 150, musicalKey: 'Bb', createdAt: '2026-07-15T00:00:00Z',
  lyricVersionCount: 1, activeLyricDocumentId: 'doc-1', activeLyricDocumentName: 'Approved',
} satisfies LyricManagerTrack

const lyricDocument = {
  id: 'doc-1', userId: 'user-1', audioTrackId: 'track-1', visualSessionId: null, title: 'Approved', artist: 'DVYDRM',
  sourceType: 'ai_transcription', sourceFormat: 'json', rawSourceText: null, defaultStyle: {}, defaultAnimation: {}, defaultEffects: {},
  globalOffsetMs: 0, isActive: true, metadata: {}, revision: 4, createdAt: '2026-07-15T00:00:00Z', updatedAt: '2026-07-15T00:00:00Z',
} satisfies LyricDocument

const version = { ...lyricDocument, cueCount: 1, language: 'en', documentReviewStatus: 'unreviewed' } satisfies LyricDocumentVersion
const job = {
  id: 'job-1', userId: 'user-1', audioTrackId: 'track-1', analysisSourceId: null, sourceMode: 'vocal_reference', timingOffsetMs: 120,
  lyricDocumentId: 'doc-1', provider: 'groq', status: 'completed', progress: 100, errorCode: null, errorMessage: null,
  providerMetadata: { signedUrl: 'must-not-render' }, requestOptions: { cueStyle: 'hip-hop' }, createdAt: '', updatedAt: '', startedAt: null, completedAt: null,
} satisfies LyricTranscriptionJob

describe('LyricWorkflowStatus', () => {
  it('shows bounded workflow state and keeps sensitive payload details hidden', async () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => root?.render(
      <LyricWorkflowStatus
        selectedTrack={track}
        loadedTrackMatches
        activeVersion={version}
        editorDocument={lyricDocument}
        cues={[{ id: 'cue-1', startMs: 0, endMs: 1_000, text: 'Line' }]}
        trackMapAvailable
        trackMapRevision="analysis-v5"
        saveStatus="saved"
        saveRevision={7}
        runtimeAudioTrackId="track-1"
        runtimeActiveDocumentId="doc-1"
        lyricsDisplayEnabled
        latestJob={job}
      />,
    ))

    expect(container.textContent).toContain('Workflow Status')
    expect(container.textContent).toContain('Vocal Reference')
    expect(container.textContent).toContain('Hip Hop')
    expect(container.textContent).not.toContain('must-not-render')
    expect(container.textContent).not.toContain('private/reverie.wav')
  })
})
