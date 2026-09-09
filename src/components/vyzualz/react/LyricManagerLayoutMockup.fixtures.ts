import type { SavedAudioTrack } from '../../../stores/audioStore'
import type { LyricCue } from '../../../types/lyrics'
import type { LyricDocumentVersion } from '../../../features/lyrics/lyricManagerTypes'
import type { TrackTimelineModel, TrackTimelineSection } from './trackTimeline/trackTimelineModel'

const FIXTURE_USER_ID = 'lyric-layout-mockup-user'

export const LYRIC_MANAGER_LAYOUT_TRACK_FIXTURES = [
  {
    id: 'audio-pop',
    dbId: 'track-pop',
    title: 'POP',
    fileName: 'DVYDRM - POP.wav',
    storagePath: null,
    durationSec: 198,
    sampleRate: 48_000,
    channels: 2,
    fileSizeByte: 61_840_000,
    mimeType: 'audio/wav',
    transcriptionAssets: null,
    artist: 'DVYDRM',
    genre: 'Hybrid Trap',
    bpm: 142,
    musicalKey: 'E Minor',
    createdAt: '2026-09-07T16:24:00.000Z',
  },
  {
    id: 'audio-reverie',
    dbId: 'track-reverie',
    title: 'Reverie',
    fileName: 'DVYDRM - Reverie.wav',
    storagePath: null,
    durationSec: 224,
    sampleRate: 48_000,
    channels: 2,
    fileSizeByte: 70_420_000,
    mimeType: 'audio/wav',
    transcriptionAssets: null,
    artist: 'DVYDRM',
    genre: 'Melodic Bass',
    bpm: 150,
    musicalKey: 'Bb Major',
    createdAt: '2026-08-30T20:12:00.000Z',
  },
  {
    id: 'audio-am',
    dbId: 'track-am',
    title: 'A.M.',
    fileName: 'DVYDRM - AM.mp3',
    storagePath: null,
    durationSec: 211,
    sampleRate: 44_100,
    channels: 2,
    fileSizeByte: 8_960_000,
    mimeType: 'audio/mpeg',
    transcriptionAssets: null,
    artist: 'DVYDRM',
    genre: 'Melodic Bass',
    bpm: 150,
    musicalKey: 'F Minor',
    createdAt: '2026-08-31T13:08:00.000Z',
  },
  {
    id: 'audio-neon-static',
    dbId: 'track-neon-static',
    title: 'Neon Static',
    fileName: 'Neon Static.m4a',
    storagePath: null,
    durationSec: 176,
    sampleRate: 48_000,
    channels: 2,
    fileSizeByte: 14_180_000,
    mimeType: 'audio/mp4',
    transcriptionAssets: null,
    artist: 'DVYDRM',
    genre: 'Bass Music',
    bpm: 145,
    musicalKey: 'G Minor',
    createdAt: '2026-08-18T09:40:00.000Z',
  },
] satisfies SavedAudioTrack[]

function version(
  id: string,
  audioTrackId: string,
  title: string,
  sourceType: LyricDocumentVersion['sourceType'],
  isActive: boolean,
  cueCount: number,
  updatedAt: string,
  reviewStatus: string,
): LyricDocumentVersion {
  return {
    id,
    userId: FIXTURE_USER_ID,
    audioTrackId,
    visualSessionId: null,
    title,
    artist: 'DVYDRM',
    sourceType,
    sourceFormat: 'json',
    rawSourceText: null,
    defaultStyle: {
      fontFamily: 'Inter',
      fontSize: 54,
      fontWeight: 800,
      color: '#FFFFFF',
      opacity: 1,
      x: 0.5,
      y: 0.78,
      align: 'center',
      maxWidth: 0.84,
    },
    defaultAnimation: {
      in: 'fadeUp',
      out: 'fade',
      inMs: 180,
      outMs: 140,
      easing: 'easeOutCubic',
    },
    defaultEffects: {
      glow: 0.22,
      bassScale: 0.08,
      beatPunch: 0.12,
    },
    globalOffsetMs: 0,
    isActive,
    metadata: {
      language: 'en',
      reviewStatus,
      mockupFixture: true,
    },
    revision: 1,
    createdAt: '2026-09-01T12:00:00.000Z',
    updatedAt,
    cueCount,
    language: 'en',
    documentReviewStatus: reviewStatus,
  }
}

export const LYRIC_MANAGER_LAYOUT_DOCUMENT_FIXTURES: Record<string, LyricDocumentVersion[]> = {
  'track-pop': [
    version('pop-live', 'track-pop', 'Festival Live', 'manual', true, 8, '2026-09-08T12:10:00.000Z', 'reviewed'),
    version('pop-transcription', 'track-pop', 'AI Transcription', 'ai_transcription', false, 9, '2026-09-08T10:42:00.000Z', 'unreviewed'),
    version('pop-alt', 'track-pop', 'Alternate Hook', 'json_import', false, 8, '2026-09-07T22:18:00.000Z', 'corrected'),
  ],
  'track-reverie': [
    version('reverie-master', 'track-reverie', 'Master Lyrics', 'manual', true, 12, '2026-09-06T18:34:00.000Z', 'reviewed'),
    version('reverie-import', 'track-reverie', 'Writer Export', 'lrc_import', false, 12, '2026-09-05T15:20:00.000Z', 'corrected'),
  ],
  'track-am': [
    version('am-draft', 'track-am', 'Working Draft', 'manual', false, 10, '2026-09-04T14:00:00.000Z', 'unreviewed'),
  ],
  'track-neon-static': [],
}

