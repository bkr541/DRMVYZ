import {
  hasUsableLyricWordTiming,
  type LyricCue,
  type LyricWord,
  type TimedLyricWord,
} from '../../../types/lyrics'

export type LyricPlaybackTransitionMode = 'continuous' | 'discontinuous'

interface PreparedWordTimeline {
  words: readonly TimedLyricWord[]
  prefixMaxEndMs: readonly number[]
}

export interface PreparedLyricTimeline {
  readonly revision: number
  readonly cues: readonly LyricCue[]
  readonly prefixMaxEndMs: readonly number[]
  readonly wordsByCue: ReadonlyMap<string, PreparedWordTimeline>
  readonly invalidCueCount: number
  readonly invalidWordCount: number
}

export interface LyricPlaybackEvents {
  lineEnter: LyricCue | null
  lineExit: LyricCue | null
  wordEnter: LyricWord | null
}

export interface LyricPlaybackState {
  documentId: string | null
  sourceIdentity: string | null
  timelineRevision: number
  currentAudioMs: number
  canonicalTimeMs: number
  globalOffsetMs: number
  activeCue: LyricCue | null
  activeCueIndex: number
  previousCue: LyricCue | null
  nextCue: LyricCue | null
  cueProgress: number
  effectiveCueStartMs: number | null
  effectiveCueEndMs: number | null
  activeCueElapsedMs: number
  activeWord: LyricWord | null
  activeWordIndex: number
  wordProgress: number
  effectiveWordStartMs: number | null
  effectiveWordEndMs: number | null
  isGap: boolean
  transitionMode: LyricPlaybackTransitionMode
  events: LyricPlaybackEvents
}

export interface ResolveLyricPlaybackInput {
  timeline: PreparedLyricTimeline
  currentAudioMs: number
  globalOffsetMs?: number
  documentId?: string | null
  sourceIdentity?: string | null
  previousState?: LyricPlaybackState | null
  transitionMode?: LyricPlaybackTransitionMode
}

let timelineRevision = 0

function finiteMs(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback
}

function isValidBounds(startMs: number, endMs: number): boolean {
  return Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs
}

function prepareWords(words: readonly LyricWord[] | undefined): {
  timeline: PreparedWordTimeline
  invalidCount: number
} {
  let invalidCount = 0
  const sorted = (words ?? [])
    .map((word, originalIndex) => ({ word, originalIndex }))
    .filter(({ word }) => {
      const valid = hasUsableLyricWordTiming(word)
      if (!valid && !(word.startMs === undefined && word.endMs === undefined)) invalidCount += 1
      return valid
    })
    .map(({ word, originalIndex }) => ({ word: word as TimedLyricWord, originalIndex }))
    .sort((left, right) => (
      left.word.startMs - right.word.startMs ||
      left.word.endMs - right.word.endMs ||
      left.originalIndex - right.originalIndex
    ))
    .map(({ word }) => word)

  const prefixMaxEndMs: number[] = []
  let maxEndMs = Number.NEGATIVE_INFINITY
  for (const word of sorted) {
    maxEndMs = Math.max(maxEndMs, word.endMs)
    prefixMaxEndMs.push(maxEndMs)
  }

  return {
    timeline: { words: sorted, prefixMaxEndMs },
    invalidCount,
  }
}

/**
 * Sorts once, validates unusable bounds, and builds lookup metadata. The returned
 * object is intended to be reused for every playback frame until cues change.
 */
