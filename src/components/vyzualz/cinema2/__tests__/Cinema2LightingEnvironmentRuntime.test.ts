import { describe, expect, it } from 'vitest'

import {
  CINEMA2_NATIVE_PRESET_SCHEMA_ID,
  CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  cinema2NamespacedId,
  cinema2Ref,
  cinema2StableId,
  type Cinema2LightId,
  type Cinema2NativePresetManifest,
  type Cinema2ParameterId,
  type Cinema2PresetId,
  type Cinema2SceneNodeId,
  type Cinema2StableId,
} from '../contracts/Cinema2NativePresetManifest'
import { createCinema2InspectorModel } from '../parameters/Cinema2InspectorModel'
import { Cinema2ParameterState } from '../parameters/Cinema2ParameterState'
import { Cinema2FinalValueResolver } from '../parameters/Cinema2TargetRuntime'
import { compileCinema2NativePreset } from '../presets/Cinema2PresetCompiler'
import { Cinema2LightingEnvironmentRuntime } from '../spatial/Cinema2LightingEnvironmentRuntime'
import { Cinema2SpatialRuntime } from '../spatial/Cinema2SpatialRuntime'

const id = <T extends Cinema2StableId>(value: string) => cinema2StableId<T>(value)

function createManifest(lightCount = 1): Cinema2NativePresetManifest {
  const anchorNodeId = id<Cinema2SceneNodeId>('lighting-anchor')
  const targetNodeId = id<Cinema2SceneNodeId>('lighting-target')
  const lightIntensity = id<Cinema2ParameterId>('light-intensity')
  const lightPosition = id<Cinema2ParameterId>('light-position')
  const background = id<Cinema2ParameterId>('environment-background')
  const fogDensity = id<Cinema2ParameterId>('environment-fog-density')
  const lights = Array.from({ length: lightCount }, (_, index) => ({
    id: id<Cinema2LightId>(`stage12c-light-${index + 1}`),
    type: index === 0 ? 'directional' as const : 'point' as const,
    color: [1, 0.8, 0.6, 1] as const,
    intensity: 0.5 + index,
    transform: { position: [0, 2 + index, 6] as const, rotation: [0, 0, 0] as const },
    ...(index === 0 ? {
      node: cinema2Ref(anchorNodeId),
      targetNode: cinema2Ref(targetNodeId),
      controls: { intensity: cinema2Ref(lightIntensity), position: cinema2Ref(lightPosition) },
    } : {}),
  }))
  return {
    schemaId: CINEMA2_NATIVE_PRESET_SCHEMA_ID,
    schemaVersion: CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
    id: cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.stage12c-lighting-test'),
    revision: 1,
    metadata: { name: 'Stage 12C Lighting Test' },
    parameters: [
      { id: lightIntensity, label: 'Key Intensity', type: 'float', defaultValue: 2, min: 0, max: 8, section: 'Lighting', group: 'Key Light' },
      { id: lightPosition, label: 'Key Position', type: 'vec3', defaultValue: [1, 2, 5], section: 'Lighting', group: 'Key Light' },
      { id: background, label: 'Background', type: 'color', defaultValue: [0.1, 0.2, 0.3, 1], section: 'Environment', group: 'Background' },
      { id: fogDensity, label: 'Haze', type: 'float', defaultValue: 0.08, min: 0, max: 1, section: 'Environment', group: 'Fog / Haze' },
    ],
    scene: {
      nodes: [
        { id: anchorNodeId, kind: 'group', coordinateSpace: 'world', transform: { position: [10, 0, 0] } },
        { id: targetNodeId, kind: 'primitive', coordinateSpace: 'world', transform: { position: [0, 0, -4] } },
      ],
      roots: [cinema2Ref(anchorNodeId), cinema2Ref(targetNodeId)],
    },
    lighting: { lights },
    environment: {
      backgroundColor: [0, 0, 0, 1],
      exposure: 1.25,
      fog: { mode: 'exponential', color: [0.15, 0.2, 0.25, 1], density: 0.02, near: 0, far: 100 },
      controls: { backgroundColor: cinema2Ref(background), fogDensity: cinema2Ref(fogDensity) },
    },
  }
}

function compile(manifest = createManifest()) {
  const result = compileCinema2NativePreset(manifest, { availableCapabilities: ['lighting', 'scene.3d'] })
  if (!result.ok) throw new Error(result.diagnostics.map(entry => `${entry.path}: ${entry.message}`).join('; '))
  return result.plan
}

function createServices(manifest = createManifest(), quality: 'low' | 'medium' | 'high' = 'high') {
  const plan = compile(manifest)
  const parameters = new Cinema2ParameterState(plan.parameters)
  const resolver = new Cinema2FinalValueResolver(plan.targets, {
    resolveBaseValue: target => target.parameterId == null ? target.authoredBaseValue : parameters.getValue(target.parameterId),
  })
  const spatial = new Cinema2SpatialRuntime(plan.scene, plan.targets.targets, resolver)
  const lighting = new Cinema2LightingEnvironmentRuntime(plan, resolver, spatial, quality)
  return { plan, parameters, resolver, spatial, lighting }
}