export const LYRIC_MANAGER_LAYOUT_CUE_FIXTURES: Record<string, LyricCue[]> = {
  'pop-live': [
    { id: 'pop-live-1', startMs: 18_400, endMs: 21_100, text: 'I can feel it building', source: 'manual', reviewStatus: 'reviewed', sectionType: 'build' },
    {
      id: 'pop-live-2',
      startMs: 21_180,
      endMs: 23_650,
      text: 'Right before we pop',
      source: 'manual',
      reviewStatus: 'reviewed',
      sectionType: 'build',
      style: { color: '#7EDAE8', fontSize: 62 },
      animation: { in: 'scalePop', inMs: 220, intensity: 0.75 },
      effects: { glow: 0.45 },
    },
    { id: 'pop-live-3', startMs: 24_000, endMs: 25_300, text: 'Pop', source: 'manual', reviewStatus: 'reviewed', sectionType: 'drop' },
  ],
  'pop-transcription': [
    { id: 'pop-ai-1', startMs: 18_360, endMs: 21_020, text: 'I can feel it building', source: 'transcription', reviewStatus: 'unreviewed', confidence: 0.91, sectionType: 'build' },
    { id: 'pop-ai-2', startMs: 21_130, endMs: 23_700, text: 'Right before we pop', source: 'transcription', reviewStatus: 'unreviewed', confidence: 0.86, sectionType: 'build' },
  ],
  'pop-alt': [
    { id: 'pop-alt-1', startMs: 18_400, endMs: 21_000, text: 'Pressure rising in the room', source: 'manual', reviewStatus: 'corrected', sectionType: 'build' },
    { id: 'pop-alt-2', startMs: 21_180, endMs: 23_650, text: 'Watch the whole thing pop', source: 'manual', reviewStatus: 'corrected', sectionType: 'build', style: { color: '#FFA6CA' } },
  ],
  'reverie-master': [
    { id: 'reverie-1', startMs: 12_000, endMs: 14_500, text: 'Lay your doubts down', source: 'manual', reviewStatus: 'reviewed', sectionType: 'verse' },
    { id: 'reverie-2', startMs: 14_650, endMs: 17_900, text: 'The best part starts from here', source: 'manual', reviewStatus: 'reviewed', sectionType: 'chorus' },
  ],
  'reverie-import': [
    { id: 'reverie-import-1', startMs: 12_020, endMs: 14_520, text: 'Lay your doubts down', source: 'import', reviewStatus: 'corrected', sectionType: 'verse' },
    { id: 'reverie-import-2', startMs: 14_680, endMs: 17_920, text: 'The best part starts from here', source: 'import', reviewStatus: 'corrected', sectionType: 'chorus' },
  ],
  'am-draft': [
    { id: 'am-1', startMs: 8_500, endMs: 11_200, text: 'Meet me in the A.M.', source: 'manual', reviewStatus: 'unreviewed', sectionType: 'verse' },
  ],
}

export function createLyricManagerLayoutTrackFixtures(): SavedAudioTrack[] {
  return LYRIC_MANAGER_LAYOUT_TRACK_FIXTURES.map(track => ({ ...track }))
}

export function createLyricManagerLayoutDocumentFixtures(): Record<string, LyricDocumentVersion[]> {
  return Object.fromEntries(
    Object.entries(LYRIC_MANAGER_LAYOUT_DOCUMENT_FIXTURES).map(([trackId, documents]) => [
      trackId,
      documents.map(document => ({
        ...document,
        defaultStyle: { ...document.defaultStyle },
        defaultAnimation: { ...document.defaultAnimation },
        defaultEffects: { ...document.defaultEffects },
        metadata: { ...document.metadata },
      })),
    ]),
  )
}