export function prepareLyricTimeline(cues: readonly LyricCue[]): PreparedLyricTimeline {
  let invalidCueCount = 0
  let invalidWordCount = 0
  const sorted = cues
    .map((cue, originalIndex) => ({ cue, originalIndex }))
    .filter(({ cue }) => {
      const valid = isValidBounds(cue.startMs, cue.endMs)
      if (!valid) invalidCueCount += 1
      return valid
    })
    .sort((left, right) => (
      left.cue.startMs - right.cue.startMs ||
      left.cue.endMs - right.cue.endMs ||
      left.originalIndex - right.originalIndex
    ))
    .map(({ cue }) => cue)

  const prefixMaxEndMs: number[] = []
  const wordsByCue = new Map<string, PreparedWordTimeline>()
  let maxEndMs = Number.NEGATIVE_INFINITY

  for (const cue of sorted) {
    maxEndMs = Math.max(maxEndMs, cue.endMs)
    prefixMaxEndMs.push(maxEndMs)
    const preparedWords = prepareWords(cue.words)
    invalidWordCount += preparedWords.invalidCount
    wordsByCue.set(cue.id, preparedWords.timeline)
  }

  timelineRevision += 1
  return {
    revision: timelineRevision,
    cues: sorted,
    prefixMaxEndMs,
    wordsByCue,
    invalidCueCount,
    invalidWordCount,
  }
}

/** Positive offsets move lyric boundaries later; negative offsets move them earlier. */
export function toEffectiveLyricTimeMs(canonicalTimeMs: number, globalOffsetMs: number): number {
  return finiteMs(canonicalTimeMs) + finiteMs(globalOffsetMs)
}

/** Convert an audio/playhead position into the document's canonical cue time. */
export function toCanonicalLyricTimeMs(currentAudioMs: number, globalOffsetMs: number): number {
  return finiteMs(currentAudioMs) - finiteMs(globalOffsetMs)
}

function upperBoundStart<T extends { startMs: number }>(items: readonly T[], timeMs: number): number {
  let low = 0
  let high = items.length
  while (low < high) {
    const middle = (low + high) >> 1
    if (items[middle].startMs <= timeMs) low = middle + 1
    else high = middle
  }
  return low
}

/**
 * Finds the most recently-started active item. When overlaps exist, the newer
 * cue/word takes precedence until it ends, after which an earlier long item can
 * become active again. prefixMaxEndMs prevents scanning unrelated history.
 */
function findActiveIndex<T extends { startMs: number; endMs: number }>(
  items: readonly T[],
  prefixMaxEndMs: readonly number[],
  timeMs: number,
): number {
  let index = upperBoundStart(items, timeMs) - 1
  while (index >= 0) {
    const item = items[index]
    if (item.startMs <= timeMs && timeMs < item.endMs) return index
    if (index === 0 || prefixMaxEndMs[index - 1] <= timeMs) return -1
    index -= 1
  }
  return -1
}

function progressAt(timeMs: number, startMs: number, endMs: number): number {
  const duration = endMs - startMs
  if (!(duration > 0)) return 0
  return Math.max(0, Math.min(1, (timeMs - startMs) / duration))
}

function sameCue(
  left: LyricPlaybackState | null | undefined,
  right: LyricCue | null,
  sourceIdentity: string | null,
): boolean {
  if (!left || left.sourceIdentity !== sourceIdentity) return false
  return left.activeCue?.id === right?.id
}

function sameWord(
  left: LyricPlaybackState | null | undefined,
  cue: LyricCue | null,
  word: LyricWord | null,
  sourceIdentity: string | null,
): boolean {
  if (!left || left.sourceIdentity !== sourceIdentity) return false
  return left.activeCue?.id === cue?.id && left.activeWord?.id === word?.id
}

