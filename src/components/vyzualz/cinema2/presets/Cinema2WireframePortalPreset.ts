import { CINEMA2_WIREFRAME_PORTAL_MODULE_TYPE_ID, WIREFRAME_PORTAL_BACKGROUND, WIREFRAME_PORTAL_PALETTE } from '../modules/Cinema2WireframePortalNativeModule'
import { WIREFRAME_PORTAL_CENTER } from '../modules/wireframePortal/WireframePortalScene'
import { WIREFRAME_PORTAL_DEFAULT_PATTERN, WIREFRAME_PORTAL_PATTERNS } from '../modules/wireframePortal/WireframePortalPatterns'
import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from './Cinema2AfterhoursPreset'
import { finishWireframePortal } from './Cinema2WireframePortalFinish'
import { wireframePortalPerformance } from './Cinema2WireframePortalPerformance'
import { withCinema2MoodDrives } from './Cinema2MoodConductorAuthoring'
import {
  CINEMA2_NATIVE_PRESET_SCHEMA_ID, CINEMA2_NATIVE_PRESET_SCHEMA_VERSION, cinema2NamespacedId, cinema2Ref, cinema2StableId,
  type Cinema2CameraId, type Cinema2EffectId, type Cinema2LightId, type Cinema2ModuleId, type Cinema2NativePresetManifest, type Cinema2ParameterId,
  type Cinema2ParameterManifest, type Cinema2PresetId, type Cinema2RenderPassId, type Cinema2RenderSlotId, type Cinema2RenderTargetId,
  type Cinema2SceneNodeId, type Cinema2Vector3,
} from '../contracts/Cinema2NativePresetManifest'

export const CINEMA2_WIREFRAME_PORTAL_PRESET_ID = cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.crate-wireframe-portal')
export const WIREFRAME_PORTAL_MODULE_ID = cinema2StableId<Cinema2ModuleId>('wireframe-portal-core')
export const wireframePortalParameterId = (name: string) => cinema2StableId<Cinema2ParameterId>(`wireframe-portal-${name.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}`)

const root = cinema2StableId<Cinema2SceneNodeId>('wireframe-portal-root')
const model = cinema2StableId<Cinema2SceneNodeId>('wireframe-portal-model')
const camera = cinema2StableId<Cinema2CameraId>('wireframe-portal-camera')
const target = cinema2StableId<Cinema2RenderTargetId>('wireframe-portal-target')
const scenePass = cinema2StableId<Cinema2RenderPassId>('wireframe-portal-scene')
const color = cinema2StableId<Cinema2RenderSlotId>('wireframe-portal-color')
const output = cinema2StableId<Cinema2RenderPassId>('wireframe-portal-output')

const base = { section: 'Design', exposure: 'primary', persistence: 'preset', reset: 'authored-default' } as const
const bind = (name: string) => cinema2Ref(wireframePortalParameterId(name))
type Parent = Cinema2ParameterManifest['designParentGroup']
const number = (name: string, label: string, parent: Parent, value: number, min: number, max: number, order: number, group?: string, description?: string): Cinema2ParameterManifest => ({
  ...base, id: wireframePortalParameterId(name), label, type: 'float', defaultValue: value, min, max, designParentGroup: parent, order, ...(group ? { group } : {}), ...(description ? { description } : {}),
})
const toggle = (name: string, label: string, parent: Parent, value: boolean, order: number, group?: string, description?: string): Cinema2ParameterManifest => ({
  ...base, id: wireframePortalParameterId(name), label, type: 'boolean', defaultValue: value, designParentGroup: parent, order, ...(group ? { group } : {}), ...(description ? { description } : {}),
})
const manual = [{ kind: 'parameter-equals' as const, parameterId: wireframePortalParameterId('cameraMode'), value: 'manual' }]
const PALETTE_LABELS = { steelColor: 'Steel', hotColor: 'Hot Joints', edgeColor: 'Edge Runs', coldRimColor: 'Cold Rim', redRimColor: 'Red Rim' } as Record<string, string>

/** Hidden channels the kick and drop cues write; they have no control of their own. */
export const WIREFRAME_PORTAL_CHANNELS = ['flash', 'blast'] as const

