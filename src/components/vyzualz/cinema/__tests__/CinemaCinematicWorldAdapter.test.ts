import { describe, expect, it, vi } from 'vitest'
import {
  CINEMA_CINEMATIC_WORLD_ADAPTER_BUNDLE,
  CINEMA_CINEMATIC_WORLD_COLOR_OUTPUT_PORT_ID,
  CINEMA_CINEMATIC_WORLD_REFERENCE_COMPOSITION,
  CINEMA_FOUNDATION_INPUT_PORT_ID,
  CINEMA_FOUNDATION_OUTPUT_TYPE_ID,
  CINEMA_FOUNDATION_PERSISTED_DEFINITIONS,
  CINEMA_FOUNDATION_RUNTIME_REGISTRY,
  CINEMA_PERFORMANCE_ACTION_SCHEMA_VERSION,
  CINEMA_PERFORMANCE_RULE_SCHEMA_VERSION,
  CINEMA_PERFORMANCE_STATE_ACTION_IDS,
  CINEMA_PRODUCTION_RUNTIME_REGISTRY,
  cinemaCinematicResetReason,
  cinemaCinematicWorldParameterId,
  cinemaCinematicWorldTypeId,
  createCinemaCinematicPresetComposition,
  createCinemaCinematicWorldAdapterBundle,
  createCinemaCinematicWorldComposition,
  createCinemaFoundationPersistedState,
  createCinemaStore,
  getCinemaCinematicWorldSupportedParameterSchemasForNode,
  getCinemaSupportedPaletteRoles,
  getCinemaSupportedParameterSchemas,
  type CinemaActionId,
  type CinemaCompositionDefinition,
  type CinemaEventId,
  type CinemaPerformanceRuleId,
} from '..'
import { cinemaStableId, type CinemaCompositionId, type CinemaNodeId } from '../CinemaIdentifiers'
import type { CinemaFrameContext } from '../CinemaRendererContracts'
import { createCinemaRuntimeNodeRegistry } from '../CinemaRuntimeNodeRegistry'
import { CinemaGraphExecutor } from '../runtime/CinemaGraphExecutor'
import { CinemaRenderTargetPool } from '../runtime/CinemaRenderTargetPool'
import { CinemaTextureManager } from '../runtime/CinemaTextureManager'
import { CinemaWebGLRenderServiceImpl } from '../runtime/CinemaWebGLRenderService'
import { cinematicWorldRendererRegistry } from '../../react/renderers/CinematicPortalRenderer'
import { cinematicWorldDefinitions } from '../../react/renderers/cinematic/worlds'
import { DEFAULT_REACT_PRESETS } from '../../react/ReactTypes'
import type { CinematicFrameContext as CinematicRenderFrame, CinematicWebGLWorldDefinition } from '../../react/renderers/CinematicWorldRenderer'
import { createCinemaMockWebGL } from './CinemaWebGLTestUtils'

