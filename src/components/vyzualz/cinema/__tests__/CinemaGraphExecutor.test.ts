/** @vitest-environment jsdom */

import { describe, expect, it } from 'vitest'
import {
  CINEMA_COMPOSITION_SCHEMA_ID,
  CINEMA_COMPOSITION_SCHEMA_VERSION,
  type CinemaCompositionDefinition,
  type CinemaCompositionInstance,
} from '../CinemaDomain'
import {
  CINEMA_FOUNDATION_GRADIENT_DEFINITION,
  CINEMA_FOUNDATION_INPUT_PORT_ID,
  CINEMA_FOUNDATION_OUTPUT_DEFINITION,
  CINEMA_FOUNDATION_OUTPUT_PLUGIN_ID,
  CINEMA_FOUNDATION_PERSISTED_DEFINITIONS,
  CINEMA_FOUNDATION_RUNTIME_REGISTRY,
} from '../CinemaFoundation'
import type {
  CinemaAssetBindingId,
  CinemaAssetId,
  CinemaCompositionId,
  CinemaCompositionInstanceId,
  CinemaConnectionId,
  CinemaNodeId,
  CinemaNodeTypeId,
  CinemaPortId,
  CinemaRendererPluginId,
} from '../CinemaIdentifiers'
import type { CinemaPersistedDefinition } from '../CinemaPersistence'
import { createCinemaRuntimeNodeRegistry } from '../CinemaRuntimeNodeRegistry'
import type {
  CinemaFrameContext,
  CinemaNodePlugin,
  CinemaNodeTypeDefinition,
  CinemaRenderNode,
} from '../CinemaRendererContracts'
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
  it('retains explicit feedback history, resets it on seek, and resolves instance asset bindings', () => {
    const feedbackInputs: boolean[] = []
    let initializedAssetId: string | null = null
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
          expect(context.assets[0]?.assetId).toBe('asset-override')
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
    executor.setGraph({ composition, instance, definitions })
    expect(executor.render(frame(false))).toBe(true)
    expect(executor.render(frame(false))).toBe(true)
    expect(executor.render(frame(true))).toBe(true)

    expect(feedbackInputs).toEqual([false, true, false])
    expect(initializedAssetId).toBe('asset-override')
    expect(targets.getDiagnostics().activeLeaseCount).toBe(2)
    expect(diagnostics).not.toContain('CINEMA_NODE_RENDER_FAILED')

    executor.setGraph({ composition: null, instance: null, definitions })
    expect(targets.getDiagnostics().activeLeaseCount).toBe(0)
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

function frame(reset: boolean): Readonly<CinemaFrameContext> {
  return {
    viewport: { width: 320, height: 180, dpr: 1 },
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
  } as unknown as Readonly<CinemaFrameContext>
}
