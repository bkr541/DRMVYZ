import type { BeatMarkerMI } from '../../../../features/musicIntelligence/types'
import type { VzCueMarker } from '../../../../types/cue'
import type { ReactTrackSection } from '../ReactTypes'

// Placeholder data for Layout Lab's Track Map, chosen so every row and every kind of mark the Track Map can show
// is present: an imported (Rekordbox) beat grid, sections of every type from every source, Rekordbox hot cues,
// memory cues and loops beside a manual cue, structural phrases, semantic moments, and preset and PixGrid actions.

export const TM_DURATION_SEC = 119.069
export const TM_BPM = 129
export const TM_PLAYHEAD_SEC = 12.777
const BEAT_PERIOD = 60 / TM_BPM
const GRID_OFFSET = 0.132

export const TM_BEAT_GRID: BeatMarkerMI[] = Array.from({ length: Math.floor((TM_DURATION_SEC - GRID_OFFSET) / BEAT_PERIOD) }, (_, index) => ({
  timeSec: GRID_OFFSET + index * BEAT_PERIOD,
  confidence: 0.96,
  isDownbeat: index % 4 === 0,
  bpm: TM_BPM,
  beatIndex: index,
  beatWithinBar: index % 4,
  barIndex: Math.floor(index / 4),
  gridSource: 'imported',
  gridConfidence: 0.95,
}))

const analysisInterpretation = (familyId: string, occurrenceIndex: number, source: 'bar_self_similarity' | 'time_domain_fallback' = 'bar_self_similarity') =>
  ({ familyId, occurrenceIndex, analysisSource: source, gridSource: 'imported' as const })

/** Twelve sections covering every section type, with Rekordbox-imported, automatic, user-edited and manual origins. */
export const TM_SECTIONS: ReactTrackSection[] = [
  { id: 's1', label: 'Intro', type: 'intro', startSec: 0, endSec: 8, intensity: 0.28, source: 'imported', provenance: { authority: 'imported', originalId: 'rb-phrase-1', analysisSource: 'rekordbox' }, confidence: 0.92, boundaryConfidence: 0.94, labelConfidence: 0.9, gridConfidence: 0.95, interpretation: analysisInterpretation('family-intro', 1) },
  { id: 's2', label: 'Verse 1', type: 'verse', startSec: 8, endSec: 20, intensity: 0.46, source: 'imported', provenance: { authority: 'imported', originalId: 'rb-phrase-2', analysisSource: 'rekordbox' }, confidence: 0.88, boundaryConfidence: 0.9, labelConfidence: 0.84, gridConfidence: 0.95, interpretation: analysisInterpretation('family-verse', 1) },
  { id: 's3', label: 'Build 1', type: 'build', startSec: 20, endSec: 24.5, intensity: 0.68, source: 'auto', confidence: 0.81, boundaryConfidence: 0.78, labelConfidence: 0.8, gridConfidence: 0.9, interpretation: analysisInterpretation('family-build', 1) },
  { id: 's4', label: 'Pre-Drop', type: 'preDrop', startSec: 24.5, endSec: 28, intensity: 0.8, source: 'auto', confidence: 0.64, boundaryConfidence: 0.7, labelConfidence: 0.6, gridConfidence: 0.9, interpretation: analysisInterpretation('family-predrop', 1) },
  { id: 's5', label: 'Drop 1', type: 'drop', startSec: 28, endSec: 56, intensity: 0.95, source: 'imported', provenance: { authority: 'imported', originalId: 'rb-phrase-5', analysisSource: 'rekordbox' }, confidence: 0.9, boundaryConfidence: 0.93, labelConfidence: 0.88, gridConfidence: 0.95, dropConfidence: 0.92, interpretation: analysisInterpretation('family-drop', 1) },
  { id: 's6', label: 'Breakdown', type: 'breakdown', startSec: 56, endSec: 70, intensity: 0.24, source: 'user-edited-auto', confidence: 0.58, boundaryConfidence: 0.52, labelConfidence: 0.66, gridConfidence: 0.88, interpretation: analysisInterpretation('family-breakdown', 1, 'time_domain_fallback') },
  { id: 's7', label: 'Bridge', type: 'bridge', startSec: 70, endSec: 78, intensity: 0.5, source: 'user-created', locked: true, provenance: { authority: 'user_created', originalId: 's7' }, confidence: 1 },
  { id: 's8', label: 'Build 2', type: 'build', startSec: 78, endSec: 90, intensity: 0.72, source: 'auto', confidence: 0.84, boundaryConfidence: 0.86, labelConfidence: 0.82, gridConfidence: 0.9, interpretation: { ...analysisInterpretation('family-build', 2), isVariation: true } },
  { id: 's9', label: 'Pre-Drop 2', type: 'preDrop', startSec: 90, endSec: 94, intensity: 0.84, source: 'auto', confidence: 0.46, boundaryConfidence: 0.44, labelConfidence: 0.5, gridConfidence: 0.85, interpretation: analysisInterpretation('family-predrop', 2) },
  { id: 's10', label: 'Drop 2', type: 'drop', startSec: 94, endSec: 110, intensity: 0.92, source: 'imported', provenance: { authority: 'imported', originalId: 'rb-phrase-10', analysisSource: 'rekordbox' }, confidence: 0.87, boundaryConfidence: 0.89, labelConfidence: 0.85, gridConfidence: 0.95, dropConfidence: 0.85, interpretation: { ...analysisInterpretation('family-drop', 2), isVariation: true } },
  { id: 's11', label: 'Section 11', type: 'unknown', startSec: 110, endSec: 114, intensity: 0.4, source: 'fallback', confidence: 0.3, boundaryConfidence: 0.34, labelConfidence: 0.28, gridConfidence: 0.6 },
  { id: 's12', label: 'Outro', type: 'outro', startSec: 114, endSec: TM_DURATION_SEC, intensity: 0.18, source: 'imported', provenance: { authority: 'imported', originalId: 'rb-phrase-12', analysisSource: 'rekordbox' }, confidence: 0.9, boundaryConfidence: 0.91, labelConfidence: 0.89, gridConfidence: 0.95, interpretation: analysisInterpretation('family-outro', 1) },
]