describe('Cinema Cinematic World adapters', () => {
  it('maps Stage 12 stateful commands through the shared reset contract', () => {
    expect(cinemaCinematicResetReason(CINEMA_PERFORMANCE_STATE_ACTION_IDS.resetNodeState)).toBe('manualReset')
    expect(cinemaCinematicResetReason(CINEMA_PERFORMANCE_STATE_ACTION_IDS.resetFeedback)).toBe('manualReset')
    expect(cinemaCinematicResetReason(CINEMA_PERFORMANCE_STATE_ACTION_IDS.reseedSimulation)).toBe('manualReset')
    expect(cinemaCinematicResetReason(CINEMA_PERFORMANCE_STATE_ACTION_IDS.clearTrailHistory)).toBe('manualReset')
  })

  it('maps every built-in WebGL world and legacyPortal into stable Cinema procedural nodes', () => {
    expect(CINEMA_CINEMATIC_WORLD_ADAPTER_BUNDLE.entries).toHaveLength(cinematicWorldDefinitions.length + 1)

    for (const definition of cinematicWorldDefinitions) {
      const entry = CINEMA_CINEMATIC_WORLD_ADAPTER_BUNDLE.entries.find(candidate => candidate.worldId === definition.id)
      expect(entry).toBeDefined()
      expect(entry?.typeId).toBe(cinemaCinematicWorldTypeId(definition.id))
      expect(entry?.backend).toBe('webgl2')
      expect(entry?.definition.family).toBe('procedural')
      expect(entry?.definition.outputPorts[0]?.id).toBe(CINEMA_CINEMATIC_WORLD_COLOR_OUTPUT_PORT_ID)
      expect(entry?.definition.metadata?.worldId).toBe(definition.id)
      expect(entry?.definition.metadata?.standaloneEngineRetained).toBe(true)
      expect(entry?.definition.metadata?.legacyCapabilities).toEqual(definition.capabilities)
      expect(entry?.definition.metadata?.direction).toEqual(JSON.parse(JSON.stringify(definition.direction ?? null)))
      expect(entry?.definition.parameters.length).toBeGreaterThan(20)
      expect(Object.isFrozen(definition.capabilities)).toBe(false)
      if (definition.direction) expect(Object.isFrozen(definition.direction)).toBe(false)
    }

    const legacy = CINEMA_CINEMATIC_WORLD_ADAPTER_BUNDLE.entries.find(entry => entry.worldId === 'legacyPortal')
    expect(legacy?.backend).toBe('canvas2d')
    expect(legacy?.definition.capabilities.canvas2d.compatibility).toBe('raster-upload')
    expect(legacy?.definition.capabilities.requires).toEqual({ webgl2: true, canvas2d: true })
  })

  it('declares camera controls from each world direction instead of a generic all-modes list', () => {
    const eventHorizon = CINEMA_CINEMATIC_WORLD_ADAPTER_BUNDLE.entries.find(entry => entry.worldId === 'eventHorizon')
    const corridor = CINEMA_CINEMATIC_WORLD_ADAPTER_BUNDLE.entries.find(entry => entry.worldId === 'infiniteCorridor')
    expect(eventHorizon?.definition.capabilities.camera.controls).toEqual(expect.arrayContaining(['position', 'rotation', 'fov', 'roll', 'target', 'orbit', 'speed', 'banking', 'beat-punch']))
    expect(eventHorizon?.definition.capabilities.camera.controls).not.toEqual(expect.arrayContaining(['dolly', 'handheld', 'shake', 'depth-of-field']))
    expect(corridor?.definition.capabilities.camera.controls).toEqual(expect.arrayContaining(['position', 'rotation', 'fov', 'roll', 'dolly', 'speed', 'handheld', 'shake', 'beat-punch']))
    expect(corridor?.definition.capabilities.camera.controls).not.toContain('orbit')
  })

  it('derives non-shader Inspector support from each Cinematic World runtime contract', () => {
    const corridor = CINEMA_CINEMATIC_WORLD_ADAPTER_BUNDLE.entries.find(entry => entry.worldId === 'infiniteCorridor')
    expect(corridor).toBeDefined()
    const supported = getCinemaSupportedParameterSchemas(corridor!.definition).map(parameter => parameter.label)
    expect(supported).not.toContain('Intensity')
    expect(supported).toContain('Motion')
    expect(supported).toContain('Glow')
    expect(supported).toContain('Fog Density')
    expect(supported).not.toContain('Bass Reactivity')
    expect(supported).not.toContain('Trail Decay')
    expect(supported).not.toContain('Particle Density')
    expect(supported).toContain('Seed')
    expect(supported).toContain('Quality Tier')
    expect(supported).not.toContain('Environment Depth')
    expect(supported).not.toContain('Environment Fog')
    expect(supported).not.toContain('Bloom')
    expect(supported).not.toContain('Material Glow')
  })

  it('hides generic Environment/Material fields and post-pipeline-only world settings that Cinema never renders', () => {
    const eventHorizon = CINEMA_CINEMATIC_WORLD_ADAPTER_BUNDLE.entries.find(entry => entry.worldId === 'eventHorizon')
    const reactive = CINEMA_CINEMATIC_WORLD_ADAPTER_BUNDLE.entries.find(entry => entry.worldId === 'reactiveConstellation')
    const legacy = CINEMA_CINEMATIC_WORLD_ADAPTER_BUNDLE.entries.find(entry => entry.worldId === 'legacyPortal')
    expect(eventHorizon).toBeDefined()
    expect(reactive).toBeDefined()
    expect(legacy).toBeDefined()

    const eventLabels = getCinemaSupportedParameterSchemas(eventHorizon!.definition).map(parameter => parameter.label)
    expect(eventLabels).not.toContain('Environment Depth')
    expect(eventLabels).not.toContain('Bloom')
    expect(eventLabels).not.toContain('Bloom Boost')
    expect(eventLabels).not.toContain('Chromatic Aberration Boost')
    expect(eventLabels).toContain('Core Radius')
    expect(eventLabels).toContain('Lensing Strength')

    const reactiveLabels = getCinemaSupportedParameterSchemas(reactive!.definition).map(parameter => parameter.label)
    expect(reactiveLabels).toContain('Environment Fog')
    expect(reactiveLabels).toContain('Atmosphere')
    expect(reactiveLabels).toContain('Material Glow')
    expect(reactiveLabels).not.toContain('Environment Depth')
    expect(reactiveLabels).not.toContain('Bloom')
    expect(reactiveLabels).not.toContain('Visual Dna Profile')
    expect(reactiveLabels).toContain('Choreography Profile')

    const legacyLabels = getCinemaSupportedParameterSchemas(legacy!.definition).map(parameter => parameter.label)
    expect(legacyLabels).toContain('Intensity')
    expect(legacyLabels).toContain('Bass Reactivity')
    expect(legacyLabels).not.toContain('Trail Decay')
    expect(legacyLabels).not.toContain('Quality Tier')
    expect(legacyLabels).not.toContain('Environment Fog')
    expect(legacyLabels).not.toContain('Material Glow')
  })

  it('does not treat standalone-only modulation targets as Cinema consumers', () => {
    const eventHorizon = CINEMA_CINEMATIC_WORLD_ADAPTER_BUNDLE.entries.find(entry => entry.worldId === 'eventHorizon')
    const mirror = CINEMA_CINEMATIC_WORLD_ADAPTER_BUNDLE.entries.find(entry => entry.worldId === 'mirrorDimension')
    const cathedral = CINEMA_CINEMATIC_WORLD_ADAPTER_BUNDLE.entries.find(entry => entry.worldId === 'celestialCathedral')
    expect(eventHorizon).toBeDefined()
    expect(mirror).toBeDefined()
    expect(cathedral).toBeDefined()

    const eventLabels = getCinemaSupportedParameterSchemas(eventHorizon!.definition).map(parameter => parameter.label)
    const mirrorLabels = getCinemaSupportedParameterSchemas(mirror!.definition).map(parameter => parameter.label)
    const cathedralLabels = getCinemaSupportedParameterSchemas(cathedral!.definition).map(parameter => parameter.label)
    expect(eventLabels).not.toContain('Trail Decay')
    expect(mirrorLabels).toContain('Trail Decay')
    expect(cathedralLabels).not.toContain('Fog Density')
    expect(cathedralLabels).toContain('Particle Density')
  })

  it('filters preset-backed common sliders when authored audio mapping bypasses their fallback consumer', () => {
    const preset = DEFAULT_REACT_PRESETS.find(candidate => candidate.id === 'preset-singularity-crown')
    const eventHorizon = CINEMA_CINEMATIC_WORLD_ADAPTER_BUNDLE.entries.find(entry => entry.worldId === 'eventHorizon')
    expect(preset).toBeDefined()
    expect(eventHorizon).toBeDefined()
    const composition = createCinemaCinematicPresetComposition(
      preset!,
      CINEMA_FOUNDATION_OUTPUT_TYPE_ID,
      CINEMA_FOUNDATION_INPUT_PORT_ID,
    )
    const node = composition.nodes.find(candidate => candidate.family === 'procedural')
    expect(node).toBeDefined()

    const labels = getCinemaCinematicWorldSupportedParameterSchemasForNode(eventHorizon!.definition, node!).map(parameter => parameter.label)
    expect(labels).not.toContain('Intensity')
    expect(labels).not.toContain('Motion')
    expect(labels).not.toContain('Glow')
    expect(labels).not.toContain('Bass Reactivity')
    expect(labels).not.toContain('Trail Decay')
    expect(labels).not.toContain('Fog Density')
    expect(labels).not.toContain('Particle Density')
    expect(labels).toContain('Seed')
    expect(labels).toContain('Quality Tier')
    expect(labels).toContain('Primary Color')
    expect(labels).toContain('Background Color')
    expect(labels).toContain('Core Radius')
  })

  it('preserves hidden preset parameter values through canonical save hydration', () => {
    const preset = DEFAULT_REACT_PRESETS.find(candidate => candidate.id === 'preset-singularity-crown')
    const eventHorizon = CINEMA_CINEMATIC_WORLD_ADAPTER_BUNDLE.entries.find(entry => entry.worldId === 'eventHorizon')
    expect(preset).toBeDefined()
    expect(eventHorizon).toBeDefined()

    const authored = createCinemaCinematicPresetComposition(
      preset!,
      CINEMA_FOUNDATION_OUTPUT_TYPE_ID,
      CINEMA_FOUNDATION_INPUT_PORT_ID,
      {
        compositionId: cinemaStableId<CinemaCompositionId>('legacy-cinematic-preset-singularity-crown', 'composition'),
        worldNodeId: cinemaStableId<CinemaNodeId>('legacy-cinematic-preset-singularity-crown', 'node'),
        outputNodeId: cinemaStableId<CinemaNodeId>('legacy-cinematic-output-preset-singularity-crown', 'node'),
      },
    )
    const state = createCinemaFoundationPersistedState()
    const persisted = state.compositions.find(composition => composition.id === authored.id)
    const persistedNode = persisted?.nodes.find(candidate => candidate.family === 'procedural')
    const motionId = cinemaCinematicWorldParameterId('motion')
    expect(persistedNode).toBeDefined()
    expect(Object.prototype.hasOwnProperty.call(persistedNode?.parameterValues ?? {}, motionId)).toBe(true)
    const savedMotion = persistedNode?.parameterValues[motionId]

    const store = createCinemaStore()
    expect(store.getState().hydrateCinemaState(JSON.parse(JSON.stringify(state))).ok).toBe(true)
    const reloaded = store.getState().compositions.find(composition => composition.id === authored.id)
    const reloadedNode = reloaded?.nodes.find(candidate => candidate.family === 'procedural')
    expect(reloadedNode?.parameterValues[motionId]).toEqual(savedMotion)

    const labels = getCinemaCinematicWorldSupportedParameterSchemasForNode(eventHorizon!.definition, reloadedNode!).map(parameter => parameter.label)
    expect(labels).not.toContain('Motion')
  })

  it('keeps Reactive Constellation direct common controls while hiding its mapped-only common controls', () => {
    const preset = DEFAULT_REACT_PRESETS.find(candidate => candidate.id === 'preset-crystal-synapse')
    const reactive = CINEMA_CINEMATIC_WORLD_ADAPTER_BUNDLE.entries.find(entry => entry.worldId === 'reactiveConstellation')
    expect(preset).toBeDefined()
    expect(reactive).toBeDefined()
    const composition = createCinemaCinematicPresetComposition(
      preset!,
      CINEMA_FOUNDATION_OUTPUT_TYPE_ID,
      CINEMA_FOUNDATION_INPUT_PORT_ID,
    )
    const node = composition.nodes.find(candidate => candidate.family === 'procedural')
    expect(node).toBeDefined()

    const labels = getCinemaCinematicWorldSupportedParameterSchemasForNode(reactive!.definition, node!).map(parameter => parameter.label)
    expect(labels).toEqual(expect.arrayContaining(['Intensity', 'Motion', 'Glow']))
    expect(labels).not.toEqual(expect.arrayContaining(['Bass Reactivity', 'Trail Decay', 'Fog Density', 'Particle Density']))
    expect(labels).toEqual(expect.arrayContaining(['Environment Fog', 'Atmosphere', 'Material Glow']))
  })

  it('declares Background for every preset-backed fullscreen world that consumes it', () => {
    const backgroundWorldIds = [
      'eventHorizon',
      'infiniteCorridor',
      'fractureRift',
      'mirrorDimension',
      'ancientMachine',
      'stormGateway',
    ] as const

    for (const worldId of backgroundWorldIds) {
      const entry = CINEMA_CINEMATIC_WORLD_ADAPTER_BUNDLE.entries.find(candidate => candidate.worldId === worldId)
      expect(entry, worldId).toBeDefined()
      expect(getCinemaSupportedPaletteRoles(entry!.definition), worldId).toEqual([
        'primary',
        'secondary',
        'accent',
        'background',
      ])
      const labels = getCinemaSupportedParameterSchemas(entry!.definition).map(parameter => parameter.label)
      expect(labels, worldId).toEqual(expect.arrayContaining([
        'Primary Color',
        'Secondary Color',
        'Accent Color',
        'Background Color',
      ]))
      expect(labels, worldId).not.toContain('Highlight Color')
      expect(labels, worldId).not.toContain('Foreground Color')
    }

    const eventHorizon = CINEMA_CINEMATIC_WORLD_ADAPTER_BUNDLE.entries.find(entry => entry.worldId === 'eventHorizon')
    const reactive = CINEMA_CINEMATIC_WORLD_ADAPTER_BUNDLE.entries.find(entry => entry.worldId === 'reactiveConstellation')
    const legacy = CINEMA_CINEMATIC_WORLD_ADAPTER_BUNDLE.entries.find(entry => entry.worldId === 'legacyPortal')
    expect(eventHorizon).toBeDefined()
    expect(reactive).toBeDefined()
    expect(legacy).toBeDefined()

    const background = eventHorizon!.definition.parameters.find(parameter => parameter.label === 'Background Color')
    const eventHorizonComposition = createCinemaCinematicWorldComposition(
      'eventHorizon',
      CINEMA_FOUNDATION_OUTPUT_TYPE_ID,
      CINEMA_FOUNDATION_INPUT_PORT_ID,
    )
    const eventHorizonNode = eventHorizonComposition.nodes.find(node => node.family === 'procedural')
    expect(background).toBeDefined()
    expect(eventHorizonNode?.parameterValues[background!.id]).toEqual(background!.default)

    expect(getCinemaSupportedPaletteRoles(reactive!.definition)).toEqual(['primary', 'secondary', 'accent', 'background'])
    expect(getCinemaSupportedPaletteRoles(legacy!.definition)).toEqual(['primary', 'secondary', 'accent', 'background'])
  })

  it('hydrates Electric Storm through the production Cinema preset path and renders its WebGL world', () => {
    const preset = DEFAULT_REACT_PRESETS.find(candidate => candidate.id === 'preset-electric-storm')
    const electricStorm = CINEMA_CINEMATIC_WORLD_ADAPTER_BUNDLE.entries.find(entry => entry.worldId === 'electricStorm')
    expect(preset).toBeDefined()
    expect(electricStorm).toBeDefined()

    const composition = createCinemaCinematicPresetComposition(
      preset!,
      CINEMA_FOUNDATION_OUTPUT_TYPE_ID,
      CINEMA_FOUNDATION_INPUT_PORT_ID,
      { compositionId: cinemaStableId<CinemaCompositionId>('electric-storm-production-test', 'composition') },
    )
    const node = composition.nodes.find(candidate => candidate.family === 'procedural')
    expect(node).toBeDefined()
    const backgroundId = cinemaCinematicWorldParameterId('world-background-color')
    const lightningId = cinemaCinematicWorldParameterId('world-lightning-color')
    const masterId = cinemaCinematicWorldParameterId('world-master-intensity')
    const impactShakeId = cinemaCinematicWorldParameterId('world-impact-shake')
    const zoomPunchId = cinemaCinematicWorldParameterId('world-zoom-punch')
    const thunderTriggerId = cinemaCinematicWorldParameterId('world-thunder-trigger')
    const flashIntensityId = cinemaCinematicWorldParameterId('world-flash-intensity')
    const flashDurationId = cinemaCinematicWorldParameterId('world-flash-duration')
    const flashDecayId = cinemaCinematicWorldParameterId('world-flash-decay')
    expect(node?.parameterValues[backgroundId]).toEqual([0, 0, 0, 1])
    expect(node?.parameterValues[lightningId]).toEqual([74 / 255, 167 / 255, 1, 1])
    expect(node?.parameterValues[masterId]).toBe(0.5)
    expect(node?.parameterValues[impactShakeId]).toBe(0.5)
    expect(node?.parameterValues[zoomPunchId]).toBe(0.5)
    expect(node?.parameterValues[flashIntensityId]).toBe(0.5)
    expect(node?.parameterValues[flashDurationId]).toBe(0.5)
    expect(node?.parameterValues[flashDecayId]).toBe(0.5)
    const thunderTriggerSchema = electricStorm!.definition.parameters.find(parameter => parameter.id === thunderTriggerId)
    expect(thunderTriggerSchema?.type).toBe('enum')
    if (thunderTriggerSchema?.type !== 'enum') throw new Error('Expected Electric Storm thunder trigger enum schema.')
    expect(node?.parameterValues[thunderTriggerId]).toBe(thunderTriggerSchema.default)
    expect(thunderTriggerSchema.options.map(option => option.label)).toEqual([
      'Energy', 'Beat', 'Downbeat', '2 Beats', '4 Beats', 'Bar', '4 Bars', '8 Bars', 'Phrase', 'Drop',
    ])

    const supportedSchemas = getCinemaCinematicWorldSupportedParameterSchemasForNode(electricStorm!.definition, node!)
    const supportedLabels = supportedSchemas.map(parameter => parameter.label)
    expect(supportedLabels).toEqual(expect.arrayContaining([
      'Background Color', 'Lightning Color', 'Master Intensity', 'Strike Rate', 'Branching', 'Thickness', 'Glow', 'Impact Shake', 'Zoom Punch',
      'Thunder Trigger', 'Flash Intensity', 'Flash Duration', 'Flash Decay',
    ]))
    expect(supportedLabels).not.toContain('Seed')
    expect(supportedSchemas.filter(parameter => parameter.group === 'React').map(parameter => parameter.label)).toEqual([
      'Thunder Trigger', 'Flash Intensity', 'Flash Duration', 'Flash Decay',
    ])

    const state = createCinemaFoundationPersistedState()
    const harness = createExecutorHarness(CINEMA_PRODUCTION_RUNTIME_REGISTRY, state.definitions, false)
    vi.mocked(harness.gl.getUniformLocation).mockImplementation((_program: WebGLProgram, name: string) => ({ name } as unknown as WebGLUniformLocation))
    harness.executor.setGraph({ composition, instance: null, definitions: state.definitions })
    expect(harness.executor.render(frame(0))).toBe(true)
    expect(harness.executor.render(frame(1))).toBe(true)
    expect(harness.executor.render(frame(2, false, true))).toBe(true)
    expect(harness.executor.render(frame(3))).toBe(true)
    expect(harness.executor.render(frame(4, false, false, { bar4: true }))).toBe(true)
    // Strike Rate now genuinely gates kick-driven strikes (Issue 1 fix), so a
    // single forced kick is an intentionally uncertain trial at this preset's
    // default 50% Strike Rate. Render many independent kick onsets (kick must
    // toggle off between them — ElectricStormAudioChoreographer dedupes a
    // sustained "active" kick to one event) so at least one real strike is
    // certain regardless of this run's random strike-generator session seed.
    for (let generation = 5; generation < 125; generation += 1) {
      expect(harness.executor.render(frame(generation, false, false, { kick: generation % 2 === 1 }))).toBe(true)
    }
    const uniformLocationCalls = vi.mocked(harness.gl.getUniformLocation).mock.calls as unknown as Array<[WebGLProgram, string]>
    expect(uniformLocationCalls.map(([, name]) => name)).toEqual(expect.arrayContaining([
      'uStrikeStyle0', 'uStrikeStyle1', 'uStrikeStyle2',
      'uImpactShake', 'uZoomPunch', 'uImpactStrength', 'uAudioDetail', 'uThunderFlash',
    ]))
    const strikeMetaCalls = (vi.mocked(harness.gl.uniform4f).mock.calls as unknown as Array<[WebGLUniformLocation, number, number, number, number]>).filter(([location]) => (
      typeof location === 'object' && location !== null && String((location as unknown as { name?: string }).name).startsWith('uStrikeMeta')
    ))
    expect(strikeMetaCalls.some(([, age, duration, intensity]) => Number(age) >= 0 && Number(duration) > 0 && Number(intensity) > 0)).toBe(true)
    const impactCalls = (vi.mocked(harness.gl.uniform1f).mock.calls as unknown as Array<[WebGLUniformLocation, number]>).filter(([location]) => (
      typeof location === 'object' && location !== null && (location as unknown as { name?: string }).name === 'uImpactStrength'
    ))
    expect(impactCalls.some(([, value]) => Number(value) > 0)).toBe(true)
    const thunderCalls = (vi.mocked(harness.gl.uniform1f).mock.calls as unknown as Array<[WebGLUniformLocation, number]>).filter(([location]) => (
      typeof location === 'object' && location !== null && (location as unknown as { name?: string }).name === 'uThunderFlash'
    ))
    expect(thunderCalls.some(([, value]) => Number(value) > 0)).toBe(true)
    expect(harness.gl.__calls.drawCount).toBeGreaterThan(0)
    expect(harness.executor.getSnapshot().failedNodeCount).toBe(0)
    expect(harness.diagnostics).not.toContain('CINEMA_NODE_RENDER_FAILED')
    harness.dispose()
  })

  it('retains Reactive Constellation as a specialized deterministic procedural plugin', () => {
    const entry = CINEMA_CINEMATIC_WORLD_ADAPTER_BUNDLE.entries.find(candidate => candidate.worldId === 'reactiveConstellation')
    expect(entry?.definition.family).toBe('procedural')
    expect(entry?.definition.metadata?.specializedProceduralRenderer).toBe(true)
    expect(entry?.definition.metadata?.legacyCapabilities).toMatchObject({
      supportsGeometryPasses: true,
      supportsFullscreenPasses: false,
    })
    expect(entry?.definition.cost.cpu).toBe('high')
    expect(entry?.definition.cost.gpu).toBe('high')
    expect(entry?.definition.output.hasDepth).toBe(true)
    expect(entry?.definition.seekPolicy).toEqual({ mode: 'reset-at-position', seedScope: 'musical-position' })
    expect(cinemaCinematicResetReason('cinema.reset.seek')).toBe('seek')
    expect(cinemaCinematicResetReason('cinema.reset.track-change')).toBe('trackReplacement')
    expect(cinemaCinematicResetReason('cinema.reset.context-restore')).toBe('contextRestored')
  })

  it('executes and deterministically resets the specialized Reactive Constellation renderer', () => {
    const state = createCinemaFoundationPersistedState()
    const composition = createCinemaCinematicWorldComposition(
      'reactiveConstellation',
      CINEMA_FOUNDATION_OUTPUT_TYPE_ID,
      CINEMA_FOUNDATION_INPUT_PORT_ID,
      { compositionId: cinemaStableId<CinemaCompositionId>('reactive-constellation-adapter-test', 'composition') },
    )
    const first = createExecutorHarness(CINEMA_PRODUCTION_RUNTIME_REGISTRY, state.definitions, false)
    first.executor.setGraph({ composition, instance: null, definitions: state.definitions })

    expect(first.executor.render(frame(0))).toBe(true)
    const initialResources = {
      programs: first.gl.__calls.createdPrograms,
      buffers: first.gl.__calls.createdBuffers,
      vertexArrays: first.gl.__calls.createdVertexArrays,
      draws: first.gl.__calls.drawInstancedCount,
    }
    expect(initialResources.buffers).toBeGreaterThan(0)
    expect(initialResources.vertexArrays).toBeGreaterThan(0)
    expect(initialResources.draws).toBeGreaterThan(0)

    expect(first.executor.render(frame(1, true))).toBe(true)
    expect(first.gl.__calls.createdPrograms).toBe(initialResources.programs)
    expect(first.gl.__calls.createdBuffers).toBe(initialResources.buffers)
    expect(first.gl.__calls.createdVertexArrays).toBe(initialResources.vertexArrays)
    expect(first.executor.getSnapshot().failedNodeCount).toBe(0)
    expect(first.diagnostics).not.toContain('CINEMA_NODE_RENDER_FAILED')

    const second = createExecutorHarness(CINEMA_PRODUCTION_RUNTIME_REGISTRY, state.definitions, false)
    second.executor.setGraph({ composition, instance: null, definitions: state.definitions })
    expect(second.executor.render(frame(0))).toBe(true)
    expect(second.executor.render(frame(1, true))).toBe(true)
    expect(second.gl.__calls.drawInstancedCount).toBe(first.gl.__calls.drawInstancedCount)
    expect(second.gl.__calls.createdBuffers).toBe(first.gl.__calls.createdBuffers)
    expect(second.gl.__calls.createdVertexArrays).toBe(first.gl.__calls.createdVertexArrays)

    first.dispose()
    second.dispose()
    expect(first.gl.__calls.deletedBuffers).toBe(first.gl.__calls.createdBuffers)
    expect(first.gl.__calls.deletedVertexArrays).toBe(first.gl.__calls.createdVertexArrays)
    expect(second.gl.__calls.deletedBuffers).toBe(second.gl.__calls.createdBuffers)
    expect(second.gl.__calls.deletedVertexArrays).toBe(second.gl.__calls.createdVertexArrays)
  })

  it('dispatches Stage 12 reseed commands through an adapter-backed cinematic node', () => {
    const state = createCinemaFoundationPersistedState()
    const base = createCinemaCinematicWorldComposition(
      'reactiveConstellation',
      CINEMA_FOUNDATION_OUTPUT_TYPE_ID,
      CINEMA_FOUNDATION_INPUT_PORT_ID,
      { compositionId: cinemaStableId<CinemaCompositionId>('constellation-performance-reseed-test', 'composition') },
    )
    const cinematicNode = base.nodes.find(node => node.family === 'procedural')
    expect(cinematicNode).toBeDefined()
    if (!cinematicNode) return
    const composition: CinemaCompositionDefinition = {
      ...base,
      revision: base.revision + 1,
      performanceRules: [{
        schemaVersion: CINEMA_PERFORMANCE_RULE_SCHEMA_VERSION,
        id: 'constellation-drop-reseed-rule' as CinemaPerformanceRuleId,
        label: 'Constellation Drop Reseed',
        priority: 100,
        enabled: true,
        condition: { schemaVersion: CINEMA_PERFORMANCE_RULE_SCHEMA_VERSION, event: 'dropStart' },
        actions: [{
          schemaVersion: CINEMA_PERFORMANCE_ACTION_SCHEMA_VERSION,
          id: 'constellation-reseed' as CinemaActionId,
          type: 'reseedSimulation',
          nodeId: cinematicNode.id,
        }],
      }],
    }
    const harness = createExecutorHarness(CINEMA_PRODUCTION_RUNTIME_REGISTRY, state.definitions, false)
    harness.executor.setGraph({ composition, instance: null, definitions: state.definitions })

    expect(harness.executor.render(frame(0, false, true))).toBe(true)
    expect(harness.executor.getSnapshot()).toMatchObject({
      activePerformanceRuleCount: 1,
      failedNodeCount: 0,
    })
    expect(harness.diagnostics).not.toContain('CINEMA_NODE_RESET_FAILED')
    expect(harness.diagnostics).not.toContain('CINEMA_NODE_RENDER_FAILED')
    harness.dispose()
  })

  it('renders a representative WebGL world through the production Cinema graph executor', () => {
    const state = createCinemaFoundationPersistedState()
    const harness = createExecutorHarness(CINEMA_PRODUCTION_RUNTIME_REGISTRY, state.definitions, false)
    harness.executor.setGraph({
      composition: CINEMA_CINEMATIC_WORLD_REFERENCE_COMPOSITION,
      instance: null,
      definitions: state.definitions,
    })

    expect(harness.executor.render(frame(0))).toBe(true)
    expect(harness.gl.__calls.drawCount).toBeGreaterThanOrEqual(2)
    expect(harness.targets.getDiagnostics().activeLeaseCount).toBe(0)
    expect(harness.diagnostics).not.toContain('CINEMA_NODE_INITIALIZE_FAILED')
    expect(harness.diagnostics).not.toContain('CINEMA_NODE_RENDER_FAILED')
    expect(harness.executor.getSnapshot().safeOutputActive).toBe(false)

    const programsBeforeReset = harness.gl.__calls.createdPrograms
    expect(harness.executor.render(frame(1, true))).toBe(true)
    expect(harness.gl.__calls.createdPrograms).toBe(programsBeforeReset)
    expect(harness.executor.getSnapshot().failedNodeCount).toBe(0)
    harness.dispose()
  })

  it('selects Gear Sun through the real Cinema preset adapter and forwards its same-frame gestures to the final world renderer', () => {
    const preset = DEFAULT_REACT_PRESETS.find(candidate => candidate.id === 'preset-gear-sun')
    const sourceDefinition = cinematicWorldDefinitions.find(candidate => candidate.id === 'ancientMachine')
    expect(preset?.cinematicConfig?.worldMode).toBe('ancientMachine')
    expect(sourceDefinition).toBeDefined()
    if (!preset || !sourceDefinition) return

    const renderedFrames: CinematicRenderFrame[] = []
    const captureDefinition: CinematicWebGLWorldDefinition = {
      ...sourceDefinition,
      capabilities: { ...sourceDefinition.capabilities, modulationTargets: [...sourceDefinition.capabilities.modulationTargets] },
      create: () => ({
        initialize: vi.fn(),
        resize: vi.fn(),
        render: vi.fn((captured: CinematicRenderFrame) => { renderedFrames.push(captured) }),
        reset: vi.fn(),
        dispose: vi.fn(),
      }),
    }
    const bundle = createCinemaCinematicWorldAdapterBundle({
      webglDefinitions: [captureDefinition],
      legacyDefinition: null,
    })
    const runtimeRegistry = createCinemaRuntimeNodeRegistry([
      ...CINEMA_FOUNDATION_RUNTIME_REGISTRY.list(),
      ...bundle.runtimeRegistrations,
    ]).registry
    const definitions = [...CINEMA_FOUNDATION_PERSISTED_DEFINITIONS, ...bundle.persistedDefinitions]
    const composition = createCinemaCinematicPresetComposition(
      preset,
      CINEMA_FOUNDATION_OUTPUT_TYPE_ID,
      CINEMA_FOUNDATION_INPUT_PORT_ID,
    )
    const harness = createExecutorHarness(runtimeRegistry, definitions, false)
    harness.executor.setGraph({ composition, instance: null, definitions })

    expect(harness.executor.render(frame(10))).toBe(true)
    expect(harness.executor.render(frame(11, false, false, { beat: true, kick: true }))).toBe(true)
    const captured = renderedFrames[renderedFrames.length - 1]
    expect(captured?.presetId).toBe('preset-gear-sun')
    expect(captured?.modulation?.values.impact).toBeGreaterThanOrEqual(0.95)
    expect(captured?.modulation?.values.environmentBrightness).toBeGreaterThanOrEqual(0.7)
    expect(harness.executor.getSnapshot().failedNodeCount).toBe(0)
    expect(harness.diagnostics).not.toContain('CINEMA_PARAMETER_SCHEMA_INVALID')
    expect(harness.diagnostics).not.toContain('CINEMA_NODE_RENDER_FAILED')
    harness.dispose()
  })

  it('renders legacyPortal through offscreen Canvas2D upload without creating another animation loop', () => {
    const legacyDefinition = cinematicWorldRendererRegistry.resolve('legacyPortal')
    if (!legacyDefinition || legacyDefinition.backend !== 'canvas2d') throw new Error('legacyPortal definition unavailable')
    const originalRequestAnimationFrame = globalThis.requestAnimationFrame
    const requestAnimationFrameSpy = vi.fn()
    Object.defineProperty(globalThis, 'requestAnimationFrame', {
      configurable: true,
      writable: true,
      value: requestAnimationFrameSpy,
    })
    const bundle = createCinemaCinematicWorldAdapterBundle({
      webglDefinitions: [],
      legacyDefinition,
      createCanvas: createCanvas2DStub,
    })
    const runtimeRegistry = createCinemaRuntimeNodeRegistry([
      ...CINEMA_FOUNDATION_RUNTIME_REGISTRY.list(),
      ...bundle.runtimeRegistrations,
    ]).registry
    const definitions = [...CINEMA_FOUNDATION_PERSISTED_DEFINITIONS, ...bundle.persistedDefinitions]
    const composition = createCinemaCinematicWorldComposition(
      'legacyPortal',
      CINEMA_FOUNDATION_OUTPUT_TYPE_ID,
      CINEMA_FOUNDATION_INPUT_PORT_ID,
      { compositionId: cinemaStableId<CinemaCompositionId>('legacy-portal-adapter-test', 'composition') },
    )
    const harness = createExecutorHarness(runtimeRegistry, definitions, true)
    harness.executor.setGraph({ composition, instance: null, definitions })

    expect(harness.executor.render(frame(0))).toBe(true)
    expect(harness.gl.texImage2D).toHaveBeenCalled()
    expect(harness.gl.pixelStorei).toHaveBeenCalledWith(harness.gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true)
    expect(harness.gl.__calls.drawCount).toBeGreaterThanOrEqual(2)
    expect(requestAnimationFrameSpy).not.toHaveBeenCalled()
    expect(harness.diagnostics).not.toContain('CINEMA_NODE_RENDER_FAILED')

    harness.dispose()
    if (originalRequestAnimationFrame) {
      Object.defineProperty(globalThis, 'requestAnimationFrame', {
        configurable: true,
        writable: true,
        value: originalRequestAnimationFrame,
      })
    } else {
      Reflect.deleteProperty(globalThis, 'requestAnimationFrame')
    }
  })

  it('fails closed with structured diagnostics when the Canvas2D compatibility context is unavailable', () => {
    const legacyDefinition = cinematicWorldRendererRegistry.resolve('legacyPortal')
    if (!legacyDefinition || legacyDefinition.backend !== 'canvas2d') throw new Error('legacyPortal definition unavailable')
    const bundle = createCinemaCinematicWorldAdapterBundle({
      webglDefinitions: [],
      legacyDefinition,
      createCanvas: () => ({
        width: 1,
        height: 1,
        getContext: vi.fn(() => null),
      } as unknown as HTMLCanvasElement),
    })
    const runtimeRegistry = createCinemaRuntimeNodeRegistry([
      ...CINEMA_FOUNDATION_RUNTIME_REGISTRY.list(),
      ...bundle.runtimeRegistrations,
    ]).registry
    const definitions = [...CINEMA_FOUNDATION_PERSISTED_DEFINITIONS, ...bundle.persistedDefinitions]
    const composition = createCinemaCinematicWorldComposition(
      'legacyPortal',
      CINEMA_FOUNDATION_OUTPUT_TYPE_ID,
      CINEMA_FOUNDATION_INPUT_PORT_ID,
      { compositionId: cinemaStableId<CinemaCompositionId>('legacy-portal-missing-context-test', 'composition') },
    )
    const harness = createExecutorHarness(runtimeRegistry, definitions, true)
    harness.executor.setGraph({ composition, instance: null, definitions })

    expect(harness.executor.render(frame(0))).toBe(true)
    expect(harness.diagnostics).toContain('CINEMA_CAPABILITY_UNAVAILABLE')
    expect(harness.diagnostics).toContain('CINEMA_NODE_INITIALIZE_FAILED')
    expect(harness.executor.getSnapshot().safeOutputActive).toBe(true)
    expect(harness.targets.getDiagnostics().activeLeaseCount).toBe(0)
    harness.dispose()
  })

  it('registers Stage 10 built-ins through the canonical persisted and runtime production boundaries', () => {
    const state = createCinemaFoundationPersistedState()
    expect(state.compositions.some(composition => composition.id === CINEMA_CINEMATIC_WORLD_REFERENCE_COMPOSITION.id)).toBe(true)
    expect(state.editorMetadata.cinematicWorldAdapterVersion).toBe(1)
    expect(state.editorMetadata.canvas2dAdapterVersion).toBe(1)
    for (const entry of CINEMA_CINEMATIC_WORLD_ADAPTER_BUNDLE.entries) {
      expect(state.definitions.some(definition => definition.id === entry.typeId)).toBe(true)
      expect(CINEMA_PRODUCTION_RUNTIME_REGISTRY.hasPlugin(entry.pluginId)).toBe(true)
    }
  })
})

