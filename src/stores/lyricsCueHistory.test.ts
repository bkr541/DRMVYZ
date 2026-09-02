import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LyricCue } from '../types/lyrics'

vi.mock('../lib/supabase', () => ({ supabaseConfigured: false }))
vi.mock('../lib/lyricsDb', () => ({
  activateLyricDocument: vi.fn(),
  getLyricDocumentById: vi.fn(),
  getLyricCuesForDocument: vi.fn(),
  getActiveLyricDocumentForAudioTrack: vi.fn(),
  getActiveLyricDocumentForVisualSession: vi.fn(),
  saveLyricDocumentAtomic: vi.fn(),
}))

import { useLyricsStore } from './lyricsStore'

const FIRST: LyricCue = { id: 'cue-1', startMs: 1_000, endMs: 2_000, text: 'First' }
const SECOND: LyricCue = { id: 'cue-2', startMs: 2_000, endMs: 3_000, text: 'Second' }

describe('lyricsStore cue history', () => {
  beforeEach(() => {
    useLyricsStore.getState().clearLyrics()
    useLyricsStore.setState({
      cues: [FIRST, SECOND],
      selectedCueId: FIRST.id,
      cueHistoryPast: [],
      cueHistoryFuture: [],
      editorSessionActive: true,
      editorDirty: false,
      lyricTimingDirty: false,
    })
  })

  it('records one undo entry for one committed cue drag', () => {
    useLyricsStore.getState().setCueBounds(FIRST.id, 1_250, 2_250)

    expect(useLyricsStore.getState().cues[0]).toMatchObject({ startMs: 1_250, endMs: 2_250 })
    expect(useLyricsStore.getState().cueHistoryPast).toHaveLength(1)
    expect(useLyricsStore.getState().editorDirty).toBe(true)

    useLyricsStore.getState().undoCueEdit()
    expect(useLyricsStore.getState().cues[0]).toMatchObject({ startMs: 1_000, endMs: 2_000 })
    expect(useLyricsStore.getState().cueHistoryFuture).toHaveLength(1)

    useLyricsStore.getState().redoCueEdit()
    expect(useLyricsStore.getState().cues[0]).toMatchObject({ startMs: 1_250, endMs: 2_250 })
  })

  it('moves cue words atomically through the store move path', () => {
    useLyricsStore.setState({
      cues: [{
        ...FIRST,
        words: [{ id: 'word-1', text: 'First', startMs: 1_100, endMs: 1_500, confidence: 0.8 }],
        groups: [{ id: 'group-1', wordIds: ['word-1'] }],
      }, SECOND],
      cueHistoryPast: [],
      cueHistoryFuture: [],
    })

    useLyricsStore.getState().moveCue(FIRST.id, 500)

    expect(useLyricsStore.getState().cues[0]).toMatchObject({
      startMs: 1_500,
      endMs: 2_500,
      words: [expect.objectContaining({ id: 'word-1', startMs: 1_600, endMs: 2_000, confidence: 0.8 })],
      groups: [{ id: 'group-1', wordIds: ['word-1'] }],
    })
    expect(useLyricsStore.getState().cueHistoryPast).toHaveLength(1)

    useLyricsStore.getState().undoCueEdit()
    expect(useLyricsStore.getState().cues[0].words?.[0]).toMatchObject({ startMs: 1_100, endMs: 1_500 })
  })

  it('undoes and redoes metadata-only and reordered cue collections', () => {
    useLyricsStore.getState().updateCue(FIRST.id, { reviewStatus: 'reviewed', confidence: 0.92 })
    useLyricsStore.getState().setCues([SECOND, { ...FIRST, reviewStatus: 'reviewed', confidence: 0.92 }])

    expect(useLyricsStore.getState().cues.map(cue => cue.id)).toEqual([SECOND.id, FIRST.id])
    useLyricsStore.getState().undoCueEdit()
    expect(useLyricsStore.getState().cues.map(cue => cue.id)).toEqual([FIRST.id, SECOND.id])
    expect(useLyricsStore.getState().cues[0]).toMatchObject({ reviewStatus: 'reviewed', confidence: 0.92 })
    useLyricsStore.getState().undoCueEdit()
    expect(useLyricsStore.getState().cues[0].reviewStatus).toBeUndefined()
    useLyricsStore.getState().redoCueEdit()
    useLyricsStore.getState().redoCueEdit()
    expect(useLyricsStore.getState().cues.map(cue => cue.id)).toEqual([SECOND.id, FIRST.id])
  })

  it('merges rapid word patches into live state with separate undo and redo entries', () => {
    const words = [
      {
        id: 'word-1',
        text: 'First',
        startMs: 1_100,
        endMs: 1_500,
        confidence: 0.8,
        source: 'transcription' as const,
        reviewStatus: 'corrected' as const,
        warnings: ['needs_review' as const],
        analysisMetadata: { token: 'preserve' },
      },
      { id: 'word-2', text: 'Second', startMs: 1_550, endMs: 1_900, confidence: 0.6 },
    ]
    useLyricsStore.setState({
      cues: [{ ...FIRST, words, groups: [{ id: 'group-1', wordIds: ['word-1', 'word-2'] }] }, SECOND],
      cueHistoryPast: [],
      cueHistoryFuture: [],
    })

    useLyricsStore.getState().updateCueWord(FIRST.id, 'word-1', { startMs: 1_200 })
    useLyricsStore.getState().updateCueWord(FIRST.id, 'word-1', { endMs: 1_600 })

    expect(useLyricsStore.getState().cues[0]).toMatchObject({
      words: [
        {
          id: 'word-1',
          text: 'First',
          startMs: 1_200,
          endMs: 1_600,
          confidence: 0.8,
          source: 'transcription',
          reviewStatus: 'corrected',
          warnings: ['needs_review'],
          analysisMetadata: { token: 'preserve' },
        },
        { id: 'word-2', text: 'Second', startMs: 1_550, endMs: 1_900, confidence: 0.6 },
      ],
      groups: [{ id: 'group-1', wordIds: ['word-1', 'word-2'] }],
    })
    expect(useLyricsStore.getState().cueHistoryPast).toHaveLength(2)

    useLyricsStore.getState().undoCueEdit()
    expect(useLyricsStore.getState().cues[0].words?.[0]).toMatchObject({ startMs: 1_200, endMs: 1_500 })
    useLyricsStore.getState().undoCueEdit()
    expect(useLyricsStore.getState().cues[0].words?.[0]).toMatchObject({ startMs: 1_100, endMs: 1_500 })
    useLyricsStore.getState().redoCueEdit()
    expect(useLyricsStore.getState().cues[0].words?.[0]).toMatchObject({ startMs: 1_200, endMs: 1_500 })
    useLyricsStore.getState().redoCueEdit()
    expect(useLyricsStore.getState().cues[0].words?.[0]).toMatchObject({ startMs: 1_200, endMs: 1_600 })
  })

  it('preserves a prior end edit when start is committed second', () => {
    useLyricsStore.setState({
      cues: [{ ...FIRST, words: [{ id: 'word-1', text: 'First', startMs: 1_100, endMs: 1_500 }] }, SECOND],
      cueHistoryPast: [],
      cueHistoryFuture: [],
    })

    useLyricsStore.getState().updateCueWord(FIRST.id, 'word-1', { endMs: 1_650 })
    useLyricsStore.getState().updateCueWord(FIRST.id, 'word-1', { startMs: 1_250 })

    expect(useLyricsStore.getState().cues[0].words?.[0]).toMatchObject({ startMs: 1_250, endMs: 1_650 })
    expect(useLyricsStore.getState().cueHistoryPast).toHaveLength(2)
  })

  it('preserves a newer edit to another word in the same cue', () => {
    useLyricsStore.setState({
      cues: [{
        ...FIRST,
        words: [
          { id: 'word-1', text: 'First', startMs: 1_100, endMs: 1_500 },
          { id: 'word-2', text: 'Second', startMs: 1_550, endMs: 1_900 },
        ],
      }, SECOND],
      cueHistoryPast: [],
      cueHistoryFuture: [],
    })

    useLyricsStore.getState().updateCueWord(FIRST.id, 'word-2', { text: 'Newer second' })
    useLyricsStore.getState().updateCueWord(FIRST.id, 'word-1', { startMs: 1_200 })

    expect(useLyricsStore.getState().cues[0].words).toEqual([
      { id: 'word-1', text: 'First', startMs: 1_200, endMs: 1_500 },
      { id: 'word-2', text: 'Newer second', startMs: 1_550, endMs: 1_900 },
    ])
  })

  it('does not create state or history when a cue or word is missing', () => {
    useLyricsStore.setState({
      cues: [{ ...FIRST, words: [{ id: 'word-1', text: 'First', startMs: 1_100, endMs: 1_500 }] }, SECOND],
      cueHistoryPast: [],
      cueHistoryFuture: [],
    })
    const before = useLyricsStore.getState().cues

    useLyricsStore.getState().updateCueWord('missing-cue', 'word-1', { startMs: 1_200 })
    useLyricsStore.getState().updateCueWord(FIRST.id, 'missing-word', { startMs: 1_200 })

    expect(useLyricsStore.getState().cues).toBe(before)
    expect(useLyricsStore.getState().cueHistoryPast).toHaveLength(0)
  })

  it('keeps history bounded during repeated edits', () => {
    for (let index = 0; index < 75; index += 1) {
      useLyricsStore.getState().setCueBounds(FIRST.id, 1_000 + index, 2_000 + index)
    }
    expect(useLyricsStore.getState().cueHistoryPast).toHaveLength(50)
  })
})