/** Sections that have a preset assigned (their blocks carry the preset badge). */
export const TM_PRESET_ASSIGNED_SECTION_IDS = new Set(['s3', 's5', 's6', 's10'])

const REKORDBOX_HOT = ['#28e214', '#e2364f', '#4ac7db', '#d8b95a', '#b84fc9', '#ff8c24', '#5b8def', '#ff6bd5']

const cue = (id: string, label: string, time: number, extra: Partial<VzCueMarker> & Pick<VzCueMarker, 'type'>): VzCueMarker => ({
  id, label, time, barIndex: Math.floor(Math.max(0, time - GRID_OFFSET) / BEAT_PERIOD / 4), beatInBar: Math.floor(Math.max(0, time - GRID_OFFSET) / BEAT_PERIOD) % 4, ...extra,
})

/** Rekordbox hot cues A–H and memory cues and loops, beside two cues made in DRMVYZ. */
export const TM_CUES: VzCueMarker[] = [
  cue('rb-hot-a', 'A · Intro', 0.4, { type: 'intro', source: 'rekordbox', kind: 'hot_cue', color: REKORDBOX_HOT[0], externalId: '1:A', snappedToBeat: true }),
  cue('rb-hot-b', 'B · Verse', 8, { type: 'verse', source: 'rekordbox', kind: 'hot_cue', color: REKORDBOX_HOT[1], externalId: '1:B', snappedToBeat: true }),
  cue('rb-mem-1', 'Memory 1', 14.2, { type: 'custom', source: 'rekordbox', kind: 'memory_cue', color: '#e2364f', externalId: '1:M1', snappedToBeat: false, beatOffsetSec: 0.018 }),
  cue('rb-hot-c', 'C · Build', 20, { type: 'build', source: 'rekordbox', kind: 'hot_cue', color: REKORDBOX_HOT[2], externalId: '1:C', snappedToBeat: true }),
  cue('rb-hot-d', 'D · Drop', 28, { type: 'drop', source: 'rekordbox', kind: 'hot_cue', color: REKORDBOX_HOT[3], externalId: '1:D', snappedToBeat: true }),
  cue('rb-loop-1', 'Loop · 8 bars', 36, { type: 'custom', source: 'rekordbox', kind: 'loop', endTime: 52.5, color: '#61d6aa', externalId: '1:L1', snappedToBeat: true }),
  cue('manual-1', 'Cue 1', 44.6, { type: 'custom', source: 'manual', kind: 'marker', color: '#e2364f', snappedToBeat: false, beatOffsetSec: -0.032, trackId: 'lab-track' }),
  cue('rb-hot-e', 'E · Break', 56, { type: 'break', source: 'rekordbox', kind: 'hot_cue', color: REKORDBOX_HOT[4], externalId: '1:E', snappedToBeat: true }),
  cue('rb-mem-2', 'Memory 2', 63.3, { type: 'custom', source: 'rekordbox', kind: 'memory_cue', color: '#e2364f', externalId: '1:M2', snappedToBeat: true }),
  cue('rb-hot-f', 'F · Bridge', 70, { type: 'custom', source: 'rekordbox', kind: 'hot_cue', color: REKORDBOX_HOT[5], externalId: '1:F', snappedToBeat: true }),
  cue('rb-hot-g', 'G · Build 2', 78, { type: 'build', source: 'rekordbox', kind: 'hot_cue', color: REKORDBOX_HOT[6], externalId: '1:G', snappedToBeat: true }),
  cue('manual-2', 'Cue 2', 86.4, { type: 'custom', source: 'manual', kind: 'marker', color: '#d8b95a', snappedToBeat: true, trackId: 'lab-track' }),
  cue('rb-hot-h', 'H · Drop 2', 94, { type: 'drop', source: 'rekordbox', kind: 'hot_cue', color: REKORDBOX_HOT[7], externalId: '1:H', snappedToBeat: true }),
  cue('rb-loop-2', 'Loop · 4 bars', 102, { type: 'custom', source: 'rekordbox', kind: 'loop', endTime: 109.4, color: '#61d6aa', externalId: '1:L2', snappedToBeat: true }),
  cue('rb-mem-3', 'Memory 3', 114, { type: 'outro', source: 'rekordbox', kind: 'memory_cue', color: '#e2364f', externalId: '1:M3', snappedToBeat: true }),
]

