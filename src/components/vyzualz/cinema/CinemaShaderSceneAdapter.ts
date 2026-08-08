import type {
  CinemaColor,
  CinemaBrandRole,
  CinemaCompositionDefinition,
  CinemaGradientStop,
  CinemaNodeDefinition,
  CinemaParameterDefinition,
  CinemaParameterValue,
} from './CinemaDomain'
import { CINEMA_COMPOSITION_SCHEMA_ID, CINEMA_COMPOSITION_SCHEMA_VERSION } from './CinemaDomain'
import { createCinemaDiagnostic } from './CinemaDiagnostics'
import {
  cinemaNamespacedId,
  cinemaStableId,
  type CinemaActionId,
  type CinemaCompositionId,
  type CinemaConnectionId,
  type CinemaControlPointId,
  type CinemaEnumOptionId,
  type CinemaNodeId,
  type CinemaNodeTypeId,
  type CinemaParameterId,
  type CinemaPortId,
  type CinemaRendererPluginId,
  type CinemaShaderPassId,
  type CinemaShaderResourceId,
} from './CinemaIdentifiers'
import type { CinemaPersistedDefinition } from './CinemaPersistence'
import type {
  CinemaNodeDisposeContext,
  CinemaNodeInitializeContext,
  CinemaNodePlugin,
  CinemaNodeRenderContext,
  CinemaNodeResetContext,
  CinemaNodeResizeContext,
  CinemaNodeTypeDefinition,
  CinemaRenderNode,
  CinemaRenderTargetLease,
  CinemaShaderPassMetadata,
  CinemaTargetDescriptor,
  CinemaTextureView,
} from './CinemaRendererContracts'
import { createCinemaRuntimeNodeRegistry, type CinemaRuntimeNodeRegistration } from './CinemaRuntimeNodeRegistry'
import { ShaderSpectrumTexture } from '../react/shaders/audio/ShaderSpectrumTexture'
import { ShaderWaveformTexture } from '../react/shaders/audio/ShaderWaveformTexture'
import { shaderRegistry } from '../react/shaders/registry'
import { ShaderRegistry } from '../react/shaders/registry/ShaderRegistry'
import type {
  BrandPaletteRole,
} from '../../../features/personalization/BrandKitTypes'
import type {
  EnumParamDef,
  GradientStop,
  RGBA,
  ShaderDefinition,
  ShaderParamDef,
  ShaderParamValue,
  TextureInputDef,
  TextureSourceType,
  Vec2,
} from '../react/shaders/registry/shaderRegistryTypes'
import { ShaderPassCompiler } from '../react/shaders/rendergraph/ShaderPassCompiler'
import { ShaderRenderPass } from '../react/shaders/rendergraph/ShaderRenderPass'
import type { CompiledGraph, CompiledPassNode } from '../react/shaders/rendergraph/shaderRenderGraphTypes'
import { FullscreenPass } from '../react/shaders/runtime/FullscreenPass'
import { GeometryPass } from '../react/shaders/runtime/GeometryPass'
import type { ShaderProgram } from '../react/shaders/runtime/ShaderProgram'
import type { TextureBinding } from '../react/shaders/runtime/shaderRuntimeTypes'
import { getShaderReservedTextureUnits } from '../react/shaders/runtime/shaderTextureUnits'
import { ShaderGradientTextureCache } from '../react/shaders/textures/ShaderGradientTextureCache'

export const CINEMA_SHADER_SCENE_ADAPTER_VERSION = 1 as const
export const CINEMA_SHADER_SCENE_COLOR_OUTPUT_PORT_ID = cinemaStableId<CinemaPortId>('color', 'port')

const NEUTRAL_HARMONIC_UNIFORMS = Object.freeze([
  'uKey', 'uKeyCode', 'uMode', 'uModeCode', 'uKeyConfidence',
  'uChord', 'uChordCode', 'uChordConfidence', 'uChordChangeHit',
  'uRootNote', 'uRootNoteCode', 'uPitchHz', 'uDominantPitch',
  'uPitchNormalized', 'uMelodyHeight', 'uMelodyContour', 'uMelodyContourCode',
] as const)

const MASTER_PARAMETER_SPECS = Object.freeze([
  { id: 'master-intensity', label: 'Master Intensity', uniform: 'uMasterIntensity', default: 1, min: 0, max: 2 },
  { id: 'master-motion', label: 'Master Motion', uniform: 'uMasterMotion', default: 1, min: 0, max: 2 },
  { id: 'master-glow', label: 'Master Glow', uniform: 'uMasterGlow', default: 1, min: 0, max: 2 },
  { id: 'master-bass-reactivity', label: 'Master Bass Reactivity', uniform: 'uMasterBassReactivity', default: 1, min: 0, max: 2 },
  { id: 'master-trail-decay', label: 'Master Trail Decay', uniform: 'uMasterTrailDecay', default: 1, min: 0, max: 2 },
  { id: 'master-fog-density', label: 'Master Fog Density', uniform: 'uMasterFogDensity', default: 1, min: 0, max: 2 },
  { id: 'master-particle-density', label: 'Master Particle Density', uniform: 'uMasterParticleDensity', default: 1, min: 0, max: 2 },
] as const)

export interface CinemaShaderSceneAdapterEntry {
  sceneId: string
  typeId: CinemaNodeTypeId
  pluginId: CinemaRendererPluginId
  definition: Readonly<CinemaNodeTypeDefinition>
  persistedDefinition: Readonly<CinemaPersistedDefinition>
  plugin: CinemaNodePlugin
}

export interface CinemaShaderSceneAdapterBundle {
  entries: readonly CinemaShaderSceneAdapterEntry[]
  persistedDefinitions: readonly CinemaPersistedDefinition[]
  runtimeRegistrations: readonly CinemaRuntimeNodeRegistration[]
}

interface ShaderParameterMapping {
  shader: ShaderParamDef
  cinemaId: CinemaParameterId
  enumValues?: readonly { cinemaId: CinemaEnumOptionId; shaderValue: string }[]
}

interface ShaderTextureInputMapping {
  input: TextureInputDef
  portId: CinemaPortId
}

interface ShaderBrandTextureInputMapping {
  portId: CinemaPortId
  label: string
  samplerName: string
  metadataPrefix: string
  unit: 'brandLogo' | 'brandTexture' | 'brandBackground'
  acceptedRole: 'logo' | 'image'
}

interface PersistentPassTarget {
  lease: CinemaRenderTargetLease
  descriptorKey: string
  pingPong: boolean
}

interface PassTargetResolution {
  lease: CinemaRenderTargetLease
  width: number
  height: number
  framebuffer: WebGLFramebuffer | null
}

const BRAND_TEXTURE_INPUT_SPECS = Object.freeze([
  {
    id: 'brand-logo',
    label: 'Brand Logo',
    samplerName: 'uBrandLogoTexture',
    metadataPrefix: 'uBrandLogo',
    unit: 'brandLogo',
    acceptedRole: 'logo',
  },
  {
    id: 'brand-texture',
    label: 'Brand Texture',
    samplerName: 'uBrandTexture',
    metadataPrefix: 'uBrandTexture',
    unit: 'brandTexture',
    acceptedRole: 'image',
  },
  {
    id: 'brand-background',
    label: 'Brand Background',
    samplerName: 'uBrandBackgroundTexture',
    metadataPrefix: 'uBrandBackground',
    unit: 'brandBackground',
    acceptedRole: 'image',
  },
] as const)

const DEFAULT_BRAND_COLORS = Object.freeze({
  primary: [0, 0.9, 1, 1] as CinemaColor,
  secondary: [0.55, 0.2, 1, 1] as CinemaColor,
  accent: [1, 0.15, 0.65, 1] as CinemaColor,
  background: [0.003, 0.005, 0.015, 1] as CinemaColor,
  foreground: [1, 1, 1, 1] as CinemaColor,
  highlight: [1, 1, 1, 1] as CinemaColor,
})

const BRAND_COLOR_PARAMETER_SPECS = Object.freeze([
  { id: 'brand-primary-color', label: 'Primary Color', role: 'primary', default: DEFAULT_BRAND_COLORS.primary },
  { id: 'brand-secondary-color', label: 'Secondary Color', role: 'secondary', default: DEFAULT_BRAND_COLORS.secondary },
  { id: 'brand-accent-color', label: 'Accent Color', role: 'accent', default: DEFAULT_BRAND_COLORS.accent },
  { id: 'brand-background-color', label: 'Background Color', role: 'background', default: DEFAULT_BRAND_COLORS.background },
  { id: 'brand-foreground-color', label: 'Foreground Color', role: 'foreground', default: DEFAULT_BRAND_COLORS.foreground },
  { id: 'brand-highlight-color', label: 'Highlight Color', role: 'highlight', default: DEFAULT_BRAND_COLORS.highlight },
] as const)

