import {
  CINEMA2_NATIVE_PRESET_SCHEMA_ID, CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  cinema2NamespacedId, cinema2Ref, cinema2StableId,
  type Cinema2CameraId, type Cinema2CapabilityId, type Cinema2ChoreographyActionId, type Cinema2ChoreographyContinuousSourcePath, type Cinema2ChoreographyRuleId, type Cinema2ChoreographyRuleManifest, type Cinema2EffectId, type Cinema2ModuleId, type Cinema2NativePresetManifest, type Cinema2ParameterId, type Cinema2ParameterManifest,
  type Cinema2PresetId, type Cinema2RenderPassId, type Cinema2RenderSlotId, type Cinema2Vector3,
  type Cinema2RenderTargetId, type Cinema2SceneNodeId,
} from '../contracts/Cinema2NativePresetManifest'
import { CINEMA2_SPACE_BOI_MODULE_TYPE_ID } from '../modules/Cinema2SpaceBoiNativeModule'
import { SPACE_BOI_PALETTE_DEFAULTS, SPACE_BOI_PALETTE_NAMES } from '../modules/spaceBoi/Cinema2SpaceBoiPalette'
import { CINEMA2_SPACE_BOI_DEFAULT_PATTERN, CINEMA2_SPACE_BOI_PATTERNS } from '../modules/spaceBoi/Cinema2SpaceBoiPatterns'
import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from './Cinema2AfterhoursPreset'
import { withCinema2MoodDrives, type Cinema2MoodDrive } from './Cinema2MoodConductorAuthoring'

export const CINEMA2_SPACE_BOI_PRESET_ID = cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.space-boi')
export const spaceBoiParameterId = (name: string) => cinema2StableId<Cinema2ParameterId>(`space-boi-${name.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}`)
const bind = (name: string) => cinema2Ref(spaceBoiParameterId(name))
const base = { section: 'Design', exposure: 'primary', persistence: 'preset', reset: 'authored-default' } as const
const number = (name: string, label: string, parent: Cinema2ParameterManifest['designParentGroup'], value: number, min: number, max: number, order: number, group?: string, description?: string, step = .01): Cinema2ParameterManifest =>
  ({ ...base, id: spaceBoiParameterId(name), label, type: 'float', defaultValue: value, min, max, step, designParentGroup: parent, order, group, ...(description ? { description } : {}) })
const toggle = (name: string, label: string, parent: Cinema2ParameterManifest['designParentGroup'], value: boolean, order: number, description?: string): Cinema2ParameterManifest =>
  ({ ...base, id: spaceBoiParameterId(name), label, type: 'boolean', defaultValue: value, designParentGroup: parent, order, ...(description ? { description } : {}) })
const cameraMode = spaceBoiParameterId('cameraMode')
const when = (value: string) => [{ kind: 'parameter-equals' as const, parameterId: cameraMode, value }]

const PALETTE_LABELS = { voidColor: 'Void', figureColor: 'Figure Lines', waterColor: 'Water Ripples', planetColor: 'Planets', starColor: 'Stars & Moons' } as const
/** The authored view: level with the figure's chest, looking at the middle of the sky from a little above the water (about 13 degrees), as in the reference render. */
const HOME_TARGET: Cinema2Vector3 = [0, 3.1, 0], HOME_RADIUS = 11, HOME_ELEVATION = 13
const HOME_EYE: Cinema2Vector3 = [0, HOME_TARGET[1] + HOME_RADIUS * Math.sin(HOME_ELEVATION * Math.PI / 180), HOME_RADIUS * Math.cos(HOME_ELEVATION * Math.PI / 180)]
/** Sky Drift: a slow arc round the figure (about 22 degrees either way, with a little rise and fall), always looking at the centre; it starts and ends on the home view. */
const DRIFT_POINTS = Array.from({ length: 24 }, (_, i) => {
  const t = i / 24, azimuth = 22 * Math.PI / 180 * Math.sin(t * Math.PI * 2), elevation = (HOME_ELEVATION + 2.5 * Math.sin(t * Math.PI * 4)) * Math.PI / 180
  return { position: [HOME_RADIUS * Math.cos(elevation) * Math.sin(azimuth), HOME_TARGET[1] + HOME_RADIUS * Math.sin(elevation), HOME_RADIUS * Math.cos(elevation) * Math.cos(azimuth)] as Cinema2Vector3, target: HOME_TARGET }
})

