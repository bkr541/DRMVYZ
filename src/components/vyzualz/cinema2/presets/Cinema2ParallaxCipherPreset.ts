import {
  cinema2Ref, cinema2StableId, type Cinema2Vector3, type Cinema2LightId, type Cinema2CapabilityId, type Cinema2ChoreographyActionId, type Cinema2ChoreographyContinuousSourcePath, type Cinema2ChoreographyRuleId,
  type Cinema2ChoreographyRuleManifest, type Cinema2NativePresetManifest, type Cinema2ParameterId, type Cinema2ParameterManifest,
} from '../contracts/Cinema2NativePresetManifest'
import { CINEMA2_PARALLAX_CIPHER_MODULE_TYPE_ID } from '../modules/Cinema2CratePresentationModule'
import {
  PARALLAX_CIPHER_CAMERA_POINTS, PARALLAX_CIPHER_DURATION, PARALLAX_CIPHER_EYE, PARALLAX_CIPHER_TARGET, PARALLAX_CIPHER_TEXT,
} from '../modules/crate/Cinema2ParallaxCipherLayout'
import { PARALLAX_CIPHER_PALETTE_DEFAULTS, PARALLAX_CIPHER_PALETTE_NAMES } from '../modules/crate/Cinema2ParallaxCipherPalette'
import { CINEMA2_PARALLAX_CIPHER_DEFAULT_PATTERN, CINEMA2_PARALLAX_CIPHER_PATTERNS } from '../modules/crate/Cinema2ParallaxCipherPatterns'
import { CINEMA2_SAY_IT_GLYPH_ASSET_ID } from '../modules/three/Cinema2ThreeAssetManifest'
import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from './Cinema2AfterhoursPreset'
import { CINEMA2_HDR_BLOOM_EFFECT_TYPE_ID } from '../effects/Cinema2HdrBloomEffect'
import { CINEMA2_CINEMATIC_FINISH_EFFECT_TYPE_ID } from '../effects/Cinema2CinematicFinishEffect'
import { CINEMA2_VOLUMETRIC_ATMOSPHERE_EFFECT_TYPE_ID } from '../effects/Cinema2VolumetricAtmosphereEffect'
import { CINEMA2_GLARE_EFFECT_TYPE_ID } from '../effects/Cinema2GlareEffect'
import { finishParallaxCipher } from './Cinema2ParallaxCipherFinish'
import { withCinema2MoodDrives, type Cinema2MoodDrive } from './Cinema2MoodConductorAuthoring'

export const CINEMA2_PARALLAX_CIPHER_TEXT_ID = cinema2StableId<Cinema2ParameterId>('parallax-cipher-text')
export const parallaxCipherParameterId = (name: string) => cinema2StableId<Cinema2ParameterId>(`parallax-cipher-${name.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}`)
export const CINEMA2_PARALLAX_CIPHER_LINE_MODE_ID = parallaxCipherParameterId('lineMode')
export const CINEMA2_PARALLAX_CIPHER_LINE_TWO_TEXT_ID = parallaxCipherParameterId('lineTwoText')
export const CINEMA2_PARALLAX_CIPHER_PATTERN_ID = parallaxCipherParameterId('pattern')
/** Envelope-driven channels the score cues write; they have no control of their own, like Bass Sigil's. */
export const PARALLAX_CIPHER_SCORE_CHANNELS = ['platePulse', 'letterRipple', 'dropRelease'] as const

const base = { section: 'Design', exposure: 'primary', persistence: 'preset', reset: 'authored-default' } as const
const number = (name: string, label: string, parent: Cinema2ParameterManifest['designParentGroup'], value: number, min: number, max: number, order: number, group?: string, description?: string): Cinema2ParameterManifest =>
  ({ ...base, id: parallaxCipherParameterId(name), label, type: 'float', defaultValue: value, min, max, step: .01, designParentGroup: parent, order, group, ...(description ? { description } : {}) })