export function cinemaShaderSceneTypeId(sceneId: string): CinemaNodeTypeId {
  return cinemaNamespacedId<CinemaNodeTypeId>(`drmvyz.cinema.shader.${normalizeNamespacedSegment(sceneId)}`, 'node type')
}

export function cinemaShaderScenePluginId(sceneId: string): CinemaRendererPluginId {
  return cinemaNamespacedId<CinemaRendererPluginId>(`drmvyz.cinema.renderer.shader.${normalizeNamespacedSegment(sceneId)}`, 'renderer plugin')
}

export function cinemaShaderTextureInputPortId(inputName: string): CinemaPortId {
  return cinemaStableId<CinemaPortId>(normalizeStableId(stripUniformPrefix(inputName)), 'port')
}

export function cinemaShaderBrandTexturePortId(slotId: string): CinemaPortId {
  return cinemaStableId<CinemaPortId>(normalizeStableId(slotId), 'port')
}

export function cinemaShaderParameterId(parameterId: string): CinemaParameterId {
  return cinemaStableId<CinemaParameterId>(normalizeStableId(parameterId), 'parameter')
}

export function createCinemaShaderSceneParameterValues(
  sceneId: string,
  values: Readonly<Record<string, unknown>>,
): Record<CinemaParameterId, CinemaParameterValue> {
  const shader = shaderRegistry.get(sceneId)
  if (!shader) throw new Error(`Shader scene \"${sceneId}\" is not registered.`)
  const result: Record<CinemaParameterId, CinemaParameterValue> = {}
  for (const parameter of shader.params) {
    if (parameter.type === 'trigger') continue
    const mapping = createParameterMapping(parameter)
    const raw = Object.prototype.hasOwnProperty.call(values, parameter.id) ? values[parameter.id] : defaultShaderValue(parameter)
    result[mapping.cinemaId] = shaderValueToCinemaValue(mapping, raw as ShaderParamValue)
  }
  return result
}

export function cinemaShaderTriggerActionId(sceneId: string, parameterId: string): CinemaActionId {
  return cinemaNamespacedId<CinemaActionId>(
    `drmvyz.cinema.shader-action.${normalizeNamespacedSegment(sceneId)}.${normalizeNamespacedSegment(parameterId)}`,
    'action',
  )
}

export function createCinemaShaderSceneAdapterBundle(
  registry: Pick<ShaderRegistry, 'getAll'> = shaderRegistry,
): CinemaShaderSceneAdapterBundle {
  const entries = registry.getAll().map(createAdapterEntry)
  return Object.freeze({
    entries: Object.freeze(entries),
    persistedDefinitions: Object.freeze(entries.map(entry => entry.persistedDefinition)),
    runtimeRegistrations: Object.freeze(entries.map(entry => ({ pluginId: entry.pluginId, plugin: entry.plugin }))),
  })
}

export const CINEMA_SHADER_SCENE_ADAPTER_BUNDLE = createCinemaShaderSceneAdapterBundle()

export const CINEMA_SHADER_SCENE_RUNTIME_REGISTRY = createCinemaRuntimeNodeRegistry(
  CINEMA_SHADER_SCENE_ADAPTER_BUNDLE.runtimeRegistrations,
).registry

export function createCinemaShaderSceneComposition(
  sceneId: string,
  outputTypeId: CinemaNodeTypeId,
  outputInputPortId: CinemaPortId,
  options: {
    compositionId?: CinemaCompositionId
    sceneNodeId?: CinemaNodeId
    outputNodeId?: CinemaNodeId
    outputNodeFamily?: CinemaNodeDefinition['family']
    name?: string
    description?: string
  } = {},
): CinemaCompositionDefinition {
  const entry = CINEMA_SHADER_SCENE_ADAPTER_BUNDLE.entries.find(candidate => candidate.sceneId === sceneId)
  if (!entry) throw new Error(`Shader scene "${sceneId}" is not registered for the Cinema adapter.`)
  const compositionId = options.compositionId ?? cinemaStableId<CinemaCompositionId>(
    normalizeStableId(`shader-${sceneId}`),
    'composition',
  )
  const sceneNodeId = options.sceneNodeId ?? cinemaStableId<CinemaNodeId>(
    normalizeStableId(`${sceneId}-node`),
    'node',
  )
  const outputNodeId = options.outputNodeId ?? cinemaStableId<CinemaNodeId>(
    normalizeStableId(`${sceneId}-output`),
    'node',
  )
  const connectionId = cinemaStableId<CinemaConnectionId>(
    normalizeStableId(`${sceneId}-to-output`),
    'connection',
  )
  const parameterValues: Record<CinemaParameterId, CinemaParameterValue> = {}
  for (const parameter of entry.definition.parameters) {
    if (parameter.type !== 'trigger') parameterValues[parameter.id] = parameter.default
  }
  const masterParameters = createMasterParameterDefinitions(false)
  const masterValues = Object.fromEntries(masterParameters.map(parameter => [parameter.id, 'default' in parameter ? parameter.default : null]))
  return {
    schemaId: CINEMA_COMPOSITION_SCHEMA_ID,
    schemaVersion: CINEMA_COMPOSITION_SCHEMA_VERSION,
    id: compositionId,
    revision: 1,
    metadata: {
      name: options.name ?? `Cinema Shader: ${entry.definition.label}`,
      description: options.description ?? `Stage 9 reference composition for Shader Pads scene ${sceneId}.`,
      tags: ['shader-adapter', sceneId],
      provenance: { builtIn: true, adapter: 'shader-scene', adapterVersion: CINEMA_SHADER_SCENE_ADAPTER_VERSION },
    },
    nodes: [
      {
        id: sceneNodeId,
        typeId: entry.typeId,
        typeVersion: entry.definition.version,
        family: 'shader',
        label: entry.definition.label,
        enabled: true,
        opacity: 1,
        parameterValues,
      },
      {
        id: outputNodeId,
        typeId: outputTypeId,
        typeVersion: 1,
        family: options.outputNodeFamily ?? 'output',
        label: 'Cinema Output',
        enabled: true,
        opacity: 1,
        parameterValues: {},
      },
    ],
    connections: [{
      id: connectionId,
      from: { nodeId: sceneNodeId, portId: CINEMA_SHADER_SCENE_COLOR_OUTPUT_PORT_ID },
      to: { nodeId: outputNodeId, portId: outputInputPortId },
      enabled: true,
    }],
    outputNodeId,
    masterParameters,
    masterValues,
    cameras: [],
    assetBindings: [],
    modulationRoutes: [],
    performanceRules: [],
  }
}

