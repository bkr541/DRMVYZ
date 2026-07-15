import { describe, expect, it } from 'vitest'
import type { Track } from '../../../types'
import type { LyricManagerTrack } from '../lyricManagerTypes'
import { rankSavedTrackLinkCandidates } from './savedTrackLinking'

function runtime(overrides: Partial<Track> = {}): Track {
  return {
    id: 'local-runtime',
    name: 'reverie.wav',
    displayName: 'Reverie',
    title: 'Reverie',
    artist: 'DVYDRM',
    url: 'blob:local',
    duration: 193,
    sourceKind: 'file',
    sourceFile: new File(['audio'], 'reverie.wav', { type: 'audio/wav' }),
    analysisRuntime: {} as Track['analysisRuntime'],
    ...overrides,
  }
}

function saved(id: string, overrides: Partial<LyricManagerTrack> = {}): LyricManagerTrack {
  return {
    id: `audio-${id}`,
    dbId: id,
    title: 'Reverie',
    fileName: 'reverie.wav',
    storagePath: `user/${id}/reverie.wav`,
    durationSec: 193.2,
    sampleRate: 48_000,
    channels: 2,
    fileSizeByte: 5,
    mimeType: 'audio/wav',
    transcriptionAssets: null,
    artist: 'DVYDRM',
    genre: null,
    bpm: 150,
    musicalKey: 'Bb Major',
    createdAt: '2026-07-01T00:00:00.000Z',
    lyricVersionCount: 1,
    activeLyricDocumentId: 'doc-1',
    activeLyricDocumentName: 'Active Lyrics',
    ...overrides,
  }
}

describe('rankSavedTrackLinkCandidates', () => {
  it('ranks bounded possible matches using multiple available signals', () => {
    const candidates = rankSavedTrackLinkCandidates(runtime(), [
      saved('strong'),
      saved('mismatch', { durationSec: 230, artist: 'Someone Else' }),
      saved('other', { title: 'Different', fileName: 'different.wav', durationSec: 100 }),
    ])

    expect(candidates[0]).toMatchObject({
      track: expect.objectContaining({ dbId: 'strong' }),
      durationMismatch: false,
    })
    expect(candidates[0].signals).toEqual(expect.arrayContaining([
      'Same normalized filename',
      'Same normalized title',
      'Same artist metadata',
    ]))
    expect(candidates.length).toBeLessThanOrEqual(8)
  })

  it('marks filename-only suggestions as mismatched candidates rather than authoritative links', () => {
    const [candidate] = rankSavedTrackLinkCandidates(
      runtime({ title: undefined, artist: undefined, duration: 180 }),
      [saved('filename-only', { title: 'Unrelated', artist: null, durationSec: 260, fileSizeByte: null })],
    )

    expect(candidate.track.dbId).toBe('filename-only')
    expect(candidate.signals).toContain('Same normalized filename')
    expect(candidate.durationMismatch).toBe(true)
  })
})