const toggle = (name: string, label: string, parent: Cinema2ParameterManifest['designParentGroup'], value: boolean, order: number, group?: string, description?: string): Cinema2ParameterManifest =>
  ({ ...base, id: parallaxCipherParameterId(name), label, type: 'boolean', defaultValue: value, designParentGroup: parent, order, group, ...(description ? { description } : {}) })

const PARALLAX_CIPHER_DISTANCE = PARALLAX_CIPHER_EYE[2]
/** Where the haze's coloured lights stand: beside the word on each side, and inside the weave. */
const HAZE_LIGHTS = [
  { id: 'cyan', palette: 'leftBankColor', position: [-3.6, 1.1, 4.5] as Cinema2Vector3, intensity: 1, range: 16 },
  { id: 'magenta', palette: 'rightBankColor', position: [3.6, 1.1, 4.5] as Cinema2Vector3, intensity: 1, range: 16 },
  { id: 'red', palette: 'redMarkerColor', position: [0, -.4, -6.4] as Cinema2Vector3, intensity: .8, range: 10 },
] as const
const PALETTE_LABELS = { leftBankColor: 'Left Bank', rightBankColor: 'Right Bank', letterColor: 'Letters', weaveColor: 'Weave', redMarkerColor: 'Red Marker' } as const
/** Every control the module reads, by the module-parameter name it is bound to. */
export const PARALLAX_CIPHER_MODULE_BINDINGS = [
  'bpmSync', 'intensity', 'reactivity', 'autoPerformance', 'pattern', 'patternChange', 'trigger', 'plateSpread', 'bankTwist', 'weaveScale', 'depthStagger',
  'nearContours', 'farContours', 'letterBevels', 'registrationDots', 'redMarker', 'lineMode', 'lineHold', 'textMotion', 'scoreAmount', ...PARALLAX_CIPHER_PALETTE_NAMES,
] as const

