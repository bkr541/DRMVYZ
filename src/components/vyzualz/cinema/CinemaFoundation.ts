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
import { createCinemaRuntimeNodeRegistry } from './CinemaRuntimeNodeRegistry'
import { createCinemaDefinitionRegistryFromPersistedDefinitions } from './CinemaDefinitionRegistry'
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
  CINEMA_LEGACY_PRESET_CATALOG_VERSION,
  createCinemaLegacyPresetCatalog,
} from './CinemaLegacyPresetCatalog'
import {
  CINEMA_CINEMATIC_WORLD_ADAPTER_BUNDLE,
  CINEMA_CINEMATIC_WORLD_ADAPTER_VERSION,
  CINEMA_CINEMATIC_WORLD_COLOR_OUTPUT_PORT_ID,
  createCinemaCinematicWorldComposition,
} from './CinemaCinematicWorldAdapter'
import {
  CINEMA_GENERATED_MASK_NODE_TYPE_ID,
  CINEMA_LOGO_NODE_TYPE_ID,
  CINEMA_LYRIC_NODE_TYPE_ID,
  CINEMA_MASK_SHAPE_PARAMETER_ID,
  CINEMA_MEDIA_COLOR_OUTPUT_PORT_ID,
  CINEMA_MEDIA_MASK_OUTPUT_PORT_ID,
  CINEMA_MEDIA_TEXT_PERSISTED_DEFINITIONS,
  CINEMA_MEDIA_TEXT_RUNTIME_REGISTRATIONS,
  CINEMA_STAGE15_REFERENCE_COMPOSITION_ID,
  CINEMA_TEXT_FALLBACK_CONTENT_PARAMETER_ID,
  CINEMA_TEXT_FALLBACK_PARAMETER_ID,
  createCinemaStage15ReferenceComposition,
} from './CinemaMediaTextNodes'
import {
  CINEMA_BLEND_NODE_TYPE_IDS,
  CINEMA_COLOR_CONVERSION_GLSL,
  CINEMA_COMPOSITOR_BACKGROUND_INPUT_PORT_ID,
  CINEMA_COMPOSITOR_COLOR_OUTPUT_PORT_ID,
  CINEMA_COMPOSITOR_EFFECT_INPUT_PORT_ID,
  CINEMA_COMPOSITOR_FOREGROUND_INPUT_PORT_ID,
  CINEMA_COMPOSITOR_MASK_INPUT_PORT_ID,
  CINEMA_COMPOSITOR_PERSISTED_DEFINITIONS,
  CINEMA_COMPOSITOR_RUNTIME_REGISTRATIONS,
  CINEMA_COMPOSITOR_TRANSITION_FROM_INPUT_PORT_ID,
  CINEMA_COMPOSITOR_TRANSITION_KIND_PARAMETER_ID,
  CINEMA_COMPOSITOR_TRANSITION_PROGRESS_PARAMETER_ID,
  CINEMA_COMPOSITOR_TRANSITION_TO_INPUT_PORT_ID,
  CINEMA_EFFECT_NODE_TYPE_IDS,
  CINEMA_MASKED_COMPOSITE_NODE_TYPE_ID,
  CINEMA_TRANSITION_NODE_TYPE_ID,
} from './CinemaCompositorNodes'
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

export const CINEMA_LEGACY_PRESET_CATALOG = deepFreeze(createCinemaLegacyPresetCatalog(
  CINEMA_FOUNDATION_OUTPUT_TYPE_ID,
  CINEMA_FOUNDATION_INPUT_PORT_ID,
))

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
  ...CINEMA_CINEMATIC_WORLD_ADAPTER_BUNDLE.persistedDefinitions,
  ...CINEMA_MEDIA_TEXT_PERSISTED_DEFINITIONS,
  ...CINEMA_COMPOSITOR_PERSISTED_DEFINITIONS,
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

