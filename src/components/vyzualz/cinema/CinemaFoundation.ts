import {
  CINEMA_COMPOSITION_SCHEMA_ID,
  CINEMA_COMPOSITION_SCHEMA_VERSION,
  type CinemaColor,
  type CinemaCompositionDefinition,
  type CinemaNodeDefinition,
  type CinemaParameterValues,
} from './CinemaDomain'
import {
  cinemaNamespacedId,
  cinemaStableId,
  type CinemaCompositionId,
  type CinemaConnectionId,
  type CinemaNodeId,
  type CinemaNodeTypeId,
  type CinemaParameterId,
  type CinemaPortId,
  type CinemaRendererPluginId,
} from './CinemaIdentifiers'
import {
  createCinemaNodeDefinitionRegistry,
  type CinemaNodeRegistryEntry,
} from './CinemaNodeRegistry'
import {
  createCinemaRuntimeNodeRegistry,
  type CinemaRuntimeNodeRegistry,
} from './CinemaRuntimeNodeRegistry'
import type {
  CinemaNodeDisposeContext,
  CinemaNodeInitializeContext,
  CinemaNodePlugin,
  CinemaNodeRenderContext,
  CinemaNodeResetContext,
  CinemaNodeResizeContext,
  CinemaNodeTypeDefinition,
  CinemaRenderNode,
} from './CinemaRendererContracts'
import {
  CINEMA_SHADER_SCENE_ADAPTER_BUNDLE,
  createCinemaShaderSceneComposition,
} from './CinemaShaderSceneAdapter'
import { DEFAULT_SHADER_SCENE_ID } from '../react/shaders/scenes'
import {
  CINEMA_PERSISTED_STORE_SCHEMA_ID,
  CINEMA_PERSISTED_STORE_SCHEMA_VERSION,
  type CinemaPersistedDefinition,
  type CinemaPersistedState,
} from './CinemaPersistence'

export const CINEMA_FOUNDATION_GRADIENT_TYPE_ID = cinemaNamespacedId<CinemaNodeTypeId>(
  'drmvyz.cinema.generator.gradient',
  'node type',
)
export const CINEMA_FOUNDATION_OUTPUT_TYPE_ID = cinemaNamespacedId<CinemaNodeTypeId>(
  'drmvyz.cinema.output.main',
  'node type',
)
export const CINEMA_FOUNDATION_GRADIENT_PLUGIN_ID = cinemaNamespacedId<CinemaRendererPluginId>(
  'drmvyz.cinema.renderer.gradient',
  'renderer plugin',
)
export const CINEMA_FOUNDATION_OUTPUT_PLUGIN_ID = cinemaNamespacedId<CinemaRendererPluginId>(
  'drmvyz.cinema.renderer.output',
  'renderer plugin',
)

export const CINEMA_FOUNDATION_COLOR_A_PARAMETER_ID = cinemaStableId<CinemaParameterId>('color-a', 'parameter')
export const CINEMA_FOUNDATION_COLOR_B_PARAMETER_ID = cinemaStableId<CinemaParameterId>('color-b', 'parameter')
export const CINEMA_FOUNDATION_ANGLE_PARAMETER_ID = cinemaStableId<CinemaParameterId>('angle', 'parameter')
export const CINEMA_FOUNDATION_OPACITY_PARAMETER_ID = cinemaStableId<CinemaParameterId>('opacity', 'parameter')
export const CINEMA_FOUNDATION_COLOR_OUTPUT_PORT_ID = cinemaStableId<CinemaPortId>('color', 'port')
export const CINEMA_FOUNDATION_INPUT_PORT_ID = cinemaStableId<CinemaPortId>('input', 'port')

const OUTPUT_DESCRIPTOR = Object.freeze({
  colorSpace: 'srgb' as const,
  alphaMode: 'premultiplied' as const,
  colorFormat: 'rgba8' as const,
  hasDepth: false,
  hasMask: false,
})

