import type {
  SoundDrawingLyricGapBehavior,
  SoundDrawingTextSource,
} from '../../../components/vyzualz/react/ReactTypes'
import { hasUsableLyricWordTiming } from '../../../types/lyrics'
import type { LyricPlaybackState } from './lyricPlaybackResolver'

export interface SoundDrawingTextResolutionInput {
  textSource?: SoundDrawingTextSource
  staticText: string
  gapBehavior?: SoundDrawingLyricGapBehavior
  fallbackText?: string
}

export type SoundDrawingLyricTextStatus =
  | 'static'
  | 'activeLine'
  | 'activeWord'
  | 'wordLineFallback'
  | 'gapHidden'
  | 'gapPrevious'
  | 'gapFallback'
  | 'noLyrics'

export interface SoundDrawingResolvedText {
  text: string
  visible: boolean
  status: SoundDrawingLyricTextStatus
  sourceIdentity: string | null
  documentId: string | null
  cueId: string | null
  wordId: string | null
  currentLine: string | null
  currentWord: string | null
  geometryIdentity: string
}

export interface SoundDrawingPreviousTextState {
  text: string
  visible: boolean
  sourceIdentity: string | null
  documentId: string | null
  cueId: string | null
  wordId: string | null
}

function normalizedSource(value: SoundDrawingTextSource | undefined): SoundDrawingTextSource {
  return value === 'activeLyricLine' || value === 'activeLyricWord' ? value : 'static'
}

function normalizedGapBehavior(
  value: SoundDrawingLyricGapBehavior | undefined,
): SoundDrawingLyricGapBehavior {
  return value === 'keepPrevious' || value === 'fallback' ? value : 'hide'
}

function resolution(
  text: string,
  visible: boolean,
  status: SoundDrawingLyricTextStatus,
  playback: LyricPlaybackState,
  cueId: string | null,
  wordId: string | null,
): SoundDrawingResolvedText {
  return {
    text,
    visible: visible && text.trim().length > 0,
    status,
    sourceIdentity: playback.sourceIdentity,
    documentId: playback.documentId,
    cueId,
    wordId,
    currentLine: playback.activeCue?.text ?? null,
    currentWord: playback.activeWord?.text ?? null,
    geometryIdentity: [
      playback.sourceIdentity ?? 'none',
      playback.documentId ?? 'none',
      cueId ?? 'none',
      wordId ?? 'none',
      text,
    ].join(':'),
  }
}

function cueHasTimedWords(playback: LyricPlaybackState): boolean {
  return Boolean(playback.activeCue?.words?.some(hasUsableLyricWordTiming))
}

/**
 * Adapts the canonical Patch 7 playback result for Sound Drawing. This module
 * never searches cue arrays or invents timings. activeLyricWord falls back to
 * the active line only when the cue has no usable timed words at all.
 */
export function resolveSoundDrawingLyricText(
  input: SoundDrawingTextResolutionInput,
  playback: LyricPlaybackState,
  previous: SoundDrawingPreviousTextState | null = null,
): SoundDrawingResolvedText {
  const textSource = normalizedSource(input.textSource)
  if (textSource === 'static') {
    return resolution(input.staticText, true, 'static', playback, null, null)
  }

  // A lyric source is valid only when the canonical runtime is tied to a real
  // document. This blocks a loading/draft source identity from retaining text
  // belonging to the previously loaded track.
  if (!playback.documentId) {
    return resolution('', false, 'noLyrics', playback, null, null)
  }

  if (textSource === 'activeLyricLine' && playback.activeCue) {
    return resolution(
      playback.activeCue.text,
      true,
      'activeLine',
      playback,
      playback.activeCue.id,
      null,
    )
  }

  if (textSource === 'activeLyricWord' && playback.activeCue) {
    if (playback.activeWord) {
      return resolution(
        playback.activeWord.text,
        true,
        'activeWord',
        playback,
        playback.activeCue.id,
        playback.activeWord.id,
      )
    }

    // Practical fallback for line-timed documents: show the canonical cue text.
    // When timed words do exist, an inter-word gap remains a real gap.
    if (!cueHasTimedWords(playback)) {
      return resolution(
        playback.activeCue.text,
        true,
        'wordLineFallback',
        playback,
        playback.activeCue.id,
        null,
      )
    }
  }

  const gapBehavior = normalizedGapBehavior(input.gapBehavior)
  if (gapBehavior === 'keepPrevious' &&
      previous?.visible &&
      previous.sourceIdentity !== null &&
      previous.sourceIdentity === playback.sourceIdentity &&
      previous.documentId === playback.documentId
  ) {
    return resolution(
      previous.text,
      true,
      'gapPrevious',
      playback,
      previous.cueId,
      previous.wordId,
    )
  }

  if (gapBehavior === 'fallback') {
    return resolution(
      input.fallbackText ?? '',
      true,
      'gapFallback',
      playback,
      null,
      null,
    )
  }

  return resolution('', false, 'gapHidden', playback, null, null)
}

export function toSoundDrawingPreviousTextState(
  resolved: SoundDrawingResolvedText,
): SoundDrawingPreviousTextState {
  return {
    text: resolved.text,
    visible: resolved.visible,
    sourceIdentity: resolved.sourceIdentity,
    documentId: resolved.documentId,
    cueId: resolved.cueId,
    wordId: resolved.wordId,
  }
}

/**
 * Small bounded state holder for gap=keepPrevious. It is keyed by renderer
 * surface/layer, and automatically loses stale text when document identity
 * changes because the pure resolver validates the previous source identity.
 */
export class SoundDrawingLyricTextRuntime {
  private readonly previousByKey = new Map<string, SoundDrawingPreviousTextState>()

  constructor(private readonly maxEntries = 64) {}

  resolve(
    key: string,
    input: SoundDrawingTextResolutionInput,
    playback: LyricPlaybackState,
  ): SoundDrawingResolvedText {
    const resolved = resolveSoundDrawingLyricText(
      input,
      playback,
      this.previousByKey.get(key) ?? null,
    )

    this.previousByKey.delete(key)
    this.previousByKey.set(key, toSoundDrawingPreviousTextState(resolved))
    while (this.previousByKey.size > this.maxEntries) {
      const oldest = this.previousByKey.keys().next().value
      if (oldest === undefined) break
      this.previousByKey.delete(oldest)
    }
    return resolved
  }

  delete(key: string): void {
    this.previousByKey.delete(key)
  }

  clear(): void {
    this.previousByKey.clear()
  }

  get size(): number {
    return this.previousByKey.size
  }
}