export const CINEMA_CINEMATIC_WORLD_REFERENCE_COMPOSITION: Readonly<CinemaCompositionDefinition> = deepFreeze(
  createCinemaCinematicWorldComposition(
    'eventHorizon',
    CINEMA_FOUNDATION_OUTPUT_TYPE_ID,
    CINEMA_FOUNDATION_INPUT_PORT_ID,
    {
      compositionId: cinemaStableId<CinemaCompositionId>('cinematic-world-reference', 'composition'),
      worldNodeId: cinemaStableId<CinemaNodeId>('cinematic-world-reference', 'node'),
      outputNodeId: cinemaStableId<CinemaNodeId>('cinematic-world-reference-output', 'node'),
      name: 'Cinema Cinematic World Reference',
      description: 'Stage 10 production reference composition rendered by CinematicWorldNodeAdapter.',
    },
  ),
)

export const CINEMA_STAGE15_REFERENCE_COMPOSITION: Readonly<CinemaCompositionDefinition> = deepFreeze(
  createCinemaStage15ReferenceComposition(
    CINEMA_FOUNDATION_OUTPUT_TYPE_ID,
    CINEMA_FOUNDATION_INPUT_PORT_ID,
  ),
)

export const CINEMA_STAGE16_REFERENCE_COMPOSITION_ID = cinemaStableId<CinemaCompositionId>('stage16-compositor-reference', 'composition')

export const CINEMA_STAGE16_REFERENCE_COMPOSITION: Readonly<CinemaCompositionDefinition> = deepFreeze(
  createCinemaStage16ReferenceComposition(),
)

