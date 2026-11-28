import { createCinema2ModelCinematicGraph } from './Cinema2ModelCinematicAuthoring'
import { withCinema2MoodDrives } from './Cinema2MoodConductorAuthoring'
import { CINEMA2_NATIVE_PRESET_SCHEMA_ID, CINEMA2_NATIVE_PRESET_SCHEMA_VERSION, cinema2NamespacedId, cinema2Ref, cinema2StableId, type Cinema2ModuleId, type Cinema2NativePresetManifest, type Cinema2ParameterId, type Cinema2ParameterManifest, type Cinema2PresetId } from '../contracts/Cinema2NativePresetManifest'
import { createCinema2UserModelBaseEnvironment, createCinema2UserModelParameter } from '../model/Cinema2UserModelBaseEnvironment'
import { CINEMA2_USER_MODEL_PREVIEWS, type Cinema2UserModelPreviewKind } from '../model/Cinema2UserModelPreviewPatterns'
import { CINEMA2_STUDIO_NEUTRAL_ENVIRONMENT_ASSET_ID } from '../modules/three/Cinema2ThreeEnvironmentRegistry'
import { CINEMA2_THREE_SCENE_MODULE_TYPE_ID } from '../modules/Cinema2ThreeSceneModule'
import { CINEMA2_QUALITY_MODE_PARAMETER } from '../parameters/Cinema2PerformanceParameters'
import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from './Cinema2AfterhoursPreset'
export const CINEMA2_USER_MODEL_PREVIEW_DESCRIPTIONS = {
  form: 'Original saved PBR materials under neutral studio reflections, with six bounded whole-model choreographies.',
  shatter: 'The intact model fractures into moving geometry and reassembles to the original logo.',
  dust: 'The original model dissolves into moving particles, gathers and reforms.',
  hologram: 'The original model transitions into a holographic projection and resolves back to its original surfaces.',
  slices: 'The intact model separates into material-preserving sections and returns to its original geometry.',
  voxel: 'Mesh-intersecting voxel grids fill closed models; open models use an explicitly diagnosed surface shell.',
} as const
export function cinema2UserModelPreviewParameterId(kind: Cinema2UserModelPreviewKind, property: string): Cinema2ParameterId { return cinema2StableId<Cinema2ParameterId>(`user-model-${kind}-${property.replace(/[A-Z]/g, letter => '-' + letter.toLowerCase())}`) }
export function createCinema2UserModelPreset(kind: Cinema2UserModelPreviewKind): Readonly<Cinema2NativePresetManifest> {
  const prefix = `user-model-${kind}`, moduleId = cinema2StableId<Cinema2ModuleId>(`${prefix}-scene`), base = createCinema2UserModelBaseEnvironment(moduleId, prefix)
  const id = (property: string) => cinema2UserModelPreviewParameterId(kind, property)
  const parameter = (property: string, label: string, type: Cinema2ParameterManifest['type'], value: Cinema2ParameterManifest['defaultValue'], parent: Cinema2ParameterManifest['designParentGroup'], extra: Partial<Cinema2ParameterManifest> = {}): Cinema2ParameterManifest => ({ id: id(property), label, type, defaultValue: value, section: 'Design', designParentGroup: parent, exposure: 'primary', persistence: 'preset', reset: 'authored-default', modulatable: false, choreographable: false, automatable: false, ...extra })
  // Each preview exposes only controls for its own representation. No operator-facing
  // representation switches, modulation matrix, look macros or competing cycle controls.
  const representationParameters: Record<Cinema2UserModelPreviewKind, Cinema2ParameterManifest[]> = {
    form: [
      parameter('formDeformation', 'Surface Flex', 'float', 0, 'effects', { order: 1, min: 0, max: 0.15, step: 0.005 }),
      parameter('tintModel', 'Tint Model from Palette', 'boolean', false, 'effects', { order: 10 }),
    ],
    shatter: [
      parameter('shatterSpread', 'Shard Spread', 'float', 1, 'effects', { order: 1, min: .05, max: 1, step: .01 }),
      parameter('shardMotion', 'Shard Rotation', 'float', 1, 'effects', { order: 2, min: 0, max: 1, step: .01 }),
      parameter('shardDebris', 'Secondary Debris', 'float', 0.35, 'effects', { order: 3, min: 0, max: 1, step: 0.01 }),
      parameter('tintModel', 'Tint Model from Palette', 'boolean', false, 'effects', { order: 10 }),
    ],
    dust: [
      parameter('dustDensity', 'Particle Density', 'float', 1, 'effects', { order: 0, min: .1, max: 1, step: .01 }),
      parameter('dustDrift', 'Particle Drift', 'float', .35, 'effects', { order: 1, min: 0, max: 1, step: .01 }),
      parameter('dustSize', 'Particle Size', 'float', 1.4, 'effects', { order: 3, min: 0.25, max: 3, step: 0.01 }),
      parameter('dustTurbulence', 'Particle Turbulence', 'float', 0.5, 'effects', { order: 4, min: 0, max: 2, step: 0.01 }),
    ],
    hologram: [
      parameter('hologramLines', 'Structural / Scan Line Density', 'float', 1, 'effects', { order: 2, min: .25, max: 2, step: .01 }),
      parameter('hologramThickness', 'Structural Line Thickness', 'float', 1, 'effects', { order: 3, min: 0.25, max: 3, step: 0.01 }),
      parameter('hologramScanSpeed', 'Scan Speed', 'float', 1, 'effects', { order: 6, min: 0, max: 3, step: 0.01 }),
    ],
    slices: [
      parameter('sliceSeparation', 'Slice Separation', 'float', 1, 'effects', { order: 0, min: .05, max: 1, step: .01 }),
      parameter('sliceCount', 'Slice Count', 'float', 14, 'effects', { order: 2, min: 2, max: 24, step: 1 }),
      parameter('sliceAxis', 'Cut Orientation', 'enum', 'y', 'effects', { order: 3, options: [{ value: 'x', label: 'Vertical' }, { value: 'y', label: 'Horizontal' }, { value: 'z', label: 'Depth' }] }),
      parameter('tintModel', 'Tint Model from Palette', 'boolean', false, 'effects', { order: 10 }),
    ],
    voxel: [
      parameter('voxelSeparation', 'Block Separation', 'float', 1, 'effects', { order: 1, min: .05, max: 1, step: .01 }),
      parameter('voxelRotation', 'Block Rotation', 'float', 0.5, 'effects', { order: 2, min: 0, max: 1, step: 0.01 }),
      parameter('voxelVariation', 'Block Size Variation', 'float', 0.2, 'effects', { order: 3, min: 0, max: 1, step: 0.01 }),
      parameter('tintModel', 'Tint Model from Palette', 'boolean', false, 'effects', { order: 10 }),
    ],
  }
  const parameters: Cinema2ParameterManifest[] = [CINEMA2_QUALITY_MODE_PARAMETER,
    parameter('intensity', 'Master Intensity', 'float', 1, 'master-controls', { min: 0, max: 2, step: .01, order: 1 }),
    parameter('bpmSync', 'BPM Sync', 'boolean', true, 'master-controls', { order: 2, description: 'Motion follows the shared track grid/tempo; OFF uses a steady 120 BPM reference. Rhythm triggers continue following musical events.' }),
    parameter('autoPerformance', 'Auto Performance', 'boolean', false, 'master-controls', { order: 3, description: 'Uses the shared Mood Conductor and the selected representation’s own patterns. Saved settings are not overwritten.' }),
    { ...createCinema2UserModelParameter(id('model')), order: 0 },
    parameter('pattern', 'Pattern', 'enum', CINEMA2_USER_MODEL_PREVIEWS[kind][0], 'design', { group: 'Performance Pattern', order: 1, options: CINEMA2_USER_MODEL_PREVIEWS[kind].map(label => ({ value: label, label })) }),
    parameter('patternChange', 'Pattern Change', 'boolean', false, 'design', { group: 'Performance Pattern', order: 2 }),
    parameter('trigger', 'Trigger', 'enum', 'beat', 'design', { group: 'Performance Pattern', order: 3, options: CINEMA2_AFTERHOURS_TRIGGER_OPTIONS, visibleWhen: [{ kind: 'parameter-equals', parameterId: id('patternChange'), value: true }] }),
    parameter('movement', 'Movement Amount', 'float', .35, 'design', { order: 4, min: 0, max: .8, step: .01 }),
    parameter('speed', 'Movement Speed', 'float', 1, 'design', { order: 5, min: 0, max: 3, step: .01 }),
    parameter('modelYaw', 'Model Rotation', 'float', 0, 'design', { order: 6, min: -180, max: 180, step: 1, unit: '°' }),
    parameter('modelScale', 'Model Scale', 'float', 1, 'design', { order: 7, min: .5, max: 1.2, step: .01 }),
    parameter('cameraZoom', 'Camera Distance', 'float', Math.hypot(.35, 5.8), 'design', { group: 'Camera', order: 2, min: 3, max: 12 }),
    parameter('cinematicBloom', 'Glow', 'float', kind === 'dust' || kind === 'hologram' ? .35 : .15, 'effects', { order: 0, min: 0, max: 1.5, step: .01 }),
    parameter('background', 'Background', 'color', [.025, .035, .045, 1], 'palette', { order: 0 }),
    parameter('primary', 'Primary', 'color', kind === 'dust' || kind === 'hologram' ? [.4,.8,1,1] : [1,.96,.9,1], 'palette', { order: 1 }),
    parameter('secondary', 'Secondary', 'color', kind === 'dust' ? [.8,.3,.85,1] : [.55,.65,1,1], 'palette', { order: 2 }),
    parameter('accent', 'Accent', 'color', [.15,.95,.65,1], 'palette', { order: 3 }),
    parameter('reactivity', 'Reactive Strength', 'float', .6, undefined, { section: 'React', order: 0, min: 0, max: 1, step: .01 }),
    parameter('response', 'Response Decay', 'float', .35, undefined, { section: 'React', order: 1, min: .05, max: 1.5, step: .01, unit: 's' }),
    ...representationParameters[kind],
  ]
  const moduleParameters = Object.fromEntries(parameters.filter(p => !['model', 'background', 'cameraZoom', 'cinematicBloom'].some(key => id(key) === p.id) && p.id !== CINEMA2_QUALITY_MODE_PARAMETER.id).map(p => [String(p.id).slice(prefix.length + 1).replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase()), p.defaultValue!]))
  const bindings = Object.fromEntries(Object.keys(moduleParameters).map(property => [property, cinema2Ref(id(property))]))
  // Preview-only constants are not parameter definitions and cannot be restored from a saved Inspector state.
  const manifest: Cinema2NativePresetManifest = {
    schemaId: CINEMA2_NATIVE_PRESET_SCHEMA_ID, schemaVersion: CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
    id: cinema2NamespacedId<Cinema2PresetId>(`drmvyz.cinema2.${prefix}`), revision: 1,
    metadata: { name: `3D ${kind.toUpperCase()} (Preview)`, description: `Reference preview: ${CINEMA2_USER_MODEL_PREVIEW_DESCRIPTIONS[kind]} Select a user model in Source; each pattern reveals, transforms and restores the model with musical timing.`, tags: ['reference', 'preview', 'user-model', '3d', kind] },
    capabilities: [{ id: 'render.webgl2', requirement: 'required', purpose: 'The shared Three.js world render path.' }, { id: 'render.depth', requirement: 'required', purpose: 'Depth-tested model effects.' }, { id: 'scene.3d', requirement: 'required', purpose: 'Model placement in the shared Scene Graph.' }, { id: 'camera.world', requirement: 'required', purpose: 'Neutral stage framing.' }, { id: 'lighting', requirement: 'required', purpose: 'PBR model lighting.' }],
    ...base.authored,
    cameras: base.authored.cameras?.map(camera => ({ ...camera, fovDegrees: 38, transform: { position: [0, 1.45, 5.8] as [number, number, number] }, rig: { kind: 'orbit' as const, radius: Math.hypot(.35, 5.8), azimuthDegrees: 0, elevationDegrees: Math.atan2(.35, 5.8) * 180 / Math.PI, angularVelocityDegreesPerSecond: 0 }, controls: { orbitRadius: cinema2Ref(id('cameraZoom')) } })),
    lighting: { lights: [
      { id: cinema2StableId(`${prefix}-ambient`), type: 'ambient', color: [1,1,1,1], intensity: .55 },
      { id: cinema2StableId(`${prefix}-key`), type: 'directional', color: [1,.96,.9,1], intensity: 1.5, targetNode: cinema2Ref(base.node), transform: { position: [3,6,4] }, controls: { color: cinema2Ref(id('primary')) } },
      { id: cinema2StableId(`${prefix}-fill`), type: 'directional', color: [.55,.65,1,1], intensity: .65, targetNode: cinema2Ref(base.node), transform: { position: [-4,2,2] }, controls: { color: cinema2Ref(id('secondary')) } },
      { id: cinema2StableId(`${prefix}-rim`), type: 'directional', color: [.15,.95,.65,1], intensity: .9, targetNode: cinema2Ref(base.node), transform: { position: [-3,2,-3] }, controls: { color: cinema2Ref(id('accent')) } },
    ] },
    environment: { ...base.authored.environment!, fog: { mode: 'exponential', color: [0,0,0,1], density: 0 }, controls: { backgroundColor: cinema2Ref(id('background')) } },
    parameters,
    modules: [{ id: moduleId, typeId: CINEMA2_THREE_SCENE_MODULE_TYPE_ID, version: 1, parameters: { ...moduleParameters, userModel: 'default-model', effectPose: 'logo-cycle', emission: kind === 'dust' || kind === 'hologram' ? .45 : 0, opacity: kind === 'hologram' ? .65 : 1 }, parameterBindings: { ...bindings, userModel: cinema2Ref(id('model')) }, config: { ...base.moduleConfig, environment: CINEMA2_STUDIO_NEUTRAL_ENVIRONMENT_ASSET_ID, userModel: { ...base.moduleConfig.userModel, neutralFloor: false }, userModelPreview: kind, hdr: true } }],
    ...createCinema2ModelCinematicGraph(prefix, id, base.root, true),
  }
  // Standard shared Auto Performance policy; the six native pattern engines own the visual choreography.
  return withCinema2MoodDrives(manifest, { idPrefix: prefix, enabledParameter: id('autoPerformance'), drives: [], patternControls: { patternChange: id('patternChange'), trigger: id('trigger') } })
}
