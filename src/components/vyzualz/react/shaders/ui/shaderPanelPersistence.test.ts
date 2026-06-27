import { describe, expect, it } from 'vitest'
import { DEFAULT_SHADER_SCENE_ID } from '../scenes'
import {
  mergeShaderPanelState,
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
    expect(merged.paramValues).toEqual({ speed: 0.75 })
    expect(merged.audioFrame).toBeNull()
    expect(merged.evaluationFrame).toBeNull()
    expect(merged.compileError).toBe('runtime-only')
  })
})
