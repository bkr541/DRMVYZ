import {
  CINEMA_COMPOSITION_SCHEMA_ID,
  CINEMA_COMPOSITION_SCHEMA_VERSION,
  type CinemaAssetBindingDefinition,
  type CinemaAssetRole,
  type CinemaColor,
  type CinemaCompositionDefinition,
  type CinemaNodeDefinition,
  type CinemaParameterDefinition,
  type CinemaParameterValue,
  type CinemaVector2,
} from './CinemaDomain'
import {
  cinemaNamespacedId,
  cinemaStableId,
  type CinemaCompositionId,
  type CinemaConnectionId,
  type CinemaEnumOptionId,
  type CinemaNodeId,
  type CinemaNodeTypeId,
  type CinemaParameterId,
  type CinemaPortId,
  type CinemaRendererPluginId,
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
  CinemaRuntimeAssetView,
  CinemaLyricFrame,
} from './CinemaRendererContracts'
import { createCinemaDiagnostic } from './CinemaDiagnostics'
import { createCinemaParameterCapabilities } from './CinemaParameterCapabilities'

export const CINEMA_IMAGE_NODE_TYPE_ID = nodeTypeId('drmvyz.cinema.media.image')
export const CINEMA_VIDEO_NODE_TYPE_ID = nodeTypeId('drmvyz.cinema.media.video')
export const CINEMA_LOGO_NODE_TYPE_ID = nodeTypeId('drmvyz.cinema.media.logo')
export const CINEMA_GENERIC_MEDIA_NODE_TYPE_ID = nodeTypeId('drmvyz.cinema.media.generic')
export const CINEMA_TEXT_NODE_TYPE_ID = nodeTypeId('drmvyz.cinema.text.static')
export const CINEMA_LYRIC_NODE_TYPE_ID = nodeTypeId('drmvyz.cinema.lyrics.current')
export const CINEMA_GENERATED_MASK_NODE_TYPE_ID = nodeTypeId('drmvyz.cinema.mask.generated')

export const CINEMA_IMAGE_NODE_PLUGIN_ID = pluginId('drmvyz.cinema.renderer.media-image')
export const CINEMA_VIDEO_NODE_PLUGIN_ID = pluginId('drmvyz.cinema.renderer.media-video')
export const CINEMA_LOGO_NODE_PLUGIN_ID = pluginId('drmvyz.cinema.renderer.media-logo')
export const CINEMA_GENERIC_MEDIA_NODE_PLUGIN_ID = pluginId('drmvyz.cinema.renderer.media-generic')
export const CINEMA_TEXT_NODE_PLUGIN_ID = pluginId('drmvyz.cinema.renderer.text-static')
export const CINEMA_LYRIC_NODE_PLUGIN_ID = pluginId('drmvyz.cinema.renderer.lyrics-current')
export const CINEMA_GENERATED_MASK_NODE_PLUGIN_ID = pluginId('drmvyz.cinema.renderer.mask-generated')

export const CINEMA_MEDIA_COLOR_OUTPUT_PORT_ID = portId('color')
export const CINEMA_MEDIA_MASK_OUTPUT_PORT_ID = portId('mask')

export const CINEMA_MEDIA_OPACITY_PARAMETER_ID = parameterId('media-opacity')
export const CINEMA_MEDIA_TINT_COLOR_PARAMETER_ID = parameterId('media-tint-color')
export const CINEMA_MEDIA_TINT_AMOUNT_PARAMETER_ID = parameterId('media-tint-amount')
export const CINEMA_MEDIA_FALLBACK_PARAMETER_ID = parameterId('media-fallback')
export const CINEMA_VIDEO_OFFSET_PARAMETER_ID = parameterId('video-offset')
export const CINEMA_VIDEO_LOOP_PARAMETER_ID = parameterId('video-loop')
export const CINEMA_VIDEO_RATE_PARAMETER_ID = parameterId('video-rate')

export const CINEMA_TEXT_CONTENT_PARAMETER_ID = parameterId('text-content')
export const CINEMA_TEXT_FALLBACK_PARAMETER_ID = parameterId('text-fallback')
export const CINEMA_TEXT_FALLBACK_CONTENT_PARAMETER_ID = parameterId('text-fallback-content')
export const CINEMA_TEXT_FONT_FAMILY_PARAMETER_ID = parameterId('text-font-family')
export const CINEMA_TEXT_FONT_SIZE_PARAMETER_ID = parameterId('text-font-size')
export const CINEMA_TEXT_FONT_WEIGHT_PARAMETER_ID = parameterId('text-font-weight')
export const CINEMA_TEXT_ALIGN_PARAMETER_ID = parameterId('text-align')
export const CINEMA_TEXT_COLOR_PARAMETER_ID = parameterId('text-color')
export const CINEMA_TEXT_HIGHLIGHT_COLOR_PARAMETER_ID = parameterId('text-highlight-color')
export const CINEMA_TEXT_OPACITY_PARAMETER_ID = parameterId('text-opacity')
export const CINEMA_TEXT_POSITION_PARAMETER_ID = parameterId('text-position')
export const CINEMA_TEXT_SCALE_PARAMETER_ID = parameterId('text-scale')
export const CINEMA_TEXT_ROTATION_PARAMETER_ID = parameterId('text-rotation')
export const CINEMA_TEXT_MAX_WIDTH_PARAMETER_ID = parameterId('text-max-width')
export const CINEMA_TEXT_LINE_HEIGHT_PARAMETER_ID = parameterId('text-line-height')
export const CINEMA_TEXT_KINETIC_PARAMETER_ID = parameterId('text-kinetic')

export const CINEMA_MASK_SHAPE_PARAMETER_ID = parameterId('mask-shape')
export const CINEMA_MASK_FEATHER_PARAMETER_ID = parameterId('mask-feather')
export const CINEMA_MASK_INVERT_PARAMETER_ID = parameterId('mask-invert')
export const CINEMA_MASK_POSITION_PARAMETER_ID = parameterId('mask-position')
export const CINEMA_MASK_SCALE_PARAMETER_ID = parameterId('mask-scale')
export const CINEMA_MASK_ROTATION_PARAMETER_ID = parameterId('mask-rotation')
export const CINEMA_MASK_OPACITY_PARAMETER_ID = parameterId('mask-opacity')

const ENUM_TRANSPARENT = cinemaStableId<CinemaEnumOptionId>('transparent', 'enum option')
const ENUM_CHECKERBOARD = cinemaStableId<CinemaEnumOptionId>('checkerboard', 'enum option')
const ENUM_HIDE = cinemaStableId<CinemaEnumOptionId>('hide', 'enum option')
const ENUM_HOLD_PREVIOUS = cinemaStableId<CinemaEnumOptionId>('hold-previous', 'enum option')
const ENUM_STATIC_FALLBACK = cinemaStableId<CinemaEnumOptionId>('static-fallback', 'enum option')
const ENUM_REGULAR = cinemaStableId<CinemaEnumOptionId>('regular', 'enum option')
const ENUM_MEDIUM = cinemaStableId<CinemaEnumOptionId>('medium', 'enum option')
const ENUM_BOLD = cinemaStableId<CinemaEnumOptionId>('bold', 'enum option')
const ENUM_BLACK = cinemaStableId<CinemaEnumOptionId>('black', 'enum option')
const ENUM_LEFT = cinemaStableId<CinemaEnumOptionId>('left', 'enum option')
const ENUM_CENTER = cinemaStableId<CinemaEnumOptionId>('center', 'enum option')
const ENUM_RIGHT = cinemaStableId<CinemaEnumOptionId>('right', 'enum option')
const ENUM_RECTANGLE = cinemaStableId<CinemaEnumOptionId>('rectangle', 'enum option')
const ENUM_CIRCLE = cinemaStableId<CinemaEnumOptionId>('circle', 'enum option')
const ENUM_DIAMOND = cinemaStableId<CinemaEnumOptionId>('diamond', 'enum option')

const MEDIA_OUTPUT = deepFreeze({
  colorSpace: 'srgb' as const,
  alphaMode: 'premultiplied' as const,
  colorFormat: 'rgba8' as const,
  hasDepth: false,
  hasMask: false,
})

