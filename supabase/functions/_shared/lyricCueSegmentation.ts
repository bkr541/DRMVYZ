export const LYRIC_CUE_SEGMENTATION_VERSION = 'track-map-v1'

export type LyricCueStyle = 'hip-hop' | 'balanced' | 'melodic' | 'vocal-chops'

export const LYRIC_CUE_STYLE_LABELS: Record<LyricCueStyle, string> = {
  'hip-hop': 'Hip-Hop / Rap',
  balanced: 'Balanced',
  melodic: 'Melodic',
  'vocal-chops': 'Vocal Chops',
}

export function normalizeLyricCueStyle(value: unknown): LyricCueStyle {
  return value === 'hip-hop' || value === 'melodic' || value === 'vocal-chops' ? value : 'balanced'
}

export interface SegmentationWord {
  id: string
  text: string
  startMs: number
  endMs: number
  confidence?: number
  warnings?: string[]
}

export interface SegmentationCue<W extends SegmentationWord = SegmentationWord> {
  startMs: number
  endMs: number
  text: string
  words: W[]
  boundaryReason: string
  sectionId?: string
  sectionType?: string
}

export interface MusicalSegmentationStructure {
  sections?: Array<{ id?: string; type?: string; startSec?: number; endSec?: number; confidence?: number; boundaryConfidence?: number }>
  beatGrid?: Array<{ timeSec?: number; confidence?: number; isDownbeat?: boolean }>
  downbeats?: Array<{ timeSec?: number; confidence?: number }>
  barMarkers?: Array<{ startSec?: number; gridConfidence?: number }>
  phrases?: Array<{ timeSec?: number; phraseLength?: number; lengthBars?: number; confidence?: number }>
  phraseHierarchy?: { units?: Array<{ level?: string; startSec?: number; confidence?: number }> }
}

interface StyleProfile { minWords: number; targetWords: number; maxWords: number; pauseMs: number; maxDurationMs: number }
const PROFILES: Record<LyricCueStyle, StyleProfile> = {
  'hip-hop': { minWords: 2, targetWords: 4, maxWords: 6, pauseMs: 430, maxDurationMs: 3_800 },
  balanced: { minWords: 4, targetWords: 7, maxWords: 9, pauseMs: 720, maxDurationMs: 6_500 },
  melodic: { minWords: 6, targetWords: 10, maxWords: 14, pauseMs: 1_050, maxDurationMs: 10_000 },
  'vocal-chops': { minWords: 1, targetWords: 2, maxWords: 4, pauseMs: 260, maxDurationMs: 2_400 },
}

function finite(value: unknown): number | null { return typeof value === 'number' && Number.isFinite(value) ? value : null }
function punctuation(text: string): boolean { return /[.!?;:]$/.test(text.trim()) }
function cueText(words: readonly SegmentationWord[]): string { return words.map(word => word.text).join(' ').replace(/\s+([,.;!?])/g, '$1').trim() }
function times(items: readonly unknown[], key = 'timeSec'): number[] {
  return items.map(item => finite((item as Record<string, unknown>)?.[key])).filter((value): value is number => value !== null).map(value => Math.round(value * 1000)).sort((a, b) => a - b)
}
function near(timeMs: number, landmarks: readonly number[], toleranceMs: number): boolean {
  return landmarks.some(value => Math.abs(value - timeMs) <= toleranceMs)
}