export function withCinema2ParallaxCipher(manifest: Readonly<Cinema2NativePresetManifest>, prefix: string): Readonly<Cinema2NativePresetManifest> {
  const camera = manifest.cameras![0]!
  const module = manifest.modules![0]!
  const source = manifest.scene!.nodes.find(node => node.kind === 'module')!
  const bind = (name: string) => cinema2Ref(parallaxCipherParameterId(name))
  const parameters: Cinema2ParameterManifest[] = [
    toggle('zoomOnKick', 'Zoom on Kick', 'master-controls', true, 2, undefined, 'On: the lens punches in a little on every kick, then eases back. The letters stay aligned because only the field of view changes.'),
    toggle('bpmSync', 'BPM Sync', 'master-controls', true, 0, undefined, 'Locks the plate and letter motion to the track tempo; off, they run at a fixed 120 BPM.'),
    number('intensity', 'Intensity', 'master-controls', 1, 0, 2, 1, undefined, 'Scales every glowing line, dot, bevel and the red marker.'),
    number('reactivity', 'Audio Reactivity', 'master-controls', .65, 0, 1, 2, undefined, 'How strongly the plates, lights and weave follow the music. At 0 the music moves nothing.'),
    toggle('autoPerformance', 'Auto Performance', 'master-controls', false, 3, undefined, 'The music runs the show: it moves the controls with the mood of the passage, chooses how often the Pattern changes, and puts Collapse on stage for a build and Shatter for a drop.'),
    { ...base, id: CINEMA2_PARALLAX_CIPHER_PATTERN_ID, label: 'Pattern', type: 'enum', defaultValue: CINEMA2_PARALLAX_CIPHER_DEFAULT_PATTERN, options: CINEMA2_PARALLAX_CIPHER_PATTERNS, designParentGroup: 'design', group: 'Pattern', order: 0,
      description: 'How the plate banks, the weave and the letters move with the beat.' },
    toggle('patternChange', 'Pattern Change', 'design', false, 1, 'Pattern', 'Advances to the next Pattern each time the Trigger fires.'),
    { ...base, id: parallaxCipherParameterId('trigger'), label: 'Trigger', type: 'enum', defaultValue: 'bar4', options: CINEMA2_AFTERHOURS_TRIGGER_OPTIONS, designParentGroup: 'design', group: 'Pattern', order: 2,
      description: 'The musical event that advances the Pattern.', visibleWhen: [{ kind: 'parameter-equals', parameterId: parallaxCipherParameterId('patternChange'), value: true }] },
    { ...base, id: parallaxCipherParameterId('cameraMode'), label: 'Camera Mode', type: 'enum', defaultValue: 'path', designParentGroup: 'design', group: 'Camera', order: 0,
      options: [{ value: 'reveal', label: 'Reveal Hold' }, { value: 'path', label: 'Immersive Path' }, { value: 'manual', label: 'Manual View' }],
      description: 'Reveal Hold keeps the one sightline where the word reads. Immersive Path swings the view out and back through the corridor. Manual View lets you place the camera.' },
    { ...number('cameraSpeed', 'View Motion Speed', 'design', 1, 0, 2, 1, 'Camera', 'How fast the view travels along the path. With BPM Sync on it also follows the track tempo.'),
      visibleWhen: [{ kind: 'parameter-equals', parameterId: parallaxCipherParameterId('cameraMode'), value: 'path' }] },
    { ...number('cameraHeading', 'Camera Heading', 'design', 0, -45, 45, 2, 'Camera', 'Turns the camera around the weave, in degrees.'), step: 1,
      visibleWhen: [{ kind: 'parameter-equals', parameterId: parallaxCipherParameterId('cameraMode'), value: 'manual' }] },
    { ...number('cameraElevation', 'Camera Elevation', 'design', 0, -15, 30, 3, 'Camera', 'Raises or lowers the camera, in degrees.'), step: 1,
      visibleWhen: [{ kind: 'parameter-equals', parameterId: parallaxCipherParameterId('cameraMode'), value: 'manual' }] },
    { ...number('cameraDistance', 'Camera Distance', 'design', PARALLAX_CIPHER_DISTANCE, 10, 18, 4, 'Camera', 'How far the camera stands from the weave.'),
      visibleWhen: [{ kind: 'parameter-equals', parameterId: parallaxCipherParameterId('cameraMode'), value: 'manual' }] },
    number('plateSpread', 'Plate Spread', 'design', 1, .6, 1.5, 0, 'Geometry', 'How far the two walls of plates stand from the centre line.'),
    number('bankTwist', 'Bank Twist', 'design', 1, 0, 1.5, 1, 'Geometry', 'How far the plate banks turn as the view moves and the Pattern plays.'),
    number('weaveScale', 'Weave Scale', 'design', 1, .5, 1.6, 2, 'Geometry', 'The size of the original weave at the vanishing point.'),
    number('depthStagger', 'Letter Depth', 'design', 1, 0, 1.5, 3, 'Geometry', 'How far the letters are spread in depth. At 0 the word sits on a single plane; it still reads at the reveal for any value.'),
    number('nearContours', 'Near Contours', 'design', 1, 0, 2, 0, 'Lighting', 'The glowing rim lines on the banks nearest the viewer.'),
    number('farContours', 'Far Contours', 'design', 1, 0, 2, 1, 'Lighting', 'The glowing rim lines on the banks in the distance.'),
    number('letterBevels', 'Letter Bevels', 'design', 1, 0, 2, 2, 'Lighting', 'The glowing edge of each letter.'),
    number('registrationDots', 'Registration Dots', 'design', 1, 0, 2, 3, 'Lighting', 'The rows of dots along the floor.'),
    number('reflections', 'Reflections', 'design', 1, 0, 3, 5, 'Lighting', 'How strongly the plates and letters mirror the studio around them.'),
    number('redMarker', 'Red Marker', 'design', 1, 0, 2, 4, 'Lighting', 'The red marker inside the weave and its two floor ticks.'),
    // The two typed lines follow SAY IT's input style: a Line Mode, then Line 1 and Line 2 (12 characters each, 20 in all). One line is on stage at a time;
    // with both typed, the patterns take the word off and the other line on through their own text transitions.
    {
      ...base, id: CINEMA2_PARALLAX_CIPHER_LINE_MODE_ID, label: 'Line Mode', type: 'enum', defaultValue: 'two', designParentGroup: 'design', group: 'Typography', order: 0,
      options: [{ value: 'one', label: 'One Line' }, { value: 'two', label: 'Two Lines' }],
      description: 'One line, or two lines that take turns on stage with 20 characters in all. Only one line is shown at a time so the word keeps reading from the reveal camera.',
    },
    {
      id: CINEMA2_PARALLAX_CIPHER_TEXT_ID, label: 'Line 1', type: 'string', defaultValue: PARALLAX_CIPHER_TEXT,
      description: 'First line of printable English letters, numbers and punctuation; limited to 12 characters.',
      section: 'Design', designParentGroup: 'design', group: 'Typography', order: 1,
      exposure: 'primary', persistence: 'preset', reset: 'authored-default', modulatable: false, choreographable: false,
    },
    {
      id: CINEMA2_PARALLAX_CIPHER_LINE_TWO_TEXT_ID, label: 'Line 2', type: 'string', defaultValue: '',
      description: 'Second line of printable English letters, numbers and punctuation; limited to 12 characters and 20 total across both lines. It takes the stage after Line 1, through the active pattern\'s transition.',
      section: 'Design', designParentGroup: 'design', group: 'Typography', order: 2,
      exposure: 'primary', persistence: 'preset', reset: 'authored-default', modulatable: false, choreographable: false,
      visibleWhen: [{ kind: 'parameter-equals', parameterId: CINEMA2_PARALLAX_CIPHER_LINE_MODE_ID, value: 'two' }],
    },
    {
      ...base, id: parallaxCipherParameterId('lineHold'), label: 'Line Hold', type: 'enum', defaultValue: '4', designParentGroup: 'design', group: 'Typography', order: 3,
      options: [{ value: '1', label: '1 Bar' }, { value: '2', label: '2 Bars' }, { value: '4', label: '4 Bars' }, { value: '8', label: '8 Bars' }, { value: '16', label: '16 Bars' }],
      description: 'How many bars each line holds before the next one takes over. A drop also brings the other line on with Auto Performance.',
      visibleWhen: [{ kind: 'parameter-equals', parameterId: CINEMA2_PARALLAX_CIPHER_LINE_MODE_ID, value: 'two' }],
    },
    number('textMotion', 'Letter Motion', 'design', 1, 0, 1.5, 4, 'Typography', 'How strongly the letters play their pattern\'s text effect and its line transition. At 0 the word stays still and a line change is instant.'),
    number('scoreAmount', 'Score Amount', 'design', .5, 0, 1, 3, 'Pattern', 'How much the kick, snare and drop cues play on the plates, letters and weave. Zero turns the score off.'),
    number('bloom', 'Bloom', 'effects', .31, 0, 1, 0, undefined, 'The glow around every light.'),
    number('haze', 'Haze', 'effects', .16, 0, 1, 1, undefined, 'The air in the corridor: far banks fade into it, and the cyan, magenta and red lights show as shafts. At 0 the air is clear.'),
    number('floorReflection', 'Floor Reflection', 'effects', .5, 0, 1, 2, undefined, 'A glossy floor under the corridor that mirrors the plates, the letters and the dots. At 0 there is no floor.'),
    number('depthFocus', 'Depth Focus', 'effects', .25, 0, 1, 3, undefined, 'Softens the banks nearest the viewer and the far end of the corridor while the word stays sharp. At 0 everything is sharp.'),
    number('lightFlares', 'Light Flares', 'effects', .08, 0, 1, 4, undefined, 'Star-shaped glints on the brightest edges and letters.'),
    number('filmGrain', 'Film Grain', 'effects', .07, 0, .5, 5, undefined, 'A fine film grain over the picture.'),
    number('lensFringe', 'Lens Fringe', 'effects', .05, 0, .5, 6, undefined, 'Colour fringing toward the edges of the picture, like a lens. It widens on the kick and the drop.'),
    number('vignette', 'Vignette', 'effects', .22, 0, 1, 7, undefined, 'Darkens the corners of the picture.'),
    ...PARALLAX_CIPHER_PALETTE_NAMES.map((name, order): Cinema2ParameterManifest => ({
      ...base, id: parallaxCipherParameterId(name), label: PALETTE_LABELS[name], type: 'color', defaultValue: PARALLAX_CIPHER_PALETTE_DEFAULTS[name], designParentGroup: 'palette', order,
    })),
  ]
  const pathRig = { kind: 'path' as const, points: PARALLAX_CIPHER_CAMERA_POINTS, durationSeconds: PARALLAX_CIPHER_DURATION, loop: true }
  const bound = (name: string) => name === 'cipherText' ? CINEMA2_PARALLAX_CIPHER_TEXT_ID : name === 'lineTwoText' ? CINEMA2_PARALLAX_CIPHER_LINE_TWO_TEXT_ID : parallaxCipherParameterId(name)
  const moduleNames = ['cipherText', 'lineTwoText', ...PARALLAX_CIPHER_MODULE_BINDINGS]
  const defaults = Object.fromEntries(moduleNames.map(name => [name, parameters.find(parameter => parameter.id === bound(name))!.defaultValue!]))
  const finished = finishParallaxCipher({
    ...manifest,
    revision: 4,
    metadata: {
      ...manifest.metadata,
      description: 'Parallax Cipher. A deep, hazy corridor of the original angular planes on a glossy floor, with beveled letters that align from a single sightline, light shafts and six beat-driven patterns.',
      tags: ['reference', 'crate', 'animated', '3d', 'typography'],
    },
    parameters,
    cameras: [{
      ...camera, label: 'Parallax Cipher', fovDegrees: 45, minAspect: 1.32, near: .08, far: 88,
      transform: { position: PARALLAX_CIPHER_EYE }, target: PARALLAX_CIPHER_TARGET, smoothingMs: 0,
      rig: pathRig,
      // Reveal Hold is the single sightline; Immersive Path is the authored swing; Manual View orbits the weave from the same starting view.
      rigVariants: { reveal: { kind: 'static' }, path: pathRig, manual: { kind: 'orbit', radius: PARALLAX_CIPHER_DISTANCE, azimuthDegrees: 0, elevationDegrees: 0, angularVelocityDegreesPerSecond: 0 } },
      // The path runs at bpm / 120 of its authored speed (the 24 s loop is 12 bars at 120 BPM) with BPM Sync on, and at its authored speed otherwise.
      // No sway, bob or roll is added (they would pull the letters off their sightline); the only tempo accent is the kick's lens punch, which changes
      // the field of view and never the viewpoint.
      motion: { idleMotion: true, interpolation: 'linear', tempo: { referenceBpm: 120, flightSpeed: true, minRate: .5, maxRate: 1.75, punch: 1.8 } },
      // Keeps every view, including Manual View, outside the nearest plate banks.
      safety: { minPosition: [-5.4, -3.5, 8.4], maxPosition: [5.4, 5.5, 20], minFovDegrees: 40, maxFovDegrees: 50 },
      controls: { rigMode: bind('cameraMode'), motionSpeed: bind('cameraSpeed'), tempoSync: bind('bpmSync'), kickZoom: bind('zoomOnKick'), orbitRadius: bind('cameraDistance'), orbitAzimuthDegrees: bind('cameraHeading'), orbitElevationDegrees: bind('cameraElevation') },
    }],
    // The three coloured lights the haze scatters: cyan and magenta stand in the corridor beside the word, red inside the weave. Their colours are the palette's
    // Left Bank, Right Bank and Red Marker, so recolouring the banks recolours the air too.
    lighting: { lights: [
      ...manifest.lighting!.lights.map(light => ({ ...light, intensity: light.type === 'ambient' ? .72 : 1.5 })),
      ...HAZE_LIGHTS.map(entry => ({
        id: cinema2StableId<Cinema2LightId>(`${prefix}-haze-${entry.id}`), type: 'point' as const, color: [...PARALLAX_CIPHER_PALETTE_DEFAULTS[entry.palette]] as [number, number, number, number], intensity: entry.intensity,
        controls: { color: bind(entry.palette) }, transform: { position: entry.position }, config: { range: entry.range },
      })),
    ] },
    environment: { backgroundColor: [.018, .022, .035, 1], exposure: 1 },
    modules: [{
      ...module, typeId: CINEMA2_PARALLAX_CIPHER_MODULE_TYPE_ID,
      parameters: { ...defaults, environmentIntensity: 1, ...Object.fromEntries(PARALLAX_CIPHER_SCORE_CHANNELS.map(name => [name, 0])) },
      parameterBindings: { ...Object.fromEntries(moduleNames.map(name => [name, cinema2Ref(bound(name))])), environmentIntensity: bind('reflections') },
      config: { instances: [
        { asset: 'cinema2-crate-paradox-weave', node: source.id, preserveMaterials: true, spin: false },
        { asset: CINEMA2_SAY_IT_GLYPH_ASSET_ID, preserveMaterials: true, spin: false },
      ] },
    }],
  }, prefix, parallaxCipherParameterId)
  return withParallaxCipherPerformance(finished, bind)
}