const MASK_OUTPUT = deepFreeze({ ...MEDIA_OUTPUT, hasMask: true })

const WEBGL_CAPABILITIES = deepFreeze({
  backends: ['webgl2'] as const,
  canvas2d: { compatibility: 'unsupported' as const, preservesPremultipliedAlpha: true },
  camera: { mode: 'none' as const, controls: [] as const, autoDirector: false },
  requires: { webgl2: true },
  fallbacks: [{
    capability: 'webgl2' as const,
    behavior: 'safe-output' as const,
    message: 'This Cinema source node requires the Cinema-owned WebGL2 runtime.',
  }],
})

const TEXT_CAPABILITIES = deepFreeze({
  ...WEBGL_CAPABILITIES,
  requires: { webgl2: true, canvas2d: true },
  fallbacks: [
    ...WEBGL_CAPABILITIES.fallbacks,
    {
      capability: 'canvas2d' as const,
      behavior: 'safe-output' as const,
      message: 'Cinema text rasterization requires the shared Canvas2D text service.',
    },
  ],
})

const COLOR_PORT = deepFreeze({
  id: CINEMA_MEDIA_COLOR_OUTPUT_PORT_ID,
  label: 'Color',
  direction: 'output' as const,
  dataType: 'color-texture' as const,
})

const MASK_PORT = deepFreeze({
  id: CINEMA_MEDIA_MASK_OUTPUT_PORT_ID,
  label: 'Mask',
  direction: 'output' as const,
  dataType: 'mask-texture' as const,
})

const MEDIA_PARAMETERS: readonly CinemaParameterDefinition[] = deepFreeze([
  {
    id: CINEMA_MEDIA_OPACITY_PARAMETER_ID,
    label: 'Opacity',
    type: 'float',
    default: 1,
    min: 0,
    max: 1,
    step: 0.01,
    modulatable: true,
    ui: { control: 'slider', order: 0 },
  },
  {
    id: CINEMA_MEDIA_TINT_COLOR_PARAMETER_ID,
    label: 'Tint Color',
    type: 'color',
    default: [1, 1, 1, 1],
    modulatable: true,
    brandRole: 'primary',
    brandPolicy: 'derived',
    ui: { control: 'color', order: 1 },
  },
  {
    id: CINEMA_MEDIA_TINT_AMOUNT_PARAMETER_ID,
    label: 'Tint Amount',
    type: 'float',
    default: 0,
    min: 0,
    max: 1,
    step: 0.01,
    modulatable: true,
    ui: { control: 'slider', order: 2 },
  },
  {
    id: CINEMA_MEDIA_FALLBACK_PARAMETER_ID,
    label: 'Missing Media',
    type: 'enum',
    default: ENUM_CHECKERBOARD,
    options: [
      { id: ENUM_CHECKERBOARD, label: 'Checkerboard' },
      { id: ENUM_TRANSPARENT, label: 'Transparent' },
    ],
    ui: { control: 'select', order: 3 },
  },
])

const LOGO_PARAMETERS: readonly CinemaParameterDefinition[] = deepFreeze(
  MEDIA_PARAMETERS.map((parameter): CinemaParameterDefinition => (
    parameter.id === CINEMA_MEDIA_FALLBACK_PARAMETER_ID && parameter.type === 'enum'
      ? { ...parameter, default: ENUM_TRANSPARENT }
      : parameter
  )),
)

const VIDEO_PARAMETERS: readonly CinemaParameterDefinition[] = deepFreeze([
  ...MEDIA_PARAMETERS,
  {
    id: CINEMA_VIDEO_OFFSET_PARAMETER_ID,
    label: 'Playback Offset',
    type: 'float',
    default: 0,
    min: -3600,
    max: 3600,
    step: 0.01,
    unit: 'seconds',
    modulatable: true,
    ui: { control: 'number', order: 4 },
  },
  {
    id: CINEMA_VIDEO_LOOP_PARAMETER_ID,
    label: 'Loop Media',
    type: 'boolean',
    default: true,
    ui: { control: 'toggle', order: 5 },
  },
  {
    id: CINEMA_VIDEO_RATE_PARAMETER_ID,
    label: 'Playback Rate',
    type: 'float',
    default: 1,
    min: 0.25,
    max: 4,
    step: 0.05,
    modulatable: true,
    ui: { control: 'slider', order: 6 },
  },
])

const TEXT_PARAMETERS: readonly CinemaParameterDefinition[] = deepFreeze([
  {
    id: CINEMA_TEXT_CONTENT_PARAMETER_ID,
    label: 'Text',
    type: 'string',
    default: 'DVYDRM',
    minLength: 0,
    maxLength: 2048,
    multiline: true,
    ui: { control: 'text', order: 0, placeholder: 'Enter text' },
  },
  {
    id: CINEMA_TEXT_FONT_FAMILY_PARAMETER_ID,
    label: 'Font Family',
    type: 'string',
    default: 'Inter, Arial, sans-serif',
    minLength: 1,
    maxLength: 256,
    ui: { control: 'text', order: 1 },
  },
  {
    id: CINEMA_TEXT_FONT_SIZE_PARAMETER_ID,
    label: 'Font Size',
    type: 'float',
    default: 96,
    min: 8,
    max: 512,
    step: 1,
    unit: 'pixels',
    modulatable: true,
    ui: { control: 'slider', order: 2 },
  },
  {
    id: CINEMA_TEXT_FONT_WEIGHT_PARAMETER_ID,
    label: 'Font Weight',
    type: 'enum',
    default: ENUM_BOLD,
    options: [
      { id: ENUM_REGULAR, label: 'Regular' },
      { id: ENUM_MEDIUM, label: 'Medium' },
      { id: ENUM_BOLD, label: 'Bold' },
      { id: ENUM_BLACK, label: 'Black' },
    ],
    ui: { control: 'select', order: 3 },
  },
  {
    id: CINEMA_TEXT_ALIGN_PARAMETER_ID,
    label: 'Alignment',
    type: 'enum',
    default: ENUM_CENTER,
    options: [
      { id: ENUM_LEFT, label: 'Left' },
      { id: ENUM_CENTER, label: 'Center' },
      { id: ENUM_RIGHT, label: 'Right' },
    ],
    ui: { control: 'select', order: 4 },
  },
  {
    id: CINEMA_TEXT_COLOR_PARAMETER_ID,
    label: 'Text Color',
    type: 'color',
    default: [1, 1, 1, 1],
    brandRole: 'foreground',
    brandPolicy: 'derived',
    modulatable: true,
    ui: { control: 'color', order: 5 },
  },
  {
    id: CINEMA_TEXT_HIGHLIGHT_COLOR_PARAMETER_ID,
    label: 'Word Highlight',
    type: 'color',
    default: [0.05, 0.85, 0.75, 1],
    brandRole: 'accent',
    brandPolicy: 'derived',
    modulatable: true,
    ui: { control: 'color', order: 6 },
  },
  {
    id: CINEMA_TEXT_OPACITY_PARAMETER_ID,
    label: 'Opacity',
    type: 'float',
    default: 1,
    min: 0,
    max: 1,
    step: 0.01,
    modulatable: true,
    ui: { control: 'slider', order: 7 },
  },
  {
    id: CINEMA_TEXT_POSITION_PARAMETER_ID,
    label: 'Position',
    type: 'vector2',
    default: [0, 0],
    min: [-1, -1],
    max: [1, 1],
    step: [0.01, 0.01],
    modulatable: true,
    ui: { control: 'vector', order: 8 },
  },
  {
    id: CINEMA_TEXT_SCALE_PARAMETER_ID,
    label: 'Scale',
    type: 'float',
    default: 1,
    min: 0.05,
    max: 8,
    step: 0.01,
    modulatable: true,
    ui: { control: 'slider', order: 9 },
  },
  {
    id: CINEMA_TEXT_ROTATION_PARAMETER_ID,
    label: 'Rotation',
    type: 'float',
    default: 0,
    min: -Math.PI,
    max: Math.PI,
    step: 0.01,
    unit: 'radians',
    modulatable: true,
    ui: { control: 'slider', order: 10 },
  },
  {
    id: CINEMA_TEXT_MAX_WIDTH_PARAMETER_ID,
    label: 'Maximum Width',
    type: 'float',
    default: 0.9,
    min: 0.1,
    max: 1,
    step: 0.01,
    modulatable: true,
    ui: { control: 'slider', order: 11 },
  },
  {
    id: CINEMA_TEXT_LINE_HEIGHT_PARAMETER_ID,
    label: 'Line Height',
    type: 'float',
    default: 1.15,
    min: 0.8,
    max: 2.5,
    step: 0.01,
    modulatable: true,
    ui: { control: 'slider', order: 12 },
  },
  {
    id: CINEMA_TEXT_KINETIC_PARAMETER_ID,
    label: 'Kinetic Amount',
    type: 'float',
    default: 0,
    min: 0,
    max: 1,
    step: 0.01,
    modulatable: true,
    ui: { control: 'slider', order: 13 },
  },
])

