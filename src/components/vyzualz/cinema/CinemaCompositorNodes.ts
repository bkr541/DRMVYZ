import {
  type CinemaNodeDefinition,
  type CinemaParameterDefinition,
  type CinemaParameterValue,
} from './CinemaDomain'
import {
  cinemaNamespacedId,
  cinemaStableId,
  type CinemaEnumOptionId,
  type CinemaNodeId,
  type CinemaNodeTypeId,
  type CinemaParameterId,
  type CinemaPortId,
  type CinemaRendererPluginId,
} from './CinemaIdentifiers'
import type { CinemaPersistedDefinition } from './CinemaPersistence'
import type {
  CinemaAlphaMode,
  CinemaColorSpace,
  CinemaNodeDisposeContext,
  CinemaNodeInitializeContext,
  CinemaNodePlugin,
  CinemaNodeRenderContext,
  CinemaNodeResetContext,
  CinemaNodeResizeContext,
  CinemaNodeTypeDefinition,
  CinemaParameterCapabilityDescriptor,
  CinemaRenderNode,
  CinemaTextureView,
} from './CinemaRendererContracts'
import { createCinemaParameterCapabilities } from './CinemaParameterCapabilities'
import { CINEMATIC_POST_PROCESS_CONSTANTS } from '../shared/CinematicPostProcessPasses'
import {
  CinemaCompositionTransitionClock,
  type CinemaCompositorBlendMode,
} from './CinemaCompositorMath'

export const CINEMA_COMPOSITOR_COLOR_OUTPUT_PORT_ID = portId('color')
export const CINEMA_COMPOSITOR_BACKGROUND_INPUT_PORT_ID = portId('background')
export const CINEMA_COMPOSITOR_FOREGROUND_INPUT_PORT_ID = portId('foreground')
export const CINEMA_COMPOSITOR_MASK_INPUT_PORT_ID = portId('mask')
export const CINEMA_COMPOSITOR_EFFECT_INPUT_PORT_ID = portId('input')
export const CINEMA_COMPOSITOR_AUXILIARY_INPUT_PORT_ID = portId('auxiliary')
export const CINEMA_COMPOSITOR_HISTORY_INPUT_PORT_ID = portId('history')
export const CINEMA_COMPOSITOR_TRANSITION_FROM_INPUT_PORT_ID = portId('from')
export const CINEMA_COMPOSITOR_TRANSITION_TO_INPUT_PORT_ID = portId('to')

export const CINEMA_COMPOSITOR_OPACITY_PARAMETER_ID = parameterId('compositor-opacity')
export const CINEMA_COMPOSITOR_MASK_MODE_PARAMETER_ID = parameterId('mask-mode')
export const CINEMA_COMPOSITOR_MASK_INVERT_PARAMETER_ID = parameterId('mask-invert')
export const CINEMA_COMPOSITOR_AMOUNT_PARAMETER_ID = parameterId('effect-amount')
export const CINEMA_COMPOSITOR_SECONDARY_PARAMETER_ID = parameterId('effect-secondary')
export const CINEMA_COMPOSITOR_SCALE_PARAMETER_ID = parameterId('effect-scale')
export const CINEMA_COMPOSITOR_OFFSET_PARAMETER_ID = parameterId('effect-offset')
export const CINEMA_COMPOSITOR_EXPOSURE_PARAMETER_ID = parameterId('effect-exposure')
export const CINEMA_COMPOSITOR_CONTRAST_PARAMETER_ID = parameterId('effect-contrast')
export const CINEMA_COMPOSITOR_SATURATION_PARAMETER_ID = parameterId('effect-saturation')
export const CINEMA_COMPOSITOR_HUE_PARAMETER_ID = parameterId('effect-hue')
export const CINEMA_COMPOSITOR_TRANSITION_KIND_PARAMETER_ID = parameterId('transition-kind')
export const CINEMA_COMPOSITOR_TRANSITION_PROGRESS_PARAMETER_ID = parameterId('transition-progress')
export const CINEMA_COMPOSITOR_TRANSITION_AUTOMATIC_PARAMETER_ID = parameterId('transition-automatic')
export const CINEMA_COMPOSITOR_TRANSITION_TOKEN_PARAMETER_ID = parameterId('transition-token')
export const CINEMA_COMPOSITOR_TRANSITION_DURATION_PARAMETER_ID = parameterId('transition-duration')
export const CINEMA_COMPOSITOR_TRANSITION_SOFTNESS_PARAMETER_ID = parameterId('transition-softness')

const MASK_ALPHA = enumId('alpha')
const MASK_LUMINANCE = enumId('luminance')
const TRANSITION_CROSSFADE = enumId('crossfade')
const TRANSITION_WIPE = enumId('wipe')
const TRANSITION_RADIAL = enumId('radial')
const TRANSITION_DISSOLVE = enumId('dissolve')
const TRANSITION_SLIDE = enumId('slide')
const TRANSITION_ZOOM = enumId('zoom')

const LINEAR_PREMULTIPLIED_OUTPUT = deepFreeze({
  colorSpace: 'linear-srgb' as const,
  alphaMode: 'premultiplied' as const,
  colorFormat: 'rgba8' as const,
  hasDepth: false,
  hasMask: false,
})

const WEBGL_CAPABILITIES = deepFreeze({
  backends: ['webgl2'] as const,
  canvas2d: { compatibility: 'unsupported' as const, preservesPremultipliedAlpha: true },
  camera: { mode: 'none' as const, controls: [] as const, autoDirector: false },
  requires: { webgl2: true },
  fallbacks: [{
    capability: 'webgl2' as const,
    behavior: 'safe-output' as const,
    message: 'Cinema compositing requires the single Cinema-owned WebGL2 runtime.',
  }],
})

const COLOR_OUTPUT_PORT = deepFreeze({
  id: CINEMA_COMPOSITOR_COLOR_OUTPUT_PORT_ID,
  label: 'Color',
  direction: 'output' as const,
  dataType: 'color-texture' as const,
})

const BACKGROUND_INPUT_PORT = deepFreeze({
  id: CINEMA_COMPOSITOR_BACKGROUND_INPUT_PORT_ID,
  label: 'Background',
  direction: 'input' as const,
  dataType: 'color-texture' as const,
  cardinality: 'one' as const,
  required: false,
})

const FOREGROUND_INPUT_PORT = deepFreeze({
  id: CINEMA_COMPOSITOR_FOREGROUND_INPUT_PORT_ID,
  label: 'Foreground',
  direction: 'input' as const,
  dataType: 'color-texture' as const,
  cardinality: 'one' as const,
  required: false,
})

const MASK_INPUT_PORT = deepFreeze({
  id: CINEMA_COMPOSITOR_MASK_INPUT_PORT_ID,
  label: 'Mask',
  direction: 'input' as const,
  dataType: 'mask-texture' as const,
  accepts: ['color-texture'] as const,
  cardinality: 'one' as const,
  required: false,
})

const EFFECT_INPUT_PORT = deepFreeze({
  id: CINEMA_COMPOSITOR_EFFECT_INPUT_PORT_ID,
  label: 'Input',
  direction: 'input' as const,
  dataType: 'color-texture' as const,
  cardinality: 'one' as const,
  required: true,
})

const AUXILIARY_INPUT_PORT = deepFreeze({
  id: CINEMA_COMPOSITOR_AUXILIARY_INPUT_PORT_ID,
  label: 'Auxiliary',
  direction: 'input' as const,
  dataType: 'color-texture' as const,
  accepts: ['mask-texture'] as const,
  cardinality: 'one' as const,
  required: false,
})

const HISTORY_INPUT_PORT = deepFreeze({
  id: CINEMA_COMPOSITOR_HISTORY_INPUT_PORT_ID,
  label: 'History',
  direction: 'input' as const,
  dataType: 'color-texture' as const,
  cardinality: 'one' as const,
  required: false,
})

const TRANSITION_FROM_INPUT_PORT = deepFreeze({
  id: CINEMA_COMPOSITOR_TRANSITION_FROM_INPUT_PORT_ID,
  label: 'From Composition',
  direction: 'input' as const,
  dataType: 'color-texture' as const,
  cardinality: 'one' as const,
  required: false,
})

const TRANSITION_TO_INPUT_PORT = deepFreeze({
  id: CINEMA_COMPOSITOR_TRANSITION_TO_INPUT_PORT_ID,
  label: 'To Composition',
  direction: 'input' as const,
  dataType: 'color-texture' as const,
  cardinality: 'one' as const,
  required: false,
})

