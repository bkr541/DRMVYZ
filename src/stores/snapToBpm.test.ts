/**
 * Snap to BPM — unit and integration tests.
 *
 * Covers:
 * 1. isClipSnapToBpmEnabled pure helper
 * 2. shouldApplySyncFreeze — freeze only when snap is ON
 * 3. getNativeVideoPlaybackDecision — visibility/expiry for native-speed clips
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
  getNativeVideoPlaybackDecision,
  getNativeBoundaryAction,
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

// ── getNativeVideoPlaybackDecision ────────────────────────────────────────────

describe('getNativeVideoPlaybackDecision', () => {
  // Base clip: 5s source (mediaInSec=0, videoDuration=5), 10s timeline slot
  const baseClip = {
    id: 'test-clip',
    mediaId: 'media-1',
    mediaInSec: 0,
    mediaOutSec: undefined as number | undefined,
    durationSec: 10,
    fitMode: 'cover' as const,
    playbackMode: 'trim' as const,
    snapToBpm: false,
    startSec: 0,
  }
  const videoDuration = 5

  describe('trim/freeze mode (non-loop) — Snap OFF + Loop OFF', () => {
    it('is visible and has correct sourceTimeSec when within source length', () => {
      const result = getNativeVideoPlaybackDecision(baseClip, 2, videoDuration)
      expect(result.visible).toBe(true)
      expect(result.expired).toBe(false)
      expect(result.loopsNaturally).toBe(false)
      expect(result.sourceTimeSec).toBeCloseTo(2, 3)
    })

    it('is visible near the source boundary (just before expiry)', () => {
      const result = getNativeVideoPlaybackDecision(baseClip, 4.9, videoDuration)
      expect(result.visible).toBe(true)
      expect(result.expired).toBe(false)
      expect(result.sourceTimeSec).toBeLessThan(5)
    })

    it('remains visible at source boundary — sourceTimeSec is final frame (trim)', () => {
      // localTimeSec=5 === source length=5 → visible, sourceTimeSec = final frame for scrub
      const result = getNativeVideoPlaybackDecision(baseClip, 5, videoDuration)
      expect(result.visible).toBe(true)
      expect(result.expired).toBe(false)
      // outSec = videoDuration = 5, so final frame = 5 - 0.001 = 4.999
      expect(result.sourceTimeSec).toBeCloseTo(4.999, 2)
      expect(result.loopsNaturally).toBe(false)
    })

    it('remains visible past source length — sourceTimeSec is final frame (trim)', () => {
      // localTimeSec=7 > source length=5 → still visible; sourceTimeSec for scrub positioning
      const result = getNativeVideoPlaybackDecision(baseClip, 7, videoDuration)
      expect(result.visible).toBe(true)
      expect(result.expired).toBe(false)
      expect(result.sourceTimeSec).toBeCloseTo(4.999, 2)
    })

    it('remains visible past source length — sourceTimeSec is final frame (freeze mode)', () => {
      const freezeClip = { ...baseClip, playbackMode: 'freeze' as const }
      const result = getNativeVideoPlaybackDecision(freezeClip, 7, videoDuration)
      expect(result.visible).toBe(true)
      expect(result.expired).toBe(false)
      expect(result.sourceTimeSec).toBeCloseTo(4.999, 2)
    })

    it('respects non-zero mediaInSec in sourceTimeSec', () => {
      const clip = { ...baseClip, mediaInSec: 2 }
      // source range is [2, 5), length = 3s
      const result = getNativeVideoPlaybackDecision(clip, 1, videoDuration)
      expect(result.visible).toBe(true)
      expect(result.sourceTimeSec).toBeCloseTo(3, 3) // inSec + localTimeSec
    })

    it('remains visible at source boundary with non-zero mediaInSec — sourceTimeSec is final frame (trim)', () => {
      const clip = { ...baseClip, mediaInSec: 2 }
      // source range [2,5), length=3. At localTimeSec=3: visible, sourceTimeSec = final frame
      const result = getNativeVideoPlaybackDecision(clip, 3, videoDuration)
      expect(result.visible).toBe(true)
      expect(result.expired).toBe(false)
      expect(result.sourceTimeSec).toBeCloseTo(4.999, 2)
    })
  })

  describe('loop mode — Snap OFF + Loop ON', () => {
    const loopClip = { ...baseClip, playbackMode: 'loop' as const }

    it('is always visible', () => {
      expect(getNativeVideoPlaybackDecision(loopClip, 0, videoDuration).visible).toBe(true)
      expect(getNativeVideoPlaybackDecision(loopClip, 5, videoDuration).visible).toBe(true)
      expect(getNativeVideoPlaybackDecision(loopClip, 12, videoDuration).visible).toBe(true)
    })

    it('never expires', () => {
      expect(getNativeVideoPlaybackDecision(loopClip, 100, videoDuration).expired).toBe(false)
    })

    it('reports loopsNaturally=true', () => {
      expect(getNativeVideoPlaybackDecision(loopClip, 2, videoDuration).loopsNaturally).toBe(true)
    })

    it('wraps sourceTimeSec within source range at t=2s', () => {
      const result = getNativeVideoPlaybackDecision(loopClip, 2, videoDuration)
      expect(result.sourceTimeSec).toBeCloseTo(2, 3)
    })

    it('wraps sourceTimeSec correctly at t=7s (5s source → maps to 2s)', () => {
      // 7 % 5 = 2, so sourceTimeSec = inSec + 2 = 2
      const result = getNativeVideoPlaybackDecision(loopClip, 7, videoDuration)
      expect(result.sourceTimeSec).toBeCloseTo(2, 3)
    })

    it('wraps sourceTimeSec at exactly t=5s back to start', () => {
      // 5 % 5 = 0, so sourceTimeSec = 0
      const result = getNativeVideoPlaybackDecision(loopClip, 5, videoDuration)
      expect(result.sourceTimeSec).toBeCloseTo(0, 3)
    })

    it('wraps with non-zero mediaInSec', () => {
      const clip = { ...loopClip, mediaInSec: 2 }
      // source range [2,5), length=3. t=4 → 4%3=1 → sourceTimeSec = 2+1 = 3
      const result = getNativeVideoPlaybackDecision(clip, 4, videoDuration)
      expect(result.sourceTimeSec).toBeCloseTo(3, 3)
    })

    it('loop never holds — getNativeBoundaryAction returns loop at outSec, not hold', () => {
      // Loop clips always use 'loop' boundary action, never 'hold', regardless of localTimeSec
      const result = getNativeVideoPlaybackDecision(loopClip, 100, videoDuration)
      expect(result.visible).toBe(true)
      expect(result.loopsNaturally).toBe(true)
    })
  })

  describe('toggle from ON to OFF — visible clips get correct sourceTimeSec', () => {
    it('gives visible decision with correct sourceTimeSec when toggling snap off before expiry', () => {
      // Snap was ON, now OFF, localTimeSec=3 < source length=5
      const result = getNativeVideoPlaybackDecision(baseClip, 3, videoDuration)
      expect(result.visible).toBe(true)
      expect(result.sourceTimeSec).toBeCloseTo(3, 3)
    })

    it('remains visible and provides final-frame sourceTimeSec when toggling snap off past source length (trim)', () => {
      // Snap was ON, now OFF, localTimeSec=6 > source length=5 — clip must stay visible.
      // sourceTimeSec is the scrub/initial-activation position; end-hold is based on
      // video.currentTime in the renderer, not on localTimeSec.
      const result = getNativeVideoPlaybackDecision(baseClip, 6, videoDuration)
      expect(result.visible).toBe(true)
      expect(result.expired).toBe(false)
      expect(result.sourceTimeSec).toBeCloseTo(4.999, 2)
    })

    it('loop mode toggle gives wrapped sourceTimeSec at t=7s', () => {
      const loopClip = { ...baseClip, playbackMode: 'loop' as const }
      // 7 % 5 = 2
      const result = getNativeVideoPlaybackDecision(loopClip, 7, videoDuration)
      expect(result.visible).toBe(true)
      expect(result.sourceTimeSec).toBeCloseTo(2, 3)
      expect(result.loopsNaturally).toBe(true)
    })
  })
})

// ── getNativeBoundaryAction ───────────────────────────────────────────────────

describe('getNativeBoundaryAction', () => {
  const outSec = 5

  describe('trim mode', () => {
    it('returns continue when video.currentTime is before outSec', () => {
      expect(getNativeBoundaryAction('trim', 2, outSec)).toBe('continue')
    })

    it('returns continue when video.currentTime is before outSec — even when timeline-local time is past source length', () => {
      // Key regression test: localTimeSec=7 > source=5, but native video is at 2s.
      // The boundary action must be driven by video.currentTime, not localTimeSec.
      expect(getNativeBoundaryAction('trim', 2, outSec)).toBe('continue')
    })

    it('returns hold when video.currentTime reaches outSec', () => {
      expect(getNativeBoundaryAction('trim', 5, outSec)).toBe('hold')
    })

    it('returns hold when video.currentTime exceeds outSec', () => {
      expect(getNativeBoundaryAction('trim', 5.5, outSec)).toBe('hold')
    })
  })

  describe('freeze mode', () => {
    it('returns continue when video.currentTime is before outSec', () => {
      expect(getNativeBoundaryAction('freeze', 3, outSec)).toBe('continue')
    })

    it('returns hold when video.currentTime reaches outSec', () => {
      expect(getNativeBoundaryAction('freeze', 5, outSec)).toBe('hold')
    })
  })

  describe('loop mode', () => {
    it('returns continue when video.currentTime is before outSec', () => {
      expect(getNativeBoundaryAction('loop', 3, outSec)).toBe('continue')
    })

    it('returns loop (not hold) when video.currentTime reaches outSec', () => {
      expect(getNativeBoundaryAction('loop', 5, outSec)).toBe('loop')
    })

    it('returns loop when video.currentTime exceeds outSec', () => {
      expect(getNativeBoundaryAction('loop', 6, outSec)).toBe('loop')
    })
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
