import { describe, expect, it, vi } from 'vitest'
import { createActiveTrackLyricsSynchronizer } from './ActiveTrackLyricsBridge'

describe('ActiveTrackLyricsSynchronizer', () => {
  it('loads only when the permanent track ID changes and clears on unload', () => {
    const resolveRuntimeLyricsForAudioTrack = vi.fn().mockResolvedValue(undefined)
    const clearRuntimeLyrics = vi.fn()
    const synchronizer = createActiveTrackLyricsSynchronizer({
      resolveRuntimeLyricsForAudioTrack,
      clearRuntimeLyrics,
    })

    // Initial provider render with no persisted track clears any stale runtime source without touching the editor draft.
    synchronizer.sync(null)
    synchronizer.sync('track-a')
    synchronizer.sync('track-a')
    synchronizer.sync('track-b')
    synchronizer.sync(null)
    synchronizer.sync(null)

    expect(resolveRuntimeLyricsForAudioTrack).toHaveBeenNthCalledWith(1, 'track-a', false, false)
    expect(resolveRuntimeLyricsForAudioTrack).toHaveBeenNthCalledWith(2, 'track-b', false, false)
    expect(resolveRuntimeLyricsForAudioTrack).toHaveBeenCalledTimes(2)
    expect(clearRuntimeLyrics).toHaveBeenCalledTimes(2)
  })

  it('can force a refresh after the Lyric Manager releases a suspended editor session', () => {
    const resolveRuntimeLyricsForAudioTrack = vi.fn().mockResolvedValue(undefined)
    const clearRuntimeLyrics = vi.fn()
    const synchronizer = createActiveTrackLyricsSynchronizer({ resolveRuntimeLyricsForAudioTrack, clearRuntimeLyrics })

    synchronizer.sync('track-a')
    synchronizer.sync('track-a')
    synchronizer.sync('track-a', true)

    expect(resolveRuntimeLyricsForAudioTrack).toHaveBeenCalledTimes(2)
    expect(resolveRuntimeLyricsForAudioTrack).toHaveBeenLastCalledWith('track-a', true, false)

    synchronizer.sync('track-a', true, true)
    expect(resolveRuntimeLyricsForAudioTrack).toHaveBeenLastCalledWith('track-a', true, true)
  })
})
