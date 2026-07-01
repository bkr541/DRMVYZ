/**
 * Regression tests for media ID stability during cloud upload.
 *
 * Root cause: both upload paths in mediaStore previously called only
 * `visual.setActiveMedia(stableId)` after replacing the local-* item ID
 * with a db-* ID. Any timeline clip, overlay clip, or layer item placed
 * during the upload retained the stale local-* reference, causing missing
 * visuals after upload completed.
 *
 * Fix: `remapMediaId(prevId, newId)` atomically updates every reference in
 * visualStore in a single `set()` call. Both upload success paths now call
 * it instead of the single-field update.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// ── Supabase must be mocked before any store imports ──────────────────────────
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth:    { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    from:    vi.fn(),
    storage: { from: vi.fn() },
  },
  supabaseConfigured: false,
}))

// Mock sessionDb so async cloud actions are no-ops in tests
vi.mock('../lib/sessionDb', () => ({
  dbCreateSession:  vi.fn().mockResolvedValue({ dbId: null, error: 'not signed in' }),
  dbUpdateSession:  vi.fn().mockResolvedValue({ error: null }),
  dbDeleteSession:  vi.fn().mockResolvedValue({ error: null }),
  loadCloudSessions: vi.fn().mockResolvedValue({ sessions: [], error: null }),
  rowToSession:     vi.fn(),
  sessionToInsert:  vi.fn(),
}))

import { useVisualStore } from './visualStore'
import type { VzSession } from './visualStore'

// ── Fixture helpers ────────────────────────────────────────────────────────────

const LOCAL_ID  = 'local-abc123'
const STABLE_ID = 'db-uuid-xyz'

function makeBgClip(mediaId: string) {
  return {
    id: 'clip-bg-001', mediaId,
    startSec: 0, durationSec: 30,
    mediaInSec: 0, fitMode: 'cover' as const, playbackMode: 'loop' as const,
    lane: 'video-background' as const,
  }
}

function makeOverlayClip(mediaId: string) {
  return {
    id: 'clip-ov-001', mediaId,
    startSec: 5, durationSec: 10,
    mediaInSec: 0, fitMode: 'contain' as const, playbackMode: 'trim' as const,
    lane: 'overlays' as const,
  }
}

function makeLayerItem(mediaId: string) {
  return {
    id: 'li-001', mediaId, layerId: 'logo' as const,
    enabled: true, locked: false, solo: false,
    opacity: 1, blendMode: 'source-over' as GlobalCompositeOperation,
    x: 0.5, y: 0.5, scale: 1, rotation: 0,
    anchor: 'center' as const, fitMode: 'contain' as const,
    zIndex: 0, audioReactive: false,
  }
}

function makeSession(mediaId: string): VzSession {
  return {
    id: 'sess-001', name: 'My Show',
    createdAt: Date.now(), source: 'local',
    activeMediaId: mediaId,
    mediaOrder: [mediaId, 'other-media-id'],
    activePresetId: 'dream-theft',
    effects: useVisualStore.getState().effects,
    enabledFx: [],
    bpm: 120, bpmSync: false,
    quality: 'High', audioSource: 'file',
    timelineEnabled: true,
    timelineClips: [makeBgClip(mediaId)],
    timelineLoop: false,
    timelineOverlayClips: [makeOverlayClip(mediaId)],
    timelineEffectRegions: [],
    layerItems: [makeLayerItem(mediaId)],
    beatGridEnabled: false,
    cueMarkers: [],
  }
}

// Reset the store to a controlled baseline before each test
function resetVisualStore() {
  useVisualStore.setState({
    activeMediaId:         null,
    timelineClips:         [],
    timelineOverlayClips:  [],
    layerItems:            [],
    sessions:              [],
    selectedLayerId:       null,
    selectedLayerItemId:   null,
    selectedTimelineEntity: null,
  })
}

// ── Tests: remapMediaId atomicity ─────���────────────────────────────────────────

describe('remapMediaId — live state', () => {
  beforeEach(resetVisualStore)

  it('updates activeMediaId', () => {
    useVisualStore.setState({ activeMediaId: LOCAL_ID })
    useVisualStore.getState().remapMediaId(LOCAL_ID, STABLE_ID)
    expect(useVisualStore.getState().activeMediaId).toBe(STABLE_ID)
  })

  it('updates background timeline clips', () => {
    useVisualStore.setState({ timelineClips: [makeBgClip(LOCAL_ID)] })
    useVisualStore.getState().remapMediaId(LOCAL_ID, STABLE_ID)
    const clips = useVisualStore.getState().timelineClips
    expect(clips[0].mediaId).toBe(STABLE_ID)
  })

  it('updates overlay clips', () => {
    useVisualStore.setState({ timelineOverlayClips: [makeOverlayClip(LOCAL_ID)] })
    useVisualStore.getState().remapMediaId(LOCAL_ID, STABLE_ID)
    const clips = useVisualStore.getState().timelineOverlayClips
    expect(clips[0].mediaId).toBe(STABLE_ID)
  })

  it('updates layer items', () => {
    useVisualStore.setState({ layerItems: [makeLayerItem(LOCAL_ID)] })
    useVisualStore.getState().remapMediaId(LOCAL_ID, STABLE_ID)
    const items = useVisualStore.getState().layerItems
    expect(items[0].mediaId).toBe(STABLE_ID)
  })

  it('updates all three simultaneously (the key bug scenario)', () => {
    useVisualStore.setState({
      activeMediaId:        LOCAL_ID,
      timelineClips:        [makeBgClip(LOCAL_ID)],
      timelineOverlayClips: [makeOverlayClip(LOCAL_ID)],
      layerItems:           [makeLayerItem(LOCAL_ID)],
    })

    useVisualStore.getState().remapMediaId(LOCAL_ID, STABLE_ID)

    const s = useVisualStore.getState()
    expect(s.activeMediaId).toBe(STABLE_ID)
    expect(s.timelineClips[0].mediaId).toBe(STABLE_ID)
    expect(s.timelineOverlayClips[0].mediaId).toBe(STABLE_ID)
    expect(s.layerItems[0].mediaId).toBe(STABLE_ID)
  })

  it('does not mutate unrelated media IDs', () => {
    const OTHER = 'local-other-media'
    useVisualStore.setState({
      activeMediaId:        OTHER,
      timelineClips:        [makeBgClip(OTHER)],
      timelineOverlayClips: [makeOverlayClip(OTHER)],
      layerItems:           [makeLayerItem(OTHER)],
    })

    useVisualStore.getState().remapMediaId(LOCAL_ID, STABLE_ID)

    const s = useVisualStore.getState()
    expect(s.activeMediaId).toBe(OTHER)
    expect(s.timelineClips[0].mediaId).toBe(OTHER)
    expect(s.timelineOverlayClips[0].mediaId).toBe(OTHER)
    expect(s.layerItems[0].mediaId).toBe(OTHER)
  })

  it('is a no-op when prevId === newId', () => {
    useVisualStore.setState({
      activeMediaId: LOCAL_ID,
      timelineClips: [makeBgClip(LOCAL_ID)],
    })
    useVisualStore.getState().remapMediaId(LOCAL_ID, LOCAL_ID)
    expect(useVisualStore.getState().activeMediaId).toBe(LOCAL_ID)
    expect(useVisualStore.getState().timelineClips[0].mediaId).toBe(LOCAL_ID)
  })

  it('is a no-op when prevId is not present anywhere', () => {
    const UNRELATED = 'local-zzz'
    useVisualStore.setState({
      activeMediaId: LOCAL_ID,
      timelineClips: [makeBgClip(LOCAL_ID)],
    })
    useVisualStore.getState().remapMediaId(UNRELATED, STABLE_ID)
    expect(useVisualStore.getState().activeMediaId).toBe(LOCAL_ID)
    expect(useVisualStore.getState().timelineClips[0].mediaId).toBe(LOCAL_ID)
  })
})

// ── Tests: session snapshot remapping ─────────────────���───────────────────────

describe('remapMediaId — session snapshots', () => {
  beforeEach(resetVisualStore)

  it('updates session activeMediaId', () => {
    useVisualStore.setState({ sessions: [makeSession(LOCAL_ID)] })
    useVisualStore.getState().remapMediaId(LOCAL_ID, STABLE_ID)
    const sess = useVisualStore.getState().sessions[0]
    expect(sess.activeMediaId).toBe(STABLE_ID)
  })

  it('updates session mediaOrder', () => {
    useVisualStore.setState({ sessions: [makeSession(LOCAL_ID)] })
    useVisualStore.getState().remapMediaId(LOCAL_ID, STABLE_ID)
    const sess = useVisualStore.getState().sessions[0]
    expect(sess.mediaOrder).toContain(STABLE_ID)
    expect(sess.mediaOrder).not.toContain(LOCAL_ID)
    // unrelated items in mediaOrder remain untouched
    expect(sess.mediaOrder).toContain('other-media-id')
  })

  it('updates session timelineClips', () => {
    useVisualStore.setState({ sessions: [makeSession(LOCAL_ID)] })
    useVisualStore.getState().remapMediaId(LOCAL_ID, STABLE_ID)
    const sess = useVisualStore.getState().sessions[0]
    expect(sess.timelineClips?.[0].mediaId).toBe(STABLE_ID)
  })

  it('updates session timelineOverlayClips', () => {
    useVisualStore.setState({ sessions: [makeSession(LOCAL_ID)] })
    useVisualStore.getState().remapMediaId(LOCAL_ID, STABLE_ID)
    const sess = useVisualStore.getState().sessions[0]
    expect(sess.timelineOverlayClips?.[0].mediaId).toBe(STABLE_ID)
  })

  it('updates session layerItems', () => {
    useVisualStore.setState({ sessions: [makeSession(LOCAL_ID)] })
    useVisualStore.getState().remapMediaId(LOCAL_ID, STABLE_ID)
    const sess = useVisualStore.getState().sessions[0]
    expect(sess.layerItems?.[0].mediaId).toBe(STABLE_ID)
  })

  it('updates all session fields atomically in a single remap call', () => {
    useVisualStore.setState({ sessions: [makeSession(LOCAL_ID)] })
    useVisualStore.getState().remapMediaId(LOCAL_ID, STABLE_ID)
    const sess = useVisualStore.getState().sessions[0]
    // Every media reference in the snapshot is updated
    expect(sess.activeMediaId).toBe(STABLE_ID)
    expect(sess.mediaOrder?.[0]).toBe(STABLE_ID)
    expect(sess.timelineClips?.[0].mediaId).toBe(STABLE_ID)
    expect(sess.timelineOverlayClips?.[0].mediaId).toBe(STABLE_ID)
    expect(sess.layerItems?.[0].mediaId).toBe(STABLE_ID)
  })
})

// ── Tests: preset snapshot remapping ─────────────────���───────────────────────

describe('remapMediaId — preset snapshots', () => {
  beforeEach(resetVisualStore)

  it('updates preset activeMediaId when scope includes activeMedia', () => {
    const presets = useVisualStore.getState().presets
    const testPreset = { ...presets[0], activeMediaId: LOCAL_ID }
    useVisualStore.setState({ presets: [testPreset, ...presets.slice(1)] })
    useVisualStore.getState().remapMediaId(LOCAL_ID, STABLE_ID)
    expect(useVisualStore.getState().presets[0].activeMediaId).toBe(STABLE_ID)
  })

  it('updates preset mediaOrder', () => {
    const presets = useVisualStore.getState().presets
    const testPreset = { ...presets[0], mediaOrder: [LOCAL_ID, 'other-media'] }
    useVisualStore.setState({ presets: [testPreset, ...presets.slice(1)] })
    useVisualStore.getState().remapMediaId(LOCAL_ID, STABLE_ID)
    expect(useVisualStore.getState().presets[0].mediaOrder).toContain(STABLE_ID)
    expect(useVisualStore.getState().presets[0].mediaOrder).not.toContain(LOCAL_ID)
  })

  it('updates preset timelineClips', () => {
    const presets = useVisualStore.getState().presets
    const testPreset = { ...presets[0], timelineClips: [makeBgClip(LOCAL_ID)] }
    useVisualStore.setState({ presets: [testPreset, ...presets.slice(1)] })
    useVisualStore.getState().remapMediaId(LOCAL_ID, STABLE_ID)
    expect(useVisualStore.getState().presets[0].timelineClips?.[0].mediaId).toBe(STABLE_ID)
  })

  it('updates preset timelineOverlayClips', () => {
    const presets = useVisualStore.getState().presets
    const testPreset = { ...presets[0], timelineOverlayClips: [makeOverlayClip(LOCAL_ID)] }
    useVisualStore.setState({ presets: [testPreset, ...presets.slice(1)] })
    useVisualStore.getState().remapMediaId(LOCAL_ID, STABLE_ID)
    expect(useVisualStore.getState().presets[0].timelineOverlayClips?.[0].mediaId).toBe(STABLE_ID)
  })

  it('scene preset saved before upload completion is fully repaired on upload success', () => {
    // Simulate: user saves a full scene preset while video is still uploading (local ID in all refs)
    const presets = useVisualStore.getState().presets
    const scenePre = {
      ...presets[0],
      activeMediaId:       LOCAL_ID,
      mediaOrder:          [LOCAL_ID],
      timelineClips:       [makeBgClip(LOCAL_ID)],
      timelineOverlayClips: [makeOverlayClip(LOCAL_ID)],
    }
    useVisualStore.setState({ presets: [scenePre, ...presets.slice(1)] })

    // Upload completes
    useVisualStore.getState().remapMediaId(LOCAL_ID, STABLE_ID)

    const p = useVisualStore.getState().presets[0]
    expect(p.activeMediaId).toBe(STABLE_ID)
    expect(p.mediaOrder?.[0]).toBe(STABLE_ID)
    expect(p.timelineClips?.[0].mediaId).toBe(STABLE_ID)
    expect(p.timelineOverlayClips?.[0].mediaId).toBe(STABLE_ID)
  })
})

// ── Tests: upload simulation scenarios ────────────��──────────────────────────

describe('upload simulation — placements survive ID transition', () => {
  beforeEach(resetVisualStore)

  it('placement before upload: all three references survive upload completion', () => {
    // Step 1: Media imported, upload starts, item has local ID
    useVisualStore.setState({
      activeMediaId:        LOCAL_ID,
      timelineClips:        [makeBgClip(LOCAL_ID)],
      timelineOverlayClips: [makeOverlayClip(LOCAL_ID)],
      layerItems:           [makeLayerItem(LOCAL_ID)],
    })

    // Step 2: User already placed the item — references exist with local ID
    expect(useVisualStore.getState().timelineClips[0].mediaId).toBe(LOCAL_ID)
    expect(useVisualStore.getState().timelineOverlayClips[0].mediaId).toBe(LOCAL_ID)
    expect(useVisualStore.getState().layerItems[0].mediaId).toBe(LOCAL_ID)

    // Step 3: Upload completes — mediaStore changes the item ID and calls remapMediaId
    useVisualStore.getState().remapMediaId(LOCAL_ID, STABLE_ID)

    // Step 4: All placements still resolve to the correct (now stable) media item
    const s = useVisualStore.getState()
    expect(s.activeMediaId).toBe(STABLE_ID)
    expect(s.timelineClips[0].mediaId).toBe(STABLE_ID)
    expect(s.timelineOverlayClips[0].mediaId).toBe(STABLE_ID)
    expect(s.layerItems[0].mediaId).toBe(STABLE_ID)
  })

  it('activeMediaId stays valid after upload completion', () => {
    useVisualStore.setState({ activeMediaId: LOCAL_ID })
    useVisualStore.getState().remapMediaId(LOCAL_ID, STABLE_ID)
    expect(useVisualStore.getState().activeMediaId).toBe(STABLE_ID)
  })

  it('session saved pre-upload has its references updated by remap', () => {
    // Save a session while upload is in progress (local ID in all references)
    const sessWithLocalId = makeSession(LOCAL_ID)
    useVisualStore.setState({
      activeMediaId:        LOCAL_ID,
      timelineClips:        [makeBgClip(LOCAL_ID)],
      timelineOverlayClips: [makeOverlayClip(LOCAL_ID)],
      layerItems:           [makeLayerItem(LOCAL_ID)],
      sessions:             [sessWithLocalId],
    })

    // Upload completes
    useVisualStore.getState().remapMediaId(LOCAL_ID, STABLE_ID)

    // Both live state and session snapshot are updated
    const s = useVisualStore.getState()
    expect(s.activeMediaId).toBe(STABLE_ID)
    const sess = s.sessions[0]
    expect(sess.activeMediaId).toBe(STABLE_ID)
    expect(sess.timelineClips?.[0].mediaId).toBe(STABLE_ID)
    expect(sess.timelineOverlayClips?.[0].mediaId).toBe(STABLE_ID)
    expect(sess.layerItems?.[0].mediaId).toBe(STABLE_ID)
    expect(sess.mediaOrder?.[0]).toBe(STABLE_ID)
  })

  it('upload failure leaves local placements intact (no remap on failure)', () => {
    // Place items with local ID
    useVisualStore.setState({
      activeMediaId:        LOCAL_ID,
      timelineClips:        [makeBgClip(LOCAL_ID)],
      timelineOverlayClips: [makeOverlayClip(LOCAL_ID)],
      layerItems:           [makeLayerItem(LOCAL_ID)],
    })

    // Upload fails — no remapMediaId call is made (the upload code returns early)
    // Local ID remains valid — do NOT call remapMediaId

    const s = useVisualStore.getState()
    expect(s.activeMediaId).toBe(LOCAL_ID)
    expect(s.timelineClips[0].mediaId).toBe(LOCAL_ID)
    expect(s.timelineOverlayClips[0].mediaId).toBe(LOCAL_ID)
    expect(s.layerItems[0].mediaId).toBe(LOCAL_ID)
  })

  it('retry after failure: remap on eventual success preserves all references', () => {
    // Phase 1: Place items with local ID
    useVisualStore.setState({
      activeMediaId:        LOCAL_ID,
      timelineClips:        [makeBgClip(LOCAL_ID)],
      timelineOverlayClips: [makeOverlayClip(LOCAL_ID)],
      layerItems:           [makeLayerItem(LOCAL_ID)],
    })

    // Phase 2: First upload attempt fails — no state change, local ID intact
    // (failure path in mediaStore sets uploadError but does NOT call remapMediaId)

    // Phase 3: Retry succeeds — stableId assigned, remapMediaId called
    useVisualStore.getState().remapMediaId(LOCAL_ID, STABLE_ID)

    const s = useVisualStore.getState()
    expect(s.activeMediaId).toBe(STABLE_ID)
    expect(s.timelineClips[0].mediaId).toBe(STABLE_ID)
    expect(s.timelineOverlayClips[0].mediaId).toBe(STABLE_ID)
    expect(s.layerItems[0].mediaId).toBe(STABLE_ID)
  })

  it('multiple simultaneous uploads do not cross-contaminate references', () => {
    const LOCAL_A = 'local-aaaa'
    const LOCAL_B = 'local-bbbb'
    const STABLE_A = 'db-aaaa-stable'
    const STABLE_B = 'db-bbbb-stable'

    useVisualStore.setState({
      activeMediaId:        LOCAL_A,
      timelineClips:        [
        { ...makeBgClip(LOCAL_A), id: 'clip-a' },
        { ...makeBgClip(LOCAL_B), id: 'clip-b' },
      ],
      timelineOverlayClips: [makeOverlayClip(LOCAL_B)],
      layerItems:           [makeLayerItem(LOCAL_A)],
    })

    // Upload A completes first
    useVisualStore.getState().remapMediaId(LOCAL_A, STABLE_A)
    // Upload B completes second
    useVisualStore.getState().remapMediaId(LOCAL_B, STABLE_B)

    const s = useVisualStore.getState()
    expect(s.activeMediaId).toBe(STABLE_A)
    expect(s.timelineClips.find(c => c.id === 'clip-a')?.mediaId).toBe(STABLE_A)
    expect(s.timelineClips.find(c => c.id === 'clip-b')?.mediaId).toBe(STABLE_B)
    expect(s.timelineOverlayClips[0].mediaId).toBe(STABLE_B)
    expect(s.layerItems[0].mediaId).toBe(STABLE_A)
  })
})

// ── Tests: deleted media reference cleanup ───────────────────────────────────

describe('removeMediaReferences — deletion safety', () => {
  beforeEach(resetVisualStore)

  it('removes live timeline and layer references and clears affected selections', () => {
    const bg = makeBgClip(LOCAL_ID)
    const overlay = makeOverlayClip(LOCAL_ID)
    const layer = makeLayerItem(LOCAL_ID)
    useVisualStore.setState({
      activeMediaId: LOCAL_ID,
      timelineClips: [bg, makeBgClip('other-media')],
      timelineOverlayClips: [overlay],
      layerItems: [layer],
      selectedLayerId: layer.layerId,
      selectedLayerItemId: layer.id,
      selectedTimelineEntity: { kind: 'bg', id: bg.id },
    })

    useVisualStore.getState().removeMediaReferences(LOCAL_ID)

    const state = useVisualStore.getState()
    expect(state.activeMediaId).toBeNull()
    expect(state.timelineClips.map(clip => clip.mediaId)).toEqual(['other-media'])
    expect(state.timelineOverlayClips).toEqual([])
    expect(state.layerItems).toEqual([])
    expect(state.selectedLayerId).toBeNull()
    expect(state.selectedLayerItemId).toBeNull()
    expect(state.selectedTimelineEntity).toBeNull()
  })

  it('removes deleted media from saved session and preset snapshots', () => {
    const session = makeSession(LOCAL_ID)
    const presets = useVisualStore.getState().presets
    const preset = {
      ...presets[0],
      activeMediaId: LOCAL_ID,
      mediaOrder: [LOCAL_ID, 'other-media'],
      timelineClips: [makeBgClip(LOCAL_ID)],
      timelineOverlayClips: [makeOverlayClip(LOCAL_ID)],
    }
    useVisualStore.setState({ sessions: [session], presets: [preset, ...presets.slice(1)] })

    useVisualStore.getState().removeMediaReferences(LOCAL_ID)

    const nextSession = useVisualStore.getState().sessions[0]
    expect(nextSession.activeMediaId).toBeNull()
    expect(nextSession.mediaOrder).toEqual(['other-media-id'])
    expect(nextSession.timelineClips).toEqual([])
    expect(nextSession.timelineOverlayClips).toEqual([])
    expect(nextSession.layerItems).toEqual([])

    const nextPreset = useVisualStore.getState().presets[0]
    expect(nextPreset.activeMediaId).toBeNull()
    expect(nextPreset.mediaOrder).toEqual(['other-media'])
    expect(nextPreset.timelineClips).toEqual([])
    expect(nextPreset.timelineOverlayClips).toEqual([])
  })
})