export type TmCueKind = 'preset' | 'pixgrid' | 'cue' | 'phrase' | 'moment'
export interface TmCueItem { id: string; timeSec: number; label: string; color: string; kind: TmCueKind; enabled: boolean; title: string }

const phrase = (timeSec: number, bars: number, reason: string, confidence: number): TmCueItem => ({
  id: `phrase:${Math.round(timeSec * 1000)}`, timeSec, label: `${bars}-bar phrase`, color: '#5b8def', kind: 'phrase', enabled: true,
  title: `${reason} · ${Math.round(confidence * 100)}% confidence`,
})
const moment = (timeSec: number, type: string, confidence: number, signals: string[]): TmCueItem => {
  const label = type.replace(/_/g, ' ')
  return {
    id: `moment:${type}-${Math.round(timeSec * 1000)}`, timeSec, label,
    color: type === 'drop_impact' || type === 'major_impact' ? '#c0314a' : '#d8b95a', kind: 'moment', enabled: true,
    title: `${label} · ${Math.round(confidence * 100)}% confidence · ${signals.join(', ')}`,
  }
}

export const TM_PHRASES: TmCueItem[] = [
  phrase(0, 8, 'Structural phrase boundary', 0.87), phrase(8, 16, 'Repeated material', 0.76), phrase(28, 32, 'Structural phrase boundary', 0.91),
  phrase(56, 16, 'Structural phrase boundary', 0.72), phrase(78, 16, 'Self-similarity boundary', 0.69), phrase(94, 32, 'Repeated material', 0.88),
]
export const TM_MOMENTS: TmCueItem[] = [
  moment(20, 'build_start', 0.78, ['Energy rise', 'Hat density up']), moment(24.5, 'pre_drop_start', 0.7, ['Riser', 'Kick drop-out']),
  moment(28, 'drop_impact', 0.93, ['Bass entry', 'Energy step']), moment(41.2, 'major_impact', 0.81, ['Transient burst']),
  moment(56, 'breakdown_entry', 0.74, ['Low-end removal']), moment(66.5, 'fakeout_candidate', 0.66, ['Abrupt stop', 'Return']),
  moment(78, 'energy_release', 0.69, ['Filter open']), moment(94, 'drop_impact', 0.9, ['Bass entry', 'Energy step']),
]
export const TM_ACTIONS: TmCueItem[] = [
  { id: 'preset:1', timeSec: 20, label: 'Build 1 → Vacancy', color: '#b84fc9', kind: 'preset', enabled: true, title: 'Build 1 → Vacancy' },
  { id: 'preset:2', timeSec: 28, label: 'Drop 1 → Electric Storm', color: '#4ac7db', kind: 'preset', enabled: true, title: 'Drop 1 → Electric Storm' },
  { id: 'preset:3', timeSec: 56, label: 'Breakdown → Marquee', color: '#d8b95a', kind: 'preset', enabled: false, title: 'Breakdown → Marquee (disabled)' },
  { id: 'pixgrid:1', timeSec: 70, label: 'Logo Flash', color: '#61d6aa', kind: 'pixgrid', enabled: true, title: 'Logo Flash · PixGrid reveal layer · 01:10.000' },
  { id: 'preset:4', timeSec: 94, label: 'Drop 2 → Electric Storm', color: '#4ac7db', kind: 'preset', enabled: true, title: 'Drop 2 → Electric Storm' },
  { id: 'pixgrid:2', timeSec: 104, label: 'Strobe Hit', color: '#ff6bd5', kind: 'pixgrid', enabled: true, title: 'Strobe Hit · PixGrid trigger flash · 01:44.000' },
]
