/**
 * Snap to BPM — unit and integration tests.
 *
 * Covers:
 * 1. isClipSnapToBpmEnabled pure helper
 * 2. shouldApplySyncFreeze — freeze only when snap is ON
 * 3. computeNativePlaybackBoundary — boundary decisions for native-speed clips
 * 4. New clip defaults (store actions)
 * 5. Duplication and lane movement preserve snapToBpm
 * 6. Session save → load round-trip (ON and OFF)
 * 7. Preset save → load round-trip
 * 8. Legacy session compat (missing field → treated as ON)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth:    { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    from:    vi.fn(),
    storage: { from: vi.fn() },
  },
  supabaseConfigured: false,
}))

vi.mock('../lib/sessionDb', () => ({
  dbCreateSession:   vi.fn().mockResolvedValue({ dbId: null, error: 'not signed in' }),
  dbUpdateSession:   vi.fn().mockResolvedValue({ error: null }),
  dbDeleteSession:   vi.fn().mockResolvedValue({ error: null }),
  loadCloudSessions: vi.fn().mockResolvedValue({ sessions: [], error: null }),
  rowToSession:      vi.fn(),
  sessionToInsert:   vi.fn(),
}))

import {
  isClipSnapToBpmEnabled,
  shouldApplySyncFreeze,
  computeNativePlaybackBoundary,
} from '../lib/timeline'
import { useVisualStore, DEFAULT_EFFECTS } from './visualStore'
import type { VzSession } from './visualStore'
import type { VzTimelineMediaClip } from '../types/timeline'

// ── Pure helper ───────────────────────────────────────────────────────────────

describe('isClipSnapToBpmEnabled', () => {
  it('returns true when snapToBpm is undefined (legacy / missing)', () => {
    expect(isClipSnapToBpmEnabled({ snapToBpm: undefined })).toBe(true)
  })

  it('returns true when snapToBpm is explicitly true', () => {
    expect(isClipSnapToBpmEnabled({ snapToBpm: true })).toBe(true)
  })

  it('returns false when snapToBpm is false', () => {
    expect(isClipSnapToBpmEnabled({ snapToBpm: false })).toBe(false)
  })
})

// ── shouldApplySyncFreeze ─────────────────────────────────────────────────────

describe('shouldApplySyncFreeze', () => {
  // Shared base clip shape for these tests
  const baseClip = {
    mediaInSec: 0,
    mediaOutSec: undefined as number | undefined,
    durationSec: 10,
    playbackMode: 'trim' as const,
  }

  it('returns false when snapToBpm is OFF, regardless of position', () => {
    // The clip is past its source length but snap is OFF — no freeze should apply
    expect(shouldApplySyncFreeze(
      { ...baseClip, snapToBpm: false },
      15, // localTimeSec beyond source
      5,  // videoDuration = 5s, source length = 5s
    )).toBe(false)
  })

  it('returns false when snapToBpm is OFF even when localTimeSec >> videoDuration', () => {
    expect(shouldApplySyncFreeze(
      { ...baseClip, snapToBpm: false },
      100,
      3,
    )).toBe(false)
  })

  it('returns true when snapToBpm is ON and localTimeSec exceeds source length (trim)', () => {
    expect(shouldApplySyncFreeze(
      { ...baseClip, snapToBpm: true },
      8,  // localTimeSec > source length (5s)
      5,
    )).toBe(true)
  })

  it('returns false when snapToBpm is ON but localTimeSec is within source (trim)', () => {
    expect(shouldApplySyncFreeze(
      { ...baseClip, snapToBpm: true },
      3,  // within the 5s source
      5,
    )).toBe(false)
  })

  it('never returns true for loop playbackMode even when snap is ON', () => {
    expect(shouldApplySyncFreeze(
      { ...baseClip, playbackMode: 'loop', snapToBpm: true },
      50, // far past source length
      5,
    )).toBe(false)
  })

  it('returns false for undefined snapToBpm (legacy → treated as ON) within source', () => {
    expect(shouldApplySyncFreeze(
      { ...baseClip, snapToBpm: undefined },
      2,
      5,
    )).toBe(false)
  })

  it('returns true for undefined snapToBpm (legacy → ON) past source length', () => {
    expect(shouldApplySyncFreeze(
      { ...baseClip, snapToBpm: undefined },
      8,
      5,
    )).toBe(true)
  })
})

// ── computeNativePlaybackBoundary ─────────────────────────────────────────────

describe('computeNativePlaybackBoundary', () => {
  it('returns null newTime and no holdAtEnd when currentTime is within range', () => {
    const result = computeNativePlaybackBoundary(3, 'trim', 0, 5)
    expect(result.newTime).toBeNull()
    expect(result.holdAtEnd).toBe(false)
  })

  it('seeks to inSec when currentTime < inSec', () => {
    const result = computeNativePlaybackBoundary(-1, 'trim', 0, 5)
    expect(result.newTime).toBe(0)
    expect(result.holdAtEnd).toBe(false)
  })

  describe('trim mode at/past outSec', () => {
    it('holds at end (newTime near outSec, holdAtEnd=true)', () => {
      const result = computeNativePlaybackBoundary(5, 'trim', 0, 5)
      expect(result.holdAtEnd).toBe(true)
      expect(result.newTime).toBeCloseTo(4.999, 2)
    })

    it('does not return holdAtEnd=false (prevents immediate replay)', () => {
      const result = computeNativePlaybackBoundary(10, 'trim', 0, 5)
      expect(result.holdAtEnd).toBe(true)
    })
  })

  describe('freeze mode at/past outSec', () => {
    it('holds at end (newTime near outSec, holdAtEnd=true)', () => {
      const result = computeNativePlaybackBoundary(5, 'freeze', 0, 5)
      expect(result.holdAtEnd).toBe(true)
      expect(result.newTime).toBeCloseTo(4.999, 2)
    })
  })

  describe('loop mode at/past outSec', () => {
    it('seeks back to inSec, holdAtEnd=false so playback continues', () => {
      const result = computeNativePlaybackBoundary(5, 'loop', 0, 5)
      expect(result.newTime).toBe(0)
      expect(result.holdAtEnd).toBe(false)
    })

    it('seeks to inSec even far past outSec', () => {
      const result = computeNativePlaybackBoundary(50, 'loop', 2, 7)
      expect(result.newTime).toBe(2)
      expect(result.holdAtEnd).toBe(false)
    })
  })

  it('respects non-zero inSec for boundary and clamp', () => {
    // currentTime in range [inSec, outSec) → no action
    const inside = computeNativePlaybackBoundary(3, 'trim', 2, 8)
    expect(inside.newTime).toBeNull()
    expect(inside.holdAtEnd).toBe(false)

    // currentTime < inSec → seek to inSec
    const below = computeNativePlaybackBoundary(1, 'trim', 2, 8)
    expect(below.newTime).toBe(2)

    // currentTime >= outSec → hold (trim)
    const past = computeNativePlaybackBoundary(8, 'trim', 2, 8)
    expect(past.holdAtEnd).toBe(true)
    expect(past.newTime).toBeGreaterThanOrEqual(2)
    expect(past.newTime!).toBeLessThan(8)
  })
})

// ── Store helpers ─────────────────────────────────────────────────────────────

function resetStore() {
  useVisualStore.setState({
    sessions:              [],
    presets:               [],
    timelineClips:         [],
    timelineOverlayClips:  [],
    timelineEffectRegions: [],
    timelineEnabled:       false,
    timelineLoop:          true,
    layerItems:            [],
    cueMarkers:            [],
    bpm:                   120,
    bpmSync:               false,
    quality:               'High',
    effects:               { ...DEFAULT_EFFECTS },
    enabledFxArr:          [],
    activeMediaId:         null,
    beatGridEnabled:       false,
  })
}

// ── New clip defaults ─────────────────────────────────────────────────────────

describe('new clip defaults', () => {
  beforeEach(resetStore)

  it('addTimelineClip sets snapToBpm: true', () => {
    useVisualStore.getState().addTimelineClip('media-1')
    const { timelineClips } = useVisualStore.getState()
    expect(timelineClips).toHaveLength(1)
    expect(timelineClips[0].snapToBpm).toBe(true)
  })

  it('addMediaClip on video-background lane sets snapToBpm: true', () => {
    useVisualStore.getState().addMediaClip('video-background', 'media-2')
    const { timelineClips } = useVisualStore.getState()
    expect(timelineClips).toHaveLength(1)
    expect(timelineClips[0].snapToBpm).toBe(true)
  })

  it('addMediaClip on overlays lane sets snapToBpm: true', () => {
    useVisualStore.getState().addMediaClip('overlays', 'media-3')
    const { timelineOverlayClips } = useVisualStore.getState()
    expect(timelineOverlayClips).toHaveLength(1)
    expect(timelineOverlayClips[0].snapToBpm).toBe(true)
  })
})

// ── Duplication preserves snapToBpm ──────────────────────────────────────────

describe('duplication preserves snapToBpm', () => {
  beforeEach(resetStore)

  it('duplicateTimelineClip preserves snapToBpm: false', () => {
    useVisualStore.getState().addTimelineClip('media-1')
    const clipId = useVisualStore.getState().timelineClips[0].id
    useVisualStore.getState().updateMediaClip(clipId, { snapToBpm: false })

    useVisualStore.getState().duplicateTimelineClip(clipId)
    const { timelineClips } = useVisualStore.getState()
    const copy = timelineClips.find(c => c.id !== clipId)
    expect(copy?.snapToBpm).toBe(false)
  })

  it('duplicateMediaClip on bg lane preserves snapToBpm: false', () => {
    useVisualStore.getState().addMediaClip('video-background', 'media-1')
    const clipId = useVisualStore.getState().timelineClips[0].id
    useVisualStore.getState().updateMediaClip(clipId, { snapToBpm: false })

    useVisualStore.getState().duplicateMediaClip(clipId)
    const { timelineClips } = useVisualStore.getState()
    const copy = timelineClips.find(c => c.id !== clipId)
    expect(copy?.snapToBpm).toBe(false)
  })

  it('duplicateMediaClip on overlays lane preserves snapToBpm: false', () => {
    useVisualStore.getState().addMediaClip('overlays', 'media-2')
    const clipId = useVisualStore.getState().timelineOverlayClips[0].id
    useVisualStore.getState().updateMediaClip(clipId, { snapToBpm: false })

    useVisualStore.getState().duplicateMediaClip(clipId)
    const { timelineOverlayClips } = useVisualStore.getState()
    const copy = timelineOverlayClips.find(c => c.id !== clipId)
    expect(copy?.snapToBpm).toBe(false)
  })
})

// ── Lane movement preserves snapToBpm ────────────────────────────────────────

describe('moveMediaClipToLane preserves snapToBpm', () => {
  beforeEach(resetStore)

  it('bg → overlay move preserves snapToBpm: false', () => {
    useVisualStore.getState().addMediaClip('video-background', 'media-1')
    const clipId = useVisualStore.getState().timelineClips[0].id
    useVisualStore.getState().updateMediaClip(clipId, { snapToBpm: false })

    useVisualStore.getState().moveMediaClipToLane(clipId, 'overlays')
    const { timelineOverlayClips } = useVisualStore.getState()
    expect(timelineOverlayClips).toHaveLength(1)
    expect(timelineOverlayClips[0].snapToBpm).toBe(false)
  })

  it('overlay → bg move preserves snapToBpm: false', () => {
    useVisualStore.getState().addMediaClip('overlays', 'media-2')
    const clipId = useVisualStore.getState().timelineOverlayClips[0].id
    useVisualStore.getState().updateMediaClip(clipId, { snapToBpm: false })

    useVisualStore.getState().moveMediaClipToLane(clipId, 'video-background')
    const { timelineClips } = useVisualStore.getState()
    expect(timelineClips).toHaveLength(1)
    expect(timelineClips[0].snapToBpm).toBe(false)
  })
})

// ── Session round-trip ────────────────────────────────────────────────────────

describe('session round-trip preserves snapToBpm', () => {
  beforeEach(resetStore)

  it('saves and restores a bg clip with snapToBpm: false', () => {
    useVisualStore.getState().addTimelineClip('media-1')
    const clipId = useVisualStore.getState().timelineClips[0].id
    useVisualStore.getState().updateMediaClip(clipId, { snapToBpm: false })

    useVisualStore.getState().saveSession('test', 'file', [])
    const sessionId = useVisualStore.getState().sessions[0].id

    // Reset then reload
    useVisualStore.setState({ timelineClips: [] })
    useVisualStore.getState().loadSession(sessionId)

    const { timelineClips } = useVisualStore.getState()
    expect(timelineClips).toHaveLength(1)
    expect(timelineClips[0].snapToBpm).toBe(false)
  })

  it('saves and restores a bg clip with snapToBpm: true', () => {
    useVisualStore.getState().addTimelineClip('media-1')
    const clipId = useVisualStore.getState().timelineClips[0].id
    useVisualStore.getState().updateMediaClip(clipId, { snapToBpm: true })

    useVisualStore.getState().saveSession('test', 'file', [])
    const sessionId = useVisualStore.getState().sessions[0].id

    useVisualStore.setState({ timelineClips: [] })
    useVisualStore.getState().loadSession(sessionId)

    const { timelineClips } = useVisualStore.getState()
    expect(timelineClips[0].snapToBpm).toBe(true)
  })

  it('mixed ON/OFF clips survive a round-trip', () => {
    useVisualStore.getState().addTimelineClip('media-A')
    useVisualStore.getState().addTimelineClip('media-B')
    const [clip1, clip2] = useVisualStore.getState().timelineClips
    useVisualStore.getState().updateMediaClip(clip1.id, { snapToBpm: true })
    useVisualStore.getState().updateMediaClip(clip2.id, { snapToBpm: false })

    useVisualStore.getState().saveSession('mixed', 'file', [])
    const sessionId = useVisualStore.getState().sessions[0].id

    useVisualStore.setState({ timelineClips: [] })
    useVisualStore.getState().loadSession(sessionId)

    const { timelineClips } = useVisualStore.getState()
    expect(timelineClips).toHaveLength(2)
    const reloaded1 = timelineClips.find(c => c.mediaId === 'media-A')
    const reloaded2 = timelineClips.find(c => c.mediaId === 'media-B')
    expect(reloaded1?.snapToBpm).toBe(true)
    expect(reloaded2?.snapToBpm).toBe(false)
  })

  it('legacy session without snapToBpm loads and behaves as ON', () => {
    // Manually inject a legacy session with no snapToBpm field
    const legacyBgClip: VzTimelineMediaClip = {
      id: 'legacy-clip',
      mediaId: 'media-legacy',
      startSec: 0, durationSec: 30,
      mediaInSec: 0, fitMode: 'cover', playbackMode: 'trim',
      lane: 'video-background',
      // snapToBpm intentionally absent
    }
    const legacySession: VzSession = {
      id: 'legacy-session',
      name: 'Legacy',
      createdAt: 0,
      source: 'local',
      activeMediaId: null,
      mediaOrder: [],
      activePresetId: 'preset-1',
      effects: { ...DEFAULT_EFFECTS },
      enabledFx: [],
      effectParams: {},
      bpm: 120,
      bpmSync: false,
      quality: 'High',
      audioSource: 'file',
      timelineEnabled: true,
      timelineClips: [legacyBgClip],
      timelineLoop: true,
      timelineOverlayClips: [],
      timelineEffectRegions: [],
      layerItems: [],
      beatGridEnabled: false,
      cueMarkers: [],
    }
    useVisualStore.setState({ sessions: [legacySession] })
    useVisualStore.getState().loadSession('legacy-session')

    const { timelineClips } = useVisualStore.getState()
    expect(timelineClips).toHaveLength(1)
    // Missing field must behave as ON
    expect(isClipSnapToBpmEnabled(timelineClips[0])).toBe(true)
  })
})

// ── Preset round-trip ─────────────────────────────────────────────────────────

describe('preset round-trip preserves snapToBpm', () => {
  beforeEach(resetStore)

  it('preset save/load preserves snapToBpm: false on bg clip', () => {
    useVisualStore.getState().addTimelineClip('media-1')
    const clipId = useVisualStore.getState().timelineClips[0].id
    useVisualStore.getState().updateMediaClip(clipId, { snapToBpm: false })
    useVisualStore.setState({ timelineEnabled: true })

    useVisualStore.getState().savePreset('Test Preset', {
      scope: { timeline: true, effects: true, enabledFx: true },
    })
    const allPresets = useVisualStore.getState().presets
    const presetId = allPresets[allPresets.length - 1].id

    // Clear then restore via preset
    useVisualStore.setState({ timelineClips: [] })
    useVisualStore.getState().selectPreset(presetId)

    const { timelineClips } = useVisualStore.getState()
    expect(timelineClips).toHaveLength(1)
    expect(timelineClips[0].snapToBpm).toBe(false)
  })
})