const LYRIC_PARAMETERS: readonly CinemaParameterDefinition[] = deepFreeze([
  ...TEXT_PARAMETERS.filter(parameter => parameter.id !== CINEMA_TEXT_CONTENT_PARAMETER_ID),
  {
    id: CINEMA_TEXT_FALLBACK_PARAMETER_ID,
    label: 'Lyric Gap Behavior',
    type: 'enum',
    default: ENUM_HIDE,
    options: [
      { id: ENUM_HIDE, label: 'Hide' },
      { id: ENUM_HOLD_PREVIOUS, label: 'Hold Previous' },
      { id: ENUM_STATIC_FALLBACK, label: 'Static Fallback' },
    ],
    ui: { control: 'select', order: 0 },
  },
  {
    id: CINEMA_TEXT_FALLBACK_CONTENT_PARAMETER_ID,
    label: 'Fallback Text',
    type: 'string',
    default: '',
    minLength: 0,
    maxLength: 2048,
    multiline: true,
    ui: { control: 'text', order: 1, placeholder: 'Shown when no lyric line is active' },
  },
])

const MASK_PARAMETERS: readonly CinemaParameterDefinition[] = deepFreeze([
  {
    id: CINEMA_MASK_SHAPE_PARAMETER_ID,
    label: 'Shape',
    type: 'enum',
    default: ENUM_RECTANGLE,
    options: [
      { id: ENUM_RECTANGLE, label: 'Rectangle' },
      { id: ENUM_CIRCLE, label: 'Circle' },
      { id: ENUM_DIAMOND, label: 'Diamond' },
    ],
    ui: { control: 'select', order: 0 },
  },
  {
    id: CINEMA_MASK_FEATHER_PARAMETER_ID,
    label: 'Feather',
    type: 'float',
    default: 0.02,
    min: 0,
    max: 0.5,
    step: 0.005,
    modulatable: true,
    ui: { control: 'slider', order: 1 },
  },
  {
    id: CINEMA_MASK_INVERT_PARAMETER_ID,
    label: 'Invert',
    type: 'boolean',
    default: false,
    ui: { control: 'toggle', order: 2 },
  },
  {
    id: CINEMA_MASK_POSITION_PARAMETER_ID,
    label: 'Position',
    type: 'vector2',
    default: [0, 0],
    min: [-1, -1],
    max: [1, 1],
    step: [0.01, 0.01],
    modulatable: true,
    ui: { control: 'vector', order: 3 },
  },
  {
    id: CINEMA_MASK_SCALE_PARAMETER_ID,
    label: 'Scale',
    type: 'vector2',
    default: [0.75, 0.75],
    min: [0.01, 0.01],
    max: [4, 4],
    step: [0.01, 0.01],
    modulatable: true,
    ui: { control: 'vector', order: 4 },
  },
  {
    id: CINEMA_MASK_ROTATION_PARAMETER_ID,
    label: 'Rotation',
    type: 'float',
    default: 0,
    min: -Math.PI,
    max: Math.PI,
    step: 0.01,
    unit: 'radians',
    modulatable: true,
    ui: { control: 'slider', order: 5 },
  },
  {
    id: CINEMA_MASK_OPACITY_PARAMETER_ID,
    label: 'Opacity',
    type: 'float',
    default: 1,
    min: 0,
    max: 1,
    step: 0.01,
    modulatable: true,
    ui: { control: 'slider', order: 6 },
  },
])

function mediaDefinition(
  typeId: CinemaNodeTypeId,
  label: string,
  family: 'media' | 'logo',
  parameters: readonly CinemaParameterDefinition[],
  roles: readonly CinemaAssetRole[],
): Readonly<CinemaNodeTypeDefinition> {
  return deepFreeze({
    typeId,
    version: 1,
    label,
    description: `${label} rendered into a Cinema-owned target using stable asset bindings.`,
    family,
    inputPorts: [],
    outputPorts: [COLOR_PORT],
    parameters,
    parameterCapabilities: createCinemaParameterCapabilities(parameters),
    capabilities: WEBGL_CAPABILITIES,
    cost: {
      cpu: roles.includes('video') ? 'low' : 'minimal',
      gpu: 'low',
      estimatedPassCount: 1,
      persistentTargetCount: 0,
      pingPongPairCount: 0,
    },
    seekPolicy: { mode: 'stateless' },
    output: MEDIA_OUTPUT,
    metadata: { stage: 15, assetRoles: roles },
  })
}

export const CINEMA_IMAGE_NODE_DEFINITION = mediaDefinition(
  CINEMA_IMAGE_NODE_TYPE_ID,
  'Image Layer',
  'media',
  MEDIA_PARAMETERS,
  ['image', 'album-artwork', 'lyric-background'],
)
export const CINEMA_VIDEO_NODE_DEFINITION = mediaDefinition(
  CINEMA_VIDEO_NODE_TYPE_ID,
  'Video Layer',
  'media',
  VIDEO_PARAMETERS,
  ['video'],
)
export const CINEMA_LOGO_NODE_DEFINITION = mediaDefinition(
  CINEMA_LOGO_NODE_TYPE_ID,
  'Logo Layer',
  'logo',
  LOGO_PARAMETERS,
  ['logo'],
)
export const CINEMA_GENERIC_MEDIA_NODE_DEFINITION = mediaDefinition(
  CINEMA_GENERIC_MEDIA_NODE_TYPE_ID,
  'Media Layer',
  'media',
  VIDEO_PARAMETERS,
  ['image', 'video', 'logo', 'album-artwork', 'lyric-background'],
)

export const CINEMA_TEXT_NODE_DEFINITION: Readonly<CinemaNodeTypeDefinition> = deepFreeze({
  typeId: CINEMA_TEXT_NODE_TYPE_ID,
  version: 1,
  label: 'Text Layer',
  description: 'Static text rasterized through Cinema’s shared text service and uploaded into a Cinema-owned target.',
  family: 'text',
  inputPorts: [],
  outputPorts: [COLOR_PORT, MASK_PORT],
  parameters: TEXT_PARAMETERS,
  parameterCapabilities: createCinemaParameterCapabilities(TEXT_PARAMETERS),
  capabilities: TEXT_CAPABILITIES,
  cost: { cpu: 'low', gpu: 'low', estimatedPassCount: 1, persistentTargetCount: 0, pingPongPairCount: 0 },
  seekPolicy: { mode: 'stateless' },
  output: MASK_OUTPUT,
  metadata: { stage: 15, contentSource: 'authored-text', maskCompatible: true },
})

export const CINEMA_LYRIC_NODE_DEFINITION: Readonly<CinemaNodeTypeDefinition> = deepFreeze({
  typeId: CINEMA_LYRIC_NODE_TYPE_ID,
  version: 1,
  label: 'Timed Lyrics',
  description: 'Current canonical lyric line with optional word highlighting and explicit gap behavior.',
  family: 'lyrics',
  inputPorts: [],
  outputPorts: [COLOR_PORT, MASK_PORT],
  parameters: LYRIC_PARAMETERS,
  parameterCapabilities: createCinemaParameterCapabilities(LYRIC_PARAMETERS),
  capabilities: deepFreeze({
    ...TEXT_CAPABILITIES,
    fallbacks: [
      ...TEXT_CAPABILITIES.fallbacks,
      {
        capability: 'lyrics' as const,
        behavior: 'safe-output' as const,
        message: 'The lyric node applies its declared gap fallback when canonical lyrics are unavailable.',
      },
    ],
  }),
  cost: { cpu: 'low', gpu: 'low', estimatedPassCount: 1, persistentTargetCount: 0, pingPongPairCount: 0 },
  seekPolicy: { mode: 'stateless' },
  output: MASK_OUTPUT,
  metadata: { stage: 15, contentSource: 'canonical-lyrics', maskCompatible: true },
})

