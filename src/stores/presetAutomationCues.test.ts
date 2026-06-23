/**
 * Tests for per-track React preset automation cue storage.
 *
 * Covers:
 *  - CRUD operations (add / update / remove / clear)
 *  - Track isolation (cues on Track A do not affect Track B)
 *  - getPresetAutomationCuesForTrack returns results sorted by timeSec
 *  - Duplicate-ID guard prevents double-insertion
 *  - Negative timeSec is clamped to zero on add and update
 *  - v9→v10 migration adds an empty map when the key is absent
 *  - resetReactView clears all cues
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useReactStore, migrateReactStore } from './reactStore'
import type { ReactPresetAutomationCue } from '../components/vyzualz/react/ReactTypes'

// ── Helpers ───────────────────────────────────────────────────────────────────

let _cueCounter = 0
function makeCue(overrides: Partial<ReactPresetAutomationCue> = {}): ReactPresetAutomationCue {
  _cueCounter++
  return {
    id:           `cue-${_cueCounter}`,
    timeSec:      10,
    presetId:     'preset-neon-energy-cloud',
    label:        'Test Cue',
    enabled:      true,
    transitionMs: 500,
    ...overrides,
  }
}

function resetCues() {
  useReactStore.setState({ presetAutomationCuesByTrackId: {} })
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

describe('presetAutomationCues — CRUD', () => {
  beforeEach(resetCues)

  it('addPresetAutomationCue appends a cue to the correct track', () => {
    const { addPresetAutomationCue, getPresetAutomationCuesForTrack } = useReactStore.getState()
    addPresetAutomationCue('track-1', makeCue({ id: 'c1', timeSec: 5 }))
    addPresetAutomationCue('track-1', makeCue({ id: 'c2', timeSec: 10 }))
    expect(getPresetAutomationCuesForTrack('track-1')).toHaveLength(2)
  })

  it('updatePresetAutomationCue applies a partial patch', () => {
    const { addPresetAutomationCue, updatePresetAutomationCue, getPresetAutomationCuesForTrack } = useReactStore.getState()
    addPresetAutomationCue('t1', makeCue({ id: 'c1', label: 'Original', timeSec: 10 }))
    updatePresetAutomationCue('t1', 'c1', { label: 'Updated', enabled: false })
    const [cue] = getPresetAutomationCuesForTrack('t1')
    expect(cue.label).toBe('Updated')
    expect(cue.enabled).toBe(false)
    expect(cue.timeSec).toBe(10)  // unchanged field preserved
  })

  it('removePresetAutomationCue deletes a cue by id', () => {
    const { addPresetAutomationCue, removePresetAutomationCue, getPresetAutomationCuesForTrack } = useReactStore.getState()
    addPresetAutomationCue('t1', makeCue({ id: 'keep' }))
    addPresetAutomationCue('t1', makeCue({ id: 'gone' }))
    removePresetAutomationCue('t1', 'gone')
    const cues = getPresetAutomationCuesForTrack('t1')
    expect(cues).toHaveLength(1)
    expect(cues[0].id).toBe('keep')
  })

  it('clearPresetAutomationCuesForTrack empties the track list', () => {
    const { addPresetAutomationCue, clearPresetAutomationCuesForTrack, getPresetAutomationCuesForTrack } = useReactStore.getState()
    addPresetAutomationCue('t1', makeCue({ id: 'c1' }))
    addPresetAutomationCue('t1', makeCue({ id: 'c2' }))
    clearPresetAutomationCuesForTrack('t1')
    expect(getPresetAutomationCuesForTrack('t1')).toHaveLength(0)
  })

  it('getPresetAutomationCuesForTrack returns [] for an unknown track', () => {
    const { getPresetAutomationCuesForTrack } = useReactStore.getState()
    expect(getPresetAutomationCuesForTrack('no-such-track')).toEqual([])
  })

  it('updatePresetAutomationCue on an unknown id is a no-op', () => {
    const { addPresetAutomationCue, updatePresetAutomationCue, getPresetAutomationCuesForTrack } = useReactStore.getState()
    addPresetAutomationCue('t1', makeCue({ id: 'real' }))
    updatePresetAutomationCue('t1', 'phantom', { label: 'ghost' })
    expect(getPresetAutomationCuesForTrack('t1')).toHaveLength(1)
    expect(getPresetAutomationCuesForTrack('t1')[0].id).toBe('real')
  })
})

// ── Track isolation ───────────────────────────────────────────────────────────

describe('presetAutomationCues — track isolation', () => {
  beforeEach(resetCues)

  it('cues added to track-A do not appear on track-B', () => {
    const { addPresetAutomationCue, getPresetAutomationCuesForTrack } = useReactStore.getState()
    addPresetAutomationCue('track-A', makeCue({ id: 'a1' }))
    expect(getPresetAutomationCuesForTrack('track-A')).toHaveLength(1)
    expect(getPresetAutomationCuesForTrack('track-B')).toHaveLength(0)
  })

  it('removing a cue from track-A does not touch track-B', () => {
    const { addPresetAutomationCue, removePresetAutomationCue, getPresetAutomationCuesForTrack } = useReactStore.getState()
    addPresetAutomationCue('track-A', makeCue({ id: 'a1' }))
    addPresetAutomationCue('track-B', makeCue({ id: 'b1' }))
    removePresetAutomationCue('track-A', 'a1')
    expect(getPresetAutomationCuesForTrack('track-A')).toHaveLength(0)
    expect(getPresetAutomationCuesForTrack('track-B')).toHaveLength(1)
  })

  it('updating a cue on track-A does not affect track-B', () => {
    const { addPresetAutomationCue, updatePresetAutomationCue, getPresetAutomationCuesForTrack } = useReactStore.getState()
    addPresetAutomationCue('track-A', makeCue({ id: 'shared', label: 'A label' }))
    addPresetAutomationCue('track-B', makeCue({ id: 'shared', label: 'B label' }))
    updatePresetAutomationCue('track-A', 'shared', { label: 'A updated' })
    expect(getPresetAutomationCuesForTrack('track-A')[0].label).toBe('A updated')
    expect(getPresetAutomationCuesForTrack('track-B')[0].label).toBe('B label')
  })

  it('clearPresetAutomationCuesForTrack removes only the target track', () => {
    const { addPresetAutomationCue, clearPresetAutomationCuesForTrack, getPresetAutomationCuesForTrack } = useReactStore.getState()
    addPresetAutomationCue('track-A', makeCue({ id: 'a1' }))
    addPresetAutomationCue('track-B', makeCue({ id: 'b1' }))
    clearPresetAutomationCuesForTrack('track-A')
    expect(getPresetAutomationCuesForTrack('track-A')).toHaveLength(0)
    expect(getPresetAutomationCuesForTrack('track-B')).toHaveLength(1)
  })
})

// ── Sorting ───────────────────────────────────────────────────────────────────

describe('presetAutomationCues — sorting', () => {
  beforeEach(resetCues)

  it('getPresetAutomationCuesForTrack returns cues sorted ascending by timeSec', () => {
    const { addPresetAutomationCue, getPresetAutomationCuesForTrack } = useReactStore.getState()
    // Insert out of order
    addPresetAutomationCue('t1', makeCue({ id: 'c-late',  timeSec: 90 }))
    addPresetAutomationCue('t1', makeCue({ id: 'c-first', timeSec: 10 }))
    addPresetAutomationCue('t1', makeCue({ id: 'c-mid',   timeSec: 45 }))
    const cues = getPresetAutomationCuesForTrack('t1')
    expect(cues.map(c => c.timeSec)).toEqual([10, 45, 90])
  })

  it('sorting does not mutate the underlying store array', () => {
    const { addPresetAutomationCue } = useReactStore.getState()
    addPresetAutomationCue('t1', makeCue({ id: 'z', timeSec: 100 }))
    addPresetAutomationCue('t1', makeCue({ id: 'a', timeSec: 1 }))
    // Raw store order should be insertion order (z, a)
    const raw = useReactStore.getState().presetAutomationCuesByTrackId['t1']
    expect(raw[0].id).toBe('z')
    expect(raw[1].id).toBe('a')
  })
})

// ── Duplicate-ID guard ────────────────────────────────────────────────────────

describe('presetAutomationCues — duplicate ID guard', () => {
  beforeEach(resetCues)

  it('adding a cue with a duplicate id is a no-op', () => {
    const { addPresetAutomationCue, getPresetAutomationCuesForTrack } = useReactStore.getState()
    addPresetAutomationCue('t1', makeCue({ id: 'dup', timeSec: 10, label: 'First' }))
    addPresetAutomationCue('t1', makeCue({ id: 'dup', timeSec: 20, label: 'Second' }))
    const cues = getPresetAutomationCuesForTrack('t1')
    expect(cues).toHaveLength(1)
    expect(cues[0].label).toBe('First')   // original preserved
    expect(cues[0].timeSec).toBe(10)
  })
})

// ── Negative timeSec clamping ─────────────────────────────────────────────────

describe('presetAutomationCues — timeSec clamping', () => {
  beforeEach(resetCues)

  it('addPresetAutomationCue clamps negative timeSec to 0', () => {
    const { addPresetAutomationCue, getPresetAutomationCuesForTrack } = useReactStore.getState()
    addPresetAutomationCue('t1', makeCue({ id: 'neg', timeSec: -5 }))
    expect(getPresetAutomationCuesForTrack('t1')[0].timeSec).toBe(0)
  })

  it('addPresetAutomationCue preserves timeSec = 0 exactly', () => {
    const { addPresetAutomationCue, getPresetAutomationCuesForTrack } = useReactStore.getState()
    addPresetAutomationCue('t1', makeCue({ id: 'zero', timeSec: 0 }))
    expect(getPresetAutomationCuesForTrack('t1')[0].timeSec).toBe(0)
  })

  it('updatePresetAutomationCue clamps negative timeSec patch to 0', () => {
    const { addPresetAutomationCue, updatePresetAutomationCue, getPresetAutomationCuesForTrack } = useReactStore.getState()
    addPresetAutomationCue('t1', makeCue({ id: 'c1', timeSec: 30 }))
    updatePresetAutomationCue('t1', 'c1', { timeSec: -10 })
    expect(getPresetAutomationCuesForTrack('t1')[0].timeSec).toBe(0)
  })

  it('updatePresetAutomationCue preserves a valid positive timeSec patch unchanged', () => {
    const { addPresetAutomationCue, updatePresetAutomationCue, getPresetAutomationCuesForTrack } = useReactStore.getState()
    addPresetAutomationCue('t1', makeCue({ id: 'c1', timeSec: 10 }))
    updatePresetAutomationCue('t1', 'c1', { timeSec: 60 })
    expect(getPresetAutomationCuesForTrack('t1')[0].timeSec).toBe(60)
  })
})

// ── Migration v9 → v10 ────────────────────────────────────────────────────────

describe('presetAutomationCues — migration v9→v10', () => {
  it('adds an empty presetAutomationCuesByTrackId map when key is absent', () => {
    const oldState = { activeReactEngineId: 'oscilloscope' }
    const migrated = migrateReactStore(oldState, 9)
    expect(migrated).toHaveProperty('presetAutomationCuesByTrackId')
    expect(migrated.presetAutomationCuesByTrackId).toEqual({})
  })

  it('preserves existing presetAutomationCuesByTrackId when already present', () => {
    const cue = makeCue({ id: 'existing-cue', timeSec: 30 })
    const existing = { 'track-xyz': [cue] }
    const state = { presetAutomationCuesByTrackId: existing }
    const migrated = migrateReactStore(state, 9)
    const byTrackId = migrated.presetAutomationCuesByTrackId as Record<string, ReactPresetAutomationCue[]>
    expect(byTrackId['track-xyz']).toHaveLength(1)
    expect(byTrackId['track-xyz'][0].id).toBe('existing-cue')
  })

  it('does not strip other state keys during migration', () => {
    const oldState = { activeReactEngineId: 'shaderPads', someOtherKey: true }
    const migrated = migrateReactStore(oldState, 9)
    expect(migrated.activeReactEngineId).toBe('shaderPads')
    expect(migrated.someOtherKey).toBe(true)
  })
})

// ── resetReactView ────────────────────────────────────────────────────────────

describe('presetAutomationCues — resetReactView', () => {
  it('clears all per-track cues on resetReactView', () => {
    const { addPresetAutomationCue, resetReactView } = useReactStore.getState()
    addPresetAutomationCue('t1', makeCue({ id: 'x' }))
    addPresetAutomationCue('t2', makeCue({ id: 'y' }))
    resetReactView()
    const { presetAutomationCuesByTrackId } = useReactStore.getState()
    expect(Object.keys(presetAutomationCuesByTrackId)).toHaveLength(0)
  })
})
