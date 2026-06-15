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
  useReactStore.setState({ manualTrackSectionsByTrackId: {}, selectedSectionId: null })
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
