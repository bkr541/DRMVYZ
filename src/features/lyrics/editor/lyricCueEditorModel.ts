import type { LyricCue, LyricWarning, LyricWord } from '../../../types/lyrics'

export const MIN_LYRIC_CUE_DURATION_MS = 1
export const DEFAULT_NEW_CUE_DURATION_MS = 2_000
export const LOW_LYRIC_CONFIDENCE = 0.7

export type LyricSnapMode =
  | 'none'
  | 'millisecond'
  | 'frame'
  | 'beat'
  | 'half-beat'
  | 'quarter-beat'
  | 'word'

export interface LyricSnapContext {
  mode: LyricSnapMode
  beatGridMs?: readonly number[]
  wordBoundaryMs?: readonly number[]
  millisecondGridMs?: number
  frameRate?: number
}

export interface LyricCueIssue {
  code:
    | 'invalid_start'
    | 'invalid_end'
    | 'zero_length'
    | 'outside_track'
    | 'overlap'
    | 'empty_text'
    | 'invalid_confidence'
    | 'word_outside_cue'
    | 'invalid_word_timing'
  message: string
  cueId: string
  relatedCueId?: string
  wordId?: string
}

export interface CueBounds {
  startMs: number
  endMs: number
}

function finiteInteger(value: number, fallback: number): number {
  return Number.isFinite(value) ? Math.round(value) : fallback
}

export function normalizeTrackDurationMs(durationMs?: number | null): number | null {
  if (durationMs == null || !Number.isFinite(durationMs) || durationMs <= 0) return null
  return Math.max(MIN_LYRIC_CUE_DURATION_MS, Math.round(durationMs))
}

export function normalizeCueBounds(
  startMs: number,
  endMs: number,
  trackDurationMs?: number | null,
): CueBounds {
  const duration = normalizeTrackDurationMs(trackDurationMs)
  let start = Math.max(0, finiteInteger(startMs, 0))
  let end = finiteInteger(endMs, start + MIN_LYRIC_CUE_DURATION_MS)

  if (duration !== null) start = Math.min(start, Math.max(0, duration - MIN_LYRIC_CUE_DURATION_MS))
  end = Math.max(start + MIN_LYRIC_CUE_DURATION_MS, end)
  if (duration !== null) end = Math.min(duration, end)
  if (end <= start) start = Math.max(0, end - MIN_LYRIC_CUE_DURATION_MS)

  return { startMs: start, endMs: end }
}

export function normalizeCue(
  cue: LyricCue,
  trackDurationMs?: number | null,
): LyricCue {
  const bounds = normalizeCueBounds(cue.startMs, cue.endMs, trackDurationMs)
  return { ...cue, ...bounds }
}

export function isCueActive(cue: Pick<LyricCue, 'startMs' | 'endMs'>, currentTimeMs: number): boolean {
  return Number.isFinite(currentTimeMs) && cue.startMs <= currentTimeMs && currentTimeMs < cue.endMs
}

export function moveCueToStart(
  cue: Pick<LyricCue, 'startMs' | 'endMs'>,
  targetStartMs: number,
  trackDurationMs?: number | null,
): CueBounds {
  const durationMs = Math.max(MIN_LYRIC_CUE_DURATION_MS, cue.endMs - cue.startMs)
  const trackDuration = normalizeTrackDurationMs(trackDurationMs)
  let startMs = Math.max(0, finiteInteger(targetStartMs, cue.startMs))
  if (trackDuration !== null) startMs = Math.min(startMs, Math.max(0, trackDuration - durationMs))
  return normalizeCueBounds(startMs, startMs + durationMs, trackDuration)
}

export function shiftCue(
  cue: Pick<LyricCue, 'startMs' | 'endMs'>,
  deltaMs: number,
  trackDurationMs?: number | null,
): CueBounds {
  return moveCueToStart(cue, cue.startMs + finiteInteger(deltaMs, 0), trackDurationMs)
}

export function resizeCueStart(
  cue: Pick<LyricCue, 'startMs' | 'endMs'>,
  startMs: number,
  trackDurationMs?: number | null,
): CueBounds {
  const duration = normalizeTrackDurationMs(trackDurationMs)
  const end = duration === null ? cue.endMs : Math.min(cue.endMs, duration)
  const start = Math.min(finiteInteger(startMs, cue.startMs), end - MIN_LYRIC_CUE_DURATION_MS)
  return normalizeCueBounds(start, end, duration)
}

export function resizeCueEnd(
  cue: Pick<LyricCue, 'startMs' | 'endMs'>,
  endMs: number,
  trackDurationMs?: number | null,
): CueBounds {
  return normalizeCueBounds(cue.startMs, finiteInteger(endMs, cue.endMs), trackDurationMs)
}