function createAdapterEntry(shader: ShaderDefinition): CinemaShaderSceneAdapterEntry {
  const typeId = cinemaShaderSceneTypeId(shader.id)
  const pluginId = cinemaShaderScenePluginId(shader.id)
  const parameterMappings = shader.params.map(createParameterMapping)
  const textureInputs = (shader.textureInputs ?? []).map(input => ({
    input,
    portId: cinemaShaderTextureInputPortId(input.name),
  }))
  const brandTextureInputs = createBrandTextureInputMappings(shader)
  const persistentPassCount = (shader.passes ?? []).filter(pass => pass.persistent && !pass.pingPong).length
  const pingPongPairCount = (shader.passes ?? []).filter(pass => pass.pingPong).length
  const estimatedPassCount = Math.max(1, shader.quality?.estimatedPassCount ?? shader.passes?.length ?? 1)
  const definition: CinemaNodeTypeDefinition = deepFreeze({
    typeId,
    version: shader.version,
    label: shader.name,
    description: shader.description,
    family: 'shader',
    inputPorts: [
      ...textureInputs.map(({ input, portId }) => ({
        id: portId,
        label: input.label,
        direction: 'input' as const,
        dataType: 'color-texture' as const,
        cardinality: 'one' as const,
        required: input.required === true,
      })),
      ...brandTextureInputs.map(input => ({
        id: input.portId,
        label: input.label,
        direction: 'input' as const,
        dataType: 'color-texture' as const,
        cardinality: 'one' as const,
        required: false,
      })),
    ],
    outputPorts: [{
      id: CINEMA_SHADER_SCENE_COLOR_OUTPUT_PORT_ID,
      label: 'Color',
      direction: 'output',
      dataType: 'color-texture',
    }],
    parameters: [
      ...createMasterParameterDefinitions(true),
      ...createBrandColorParameterDefinitions(),
      ...parameterMappings.map(mapping => cinemaParameterDefinition(mapping)),
    ],
    capabilities: {
      backends: ['webgl2'],
      canvas2d: { compatibility: 'unsupported', preservesPremultipliedAlpha: true },
      camera: { mode: 'uniformCamera', controls: [], autoDirector: false },
      requires: { webgl2: true },
      fallbacks: [
        {
          capability: 'webgl2',
          behavior: 'safe-output',
          message: 'Shader scene adapters require the Cinema-owned WebGL2 context.',
        },
        ...(shader.quality?.requiresFloatTarget ? [{
          capability: 'floatColorTargets' as const,
          behavior: 'use-lower-quality' as const,
          message: 'The Shader scene will use Shader Pads float-target downgrade rules.',
        }] : []),
      ],
    },
    cost: {
      cpu: estimatedPassCount >= 6 ? 'high' : estimatedPassCount >= 3 ? 'medium' : 'low',
      gpu: estimatedPassCount >= 6 ? 'extreme' : estimatedPassCount >= 3 ? 'high' : 'medium',
      estimatedPassCount,
      persistentTargetCount: persistentPassCount,
      pingPongPairCount,
    },
    seekPolicy: shader.resetOnActivation || persistentPassCount > 0 || pingPongPairCount > 0
      ? { mode: 'reset-at-position', seedScope: 'node' }
      : { mode: 'stateless' },
    output: {
      colorSpace: 'srgb',
      alphaMode: 'premultiplied',
      colorFormat: 'rgba8',
      hasDepth: false,
      hasMask: false,
    },
    shaderPasses: createShaderPassMetadata(shader, textureInputs, brandTextureInputs, parameterMappings),
    metadata: {
      adapter: 'shader-scene',
      adapterVersion: CINEMA_SHADER_SCENE_ADAPTER_VERSION,
      sourceEngine: 'shaderPads',
      shaderSceneId: shader.id,
      shaderCategory: shader.category,
      shaderVersion: shader.version,
      tags: [...(shader.tags ?? [])],
      customVertexShader: Boolean(shader.vertSrc && shader.vertSrc !== 'shared'),
      externalTextureCount: textureInputs.length,
      brandTextureSlotCount: brandTextureInputs.length,
      brandTexturePorts: brandTextureInputs.map(input => ({
        portId: input.portId,
        samplerName: input.samplerName,
        acceptedRole: input.acceptedRole,
      })),
      resetOnActivation: shader.resetOnActivation === true,
      feedbackHistoryFrames: shader.feedback?.historyFrames ?? 0,
      prefersFloatTargets: shader.quality?.requiresFloatTarget === true,
    },
  })

  const persistedDefinition: CinemaPersistedDefinition = deepFreeze({
    id: typeId,
    definition,
    rendererPluginId: pluginId,
    source: { kind: 'adapter', id: `shader-scene:${shader.id}` },
    quality: {
      minimumTier: shader.quality?.minimumTier ?? 'low',
      maximumTier: 'ultra',
      adaptive: true,
      maximumEstimatedPassCount: estimatedPassCount,
      maximumPersistentTargetCount: persistentPassCount,
      maximumPingPongPairCount: pingPongPairCount,
    },
  })

  const plugin: CinemaNodePlugin = Object.freeze({
    definition,
    createNode(node: Readonly<CinemaNodeDefinition>): CinemaRenderNode {
      return new ShaderSceneNodeAdapter(node, shader, parameterMappings, textureInputs, brandTextureInputs)
    },
  })

  return Object.freeze({ sceneId: shader.id, typeId, pluginId, definition, persistedDefinition, plugin })
}

class ShaderSceneNodeAdapter implements CinemaRenderNode {
  readonly typeId: CinemaNodeTypeId
  private compiler: ShaderPassCompiler | null = null
  private graph: CompiledGraph | null = null
  private fullscreen: FullscreenPass | null = null
  private geometry: GeometryPass | null = null
  private passes: ShaderRenderPass[] = []
  private spectrum: ShaderSpectrumTexture | null = null
  private waveform: ShaderWaveformTexture | null = null
  private gradients: ShaderGradientTextureCache | null = null
  private neutralTexture: WebGLTexture | null = null
  private persistentTargets = new Map<string, PersistentPassTarget>()
  private targets: CinemaNodeInitializeContext['targets'] | null = null
  private gl: WebGL2RenderingContext | null = null
  private initialized = false

  constructor(
    readonly authoredNode: Readonly<CinemaNodeDefinition>,
    private readonly shader: Readonly<ShaderDefinition>,
    private readonly parameterMappings: readonly ShaderParameterMapping[],
    private readonly textureInputs: readonly ShaderTextureInputMapping[],
    private readonly brandTextureInputs: readonly ShaderBrandTextureInputMapping[],
  ) {
    this.typeId = authoredNode.typeId
  }

  get nodeId(): CinemaNodeId { return this.authoredNode.id }

  initialize(context: CinemaNodeInitializeContext): void {
    this.targets = context.targets
    this.gl = context.webgl.gl
    this.assertCapabilities(context)
    this.compiler = new ShaderPassCompiler(this.gl)
    const result = this.compiler.compile(this.shader as ShaderDefinition)
    if (!result.graph) {
      context.diagnostics.report(createCinemaDiagnostic({
        code: 'CINEMA_SHADER_COMPILE_FAILED',
        severity: 'error',
        message: result.error?.message ?? `Shader scene "${this.shader.id}" failed to compile through Cinema.`,
        attribution: { nodeId: this.nodeId, stage: 'shader-scene-adapter' },
        details: {
          sceneId: this.shader.id,
          passId: result.error?.passId ?? null,
          compilerCode: result.error?.code ?? 'UNKNOWN',
        },
      }))
      throw new Error(result.error?.message ?? `Shader scene "${this.shader.id}" failed to compile.`)
    }
    this.graph = result.graph
    this.fullscreen = new FullscreenPass(this.gl)
    this.geometry = new GeometryPass(this.gl)
    this.passes = this.graph.passes.map(node => new ShaderRenderPass(
      this.gl!,
      this.fullscreen!,
      this.geometry!,
      node,
    ))
    this.spectrum = new ShaderSpectrumTexture(this.gl)
    this.waveform = new ShaderWaveformTexture(this.gl)
    this.gradients = new ShaderGradientTextureCache(this.gl)
    this.neutralTexture = createNeutralTexture(this.gl)
    this.initialized = true
    if (this.shader.resetOnActivation) this.clearState()
  }

  resize(_context: CinemaNodeResizeContext): void {
    this.clearState()
  }

  render(context: CinemaNodeRenderContext): void {
    if (!this.initialized || !this.graph || !this.gl || !this.targets || !this.spectrum || !this.waveform || !this.gradients) {
      throw new Error(`Shader scene adapter "${this.shader.id}" is not initialized.`)
    }
    if (!context.target || context.outputNode) {
      throw new Error(`Shader scene adapter "${this.shader.id}" must render into a Cinema-provided node target.`)
    }

    this.spectrum.update(context.frame.audio.fft)
    this.waveform.update(context.frame.audio.waveform)

    const shaderValues = this.resolveShaderValues(context)
    const reservedUnits = getShaderReservedTextureUnits(this.gl)
    const firstGradientUnit = maximumPassInputCount(this.graph)
    const gradientUnits = this.gradients.buildUnitMap(
      this.shader as ShaderDefinition,
      shaderValues,
      this.gl,
      firstGradientUnit,
      reservedUnits.firstReserved,
    )
    const frameTargets: CinemaRenderTargetLease[] = []
    const outputs = new Map<string, CinemaTextureView>()

    try {
      for (let index = 0; index < this.graph.passes.length; index += 1) {
        const compiled = this.graph.passes[index]
        const pass = this.passes[index]
        const previousSelfView = compiled.pingPong && compiled.outputName
          ? this.getPersistentReadView(compiled.outputName)
          : null
        const bindings = this.resolvePassInputs(context, compiled, outputs, previousSelfView)
        const target = this.resolvePassTarget(context, compiled, frameTargets)
        pass.execute(
          target.framebuffer,
          target.width,
          target.height,
          bindings,
          program => this.applyUniforms(program, context, shaderValues, gradientUnits, target.width, target.height),
        )
        if (compiled.outputName) {
          const view = context.targets.getReadTexture(target.lease)
          if (view) outputs.set(compiled.outputName, view)
        }
      }
    } finally {
      for (const lease of frameTargets.reverse()) context.targets.release(lease)
      for (const unit of gradientUnits.values()) {
        this.gl.activeTexture(this.gl.TEXTURE0 + unit)
        this.gl.bindTexture(this.gl.TEXTURE_2D, null)
      }
      this.gl.activeTexture(this.gl.TEXTURE0 + reservedUnits.spectrum)
      this.gl.bindTexture(this.gl.TEXTURE_2D, null)
      this.gl.activeTexture(this.gl.TEXTURE0 + reservedUnits.waveform)
      this.gl.bindTexture(this.gl.TEXTURE_2D, null)
      for (const input of this.brandTextureInputs) {
        this.gl.activeTexture(this.gl.TEXTURE0 + reservedUnits[input.unit])
        this.gl.bindTexture(this.gl.TEXTURE_2D, null)
      }
      context.webgl.resetState()
    }
  }