export const CINEMA_GENERATED_MASK_NODE_DEFINITION: Readonly<CinemaNodeTypeDefinition> = deepFreeze({
  typeId: CINEMA_GENERATED_MASK_NODE_TYPE_ID,
  version: 1,
  label: 'Generated Mask',
  description: 'A deterministic geometric mask source rendered directly into Cinema color and mask attachments.',
  family: 'procedural',
  inputPorts: [],
  outputPorts: [COLOR_PORT, MASK_PORT],
  parameters: MASK_PARAMETERS,
  parameterCapabilities: createCinemaParameterCapabilities(MASK_PARAMETERS),
  capabilities: WEBGL_CAPABILITIES,
  cost: { cpu: 'minimal', gpu: 'minimal', estimatedPassCount: 1, persistentTargetCount: 0, pingPongPairCount: 0 },
  seekPolicy: { mode: 'stateless' },
  output: MASK_OUTPUT,
  metadata: { stage: 15, maskCompatible: true },
})

export const CINEMA_MEDIA_TEXT_PERSISTED_DEFINITIONS: readonly CinemaPersistedDefinition[] = deepFreeze([
  persisted(CINEMA_IMAGE_NODE_DEFINITION, CINEMA_IMAGE_NODE_PLUGIN_ID, 'cinema-image-layer'),
  persisted(CINEMA_VIDEO_NODE_DEFINITION, CINEMA_VIDEO_NODE_PLUGIN_ID, 'cinema-video-layer'),
  persisted(CINEMA_LOGO_NODE_DEFINITION, CINEMA_LOGO_NODE_PLUGIN_ID, 'cinema-logo-layer'),
  persisted(CINEMA_GENERIC_MEDIA_NODE_DEFINITION, CINEMA_GENERIC_MEDIA_NODE_PLUGIN_ID, 'cinema-media-layer'),
  persisted(CINEMA_TEXT_NODE_DEFINITION, CINEMA_TEXT_NODE_PLUGIN_ID, 'cinema-text-layer'),
  persisted(CINEMA_LYRIC_NODE_DEFINITION, CINEMA_LYRIC_NODE_PLUGIN_ID, 'cinema-lyric-layer'),
  persisted(CINEMA_GENERATED_MASK_NODE_DEFINITION, CINEMA_GENERATED_MASK_NODE_PLUGIN_ID, 'cinema-generated-mask'),
])

export const CINEMA_MEDIA_TEXT_RUNTIME_REGISTRATIONS = deepFreeze([
  runtime(CINEMA_IMAGE_NODE_PLUGIN_ID, CINEMA_IMAGE_NODE_DEFINITION, node => new MediaLayerNode(node, ['image', 'album-artwork', 'lyric-background'])),
  runtime(CINEMA_VIDEO_NODE_PLUGIN_ID, CINEMA_VIDEO_NODE_DEFINITION, node => new MediaLayerNode(node, ['video'])),
  runtime(CINEMA_LOGO_NODE_PLUGIN_ID, CINEMA_LOGO_NODE_DEFINITION, node => new MediaLayerNode(node, ['logo'])),
  runtime(CINEMA_GENERIC_MEDIA_NODE_PLUGIN_ID, CINEMA_GENERIC_MEDIA_NODE_DEFINITION, node => new MediaLayerNode(node, ['image', 'video', 'logo', 'album-artwork', 'lyric-background'])),
  runtime(CINEMA_TEXT_NODE_PLUGIN_ID, CINEMA_TEXT_NODE_DEFINITION, node => new TextLayerNode(node, 'static')),
  runtime(CINEMA_LYRIC_NODE_PLUGIN_ID, CINEMA_LYRIC_NODE_DEFINITION, node => new TextLayerNode(node, 'lyrics')),
  runtime(CINEMA_GENERATED_MASK_NODE_PLUGIN_ID, CINEMA_GENERATED_MASK_NODE_DEFINITION, node => new GeneratedMaskNode(node)),
])

export const CINEMA_STAGE15_REFERENCE_COMPOSITION_ID = cinemaStableId<CinemaCompositionId>('stage15-media-text-reference', 'composition')
export const CINEMA_STAGE15_REFERENCE_TEXT_NODE_ID = cinemaStableId<CinemaNodeId>('stage15-reference-text', 'node')
export const CINEMA_STAGE15_REFERENCE_OUTPUT_NODE_ID = cinemaStableId<CinemaNodeId>('stage15-reference-output', 'node')

export function createCinemaStage15ReferenceComposition(
  outputTypeId: CinemaNodeTypeId,
  outputInputPortId: CinemaPortId,
): Readonly<CinemaCompositionDefinition> {
  const connectionId = cinemaStableId<CinemaConnectionId>('stage15-reference-to-output', 'connection')
  return deepFreeze({
    schemaId: CINEMA_COMPOSITION_SCHEMA_ID,
    schemaVersion: CINEMA_COMPOSITION_SCHEMA_VERSION,
    id: CINEMA_STAGE15_REFERENCE_COMPOSITION_ID,
    revision: 1,
    metadata: {
      name: 'Cinema Media, Text, and Lyrics Reference',
      description: 'Stage 15 production-path reference composition using the native text source and mask-compatible output descriptor.',
      tags: ['stage-15', 'text', 'lyrics', 'media'],
      provenance: { builtIn: true, stage: 15 },
    },
    nodes: [
      {
        id: CINEMA_STAGE15_REFERENCE_TEXT_NODE_ID,
        typeId: CINEMA_TEXT_NODE_TYPE_ID,
        typeVersion: 1,
        family: 'text',
        label: 'Stage 15 Reference Text',
        enabled: true,
        opacity: 1,
        parameterValues: {
          [CINEMA_TEXT_CONTENT_PARAMETER_ID]: 'CINEMA · MEDIA · TEXT · LYRICS',
          [CINEMA_TEXT_FONT_SIZE_PARAMETER_ID]: 84,
          [CINEMA_TEXT_COLOR_PARAMETER_ID]: [0.9, 1, 1, 1],
          [CINEMA_TEXT_HIGHLIGHT_COLOR_PARAMETER_ID]: [0.05, 0.9, 0.7, 1],
          [CINEMA_TEXT_MAX_WIDTH_PARAMETER_ID]: 0.86,
        },
      },
      {
        id: CINEMA_STAGE15_REFERENCE_OUTPUT_NODE_ID,
        typeId: outputTypeId,
        typeVersion: 1,
        family: 'output',
        label: 'Cinema Output',
        enabled: true,
        opacity: 1,
        parameterValues: {},
      },
    ],
    connections: [{
      id: connectionId,
      from: { nodeId: CINEMA_STAGE15_REFERENCE_TEXT_NODE_ID, portId: CINEMA_MEDIA_COLOR_OUTPUT_PORT_ID },
      to: { nodeId: CINEMA_STAGE15_REFERENCE_OUTPUT_NODE_ID, portId: outputInputPortId },
      enabled: true,
    }],
    outputNodeId: CINEMA_STAGE15_REFERENCE_OUTPUT_NODE_ID,
    masterParameters: [],
    masterValues: {},
    cameras: [],
    assetBindings: [],
    modulationRoutes: [],
    performanceRules: [],
  })
}

export type CinemaLyricGapBehavior = 'hide' | 'hold-previous' | 'static-fallback'

export interface CinemaLyricDisplaySnapshot {
  readonly text: string
  readonly highlightWord: string | null
  readonly nextPreviousText: string
  readonly nextPreviousWord: string | null
}