export const WIREFRAME_PORTAL_PARAMETERS: readonly Cinema2ParameterManifest[] = [
  toggle('bpmSync', 'BPM Sync', 'master-controls', true, 0, undefined, 'Locks the ember drift, rim sweep and camera to the track\'s detected tempo.'),
  number('intensity', 'Intensity', 'master-controls', 1, 0, 2, 1),
  number('reactivity', 'Audio Reactivity', 'master-controls', .65, 0, 1, 2, undefined, 'Strength of the bass, energy, vocal and beat reactions. Zero restores the authored look.'),
  toggle('autoPerformance', 'Auto Performance', 'master-controls', false, 3, undefined, 'The shared Mood Conductor moves the truss with the passage of the track.'),
  { ...base, id: wireframePortalParameterId('pattern'), label: 'Pattern', type: 'enum', defaultValue: WIREFRAME_PORTAL_DEFAULT_PATTERN, options: WIREFRAME_PORTAL_PATTERNS, designParentGroup: 'design', group: 'Pattern', order: 0,
    description: 'The program the bays and beams play: Lattice breathes, Extrude pumps, Rotor turns, Fold closes in, Ripple rolls, Detonate blasts apart and reassembles.' },
  toggle('patternChange', 'Pattern Change', 'design', false, 1, 'Pattern', 'Advances to the next Pattern each time the Trigger fires.'),
  { ...base, id: wireframePortalParameterId('trigger'), label: 'Trigger', type: 'enum', defaultValue: 'bar4', options: CINEMA2_AFTERHOURS_TRIGGER_OPTIONS, designParentGroup: 'design', group: 'Pattern', order: 2,
    description: 'The musical event that advances the Pattern.', visibleWhen: [{ kind: 'parameter-equals', parameterId: wireframePortalParameterId('patternChange'), value: true }] },
  number('kinetics', 'Kinetics', 'design', 1, 0, 1.5, 3, 'Pattern', 'How far the bays move: push, turn, fold and blast. Zero holds the structure still.'),
  number('jointHeat', 'Joint Heat', 'design', 1, 0, 2, 1, 'Structure', 'The glow of the hot cores in every bay and joint.'),
  number('edgeLighting', 'Edge Runs', 'design', 1, 0, 1.5, 2, 'Structure', 'The cold light runs along the frame edges and the links between bays.'),
  number('pinLighting', 'Wayfinding Pins', 'design', 1, 0, 1.5, 3, 'Structure', 'The small beacons on the bay faces.'),
  number('steelRoughness', 'Steel Roughness', 'design', .36, .1, .7, 4, 'Structure', 'Low is polished and catches sharp highlights; high is brushed and soft.'),
  number('beamLighting', 'Beam Lighting', 'design', 1, 0, 2, 0, 'Lighting', 'The beams that sweep out of the bays through the haze.'),
  number('strobe', 'Strobe', 'design', .5, 0, 1, 4, 'Lighting', 'How hard the kick flashes the rig and a drop chops the beams.'),
  number('rimLighting', 'Rim Lighting', 'design', 1, 0, 2, 1, 'Lighting', 'The hard cold and red lights from behind that catch the chamfers.'),
  number('emberDrift', 'Ember Drift', 'design', .5, 0, 1, 2, 'Lighting', 'How far a warm band of heat drifts through the joints and edge runs.'),
  number('motionRate', 'Sweep Rate', 'design', 1, 0, 2, 3, 'Lighting', 'Speed of the ember drift, the rim sweep and the dust, counted in beats.'),
  {
    ...base, id: wireframePortalParameterId('cameraMode'), label: 'Camera Mode', type: 'enum', defaultValue: 'director', designParentGroup: 'design', group: 'Camera', order: 0,
    options: [{ value: 'director', label: 'Director' }, { value: 'flythrough', label: 'Flythrough' }, { value: 'horizontal', label: 'Horizontal Orbit' }, { value: 'manual', label: 'Manual Orbit' }],
    description: 'Director edits orbits, swoops and flights through the truss into one loop. Flythrough keeps to the corridors. Horizontal turns around it; Manual lets you place the camera.',
  },
  toggle('cameraMotion', 'Camera Motion', 'design', true, 1, 'Camera'),
  toggle('cameraKickZoom', 'Kick Zoom', 'design', true, 2, 'Camera', 'A quick zoom-in on every kick.'),
  number('cameraSpeed', 'Camera Speed', 'design', 1, 0, 2, 3, 'Camera'),
  { ...number('cameraHeading', 'Camera Heading', 'design', 32, -180, 180, 4, 'Camera'), visibleWhen: manual },
  { ...number('cameraElevation', 'Camera Elevation', 'design', 8, -30, 70, 5, 'Camera'), visibleWhen: manual },
  { ...number('cameraDistance', 'Camera Distance', 'design', 14.5, 11, 26, 6, 'Camera'), visibleWhen: manual },
  number('cameraFov', 'Camera Field of View', 'design', 44, 30, 65, 7, 'Camera'),
  number('haze', 'Haze', 'effects', .35, 0, 1, 0, undefined, 'The cold haze along the horizon behind the truss.'),
  number('dust', 'Dust', 'effects', .5, 0, 1, 1, undefined, 'Specks drifting through the light. Off on the low quality tier.'),
  number('bloom', 'Bloom', 'effects', .38, 0, .8, 2),
  number('flares', 'Joint Glare', 'effects', .2, 0, .6, 3, undefined, 'Anamorphic streaks off the brightest joints.'),
  number('focus', 'Depth Focus', 'effects', .55, 0, 1, 4, undefined, 'Shallow depth of field: the middle of the truss stays sharp and the near and far bays soften.'),
  number('finishMix', 'Tone Finish', 'effects', 1, 0, 1, 5, undefined, 'Contrast, cold shadows, vignette and grain.'),
  { ...base, id: wireframePortalParameterId('background'), label: 'Background', type: 'color', defaultValue: [...WIREFRAME_PORTAL_BACKGROUND], designParentGroup: 'palette', order: 0 },
  ...Object.entries(WIREFRAME_PORTAL_PALETTE).map(([name, value], index): Cinema2ParameterManifest => ({
    ...base, id: wireframePortalParameterId(name), label: PALETTE_LABELS[name]!, type: 'color', defaultValue: [...value], designParentGroup: 'palette', order: index + 1,
  })),
]

