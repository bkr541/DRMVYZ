import {
  EMPTY_LYRIC_PLAYBACK_STATE,
  type LyricPlaybackState,
} from './lyricPlaybackResolver'

type LyricPlaybackListener = () => void

let currentState = EMPTY_LYRIC_PLAYBACK_STATE
const listeners = new Set<LyricPlaybackListener>()

export const LyricPlaybackBus = {
  getState(): LyricPlaybackState {
    return currentState
  },

  setState(state: LyricPlaybackState): void {
    currentState = state
    listeners.forEach(listener => listener())
  },

  subscribe(listener: LyricPlaybackListener): () => void {
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  },

  reset(): void {
    currentState = EMPTY_LYRIC_PLAYBACK_STATE
    listeners.forEach(listener => listener())
  },
} as const