export function resolveLyricPlayback(input: ResolveLyricPlaybackInput): LyricPlaybackState {
  const {
    timeline,
    previousState = null,
    transitionMode = 'continuous',
  } = input
  const currentAudioMs = finiteMs(input.currentAudioMs)
  const globalOffsetMs = finiteMs(input.globalOffsetMs ?? 0)
  const documentId = input.documentId ?? null
  const sourceIdentity = input.sourceIdentity ?? documentId
  const canonicalTimeMs = toCanonicalLyricTimeMs(currentAudioMs, globalOffsetMs)
  const activeCueIndex = findActiveIndex(timeline.cues, timeline.prefixMaxEndMs, canonicalTimeMs)
  const activeCue = activeCueIndex >= 0 ? timeline.cues[activeCueIndex] : null

  const insertionIndex = upperBoundStart(timeline.cues, canonicalTimeMs)
  let previousCue: LyricCue | null = null
  for (let index = insertionIndex - 1; index >= 0; index -= 1) {
    if (index !== activeCueIndex) {
      previousCue = timeline.cues[index]
      break
    }
  }
  const nextCue = timeline.cues[insertionIndex] ?? null

  let activeWord: TimedLyricWord | null = null
  let activeWordIndex = -1
  let wordProgress = 0
  let effectiveWordStartMs: number | null = null
  let effectiveWordEndMs: number | null = null

  if (activeCue) {
    const wordTimeline = timeline.wordsByCue.get(activeCue.id)
    if (wordTimeline) {
      activeWordIndex = findActiveIndex(
        wordTimeline.words,
        wordTimeline.prefixMaxEndMs,
        canonicalTimeMs,
      )
      activeWord = activeWordIndex >= 0 ? wordTimeline.words[activeWordIndex] : null
      if (activeWord) {
        wordProgress = progressAt(canonicalTimeMs, activeWord.startMs, activeWord.endMs)
        effectiveWordStartMs = toEffectiveLyricTimeMs(activeWord.startMs, globalOffsetMs)
        effectiveWordEndMs = toEffectiveLyricTimeMs(activeWord.endMs, globalOffsetMs)
      }
    }
  }

  const cueChanged = !sameCue(previousState, activeCue, sourceIdentity)
  const wordChanged = !sameWord(previousState, activeCue, activeWord, sourceIdentity)
  const lineExit = previousState && cueChanged ? previousState.activeCue : null
  const lineEnter = cueChanged ? activeCue : null
  const wordEnter = wordChanged ? activeWord : null
  const effectiveCueStartMs = activeCue
    ? toEffectiveLyricTimeMs(activeCue.startMs, globalOffsetMs)
    : null
  const effectiveCueEndMs = activeCue
    ? toEffectiveLyricTimeMs(activeCue.endMs, globalOffsetMs)
    : null

  return {
    documentId,
    sourceIdentity,
    timelineRevision: timeline.revision,
    currentAudioMs,
    canonicalTimeMs,
    globalOffsetMs,
    activeCue,
    activeCueIndex,
    previousCue,
    nextCue,
    cueProgress: activeCue ? progressAt(canonicalTimeMs, activeCue.startMs, activeCue.endMs) : 0,
    effectiveCueStartMs,
    effectiveCueEndMs,
    activeCueElapsedMs: activeCue ? Math.max(0, canonicalTimeMs - activeCue.startMs) : 0,
    activeWord,
    activeWordIndex,
    wordProgress,
    effectiveWordStartMs,
    effectiveWordEndMs,
    isGap: timeline.cues.length > 0 && activeCue === null,
    transitionMode,
    events: { lineEnter, lineExit, wordEnter },
  }
}

export const EMPTY_PREPARED_LYRIC_TIMELINE: PreparedLyricTimeline = Object.freeze({
  revision: 0,
  cues: Object.freeze([]) as readonly LyricCue[],
  prefixMaxEndMs: Object.freeze([]) as readonly number[],
  wordsByCue: new Map<string, PreparedWordTimeline>(),
  invalidCueCount: 0,
  invalidWordCount: 0,
})

export const EMPTY_LYRIC_PLAYBACK_STATE: LyricPlaybackState = Object.freeze({
  documentId: null,
  sourceIdentity: null,
  timelineRevision: 0,
  currentAudioMs: 0,
  canonicalTimeMs: 0,
  globalOffsetMs: 0,
  activeCue: null,
  activeCueIndex: -1,
  previousCue: null,
  nextCue: null,
  cueProgress: 0,
  effectiveCueStartMs: null,
  effectiveCueEndMs: null,
  activeCueElapsedMs: 0,
  activeWord: null,
  activeWordIndex: -1,
  wordProgress: 0,
  effectiveWordStartMs: null,
  effectiveWordEndMs: null,
  isGap: false,
  transitionMode: 'discontinuous',
  events: Object.freeze({ lineEnter: null, lineExit: null, wordEnter: null }),
})

export interface ActiveLyricTrackerSource {
  documentId?: string | null
  sourceIdentity?: string | null
  cues: readonly LyricCue[]
  globalOffsetMs?: number
}