/** Every parameter the module reads, by name. */
export const WIREFRAME_PORTAL_MODULE_PARAMETERS = [
  'bpmSync', 'intensity', 'reactivity', 'autoPerformance', 'pattern', 'patternChange', 'trigger', 'kinetics', 'beamLighting', 'strobe', 'jointHeat', 'edgeLighting', 'pinLighting', 'steelRoughness', 'rimLighting', 'emberDrift', 'motionRate',
  'haze', 'dust', 'background', ...Object.keys(WIREFRAME_PORTAL_PALETTE),
] as const

const DISTANCE = 14.5
const FOCUS = WIREFRAME_PORTAL_CENTER
type PathPoint = { position: Cinema2Vector3; target: Cinema2Vector3 }
const lerp = (from: number, to: number, t: number) => from + (to - from) * t
/** An arc around the truss at a radius and elevation that ease from one value to the next, always looking at its centre. Azimuth 0 is the front. */
const orbit = (az0: number, az1: number, r0: number, r1: number, el0: number, el1: number, count: number): PathPoint[] => Array.from({ length: count }, (_, i) => {
  const t = i / count
  const az = lerp(az0, az1, t) * Math.PI / 180, el = lerp(el0, el1, t) * Math.PI / 180, r = lerp(r0, r1, t)
  return { position: [FOCUS[0] + Math.sin(az) * Math.cos(el) * r, FOCUS[1] + Math.sin(el) * r, FOCUS[2] + Math.cos(az) * Math.cos(el) * r], target: [...FOCUS] }
})
/**
 * A straight flight that looks ahead along its own line, so the camera travels through the bays rather than around them. Once it is past the truss
 * (from `lookBackAt`, as a fraction of the flight) the view swings back toward the truss's centre, so the camera never stares into empty space.
 */
