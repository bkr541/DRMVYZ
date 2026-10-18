import { describe, expect, it } from 'vitest'
import {
  CINEMA_CINEMATIC_PRESET_CATALOG_EXCLUSIONS,
  CINEMA_LEGACY_PRESET_CATALOG,
} from '..'
import {
  CINEMA2_LEGACY_CUSTOM_CONTENT_POLICY,
  CINEMA2_LEGACY_ENGINE_IDS,
  CINEMA2_LEGACY_SOURCE_MIGRATIONS,
  cinema2LegacySourceKey,
  resolveCinema2LegacySourceMigration,
} from '../../cinema2/migration/Cinema2LegacyMigrationManifest'
import { Cinema2ParameterState } from '../../cinema2/parameters/Cinema2ParameterState'
import { cinema2NativePresetRegistry } from '../../cinema2/presets/Cinema2PresetRegistry'
import { DEFAULT_REACT_PRESETS } from '../../react/ReactTypes'
import { PRODUCTION_SCENES, SHADER_SCENE_REGISTRY_AUDIT } from '../../react/shaders/scenes'

const catalogKeys = new Set(CINEMA_LEGACY_PRESET_CATALOG.manifest.map(entry => (
  cinema2LegacySourceKey(entry.legacyEngineId, entry.legacySourceId)
)))

const expectedCompatibilityKeys = [
  ...PRODUCTION_SCENES.map(scene => cinema2LegacySourceKey('shaderPads', scene.id)),
  ...Object.keys(SHADER_SCENE_REGISTRY_AUDIT).map(sceneId => cinema2LegacySourceKey('shaderPads', sceneId)),
  ...DEFAULT_REACT_PRESETS
    .filter(preset => preset.engine === 'cinematicPortal')
    .map(preset => cinema2LegacySourceKey('cinematicPortal', preset.id)),
].sort()

describe('Cinema 2.0 legacy removal migration manifest', () => {
  it('accounts exactly once for every known Shader and Cinematic Worlds source identity', () => {
    const actualKeys = CINEMA2_LEGACY_SOURCE_MIGRATIONS.map(entry => (
      cinema2LegacySourceKey(entry.sourceEngineId, entry.sourceId)
    )).sort()

    expect(actualKeys).toEqual(expectedCompatibilityKeys)
    expect(new Set(actualKeys).size).toBe(actualKeys.length)
    expect(CINEMA2_LEGACY_ENGINE_IDS).toEqual(['cinema', 'shaderPads', 'cinematicPortal'])
  })

  it('classifies the active Cinema catalog separately from compatibility-only sources', () => {
    for (const entry of CINEMA2_LEGACY_SOURCE_MIGRATIONS) {
      const key = cinema2LegacySourceKey(entry.sourceEngineId, entry.sourceId)
      expect(entry.availability, key).toBe(catalogKeys.has(key) ? 'cinema-catalog' : 'compatibility-only')
    }

    expect(catalogKeys.size).toBe(CINEMA_LEGACY_PRESET_CATALOG.manifest.length)
    expect(Object.keys(CINEMA_CINEMATIC_PRESET_CATALOG_EXCLUSIONS).length).toBeGreaterThan(0)
  })

  it('maps every carried-forward source to a registered preset with a valid parameter patch', () => {
    for (const entry of CINEMA2_LEGACY_SOURCE_MIGRATIONS) {
      if (entry.disposition !== 'migrate') continue
      const compiled = cinema2NativePresetRegistry.compile(entry.destination.presetId)
      expect(compiled.ok, `${entry.sourceEngineId}:${entry.sourceId}`).toBe(true)
      if (!compiled.ok) continue

      const state = new Cinema2ParameterState(compiled.plan.parameters)
      for (const [parameterId, value] of Object.entries(entry.destination.parameterPatch ?? {})) {
        expect(
          state.setPersistentValue(parameterId as Parameters<typeof state.setPersistentValue>[0], value),
          `${entry.sourceEngineId}:${entry.sourceId} -> ${parameterId}`,
        ).toMatchObject({ ok: true })
      }
    }
  })

  it('requires an explicit archive disposition for every intentionally retired source', () => {
    const retired = CINEMA2_LEGACY_SOURCE_MIGRATIONS.filter(entry => entry.disposition === 'retire')
    expect(retired.length).toBeGreaterThan(0)
    for (const entry of retired) {
      expect(entry.reason.trim().length, entry.sourceId).toBeGreaterThan(0)
      expect(entry.recovery).toBe('preserve-in-legacy-archive')
    }
    expect(CINEMA2_LEGACY_CUSTOM_CONTENT_POLICY.silentDeletionAllowed).toBe(false)
  })

  it('resolves migrations by stable source identity', () => {
    const source = CINEMA2_LEGACY_SOURCE_MIGRATIONS[0]
    expect(source).toBeDefined()
    if (!source) return
    expect(resolveCinema2LegacySourceMigration(source.sourceEngineId, source.sourceId)).toBe(source)
    expect(resolveCinema2LegacySourceMigration('shaderPads', 'unknown-source')).toBeNull()
  })
})
