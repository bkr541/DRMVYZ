import {
  CINEMA2_NATIVE_PRESET_SCHEMA_ID, CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  cinema2NamespacedId, cinema2Ref, cinema2StableId,
  type Cinema2CameraId, type Cinema2LayerId, type Cinema2LightId,
  type Cinema2ModuleId, type Cinema2NativePresetManifest, type Cinema2ParameterId, type Cinema2ParameterManifest,
  type Cinema2PresetId, type Cinema2RenderPassId, type Cinema2RenderSlotId,
  type Cinema2RenderTargetId, type Cinema2SceneNodeId, type Cinema2Vector3,
} from '../contracts/Cinema2NativePresetManifest'
import { CINEMA2_QUALITY_MODE_PARAMETER } from '../parameters/Cinema2PerformanceParameters'
import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from './Cinema2AfterhoursPreset'
import { CINEMA2_NIGHTSHIFT_MODULE_TYPE_ID } from '../modules/Cinema2NightshiftNativeModule'
import { CINEMA2_NIGHTSHIFT_PATTERNS, NIGHTSHIFT_COLORS, NIGHTSHIFT_SIGN_TEXT } from '../modules/nightshift/Cinema2NightshiftDomain'
import { NIGHTSHIFT_MUSIC_TARGET_DEFAULTS } from '../modules/nightshift/Cinema2NightshiftAudio'
import { NIGHTSHIFT_CHOREOGRAPHY_DEFAULTS, nightshiftAudioRules } from './Cinema2NightshiftChoreography'
import { NIGHTSHIFT_EFFECT_DEFAULTS, nightshiftFinishingEffects, nightshiftFinishingRules, nightshiftFinishingGraph } from './Cinema2NightshiftFinishing'

export const CINEMA2_NIGHTSHIFT_PRESET_ID = cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.nightshift')
export const CINEMA2_NIGHTSHIFT_CAMERA_ID = cinema2StableId<Cinema2CameraId>('nightshift-reference-camera')
const ROOT = cinema2StableId<Cinema2SceneNodeId>('nightshift-root')
const MODEL = cinema2StableId<Cinema2SceneNodeId>('nightshift-installation')
const HERO = cinema2StableId<Cinema2SceneNodeId>('nightshift-hero-target')
const MODULE = cinema2StableId<Cinema2ModuleId>('nightshift-static-core')
const LAYER = cinema2StableId<Cinema2LayerId>('nightshift-world')
const TARGET = cinema2StableId<Cinema2RenderTargetId>('nightshift-scene-target')
const SCENE = cinema2StableId<Cinema2RenderPassId>('nightshift-scene')
const OUTPUT = cinema2StableId<Cinema2RenderPassId>('nightshift-output')
const COLOR = cinema2StableId<Cinema2RenderSlotId>('nightshift-color')
const DEPTH = cinema2StableId<Cinema2RenderSlotId>('nightshift-depth')
const vec = (x: number, y: number, z: number): Cinema2Vector3 => [x, y, z]

