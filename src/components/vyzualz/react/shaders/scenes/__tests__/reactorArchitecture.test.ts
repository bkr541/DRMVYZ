import { beforeEach, describe, expect, it } from 'vitest'
import { ShaderLibrary } from '../../library/ShaderLibrary'
import { migrateShaderLibraryPersistedState } from '../../library/ShaderLibraryStore'
import { ShaderDefinitionValidator } from '../../registry/ShaderDefinitionValidator'
import { validateParamValue } from '../../registry/ShaderParameterSchema'
import type { ShaderParamValues } from '../../registry/shaderRegistryTypes'
import {
  LEGACY_REACTOR_SCENE_IDS,
  REACTOR,
  REACTOR_RECIPE_CONFIGS,
  REACTOR_SCENE_ID,
  applyReactorRecipe,
  isReactorParamVisible,
} from '../reactor'
import {
  migrateLegacyReactorParamValues,
  migrateLegacyReactorSceneId,
} from '../reactorMigration'
import {
  mergeShaderPanelState,
  useShaderPanelStore,
} from '../../ui/shaderPanelStore'

const LEGACY_IDS = Object.values(LEGACY_REACTOR_SCENE_IDS)
const RECIPE_IDS = ['semantic', 'shrapnel', 'singularity', 'hybrid'] as const