const FOUNDATION_CAPABILITIES = Object.freeze({
  backends: ['webgl2'] as const,
  canvas2d: {
    compatibility: 'unsupported' as const,
    preservesPremultipliedAlpha: true,
  },
  camera: {
    mode: 'none' as const,
    controls: [] as const,
    autoDirector: false,
  },
  requires: { webgl2: true },
  fallbacks: [{
    capability: 'webgl2' as const,
    behavior: 'safe-output' as const,
    message: 'The Cinema foundation nodes require the Cinema-owned WebGL2 runtime.',
  }],
})

export const CINEMA_FOUNDATION_GRADIENT_DEFINITION: Readonly<CinemaNodeTypeDefinition> = deepFreeze({
  typeId: CINEMA_FOUNDATION_GRADIENT_TYPE_ID,
  version: 1,
  label: 'Foundation Gradient',
  description: 'A native Cinema solid or two-color gradient generator.',
  family: 'procedural',
  inputPorts: [],
  outputPorts: [{
    id: CINEMA_FOUNDATION_COLOR_OUTPUT_PORT_ID,
    label: 'Color',
    direction: 'output',
    dataType: 'color-texture',
  }],
  parameters: [
    {
      id: CINEMA_FOUNDATION_COLOR_A_PARAMETER_ID,
      label: 'Color A',
      type: 'color',
      default: [0.05, 0.8, 0.95, 1],
      modulatable: true,
      ui: { control: 'color', order: 0 },
    },
    {
      id: CINEMA_FOUNDATION_COLOR_B_PARAMETER_ID,
      label: 'Color B',
      type: 'color',
      default: [0.05, 0.85, 0.45, 1],
      modulatable: true,
      ui: { control: 'color', order: 1 },
    },
    {
      id: CINEMA_FOUNDATION_ANGLE_PARAMETER_ID,
      label: 'Angle',
      type: 'float',
      default: 25,
      min: -180,
      max: 180,
      step: 1,
      unit: 'degrees',
      modulatable: true,
      ui: { control: 'slider', order: 2 },
    },
    {
      id: CINEMA_FOUNDATION_OPACITY_PARAMETER_ID,
      label: 'Opacity',
      type: 'float',
      default: 1,
      min: 0,
      max: 1,
      step: 0.01,
      modulatable: true,
      ui: { control: 'slider', order: 3 },
    },
  ],
  capabilities: FOUNDATION_CAPABILITIES,
  cost: {
    cpu: 'minimal',
    gpu: 'minimal',
    estimatedPassCount: 1,
    persistentTargetCount: 0,
    pingPongPairCount: 0,
  },
  seekPolicy: { mode: 'stateless' },
  output: OUTPUT_DESCRIPTOR,
  metadata: { foundation: true },
})

export const CINEMA_FOUNDATION_OUTPUT_DEFINITION: Readonly<CinemaNodeTypeDefinition> = deepFreeze({
  typeId: CINEMA_FOUNDATION_OUTPUT_TYPE_ID,
  version: 1,
  label: 'Cinema Output',
  description: 'The single authorized Cinema default-framebuffer output node.',
  family: 'output',
  inputPorts: [{
    id: CINEMA_FOUNDATION_INPUT_PORT_ID,
    label: 'Input',
    direction: 'input',
    dataType: 'color-texture',
    cardinality: 'one',
    required: true,
  }],
  outputPorts: [],
  parameters: [],
  capabilities: FOUNDATION_CAPABILITIES,
  cost: {
    cpu: 'minimal',
    gpu: 'minimal',
    estimatedPassCount: 1,
    persistentTargetCount: 0,
    pingPongPairCount: 0,
  },
  seekPolicy: { mode: 'stateless' },
  output: OUTPUT_DESCRIPTOR,
  metadata: { foundation: true, finalOutput: true },
})