const PARAMETERS: readonly Cinema2ParameterManifest[] = [
  toggle('bpmSync', 'BPM Sync', 'master-controls', true, 0, 'Locks the figure, the planets, the water and the camera drift to the track tempo. Off, they run at a steady 120 BPM.'),
  number('intensity', 'Intensity', 'master-controls', 1, 0, 2, 1, undefined, 'Scales the brightness of every line: the figure, the water, the planets, the stars and the moons. At 0 the picture goes dark.'),
  number('reactivity', 'Audio Reactivity', 'master-controls', .65, 0, 1, 2, undefined, 'How strongly the figure, the planets, the water and the stars follow the music. At 0 the music moves nothing.'),
  toggle('zoomOnKick', 'Zoom on Kick', 'master-controls', true, 3, 'On: the lens punches in a little on every kick, then eases back. Only the field of view changes.'),
  toggle('autoPerformance', 'Auto Performance', 'master-controls', false, 4, 'The music runs the show: it moves the controls with the mood of the passage, chooses how often the Pattern changes, and puts Ascension on stage for a build and Supernova for a drop.'),
  { ...base, id: spaceBoiParameterId('pattern'), label: 'Pattern', type: 'enum', defaultValue: CINEMA2_SPACE_BOI_DEFAULT_PATTERN, options: CINEMA2_SPACE_BOI_PATTERNS, designParentGroup: 'design', group: 'Pattern', order: 0,
    description: 'What the figure, the planets and the water do. Stargazing is the original picture with a slow breath.' },
  { ...toggle('patternChange', 'Pattern Change', 'design', false, 1, 'Advances to the next Pattern each time the Trigger fires.'), group: 'Pattern' },
  { ...base, id: spaceBoiParameterId('trigger'), label: 'Trigger', type: 'enum', defaultValue: 'bar4', options: CINEMA2_AFTERHOURS_TRIGGER_OPTIONS, designParentGroup: 'design', group: 'Pattern', order: 2,
    description: 'The musical event that advances the Pattern.', visibleWhen: [{ kind: 'parameter-equals', parameterId: spaceBoiParameterId('patternChange'), value: true }] },
  number('armMotion', 'Arm Motion', 'design', 1, 0, 1.5, 0, 'Figure', 'How far his two arms swing out, up and forward in the Patterns. Stargazing keeps them still.'),
  number('headMotion', 'Head Motion', 'design', 1, 0, 1.5, 1, 'Figure', 'How far his head turns, tips and leans.'),
  number('bodyMotion', 'Body Motion', 'design', 1, 0, 1.5, 2, 'Figure', 'How far his body sways, rises out of the water and breathes.'),
  number('scoreAmount', 'Kick Ripple', 'design', .5, 0, 1, 3, 'Figure', 'How strongly each kick sends a pulse of light outward: his lines, then the water, then the planets, then the stars.'),
  number('planetMotion', 'Planet Motion', 'design', 1, 0, 1.5, 0, 'Sky', 'How far the planets rise, swell and brighten, and how much the moons swell.'),
  number('starShimmer', 'Star Shimmer', 'design', 1, 0, 1.5, 1, 'Sky', 'How much the stars and moons brighten, and how fast the star field turns.'),
  number('rippleMotion', 'Ripple Motion', 'design', 1, 0, 1.5, 2, 'Water', 'How far the three bands of ripples spread out and how bright they pulse.'),
  number('figureInk', 'Figure Lines', 'design', 1, 0, 2, 0, 'Ink', 'Brightness of the outline and the eyes of the figure.'),
  number('waterInk', 'Water Ripples', 'design', 1, 0, 2, 1, 'Ink', 'Brightness of the ripples in the water.'),
  number('planetInk', 'Planets', 'design', 1, 0, 2, 2, 'Ink', 'Brightness of the planets\' bands and rings.'),
  number('starInk', 'Stars & Moons', 'design', 1, 0, 2, 3, 'Ink', 'Brightness of the stars and the three small moons.'),
  { ...base, id: cameraMode, label: 'Camera Mode', type: 'enum', defaultValue: 'home', designParentGroup: 'design', group: 'Camera', order: 0,
    options: [{ value: 'home', label: 'Home View' }, { value: 'drift', label: 'Sky Drift' }, { value: 'manual', label: 'Manual View' }],
    description: 'Home View is the fixed framing. Sky Drift swings slowly round the figure. Manual View lets you place the camera.' },
  { ...number('cameraSpeed', 'View Motion Speed', 'design', 1, 0, 2, 1, 'Camera', 'How fast the view drifts. With BPM Sync on it also follows the track tempo.'), visibleWhen: when('drift') },
  { ...number('cameraHeading', 'Camera Heading', 'design', 0, -50, 50, 2, 'Camera', 'Turns the camera round the figure, in degrees.'), step: 1, visibleWhen: when('manual') },
  { ...number('cameraElevation', 'Camera Elevation', 'design', HOME_ELEVATION, -5, 45, 3, 'Camera', 'Raises or lowers the camera, in degrees. The water sits level at the figure\'s waist.'), step: 1, visibleWhen: when('manual') },
  { ...number('cameraDistance', 'Camera Distance', 'design', HOME_RADIUS, 8, 13, 4, 'Camera', 'How far the camera stands from the figure.'), visibleWhen: when('manual') },
  { ...number('cameraFov', 'Field of View', 'design', 40, 28, 60, 5, 'Camera', 'The width of the view, in degrees.'), step: 1 },
  number('bloom', 'Bloom', 'effects', .3, 0, 3, 0, undefined, 'A soft glow around every bright line.'),
  number('exposure', 'Exposure', 'effects', 1, .5, 2, 1, undefined, 'Overall brightness of the picture.'),
  number('vignette', 'Vignette', 'effects', 0, 0, 1, 2, undefined, 'Darkens the corners of the picture.'),
  ...SPACE_BOI_PALETTE_NAMES.map((name, order): Cinema2ParameterManifest => ({ ...base, id: spaceBoiParameterId(name), label: PALETTE_LABELS[name], type: 'color', defaultValue: SPACE_BOI_PALETTE_DEFAULTS[name], designParentGroup: 'palette', order,
    description: name === 'voidColor' ? 'The black of the picture: the sky behind everything, the figure\'s fill, the hatching on the planets and the water\'s floor.' : undefined })),
]
const MODULE_BINDINGS = ['bpmSync', 'intensity', 'reactivity', 'autoPerformance', 'pattern', 'patternChange', 'trigger', 'armMotion', 'headMotion', 'bodyMotion', 'scoreAmount', 'planetMotion', 'starShimmer', 'rippleMotion', 'figureInk', 'waterInk', 'planetInk', 'starInk', ...SPACE_BOI_PALETTE_NAMES] as const
/** Score channels the choreography sets (kick ripple); they are module inputs, not controls. */
const SCORE_CHANNELS = ['cueFigure', 'cueWater', 'cuePlanets', 'cueStars'] as const