const TIMELINE_SECTION_TEMPLATE: ReadonlyArray<{
  label: string
  type: string
  startRatio: number
  endRatio: number
  intensity: number
}> = [
  { label: 'Intro', type: 'intro', startRatio: 0, endRatio: 0.09, intensity: 0.28 },
  { label: 'Verse', type: 'verse', startRatio: 0.09, endRatio: 0.25, intensity: 0.42 },
  { label: 'Build', type: 'build', startRatio: 0.25, endRatio: 0.36, intensity: 0.72 },
  { label: 'Drop', type: 'drop', startRatio: 0.36, endRatio: 0.49, intensity: 0.96 },
  { label: 'Breakdown', type: 'breakdown', startRatio: 0.49, endRatio: 0.62, intensity: 0.34 },
  { label: 'Verse', type: 'verse', startRatio: 0.62, endRatio: 0.74, intensity: 0.5 },
  { label: 'Build', type: 'build', startRatio: 0.74, endRatio: 0.84, intensity: 0.78 },
  { label: 'Drop', type: 'drop', startRatio: 0.84, endRatio: 0.95, intensity: 1 },
  { label: 'Outro', type: 'outro', startRatio: 0.95, endRatio: 1, intensity: 0.25 },
]

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function buildFixtureSections(track: SavedAudioTrack, durationSec: number): TrackTimelineSection[] {
  return TIMELINE_SECTION_TEMPLATE.map((section, index) => ({
    id: `${track.dbId}-fixture-section-${index}`,
    label: section.label,
    type: section.type,
    start: section.startRatio * durationSec,
    end: section.endRatio * durationSec,
    intensity: section.intensity,
    confidence: 0.9,
  }))
}

function sectionIntensityAt(timeSec: number, durationSec: number): number {
  const ratio = durationSec > 0 ? timeSec / durationSec : 0
  return TIMELINE_SECTION_TEMPLATE.find(section => ratio >= section.startRatio && ratio < section.endRatio)?.intensity
    ?? TIMELINE_SECTION_TEMPLATE[TIMELINE_SECTION_TEMPLATE.length - 1]!.intensity
}

/**
 * Builds deterministic, disconnected timeline analysis for the layout mockup.
 * The shape intentionally matches TrackTimelineModel so the mockup can render
 * through the same pure canvas primitives as React Track Map / Track Timeline.
 */
export function createLyricManagerLayoutTimelineFixture(track: SavedAudioTrack): TrackTimelineModel {
  const durationSec = Math.max(0.001, track.durationSec ?? 180)
  const bpm = Math.max(1, track.bpm ?? 120)
  const beatsPerBar = 4
  const beatDurationSec = 60 / bpm
  const beatCount = Math.max(1, Math.floor(durationSec / beatDurationSec) + 1)
  const beats = Array.from({ length: beatCount }, (_, index) => ({
    time: Math.min(durationSec, index * beatDurationSec),
    beatIndex: index,
    barIndex: Math.floor(index / beatsPerBar),
    beatWithinBar: index % beatsPerBar,
    isDownbeat: index % beatsPerBar === 0,
    bpm,
    confidence: 0.96,
  })).filter((beat, index, source) => index === 0 || beat.time > source[index - 1]!.time)

  const barCount = Math.max(1, Math.ceil(durationSec / (beatDurationSec * beatsPerBar)))
  const bars = Array.from({ length: barCount }, (_, barIndex) => {
    const start = barIndex * beatDurationSec * beatsPerBar
    return {
      barIndex,
      barNumber: barIndex + 1,
      start,
      end: Math.min(durationSec, start + beatDurationSec * beatsPerBar),
      gridConfidence: 0.96,
    }
  }).filter(bar => bar.end > bar.start)

  const sections = buildFixtureSections(track, durationSec)
  const binCount = Math.min(1_024, Math.max(420, Math.round(durationSec * 4)))
  const waveform = Array.from({ length: binCount }, (_, index) => {
    const start = (index / binCount) * durationSec
    const end = ((index + 1) / binCount) * durationSec
    const center = (start + end) / 2
    const intensity = sectionIntensityAt(center, durationSec)
    const pulse = 0.58 + 0.24 * Math.sin(index * 0.31) + 0.12 * Math.sin(index * 0.071 + 1.4)
    const transient = 0.08 * Math.abs(Math.sin(index * 0.83))
    const amplitude = clamp01(0.1 + intensity * Math.max(0.18, pulse) + transient)
    const low = clamp01(0.18 + intensity * (0.48 + 0.22 * Math.sin(index * 0.055 + 0.4)))
    const mid = clamp01(0.16 + intensity * (0.42 + 0.2 * Math.sin(index * 0.087 + 1.2)))
    const high = clamp01(0.12 + intensity * (0.34 + 0.2 * Math.sin(index * 0.139 + 2.1)))
    return {
      index,
      start,
      center,
      end,
      positive: clamp01(amplitude * (0.82 + 0.18 * Math.sin(index * 0.19))),
      negative: clamp01(amplitude * (0.76 + 0.2 * Math.sin(index * 0.23 + 0.9))),
      rms: clamp01(amplitude * 0.68),
      low,
      mid,
      high,
    }
  })

  return {
    meta: {
      filename: track.fileName,
      bpm,
      timeSignature: beatsPerBar,
      dominantKey: track.musicalKey ?? 'Unknown',
      keyConfidence: track.musicalKey ? 0.92 : null,
      sampleRate: track.sampleRate,
      channels: track.channels,
      analysisVersion: 'lyric-manager-layout-fixture-v1',
    },
    durationSec,
    beats,
    bars,
    sections,
    phrases: [],
    semanticMoments: [],
    structuralBoundaries: [],
    curves: {},
    waveform,
    timelineEvents: [],
    warnings: [],
  }
}