const OPACITY_PARAMETER: CinemaParameterDefinition = deepFreeze({
  id: CINEMA_COMPOSITOR_OPACITY_PARAMETER_ID,
  label: 'Opacity',
  type: 'float',
  default: 1,
  min: 0,
  max: 1,
  step: 0.01,
  modulatable: true,
  ui: { control: 'slider', order: 0 },
})

const EFFECT_PARAMETERS: readonly CinemaParameterDefinition[] = deepFreeze([
  {
    id: CINEMA_COMPOSITOR_AMOUNT_PARAMETER_ID,
    label: 'Amount',
    type: 'float',
    default: 0.5,
    min: 0,
    max: 1,
    step: 0.01,
    modulatable: true,
    ui: { control: 'slider', order: 0 },
  },
  {
    id: CINEMA_COMPOSITOR_SECONDARY_PARAMETER_ID,
    label: 'Secondary',
    type: 'float',
    default: 0.5,
    min: 0,
    max: 1,
    step: 0.01,
    modulatable: true,
    ui: { control: 'slider', order: 1 },
  },
  {
    id: CINEMA_COMPOSITOR_SCALE_PARAMETER_ID,
    label: 'Scale',
    type: 'float',
    default: 1,
    min: 0.01,
    max: 128,
    step: 0.01,
    modulatable: true,
    ui: { control: 'slider', order: 2 },
  },
  {
    id: CINEMA_COMPOSITOR_OFFSET_PARAMETER_ID,
    label: 'Offset',
    type: 'float',
    default: 0,
    min: -4,
    max: 4,
    step: 0.001,
    modulatable: true,
    ui: { control: 'slider', order: 3 },
  },
  {
    id: CINEMA_COMPOSITOR_EXPOSURE_PARAMETER_ID,
    label: 'Exposure',
    type: 'float',
    default: 1,
    min: 0,
    max: 8,
    step: 0.01,
    modulatable: true,
    ui: { control: 'slider', order: 4 },
  },
  {
    id: CINEMA_COMPOSITOR_CONTRAST_PARAMETER_ID,
    label: 'Contrast',
    type: 'float',
    default: 1,
    min: 0,
    max: 4,
    step: 0.01,
    modulatable: true,
    ui: { control: 'slider', order: 5 },
  },
  {
    id: CINEMA_COMPOSITOR_SATURATION_PARAMETER_ID,
    label: 'Saturation',
    type: 'float',
    default: 1,
    min: 0,
    max: 4,
    step: 0.01,
    modulatable: true,
    ui: { control: 'slider', order: 6 },
  },
  {
    id: CINEMA_COMPOSITOR_HUE_PARAMETER_ID,
    label: 'Hue',
    type: 'float',
    default: 0,
    min: -Math.PI,
    max: Math.PI,
    step: 0.001,
    unit: 'radians',
    modulatable: true,
    ui: { control: 'slider', order: 7 },
  },
])

export const CINEMA_BLEND_NODE_TYPE_IDS: Readonly<Record<CinemaCompositorBlendMode, CinemaNodeTypeId>> = deepFreeze({
  normal: nodeTypeId('drmvyz.cinema.mixer.normal'),
  add: nodeTypeId('drmvyz.cinema.mixer.add'),
  screen: nodeTypeId('drmvyz.cinema.mixer.screen'),
  multiply: nodeTypeId('drmvyz.cinema.mixer.multiply'),
  lighten: nodeTypeId('drmvyz.cinema.mixer.lighten'),
  darken: nodeTypeId('drmvyz.cinema.mixer.darken'),
  difference: nodeTypeId('drmvyz.cinema.mixer.difference'),
  overlay: nodeTypeId('drmvyz.cinema.mixer.overlay'),
})

export const CINEMA_MASKED_COMPOSITE_NODE_TYPE_ID = nodeTypeId('drmvyz.cinema.mixer.masked-composite')

export type CinemaEffectKind =
  | 'bloom'
  | 'blur'
  | 'feedback'
  | 'refraction'
  | 'pixelation'
  | 'chromatic-aberration'
  | 'color-grading'
  | 'kaleidoscope'
  | 'edge-detection'
  | 'strobe'
  | 'grain'
  | 'vignette'
  | 'tone-mapping'

export const CINEMA_EFFECT_NODE_TYPE_IDS: Readonly<Record<CinemaEffectKind, CinemaNodeTypeId>> = deepFreeze({
  bloom: nodeTypeId('drmvyz.cinema.effect.bloom'),
  blur: nodeTypeId('drmvyz.cinema.effect.blur'),
  feedback: nodeTypeId('drmvyz.cinema.effect.feedback'),
  refraction: nodeTypeId('drmvyz.cinema.effect.refraction-displacement'),
  pixelation: nodeTypeId('drmvyz.cinema.effect.pixelation'),
  'chromatic-aberration': nodeTypeId('drmvyz.cinema.effect.chromatic-aberration'),
  'color-grading': nodeTypeId('drmvyz.cinema.effect.color-grading'),
  kaleidoscope: nodeTypeId('drmvyz.cinema.effect.kaleidoscope'),
  'edge-detection': nodeTypeId('drmvyz.cinema.effect.edge-detection'),
  strobe: nodeTypeId('drmvyz.cinema.effect.strobe'),
  grain: nodeTypeId('drmvyz.cinema.effect.grain'),
  vignette: nodeTypeId('drmvyz.cinema.effect.vignette'),
  'tone-mapping': nodeTypeId('drmvyz.cinema.effect.tone-mapping'),
})

export const CINEMA_TRANSITION_NODE_TYPE_ID = nodeTypeId('drmvyz.cinema.transition.composition')

const BLEND_LABELS: Readonly<Record<CinemaCompositorBlendMode, string>> = {
  normal: 'Normal Alpha Mixer',
  add: 'Add Mixer',
  screen: 'Screen Mixer',
  multiply: 'Multiply Mixer',
  lighten: 'Lighten Mixer',
  darken: 'Darken Mixer',
  difference: 'Difference Mixer',
  overlay: 'Overlay Mixer',
}

const EFFECT_LABELS: Readonly<Record<CinemaEffectKind, string>> = {
  bloom: 'Bloom',
  blur: 'Blur',
  feedback: 'Feedback',
  refraction: 'Refraction / Displacement',
  pixelation: 'Pixelation',
  'chromatic-aberration': 'Chromatic Aberration',
  'color-grading': 'Color Grading',
  kaleidoscope: 'Kaleidoscope',
  'edge-detection': 'Edge Detection',
  strobe: 'Strobe',
  grain: 'Grain',
  vignette: 'Vignette',
  'tone-mapping': 'Tone Mapping',
}

function blendDefinition(mode: CinemaCompositorBlendMode): Readonly<CinemaNodeTypeDefinition> {
  return deepFreeze({
    typeId: CINEMA_BLEND_NODE_TYPE_IDS[mode],
    version: 1,
    label: BLEND_LABELS[mode],
    description: `${BLEND_LABELS[mode]} using linear-light premultiplied-alpha compositing.`,
    family: 'mixer',
    inputPorts: [BACKGROUND_INPUT_PORT, FOREGROUND_INPUT_PORT],
    outputPorts: [COLOR_OUTPUT_PORT],
    parameters: [OPACITY_PARAMETER],
    parameterCapabilities: createCinemaParameterCapabilities([OPACITY_PARAMETER]),
    capabilities: WEBGL_CAPABILITIES,
    cost: { cpu: 'minimal', gpu: 'low', estimatedPassCount: 1, persistentTargetCount: 0, pingPongPairCount: 0 },
    seekPolicy: { mode: 'stateless' },
    output: LINEAR_PREMULTIPLIED_OUTPUT,
    metadata: { stage: 16, blendMode: mode, premultipliedAlpha: true, colorSpace: 'linear-srgb' },
  })
}

export const CINEMA_BLEND_NODE_DEFINITIONS: Readonly<Record<CinemaCompositorBlendMode, Readonly<CinemaNodeTypeDefinition>>> = deepFreeze({
  normal: blendDefinition('normal'),
  add: blendDefinition('add'),
  screen: blendDefinition('screen'),
  multiply: blendDefinition('multiply'),
  lighten: blendDefinition('lighten'),
  darken: blendDefinition('darken'),
  difference: blendDefinition('difference'),
  overlay: blendDefinition('overlay'),
})

