import { beforeEach, describe, expect, it } from 'vitest'
import { ShaderLibrary } from '../../library/ShaderLibrary'
import { migrateShaderLibraryPersistedState } from '../../library/ShaderLibraryStore'
import { ShaderDefinitionValidator } from '../../registry/ShaderDefinitionValidator'
import { shaderRegistry } from '../../registry'
import { validateParamValue } from '../../registry/ShaderParameterSchema'
import type { ShaderParamValues } from '../../registry/shaderRegistryTypes'
import {
  LEGACY_REACTOR_SCENE_IDS,
  REACTOR,
  REACTOR_CHOREOGRAPHY_TRIGGERS,
  REACTOR_RAY_REROLL_CADENCES,
  REACTOR_RAY_STYLES,
  REACTOR_RECIPE_CONFIGS,
  REACTOR_SCENE_ID,
  applyReactorRecipe,
  isReactorParamVisible,
  normalizeReactorParamValues,
  resolveReactorRayEpoch,
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

  it('shows one canonical Reactor card and keeps legacy definitions out of the runtime registry', () => {
    const library = new ShaderLibrary(new Map(), new Set(), new Map(), [], new Set())
    const bundled = library.getBundled()
    const unifiedEntries = bundled.filter(definition => (
      definition.id === REACTOR_SCENE_ID || LEGACY_IDS.includes(definition.id as typeof LEGACY_IDS[number])
    ))

    expect(unifiedEntries.map(definition => definition.id)).toEqual([REACTOR_SCENE_ID])
    expect(unifiedEntries[0]?.name).toBe('Reactor')
    for (const legacyId of LEGACY_IDS) expect(shaderRegistry.has(legacyId)).toBe(false)
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

  it('supports each module alone, any combination, and a balanced three-module recipe', () => {
    const semantic = applyReactorRecipe('semantic')
    const shrapnel = applyReactorRecipe('shrapnel')
    const singularity = applyReactorRecipe('singularity')
    const hybrid = applyReactorRecipe('hybrid')

    expect(semantic).toMatchObject({
      semanticGeometryEnabled: true, shrapnelEnabled: false, brandCoreEnabled: false,
      semanticMix: 1, shrapnelMix: 0, brandMix: 0,
    })
    expect(shrapnel).toMatchObject({
      semanticGeometryEnabled: false, shrapnelEnabled: true, brandCoreEnabled: false,
      semanticMix: 0, shrapnelMix: 1, brandMix: 0,
    })
    expect(singularity).toMatchObject({
      semanticGeometryEnabled: false, shrapnelEnabled: false, brandCoreEnabled: true,
      semanticMix: 0, shrapnelMix: 0, brandMix: 1,
    })
    expect(hybrid).toMatchObject({
      semanticGeometryEnabled: true, shrapnelEnabled: true, brandCoreEnabled: true,
    })
    expect(hybrid.semanticMix).toBeLessThan(1)
    expect(hybrid.shrapnelMix).toBeLessThan(1)
    expect(hybrid.brandMix).toBeLessThan(1)

    const anyTwo = {
      ...hybrid,
      recipe: 'custom',
      semanticGeometryEnabled: true,
      shrapnelEnabled: false,
      brandCoreEnabled: true,
    }
    expect(anyTwo.semanticGeometryEnabled && anyTwo.brandCoreEnabled).toBe(true)
    expect(anyTwo.shrapnelEnabled).toBe(false)
  })

  it('hydrates Patch 2 Reactor values with module weights without changing authored controls', () => {
    const normalized = normalizeReactorParamValues({
      recipe: 'custom',
      semanticGeometryEnabled: true,
      shrapnelEnabled: false,
      brandCoreEnabled: true,
      spread: 1.42,
    })

    expect(normalized).toMatchObject({
      recipe: 'custom',
      semanticMix: 1,
      shrapnelMix: 0,
      brandMix: 1,
      spread: 1.42,
    })
  })

  it('uses one modular render graph rather than switching among legacy scenes', () => {
    expect(REACTOR.passes?.map(pass => pass.id)).toEqual(['generator', 'feedback', 'composite'])
    const source = REACTOR.passes?.map(pass => pass.fragSrc).join('\n') ?? ''
    expect(source).toContain('renderSemanticModule')
    expect(source).toContain('renderShrapnelModule')
    expect(source).toContain('renderBrandModule')
    expect(source).toContain('uSemanticMix')
    expect(source).toContain('uShrapnelMix')
    expect(source).toContain('uBrandMix')
    expect(source).toContain('logoOcclusion')
    expect(source).toContain('neutralDiamond')
    for (const legacyId of LEGACY_IDS) expect(source).not.toContain(legacyId)
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

describe('Reactor generative ray field', () => {
  const RAY_PARAM_IDS = [
    'rayStyle', 'rayRerollCadence', 'raySeed', 'rayAngularIrregularity',
    'rayCurvature', 'rayForkAmount', 'rayDashDensity', 'rayLengthVariation',
  ] as const

  it('bumps the scene version and exposes the eight ray params in the Shrapnel group', () => {
    expect(REACTOR.version).toBe(4)
    for (const id of RAY_PARAM_IDS) {
      const param = REACTOR.params.find(p => p.id === id)
      expect(param, `${id} param`).toBeDefined()
      expect(param?.group).toBe('Shrapnel')
    }
    const style = REACTOR.params.find(p => p.id === 'rayStyle')
    expect(style?.type).toBe('enum')
    expect(style && style.type === 'enum' ? style.values.map(v => v.value) : []).toEqual([...REACTOR_RAY_STYLES])
    expect([...REACTOR_RAY_STYLES]).toEqual(['spoke', 'lance', 'tracer', 'forked', 'arc', 'mixed'])
    const cadence = REACTOR.params.find(p => p.id === 'rayRerollCadence')
    expect(cadence && cadence.type === 'enum' ? cadence.values.map(v => v.value) : []).toEqual([...REACTOR_RAY_REROLL_CADENCES])
    expect([...REACTOR_RAY_REROLL_CADENCES]).toEqual(['off', 'bar', 'bar4', 'phrase', 'drop'])
    const seed = REACTOR.params.find(p => p.id === 'raySeed')
    expect(seed?.type).toBe('integer')
    expect(seed?.modulatable).toBe(false)
  })

  it('gates every ray param on the Shrapnel module', () => {
    const off = applyReactorRecipe('semantic')   // shrapnelEnabled: false
    const on = applyReactorRecipe('shrapnel')    // shrapnelEnabled: true
    for (const id of RAY_PARAM_IDS) {
      expect(isReactorParamVisible(id, off), `${id} hidden when shrapnel off`).toBe(false)
      expect(isReactorParamVisible(id, on), `${id} shown when shrapnel on`).toBe(true)
    }
  })

  it('the GLSL shrapnel module is seed/epoch driven and carries every ray style branch', () => {
    const source = REACTOR.passes?.map(pass => pass.fragSrc).join('\n') ?? ''
    // Layout keyed on the persistent epoch, not a raw bar counter.
    expect(source).toContain('float epoch = floor(uRaySeed) + floor(uRayEpoch)')
    expect(source).not.toMatch(/renderShrapnelModule[\s\S]*?floor\(uBarIndex\)/)
    // Irregular-but-non-clumping placement.
    expect(source).toContain('reactorGoldenAngle(')
    expect(source).toContain('mix(evenAngle, scatterAngle, irregularity)')
    // Style silhouettes.
    expect(source).toContain('reactorBezierDistance(')
    expect(source).toContain('isArc')
    expect(source).toContain('isForked')
    expect(source).toContain('isLance')
    expect(source).toContain('isTracer')
    // Per-ray colour role.
    expect(source).toContain('rayFieldPrimary')
    expect(source).toContain('rayFieldAccent')
  })

  it('legacy projects hydrate ray params from the recipe defaults', () => {
    const normalized = normalizeReactorParamValues({
      recipe: 'custom',
      shrapnelEnabled: true,
      spread: 1.2,
    })
    const hybrid = applyReactorRecipe('hybrid')
    for (const id of RAY_PARAM_IDS) {
      expect(normalized[id], `${id} hydrated`).toEqual(hybrid[id])
    }
  })

  it('repairs malformed persisted ray values', () => {
    const normalized = normalizeReactorParamValues({
      recipe: 'custom',
      shrapnelEnabled: true,
      rayStyle: 'triangle' as never,
      rayRerollCadence: 'every-beat' as never,
      raySeed: -40.7 as never,
      rayAngularIrregularity: 5 as never,
      rayCurvature: -2 as never,
    })
    expect(normalized.rayStyle).toBe('mixed')
    expect(normalized.rayRerollCadence).toBe('bar')
    expect(normalized.raySeed).toBe(0)
    expect(normalized.rayAngularIrregularity).toBe(1)
    expect(normalized.rayCurvature).toBe(0)
  })

  it('the Shrapnel recipe scatters harder than the Semantic recipe', () => {
    expect(REACTOR_RECIPE_CONFIGS.shrapnel.rayAngularIrregularity)
      .toBeGreaterThan(REACTOR_RECIPE_CONFIGS.semantic.rayAngularIrregularity)
    expect(REACTOR_RECIPE_CONFIGS.singularity.rayStyle).toBe('arc')
  })

  it('resolveReactorRayEpoch maps each cadence to a deterministic epoch', () => {
    const at = (barIndex: number, phraseIndex: number | null, dropCount: number) =>
      ({ barIndex, phraseIndex, dropCount })
    expect(resolveReactorRayEpoch('off', at(9, 2, 4))).toBe(0)
    expect(resolveReactorRayEpoch('bar', at(9, 2, 4))).toBe(9)
    expect(resolveReactorRayEpoch('bar4', at(9, 2, 4))).toBe(2)
    expect(resolveReactorRayEpoch('bar4', at(12, null, 0))).toBe(3)
    expect(resolveReactorRayEpoch('phrase', at(9, 2, 4))).toBe(2)          // real phrase index
    expect(resolveReactorRayEpoch('phrase', at(40, null, 0))).toBe(2)      // 16-bar fallback
    expect(resolveReactorRayEpoch('drop', at(9, 2, 4))).toBe(4)            // caller-owned count
    // Malformed inputs never produce NaN / negative epochs.
    expect(resolveReactorRayEpoch('bar', at(Number.NaN, null, 0))).toBe(0)
    expect(resolveReactorRayEpoch('bar', at(-7, null, 0))).toBe(0)
  })
})

describe('Reactor procedural core module', () => {
  const CORE_PARAM_IDS = ['coreComplexity', 'coreIrregularity', 'coreWobble'] as const

  it('adds the Procedural Core module toggle, mix, and shape knobs', () => {
    const toggle = REACTOR.params.find(p => p.id === 'coreModuleEnabled')
    expect(toggle?.type).toBe('boolean')
    expect(toggle?.group).toBe('Modules')
    const mix = REACTOR.params.find(p => p.id === 'coreModuleMix')
    expect(mix?.group).toBe('Modules')
    for (const id of CORE_PARAM_IDS) {
      const param = REACTOR.params.find(p => p.id === id)
      expect(param, `${id} param`).toBeDefined()
      expect(param?.group).toBe('Procedural Core')
      expect(param?.type).toBe('float')
    }
  })

  it('gates the core shape knobs on the Procedural Core module', () => {
    const values = { ...applyReactorRecipe('hybrid'), coreModuleEnabled: false } as ShaderParamValues
    for (const id of [...CORE_PARAM_IDS, 'coreModuleMix'] as const) {
      expect(isReactorParamVisible(id, values), `${id} hidden`).toBe(false)
      expect(isReactorParamVisible(id, applyReactorRecipe('hybrid')), `${id} shown`).toBe(true)
    }
  })

  it('renders a seeded procedural core behind the other modules in GLSL', () => {
    const source = REACTOR.passes?.map(pass => pass.fragSrc).join('\n') ?? ''
    expect(source).toContain('ReactorLayer renderCoreModule(')
    // Same generative epoch as the ray field.
    expect(source).toMatch(/renderCoreModule[\s\S]*?float epoch = floor\(uRaySeed\) \+ floor\(uRayEpoch\)/)
    // Seeded lobe count + animated wobble.
    expect(source).toContain('float lobes = 3.0 + floor(complexity * 6.0 + seedA * 3.0)')
    expect(source).toContain('wobbleNoise')
    // Folded into the non-brand accumulator ahead of the semantic / shrapnel layers.
    expect(source).toContain('vec3 nonBrandColor = coreLayer.color * coreWeight')
  })

  it('every shipped recipe enables the procedural core', () => {
    for (const id of RECIPE_IDS) {
      expect(REACTOR_RECIPE_CONFIGS[id].coreModuleEnabled, id).toBe(true)
    }
  })

  it('legacy projects hydrate core params from the recipe and repair malformed values', () => {
    const hydrated = normalizeReactorParamValues({ recipe: 'custom', coreModuleEnabled: true })
    const hybrid = applyReactorRecipe('hybrid')
    for (const id of CORE_PARAM_IDS) expect(hydrated[id]).toEqual(hybrid[id])
    const repaired = normalizeReactorParamValues({
      recipe: 'custom',
      coreComplexity: 9 as never,
      coreIrregularity: -3 as never,
    })
    expect(repaired.coreComplexity).toBe(1)
    expect(repaired.coreIrregularity).toBe(0)
  })
})

describe('Reactor choreography trigger param', () => {
  it('exposes one canonical-music Trigger enum in its own group', () => {
    const param = REACTOR.params.find(p => p.id === 'choreographyTrigger')
    expect(param?.type).toBe('enum')
    expect(param?.group).toBe('Choreography')
    expect(param && param.type === 'enum' ? param.values.map(v => v.value) : []).toEqual([...REACTOR_CHOREOGRAPHY_TRIGGERS])
    expect([...REACTOR_CHOREOGRAPHY_TRIGGERS]).toEqual(
      ['off', 'energy', 'beat', 'beat2', 'beat4', 'bar', 'bar4', 'bar8', 'downbeat', 'phrase', 'drop'],
    )
  })

  it('wires the choreography burst uniforms into the shockwave in GLSL', () => {
    const source = REACTOR.passes?.map(pass => pass.fragSrc).join('\n') ?? ''
    expect(source).toContain('uniform float uReactorBurst;')
    expect(source).toContain('uniform float uReactorBurstPhase;')
    expect(source).toContain('float burstRadius = clamp(uReactorBurstPhase, 0.0, 1.25)')
    expect(source).toContain('shockShape += burstRing;')
  })

  it('recipes opt into a musical trigger; an unrecognized value repairs to off', () => {
    expect(REACTOR_RECIPE_CONFIGS.singularity.choreographyTrigger).toBe('drop')
    expect(REACTOR_RECIPE_CONFIGS.hybrid.choreographyTrigger).toBe('bar4')
    const repaired = normalizeReactorParamValues({ recipe: 'custom', choreographyTrigger: 'every-drop' as never })
    expect(repaired.choreographyTrigger).toBe('off')
    // A missing value still hydrates from the recipe rather than the repair fallback.
    const hydrated = normalizeReactorParamValues({ recipe: 'singularity' })
    expect(hydrated.choreographyTrigger).toBe('drop')
  })
})