describe('Reactor unified Shader architecture', () => {
  beforeEach(() => {
    useShaderPanelStore.setState({
      activeShaderId: null,
      paramValuesByShaderId: {},
      paramValues: {},
      modulatedValues: {},
      routesByShaderId: {},
      textureSelectionsByShaderId: {},
    })
  })

  it('shows one canonical Reactor card while keeping legacy scenes internal', () => {
    const library = new ShaderLibrary(new Map(), new Set(), new Map(), [], new Set())
    const bundled = library.getBundled()
    const unifiedEntries = bundled.filter(definition => (
      definition.id === REACTOR_SCENE_ID || LEGACY_IDS.includes(definition.id as typeof LEGACY_IDS[number])
    ))

    expect(unifiedEntries.map(definition => definition.id)).toEqual([REACTOR_SCENE_ID])
    expect(unifiedEntries[0]?.name).toBe('Reactor')
    expect(library.getEntry(LEGACY_REACTOR_SCENE_IDS.semantic)?.definition.id).toBe(REACTOR_SCENE_ID)
  })

  it('centralizes legacy scene migration and preserves each legacy recipe', () => {
    expect(migrateLegacyReactorSceneId(LEGACY_REACTOR_SCENE_IDS.semantic)).toBe(REACTOR_SCENE_ID)
    expect(migrateLegacyReactorSceneId(LEGACY_REACTOR_SCENE_IDS.shrapnel)).toBe(REACTOR_SCENE_ID)
    expect(migrateLegacyReactorSceneId(LEGACY_REACTOR_SCENE_IDS.singularity)).toBe(REACTOR_SCENE_ID)

    expect(migrateLegacyReactorParamValues(LEGACY_REACTOR_SCENE_IDS.semantic, {
      cellCount: 14,
      spin: 1.65,
    })).toMatchObject({
      recipe: 'semantic',
      semanticCellCount: 14,
      angularMovement: 1.65,
      semanticGeometryEnabled: true,
      shrapnelEnabled: false,
    })

    expect(migrateLegacyReactorParamValues(LEGACY_REACTOR_SCENE_IDS.shrapnel, {
      shardCount: 52,
      trailAmount: 0.94,
    })).toMatchObject({
      recipe: 'shrapnel',
      shardCount: 52,
      trailPersistence: 0.94,
      shrapnelEnabled: true,
      semanticGeometryEnabled: false,
    })

    expect(migrateLegacyReactorParamValues(LEGACY_REACTOR_SCENE_IDS.singularity, {
      coreScale: 1.4,
      refraction: 1.75,
    })).toMatchObject({
      recipe: 'singularity',
      logoScale: 1.4,
      refractionAmount: 1.75,
      brandCoreEnabled: true,
      mediaRefractionEnabled: true,
    })
  })

  it('migrates persisted selection, favorites, collections, recent items, and saved presets', () => {
    const panelState = mergeShaderPanelState({
      activeShaderId: LEGACY_REACTOR_SCENE_IDS.semantic,
      paramValuesByShaderId: {
        [LEGACY_REACTOR_SCENE_IDS.semantic]: { cellCount: 16, shockwave: 1.8 },
      },
      routesByShaderId: {},
      textureSelectionsByShaderId: {},
    }, useShaderPanelStore.getState())

    expect(panelState.activeShaderId).toBe(REACTOR_SCENE_ID)
    expect(panelState.paramValues).toMatchObject({
      recipe: 'semantic',
      semanticCellCount: 16,
      shockwaveIntensity: 1.8,
    })
    expect(panelState.paramValuesByShaderId).not.toHaveProperty(LEGACY_REACTOR_SCENE_IDS.semantic)

    const libraryState = migrateShaderLibraryPersistedState({
      favorites: [LEGACY_REACTOR_SCENE_IDS.semantic, LEGACY_REACTOR_SCENE_IDS.shrapnel],
      collections: { Live: [LEGACY_REACTOR_SCENE_IDS.singularity] },
      recentlyUsed: [LEGACY_REACTOR_SCENE_IDS.shrapnel],
      thumbnailCache: [LEGACY_REACTOR_SCENE_IDS.semantic],
      shaderPresets: {
        legacy: {
          id: 'legacy',
          name: 'Legacy Singularity',
          sceneId: LEGACY_REACTOR_SCENE_IDS.singularity,
          values: { coreScale: 1.25, echoAmount: 0.91 },
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      },
    })

    expect(libraryState.favorites).toEqual([REACTOR_SCENE_ID])
    expect(libraryState.collections).toEqual({ Live: [REACTOR_SCENE_ID] })
    expect(libraryState.recentlyUsed).toEqual([REACTOR_SCENE_ID])
    expect(libraryState.thumbnailCache).toEqual([REACTOR_SCENE_ID])
    expect(libraryState.shaderPresets?.legacy).toMatchObject({
      sceneId: REACTOR_SCENE_ID,
      values: {
        recipe: 'singularity',
        logoScale: 1.25,
        trailPersistence: 0.91,
      },
    })
  })

  it('applies complete recipe bundles and marks manual edits as Custom', () => {
    const store = useShaderPanelStore.getState()
    store.setActiveShaderId(LEGACY_REACTOR_SCENE_IDS.shrapnel)
    expect(useShaderPanelStore.getState().activeShaderId).toBe(REACTOR_SCENE_ID)
    expect(useShaderPanelStore.getState().paramValues.recipe).toBe('shrapnel')

    useShaderPanelStore.getState().setParamValue('recipe', 'shrapnel')

    expect(useShaderPanelStore.getState().paramValues).toEqual(applyReactorRecipe('shrapnel'))
    expect(useShaderPanelStore.getState().paramValues).toMatchObject({
      recipe: 'shrapnel',
      semanticGeometryEnabled: false,
      shrapnelEnabled: true,
      brandCoreEnabled: false,
    })

    useShaderPanelStore.getState().setParamValue('spread', 1.48)
    expect(useShaderPanelStore.getState().paramValues).toMatchObject({
      recipe: 'custom',
      spread: 1.48,
      shrapnelEnabled: true,
    })
  })

  it('defines valid defaults and keeps every recipe value within parameter bounds', () => {
    const validation = ShaderDefinitionValidator.validate(REACTOR)
    expect(validation.valid).toBe(true)
    expect(REACTOR.defaults).toEqual(applyReactorRecipe('hybrid'))

    for (const recipe of RECIPE_IDS) {
      const values = REACTOR_RECIPE_CONFIGS[recipe] as unknown as ShaderParamValues
      for (const param of REACTOR.params) {
        expect(values).toHaveProperty(param.id)
        expect(validateParamValue(param, values[param.id])).toBeNull()
      }
    }
  })

  it('hides subordinate module controls when their module is disabled', () => {
    const values = applyReactorRecipe('semantic')
    expect(isReactorParamVisible('semanticCellCount', values)).toBe(true)
    expect(isReactorParamVisible('shardCount', values)).toBe(false)
    expect(isReactorParamVisible('brandInfluence', values)).toBe(false)
    expect(isReactorParamVisible('shockwaveWidth', values)).toBe(true)
  })
})