/** Pure lyric-content resolver shared by the runtime node and deterministic tests. */
export function resolveCinemaLyricDisplay(input: {
  lyrics: Readonly<CinemaLyricFrame>
  gapBehavior: CinemaLyricGapBehavior
  staticFallback: string
  previousText: string
  previousWord: string | null
}): Readonly<CinemaLyricDisplaySnapshot> {
  const activeText = input.lyrics.lineText?.trim() ?? ''
  if (activeText) {
    return Object.freeze({
      text: activeText,
      highlightWord: input.lyrics.wordText,
      nextPreviousText: activeText,
      nextPreviousWord: input.lyrics.wordText,
    })
  }
  if (input.gapBehavior === 'hold-previous') {
    return Object.freeze({
      text: input.previousText,
      highlightWord: input.previousWord,
      nextPreviousText: input.previousText,
      nextPreviousWord: input.previousWord,
    })
  }
  if (input.gapBehavior === 'static-fallback') {
    return Object.freeze({
      text: input.staticFallback,
      highlightWord: null,
      nextPreviousText: input.previousText,
      nextPreviousWord: input.previousWord,
    })
  }
  return Object.freeze({
    text: '',
    highlightWord: null,
    nextPreviousText: input.previousText,
    nextPreviousWord: input.previousWord,
  })
}

class MediaLayerNode implements CinemaRenderNode {
  readonly nodeId: CinemaNodeId
  readonly typeId: CinemaNodeTypeId
  private program: WebGLProgram | null = null
  private readonly locations = new Map<string, WebGLUniformLocation | null>()
  private readonly reported = new Set<string>()

  constructor(
    private readonly node: Readonly<CinemaNodeDefinition>,
    private readonly acceptedRoles: readonly CinemaAssetRole[],
  ) {
    this.nodeId = node.id
    this.typeId = node.typeId
  }

  initialize(context: CinemaNodeInitializeContext): void {
    this.program = createProgram(context.webgl.gl, FULLSCREEN_VERTEX_SHADER, MEDIA_FRAGMENT_SHADER)
    cacheUniforms(context.webgl.gl, this.program, this.locations, [
      'uTexture', 'uMode', 'uViewportSize', 'uSourceSize', 'uCrop', 'uPosition', 'uScale',
      'uRotation', 'uOpacity', 'uTint', 'uTintAmount', 'uFit',
    ])
  }

  resize(_context: CinemaNodeResizeContext): void {}

  render(context: CinemaNodeRenderContext): void {
    if (!context.target || !this.program) throw new Error('Cinema media node target or program is unavailable.')
    const binding = selectBinding(context.assets, this.acceptedRoles)
    let view: Readonly<CinemaRuntimeAssetView> | null = null
    if (binding) {
      const candidate = context.assetManager.resolve(binding)
      view = candidate.mediaKind === 'video'
        ? context.assetManager.synchronizeVideo?.(binding, context.frame.transport, {
            offsetSec: numberValue(context.values[CINEMA_VIDEO_OFFSET_PARAMETER_ID], 0),
            loop: booleanValue(context.values[CINEMA_VIDEO_LOOP_PARAMETER_ID], true),
            playbackRate: numberValue(context.values[CINEMA_VIDEO_RATE_PARAMETER_ID], 1),
          }) ?? candidate
        : candidate
    }
    if (!binding) this.reportOnce(context, 'binding-missing', 'CINEMA_ASSET_MISSING', 'Cinema media node has no compatible stable asset binding.')
    else if (!view || view.status === 'fallback' || view.status === 'error') {
      this.reportOnce(
        context,
        `asset-${binding.assetId}-${view?.status ?? 'missing'}`,
        view?.status === 'error' ? 'CINEMA_MEDIA_DECODE_FAILED' : 'CINEMA_ASSET_MISSING',
        `Cinema media node could not render asset "${binding.assetId}" and used its declared fallback.`,
      )
    }

    const texture = view?.status === 'ready' ? view.texture : null
    const fallback = enumValue(context.values[CINEMA_MEDIA_FALLBACK_PARAMETER_ID], ENUM_CHECKERBOARD)
    const mode = texture ? 2 : fallback === ENUM_TRANSPARENT ? 0 : 1
    const gl = context.webgl.gl
    context.webgl.bindTarget(context.target)
    context.webgl.resetState()
    gl.useProgram(this.program)
    if (texture) {
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, texture)
      gl.uniform1i(this.locations.get('uTexture') ?? null, 0)
    }
    const sourceWidth = Math.max(1, view?.width ?? context.viewport.width)
    const sourceHeight = Math.max(1, view?.height ?? context.viewport.height)
    const crop = binding?.crop ?? [0, 0, 1, 1]
    const position = binding?.position ?? [0, 0]
    const scale = binding?.scale ?? [1, 1]
    const tint = colorValue(context.values[CINEMA_MEDIA_TINT_COLOR_PARAMETER_ID], [1, 1, 1, 1])
    const opacity = clamp01(
      this.node.opacity
      * (binding?.opacity ?? 1)
      * numberValue(context.values[CINEMA_MEDIA_OPACITY_PARAMETER_ID], 1),
    )
    gl.uniform1i(this.locations.get('uMode') ?? null, mode)
    gl.uniform2f(this.locations.get('uViewportSize') ?? null, context.viewport.width, context.viewport.height)
    gl.uniform2f(this.locations.get('uSourceSize') ?? null, sourceWidth, sourceHeight)
    gl.uniform4f(this.locations.get('uCrop') ?? null, crop[0], crop[1], crop[2], crop[3])
    gl.uniform2f(this.locations.get('uPosition') ?? null, position[0], position[1])
    gl.uniform2f(this.locations.get('uScale') ?? null, Math.max(0.0001, scale[0]), Math.max(0.0001, scale[1]))
    gl.uniform1f(this.locations.get('uRotation') ?? null, binding?.rotationRadians ?? 0)
    gl.uniform1f(this.locations.get('uOpacity') ?? null, opacity)
    gl.uniform4fv(this.locations.get('uTint') ?? null, tint)
    gl.uniform1f(this.locations.get('uTintAmount') ?? null, clamp01(numberValue(context.values[CINEMA_MEDIA_TINT_AMOUNT_PARAMETER_ID], 0)))
    gl.uniform1i(this.locations.get('uFit') ?? null, fitMode(binding?.fit ?? 'contain'))
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    if (texture) gl.bindTexture(gl.TEXTURE_2D, null)
  }

  reset(_context: CinemaNodeResetContext): void {}

  dispose(context: CinemaNodeDisposeContext): void {
    if (this.program) context.webgl.gl.deleteProgram(this.program)
    this.program = null
    this.locations.clear()
    this.reported.clear()
  }

  private reportOnce(
    context: CinemaNodeRenderContext,
    key: string,
    code: 'CINEMA_ASSET_MISSING' | 'CINEMA_MEDIA_DECODE_FAILED',
    message: string,
  ): void {
    if (this.reported.has(key)) return
    this.reported.add(key)
    context.diagnostics.report(createCinemaDiagnostic({
      code,
      severity: 'warning',
      message,
      attribution: { nodeId: this.nodeId, stage: 'media-text-nodes' },
    }))
  }
}

class TextLayerNode implements CinemaRenderNode {
  readonly nodeId: CinemaNodeId
  readonly typeId: CinemaNodeTypeId
  private program: WebGLProgram | null = null
  private texture: WebGLTexture | null = null
  private rasterizer: SharedTextRasterizer | null = null
  private readonly locations = new Map<string, WebGLUniformLocation | null>()
  private lastRasterKey = ''
  private lastLyricText = ''
  private lastLyricWord: string | null = null
  private fontWarningKey = ''

  constructor(
    private readonly node: Readonly<CinemaNodeDefinition>,
    private readonly mode: 'static' | 'lyrics',
  ) {
    this.nodeId = node.id
    this.typeId = node.typeId
  }

