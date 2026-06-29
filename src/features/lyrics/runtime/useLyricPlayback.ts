import { useSyncExternalStore } from 'react'
import type { LyricCue, LyricWord } from '../../../types/lyrics'
import { LyricPlaybackBus } from './LyricPlaybackBus'
import type { LyricPlaybackState } from './lyricPlaybackResolver'

export type LyricPlaybackSelector<T> = (state: LyricPlaybackState) => T

export function useLyricPlaybackSelector<T>(selector: LyricPlaybackSelector<T>): T {
  return useSyncExternalStore(
    LyricPlaybackBus.subscribe,
    () => selector(LyricPlaybackBus.getState()),
    () => selector(LyricPlaybackBus.getState()),
  )
}

export const selectCurrentLyricCue = (state: LyricPlaybackState): LyricCue | null => state.activeCue
export const selectCurrentLyricText = (state: LyricPlaybackState): string | null => state.activeCue?.text ?? null
export const selectCurrentLyricWord = (state: LyricPlaybackState): LyricWord | null => state.activeWord
export const selectLyricCueProgress = (state: LyricPlaybackState): number => state.cueProgress
export const selectLyricWordProgress = (state: LyricPlaybackState): number => state.wordProgress
export const selectNextLyricCue = (state: LyricPlaybackState): LyricCue | null => state.nextCue
export const selectIsLyricGap = (state: LyricPlaybackState): boolean => state.isGap

export function useCurrentLyricCue(): LyricCue | null {
  return useLyricPlaybackSelector(selectCurrentLyricCue)
}

export function useCurrentLyricText(): string | null {
  return useLyricPlaybackSelector(selectCurrentLyricText)
}

export function useCurrentLyricWord(): LyricWord | null {
  return useLyricPlaybackSelector(selectCurrentLyricWord)
}

export function useLyricCueProgress(): number {
  return useLyricPlaybackSelector(selectLyricCueProgress)
}

export function useLyricWordProgress(): number {
  return useLyricPlaybackSelector(selectLyricWordProgress)
}

export function useNextLyricCue(): LyricCue | null {
  return useLyricPlaybackSelector(selectNextLyricCue)
}

export function useIsLyricGap(): boolean {
  return useLyricPlaybackSelector(selectIsLyricGap)
}
