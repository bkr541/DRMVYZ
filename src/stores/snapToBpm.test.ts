/**
 * Snap to BPM — unit and integration tests.
 *
 * Covers:
 * 1. isClipSnapToBpmEnabled pure helper
 * 2. New clip defaults (store actions)
 * 3. Duplication and lane movement preserve snapToBpm
 * 4. Session save → load round-trip (ON and OFF)
 * 5. Preset save → load round-trip
 * 6. Legacy session compat (missing field → treated as ON)
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

import { isClipSnapToBpmEnabled } from '../lib/timeline'
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