  initialize(context: CinemaNodeInitializeContext): void {
    const gl = context.webgl.gl
    this.program = createProgram(gl, FULLSCREEN_VERTEX_SHADER, TEXT_FRAGMENT_SHADER)
    this.texture = gl.createTexture()
    if (!this.texture) throw new Error('Cinema could not allocate a text texture.')
    gl.bindTexture(gl.TEXTURE_2D, this.texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]))
    gl.bindTexture(gl.TEXTURE_2D, null)
    this.rasterizer = getSharedTextRasterizer(gl)
    cacheUniforms(gl, this.program, this.locations, [
      'uTexture', 'uPosition', 'uScale', 'uRotation', 'uOpacity', 'uViewportSize', 'uTextureSize',
    ])
  }

  resize(_context: CinemaNodeResizeContext): void {
    this.lastRasterKey = ''
  }

  render(context: CinemaNodeRenderContext): void {
    if (!context.target || !this.program || !this.texture || !this.rasterizer) {
      throw new Error('Cinema text node resources are unavailable.')
    }
    const resolved = this.resolveContent(context)
    const values = context.values
    const fontFamily = stringValue(values[CINEMA_TEXT_FONT_FAMILY_PARAMETER_ID], 'Inter, Arial, sans-serif')
    const fontSize = numberValue(values[CINEMA_TEXT_FONT_SIZE_PARAMETER_ID], 96)
    const fontWeight = fontWeightValue(values[CINEMA_TEXT_FONT_WEIGHT_PARAMETER_ID])
    const align = alignValue(values[CINEMA_TEXT_ALIGN_PARAMETER_ID])
    const color = colorValue(values[CINEMA_TEXT_COLOR_PARAMETER_ID], [1, 1, 1, 1])
    const highlight = colorValue(values[CINEMA_TEXT_HIGHLIGHT_COLOR_PARAMETER_ID], [0.05, 0.85, 0.75, 1])
    const maxWidth = clamp(numberValue(values[CINEMA_TEXT_MAX_WIDTH_PARAMETER_ID], 0.9), 0.1, 1)
    const lineHeight = clamp(numberValue(values[CINEMA_TEXT_LINE_HEIGHT_PARAMETER_ID], 1.15), 0.8, 2.5)
    const rasterKey = [
      resolved.text,
      resolved.highlightWord ?? '',
      fontFamily,
      fontSize,
      fontWeight,
      align,
      color.join(','),
      highlight.join(','),
      maxWidth,
      lineHeight,
      context.viewport.width,
      context.viewport.height,
    ].join('|')

    if (rasterKey !== this.lastRasterKey) {
      const fontAvailable = fontIsAvailable(fontFamily, fontSize)
      const effectiveFamily = fontAvailable ? fontFamily : 'Arial, sans-serif'
      if (!fontAvailable && this.fontWarningKey !== fontFamily) {
        this.fontWarningKey = fontFamily
        context.diagnostics.report(createCinemaDiagnostic({
          code: 'CINEMA_FONT_UNAVAILABLE',
          severity: 'warning',
          message: `Cinema font "${fontFamily}" is unavailable; the system-font fallback is active.`,
          attribution: { nodeId: this.nodeId, stage: 'media-text-nodes' },
        }))
      }
      const raster = this.rasterizer.rasterize({
        text: resolved.text,
        highlightWord: resolved.highlightWord,
        viewportWidth: context.viewport.width,
        viewportHeight: context.viewport.height,
        fontFamily: effectiveFamily,
        fontSize,
        fontWeight,
        align,
        color,
        highlightColor: highlight,
        maxWidth,
        lineHeight,
      })
      const gl = context.webgl.gl
      gl.bindTexture(gl.TEXTURE_2D, this.texture)
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, raster.canvas)
      gl.bindTexture(gl.TEXTURE_2D, null)
      this.lastRasterKey = rasterKey
    }

    const gl = context.webgl.gl
    context.webgl.bindTarget(context.target)
    context.webgl.resetState()
    gl.useProgram(this.program)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.texture)
    gl.uniform1i(this.locations.get('uTexture') ?? null, 0)
    const position = vector2Value(values[CINEMA_TEXT_POSITION_PARAMETER_ID], [0, 0])
    const kinetic = clamp01(numberValue(values[CINEMA_TEXT_KINETIC_PARAMETER_ID], 0))
    const pulse = this.mode === 'lyrics'
      ? 1 + Math.sin(clamp01(context.frame.lyrics.wordProgress) * Math.PI) * kinetic * 0.08
      : 1
    const scale = Math.max(0.001, numberValue(values[CINEMA_TEXT_SCALE_PARAMETER_ID], 1) * pulse)
    const opacity = clamp01(this.node.opacity * numberValue(values[CINEMA_TEXT_OPACITY_PARAMETER_ID], 1))
    gl.uniform2f(this.locations.get('uPosition') ?? null, position[0], position[1])
    gl.uniform2f(this.locations.get('uScale') ?? null, scale, scale)
    gl.uniform1f(this.locations.get('uRotation') ?? null, numberValue(values[CINEMA_TEXT_ROTATION_PARAMETER_ID], 0))
    gl.uniform1f(this.locations.get('uOpacity') ?? null, opacity)
    gl.uniform2f(this.locations.get('uViewportSize') ?? null, context.viewport.width, context.viewport.height)
    gl.uniform2f(this.locations.get('uTextureSize') ?? null, this.rasterizer.width, this.rasterizer.height)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    gl.bindTexture(gl.TEXTURE_2D, null)
  }

  reset(context: CinemaNodeResetContext): void {
    if (context.actionId === 'cinema.reset.track-change' || context.actionId === 'cinema.reset.activation') {
      this.lastLyricText = ''
      this.lastLyricWord = null
      this.lastRasterKey = ''
    }
  }

  dispose(context: CinemaNodeDisposeContext): void {
    const gl = context.webgl.gl
    if (this.program) gl.deleteProgram(this.program)
    if (this.texture) gl.deleteTexture(this.texture)
    this.program = null
    this.texture = null
    this.rasterizer = null
    this.locations.clear()
  }

  private resolveContent(context: CinemaNodeRenderContext): { text: string; highlightWord: string | null } {
    if (this.mode === 'static') {
      return {
        text: stringValue(context.values[CINEMA_TEXT_CONTENT_PARAMETER_ID], ''),
        highlightWord: null,
      }
    }
    const fallback = enumValue(context.values[CINEMA_TEXT_FALLBACK_PARAMETER_ID], ENUM_HIDE)
    const resolved = resolveCinemaLyricDisplay({
      lyrics: context.frame.lyrics,
      gapBehavior: fallback === ENUM_HOLD_PREVIOUS
        ? 'hold-previous'
        : fallback === ENUM_STATIC_FALLBACK
          ? 'static-fallback'
          : 'hide',
      staticFallback: stringValue(context.values[CINEMA_TEXT_FALLBACK_CONTENT_PARAMETER_ID], ''),
      previousText: this.lastLyricText,
      previousWord: this.lastLyricWord,
    })
    this.lastLyricText = resolved.nextPreviousText
    this.lastLyricWord = resolved.nextPreviousWord
    return { text: resolved.text, highlightWord: resolved.highlightWord }
  }
}

class GeneratedMaskNode implements CinemaRenderNode {
  readonly nodeId: CinemaNodeId
  readonly typeId = CINEMA_GENERATED_MASK_NODE_TYPE_ID
  private program: WebGLProgram | null = null
  private readonly locations = new Map<string, WebGLUniformLocation | null>()

  constructor(private readonly node: Readonly<CinemaNodeDefinition>) {
    this.nodeId = node.id
  }

  initialize(context: CinemaNodeInitializeContext): void {
    this.program = createProgram(context.webgl.gl, FULLSCREEN_VERTEX_SHADER, MASK_FRAGMENT_SHADER)
    cacheUniforms(context.webgl.gl, this.program, this.locations, [
      'uShape', 'uFeather', 'uInvert', 'uPosition', 'uScale', 'uRotation', 'uOpacity',
    ])
  }

  resize(_context: CinemaNodeResizeContext): void {}

