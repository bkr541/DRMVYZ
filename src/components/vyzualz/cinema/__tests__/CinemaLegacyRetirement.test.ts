import { beforeEach, describe, expect, it } from 'vitest'
import { migrateReactStore, reactStorePartialize, useReactStore } from '../../../../stores/reactStore'
import { DEFAULT_PERFORMANCE_PADS, DEFAULT_REACT_PRESETS } from '../../react/ReactTypes'
import { DEFAULT_SHADER_SCENE_ID } from '../../react/shaders/scenes'
import {
  buildLegacyCinematicCinemaInstance,
  buildLegacyShaderCinemaInstance,
  migrateLegacyPerformancePadsToCinema,
  migrateLegacyPresetAutomationCuesToCinema,
  resolveCinemaLegacyCompositionId,
} from '../CinemaLegacyRetirement'
import { CINEMA_LEGACY_PRESET_CATALOG } from '../CinemaFoundation'
import { cinemaShaderParameterId } from '../CinemaShaderSceneAdapter'

const cinematicPreset = DEFAULT_REACT_PRESETS.find(preset => preset.engine === 'cinematicPortal')!

function compositionFor(engine: 'shaderPads' | 'cinematicPortal', sourceId: string) {
  const compositionId = resolveCinemaLegacyCompositionId(engine, sourceId)
  const composition = CINEMA_LEGACY_PRESET_CATALOG.compositions.find(candidate => candidate.id === compositionId)
  if (!composition) throw new Error(`Missing Stage-21 composition for ${engine}:${sourceId}`)
  return composition
}

describe('Cinema Stage 23 legacy engine retirement', () => {
  beforeEach(() => {
    useReactStore.getState().resetReactView()
  })

  it('maps every supported persisted React-store version to Cinema without losing the legacy source identity', () => {
    const base = reactStorePartialize(useReactStore.getState())

    for (let version = 0; version <= 66; version += 1) {
      const migrated = migrateReactStore({
        ...base,
        activeReactEngineId: 'cinematicPortal',
        activeReactPresetId: cinematicPreset.id,
      }, version)

      expect(migrated.activeReactEngineId, `version ${version}`).toBe('cinema')
      expect(migrated.activeReactPresetId, `version ${version}`).toBeNull()
      expect(migrated.pendingCinemaLegacySelectionMigration, `version ${version}`).toEqual({
        legacyEngineId: 'cinematicPortal',
        legacySourceId: cinematicPreset.id,
      })
    }
  })

  it('keeps Shader Pads as an import alias and defers the scene ID to the shader compatibility store', () => {
    const migrated = migrateReactStore({
      activeReactEngineId: 'shaderPads',
      activeReactPresetId: null,
    }, 66)

    expect(migrated.activeReactEngineId).toBe('cinema')
    expect(migrated.activeReactPresetId).toBeNull()
    expect(migrated.pendingCinemaLegacySelectionMigration).toEqual({
      legacyEngineId: 'shaderPads',
      legacySourceId: null,
    })
  })

  it('rewrites legacy performance-pad and automation-cue destinations to stable Stage-21 Cinema composition IDs', () => {
    const expectedCompositionId = resolveCinemaLegacyCompositionId('cinematicPortal', cinematicPreset.id)
    expect(expectedCompositionId).not.toBeNull()

    const pads = migrateLegacyPerformancePadsToCinema([{
      ...DEFAULT_PERFORMANCE_PADS[0],
      id: 'pad-stage23',
      label: 'Legacy World',
      presetId: cinematicPreset.id,
    }])
    const cues = migrateLegacyPresetAutomationCuesToCinema({
      track: [{ id: 'cue-stage23', timeSec: 12, presetId: cinematicPreset.id, label: 'World', enabled: true, transitionMs: 250 }],
    })

    expect(pads[0]).toMatchObject({ presetId: null, cinemaCompositionId: expectedCompositionId })
    expect(cues.track[0]).toMatchObject({ presetId: null, cinemaCompositionId: expectedCompositionId })
  })

  it('preserves authored Shader values and master controls in a Cinema composition instance', () => {
    const composition = compositionFor('shaderPads', DEFAULT_SHADER_SCENE_ID)
    const instance = buildLegacyShaderCinemaInstance({
      composition,
      sceneId: DEFAULT_SHADER_SCENE_ID,
      shaderValues: { speed: 2.75 },
      masterControls: {
        intensity: 0.61,
        motion: 0.72,
        glow: 0.83,
        bassReactivity: 0.94,
        trailDecay: 0.15,
        fogDensity: 0.26,
        particleDensity: 0.37,
      },
    })

    expect(instance.compositionId).toBe(composition.id)
    expect(instance.nodeOverrides[0]?.values[cinemaShaderParameterId('speed')]).toBe(2.75)
    expect(instance.masterOverrides[cinemaShaderParameterId('master-intensity')]).toBe(0.61)
    expect(instance.metadata).toMatchObject({ sourceEngine: 'shaderPads', sourceId: DEFAULT_SHADER_SCENE_ID })
  })

  it('reconstructs a Cinematic Worlds preset as an instance of its immutable Stage-21 composition', () => {
    const composition = compositionFor('cinematicPortal', cinematicPreset.id)
    const instance = buildLegacyCinematicCinemaInstance({
      composition,
      preset: cinematicPreset,
      config: cinematicPreset.cinematicConfig ?? null,
      masterControls: {
        intensity: 0.41,
        motion: 0.52,
        glow: 0.63,
        bassReactivity: 0.74,
        trailDecay: 0.18,
        fogDensity: 0.29,
        particleDensity: 0.31,
      },
    })

    expect(instance.compositionId).toBe(composition.id)
    expect(instance.nodeOverrides).toHaveLength(1)
    expect(instance.cameraOverrides.length).toBe(composition.cameras.length)
    expect(instance.metadata).toMatchObject({ sourceEngine: 'cinematicPortal', sourceId: cinematicPreset.id })
  })
})