  reset(_context: CinemaNodeResetContext): void {
    this.clearState()
  }

  dispose(_context: CinemaNodeDisposeContext): void {
    this.releasePersistentTargets()
    if (this.graph) ShaderPassCompiler.disposeGraph(this.graph)
    this.fullscreen?.dispose()
    this.geometry?.dispose()
    this.spectrum?.dispose()
    this.waveform?.dispose()
    this.gradients?.dispose()
    if (this.neutralTexture && this.gl) this.gl.deleteTexture(this.neutralTexture)
    this.compiler = null
    this.graph = null
    this.fullscreen = null
    this.geometry = null
    this.passes = []
    this.spectrum = null
    this.waveform = null
    this.gradients = null
    this.neutralTexture = null
    this.targets = null
    this.gl = null
    this.initialized = false
  }

  private assertCapabilities(context: CinemaNodeInitializeContext): void {
    if (!context.platform.webgl2) {
      context.diagnostics.report(createCinemaDiagnostic({
        code: 'CINEMA_CAPABILITY_UNAVAILABLE',
        severity: 'error',
        message: `Shader scene "${this.shader.id}" requires WebGL2.`,
        attribution: { nodeId: this.nodeId, stage: 'shader-scene-adapter' },
      }))
      throw new Error(`Shader scene "${this.shader.id}" requires WebGL2.`)
    }
    const requiredUnits = maximumDeclaredPassInputCount(this.shader) + gradientParameterCount(this.shader) + 5
    if (context.platform.maximumTextureUnits < requiredUnits) {
      context.diagnostics.report(createCinemaDiagnostic({
        code: 'CINEMA_CAPABILITY_UNAVAILABLE',
        severity: 'error',
        message: `Shader scene "${this.shader.id}" needs ${requiredUnits} texture units, but Cinema reports ${context.platform.maximumTextureUnits}.`,
        attribution: { nodeId: this.nodeId, stage: 'shader-scene-adapter' },
        details: { requiredTextureUnits: requiredUnits, availableTextureUnits: context.platform.maximumTextureUnits },
      }))
      throw new Error(`Shader scene "${this.shader.id}" exceeds the available texture-unit budget.`)
    }
  }

  private resolvePassInputs(
    context: CinemaNodeRenderContext,
    pass: CompiledPassNode,
    outputs: ReadonlyMap<string, CinemaTextureView>,
    previousSelfView: CinemaTextureView | null,
  ): TextureBinding[] {
    const bindings: TextureBinding[] = []
    for (let unit = 0; unit < pass.inputs.length; unit += 1) {
      const input = pass.inputs[unit]
      const external = this.textureInputs.find(mapping => mapping.input.name === input.source)
      const view = external
        ? context.inputs[external.portId] ?? null
        : pass.pingPong && pass.outputName === input.source
          ? previousSelfView
          : outputs.get(input.source) ?? null
      if (!view) {
        if (external?.input.required) {
          context.diagnostics.report(createCinemaDiagnostic({
            code: 'CINEMA_ASSET_MISSING',
            severity: 'warning',
            message: `Required Shader texture input "${external.input.name}" is unavailable; Cinema supplied the neutral texture fallback.`,
            attribution: { nodeId: this.nodeId, portId: external.portId, stage: 'shader-scene-adapter' },
            details: { sceneId: this.shader.id, textureSource: external.input.source },
          }))
        }
      }
      const texture = view ? context.webgl.resolveTexture(view) : null
      const resolvedTexture = texture ?? this.neutralTexture
      if (resolvedTexture) bindings.push({ unit, texture: resolvedTexture, uniformName: input.uniformName })
    }
    return bindings
  }

  private resolvePassTarget(
    context: CinemaNodeRenderContext,
    pass: CompiledPassNode,
    frameTargets: CinemaRenderTargetLease[],
  ): PassTargetResolution {
    if (pass.outputName === null) return this.bindLease(context, context.target!)
    const descriptor = targetDescriptor(pass, context.quality)
    const descriptorKey = JSON.stringify(descriptor)
    if (pass.persistent || pass.pingPong) {
      let persistent = this.persistentTargets.get(pass.outputName)
      if (persistent && persistent.descriptorKey !== descriptorKey) {
        context.targets.release(persistent.lease)
        this.persistentTargets.delete(pass.outputName)
        persistent = undefined
      }
      if (!persistent) {
        const lease = context.targets.acquire(
          this.nodeId,
          descriptor,
          pass.pingPong ? 'ping-pong-node' : 'persistent-node',
        )
        persistent = { lease, descriptorKey, pingPong: pass.pingPong }
        this.persistentTargets.set(pass.outputName, persistent)
        context.targets.clear(lease)
        if (pass.pingPong) {
          context.targets.swapPingPong(lease)
          context.targets.clear(lease)
          context.targets.swapPingPong(lease)
        }
      }
      if (pass.pingPong) context.targets.swapPingPong(persistent.lease)
      return this.bindLease(context, persistent.lease)
    }
    const lease = context.targets.acquire(this.nodeId, descriptor, 'frame')
    frameTargets.push(lease)
    return this.bindLease(context, lease)
  }

  private bindLease(
    context: CinemaNodeRenderContext,
    lease: CinemaRenderTargetLease,
  ): PassTargetResolution {
    const dimensions = context.webgl.bindTarget(lease)
    const framebuffer = context.webgl.gl.getParameter(context.webgl.gl.FRAMEBUFFER_BINDING) as WebGLFramebuffer | null
    return { lease, width: dimensions.width, height: dimensions.height, framebuffer }
  }

  private getPersistentReadView(outputName: string): CinemaTextureView | null {
    const target = this.persistentTargets.get(outputName)
    return target && this.targets ? this.targets.getReadTexture(target.lease) : null
  }

  private resolveShaderValues(context: CinemaNodeRenderContext): Record<string, ShaderParamValue> {
    const values: Record<string, ShaderParamValue> = { ...this.shader.defaults }
    for (const mapping of this.parameterMappings) {
      const raw = context.values[mapping.cinemaId]
      values[mapping.shader.id] = cinemaValueToShaderValue(mapping, raw)
    }
    return values
  }