  render(context: CinemaNodeRenderContext): void {
    if (!context.target || !this.program) throw new Error('Cinema generated-mask target or program is unavailable.')
    const gl = context.webgl.gl
    context.webgl.bindTarget(context.target)
    context.webgl.resetState()
    gl.useProgram(this.program)
    const shape = enumValue(context.values[CINEMA_MASK_SHAPE_PARAMETER_ID], ENUM_RECTANGLE)
    const position = vector2Value(context.values[CINEMA_MASK_POSITION_PARAMETER_ID], [0, 0])
    const scale = vector2Value(context.values[CINEMA_MASK_SCALE_PARAMETER_ID], [0.75, 0.75])
    gl.uniform1i(this.locations.get('uShape') ?? null, shape === ENUM_CIRCLE ? 1 : shape === ENUM_DIAMOND ? 2 : 0)
    gl.uniform1f(this.locations.get('uFeather') ?? null, clamp(numberValue(context.values[CINEMA_MASK_FEATHER_PARAMETER_ID], 0.02), 0, 0.5))
    gl.uniform1i(this.locations.get('uInvert') ?? null, booleanValue(context.values[CINEMA_MASK_INVERT_PARAMETER_ID], false) ? 1 : 0)
    gl.uniform2f(this.locations.get('uPosition') ?? null, position[0], position[1])
    gl.uniform2f(this.locations.get('uScale') ?? null, Math.max(0.001, scale[0]), Math.max(0.001, scale[1]))
    gl.uniform1f(this.locations.get('uRotation') ?? null, numberValue(context.values[CINEMA_MASK_ROTATION_PARAMETER_ID], 0))
    gl.uniform1f(this.locations.get('uOpacity') ?? null, clamp01(this.node.opacity * numberValue(context.values[CINEMA_MASK_OPACITY_PARAMETER_ID], 1)))
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  reset(_context: CinemaNodeResetContext): void {}

  dispose(context: CinemaNodeDisposeContext): void {
    if (this.program) context.webgl.gl.deleteProgram(this.program)
    this.program = null
    this.locations.clear()
  }
}

interface TextRasterInput {
  text: string
  highlightWord: string | null
  viewportWidth: number
  viewportHeight: number
  fontFamily: string
  fontSize: number
  fontWeight: number
  align: CanvasTextAlign
  color: Float32Array
  highlightColor: Float32Array
  maxWidth: number
  lineHeight: number
}

class SharedTextRasterizer {
  readonly canvas: HTMLCanvasElement
  readonly context: CanvasRenderingContext2D
  width = 1
  height = 1

  constructor() {
    if (typeof document === 'undefined') throw new Error('Cinema shared text rasterizer requires a browser document.')
    this.canvas = document.createElement('canvas')
    const context = this.canvas.getContext('2d', { alpha: true })
    if (!context) throw new Error('Cinema could not create the shared Canvas2D text rasterizer.')
    this.context = context
  }

  rasterize(input: TextRasterInput): { canvas: HTMLCanvasElement } {
    const width = Math.max(64, Math.min(2048, Math.ceil(input.viewportWidth)))
    const height = Math.max(64, Math.min(1024, Math.ceil(input.viewportHeight)))
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width
      this.canvas.height = height
    }
    this.width = width
    this.height = height
    const context = this.context
    context.clearRect(0, 0, width, height)
    context.textBaseline = 'middle'
    context.textAlign = input.align
    context.font = `${input.fontWeight} ${Math.max(8, input.fontSize)}px ${input.fontFamily}`
    const maximumLineWidth = Math.max(1, width * input.maxWidth)
    const paragraphs = input.text.split(/\r?\n/)
    const lines: string[] = []
    for (const paragraph of paragraphs) lines.push(...wrapText(context, paragraph, maximumLineWidth))
    const lineHeightPx = input.fontSize * input.lineHeight
    const totalHeight = Math.max(lineHeightPx, lines.length * lineHeightPx)
    let y = height / 2 - totalHeight / 2 + lineHeightPx / 2
    const x = input.align === 'left'
      ? (width - maximumLineWidth) / 2
      : input.align === 'right'
        ? (width + maximumLineWidth) / 2
        : width / 2
    for (const line of lines.length > 0 ? lines : ['']) {
      drawHighlightedLine(context, line, input.highlightWord, x, y, input.align, input.color, input.highlightColor)
      y += lineHeightPx
    }
    return { canvas: this.canvas }
  }
}

const SHARED_TEXT_RASTERIZERS = new WeakMap<WebGL2RenderingContext, SharedTextRasterizer>()

function getSharedTextRasterizer(gl: WebGL2RenderingContext): SharedTextRasterizer {
  const existing = SHARED_TEXT_RASTERIZERS.get(gl)
  if (existing) return existing
  const created = new SharedTextRasterizer()
  SHARED_TEXT_RASTERIZERS.set(gl, created)
  return created
}

function wrapText(context: CanvasRenderingContext2D, text: string, maximumWidth: number): string[] {
  if (!text) return ['']
  const words = text.trim().split(/\s+/)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (current && context.measureText(candidate).width > maximumWidth) {
      lines.push(current)
      current = word
    } else {
      current = candidate
    }
  }
  if (current || lines.length === 0) lines.push(current)
  return lines
}

function drawHighlightedLine(
  context: CanvasRenderingContext2D,
  line: string,
  highlightWord: string | null,
  x: number,
  y: number,
  align: CanvasTextAlign,
  color: Float32Array,
  highlightColor: Float32Array,
): void {
  const tokens = line.split(/(\s+)/)
  const widths = tokens.map(token => context.measureText(token).width)
  const totalWidth = widths.reduce((sum, width) => sum + width, 0)
  let cursor = align === 'center' ? x - totalWidth / 2 : align === 'right' ? x - totalWidth : x
  const normalizedHighlight = highlightWord?.trim().toLowerCase() ?? ''
  context.textAlign = 'left'
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]
    const normalized = token.trim().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '').toLowerCase()
    context.fillStyle = rgbaCss(normalizedHighlight && normalized === normalizedHighlight ? highlightColor : color)
    context.fillText(token, cursor, y)
    cursor += widths[index]
  }
  context.textAlign = align
}

function fontIsAvailable(fontFamily: string, fontSize: number): boolean {
  if (typeof document === 'undefined' || !document.fonts?.check) return true
  try { return document.fonts.check(`${Math.max(8, fontSize)}px ${fontFamily}`) } catch { return false }
}

function rgbaCss(color: Float32Array): string {
  return `rgba(${Math.round(color[0] * 255)}, ${Math.round(color[1] * 255)}, ${Math.round(color[2] * 255)}, ${clamp01(color[3])})`
}

function selectBinding(
  bindings: readonly Readonly<CinemaAssetBindingDefinition>[],
  acceptedRoles: readonly CinemaAssetRole[],
): Readonly<CinemaAssetBindingDefinition> | null {
  return bindings.find(binding => acceptedRoles.includes(binding.role)) ?? null
}

function persisted(
  definition: Readonly<CinemaNodeTypeDefinition>,
  rendererPluginId: CinemaRendererPluginId,
  sourceId: string,
): CinemaPersistedDefinition {
  return {
    id: definition.typeId,
    definition,
    rendererPluginId,
    source: { kind: 'built-in', id: sourceId },
    quality: {
      minimumTier: 'low',
      maximumTier: 'ultra',
      adaptive: false,
      maximumEstimatedPassCount: 1,
      maximumPersistentTargetCount: 0,
      maximumPingPongPairCount: 0,
    },
  }
}

function runtime(
  pluginIdValue: CinemaRendererPluginId,
  definition: Readonly<CinemaNodeTypeDefinition>,
  factory: (node: Readonly<CinemaNodeDefinition>) => CinemaRenderNode,
) {
  const plugin: CinemaNodePlugin = Object.freeze({ definition, createNode: factory })
  return Object.freeze({ pluginId: pluginIdValue, plugin })
}

function nodeTypeId(value: string): CinemaNodeTypeId {
  return cinemaNamespacedId<CinemaNodeTypeId>(value, 'node type')
}

function pluginId(value: string): CinemaRendererPluginId {
  return cinemaNamespacedId<CinemaRendererPluginId>(value, 'renderer plugin')
}

function parameterId(value: string): CinemaParameterId {
  return cinemaStableId<CinemaParameterId>(value, 'parameter')
}

function portId(value: string): CinemaPortId {
  return cinemaStableId<CinemaPortId>(value, 'port')
}

