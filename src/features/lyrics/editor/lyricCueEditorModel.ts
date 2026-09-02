import {
  hasFiniteLyricWordTiming,
  hasUsableLyricWordTiming,
  getSafeLyricGroupWordIds,
  type LyricCue,
  type LyricGroup,
  type LyricWarning,
  type LyricWord,
} from '../../../types/lyrics'

export const MIN_LYRIC_CUE_DURATION_MS = 1
export const DEFAULT_NEW_CUE_DURATION_MS = 2_000
export const LOW_LYRIC_CONFIDENCE = 0.7

/**
 * Deterministic width for a repaired word that has no bounded gap to
 * interpolate into (a one-sided neighbour, or a degenerate gap). Consecutive
 * repaired words chain off each other, so they still get ordered,
 * non-identical ranges. Kept small so an appended repair rarely needs to push
 * the destination cue's bounds outward by much.
 */
export const GENERATED_WORD_MIN_DURATION_MS = 60

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
  words?: LyricWord[]
}

export function retainLyricGroupsForWords(
  groups: readonly LyricGroup[] | undefined,
  words: readonly Pick<LyricWord, 'id'>[],
): LyricGroup[] | undefined {
  if (!groups?.length) return undefined
  const wordIds = new Set(words.map(word => word.id))
  const next = groups
    .flatMap(group => {
      if (typeof group !== 'object' || group === null || Array.isArray(group)) return []
      const nextWordIds = getSafeLyricGroupWordIds(group).filter(wordId => wordIds.has(wordId))
      return nextWordIds.length > 0 ? [{ ...group, wordIds: nextWordIds }] : []
    })
  return next.length > 0 ? next : undefined
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
  cue: Pick<LyricCue, 'startMs' | 'endMs' | 'words'>,
  targetStartMs: number,
  trackDurationMs?: number | null,
): CueBounds {
  const durationMs = Math.max(MIN_LYRIC_CUE_DURATION_MS, cue.endMs - cue.startMs)
  const trackDuration = normalizeTrackDurationMs(trackDurationMs)
  let startMs = Math.max(0, finiteInteger(targetStartMs, cue.startMs))
  if (trackDuration !== null) startMs = Math.min(startMs, Math.max(0, trackDuration - durationMs))
  const bounds = normalizeCueBounds(startMs, startMs + durationMs, trackDuration)
  const appliedDeltaMs = bounds.startMs - cue.startMs
  return {
    ...bounds,
    ...(cue.words
      ? {
          words: cue.words.map(word => hasFiniteLyricWordTiming(word)
            ? {
                ...word,
                startMs: word.startMs + appliedDeltaMs,
                endMs: word.endMs + appliedDeltaMs,
              }
            : { ...word }),
        }
      : {}),
  }
}