export const CINEMA_FOUNDATION_PERSISTED_DEFINITIONS: readonly CinemaPersistedDefinition[] = deepFreeze([
  {
    id: CINEMA_FOUNDATION_GRADIENT_TYPE_ID,
    definition: CINEMA_FOUNDATION_GRADIENT_DEFINITION,
    rendererPluginId: CINEMA_FOUNDATION_GRADIENT_PLUGIN_ID,
    source: { kind: 'built-in', id: 'cinema-foundation-gradient' },
    quality: {
      minimumTier: 'low',
      maximumTier: 'ultra',
      adaptive: false,
      maximumEstimatedPassCount: 1,
      maximumPersistentTargetCount: 0,
      maximumPingPongPairCount: 0,
    },
  },
  {
    id: CINEMA_FOUNDATION_OUTPUT_TYPE_ID,
    definition: CINEMA_FOUNDATION_OUTPUT_DEFINITION,
    rendererPluginId: CINEMA_FOUNDATION_OUTPUT_PLUGIN_ID,
    source: { kind: 'built-in', id: 'cinema-foundation-output' },
    quality: {
      minimumTier: 'low',
      maximumTier: 'ultra',
      adaptive: false,
      maximumEstimatedPassCount: 1,
      maximumPersistentTargetCount: 0,
      maximumPingPongPairCount: 0,
    },
  },
])

export const CINEMA_PRODUCTION_PERSISTED_DEFINITIONS: readonly CinemaPersistedDefinition[] = deepFreeze([
  ...CINEMA_FOUNDATION_PERSISTED_DEFINITIONS,
  ...CINEMA_SHADER_SCENE_ADAPTER_BUNDLE.persistedDefinitions,
])

export const CINEMA_FOUNDATION_COMPOSITION_ID = cinemaStableId<CinemaCompositionId>('foundation-gradient', 'composition')
export const CINEMA_FOUNDATION_GRADIENT_NODE_ID = cinemaStableId<CinemaNodeId>('foundation-gradient', 'node')
export const CINEMA_FOUNDATION_OUTPUT_NODE_ID = cinemaStableId<CinemaNodeId>('foundation-output', 'node')
const FOUNDATION_CONNECTION_ID = cinemaStableId<CinemaConnectionId>('foundation-to-output', 'connection')

export const CINEMA_FOUNDATION_COMPOSITION: Readonly<CinemaCompositionDefinition> = deepFreeze({
  schemaId: CINEMA_COMPOSITION_SCHEMA_ID,
  schemaVersion: CINEMA_COMPOSITION_SCHEMA_VERSION,
  id: CINEMA_FOUNDATION_COMPOSITION_ID,
  revision: 1,
  metadata: {
    name: 'Cinema Foundation Gradient',
    description: 'Native Stage 8 reference composition rendered through the production Cinema graph executor.',
    tags: ['foundation', 'gradient'],
    provenance: { builtIn: true, stage: 8 },
  },
  nodes: [
    {
      id: CINEMA_FOUNDATION_GRADIENT_NODE_ID,
      typeId: CINEMA_FOUNDATION_GRADIENT_TYPE_ID,
      typeVersion: 1,
      family: 'procedural',
      label: 'Foundation Gradient',
      enabled: true,
      opacity: 1,
      parameterValues: {
        [CINEMA_FOUNDATION_COLOR_A_PARAMETER_ID]: [0.02, 0.65, 0.95, 1],
        [CINEMA_FOUNDATION_COLOR_B_PARAMETER_ID]: [0.05, 0.9, 0.35, 1],
        [CINEMA_FOUNDATION_ANGLE_PARAMETER_ID]: 25,
        [CINEMA_FOUNDATION_OPACITY_PARAMETER_ID]: 1,
      },
    },
    {
      id: CINEMA_FOUNDATION_OUTPUT_NODE_ID,
      typeId: CINEMA_FOUNDATION_OUTPUT_TYPE_ID,
      typeVersion: 1,
      family: 'output',
      label: 'Cinema Output',
      enabled: true,
      opacity: 1,
      parameterValues: {},
    },
  ],
  connections: [{
    id: FOUNDATION_CONNECTION_ID,
    from: { nodeId: CINEMA_FOUNDATION_GRADIENT_NODE_ID, portId: CINEMA_FOUNDATION_COLOR_OUTPUT_PORT_ID },
    to: { nodeId: CINEMA_FOUNDATION_OUTPUT_NODE_ID, portId: CINEMA_FOUNDATION_INPUT_PORT_ID },
    enabled: true,
  }],
  outputNodeId: CINEMA_FOUNDATION_OUTPUT_NODE_ID,
  masterParameters: [],
  masterValues: {},
  cameras: [],
  assetBindings: [],
  modulationRoutes: [],
  performanceRules: [],
})