function createExecutorHarness(
  runtimeRegistry: ReturnType<typeof createCinemaRuntimeNodeRegistry>['registry'],
  _definitions: ReturnType<typeof createCinemaFoundationPersistedState>['definitions'],
  canvas2d: boolean,
) {
  const gl = createCinemaMockWebGL()
  const diagnostics: string[] = []
  const sink = { report: (diagnostic: { code: string }) => diagnostics.push(diagnostic.code) }
  const viewport = { width: 320, height: 180, dpr: 1 }
  const textures = new CinemaTextureManager()
  const targets = new CinemaRenderTargetPool(gl, textures, viewport, sink)
  const webgl = new CinemaWebGLRenderServiceImpl(gl, targets, textures)
  const executor = new CinemaGraphExecutor({
    runtimeRegistry,
    platform: {
      webgl2: true,
      canvas2d,
      floatColorTargets: true,
      floatBlending: true,
      textureArrays: true,
      instancing: true,
      timerQueries: false,
      maximumTextureSize: 8192,
      maximumTextureUnits: 16,
    },
    targets,
    textures,
    webgl,
    diagnostics: sink,
  })
  executor.resize({ width: 1, height: 1, dpr: 1 }, viewport)
  return {
    gl,
    diagnostics,
    targets,
    executor,
    dispose() {
      executor.dispose()
      targets.dispose()
      textures.dispose()
    },
  }
}