export const CINEMA_MASKED_COMPOSITE_NODE_DEFINITION: Readonly<CinemaNodeTypeDefinition> = deepFreeze({
  typeId: CINEMA_MASKED_COMPOSITE_NODE_TYPE_ID,
  version: 1,
  label: 'Masked Composite',
  description: 'Premultiplied foreground-over-background compositing using deterministic alpha or luminance masks.',
  family: 'mixer',
  inputPorts: [BACKGROUND_INPUT_PORT, FOREGROUND_INPUT_PORT, MASK_INPUT_PORT],
  outputPorts: [COLOR_OUTPUT_PORT],
  parameters: [
    OPACITY_PARAMETER,
    {
      id: CINEMA_COMPOSITOR_MASK_MODE_PARAMETER_ID,
      label: 'Mask Source',
      type: 'enum',
      default: MASK_ALPHA,
      options: [
        { id: MASK_ALPHA, label: 'Alpha' },
        { id: MASK_LUMINANCE, label: 'Luminance' },
      ],
      ui: { control: 'select', order: 1 },
    },
    {
      id: CINEMA_COMPOSITOR_MASK_INVERT_PARAMETER_ID,
      label: 'Invert Mask',
      type: 'boolean',
      default: false,
      ui: { control: 'toggle', order: 2 },
    },
  ],
  parameterCapabilities: [
    { parameterId: CINEMA_COMPOSITOR_OPACITY_PARAMETER_ID, support: 'live' },
    { parameterId: CINEMA_COMPOSITOR_MASK_MODE_PARAMETER_ID, support: 'live' },
    { parameterId: CINEMA_COMPOSITOR_MASK_INVERT_PARAMETER_ID, support: 'live' },
  ],
  capabilities: WEBGL_CAPABILITIES,
  cost: { cpu: 'minimal', gpu: 'low', estimatedPassCount: 1, persistentTargetCount: 0, pingPongPairCount: 0 },
  seekPolicy: { mode: 'stateless' },
  output: LINEAR_PREMULTIPLIED_OUTPUT,
  metadata: { stage: 16, blendMode: 'masked', maskModes: ['alpha', 'luminance'], premultipliedAlpha: true },
})

function effectDefinition(kind: CinemaEffectKind): Readonly<CinemaNodeTypeDefinition> {
  const inputPorts = kind === 'feedback'
    ? [EFFECT_INPUT_PORT, HISTORY_INPUT_PORT]
    : kind === 'refraction'
      ? [EFFECT_INPUT_PORT, AUXILIARY_INPUT_PORT]
      : [EFFECT_INPUT_PORT]
  return deepFreeze({
    typeId: CINEMA_EFFECT_NODE_TYPE_IDS[kind],
    version: 1,
    label: EFFECT_LABELS[kind],
    description: `${EFFECT_LABELS[kind]} as a reusable Cinema-owned linear-light post pass.`,
    family: 'effect',
    inputPorts,
    outputPorts: [COLOR_OUTPUT_PORT],
    parameters: EFFECT_PARAMETERS,
    parameterCapabilities: createEffectParameterCapabilities(kind),
    capabilities: WEBGL_CAPABILITIES,
    cost: {
      cpu: 'minimal',
      gpu: kind === 'bloom' || kind === 'blur' || kind === 'edge-detection' ? 'medium' : 'low',
      estimatedPassCount: 1,
      persistentTargetCount: kind === 'feedback' ? 2 : 0,
      pingPongPairCount: 0,
    },
    seekPolicy: kind === 'feedback'
      ? { mode: 'reset-at-position', seedScope: 'musical-position' }
      : { mode: 'stateless' },
    output: LINEAR_PREMULTIPLIED_OUTPUT,
    metadata: {
      stage: 16,
      effectKind: kind,
      premultipliedAlpha: true,
      colorSpace: 'linear-srgb',
      ...(kind === 'bloom' || kind === 'feedback' || kind === 'chromatic-aberration' || kind === 'grain' || kind === 'vignette' || kind === 'tone-mapping'
        ? { extractedFrom: 'cinematic-post-processing', neutralPassContract: 'shared-cinematic-post-pass-semantics-v1' }
        : {}),
    },
  })
}

function createEffectParameterCapabilities(kind: CinemaEffectKind): readonly CinemaParameterCapabilityDescriptor[] {
  const consumedByKind: Readonly<Record<CinemaEffectKind, readonly CinemaParameterId[]>> = {
    bloom: [CINEMA_COMPOSITOR_AMOUNT_PARAMETER_ID, CINEMA_COMPOSITOR_SECONDARY_PARAMETER_ID, CINEMA_COMPOSITOR_SCALE_PARAMETER_ID],
    blur: [CINEMA_COMPOSITOR_AMOUNT_PARAMETER_ID, CINEMA_COMPOSITOR_SCALE_PARAMETER_ID],
    feedback: [CINEMA_COMPOSITOR_AMOUNT_PARAMETER_ID, CINEMA_COMPOSITOR_SECONDARY_PARAMETER_ID],
    refraction: [CINEMA_COMPOSITOR_AMOUNT_PARAMETER_ID, CINEMA_COMPOSITOR_SCALE_PARAMETER_ID, CINEMA_COMPOSITOR_OFFSET_PARAMETER_ID],
    pixelation: [CINEMA_COMPOSITOR_AMOUNT_PARAMETER_ID, CINEMA_COMPOSITOR_SCALE_PARAMETER_ID],
    'chromatic-aberration': [CINEMA_COMPOSITOR_AMOUNT_PARAMETER_ID, CINEMA_COMPOSITOR_SCALE_PARAMETER_ID],
    'color-grading': [CINEMA_COMPOSITOR_EXPOSURE_PARAMETER_ID, CINEMA_COMPOSITOR_CONTRAST_PARAMETER_ID, CINEMA_COMPOSITOR_SATURATION_PARAMETER_ID, CINEMA_COMPOSITOR_HUE_PARAMETER_ID],
    kaleidoscope: [CINEMA_COMPOSITOR_AMOUNT_PARAMETER_ID, CINEMA_COMPOSITOR_SCALE_PARAMETER_ID],
    'edge-detection': [CINEMA_COMPOSITOR_SCALE_PARAMETER_ID],
    strobe: [CINEMA_COMPOSITOR_AMOUNT_PARAMETER_ID, CINEMA_COMPOSITOR_SECONDARY_PARAMETER_ID, CINEMA_COMPOSITOR_SCALE_PARAMETER_ID, CINEMA_COMPOSITOR_OFFSET_PARAMETER_ID],
    grain: [CINEMA_COMPOSITOR_AMOUNT_PARAMETER_ID, CINEMA_COMPOSITOR_SCALE_PARAMETER_ID],
    vignette: [CINEMA_COMPOSITOR_AMOUNT_PARAMETER_ID, CINEMA_COMPOSITOR_SECONDARY_PARAMETER_ID],
    'tone-mapping': [CINEMA_COMPOSITOR_EXPOSURE_PARAMETER_ID],
  }
  const consumed = new Set(consumedByKind[kind])
  return EFFECT_PARAMETERS.map(parameter => consumed.has(parameter.id)
    ? { parameterId: parameter.id, support: 'live' as const }
    : {
        parameterId: parameter.id,
        support: 'unsupported' as const,
        reason: `${EFFECT_LABELS[kind]} does not consume this shared effect parameter.`,
      })
}

export const CINEMA_EFFECT_NODE_DEFINITIONS: Readonly<Record<CinemaEffectKind, Readonly<CinemaNodeTypeDefinition>>> = deepFreeze({
  bloom: effectDefinition('bloom'),
  blur: effectDefinition('blur'),
  feedback: effectDefinition('feedback'),
  refraction: effectDefinition('refraction'),
  pixelation: effectDefinition('pixelation'),
  'chromatic-aberration': effectDefinition('chromatic-aberration'),
  'color-grading': effectDefinition('color-grading'),
  kaleidoscope: effectDefinition('kaleidoscope'),
  'edge-detection': effectDefinition('edge-detection'),
  strobe: effectDefinition('strobe'),
  grain: effectDefinition('grain'),
  vignette: effectDefinition('vignette'),
  'tone-mapping': effectDefinition('tone-mapping'),
})

