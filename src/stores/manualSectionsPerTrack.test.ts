/**
 * Tests for the per-track manual section model in reactStore.
 *
 * Covers:
 *  - Sections are isolated per track (edits on A don't affect B)
 *  - CRUD actions require trackId
 *  - v4→v5 migration assigns legacy flat array to '_legacy' bucket
 *  - New sessions start with an empty map
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useReactStore, migrateReactStore } from './reactStore'
import { resolveTrackSections } from '../features/trackIntelligence/trackMapAdapter'
import type { ReactTrackSection } from '../components/vyzualz/react/ReactTypes'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeSection(overrides: Partial<ReactTrackSection> = {}): ReactTrackSection {
  return {
    id:        `sec-${Math.random().toString(36).slice(2)}`,
    label:     'Test',
    type:      'intro',
    startSec:  0,
    endSec:    30,
    intensity: 0.5,
    source:    'user-created',
    ...overrides,
  }
}

// Reset store state before each test so tests are independent.
// Direct setState bypasses the persist middleware so no localStorage side-effects.
function resetSections() {
  useReactStore.setState({
    manualTrackSectionsByTrackId: {},
    selectedSectionId: null,
    selectedSectionByTrackId: {},
    suppressedAutoSectionsByTrackId: {},
  })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('per-track manual sections — isolation', () => {
  beforeEach(resetSections)

  it('sections added to track-A do not appear for track-B', () => {
    const { addManualSection, getManualSectionsForTrack } = useReactStore.getState()
    addManualSection('track-A', makeSection({ id: 'sec-1' }))
    expect(getManualSectionsForTrack('track-A')).toHaveLength(1)
    expect(getManualSectionsForTrack('track-B')).toHaveLength(0)
  })

  it('removing a section from track-A does not touch track-B', () => {
    const { addManualSection, removeManualSection, getManualSectionsForTrack } = useReactStore.getState()
    addManualSection('track-A', makeSection({ id: 'sec-a' }))
    addManualSection('track-B', makeSection({ id: 'sec-b' }))
    removeManualSection('track-A', 'sec-a')
    expect(getManualSectionsForTrack('track-A')).toHaveLength(0)
    expect(getManualSectionsForTrack('track-B')).toHaveLength(1)
  })

  it('updating a section on track-A does not affect track-B', () => {
    const { addManualSection, updateManualSection, getManualSectionsForTrack } = useReactStore.getState()
    addManualSection('track-A', makeSection({ id: 'sec-a', label: 'Original' }))
    addManualSection('track-B', makeSection({ id: 'sec-a', label: 'B section' }))
    updateManualSection('track-A', 'sec-a', { label: 'Updated' })
    expect(getManualSectionsForTrack('track-A')[0].label).toBe('Updated')
    expect(getManualSectionsForTrack('track-B')[0].label).toBe('B section')
  })

  it('clearManualSectionsForTrack removes only that track', () => {
    const { addManualSection, clearManualSectionsForTrack, getManualSectionsForTrack } = useReactStore.getState()
    addManualSection('track-A', makeSection({ id: 'a1' }))
    addManualSection('track-B', makeSection({ id: 'b1' }))
    clearManualSectionsForTrack('track-A')
    expect(getManualSectionsForTrack('track-A')).toHaveLength(0)
    expect(getManualSectionsForTrack('track-B')).toHaveLength(1)
  })
})

describe('per-track manual sections — CRUD', () => {
  beforeEach(resetSections)

  it('addManualSection appends to the correct track', () => {
    const { addManualSection, getManualSectionsForTrack } = useReactStore.getState()
    addManualSection('t1', makeSection({ id: 's1' }))
    addManualSection('t1', makeSection({ id: 's2' }))
    const sections = getManualSectionsForTrack('t1')
    expect(sections).toHaveLength(2)
    expect(sections.map(s => s.id)).toEqual(['s1', 's2'])
  })

  it('removeManualSection clears selectedSectionId when the removed section was selected', () => {
    const { addManualSection, removeManualSection } = useReactStore.getState()
    const sec = makeSection({ id: 'to-remove' })
    addManualSection('t1', sec)
    useReactStore.setState({ selectedSectionId: 'to-remove' })
    removeManualSection('t1', 'to-remove')
    expect(useReactStore.getState().selectedSectionId).toBeNull()
  })

  it('removeManualSection preserves selectedSectionId when a different section is removed', () => {
    const { addManualSection, removeManualSection } = useReactStore.getState()
    addManualSection('t1', makeSection({ id: 'keep' }))
    addManualSection('t1', makeSection({ id: 'gone' }))
    useReactStore.setState({ selectedSectionId: 'keep' })
    removeManualSection('t1', 'gone')
    expect(useReactStore.getState().selectedSectionId).toBe('keep')
  })

  it('getManualSectionsForTrack returns [] for an unknown trackId', () => {
    const { getManualSectionsForTrack } = useReactStore.getState()
    expect(getManualSectionsForTrack('does-not-exist')).toEqual([])
  })
})

describe('per-track manual sections — v4→v5 migration', () => {
  it('assigns legacy flat sections to _legacy bucket when old manualTrackSections is present', () => {
    const legacySections: ReactTrackSection[] = [
      makeSection({ id: 'old-1', label: 'Legacy Intro' }),
      makeSection({ id: 'old-2', label: 'Legacy Drop' }),
    ]

    const oldState = {
      manualTrackSections: legacySections,
      // No manualTrackSectionsByTrackId key (v4 store)
    }

    const migrated = migrateReactStore(oldState, 4)

    // Old key removed
    expect(migrated).not.toHaveProperty('manualTrackSections')

    // Sections assigned to _legacy bucket
    const byTrackId = migrated.manualTrackSectionsByTrackId as Record<string, ReactTrackSection[]>
    expect(byTrackId).toBeDefined()
    expect(byTrackId['_legacy']).toHaveLength(2)
    expect(byTrackId['_legacy'][0].id).toBe('old-1')
    expect(byTrackId['_legacy'][1].id).toBe('old-2')
  })

  it('produces an empty per-track map when old manualTrackSections is absent', () => {
    const oldState = { activeReactEngineId: 'oscilloscope' }
    const migrated = migrateReactStore(oldState, 4)

    expect(migrated).not.toHaveProperty('manualTrackSections')
    const byTrackId = migrated.manualTrackSectionsByTrackId as Record<string, ReactTrackSection[]>
    expect(byTrackId).toBeDefined()
    expect(Object.keys(byTrackId)).toHaveLength(0)
  })

  it('preserves existing manualTrackSectionsByTrackId when already migrated', () => {
    const existingByTrackId = { 'track-xyz': [makeSection({ id: 'existing' })] }
    const alreadyMigrated = {
      manualTrackSectionsByTrackId: existingByTrackId,
    }

    const migrated = migrateReactStore(alreadyMigrated, 4)
    const byTrackId = migrated.manualTrackSectionsByTrackId as Record<string, ReactTrackSection[]>
    expect(byTrackId['track-xyz']).toHaveLength(1)
    expect(byTrackId['track-xyz'][0].id).toBe('existing')
  })
})

describe('per-track manual sections — resetReactView', () => {
  it('clears all per-track sections on resetReactView', () => {
    const { addManualSection, resetReactView, manualTrackSectionsByTrackId: _ } = useReactStore.getState()
    addManualSection('t1', makeSection({ id: 'x' }))
    addManualSection('t2', makeSection({ id: 'y' }))
    resetReactView()
    const { manualTrackSectionsByTrackId } = useReactStore.getState()
    expect(Object.keys(manualTrackSectionsByTrackId)).toHaveLength(0)
  })
})

// ── setSelectedSectionIdForTrack ─────────────────────────────────────────────

describe('setSelectedSectionIdForTrack', () => {
  beforeEach(resetSections)

  it('sets the selected section ID for a specific track', () => {
    const { setSelectedSectionIdForTrack } = useReactStore.getState()
    setSelectedSectionIdForTrack('track-A', 'sec-1')
    expect(useReactStore.getState().selectedSectionByTrackId['track-A']).toBe('sec-1')
  })

  it('isolates selection: track-A selection does not affect track-B', () => {
    const { setSelectedSectionIdForTrack } = useReactStore.getState()
    setSelectedSectionIdForTrack('track-A', 'sec-1')
    setSelectedSectionIdForTrack('track-B', 'sec-2')
    expect(useReactStore.getState().selectedSectionByTrackId['track-A']).toBe('sec-1')
    expect(useReactStore.getState().selectedSectionByTrackId['track-B']).toBe('sec-2')
  })

  it('calling with null trackId is a no-op', () => {
    const { setSelectedSectionIdForTrack } = useReactStore.getState()
    setSelectedSectionIdForTrack(null, 'sec-1')
    expect(Object.keys(useReactStore.getState().selectedSectionByTrackId)).toHaveLength(0)
  })

  it('removeManualSection clears selectedSectionByTrackId for the removed section', () => {
    const { addManualSection, removeManualSection, setSelectedSectionIdForTrack } = useReactStore.getState()
    addManualSection('t1', makeSection({ id: 'sec-del' }))
    setSelectedSectionIdForTrack('t1', 'sec-del')
    removeManualSection('t1', 'sec-del')
    expect(useReactStore.getState().selectedSectionByTrackId['t1']).toBeNull()
  })

  it('removeManualSection preserves selectedSectionByTrackId for a different section', () => {
    const { addManualSection, removeManualSection, setSelectedSectionIdForTrack } = useReactStore.getState()
    addManualSection('t1', makeSection({ id: 'keep' }))
    addManualSection('t1', makeSection({ id: 'gone' }))
    setSelectedSectionIdForTrack('t1', 'keep')
    removeManualSection('t1', 'gone')
    expect(useReactStore.getState().selectedSectionByTrackId['t1']).toBe('keep')
  })
})

// ── suppressAutoSection / restoreAutoSection ──────────────────────────────────

describe('suppressAutoSection', () => {
  beforeEach(resetSections)

  it('adds the section ID to the suppressed list for a track', () => {
    const { suppressAutoSection } = useReactStore.getState()
    suppressAutoSection('t1', 'sec-auto')
    const suppressed = useReactStore.getState().suppressedAutoSectionsByTrackId['t1']
    expect(suppressed).toContain('sec-auto')
  })

  it('is idempotent — does not duplicate if suppressed twice', () => {
    const { suppressAutoSection } = useReactStore.getState()
    suppressAutoSection('t1', 'sec-auto')
    suppressAutoSection('t1', 'sec-auto')
    const suppressed = useReactStore.getState().suppressedAutoSectionsByTrackId['t1']
    expect(suppressed.filter(id => id === 'sec-auto')).toHaveLength(1)
  })

  it('clears selectedSectionByTrackId when the suppressed section was selected', () => {
    const { suppressAutoSection, setSelectedSectionIdForTrack } = useReactStore.getState()
    setSelectedSectionIdForTrack('t1', 'sec-auto')
    suppressAutoSection('t1', 'sec-auto')
    expect(useReactStore.getState().selectedSectionByTrackId['t1']).toBeNull()
  })

  it('does not affect suppressed list for other tracks', () => {
    const { suppressAutoSection } = useReactStore.getState()
    suppressAutoSection('track-A', 'sec-auto')
    expect(useReactStore.getState().suppressedAutoSectionsByTrackId['track-B'] ?? []).toHaveLength(0)
  })
})

describe('restoreAutoSection', () => {
  beforeEach(resetSections)

  it('removes the user-edited-auto override for the section', () => {
    const { commitAutomaticSectionOverride, restoreAutoSection, getManualSectionsForTrack } = useReactStore.getState()
    const orig = makeSection({ id: 'auto-1', source: 'auto' })
    commitAutomaticSectionOverride('t1', orig, { endSec: 50 })
    expect(getManualSectionsForTrack('t1')).toHaveLength(1)

    restoreAutoSection('t1', 'auto-1')
    expect(getManualSectionsForTrack('t1')).toHaveLength(0)
  })

  it('removes the section from the suppressed list', () => {
    const { suppressAutoSection, restoreAutoSection } = useReactStore.getState()
    suppressAutoSection('t1', 'auto-1')
    restoreAutoSection('t1', 'auto-1')
    const suppressed = useReactStore.getState().suppressedAutoSectionsByTrackId['t1'] ?? []
    expect(suppressed).not.toContain('auto-1')
  })

  it('is a no-op when the section has no override and is not suppressed', () => {
    const { restoreAutoSection, getManualSectionsForTrack } = useReactStore.getState()
    restoreAutoSection('t1', 'no-such-section')
    expect(getManualSectionsForTrack('t1')).toHaveLength(0)
  })
})

// ── resolveTrackSections suppressedIds ───────────────────────────────────────

describe('resolveTrackSections — suppressedIds', () => {
  const autoA = makeSection({ id: 'auto-a', source: 'auto',         startSec: 0,  endSec: 30  })
  const autoB = makeSection({ id: 'auto-b', source: 'auto',         startSec: 30, endSec: 60  })
  const user  = makeSection({ id: 'user-1', source: 'user-created', startSec: 60, endSec: 90  })

  it('excludes suppressed auto section from resolved timeline', () => {
    const resolved = resolveTrackSections({
      analyzedSections: [autoA, autoB],
      manualSections:   [],
      durationSec:      120,
      suppressedIds:    ['auto-a'],
    })
    expect(resolved.map(s => s.id)).not.toContain('auto-a')
    expect(resolved.map(s => s.id)).toContain('auto-b')
  })

  it('excludes a suppressed auto section even if it has a user-edited-auto override', () => {
    const override = makeSection({ id: 'auto-a', source: 'user-edited-auto', startSec: 5, endSec: 35 })
    const resolved = resolveTrackSections({
      analyzedSections: [autoA],
      manualSections:   [override],
      durationSec:      120,
      suppressedIds:    ['auto-a'],
    })
    expect(resolved).toHaveLength(0)
  })

  it('empty suppressedIds behaves the same as omitting the parameter', () => {
    const withEmpty  = resolveTrackSections({ analyzedSections: [autoA], manualSections: [], durationSec: 120, suppressedIds: [] })
    const withOmit   = resolveTrackSections({ analyzedSections: [autoA], manualSections: [], durationSec: 120 })
    expect(withEmpty).toEqual(withOmit)
  })

  it('user-created sections are unaffected by suppressedIds containing their ID', () => {
    const resolved = resolveTrackSections({
      analyzedSections: [],
      manualSections:   [user],
      durationSec:      120,
      suppressedIds:    ['user-1'],  // targeting user section (unusual but should be harmless)
    })
    expect(resolved.map(s => s.id)).toContain('user-1')
  })
})

// ── commitAutomaticSectionOverride ───────────────────────────────────────────

describe('commitAutomaticSectionOverride', () => {
  beforeEach(resetSections)

  it('creates a new user-edited-auto entry when no override exists yet', () => {
    const { commitAutomaticSectionOverride, getManualSectionsForTrack } = useReactStore.getState()
    const original = makeSection({ id: 'auto-1', source: 'auto', startSec: 0, endSec: 30 })

    commitAutomaticSectionOverride('t1', original, { endSec: 45 })

    const sections = getManualSectionsForTrack('t1')
    expect(sections).toHaveLength(1)
    expect(sections[0].id).toBe('auto-1')
    expect(sections[0].source).toBe('user-edited-auto')
    expect(sections[0].endSec).toBe(45)
  })

  it('preserves all original metadata when creating an override', () => {
    const { commitAutomaticSectionOverride, getManualSectionsForTrack } = useReactStore.getState()
    const original = makeSection({
      id:        'auto-2',
      label:     'Build',
      type:      'build',
      startSec:  30,
      endSec:    60,
      intensity: 0.8,
      confidence: 0.95,
      source:    'auto',
    })

    commitAutomaticSectionOverride('t1', original, { startSec: 25 })

    const [sec] = getManualSectionsForTrack('t1')
    expect(sec.label).toBe('Build')
    expect(sec.type).toBe('build')
    expect(sec.intensity).toBe(0.8)
    expect(sec.confidence).toBe(0.95)
    expect(sec.startSec).toBe(25)
    expect(sec.endSec).toBe(60)      // unchanged
  })

  it('does NOT mutate the original auto section object', () => {
    const { commitAutomaticSectionOverride } = useReactStore.getState()
    const original = makeSection({ id: 'auto-3', source: 'auto', endSec: 30 })
    const originalEnd = original.endSec

    commitAutomaticSectionOverride('t1', original, { endSec: 50 })

    expect(original.endSec).toBe(originalEnd)
    expect(original.source).toBe('auto')
  })

  it('updates an existing user-edited-auto entry in place', () => {
    const { commitAutomaticSectionOverride, getManualSectionsForTrack } = useReactStore.getState()
    const original = makeSection({ id: 'auto-4', source: 'auto', startSec: 0, endSec: 30 })

    // First edit: move end to 40
    commitAutomaticSectionOverride('t1', original, { endSec: 40 })
    // Second edit: move end again to 50
    commitAutomaticSectionOverride('t1', original, { endSec: 50 })

    const sections = getManualSectionsForTrack('t1')
    // Still only one entry (updated in place, not duplicated)
    expect(sections).toHaveLength(1)
    expect(sections[0].endSec).toBe(50)
    expect(sections[0].source).toBe('user-edited-auto')
  })

  it('override is isolated per track', () => {
    const { commitAutomaticSectionOverride, getManualSectionsForTrack } = useReactStore.getState()
    const original = makeSection({ id: 'auto-5', source: 'auto' })

    commitAutomaticSectionOverride('trackA', original, { endSec: 40 })

    expect(getManualSectionsForTrack('trackA')).toHaveLength(1)
    expect(getManualSectionsForTrack('trackB')).toHaveLength(0)
  })

  it('resolveTrackSections uses the override to replace the auto section', () => {
    const { commitAutomaticSectionOverride, getManualSectionsForTrack } = useReactStore.getState()

    const original = makeSection({ id: 'sec-drop', type: 'drop', source: 'auto', startSec: 30, endSec: 60 })
    commitAutomaticSectionOverride('t1', original, { startSec: 25 })

    const manualSections = getManualSectionsForTrack('t1')
    const resolved = resolveTrackSections({
      analyzedSections: [original],
      manualSections,
      durationSec: 120,
    })

    expect(resolved).toHaveLength(1)
    expect(resolved[0].startSec).toBe(25)  // override wins
    expect(resolved[0].source).toBe('user-edited-auto')
  })
})
