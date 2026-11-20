import {
  CINEMA2_NATIVE_PRESET_SCHEMA_ID, CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  cinema2NamespacedId, cinema2Ref, cinema2StableId,
  type Cinema2CameraId, type Cinema2CapabilityId, type Cinema2ChoreographyActionId, type Cinema2ChoreographyContinuousSourcePath, type Cinema2ChoreographyRuleId, type Cinema2ChoreographyRuleManifest, type Cinema2EffectId, type Cinema2LightGroupId, type Cinema2LightId, type Cinema2ModuleId, type Cinema2NativePresetManifest, type Cinema2ParameterId, type Cinema2ParameterManifest,
  type Cinema2PresetId, type Cinema2RenderPassId, type Cinema2RenderSlotId, type Cinema2Vector3,
  type Cinema2RenderTargetId, type Cinema2SceneNodeId,
} from '../contracts/Cinema2NativePresetManifest'
import { CINEMA2_CHAMBER_MODULE_TYPE_ID } from '../modules/Cinema2ChamberNativeModule'
import { CHAMBER_PALETTE_DEFAULTS, CHAMBER_PALETTE_NAMES } from '../modules/chamber/Cinema2ChamberPalette'
import { CINEMA2_CHAMBER_DEFAULT_PATTERN, CINEMA2_CHAMBER_PATTERNS } from '../modules/chamber/Cinema2ChamberPatterns'
import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from './Cinema2AfterhoursPreset'
import { withCinema2MoodDrives, type Cinema2MoodDrive } from './Cinema2MoodConductorAuthoring'

export const CINEMA2_CHAMBER_PRESET_ID = cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.chamber')
export const chamberParameterId = (name: string) => cinema2StableId<Cinema2ParameterId>(`chamber-${name.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}`)
const bind = (name: string) => cinema2Ref(chamberParameterId(name))
const base = { section: 'Design', exposure: 'primary', persistence: 'preset', reset: 'authored-default' } as const
const number = (name: string, label: string, parent: Cinema2ParameterManifest['designParentGroup'], value: number, min: number, max: number, order: number, group?: string, description?: string, step = .01): Cinema2ParameterManifest =>
  ({ ...base, id: chamberParameterId(name), label, type: 'float', defaultValue: value, min, max, step, designParentGroup: parent, order, group, ...(description ? { description } : {}) })
const toggle = (name: string, label: string, parent: Cinema2ParameterManifest['designParentGroup'], value: boolean, order: number, description?: string): Cinema2ParameterManifest =>
  ({ ...base, id: chamberParameterId(name), label, type: 'boolean', defaultValue: value, designParentGroup: parent, order, ...(description ? { description } : {}) })
const cameraMode = chamberParameterId('cameraMode')
const when = (value: string) => [{ kind: 'parameter-equals' as const, parameterId: cameraMode, value }]

/** Authored light levels; the Lights controls start here, so the defaults are the original look. */
const LIGHTS = { floorPool: .22, deviceGlow: .025, platformGlow: .05, windowSpill: .22, rim: .08, fill: .025 } as const
const PALETTE_LABELS = { ringColor: 'Platform Ring', tickColor: 'Floor Ticks', beaconColor: 'Corner Beacons', lampColor: 'Arm Lamps', coreColor: 'Core Lamp' } as const
const SPILL_COLOR = [0, .65, .9, 1] as const
const HOME_EYE: Cinema2Vector3 = [0, 3.6, 8], HOME_TARGET: Cinema2Vector3 = [0, 3.8, -.3]
/** Interior Drift: a slow arc round the platform (about 26 degrees either way, with a little rise and fall), always looking at the centre; it starts and ends on the home view. */
const DRIFT_POINTS = Array.from({ length: 24 }, (_, i) => {
  const t = i / 24, azimuth = 26 * Math.PI / 180 * Math.sin(t * Math.PI * 2), radius = 8.3
  return { position: [radius * Math.sin(azimuth), 3.6 + .45 * Math.sin(t * Math.PI * 4), HOME_TARGET[2] + radius * Math.cos(azimuth)] as Cinema2Vector3, target: HOME_TARGET }
})

