import { describe, expect, it } from 'vitest'
import { cinema2NativePresetRegistry } from '../presets/Cinema2PresetRegistry'
import { cinema2SlotSupportsPool } from '../media/Cinema2SourceCapabilities'
import { CINEMA2_EVERYWHERE_PRESET_ID } from '../presets/Cinema2EverywherePreset'
import { CINEMA2_CORRIDOR_PRESET_ID } from '../presets/Cinema2CorridorPreset'
import {
  CINEMA2_REACTOR_CORE_SIZE_ID,
  CINEMA2_REACTOR_PRESET_ID,
  CINEMA2_REACTOR_USER_MEDIA_SLOT_ID,
} from '../presets/Cinema2ReactorPreset'
import { CINEMA2_LEGACY_SOURCE_MIGRATIONS } from '../migration/Cinema2LegacyMigrationManifest'
import {
  CINEMA2_WORKSPACE_SCHEMA_ID,
  CINEMA2_WORKSPACE_SCHEMA_VERSION,
  activateCinema2Workspace,
  archiveLegacyCinemaDocument,
  createEmptyCinema2WorkspaceDocument,
  exportCinema2LegacyArchive,
  getCinema2WorkspacePresetState,
  parseCinema2WorkspaceDocument,
  migrateCinema2LegacyPoolSelection,
  reconcileCinema2PoolReferences,
  removeCinema2MediaReferences,
  storeCinema2WorkspacePresetState,
} from '../runtime/Cinema2WorkspacePersistence'

const MEDIA_ASSIGNMENT = Object.freeze({
  slotId: CINEMA2_REACTOR_USER_MEDIA_SLOT_ID,
  source: Object.freeze({
    id: 'media-library:hero',
    revision: 3,
    label: 'Hero',
    kind: 'image' as const,
    url: 'https://media.example/hero.png',
    mimeType: 'image/png',
  }),
  presentation: Object.freeze({
    fit: 'cover' as const,
    position: Object.freeze([0.5, 0.4] as const),
    scale: Object.freeze([1, 1] as const),
    rotation: 0,
    opacity: 0.85,
  }),
})