function nearest(value: number, candidates: readonly number[]): number {
  let result = value
  let distance = Number.POSITIVE_INFINITY
  for (const candidate of candidates) {
    if (!Number.isFinite(candidate)) continue
    const nextDistance = Math.abs(candidate - value)
    if (nextDistance < distance) {
      result = candidate
      distance = nextDistance
    }
  }
  return result
}

function subdividedBeatGrid(beatGridMs: readonly number[], divisions: 1 | 2 | 4): number[] {
  const beats = [...new Set(beatGridMs.filter(Number.isFinite).map(Math.round))].sort((a, b) => a - b)
  if (divisions === 1 || beats.length < 2) return beats
  const result: number[] = []
  for (let index = 0; index < beats.length - 1; index += 1) {
    const start = beats[index]
    const interval = beats[index + 1] - start
    for (let division = 0; division < divisions; division += 1) {
      result.push(Math.round(start + (interval * division) / divisions))
    }
  }
  result.push(beats[beats.length - 1])
  return [...new Set(result)]
}

export function canUseSnapMode(mode: LyricSnapMode, context: Omit<LyricSnapContext, 'mode'>): boolean {
  if (mode === 'beat' || mode === 'half-beat' || mode === 'quarter-beat') {
    return (context.beatGridMs?.filter(Number.isFinite).length ?? 0) >= 2
  }
  if (mode === 'word') return (context.wordBoundaryMs?.filter(Number.isFinite).length ?? 0) > 0
  return true
}

export function snapTimeMs(valueMs: number, context: LyricSnapContext): number {
  const value = Math.max(0, finiteInteger(valueMs, 0))
  switch (context.mode) {
    case 'none':
      return value
    case 'millisecond': {
      const grid = Math.max(1, finiteInteger(context.millisecondGridMs ?? 10, 10))
      return Math.round(value / grid) * grid
    }
    case 'frame': {
      const frameRate = Number.isFinite(context.frameRate) && (context.frameRate ?? 0) > 0
        ? context.frameRate!
        : 30
      const frameMs = 1000 / frameRate
      return Math.round(Math.round(value / frameMs) * frameMs)
    }
    case 'beat':
      return canUseSnapMode('beat', context)
        ? Math.round(nearest(value, subdividedBeatGrid(context.beatGridMs ?? [], 1)))
        : value
    case 'half-beat':
      return canUseSnapMode('half-beat', context)
        ? Math.round(nearest(value, subdividedBeatGrid(context.beatGridMs ?? [], 2)))
        : value
    case 'quarter-beat':
      return canUseSnapMode('quarter-beat', context)
        ? Math.round(nearest(value, subdividedBeatGrid(context.beatGridMs ?? [], 4)))
        : value
    case 'word':
      return canUseSnapMode('word', context)
        ? Math.round(nearest(value, context.wordBoundaryMs ?? []))
        : value
  }
}

export function cueWordBoundaries(cue?: Pick<LyricCue, 'words'> | null): number[] {
  if (!cue?.words) return []
  return [...new Set(cue.words.flatMap(word => [word.startMs, word.endMs]).filter(Number.isFinite).map(Math.round))]
    .sort((a, b) => a - b)
}

export function findCueOverlaps(cues: readonly LyricCue[]): Map<string, string[]> {
  const overlaps = new Map<string, string[]>()
  const ordered = [...cues].sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs)
  for (let left = 0; left < ordered.length; left += 1) {
    for (let right = left + 1; right < ordered.length; right += 1) {
      const a = ordered[left]
      const b = ordered[right]
      if (b.startMs >= a.endMs) break
      if (a.startMs < b.endMs && b.startMs < a.endMs) {
        overlaps.set(a.id, [...(overlaps.get(a.id) ?? []), b.id])
        overlaps.set(b.id, [...(overlaps.get(b.id) ?? []), a.id])
      }
    }
  }
  return overlaps
}

export function validateWordTiming(cue: Pick<LyricCue, 'startMs' | 'endMs' | 'words'>): {
  validWords: LyricWord[]
  invalidWords: LyricWord[]
} {
  const validWords: LyricWord[] = []
  const invalidWords: LyricWord[] = []
  for (const word of cue.words ?? []) {
    const valid = Number.isFinite(word.startMs)
      && Number.isFinite(word.endMs)
      && word.startMs >= cue.startMs
      && word.endMs <= cue.endMs
      && word.endMs > word.startMs
    ;(valid ? validWords : invalidWords).push(word)
  }
  return { validWords, invalidWords }
}