const PARAMETERS: readonly Cinema2ParameterManifest[] = [
  toggle('bpmSync', 'BPM Sync', 'master-controls', true, 0, 'Locks the camera drift and the light programs to the track tempo. Off, they run at a steady 120 BPM.'),
  number('intensity', 'Intensity', 'master-controls', 1, 0, 2, 1, undefined, 'Scales every glowing element: the platform ring, floor ticks, corner beacons, arm lamps and the lamp under the device.'),
  number('reactivity', 'Audio Reactivity', 'master-controls', .65, 0, 1, 2, undefined, 'How strongly the glow and the lights follow the music. At 0 the music moves nothing.'),
  toggle('zoomOnKick', 'Zoom on Kick', 'master-controls', true, 3, 'On: the lens punches in a little on every kick, then eases back. Only the field of view changes.'),
  toggle('autoPerformance', 'Auto Performance', 'master-controls', false, 4, 'The music runs the show: it moves the controls with the mood of the passage, chooses how often the Pattern changes, and puts Charge Ring on stage for a build and Lockdown Flash for a drop.'),
  { ...base, id: chamberParameterId('pattern'), label: 'Pattern', type: 'enum', defaultValue: CINEMA2_CHAMBER_DEFAULT_PATTERN, options: CINEMA2_CHAMBER_PATTERNS, designParentGroup: 'design', group: 'Pattern', order: 0,
    description: 'The light program the glowing elements play. Standby is the original, steady look.' },
  { ...toggle('patternChange', 'Pattern Change', 'design', false, 1, 'Advances to the next Pattern each time the Trigger fires.'), group: 'Pattern' },
  { ...base, id: chamberParameterId('trigger'), label: 'Trigger', type: 'enum', defaultValue: 'bar4', options: CINEMA2_AFTERHOURS_TRIGGER_OPTIONS, designParentGroup: 'design', group: 'Pattern', order: 2,
    description: 'The musical event that advances the Pattern.', visibleWhen: [{ kind: 'parameter-equals', parameterId: chamberParameterId('patternChange'), value: true }] },
  number('ringLight', 'Platform Ring', 'design', 1, 0, 2, 0, 'Emission', 'Brightness of the glowing ring around the platform.'),
  number('tickLight', 'Floor Ticks', 'design', 1, 0, 2, 1, 'Emission', 'Brightness of the eight radial marks on the floor.'),
  number('beaconLight', 'Corner Beacons', 'design', 1, 0, 2, 2, 'Emission', 'Brightness of the four beacons at the corners of the floor.'),
  number('lampLight', 'Arm Lamps', 'design', 1, 0, 2, 3, 'Emission', 'Brightness of the cyan lamps on the device\'s two arms.'),
  number('coreLight', 'Core Lamp', 'design', 1, 0, 2, 4, 'Emission', 'Brightness of the white lamp under the device.'),
  number('armMotion', 'Arm Motion', 'design', 1, 0, 1.5, 0, 'Device', 'How far the device\'s two arms swing and turn in the light programs. Standby keeps them still.'),
  number('scoreAmount', 'Kick Ripple', 'design', .5, 0, 1, 1, 'Device', 'How strongly each kick sends a ripple outward through the glowing elements: the core lamp, the arm lamps, the ring, the floor ticks and the beacons.'),
  number('floorPool', 'Floor Pool', 'design', LIGHTS.floorPool, 0, 1, 0, 'Lights', 'The soft light pool on the platform.', .005),
  number('platformGlow', 'Platform Glow', 'design', LIGHTS.platformGlow, 0, .3, 1, 'Lights', 'The teal glow from under the platform.', .005),
  number('deviceGlow', 'Device Glow', 'design', LIGHTS.deviceGlow, 0, .2, 2, 'Lights', 'The cyan light from the device.', .005),
  number('windowSpill', 'Window Spill', 'design', LIGHTS.windowSpill, 0, 1, 3, 'Lights', 'The blue light spilling in from the window on the left.', .005),
  number('rim', 'Rim Light', 'design', LIGHTS.rim, 0, .5, 4, 'Lights', 'The cool light from above and behind that outlines the device.', .005),
  number('fill', 'Ambient Fill', 'design', LIGHTS.fill, 0, .2, 5, 'Lights', 'The faint overall fill.', .005),
  number('reflections', 'Reflections', 'design', .015, 0, .1, 6, 'Lights', 'How strongly the glossy metal reflects the studio environment.', .001),
  { ...base, id: cameraMode, label: 'Camera Mode', type: 'enum', defaultValue: 'home', designParentGroup: 'design', group: 'Camera', order: 0,
    options: [{ value: 'home', label: 'Home View' }, { value: 'drift', label: 'Interior Drift' }, { value: 'manual', label: 'Manual View' }],
    description: 'Home View is the fixed framing. Interior Drift swings slowly round the platform. Manual View lets you place the camera.' },
  { ...number('cameraSpeed', 'View Motion Speed', 'design', 1, 0, 2, 1, 'Camera', 'How fast the view drifts. With BPM Sync on it also follows the track tempo.'), visibleWhen: when('drift') },
  { ...number('cameraHeading', 'Camera Heading', 'design', 0, -60, 60, 2, 'Camera', 'Turns the camera round the platform, in degrees.'), step: 1, visibleWhen: when('manual') },
  { ...number('cameraElevation', 'Camera Elevation', 'design', 0, -10, 40, 3, 'Camera', 'Raises or lowers the camera, in degrees.'), step: 1, visibleWhen: when('manual') },
  { ...number('cameraDistance', 'Camera Distance', 'design', 8.3, 6, 9.4, 4, 'Camera', 'How far the camera stands from the platform.'), visibleWhen: when('manual') },
  { ...number('cameraFov', 'Field of View', 'design', 56, 40, 75, 5, 'Camera', 'The width of the view, in degrees.'), step: 1 },
  number('bloom', 'Bloom', 'effects', 1, 0, 3, 0, undefined, 'The glow around every lit element.'),
  number('exposure', 'Exposure', 'effects', 1, .5, 2, 1, undefined, 'Overall brightness of the picture.'),
  number('vignette', 'Vignette', 'effects', 0, 0, 1, 2, undefined, 'Darkens the corners of the picture.'),
  ...CHAMBER_PALETTE_NAMES.map((name, order): Cinema2ParameterManifest => ({ ...base, id: chamberParameterId(name), label: PALETTE_LABELS[name], type: 'color', defaultValue: CHAMBER_PALETTE_DEFAULTS[name], designParentGroup: 'palette', order })),
  { ...base, id: chamberParameterId('spillColor'), label: 'Window Spill', type: 'color', defaultValue: SPILL_COLOR, designParentGroup: 'palette', order: CHAMBER_PALETTE_NAMES.length },
]
const MODULE_BINDINGS = ['bpmSync', 'intensity', 'reactivity', 'autoPerformance', 'pattern', 'patternChange', 'trigger', 'ringLight', 'tickLight', 'beaconLight', 'lampLight', 'coreLight', 'armMotion', 'scoreAmount', ...CHAMBER_PALETTE_NAMES] as const
/** Score channels the choreography sets (kick ripple); they are module inputs, not controls. */
const SCORE_CHANNELS = ['cueCore', 'cueLamps', 'cueRing', 'cueTicks', 'cueBeacons'] as const