type Bind = (name: string) => ReturnType<typeof cinema2Ref<'parameter'>>

/** Audio choreography, the mood drives and Auto Performance. Every target is one of the preset's own controls, so the Inspector shows each one moving and Auto Performance locks it. */
function withParallaxCipherPerformance(manifest: Readonly<Cinema2NativePresetManifest>, bind: Bind): Readonly<Cinema2NativePresetManifest> {
  const module = manifest.modules![0]!
  const effectOf = (typeId: string) => manifest.effects!.find(effect => effect.typeId === typeId)!
  const moduleTarget = (property: string) => ({ kind: 'module' as const, ref: cinema2Ref(module.id), property })
  // The finishing effects that react: bloom, the grade's lens fringe, the haze and the glare. Each property is the one its control is bound to.
  const effectTargets: Record<string, { kind: 'effect'; ref: ReturnType<typeof cinema2Ref<'effect'>>; property: string }> = {
    bloom: { kind: 'effect', ref: cinema2Ref(effectOf(CINEMA2_HDR_BLOOM_EFFECT_TYPE_ID).id), property: 'intensity' },
    lensFringe: { kind: 'effect', ref: cinema2Ref(effectOf(CINEMA2_CINEMATIC_FINISH_EFFECT_TYPE_ID).id), property: 'aberration' },
    haze: { kind: 'effect', ref: cinema2Ref(effectOf(CINEMA2_VOLUMETRIC_ATMOSPHERE_EFFECT_TYPE_ID).id), property: 'mix' },
    lightFlares: { kind: 'effect', ref: cinema2Ref(effectOf(CINEMA2_GLARE_EFFECT_TYPE_ID).id), property: 'mix' },
  }
  const target = (property: string) => effectTargets[property] ?? moduleTarget(property)
  const continuous = (name: string, capability: Cinema2CapabilityId, path: Cinema2ChoreographyContinuousSourcePath, property: string, factor: number, gated = false): Cinema2ChoreographyRuleManifest => ({
    id: cinema2StableId<Cinema2ChoreographyRuleId>(`parallax-cipher-${name}`), priority: 20, strengthParameter: bind('reactivity'), ...(gated ? { enabledParameter: bind('autoPerformance') } : {}),
    source: { signal: 'continuous', capability, path, clamp: [0, 1], smoothingMs: 150 },
    actions: [{ id: cinema2StableId<Cinema2ChoreographyActionId>(`parallax-cipher-${name}-drive`), target: target(property), operation: 'multiply', value: factor }],
  })
  const accent = (signal: 'kick' | 'snare' | 'drop', property: string, factor: number, release: number): Cinema2ChoreographyRuleManifest => ({
    id: cinema2StableId<Cinema2ChoreographyRuleId>(`parallax-cipher-${signal}-${property.toLowerCase()}`), priority: 30, strengthParameter: bind('reactivity'),
    source: { signal, capability: signal === 'drop' ? 'music.drop' : 'music.rhythm-events' },
    conditions: [{ kind: 'once-per-event' }, ...(signal === 'drop' ? [] : [{ kind: 'not-silent' as const }])],
    actions: [{ id: cinema2StableId<Cinema2ChoreographyActionId>(`parallax-cipher-${signal}-${property.toLowerCase()}-accent`), target: target(property), operation: 'envelope', composition: 'multiply', value: factor, envelope: { attack: .015, hold: .035, release, unit: 'seconds' }, retrigger: 'restart' }],
  })
  const scoreOn = [{ kind: 'parameter-not-equals' as const, parameterId: parallaxCipherParameterId('scoreAmount'), value: 0 }]
  const cue = (signal: 'kick' | 'snare' | 'drop', property: string, release: number): Cinema2ChoreographyRuleManifest => ({
    id: cinema2StableId<Cinema2ChoreographyRuleId>(`parallax-cipher-score-${signal}-${property.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}`), priority: 40,
    strengthParameter: bind('reactivity'), enabledWhen: scoreOn,
    source: { signal, capability: signal === 'drop' ? 'music.drop' : 'music.rhythm-events' },
    conditions: [{ kind: 'once-per-event' }, ...(signal === 'drop' ? [] : [{ kind: 'not-silent' as const }])],
    actions: [{
      id: cinema2StableId<Cinema2ChoreographyActionId>(`parallax-cipher-score-${property.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}-cue`), target: moduleTarget(property),
      operation: 'envelope', composition: 'replace', value: 1, delayBeats: 0, envelope: { attack: .015, hold: .035, release, unit: 'seconds' }, retrigger: 'restart',
    }],
  })
  const rules = [
    // The walls breathe with the bass, the banks turn with the mids, the rim lines follow the highs, and the letters' edges follow the voice.
    continuous('bass-spread', 'audio.bands', 'audio.bands.bass', 'plateSpread', 1.18),
    continuous('bass-weave', 'audio.bands', 'audio.bands.bass', 'weaveScale', 1.14),
    continuous('mid-twist', 'audio.bands', 'audio.bands.mid', 'bankTwist', 1.35),
    continuous('high-near', 'audio.bands', 'audio.bands.high', 'nearContours', 1.4),
    continuous('high-far', 'audio.bands', 'audio.bands.high', 'farContours', 1.3),
    continuous('energy-intensity', 'audio.features', 'audio.features.overallEnergy', 'intensity', 1.25),
    continuous('vocal-bevels', 'music.vocal-presence', 'audio.features.vocalPresence', 'letterBevels', 1.6),
    accent('kick', 'weaveScale', 1.18, .25), accent('kick', 'redMarker', 2.2, .2),
    accent('snare', 'registrationDots', 1.8, .22), accent('snare', 'letterBevels', 1.5, .22),
    accent('drop', 'bloom', 1.7, 1.2), accent('drop', 'plateSpread', 1.15, 1.2), accent('drop', 'intensity', 1.2, 1.2),
    // The lens opens on a kick and a drop, the glare flares and the air thickens on the drop.
    accent('kick', 'lensFringe', 2.2, .2), accent('drop', 'lensFringe', 3.2, 1.2), accent('drop', 'lightFlares', 1.8, 1.2), accent('drop', 'haze', 1.25, 1.2),
    continuous('director-twist', 'visual-director.significance', 'director.intensity', 'bankTwist', 1.15, true),
    continuous('director-letters', 'visual-director.significance', 'director.momentum', 'textMotion', 1.2, true),
    // The score (as in Bass Sigil): the kick, snare and drop each fire a cue on their own channel, and the scene plays that channel on the plates, letters and weave.
    cue('kick', 'platePulse', .3), cue('snare', 'letterRipple', .4), cue('drop', 'dropRelease', 1.4),
  ]
  const drive = (id: string, property: string, source: Cinema2MoodDrive['source'], value: number): Cinema2MoodDrive => ({ id, target: target(property), source, operation: 'multiply', value })
  const drives: Cinema2MoodDrive[] = [
    drive('calm-twist', 'bankTwist', 'mood.calm', .6), drive('calm-near', 'nearContours', 'mood.calm', .8),
    drive('activity-twist', 'bankTwist', 'mood.activity', 1.2), drive('activity-spread', 'plateSpread', 'mood.activity', 1.08),
    drive('momentum-twist', 'bankTwist', 'mood.momentum', 1.15), drive('energy-intensity', 'intensity', 'mood.energy', 1.15),
    drive('drive-spread', 'plateSpread', 'mood.drive', 1.1),
    // A build pulls the weave in and lights the far banks; a peak lights everything; a shock flares the letters.
    drive('build-weave', 'weaveScale', 'mood.build', .85), drive('build-far', 'farContours', 'mood.build', 1.3),
    drive('peak-near', 'nearContours', 'mood.peak', 1.3), drive('peak-far', 'farContours', 'mood.peak', 1.3), drive('peak-bloom', 'bloom', 'mood.peak', 1.3),
    drive('shock-bevels', 'letterBevels', 'mood.shock', 1.4),
    // A build thickens the air; a peak lights the glare.
    drive('build-haze', 'haze', 'mood.build', 1.3), drive('peak-flares', 'lightFlares', 'mood.peak', 1.4),
    // The letters follow the passage too: calmer words move less, a build agitates them, a driving or peak passage plays them hard.
    drive('calm-letters', 'textMotion', 'mood.calm', .6), drive('build-letters', 'textMotion', 'mood.build', 1.25), drive('drive-letters', 'textMotion', 'mood.drive', 1.15),
    drive('peak-letters', 'textMotion', 'mood.peak', 1.2),
  ]
  for (const name of ['intensity', 'nearContours', 'farContours', 'letterBevels', 'registrationDots', 'redMarker', 'bloom', 'textMotion', 'haze', 'lightFlares', 'lensFringe']) drives.push(drive(`silence-${name.toLowerCase()}`, name, 'mood.silence', .1))
  return withCinema2MoodDrives({
    ...manifest,
    capabilities: [...manifest.capabilities ?? [], ...(['audio.transport', 'audio.bands', 'audio.features', 'music.rhythm-events', 'music.drop', 'music.vocal-presence', 'visual-director.significance'] as const).map(id => ({ id, requirement: 'optional' as const, purpose: 'Shared musical facts and performance meaning.' }))],
    choreography: { tempoSyncParameter: bind('bpmSync'), rules },
  }, { idPrefix: 'parallax-cipher', enabledParameter: parallaxCipherParameterId('autoPerformance'), strengthParameter: parallaxCipherParameterId('reactivity'), patternControls: { patternChange: parallaxCipherParameterId('patternChange'), trigger: parallaxCipherParameterId('trigger') }, drives })
}