const root = cinema2StableId<Cinema2SceneNodeId>('space-boi-root')
const scene = cinema2StableId<Cinema2SceneNodeId>('space-boi-scene-node')
const moduleId = cinema2StableId<Cinema2ModuleId>('space-boi-scene')
const camera = cinema2StableId<Cinema2CameraId>('space-boi-camera')
const target = cinema2StableId<Cinema2RenderTargetId>('space-boi-target')
const scenePass = cinema2StableId<Cinema2RenderPassId>('space-boi-world')
const color = cinema2StableId<Cinema2RenderSlotId>('space-boi-world-color')
const outputPass = cinema2StableId<Cinema2RenderPassId>('space-boi-output')
const bloom = cinema2StableId<Cinema2EffectId>('space-boi-source-bloom')
const finish = cinema2StableId<Cinema2EffectId>('space-boi-source-finish')
const bloomPass = cinema2StableId<Cinema2RenderPassId>('space-boi-bloom-pass')
const bloomTarget = cinema2StableId<Cinema2RenderTargetId>('space-boi-bloom-target')
const bloomColor = cinema2StableId<Cinema2RenderSlotId>('space-boi-bloom-color')
const finishPass = cinema2StableId<Cinema2RenderPassId>('space-boi-finish-pass')
const finishTarget = cinema2StableId<Cinema2RenderTargetId>('space-boi-finish-target')
const finishColor = cinema2StableId<Cinema2RenderSlotId>('space-boi-finish-color')

