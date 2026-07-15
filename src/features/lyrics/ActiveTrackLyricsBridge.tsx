import { useEffect, useRef } from 'react'
import { useSharedAudio } from '../../context/AudioEngineContext'
import { useLyricsStore } from '../../stores/lyricsStore'
import { musicIntelligenceEngine } from '../musicIntelligence/MusicIntelligenceEngine'

interface ActiveTrackLyricsActions {
  resolveRuntimeLyricsForAudioTrack(audioTrackId: string, force?: boolean, preserveEditor?: boolean): Promise<void>
  clearRuntimeLyrics(preserveEditor?: boolean): void
}

export interface ActiveTrackLyricsSynchronizer {
  sync(audioTrackId: string | null, force?: boolean, preserveEditor?: boolean): void
}

/**
 * Stateful adapter shared by the React bridge and unit tests. Runtime lyric
 * resolution is keyed only by the persisted audio_tracks ID, never by a local
 * blob URL, filename, or temporary playlist identity.
 */
export function createActiveTrackLyricsSynchronizer(
  actions: ActiveTrackLyricsActions,
): ActiveTrackLyricsSynchronizer {
  let lastAudioTrackId: string | null | undefined

  return {
    sync(audioTrackId, force = false, preserveEditor = false) {
      if (!force && audioTrackId === lastAudioTrackId) return
      lastAudioTrackId = audioTrackId
      if (audioTrackId) {
        void actions.resolveRuntimeLyricsForAudioTrack(audioTrackId, force, preserveEditor)
      } else {
        actions.clearRuntimeLyrics(preserveEditor)
      }
    },
  }
}

/** Mounted once under AudioEngineProvider. No visual surface owns lyric loading. */
export function ActiveTrackLyricsBridge() {
  const { currentAudioTrackId, getCurrentTime } = useSharedAudio()
  const editorSessionActive = useLyricsStore(state => state.editorSessionActive)
  const synchronizerRef = useRef<ActiveTrackLyricsSynchronizer | null>(null)
  const wasSuspendedRef = useRef(false)

  if (!synchronizerRef.current) {
    synchronizerRef.current = createActiveTrackLyricsSynchronizer({
      resolveRuntimeLyricsForAudioTrack: (audioTrackId, force, preserveEditor) =>
        useLyricsStore.getState().resolveRuntimeLyricsForAudioTrack(audioTrackId, force, preserveEditor),
      clearRuntimeLyrics: (preserveEditor) => useLyricsStore.getState().clearRuntimeLyrics('idle', preserveEditor),
    })
  }

  useEffect(() => {
    let previousCues = useLyricsStore.getState().runtimeCues
    let previousDocumentId = useLyricsStore.getState().runtimeActiveDocumentId
    let previousAudioTrackId = useLyricsStore.getState().runtimeAudioTrackId
    let previousOffsetMs = useLyricsStore.getState().runtimeGlobalOffsetMs

    const syncPlaybackSource = (state: ReturnType<typeof useLyricsStore.getState>, force = false) => {
      if (!force
        && state.runtimeCues === previousCues
        && state.runtimeActiveDocumentId === previousDocumentId
        && state.runtimeAudioTrackId === previousAudioTrackId
        && state.runtimeGlobalOffsetMs === previousOffsetMs
      ) return

      previousCues = state.runtimeCues
      previousDocumentId = state.runtimeActiveDocumentId
      previousAudioTrackId = state.runtimeAudioTrackId
      previousOffsetMs = state.runtimeGlobalOffsetMs

      musicIntelligenceEngine.setActiveLyrics({
        documentId: state.runtimeActiveDocumentId,
        sourceIdentity: `${state.runtimeAudioTrackId ?? 'unbound'}:${state.runtimeActiveDocumentId ?? 'none'}`,
        cues: state.runtimeCues,
        globalOffsetMs: state.runtimeGlobalOffsetMs,
      })
      musicIntelligenceEngine.resolveLyricsAt(getCurrentTime(), 'discontinuous')
    }

    syncPlaybackSource(useLyricsStore.getState(), true)
    return useLyricsStore.subscribe(state => syncPlaybackSource(state))
  }, [getCurrentTime])

  useEffect(() => {
    if (editorSessionActive) {
      wasSuspendedRef.current = true
      return
    }

    const force = wasSuspendedRef.current
    wasSuspendedRef.current = false
    if (force && useLyricsStore.getState().skipNextEditorResync) {
      useLyricsStore.setState({ skipNextEditorResync: false })
      synchronizerRef.current?.sync(currentAudioTrackId, true, true)
      return
    }
    synchronizerRef.current?.sync(currentAudioTrackId, force)
  }, [currentAudioTrackId, editorSessionActive])

  return null
}