  private applyUniforms(
    program: ShaderProgram,
    context: CinemaNodeRenderContext,
    values: Record<string, ShaderParamValue>,
    gradientUnits: ReadonlyMap<string, number>,
    width: number,
    height: number,
  ): void {
    const frame = context.frame
    const gl = context.webgl.gl
    const reserved = getShaderReservedTextureUnits(gl)
    program.setVec2('uResolution', width, height)
    program.setFloat('uAspect', height > 0 ? width / height : 1)
    program.setFloat('uTime', frame.timing.elapsedTimeSec)
    program.setFloat('uDeltaTime', frame.timing.deltaTimeSec)
    program.setFloat('uPlaybackTime', frame.transport.audioTimeSec)
    program.setFloat('uPlaybackProgress', frame.transport.durationSec && frame.transport.durationSec > 0
      ? clamp01(frame.transport.audioTimeSec / frame.transport.durationSec)
      : 0)
    program.setFloat('uFrameIndex', frame.timing.frameIndex)
    program.setFloat('uCompositionSeed', frame.timing.seeds.composition)
    program.setFloat('uTrackSeed', frame.timing.seeds.track)
    program.setFloat('uEventSeed', frame.timing.seeds.event)

    const audio = frame.audio
    const analyserAvailable = frame.capabilities.analyser && audio.available
    const musicIntelligenceAvailable = frame.capabilities.musicIntelligence && frame.music.available
    const sectionAvailable = frame.capabilities.authoritativeSections && frame.music.sectionId !== null
    const lyricsAvailable = frame.capabilities.lyrics && frame.lyrics.available
    const semanticAvailable = musicIntelligenceAvailable
    program.setFloat('uVolume', audio.volume)
    program.setFloat('uRms', audio.rms)
    program.setFloat('uPeak', Math.max(audio.volume, audio.rms, audio.energy))
    program.setFloat('uCrestFactor', 0)
    program.setFloat('uEnergy', audio.energy)
    program.setFloat('uEnergyShort', audio.energy)
    program.setFloat('uEnergyShortTerm', audio.energy)
    program.setFloat('uEnergyLong', audio.energy)
    program.setFloat('uEnergyLongTerm', audio.energy)
    program.setFloat('uEnergyDelta', audio.flux)
    program.setFloat('uEnergyPercentile', audio.energy)
    program.setFloat('uTrackEnergy', audio.energy)
    program.setFloat('uSub', audio.sub)
    program.setFloat('uBass', audio.bass)
    program.setFloat('uLowMid', audio.mid)
    program.setFloat('uMid', audio.mid)
    program.setFloat('uHighMid', (audio.mid + audio.high) * 0.5)
    program.setFloat('uHigh', audio.high)
    program.setFloat('uAir', audio.high)
    program.setFloat('uRawSub', audio.sub)
    program.setFloat('uRawBass', audio.bass)
    program.setFloat('uRawLowMid', audio.mid)
    program.setFloat('uRawMid', audio.mid)
    program.setFloat('uRawHigh', audio.high)
    program.setFloat('uRawAir', audio.high)
    program.setFloat('uSpectralCentroid', audio.centroid)
    program.setFloat('uSpectralFlux', audio.flux)
    program.setFloat('uSpectralSpread', 0)
    program.setFloat('uSpectralRolloff', 0)
    program.setFloat('uSpectralFlatness', 0)
    program.setFloat('uHarmonicity', audio.harmonicity)
    program.setFloat('uComplexity', audio.complexity)
    program.setFloat('uTension', audio.tension)
    program.setFloat('uBuildProgress', audio.buildProgress)
    program.setFloat('uDropImpact', audio.dropImpact)
    program.setFloat('uVocalActivity', audio.vocalPresence)
    program.setFloat('uVocalPresence', audio.vocalPresence)

    const music = frame.music
    program.setFloat('uBpm', music.bpm ?? 0)
    program.setFloat('uBpmConfidence', music.bpm === null ? 0 : 1)
    program.setFloat('uBeatPhase', music.beatPhase)
    program.setFloat('uBarPhase', music.clocks.states.bar.phase)
    program.setFloat('uPhrasePhase', music.clocks.states.phrase.phase)
    program.setFloat('uPhrase4Progress', music.clocks.states.bar4.phase)
    program.setFloat('uPhrase8Progress', music.clocks.states.bar8.phase)
    program.setFloat('uPhrase16Progress', music.clocks.states.phrase.phase)
    program.setFloat('uPhrase32Progress', 0)
    program.setFloat('uPhrase4Hit', frame.impulses.phrase4 ? 1 : 0)
    program.setFloat('uPhrase8Hit', frame.impulses.phrase8 ? 1 : 0)
    program.setFloat('uPhrase16Hit', 0)
    program.setFloat('uPhrase32Hit', 0)
    program.setFloat('uBeatIndex', music.beatIndex ?? 0)
    program.setFloat('uBeatInBar', music.beatInBar ?? 0)
    program.setFloat('uBarIndex', music.barIndex ?? 0)
    program.setFloat('uSectionProgress', music.sectionProgress)
    program.setFloat('uSectionPhase', music.sectionProgress)
    program.setFloat('uSectionType', encodeSectionType(music.sectionType))
    program.setFloat('uSectionIntensity', audio.energy)
    program.setFloat('uSectionConfidence', sectionAvailable ? 1 : 0)
    program.setFloat('uSectionSource', encodeSectionSource(music.source))

    const impulses = frame.impulses
    program.setFloat('uKick', impulses.kick ? 1 : 0)
    program.setFloat('uSnare', impulses.snare ? 1 : 0)
    program.setFloat('uHat', impulses.transient && !impulses.kick && !impulses.snare ? 1 : 0)
    program.setFloat('uBeatHit', impulses.beat ? 1 : 0)
    program.setFloat('uDownbeatHit', impulses.downbeat ? 1 : 0)
    program.setFloat('uKickHit', impulses.kick ? 1 : 0)
    program.setFloat('uSnareHit', impulses.snare ? 1 : 0)
    program.setFloat('uHatHit', impulses.transient && !impulses.kick && !impulses.snare ? 1 : 0)
    program.setFloat('uTransient', impulses.transient ? 1 : 0)
    program.setFloat('uTransientConfidence', analyserAvailable ? 1 : 0)
    program.setFloat('uSectionStartPulse', impulses.sectionStart ? 1 : 0)
    program.setFloat('uSectionChangePulse', impulses.sectionStart ? 1 : 0)
    program.setFloat('uDropStartPulse', impulses.dropStart ? 1 : 0)

    const lyrics = frame.lyrics
    program.setFloat('uLyricActivity', lyrics.vocalsActive ? 1 : 0)
    program.setFloat('uLyricLineProgress', lyrics.lineProgress)
    program.setFloat('uLyricWordProgress', lyrics.wordProgress)
    program.setFloat('uLyricWordHit', impulses.lyricWord ? 1 : 0)
    program.setFloat('uLyricLineEnter', impulses.lyricCue ? 1 : 0)
    program.setFloat('uLyricLineExit', 0)
    program.setFloat('uLyricGap', lyricsAvailable ? 0 : 1)
    program.setFloat('uLyricPhraseConfidence', lyricsAvailable ? 1 : 0)

    // Stage 6's normalized frame intentionally exposes no pitch, key, chord,
    // stem, mood, or semantic classification payloads. Keep those legacy
    // Shader uniforms explicitly neutral instead of inventing values from
    // unrelated signals; their availability gates preserve safe behavior.
    applyNeutralHarmonicUniforms(program)
    program.setFloat('uVocalEnergy', audio.vocalPresence)
    program.setFloat('uDrumEnergy', 0)
    program.setFloat('uBassStemEnergy', 0)
    program.setFloat('uInstrumentEnergy', 0)
    program.setFloat('uOtherStemEnergy', 0)
    program.setFloat('uVocalActivity', audio.vocalPresence)
    program.setFloat('uDrumStemTransient', 0)
    program.setFloat('uBassStemTransient', 0)
    program.setFloat('uBuildConfidence', audio.buildProgress)
    program.setFloat('uDropConfidence', audio.dropImpact)
    program.setFloat('uFakeoutConfidence', 0)
    program.setFloat('uVocalHookConfidence', audio.vocalPresence)
    program.setFloat('uMood', 0)
    program.setFloat('uMoodCode', 0)
    program.setFloat('uTexture', 0)
    program.setFloat('uTextureCode', 0)

    program.setFloat('uHasLiveBands', analyserAvailable ? 1 : 0)
    program.setFloat('uHasRhythmEvents', frame.capabilities.sharedPerformance ? 1 : 0)
    program.setFloat('uHasBeatGrid', frame.capabilities.beatGrid ? 1 : 0)
    program.setFloat('uHasSections', sectionAvailable ? 1 : 0)
    program.setFloat('uHasTrackEnergyCurve', musicIntelligenceAvailable ? 1 : 0)
    program.setFloat('uHasStems', 0)
    program.setFloat('uHasLyrics', lyricsAvailable ? 1 : 0)
    program.setFloat('uHasHarmonics', 0)
    program.setFloat('uHasSemantics', semanticAvailable ? 1 : 0)
    program.setFloat('uOverallConfidence', analyserAvailable || musicIntelligenceAvailable ? 1 : 0)
    program.setFloat('uRhythmConfidence', frame.capabilities.beatGrid ? 1 : 0)
    program.setFloat('uHarmonicConfidence', 0)

    for (const spec of MASTER_PARAMETER_SPECS) {
      const id = cinemaShaderParameterId(spec.id)
      const opacityScale = spec.id === 'master-intensity' ? clamp01(this.authoredNode.opacity) : 1
      program.setFloat(spec.uniform, numberValue(context.values[id], spec.default) * opacityScale)
    }

    const brandColors = resolveNodeBrandColors(context.values, frame.brand.colors)
    applyBrandUniform(program, 'uBrandPrimary', brandColors.primary, DEFAULT_BRAND_COLORS.primary)
    applyBrandUniform(program, 'uBrandSecondary', brandColors.secondary, DEFAULT_BRAND_COLORS.secondary)
    applyBrandUniform(program, 'uBrandAccent', brandColors.accent, DEFAULT_BRAND_COLORS.accent)
    applyBrandUniform(program, 'uBrandBackground', brandColors.background, DEFAULT_BRAND_COLORS.background)
    applyBrandUniform(program, 'uBrandForeground', brandColors.foreground, DEFAULT_BRAND_COLORS.foreground)
    applyBrandUniform(program, 'uBrandText', brandColors.foreground, DEFAULT_BRAND_COLORS.foreground)
    applyBrandUniform(program, 'uBrandHighlight', brandColors.highlight, DEFAULT_BRAND_COLORS.highlight)
    applyBrandUniform(program, 'uBrandImpact', DEFAULT_BRAND_COLORS.highlight, DEFAULT_BRAND_COLORS.highlight)
    program.setFloat('uBrandStrength', frame.brand.available ? 1 : 0)
    program.setFloat('uBrandEnabled', frame.brand.available ? 1 : 0)

    for (const mapping of this.parameterMappings) {
      const value = values[mapping.shader.id]
      applyParameterUniform(
        program,
        this.shader.id,
        mapping,
        value,
        gradientUnits,
        frame.brand.available ? frame.brand.colors : {},
        frame.performance.actionIds,
      )
    }

    for (const mapping of this.textureInputs) {
      const available = Boolean(context.inputs[mapping.portId] && context.webgl.resolveTexture(context.inputs[mapping.portId]!))
      program.setFloat(`${mapping.input.name}Available`, available ? 1 : 0)
      program.setVec2(`${mapping.input.name}Resolution`, 1, 1)
      program.setFloat(`${mapping.input.name}Aspect`, 1)
      program.setVec2(`${mapping.input.name}UvScale`, 1, 1)
      program.setVec2(`${mapping.input.name}UvOffset`, 0, 0)
    }

    for (const input of this.brandTextureInputs) {
      const view = context.inputs[input.portId] ?? null
      const texture = view ? context.webgl.resolveTexture(view) : null
      gl.activeTexture(gl.TEXTURE0 + reserved[input.unit])
      gl.bindTexture(gl.TEXTURE_2D, texture ?? this.neutralTexture)
      program.setSampler(input.samplerName, reserved[input.unit])
      program.setFloat(`${input.metadataPrefix}Available`, texture ? 1 : 0)
      program.setFloat(`${input.metadataPrefix}Aspect`, 1)
      program.setFloat(`${input.metadataPrefix}Scale`, 1)
      program.setFloat(`${input.metadataPrefix}Opacity`, 1)
      program.setVec2(`${input.metadataPrefix}UvScale`, 1, 1)
      program.setVec2(`${input.metadataPrefix}UvOffset`, 0, 0)
    }

    gl.activeTexture(gl.TEXTURE0 + reserved.spectrum)
    gl.bindTexture(gl.TEXTURE_2D, this.spectrum!.texture)
    program.setSampler('uSpectrumTexture', reserved.spectrum)
    program.setInt('uSpectrumBinCount', this.spectrum!.binCount)
    program.setFloat('uSpectrumAvailable', frame.audio.fft ? 1 : 0)

    gl.activeTexture(gl.TEXTURE0 + reserved.waveform)
    gl.bindTexture(gl.TEXTURE_2D, this.waveform!.texture)
    program.setSampler('uWaveformTexture', reserved.waveform)
    program.setInt('uWaveformSampleCount', this.waveform!.sampleCount)
    program.setFloat('uWaveformAvailable', frame.audio.waveform ? 1 : 0)
  }