export const CINEMA_TRANSITION_NODE_DEFINITION: Readonly<CinemaNodeTypeDefinition> = deepFreeze({
  typeId: CINEMA_TRANSITION_NODE_TYPE_ID,
  version: 1,
  label: 'Composition Transition',
  description: 'Single-context composition transition compositor with deterministic interruption handling.',
  family: 'mixer',
  inputPorts: [TRANSITION_FROM_INPUT_PORT, TRANSITION_TO_INPUT_PORT],
  outputPorts: [COLOR_OUTPUT_PORT],
  parameters: [
    {
      id: CINEMA_COMPOSITOR_TRANSITION_KIND_PARAMETER_ID,
      label: 'Transition',
      type: 'enum',
      default: TRANSITION_CROSSFADE,
      options: [
        { id: TRANSITION_CROSSFADE, label: 'Crossfade' },
        { id: TRANSITION_WIPE, label: 'Wipe' },
        { id: TRANSITION_RADIAL, label: 'Radial' },
        { id: TRANSITION_DISSOLVE, label: 'Dissolve' },
        { id: TRANSITION_SLIDE, label: 'Slide' },
        { id: TRANSITION_ZOOM, label: 'Zoom' },
      ],
      ui: { control: 'select', order: 0 },
    },
    {
      id: CINEMA_COMPOSITOR_TRANSITION_PROGRESS_PARAMETER_ID,
      label: 'Progress',
      type: 'float',
      default: 1,
      min: 0,
      max: 1,
      step: 0.001,
      modulatable: true,
      ui: { control: 'slider', order: 1 },
    },
    {
      id: CINEMA_COMPOSITOR_TRANSITION_AUTOMATIC_PARAMETER_ID,
      label: 'Automatic Clock',
      type: 'boolean',
      default: false,
      ui: { control: 'toggle', order: 2 },
    },
    {
      id: CINEMA_COMPOSITOR_TRANSITION_TOKEN_PARAMETER_ID,
      label: 'Transition Token',
      type: 'string',
      default: 'initial',
      minLength: 1,
      maxLength: 128,
      ui: { control: 'text', order: 3 },
    },
    {
      id: CINEMA_COMPOSITOR_TRANSITION_DURATION_PARAMETER_ID,
      label: 'Duration',
      type: 'float',
      default: 1,
      min: 0,
      max: 60,
      step: 0.01,
      unit: 'seconds',
      ui: { control: 'slider', order: 4 },
    },
    {
      id: CINEMA_COMPOSITOR_TRANSITION_SOFTNESS_PARAMETER_ID,
      label: 'Softness',
      type: 'float',
      default: 0.08,
      min: 0,
      max: 0.5,
      step: 0.001,
      modulatable: true,
      ui: { control: 'slider', order: 5 },
    },
  ],
  parameterCapabilities: [
    { parameterId: CINEMA_COMPOSITOR_TRANSITION_KIND_PARAMETER_ID, support: 'live' },
    { parameterId: CINEMA_COMPOSITOR_TRANSITION_PROGRESS_PARAMETER_ID, support: 'live' },
    { parameterId: CINEMA_COMPOSITOR_TRANSITION_AUTOMATIC_PARAMETER_ID, support: 'live' },
    { parameterId: CINEMA_COMPOSITOR_TRANSITION_TOKEN_PARAMETER_ID, support: 'live' },
    { parameterId: CINEMA_COMPOSITOR_TRANSITION_DURATION_PARAMETER_ID, support: 'live' },
    { parameterId: CINEMA_COMPOSITOR_TRANSITION_SOFTNESS_PARAMETER_ID, support: 'live' },
  ],
  capabilities: WEBGL_CAPABILITIES,
  cost: { cpu: 'minimal', gpu: 'low', estimatedPassCount: 1, persistentTargetCount: 0, pingPongPairCount: 0 },
  seekPolicy: { mode: 'reset-at-position', seedScope: 'musical-position' },
  output: LINEAR_PREMULTIPLIED_OUTPUT,
  metadata: {
    stage: 16,
    transitionCompositor: true,
    interruptionSafe: true,
    singleContext: true,
    adaptedFrom: ['shader-transition-crossfade', 'shader-transition-noise-dissolve', 'shader-transition-radial-wipe'],
    ownershipNote: 'transition semantics only; Cinema owns program, targets, context, and frame lifecycle',
  },
})

const BLEND_PLUGIN_IDS: Readonly<Record<CinemaCompositorBlendMode, CinemaRendererPluginId>> = deepFreeze({
  normal: pluginId('drmvyz.cinema.renderer.mixer-normal'),
  add: pluginId('drmvyz.cinema.renderer.mixer-add'),
  screen: pluginId('drmvyz.cinema.renderer.mixer-screen'),
  multiply: pluginId('drmvyz.cinema.renderer.mixer-multiply'),
  lighten: pluginId('drmvyz.cinema.renderer.mixer-lighten'),
  darken: pluginId('drmvyz.cinema.renderer.mixer-darken'),
  difference: pluginId('drmvyz.cinema.renderer.mixer-difference'),
  overlay: pluginId('drmvyz.cinema.renderer.mixer-overlay'),
})

const MASKED_PLUGIN_ID = pluginId('drmvyz.cinema.renderer.mixer-masked-composite')
const TRANSITION_PLUGIN_ID = pluginId('drmvyz.cinema.renderer.transition-composition')

const EFFECT_PLUGIN_IDS: Readonly<Record<CinemaEffectKind, CinemaRendererPluginId>> = deepFreeze({
  bloom: pluginId('drmvyz.cinema.renderer.effect-bloom'),
  blur: pluginId('drmvyz.cinema.renderer.effect-blur'),
  feedback: pluginId('drmvyz.cinema.renderer.effect-feedback'),
  refraction: pluginId('drmvyz.cinema.renderer.effect-refraction'),
  pixelation: pluginId('drmvyz.cinema.renderer.effect-pixelation'),
  'chromatic-aberration': pluginId('drmvyz.cinema.renderer.effect-chromatic-aberration'),
  'color-grading': pluginId('drmvyz.cinema.renderer.effect-color-grading'),
  kaleidoscope: pluginId('drmvyz.cinema.renderer.effect-kaleidoscope'),
  'edge-detection': pluginId('drmvyz.cinema.renderer.effect-edge-detection'),
  strobe: pluginId('drmvyz.cinema.renderer.effect-strobe'),
  grain: pluginId('drmvyz.cinema.renderer.effect-grain'),
  vignette: pluginId('drmvyz.cinema.renderer.effect-vignette'),
  'tone-mapping': pluginId('drmvyz.cinema.renderer.effect-tone-mapping'),
})

export const CINEMA_COMPOSITOR_PERSISTED_DEFINITIONS: readonly CinemaPersistedDefinition[] = deepFreeze([
  ...Object.entries(CINEMA_BLEND_NODE_DEFINITIONS).map(([mode, definition]) => persisted(
    definition,
    BLEND_PLUGIN_IDS[mode as CinemaCompositorBlendMode],
    `cinema-mixer-${mode}`,
  )),
  persisted(CINEMA_MASKED_COMPOSITE_NODE_DEFINITION, MASKED_PLUGIN_ID, 'cinema-masked-composite'),
  ...Object.entries(CINEMA_EFFECT_NODE_DEFINITIONS).map(([kind, definition]) => persisted(
    definition,
    EFFECT_PLUGIN_IDS[kind as CinemaEffectKind],
    `cinema-effect-${kind}`,
    kind === 'feedback' ? {
      inputPortId: CINEMA_COMPOSITOR_HISTORY_INPUT_PORT_ID,
      outputPortId: CINEMA_COMPOSITOR_COLOR_OUTPUT_PORT_ID,
      historyFrames: 1,
    } : undefined,
  )),
  persisted(CINEMA_TRANSITION_NODE_DEFINITION, TRANSITION_PLUGIN_ID, 'cinema-composition-transition'),
])

export const CINEMA_COMPOSITOR_RUNTIME_REGISTRATIONS = deepFreeze([
  ...Object.entries(CINEMA_BLEND_NODE_DEFINITIONS).map(([mode, definition]) => runtime(
    BLEND_PLUGIN_IDS[mode as CinemaCompositorBlendMode],
    definition,
    node => new BlendNode(node, mode as CinemaCompositorBlendMode),
  )),
  runtime(MASKED_PLUGIN_ID, CINEMA_MASKED_COMPOSITE_NODE_DEFINITION, node => new MaskedCompositeNode(node)),
  ...Object.entries(CINEMA_EFFECT_NODE_DEFINITIONS).map(([kind, definition]) => runtime(
    EFFECT_PLUGIN_IDS[kind as CinemaEffectKind],
    definition,
    node => new EffectNode(node, kind as CinemaEffectKind),
  )),
  runtime(TRANSITION_PLUGIN_ID, CINEMA_TRANSITION_NODE_DEFINITION, node => new TransitionNode(node)),
])

