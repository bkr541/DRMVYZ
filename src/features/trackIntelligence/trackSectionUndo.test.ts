import { describe, expect, it } from 'vitest'
import type { ReactPresetAutomationCue, ReactTrackSection } from '../../components/vyzualz/react/ReactTypes'
import {
  captureTrackSectionUndoSnapshot,
  restoreTrackSectionUndoSnapshot,
  type TrackSectionUndoState,
} from './trackSectionUndo'

function section(id: string, label: string): ReactTrackSection {
  return {
    id,
    label,
    type: 'intro',
    startSec: 0,
    endSec: 10,
    intensity: 0.5,
    source: 'user-created',
  }
}

function cue(id: string): ReactPresetAutomationCue {
  return {
    id,
    timeSec: 0,
    presetId: 'preset-test',
    label: 'Intro → Test',
    enabled: true,
    transitionMs: 0,
    sectionId: 'section-a',
  }
}

function state(): TrackSectionUndoState {
  return {
    manualTrackSectionsByTrackId: {
      'track-a': [section('section-a', 'Original')],
      'track-b': [section('section-b', 'Other track')],
    },
    suppressedAutoSectionsByTrackId: {
      'track-a': ['auto-a'],
      'track-b': ['auto-b'],
    },
    presetAutomationCuesByTrackId: {
      'track-a': [cue('cue-a')],
      'track-b': [cue('cue-b')],
    },
    selectedSectionByTrackId: {
      'track-a': 'section-a',
      'track-b': 'section-b',
    },
    selectedSectionId: 'section-a',
  }
}

describe('Track Section undo snapshots', () => {
  it('restores one track atomically without changing another track', () => {
    const before = state()
    const snapshot = captureTrackSectionUndoSnapshot(before, 'track-a')
    const edited: TrackSectionUndoState = {
      ...before,
      manualTrackSectionsByTrackId: {
        ...before.manualTrackSectionsByTrackId,
        'track-a': [section('section-a', 'Edited')],
      },
      suppressedAutoSectionsByTrackId: {
        ...before.suppressedAutoSectionsByTrackId,
        'track-a': [],
      },
      presetAutomationCuesByTrackId: {
        ...before.presetAutomationCuesByTrackId,
        'track-a': [],
      },
      selectedSectionByTrackId: {
        ...before.selectedSectionByTrackId,
        'track-a': null,
      },
      selectedSectionId: null,
    }

    const restored = restoreTrackSectionUndoSnapshot(edited, 'track-a', snapshot)

    expect(restored.manualTrackSectionsByTrackId['track-a'][0]?.label).toBe('Original')
    expect(restored.suppressedAutoSectionsByTrackId['track-a']).toEqual(['auto-a'])
    expect(restored.presetAutomationCuesByTrackId['track-a']).toHaveLength(1)
    expect(restored.selectedSectionByTrackId['track-a']).toBe('section-a')
    expect(restored.selectedSectionId).toBe('section-a')
    expect(restored.manualTrackSectionsByTrackId['track-b'][0]?.label).toBe('Other track')
    expect(restored.suppressedAutoSectionsByTrackId['track-b']).toEqual(['auto-b'])
  })

  it('captures immutable copies rather than live store arrays', () => {
    const current = state()
    const snapshot = captureTrackSectionUndoSnapshot(current, 'track-a')

    current.manualTrackSectionsByTrackId['track-a'][0]!.label = 'Mutated later'
    current.suppressedAutoSectionsByTrackId['track-a'].push('auto-later')
    current.presetAutomationCuesByTrackId['track-a'][0]!.label = 'Mutated cue'

    expect(snapshot.manualSections[0]?.label).toBe('Original')
    expect(snapshot.suppressedAutoSectionIds).toEqual(['auto-a'])
    expect(snapshot.presetAutomationCues[0]?.label).toBe('Intro → Test')
  })
})
