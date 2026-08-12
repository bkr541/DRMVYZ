/** @vitest-environment jsdom */

import { describe, expect, it } from 'vitest'
import {
  CINEMA_COMPOSITION_SCHEMA_ID,
  CINEMA_COMPOSITION_SCHEMA_VERSION,
  CINEMA_PERFORMANCE_ACTION_SCHEMA_VERSION,
  CINEMA_PERFORMANCE_RULE_SCHEMA_VERSION,
  type CinemaCompositionDefinition,
  type CinemaCompositionInstance,
} from '../CinemaDomain'
import {
  CINEMA_FOUNDATION_ANGLE_PARAMETER_ID,
  CINEMA_FOUNDATION_COMPOSITION,
  CINEMA_FOUNDATION_COLOR_OUTPUT_PORT_ID,
  CINEMA_FOUNDATION_GRADIENT_DEFINITION,
  CINEMA_FOUNDATION_GRADIENT_NODE_ID,
  CINEMA_FOUNDATION_GRADIENT_PLUGIN_ID,
  CINEMA_FOUNDATION_INPUT_PORT_ID,
  CINEMA_FOUNDATION_OUTPUT_DEFINITION,
  CINEMA_FOUNDATION_OUTPUT_PLUGIN_ID,
  CINEMA_FOUNDATION_PERSISTED_DEFINITIONS,
  CINEMA_FOUNDATION_RUNTIME_REGISTRY,
} from '../CinemaFoundation'
import type {
  CinemaAssetBindingId,
  CinemaActionId,
  CinemaAssetId,
  CinemaCameraId,
  CinemaCompositionId,
  CinemaCompositionInstanceId,
  CinemaConnectionId,
  CinemaNodeId,
  CinemaNodeTypeId,
  CinemaPortId,
  CinemaRendererPluginId,
  CinemaPerformanceRuleId,
} from '../CinemaIdentifiers'
import type { CinemaPersistedDefinition } from '../CinemaPersistence'
import { CINEMA_MODULATION_SOURCE_IDS } from '../CinemaModulationSources'
import { createCinemaParameterPath } from '../CinemaIdentifiers'
import { createCinemaRuntimeNodeRegistry } from '../CinemaRuntimeNodeRegistry'
import type {
  CinemaFrameContext,
  CinemaNodePlugin,
  CinemaNodeTypeDefinition,
  CinemaRenderNode,
} from '../CinemaRendererContracts'
import { CINEMA_CAMERA_PARAMETER_IDS } from '../CinemaCameraRuntime'
import { CinemaGraphExecutor } from '../runtime/CinemaGraphExecutor'
import { CinemaRenderTargetPool } from '../runtime/CinemaRenderTargetPool'
import { CinemaTextureManager } from '../runtime/CinemaTextureManager'
import { CinemaWebGLRenderServiceImpl } from '../runtime/CinemaWebGLRenderService'
import { createCinemaMockWebGL } from './CinemaWebGLTestUtils'

const FEEDBACK_TYPE_ID = 'drmvyz.cinema.control.feedback-test' as CinemaNodeTypeId
const EFFECT_TYPE_ID = 'drmvyz.cinema.effect.feedback-test' as CinemaNodeTypeId
const FEEDBACK_PLUGIN_ID = 'drmvyz.cinema.renderer.feedback-test' as CinemaRendererPluginId
const EFFECT_PLUGIN_ID = 'drmvyz.cinema.renderer.effect-test' as CinemaRendererPluginId
const WRITE_PORT_ID = 'history-write' as CinemaPortId
const HISTORY_PORT_ID = 'history-read' as CinemaPortId
const EFFECT_INPUT_PORT_ID = 'effect-input' as CinemaPortId
const EFFECT_OUTPUT_PORT_ID = 'effect-output' as CinemaPortId
const FEEDBACK_NODE_ID = 'feedback-node' as CinemaNodeId
const EFFECT_NODE_ID = 'effect-node' as CinemaNodeId
const OUTPUT_NODE_ID = 'output-node' as CinemaNodeId

const FEEDBACK_DEFINITION: CinemaNodeTypeDefinition = {
  ...CINEMA_FOUNDATION_GRADIENT_DEFINITION,
  typeId: FEEDBACK_TYPE_ID,
  label: 'Feedback Test',
  family: 'control',
  inputPorts: [{
    id: WRITE_PORT_ID,
    label: 'Write',
    direction: 'input',
    dataType: 'color-texture',
    required: true,
  }],
  outputPorts: [{
    id: HISTORY_PORT_ID,
    label: 'History',
    direction: 'output',
    dataType: 'color-texture',
  }],
  parameters: [],
  seekPolicy: { mode: 'reset-at-position', seedScope: 'node' },
}

