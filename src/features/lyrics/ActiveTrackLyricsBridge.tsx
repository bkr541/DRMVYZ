import { useEffect, useRef } from 'react'
import { useSharedAudio } from '../../context/AudioEngineContext'
import { useLyricsStore } from '../../stores/lyricsStore'

interface ActiveTrackLyricsActions {
  loadLyricsForAudioTrack(audioTrackId: string, force?: boolean): Promise<void>
  clearLyrics(): void
}

export interface ActiveTrackLyricsSynchronizer {
  sync(audioTrackId: string | null, force?: boolean): void
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
    sync(audioTrackId, force = false) {
      if (!force && audioTrackId === lastAudioTrackId) return

      // A provider mount with no active persisted track is not a track change.
      // Leaving the store untouched protects an unsaved local Lyric Manager draft.
      if (!force && lastAudioTrackId === undefined && audioTrackId === null) {
        lastAudioTrackId = null
        return
      }

      lastAudioTrackId = audioTrackId
      if (audioTrackId) {
        void actions.loadLyricsForAudioTrack(audioTrackId, force)
      } else {
        actions.clearLyrics()
      }
    },
  }
}

/** Mounted once under AudioEngineProvider. No visual surface owns lyric loading. */
export function ActiveTrackLyricsBridge() {
  const { currentAudioTrackId } = useSharedAudio()
  const editorSessionActive = useLyricsStore(state => state.editorSessionActive)
  const synchronizerRef = useRef<ActiveTrackLyricsSynchronizer | null>(null)
  const wasSuspendedRef = useRef(false)

  if (!synchronizerRef.current) {
    synchronizerRef.current = createActiveTrackLyricsSynchronizer({
      loadLyricsForAudioTrack: (audioTrackId, force) =>
        useLyricsStore.getState().loadLyricsForAudioTrack(audioTrackId, force),
      clearLyrics: () => useLyricsStore.getState().clearLyrics(),
    })
  }

  useEffect(() => {
    if (editorSessionActive) {
      wasSuspendedRef.current = true
      return
    }

    const force = wasSuspendedRef.current
    wasSuspendedRef.current = false
    if (force && useLyricsStore.getState().skipNextEditorResync) {
      useLyricsStore.setState({ skipNextEditorResync: false })
      return
    }
    synchronizerRef.current?.sync(currentAudioTrackId, force)
  }, [currentAudioTrackId, editorSessionActive])

  return null
}
