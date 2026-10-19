import { describe, expect, it } from 'vitest'
import type { ReactPerformancePad, ReactPresetAutomationCue, ReactTrackSection } from '../../react/ReactTypes'
import { CINEMA2_EVENT_HORIZON_LOOK_ID, CINEMA2_EVENT_HORIZON_PRESET_ID } from '../presets/Cinema2EventHorizonPreset'
import { CINEMA2_REACTOR_PRESET_ID } from '../presets/Cinema2ReactorPreset'
import {
  migrateLegacyCinemaStoreToCinema2,
  migrateLegacyPerformancePadsToCinema2,
  migrateLegacyPresetAutomationCuesToCinema2,
  migrateLegacyReactSelectionToCinema2,
  migrateLegacyTrackSectionsToCinema2,
  resolveCinema2LegacySourceForComposition,
  resolveCinema2LegacyDestination,
} from '../migration/Cinema2LegacyStateMigration'
import { resolveLegacyCinemaPersistedActiveSource } from '../migration/Cinema2LegacyPersistenceReader'
import { createEmptyCinema2WorkspaceDocument } from '../runtime/Cinema2WorkspacePersistence'

describe('Cinema 2.0 Phase 4 legacy state migration', () => {
  it('resolves mapped and consolidated identities without substituting missing sources', () => {
    expect(resolveCinema2LegacyDestination('shaderPads', 'shader-reactor')).toMatchObject({
      schemaVersion: 1,
      engineId: 'cinema2',
      presetId: CINEMA2_REACTOR_PRESET_ID,
    })
    expect(resolveCinema2LegacyDestination('cinematicPortal', 'preset-quasar-maw')).toMatchObject({
      presetId: CINEMA2_EVENT_HORIZON_PRESET_ID,
      parameterPatch: { [CINEMA2_EVENT_HORIZON_LOOK_ID]: 'quasarMaw' },
    })
    expect(resolveCinema2LegacyDestination('cinematicPortal', 'preset-does-not-exist')).toBeNull()
    expect(resolveCinema2LegacyDestination('cinematicPortal', 'preset-neon-transit')).toBeNull()
  })

  it('decodes persisted legacy identities without loading the legacy runtime', () => {
    expect(resolveCinema2LegacySourceForComposition('legacy-shader-shader-reactor')).toEqual({
      sourceEngineId: 'shaderPads',
      sourceId: 'shader-reactor',
    })
    expect(resolveLegacyCinemaPersistedActiveSource({
      activeCompositionId: 'legacy-cinematic-preset-quasar-maw',
      compositions: [{
        id: 'legacy-cinematic-preset-quasar-maw',
        metadata: { provenance: { sourceEngine: 'cinematicPortal', sourceId: 'preset-quasar-maw' } },
      }],
    })).toEqual({ sourceEngineId: 'cinematicPortal', sourceId: 'preset-quasar-maw' })
  })

  it('replaces legacy pad, cue, and track references with versioned destinations', () => {
    const pad = {
      id: 'pad-legacy',
      presetId: null,
      cinemaCompositionId: 'composition:reactor',
      label: 'Reactor',
      color: '#fff',
      keyBinding: '1',
      transitionTimeMs: 400,
    } as unknown as ReactPerformancePad
    const cue = {
      id: 'cue-legacy',
      timeSec: 12,
      presetId: 'preset-quasar-maw',
      label: 'Quasar',
      enabled: true,
      transitionMs: 500,
    } as ReactPresetAutomationCue
    const section = {
      id: 'section-legacy',
      label: 'Drop',
      type: 'drop',
      startSec: 10,
      endSec: 20,
      intensity: 1,
      engineId: 'shaderPads',
      legacySourceId: 'shader-reactor',
    } as unknown as ReactTrackSection
    const resolveComposition = (compositionId: string) => compositionId === 'composition:reactor'
      ? { sourceEngineId: 'shaderPads' as const, sourceId: 'shader-reactor' }
      : null

    const migratedPad = migrateLegacyPerformancePadsToCinema2([pad], resolveComposition)[0]!
    const migratedCue = migrateLegacyPresetAutomationCuesToCinema2({ track: [cue] }, resolveComposition).track[0]!
    const migratedSection = migrateLegacyTrackSectionsToCinema2([section], resolveComposition)[0]!

    expect(migratedPad).toMatchObject({ presetId: null, destination: { engineId: 'cinema2', presetId: CINEMA2_REACTOR_PRESET_ID } })
    expect(migratedCue).toMatchObject({ presetId: null, destination: { engineId: 'cinema2', presetId: CINEMA2_EVENT_HORIZON_PRESET_ID } })
    expect(migratedSection).toMatchObject({ engineId: 'cinema2', destination: { presetId: CINEMA2_REACTOR_PRESET_ID } })
    expect(migratedPad).not.toHaveProperty('cinemaCompositionId')
    expect(migratedCue).not.toHaveProperty('cinemaCompositionId')
  })

  it('moves historical active selections directly into Cinema 2.0', () => {
    const result = migrateLegacyReactSelectionToCinema2({
      workspace: createEmptyCinema2WorkspaceDocument(),
      engineId: 'cinematicPortal',
      presetId: 'preset-quasar-maw',
    })
    expect(result.selectedLegacyEngine).toBe(true)
    expect(result.workspace.activePresetId).toBe(CINEMA2_EVENT_HORIZON_PRESET_ID)
    expect(result.workspace.presets[0]?.lookId).toBeNull()
  })

  it('archives the raw legacy document and marks the migration atomically and idempotently', () => {
    const legacyDocument = {
      schemaId: 'drmvyz.cinema.store',
      schemaVersion: 4,
      activeCompositionId: 'composition:reactor',
      compositions: [{ id: 'custom-composition', metadata: { name: 'User authored' } }],
    }
    const first = migrateLegacyCinemaStoreToCinema2({
      workspace: createEmptyCinema2WorkspaceDocument(),
      legacyDocument,
      activeSource: { sourceEngineId: 'shaderPads', sourceId: 'shader-reactor' },
      archivedAt: '2026-10-18T00:00:00.000Z',
    })
    const second = migrateLegacyCinemaStoreToCinema2({
      workspace: first,
      legacyDocument,
      activeSource: { sourceEngineId: 'shaderPads', sourceId: 'shader-reactor' },
      archivedAt: '2026-10-18T00:00:00.000Z',
    })

    expect(first.legacyMigrationVersion).toBe(1)
    expect(first.activePresetId).toBe(CINEMA2_REACTOR_PRESET_ID)
    expect(first.legacyArchive?.payload).toEqual(legacyDocument)
    expect(second).toEqual(first)
  })

  it('re-runs for a newly imported legacy package while remaining idempotent per source document', () => {
    const first = migrateLegacyCinemaStoreToCinema2({
      workspace: createEmptyCinema2WorkspaceDocument(),
      legacyDocument: { schemaVersion: 4, activeCompositionId: 'old' },
      activeSource: { sourceEngineId: 'shaderPads', sourceId: 'shader-reactor' },
      archivedAt: '2026-10-18T00:00:00.000Z',
    })
    const imported = migrateLegacyCinemaStoreToCinema2({
      workspace: first,
      legacyDocument: { schemaVersion: 4, activeCompositionId: 'imported' },
      activeSource: { sourceEngineId: 'cinematicPortal', sourceId: 'preset-quasar-maw' },
      archivedAt: '2026-10-19T00:00:00.000Z',
    })

    expect(imported).not.toEqual(first)
    expect(imported.activePresetId).toBe(CINEMA2_EVENT_HORIZON_PRESET_ID)
    expect(imported.legacyArchive?.payload).toMatchObject({ activeCompositionId: 'imported' })
    expect(imported.legacyMigrationFingerprint).not.toBe(first.legacyMigrationFingerprint)
  })
})
