import { describe, expect, it } from 'vitest'
import { restorePreviewPlaybackPosition } from './MediaPreviewModal'

describe('MediaPreviewModal expiry recovery', () => {
  it('preserves playback position after a signed URL is replaced', () => {
    const video = { currentTime: 0, duration: 120 }
    expect(restorePreviewPlaybackPosition(video, 47.25)).toBe(true)
    expect(video.currentTime).toBe(47.25)
  })

  it('clamps a recovered position to the replacement asset duration', () => {
    const video = { currentTime: 0, duration: 30 }
    expect(restorePreviewPlaybackPosition(video, 47.25)).toBe(true)
    expect(video.currentTime).toBe(30)
  })

  it('does not seek for invalid or zero positions', () => {
    const video = { currentTime: 8, duration: 30 }
    expect(restorePreviewPlaybackPosition(video, Number.NaN)).toBe(false)
    expect(restorePreviewPlaybackPosition(video, 0)).toBe(false)
    expect(video.currentTime).toBe(8)
  })
})