const authored: Readonly<Cinema2NativePresetManifest> = {
  schemaId: CINEMA2_NATIVE_PRESET_SCHEMA_ID,
  schemaVersion: CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  id: CINEMA2_SPACE_BOI_PRESET_ID,
  revision: 1,
  metadata: {
    name: 'Space Boi',
    description: 'A figure standing waist deep in black water under a sky of planets, drawn in two flat inks. He turns his head, sways, breathes and raises his arms; the planets rise and swell, the ripples spread and the stars brighten with the music, in eight Patterns.',
    author: 'STAGELESS. Original model "space boi" by silvercrow101 (CC BY-NC 4.0).',
    tags: ['reference', 'animated', '3d', 'character'],
  },
  capabilities: [
    { id: 'render.webgl2', requirement: 'required', purpose: 'Render the original space boi model.' },
    { id: 'render.depth', requirement: 'required', purpose: 'Resolve the figure, the planets and the black water against each other.' },
    { id: 'render.hdr', requirement: 'optional', purpose: 'Let a brightened line bloom before neutral output.' },
    { id: 'scene.3d', requirement: 'required', purpose: 'Place the imported scene in world space.' },
    { id: 'camera.world', requirement: 'required', purpose: 'Frame the scene with a perspective camera.' },
  ],
  scene: {
    roots: [cinema2Ref(root)],
    nodes: [
      { id: root, kind: 'group', coordinateSpace: 'world' },
      // The file is exported at the origin with the water at y = 0: no offset is needed.
      { id: scene, kind: 'module', parent: cinema2Ref(root), module: cinema2Ref(moduleId) },
    ],
  },
  modules: [{
    id: moduleId, typeId: CINEMA2_SPACE_BOI_MODULE_TYPE_ID, version: 1,
    // The GLB's own flat unlit materials are kept; the module only recolours its own copies and poses the figure, planets, water and stars.
    config: { instances: [{ asset: 'cinema2-space-boi', node: scene, preserveMaterials: true, spin: false }], hdr: true },
    parameters: { ...Object.fromEntries(MODULE_BINDINGS.map(name => [name, PARAMETERS.find(parameter => parameter.id === spaceBoiParameterId(name))!.defaultValue!])), ...Object.fromEntries(SCORE_CHANNELS.map(name => [name, 0])) },
    parameterBindings: Object.fromEntries(MODULE_BINDINGS.map(name => [name, bind(name)])),
  }],
  parameters: PARAMETERS,
  cameras: [{
    id: camera, label: 'Space Boi View', projection: 'perspective',
    fovDegrees: 40, minAspect: 16 / 9, near: 0.05, far: 120,
    transform: { position: HOME_EYE },
    target: HOME_TARGET,
    // The base rig is the drift (a path is needed for the motion settings below); Camera Mode picks Home View (this camera's fixed pose) by default.
    rig: { kind: 'path', points: DRIFT_POINTS, durationSeconds: 48, loop: true },
    rigVariants: {
      home: { kind: 'static' },
      drift: { kind: 'path', points: DRIFT_POINTS, durationSeconds: 48, loop: true },
      manual: { kind: 'orbit', radius: HOME_RADIUS, azimuthDegrees: 0, elevationDegrees: HOME_ELEVATION, angularVelocityDegreesPerSecond: 0 },
    },
    // The drift runs at bpm / 120 of its authored speed with BPM Sync on. The safety box keeps every view, Manual View included, in front of the figure and above the water.
    motion: { idleMotion: true, interpolation: 'spline', constantSpeed: true, tempo: { referenceBpm: 120, flightSpeed: true, minRate: .5, maxRate: 1.75, punch: 1.6 } },
    safety: { minPosition: [-10, 1.4, 4], maxPosition: [10, 12, 14], minFovDegrees: 24, maxFovDegrees: 66 },
    controls: { rigMode: bind('cameraMode'), motionSpeed: bind('cameraSpeed'), tempoSync: bind('bpmSync'), kickZoom: bind('zoomOnKick'), orbitRadius: bind('cameraDistance'), orbitAzimuthDegrees: bind('cameraHeading'), orbitElevationDegrees: bind('cameraElevation'), fovDegrees: bind('cameraFov') },
  }],
  defaults: { camera: cinema2Ref(camera) },
  // The void is the background: the figure's fill and the water's floor are drawn in the same colour, so the picture stays cut out whatever it is set to.
  environment: { backgroundColor: [0, 0, 0, 1], exposure: 1, controls: { backgroundColor: bind('voidColor') } },
  effects: [
    { id: bloom, typeId: cinema2StableId('hdr-bloom'), version: 1, enabled: true, scope: 'output', order: 0,
      parameters: { mix: .8, threshold: .8, knee: .2, intensity: 1, spread: .6, levels: 6 }, parameterBindings: { intensity: bind('bloom') } },
    // No tone mapping: the two inks must come out exactly as the file authors them.
    { id: finish, typeId: cinema2StableId('cinematic-finish'), version: 1, enabled: true, scope: 'output', order: 1,
      parameters: { mix: 1, toneMap: 0, exposure: 1, contrast: 1, saturation: 1, temperature: 0, tint: 0, tintAmount: 0, vignette: 0, grain: 0, aberration: 0 }, parameterBindings: { exposure: bind('exposure'), vignette: bind('vignette') } },
  ],
  render: {
    targets: [
      { id: target, descriptor: { size: { kind: 'viewport' }, colorFormat: 'rgba16f', fallbackColorFormat: 'rgba8', depthFormat: 'depth24' } },
      ...[bloomTarget, finishTarget].map(id => ({ id, descriptor: { size: { kind: 'viewport' as const }, colorFormat: 'rgba16f' as const, fallbackColorFormat: 'rgba8' as const }, ownership: 'transient' as const })),
    ],
    passes: [
      { id: scenePass, kind: 'scene', scene: cinema2Ref(root), outputs: [{ id: color, target: cinema2Ref(target), attachment: 'color' }] },
      { id: bloomPass, kind: 'fullscreen', effect: cinema2Ref(bloom), dependsOn: [cinema2Ref(scenePass)], inputs: [{ id: cinema2StableId('space-boi-bloom-input'), source: { pass: cinema2Ref(scenePass), output: color }, attachment: 'color' }], outputs: [{ id: bloomColor, target: cinema2Ref(bloomTarget), attachment: 'color' }] },
      { id: finishPass, kind: 'fullscreen', effect: cinema2Ref(finish), dependsOn: [cinema2Ref(bloomPass)], inputs: [{ id: cinema2StableId('space-boi-finish-input'), source: { pass: cinema2Ref(bloomPass), output: bloomColor }, attachment: 'color' }], outputs: [{ id: finishColor, target: cinema2Ref(finishTarget), attachment: 'color' }] },
      { id: outputPass, kind: 'output', inputs: [{ id: cinema2StableId('space-boi-input'), source: { pass: cinema2Ref(finishPass), output: finishColor }, attachment: 'color' }] },
    ],
    outputPass: cinema2Ref(outputPass),
  },
  output: { renderPass: cinema2Ref(outputPass), colorSpace: 'srgb', alphaMode: 'opaque' },
}

