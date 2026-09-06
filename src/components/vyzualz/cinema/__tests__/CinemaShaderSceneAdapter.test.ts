import { describe, expect, it, vi } from 'vitest'
import {
  CINEMA_PERFORMANCE_ACTION_SCHEMA_VERSION,
  CINEMA_PERFORMANCE_RULE_SCHEMA_VERSION,
  type CinemaCompositionDefinition,
} from '../CinemaDomain'
import {
  CINEMA_FOUNDATION_COMPOSITION_ID,
  CINEMA_FOUNDATION_GRADIENT_DEFINITION,
  CINEMA_FOUNDATION_INPUT_PORT_ID,
  CINEMA_FOUNDATION_OUTPUT_TYPE_ID,
  CINEMA_LEGACY_PRESET_CATALOG,
  CINEMA_PRODUCTION_RUNTIME_REGISTRY,
  CINEMA_SHADER_REFERENCE_COMPOSITION,
  createCinemaFoundationPersistedState,
  reconcileCinemaBuiltInState,
} from '../CinemaFoundation'
import {
  CINEMA_SHADER_SCENE_ADAPTER_BUNDLE,
  CINEMA_SHADER_SCENE_COLOR_OUTPUT_PORT_ID,
  cinemaShaderBrandTexturePortId,
  cinemaShaderParameterId,
  cinemaShaderSceneTypeId,
  cinemaShaderTextureInputPortId,
  createCinemaShaderSceneAdapterBundle,
  createCinemaShaderSceneComposition,
  createCinemaShaderSceneParameterValues,
} from '../CinemaShaderSceneAdapter'
import {
  cinemaStableId,
  type CinemaActionId,
  type CinemaCompositionId,
  type CinemaEventId,
  type CinemaPerformanceRuleId,
} from '../CinemaIdentifiers'
import type { CinemaFrameContext } from '../CinemaRendererContracts'
import { CinemaGraphExecutor } from '../runtime/CinemaGraphExecutor'
import { CinemaRenderTargetPool } from '../runtime/CinemaRenderTargetPool'
import { CinemaTextureManager } from '../runtime/CinemaTextureManager'
import { CinemaWebGLRenderServiceImpl } from '../runtime/CinemaWebGLRenderService'
import { ShaderRegistry, shaderRegistry } from '../../react/shaders/registry'
import type { ShaderDefinition } from '../../react/shaders/registry/shaderRegistryTypes'
import { REACTOR_SCENE_ID } from '../../react/shaders/scenes/reactor'
import { PRISM_TUNNEL } from '../../react/shaders/scenes/prismTunnel'
import { getCinemaSupportedPaletteRoles, getCinemaSupportedParameterSchemas } from '../CinemaParameterCapabilities'
import { SOUND_DRAWING_VECTORSCOPE } from '../../react/shaders/scenes/soundDrawingVectorscope'
import { createCinemaMockWebGL } from './CinemaWebGLTestUtils'
import { CinemaImpulseGate } from '../CinemaImpulseGate'
import { disposeCinemaShaderProgramCache } from '../CinemaShaderProgramCache'

