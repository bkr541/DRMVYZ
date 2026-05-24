/**
 * Color grade store integration tests.
 *
 * Covers:
 * 1. masterDimmer clamping
 * 2. colorGradePreviewBypass set/get
 * 3. Clip duplication preserves colorGrade
 * 4. moveMediaClipToLane preserves colorGrade
 * 5. Layer item updateLayerItem stores colorGrade
 * 6. masterDimmer survives session round-trip
 * 7. colorGradePreviewBypass not in persisted state
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

import { useVisualStore, DEFAULT_EFFECTS } from './visualStore'
import { DEFAULT_COLOR_GRADE } from '../types/vzColorGrade'
import type { VzColorGrade } from '../types/vzColorGrade'

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
    masterDimmer:          0,
    colorGradePreviewBypass: false,
  })
}

const customGrade = (): VzColorGrade => ({
  ...DEFAULT_COLOR_GRADE,
  brightness: 12,
  contrast: 24,
  saturation: -8,
  temperature: 18,
})

// ── masterDimmer ──────────────────────────────────────────────────────────────

describe('masterDimmer', () => {
  beforeEach(resetStore)

  it('clamps values above 1 to 1', () => {
    useVisualStore.getState().setMasterDimmer(5)
    expect(useVisualStore.getState().masterDimmer).toBe(1)
  })

  it('clamps negative values to 0', () => {
    useVisualStore.getState().setMasterDimmer(-0.5)
    expect(useVisualStore.getState().masterDimmer).toBe(0)
  })

  it('passes through in-range values', () => {
    useVisualStore.getState().setMasterDimmer(0.4)
    expect(useVisualStore.getState().masterDimmer).toBeCloseTo(0.4)
  })
})

// ── colorGradePreviewBypass ────────────────────────────────────────────────────

describe('colorGradePreviewBypass', () => {
  beforeEach(resetStore)

  it('sets and clears', () => {
    useVisualStore.getState().setColorGradePreviewBypass(true)
    expect(useVisualStore.getState().colorGradePreviewBypass).toBe(true)
    useVisualStore.getState().setColorGradePreviewBypass(false)
    expect(useVisualStore.getState().colorGradePreviewBypass).toBe(false)
  })
})

// ── colorGrade preserved across clip operations ────────────────────────────────

describe('clip operations preserve colorGrade', () => {
  beforeEach(resetStore)

  it('duplicateTimelineClip preserves colorGrade', () => {
    useVisualStore.getState().addTimelineClip('media-1')
    const clipId = useVisualStore.getState().timelineClips[0].id
    const cg = customGrade()
    useVisualStore.getState().updateMediaClip(clipId, { colorGrade: cg })

    useVisualStore.getState().duplicateTimelineClip(clipId)
    const copy = useVisualStore.getState().timelineClips.find(c => c.id !== clipId)
    expect(copy?.colorGrade).toEqual(cg)
  })

  it('duplicateMediaClip on overlays lane preserves colorGrade', () => {
    useVisualStore.getState().addMediaClip('overlays', 'media-2')
    const clipId = useVisualStore.getState().timelineOverlayClips[0].id
    const cg = customGrade()
    useVisualStore.getState().updateMediaClip(clipId, { colorGrade: cg })

    useVisualStore.getState().duplicateMediaClip(clipId)
    const copy = useVisualStore.getState().timelineOverlayClips.find(c => c.id !== clipId)
    expect(copy?.colorGrade).toEqual(cg)
  })

  it('moveMediaClipToLane (bg → overlay) preserves colorGrade', () => {
    useVisualStore.getState().addMediaClip('video-background', 'media-1')
    const clipId = useVisualStore.getState().timelineClips[0].id
    const cg = customGrade()
    useVisualStore.getState().updateMediaClip(clipId, { colorGrade: cg })

    useVisualStore.getState().moveMediaClipToLane(clipId, 'overlays')
    const moved = useVisualStore.getState().timelineOverlayClips[0]
    expect(moved.colorGrade).toEqual(cg)
  })

  it('moveMediaClipToLane (overlay → bg) preserves colorGrade', () => {
    useVisualStore.getState().addMediaClip('overlays', 'media-2')
    const clipId = useVisualStore.getState().timelineOverlayClips[0].id
    const cg = customGrade()
    useVisualStore.getState().updateMediaClip(clipId, { colorGrade: cg })

    useVisualStore.getState().moveMediaClipToLane(clipId, 'video-background')
    const moved = useVisualStore.getState().timelineClips[0]
    expect(moved.colorGrade).toEqual(cg)
  })
})

// ── layer items ────────────────────────────────────────────────────────────────

describe('layer item colorGrade', () => {
  beforeEach(resetStore)

  it('updateLayerItem stores colorGrade', () => {
    useVisualStore.getState().addLayerItem('media-li', 'character')
    const itemId = useVisualStore.getState().layerItems[0].id
    const cg = customGrade()
    useVisualStore.getState().updateLayerItem(itemId, { colorGrade: cg })
    expect(useVisualStore.getState().layerItems[0].colorGrade).toEqual(cg)
  })
})

// ── session round-trip ─────────────────────────────────────────────────────────

describe('session round-trip', () => {
  beforeEach(resetStore)

  it('masterDimmer survives save → load', () => {
    useVisualStore.getState().setMasterDimmer(0.6)
    useVisualStore.getState().saveSession('test', 'file', [])
    const sessionId = useVisualStore.getState().sessions[0].id

    useVisualStore.setState({ masterDimmer: 0 })
    useVisualStore.getState().loadSession(sessionId)
    expect(useVisualStore.getState().masterDimmer).toBeCloseTo(0.6)
  })

  it('bg clip colorGrade survives save → load', () => {
    useVisualStore.getState().addTimelineClip('media-1')
    const clipId = useVisualStore.getState().timelineClips[0].id
    const cg = customGrade()
    useVisualStore.getState().updateMediaClip(clipId, { colorGrade: cg })

    useVisualStore.getState().saveSession('test', 'file', [])
    const sessionId = useVisualStore.getState().sessions[0].id

    useVisualStore.setState({ timelineClips: [] })
    useVisualStore.getState().loadSession(sessionId)
    expect(useVisualStore.getState().timelineClips[0].colorGrade).toEqual(cg)
  })
})

// ── ephemeral preview state ──────────────────────────────────────────────────────

describe('colorGradePreviewBypass is ephemeral (never persisted to sessions)', () => {
  beforeEach(resetStore)

  it('is not captured by saveSession and is not restored by loadSession', () => {
    useVisualStore.getState().setColorGradePreviewBypass(true)
    useVisualStore.getState().saveSession('test', 'file', [])
    const session = useVisualStore.getState().sessions[0] as unknown as Record<string, unknown>
    // The session snapshot must not carry the ephemeral preview flag.
    expect('colorGradePreviewBypass' in session).toBe(false)

    // Loading the session must not flip the live bypass flag.
    useVisualStore.getState().setColorGradePreviewBypass(false)
    useVisualStore.getState().loadSession(useVisualStore.getState().sessions[0].id)
    expect(useVisualStore.getState().colorGradePreviewBypass).toBe(false)
  })
})
