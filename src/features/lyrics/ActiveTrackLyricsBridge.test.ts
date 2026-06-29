import { describe, expect, it, vi } from 'vitest'
import { createActiveTrackLyricsSynchronizer } from './ActiveTrackLyricsBridge'

describe('ActiveTrackLyricsSynchronizer', () => {
  it('loads only when the permanent track ID changes and clears on unload', () => {
    const loadLyricsForAudioTrack = vi.fn().mockResolvedValue(undefined)
    const clearLyrics = vi.fn()
    const synchronizer = createActiveTrackLyricsSynchronizer({
      loadLyricsForAudioTrack,
      clearLyrics,
    })

    // Initial provider render with no persisted track must not erase a local draft.
    synchronizer.sync(null)
    synchronizer.sync('track-a')
    synchronizer.sync('track-a')
    synchronizer.sync('track-b')
    synchronizer.sync(null)
    synchronizer.sync(null)

    expect(loadLyricsForAudioTrack).toHaveBeenNthCalledWith(1, 'track-a', false)
    expect(loadLyricsForAudioTrack).toHaveBeenNthCalledWith(2, 'track-b', false)
    expect(loadLyricsForAudioTrack).toHaveBeenCalledTimes(2)
    expect(clearLyrics).toHaveBeenCalledTimes(1)
  })

  it('can force a refresh after the Lyric Manager releases a suspended editor session', () => {
    const loadLyricsForAudioTrack = vi.fn().mockResolvedValue(undefined)
    const clearLyrics = vi.fn()
    const synchronizer = createActiveTrackLyricsSynchronizer({ loadLyricsForAudioTrack, clearLyrics })

    synchronizer.sync('track-a')
    synchronizer.sync('track-a')
    synchronizer.sync('track-a', true)

    expect(loadLyricsForAudioTrack).toHaveBeenCalledTimes(2)
    expect(loadLyricsForAudioTrack).toHaveBeenLastCalledWith('track-a', true)
  })
})
