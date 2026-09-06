import { describe, expect, it } from 'vitest'
import { DEFAULT_SHADER_SCENE_ID } from '../scenes'
import { PRISM_APERTURE_LIMITS } from '../scenes/prismApertureController'
import { shaderRegistry } from '../registry'
import {
  mergeShaderPanelState,
  migrateShaderPanelPersistedState,
  shaderPanelPartialize,
  useShaderPanelStore,
} from './shaderPanelStore'

describe('Shader panel persistence', () => {
  it('persists authoring state while stripping runtime media elements', () => {
    const current = useShaderPanelStore.getState()
    const persisted = shaderPanelPartialize({
      ...current,
      activeShaderId: DEFAULT_SHADER_SCENE_ID,
      paramValuesByShaderId: { [DEFAULT_SHADER_SCENE_ID]: { speed: 0.42 } },
      routesByShaderId: { [DEFAULT_SHADER_SCENE_ID]: [] },
      textureSelectionsByShaderId: {
        [DEFAULT_SHADER_SCENE_ID]: {
          source: {
            sourceType: 'uploaded-image',
            assetUrl: 'media:item-1',
            mediaElement: {} as HTMLImageElement,
          },
        },
      },
    })

    expect(persisted.activeShaderId).toBe(DEFAULT_SHADER_SCENE_ID)
    expect(persisted.paramValuesByShaderId[DEFAULT_SHADER_SCENE_ID]).toEqual({ speed: 0.42 })
    expect(persisted.textureSelectionsByShaderId[DEFAULT_SHADER_SCENE_ID].source).toEqual({
      sourceType: 'uploaded-image',
      assetUrl: 'media:item-1',
    })
    expect('compileStatus' in persisted).toBe(false)
    expect('performanceMetrics' in persisted).toBe(false)
    expect('_previewCompileCallback' in persisted).toBe(false)
  })

  it('rebuilds the active param projection without restoring transient frame state', () => {
    const current = useShaderPanelStore.getState()
    const merged = mergeShaderPanelState({
      activeShaderId: DEFAULT_SHADER_SCENE_ID,
      paramValuesByShaderId: { [DEFAULT_SHADER_SCENE_ID]: { speed: 0.75 } },
      routesByShaderId: { [DEFAULT_SHADER_SCENE_ID]: [] },
      textureSelectionsByShaderId: {},
    }, {
      ...current,
      audioFrame: null,
      evaluationFrame: null,
      compileError: 'runtime-only',
    })

    expect(merged.activeShaderId).toBe(DEFAULT_SHADER_SCENE_ID)
    expect(merged.paramValues).toEqual({ speed: 0.75, aperture: PRISM_APERTURE_LIMITS.default })
    expect(merged.audioFrame).toBeNull()
    expect(merged.evaluationFrame).toBeNull()
    expect(merged.compileError).toBe('runtime-only')
  })

  it('persists and reloads authored Prism aperture and restores the default on reset', () => {
    const original = useShaderPanelStore.getState()
    try {
      useShaderPanelStore.getState().setActiveShaderId(DEFAULT_SHADER_SCENE_ID)
      useShaderPanelStore.getState().setParamValue('aperture', 1.67)
      const persisted = shaderPanelPartialize(useShaderPanelStore.getState())
      expect(persisted.paramValuesByShaderId[DEFAULT_SHADER_SCENE_ID].aperture).toBe(1.67)

      const merged = mergeShaderPanelState(persisted, useShaderPanelStore.getState())
      expect(merged.paramValues.aperture).toBe(1.67)

      useShaderPanelStore.getState().resetParams()
      expect(useShaderPanelStore.getState().paramValues.aperture).toBe(PRISM_APERTURE_LIMITS.default)
    } finally {
      useShaderPanelStore.setState(original)
    }
  })

  it.each(['shader-spectrum-cathedral', 'shader-dreamstate-mycelium'])(
    'retires %s without preserving stale scene records',
    (retiredId) => {
      const migrated = migrateShaderPanelPersistedState({
        activeShaderId: retiredId,
        paramValuesByShaderId: { [retiredId]: { speed: 0.9 } },
        routesByShaderId: { [retiredId]: [] },
        textureSelectionsByShaderId: { [retiredId]: {} },
      })

      expect(migrated.activeShaderId).toBe(DEFAULT_SHADER_SCENE_ID)
      expect(migrated.paramValuesByShaderId).toEqual({})
      expect(migrated.routesByShaderId).toEqual({})
      expect(migrated.textureSelectionsByShaderId).toEqual({})
    },
  )

  it('strips retired scene records before writing current state', () => {
    const current = useShaderPanelStore.getState()
    const persisted = shaderPanelPartialize({
      ...current,
      activeShaderId: 'shader-spectrum-cathedral',
      paramValuesByShaderId: { 'shader-spectrum-cathedral': { speed: 0.4 } },
      routesByShaderId: { 'shader-spectrum-cathedral': [] },
      textureSelectionsByShaderId: { 'shader-spectrum-cathedral': {} },
    })

    expect(persisted.activeShaderId).toBe(DEFAULT_SHADER_SCENE_ID)
    expect(persisted.paramValuesByShaderId).toEqual({})
    expect(persisted.routesByShaderId).toEqual({})
    expect(persisted.textureSelectionsByShaderId).toEqual({})
  })

  it('restores scene-local master and parameter values after switching scenes', () => {
    const original = useShaderPanelStore.getState()
    const scenes = shaderRegistry.getAll().filter(definition => (
      Object.values(definition.defaults).some(value => typeof value === 'number')
    )).slice(0, 2)
    expect(scenes).toHaveLength(2)
    const first = scenes[0]
    const second = scenes[1]
    if (!first || !second) return
    const parameter = Object.keys(first.defaults).find(key => typeof first.defaults[key] === 'number')
    expect(parameter).toBeDefined()
    if (!parameter) return
    const authored = (first.defaults[parameter] as number) + 0.03125

    try {
      useShaderPanelStore.getState().setActiveShaderId(first.id)
      useShaderPanelStore.getState().setParamValue(parameter, authored)
      useShaderPanelStore.getState().setActiveShaderId(second.id)
      useShaderPanelStore.getState().setActiveShaderId(first.id)
      expect(useShaderPanelStore.getState().paramValues[parameter]).toBe(authored)
    } finally {
      useShaderPanelStore.setState(original)
    }
  })

})