describe('Cinema 2.0 durable workspace state', () => {
  it('keeps the legacy per-preset pool pointer scoped to one authored pool slot', () => {
    for (const manifest of cinema2NativePresetRegistry.list()) {
      expect(manifest.mediaSlots?.filter(slot => cinema2SlotSupportsPool(slot.id)).length ?? 0, manifest.id).toBeLessThanOrEqual(1)
    }
  })

  it('keeps pool choice scoped to its preset across switching, retirement and reload', () => {
    const first = activateCinema2Workspace(createEmptyCinema2WorkspaceDocument(), { presetId: CINEMA2_EVERYWHERE_PRESET_ID })
    if (!first.ok) throw new Error('Could not activate Everywhere')
    const saved = storeCinema2WorkspacePresetState(first.document, { ...first.state, poolId: 'pool-one' })
    const second = activateCinema2Workspace(saved, { presetId: CINEMA2_CORRIDOR_PRESET_ID })
    if (!second.ok) throw new Error('Could not activate Corridor')
    expect(second.state.poolId).toBeNull()
    const retired = storeCinema2WorkspacePresetState(second.document, { presetId: first.state.presetId, serializedParameterState: first.state.serializedParameterState, mediaSlots: [] })
    const reloaded = parseCinema2WorkspaceDocument(JSON.parse(JSON.stringify(retired)))
    expect(getCinema2WorkspacePresetState(reloaded.value, CINEMA2_EVERYWHERE_PRESET_ID)?.poolId).toBe('pool-one')
    expect(getCinema2WorkspacePresetState(reloaded.value, CINEMA2_CORRIDOR_PRESET_ID)?.poolId).toBeNull()
    const reset = storeCinema2WorkspacePresetState(reloaded.value, { ...first.state, poolId: null })
    expect(getCinema2WorkspacePresetState(reset, CINEMA2_EVERYWHERE_PRESET_ID)?.poolId).toBeNull()
  })

  it('normalizes malformed pool IDs without inheriting a different Canvas pool', () => {
    const first = activateCinema2Workspace(createEmptyCinema2WorkspaceDocument(), { presetId: CINEMA2_EVERYWHERE_PRESET_ID })
    if (!first.ok) throw new Error('Could not activate Everywhere')
    for (const poolId of [42, {}, '', '   ']) {
      const input = { ...first.document, presets: [{ ...first.state, poolId }] }
      const normalized = parseCinema2WorkspaceDocument(input).value
      expect(migrateCinema2LegacyPoolSelection(normalized, 'unrelated').presets[0]?.poolId).toBeNull()
    }
    const { poolId: _poolId, ...legacy } = first.state
    const old = parseCinema2WorkspaceDocument({ ...first.document, presets: [legacy] }).value
    const migrated = migrateCinema2LegacyPoolSelection(old, 'legacy')
    expect(migrated.presets[0]?.poolId).toBe('legacy')
    expect(reconcileCinema2PoolReferences(migrated, [{ id: 'legacy' }])).toBe(migrated)
    expect(reconcileCinema2PoolReferences(migrated, []).presets[0]?.poolId).toBeNull()
  })

  it('removes only confirmed deleted individual media assignments', () => {
    const activated = activateCinema2Workspace(createEmptyCinema2WorkspaceDocument(), {
      presetId: CINEMA2_REACTOR_PRESET_ID, mediaPatch: [MEDIA_ASSIGNMENT],
    })
    if (!activated.ok) throw new Error('Could not activate Reactor')
    expect(removeCinema2MediaReferences(activated.document, 'unrelated')).toBe(activated.document)
    const cleaned = removeCinema2MediaReferences(activated.document, MEDIA_ASSIGNMENT.source.id)
    expect(cleaned.presets[0]?.mediaSlots).toEqual([])
    expect(cleaned.presets[0]?.serializedParameterState).toBe(activated.state.serializedParameterState)
    expect(cleaned.activationRevision).toBe(activated.document.activationRevision)
  })

  it('accepts every mapped Phase 1 migration destination through the activation contract', () => {
    for (const migration of CINEMA2_LEGACY_SOURCE_MIGRATIONS) {
      if (migration.disposition !== 'migrate') continue
      const result = activateCinema2Workspace(createEmptyCinema2WorkspaceDocument(), {
        presetId: migration.destination.presetId,
        parameterPatch: migration.destination.parameterPatch,
      })
      expect(result.ok, `${migration.sourceEngineId}:${migration.sourceId}`).toBe(true)
    }
  })

  it('activates a registered destination and round-trips preset, look, parameters, and media', () => {
    const activated = activateCinema2Workspace(createEmptyCinema2WorkspaceDocument(), {
      presetId: CINEMA2_REACTOR_PRESET_ID,
      look: { id: 'hero-reactor' },
      parameterPatch: { [CINEMA2_REACTOR_CORE_SIZE_ID]: 1.05 },
      mediaPatch: [MEDIA_ASSIGNMENT],
    })
    expect(activated.ok).toBe(true)
    if (!activated.ok) return

    const reloaded = parseCinema2WorkspaceDocument(JSON.parse(JSON.stringify(activated.document)))
    expect(reloaded.ok).toBe(true)
    expect(reloaded.value.activePresetId).toBe(CINEMA2_REACTOR_PRESET_ID)
    expect(reloaded.value.activationRevision).toBe(1)
    expect(getCinema2WorkspacePresetState(reloaded.value, CINEMA2_REACTOR_PRESET_ID)).toMatchObject({
      lookId: 'hero-reactor',
      mediaSlots: [{ slotId: CINEMA2_REACTOR_USER_MEDIA_SLOT_ID, source: { id: 'media-library:hero' } }],
    })
    expect(JSON.parse(activated.state.serializedParameterState).values[CINEMA2_REACTOR_CORE_SIZE_ID]).toBe(1.05)
  })

  it('keeps runtime-retirement saves durable without creating a new activation', () => {
    const activated = activateCinema2Workspace(createEmptyCinema2WorkspaceDocument(), {
      presetId: CINEMA2_REACTOR_PRESET_ID,
    })
    expect(activated.ok).toBe(true)
    if (!activated.ok) return

    const stored = storeCinema2WorkspacePresetState(activated.document, {
      ...activated.state,
      serializedParameterState: activated.state.serializedParameterState,
      mediaSlots: [MEDIA_ASSIGNMENT],
    })
    expect(stored.activationRevision).toBe(activated.document.activationRevision)
    expect(getCinema2WorkspacePresetState(stored, CINEMA2_REACTOR_PRESET_ID)?.mediaSlots).toHaveLength(1)
  })

  it('fails closed for unsupported schema versions and invalid activation patches', () => {
    const unsupported = parseCinema2WorkspaceDocument({
      schemaId: CINEMA2_WORKSPACE_SCHEMA_ID,
      schemaVersion: CINEMA2_WORKSPACE_SCHEMA_VERSION + 1,
      presets: [],
    })
    expect(unsupported.ok).toBe(false)
    expect(unsupported.value).toEqual(createEmptyCinema2WorkspaceDocument())

    const invalidPatch = activateCinema2Workspace(createEmptyCinema2WorkspaceDocument(), {
      presetId: CINEMA2_REACTOR_PRESET_ID,
      parameterPatch: { 'missing-parameter': true },
    })
    expect(invalidPatch.ok).toBe(false)
    expect(invalidPatch.document).toEqual(createEmptyCinema2WorkspaceDocument())
  })

  it('preserves and exports a lossless legacy Cinema document for save/save-as recovery', () => {
    const legacy = {
      schemaId: 'drmvyz.cinema.store',
      schemaVersion: 8,
      compositions: [{ id: 'custom-composition', name: 'My Show' }],
      instances: [{ id: 'custom-instance', compositionId: 'custom-composition' }],
      collections: [{ id: 'favorites', compositionIds: ['custom-composition'] }],
      editorMetadata: { selectedNodeIds: ['custom-node'] },
    }
    const archived = archiveLegacyCinemaDocument(
      createEmptyCinema2WorkspaceDocument(),
      legacy,
      '2026-10-18T12:00:00.000Z',
    )
    const exported = exportCinema2LegacyArchive(archived)
    expect(exported).not.toBeNull()
    expect(JSON.parse(exported!).payload).toEqual(legacy)

    const saveAsCopy = parseCinema2WorkspaceDocument(JSON.parse(JSON.stringify(archived)))
    expect(saveAsCopy.ok).toBe(true)
    expect(saveAsCopy.value.legacyArchive?.payload).toEqual(legacy)
  })
})