export const CINEMA_SHADER_REFERENCE_COMPOSITION: Readonly<CinemaCompositionDefinition> = deepFreeze(
  createCinemaShaderSceneComposition(
    DEFAULT_SHADER_SCENE_ID,
    CINEMA_FOUNDATION_OUTPUT_TYPE_ID,
    CINEMA_FOUNDATION_INPUT_PORT_ID,
    {
      compositionId: cinemaStableId<CinemaCompositionId>('shader-scene-reference', 'composition'),
      sceneNodeId: cinemaStableId<CinemaNodeId>('shader-scene-reference', 'node'),
      outputNodeId: cinemaStableId<CinemaNodeId>('shader-scene-reference-output', 'node'),
      name: 'Cinema Shader Scene Reference',
      description: 'Stage 9 production reference composition rendered by the ShaderSceneNodeAdapter.',
    },
  ),
)

export function createCinemaFoundationPersistedState(): CinemaPersistedState {
  return JSON.parse(JSON.stringify({
    schemaId: CINEMA_PERSISTED_STORE_SCHEMA_ID,
    schemaVersion: CINEMA_PERSISTED_STORE_SCHEMA_VERSION,
    definitions: CINEMA_PRODUCTION_PERSISTED_DEFINITIONS,
    compositions: [CINEMA_FOUNDATION_COMPOSITION, CINEMA_SHADER_REFERENCE_COMPOSITION],
    instances: [],
    collections: [],
    activeCompositionId: CINEMA_SHADER_REFERENCE_COMPOSITION.id,
    activeInstanceId: null,
    editorMetadata: { foundationInitialized: true, shaderSceneAdapterVersion: 1 },
    migrationProvenance: [],
  })) as CinemaPersistedState
}

export function reconcileCinemaBuiltInState(state: CinemaPersistedState): CinemaPersistedState {
  const foundationState = state.editorMetadata.foundationInitialized === true
    || state.definitions.some(definition => (
      definition.id === CINEMA_FOUNDATION_GRADIENT_TYPE_ID
      || definition.id === CINEMA_FOUNDATION_OUTPUT_TYPE_ID
    ))
    || state.compositions.some(composition => composition.id === CINEMA_FOUNDATION_COMPOSITION_ID)
  if (!foundationState) return state

  const canonicalDefinitionIds = new Set(CINEMA_PRODUCTION_PERSISTED_DEFINITIONS.map(definition => String(definition.id)))
  const definitions = [
    ...state.definitions.filter(definition => !canonicalDefinitionIds.has(String(definition.id))),
    ...CINEMA_PRODUCTION_PERSISTED_DEFINITIONS,
  ]
  const compositions = [
    ...state.compositions.filter(composition => composition.id !== CINEMA_SHADER_REFERENCE_COMPOSITION.id),
    CINEMA_SHADER_REFERENCE_COMPOSITION,
  ]
  return JSON.parse(JSON.stringify({
    ...state,
    definitions,
    compositions,
    editorMetadata: {
      ...state.editorMetadata,
      shaderSceneAdapterVersion: 1,
    },
  })) as CinemaPersistedState
}

export function createCinemaDefinitionRegistryFromPersisted(
  definitions: readonly CinemaPersistedDefinition[],
  runtimeRegistry: CinemaRuntimeNodeRegistry = CINEMA_PRODUCTION_RUNTIME_REGISTRY,
) {
  const registrations: CinemaNodeRegistryEntry[] = definitions.map(definition => ({
    definition: definition.definition,
    rendererPlugin: {
      id: definition.rendererPluginId,
      available: runtimeRegistry.hasPlugin(definition.rendererPluginId),
    },
    source: definition.source,
    ...(definition.feedback ? { feedback: definition.feedback } : {}),
    quality: definition.quality,
  }))
  return createCinemaNodeDefinitionRegistry(registrations)
}

