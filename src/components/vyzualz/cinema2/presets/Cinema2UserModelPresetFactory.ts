import { createCinema2ModelAudioParameters, MODEL_AUDIO_PROFILES, MODEL_AUDIO_TARGETS } from '../model/Cinema2ModelAudioChoreography'
import { createCinema2ModelCinematicParameters, createCinema2ModelCinematicGraph } from './Cinema2ModelCinematicAuthoring'
import { CINEMA2_NATIVE_PRESET_SCHEMA_ID, CINEMA2_NATIVE_PRESET_SCHEMA_VERSION, cinema2NamespacedId, cinema2Ref, cinema2StableId, type Cinema2ModuleId, type Cinema2NativePresetManifest, type Cinema2ParameterId, type Cinema2ParameterManifest, type Cinema2PresetId } from '../contracts/Cinema2NativePresetManifest'
import { createCinema2UserModelBaseEnvironment, createCinema2UserModelParameter } from '../model/Cinema2UserModelBaseEnvironment'
import { cinema2RepresentationPatternProperty, CINEMA2_USER_MODEL_PREVIEWS, type Cinema2UserModelPreviewKind } from '../model/Cinema2UserModelPreviewPatterns'
import { CINEMA2_STUDIO_NEUTRAL_ENVIRONMENT_ASSET_ID } from '../modules/three/Cinema2ThreeEnvironmentRegistry'
import { CINEMA2_THREE_SCENE_MODULE_TYPE_ID } from '../modules/Cinema2ThreeSceneModule'
import { CINEMA2_QUALITY_MODE_PARAMETER } from '../parameters/Cinema2PerformanceParameters'
import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from './Cinema2AfterhoursPreset'
export const CINEMA2_USER_MODEL_PREVIEW_DESCRIPTIONS = {
  form: 'Original saved PBR materials under neutral studio reflections, with six bounded whole-model choreographies.',
  shatter: 'Actual capped model fragments separate, rotate and reassemble; bounded geometric partitioning, not rigid-body simulation.',
  dust: 'Progressive surface dissolution, six particle choreographies, gathering and exact surface reassembly into your original model.',
  hologram: 'Thick structural edges, directional scan bands, rim light and contour echoes project across the actual model surfaces.',
  slices: 'Actual model surfaces clipped into material-preserving oriented sections with closed cut-face caps, six choreographies and reassembly.',
  voxel: 'Mesh-intersecting voxel grids fill closed models; open models use an explicitly diagnosed surface shell.',
} as const
export function cinema2UserModelPreviewParameterId(kind: Cinema2UserModelPreviewKind, property: string): Cinema2ParameterId { return cinema2StableId<Cinema2ParameterId>(`user-model-${kind}-${property.replace(/[A-Z]/g, letter => '-' + letter.toLowerCase())}`) }
export function createCinema2UserModelPreset(kind: Cinema2UserModelPreviewKind): Readonly<Cinema2NativePresetManifest> {
  const prefix = `user-model-${kind}`, moduleId = cinema2StableId<Cinema2ModuleId>(`${prefix}-scene`), base = createCinema2UserModelBaseEnvironment(moduleId, prefix)
  const id = (property: string) => cinema2UserModelPreviewParameterId(kind, property)
  const parameter = (property: string, label: string, type: Cinema2ParameterManifest['type'], value: Cinema2ParameterManifest['defaultValue'], parent: Cinema2ParameterManifest['designParentGroup'], extra: Partial<Cinema2ParameterManifest> = {}): Cinema2ParameterManifest => ({ id: id(property), label, type, defaultValue: value, section: 'Design', designParentGroup: parent, exposure: 'primary', persistence: 'preset', reset: 'authored-default', modulatable: false, choreographable: false, automatable: false, ...extra })
  const modes = Object.keys(CINEMA2_USER_MODEL_PREVIEWS) as Cinema2UserModelPreviewKind[]
  const options = modes.map(value => ({ value, label: value[0].toUpperCase() + value.slice(1) }))
  const enumOptions = (values: string[]) => values.map(value => ({ value, label: value[0].toUpperCase() + value.slice(1) }))
  const parameters: Cinema2ParameterManifest[] = [CINEMA2_QUALITY_MODE_PARAMETER,
    parameter('intensity', 'Master Intensity', 'float', 1, 'master-controls', { min: 0, max: 2, step: .01, order: 1 }),
    parameter('bpmSync', 'BPM Sync', 'boolean', true, 'master-controls', { order: 2, description: 'Motion follows the shared track grid/tempo; OFF uses a steady 120 BPM reference. Rhythm triggers continue following musical events.' }),
    parameter('autoPerformance', 'Auto Performance', 'boolean', false, 'master-controls', { order: 3, description: 'Lets the music take the Pattern for a moment: the preview gathers while a build charges and breaks into its most energetic arrangement from each drop, then your Pattern resumes. It never changes your Pattern, Pattern Change or Trigger, and choosing a Pattern during one ends it at once.' }),
    { ...createCinema2UserModelParameter(id('model')), order: 0, group: 'Model' },
    parameter('defaultRepresentation', 'Default Representation', 'enum', kind, 'design', { group: 'Model', order: 1, options }),
    parameter('representation', 'Active Representation', 'enum', 'default', 'design', { group: 'Model', order: 2, options: [{ value: 'default', label: 'Use Default' }, ...options], description: 'Switch representations without replacing the selected model or restarting the scene.' }),
    parameter('transitionDuration', 'Transition Duration', 'float', 0, 'design', { group: 'Model', order: 3, min: 0, max: 3, step: .05, unit: 's', description: 'Zero switches immediately; nonzero blends the two representations.' }),
    parameter('transitionEasing', 'Transition Easing', 'enum', 'smoothstep', 'design', { group: 'Model', order: 4, options: [{ value: 'linear', label: 'Linear' }, { value: 'smoothstep', label: 'Smooth' }] }),
    parameter('effectPose', 'Representation Pose', 'enum', 'cycle', 'design', { group: 'Model', order: 5, options: [{ value: 'cycle', label: 'Musical Cycle' }, { value: 'representation', label: 'Hold Representation' }], description: 'Musical Cycle preserves the original transform and reassembly choreography. Hold Representation keeps the chosen effect visible while patterns animate.' }),
    parameter('modelPosition', 'Model Position', 'vec3', [0, 0, 0], 'design', { group: 'Model Transform', order: 0, min: -2, max: 2, step: .01 }),
    parameter('modelRotation', 'Model Orientation', 'vec3', [0, 0, 0], 'design', { group: 'Model Transform', order: 1, min: -180, max: 180, step: 1, unit: '°' }),
    parameter('cameraOrbit', 'Camera Orbit', 'float', 0, 'design', { group: 'Camera', order: 0, min: -180, max: 180, step: 1, unit: '°' }),
    parameter('cameraElevation', 'Camera Elevation', 'float', Math.atan2(.35, 5.8) * 180 / Math.PI, 'design', { group: 'Camera', order: 1, min: -60, max: 60, unit: '°' }),
    parameter('cameraZoom', 'Camera Distance', 'float', Math.hypot(.35, 5.8), 'design', { group: 'Camera', order: 2, min: 3, max: 12 }),
    parameter('cameraTarget', 'Camera Target Offset', 'vec3', [0, 0, 0], 'design', { group: 'Camera', order: 3, min: -2, max: 2, step: .01 }),
    parameter('pattern', 'Pattern', 'enum', CINEMA2_USER_MODEL_PREVIEWS[kind][0], 'design', { group: 'Performance Pattern', order: 1, options: CINEMA2_USER_MODEL_PREVIEWS[kind].map((label, index) => ({ value: label, label: `${label} / ${MODEL_AUDIO_PROFILES[index]}` })), description: 'The existing six motions also select the musical representation sequence when Musical Representation Transitions is enabled.' }),
    ...modes.filter(mode => mode !== kind).map(mode => parameter(cinema2RepresentationPatternProperty(mode), `${options.find(option => option.value === mode)!.label} Pattern`, 'enum', CINEMA2_USER_MODEL_PREVIEWS[mode][0], 'design', { group: `${options.find(option => option.value === mode)!.label} Patterns`, order: 1, options: CINEMA2_USER_MODEL_PREVIEWS[mode].map(label => ({ value: label, label })) })),
    parameter('patternChange', 'Pattern Change', 'boolean', false, 'design', { group: 'Performance Pattern', order: 2 }),
    parameter('trigger', 'Trigger', 'enum', 'beat', 'design', { group: 'Performance Pattern', order: 3, options: CINEMA2_AFTERHOURS_TRIGGER_OPTIONS, visibleWhen: [{ kind: 'parameter-equals', parameterId: id('patternChange'), value: true }] }),
    parameter('movement', 'Movement Amount', 'float', .35, 'design', { order: 4, min: 0, max: .8, step: .01 }),
    parameter('speed', 'Movement Speed', 'float', 1, 'design', { order: 5, min: 0, max: 3, step: .01 }),
    ...[parameter('tintModel', 'Tint Model from Palette', 'boolean', false, 'effects', { order: 2, description: 'Off preserves the saved PBR material colors. On multiplies them by Primary and Secondary.' }),
      parameter('modelYaw', 'Model Rotation', 'float', 0, 'design', { group: 'Model Transform', order: 2, min: -180, max: 180, step: 1, unit: '°' }),
      parameter('modelScale', 'Model Scale', 'float', 1, 'design', { group: 'Model Transform', order: 3, min: .5, max: 1.2, step: .01 })],
    parameter('cycleBeats', 'Dissolve Cycle', 'float', 16, 'design', { order: 8, min: 8, max: 64, step: 4, unit: 'beats', description: 'Each selected Pattern completes a solid, dissolve, drift, gather and reform cycle even with Pattern Change off.' }),
    parameter('transformCycleBeats', 'Transformation Cycle', 'float', 16, 'design', { order: 8, min: 8, max: 64, step: 4, unit: 'beats', description: 'Each Pattern transforms and reforms the original model, independently of Pattern Change.' }),
    parameter('sliceCycleBeats', 'Slice Cycle', 'float', 16, 'design', { order: 8, min: 8, max: 64, step: 4, unit: 'beats', description: 'A complete assembled, separated and reassembled model cycle; runs with Pattern Change off.' }),
    parameter('opacity', 'Opacity', 'float', kind === 'hologram' ? .85 : 1, 'effects', { order: 0, min: .1, max: 1, step: .01 }),
    parameter('emission', 'Emission', 'float', kind === 'dust' || kind === 'hologram' ? .45 : 0, 'effects', { order: 1, min: 0, max: 2, step: .01 }),
    parameter('formMaterial', 'Form Material', 'enum', 'shared', 'effects', { group: 'Form', order: 0, options: [{ value: 'shared', label: 'Use Shared Tint' }, { value: 'original', label: 'Original PBR' }, { value: 'palette', label: 'Palette Tint' }] }),
    parameter('formDeformation', 'Surface Flex', 'float', 0, 'effects', { group: 'Form', order: 1, min: 0, max: 0.15, step: 0.005, modulatable: true, choreographable: true }),
    parameter('shardDetail', 'Fracture Detail', 'enum', 'auto', 'effects', { group: 'Shatter', order: 0, options: [{ value: 'auto', label: 'Auto (Quality Tier)' }, { value: '4', label: 'Legacy (4)' }, { value: '12', label: 'Legacy (12)' }, { value: '24', label: 'Legacy (24)' }, { value: '48', label: 'Low (up to 48)' }, { value: '96', label: 'Medium (up to 96)' }, { value: '192', label: 'High (up to 192)' }] }),
    parameter('shatterSpread', 'Shard Spread', 'float', 1, 'effects', { modulatable: true, choreographable: true, group: 'Shatter', order: 1, min: 0, max: 1, step: .01 }),
    parameter('shardMotion', 'Shard Rotation', 'float', 1, 'effects', { modulatable: true, choreographable: true, group: 'Shatter', order: 2, min: 0, max: 1, step: .01 }),
    parameter('shardDebris', 'Secondary Debris', 'float', 0.35, 'effects', { group: 'Shatter', order: 3, min: 0, max: 1, step: 0.01, modulatable: true, choreographable: true }),
    parameter('shardCracks', 'Fine Crack Separation', 'float', 0, 'effects', { group: 'Shatter', order: 4, min: 0, max: 1, step: 0.01, modulatable: true, choreographable: true }),
    parameter('dustDensity', 'Particle Density', 'float', 1, 'effects', { modulatable: true, choreographable: true, group: 'Dust', order: 0, min: .1, max: 1, step: .01 }),
    parameter('dustDrift', 'Particle Drift', 'float', 1, 'effects', { modulatable: true, choreographable: true, group: 'Dust', order: 1, min: 0, max: 1, step: .01 }),
    parameter('dustFlowDirection', 'Particle Vertical Flow Bias', 'float', 0, 'effects', { group: 'Dust', order: 8, min: -1, max: 1, step: .01 }),
    parameter('dustFlow', 'Particle Flow', 'float', 1, 'effects', { modulatable: true, choreographable: true, group: 'Dust', order: 2, min: 0, max: 2, step: .01 }),
    parameter('dustSize', 'Particle Size', 'float', 1, 'effects', { group: 'Dust', order: 3, min: 0.25, max: 3, step: 0.01, modulatable: true, choreographable: true }),
    parameter('dustTurbulence', 'Particle Turbulence', 'float', 0.5, 'effects', { group: 'Dust', order: 4, min: 0, max: 2, step: 0.01, modulatable: true, choreographable: true }),
    parameter('dustOpacity', 'Particle Opacity', 'float', 1, 'effects', { group: 'Dust', order: 5, min: 0, max: 1, step: 0.01, modulatable: true, choreographable: true }),
    parameter('hologramGlow', 'Hologram Glow', 'float', 0, 'effects', { modulatable: true, choreographable: true, group: 'Hologram', order: 0, min: 0, max: 2, step: .01 }),
    parameter('hologramTransparency', 'Hologram Transparency', 'float', 0, 'effects', { modulatable: true, choreographable: true, group: 'Hologram', order: 1, min: 0, max: .9, step: .01 }),
    parameter('hologramLines', 'Structural / Scan Line Density', 'float', 1, 'effects', { modulatable: true, choreographable: true, group: 'Hologram', order: 2, min: .25, max: 2, step: .01 }),
    parameter('hologramThickness', 'Structural Line Thickness', 'float', 1, 'effects', { group: 'Hologram', order: 3, min: 0.25, max: 3, step: 0.01, modulatable: true, choreographable: true }),
    parameter('hologramScanWidth', 'Scan Band Width', 'float', 0.12, 'effects', { group: 'Hologram', order: 4, min: 0.02, max: 0.5, step: 0.01, modulatable: true, choreographable: true }),
    parameter('hologramRim', 'Rim Intensity', 'float', 1, 'effects', { group: 'Hologram', order: 5, min: 0, max: 3, step: 0.01, modulatable: true, choreographable: true }),
    parameter('hologramScanSpeed', 'Scan Speed', 'float', 1, 'effects', { group: 'Hologram', order: 6, min: 0, max: 3, step: 0.01, modulatable: true, choreographable: true }),
    parameter('hologramScanDirection', 'Scan Direction', 'enum', 'y', 'effects', { group: 'Hologram', order: 7, options: enumOptions(['y', 'x', 'z', 'diagonal']) }),
    parameter('sliceSeparation', 'Slice Separation', 'float', 1, 'effects', { modulatable: true, choreographable: true, group: 'Slices', order: 0, min: 0, max: 1, step: .01 }),
    parameter('sliceDirection', 'Separation Direction', 'enum', 'y', 'effects', { group: 'Slices', order: 1, options: enumOptions(['x', 'y', 'z']) }),
    parameter('sliceCount', 'Slice Count', 'float', 14, 'effects', { group: 'Slices', order: 2, min: 2, max: 24, step: 1 }),
    parameter('sliceAxis', 'Cut Orientation', 'enum', 'y', 'effects', { group: 'Slices', order: 3, options: enumOptions(['x', 'y', 'z']) }),
    parameter('voxelDetail', 'Block Detail', 'enum', 'auto', 'effects', { group: 'Voxel', order: 0, options: enumOptions(['auto', 'low', 'medium', 'high']), description: 'Selects an existing occupancy grid, capped by global render quality.' }),
    parameter('voxelSeparation', 'Block Separation', 'float', 1, 'effects', { modulatable: true, choreographable: true, group: 'Voxel', order: 1, min: 0, max: 1, step: .01 }),
    parameter('voxelRotation', 'Block Rotation', 'float', 0.5, 'effects', { group: 'Voxel', order: 2, min: 0, max: 1, step: 0.01, modulatable: true, choreographable: true }),
    parameter('voxelVariation', 'Block Size Variation', 'float', 0.2, 'effects', { group: 'Voxel', order: 3, min: 0, max: 1, step: 0.01, modulatable: true, choreographable: true }),
    ...([
      ['shardImpulse', 'Fragment Impulse', 'Shatter'], ['shardReassembly', 'Fragment Reassembly', 'Shatter'],
      ['dustImpulse', 'Particle Expansion Wave', 'Dust'], ['dustSparkle', 'Particle Sparkle', 'Dust'], ['dustBrightness', 'Particle Brightness', 'Dust'], ['dustReassembly', 'Particle Reassembly', 'Dust'],
      ['hologramFlash', 'Scan Flash', 'Hologram'], ['hologramInterference', 'Signal Interference', 'Hologram'], ['hologramEcho', 'Contour Echo', 'Hologram'], ['hologramDistortion', 'Scan Distortion', 'Hologram'],
    ] as const).map(([key, label, group], index) => parameter(key, label, 'float', 0, 'effects', { group, order: 10 + index, min: 0, max: 1, step: .01, modulatable: true, choreographable: true })),
    ...createCinema2ModelCinematicParameters(id),
    parameter('background', 'Background', 'color', [.025, .035, .045, 1], 'palette', { order: 0 }),
    parameter('primary', 'Primary', 'color', kind === 'shatter' ? [1, .55, .22, 1] : [.4, .8, 1, 1], 'palette', { order: 1, description: 'Primary dust grains and hologram projection, or optional model/voxel tint.' }),
    parameter('secondary', 'Secondary', 'color', [.8, .3, .85, 1], 'palette', { order: 2, description: 'Secondary dust grains, or optional side-material and voxel tint.' }),
    parameter('accent', 'Accent', 'color', [.15, .95, .65, 1], 'palette', { order: 3, description: 'Stage rim light, model cut faces, hologram contours and dust dissolution edge.' }),
    parameter('reactivity', 'Reactive Strength', 'float', .6, undefined, { section: 'React', group: 'Model Response', order: 0, min: 0, max: 1, step: .01 }),
    parameter('response', 'Response Decay', 'float', .35, undefined, { section: 'React', group: 'Model Response', order: 1, min: .05, max: 1.5, step: .01, unit: 's' }),
  ]
  for (const definition of parameters) if (MODEL_AUDIO_TARGETS.some(key => id(key) === definition.id)) { definition.modulatable = true; definition.choreographable = true }
  const audioParameters = createCinema2ModelAudioParameters(kind, parameters)
  const moduleParameters = Object.fromEntries([...parameters, ...audioParameters.filter(p => p.id === id('audioRepresentationDirector') || p.id === id('audioMappingsEnabled'))].filter(p => !['model', 'background', 'cameraOrbit', 'cameraElevation', 'cameraZoom', 'cameraTarget'].some(key => id(key) === p.id) && p.id !== CINEMA2_QUALITY_MODE_PARAMETER.id).map(p => [String(p.id).slice(prefix.length + 1).replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase()), p.defaultValue!]))
  const bindings = Object.fromEntries(Object.keys(moduleParameters).map(property => [property, cinema2Ref(id(property))]))
  const background = base.authored.environment!
  return {
    schemaId: CINEMA2_NATIVE_PRESET_SCHEMA_ID, schemaVersion: CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
    id: cinema2NamespacedId<Cinema2PresetId>(`drmvyz.cinema2.${prefix}`), // Additive controls retain revision 1 so existing pinned model/version selections restore.
    revision: 1,
    metadata: { name: `3D ${kind.toUpperCase()} (Preview)`, description: `Reference preview: ${CINEMA2_USER_MODEL_PREVIEW_DESCRIPTIONS[kind]} Uses your pinned model; the model slot stays empty until it is ready. Neutral studio stage with model-based choreography.`, tags: ['reference', 'preview', 'user-model', '3d', kind] },
    capabilities: [{ id: 'render.webgl2', requirement: 'required', purpose: 'The shared Three.js world render path.' }, { id: 'render.depth', requirement: 'required', purpose: 'Depth-tested model effects.' }, { id: 'scene.3d', requirement: 'required', purpose: 'Model placement in the shared Scene Graph.' }, { id: 'camera.world', requirement: 'required', purpose: 'Fixed neutral stage framing.' }, { id: 'lighting', requirement: 'required', purpose: 'PBR model lighting.' }, { id: 'render.history', requirement: 'optional', purpose: 'Opt-in temporal trails.' }],
    ...base.authored,
    cameras: base.authored.cameras?.map(camera => ({ ...camera, fovDegrees: 38, transform: { position: [0, 1.45, 5.8] as [number, number, number] }, rig: { kind: 'orbit' as const, radius: Math.hypot(.35, 5.8), azimuthDegrees: 0, elevationDegrees: Math.atan2(.35, 5.8) * 180 / Math.PI, angularVelocityDegreesPerSecond: 0 }, controls: { orbitRadius: cinema2Ref(id('cameraZoom')), orbitAzimuthDegrees: cinema2Ref(id('cameraOrbit')), orbitElevationDegrees: cinema2Ref(id('cameraElevation')), targetOffset: cinema2Ref(id('cameraTarget')) } })),
    lighting: { lights: [
      { id: cinema2StableId(`${prefix}-ambient`), type: 'ambient', color: [1,1,1,1], intensity: .4, controls: { color: cinema2Ref(id('cinematicAmbientColor')), intensity: cinema2Ref(id('cinematicAmbientIntensity')) } },
      ...(['Key','Fill','StageRim'] as const).map((name, index) => ({ id: cinema2StableId<import('../contracts/Cinema2NativePresetManifest').Cinema2LightId>(`${prefix}-${name === 'StageRim' ? 'rim' : name.toLowerCase()}`), type: 'directional' as const, color: [1,1,1,1] as const, intensity: index === 0 ? 1.2 : .5, targetNode: cinema2Ref(base.node), transform: { position: [3,6,4] as const }, controls: { color: cinema2Ref(id(`cinematic${name}Color`)), intensity: cinema2Ref(id(`cinematic${name}Intensity`)), position: cinema2Ref(id(`cinematic${name}Position`)) } })),
    ] },
    environment: { ...background, controls: { backgroundColor: cinema2Ref(id('background')), fogColor: cinema2Ref(id('cinematicFogColor')), fogDensity: cinema2Ref(id('cinematicFogDensity')) } },
    parameters: [...parameters, ...audioParameters],
    modules: [{ id: moduleId, typeId: CINEMA2_THREE_SCENE_MODULE_TYPE_ID, version: 1, parameters: { ...moduleParameters, userModel: 'default-model' }, parameterBindings: { ...bindings, userModel: cinema2Ref(id('model')) }, config: { ...base.moduleConfig, ...{ environment: CINEMA2_STUDIO_NEUTRAL_ENVIRONMENT_ASSET_ID, userModel: { ...base.moduleConfig.userModel, neutralFloor: false } }, userModelPreview: kind, hdr: true } }],
    ...createCinema2ModelCinematicGraph(prefix, id, base.root),
  }
}
