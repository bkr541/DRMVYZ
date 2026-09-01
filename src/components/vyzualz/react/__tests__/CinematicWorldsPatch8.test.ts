import { beforeEach, describe, expect, it } from 'vitest'
import {
  createDefaultCinematicWorldConfig,
  normalizeCinematicWorldConfig,
} from '../CinematicWorldConfig'
import {
  CINEMATIC_WORLD_UI,
  CINEMATIC_SOURCE_LABELS,
  CINEMATIC_TARGET_LABELS,
  nextCinematicVariationSeed,
  randomizeCinematicVariationSeed,
} from '../CinematicWorldsUi'
import { DEFAULT_REACT_PRESETS } from '../ReactTypes'
import {
  REACT_PROJECT_STATE_KEYS,
  mergeReactStoreState,
  migrateReactStore,
  reactStorePartialize,
  resolveCinematicConfigForPreset,
  useReactStore,
} from '../../../../stores/reactStore'

const eventHorizon = DEFAULT_REACT_PRESETS.find(preset => preset.cinematicConfig?.worldMode === 'eventHorizon')!

describe('Cinematic Worlds Patch 8 metadata and compatibility', () => {
  it('keeps the internal engine ID while exposing every implemented world with human labels', () => {
    expect(eventHorizon.engine).toBe('cinematicPortal')
    expect(CINEMATIC_WORLD_UI.map(world => world.id)).toEqual([
      'eventHorizon', 'infiniteCorridor', 'fractureRift', 'monolithGate', 'liquidMembrane',
      'celestialCathedral', 'mirrorDimension', 'ancientMachine', 'stormGateway', 'orbitalPrismArray', 'reactiveConstellation', 'legacyPortal',
    ])
    expect(CINEMATIC_WORLD_UI.every(world => world.label && world.description && world.category)).toBe(true)
  })

  it('uses readable source and target names rather than internal identifiers', () => {
    expect(CINEMATIC_SOURCE_LABELS.trackEnergy).toBe('Track Energy Curve')
    expect(CINEMATIC_SOURCE_LABELS.dropEntry).toBe('Drop Entry')
    expect(CINEMATIC_TARGET_LABELS.geometryRotation).toBe('Geometry Rotation')
    expect(CINEMATIC_TARGET_LABELS.environmentBrightness).toBe('Environment Brightness')
  })

  it('produces deterministic, serializable variation navigation', () => {
    expect(nextCinematicVariationSeed(0, -1)).toBe(0xffffffff)
    expect(nextCinematicVariationSeed(0xffffffff, 1)).toBe(0)
    expect(randomizeCinematicVariationSeed(47003)).toBe(randomizeCinematicVariationSeed(47003))
    expect(randomizeCinematicVariationSeed(47003)).not.toBe(47003)
  })

  it('normalizes safe Auto Director ranges and the Auto quality tier', () => {
    const normalized = normalizeCinematicWorldConfig({
      ...createDefaultCinematicWorldConfig(),
      qualityTier: 'auto',
      camera: {
        ...createDefaultCinematicWorldConfig().camera,
        autoDirector: {
          ...createDefaultCinematicWorldConfig().camera.autoDirector,
          strength: 50,
          cameraActivity: -4,
          transitionFrequency: 9,
          dropImpact: -1,
          buildIntensity: 4,
          manualCameraLock: true,
        },
      },
    })
    expect(normalized.qualityTier).toBe('auto')
    expect(normalized.camera.autoDirector).toMatchObject({
      strength: 1,
      cameraActivity: 0,
      transitionFrequency: 1,
      dropImpact: 0,
      buildIntensity: 1,
      manualCameraLock: true,
    })
  })
})

describe('Cinematic Worlds authored state serialization', () => {
  beforeEach(() => useReactStore.getState().resetReactView())

  it('preserves overrides and seed locks while switching engines and presets', () => {
    const base = resolveCinematicConfigForPreset(eventHorizon, {})!
    const edited = { ...base, seed: 998877, qualityTier: 'medium' as const }
    useReactStore.getState().selectReactPreset(eventHorizon.id)
    useReactStore.getState().setCinematicConfigForPreset(eventHorizon.id, edited)
    useReactStore.getState().setCinematicSeedLocked(eventHorizon.id, true)
    useReactStore.getState().selectReactEngine('oscilloscope')
    useReactStore.getState().selectReactPreset(eventHorizon.id)

    const restored = useReactStore.getState()
    expect(restored.cinematicConfigsByPresetId[eventHorizon.id]).toMatchObject({ seed: 998877, qualityTier: 'medium' })
    expect(restored.cinematicSeedLocksByPresetId[eventHorizon.id]).toBe(true)
  })

  it('places authored Cinematic Worlds state in the project payload', () => {
    const base = resolveCinematicConfigForPreset(eventHorizon, {})!
    useReactStore.getState().setCinematicConfigForPreset(eventHorizon.id, { ...base, seed: 112233 })
    useReactStore.getState().setCinematicSeedLocked(eventHorizon.id, true)
    useReactStore.getState().setCinematicWorldsUiMode('advanced')
    const persisted = reactStorePartialize(useReactStore.getState())

    expect(REACT_PROJECT_STATE_KEYS).toContain('cinematicConfigsByPresetId')
    expect(REACT_PROJECT_STATE_KEYS).toContain('cinematicSeedLocksByPresetId')
    expect(REACT_PROJECT_STATE_KEYS).toContain('cinematicWorldsUiMode')
    expect(persisted.cinematicConfigsByPresetId[eventHorizon.id].seed).toBe(112233)
    expect(persisted.cinematicSeedLocksByPresetId[eventHorizon.id]).toBe(true)
    expect(persisted.cinematicWorldsUiMode).toBe('advanced')
  })

  it('round-trips deterministic randomization through the merge used by reload', () => {
    const current = useReactStore.getState()
    const base = resolveCinematicConfigForPreset(eventHorizon, {})!
    const seed = randomizeCinematicVariationSeed(base.seed)
    const merged = mergeReactStoreState({
      cinematicConfigsByPresetId: { [eventHorizon.id]: { ...base, seed } },
      cinematicSeedLocksByPresetId: { [eventHorizon.id]: true },
    }, current)

    expect(merged.cinematicConfigsByPresetId[eventHorizon.id].seed).toBe(seed)
    expect(merged.cinematicSeedLocksByPresetId[eventHorizon.id]).toBe(true)
  })

  it('loads old projects without Cinematic Worlds overrides and keeps legacy portal visuals', () => {
    const legacy = {
      ...eventHorizon,
      id: 'preset-legacy-compatibility-fixture',
      name: 'Legacy Compatibility Fixture',
      cinematicConfig: undefined,
    }
    const migrated = migrateReactStore({
      activeReactPresetId: legacy.id,
      activeReactEngineId: 'cinematicPortal',
      reactPresets: [{ ...legacy, cinematicConfig: undefined }],
    }, 23)
    const migratedPreset = (migrated.reactPresets as typeof DEFAULT_REACT_PRESETS)[0]

    expect(migratedPreset.engine).toBe('cinematicPortal')
    expect(migratedPreset.cinematicConfig?.worldMode).toBe('legacyPortal')
    expect(migrated.cinematicConfigsByPresetId).toEqual({})
    expect(migrated.cinematicSeedLocksByPresetId).toEqual({})
  })
})
