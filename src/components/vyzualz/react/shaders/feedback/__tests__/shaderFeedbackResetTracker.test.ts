import { describe, expect, it } from 'vitest'
import { ShaderFeedbackResetTracker } from '../ShaderFeedbackResetTracker'

const baseSignals = {
  sceneId: 'shader-reactor',
  trackId: 'track-a',
  playbackTime: 10,
  sectionType: 'verse',
  dropImpact: 0,
  w: 1280,
  h: 720,
}

describe('ShaderFeedbackResetTracker', () => {
  it('detects activation, track, playback, section, and resolution lifecycle changes', () => {
    const tracker = new ShaderFeedbackResetTracker()
    expect(tracker.update(baseSignals)).toBe(true)
    expect(tracker.update(baseSignals)).toBe(false)
    expect(tracker.update({ ...baseSignals, trackId: 'track-b' })).toBe(true)
    expect(tracker.update({ ...baseSignals, trackId: 'track-b', playbackTime: 2 })).toBe(true)
    expect(tracker.update({ ...baseSignals, trackId: 'track-b', playbackTime: 3, sectionType: 'drop' }, {
      onSectionChange: true,
    })).toBe(true)
    expect(tracker.update({
      ...baseSignals,
      trackId: 'track-b',
      playbackTime: 4,
      sectionType: 'drop',
      w: 1920,
      h: 1080,
    })).toBe(true)
  })

  it('resets on the drop threshold edge, not every frame of a sustained envelope', () => {
    const tracker = new ShaderFeedbackResetTracker()
    const config = {
      onSceneChange: false,
      onTrackChange: false,
      onPlaybackRestart: false,
      onResolutionChange: false,
      onDropImpact: true,
      dropImpactThreshold: 0.7,
    }

    tracker.update(baseSignals, config)
    expect(tracker.update({ ...baseSignals, dropImpact: 0.9 }, config)).toBe(true)
    expect(tracker.update({ ...baseSignals, dropImpact: 0.95 }, config)).toBe(false)
    expect(tracker.update({ ...baseSignals, dropImpact: 0.2 }, config)).toBe(false)
    expect(tracker.update({ ...baseSignals, dropImpact: 0.85 }, config)).toBe(true)
  })
})