const EFFECT_DEFINITION: CinemaNodeTypeDefinition = {
  ...CINEMA_FOUNDATION_GRADIENT_DEFINITION,
  typeId: EFFECT_TYPE_ID,
  label: 'Effect Test',
  family: 'effect',
  inputPorts: [{
    id: EFFECT_INPUT_PORT_ID,
    label: 'Input',
    direction: 'input',
    dataType: 'color-texture',
    required: true,
  }],
  outputPorts: [{
    id: EFFECT_OUTPUT_PORT_ID,
    label: 'Output',
    direction: 'output',
    dataType: 'color-texture',
  }],
  parameters: [],
}

describe('CinemaGraphExecutor', () => {
  it('hot-applies 50+ live instance revisions without rebuilding stateful renderer nodes', () => {
    let initializeCount = 0
    let resetCount = 0
    let disposeCount = 0
    const observedAngles: number[] = []
    const gradientPlugin: CinemaNodePlugin = {
      definition: CINEMA_FOUNDATION_GRADIENT_DEFINITION,
      createNode: authored => ({
        ...renderTargetNode(authored, context => {
          observedAngles.push(Number(context.values[CINEMA_FOUNDATION_ANGLE_PARAMETER_ID]))
        }),
        initialize() { initializeCount += 1 },
        reset() { resetCount += 1 },
        dispose() { disposeCount += 1 },
      }),
    }
    const outputRegistration = CINEMA_FOUNDATION_RUNTIME_REGISTRY.getByPluginId(CINEMA_FOUNDATION_OUTPUT_PLUGIN_ID)
    expect(outputRegistration).toBeDefined()
    if (!outputRegistration) return

    const runtimeRegistry = createCinemaRuntimeNodeRegistry([
      { pluginId: CINEMA_FOUNDATION_GRADIENT_PLUGIN_ID, plugin: gradientPlugin },
      outputRegistration,
    ]).registry
    const gl = createCinemaMockWebGL()
    const sink = { report: () => {} }
    const viewport = { width: 320, height: 180, dpr: 1 }
    const textures = new CinemaTextureManager()
    const targets = new CinemaRenderTargetPool(gl, textures, viewport, sink)
    const webgl = new CinemaWebGLRenderServiceImpl(gl, targets, textures)
    const executor = new CinemaGraphExecutor({
      runtimeRegistry,
      platform: {
        webgl2: true, canvas2d: false, floatColorTargets: false, floatBlending: false,
        textureArrays: true, instancing: true, timerQueries: false,
        maximumTextureSize: 8192, maximumTextureUnits: 16,
      },
      targets,
      textures,
      webgl,
      diagnostics: sink,
    })
    const liveInstance = (revision: number, angle: number): CinemaCompositionInstance => ({
      id: 'foundation-live-hot-update' as CinemaCompositionInstanceId,
      compositionId: CINEMA_FOUNDATION_COMPOSITION.id,
      label: 'Foundation Live Hot Update',
      revision,
      masterOverrides: {},
      nodeOverrides: [{
        nodeId: CINEMA_FOUNDATION_GRADIENT_NODE_ID,
        values: { [CINEMA_FOUNDATION_ANGLE_PARAMETER_ID]: angle },
      }],
      cameraOverrides: [],
      assetBindingOverrides: [],
    })

    executor.resize({ width: 1, height: 1, dpr: 1 }, viewport)
    executor.setGraph({
      composition: CINEMA_FOUNDATION_COMPOSITION,
      instance: liveInstance(1, -120),
      definitions: CINEMA_FOUNDATION_PERSISTED_DEFINITIONS,
    })
    expect(executor.render(frame(false))).toBe(true)
    const activationResetCount = resetCount

    for (let index = 0; index < 55; index += 1) {
      const angle = -110 + index
      executor.setGraph({
        composition: CINEMA_FOUNDATION_COMPOSITION,
        instance: liveInstance(index + 2, angle),
        definitions: CINEMA_FOUNDATION_PERSISTED_DEFINITIONS,
      })
      expect(executor.render(frame(false))).toBe(true)
      expect(observedAngles.at(-1)).toBe(angle)
    }

    expect(initializeCount).toBe(1)
    expect(disposeCount).toBe(0)
    expect(resetCount).toBe(activationResetCount)

    const structuralComposition = {
      ...CINEMA_FOUNDATION_COMPOSITION,
      revision: CINEMA_FOUNDATION_COMPOSITION.revision + 1,
    } as CinemaCompositionDefinition
    executor.setGraph({
      composition: structuralComposition,
      instance: liveInstance(57, -45),
      definitions: CINEMA_FOUNDATION_PERSISTED_DEFINITIONS,
    })
    expect(initializeCount).toBe(2)
    expect(disposeCount).toBe(1)

    executor.dispose()
    targets.dispose()
    textures.dispose()
  })

  it('retains explicit feedback history, resets it on seek, and resolves instance asset bindings', () => {
    const feedbackInputs: boolean[] = []
    let initializedAssetId: string | null = null
    let expectedAssetId = 'asset-override'
    const feedbackPlugin: CinemaNodePlugin = {
      definition: FEEDBACK_DEFINITION,
      createNode: node => renderTargetNode(node, context => {
        feedbackInputs.push(Boolean(context.inputs[WRITE_PORT_ID]))
      }),
    }
    const effectPlugin: CinemaNodePlugin = {
      definition: EFFECT_DEFINITION,
      createNode: node => ({
        ...renderTargetNode(node),
        initialize(context) {
          initializedAssetId = String(context.assets[0]?.assetId ?? '')
        },
        render(context) {
          expect(context.assets[0]?.assetId).toBe(expectedAssetId)
          expect(context.target).not.toBeNull()
          if (!context.target) return
          context.webgl.bindTarget(context.target)
          context.webgl.gl.drawArrays(context.webgl.gl.TRIANGLES, 0, 3)
        },
      }),
    }
    const outputRegistration = CINEMA_FOUNDATION_RUNTIME_REGISTRY.getByPluginId(CINEMA_FOUNDATION_OUTPUT_PLUGIN_ID)
    expect(outputRegistration).toBeDefined()
    if (!outputRegistration) return

    const runtimeRegistry = createCinemaRuntimeNodeRegistry([
      { pluginId: FEEDBACK_PLUGIN_ID, plugin: feedbackPlugin },
      { pluginId: EFFECT_PLUGIN_ID, plugin: effectPlugin },
      outputRegistration,
    ]).registry
    const definitions = createDefinitions()
    const composition = createFeedbackComposition()
    const instance = createFeedbackInstance(composition.id)
    const gl = createCinemaMockWebGL()
    const diagnostics: string[] = []
    const sink = { report: (diagnostic: { code: string }) => diagnostics.push(diagnostic.code) }
    const viewport = { width: 320, height: 180, dpr: 1 }
    const textures = new CinemaTextureManager()
    const targets = new CinemaRenderTargetPool(gl, textures, viewport, sink)
    const webgl = new CinemaWebGLRenderServiceImpl(gl, targets, textures)
    let nowMs = 0
    let snapshotCount = 0
    const executor = new CinemaGraphExecutor({
      runtimeRegistry,
      platform: {
        webgl2: true,
        canvas2d: false,
        floatColorTargets: false,
        floatBlending: false,
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
      now: () => nowMs,
      snapshotIntervalMs: 250,
      onSnapshot: () => { snapshotCount += 1 },
    })

    executor.resize({ width: 1, height: 1, dpr: 1 }, viewport)
    executor.setGraph({ composition, instance, definitions })
    const immediateSnapshotCount = snapshotCount
    expect(executor.render(frame(false))).toBe(true)
    expect(executor.render(frame(false))).toBe(true)
    expect(executor.render(frame(true))).toBe(true)

    expect(feedbackInputs).toEqual([false, true, false])
    expect(initializedAssetId).toBe('asset-override')
    expect(targets.getDiagnostics().activeLeaseCount).toBe(2)
    expect(diagnostics).not.toContain('CINEMA_NODE_RENDER_FAILED')
    expect(executor.getSnapshot()).toMatchObject({ parameterResolutionCount: 0, parameterReuseCount: 3 })
    expect(snapshotCount).toBe(immediateSnapshotCount)
    nowMs = 300
    expect(executor.render(frame(false))).toBe(true)
    expect(snapshotCount).toBe(immediateSnapshotCount + 1)

    expectedAssetId = 'asset-replacement'
    const replacementInstance: CinemaCompositionInstance = {
      ...instance,
      revision: instance.revision + 1,
      assetBindingOverrides: [{
        bindingId: 'asset-binding' as CinemaAssetBindingId,
        values: { assetId: 'asset-replacement' as CinemaAssetId },
      }],
    }
    executor.setGraph({ composition, instance: replacementInstance, definitions })
    expect(initializedAssetId).toBe('asset-replacement')
    expect(executor.render(frame(false))).toBe(true)
    expect(feedbackInputs.at(-1)).toBe(false)

    executor.setGraph({ composition: null, instance: null, definitions })
    expect(targets.getDiagnostics().activeLeaseCount).toBe(0)
    executor.dispose()
    targets.dispose()
    textures.dispose()
  })

  it('evaluates persisted routes through the production graph executor before node render', () => {
    const observedAngles: number[] = []
    const gradientPlugin: CinemaNodePlugin = {
      definition: CINEMA_FOUNDATION_GRADIENT_DEFINITION,
      createNode: node => renderTargetNode(node, context => {
        observedAngles.push(Number(context.values[CINEMA_FOUNDATION_ANGLE_PARAMETER_ID]))
      }),
    }
    const outputRegistration = CINEMA_FOUNDATION_RUNTIME_REGISTRY.getByPluginId(CINEMA_FOUNDATION_OUTPUT_PLUGIN_ID)
    expect(outputRegistration).toBeDefined()
    if (!outputRegistration) return

    const runtimeRegistry = createCinemaRuntimeNodeRegistry([
      { pluginId: CINEMA_FOUNDATION_GRADIENT_PLUGIN_ID, plugin: gradientPlugin },
      outputRegistration,
    ]).registry
    const composition = structuredClone(CINEMA_FOUNDATION_COMPOSITION) as CinemaCompositionDefinition
    composition.revision = 2
    composition.modulationRoutes = [{
      id: 'bass-angle' as import('../CinemaIdentifiers').CinemaModulationRouteId,
      sourceId: CINEMA_MODULATION_SOURCE_IDS.audioBass,
      destination: createCinemaParameterPath(
        'nodes',
        CINEMA_FOUNDATION_ANGLE_PARAMETER_ID,
        CINEMA_FOUNDATION_GRADIENT_NODE_ID,
      ),
      mode: 'add',
      amount: 10,
      enabled: true,
    }]

    const gl = createCinemaMockWebGL()
    const sink = { report: () => {} }
    const viewport = { width: 320, height: 180, dpr: 1 }
    const textures = new CinemaTextureManager()
    const targets = new CinemaRenderTargetPool(gl, textures, viewport, sink)
    const webgl = new CinemaWebGLRenderServiceImpl(gl, targets, textures)
    const executor = new CinemaGraphExecutor({
      runtimeRegistry,
      platform: {
        webgl2: true,
        canvas2d: false,
        floatColorTargets: false,
        floatBlending: false,
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
    executor.setGraph({ composition, instance: null, definitions: CINEMA_FOUNDATION_PERSISTED_DEFINITIONS })
    expect(executor.render(modulationFrame(0.5))).toBe(true)
    expect(observedAngles).toEqual([30])
    expect(executor.getSnapshot()).toMatchObject({ modulationRouteCount: 1, activeModulationRouteCount: 1 })
    expect(composition.nodes[0].parameterValues[CINEMA_FOUNDATION_ANGLE_PARAMETER_ID]).toBe(25)

    executor.dispose()
    targets.dispose()
    textures.dispose()
  })

  it('evaluates coordinated performance actions through the production graph executor', () => {
    const observedAngles: number[] = []
    const resetCommands: string[] = []
    const gradientPlugin: CinemaNodePlugin = {
      definition: CINEMA_FOUNDATION_GRADIENT_DEFINITION,
      createNode: node => ({
        ...renderTargetNode(node, context => {
          observedAngles.push(Number(context.values[CINEMA_FOUNDATION_ANGLE_PARAMETER_ID]))
        }),
        reset(context) {
          if (context.command) resetCommands.push(context.command.type)
        },
      }),
    }
    const outputRegistration = CINEMA_FOUNDATION_RUNTIME_REGISTRY.getByPluginId(CINEMA_FOUNDATION_OUTPUT_PLUGIN_ID)
    expect(outputRegistration).toBeDefined()
    if (!outputRegistration) return

    const runtimeRegistry = createCinemaRuntimeNodeRegistry([
      { pluginId: CINEMA_FOUNDATION_GRADIENT_PLUGIN_ID, plugin: gradientPlugin },
      outputRegistration,
    ]).registry
    const composition = structuredClone(CINEMA_FOUNDATION_COMPOSITION) as CinemaCompositionDefinition
    composition.revision = 3
    composition.performanceRules = [{
      schemaVersion: CINEMA_PERFORMANCE_RULE_SCHEMA_VERSION,
      id: 'drop-choreography' as CinemaPerformanceRuleId,
      label: 'Drop Choreography',
      priority: 100,
      enabled: true,
      condition: { schemaVersion: CINEMA_PERFORMANCE_RULE_SCHEMA_VERSION, event: 'dropStart' },
      actions: [{
        schemaVersion: CINEMA_PERFORMANCE_ACTION_SCHEMA_VERSION,
        id: 'drop-angle' as CinemaActionId,
        type: 'set-parameter',
        destination: createCinemaParameterPath(
          'nodes',
          CINEMA_FOUNDATION_ANGLE_PARAMETER_ID,
          CINEMA_FOUNDATION_GRADIENT_NODE_ID,
        ),
        value: 80,
      }, {
        schemaVersion: CINEMA_PERFORMANCE_ACTION_SCHEMA_VERSION,
        id: 'drop-reset' as CinemaActionId,
        type: 'resetNodeState',
        nodeId: CINEMA_FOUNDATION_GRADIENT_NODE_ID,
      }],
    }]

    const gl = createCinemaMockWebGL()
    const sink = { report: () => {} }
    const viewport = { width: 320, height: 180, dpr: 1 }
    const textures = new CinemaTextureManager()
    const targets = new CinemaRenderTargetPool(gl, textures, viewport, sink)
    const webgl = new CinemaWebGLRenderServiceImpl(gl, targets, textures)
    const executor = new CinemaGraphExecutor({
      runtimeRegistry,
      platform: {
        webgl2: true, canvas2d: false, floatColorTargets: false, floatBlending: false,
        textureArrays: true, instancing: true, timerQueries: false,
        maximumTextureSize: 8192, maximumTextureUnits: 16,
      },
      targets,
      textures,
      webgl,
      diagnostics: sink,
    })

    executor.resize({ width: 1, height: 1, dpr: 1 }, viewport)
    executor.setGraph({ composition, instance: null, definitions: CINEMA_FOUNDATION_PERSISTED_DEFINITIONS })
    expect(executor.render(performanceFrame())).toBe(true)
    expect(observedAngles).toEqual([80])
    expect(resetCommands).toEqual(['resetNodeState'])
    expect(executor.getSnapshot()).toMatchObject({ performanceRuleCount: 1, activePerformanceRuleCount: 1 })
    expect(composition.nodes[0].parameterValues[CINEMA_FOUNDATION_ANGLE_PARAMETER_ID]).toBe(25)

    executor.dispose()
    targets.dispose()
    textures.dispose()
  })

  it('resolves one shared camera through the production executor and gates incompatible nodes', () => {
    const sourceTypeId = 'drmvyz.cinema.procedural.camera-source-test' as CinemaNodeTypeId
    const effectTypeId = 'drmvyz.cinema.effect.camera-effect-test' as CinemaNodeTypeId
    const nativeTypeId = 'drmvyz.cinema.effect.native-camera-test' as CinemaNodeTypeId
    const sourcePluginId = 'drmvyz.cinema.renderer.camera-source-test' as CinemaRendererPluginId
    const effectPluginId = 'drmvyz.cinema.renderer.camera-effect-test' as CinemaRendererPluginId
    const nativePluginId = 'drmvyz.cinema.renderer.native-camera-test' as CinemaRendererPluginId
    const sourceNodeId = 'camera-source-node' as CinemaNodeId
    const effectNodeId = 'camera-effect-node' as CinemaNodeId
    const nativeNodeId = 'native-camera-node' as CinemaNodeId
    const outputNodeId = 'camera-output-node' as CinemaNodeId
    const effectInput = 'camera-effect-input' as CinemaPortId
    const effectOutput = 'camera-effect-output' as CinemaPortId
    const nativeInput = 'native-camera-input' as CinemaPortId
    const nativeOutput = 'native-camera-output' as CinemaPortId
    const cameraId = 'shared-stage-13-camera' as CinemaCameraId
    const observed: Record<string, Readonly<CinemaFrameContext>['camera']> = {}
    const resetObserved: Record<string, Readonly<CinemaFrameContext>['camera']> = {}

    const sourceDefinition: CinemaNodeTypeDefinition = {
      ...CINEMA_FOUNDATION_GRADIENT_DEFINITION,
      typeId: sourceTypeId,
      capabilities: {
        ...CINEMA_FOUNDATION_GRADIENT_DEFINITION.capabilities,
        camera: { mode: 'uniformCamera', controls: ['position', 'target', 'fov'], autoDirector: true },
      },
    }
    const effectDefinition: CinemaNodeTypeDefinition = {
      ...EFFECT_DEFINITION,
      typeId: effectTypeId,
      inputPorts: [{ id: effectInput, label: 'Input', direction: 'input', dataType: 'color-texture', required: true }],
      outputPorts: [{ id: effectOutput, label: 'Output', direction: 'output', dataType: 'color-texture' }],
      capabilities: {
        ...EFFECT_DEFINITION.capabilities,
        camera: { mode: 'worldCamera', controls: ['position', 'rotation', 'target', 'fov'], autoDirector: true },
      },
    }
    const nativeDefinition: CinemaNodeTypeDefinition = {
      ...EFFECT_DEFINITION,
      typeId: nativeTypeId,
      inputPorts: [{ id: nativeInput, label: 'Input', direction: 'input', dataType: 'color-texture', required: true }],
      outputPorts: [{ id: nativeOutput, label: 'Output', direction: 'output', dataType: 'color-texture' }],
      capabilities: {
        ...EFFECT_DEFINITION.capabilities,
        camera: { mode: 'nativeCamera', controls: [], autoDirector: false },
      },
    }
    const plugin = (definition: CinemaNodeTypeDefinition): CinemaNodePlugin => ({
      definition,
      createNode: authored => ({
        ...renderTargetNode(authored, context => { observed[String(authored.id)] = context.frame.camera }),
        reset(context) {
          resetObserved[String(authored.id)] = context.frame?.camera ?? null
        },
      }),
    })
    const outputRegistration = CINEMA_FOUNDATION_RUNTIME_REGISTRY.getByPluginId(CINEMA_FOUNDATION_OUTPUT_PLUGIN_ID)
    expect(outputRegistration).toBeDefined()
    if (!outputRegistration) return
    const runtimeRegistry = createCinemaRuntimeNodeRegistry([
      { pluginId: sourcePluginId, plugin: plugin(sourceDefinition) },
      { pluginId: effectPluginId, plugin: plugin(effectDefinition) },
      { pluginId: nativePluginId, plugin: plugin(nativeDefinition) },
      outputRegistration,
    ]).registry
    const baseMetadata = CINEMA_FOUNDATION_PERSISTED_DEFINITIONS.find(
      definition => definition.id === CINEMA_FOUNDATION_GRADIENT_DEFINITION.typeId,
    )!
    const definitions: CinemaPersistedDefinition[] = [
      { ...baseMetadata, id: sourceTypeId, definition: sourceDefinition, rendererPluginId: sourcePluginId },
      { ...baseMetadata, id: effectTypeId, definition: effectDefinition, rendererPluginId: effectPluginId },
      { ...baseMetadata, id: nativeTypeId, definition: nativeDefinition, rendererPluginId: nativePluginId },
      CINEMA_FOUNDATION_PERSISTED_DEFINITIONS.find(definition => definition.id === CINEMA_FOUNDATION_OUTPUT_DEFINITION.typeId)!,
    ]
    const composition: CinemaCompositionDefinition = {
      ...structuredClone(CINEMA_FOUNDATION_COMPOSITION),
      id: 'shared-camera-executor-composition' as CinemaCompositionId,
      revision: 13,
      nodes: [
        { id: sourceNodeId, typeId: sourceTypeId, typeVersion: 1, family: 'procedural', enabled: true, opacity: 1, parameterValues: {} },
        { id: effectNodeId, typeId: effectTypeId, typeVersion: 1, family: 'effect', enabled: true, opacity: 1, parameterValues: {} },
        { id: nativeNodeId, typeId: nativeTypeId, typeVersion: 1, family: 'effect', enabled: true, opacity: 1, parameterValues: {} },
        { id: outputNodeId, typeId: CINEMA_FOUNDATION_OUTPUT_DEFINITION.typeId, typeVersion: 1, family: 'output', enabled: true, opacity: 1, parameterValues: {} },
      ],
      connections: [
        connection('camera-source-effect', sourceNodeId, CINEMA_FOUNDATION_COLOR_OUTPUT_PORT_ID, effectNodeId, effectInput),
        connection('camera-effect-native', effectNodeId, effectOutput, nativeNodeId, nativeInput),
        connection('camera-native-output', nativeNodeId, nativeOutput, outputNodeId, CINEMA_FOUNDATION_INPUT_PORT_ID),
      ],
      outputNodeId,
      cameras: [{
        id: cameraId,
        label: 'Shared Stage 13 Camera',
        mode: 'locked',
        parameterValues: {
          [CINEMA_CAMERA_PARAMETER_IDS.position]: [1, 2, 3],
          [CINEMA_CAMERA_PARAMETER_IDS.rotation]: [0, 0, 0],
          [CINEMA_CAMERA_PARAMETER_IDS.target]: [0, 0, 0],
          [CINEMA_CAMERA_PARAMETER_IDS.fovDegrees]: 60,
        },
      }],
      modulationRoutes: [{
        id: 'bass-camera-fov' as import('../CinemaIdentifiers').CinemaModulationRouteId,
        sourceId: CINEMA_MODULATION_SOURCE_IDS.audioBass,
        destination: createCinemaParameterPath('cameras', CINEMA_CAMERA_PARAMETER_IDS.fovDegrees, cameraId),
        mode: 'add',
        amount: 10,
        enabled: true,
      }],
    }

    const gl = createCinemaMockWebGL()
    const sink = { report: () => {} }
    const viewport = { width: 320, height: 180, dpr: 1 }
    const textures = new CinemaTextureManager()
    const targets = new CinemaRenderTargetPool(gl, textures, viewport, sink)
    const webgl = new CinemaWebGLRenderServiceImpl(gl, targets, textures)
    const executor = new CinemaGraphExecutor({
      runtimeRegistry,
      platform: {
        webgl2: true, canvas2d: false, floatColorTargets: false, floatBlending: false,
        textureArrays: true, instancing: true, timerQueries: false,
        maximumTextureSize: 8192, maximumTextureUnits: 16,
      },
      targets,
      textures,
      webgl,
      diagnostics: sink,
    })

    executor.resize({ width: 1, height: 1, dpr: 1 }, viewport)
    executor.setGraph({ composition, instance: null, definitions })
    const cameraFrame = performanceFrame()
    expect(executor.render({ ...cameraFrame, audio: { ...cameraFrame.audio, bass: 0.5 } })).toBe(true)
    expect(observed[sourceNodeId]?.cameraId).toBe(cameraId)
    expect(observed[sourceNodeId]?.fovDegrees).toBe(65)
    expect(observed[effectNodeId]).toBe(observed[sourceNodeId])
    expect(observed[nativeNodeId]).toBeNull()
    expect(executor.getSnapshot()).toMatchObject({ modulationRouteCount: 1, activeModulationRouteCount: 1 })

    const seekFrame = {
      ...cameraFrame,
      audio: { ...cameraFrame.audio, bass: 0.5 },
      transport: {
        ...cameraFrame.transport,
        seeking: true,
        discontinuity: true,
        discontinuityReasons: ['seek'],
        reset: {
          required: true,
          reconstruct: true,
          generation: 1,
          reasons: ['seek'],
          actionIds: ['cinema.reset.seek'],
          identity: 'seek:24',
        },
      },
    } as unknown as Readonly<CinemaFrameContext>
    expect(executor.render(seekFrame)).toBe(true)
    expect(resetObserved[sourceNodeId]?.cameraId).toBe(cameraId)
    expect(resetObserved[effectNodeId]).toBe(resetObserved[sourceNodeId])
    expect(resetObserved[nativeNodeId]).toBeNull()

    executor.dispose()
    targets.dispose()
    textures.dispose()
  })

})

function renderTargetNode(
  node: Readonly<{ id: CinemaNodeId; typeId: CinemaNodeTypeId }>,
  beforeDraw?: (context: Parameters<CinemaRenderNode['render']>[0]) => void,
): CinemaRenderNode {
  return {
    nodeId: node.id,
    typeId: node.typeId,
    initialize() {},
    resize() {},
    reset() {},
    dispose() {},
    render(context) {
      beforeDraw?.(context)
      expect(context.target).not.toBeNull()
      if (!context.target) return
      context.webgl.bindTarget(context.target)
      context.webgl.gl.drawArrays(context.webgl.gl.TRIANGLES, 0, 3)
    },
  }
}

function createDefinitions(): CinemaPersistedDefinition[] {
  const gradientMetadata = CINEMA_FOUNDATION_PERSISTED_DEFINITIONS.find(
    definition => definition.id === CINEMA_FOUNDATION_GRADIENT_DEFINITION.typeId,
  )!
  const outputMetadata = CINEMA_FOUNDATION_PERSISTED_DEFINITIONS.find(
    definition => definition.id === CINEMA_FOUNDATION_OUTPUT_DEFINITION.typeId,
  )!
  return [
    {
      ...gradientMetadata,
      id: FEEDBACK_TYPE_ID,
      definition: FEEDBACK_DEFINITION,
      rendererPluginId: FEEDBACK_PLUGIN_ID,
      source: { kind: 'built-in', id: 'feedback-test' },
      feedback: { inputPortId: WRITE_PORT_ID, outputPortId: HISTORY_PORT_ID, historyFrames: 1 },
    },
    {
      ...gradientMetadata,
      id: EFFECT_TYPE_ID,
      definition: EFFECT_DEFINITION,
      rendererPluginId: EFFECT_PLUGIN_ID,
      source: { kind: 'built-in', id: 'effect-test' },
    },
    outputMetadata,
  ]
}

function createFeedbackComposition(): CinemaCompositionDefinition {
  const bindingId = 'asset-binding' as CinemaAssetBindingId
  return {
    schemaId: CINEMA_COMPOSITION_SCHEMA_ID,
    schemaVersion: CINEMA_COMPOSITION_SCHEMA_VERSION,
    id: 'feedback-composition' as CinemaCompositionId,
    revision: 1,
    metadata: { name: 'Feedback Test' },
    nodes: [
      node(FEEDBACK_NODE_ID, FEEDBACK_TYPE_ID, 'control'),
      { ...node(EFFECT_NODE_ID, EFFECT_TYPE_ID, 'effect'), assetBindingIds: [bindingId] },
      node(OUTPUT_NODE_ID, CINEMA_FOUNDATION_OUTPUT_DEFINITION.typeId, 'output'),
    ],
    connections: [
      connection('feedback-effect', FEEDBACK_NODE_ID, HISTORY_PORT_ID, EFFECT_NODE_ID, EFFECT_INPUT_PORT_ID),
      connection('effect-feedback', EFFECT_NODE_ID, EFFECT_OUTPUT_PORT_ID, FEEDBACK_NODE_ID, WRITE_PORT_ID),
      connection('effect-output', EFFECT_NODE_ID, EFFECT_OUTPUT_PORT_ID, OUTPUT_NODE_ID, CINEMA_FOUNDATION_INPUT_PORT_ID),
    ],
    outputNodeId: OUTPUT_NODE_ID,
    masterParameters: [],
    masterValues: {},
    cameras: [],
    assetBindings: [{
      id: bindingId,
      assetId: 'asset-original' as CinemaAssetId,
      role: 'image',
      fit: 'contain',
      preserveOriginalColors: true,
      opacity: 1,
      blendMode: 'normal',
    }],
    modulationRoutes: [],
    performanceRules: [],
  }
}

function createFeedbackInstance(compositionId: CinemaCompositionId): CinemaCompositionInstance {
  return {
    id: 'feedback-instance' as CinemaCompositionInstanceId,
    compositionId,
    label: 'Asset Override',
    revision: 1,
    masterOverrides: {},
    nodeOverrides: [],
    cameraOverrides: [],
    assetBindingOverrides: [{
      bindingId: 'asset-binding' as CinemaAssetBindingId,
      values: { assetId: 'asset-override' as CinemaAssetId },
    }],
  }
}

function node(id: CinemaNodeId, typeId: CinemaNodeTypeId, family: 'control' | 'effect' | 'output') {
  return { id, typeId, typeVersion: 1, family, label: id, enabled: true, opacity: 1, parameterValues: {} }
}

function connection(
  id: string,
  fromNodeId: CinemaNodeId,
  fromPortId: CinemaPortId,
  toNodeId: CinemaNodeId,
  toPortId: CinemaPortId,
) {
  return {
    id: id as CinemaConnectionId,
    from: { nodeId: fromNodeId, portId: fromPortId },
    to: { nodeId: toNodeId, portId: toPortId },
    enabled: true,
  }
}

function modulationFrame(bass: number): Readonly<CinemaFrameContext> {
  return {
    ...frame(false),
    timing: {
      frameIndex: 1,
      elapsedTimeSec: 1,
      deltaTimeSec: 1 / 60,
      seeds: { composition: 1, track: 2, musicalPosition: 3, event: 4 },
    },
    audio: {
      available: true,
      volume: 0.5,
      rms: 0.5,
      energy: 0.5,
      bass,
      mid: 0,
      high: 0,
      sub: 0,
      centroid: 0,
      flux: 0,
      harmonicity: 0,
      complexity: 0,
      tension: 0,
      buildProgress: 0,
      dropImpact: 0,
      vocalPresence: 0,
      fft: null,
      waveform: null,
    },
  } as unknown as Readonly<CinemaFrameContext>
}

function frame(reset: boolean): Readonly<CinemaFrameContext> {
  return {
    version: 1,
    viewport: { width: 320, height: 180, dpr: 1 },
    timing: {
      frameIndex: reset ? 1 : 0,
      elapsedTimeSec: 0,
      deltaTimeSec: 1 / 60,
      seeds: { composition: 1, track: 2, musicalPosition: 3, event: 4 },
    },
    transport: {
      trackId: 'feedback-test',
      audioTimeSec: 0,
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
        generation: reset ? 1 : 0,
        reasons: reset ? ['seek'] : [],
        actionIds: reset ? ['cinema.reset.seek'] : [],
        identity: null,
      },
    },
    brand: { available: false, colors: {} },
    performance: { events: [], actionIds: [], toggleStates: {} },
    capabilities: {
      analyser: false,
      musicIntelligence: false,
      authoritativeSections: false,
      lyrics: false,
      sharedPerformance: false,
      brandKit: false,
    },
  } as unknown as Readonly<CinemaFrameContext>
}

function performanceFrame(): Readonly<CinemaFrameContext> {
  const clock = { available: true, spanBeats: 1, index: 32, phase: 0, hit: false, eventId: null }
  return {
    ...modulationFrame(0),
    version: 1,
    music: {
      available: true, source: 'music-intelligence', bpm: 120, beatIndex: 32, beatPhase: 0,
      beatInBar: 0, barIndex: 8, phraseIndex: 2, sectionId: 'drop-section', sectionType: 'drop', sectionProgress: 0,
      clocks: {
        beat: false, beat2: false, beat4: false, bar: false, bar4: false, bar8: false, phrase: false,
        states: { beat: clock, beat2: clock, beat4: clock, bar: clock, bar4: clock, bar8: clock, phrase: clock },
      },
    },
    lyrics: { available: false, vocalsActive: false, cue: null, word: null },
    impulses: {
      beat: false, downbeat: false, kick: false, snare: false, transient: false,
      sectionStart: true, dropStart: true, lyricCue: false, lyricWord: false, phrase4: false, phrase8: false,
      eventIds: {
        beat: null, downbeat: null, kick: null, snare: null, transient: null,
        sectionStart: 'music:drop-section' as import('../CinemaIdentifiers').CinemaEventId,
        dropStart: 'music:drop-section' as import('../CinemaIdentifiers').CinemaEventId,
        lyricCue: null, lyricWord: null, phrase4: null, phrase8: null,
      },
    },
    performance: { events: [], actionIds: [], toggleStates: {} },
    brand: { available: false, colors: {} },
    capabilities: {
      analyser: true, musicIntelligence: true, authoritativeSections: true,
      lyrics: false, sharedPerformance: true, brandKit: false,
    },
  } as unknown as Readonly<CinemaFrameContext>
}