class FoundationGradientNode implements CinemaRenderNode {
  readonly typeId = CINEMA_FOUNDATION_GRADIENT_TYPE_ID
  private program: WebGLProgram | null = null
  private colorALocation: WebGLUniformLocation | null = null
  private colorBLocation: WebGLUniformLocation | null = null
  private angleLocation: WebGLUniformLocation | null = null
  private opacityLocation: WebGLUniformLocation | null = null

  constructor(readonly nodeId: CinemaNodeId, private readonly authoredOpacity: number) {}

  initialize(context: CinemaNodeInitializeContext): void {
    const gl = context.webgl.gl
    this.program = createProgram(gl, FULLSCREEN_VERTEX_SHADER, GRADIENT_FRAGMENT_SHADER)
    this.colorALocation = gl.getUniformLocation(this.program, 'uColorA')
    this.colorBLocation = gl.getUniformLocation(this.program, 'uColorB')
    this.angleLocation = gl.getUniformLocation(this.program, 'uAngle')
    this.opacityLocation = gl.getUniformLocation(this.program, 'uOpacity')
  }

  resize(_context: CinemaNodeResizeContext): void {}

  render(context: CinemaNodeRenderContext): void {
    if (!context.target || !this.program) throw new Error('Foundation gradient target or program is unavailable.')
    const gl = context.webgl.gl
    context.webgl.bindTarget(context.target)
    context.webgl.resetState()
    gl.useProgram(this.program)
    const colorA = colorValue(context.values[CINEMA_FOUNDATION_COLOR_A_PARAMETER_ID], [0, 0, 0, 1])
    const colorB = colorValue(context.values[CINEMA_FOUNDATION_COLOR_B_PARAMETER_ID], [colorA[0], colorA[1], colorA[2], colorA[3]])
    const angle = numberValue(context.values[CINEMA_FOUNDATION_ANGLE_PARAMETER_ID], 0) * Math.PI / 180
    const opacity = clamp01(numberValue(context.values[CINEMA_FOUNDATION_OPACITY_PARAMETER_ID], 1) * this.authoredOpacity)
    gl.uniform4fv(this.colorALocation, colorA)
    gl.uniform4fv(this.colorBLocation, colorB)
    gl.uniform1f(this.angleLocation, angle)
    gl.uniform1f(this.opacityLocation, opacity)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  reset(_context: CinemaNodeResetContext): void {}

  dispose(context: CinemaNodeDisposeContext): void {
    if (this.program) context.webgl.gl.deleteProgram(this.program)
    this.program = null
  }
}

class FoundationOutputNode implements CinemaRenderNode {
  readonly typeId = CINEMA_FOUNDATION_OUTPUT_TYPE_ID
  private program: WebGLProgram | null = null
  private textureLocation: WebGLUniformLocation | null = null

  constructor(readonly nodeId: CinemaNodeId) {}

  initialize(context: CinemaNodeInitializeContext): void {
    const gl = context.webgl.gl
    this.program = createProgram(gl, FULLSCREEN_VERTEX_SHADER, OUTPUT_FRAGMENT_SHADER)
    this.textureLocation = gl.getUniformLocation(this.program, 'uTexture')
  }

  resize(_context: CinemaNodeResizeContext): void {}

  render(context: CinemaNodeRenderContext): void {
    if (!context.outputNode || context.target || !this.program) {
      throw new Error('Cinema output node received an unauthorized render destination.')
    }
    const gl = context.webgl.gl
    const input = context.inputs[CINEMA_FOUNDATION_INPUT_PORT_ID]
    context.webgl.bindDefaultFramebuffer(context.viewport)
    context.webgl.resetState()
    if (!input) {
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      return
    }
    const texture = context.webgl.resolveTexture(input)
    if (!texture) {
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      return
    }
    gl.useProgram(this.program)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.uniform1i(this.textureLocation, 0)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    gl.bindTexture(gl.TEXTURE_2D, null)
  }