const fly = (from: Cinema2Vector3, to: Cinema2Vector3, count: number, lookBackAt: number, lookAhead = 9): PathPoint[] => {
  const length = Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2]) || 1
  const d = [(to[0] - from[0]) / length, (to[1] - from[1]) / length, (to[2] - from[2]) / length]
  return Array.from({ length: count }, (_, i) => {
    const t = i / count
    const position: Cinema2Vector3 = [lerp(from[0], to[0], t), lerp(from[1], to[1], t), lerp(from[2], to[2], t)]
    const back = Math.min(1, Math.max(0, (t - lookBackAt) / (1 - lookBackAt)))
    const swing = back * back * (3 - 2 * back)
    const ahead: Cinema2Vector3 = [position[0] + d[0]! * lookAhead, position[1] + d[1]! * lookAhead, position[2] + d[2]! * lookAhead]
    return { position, target: [lerp(ahead[0], FOCUS[0], swing), lerp(ahead[1], FOCUS[1], swing), lerp(ahead[2], FOCUS[2], swing)] }
  })
}
// The corridors: the column down the middle (x 0, y 0) runs through four bays front to back; the row at z -3.88 runs through five bays side to side.
// Each flight stops a few units past the last bay and the next orbit starts from there, so there is no long empty run.
const FLY_Z = (count: number) => fly([0, .15, 9.8], [0, .15, -14], count, .55)
const FLY_X = (count: number) => fly([-15, .1, -3.88], [9, .1, -3.88], count, .6)
const directorPath: PathPoint[] = [
  ...orbit(20, 140, 16, 15, 12, 10, 14), ...orbit(140, 360, 15, 13.5, 10, 3, 16), ...FLY_Z(18),
  ...orbit(180, 270, 10.3, 15, 1, 8, 10), ...FLY_X(18), ...orbit(90, 20, 9, 16, 1, 12, 14),
]
const flythroughPath: PathPoint[] = [
  ...orbit(300, 360, 15, 13.5, 8, 3, 8), ...FLY_Z(16), ...orbit(180, 270, 10.3, 15, 1, 8, 8), ...FLY_X(16), ...orbit(90, 30, 9, 15, 1, 8, 8),
]

const authored: Readonly<Cinema2NativePresetManifest> = {
  schemaId: CINEMA2_NATIVE_PRESET_SCHEMA_ID, schemaVersion: CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  id: CINEMA2_WIREFRAME_PORTAL_PRESET_ID, revision: 3,
  metadata: {
    name: 'Wireframe Portal',
    description: 'Corner Truss as a kinetic light rig: 28 steel bays that push, turn, fold, ripple and blast apart with hot cores, beams sweeping through haze, strobes, hard rim lights, six programs with Pattern Change and Auto Performance, and a camera that orbits and flies through the truss.',
    tags: ['reference', 'crate', 'truss', 'kinetic', '3d'],
  },
  capabilities: [
    { id: 'render.webgl2', requirement: 'required', purpose: 'Render the steel truss.' },
    { id: 'render.depth', requirement: 'required', purpose: 'True depth between the bays, and the scene depth for depth of field.' },
    { id: 'render.hdr', requirement: 'optional', purpose: 'Linear-light bloom and glare on the hot joints.' },
    { id: 'scene.3d', requirement: 'required', purpose: 'World-space composition viewed from every direction.' },
    { id: 'camera.world', requirement: 'required', purpose: 'Orbit and path travel around the truss.' },
    { id: 'lighting', requirement: 'required', purpose: 'Read the metal frames in hard rim light.' },
    ...(['audio.transport', 'audio.bands', 'audio.features', 'music.rhythm-events', 'music.drop', 'music.vocal-presence', 'visual-director.significance'] as const)
      .map(id => ({ id, requirement: 'optional' as const, purpose: 'Shared musical facts and broad performance meaning.' })),
  ],
  parameters: WIREFRAME_PORTAL_PARAMETERS,
  modules: [{
    id: WIREFRAME_PORTAL_MODULE_ID, typeId: CINEMA2_WIREFRAME_PORTAL_MODULE_TYPE_ID, version: 1,
    parameters: { ...Object.fromEntries(WIREFRAME_PORTAL_MODULE_PARAMETERS.map(name => [name, WIREFRAME_PORTAL_PARAMETERS.find(p => p.id === wireframePortalParameterId(name))!.defaultValue!])), environmentIntensity: .05, ...Object.fromEntries(WIREFRAME_PORTAL_CHANNELS.map(name => [name, 0])) },
    parameterBindings: Object.fromEntries(WIREFRAME_PORTAL_MODULE_PARAMETERS.map(name => [name, bind(name)])),
    config: { hdr: true, instances: [{ asset: 'cinema2-crate-wireframe-portal', node: model, preserveMaterials: true, spin: false }] },
  }],
  scene: { nodes: [{ id: root, kind: 'group', coordinateSpace: 'world' }, { id: model, kind: 'module', parent: cinema2Ref(root), module: cinema2Ref(WIREFRAME_PORTAL_MODULE_ID) }], roots: [cinema2Ref(root)] },
  choreography: { tempoSyncParameter: bind('bpmSync'), rules: wireframePortalPerformance(WIREFRAME_PORTAL_MODULE_ID, wireframePortalParameterId).rules },
  cameras: [{
    id: camera, label: 'Truss orbit', projection: 'perspective', fovDegrees: 44, minAspect: 16 / 9, minAspectAnchor: 0, near: .1, far: 130, target: [...FOCUS],
    rig: { kind: 'path', points: directorPath, durationSeconds: 84, loop: true },
    rigVariants: {
      director: { kind: 'path', points: directorPath, durationSeconds: 84, loop: true },
      flythrough: { kind: 'path', points: flythroughPath, durationSeconds: 52, loop: true },
      horizontal: { kind: 'orbit', radius: DISTANCE, azimuthDegrees: 32, elevationDegrees: 8, angularVelocityDegreesPerSecond: 7 },
      manual: { kind: 'orbit', radius: DISTANCE, azimuthDegrees: 32, elevationDegrees: 8, angularVelocityDegreesPerSecond: 0 },
    },
    motion: { idleMotion: true, interpolation: 'spline', constantSpeed: true, tempo: { referenceBpm: 120, flightSpeed: true, punch: 1.4 } },
    controls: {
      rigMode: bind('cameraMode'), motionEnabled: bind('cameraMotion'), motionSpeed: bind('cameraSpeed'), tempoSync: bind('bpmSync'), kickZoom: bind('cameraKickZoom'),
      orbitRadius: bind('cameraDistance'), orbitAzimuthDegrees: bind('cameraHeading'), orbitElevationDegrees: bind('cameraElevation'), fovDegrees: bind('cameraFov'),
    },
  }],
  defaults: { camera: cinema2Ref(camera) },
  environment: { backgroundColor: [...WIREFRAME_PORTAL_BACKGROUND], exposure: 1, controls: { backgroundColor: bind('background') } },
  lighting: {
    lights: [
      { id: cinema2StableId<Cinema2LightId>('wireframe-portal-fill'), type: 'ambient', color: [.5, .6, .8, 1], intensity: .2 },
      { id: cinema2StableId<Cinema2LightId>('wireframe-portal-key'), type: 'directional', color: [.7, .8, 1, 1], intensity: .6, transform: { position: [-4, 7, 8] }, targetNode: cinema2Ref(model) },
    ],
  },
  render: {
    targets: [{ id: target, descriptor: { size: { kind: 'viewport' }, colorFormat: 'rgba16f', depthFormat: 'depth24' } }],
    passes: [
      { id: scenePass, kind: 'scene', scene: cinema2Ref(root), outputs: [{ id: color, target: cinema2Ref(target), attachment: 'color' }] },
      { id: output, kind: 'output', inputs: [{ id: cinema2StableId<Cinema2RenderSlotId>('wireframe-portal-input'), source: { pass: cinema2Ref(scenePass), output: color }, attachment: 'color' }] },
    ],
    outputPass: cinema2Ref(output),
  },
  output: { renderPass: cinema2Ref(output), colorSpace: 'srgb', alphaMode: 'opaque' },
}

