import { useEffect, useRef } from 'react'
import { useSharedAudio } from '../../context/AudioEngineContext'
import { useLyricsStore } from '../../stores/lyricsStore'

interface ActiveTrackLyricsActions {
  loadLyricsForAudioTrack(audioTrackId: string): Promise<void>
  clearLyrics(): void
}

export interface ActiveTrackLyricsSynchronizer {
  sync(audioTrackId: string | null): void
}

/**
 * Small stateful adapter shared by the React bridge and unit tests. It prevents
 * provider re-renders from reissuing the same lookup. The store independently
 * deduplicates too, which also protects React StrictMode remounts.
 */
export function createActiveTrackLyricsSynchronizer(
  actions: ActiveTrackLyricsActions,
): ActiveTrackLyricsSynchronizer {
  let lastAudioTrackId: string | null | undefined

  return {
    sync(audioTrackId) {
      if (audioTrackId === lastAudioTrackId) return

      // A provider mount with no active persisted track is not a track change.
      // Leaving the store untouched protects an unsaved local Lyric Manager draft.
      if (lastAudioTrackId === undefined && audioTrackId === null) {
        lastAudioTrackId = null
        return
      }

      lastAudioTrackId = audioTrackId
      if (audioTrackId) {
        void actions.loadLyricsForAudioTrack(audioTrackId)
      } else {
        actions.clearLyrics()
      }
    },
  }
}

/** Mounted once under AudioEngineProvider. No visual surface owns lyric loading. */
export function ActiveTrackLyricsBridge() {
  const { currentAudioTrackId } = useSharedAudio()
  const synchronizerRef = useRef<ActiveTrackLyricsSynchronizer | null>(null)

  if (!synchronizerRef.current) {
    synchronizerRef.current = createActiveTrackLyricsSynchronizer({
      loadLyricsForAudioTrack: audioTrackId =>
        useLyricsStore.getState().loadLyricsForAudioTrack(audioTrackId),
      clearLyrics: () => useLyricsStore.getState().clearLyrics(),
    })
  }

  useEffect(() => {
    synchronizerRef.current?.sync(currentAudioTrackId)
  }, [currentAudioTrackId])

  return null
}