export function segmentTimedWords<W extends SegmentationWord>(
  inputWords: readonly W[],
  styleValue: unknown,
  structure: MusicalSegmentationStructure | null = null,
): SegmentationCue<W>[] {
  const style = normalizeLyricCueStyle(styleValue)
  const base = PROFILES[style]
  const words = [...inputWords].filter(word => word.text.trim() && Number.isFinite(word.startMs) && Number.isFinite(word.endMs) && word.endMs > word.startMs)
    .sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs)
  if (!words.length) return []

  const sections = (structure?.sections ?? []).map(section => ({
    id: section.id, type: section.type,
    startMs: Math.round((finite(section.startSec) ?? 0) * 1000),
    endMs: Math.round((finite(section.endSec) ?? 0) * 1000),
    confidence: finite(section.boundaryConfidence) ?? finite(section.confidence) ?? 0,
  })).filter(section => section.endMs > section.startMs).sort((a, b) => a.startMs - b.startMs)
  const sectionBoundaries = sections.filter(section => section.confidence >= 0.55).flatMap(section => [section.startMs, section.endMs])
  const beats = times(structure?.beatGrid ?? [])
  const downbeats = times(structure?.downbeats ?? [])
  const bars = times(structure?.barMarkers ?? [], 'startSec')
  const phrase4: number[] = [], phrase8: number[] = [], phrase16: number[] = []
  for (const phrase of structure?.phrases ?? []) {
    const time = finite(phrase.timeSec); const length = finite(phrase.lengthBars) ?? finite(phrase.phraseLength); const confidence = finite(phrase.confidence) ?? 0
    if (time === null || confidence < 0.4) continue
    ;(length && length >= 16 ? phrase16 : length && length >= 8 ? phrase8 : phrase4).push(Math.round(time * 1000))
  }
  for (const unit of structure?.phraseHierarchy?.units ?? []) {
    const time = finite(unit.startSec); if (time === null || (finite(unit.confidence) ?? 0) < 0.4) continue
    if (unit.level === 'sixteen_bar' || unit.level === 'thirty_two_bar') phrase16.push(Math.round(time * 1000))
    else if (unit.level === 'eight_bar') phrase8.push(Math.round(time * 1000))
    else if (unit.level === 'four_bar') phrase4.push(Math.round(time * 1000))
  }

  const sectionAt = (timeMs: number) => sections.find(section => timeMs >= section.startMs && timeMs < section.endMs)
  const output: SegmentationCue<W>[] = []
  let current: W[] = []
  const flush = (reason: string) => {
    if (!current.length) return
    const section = sectionAt(current[0].startMs)
    output.push({ startMs: current[0].startMs, endMs: current[current.length - 1].endMs, text: cueText(current), words: current, boundaryReason: reason, ...(section?.id ? { sectionId: section.id } : {}), ...(section?.type ? { sectionType: section.type } : {}) })
    current = []
  }

  for (const word of words) {
    if (!current.length) { current = [word]; continue }
    const previous = current[current.length - 1]
    const currentSection = sectionAt(current[0].startMs)
    const nextSection = sectionAt(word.startMs)
    const sectionType = (currentSection?.type ?? '').toLowerCase()
    const adaptiveMax = sectionType.includes('drop') && style !== 'vocal-chops' ? Math.max(base.minWords, base.maxWords - 2)
      : sectionType.includes('build') ? Math.max(base.minWords, base.maxWords - 1)
      : sectionType.includes('break') && style === 'melodic' ? base.maxWords + 2 : base.maxWords
    const gap = word.startMs - previous.endMs
    const boundaryTime = previous.endMs
    const crossesSection = Boolean(currentSection && nextSection && currentSection.id !== nextSection.id && near(word.startMs, sectionBoundaries, 250))
    const majorPhrase = near(boundaryTime, phrase16, 520)
    const strongPhrase = near(boundaryTime, phrase8, 420)
    const localPhrase = near(boundaryTime, phrase4, 330)
    const musical = near(boundaryTime, downbeats, 260) || near(boundaryTime, bars, 300) || (style === 'vocal-chops' && near(boundaryTime, beats, 180))
    let reason = ''
    if (crossesSection) reason = 'section'
    else if (gap >= base.pauseMs) reason = 'pause'
    else if (punctuation(previous.text) && current.length >= base.minWords) reason = 'punctuation'
    else if (current.length >= adaptiveMax) reason = 'style-limit'
    else if (word.endMs - current[0].startMs > base.maxDurationMs) reason = 'duration'
    else if (current.length >= base.targetWords && majorPhrase) reason = '16-bar'
    else if (current.length >= base.targetWords && strongPhrase) reason = '8-bar'
    else if (current.length >= base.minWords && localPhrase) reason = '4-bar'
    else if (current.length >= base.targetWords && musical) reason = 'musical-grid'
    if (reason) flush(reason)
    current.push(word)
  }
  flush('end')
  return output
}

export function segmentationProvenance(styleValue: unknown, structure: MusicalSegmentationStructure | null, sourceDocumentId?: string) {
  const style = normalizeLyricCueStyle(styleValue)
  return {
    cueSegmentationStyle: style,
    usedTrackSections: Boolean(structure?.sections?.length),
    usedBeatGrid: Boolean(structure?.beatGrid?.length || structure?.downbeats?.length || structure?.barMarkers?.length),
    usedPhraseMarkers: Boolean(structure?.phrases?.length || structure?.phraseHierarchy?.units?.length),
    segmentationAlgorithmVersion: LYRIC_CUE_SEGMENTATION_VERSION,
    ...(sourceDocumentId ? { sourceDocumentId } : {}),
  }
}