abstract class FullscreenNode implements CinemaRenderNode {
  readonly nodeId: CinemaNodeId
  readonly typeId: CinemaNodeTypeId
  protected program: WebGLProgram | null = null
  protected readonly locations = new Map<string, WebGLUniformLocation | null>()

  constructor(protected readonly authored: Readonly<CinemaNodeDefinition>) {
    this.nodeId = authored.id
    this.typeId = authored.typeId
  }

  abstract initialize(context: CinemaNodeInitializeContext): void
  resize(_context: CinemaNodeResizeContext): void {}
  abstract render(context: CinemaNodeRenderContext): void
  reset(_context: CinemaNodeResetContext): void {}

  dispose(context: CinemaNodeDisposeContext): void {
    if (this.program) context.webgl.gl.deleteProgram(this.program)
    this.program = null
    this.locations.clear()
  }

  protected initializeProgram(context: CinemaNodeInitializeContext, fragment: string, uniforms: readonly string[]): void {
    this.program = createProgram(context.webgl.gl, FULLSCREEN_VERTEX_SHADER, fragment)
    for (const uniform of uniforms) this.locations.set(uniform, context.webgl.gl.getUniformLocation(this.program, uniform))
  }

  protected begin(context: CinemaNodeRenderContext): WebGL2RenderingContext {
    if (!context.target || context.outputNode || !this.program) {
      throw new Error(`Cinema compositor node "${this.nodeId}" received an invalid render destination.`)
    }
    const gl = context.webgl.gl
    context.webgl.bindTarget(context.target)
    context.webgl.resetState()
    gl.useProgram(this.program)
    return gl
  }

  protected bindTexture(
    context: CinemaNodeRenderContext,
    input: CinemaTextureView | null | undefined,
    unit: number,
    samplerUniform: string,
    hasUniform: string,
    colorSpaceUniform: string,
    alphaModeUniform: string,
  ): void {
    const gl = context.webgl.gl
    const texture = input ? context.webgl.resolveTexture(input) : null
    gl.activeTexture(gl.TEXTURE0 + unit)
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.uniform1i(this.locations.get(samplerUniform) ?? null, unit)
    gl.uniform1i(this.locations.get(hasUniform) ?? null, texture ? 1 : 0)
    gl.uniform1i(this.locations.get(colorSpaceUniform) ?? null, colorSpaceCode(input?.descriptor.colorSpace))
    gl.uniform1i(this.locations.get(alphaModeUniform) ?? null, alphaModeCode(input?.descriptor.alphaMode))
  }
}

class BlendNode extends FullscreenNode {
  constructor(node: Readonly<CinemaNodeDefinition>, private readonly mode: CinemaCompositorBlendMode) {
    super(node)
  }

  initialize(context: CinemaNodeInitializeContext): void {
    this.initializeProgram(context, BLEND_FRAGMENT_SHADER, [
      'uBackground', 'uForeground', 'uHasBackground', 'uHasForeground',
      'uBackgroundColorSpace', 'uForegroundColorSpace', 'uBackgroundAlphaMode', 'uForegroundAlphaMode',
      'uOpacity', 'uMode',
    ])
  }

  render(context: CinemaNodeRenderContext): void {
    const gl = this.begin(context)
    this.bindTexture(context, context.inputs[CINEMA_COMPOSITOR_BACKGROUND_INPUT_PORT_ID], 0,
      'uBackground', 'uHasBackground', 'uBackgroundColorSpace', 'uBackgroundAlphaMode')
    this.bindTexture(context, context.inputs[CINEMA_COMPOSITOR_FOREGROUND_INPUT_PORT_ID], 1,
      'uForeground', 'uHasForeground', 'uForegroundColorSpace', 'uForegroundAlphaMode')
    gl.uniform1f(this.locations.get('uOpacity') ?? null, clamp01(
      this.authored.opacity * numberValue(context.values[CINEMA_COMPOSITOR_OPACITY_PARAMETER_ID], 1),
    ))
    gl.uniform1i(this.locations.get('uMode') ?? null, blendModeCode(this.mode))
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }
}

class MaskedCompositeNode extends FullscreenNode {
  initialize(context: CinemaNodeInitializeContext): void {
    this.initializeProgram(context, MASKED_FRAGMENT_SHADER, [
      'uBackground', 'uForeground', 'uMask', 'uHasBackground', 'uHasForeground', 'uHasMask',
      'uBackgroundColorSpace', 'uForegroundColorSpace', 'uMaskColorSpace',
      'uBackgroundAlphaMode', 'uForegroundAlphaMode', 'uMaskAlphaMode',
      'uOpacity', 'uMaskMode', 'uInvertMask',
    ])
  }

  render(context: CinemaNodeRenderContext): void {
    const gl = this.begin(context)
    this.bindTexture(context, context.inputs[CINEMA_COMPOSITOR_BACKGROUND_INPUT_PORT_ID], 0,
      'uBackground', 'uHasBackground', 'uBackgroundColorSpace', 'uBackgroundAlphaMode')
    this.bindTexture(context, context.inputs[CINEMA_COMPOSITOR_FOREGROUND_INPUT_PORT_ID], 1,
      'uForeground', 'uHasForeground', 'uForegroundColorSpace', 'uForegroundAlphaMode')
    this.bindTexture(context, context.inputs[CINEMA_COMPOSITOR_MASK_INPUT_PORT_ID], 2,
      'uMask', 'uHasMask', 'uMaskColorSpace', 'uMaskAlphaMode')
    gl.uniform1f(this.locations.get('uOpacity') ?? null, clamp01(
      this.authored.opacity * numberValue(context.values[CINEMA_COMPOSITOR_OPACITY_PARAMETER_ID], 1),
    ))
    gl.uniform1i(this.locations.get('uMaskMode') ?? null,
      stringValue(context.values[CINEMA_COMPOSITOR_MASK_MODE_PARAMETER_ID], MASK_ALPHA) === MASK_LUMINANCE ? 1 : 0)
    gl.uniform1i(this.locations.get('uInvertMask') ?? null,
      booleanValue(context.values[CINEMA_COMPOSITOR_MASK_INVERT_PARAMETER_ID], false) ? 1 : 0)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }
}

class EffectNode extends FullscreenNode {
  constructor(node: Readonly<CinemaNodeDefinition>, private readonly kind: CinemaEffectKind) {
    super(node)
  }

  initialize(context: CinemaNodeInitializeContext): void {
    this.initializeProgram(context, EFFECT_FRAGMENT_SHADER, [
      'uSource', 'uAuxiliary', 'uHistory', 'uHasSource', 'uHasAuxiliary', 'uHasHistory',
      'uSourceColorSpace', 'uAuxiliaryColorSpace', 'uHistoryColorSpace',
      'uSourceAlphaMode', 'uAuxiliaryAlphaMode', 'uHistoryAlphaMode',
      'uResolution', 'uTime', 'uWet', 'uAmount', 'uSecondary', 'uScale', 'uOffset',
      'uExposure', 'uContrast', 'uSaturation', 'uHue', 'uEffectKind',
    ])
  }