function createCanvas2DStub(): HTMLCanvasElement {
  const canvas = { width: 1, height: 1 } as HTMLCanvasElement
  const gradient = { addColorStop: vi.fn() }
  const known: Record<string, unknown> = {
    canvas,
    createLinearGradient: vi.fn(() => gradient),
    createRadialGradient: vi.fn(() => gradient),
  }
  const context = new Proxy(known, {
    get(target, property) {
      if (property in target) return target[String(property)]
      const value = vi.fn()
      target[String(property)] = value
      return value
    },
    set(target, property, value) {
      target[String(property)] = value
      return true
    },
  }) as unknown as CanvasRenderingContext2D
  Object.assign(canvas, { getContext: vi.fn(() => context) })
  return canvas
}

function frame(
  generation: number,
  reset = false,
  dropStart = false,
  events: Partial<{ beat: boolean; kick: boolean; snare: boolean; bar4: boolean }> = {},
): Readonly<CinemaFrameContext> {
  const clock = (spanBeats: number, hit = false, eventId: CinemaEventId | null = null) => ({ available: true, spanBeats, index: generation, phase: 0.25, hit, eventId })
  const beat = events.beat ?? generation === 0
  const kick = events.kick ?? generation === 0
  const snare = events.snare ?? false
  return {
    version: 1,
    viewport: { width: 320, height: 180, dpr: 1 },
    timing: {
      frameIndex: generation,
      elapsedTimeSec: generation / 60,
      deltaTimeSec: 1 / 60,
      seeds: { composition: 1, track: 2, musicalPosition: 3, event: 4 },
    },
    transport: {
      trackId: 'stage-10-adapter-test',
      audioTimeSec: generation / 60,
      durationSec: 60,
      playing: true,
      paused: false,
      seeking: reset,
      looped: false,
      visibilitySuspended: false,
      discontinuity: reset,
      discontinuityReasons: reset ? ['seek'] : [],
      reset: {
        required: reset,
        reconstruct: reset,
        generation,
        reasons: reset ? ['seek'] : [],
        actionIds: reset ? ['cinema.reset.seek'] : [],
        identity: reset ? `seek-${generation}` : null,
      },
    },
    audio: {
      available: true,
      volume: 0.7,
      rms: 0.6,
      energy: 0.65,
      bass: 0.8,
      mid: 0.5,
      high: 0.4,
      sub: 0.75,
      centroid: 0.5,
      flux: 0.3,
      harmonicity: 0.5,
      complexity: 0.4,
      tension: 0.3,
      buildProgress: 0.2,
      dropImpact: dropStart ? 1 : 0,
      vocalPresence: 0.1,
      fft: new Uint8Array([0, 64, 128, 255]),
      waveform: new Uint8Array([128, 160, 96, 128]),
    },
    music: {
      available: true,
      source: 'music-intelligence',
      bpm: 150,
      beatIndex: generation,
      beatPhase: 0.25,
      beatInBar: generation % 4,
      barIndex: Math.floor(generation / 4),
      phraseIndex: 0,
      sectionId: 'verse-1',
      sectionType: 'verse',
      sectionProgress: 0.2,
      clocks: {
        beat: false,
        beat2: false,
        beat4: false,
        bar: false,
        bar4: events.bar4 ?? false,
        bar8: false,
        phrase: false,
        states: {
          beat: clock(1),
          beat2: clock(2),
          beat4: clock(4),
          bar: clock(4),
          bar4: clock(16, events.bar4 ?? false, events.bar4 ? `music:bar4:${generation}` as CinemaEventId : null),
          bar8: clock(32),
          phrase: clock(32),
        },
      },
    },
    impulses: {
      beat,
      downbeat: generation === 0,
      kick,
      snare,
      transient: kick || snare,
      sectionStart: dropStart,
      dropStart,
      lyricCue: false,
      lyricWord: false,
      phrase4: false,
      phrase8: false,
      eventIds: {
        beat: null,
        downbeat: null,
        kick: null,
        snare: null,
        transient: null,
        sectionStart: dropStart ? 'music:drop-section' as CinemaEventId : null,
        dropStart: dropStart ? 'music:drop-section' as CinemaEventId : null,
        lyricCue: null,
        lyricWord: null,
        phrase4: null,
        phrase8: null,
      },
    },
    lyrics: {
      available: false,
      sourceIdentity: null,
      lineId: null,
      lineText: null,
      wordId: null,
      wordText: null,
      lineProgress: 0,
      wordProgress: 0,
      vocalsActive: false,
    },
    performance: { actionIds: [], toggleStates: {} },
    brand: { available: false, colors: {} },
    capabilities: {
      analyser: true,
      musicIntelligence: true,
      beatGrid: true,
      authoritativeSections: true,
      lyrics: false,
      brandKit: false,
      sharedPerformance: true,
      mediaAssets: false,
    },
    activeCameraId: null,
    camera: null,
  }
}
