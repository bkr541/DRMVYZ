import type { LyricDocumentVersion, LyricManagerTrack } from '../../../../features/lyrics/lyricManagerTypes'

// Placeholder library for Layout Lab's Lyric Manager Tracks tab, chosen so every state the Tracks list can show can be
// reached by clicking: a selected track with its lyric versions nested in its card (an active version, an open one, a
// version with no cues, every import source, one with an artist), a loaded and playing track, tracks with and without an artist,
// BPM, key and active lyrics (the overflow menu only offers what exists), tracks needing review, unattached legacy
// documents under the list, and a Load More page.

const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString()

function track(index: number, fields: Partial<LyricManagerTrack> & Pick<LyricManagerTrack, 'title'>): LyricManagerTrack {
  return {
    id: `audio-lab-${index}`,
    dbId: `lab-track-${index}`,
    fileName: `${fields.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.wav`,
    storagePath: null,
    durationSec: null,
    sampleRate: 48000,
    channels: 2,
    fileSizeByte: null,
    mimeType: 'audio/wav',
    transcriptionAssets: null,
    artist: null,
    genre: null,
    bpm: null,
    musicalKey: null,
    createdAt: ago(60 * 24 * (index + 1)),
    lyricVersionCount: 0,
    activeLyricDocumentId: null,
    activeLyricDocumentName: null,
    ...fields,
  }
}

export const LTR_TRACKS: LyricManagerTrack[] = [
  track(1, { title: 'Neon Cathedral', artist: 'DVYDRM', durationSec: 252, bpm: 129, musicalKey: '8A', lyricVersionCount: 5, activeLyricDocumentId: 'lab-doc-1', activeLyricDocumentName: 'Neon Cathedral — Final' }),
  track(2, { title: 'Static in the Sky', artist: 'Kody Robinson', durationSec: 228, bpm: 128, musicalKey: '5A', lyricVersionCount: 2, activeLyricDocumentId: 'lab-doc-6', activeLyricDocumentName: 'Static in the Sky — Synced' }),
  track(3, { title: 'Afterglow (Extended Mix)', artist: 'GOONZ', durationSec: 391, bpm: 126, musicalKey: '11B' }),
  track(4, { title: 'Untitled Session 04', durationSec: 187 }),
  track(5, { title: 'Velvet Intermission', artist: 'DVYDRM', durationSec: 302, bpm: 132, musicalKey: '2A', lyricVersionCount: 1, needsReview: true }),
  track(6, { title: 'Obsessed with the Fall', artist: 'Kody Robinson', durationSec: 202, bpm: 140, musicalKey: '9A', lyricVersionCount: 1, activeLyricDocumentId: 'lab-doc-8', activeLyricDocumentName: 'Obsessed with the Fall — AI draft' }),
  track(7, { title: 'Chasing Every Echo', artist: 'GOONZ', durationSec: 280, bpm: 124, musicalKey: '4B' }),
  track(8, { title: 'Premiere Burst', artist: 'DVYDRM', durationSec: 178, bpm: 150, musicalKey: '7A', needsReview: true }),
  track(9, { title: 'Fading Into Blue', artist: 'Kody Robinson', durationSec: 213, bpm: 118, musicalKey: '12A' }),
  track(10, { title: 'Tower Call & Response', artist: 'DVYDRM', durationSec: 265, bpm: 134, musicalKey: '6B' }),
]

/** The page Load More appends. */
export const LTR_MORE_TRACKS: LyricManagerTrack[] = [
  track(11, { title: 'Canopy Cascade', artist: 'DVYDRM', durationSec: 244, bpm: 130, musicalKey: '3A' }),
  track(12, { title: 'Neon Crown Rise', artist: 'GOONZ', durationSec: 319, bpm: 127, musicalKey: '10B' }),
  track(13, { title: 'Opening Night', durationSec: 156 }),
]

function doc(index: number, trackId: string | null, fields: Partial<LyricDocumentVersion> & Pick<LyricDocumentVersion, 'title' | 'sourceType'>): LyricDocumentVersion {
  return {
    id: `lab-doc-${index}`,
    userId: 'lab-user',
    audioTrackId: trackId,
    visualSessionId: null,
    artist: '',
    sourceFormat: 'json',
    rawSourceText: null,
    defaultStyle: {},
    defaultAnimation: {},
    defaultEffects: {},
    globalOffsetMs: 0,
    isActive: false,
    metadata: {},
    revision: 1,
    createdAt: ago(60 * 24 * 9),
    updatedAt: ago(60 * 24),
    cueCount: 0,
    language: 'en',
    documentReviewStatus: null,
    ...fields,
  }
}

/** Lyric versions by track id; the selected track's are nested in its card (the first track has five). */
export const LTR_DOCUMENTS: Record<string, LyricDocumentVersion[]> = {
  'lab-track-1': [
    doc(1, 'lab-track-1', { title: 'Neon Cathedral — Final', sourceType: 'ai_transcription', cueCount: 24, documentReviewStatus: 'reviewed', isActive: true, updatedAt: ago(125) }),
    doc(2, 'lab-track-1', { title: 'Neon Cathedral — Draft', sourceType: 'lrc_import', cueCount: 18, documentReviewStatus: 'unreviewed', updatedAt: ago(60 * 26) }),
    doc(3, 'lab-track-1', { title: 'Manual sync pass', sourceType: 'manual', cueCount: 0, language: null, updatedAt: ago(8) }),
    doc(4, 'lab-track-1', { title: 'Karaoke timing (VTT)', sourceType: 'vtt_import', cueCount: 31, documentReviewStatus: 'corrected', artist: 'DVYDRM', updatedAt: ago(60 * 24 * 4) }),
    doc(5, 'lab-track-1', { title: 'Word-level eLRC', sourceType: 'enhanced_lrc_import', cueCount: 22, language: 'es', documentReviewStatus: 'reviewed', updatedAt: ago(60 * 24 * 45) }),
  ],
  'lab-track-2': [
    doc(6, 'lab-track-2', { title: 'Static in the Sky — Synced', sourceType: 'json_import', cueCount: 27, documentReviewStatus: 'reviewed', isActive: true, updatedAt: ago(60 * 5) }),
    doc(7, 'lab-track-2', { title: 'Static in the Sky — API lookup', sourceType: 'api_lookup', cueCount: 20, documentReviewStatus: 'unreviewed', updatedAt: ago(60 * 24 * 3) }),
  ],
  'lab-track-5': [
    doc(9, 'lab-track-5', { title: 'Velvet Intermission — AI draft', sourceType: 'ai_transcription', cueCount: 15, documentReviewStatus: 'unreviewed', updatedAt: ago(40) }),
  ],
  'lab-track-6': [
    doc(8, 'lab-track-6', { title: 'Obsessed with the Fall — AI draft', sourceType: 'ai_transcription', cueCount: 19, documentReviewStatus: 'reviewed', isActive: true, updatedAt: ago(60 * 24 * 2) }),
  ],
}

/** Older documents not linked to any audio track, listed under the tracks. */
export const LTR_LEGACY_DOCUMENTS: LyricDocumentVersion[] = [
  doc(20, null, { title: 'Old lyric sheet', sourceType: 'manual', cueCount: 12, language: 'en', updatedAt: ago(60 * 24 * 90) }),
  doc(21, null, { title: '(Untitled)', sourceType: 'lrc_import', cueCount: 40, language: null, documentReviewStatus: 'unreviewed', updatedAt: ago(60 * 24 * 200) }),
]