  render(context: CinemaNodeRenderContext): void {
    const gl = this.begin(context)
    this.bindTexture(context, context.inputs[CINEMA_COMPOSITOR_EFFECT_INPUT_PORT_ID], 0,
      'uSource', 'uHasSource', 'uSourceColorSpace', 'uSourceAlphaMode')
    this.bindTexture(context, context.inputs[CINEMA_COMPOSITOR_AUXILIARY_INPUT_PORT_ID], 1,
      'uAuxiliary', 'uHasAuxiliary', 'uAuxiliaryColorSpace', 'uAuxiliaryAlphaMode')
    this.bindTexture(context, context.inputs[CINEMA_COMPOSITOR_HISTORY_INPUT_PORT_ID], 2,
      'uHistory', 'uHasHistory', 'uHistoryColorSpace', 'uHistoryAlphaMode')
    gl.uniform2f(this.locations.get('uResolution') ?? null,
      Math.max(1, context.viewport.width), Math.max(1, context.viewport.height))
    gl.uniform1f(this.locations.get('uTime') ?? null, context.frame.timing.elapsedTimeSec)
    gl.uniform1f(this.locations.get('uWet') ?? null, clamp01(this.authored.opacity))
    gl.uniform1f(this.locations.get('uAmount') ?? null,
      clamp01(numberValue(context.values[CINEMA_COMPOSITOR_AMOUNT_PARAMETER_ID], 0.5)))
    gl.uniform1f(this.locations.get('uSecondary') ?? null,
      clamp01(numberValue(context.values[CINEMA_COMPOSITOR_SECONDARY_PARAMETER_ID], 0.5)))
    gl.uniform1f(this.locations.get('uScale') ?? null,
      Math.max(0.01, numberValue(context.values[CINEMA_COMPOSITOR_SCALE_PARAMETER_ID], 1)))
    gl.uniform1f(this.locations.get('uOffset') ?? null,
      numberValue(context.values[CINEMA_COMPOSITOR_OFFSET_PARAMETER_ID], 0))
    gl.uniform1f(this.locations.get('uExposure') ?? null,
      Math.max(0, numberValue(context.values[CINEMA_COMPOSITOR_EXPOSURE_PARAMETER_ID], 1)))
    gl.uniform1f(this.locations.get('uContrast') ?? null,
      Math.max(0, numberValue(context.values[CINEMA_COMPOSITOR_CONTRAST_PARAMETER_ID], 1)))
    gl.uniform1f(this.locations.get('uSaturation') ?? null,
      Math.max(0, numberValue(context.values[CINEMA_COMPOSITOR_SATURATION_PARAMETER_ID], 1)))
    gl.uniform1f(this.locations.get('uHue') ?? null,
      numberValue(context.values[CINEMA_COMPOSITOR_HUE_PARAMETER_ID], 0))
    gl.uniform1i(this.locations.get('uEffectKind') ?? null, effectKindCode(this.kind))
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }
}

class TransitionNode extends FullscreenNode {
  private readonly clock = new CinemaCompositionTransitionClock()

  initialize(context: CinemaNodeInitializeContext): void {
    this.initializeProgram(context, TRANSITION_FRAGMENT_SHADER, [
      'uFrom', 'uTo', 'uHasFrom', 'uHasTo', 'uFromColorSpace', 'uToColorSpace',
      'uFromAlphaMode', 'uToAlphaMode', 'uProgress', 'uSoftness', 'uTransitionKind', 'uSeed',
    ])
  }