function createProgram(gl: WebGL2RenderingContext, vertexSource: string, fragmentSource: string): WebGLProgram {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, vertexSource)
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource)
  const program = gl.createProgram()
  if (!program) {
    gl.deleteShader(vertex)
    gl.deleteShader(fragment)
    throw new Error('Cinema could not allocate a media/text WebGL program.')
  }
  gl.attachShader(program, vertex)
  gl.attachShader(program, fragment)
  gl.linkProgram(program)
  gl.deleteShader(vertex)
  gl.deleteShader(fragment)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) || 'Unknown Cinema media/text program link failure.'
    gl.deleteProgram(program)
    throw new Error(message)
  }
  return program
}

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)
  if (!shader) throw new Error('Cinema could not allocate a media/text shader.')
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) || 'Unknown Cinema media/text shader compile failure.'
    gl.deleteShader(shader)
    throw new Error(message)
  }
  return shader
}

function cacheUniforms(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  locations: Map<string, WebGLUniformLocation | null>,
  names: readonly string[],
): void {
  for (const name of names) locations.set(name, gl.getUniformLocation(program, name))
}

function fitMode(value: CinemaAssetBindingDefinition['fit']): number {
  switch (value) {
    case 'cover': return 1
    case 'stretch': return 2
    case 'none': return 3
    case 'contain': return 0
  }
}

function numberValue(value: CinemaParameterValue | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function stringValue(value: CinemaParameterValue | undefined, fallback: string): string {
  return typeof value === 'string' ? value : fallback
}

function booleanValue(value: CinemaParameterValue | undefined, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function enumValue(value: CinemaParameterValue | undefined, fallback: string): string {
  return typeof value === 'string' ? value : fallback
}

function vector2Value(value: CinemaParameterValue | undefined, fallback: CinemaVector2): CinemaVector2 {
  return Array.isArray(value) && value.length === 2 && value.every(component => typeof component === 'number' && Number.isFinite(component))
    ? [Number(value[0]), Number(value[1])]
    : fallback
}

function colorValue(value: CinemaParameterValue | undefined, fallback: CinemaColor): Float32Array {
  if (!Array.isArray(value) || value.length !== 4 || value.some(component => typeof component !== 'number' || !Number.isFinite(component))) {
    return new Float32Array(fallback)
  }
  return new Float32Array(value.map(component => clamp01(Number(component))))
}

function fontWeightValue(value: CinemaParameterValue | undefined): number {
  const id = enumValue(value, ENUM_BOLD)
  if (id === ENUM_REGULAR) return 400
  if (id === ENUM_MEDIUM) return 500
  if (id === ENUM_BLACK) return 900
  return 700
}

function alignValue(value: CinemaParameterValue | undefined): CanvasTextAlign {
  const id = enumValue(value, ENUM_CENTER)
  if (id === ENUM_LEFT) return 'left'
  if (id === ENUM_RIGHT) return 'right'
  return 'center'
}

function clamp01(value: number): number {
  return clamp(value, 0, 1)
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Number.isFinite(value) ? Math.min(maximum, Math.max(minimum, value)) : minimum
}

function deepFreeze<Value>(value: Value): Value {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested)
  }
  return value
}

const FULLSCREEN_VERTEX_SHADER = `#version 300 es
precision highp float;
out vec2 vUv;
void main() {
  vec2 position = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = position;
  gl_Position = vec4(position * 2.0 - 1.0, 0.0, 1.0);
}`

const MEDIA_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uTexture;
uniform int uMode;
uniform vec2 uViewportSize;
uniform vec2 uSourceSize;
uniform vec4 uCrop;
uniform vec2 uPosition;
uniform vec2 uScale;
uniform float uRotation;
uniform float uOpacity;
uniform vec4 uTint;
uniform float uTintAmount;
uniform int uFit;
out vec4 outColor;
void main() {
  if (uMode == 0) { outColor = vec4(0.0); return; }
  if (uMode == 1) {
    vec2 cell = floor(vUv * 16.0);
    float shade = mod(cell.x + cell.y, 2.0) < 1.0 ? 0.18 : 0.28;
    float alpha = clamp(uOpacity, 0.0, 1.0);
    outColor = vec4(vec3(shade) * alpha, alpha);
    return;
  }
  vec2 local = vUv - 0.5 - uPosition * 0.5;
  float c = cos(-uRotation);
  float s = sin(-uRotation);
  local = mat2(c, -s, s, c) * local;
  local /= max(uScale, vec2(0.0001));
  float sourceAspect = max(0.0001, (uSourceSize.x * (uCrop.z - uCrop.x)) / max(1.0, uSourceSize.y * (uCrop.w - uCrop.y)));
  float viewportAspect = max(0.0001, uViewportSize.x / max(1.0, uViewportSize.y));
  vec2 contentSize = vec2(1.0);
  if (uFit == 0 || uFit == 3) {
    contentSize = sourceAspect > viewportAspect
      ? vec2(1.0, viewportAspect / sourceAspect)
      : vec2(sourceAspect / viewportAspect, 1.0);
  } else if (uFit == 1) {
    contentSize = sourceAspect > viewportAspect
      ? vec2(sourceAspect / viewportAspect, 1.0)
      : vec2(1.0, viewportAspect / sourceAspect);
  }
  vec2 sourceUv = local / contentSize + 0.5;
  if (uFit != 1 && (sourceUv.x < 0.0 || sourceUv.x > 1.0 || sourceUv.y < 0.0 || sourceUv.y > 1.0)) {
    outColor = vec4(0.0);
    return;
  }
  sourceUv = clamp(sourceUv, 0.0, 1.0);
  sourceUv = mix(uCrop.xy, uCrop.zw, sourceUv);
  vec4 sampled = texture(uTexture, sourceUv);
  float alpha = clamp(sampled.a * uOpacity, 0.0, 1.0);
  vec3 tinted = mix(sampled.rgb, uTint.rgb * sampled.a, clamp(uTintAmount, 0.0, 1.0));
  outColor = vec4(tinted * uOpacity, alpha);
}`

const TEXT_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uTexture;
uniform vec2 uPosition;
uniform vec2 uScale;
uniform float uRotation;
uniform float uOpacity;
uniform vec2 uViewportSize;
uniform vec2 uTextureSize;
layout(location = 0) out vec4 outColor;
layout(location = 1) out float outMask;
void main() {
  vec2 local = vUv - 0.5 - uPosition * 0.5;
  float c = cos(-uRotation);
  float s = sin(-uRotation);
  local = mat2(c, -s, s, c) * local;
  local /= max(uScale, vec2(0.0001));
  float textureAspect = max(0.0001, uTextureSize.x / max(1.0, uTextureSize.y));
  float viewportAspect = max(0.0001, uViewportSize.x / max(1.0, uViewportSize.y));
  vec2 contentSize = textureAspect > viewportAspect
    ? vec2(1.0, viewportAspect / textureAspect)
    : vec2(textureAspect / viewportAspect, 1.0);
  vec2 uv = local / contentSize + 0.5;
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
    outColor = vec4(0.0);
    outMask = 0.0;
    return;
  }
  vec4 sampled = texture(uTexture, uv);
  float alpha = clamp(sampled.a * uOpacity, 0.0, 1.0);
  outColor = vec4(sampled.rgb * uOpacity, alpha);
  outMask = alpha;
}`

const MASK_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec2 vUv;
uniform int uShape;
uniform float uFeather;
uniform int uInvert;
uniform vec2 uPosition;
uniform vec2 uScale;
uniform float uRotation;
uniform float uOpacity;
layout(location = 0) out vec4 outColor;
layout(location = 1) out float outMask;
void main() {
  vec2 local = vUv - 0.5 - uPosition * 0.5;
  float c = cos(-uRotation);
  float s = sin(-uRotation);
  local = mat2(c, -s, s, c) * local;
  local /= max(uScale * 0.5, vec2(0.0001));
  float distanceValue;
  if (uShape == 1) distanceValue = length(local) - 1.0;
  else if (uShape == 2) distanceValue = abs(local.x) + abs(local.y) - 1.0;
  else distanceValue = max(abs(local.x), abs(local.y)) - 1.0;
  float mask = 1.0 - smoothstep(-max(0.0001, uFeather), max(0.0001, uFeather), distanceValue);
  if (uInvert == 1) mask = 1.0 - mask;
  mask *= clamp(uOpacity, 0.0, 1.0);
  outColor = vec4(vec3(mask), mask);
  outMask = mask;
}`