export function getCueIssues(
  cue: LyricCue,
  cues: readonly LyricCue[],
  trackDurationMs?: number | null,
): LyricCueIssue[] {
  const issues: LyricCueIssue[] = []
  const duration = normalizeTrackDurationMs(trackDurationMs)
  if (!Number.isFinite(cue.startMs) || cue.startMs < 0) {
    issues.push({ code: 'invalid_start', cueId: cue.id, message: 'Start time must be a finite value at or after 0 ms.' })
  }
  if (!Number.isFinite(cue.endMs)) {
    issues.push({ code: 'invalid_end', cueId: cue.id, message: 'End time must be a finite value.' })
  } else if (cue.endMs <= cue.startMs) {
    issues.push({ code: 'zero_length', cueId: cue.id, message: 'End time must be later than start time.' })
  }
  if (duration !== null && (cue.startMs >= duration || cue.endMs > duration)) {
    issues.push({ code: 'outside_track', cueId: cue.id, message: 'Cue timing extends beyond the known track duration.' })
  }
  if (!cue.text.trim()) issues.push({ code: 'empty_text', cueId: cue.id, message: 'Cue text is empty.' })
  if (cue.confidence !== undefined && (!Number.isFinite(cue.confidence) || cue.confidence < 0 || cue.confidence > 1)) {
    issues.push({ code: 'invalid_confidence', cueId: cue.id, message: 'Confidence must be between 0 and 1.' })
  }

  for (const relatedCueId of findCueOverlaps(cues).get(cue.id) ?? []) {
    const relatedCue = cues.find(candidate => candidate.id === relatedCueId)
    if (isIntentionalCueOverlap(cue) || (relatedCue && isIntentionalCueOverlap(relatedCue))) continue
    issues.push({
      code: 'overlap',
      cueId: cue.id,
      relatedCueId,
      message: 'Cue overlaps another cue without an intentional-overlap marker.',
    })
  }

  const { invalidWords } = validateWordTiming(cue)
  for (const word of invalidWords) {
    const timingFinite = Number.isFinite(word.startMs) && Number.isFinite(word.endMs) && word.endMs > word.startMs
    issues.push({
      code: timingFinite ? 'word_outside_cue' : 'invalid_word_timing',
      cueId: cue.id,
      wordId: word.id,
      message: timingFinite ? `Word “${word.text}” falls outside the cue.` : `Word “${word.text}” has invalid timing.`,
    })
  }
  return issues
}

function cloneWithId(cue: LyricCue, id: string, sourceWords = cue.words): LyricCue {
  const wordIdMap = new Map<string, string>()
  const words = sourceWords?.map(word => {
    const wordId = `${id}-${word.id}`
    wordIdMap.set(word.id, wordId)
    return { ...word, id: wordId }
  })
  const groups = cue.groups
    ?.map(group => ({
      ...group,
      id: `${id}-${group.id}`,
      wordIds: group.wordIds.flatMap(wordId => {
        const mapped = wordIdMap.get(wordId)
        return mapped ? [mapped] : []
      }),
    }))
    .filter(group => group.wordIds.length > 0)

  return {
    ...cue,
    id,
    words: words?.length ? words : undefined,
    groups: groups?.length ? groups : undefined,
  }
}

export function duplicateCue(
  cue: LyricCue,
  id: string,
  trackDurationMs?: number | null,
): LyricCue {
  const duration = cue.endMs - cue.startMs
  const bounds = moveCueToStart(cue, cue.endMs, trackDurationMs)
  const copy = cloneWithId(cue, id)
  return {
    ...copy,
    ...bounds,
    endMs: Math.max(bounds.startMs + MIN_LYRIC_CUE_DURATION_MS, Math.min(bounds.endMs, bounds.startMs + duration)),
    reviewStatus: 'unreviewed',
  }
}

export function splitCue(
  cue: LyricCue,
  splitMs: number,
  leftId: string,
  rightId: string,
): [LyricCue, LyricCue] | null {
  const point = finiteInteger(splitMs, -1)
  if (point <= cue.startMs || point >= cue.endMs) return null

  const words = cue.words ?? []
  const leftWords: LyricWord[] = []
  const rightWords: LyricWord[] = []
  for (const word of words) {
    if (word.endMs <= point) {
      leftWords.push({ ...word })
    } else if (word.startMs >= point) {
      rightWords.push({ ...word })
    } else {
      const midpoint = word.startMs + (word.endMs - word.startMs) / 2
      if (midpoint <= point) {
        leftWords.push({ ...word, endMs: point })
      } else {
        rightWords.push({ ...word, startMs: point })
      }
    }
  }
  const tokens = cue.text.trim().split(/\s+/)
  const textSplit = Math.max(1, Math.min(tokens.length - 1, leftWords.length || Math.ceil(tokens.length / 2)))
  const leftText = tokens.length > 1 ? tokens.slice(0, textSplit).join(' ') : cue.text
  const rightText = tokens.length > 1 ? tokens.slice(textSplit).join(' ') : cue.text
  const left = cloneWithId(cue, leftId, leftWords)
  const right = cloneWithId(cue, rightId, rightWords)

  return [
    { ...left, endMs: point, text: leftText },
    { ...right, startMs: point, text: rightText },
  ]
}

