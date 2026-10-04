import { useEffect, useRef } from 'react'
import { useSharedAudio } from '../../context/AudioEngineContext'
import { resolveEffectiveRuntimeLyrics, useLyricsStore } from '../../stores/lyricsStore'
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
    // The engine consumes the effective runtime lyrics: a temporary preview version if one exists, else the persisted active version.
    let previous = resolveEffectiveRuntimeLyrics(useLyricsStore.getState())

    const syncPlaybackSource = (state: ReturnType<typeof useLyricsStore.getState>, force = false) => {
      const next = resolveEffectiveRuntimeLyrics(state)
      if (!force
        && next.cues === previous.cues
        && next.documentId === previous.documentId
        && next.audioTrackId === previous.audioTrackId
        && next.globalOffsetMs === previous.globalOffsetMs
        && next.isPreview === previous.isPreview
      ) return

      previous = next

      musicIntelligenceEngine.setActiveLyrics({
        documentId: next.documentId,
        sourceIdentity: `${next.audioTrackId ?? 'unbound'}:${next.documentId ?? 'none'}${next.isPreview ? ':preview' : ''}`,
        cues: next.cues,
        globalOffsetMs: next.globalOffsetMs,
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