  reset(_context: CinemaNodeResetContext): void {}

  dispose(context: CinemaNodeDisposeContext): void {
    if (this.program) context.webgl.gl.deleteProgram(this.program)
    this.program = null
  }
}

const GRADIENT_PLUGIN: CinemaNodePlugin = Object.freeze({
  definition: CINEMA_FOUNDATION_GRADIENT_DEFINITION,
  createNode(node: Readonly<CinemaNodeDefinition>): CinemaRenderNode {
    return new FoundationGradientNode(node.id, clamp01(node.opacity))
  },
})

const OUTPUT_PLUGIN: CinemaNodePlugin = Object.freeze({
  definition: CINEMA_FOUNDATION_OUTPUT_DEFINITION,
  createNode(node: Readonly<CinemaNodeDefinition>): CinemaRenderNode {
    return new FoundationOutputNode(node.id)
  },
})

export const CINEMA_FOUNDATION_RUNTIME_REGISTRY = createCinemaRuntimeNodeRegistry([
  { pluginId: CINEMA_FOUNDATION_GRADIENT_PLUGIN_ID, plugin: GRADIENT_PLUGIN },
  { pluginId: CINEMA_FOUNDATION_OUTPUT_PLUGIN_ID, plugin: OUTPUT_PLUGIN },
]).registry

export const CINEMA_PRODUCTION_RUNTIME_REGISTRY = createCinemaRuntimeNodeRegistry([
  ...CINEMA_FOUNDATION_RUNTIME_REGISTRY.list(),
  ...CINEMA_SHADER_SCENE_ADAPTER_BUNDLE.runtimeRegistrations,
]).registry

const FULLSCREEN_VERTEX_SHADER = `#version 300 es
precision highp float;
out vec2 vUv;
void main() {
  vec2 position = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = position;
  gl_Position = vec4(position * 2.0 - 1.0, 0.0, 1.0);
}`

const GRADIENT_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec2 vUv;
uniform vec4 uColorA;
uniform vec4 uColorB;
uniform float uAngle;
uniform float uOpacity;
out vec4 outColor;
void main() {
  vec2 direction = vec2(cos(uAngle), sin(uAngle));
  float amount = clamp(dot(vUv - 0.5, direction) + 0.5, 0.0, 1.0);
  vec4 color = mix(uColorA, uColorB, amount);
  float alpha = clamp(color.a * uOpacity, 0.0, 1.0);
  outColor = vec4(color.rgb * alpha, alpha);
}`

const OUTPUT_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uTexture;
out vec4 outColor;
void main() {
  outColor = texture(uTexture, vUv);
}`

function createProgram(gl: WebGL2RenderingContext, vertexSource: string, fragmentSource: string): WebGLProgram {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, vertexSource)
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource)
  const program = gl.createProgram()
  if (!program) {
    gl.deleteShader(vertex)
    gl.deleteShader(fragment)
    throw new Error('Cinema could not allocate a WebGL program.')
  }
  gl.attachShader(program, vertex)
  gl.attachShader(program, fragment)
  gl.linkProgram(program)
  gl.deleteShader(vertex)
  gl.deleteShader(fragment)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) || 'Unknown WebGL program link failure.'
    gl.deleteProgram(program)
    throw new Error(message)
  }
  return program
}

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)
  if (!shader) throw new Error('Cinema could not allocate a WebGL shader.')
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) || 'Unknown WebGL shader compile failure.'
    gl.deleteShader(shader)
    throw new Error(message)
  }
  return shader
}

function numberValue(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function colorValue(value: unknown, fallback: CinemaColor): Float32Array {
  if (!Array.isArray(value) || value.length !== 4 || value.some(component => typeof component !== 'number')) {
    return new Float32Array(fallback)
  }
  return new Float32Array(value.map(component => clamp01(Number(component))))
}

function clamp01(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0
}

function deepFreeze<Value>(value: Value): Value {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested)
  }
  return value
}