const kebab = (name: string) => name.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)

/** Audio choreography, the mood drives and Auto Performance. Every target is one of the preset's own controls, so the Inspector shows each moving and Auto Performance locks it. */
function withSpaceBoiPerformance(manifest: Readonly<Cinema2NativePresetManifest>): Readonly<Cinema2NativePresetManifest> {
  const module = manifest.modules![0]!, bloom = manifest.effects![0]!
  const target = (property: string) => property === 'bloom' ? { kind: 'effect' as const, ref: cinema2Ref(bloom.id), property: 'intensity' } : { kind: 'module' as const, ref: cinema2Ref(module.id), property }
  const continuous = (name: string, capability: Cinema2CapabilityId, path: Cinema2ChoreographyContinuousSourcePath, property: string, factor: number, gated = false): Cinema2ChoreographyRuleManifest => ({
    id: cinema2StableId<Cinema2ChoreographyRuleId>(`space-boi-${name}`), priority: 20, strengthParameter: bind('reactivity'), ...(gated ? { enabledParameter: bind('autoPerformance') } : {}),
    source: { signal: 'continuous', capability, path, clamp: [0, 1], smoothingMs: 150 },
    actions: [{ id: cinema2StableId<Cinema2ChoreographyActionId>(`space-boi-${name}-drive`), target: target(property), operation: 'multiply', value: factor }],
  })
  const accent = (signal: 'kick' | 'snare' | 'downbeat' | 'drop', name: string, property: string, factor: number, release: number): Cinema2ChoreographyRuleManifest => ({
    id: cinema2StableId<Cinema2ChoreographyRuleId>(`space-boi-${signal}-${name}`), priority: 30, strengthParameter: bind('reactivity'),
    source: { signal, capability: signal === 'drop' ? 'music.drop' : signal === 'downbeat' ? 'music.downbeat' : 'music.rhythm-events' },
    conditions: [{ kind: 'once-per-event' }, ...(signal === 'drop' ? [] : [{ kind: 'not-silent' as const }])],
    actions: [{ id: cinema2StableId<Cinema2ChoreographyActionId>(`space-boi-${signal}-${name}-accent`), target: target(property), operation: 'envelope', composition: 'multiply', value: factor, envelope: { attack: .015, hold: .035, release, unit: 'seconds' }, retrigger: 'restart' }],
  })
  const rules = [
    // The water breathes with the bass, the planets follow the mids, the stars the highs, his head the voice, his arms the overall energy.
    continuous('bass-ripples', 'audio.bands', 'audio.bands.bass', 'rippleMotion', 1.5), continuous('bass-water', 'audio.bands', 'audio.bands.bass', 'waterInk', 1.3),
    continuous('mid-planets', 'audio.bands', 'audio.bands.mid', 'planetMotion', 1.25), continuous('mid-planet-ink', 'audio.bands', 'audio.bands.mid', 'planetInk', 1.2),
    continuous('high-stars', 'audio.bands', 'audio.bands.high', 'starShimmer', 1.5), continuous('high-star-ink', 'audio.bands', 'audio.bands.high', 'starInk', 1.3),
    continuous('energy-arms', 'audio.features', 'audio.features.overallEnergy', 'armMotion', 1.4), continuous('energy-intensity', 'audio.features', 'audio.features.overallEnergy', 'intensity', 1.15),
    continuous('vocal-head', 'music.vocal-presence', 'audio.features.vocalPresence', 'headMotion', 1.5), continuous('vocal-figure', 'music.vocal-presence', 'audio.features.vocalPresence', 'figureInk', 1.2),
    // A kick makes him move: the arms tap and the body dips; a snare flashes the planets and the stars; a downbeat nods his head.
    accent('kick', 'arms', 'armMotion', 1.5, .25), accent('kick', 'body', 'bodyMotion', 1.6, .25),
    accent('snare', 'planets', 'planetInk', 1.9, .2), accent('snare', 'stars', 'starInk', 2, .25),
    accent('downbeat', 'head', 'headMotion', 2, .3),
    accent('drop', 'bloom', 'bloom', 1.7, 1.2), accent('drop', 'intensity', 'intensity', 1.25, 1.2), accent('drop', 'ripples', 'rippleMotion', 1.6, 1.2), accent('drop', 'planets', 'planetMotion', 1.5, 1.2),
    // Kick ripple: his lines, the water, the planets, the stars, each an eighth of a beat after the last.
    ...(['cueFigure', 'cueWater', 'cuePlanets', 'cueStars'] as const).map((channel, step): Cinema2ChoreographyRuleManifest => ({
      id: cinema2StableId<Cinema2ChoreographyRuleId>(`space-boi-score-kick-${kebab(channel)}`), priority: 40, strengthParameter: bind('reactivity'), enabledWhen: [{ kind: 'parameter-not-equals', parameterId: spaceBoiParameterId('scoreAmount'), value: 0 }],
      source: { signal: 'kick', capability: 'music.rhythm-events' }, conditions: [{ kind: 'once-per-event' }, { kind: 'not-silent' }],
      actions: [{ id: cinema2StableId<Cinema2ChoreographyActionId>(`space-boi-score-${kebab(channel)}-cue`), target: target(channel), operation: 'envelope', composition: 'replace', value: 1, delayBeats: step * .125, envelope: { attack: .015, hold: .035, release: .22 + step * .02, unit: 'seconds' }, retrigger: 'restart' }],
    })),
    continuous('director-water', 'visual-director.significance', 'director.intensity', 'waterInk', 1.15, true),
  ]
  const drive = (id: string, property: string, source: Cinema2MoodDrive['source'], value: number): Cinema2MoodDrive => ({ id, target: target(property) as Cinema2MoodDrive['target'], source, operation: 'multiply', value })
  const drives: Cinema2MoodDrive[] = [
    drive('calm-arms', 'armMotion', 'mood.calm', .7), drive('peak-arms', 'armMotion', 'mood.peak', 1.3), drive('calm-planets', 'planetMotion', 'mood.calm', .8), drive('calm-intensity', 'intensity', 'mood.calm', .85),
    drive('activity-ripples', 'rippleMotion', 'mood.activity', 1.15), drive('activity-stars', 'starShimmer', 'mood.activity', 1.2),
    drive('momentum-head', 'headMotion', 'mood.momentum', 1.2), drive('energy-intensity', 'intensity', 'mood.energy', 1.15), drive('drive-body', 'bodyMotion', 'mood.drive', 1.3),
    // A build lifts the planets' and the stars' light; a peak lights the figure and the water and lifts the bloom; a shock flares the stars.
    drive('build-planet-ink', 'planetInk', 'mood.build', 1.4), drive('build-star-ink', 'starInk', 'mood.build', 1.3),
    drive('peak-figure-ink', 'figureInk', 'mood.peak', 1.2), drive('peak-water-ink', 'waterInk', 'mood.peak', 1.25), drive('peak-bloom', 'bloom', 'mood.peak', 1.3),
    drive('shock-star-ink', 'starInk', 'mood.shock', 1.5), drive('shock-planet-motion', 'planetMotion', 'mood.shock', 1.4),
  ]
  for (const name of ['intensity', 'armMotion', 'headMotion', 'bodyMotion', 'planetMotion', 'rippleMotion', 'starShimmer', 'bloom']) drives.push(drive(`silence-${name.toLowerCase()}`, name, 'mood.silence', .1))
  return withCinema2MoodDrives({
    ...manifest,
    capabilities: [...manifest.capabilities ?? [], ...(['audio.transport', 'audio.bands', 'audio.features', 'music.rhythm-events', 'music.downbeat', 'music.drop', 'music.vocal-presence', 'visual-director.significance'] as const).map(id => ({ id, requirement: 'optional' as const, purpose: 'Shared musical facts and performance meaning.' }))],
    choreography: { tempoSyncParameter: bind('bpmSync'), rules },
  }, { idPrefix: 'space-boi', enabledParameter: spaceBoiParameterId('autoPerformance'), strengthParameter: spaceBoiParameterId('reactivity'), patternControls: { patternChange: spaceBoiParameterId('patternChange'), trigger: spaceBoiParameterId('trigger') }, drives })
}

export const CINEMA2_SPACE_BOI_PRESET_MANIFEST: Readonly<Cinema2NativePresetManifest> = withSpaceBoiPerformance(authored)