const parameter = (name: string) => cinema2StableId<Cinema2ParameterId>(`nightshift-${name}`)
export const CINEMA2_NIGHTSHIFT_PARAMETER_IDS = {
  master: parameter('master-intensity'), bpmSync: parameter('bpm-sync'), motion: parameter('motion-amount'),
  camera: parameter('camera-motion'), panRoom: parameter('pan-room'), rotation: parameter('ball-rotation'), floor: parameter('floor-intensity'),
  musicResponse: parameter('music-response'),
  autoPerformance: parameter('auto-performance'),
  bloom: parameter('bloom'), haze: parameter('club-haze'), reflections: parameter('reflections'),
  ball: parameter('ball-highlights'), ceiling: parameter('ceiling-intensity'), coverage: parameter('pattern-coverage'),
  pattern: parameter('pattern'), patternChange: parameter('pattern-change'), trigger: parameter('trigger'),
  backgroundColor: parameter('background-color'), cyanColor: parameter('ceiling-cyan'), magentaColor: parameter('floor-magenta'),
  blueColor: parameter('floor-blue'), amberColor: parameter('floor-amber'), ballColor: parameter('ball-tint'),
  signs: parameter('enable-signs'), signText: parameter('sign-text'), signTextLeft: parameter('sign-text-left'), signTextFront: parameter('sign-text-front'), signTextRight: parameter('sign-text-right'), signSize: parameter('sign-size'), signColor: parameter('sign-color'),
} as const
const P = CINEMA2_NIGHTSHIFT_PARAMETER_IDS
const base = { section: 'Design', exposure: 'primary', persistence: 'preset', reset: 'authored-default' } as const
const float = (id: Cinema2ParameterId, label: string, value: number, parent: 'master-controls' | 'design', order: number): Cinema2ParameterManifest => ({
  ...base, id, label, type: 'float', min: 0, max: 1, step: .01, defaultValue: value,
  designParentGroup: parent, group: parent === 'master-controls' ? 'Performance' : 'Installation', order,
})
const parameters: Cinema2ParameterManifest[] = [
  CINEMA2_QUALITY_MODE_PARAMETER,
  float(P.master, 'Master Intensity', .85, 'master-controls', 1),
  { ...base, id: P.bpmSync, label: 'BPM Sync', type: 'boolean', defaultValue: true, designParentGroup: 'master-controls', group: 'Performance', order: 2,
    description: 'Locks floor timing, ball rotation and Pan Room to shared BPM. Off uses an authored 100-BPM rate; it does not disable musical event triggers. This local control is independent of Audio Dock BPM Sync.' },
  float(P.motion, 'Motion Amount', .35, 'master-controls', 3),
  { ...float(P.camera, 'Camera Motion', .5, 'master-controls', 4), description: 'Camera drift around the installation. Zero restores the reference shot.' },
  { ...float(P.musicResponse, 'Music Response', .8, 'master-controls', 5), description: 'Scales musical lighting and motion gains. Zero removes these reactions; Pattern Change, Auto Performance and BPM Sync remain independent.' },
  { ...base, id: P.autoPerformance, label: 'Auto Performance', type: 'boolean', defaultValue: false, designParentGroup: 'master-controls', group: 'Performance', order: 6,
    description: 'Temporarily performs build and drop programs, then restores the current base. Manual Pattern selection takes over immediately. Palette, framing and intensity limits stay yours.' },
  { ...base, id: P.panRoom, label: 'Pan Room', type: 'boolean', defaultValue: false, designParentGroup: 'master-controls', group: 'Performance', order: 7,
    description: 'Circles the room in 64 beats, keeping the disco ball above center. Uses BPM Sync, or 100 BPM when sync is off. Overrides camera drift while enabled.' },
  { ...base, id: P.pattern, label: 'Pattern', type: 'enum', defaultValue: 'nightshift', options: CINEMA2_NIGHTSHIFT_PATTERNS, designParentGroup: 'design', group: 'Pattern', order: 1 },
  { ...base, id: P.patternChange, label: 'Pattern Change', type: 'boolean', defaultValue: false, designParentGroup: 'design', group: 'Pattern', order: 2 },
  { ...base, id: P.trigger, label: 'Trigger', type: 'enum', defaultValue: 'bar4', options: CINEMA2_AFTERHOURS_TRIGGER_OPTIONS,
    visibleWhen: [{ kind: 'parameter-equals', parameterId: P.patternChange, value: true }], designParentGroup: 'design', group: 'Pattern', order: 3 },
  { ...base, id: P.rotation, label: 'Ball Rotation', type: 'boolean', defaultValue: true, designParentGroup: 'design', group: 'Installation', order: 10 },
  float(P.floor, 'Floor Intensity', .8, 'design', 11), float(P.ball, 'Ball Highlight Intensity', .75, 'design', 12),
  float(P.ceiling, 'Ceiling Intensity', .7, 'design', 13), float(P.coverage, 'Pattern Coverage', .75, 'design', 14),
  { ...base, id: P.signs, label: 'Enable Signs', type: 'boolean', defaultValue: false, designParentGroup: 'design', group: 'Signs', order: 20 },
  ...(['signText', 'signTextLeft', 'signTextFront', 'signTextRight'] as const).map((key, index): Cinema2ParameterManifest => ({
    ...base, id: P[key], label: ['Back Sign Text', 'Left Sign Text', 'Front Sign Text', 'Right Sign Text'][index], type: 'string',
    defaultValue: index === 0 ? NIGHTSHIFT_SIGN_TEXT : '', modulatable: false, choreographable: false,
    designParentGroup: 'design', group: 'Signs', order: 21 + index,
    visibleWhen: [{ kind: 'parameter-equals', parameterId: P.signs, value: true }],
    description: 'Neon text on this side of the room (up to 64 characters). Leave empty to hide it.',
  })),
  { ...base, id: P.signSize, label: 'Sign Size', type: 'float', defaultValue: 1, min: .25, max: 2, step: .05,
    designParentGroup: 'design', group: 'Signs', order: 25,
    visibleWhen: [{ kind: 'parameter-equals', parameterId: P.signs, value: true }],
    description: 'Scales the freestanding neon sign from one quarter to twice its default size.' },
  ...(['bloom', 'haze', 'reflections'] as const).map((key, order): Cinema2ParameterManifest => ({
    ...base, id: P[key], label: key === 'bloom' ? 'Bloom' : key === 'haze' ? 'Club Haze / Fog' : 'Reflections', type: 'float',
    min: 0, max: 1, step: .01, defaultValue: NIGHTSHIFT_EFFECT_DEFAULTS[key], designParentGroup: 'effects', group: 'Club Finish', order,
    description: key === 'haze' ? 'Dense, drifting ground fog around and above the dance floor. Raises fog density and opacity; zero clears it completely.'
      : 'Zero bypasses this effect. The maximum stays restrained to preserve the floor seams and dark room.' })),
  ...([
    ['backgroundColor', 'Background', NIGHTSHIFT_COLORS.background], ['cyanColor', 'Ceiling Cyan', NIGHTSHIFT_COLORS.cyan],
    ['magentaColor', 'Floor Magenta', NIGHTSHIFT_COLORS.magenta], ['blueColor', 'Floor Blue', NIGHTSHIFT_COLORS.blue],
    ['amberColor', 'Floor Amber', NIGHTSHIFT_COLORS.amber], ['ballColor', 'Ball Tint', NIGHTSHIFT_COLORS.ball],
    ['signColor', 'Sign Color', NIGHTSHIFT_COLORS.sign],
  ] as const).map(([key, label, defaultValue], order): Cinema2ParameterManifest => ({
    ...base, id: P[key], label, type: 'color', defaultValue, designParentGroup: 'palette', group: 'Club Palette', order,
  })),
]

