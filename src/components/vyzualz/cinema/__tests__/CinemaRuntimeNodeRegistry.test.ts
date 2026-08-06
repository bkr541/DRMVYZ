import { describe, expect, it } from 'vitest'
import {
  CINEMA_FOUNDATION_GRADIENT_DEFINITION,
  CINEMA_FOUNDATION_GRADIENT_PLUGIN_ID,
  CINEMA_FOUNDATION_RUNTIME_REGISTRY,
  CINEMA_PRODUCTION_RUNTIME_REGISTRY,
} from '../CinemaFoundation'
import { CINEMA_SHADER_SCENE_ADAPTER_BUNDLE } from '../CinemaShaderSceneAdapter'
import { CINEMA_CINEMATIC_WORLD_ADAPTER_BUNDLE } from '../CinemaCinematicWorldAdapter'
import { createCinemaRuntimeNodeRegistry } from '../CinemaRuntimeNodeRegistry'
import type { CinemaNodePlugin, CinemaRenderNode } from '../CinemaRendererContracts'

const plugin: CinemaNodePlugin = {
  definition: CINEMA_FOUNDATION_GRADIENT_DEFINITION,
  createNode(node): CinemaRenderNode {
    return {
      nodeId: node.id,
      typeId: node.typeId,
      initialize() {},
      resize() {},
      render() {},
      reset() {},
      dispose() {},
    }
  },
}

describe('Cinema runtime node registry', () => {
  it('keeps runtime factories separate from persisted metadata with a deterministic fingerprint', () => {
    const first = createCinemaRuntimeNodeRegistry([
      { pluginId: CINEMA_FOUNDATION_GRADIENT_PLUGIN_ID, plugin },
    ])
    const second = createCinemaRuntimeNodeRegistry([
      { pluginId: CINEMA_FOUNDATION_GRADIENT_PLUGIN_ID, plugin },
    ])

    expect(first.diagnostics).toEqual([])
    expect(first.registry.size).toBe(1)
    expect(first.registry.fingerprint).toBe(second.registry.fingerprint)
    expect(first.registry.getByTypeId(CINEMA_FOUNDATION_GRADIENT_DEFINITION.typeId)?.plugin).toBe(plugin)
    expect(JSON.stringify(first.registry)).not.toContain('createNode')
  })

  it('rejects duplicate factories and malformed external identifiers diagnostically', () => {
    const duplicate = createCinemaRuntimeNodeRegistry([
      { pluginId: CINEMA_FOUNDATION_GRADIENT_PLUGIN_ID, plugin },
      { pluginId: CINEMA_FOUNDATION_GRADIENT_PLUGIN_ID, plugin },
    ])
    expect(duplicate.registry.size).toBe(1)
    expect(duplicate.diagnostics.some(diagnostic => diagnostic.code === 'CINEMA_NODE_REGISTRY_DUPLICATE')).toBe(true)

    const malformed = createCinemaRuntimeNodeRegistry([
      { pluginId: 'Gradient Renderer' as never, plugin },
    ])
    expect(malformed.registry.size).toBe(0)
    expect(malformed.diagnostics.some(diagnostic => diagnostic.code === 'CINEMA_ID_LOOKS_LIKE_LABEL')).toBe(true)
  })

  it('keeps foundation plugins and registers every Shader and Cinematic World adapter in production', () => {
    expect(CINEMA_FOUNDATION_RUNTIME_REGISTRY.size).toBe(2)
    expect(CINEMA_FOUNDATION_RUNTIME_REGISTRY.list().map(registration => registration.plugin.definition.family)).toEqual([
      'procedural',
      'output',
    ])
    expect(CINEMA_PRODUCTION_RUNTIME_REGISTRY.size).toBe(
      2 + CINEMA_SHADER_SCENE_ADAPTER_BUNDLE.entries.length + CINEMA_CINEMATIC_WORLD_ADAPTER_BUNDLE.entries.length,
    )
    expect(CINEMA_SHADER_SCENE_ADAPTER_BUNDLE.entries.every(entry => (
      CINEMA_PRODUCTION_RUNTIME_REGISTRY.hasPlugin(entry.pluginId)
    ))).toBe(true)
    expect(CINEMA_CINEMATIC_WORLD_ADAPTER_BUNDLE.entries.every(entry => (
      CINEMA_PRODUCTION_RUNTIME_REGISTRY.hasPlugin(entry.pluginId)
    ))).toBe(true)
  })
})