function createCinemaStage16ReferenceComposition(): CinemaCompositionDefinition {
  const worldTemplate = CINEMA_CINEMATIC_WORLD_REFERENCE_COMPOSITION.nodes.find(node => node.family !== 'output')
  if (!worldTemplate) throw new Error('Cinema Stage 16 reference composition requires the registered Cinematic World adapter.')
  const ids = {
    world: cinemaStableId<CinemaNodeId>('stage16-world', 'node'),
    bloom: cinemaStableId<CinemaNodeId>('stage16-world-bloom', 'node'),
    logo: cinemaStableId<CinemaNodeId>('stage16-logo', 'node'),
    mask: cinemaStableId<CinemaNodeId>('stage16-mask', 'node'),
    masked: cinemaStableId<CinemaNodeId>('stage16-masked-logo', 'node'),
    lyrics: cinemaStableId<CinemaNodeId>('stage16-lyrics', 'node'),
    lyricGrade: cinemaStableId<CinemaNodeId>('stage16-lyrics-grade', 'node'),
    screen: cinemaStableId<CinemaNodeId>('stage16-screen-mix', 'node'),
    generator: cinemaStableId<CinemaNodeId>('stage16-test-generator', 'node'),
    pixelation: cinemaStableId<CinemaNodeId>('stage16-pixelation', 'node'),
    transition: cinemaStableId<CinemaNodeId>('stage16-transition', 'node'),
    tone: cinemaStableId<CinemaNodeId>('stage16-master-tone', 'node'),
    output: cinemaStableId<CinemaNodeId>('stage16-output', 'node'),
  }
  const connection = (
    id: string,
    fromNodeId: CinemaNodeId,
    fromPortId: CinemaPortId,
    toNodeId: CinemaNodeId,
    toPortId: CinemaPortId,
  ) => ({
    id: cinemaStableId<CinemaConnectionId>(id, 'connection'),
    from: { nodeId: fromNodeId, portId: fromPortId },
    to: { nodeId: toNodeId, portId: toPortId },
    enabled: true,
  })
  return {
    schemaId: CINEMA_COMPOSITION_SCHEMA_ID,
    schemaVersion: CINEMA_COMPOSITION_SCHEMA_VERSION,
    id: CINEMA_STAGE16_REFERENCE_COMPOSITION_ID,
    revision: 1,
    metadata: {
      name: 'Cinema Layer Compositor Reference',
      description: 'Production-path Stage 16 graph combining a world, transparent logo, lyrics, generated mask, test generator, per-layer effects, master tone mapping, and a composition transition.',
      tags: ['stage-16', 'compositor', 'masks', 'effects', 'transitions'],
      provenance: { builtIn: true, stage: 16 },
    },
    nodes: [
      { ...worldTemplate, id: ids.world, label: 'Cinematic World Layer' },
      { id: ids.bloom, typeId: CINEMA_EFFECT_NODE_TYPE_IDS.bloom, typeVersion: 1, family: 'effect', label: 'World Bloom', enabled: true, opacity: 1, parameterValues: {} },
      { id: ids.logo, typeId: CINEMA_LOGO_NODE_TYPE_ID, typeVersion: 1, family: 'logo', label: 'Transparent Logo Layer', enabled: true, opacity: 1, parameterValues: {} },
      { id: ids.mask, typeId: CINEMA_GENERATED_MASK_NODE_TYPE_ID, typeVersion: 1, family: 'procedural', label: 'Logo Diamond Mask', enabled: true, opacity: 1, parameterValues: { [CINEMA_MASK_SHAPE_PARAMETER_ID]: 'diamond' } },
      { id: ids.masked, typeId: CINEMA_MASKED_COMPOSITE_NODE_TYPE_ID, typeVersion: 1, family: 'mixer', label: 'Masked Logo Composite', enabled: true, opacity: 1, parameterValues: {} },
      { id: ids.lyrics, typeId: CINEMA_LYRIC_NODE_TYPE_ID, typeVersion: 1, family: 'lyrics', label: 'Canonical Lyrics Layer', enabled: true, opacity: 1, parameterValues: { [CINEMA_TEXT_FALLBACK_PARAMETER_ID]: 'static-fallback', [CINEMA_TEXT_FALLBACK_CONTENT_PARAMETER_ID]: 'CINEMA · LAYERS · EFFECTS' } },
      { id: ids.lyricGrade, typeId: CINEMA_EFFECT_NODE_TYPE_IDS['color-grading'], typeVersion: 1, family: 'effect', label: 'Lyrics Color Grade', enabled: true, opacity: 1, parameterValues: {} },
      { id: ids.screen, typeId: CINEMA_BLEND_NODE_TYPE_IDS.screen, typeVersion: 1, family: 'mixer', label: 'World + Lyrics Screen', enabled: true, opacity: 1, parameterValues: {} },
      { id: ids.generator, typeId: CINEMA_FOUNDATION_GRADIENT_TYPE_ID, typeVersion: 1, family: 'procedural', label: 'Particle/Test Generator', enabled: true, opacity: 0.75, parameterValues: { [CINEMA_FOUNDATION_ANGLE_PARAMETER_ID]: 55 } },
      { id: ids.pixelation, typeId: CINEMA_EFFECT_NODE_TYPE_IDS.pixelation, typeVersion: 1, family: 'effect', label: 'Generator Pixelation', enabled: true, opacity: 1, parameterValues: {} },
      { id: ids.transition, typeId: CINEMA_TRANSITION_NODE_TYPE_ID, typeVersion: 1, family: 'mixer', label: 'Composition Transition', enabled: true, opacity: 1, parameterValues: { [CINEMA_COMPOSITOR_TRANSITION_KIND_PARAMETER_ID]: 'wipe', [CINEMA_COMPOSITOR_TRANSITION_PROGRESS_PARAMETER_ID]: 0.25 } },
      { id: ids.tone, typeId: CINEMA_EFFECT_NODE_TYPE_IDS['tone-mapping'], typeVersion: 1, family: 'effect', label: 'Master Tone Mapping', enabled: true, opacity: 1, parameterValues: {} },
      { id: ids.output, typeId: CINEMA_FOUNDATION_OUTPUT_TYPE_ID, typeVersion: 1, family: 'output', label: 'Cinema Output', enabled: true, opacity: 1, parameterValues: {} },
    ],
    connections: [
      connection('stage16-world-bloom', ids.world, CINEMA_CINEMATIC_WORLD_COLOR_OUTPUT_PORT_ID, ids.bloom, CINEMA_COMPOSITOR_EFFECT_INPUT_PORT_ID),
      connection('stage16-bloom-masked-background', ids.bloom, CINEMA_COMPOSITOR_COLOR_OUTPUT_PORT_ID, ids.masked, CINEMA_COMPOSITOR_BACKGROUND_INPUT_PORT_ID),
      connection('stage16-logo-masked-foreground', ids.logo, CINEMA_MEDIA_COLOR_OUTPUT_PORT_ID, ids.masked, CINEMA_COMPOSITOR_FOREGROUND_INPUT_PORT_ID),
      connection('stage16-mask-masked-mask', ids.mask, CINEMA_MEDIA_MASK_OUTPUT_PORT_ID, ids.masked, CINEMA_COMPOSITOR_MASK_INPUT_PORT_ID),
      connection('stage16-lyrics-grade', ids.lyrics, CINEMA_MEDIA_COLOR_OUTPUT_PORT_ID, ids.lyricGrade, CINEMA_COMPOSITOR_EFFECT_INPUT_PORT_ID),
      connection('stage16-masked-screen-background', ids.masked, CINEMA_COMPOSITOR_COLOR_OUTPUT_PORT_ID, ids.screen, CINEMA_COMPOSITOR_BACKGROUND_INPUT_PORT_ID),
      connection('stage16-lyrics-screen-foreground', ids.lyricGrade, CINEMA_COMPOSITOR_COLOR_OUTPUT_PORT_ID, ids.screen, CINEMA_COMPOSITOR_FOREGROUND_INPUT_PORT_ID),
      connection('stage16-generator-pixelation', ids.generator, CINEMA_FOUNDATION_COLOR_OUTPUT_PORT_ID, ids.pixelation, CINEMA_COMPOSITOR_EFFECT_INPUT_PORT_ID),
      connection('stage16-screen-transition-from', ids.screen, CINEMA_COMPOSITOR_COLOR_OUTPUT_PORT_ID, ids.transition, CINEMA_COMPOSITOR_TRANSITION_FROM_INPUT_PORT_ID),
      connection('stage16-pixel-transition-to', ids.pixelation, CINEMA_COMPOSITOR_COLOR_OUTPUT_PORT_ID, ids.transition, CINEMA_COMPOSITOR_TRANSITION_TO_INPUT_PORT_ID),
      connection('stage16-transition-tone', ids.transition, CINEMA_COMPOSITOR_COLOR_OUTPUT_PORT_ID, ids.tone, CINEMA_COMPOSITOR_EFFECT_INPUT_PORT_ID),
      connection('stage16-tone-output', ids.tone, CINEMA_COMPOSITOR_COLOR_OUTPUT_PORT_ID, ids.output, CINEMA_FOUNDATION_INPUT_PORT_ID),
    ],
    outputNodeId: ids.output,
    masterParameters: [],
    masterValues: {},
    cameras: CINEMA_CINEMATIC_WORLD_REFERENCE_COMPOSITION.cameras,
    assetBindings: [],
    modulationRoutes: [],
    performanceRules: [],
  }
}