const finishing = nightshiftFinishingGraph(SCENE, COLOR, DEPTH)
/** Accepted native NIGHTSHIFT installation with bounded shared musical behavior. */
export const CINEMA2_NIGHTSHIFT_PRESET_MANIFEST: Readonly<Cinema2NativePresetManifest> = {
  schemaId: CINEMA2_NATIVE_PRESET_SCHEMA_ID, schemaVersion: CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  id: CINEMA2_NIGHTSHIFT_PRESET_ID, revision: 3,
  metadata: {
    name: 'NIGHTSHIFT',
    description: 'A music-reactive disco ball, dance floor and ceiling LED frame with eight choreographed programs, optional freestanding neon signage, Auto Performance, editable club palette, camera motion and adjustable club haze, bloom and reflections.',
    tags: ['keeper', 'nightclub', 'nightshift', '3d'],
  },
  capabilities: [
    { id: 'render.webgl2', requirement: 'required', purpose: 'Depth-tested world-space mirror ball and dance-floor installation.' },
    ...([
      ['audio.bands', 'Bass rotation gain and high-frequency mirror traversal.'],
      ['audio.features', 'Continuous musical energy shapes floor coverage.'],
      ['music.beat', 'Shared beat grid for BPM Sync and event-driven pattern changes.'],
      ['music.downbeat', 'Canonical downbeat trigger.'],
      ['music.rhythm-events', 'Shared kick and snare accents and triggers.'],
      ['music.bar', 'Canonical bar and multi-bar triggers.'],
      ['music.phrase', 'Analyzed phrase trigger.'],
      ['music.build', 'Supported build progress concentrates the current floor program.'],
      ['music.drop', 'Analyzed drop launches an outward accent and optional pattern trigger.'],
      ['music.vocal-presence', 'Supported vocal presence reduces active floor coverage.'],
      ['visual-director.significance', 'Shared intensity, momentum, build context and qualified impact shape bounded room-scale behavior.'],
    ] as const).map(([id, purpose]) => ({ id, purpose, requirement: 'optional' as const })),
  ],
  parameters,
  modules: [{
    id: MODULE, typeId: CINEMA2_NIGHTSHIFT_MODULE_TYPE_ID, version: 1, enabled: true,
    parameters: { ...NIGHTSHIFT_CHOREOGRAPHY_DEFAULTS, ...NIGHTSHIFT_MUSIC_TARGET_DEFAULTS, master: .85, bpmSync: true, motion: .35, rotation: true, musicResponse: .8, floor: .8, ball: .75, ceiling: .7, coverage: .75,
      pattern: 'nightshift', patternChange: false, trigger: 'bar4', autoPerformance: false, panRoom: false, signs: false, signText: NIGHTSHIFT_SIGN_TEXT, signTextLeft: '', signTextFront: '', signTextRight: '', signSize: 1,
      backgroundColor: NIGHTSHIFT_COLORS.background, cyanColor: NIGHTSHIFT_COLORS.cyan, magentaColor: NIGHTSHIFT_COLORS.magenta,
      blueColor: NIGHTSHIFT_COLORS.blue, amberColor: NIGHTSHIFT_COLORS.amber, ballColor: NIGHTSHIFT_COLORS.ball, signColor: NIGHTSHIFT_COLORS.sign },
    parameterBindings: Object.fromEntries(Object.entries(P).filter(([key]) => !['camera', 'bloom', 'haze', 'reflections'].includes(key)).map(([key, id]) => [key, cinema2Ref(id)])),
    config: { asset: 'cinema2-nightshift-static' },
  }],
  choreography: { rules: [...nightshiftAudioRules(MODULE), ...nightshiftFinishingRules(P)] },
  effects: nightshiftFinishingEffects(P),
  scene: { nodes: [
    { id: ROOT, kind: 'group', coordinateSpace: 'world' },
    { id: MODEL, kind: 'module', parent: cinema2Ref(ROOT), module: cinema2Ref(MODULE) },
    { id: HERO, kind: 'group', parent: cinema2Ref(ROOT), transform: { position: vec(0, 5.7, -2.3) } },
  ], roots: [cinema2Ref(ROOT)] },
  layers: [{ id: LAYER, label: 'NIGHTSHIFT installation', source: cinema2Ref(ROOT), role: 'world', depthPolicy: 'read-write', order: 0 }],
  cameras: [{
    id: CINEMA2_NIGHTSHIFT_CAMERA_ID, label: 'Reference framing', projection: 'perspective',
    fovDegrees: 42, minAspect: 0.95, near: 0.1, far: 60,
    transform: { position: vec(0, 3.1, 14.5) }, target: vec(0, 2.05, 0), rig: { kind: 'static' },
    motion: { orbit: { angularSpeedDegreesPerSecond: 9.375, center: vec(0, 0, -2.3), beatsPerRevolution: 64 }, tempo: { referenceBpm: 100, flightSpeed: false }, drift: { position: .18, target: .0375, rollDegrees: 0, fovDegrees: .375, speed: .0525, seed: 52023 } },
    controls: { motionAmount: cinema2Ref(P.camera), orbitMotionEnabled: cinema2Ref(P.panRoom), tempoSync: cinema2Ref(P.bpmSync) },
    safety: { minPosition: vec(-18, 2.95, -20), maxPosition: vec(18, 3.25, 15), maxPositionOffset: vec(36, .12, 36), maxTargetOffset: vec(18, .075, 18), minFovDegrees: 40.5, maxFovDegrees: 43.5 },
  }],
  defaults: { camera: cinema2Ref(CINEMA2_NIGHTSHIFT_CAMERA_ID) },
  lighting: { lights: [
    { id: cinema2StableId<Cinema2LightId>('nightshift-ambient'), type: 'ambient', color: [0.12, 0.06, 0.24, 1], intensity: 0.035 },
    { id: cinema2StableId<Cinema2LightId>('nightshift-magenta-fill'), type: 'spot', color: [1, 0.025, 0.55, 1], intensity: 1.6, controls: { color: cinema2Ref(P.magentaColor) },
      transform: { position: vec(-1.5, 0.7, 5) }, targetNode: cinema2Ref(HERO), config: { coneAngleDegrees: 75, penumbra: 0.6, range: 24 } },
    { id: cinema2StableId<Cinema2LightId>('nightshift-warm-rim'), type: 'spot', color: [1, 0.18, 0.015, 1], intensity: 1.5, controls: { color: cinema2Ref(P.amberColor) },
      transform: { position: vec(-4, 8.66, -.3) }, targetNode: cinema2Ref(HERO), config: { coneAngleDegrees: 60, penumbra: 0.3, range: 24 } },
    { id: cinema2StableId<Cinema2LightId>('nightshift-blue-rim'), type: 'spot', color: [0.02, 0.24, 1, 1], intensity: 1.6, controls: { color: cinema2Ref(P.blueColor) },
      transform: { position: vec(4, 7.86, -1.3) }, targetNode: cinema2Ref(HERO), config: { coneAngleDegrees: 60, penumbra: 0.3, range: 24 } },
  ] },
  environment: { backgroundColor: NIGHTSHIFT_COLORS.background, exposure: 1, controls: { backgroundColor: cinema2Ref(P.backgroundColor) } },
  render: {
    targets: [{ id: TARGET, descriptor: { size: { kind: 'viewport' }, colorFormat: 'rgba8', depthFormat: 'depth24' }, ownership: 'transient' }, ...finishing.targets],
    passes: [
      { id: SCENE, kind: 'scene', layers: [cinema2Ref(LAYER)], outputs: [
        { id: COLOR, target: cinema2Ref(TARGET), attachment: 'color' },
        { id: DEPTH, target: cinema2Ref(TARGET), attachment: 'depth' },
      ] },
      ...finishing.passes,
      { id: OUTPUT, kind: 'output', inputs: [{ id: cinema2StableId<Cinema2RenderSlotId>('nightshift-final-color'), source: { pass: cinema2Ref(finishing.pass), output: finishing.color }, attachment: 'color' }] },
    ], outputPass: cinema2Ref(OUTPUT),
  },
  output: { renderPass: cinema2Ref(OUTPUT), colorSpace: 'srgb', alphaMode: 'opaque' },
}