export function mergeCues(primary: LyricCue, secondary: LyricCue, id = primary.id): LyricCue {
  const confidences = [primary.confidence, secondary.confidence].filter(
    (value): value is number => value !== undefined && Number.isFinite(value),
  )
  const warnings = [...new Set([...(primary.warnings ?? []), ...(secondary.warnings ?? [])])] as LyricWarning[]
  return {
    ...primary,
    id,
    startMs: Math.min(primary.startMs, secondary.startMs),
    endMs: Math.max(primary.endMs, secondary.endMs),
    text: [primary.text.trim(), secondary.text.trim()].filter(Boolean).join(' '),
    words: [...(primary.words ?? []), ...(secondary.words ?? [])].sort((a, b) => a.startMs - b.startMs),
    groups: [...(primary.groups ?? []), ...(secondary.groups ?? [])],
    confidence: confidences.length ? confidences.reduce((sum, value) => sum + value, 0) / confidences.length : undefined,
    warnings: warnings.length ? warnings : undefined,
    reviewStatus: primary.reviewStatus === 'reviewed' && secondary.reviewStatus === 'reviewed' ? 'reviewed' : 'unreviewed',
  }
}

export function addCueAtPlayhead(
  id: string,
  playheadMs: number,
  trackDurationMs?: number | null,
): LyricCue {
  const duration = normalizeTrackDurationMs(trackDurationMs)
  const startMs = Math.max(0, finiteInteger(playheadMs, 0))
  const endMs = duration === null
    ? startMs + DEFAULT_NEW_CUE_DURATION_MS
    : Math.min(duration, startMs + DEFAULT_NEW_CUE_DURATION_MS)
  const bounds = normalizeCueBounds(startMs, endMs, duration)
  return {
    id,
    ...bounds,
    text: '',
    source: 'manual',
    reviewStatus: 'unreviewed',
  }
}

export function sortLyricCues(cues: readonly LyricCue[]): LyricCue[] {
  return [...cues].sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs || a.id.localeCompare(b.id))
}


export interface CueLaneAssignment {
  cueId: string
  lane: number
}

export interface CueLaneLayout {
  assignments: CueLaneAssignment[]
  laneCount: number
}

/**
 * Greedy interval partitioning yields the minimum lane count for interval cues.
 * Stable sort keys make the layout deterministic across renders and saves.
 */
export function assignCueOverlapLanes(cues: readonly LyricCue[]): CueLaneLayout {
  const ordered = sortLyricCues(cues)
  const laneEndMs: number[] = []
  const assignments: CueLaneAssignment[] = []
  for (const cue of ordered) {
    let lane = laneEndMs.findIndex(endMs => endMs <= cue.startMs)
    if (lane < 0) {
      lane = laneEndMs.length
      laneEndMs.push(cue.endMs)
    } else {
      laneEndMs[lane] = cue.endMs
    }
    assignments.push({ cueId: cue.id, lane })
  }
  return { assignments, laneCount: laneEndMs.length }
}

export function isIntentionalCueOverlap(
  cue: Pick<LyricCue, 'analysisMetadata' | 'warnings'>,
): boolean {
  return cue.analysisMetadata?.intentionalOverlap === true
    || cue.analysisMetadata?.vocalRole === 'adlib'
    || cue.analysisMetadata?.vocalRole === 'double'
    || cue.analysisMetadata?.allowOverlap === true
}

export type LyricWordBoundaryEdge = 'start' | 'end'

/**
 * Resizes one word edge without changing word order or allowing inverted timing.
 * Adjacent words act as hard guards and every word remains inside its parent cue.
 */
export function resizeLyricWordBoundary(
  cue: Pick<LyricCue, 'startMs' | 'endMs' | 'words'>,
  wordId: string,
  edge: LyricWordBoundaryEdge,
  targetMs: number,
): LyricWord[] {
  const words = (cue.words ?? []).map(word => ({ ...word }))
  const index = words.findIndex(word => word.id === wordId)
  if (index < 0) return words
  const word = words[index]
  const previous = words[index - 1]
  const next = words[index + 1]
  const target = finiteInteger(targetMs, edge === 'start' ? word.startMs : word.endMs)

  if (edge === 'start') {
    const min = Math.max(cue.startMs, previous?.endMs ?? cue.startMs)
    const max = word.endMs - MIN_LYRIC_CUE_DURATION_MS
    word.startMs = Math.max(min, Math.min(max, target))
  } else {
    const min = word.startMs + MIN_LYRIC_CUE_DURATION_MS
    const max = Math.min(cue.endMs, next?.startMs ?? cue.endMs)
    word.endMs = Math.max(min, Math.min(max, target))
  }
  return words
}