export interface LegacyLyricLine {
  text: string
  startSec: number
  endSec: number
  words: ReadonlyArray<{
    text: string
    startSec: number
    endSec: number
    confidence?: number
  }>
  confidence?: number
  source?: string
}

export interface ActiveLyricState {
  playback: LyricPlaybackState
  activeLine: string | null
  activeWord: string | null
  vocalActivity: number
  phraseConfidence: number
  lyricLineProgress: number
  wordProgress: number
  wordHit: boolean
  lineEnter: boolean
  lineExit: boolean
  isGap: boolean
}

/** Stateful adapter retained for Music Intelligence, now backed by the canonical resolver. */
export class ActiveLyricTracker {
  private timeline = EMPTY_PREPARED_LYRIC_TIMELINE
  private sourceCues: readonly LyricCue[] | null = null
  private documentId: string | null = null
  private sourceIdentity: string | null = null
  private globalOffsetMs = 0
  private previousState: LyricPlaybackState | null = null
  private vocalActivityEma = 0

  setLyrics(source: ActiveLyricTrackerSource): void {
    if (source.cues !== this.sourceCues) {
      this.timeline = prepareLyricTimeline(source.cues)
      this.sourceCues = source.cues
    }
    const nextDocumentId = source.documentId ?? null
    const nextSourceIdentity = source.sourceIdentity ?? nextDocumentId
    if (this.sourceIdentity !== nextSourceIdentity) this.vocalActivityEma = 0
    this.documentId = nextDocumentId
    this.sourceIdentity = nextSourceIdentity
    this.globalOffsetMs = finiteMs(source.globalOffsetMs ?? 0)
  }

  setLines(lines: readonly LegacyLyricLine[], sourceIdentity = 'track-analysis'): void {
    const cues: LyricCue[] = lines.map((line, lineIndex) => ({
      id: `analysis-line-${lineIndex}`,
      text: line.text,
      startMs: Math.round(line.startSec * 1000),
      endMs: Math.round(line.endSec * 1000),
      confidence: line.confidence,
      source: 'transcription',
      words: line.words.map((word, wordIndex) => ({
        id: `analysis-line-${lineIndex}-word-${wordIndex}`,
        text: word.text,
        startMs: Math.round(word.startSec * 1000),
        endMs: Math.round(word.endSec * 1000),
        confidence: word.confidence,
        source: 'transcription',
      })),
    }))
    this.setLyrics({ cues, sourceIdentity, globalOffsetMs: 0 })
  }

  update(
    audioTimeSec: number,
    transitionMode: LyricPlaybackTransitionMode = 'continuous',
  ): ActiveLyricState {
    const playback = resolveLyricPlayback({
      timeline: this.timeline,
      currentAudioMs: audioTimeSec * 1000,
      globalOffsetMs: this.globalOffsetMs,
      documentId: this.documentId,
      sourceIdentity: this.sourceIdentity,
      previousState: this.previousState,
      transitionMode,
    })
    this.previousState = playback

    const inLine = playback.activeCue ? 1 : 0
    this.vocalActivityEma = 0.05 * inLine + 0.95 * this.vocalActivityEma

    return {
      playback,
      activeLine: playback.activeCue?.text ?? null,
      activeWord: playback.activeWord?.text ?? null,
      vocalActivity: Math.min(1, this.vocalActivityEma * 1.5),
      phraseConfidence: playback.activeCue?.confidence ?? 0,
      lyricLineProgress: playback.cueProgress,
      wordProgress: playback.wordProgress,
      wordHit: playback.events.wordEnter !== null,
      lineEnter: playback.events.lineEnter !== null,
      lineExit: playback.events.lineExit !== null,
      isGap: playback.isGap,
    }
  }

  getState(): LyricPlaybackState {
    return this.previousState ?? EMPTY_LYRIC_PLAYBACK_STATE
  }

  hasLyrics(): boolean {
    return this.timeline.cues.length > 0
  }

  reset(): void {
    this.previousState = null
    this.vocalActivityEma = 0
  }
}