export function createCinemaFoundationPersistedState(): CinemaPersistedState {
  return JSON.parse(JSON.stringify({
    schemaId: CINEMA_PERSISTED_STORE_SCHEMA_ID,
    schemaVersion: CINEMA_PERSISTED_STORE_SCHEMA_VERSION,
    definitions: CINEMA_PRODUCTION_PERSISTED_DEFINITIONS,
    compositions: [
      CINEMA_FOUNDATION_COMPOSITION,
      CINEMA_SHADER_REFERENCE_COMPOSITION,
      CINEMA_CINEMATIC_WORLD_REFERENCE_COMPOSITION,
      CINEMA_STAGE15_REFERENCE_COMPOSITION,
      CINEMA_STAGE16_REFERENCE_COMPOSITION,
      ...CINEMA_LEGACY_PRESET_CATALOG.compositions,
    ],
    instances: [],
    collections: [],
    activeCompositionId: CINEMA_SHADER_REFERENCE_COMPOSITION.id,
    activeInstanceId: null,
    editorMetadata: {
      foundationInitialized: true,
      shaderSceneAdapterVersion: 1,
      cinematicWorldAdapterVersion: CINEMA_CINEMATIC_WORLD_ADAPTER_VERSION,
      canvas2dAdapterVersion: CINEMA_CINEMATIC_WORLD_ADAPTER_VERSION,
      mediaTextNodeVersion: 1,
      compositorNodeVersion: 1,
      legacyPresetCatalogVersion: CINEMA_LEGACY_PRESET_CATALOG_VERSION,
    },
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
  const canonicalCatalogCompositionIds = new Set(CINEMA_LEGACY_PRESET_CATALOG.compositions.map(composition => String(composition.id)))
  const definitions = [
    ...state.definitions.filter(definition => !canonicalDefinitionIds.has(String(definition.id))),
    ...CINEMA_PRODUCTION_PERSISTED_DEFINITIONS,
  ]
  const compositions = [
    ...state.compositions.filter(composition => (
      composition.id !== CINEMA_SHADER_REFERENCE_COMPOSITION.id
      && composition.id !== CINEMA_CINEMATIC_WORLD_REFERENCE_COMPOSITION.id
      && composition.id !== CINEMA_STAGE15_REFERENCE_COMPOSITION_ID
      && composition.id !== CINEMA_STAGE16_REFERENCE_COMPOSITION_ID
      && !canonicalCatalogCompositionIds.has(String(composition.id))
    )),
    CINEMA_SHADER_REFERENCE_COMPOSITION,
    CINEMA_CINEMATIC_WORLD_REFERENCE_COMPOSITION,
    CINEMA_STAGE15_REFERENCE_COMPOSITION,
    CINEMA_STAGE16_REFERENCE_COMPOSITION,
    ...CINEMA_LEGACY_PRESET_CATALOG.compositions,
  ]
  return JSON.parse(JSON.stringify({
    ...state,
    definitions,
    compositions,
    editorMetadata: {
      ...state.editorMetadata,
      shaderSceneAdapterVersion: 1,
      cinematicWorldAdapterVersion: CINEMA_CINEMATIC_WORLD_ADAPTER_VERSION,
      canvas2dAdapterVersion: CINEMA_CINEMATIC_WORLD_ADAPTER_VERSION,
      mediaTextNodeVersion: 1,
      compositorNodeVersion: 1,
      legacyPresetCatalogVersion: CINEMA_LEGACY_PRESET_CATALOG_VERSION,
    },
  })) as CinemaPersistedState
}

export function createCinemaDefinitionRegistryFromPersisted(
  definitions: readonly CinemaPersistedDefinition[],
  runtimeRegistry = CINEMA_PRODUCTION_RUNTIME_REGISTRY,
) {
  return createCinemaDefinitionRegistryFromPersistedDefinitions(definitions, runtimeRegistry)
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
  private colorSpaceLocation: WebGLUniformLocation | null = null
  private alphaModeLocation: WebGLUniformLocation | null = null

  constructor(readonly nodeId: CinemaNodeId) {}

  initialize(context: CinemaNodeInitializeContext): void {
    const gl = context.webgl.gl
    this.program = createProgram(gl, FULLSCREEN_VERTEX_SHADER, OUTPUT_FRAGMENT_SHADER)
    this.textureLocation = gl.getUniformLocation(this.program, 'uTexture')
    this.colorSpaceLocation = gl.getUniformLocation(this.program, 'uColorSpace')
    this.alphaModeLocation = gl.getUniformLocation(this.program, 'uAlphaMode')
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
    gl.uniform1i(this.colorSpaceLocation, input.descriptor.colorSpace === 'linear-srgb' ? 1 : input.descriptor.colorSpace === 'display-p3' ? 2 : 0)
    gl.uniform1i(this.alphaModeLocation, input.descriptor.alphaMode === 'straight' ? 1 : input.descriptor.alphaMode === 'opaque' ? 2 : 0)
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
  ...CINEMA_CINEMATIC_WORLD_ADAPTER_BUNDLE.runtimeRegistrations,
  ...CINEMA_MEDIA_TEXT_RUNTIME_REGISTRATIONS,
  ...CINEMA_COMPOSITOR_RUNTIME_REGISTRATIONS,
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
uniform int uColorSpace;
uniform int uAlphaMode;
out vec4 outColor;
${CINEMA_COLOR_CONVERSION_GLSL}
void main() {
  vec4 normalized = cinemaNormalizeSample(texture(uTexture, vUv), uColorSpace, uAlphaMode);
  vec3 encoded = cinemaLinearToSrgb(cinemaStraight(normalized));
  outColor = vec4(encoded * normalized.a, normalized.a);
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
