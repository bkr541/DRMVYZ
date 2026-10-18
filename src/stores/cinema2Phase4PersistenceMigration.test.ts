import { describe, expect, it } from 'vitest'
import { createEmptyCinema2WorkspaceDocument } from '../components/vyzualz/cinema2/runtime/Cinema2WorkspacePersistence'
import { CINEMA2_EVENT_HORIZON_PRESET_ID } from '../components/vyzualz/cinema2/presets/Cinema2EventHorizonPreset'
import { CINEMA2_REACTOR_PRESET_ID } from '../components/vyzualz/cinema2/presets/Cinema2ReactorPreset'
import { migrateReactStore } from './reactStore'

const historicalFixture = {
  activeReactEngineId: 'cinematicPortal',
  activeReactPresetId: 'preset-quasar-maw',
  cinema2Workspace: createEmptyCinema2WorkspaceDocument(),
  performancePads: [{
    id: 'pad-1',
    presetId: 'preset-singularity-crown',
    label: 'Crown',
    color: '#fff',
    keyBinding: '1',
    transitionTimeMs: 300,
  }],
  presetAutomationCuesByTrackId: {
    track: [{
      id: 'cue-1',
      timeSec: 4,
      presetId: 'preset-singularity-crown',
      label: 'Crown',
      enabled: true,
      transitionMs: 200,
    }],
  },
  manualTrackSectionsByTrackId: {
    track: [{
      id: 'section-1',
      label: 'Drop',
      type: 'drop',
      startSec: 0,
      endSec: 8,
      intensity: 1,
      engineId: 'shaderPads',
      legacySourceId: 'shader-reactor',
    }],
  },
}

describe('React persistence Phase 4 Cinema migration', () => {
  it.each(['local state', 'project import', 'package import'])('applies identical migration rules to %s', () => {
    const migrated = migrateReactStore(structuredClone(historicalFixture), 77)
    expect(migrated.activeReactEngineId).toBe('cinema2')
    expect(migrated.activeReactPresetId).toBeNull()
    expect(migrated.pendingCinemaLegacySelectionMigration).toBeNull()
    expect((migrated.cinema2Workspace as ReturnType<typeof createEmptyCinema2WorkspaceDocument>).activePresetId)
      .toBe(CINEMA2_EVENT_HORIZON_PRESET_ID)
    expect((migrated.performancePads as Array<Record<string, unknown>>)[0]).toMatchObject({
      presetId: null,
      destination: { engineId: 'cinema2', presetId: CINEMA2_EVENT_HORIZON_PRESET_ID },
    })
    expect((migrated.presetAutomationCuesByTrackId as Record<string, Array<Record<string, unknown>>>).track[0])
      .toMatchObject({ presetId: null, destination: { engineId: 'cinema2' } })
    expect((migrated.manualTrackSectionsByTrackId as Record<string, Array<Record<string, unknown>>>).track[0])
      .toMatchObject({ engineId: 'cinema2', destination: { presetId: CINEMA2_REACTOR_PRESET_ID } })
  })

  it('is stable when the current-version migration boundary runs again', () => {
    const first = migrateReactStore(structuredClone(historicalFixture), 77)
    const second = migrateReactStore(structuredClone(first), 78)
    expect(second).toEqual(first)
  })
})