const root = cinema2StableId<Cinema2SceneNodeId>('chamber-root')
const room = cinema2StableId<Cinema2SceneNodeId>('chamber-room')
const moduleId = cinema2StableId<Cinema2ModuleId>('chamber-scene')
const camera = cinema2StableId<Cinema2CameraId>('chamber-camera')
const target = cinema2StableId<Cinema2RenderTargetId>('chamber-target')
const scenePass = cinema2StableId<Cinema2RenderPassId>('chamber-world')
const color = cinema2StableId<Cinema2RenderSlotId>('chamber-world-color')
const outputPass = cinema2StableId<Cinema2RenderPassId>('chamber-output')
const bloom = cinema2StableId<Cinema2EffectId>('chamber-source-bloom')
const finish = cinema2StableId<Cinema2EffectId>('chamber-source-finish')
const bloomPass = cinema2StableId<Cinema2RenderPassId>('chamber-bloom-pass')
const bloomTarget = cinema2StableId<Cinema2RenderTargetId>('chamber-bloom-target')
const bloomColor = cinema2StableId<Cinema2RenderSlotId>('chamber-bloom-color')
const finishPass = cinema2StableId<Cinema2RenderPassId>('chamber-finish-pass')
const finishTarget = cinema2StableId<Cinema2RenderTargetId>('chamber-finish-target')
const finishColor = cinema2StableId<Cinema2RenderSlotId>('chamber-finish-color')
const lightTarget = cinema2StableId<Cinema2SceneNodeId>('chamber-light-target')
const floorTarget = cinema2StableId<Cinema2SceneNodeId>('chamber-floor-target')

