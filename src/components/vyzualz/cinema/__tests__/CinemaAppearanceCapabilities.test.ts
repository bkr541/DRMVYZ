import { describe, expect, it } from 'vitest'
import {
  CINEMA_CINEMATIC_WORLD_REFERENCE_COMPOSITION,
  CINEMA_FOUNDATION_COMPOSITION,
  CINEMA_SHADER_REFERENCE_COMPOSITION,
  createCinemaFoundationPersistedState,
  createCinemaInspectorAppearanceCapabilities,
  normalizeCinemaPersistedState,
  type CinemaCompositionDefinition,
} from '../index'

describe('Cinema Inspector appearance capability normalization', () => {
  const definitions = createCinemaFoundationPersistedState().definitions

  it('uses one section policy across shader, world, and foundation renderer families', () => {
    const shader = createCinemaInspectorAppearanceCapabilities(CINEMA_SHADER_REFERENCE_COMPOSITION, definitions)
    expect(shader.showMasterAppearance).toBe(true)
    expect(shader.showCameraResources).toBe(false)
    expect(shader.masterParameters.map(parameter => parameter.label)).toEqual(expect.arrayContaining([
      'Master Intensity',
      'Master Motion',
    ]))
    expect(shader.masterParameters.map(parameter => parameter.label)).not.toContain('Master Glow')

    const world = createCinemaInspectorAppearanceCapabilities(CINEMA_CINEMATIC_WORLD_REFERENCE_COMPOSITION, definitions)
    expect(world.showMasterAppearance).toBe(false)
    expect(world.showCameraResources).toBe(true)
    expect(world.masterParameters).toEqual([])
    const worldCamera = CINEMA_CINEMATIC_WORLD_REFERENCE_COMPOSITION.cameras[0]
    expect(worldCamera).toBeDefined()
    expect(world.cameraParameterSchemas[worldCamera!.id]?.map(parameter => parameter.label)).toEqual(expect.arrayContaining([
      'Field of View',
      'Orbit Radius',
      'Orbit Speed',
    ]))

    const foundation = createCinemaInspectorAppearanceCapabilities(CINEMA_FOUNDATION_COMPOSITION, definitions)
    expect(foundation.showMasterAppearance).toBe(false)
    expect(foundation.showCameraResources).toBe(false)
    expect(foundation.masterParameters).toEqual([])
    expect(foundation.cameraParameterSchemas).toEqual({})
  })

  it('keeps renderer-local controls local instead of manufacturing cross-family masters', () => {
    const world = createCinemaInspectorAppearanceCapabilities(CINEMA_CINEMATIC_WORLD_REFERENCE_COMPOSITION, definitions)
    const worldNode = CINEMA_CINEMATIC_WORLD_REFERENCE_COMPOSITION.nodes.find(node => node.family === 'procedural')
    const worldDefinition = definitions.find(definition => definition.id === worldNode?.typeId)?.definition

    expect(worldDefinition?.parameters.some(parameter => parameter.label === 'Intensity')).toBe(true)
    expect(worldDefinition?.parameters.some(parameter => parameter.label === 'Motion')).toBe(true)
    expect(world.masterParameters).toEqual([])
    expect(CINEMA_CINEMATIC_WORLD_REFERENCE_COMPOSITION.masterParameters).toEqual([])
  })

  it('hides masters without an enabled verified consumer while preserving their canonical saved schemas and values', () => {
    const disabledShader: CinemaCompositionDefinition = {
      ...CINEMA_SHADER_REFERENCE_COMPOSITION,
      nodes: CINEMA_SHADER_REFERENCE_COMPOSITION.nodes.map(node => node.family === 'shader'
        ? { ...node, enabled: false }
        : node),
    }
    const beforeParameters = JSON.stringify(disabledShader.masterParameters)
    const beforeValues = JSON.stringify(disabledShader.masterValues)

    const capabilities = createCinemaInspectorAppearanceCapabilities(disabledShader, definitions)

    expect(capabilities.showMasterAppearance).toBe(false)
    expect(capabilities.masterParameters).toEqual([])
    expect(JSON.stringify(disabledShader.masterParameters)).toBe(beforeParameters)
    expect(JSON.stringify(disabledShader.masterValues)).toBe(beforeValues)
  })

  it('preserves hidden master values and camera IDs through canonical persistence normalization', () => {
    const state = createCinemaFoundationPersistedState()
    const shader = state.compositions.find(composition => composition.id === CINEMA_SHADER_REFERENCE_COMPOSITION.id)
    const hiddenMaster = shader?.masterParameters.find(parameter => parameter.label === 'Master Glow')
    expect(shader).toBeDefined()
    expect(hiddenMaster).toBeDefined()

    const persisted = {
      ...state,
      compositions: state.compositions.map(composition => composition.id === shader!.id
        ? { ...composition, masterValues: { ...composition.masterValues, [hiddenMaster!.id]: 1.73 } }
        : composition),
    }
    const normalized = normalizeCinemaPersistedState(persisted)
    expect(normalized.ok).toBe(true)
    if (!normalized.ok) return

    const restoredShader = normalized.value.compositions.find(composition => composition.id === shader!.id)
    expect(restoredShader?.masterValues[hiddenMaster!.id]).toBe(1.73)
    expect(createCinemaInspectorAppearanceCapabilities(restoredShader!, normalized.value.definitions)
      .masterParameters.map(parameter => parameter.id)).not.toContain(hiddenMaster!.id)

    const restoredWorld = normalized.value.compositions.find(
      composition => composition.id === CINEMA_CINEMATIC_WORLD_REFERENCE_COMPOSITION.id,
    )
    expect(restoredWorld?.cameras.map(camera => camera.id)).toEqual(
      CINEMA_CINEMATIC_WORLD_REFERENCE_COMPOSITION.cameras.map(camera => camera.id),
    )
  })

  it('shows a real camera resource even when no renderer is assigned to consume live camera controls', () => {
    const detachedCameraComposition: CinemaCompositionDefinition = {
      ...CINEMA_FOUNDATION_COMPOSITION,
      cameras: CINEMA_CINEMATIC_WORLD_REFERENCE_COMPOSITION.cameras,
    }

    const capabilities = createCinemaInspectorAppearanceCapabilities(detachedCameraComposition, definitions)
    const camera = detachedCameraComposition.cameras[0]

    expect(capabilities.showCameraResources).toBe(true)
    expect(camera).toBeDefined()
    expect(capabilities.cameraParameterSchemas[camera!.id]).toEqual([])
  })
})