  private clearState(): void {
    if (!this.targets) return
    for (const target of this.persistentTargets.values()) {
      try {
        this.targets.clear(target.lease)
        if (target.pingPong) {
          this.targets.swapPingPong(target.lease)
          this.targets.clear(target.lease)
          this.targets.swapPingPong(target.lease)
        }
      } catch { /* context loss invalidates GPU state */ }
    }
  }

  private releasePersistentTargets(): void {
    if (this.targets) {
      for (const target of this.persistentTargets.values()) this.targets.release(target.lease)
    }
    this.persistentTargets.clear()
  }
}

function createMasterParameterDefinitions(bindToMaster: boolean): CinemaParameterDefinition[] {
  return MASTER_PARAMETER_SPECS.map((spec, order) => ({
    id: cinemaShaderParameterId(spec.id),
    label: spec.label,
    group: 'Master',
    type: 'float' as const,
    default: spec.default,
    min: spec.min,
    max: spec.max,
    step: 0.01,
    modulatable: true,
    ui: { control: 'slider' as const, order },
    ...(bindToMaster ? {
      masterBinding: {
        masterParameterId: cinemaShaderParameterId(spec.id),
        operation: 'replace' as const,
        influence: 1,
      },
    } : {}),
  }))
}

function createBrandColorParameterDefinitions(): CinemaParameterDefinition[] {
  return BRAND_COLOR_PARAMETER_SPECS.map((spec, order) => ({
    id: cinemaShaderParameterId(spec.id),
    label: spec.label,
    type: 'color' as const,
    default: [...spec.default] as CinemaColor,
    brandRole: spec.role as CinemaBrandRole,
    brandPolicy: 'free' as const,
    modulatable: false,
    ui: { control: 'color' as const, order },
  }))
}

function resolveNodeBrandColors(
  values: Readonly<Partial<Record<CinemaParameterId, CinemaParameterValue>>>,
  fallback: CinemaNodeRenderContext['frame']['brand']['colors'],
): Readonly<Partial<Record<CinemaBrandRole, CinemaColor>>> {
  return Object.freeze(Object.fromEntries(BRAND_COLOR_PARAMETER_SPECS.map(spec => {
    const value = values[cinemaShaderParameterId(spec.id)]
    return [spec.role, colorValue(value, fallback[spec.role] ?? spec.default)]
  })))
}

function createParameterMapping(shader: ShaderParamDef): ShaderParameterMapping {
  const cinemaId = cinemaShaderParameterId(shader.id)
  if (shader.type !== 'enum') return { shader, cinemaId }
  const used = new Set<string>()
  const enumValues = shader.values.map((option, index) => {
    let id = normalizeStableId(option.value)
    while (used.has(id)) id = normalizeStableId(`${option.value}-${index + 1}`)
    used.add(id)
    return {
      cinemaId: cinemaStableId<CinemaEnumOptionId>(id, 'enum option'),
      shaderValue: option.value,
    }
  })
  return { shader, cinemaId, enumValues }
}

function cinemaParameterDefinition(mapping: ShaderParameterMapping): CinemaParameterDefinition {
  const parameter = mapping.shader
  const base = {
    id: mapping.cinemaId,
    label: parameter.label,
    ...(parameter.description ? { description: parameter.description } : {}),
    ...(parameter.group ? { group: parameter.group } : {}),
    ...(parameter.advanced != null ? { advanced: parameter.advanced } : {}),
    modulatable: parameter.modulatable ?? false,
  }
  switch (parameter.type) {
    case 'float':
      return { ...base, type: 'float', default: parameter.default, min: parameter.min, max: parameter.max, ...(parameter.step != null ? { step: parameter.step } : {}), ...(parameter.unit ? { unit: parameter.unit } : {}), ...(parameter.logarithmic ? { logarithmic: true } : {}), ui: { control: 'slider' } }
    case 'integer':
      return { ...base, type: 'integer', default: parameter.default, min: parameter.min, max: parameter.max, ...(parameter.step != null ? { step: parameter.step } : {}), ...(parameter.unit ? { unit: parameter.unit } : {}), ui: { control: 'number' } }
    case 'boolean':
      return { ...base, type: 'boolean', default: parameter.default, ui: { control: 'toggle' } }
    case 'enum': {
      const values = mapping.enumValues ?? []
      const defaultValue = values.find(value => value.shaderValue === parameter.default)?.cinemaId ?? values[0]?.cinemaId
      if (!defaultValue) throw new Error(`Shader enum parameter "${parameter.id}" has no values.`)
      return {
        ...base,
        type: 'enum',
        default: defaultValue,
        options: parameter.values.map(option => ({
          id: values.find(value => value.shaderValue === option.value)!.cinemaId,
          label: option.label,
        })),
        ui: { control: 'select' },
      }
    }
    case 'trigger':
      return { ...base, type: 'trigger', modulatable: false, ui: { control: 'button' } }
    case 'color':
      return { ...base, type: 'color', default: [...parameter.default] as CinemaColor, ...(parameter.brandRole ? { brandRole: toCinemaBrandRole(parameter.brandRole) } : {}), ui: { control: 'color' } }
    case 'gradient':
      return {
        ...base,
        type: 'gradient',
        default: parameter.default.map((stop, index) => ({
          id: cinemaStableId<CinemaControlPointId>(`stop-${index + 1}`, 'control point'),
          position: stop.position,
          color: [...stop.color] as CinemaColor,
        })),
        ui: { control: 'gradient' },
      }
    case 'vec2':
      return { ...base, type: 'vector2', default: [...parameter.default] as Vec2, min: [...parameter.min] as Vec2, max: [...parameter.max] as Vec2, ...(parameter.step ? { step: [...parameter.step] as Vec2 } : {}), ui: { control: 'vector' } }
    case 'texture':
      return { ...base, type: 'texture', default: null, acceptedRoles: acceptedAssetRoles(parameter.acceptedSources), ui: { control: 'texture' } }
  }
}