const authored: Readonly<Cinema2NativePresetManifest> = {
  schemaId: CINEMA2_NATIVE_PRESET_SCHEMA_ID,
  schemaVersion: CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  id: CINEMA2_CHAMBER_PRESET_ID,
  revision: 5,
  metadata: {
    name: 'CHAMBER',
    description: 'Rowan Design’s Darkspore Editor Chamber: a glossy interior with a glowing platform ring, floor ticks, corner beacons and an overhead device, with eight light programs and a camera that can drift or be placed by hand.',
    author: 'DRMVYZ. Original model by Rowan Design (CC BY 4.0).',
    tags: ['reference', 'animated', '3d', 'scene-preview'],
  },
  capabilities: [
    { id: 'render.webgl2', requirement: 'required', purpose: 'Render the original chamber model and texture.' },
    { id: 'render.depth', requirement: 'required', purpose: 'Resolve overlapping surfaces inside the chamber.' },
    { id: 'render.hdr', requirement: 'optional', purpose: 'Retain the source emission and metal highlights before neutral tone mapping.' },
    { id: 'scene.3d', requirement: 'required', purpose: 'Place the imported chamber in world space.' },
    { id: 'camera.world', requirement: 'required', purpose: 'Frame the chamber with a fixed interior camera.' },
    { id: 'lighting', requirement: 'required', purpose: 'Provide static illumination for the imported materials.' },
  ],
  scene: {
    roots: [cinema2Ref(root)],
    nodes: [
      { id: root, kind: 'group', coordinateSpace: 'world' },
      { id: lightTarget, kind: 'group', parent: cinema2Ref(root), transform: { position: [0, 5.8, 0] } },
      { id: floorTarget, kind: 'group', parent: cinema2Ref(root), transform: { position: [0, .8, 0] } },
      {
        id: room, kind: 'module', parent: cinema2Ref(root), module: cinema2Ref(moduleId),
        // Cancel the source scene’s large export offset and put the chamber floor near Y = 0.
        transform: { position: [0, 438.02, -446.92] },
      },
    ],
  },
  modules: [{
    id: moduleId, typeId: CINEMA2_CHAMBER_MODULE_TYPE_ID, version: 1,
    // The GLB's surfaces are left as authored. The module only drives the emission of the glowing elements (its own copies of those meshes).
    config: {
      instances: [{ asset: 'cinema2-chamber', node: room, preserveMaterials: true, spin: false }], hdr: true,
      // A few faint motes of dust in the room's air (high quality draws all of them, medium half, low none).
      particles: [{ count: 140, center: [0, 4.6, 0], size: [8.5, 7.6, 8.5], pointSize: .035, color: [.45, .8, 1], brightness: .12, drift: [.03, .05, .03], twinkle: .5 }],
    },
    // `environmentIntensity` is the viewer's reflection strength, not an override of any GLB material property.
    parameters: { ...Object.fromEntries(MODULE_BINDINGS.map(name => [name, PARAMETERS.find(parameter => parameter.id === chamberParameterId(name))!.defaultValue!])), environmentIntensity: .015, ...Object.fromEntries(SCORE_CHANNELS.map(name => [name, 0])) },
    parameterBindings: { ...Object.fromEntries(MODULE_BINDINGS.map(name => [name, bind(name)])), environmentIntensity: bind('reflections') },
  }],
  parameters: PARAMETERS,
  cameras: [{
    id: camera, label: 'Chamber Interior', projection: 'perspective',
    fovDegrees: 56, minAspect: 16 / 9, near: 0.05, far: 100,
    transform: { position: HOME_EYE },
    target: HOME_TARGET,
    // The base rig is the drift (a path is needed for the motion settings below); Camera Mode picks Home View (this camera's fixed pose) by default.
    rig: { kind: 'path', points: DRIFT_POINTS, durationSeconds: 40, loop: true },
    rigVariants: {
      home: { kind: 'static' },
      drift: { kind: 'path', points: DRIFT_POINTS, durationSeconds: 40, loop: true },
      manual: { kind: 'orbit', radius: 8.3, azimuthDegrees: 0, elevationDegrees: 0, angularVelocityDegreesPerSecond: 0 },
    },
    // The drift runs at bpm / 120 of its authored speed with BPM Sync on. The safety box keeps every view, Manual View included, between the pillars' ring and the walls.
    motion: { idleMotion: true, interpolation: 'spline', constantSpeed: true, tempo: { referenceBpm: 120, flightSpeed: true, minRate: .5, maxRate: 1.75, punch: 1.6 } },
    safety: { minPosition: [-9, 1.2, -5], maxPosition: [9, 8.4, 9.6], minFovDegrees: 38, maxFovDegrees: 78 },
    controls: { rigMode: bind('cameraMode'), motionSpeed: bind('cameraSpeed'), tempoSync: bind('bpmSync'), kickZoom: bind('zoomOnKick'), orbitRadius: bind('cameraDistance'), orbitAzimuthDegrees: bind('cameraHeading'), orbitElevationDegrees: bind('cameraElevation'), fovDegrees: bind('cameraFov') },
  }],
  defaults: { camera: cinema2Ref(camera) },
  environment: { backgroundColor: [.002, .006, .008, 1], exposure: 1 },
  lighting: { lights: [
    // Low quality keeps the neutral platform pool and device accent. Cyan spill
    // stays below the platform, leaving its top lit by the original white lamp.
    { id: cinema2StableId('chamber-floor-pool'), type: 'spot', color: [.9, .94, 1, 1], intensity: LIGHTS.floorPool, controls: { intensity: bind('floorPool') }, transform: { position: [0, 5.25, 0] }, targetNode: cinema2Ref(floorTarget), config: { coneAngleDegrees: 24, penumbra: .8, range: 7 } },
    { id: cinema2StableId('chamber-device'), type: 'point', color: [.04, .85, 1, 1], intensity: LIGHTS.deviceGlow, controls: { intensity: bind('deviceGlow') }, transform: { position: [0, 6.3, 1.2] }, config: { range: 7 } },
    { id: cinema2StableId('chamber-platform'), type: 'point', color: [0, .92, .72, 1], intensity: LIGHTS.platformGlow, controls: { intensity: bind('platformGlow') }, transform: { position: [0, .65, 0] }, config: { range: 7 } },
    { id: cinema2StableId('chamber-left-spill'), type: 'point', color: SPILL_COLOR, intensity: LIGHTS.windowSpill, controls: { intensity: bind('windowSpill'), color: bind('spillColor') }, transform: { position: [-6, 2.8, -7] }, config: { range: 9 } },
    { id: cinema2StableId('chamber-rim'), type: 'spot', color: [.62, .72, .8, 1], intensity: LIGHTS.rim, controls: { intensity: bind('rim') }, transform: { position: [3.8, 7.8, -2] }, targetNode: cinema2Ref(lightTarget), config: { coneAngleDegrees: 35, penumbra: .7, range: 12 } },
    { id: cinema2StableId('chamber-fill'), type: 'ambient', color: [.45, .55, .65, 1], intensity: LIGHTS.fill, controls: { intensity: bind('fill') } },
  ] },
  effects: [
    // These expose the GLB's own emission; no replacement glow or recoloring.
    { id: bloom, typeId: cinema2StableId('hdr-bloom'), version: 1, enabled: true, scope: 'output', order: 0,
      parameters: { mix: .8, threshold: .8, knee: .2, intensity: 1, spread: .6, levels: 6 }, parameterBindings: { intensity: bind('bloom') } },
    { id: finish, typeId: cinema2StableId('cinematic-finish'), version: 1, enabled: true, scope: 'output', order: 1,
      parameters: { mix: 1, toneMap: 1, exposure: 1, contrast: 1, saturation: 1, temperature: 0, tint: 0, tintAmount: 0, vignette: 0, grain: 0, aberration: 0 }, parameterBindings: { exposure: bind('exposure'), vignette: bind('vignette') } },
  ],
  render: {
    targets: [
      { id: target, descriptor: { size: { kind: 'viewport' }, colorFormat: 'rgba16f', fallbackColorFormat: 'rgba8', depthFormat: 'depth24' } },
      ...[bloomTarget, finishTarget].map(id => ({ id, descriptor: { size: { kind: 'viewport' as const }, colorFormat: 'rgba16f' as const, fallbackColorFormat: 'rgba8' as const }, ownership: 'transient' as const })),
    ],
    passes: [
      { id: scenePass, kind: 'scene', scene: cinema2Ref(root), outputs: [{ id: color, target: cinema2Ref(target), attachment: 'color' }] },
      { id: bloomPass, kind: 'fullscreen', effect: cinema2Ref(bloom), dependsOn: [cinema2Ref(scenePass)], inputs: [{ id: cinema2StableId('chamber-bloom-input'), source: { pass: cinema2Ref(scenePass), output: color }, attachment: 'color' }], outputs: [{ id: bloomColor, target: cinema2Ref(bloomTarget), attachment: 'color' }] },
      { id: finishPass, kind: 'fullscreen', effect: cinema2Ref(finish), dependsOn: [cinema2Ref(bloomPass)], inputs: [{ id: cinema2StableId('chamber-finish-input'), source: { pass: cinema2Ref(bloomPass), output: bloomColor }, attachment: 'color' }], outputs: [{ id: finishColor, target: cinema2Ref(finishTarget), attachment: 'color' }] },
      { id: outputPass, kind: 'output', inputs: [{ id: cinema2StableId('chamber-input'), source: { pass: cinema2Ref(finishPass), output: finishColor }, attachment: 'color' }] },
    ],
    outputPass: cinema2Ref(outputPass),
  },
  output: { renderPass: cinema2Ref(outputPass), colorSpace: 'srgb', alphaMode: 'opaque' },
}

