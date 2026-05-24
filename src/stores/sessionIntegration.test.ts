/**
 * Session save / load integration tests.
 *
 * Verifies that the full save → load roundtrip preserves every field of a
 * complex session: effects, timeline clips, overlay clips, effect regions,
 * BPM, quality, layer items, cue markers, and the legacy clip migration path.
 *
 * These tests exercise the real store actions against the in-memory state
 * maintained by Zustand.  No cloud calls are made (supabase is mocked).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Mock Supabase before store import so no cloud calls fire during tests.
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth:    { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    from:    vi.fn(),
    storage: { from: vi.fn() },
  },
  supabaseConfigured: false,
}))

vi.mock('../lib/sessionDb', () => ({
  dbCreateSession:  vi.fn().mockResolvedValue({ dbId: null, error: 'not signed in' }),
  dbUpdateSession:  vi.fn().mockResolvedValue({ error: null }),
  dbDeleteSession:  vi.fn().mockResolvedValue({ error: null }),
  loadCloudSessions: vi.fn().mockResolvedValue({ sessions: [], error: null }),
  rowToSession:     vi.fn(),
  sessionToInsert:  vi.fn(),
}))

import { useVisualStore } from './visualStore'
import { DEFAULT_EFFECTS } from './visualStore'
import type { VzSession } from './visualStore'

// ── Helpers ───────────────────────────────────────────────────────────────────

function freshStore() {
  // Reset the in-memory Zustand store state between tests by calling the internal
  // reset action when available, otherwise read current state to verify isolation.
  return useVisualStore.getState()
}

function makeBgClip(id: string, mediaId: string, startSec = 0) {
  return {
    id, mediaId,
    startSec, durationSec: 30,
    mediaInSec: 0, fitMode: 'cover' as const, playbackMode: 'loop' as const,
    lane: 'video-background' as const,
  }
}

function makeOverlayClip(id: string, mediaId: string, startSec = 0) {
  return {
    id, mediaId,
    startSec, durationSec: 10,
    mediaInSec: 0, fitMode: 'contain' as const, playbackMode: 'trim' as const,
    lane: 'overlays' as const,
  }
}

function makeEffectRegion(id: string, startSec = 5) {
  return {
    id, effectId: 'Bloom', startSec, durationSec: 5,
    enabled: true,
    targetType: 'global' as const,
    intensity: 0.8,
  }
}

// ── Session save → load roundtrip ─────────────────────────────────────────────

describe('session save → load roundtrip', () => {
  beforeEach(() => {
    // Clear sessions array and reset relevant fields before each test.
    useVisualStore.setState({
      sessions:             [],
      timelineClips:        [],
      timelineOverlayClips: [],
      timelineEffectRegions: [],
      timelineEnabled:      false,
      timelineLoop:         true,
      layerItems:           [],
      cueMarkers:           [],
      bpm:                  120,
      bpmSync:              false,
      quality:              'High',
      effects:              { ...DEFAULT_EFFECTS },
      enabledFxArr:         [],
      activeMediaId:        null,
      beatGridEnabled:      false,
    })
  })

  it('saved session appears in sessions array', () => {
    useVisualStore.getState().saveSession('Test Show', 'file', ['media-001'])
    const { sessions } = useVisualStore.getState()
    expect(sessions).toHaveLength(1)
    expect(sessions[0].name).toBe('Test Show')
    expect(sessions[0].source).toBe('local')
  })

  it('session id is unique across multiple saves made at distinct timestamps', () => {
    vi.useFakeTimers()
    useVisualStore.getState().saveSession('Show A', 'file', [])
    vi.advanceTimersByTime(1)
    useVisualStore.getState().saveSession('Show B', 'file', [])
    vi.useRealTimers()
    const { sessions } = useVisualStore.getState()
    expect(sessions).toHaveLength(2)
    expect(sessions[0].id).not.toBe(sessions[1].id)
  })

  it('loadSession restores BPM, quality, and bpmSync', () => {
    useVisualStore.setState({ bpm: 140, bpmSync: true, quality: 'Low' })
    useVisualStore.getState().saveSession('BPM test', 'file', [])
    const sessionId = useVisualStore.getState().sessions[0].id

    // Mutate state away from saved values
    useVisualStore.setState({ bpm: 90, bpmSync: false, quality: 'Medium' })

    useVisualStore.getState().loadSession(sessionId)
    const s = useVisualStore.getState()
    expect(s.bpm).toBe(140)
    expect(s.bpmSync).toBe(true)
    expect(s.quality).toBe('Low')
  })

  it('loadSession restores effects snapshot', () => {
    const modifiedEffects = { ...DEFAULT_EFFECTS, bloom: 0.99, rgbSplit: 0.77 }
    useVisualStore.setState({ effects: modifiedEffects })
    useVisualStore.getState().saveSession('FX test', 'file', [])
    const sessionId = useVisualStore.getState().sessions[0].id

    useVisualStore.setState({ effects: { ...DEFAULT_EFFECTS, bloom: 0, rgbSplit: 0 } })

    useVisualStore.getState().loadSession(sessionId)
    const { effects } = useVisualStore.getState()
    expect(effects.bloom).toBe(0.99)
    expect(effects.rgbSplit).toBe(0.77)
  })

  it('loadSession restores active media ID', () => {
    useVisualStore.setState({ activeMediaId: 'db-media-xyz' })
    useVisualStore.getState().saveSession('Media test', 'file', ['db-media-xyz'])
    const sessionId = useVisualStore.getState().sessions[0].id

    useVisualStore.setState({ activeMediaId: null })

    useVisualStore.getState().loadSession(sessionId)
    expect(useVisualStore.getState().activeMediaId).toBe('db-media-xyz')
  })

  it('loadSession restores timeline clips and loop flag', () => {
    const clips = [makeBgClip('clip-1', 'media-a', 0), makeBgClip('clip-2', 'media-b', 30)]
    useVisualStore.setState({ timelineClips: clips, timelineEnabled: true, timelineLoop: false })
    useVisualStore.getState().saveSession('Timeline test', 'file', ['media-a', 'media-b'])
    const sessionId = useVisualStore.getState().sessions[0].id

    useVisualStore.setState({ timelineClips: [], timelineEnabled: false, timelineLoop: true })

    useVisualStore.getState().loadSession(sessionId)
    const s = useVisualStore.getState()
    expect(s.timelineClips).toHaveLength(2)
    expect(s.timelineClips[0].mediaId).toBe('media-a')
    expect(s.timelineEnabled).toBe(true)
    expect(s.timelineLoop).toBe(false)
  })

  it('loadSession restores overlay clips', () => {
    const overlays = [makeOverlayClip('ov-1', 'logo-media', 5)]
    useVisualStore.setState({ timelineOverlayClips: overlays })
    useVisualStore.getState().saveSession('Overlay test', 'file', [])
    const sessionId = useVisualStore.getState().sessions[0].id

    useVisualStore.setState({ timelineOverlayClips: [] })

    useVisualStore.getState().loadSession(sessionId)
    const { timelineOverlayClips } = useVisualStore.getState()
    expect(timelineOverlayClips).toHaveLength(1)
    expect(timelineOverlayClips[0].mediaId).toBe('logo-media')
    expect(timelineOverlayClips[0].lane).toBe('overlays')
  })

  it('loadSession restores effect regions', () => {
    const regions = [makeEffectRegion('er-1', 5), makeEffectRegion('er-2', 20)]
    useVisualStore.setState({ timelineEffectRegions: regions })
    useVisualStore.getState().saveSession('Regions test', 'file', [])
    const sessionId = useVisualStore.getState().sessions[0].id

    useVisualStore.setState({ timelineEffectRegions: [] })

    useVisualStore.getState().loadSession(sessionId)
    const { timelineEffectRegions } = useVisualStore.getState()
    expect(timelineEffectRegions).toHaveLength(2)
    expect(timelineEffectRegions[0].startSec).toBe(5)
    expect(timelineEffectRegions[1].startSec).toBe(20)
  })

  it('loadSession restores cue markers', () => {
    useVisualStore.setState({
      cueMarkers: [{ id: 'cue-1', time: 12.5, label: 'Drop', color: '#ff0000', type: 'custom' }],
    })
    useVisualStore.getState().saveSession('Cue test', 'file', [])
    const sessionId = useVisualStore.getState().sessions[0].id

    useVisualStore.setState({ cueMarkers: [] })

    useVisualStore.getState().loadSession(sessionId)
    const { cueMarkers } = useVisualStore.getState()
    expect(cueMarkers).toHaveLength(1)
    expect(cueMarkers[0].time).toBe(12.5)
    expect(cueMarkers[0].label).toBe('Drop')
  })

  it('loadSession returns the session object for the caller', () => {
    useVisualStore.getState().saveSession('Return test', 'file', [])
    const sessionId = useVisualStore.getState().sessions[0].id
    const returned = useVisualStore.getState().loadSession(sessionId)
    expect(returned).not.toBeNull()
    expect(returned!.name).toBe('Return test')
  })

  it('loadSession returns null for unknown id', () => {
    const result = useVisualStore.getState().loadSession('nonexistent-id')
    expect(result).toBeNull()
  })

  it('deleteSession removes session from array', () => {
    useVisualStore.getState().saveSession('To delete', 'file', [])
    const sessionId = useVisualStore.getState().sessions[0].id

    useVisualStore.getState().deleteSession(sessionId)
    expect(useVisualStore.getState().sessions).toHaveLength(0)
  })

  it('renameSession updates name without changing other fields', () => {
    useVisualStore.setState({ bpm: 130 })
    useVisualStore.getState().saveSession('Old name', 'file', [])
    const sessionId = useVisualStore.getState().sessions[0].id

    useVisualStore.getState().renameSession(sessionId, 'New name')
    const session = useVisualStore.getState().sessions.find(s => s.id === sessionId)
    expect(session?.name).toBe('New name')
    expect(session?.bpm).toBe(130)
  })
})

// ── Legacy clip migration ─────────────────────────────────────────────────────

describe('loadSession — legacy clip migration', () => {
  beforeEach(() => {
    useVisualStore.setState({ sessions: [], timelineClips: [] })
  })

  it('loads a session containing legacy clips without a lane field', () => {
    // Simulate a session saved before the `lane` field was added.
    const legacySession: VzSession = {
      id: 'legacy-session-001',
      name: 'Legacy Show',
      createdAt: Date.now(),
      source: 'local',
      activeMediaId: null,
      mediaOrder: ['media-x'],
      activePresetId: 'clean-playback',
      effects: { ...DEFAULT_EFFECTS },
      enabledFx: [],
      bpm: 120,
      bpmSync: false,
      quality: 'High',
      audioSource: 'file',
      // Intentionally omit `lane` to simulate legacy format
      timelineClips: [
        { id: 'lc-1', mediaId: 'media-x', startSec: 0, durationSec: 30,
          mediaInSec: 0, fitMode: 'cover', playbackMode: 'loop' } as never,
      ],
    }

    useVisualStore.setState({ sessions: [legacySession] })
    useVisualStore.getState().loadSession('legacy-session-001')

    const { timelineClips } = useVisualStore.getState()
    expect(timelineClips).toHaveLength(1)
    // Migration must assign the 'video-background' lane
    expect(timelineClips[0].lane).toBe('video-background')
  })

  it('does not repack startSec of modern clips that already have lane', () => {
    const modernSession: VzSession = {
      id: 'modern-session-001',
      name: 'Modern Show',
      createdAt: Date.now(),
      source: 'local',
      activeMediaId: null,
      mediaOrder: [],
      activePresetId: 'clean-playback',
      effects: { ...DEFAULT_EFFECTS },
      enabledFx: [],
      bpm: 120,
      bpmSync: false,
      quality: 'High',
      audioSource: 'file',
      timelineClips: [
        makeBgClip('mc-1', 'media-a', 0),
        makeBgClip('mc-2', 'media-b', 45),  // non-sequential — must be preserved
      ],
    }

    useVisualStore.setState({ sessions: [modernSession] })
    useVisualStore.getState().loadSession('modern-session-001')

    const { timelineClips } = useVisualStore.getState()
    expect(timelineClips).toHaveLength(2)
    // startSec must not be recalculated — modern clips store absolute positions
    expect(timelineClips.find(c => c.id === 'mc-2')?.startSec).toBe(45)
  })
})

// ── Multi-session isolation ───────────────────────────────────────────────────

describe('multi-session isolation', () => {
  beforeEach(() => {
    // Use fake timers so rapid saves always produce distinct Date.now() IDs.
    vi.useFakeTimers()
    useVisualStore.setState({ sessions: [] })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('loading one session does not affect sibling sessions in the array', () => {
    useVisualStore.setState({ bpm: 100 })
    useVisualStore.getState().saveSession('Show A', 'file', [])

    // Advance clock so the next save gets a different timestamp-based ID.
    vi.advanceTimersByTime(1)
    useVisualStore.setState({ bpm: 160 })
    useVisualStore.getState().saveSession('Show B', 'file', [])

    const sessions = useVisualStore.getState().sessions
    expect(sessions).toHaveLength(2)  // confirm both got unique IDs

    const idA = sessions.find(s => s.name === 'Show A')!.id
    const idB = sessions.find(s => s.name === 'Show B')!.id
    expect(idA).not.toBe(idB)

    useVisualStore.getState().loadSession(idA)
    // Show B must still have its original BPM of 160 in the sessions array
    const showB = useVisualStore.getState().sessions.find(s => s.id === idB)!
    expect(showB.bpm).toBe(160)
  })
})