describe('Cinema ShaderSceneNodeAdapter', () => {
  it('maps every active Shader registry scene into stable Cinema contracts', () => {
    expect(CINEMA_SHADER_SCENE_ADAPTER_BUNDLE.entries).toHaveLength(shaderRegistry.size)
    expect(CINEMA_SHADER_SCENE_ADAPTER_BUNDLE.persistedDefinitions).toHaveLength(shaderRegistry.size)

    for (const shader of shaderRegistry.getAll()) {
      const entry = CINEMA_SHADER_SCENE_ADAPTER_BUNDLE.entries.find(candidate => candidate.sceneId === shader.id)
      expect(entry).toBeDefined()
      expect(entry?.typeId).toBe(cinemaShaderSceneTypeId(shader.id))
      expect(entry?.definition.family).toBe('shader')
      expect(entry?.definition.outputPorts[0]?.id).toBe(CINEMA_SHADER_SCENE_COLOR_OUTPUT_PORT_ID)
      expect(entry?.definition.shaderPasses).toHaveLength(Math.max(1, shader.passes?.length ?? 0))
      expect(entry?.definition.metadata?.shaderSceneId).toBe(shader.id)
      expect(entry?.definition.parameters.length).toBeGreaterThanOrEqual(shader.params.length + 7)
    }

    const reactor = CINEMA_SHADER_SCENE_ADAPTER_BUNDLE.entries.find(entry => entry.sceneId === REACTOR_SCENE_ID)
    expect(reactor?.definition.shaderPasses).toHaveLength(3)
    expect(reactor?.definition.cost.pingPongPairCount).toBe(1)
    expect(reactor?.definition.seekPolicy.mode).toBe('reset-at-position')
    expect(reactor?.definition.inputPorts.map(port => port.id)).toEqual([
      cinemaShaderTextureInputPortId('uUserMedia'),
      cinemaShaderTextureInputPortId('uAlbumArtwork'),
      cinemaShaderTextureInputPortId('uMediaOutput'),
      cinemaShaderBrandTexturePortId('brand-logo'),
      cinemaShaderBrandTexturePortId('brand-texture'),
      cinemaShaderBrandTexturePortId('brand-background'),
    ])
    expect(reactor?.definition.metadata?.brandTextureSlotCount).toBe(3)
  })

  it('derives Inspector parameter capability from actual Shader uniform consumers', () => {
    const prism = CINEMA_SHADER_SCENE_ADAPTER_BUNDLE.entries.find(entry => entry.sceneId === PRISM_TUNNEL.id)
    expect(prism).toBeDefined()
    const byLabel = new Map(prism!.definition.parameters.map(parameter => [parameter.label, parameter]))
    const capabilities = new Map(prism!.definition.parameterCapabilities?.map(capability => [capability.parameterId, capability]))

    expect(capabilities.get(byLabel.get('Master Intensity')!.id)?.support).toBe('live')
    expect(capabilities.get(byLabel.get('Master Motion')!.id)?.support).toBe('live')
    expect(capabilities.get(byLabel.get('Master Glow')!.id)?.support).toBe('unsupported')
    expect(capabilities.get(byLabel.get('Master Trail Decay')!.id)?.support).toBe('unsupported')
    expect(capabilities.get(byLabel.get('Master Particle Density')!.id)?.support).toBe('unsupported')
    expect(getCinemaSupportedParameterSchemas(prism!.definition).map(parameter => parameter.label)).toContain('Glow')
  })

  it('exposes one persisted Prism Aperture control and safely defaults old state that lacks it', () => {
    const prism = CINEMA_SHADER_SCENE_ADAPTER_BUNDLE.entries.find(entry => entry.sceneId === PRISM_TUNNEL.id)
    const aperture = prism?.definition.parameters.find(parameter => parameter.label === 'Aperture')
    expect(aperture).toMatchObject({
      id: cinemaShaderParameterId('aperture'),
      type: 'float',
      default: 1,
      min: 0,
      max: 2,
      ui: { control: 'slider' },
    })

    const oldStateValues = createCinemaShaderSceneParameterValues(PRISM_TUNNEL.id, { speed: 0.75 })
    expect(oldStateValues[cinemaShaderParameterId('aperture')]).toBe(1)
    expect(oldStateValues[cinemaShaderParameterId('speed')]).toBe(0.75)
  })

  it('publishes shader semantic palette roles from verified Brand Kit uniform consumers', () => {
    const registry = new ShaderRegistry()
    registry.register({
      ...PRISM_TUNNEL,
      id: 'stage4-palette-capability',
      name: 'Stage 4 Palette Capability',
      fragSrc: 'uniform vec4 uBrandPrimary;\nuniform vec4 uBrandBackground;',
    })
    const definition = createCinemaShaderSceneAdapterBundle(registry).entries[0]!.definition
    expect(getCinemaSupportedPaletteRoles(definition)).toEqual(['primary', 'background'])
    expect(definition.capabilities.palette?.roles).toEqual(['primary', 'background'])

    const supported = getCinemaSupportedParameterSchemas(definition).map(parameter => parameter.label)
    expect(supported).toContain('Primary Color')
    expect(supported).toContain('Background Color')
    expect(supported).not.toContain('Secondary Color')
    expect(supported).not.toContain('Accent Color')
    expect(supported).not.toContain('Foreground Color')
    expect(supported).not.toContain('Highlight Color')
  })

  it('hides a declared Shader parameter when its uniform is missing and uses a conservative legacy fallback', () => {
    const registry = new ShaderRegistry()
    const missingUniform: ShaderDefinition = {
      ...PRISM_TUNNEL,
      id: 'stage2-missing-uniform',
      name: 'Stage 2 Missing Uniform',
      params: [
        ...PRISM_TUNNEL.params,
        {
          id: 'dead-control',
          label: 'Dead Control',
          type: 'float',
          uniformName: 'uDeadControl',
          default: 0.5,
          min: 0,
          max: 1,
          step: 0.01,
        },
      ],
    }
    registry.register(missingUniform)
    const definition = createCinemaShaderSceneAdapterBundle(registry).entries[0]!.definition
    expect(getCinemaSupportedParameterSchemas(definition).map(parameter => parameter.label)).not.toContain('Dead Control')

    const legacyDefinition = { ...CINEMA_FOUNDATION_GRADIENT_DEFINITION, parameterCapabilities: undefined }
    expect(getCinemaSupportedParameterSchemas(legacyDefinition)).toEqual([])
  })

  it('preserves geometry-pass metadata and float-target downgrade semantics for adapter-capable definitions', () => {
    const registry = new ShaderRegistry()
    registry.register(SOUND_DRAWING_VECTORSCOPE)
    const bundle = createCinemaShaderSceneAdapterBundle(registry)
    const definition = bundle.entries[0]?.definition

    expect(definition?.shaderPasses?.some(pass => pass.draw.kind === 'geometry')).toBe(true)
    expect(definition?.capabilities.requires.floatColorTargets).toBe(undefined)
    expect(definition?.capabilities.fallbacks.some(fallback => (
      fallback.capability === 'floatColorTargets' && fallback.behavior === 'use-lower-quality'
    ))).toBe(true)
    expect(definition?.metadata?.prefersFloatTargets).toBe(true)
  })

  it('renders the single-pass reference scene through the real Cinema graph executor', () => {
    const state = createCinemaFoundationPersistedState()
    const harness = createExecutorHarness()
    harness.executor.resize({ width: 1, height: 1, dpr: 1 }, harness.viewport)
    harness.executor.setGraph({
      composition: CINEMA_SHADER_REFERENCE_COMPOSITION,
      instance: null,
      definitions: state.definitions,
    })

    expect(harness.executor.render(frame(0))).toBe(true)
    expect(harness.gl.__calls.drawCount).toBeGreaterThanOrEqual(2)
    expect(harness.targets.getDiagnostics().activeLeaseCount).toBe(0)
    expect(harness.diagnostics).not.toContain('CINEMA_NODE_INITIALIZE_FAILED')
    expect(harness.diagnostics).not.toContain('CINEMA_NODE_RENDER_FAILED')
    expect(harness.executor.getSnapshot().safeOutputActive).toBe(false)

    harness.dispose()
  })

  it('keeps non-Prism Shader scenes outside the Prism radial topology path', () => {
    const liquid = CINEMA_SHADER_SCENE_ADAPTER_BUNDLE.entries.find(entry => entry.sceneId === 'shader-liquid-metaballs')
    expect(liquid).toBeDefined()
    const fragmentSource = liquid?.definition.shaderPasses?.[0]?.fragment.source ?? ''
    expect(fragmentSource).not.toContain('PrismRadialElement')
    expect(fragmentSource).not.toContain('prismTopologyAt')
    expect(fragmentSource).not.toContain('prismApplyAperture')
  })

  it('routes the production Prism Tunnel preset through the radial topology shader path', () => {
    const state = createCinemaFoundationPersistedState()
    const preset = CINEMA_LEGACY_PRESET_CATALOG.manifest.find(entry => entry.legacySourceId === PRISM_TUNNEL.id)
    expect(preset).toBeDefined()
    const composition = CINEMA_LEGACY_PRESET_CATALOG.compositions.find(candidate => candidate.id === preset?.compositionId)
    expect(composition).toBeDefined()
    expect(composition?.nodes.some(node => node.typeId === cinemaShaderSceneTypeId(PRISM_TUNNEL.id))).toBe(true)

    const prismAdapter = CINEMA_SHADER_SCENE_ADAPTER_BUNDLE.entries.find(entry => entry.sceneId === PRISM_TUNNEL.id)
    const fragmentSource = prismAdapter?.definition.shaderPasses?.[0]?.fragment.source ?? ''
    expect(fragmentSource).toContain('PrismRadialElement prismTopologyAt')
    expect(fragmentSource).toContain('PrismRadialElement prismApplyAperture')
    expect(fragmentSource).toContain('PrismRadialElement topologyElement = prismTopologyAt(radialUv, baseRadius, uWarp)')
    expect(fragmentSource).toContain('prismApplyAperture(topologyElement, baseRadius, uAperture)')
    expect(fragmentSource).not.toContain('vec3 ro =')

    const harness = createExecutorHarness()
    harness.executor.resize({ width: 1, height: 1, dpr: 1 }, harness.viewport)
    harness.executor.setGraph({ composition: composition!, instance: null, definitions: state.definitions })

    expect(harness.executor.render(frame(0))).toBe(true)
    expect(harness.gl.__calls.drawCount).toBeGreaterThanOrEqual(2)
    expect(harness.diagnostics).not.toContain('CINEMA_NODE_INITIALIZE_FAILED')
    expect(harness.diagnostics).not.toContain('CINEMA_NODE_RENDER_FAILED')
    harness.dispose()
  })

  it('reuses identical Shader programs when a same-context preset is activated again', () => {
    const state = createCinemaFoundationPersistedState()
    const harness = createExecutorHarness()
    harness.executor.resize({ width: 1, height: 1, dpr: 1 }, harness.viewport)
    harness.executor.setGraph({ composition: CINEMA_SHADER_REFERENCE_COMPOSITION, instance: null, definitions: state.definitions })
    const firstActivationPrograms = harness.gl.__calls.createdPrograms

    harness.executor.setGraph({ composition: null, instance: null, definitions: state.definitions })
    harness.executor.setGraph({ composition: CINEMA_SHADER_REFERENCE_COMPOSITION, instance: null, definitions: state.definitions })
    const repeatedActivationPrograms = harness.gl.__calls.createdPrograms - firstActivationPrograms

    expect(firstActivationPrograms).toBe(2)
    expect(repeatedActivationPrograms).toBe(1)
    harness.dispose()
  })

  it('presents a repeated kick identity to Shader uniforms for exactly one render', () => {
    const state = createCinemaFoundationPersistedState()
    const harness = createExecutorHarness()
    vi.mocked(harness.gl.getUniformLocation).mockImplementation((_program, name) => (
      { name } as unknown as WebGLUniformLocation
    ))
    harness.executor.resize({ width: 1, height: 1, dpr: 1 }, harness.viewport)
    harness.executor.setGraph({
      composition: CINEMA_SHADER_REFERENCE_COMPOSITION,
      instance: null,
      definitions: state.definitions,
    })
    const base = frame(1)
    const eventFrame: Readonly<CinemaFrameContext> = {
      ...base,
      impulses: {
        ...base.impulses,
        kick: true,
        eventIds: { ...base.impulses.eventIds, kick: 'kick-identity-1' as CinemaEventId },
      },
    }
    const gate = new CinemaImpulseGate()

    expect(harness.executor.render(gate.consume(eventFrame))).toBe(true)
    expect(harness.executor.render(gate.consume(eventFrame))).toBe(true)
    const kickUniformValues = vi.mocked(harness.gl.uniform1f).mock.calls
      .filter(([location]) => (location as unknown as { name?: string })?.name === 'uKickHit')
      .map(([, value]) => value)
    expect(kickUniformValues.slice(-2)).toEqual([1, 0])
    harness.dispose()
  })

  it('carries Reactor authored drop performance through preset composition, graph execution, and final uniforms', () => {
    const state = createCinemaFoundationPersistedState()
    const preset = CINEMA_LEGACY_PRESET_CATALOG.manifest.find(entry => entry.legacySourceId === REACTOR_SCENE_ID)!
    const composition = CINEMA_LEGACY_PRESET_CATALOG.compositions.find(candidate => candidate.id === preset.compositionId)!
    const harness = createExecutorHarness()
    vi.mocked(harness.gl.getUniformLocation).mockImplementation((_program, name) => (
      { name } as unknown as WebGLUniformLocation
    ))
    harness.executor.resize({ width: 1, height: 1, dpr: 1 }, harness.viewport)
    harness.executor.setGraph({ composition, instance: null, definitions: state.definitions })

    expect(harness.executor.render(frame(0))).toBe(true)
    const dropForceUniformValues = () => vi.mocked(harness.gl.uniform1f).mock.calls
      .filter(([location]) => (location as unknown as { name?: string })?.name === 'uDropForce')
      .map(([, value]) => value)
    const baselineDropForceValues = dropForceUniformValues()
    const baselineDropForce = baselineDropForceValues[baselineDropForceValues.length - 1]
    const base = frame(1, false, true)
    const dropFrame: Readonly<CinemaFrameContext> = {
      ...base,
      music: {
        ...base.music,
        sectionId: 'drop-1',
        sectionType: 'drop',
      },
    }
    expect(harness.executor.render(dropFrame)).toBe(true)

    const dropForceValues = dropForceUniformValues()
    expect(dropForceValues.length).toBeGreaterThanOrEqual(2)
    expect(dropForceValues[dropForceValues.length - 1]).toBeGreaterThan(baselineDropForce)
    expect(harness.diagnostics).not.toContain('CINEMA_NODE_RENDER_FAILED')
    harness.dispose()
  })

  it('executes Reactor feedback, resets both history targets, and reconstructs after context restoration', () => {
    const state = createCinemaFoundationPersistedState()
    const composition = createCinemaShaderSceneComposition(
      REACTOR_SCENE_ID,
      CINEMA_FOUNDATION_OUTPUT_TYPE_ID,
      CINEMA_FOUNDATION_INPUT_PORT_ID,
      { compositionId: cinemaStableId<CinemaCompositionId>('reactor-adapter-test', 'composition') },
    )
    const harness = createExecutorHarness()
    harness.executor.resize({ width: 1, height: 1, dpr: 1 }, harness.viewport)
    harness.executor.setGraph({ composition, instance: null, definitions: state.definitions })

    expect(harness.executor.render(frame(0))).toBe(true)
    expect(harness.targets.getDiagnostics().activeLeaseCount).toBe(1)
    const clearsBeforeReset = harness.gl.__calls.clearCount
    const programsBeforeRestore = harness.gl.__calls.createdPrograms

    expect(harness.executor.render(frame(1, true))).toBe(true)
    expect(harness.gl.__calls.clearCount - clearsBeforeReset).toBeGreaterThanOrEqual(2)
    expect(harness.diagnostics).not.toContain('CINEMA_NODE_RENDER_FAILED')

    harness.executor.handleContextLost()
    disposeCinemaShaderProgramCache(harness.gl)
    expect(harness.targets.getDiagnostics().activeLeaseCount).toBe(0)
    harness.targets.abandonContext()
    harness.targets.rebuildAfterContextRestore()
    harness.executor.rebuildAfterContextRestore()

    expect(harness.executor.render(frame(2))).toBe(true)
    expect(harness.gl.__calls.createdPrograms - programsBeforeRestore).toBeGreaterThanOrEqual(4)
    expect(harness.targets.getDiagnostics().activeLeaseCount).toBe(1)
    expect(harness.executor.getSnapshot().failedNodeCount).toBe(0)

    harness.dispose()
  })

  it('dispatches Stage 12 feedback reset commands through an adapter-backed shader node', () => {
    const state = createCinemaFoundationPersistedState()
    const base = createCinemaShaderSceneComposition(
      REACTOR_SCENE_ID,
      CINEMA_FOUNDATION_OUTPUT_TYPE_ID,
      CINEMA_FOUNDATION_INPUT_PORT_ID,
      { compositionId: cinemaStableId<CinemaCompositionId>('reactor-performance-reset-test', 'composition') },
    )
    const shaderNode = base.nodes.find(node => node.family === 'shader')
    expect(shaderNode).toBeDefined()
    if (!shaderNode) return
    const composition: CinemaCompositionDefinition = {
      ...base,
      revision: base.revision + 1,
      performanceRules: [{
        schemaVersion: CINEMA_PERFORMANCE_RULE_SCHEMA_VERSION,
        id: 'reactor-drop-reset-rule' as CinemaPerformanceRuleId,
        label: 'Reactor Drop Reset',
        priority: 100,
        enabled: true,
        condition: { schemaVersion: CINEMA_PERFORMANCE_RULE_SCHEMA_VERSION, event: 'dropStart' },
        actions: [{
          schemaVersion: CINEMA_PERFORMANCE_ACTION_SCHEMA_VERSION,
          id: 'reactor-reset-feedback' as CinemaActionId,
          type: 'resetFeedback',
          nodeId: shaderNode.id,
        }],
      }],
    }
    const harness = createExecutorHarness()
    harness.executor.resize({ width: 1, height: 1, dpr: 1 }, harness.viewport)
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

  it('reconciles Stage 8 persisted state with built-in adapter contracts without changing the active composition', () => {
    const current = createCinemaFoundationPersistedState()
    const stage8Like = {
      ...current,
      definitions: current.definitions.filter(definition => definition.source.kind !== 'adapter'),
      compositions: current.compositions.filter(composition => composition.id !== CINEMA_SHADER_REFERENCE_COMPOSITION.id),
      activeCompositionId: CINEMA_FOUNDATION_COMPOSITION_ID,
      editorMetadata: { foundationInitialized: true },
    }
    const reconciled = reconcileCinemaBuiltInState(stage8Like)
    expect(reconciled.activeCompositionId).toBe(stage8Like.activeCompositionId)
    expect(reconciled.definitions.some(definition => definition.source.kind === 'adapter')).toBe(true)
    expect(reconciled.compositions.some(composition => composition.id === CINEMA_SHADER_REFERENCE_COMPOSITION.id)).toBe(true)
    expect(reconciled.editorMetadata.shaderSceneAdapterVersion).toBe(1)
  })
})

function createExecutorHarness() {
  const gl = createCinemaMockWebGL()
  const diagnostics: string[] = []
  const sink = { report: (diagnostic: { code: string }) => diagnostics.push(diagnostic.code) }
  const viewport = { width: 320, height: 180, dpr: 1 }
  const textures = new CinemaTextureManager()
  const targets = new CinemaRenderTargetPool(gl, textures, viewport, sink)
  const webgl = new CinemaWebGLRenderServiceImpl(gl, targets, textures)
  const executor = new CinemaGraphExecutor({
    runtimeRegistry: CINEMA_PRODUCTION_RUNTIME_REGISTRY,
    platform: {
      webgl2: true,
      canvas2d: false,
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
  return {
    gl,
    diagnostics,
    viewport,
    textures,
    targets,
    executor,
    dispose() {
      executor.dispose()
      disposeCinemaShaderProgramCache(gl)
      targets.dispose()
      textures.dispose()
    },
  }
}

function frame(generation: number, reset = false, dropStart = false): Readonly<CinemaFrameContext> {
  const clock = (spanBeats: number) => ({ available: true, spanBeats, index: 0, phase: 0.25, hit: false, eventId: null })
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
      trackId: 'stage-9-adapter-test',
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
      volume: 0.6,
      rms: 0.5,
      energy: 0.7,
      bass: 0.8,
      mid: 0.5,
      high: 0.4,
      sub: 0.6,
      centroid: 0.45,
      flux: 0.2,
      harmonicity: 0.7,
      complexity: 0.4,
      tension: 0.3,
      buildProgress: 0.2,
      dropImpact: dropStart ? 1 : 0,
      vocalPresence: 0.1,
      fft: new Uint8Array(512).fill(96),
      waveform: new Uint8Array(1024).fill(128),
    },
    music: {
      available: true,
      source: 'bpm-derived',
      bpm: 150,
      beatIndex: 0,
      beatPhase: 0.25,
      beatInBar: 0,
      barIndex: 0,
      phraseIndex: 0,
      sectionId: 'intro',
      sectionType: 'intro',
      sectionProgress: 0.1,
      clocks: {
        beat: false,
        beat2: false,
        beat4: false,
        bar: false,
        bar4: false,
        bar8: false,
        phrase: false,
        states: {
          beat: clock(1),
          beat2: clock(2),
          beat4: clock(4),
          bar: clock(4),
          bar4: clock(16),
          bar8: clock(32),
          phrase: clock(16),
        },
      },
    },
    impulses: {
      beat: false,
      downbeat: false,
      kick: false,
      snare: false,
      transient: false,
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
    performance: { actionIds: [] as CinemaActionId[], toggleStates: {} },
    brand: {
      available: true,
      colors: {
        primary: [0.05, 0.75, 1, 1],
        secondary: [0.1, 0.95, 0.55, 1],
        accent: [1, 0.2, 0.4, 1],
        background: [0.002, 0.004, 0.01, 1],
      },
    },
    capabilities: {
      analyser: true,
      musicIntelligence: true,
      beatGrid: true,
      authoritativeSections: true,
      lyrics: false,
      brandKit: true,
      sharedPerformance: true,
      mediaAssets: false,
    },
    activeCameraId: null,
    camera: null,
  }
}