function createShaderPassMetadata(
  shader: ShaderDefinition,
  textureInputs: readonly ShaderTextureInputMapping[],
  brandTextureInputs: readonly ShaderBrandTextureInputMapping[],
  parameterMappings: readonly ShaderParameterMapping[],
): readonly CinemaShaderPassMetadata[] {
  const passes = shader.passes && shader.passes.length > 0
    ? shader.passes
    : [{
        id: '__single__',
        fragSrc: shader.fragSrc ?? '',
        vertSrc: shader.vertSrc && shader.vertSrc !== 'shared' ? shader.vertSrc : undefined,
        inputs: (shader.textureInputs ?? []).map(input => input.name),
        output: 'color',
        resolutionScale: 1,
        clearBeforeRender: true,
      }]
  const outputOwner = new Map(passes.map(pass => [pass.output, pass.id]))
  return passes.map(pass => {
    const implicitDependencies = pass.inputs
      .map(raw => outputOwner.get(typeof raw === 'string' ? raw : raw.source))
      .filter((value): value is string => Boolean(value && value !== pass.id))
    const dependencies = [...new Set([...(pass.dependsOn ?? []), ...implicitDependencies])]
    return {
      id: cinemaStableId<CinemaShaderPassId>(normalizeStableId(pass.id), 'shader pass'),
      label: pass.id,
      vertex: pass.vertSrc || (shader.vertSrc && shader.vertSrc !== 'shared')
        ? { language: 'glsl-es-300', source: pass.vertSrc ?? shader.vertSrc as string }
        : { language: 'shared-fullscreen-triangle' },
      fragment: { language: 'glsl-es-300', source: pass.fragSrc },
      draw: pass.drawKind === 'geometry'
        ? {
            kind: 'geometry',
            geometry: {
              primitive: 'triangle-strip',
              indexed: false,
              instanced: true,
              attributes: [],
            },
          }
        : { kind: 'fullscreen' },
      uniforms: parameterMappings.map(mapping => ({
        uniformName: mapping.shader.uniformName,
        uniformType: shaderUniformType(mapping.shader),
        source: { kind: 'parameter', parameterId: mapping.cinemaId },
      })),
      inputs: [
        ...pass.inputs.map(raw => {
          const source = typeof raw === 'string' ? raw : raw.source
          const uniformName = typeof raw === 'string' ? raw.replace(/-/g, '_') : raw.uniformName
          const external = textureInputs.find(mapping => mapping.input.name === source)
          return {
            source: external
              ? { kind: 'node-input' as const, portId: external.portId }
              : pass.pingPong && source === pass.output
                ? { kind: 'pass-history' as const, outputId: cinemaStableId<CinemaShaderResourceId>(normalizeStableId(source), 'shader resource'), framesAgo: 1 }
                : { kind: 'pass-output' as const, outputId: cinemaStableId<CinemaShaderResourceId>(normalizeStableId(source), 'shader resource') },
            uniformName,
            required: external?.input.required ?? true,
          }
        }),
        ...brandTextureInputs
          .filter(input => shaderSourceUsesUniform(pass.fragSrc, input.samplerName))
          .map(input => ({
            source: { kind: 'node-input' as const, portId: input.portId },
            uniformName: input.samplerName,
            required: false,
          })),
      ],
      outputId: cinemaStableId<CinemaShaderResourceId>(normalizeStableId(pass.output), 'shader resource'),
      dependsOn: dependencies.map(id => cinemaStableId<CinemaShaderPassId>(normalizeStableId(id), 'shader pass')),
      target: {
        resolutionScale: pass.resolutionScale ?? 1,
        format: pass.format ?? (shader.quality?.requiresFloatTarget ? 'rgba16f' : 'rgba8'),
        filter: pass.filter ?? 'linear',
        wrap: pass.wrap ?? 'clamp',
        clearBeforeRender: pass.clearBeforeRender ?? true,
        blendMode: pass.blendMode ?? 'none',
        persistent: pass.persistent ?? false,
        pingPong: pass.pingPong ?? false,
        ...(pass.pingPong ? { historyFrames: shader.feedback?.historyFrames ?? 1 } : {}),
        ...(pass.bloomTier != null ? { bloomTier: pass.bloomTier } : {}),
      },
    }
  })
}

function shaderUniformType(parameter: ShaderParamDef): 'float' | 'int' | 'bool' | 'vec2' | 'vec3' | 'vec4' {
  switch (parameter.type) {
    case 'integer': return 'int'
    case 'boolean': return 'bool'
    case 'enum': return parameter.uniformType === 'int' ? 'int' : 'float'
    case 'vec2': return 'vec2'
    case 'color': return 'vec4'
    default: return 'float'
  }
}

function targetDescriptor(
  pass: CompiledPassNode,
  quality: CinemaNodeRenderContext['quality'],
): CinemaTargetDescriptor {
  const graphScale = quality?.resolutionScale ?? 1
  const optionalPassScale = pass.bloomTier != null && pass.bloomTier > (quality?.optionalPassTier ?? 3)
    ? 0.05
    : 1
  const resolutionScale = Math.max(0.05, pass.resolutionScale * graphScale * optionalPassScale)
  return {
    colorSpace: 'srgb',
    alphaMode: 'premultiplied',
    colorFormat: pass.format,
    hasDepth: false,
    hasMask: false,
    widthScale: resolutionScale,
    heightScale: resolutionScale,
    filter: pass.filter,
    wrap: pass.wrap,
    clearColor: [0, 0, 0, 0],
  }
}

function applyParameterUniform(
  program: ShaderProgram,
  sceneId: string,
  mapping: ShaderParameterMapping,
  value: ShaderParamValue,
  gradientUnits: ReadonlyMap<string, number>,
  brandColors: CinemaNodeRenderContext['frame']['brand']['colors'],
  actionIds: readonly CinemaActionId[],
): void {
  const parameter = mapping.shader
  switch (parameter.type) {
    case 'float':
    case 'integer':
      program.setFloat(parameter.uniformName, numberValue(value, parameter.default))
      break
    case 'boolean':
      program.setFloat(parameter.uniformName, value === true ? 1 : 0)
      break
    case 'enum': {
      const selected = typeof value === 'string' ? value : parameter.default
      const index = Math.max(0, parameter.values.findIndex(option => option.value === selected))
      if (parameter.uniformType === 'int') program.setInt(parameter.uniformName, index)
      else program.setFloat(parameter.uniformName, index)
      break
    }
    case 'trigger': {
      const actionId = cinemaShaderTriggerActionId(sceneId, parameter.id)
      program.setFloat(parameter.uniformName, value === true || actionIds.includes(actionId) ? 1 : 0)
      break
    }
    case 'color': {
      const authored = colorValue(value, parameter.default)
      const resolved = parameter.brandRole ? brandColor(brandColors, parameter.brandRole, authored) : authored
      program.setVec4(parameter.uniformName, resolved[0], resolved[1], resolved[2], resolved[3])
      break
    }
    case 'vec2': {
      const vector = vector2Value(value, parameter.default)
      program.setVec2(parameter.uniformName, vector[0], vector[1])
      break
    }
    case 'gradient': {
      const unit = gradientUnits.get(parameter.id)
      if (unit != null) {
        program.setSampler(parameter.uniformName, unit)
        program.setFloat(`${parameter.uniformName}StopCount`, Array.isArray(value) ? value.length : parameter.default.length)
      }
      break
    }
    case 'texture':
      break
  }
}

