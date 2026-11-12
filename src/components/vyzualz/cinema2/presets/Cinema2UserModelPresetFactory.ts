import { CINEMA2_NATIVE_PRESET_SCHEMA_ID, CINEMA2_NATIVE_PRESET_SCHEMA_VERSION, cinema2NamespacedId, cinema2Ref, cinema2StableId, type Cinema2ModuleId, type Cinema2NativePresetManifest, type Cinema2ParameterId, type Cinema2ParameterManifest, type Cinema2PresetId } from '../contracts/Cinema2NativePresetManifest'
import { createCinema2UserModelBaseEnvironment, createCinema2UserModelParameter } from '../model/Cinema2UserModelBaseEnvironment'
import { CINEMA2_USER_MODEL_PREVIEWS, type Cinema2UserModelPreviewKind } from '../model/Cinema2UserModelPreviewPatterns'
import { CINEMA2_THREE_SCENE_MODULE_TYPE_ID } from '../modules/Cinema2ThreeSceneModule'
import { CINEMA2_QUALITY_MODE_PARAMETER } from '../parameters/Cinema2PerformanceParameters'
import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from './Cinema2AfterhoursPreset'
export const CINEMA2_USER_MODEL_PREVIEW_DESCRIPTIONS = {
  form: 'Original saved PBR mesh with bounded whole-object motion.',
  shatter: 'Surface-informed proxy fragment clusters; approximate separation and rejoin, not physical mesh fracture.',
  dust: 'Surface-sampled particle proxy with gather and drift; not a dissolution simulation.',
  hologram: 'Wireframe/transparency/emission with a simple scan-plane proxy; not volumetric holography.',
  slices: 'Surface-informed layer envelopes with offsets; approximate ribbons, not exact geometry sections.',
  voxel: 'Capped surface-informed cube instances; not solid-volume voxelization.',
} as const
export function cinema2UserModelPreviewParameterId(kind: Cinema2UserModelPreviewKind, property: string): Cinema2ParameterId { return cinema2StableId<Cinema2ParameterId>(`user-model-${kind}-${property.replace(/[A-Z]/g, letter => '-' + letter.toLowerCase())}`) }
export function createCinema2UserModelPreset(kind: Cinema2UserModelPreviewKind): Readonly<Cinema2NativePresetManifest> {
  const prefix = `user-model-${kind}`, moduleId = cinema2StableId<Cinema2ModuleId>(`${prefix}-scene`), base = createCinema2UserModelBaseEnvironment(moduleId, prefix)
  const id = (property: string) => cinema2UserModelPreviewParameterId(kind, property)
  const parameter = (property: string, label: string, type: Cinema2ParameterManifest['type'], value: Cinema2ParameterManifest['defaultValue'], parent: Cinema2ParameterManifest['designParentGroup'], extra: Partial<Cinema2ParameterManifest> = {}): Cinema2ParameterManifest => ({ id: id(property), label, type, defaultValue: value, section: 'Design', designParentGroup: parent, exposure: 'primary', persistence: 'preset', reset: 'authored-default', modulatable: false, choreographable: false, automatable: false, ...extra })
  const parameters: Cinema2ParameterManifest[] = [CINEMA2_QUALITY_MODE_PARAMETER,
    parameter('intensity', 'Master Intensity', 'float', .8, 'master-controls', { min: 0, max: 2, step: .01, order: 1 }),
    parameter('bpmSync', 'BPM Sync', 'boolean', true, 'master-controls', { order: 2, description: 'Motion follows the shared track grid/tempo; OFF uses a steady 120 BPM reference. Rhythm triggers continue following musical events.' }),
    { ...createCinema2UserModelParameter(id('model')), order: 0 },
    parameter('pattern', 'Pattern', 'enum', CINEMA2_USER_MODEL_PREVIEWS[kind][0], 'design', { order: 1, options: CINEMA2_USER_MODEL_PREVIEWS[kind].map(label => ({ value: label, label })) }),
    parameter('patternChange', 'Pattern Change', 'boolean', false, 'design', { order: 2 }),
    parameter('trigger', 'Trigger', 'enum', 'beat', 'design', { order: 3, options: CINEMA2_AFTERHOURS_TRIGGER_OPTIONS, visibleWhen: [{ kind: 'parameter-equals', parameterId: id('patternChange'), value: true }] }),
    parameter('movement', 'Movement Amount', 'float', .35, 'design', { order: 4, min: 0, max: .8, step: .01 }),
    parameter('speed', 'Movement Speed', 'float', 1, 'design', { order: 5, min: 0, max: 3, step: .01 }),
    parameter('opacity', 'Opacity', 'float', kind === 'hologram' ? .85 : 1, 'effects', { order: 0, min: .1, max: 1, step: .01 }),
    parameter('emission', 'Emission', 'float', kind === 'hologram' || kind === 'dust' ? .45 : .12, 'effects', { order: 1, min: 0, max: 2, step: .01 }),
    parameter('background', 'Background', 'color', [.025, .035, .045, 1], 'palette', { order: 0 }),
    parameter('primary', 'Primary', 'color', kind === 'shatter' ? [1, .55, .22, 1] : [.4, .8, 1, 1], 'palette', { order: 1, description: 'Front/cap tint or primary proxy region. Saved material colors remain the base.' }),
    parameter('secondary', 'Secondary', 'color', [.8, .3, .85, 1], 'palette', { order: 2, description: 'Side/alternate proxy regions and the independent contour halo.' }),
    parameter('accent', 'Accent', 'color', [.15, .95, .65, 1], 'palette', { order: 3, description: 'Pedestal ring and hologram scan plane.' }),
    parameter('reactivity', 'Reactive Strength', 'float', .6, undefined, { section: 'React', group: 'Model Response', order: 0, min: 0, max: 1, step: .01 }),
    parameter('response', 'Response Decay', 'float', .35, undefined, { section: 'React', group: 'Model Response', order: 1, min: .05, max: 1.5, step: .01, unit: 's' }),
  ]
  const moduleParameters = Object.fromEntries(parameters.filter(p => !['model', 'background'].some(key => id(key) === p.id) && p.id !== CINEMA2_QUALITY_MODE_PARAMETER.id).map(p => [String(p.id).slice(prefix.length + 1).replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase()), p.defaultValue!]))
  const bindings = Object.fromEntries(Object.keys(moduleParameters).map(property => [property, cinema2Ref(id(property))]))
  const background = base.authored.environment!
  return {
    schemaId: CINEMA2_NATIVE_PRESET_SCHEMA_ID, schemaVersion: CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
    id: cinema2NamespacedId<Cinema2PresetId>(`drmvyz.cinema2.${prefix}`), revision: 1,
    metadata: { name: `3D ${kind.toUpperCase()} (Preview)`, description: `Reference preview: ${CINEMA2_USER_MODEL_PREVIEW_DESCRIPTIONS[kind]} Uses your pinned model or a neutral fallback; final stage and advanced choreography are pending.`, tags: ['reference', 'preview', 'user-model', '3d', kind] },
    capabilities: [{ id: 'render.webgl2', requirement: 'required', purpose: 'The shared Three.js world render path.' }, { id: 'render.depth', requirement: 'required', purpose: 'Depth-tested model and proxy geometry.' }, { id: 'scene.3d', requirement: 'required', purpose: 'Model placement in the shared Scene Graph.' }, { id: 'camera.world', requirement: 'required', purpose: 'Fixed neutral stage framing.' }, { id: 'lighting', requirement: 'required', purpose: 'PBR model lighting.' }],
    ...base.authored,
    cameras: base.authored.cameras?.map(camera => ({ ...camera, fovDegrees: 44 })),
    environment: { ...background, controls: { backgroundColor: cinema2Ref(id('background')) } },
    parameters,
    modules: [{ id: moduleId, typeId: CINEMA2_THREE_SCENE_MODULE_TYPE_ID, version: 1, parameters: { ...moduleParameters, userModel: 'default-model' }, parameterBindings: { ...bindings, userModel: cinema2Ref(id('model')) }, config: { ...base.moduleConfig, userModelPreview: kind } }],
    render: {
      targets: [{ id: cinema2StableId(`${prefix}-target`), descriptor: { size: { kind: 'viewport' }, colorFormat: 'rgba8', depthFormat: 'depth24' } }],
      passes: [{ id: cinema2StableId(`${prefix}-pass`), kind: 'scene', scene: cinema2Ref(base.root), outputs: [{ id: cinema2StableId(`${prefix}-color`), target: cinema2Ref(cinema2StableId(`${prefix}-target`)), attachment: 'color' }] },
        { id: cinema2StableId(`${prefix}-output`), kind: 'output', inputs: [{ id: cinema2StableId(`${prefix}-input`), source: { pass: cinema2Ref(cinema2StableId(`${prefix}-pass`)), output: cinema2StableId(`${prefix}-color`) }, attachment: 'color' }] }],
      outputPass: cinema2Ref(cinema2StableId(`${prefix}-output`)),
    },
    output: { renderPass: cinema2Ref(cinema2StableId(`${prefix}-output`)), colorSpace: 'srgb', alphaMode: 'opaque' },
  }
}