const performance = wireframePortalPerformance(WIREFRAME_PORTAL_MODULE_ID, wireframePortalParameterId)
const bloomEffect = cinema2StableId<Cinema2EffectId>('wireframe-portal-bloom')
export const CINEMA2_WIREFRAME_PORTAL_PRESET_MANIFEST = withCinema2MoodDrives(finishWireframePortal(authored, wireframePortalParameterId), {
  idPrefix: 'wireframe-portal', enabledParameter: wireframePortalParameterId('autoPerformance'), strengthParameter: wireframePortalParameterId('reactivity'),
  patternControls: { patternChange: wireframePortalParameterId('patternChange'), trigger: wireframePortalParameterId('trigger') },
  drives: [
    ...performance.drives,
    { id: 'peak-bloom', target: { kind: 'effect', ref: cinema2Ref(bloomEffect), property: 'intensity' }, source: 'mood.peak', operation: 'multiply', value: 1.3 },
    { id: 'shock-glare', target: { kind: 'effect', ref: cinema2Ref(cinema2StableId<Cinema2EffectId>('wireframe-portal-flares')), property: 'mix' }, source: 'mood.shock', operation: 'multiply', value: 1.6 },
    { id: 'build-focus', target: { kind: 'effect', ref: cinema2Ref(cinema2StableId<Cinema2EffectId>('wireframe-portal-focus')), property: 'mix' }, source: 'mood.build', operation: 'multiply', value: 1.3 },
    { id: 'silence-bloom', target: { kind: 'effect', ref: cinema2Ref(bloomEffect), property: 'intensity' }, source: 'mood.silence', operation: 'multiply', value: .1 },
  ],
})