  render(context: CinemaNodeRenderContext): void {
    const gl = this.begin(context)
    this.bindTexture(context, context.inputs[CINEMA_COMPOSITOR_TRANSITION_FROM_INPUT_PORT_ID], 0,
      'uFrom', 'uHasFrom', 'uFromColorSpace', 'uFromAlphaMode')
    this.bindTexture(context, context.inputs[CINEMA_COMPOSITOR_TRANSITION_TO_INPUT_PORT_ID], 1,
      'uTo', 'uHasTo', 'uToColorSpace', 'uToAlphaMode')
    const automatic = booleanValue(context.values[CINEMA_COMPOSITOR_TRANSITION_AUTOMATIC_PARAMETER_ID], false)
    const progress = automatic
      ? this.clock.begin(
          stringValue(context.values[CINEMA_COMPOSITOR_TRANSITION_TOKEN_PARAMETER_ID], 'initial'),
          context.frame.timing.elapsedTimeSec,
          numberValue(context.values[CINEMA_COMPOSITOR_TRANSITION_DURATION_PARAMETER_ID], 1),
        ).progress
      : clamp01(numberValue(context.values[CINEMA_COMPOSITOR_TRANSITION_PROGRESS_PARAMETER_ID], 1))
    gl.uniform1f(this.locations.get('uProgress') ?? null, progress)
    gl.uniform1f(this.locations.get('uSoftness') ?? null,
      clamp(numberValue(context.values[CINEMA_COMPOSITOR_TRANSITION_SOFTNESS_PARAMETER_ID], 0.08), 0, 0.5))
    gl.uniform1i(this.locations.get('uTransitionKind') ?? null,
      transitionKindCode(stringValue(context.values[CINEMA_COMPOSITOR_TRANSITION_KIND_PARAMETER_ID], TRANSITION_CROSSFADE)))
    gl.uniform1f(this.locations.get('uSeed') ?? null, (context.frame.timing.seeds.musicalPosition >>> 0) / 0xffffffff)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  reset(_context: CinemaNodeResetContext): void {
    this.clock.reset()
  }
}

const FULLSCREEN_VERTEX_SHADER = `#version 300 es
precision highp float;
out vec2 vUv;
void main() {
  vec2 position = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = position;
  gl_Position = vec4(position * 2.0 - 1.0, 0.0, 1.0);
}`

export const CINEMA_COLOR_CONVERSION_GLSL = `
vec3 cinemaSrgbToLinear(vec3 value) {
  vec3 low = value / 12.92;
  vec3 high = pow(max((value + 0.055) / 1.055, vec3(0.0)), vec3(2.4));
  return mix(high, low, lessThanEqual(value, vec3(0.04045)));
}
vec3 cinemaLinearToSrgb(vec3 value) {
  vec3 normalized = max(value, vec3(0.0));
  vec3 low = normalized * 12.92;
  vec3 high = 1.055 * pow(normalized, vec3(1.0 / 2.4)) - 0.055;
  return mix(high, low, lessThanEqual(normalized, vec3(0.0031308)));
}
vec3 cinemaDisplayP3ToLinearSrgb(vec3 value) {
  return mat3(
    vec3(1.224745, -0.042058, -0.019642),
    vec3(-0.224904, 1.042081, -0.078655),
    vec3(0.0, 0.0, 1.098537)
  ) * value;
}
vec4 cinemaNormalizeSample(vec4 sampleValue, int colorSpace, int alphaMode) {
  float alpha = alphaMode == 2 ? 1.0 : clamp(sampleValue.a, 0.0, 1.0);
  vec3 straight = alphaMode == 0
    ? (alpha > 0.000001 ? sampleValue.rgb / alpha : vec3(0.0))
    : sampleValue.rgb;
  if (colorSpace == 0) {
    straight = cinemaSrgbToLinear(max(straight, vec3(0.0)));
  } else if (colorSpace == 2) {
    straight = cinemaDisplayP3ToLinearSrgb(cinemaSrgbToLinear(max(straight, vec3(0.0))));
  }
  return vec4(straight * alpha, alpha);
}
vec3 cinemaStraight(vec4 premultiplied) {
  return premultiplied.a > 0.000001 ? premultiplied.rgb / premultiplied.a : vec3(0.0);
}
vec4 cinemaSourceOver(vec4 background, vec4 foreground) {
  return foreground + background * (1.0 - foreground.a);
}
`

const BLEND_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uBackground;
uniform sampler2D uForeground;
uniform int uHasBackground;
uniform int uHasForeground;
uniform int uBackgroundColorSpace;
uniform int uForegroundColorSpace;
uniform int uBackgroundAlphaMode;
uniform int uForegroundAlphaMode;
uniform float uOpacity;
uniform int uMode;
out vec4 outColor;
${CINEMA_COLOR_CONVERSION_GLSL}
vec3 blendRgb(vec3 background, vec3 foreground, int mode) {
  if (mode == 1) return min(vec3(1.0), background + foreground);
  if (mode == 2) return 1.0 - (1.0 - background) * (1.0 - foreground);
  if (mode == 3) return background * foreground;
  if (mode == 4) return max(background, foreground);
  if (mode == 5) return min(background, foreground);
  if (mode == 6) return abs(background - foreground);
  if (mode == 7) return mix(
    2.0 * background * foreground,
    1.0 - 2.0 * (1.0 - background) * (1.0 - foreground),
    step(vec3(0.5), background)
  );
  return foreground;
}
void main() {
  vec4 background = uHasBackground == 1
    ? cinemaNormalizeSample(texture(uBackground, vUv), uBackgroundColorSpace, uBackgroundAlphaMode)
    : vec4(0.0);
  vec4 foreground = uHasForeground == 1
    ? cinemaNormalizeSample(texture(uForeground, vUv), uForegroundColorSpace, uForegroundAlphaMode)
    : vec4(0.0);
  foreground *= clamp(uOpacity, 0.0, 1.0);
  vec3 blended = blendRgb(cinemaStraight(background), cinemaStraight(foreground), uMode);
  float outputAlpha = foreground.a + background.a * (1.0 - foreground.a);
  vec3 outputRgb = (1.0 - foreground.a) * background.rgb
    + (1.0 - background.a) * foreground.rgb
    + background.a * foreground.a * blended;
  outColor = vec4(max(outputRgb, vec3(0.0)), clamp(outputAlpha, 0.0, 1.0));
}`

const MASKED_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uBackground;
uniform sampler2D uForeground;
uniform sampler2D uMask;
uniform int uHasBackground;
uniform int uHasForeground;
uniform int uHasMask;
uniform int uBackgroundColorSpace;
uniform int uForegroundColorSpace;
uniform int uMaskColorSpace;
uniform int uBackgroundAlphaMode;
uniform int uForegroundAlphaMode;
uniform int uMaskAlphaMode;
uniform float uOpacity;
uniform int uMaskMode;
uniform int uInvertMask;
out vec4 outColor;
${CINEMA_COLOR_CONVERSION_GLSL}
void main() {
  vec4 background = uHasBackground == 1
    ? cinemaNormalizeSample(texture(uBackground, vUv), uBackgroundColorSpace, uBackgroundAlphaMode)
    : vec4(0.0);
  vec4 foreground = uHasForeground == 1
    ? cinemaNormalizeSample(texture(uForeground, vUv), uForegroundColorSpace, uForegroundAlphaMode)
    : vec4(0.0);
  float maskWeight = 0.0;
  if (uHasMask == 1) {
    vec4 maskSample = cinemaNormalizeSample(texture(uMask, vUv), uMaskColorSpace, uMaskAlphaMode);
    maskWeight = uMaskMode == 1
      ? dot(cinemaStraight(maskSample), vec3(0.2126, 0.7152, 0.0722))
      : maskSample.a;
  }
  if (uInvertMask == 1) maskWeight = 1.0 - maskWeight;
  foreground *= clamp(maskWeight * uOpacity, 0.0, 1.0);
  outColor = cinemaSourceOver(background, foreground);
}`

const CINEMATIC_POST = CINEMATIC_POST_PROCESS_CONSTANTS

const EFFECT_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uSource;
uniform sampler2D uAuxiliary;
uniform sampler2D uHistory;
uniform int uHasSource;
uniform int uHasAuxiliary;
uniform int uHasHistory;
uniform int uSourceColorSpace;
uniform int uAuxiliaryColorSpace;
uniform int uHistoryColorSpace;
uniform int uSourceAlphaMode;
uniform int uAuxiliaryAlphaMode;
uniform int uHistoryAlphaMode;
uniform vec2 uResolution;
uniform float uTime;
uniform float uWet;
uniform float uAmount;
uniform float uSecondary;
uniform float uScale;
uniform float uOffset;
uniform float uExposure;
uniform float uContrast;
uniform float uSaturation;
uniform float uHue;
uniform int uEffectKind;
out vec4 outColor;
${CINEMA_COLOR_CONVERSION_GLSL}
vec4 sourceAt(vec2 uv) {
  if (uHasSource == 0) return vec4(0.0);
  return cinemaNormalizeSample(texture(uSource, clamp(uv, vec2(0.0), vec2(1.0))), uSourceColorSpace, uSourceAlphaMode);
}
vec4 auxiliaryAt(vec2 uv) {
  if (uHasAuxiliary == 0) return vec4(0.0);
  return cinemaNormalizeSample(texture(uAuxiliary, clamp(uv, vec2(0.0), vec2(1.0))), uAuxiliaryColorSpace, uAuxiliaryAlphaMode);
}
vec4 historyAt(vec2 uv) {
  if (uHasHistory == 0) return vec4(0.0);
  return cinemaNormalizeSample(texture(uHistory, clamp(uv, vec2(0.0), vec2(1.0))), uHistoryColorSpace, uHistoryAlphaMode);
}
float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 345.45));
  p += dot(p, p + 34.345);
  return fract(p.x * p.y);
}
vec3 rotateHue(vec3 color, float angle) {
  const mat3 toYiq = mat3(
    0.299, 0.587, 0.114,
    0.596, -0.275, -0.321,
    0.212, -0.523, 0.311
  );
  const mat3 toRgb = mat3(
    1.0, 0.956, 0.621,
    1.0, -0.272, -0.647,
    1.0, -1.106, 1.703
  );
  vec3 yiq = toYiq * color;
  float hue = atan(yiq.z, yiq.y) + angle;
  float chroma = length(yiq.yz);
  return max(toRgb * vec3(yiq.x, chroma * cos(hue), chroma * sin(hue)), vec3(0.0));
}
vec4 blurSample(vec2 uv, float radius) {
  vec2 px = radius / max(uResolution, vec2(1.0));
  vec4 sum = sourceAt(uv) * 0.227027;
  sum += sourceAt(uv + vec2(px.x, 0.0) * 1.384615) * 0.158108;
  sum += sourceAt(uv - vec2(px.x, 0.0) * 1.384615) * 0.158108;
  sum += sourceAt(uv + vec2(0.0, px.y) * 1.384615) * 0.158108;
  sum += sourceAt(uv - vec2(0.0, px.y) * 1.384615) * 0.158108;
  sum += sourceAt(uv + px * 3.230769) * 0.070811;
  sum += sourceAt(uv - px * 3.230769) * 0.070811;
  return sum;
}
void main() {
  vec4 base = sourceAt(vUv);
  vec4 effected = base;
  vec2 px = 1.0 / max(uResolution, vec2(1.0));
  if (uEffectKind == 0) {
    vec4 glow = blurSample(vUv, 1.0 + uScale * 3.0);
    vec3 bright = max(cinemaStraight(glow) - vec3(uSecondary), vec3(0.0));
    float glowAlpha = clamp(glow.a * uAmount, 0.0, 1.0);
    float bloomAlpha = max(base.a, glowAlpha);
    effected = vec4(base.rgb + bright * glowAlpha * (0.5 + uAmount * 2.5), bloomAlpha);
  } else if (uEffectKind == 1) {
    effected = blurSample(vUv, 0.5 + uAmount * uScale * 8.0);
  } else if (uEffectKind == 2) {
    vec2 centered = vUv - 0.5;
    vec2 drift = vec2(sin(uTime * 0.17), cos(uTime * 0.13)) * ${CINEMATIC_POST.feedbackDrift} * uSecondary;
    vec4 history = historyAt(0.5 + centered * (1.0 + uAmount * ${CINEMATIC_POST.feedbackZoom}) + drift);
    effected = cinemaSourceOver(history * clamp(uAmount * 0.9, 0.0, 0.95), base);
  } else if (uEffectKind == 3) {
    vec4 displacement = uHasAuxiliary == 1 ? auxiliaryAt(vUv) : base;
    vec2 vector = (cinemaStraight(displacement).rg - 0.5) * (0.02 * uAmount * uScale);
    effected = sourceAt(vUv + vector + vec2(uOffset));
  } else if (uEffectKind == 4) {
    vec2 cells = max(vec2(1.0), floor(uResolution / max(1.0, uScale * (2.0 + 126.0 * uAmount))));
    vec2 uv = (floor(vUv * cells) + 0.5) / cells;
    effected = sourceAt(uv);
  } else if (uEffectKind == 5) {
    vec2 direction = normalize(vUv - 0.5 + vec2(0.0001));
    vec2 shift = direction * uAmount * uScale * ${CINEMATIC_POST.chromaticShift};
    vec4 center = sourceAt(vUv);
    vec4 redSample = sourceAt(vUv + shift);
    vec4 blueSample = sourceAt(vUv - shift);
    vec3 straight = cinemaStraight(center);
    straight.r = cinemaStraight(redSample).r;
    straight.b = cinemaStraight(blueSample).b;
    effected = vec4(straight * center.a, center.a);
  } else if (uEffectKind == 6) {
    vec3 straight = cinemaStraight(base) * uExposure;
    float luma = dot(straight, vec3(0.2126, 0.7152, 0.0722));
    straight = mix(vec3(luma), straight, uSaturation);
    straight = (straight - 0.5) * uContrast + 0.5;
    straight = rotateHue(straight, uHue);
    effected = vec4(max(straight, vec3(0.0)) * base.a, base.a);
  } else if (uEffectKind == 7) {
    vec2 p = vUv - 0.5;
    float radius = length(p);
    float angle = atan(p.y, p.x);
    float segments = max(2.0, floor(2.0 + uScale * (2.0 + uAmount * 14.0)));
    float wedge = 6.28318530718 / segments;
    angle = abs(mod(angle + wedge * 0.5, wedge) - wedge * 0.5);
    effected = sourceAt(0.5 + vec2(cos(angle), sin(angle)) * radius);
  } else if (uEffectKind == 8) {
    float left = dot(cinemaStraight(sourceAt(vUv - vec2(px.x, 0.0))), vec3(0.2126, 0.7152, 0.0722));
    float right = dot(cinemaStraight(sourceAt(vUv + vec2(px.x, 0.0))), vec3(0.2126, 0.7152, 0.0722));
    float down = dot(cinemaStraight(sourceAt(vUv - vec2(0.0, px.y))), vec3(0.2126, 0.7152, 0.0722));
    float up = dot(cinemaStraight(sourceAt(vUv + vec2(0.0, px.y))), vec3(0.2126, 0.7152, 0.0722));
    float edge = clamp(length(vec2(right - left, up - down)) * (2.0 + uScale * 8.0), 0.0, 1.0);
    effected = vec4(vec3(edge) * base.a, base.a);
  } else if (uEffectKind == 9) {
    float rate = 1.0 + uScale * 24.0;
    float gate = step(1.0 - uSecondary, fract(uTime * rate + uOffset));
    effected = base * mix(1.0, gate, uAmount);
  } else if (uEffectKind == 10) {
    vec3 straight = cinemaStraight(base);
    float grain = (hash21(gl_FragCoord.xy / max(1.0, uScale) + uTime * 31.0) - 0.5) * uAmount;
    effected = vec4(max(straight + grain, vec3(0.0)) * base.a, base.a);
  } else if (uEffectKind == 11) {
    vec2 p = vUv * 2.0 - 1.0;
    float vignette = smoothstep(${CINEMATIC_POST.vignetteOuter}, max(0.05, ${CINEMATIC_POST.vignetteInner} + uSecondary * 0.25), dot(p, p));
    effected = vec4(base.rgb * mix(1.0, vignette, uAmount), base.a);
  } else if (uEffectKind == 12) {
    vec3 straight = max(cinemaStraight(base) * uExposure, vec3(0.0));
    straight = straight / (straight + vec3(1.0));
    effected = vec4(straight * base.a, base.a);
  }
  outColor = mix(base, effected, clamp(uWet, 0.0, 1.0));
}`

const TRANSITION_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uFrom;
uniform sampler2D uTo;
uniform int uHasFrom;
uniform int uHasTo;
uniform int uFromColorSpace;
uniform int uToColorSpace;
uniform int uFromAlphaMode;
uniform int uToAlphaMode;
uniform float uProgress;
uniform float uSoftness;
uniform int uTransitionKind;
uniform float uSeed;
out vec4 outColor;
${CINEMA_COLOR_CONVERSION_GLSL}
float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 345.45));
  p += dot(p, p + 34.345 + uSeed * 19.19);
  return fract(p.x * p.y);
}
vec4 fromAt(vec2 uv) {
  if (uHasFrom == 0) return vec4(0.0);
  return cinemaNormalizeSample(texture(uFrom, clamp(uv, vec2(0.0), vec2(1.0))), uFromColorSpace, uFromAlphaMode);
}
vec4 toAt(vec2 uv) {
  if (uHasTo == 0) return vec4(0.0);
  return cinemaNormalizeSample(texture(uTo, clamp(uv, vec2(0.0), vec2(1.0))), uToColorSpace, uToAlphaMode);
}
void main() {
  float progress = clamp(uProgress, 0.0, 1.0);
  float softness = max(0.0001, uSoftness);
  float amount = progress;
  vec2 fromUv = vUv;
  vec2 toUv = vUv;
  if (uTransitionKind == 1) {
    amount = smoothstep(progress - softness, progress + softness, vUv.x);
    amount = 1.0 - amount;
  } else if (uTransitionKind == 2) {
    float radius = length(vUv - 0.5) * 1.41421356;
    amount = 1.0 - smoothstep(progress - softness, progress + softness, radius);
  } else if (uTransitionKind == 3) {
    amount = step(hash21(floor(vUv * 256.0)), progress);
  } else if (uTransitionKind == 4) {
    fromUv = vUv - vec2(progress, 0.0);
    toUv = vUv + vec2(1.0 - progress, 0.0);
    amount = smoothstep(0.0, 1.0, progress);
  } else if (uTransitionKind == 5) {
    fromUv = 0.5 + (vUv - 0.5) * (1.0 + progress * 0.15);
    toUv = 0.5 + (vUv - 0.5) * (1.15 - progress * 0.15);
    amount = smoothstep(0.0, 1.0, progress);
  }
  vec4 fromColor = fromAt(fromUv);
  vec4 toColor = toAt(toUv);
  outColor = mix(fromColor, toColor, clamp(amount, 0.0, 1.0));
}`