const FLOOR_GROUP = cinema2StableId<Cinema2LightGroupId>('chamber-floor-lights')
const ROOM_GROUP = cinema2StableId<Cinema2LightGroupId>('chamber-room-lights')
const kebab = (name: string) => name.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)
const light = (name: string) => cinema2Ref(cinema2StableId<Cinema2LightId>(name))

/** Audio choreography, the mood drives and Auto Performance. Every target is one of the preset's own controls, so the Inspector shows each moving and Auto Performance locks it. */
function withChamberPerformance(manifest: Readonly<Cinema2NativePresetManifest>): Readonly<Cinema2NativePresetManifest> {
  const module = manifest.modules![0]!, bloom = manifest.effects![0]!
  const lights = new Map([['floorPool', 'chamber-floor-pool'], ['platformGlow', 'chamber-platform'], ['deviceGlow', 'chamber-device'], ['windowSpill', 'chamber-left-spill'], ['rim', 'chamber-rim'], ['fill', 'chamber-fill']])
  const target = (property: string) => property === 'bloom' ? { kind: 'effect' as const, ref: cinema2Ref(bloom.id), property: 'intensity' }
    : lights.has(property) ? { kind: 'light' as const, ref: light(lights.get(property)!), property: 'intensity' } : { kind: 'module' as const, ref: cinema2Ref(module.id), property }
  const continuous = (name: string, capability: Cinema2CapabilityId, path: Cinema2ChoreographyContinuousSourcePath, property: string, factor: number, gated = false): Cinema2ChoreographyRuleManifest => ({
    id: cinema2StableId<Cinema2ChoreographyRuleId>(`chamber-${name}`), priority: 20, strengthParameter: bind('reactivity'), ...(gated ? { enabledParameter: bind('autoPerformance') } : {}),
    source: { signal: 'continuous', capability, path, clamp: [0, 1], smoothingMs: 150 },
    actions: [{ id: cinema2StableId<Cinema2ChoreographyActionId>(`chamber-${name}-drive`), target: target(property), operation: 'multiply', value: factor }],
  })
  const accent = (signal: 'kick' | 'snare' | 'downbeat' | 'drop', name: string, targetRef: ReturnType<typeof target> | { kind: 'light-group'; ref: ReturnType<typeof cinema2Ref<'light-group'>>; property: string; stagger?: { beats: number; order?: 'forward' | 'reverse' | 'center-out' | 'edges-in' } }, factor: number, release: number): Cinema2ChoreographyRuleManifest => ({
    id: cinema2StableId<Cinema2ChoreographyRuleId>(`chamber-${signal}-${name}`), priority: 30, strengthParameter: bind('reactivity'),
    source: { signal, capability: signal === 'drop' ? 'music.drop' : signal === 'downbeat' ? 'music.downbeat' : 'music.rhythm-events' },
    conditions: [{ kind: 'once-per-event' }, ...(signal === 'drop' ? [] : [{ kind: 'not-silent' as const }])],
    actions: [{ id: cinema2StableId<Cinema2ChoreographyActionId>(`chamber-${signal}-${name}-accent`), target: targetRef as never, operation: 'envelope', composition: 'multiply', value: factor, envelope: { attack: .015, hold: .035, release, unit: 'seconds' }, retrigger: 'restart' }],
  })
  const rules = [
    // The ring and the platform glow breathe with the bass, the lamps follow the mids, the floor marks and beacons the highs, the device the voice.
    continuous('bass-ring', 'audio.bands', 'audio.bands.bass', 'ringLight', 1.4), continuous('bass-platform', 'audio.bands', 'audio.bands.bass', 'platformGlow', 1.8),
    continuous('mid-lamps', 'audio.bands', 'audio.bands.mid', 'lampLight', 1.3),
    continuous('high-ticks', 'audio.bands', 'audio.bands.high', 'tickLight', 1.3), continuous('high-beacons', 'audio.bands', 'audio.bands.high', 'beaconLight', 1.4),
    continuous('energy-intensity', 'audio.features', 'audio.features.overallEnergy', 'intensity', 1.2),
    continuous('vocal-device', 'music.vocal-presence', 'audio.features.vocalPresence', 'deviceGlow', 2), continuous('vocal-core', 'music.vocal-presence', 'audio.features.vocalPresence', 'coreLight', 1.25),
    // A kick hits the core lamp and sends a pulse through the floor lights, one after another.
    accent('kick', 'core', target('coreLight'), 1.7, .22),
    accent('kick', 'floor-lights', { kind: 'light-group', ref: cinema2Ref(FLOOR_GROUP), property: 'intensity', stagger: { beats: .25, order: 'forward' } }, 2, .3),
    accent('snare', 'beacons', target('beaconLight'), 1.9, .2), accent('snare', 'spill', target('windowSpill'), 2, .25),
    accent('downbeat', 'rim', target('rim'), 2.2, .3),
    accent('drop', 'bloom', target('bloom'), 1.7, 1.2), accent('drop', 'intensity', target('intensity'), 1.25, 1.2), accent('drop', 'room', { kind: 'light-group', ref: cinema2Ref(ROOM_GROUP), property: 'intensity', stagger: { beats: .5, order: 'center-out' } }, 2.5, 1.2),
    // Arms: they follow the energy of the music and tap on every kick.
    continuous('energy-arms', 'audio.features', 'audio.features.overallEnergy', 'armMotion', 1.4), accent('kick', 'arms', target('armMotion'), 1.5, .25),
    // Kick ripple: core lamp, arm lamps, ring, floor ticks, beacons, each an eighth of a beat after the last.
    ...(['cueCore', 'cueLamps', 'cueRing', 'cueTicks', 'cueBeacons'] as const).map((channel, step): Cinema2ChoreographyRuleManifest => ({
      id: cinema2StableId<Cinema2ChoreographyRuleId>(`chamber-score-kick-${kebab(channel)}`), priority: 40, strengthParameter: bind('reactivity'), enabledWhen: [{ kind: 'parameter-not-equals', parameterId: chamberParameterId('scoreAmount'), value: 0 }],
      source: { signal: 'kick', capability: 'music.rhythm-events' }, conditions: [{ kind: 'once-per-event' }, { kind: 'not-silent' }],
      actions: [{ id: cinema2StableId<Cinema2ChoreographyActionId>(`chamber-score-${kebab(channel)}-cue`), target: target(channel), operation: 'envelope', composition: 'replace', value: 1, delayBeats: step * .125, envelope: { attack: .015, hold: .035, release: .22 + step * .02, unit: 'seconds' }, retrigger: 'restart' }],
    })),
    continuous('director-ring', 'visual-director.significance', 'director.intensity', 'ringLight', 1.15, true),
  ]
  const drive = (id: string, property: string, source: Cinema2MoodDrive['source'], value: number): Cinema2MoodDrive => ({ id, target: target(property) as Cinema2MoodDrive['target'], source, operation: 'multiply', value })
  const drives: Cinema2MoodDrive[] = [
    drive('calm-lamps', 'lampLight', 'mood.calm', .7), drive('calm-arms', 'armMotion', 'mood.calm', .7), drive('peak-arms', 'armMotion', 'mood.peak', 1.3), drive('calm-spill', 'windowSpill', 'mood.calm', .8), drive('calm-intensity', 'intensity', 'mood.calm', .85),
    drive('activity-ring', 'ringLight', 'mood.activity', 1.15), drive('activity-ticks', 'tickLight', 'mood.activity', 1.15),
    drive('momentum-beacons', 'beaconLight', 'mood.momentum', 1.2), drive('energy-intensity', 'intensity', 'mood.energy', 1.15), drive('drive-platform', 'platformGlow', 'mood.drive', 1.3),
    // A build pulls the floor pool and the core lamp up; a peak lights everything and lifts the bloom; a shock flares the beacons and the rim.
    drive('build-pool', 'floorPool', 'mood.build', 1.5), drive('build-core', 'coreLight', 'mood.build', 1.3),
    drive('peak-ring', 'ringLight', 'mood.peak', 1.25), drive('peak-lamps', 'lampLight', 'mood.peak', 1.25), drive('peak-bloom', 'bloom', 'mood.peak', 1.3),
    drive('shock-beacons', 'beaconLight', 'mood.shock', 1.5), drive('shock-rim', 'rim', 'mood.shock', 1.8),
  ]
  for (const name of ['intensity', 'armMotion', 'floorPool', 'platformGlow', 'deviceGlow', 'windowSpill', 'rim', 'bloom']) drives.push(drive(`silence-${name.toLowerCase()}`, name, 'mood.silence', .1))
  return withCinema2MoodDrives({
    ...manifest,
    capabilities: [...manifest.capabilities ?? [], ...(['audio.transport', 'audio.bands', 'audio.features', 'music.rhythm-events', 'music.downbeat', 'music.drop', 'music.vocal-presence', 'visual-director.significance'] as const).map(id => ({ id, requirement: 'optional' as const, purpose: 'Shared musical facts and performance meaning.' }))],
    lighting: { ...manifest.lighting!, groups: [
      { id: FLOOR_GROUP, label: 'Floor Lights', lights: [light('chamber-floor-pool'), light('chamber-platform'), light('chamber-device')] },
      { id: ROOM_GROUP, label: 'Room Lights', lights: [light('chamber-left-spill'), light('chamber-rim')] },
    ] },
    choreography: { tempoSyncParameter: bind('bpmSync'), rules },
  }, { idPrefix: 'chamber', enabledParameter: chamberParameterId('autoPerformance'), strengthParameter: chamberParameterId('reactivity'), patternControls: { patternChange: chamberParameterId('patternChange'), trigger: chamberParameterId('trigger') }, drives })
}

export const CINEMA2_CHAMBER_PRESET_MANIFEST: Readonly<Cinema2NativePresetManifest> = withChamberPerformance(authored)