describe('Cinema 2.0 Stage 12C shared Lighting and Environment foundation', () => {
  it('validates light transforms, light controls and environment/fog values at the compiler boundary', () => {
    const malformed = createManifest() as unknown as Record<string, unknown>
    const lighting = malformed.lighting as { lights: Array<Record<string, unknown>> }
    lighting.lights[0].intensity = -1
    lighting.lights[0].transform = { position: [0, Number.NaN, 1] }
    const environment = malformed.environment as Record<string, unknown>
    environment.backgroundColor = [2, 0, 0, 1]
    environment.fog = { mode: 'linear', near: 10, far: 5 }

    const result = compileCinema2NativePreset(malformed)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.diagnostics.map(entry => entry.code)).toEqual(expect.arrayContaining([
      'CINEMA2_PRESET_LIGHT_VALUE_INVALID',
      'CINEMA2_PRESET_LIGHTING_COLOR_INVALID',
      'CINEMA2_PRESET_ENVIRONMENT_VALUE_INVALID',
    ]))
  })

  it('resolves parameter controls, shared target contributions, Scene Graph targets and fog through one final runtime frame', () => {
    const { plan, parameters, resolver, spatial, lighting } = createServices()
    const firstLight = plan.manifest.lighting!.lights[0]
    const frame = lighting.getFrame()
    expect(frame.lights[0]).toMatchObject({ id: firstLight.id, intensity: 2, position: [11, 2, 5], targetPosition: [0, 0, -4] })
    expect(frame.environment).toMatchObject({ backgroundColor: [0.1, 0.2, 0.3, 1], exposure: 1.25, fog: { mode: 'exponential', density: 0.08 } })
    expect(plan.scene.nodes.find(node => node.id === firstLight.node?.$ref)?.anchoredLightIds).toEqual([firstLight.id])

    expect(parameters.setPersistentValue(id<Cinema2ParameterId>('light-intensity'), 3.5).ok).toBe(true)
    expect(parameters.setPersistentValue(id<Cinema2ParameterId>('environment-background'), [0.3, 0.1, 0.05, 1]).ok).toBe(true)
    const colorTarget = plan.targets.targets.find(target => target.kind === 'light' && target.ownerId === firstLight.id && target.property === 'color')
    const anchorNodeId = firstLight.node?.$ref
    const targetNodeId = firstLight.targetNode?.$ref
    const anchorPosition = plan.targets.targets.find(target => target.kind === 'scene-node' && target.ownerId === anchorNodeId && target.property === 'transform.position')
    const targetPosition = plan.targets.targets.find(target => target.kind === 'scene-node' && target.ownerId === targetNodeId && target.property === 'transform.position')
    expect(colorTarget).toBeDefined()
    expect(anchorPosition).toBeDefined()
    expect(targetPosition).toBeDefined()
    if (!colorTarget || !anchorPosition || !targetPosition) return
    expect(resolver.replaceTransientContributions('choreography', [
      { targetId: colorTarget.id, contribution: { contributorId: 'choreography:light-color', operation: 'replace', value: [0.2, 0.6, 1, 1] } },
      { targetId: anchorPosition.id, contribution: { contributorId: 'choreography:light-anchor', operation: 'replace', value: [2, 0, -3] } },
      { targetId: targetPosition.id, contribution: { contributorId: 'choreography:light-target', operation: 'replace', value: [2, 0, -3] } },
    ])).toMatchObject({ applied: true })

    const updated = lighting.update()
    expect(updated.lights[0]).toMatchObject({ intensity: 3.5, color: [0.2, 0.6, 1, 1], position: [3, 2, 2], targetPosition: [2, 0, -3] })
    expect(updated.environment.backgroundColor).toEqual([0.3, 0.1, 0.05, 1])
    expect(updated.lights[0].direction).not.toEqual(frame.lights[0].direction)

    lighting.dispose()
    spatial.dispose()
    expect(lighting.getSnapshot()).toMatchObject({ disposed: true, activeLightCount: 1, hasAuthoredEnvironment: true })
  })

  it('applies deterministic quality light limits without inventing missing services', () => {
    const low = createServices(createManifest(6), 'low')
    const medium = createServices(createManifest(6), 'medium')
    const high = createServices(createManifest(6), 'high')
    expect(low.lighting.getSnapshot()).toMatchObject({ authoredLightCount: 6, activeLightCount: 2, omittedLightCount: 4 })
    expect(medium.lighting.getSnapshot()).toMatchObject({ activeLightCount: 4, omittedLightCount: 2 })
    expect(high.lighting.getSnapshot()).toMatchObject({ activeLightCount: 6, omittedLightCount: 0 })
    low.lighting.dispose(); low.spatial.dispose()
    medium.lighting.dispose(); medium.spatial.dispose()
    high.lighting.dispose(); high.spatial.dispose()
  })

  it('shows Lighting and Environment only from authored schema controls, with no preset-identity UI branch', () => {
    const plan = compile()
    const state = new Cinema2ParameterState(plan.parameters)
    const model = createCinema2InspectorModel(plan, state.getSnapshot(), 'design')
    expect(model.map(section => section.label)).toEqual(['Lighting', 'Environment'])
    expect(model.find(section => section.label === 'Environment')?.groups.map(group => group.label)).toEqual(['Background', 'Fog / Haze'])

    const empty = compileCinema2NativePreset({
      schemaId: CINEMA2_NATIVE_PRESET_SCHEMA_ID,
      schemaVersion: CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
      id: cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.stage12c-no-controls'),
      revision: 1,
      metadata: { name: 'No Environment Controls' },
      environment: { backgroundColor: [0, 0, 0, 1] },
    })
    expect(empty.ok).toBe(true)
    if (!empty.ok) return
    const emptyState = new Cinema2ParameterState(empty.plan.parameters)
    expect(createCinema2InspectorModel(empty.plan, emptyState.getSnapshot(), 'design')).toEqual([])
  })
})