export function shiftCue(
  cue: Pick<LyricCue, 'startMs' | 'endMs' | 'words'>,
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
  return [...new Set(cue.words
    .filter(hasUsableLyricWordTiming)
    .flatMap(word => [word.startMs, word.endMs])
    .map(Math.round))]
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
  untimedWords: LyricWord[]
} {
  const validWords: LyricWord[] = []
  const invalidWords: LyricWord[] = []
  const untimedWords: LyricWord[] = []
  for (const word of cue.words ?? []) {
    if (word.startMs === undefined && word.endMs === undefined) {
      untimedWords.push(word)
      continue
    }
    const valid = hasUsableLyricWordTiming(word)
      && word.startMs >= cue.startMs
      && word.endMs <= cue.endMs
    ;(valid ? validWords : invalidWords).push(word)
  }
  return { validWords, invalidWords, untimedWords }
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

  const { invalidWords, untimedWords } = validateWordTiming(cue)
  for (const word of invalidWords) {
    const timingFinite = hasUsableLyricWordTiming(word)
    issues.push({
      code: timingFinite ? 'word_outside_cue' : 'invalid_word_timing',
      cueId: cue.id,
      wordId: word.id,
      message: timingFinite ? `Word “${word.text}” falls outside the cue.` : `Word “${word.text}” has invalid timing.`,
    })
  }
  // Untimed words are a repair-required state, not a healthy one — surface
  // them with the same code so a bypassed/legacy document never validates as
  // clean while carrying words that normalization should have retimed.
  for (const word of untimedWords) {
    issues.push({
      code: 'invalid_word_timing',
      cueId: cue.id,
      wordId: word.id,
      message: `Word “${word.text}” has no timing.`,
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
    ?.flatMap((group, groupIndex) => {
      if (typeof group !== 'object' || group === null || Array.isArray(group)) return []
      const groupId = typeof group.id === 'string' && group.id.trim()
        ? group.id.trim()
        : `group_${String(groupIndex + 1).padStart(3, '0')}`
      const wordIds = getSafeLyricGroupWordIds(group).flatMap(wordId => {
        const mapped = wordIdMap.get(wordId)
        return mapped ? [mapped] : []
      })
      return wordIds.length > 0 ? [{ ...group, id: `${id}-${groupId}`, wordIds }] : []
    })

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
  const movePatch = moveCueToStart(cue, cue.endMs, trackDurationMs)
  const copy = cloneWithId({ ...cue, ...movePatch }, id)
  return {
    ...copy,
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
  const tokens = cue.text.trim().split(/\s+/)

  const timedWordSide = (word: LyricWord & { startMs: number; endMs: number }): 'left' | 'right' => {
    if (word.endMs <= point) return 'left'
    if (word.startMs >= point) return 'right'
    const midpoint = word.startMs + (word.endMs - word.startMs) / 2
    return midpoint <= point ? 'left' : 'right'
  }

  // Text split still follows how many usable-timed words land on the left.
  let leftTimedCount = 0
  for (const word of words) {
    if (hasUsableLyricWordTiming(word) && timedWordSide(word) === 'left') leftTimedCount += 1
  }
  const textSplit = Math.max(1, Math.min(tokens.length - 1, leftTimedCount || Math.ceil(tokens.length / 2)))

  // Words that carry no usable timing are assigned by their stable source
  // order against the same proportional boundary — never all dumped left —
  // then given real timing by normalization below.
  const untimedBoundary = tokens.length > 1
    ? Math.round(words.length * (textSplit / tokens.length))
    : Math.ceil(words.length / 2)

  const leftWords: LyricWord[] = []
  const rightWords: LyricWord[] = []
  words.forEach((word, index) => {
    if (!hasUsableLyricWordTiming(word)) {
      ;(index < untimedBoundary ? leftWords : rightWords).push({ ...word })
      return
    }
    const side = timedWordSide(word)
    if (side === 'left') leftWords.push(word.endMs <= point ? { ...word } : { ...word, endMs: point })
    else rightWords.push(word.startMs >= point ? { ...word } : { ...word, startMs: point })
  })

  const leftText = tokens.length > 1 ? tokens.slice(0, textSplit).join(' ') : cue.text
  const rightText = tokens.length > 1 ? tokens.slice(textSplit).join(' ') : cue.text
  const left = cloneWithId(cue, leftId, leftWords)
  const right = cloneWithId(cue, rightId, rightWords)

  const pair: [LyricCue, LyricCue] = [
    { ...left, endMs: point, text: leftText },
    { ...right, startMs: point, text: rightText },
  ]
  return hasRepairableWordTiming(pair)
    ? (normalizeLyricCueTiming(pair).cues as [LyricCue, LyricCue])
    : pair
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
    words: [...(primary.words ?? []), ...(secondary.words ?? [])].sort((a, b) => {
      const aStart = hasUsableLyricWordTiming(a) ? a.startMs : Number.POSITIVE_INFINITY
      const bStart = hasUsableLyricWordTiming(b) ? b.startMs : Number.POSITIVE_INFINITY
      return aStart - bStart
    }),
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

// ── Canonical word-timing normalization ──────────────────────────────────────
//
// A usable Lyric Manager document contains no untimed words and no invalid
// word timing. When extraction / import / legacy load / editor recovery
// produces a word without usable timing, it is rolled into the nearest
// eligible cue (ties → left / prior), given deterministic generated timing,
// and the destination cue's bounds are expanded to contain it. This is the
// single deterministic repair used at every canonical ingestion boundary.

export interface LyricTimingNormalizationResult {
  cues: LyricCue[]
  /** Words that received freshly generated timing. */
  repairedWordCount: number
  /** Words that changed cue ownership as part of the repair. */
  movedWordCount: number
  /**
   * True when the document has lyric words but no usable cue timing or timed
   * word anywhere to anchor a repair against. Callers must surface this
   * through the existing validation/error path — text is never discarded.
   */
  unrepairable: boolean
}

/** Fast check so healthy documents skip the full normalization pass. */
export function hasRepairableWordTiming(cues: readonly LyricCue[]): boolean {
  return cues.some(cue => (cue.words ?? []).some(word => !hasUsableLyricWordTiming(word)))
}

function cueBoundsEligible(cue: LyricCue | undefined): boolean {
  return !!cue
    && Number.isFinite(cue.startMs)
    && Number.isFinite(cue.endMs)
    && cue.endMs > cue.startMs
}

export function normalizeLyricCueTiming(
  cues: readonly LyricCue[],
  trackDurationMs?: number | null,
): LyricTimingNormalizationResult {
  const work: LyricCue[] = cues.map(cue => ({
    ...cue,
    words: cue.words ? cue.words.map(word => ({ ...word })) : undefined,
    groups: cue.groups ? cue.groups.map(group => ({ ...group })) : undefined,
  }))

  if (!hasRepairableWordTiming(work)) {
    return { cues: work, repairedWordCount: 0, movedWordCount: 0, unrepairable: false }
  }

  // Pass 1 — expand every cue's bounds around its own usable-timed words so a
  // cue that carries any valid word becomes an eligible destination.
  for (const cue of work) {
    for (const word of cue.words ?? []) {
      if (!hasUsableLyricWordTiming(word)) continue
      cue.startMs = Number.isFinite(cue.startMs) ? Math.min(cue.startMs, word.startMs) : word.startMs
      cue.endMs = Number.isFinite(cue.endMs) ? Math.max(cue.endMs, word.endMs) : word.endMs
    }
  }

  const anyEligibleCue = work.some(cueBoundsEligible)
  const anyTimedWord = work.some(cue => (cue.words ?? []).some(hasUsableLyricWordTiming))
  if (!anyEligibleCue && !anyTimedWord) {
    return { cues: work, repairedWordCount: 0, movedWordCount: 0, unrepairable: true }
  }

  // Document-order positions of usable-timed words — the deterministic context
  // used to pick a side for a word that carries no finite anchor at all.
  const timedWordPositions: number[] = []
  {
    let position = 0
    for (const cue of work) {
      for (const word of cue.words ?? []) {
        if (hasUsableLyricWordTiming(word)) timedWordPositions.push(position)
        position += 1
      }
    }
  }

  interface RepairTarget { cueIndex: number; wordId: string; anchorMs: number | null; position: number }
  const targets: RepairTarget[] = []
  {
    let position = 0
    work.forEach((cue, cueIndex) => {
      for (const word of cue.words ?? []) {
        if (!hasUsableLyricWordTiming(word)) {
          const anchorMs = Number.isFinite(word.startMs as number)
            ? (word.startMs as number)
            : Number.isFinite(word.endMs as number)
              ? (word.endMs as number)
              : null
          targets.push({ cueIndex, wordId: word.id, anchorMs, position })
        }
        position += 1
      }
    })
  }

  const nearestEligibleCue = (fromIndex: number, direction: -1 | 1): number | null => {
    for (let index = fromIndex; index >= 0 && index < work.length; index += direction) {
      if (cueBoundsEligible(work[index])) return index
    }
    return null
  }

  let repairedWordCount = 0
  let movedWordCount = 0

  for (const target of targets) {
    const sourceIndex = target.cueIndex
    const sourceCue = work[sourceIndex]
    const wordIndex = (sourceCue.words ?? []).findIndex(candidate => candidate.id === target.wordId)
    if (wordIndex < 0) continue
    const word = sourceCue.words![wordIndex]

    const leftCue = nearestEligibleCue(sourceIndex, -1)
    const rightCue = nearestEligibleCue(sourceIndex, 1)

    let destIndex: number
    if (leftCue === sourceIndex || rightCue === sourceIndex) {
      destIndex = sourceIndex
    } else if (leftCue === null && rightCue === null) {
      destIndex = sourceIndex
    } else if (leftCue === null) {
      destIndex = rightCue!
    } else if (rightCue === null) {
      destIndex = leftCue
    } else {
      let distanceLeft: number
      let distanceRight: number
      if (target.anchorMs !== null) {
        distanceLeft = Math.abs(target.anchorMs - work[leftCue].endMs)
        distanceRight = Math.abs(target.anchorMs - work[rightCue].startMs)
      } else {
        const leftContext = timedWordPositions.filter(position => position < target.position).pop()
        const rightContext = timedWordPositions.find(position => position > target.position)
        distanceLeft = leftContext === undefined ? Number.POSITIVE_INFINITY : target.position - leftContext
        distanceRight = rightContext === undefined ? Number.POSITIVE_INFINITY : rightContext - target.position
      }
      // Ties, ambiguity, or "no provable side" all resolve to the left / prior cue.
      destIndex = distanceLeft <= distanceRight ? leftCue : rightCue
    }

    sourceCue.words!.splice(wordIndex, 1)
    if (sourceCue.words!.length === 0) sourceCue.words = undefined

    const destCue = work[destIndex]
    if (!destCue.words) destCue.words = []
    const insertAt = destIndex === sourceIndex
      ? Math.min(wordIndex, destCue.words.length)
      : destIndex < sourceIndex
        ? destCue.words.length
        : 0
    destCue.words.splice(insertAt, 0, word)
    if (destIndex !== sourceIndex) {
      movedWordCount += 1
      // Ownership changed: the source cue's groups stop referencing this word.
      // A word retimed inside its own cue keeps its group membership.
      sourceCue.groups = retainLyricGroupsForWords(sourceCue.groups, sourceCue.words ?? [])
    }

    // Generate timing between the nearest usable-timed neighbours in the
    // destination cue. Consecutive repairs chain off each other.
    const placedIndex = destCue.words.findIndex(candidate => candidate.id === word.id)
    let previousEndMs: number | null = null
    for (let index = placedIndex - 1; index >= 0; index -= 1) {
      const neighbour = destCue.words[index]
      if (hasUsableLyricWordTiming(neighbour)) { previousEndMs = neighbour.endMs; break }
    }
    let nextStartMs: number | null = null
    for (let index = placedIndex + 1; index < destCue.words.length; index += 1) {
      const neighbour = destCue.words[index]
      if (hasUsableLyricWordTiming(neighbour)) { nextStartMs = neighbour.startMs; break }
    }
    const lowerMs = previousEndMs ?? (Number.isFinite(destCue.startMs) ? destCue.startMs : 0)
    const upperMs = nextStartMs ?? (Number.isFinite(destCue.endMs)
      ? destCue.endMs
      : lowerMs + GENERATED_WORD_MIN_DURATION_MS)

    let startMs = Math.round(lowerMs)
    let endMs: number
    const gapMs = upperMs - lowerMs
    if (nextStartMs !== null && gapMs >= 2 * MIN_LYRIC_CUE_DURATION_MS) {
      endMs = Math.round(lowerMs + Math.min(GENERATED_WORD_MIN_DURATION_MS, Math.max(MIN_LYRIC_CUE_DURATION_MS, gapMs / 2)))
    } else {
      endMs = startMs + GENERATED_WORD_MIN_DURATION_MS
    }
    if (endMs <= startMs) endMs = startMs + MIN_LYRIC_CUE_DURATION_MS
    word.startMs = startMs
    word.endMs = endMs
    repairedWordCount += 1

    destCue.startMs = Math.min(Number.isFinite(destCue.startMs) ? destCue.startMs : startMs, startMs)
    destCue.endMs = Math.max(Number.isFinite(destCue.endMs) ? destCue.endMs : endMs, endMs)
  }

  const normalized = work.map(cue => ({ ...cue, ...normalizeCueBounds(cue.startMs, cue.endMs, trackDurationMs) }))
  return { cues: normalized, repairedWordCount, movedWordCount, unrepairable: false }
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
  if (!hasUsableLyricWordTiming(word)) return words
  const previous = words[index - 1]
  const next = words[index + 1]
  const previousEndMs = previous && hasUsableLyricWordTiming(previous) ? previous.endMs : cue.startMs
  const nextStartMs = next && hasUsableLyricWordTiming(next) ? next.startMs : cue.endMs
  const target = finiteInteger(targetMs, edge === 'start' ? word.startMs : word.endMs)

  if (edge === 'start') {
    const min = Math.max(cue.startMs, previousEndMs)
    const max = word.endMs - MIN_LYRIC_CUE_DURATION_MS
    word.startMs = Math.max(min, Math.min(max, target))
  } else {
    const min = word.startMs + MIN_LYRIC_CUE_DURATION_MS
    const max = Math.min(cue.endMs, nextStartMs)
    word.endMs = Math.max(min, Math.min(max, target))
  }
  return words
}