function persisted(
  definition: Readonly<CinemaNodeTypeDefinition>,
  rendererPluginId: CinemaRendererPluginId,
  sourceId: string,
  feedback?: CinemaPersistedDefinition['feedback'],
): CinemaPersistedDefinition {
  return {
    id: definition.typeId,
    definition,
    rendererPluginId,
    source: { kind: 'built-in', id: sourceId },
    ...(feedback ? { feedback } : {}),
    quality: {
      minimumTier: 'low',
      maximumTier: 'ultra',
      adaptive: true,
      maximumEstimatedPassCount: definition.cost.estimatedPassCount,
      maximumPersistentTargetCount: definition.cost.persistentTargetCount,
      maximumPingPongPairCount: definition.cost.pingPongPairCount,
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

function createProgram(gl: WebGL2RenderingContext, vertexSource: string, fragmentSource: string): WebGLProgram {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, vertexSource)
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource)
  const program = gl.createProgram()
  if (!program) {
    gl.deleteShader(vertex)
    gl.deleteShader(fragment)
    throw new Error('Cinema could not allocate a compositor WebGL program.')
  }
  gl.attachShader(program, vertex)
  gl.attachShader(program, fragment)
  gl.linkProgram(program)
  gl.deleteShader(vertex)
  gl.deleteShader(fragment)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) || 'Unknown Cinema compositor program link failure.'
    gl.deleteProgram(program)
    throw new Error(message)
  }
  return program
}

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)
  if (!shader) throw new Error('Cinema could not allocate a compositor shader.')
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) || 'Unknown Cinema compositor shader compile failure.'
    gl.deleteShader(shader)
    throw new Error(message)
  }
  return shader
}

function colorSpaceCode(value: CinemaColorSpace | undefined): number {
  if (value === 'linear-srgb') return 1
  if (value === 'display-p3') return 2
  return 0
}

function alphaModeCode(value: CinemaAlphaMode | undefined): number {
  if (value === 'straight') return 1
  if (value === 'opaque') return 2
  return 0
}

function blendModeCode(mode: CinemaCompositorBlendMode): number {
  switch (mode) {
    case 'normal': return 0
    case 'add': return 1
    case 'screen': return 2
    case 'multiply': return 3
    case 'lighten': return 4
    case 'darken': return 5
    case 'difference': return 6
    case 'overlay': return 7
  }
}

function effectKindCode(kind: CinemaEffectKind): number {
  switch (kind) {
    case 'bloom': return 0
    case 'blur': return 1
    case 'feedback': return 2
    case 'refraction': return 3
    case 'pixelation': return 4
    case 'chromatic-aberration': return 5
    case 'color-grading': return 6
    case 'kaleidoscope': return 7
    case 'edge-detection': return 8
    case 'strobe': return 9
    case 'grain': return 10
    case 'vignette': return 11
    case 'tone-mapping': return 12
  }
}

function transitionKindCode(kind: string): number {
  if (kind === TRANSITION_WIPE) return 1
  if (kind === TRANSITION_RADIAL) return 2
  if (kind === TRANSITION_DISSOLVE) return 3
  if (kind === TRANSITION_SLIDE) return 4
  if (kind === TRANSITION_ZOOM) return 5
  return 0
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

function enumId(value: string): CinemaEnumOptionId {
  return cinemaStableId<CinemaEnumOptionId>(value, 'enum option')
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