function shaderValueToCinemaValue(mapping: ShaderParameterMapping, value: ShaderParamValue): CinemaParameterValue {
  const parameter = mapping.shader
  switch (parameter.type) {
    case 'float':
    case 'integer':
      return numberValue(value, parameter.default)
    case 'boolean':
      return value === true
    case 'enum':
      return mapping.enumValues?.find(option => option.shaderValue === value)?.cinemaId
        ?? mapping.enumValues?.find(option => option.shaderValue === parameter.default)?.cinemaId
        ?? mapping.enumValues?.[0]?.cinemaId
        ?? cinemaStableId<CinemaEnumOptionId>('default', 'enum option')
    case 'trigger':
      return value === true
    case 'color':
      return [...colorValue(value, parameter.default)] as CinemaColor
    case 'gradient':
      return gradientValue(value, parameter.default).map((stop, index) => ({
        id: cinemaStableId<CinemaControlPointId>(`stop-${index + 1}`, 'control point'),
        position: stop.position,
        color: [...stop.color] as CinemaColor,
      }))
    case 'vec2':
      return [...vector2Value(value, parameter.default)] as Vec2
    case 'texture':
      return typeof value === 'string' ? value : null
  }
}

function cinemaValueToShaderValue(mapping: ShaderParameterMapping, value: CinemaParameterValue | undefined): ShaderParamValue {
  const parameter = mapping.shader
  if (value === undefined) return defaultShaderValue(parameter)
  switch (parameter.type) {
    case 'float':
    case 'integer':
      return numberValue(value, parameter.default)
    case 'boolean':
      return value === true
    case 'enum':
      return mapping.enumValues?.find(option => option.cinemaId === value)?.shaderValue ?? parameter.default
    case 'trigger':
      return value === true
    case 'color':
      return colorValue(value, parameter.default)
    case 'gradient':
      return gradientValue(value, parameter.default)
    case 'vec2':
      return vector2Value(value, parameter.default)
    case 'texture':
      return typeof value === 'string' ? value : null
  }
}

function defaultShaderValue(parameter: ShaderParamDef): ShaderParamValue {
  return parameter.type === 'trigger' ? false : parameter.type === 'texture' ? null : parameter.default
}

function gradientValue(value: unknown, fallback: GradientStop[]): GradientStop[] {
  if (!Array.isArray(value)) return fallback.map(stop => ({ position: stop.position, color: [...stop.color] as RGBA }))
  const converted: GradientStop[] = []
  for (const stop of value as readonly CinemaGradientStop[]) {
    if (!stop || typeof stop.position !== 'number' || !Array.isArray(stop.color) || stop.color.length !== 4) continue
    converted.push({ position: clamp01(stop.position), color: colorValue(stop.color, [0, 0, 0, 1]) })
  }
  return converted.length > 0 ? converted : fallback
}

function acceptedAssetRoles(sources: readonly TextureSourceType[]): readonly ('logo' | 'image' | 'video' | 'album-artwork' | 'mask' | 'node-output')[] {
  const roles = new Set<'logo' | 'image' | 'video' | 'album-artwork' | 'mask' | 'node-output'>()
  for (const source of sources) {
    if (source === 'logo') roles.add('logo')
    else if (source === 'uploaded-video') roles.add('video')
    else if (source === 'album-artwork') roles.add('album-artwork')
    else if (source === 'mask') roles.add('mask')
    else if (source === 'media-output' || source === 'shader-output' || source === 'previous-frame') roles.add('node-output')
    else roles.add('image')
  }
  return [...roles]
}

function maximumPassInputCount(graph: CompiledGraph): number {
  return graph.passes.reduce((maximum, pass) => Math.max(maximum, pass.inputs.length), 0)
}

function maximumDeclaredPassInputCount(shader: ShaderDefinition): number {
  if (!shader.passes || shader.passes.length === 0) return shader.textureInputs?.length ?? 0
  return shader.passes.reduce((maximum, pass) => Math.max(maximum, pass.inputs.length), 0)
}

function gradientParameterCount(shader: ShaderDefinition): number {
  return shader.params.filter(parameter => parameter.type === 'gradient').length
}

function brandColor(
  colors: CinemaNodeRenderContext['frame']['brand']['colors'],
  role: BrandPaletteRole,
  fallback: RGBA,
): RGBA {
  const color = colors[toCinemaBrandRole(role)]
  return color ? [...color] as RGBA : fallback
}

function createBrandTextureInputMappings(shader: ShaderDefinition): ShaderBrandTextureInputMapping[] {
  const source = shaderSource(shader)
  return BRAND_TEXTURE_INPUT_SPECS
    .filter(spec => shaderSourceUsesUniform(source, spec.samplerName))
    .map(spec => ({
      portId: cinemaShaderBrandTexturePortId(spec.id),
      label: spec.label,
      samplerName: spec.samplerName,
      metadataPrefix: spec.metadataPrefix,
      unit: spec.unit,
      acceptedRole: spec.acceptedRole,
    }))
}

function shaderSource(shader: ShaderDefinition): string {
  return [
    shader.fragSrc ?? '',
    shader.vertSrc && shader.vertSrc !== 'shared' ? shader.vertSrc : '',
    ...(shader.passes ?? []).flatMap(pass => [pass.fragSrc, pass.vertSrc ?? '']),
  ].join('\n')
}

function shaderSourceUsesUniform(source: string, uniformName: string): boolean {
  return new RegExp(`\\b${escapeRegExp(uniformName)}\\b`).test(source)
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}


function toCinemaBrandRole(role: BrandPaletteRole): CinemaBrandRole {
  return role === 'text' ? 'foreground' : role
}

function applyBrandUniform(
  program: ShaderProgram,
  name: string,
  value: CinemaColor | undefined,
  fallback: CinemaColor,
): void {
  const color = value ?? fallback
  program.setVec4(name, color[0], color[1], color[2], color[3])
}

function applyNeutralHarmonicUniforms(program: ShaderProgram): void {
  for (const name of NEUTRAL_HARMONIC_UNIFORMS) program.setFloat(name, 0)
}

function encodeSectionSource(source: CinemaNodeRenderContext['frame']['music']['source']): number {
  switch (source) {
    case 'music-intelligence': return 1
    case 'react-frame': return 2
    case 'bpm-derived': return 3
    case 'unavailable': return 0
  }
}

function encodeSectionType(sectionType: string | null): number {
  if (!sectionType) return 0
  let hash = 0x811c9dc5
  for (let index = 0; index < sectionType.length; index += 1) {
    hash ^= sectionType.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0) / 0xffffffff
}

function createNeutralTexture(gl: WebGL2RenderingContext): WebGLTexture {
  const texture = gl.createTexture()
  if (!texture) throw new Error('Cinema Shader adapter could not allocate its neutral texture fallback.')
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    1,
    1,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    new Uint8Array([0, 0, 0, 0]),
  )
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.bindTexture(gl.TEXTURE_2D, null)
  return texture
}

function numberValue(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function colorValue(value: unknown, fallback: readonly number[]): RGBA {
  if (!Array.isArray(value) || value.length !== 4 || value.some(component => typeof component !== 'number' || !Number.isFinite(component))) {
    return [...fallback] as RGBA
  }
  return value.map(component => clamp01(Number(component))) as RGBA
}

function vector2Value(value: unknown, fallback: readonly number[]): Vec2 {
  if (!Array.isArray(value) || value.length !== 2 || value.some(component => typeof component !== 'number' || !Number.isFinite(component))) {
    return [...fallback] as Vec2
  }
  return [Number(value[0]), Number(value[1])]
}

function normalizeNamespacedSegment(value: string): string {
  return normalizeStableId(value).replace(/_/g, '-')
}

function normalizeStableId(value: string): string {
  const normalized = value
    .replace(/^u(?=[A-Z])/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return /^[a-z]/.test(normalized) ? normalized || 'value' : `value-${normalized || 'item'}`
}

function stripUniformPrefix(value: string): string {
  return value.replace(/^u(?=[A-Z])/, '')
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
