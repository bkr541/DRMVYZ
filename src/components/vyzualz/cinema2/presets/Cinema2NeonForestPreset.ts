import { NEON_FOREST_FINISHING_EFFECTS, neonForestFinishingRules, neonForestFinishingGraph } from './Cinema2NeonForestFinishing'
import { createNeonForestChoreography, NEON_FOREST_CHOREOGRAPHY_DEFAULTS } from './Cinema2NeonForestChoreography'
import { NEON_FOREST_MUSIC_DEFAULTS } from '../modules/neonForest/Cinema2NeonForestAudio'
import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from './Cinema2AfterhoursPreset'
import { NEON_FOREST_PATTERNS, NEON_FOREST_CAMERA_MODES, NEON_FOREST_CAMERA_RIGS, NEON_FOREST_COLORS } from '../modules/neonForest/Cinema2NeonForestDomain'
import {
  CINEMA2_NATIVE_PRESET_SCHEMA_ID, CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  cinema2NamespacedId, cinema2Ref, cinema2StableId,
  type Cinema2CameraId, type Cinema2LayerId, type Cinema2ModuleId,
  type Cinema2NativePresetManifest, type Cinema2ParameterId, type Cinema2PresetId,
  type Cinema2RenderPassId, type Cinema2RenderSlotId, type Cinema2RenderTargetId,
  type Cinema2SceneNodeId, type Cinema2ParameterManifest,
} from '../contracts/Cinema2NativePresetManifest'
import { CINEMA2_NEON_FOREST_MODULE_TYPE_ID } from '../modules/Cinema2NeonForestNativeModule'
import { CINEMA2_QUALITY_MODE_PARAMETER } from '../parameters/Cinema2PerformanceParameters'

export const CINEMA2_NEON_FOREST_PRESET_ID = cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.neon-forest')
export const neonForestParameterId = (name: string) => cinema2StableId<Cinema2ParameterId>(`neon-forest-${name.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}`)
const moduleId = cinema2StableId<Cinema2ModuleId>('neon-forest-forest')
const root = cinema2StableId<Cinema2SceneNodeId>('neon-forest-root')
const world = cinema2StableId<Cinema2SceneNodeId>('neon-forest-world')
const layer = cinema2StableId<Cinema2LayerId>('neon-forest-world-layer')
const camera = cinema2StableId<Cinema2CameraId>('neon-forest-camera')
const target = cinema2StableId<Cinema2RenderTargetId>('neon-forest-scene-target')
const pass = cinema2StableId<Cinema2RenderPassId>('neon-forest-scene-pass')
const color = cinema2StableId<Cinema2RenderSlotId>('neon-forest-scene-color')
const depth = cinema2StableId<Cinema2RenderSlotId>('neon-forest-scene-depth')
const finishing = neonForestFinishingGraph(pass, color, depth)
const ref = (name: string) => cinema2Ref(neonForestParameterId(name))
const base = { section: 'Design', exposure: 'primary', persistence: 'preset', reset: 'authored-default' } as const
const num = (name: string, label: string, value: number, min: number, max: number, group: string, parent: Cinema2ParameterManifest['designParentGroup'], order: number): Cinema2ParameterManifest => ({ ...base, id: neonForestParameterId(name), label, type: 'float', defaultValue: value, min, max, step: .01, group, designParentGroup: parent, order })
const toggle = (name: string, label: string, value: boolean, group: string, parent: Cinema2ParameterManifest['designParentGroup'], order: number): Cinema2ParameterManifest => ({ ...base, id: neonForestParameterId(name), label, type: 'boolean', defaultValue: value, group, designParentGroup: parent, order })
const moduleDefaults = { autoPerformance: false, musicResponse: .8, master: .85, motion: true, amount: .65, speed: 1, bpmSync: true, pattern: 'prism-tide', patternChange: false, trigger: 'bar4', density: 1, scale: 1, emission: .65, particles: .45, portalSize: 1, portalMotion: true, ...NEON_FOREST_COLORS }
const orbitOnly = [{ kind: 'parameter-equals', parameterId: neonForestParameterId('cameraMode'), value: 'orbit' }] as const

/** Native reference entry until human visual acceptance. Stable IDs preserve authored edits. */
export const CINEMA2_NEON_FOREST_PRESET_MANIFEST: Readonly<Cinema2NativePresetManifest> = {
  schemaId: CINEMA2_NATIVE_PRESET_SCHEMA_ID, schemaVersion: CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  id: CINEMA2_NEON_FOREST_PRESET_ID, revision: 1,
  metadata: {
    name: 'NEON FOREST', author: 'DRMVYZ; Neon Stage by AnixMoon (CC BY 4.0)',
    description: 'A complete 3D crystal grove inspired by Neon Stage: eight rooted geometry programs, an articulated neon portal, aisle travel, grove orbit, shared musical choreography, mandatory BPM Sync and opt-in Auto Performance, visible light shafts, drifting ground mist and HDR bloom.',
    tags: ['3d', 'crystals', 'neon', 'forest', 'choreography'],
  },
  capabilities: [
    { id: 'render.webgl2', requirement: 'required', purpose: 'Render the prepared textured forest in the shared WebGL context.' },
    { id: 'render.hdr', requirement: 'optional', purpose: 'HDR emission, atmosphere and bloom before final tone mapping.' },
    { id: 'render.depth', requirement: 'required', purpose: 'Resolve terrain, spires and overlapping crystals with real scene depth.' },
    { id: 'scene.3d', requirement: 'required', purpose: 'Continuous terrain and surrounding crystal groves in world space.' },
    { id: 'camera.world', requirement: 'required', purpose: 'Shared spline travel, grove orbit, elevated passage and fixed framing.' },
    ...([['audio.bands', 'Shared bass/high energy shapes bends and particles.'], ['audio.features', 'Shared energy and vocals shape motion and restraint.'], ['music.beat', 'Canonical beat and beat-multiple triggers.'], ['music.downbeat', 'Shared downbeat accents and triggers.'], ['music.rhythm-events', 'Shared kick and snare facts.'], ['music.bar', 'Canonical bar and multi-bar triggers.'], ['music.phrase', 'Shared phrase boundaries.'], ['music.build', 'Supported build progress gathers the grove.'], ['music.drop', 'Shared semantic drop releases an outward wave.'], ['music.vocal-presence', 'Supported vocals restrain movement and particle activity.']] as const).map(([id, purpose]) => ({ id, purpose, requirement: 'optional' as const })),
    { id: 'music.section', requirement: 'optional', purpose: 'Shared section boundaries for bounded Director transition accents.' },
    { id: 'visual-director.significance', requirement: 'optional', purpose: 'Bounded grove range, tension, impact and section-transition significance.' },
    { id: 'lighting', requirement: 'required', purpose: 'Readable PBR surfaces and baseline local light spill.' },
  ],
  parameters: [
    num('master', 'Master Intensity', .85, 0, 1, 'Performance', 'master-controls', 0),
    toggle('motion', 'Geometry Motion', true, 'Performance', 'master-controls', 1),
    num('amount', 'Motion Amount', .65, 0, 1, 'Performance', 'master-controls', 2),
    num('speed', 'Motion Speed', 1, 0, 2, 'Performance', 'master-controls', 3),
    { ...toggle('bpmSync', 'BPM Sync', true, 'Performance', 'master-controls', 4), description: 'Required preset timing control. ON locks geometry, portal and camera to shared transport BPM; OFF uses the authored 100 BPM equivalent. Independent of Audio Dock BPM Sync; musical event reactions remain available.' },
    num('musicResponse', 'Music Response', .8, 0, 1, 'Performance', 'master-controls', 5),
    { ...toggle('autoPerformance', 'Auto Performance', false, 'Performance', 'master-controls', 6), description: 'Temporary build/drop patterns only. Manual Pattern edits reclaim the base immediately. Camera and effects remain manual.' },
    { ...base, id: neonForestParameterId('pattern'), label: 'Pattern', type: 'enum', defaultValue: 'prism-tide', options: NEON_FOREST_PATTERNS, designParentGroup: 'design', group: 'Pattern', order: 0 },
    toggle('patternChange', 'Pattern Change', false, 'Pattern', 'design', 1),
    { ...base, id: neonForestParameterId('trigger'), label: 'Trigger', type: 'enum', defaultValue: 'bar4', options: CINEMA2_AFTERHOURS_TRIGGER_OPTIONS,
      visibleWhen: [{ kind: 'parameter-equals', parameterId: neonForestParameterId('patternChange'), value: true }], designParentGroup: 'design', group: 'Pattern', order: 2,
      description: 'Advances the current program on a new shared musical event. Manual Pattern selection stays immediate and does not turn Pattern Change off.' },
    num('density', 'Forest Density', 1, 0, 1, 'Forest', 'design', 10),
    num('scale', 'Crystal Scale', 1, .8, 1.1, 'Forest', 'design', 11),
    num('portalSize', 'Portal Size', 1, .65, 1.35, 'Forest', 'design', 12),
    toggle('portalMotion', 'Portal Motion', true, 'Forest', 'design', 13),
    { ...base, id: neonForestParameterId('cameraMode'), label: 'Camera Mode', type: 'enum', defaultValue: 'travel', options: NEON_FOREST_CAMERA_MODES, designParentGroup: 'design', group: 'Camera', order: 20 },
    toggle('cameraMotion', 'Camera Motion', true, 'Camera', 'design', 21),
    num('cameraSpeed', 'Camera Speed', 1, 0, 2, 'Camera', 'design', 22),
    num('fov', 'Field of View', 58, 45, 75, 'Camera', 'design', 23),
    { ...num('radius', 'Orbit Radius', 20, 18, 24, 'Camera', 'design', 24), visibleWhen: orbitOnly },
    { ...num('heading', 'Orbit Heading', 0, -180, 180, 'Camera', 'design', 25), visibleWhen: orbitOnly },
    { ...num('elevation', 'Orbit Elevation', 40, 35, 60, 'Camera', 'design', 26), visibleWhen: orbitOnly },
    num('emission', 'Crystal Emission', .65, 0, 1, 'Bioluminescence', 'effects', 0),
    num('particles', 'Particle Density', .45, 0, 1, 'Bioluminescence', 'effects', 1),
    toggle('lightsEnabled', 'Scene Lights', true, 'Forest Lighting', 'effects', 10),
    num('lightStrength', 'Light Strength', .8, 0, 1, 'Forest Lighting', 'effects', 11),
    toggle('atmosphereEnabled', 'Atmosphere', true, 'Atmosphere', 'effects', 20),
    num('fogDensity', 'Fog Density', .45, 0, 1, 'Atmosphere', 'effects', 21),
    num('mist', 'Ground Mist', .08, 0, .2, 'Atmosphere', 'effects', 22),
    num('mistHeight', 'Mist Height', 1.8, .2, 5, 'Atmosphere', 'effects', 23),
    num('shafts', 'Light Shafts', .65, 0, 2, 'Atmosphere', 'effects', 24),
    toggle('bloomEnabled', 'Bloom', true, 'Finishing', 'effects', 30),
    num('bloom', 'Bloom Amount', .45, 0, 1, 'Finishing', 'effects', 31),
    toggle('reflectionsEnabled', 'Ground Reflections', true, 'Finishing', 'effects', 32),
    num('reflections', 'Reflection Amount', .3, 0, 1, 'Finishing', 'effects', 33),
    { ...base, id: neonForestParameterId('atmosphereColor'), label: 'Atmosphere', type: 'color', defaultValue: [.22, .42, .52, 1], designParentGroup: 'palette', group: 'Forest Palette', order: 7 },
    ...Object.entries(NEON_FOREST_COLORS).map(([key, defaultValue], order): Cinema2ParameterManifest => ({ ...base, id: neonForestParameterId(key), label: { backgroundColor: 'Background', primaryColor: 'Crystal Primary', secondaryColor: 'Crystal Secondary', portalColor: 'Portal Accent', groundColor: 'Ground', particleColor: 'Particles' }[key]!, type: 'color', defaultValue, designParentGroup: 'palette', group: 'Forest Palette', order })),
    CINEMA2_QUALITY_MODE_PARAMETER,
  ],
  modules: [{ id: moduleId, typeId: CINEMA2_NEON_FOREST_MODULE_TYPE_ID, version: 1, enabled: true,
    config: { asset: 'cinema2-neon-forest-static' }, parameters: { ...moduleDefaults, ...NEON_FOREST_MUSIC_DEFAULTS, ...NEON_FOREST_CHOREOGRAPHY_DEFAULTS },
    parameterBindings: Object.fromEntries(Object.keys(moduleDefaults).map(key => [key, ref(key)])),
  }],
  choreography: { rules: [...createNeonForestChoreography(moduleId), ...neonForestFinishingRules()] },
  scene: { nodes: [
    { id: cinema2StableId<Cinema2SceneNodeId>('neon-forest-light-focus'), kind: 'group', parent: cinema2Ref(root), coordinateSpace: 'world', transform: { position: [0, 2.262, 0] } },
    { id: root, kind: 'group', coordinateSpace: 'world' },
    { id: world, kind: 'module', parent: cinema2Ref(root), module: cinema2Ref(moduleId) },
  ], roots: [cinema2Ref(root)] },
  layers: [{ id: layer, label: 'NEON FOREST Grove', source: cinema2Ref(root), role: 'world', depthPolicy: 'read-write', order: 0 }],
  cameras: [{
    id: camera, label: 'NEON FOREST Camera', projection: 'perspective', fovDegrees: 58, minAspect: 1,
    near: .1, far: 180, target: [0, 2.262, 0], transform: { position: [0, 3.2, 14.5] },
    rig: NEON_FOREST_CAMERA_RIGS.travel, rigVariants: NEON_FOREST_CAMERA_RIGS,
    motion: { idleMotion: true, interpolation: 'spline', constantSpeed: true, tempo: { referenceBpm: 100, minRate: .5, maxRate: 2, flightSpeed: true } },
    controls: { rigMode: ref('cameraMode'), motionEnabled: ref('cameraMotion'), motionSpeed: ref('cameraSpeed'), tempoSync: ref('bpmSync'),
      fovDegrees: ref('fov'), orbitRadius: ref('radius'), orbitAzimuthDegrees: ref('heading'), orbitElevationDegrees: ref('elevation') },
    safety: { minPosition: [-50, 1.5, -60], maxPosition: [50, 50, 50], minFovDegrees: 45, maxFovDegrees: 75, minNear: .05, maxFar: 200 },
  }],
  lighting: { lights: [
    { id: cinema2StableId('neon-forest-fill'), type: 'ambient', color: [.4, .5, .7, 1], intensity: .09 },
    { id: cinema2StableId('neon-forest-moon'), type: 'directional', color: [.48, .66, 1, 1], intensity: .22, config: { scatter: false }, transform: { rotation: [-.85, -.6, 0] } },
    { id: cinema2StableId('neon-forest-grove-spill'), type: 'point', controls: { color: ref('primaryColor') }, color: [.08, .88, 1, 1], intensity: .8, transform: { position: [0, 3, 0] }, config: { range: 22 } },
    { id: cinema2StableId('neon-forest-teal-spill'), type: 'point', controls: { color: ref('secondaryColor') }, color: [.68, .12, 1, 1], intensity: .7, transform: { position: [-8, 3, -2] }, config: { range: 19 } },
    { id: cinema2StableId('neon-forest-amber-spill'), type: 'point', color: [1, .08, .43, 1], controls: { color: ref('portalColor') }, intensity: .65, transform: { position: [8, 3, -2] }, config: { range: 19 } },
    { id: cinema2StableId('neon-forest-left-shaft'), type: 'spot', color: [.25, .85, 1, 1], intensity: 1.25, controls: { color: ref('portalColor') }, transform: { position: [-10, 13, 3] }, targetNode: cinema2Ref(cinema2StableId<Cinema2SceneNodeId>('neon-forest-light-focus')), config: { range: 48, innerConeDegrees: 7, outerConeDegrees: 16 } },
    { id: cinema2StableId('neon-forest-right-shaft'), type: 'spot', color: [.7, .25, 1, 1], intensity: 1.1, controls: { color: ref('primaryColor') }, transform: { position: [10, 14, -5] }, targetNode: cinema2Ref(cinema2StableId<Cinema2SceneNodeId>('neon-forest-light-focus')), config: { range: 48, innerConeDegrees: 7, outerConeDegrees: 16 } },
    { id: cinema2StableId('neon-forest-front-fill'), type: 'point', color: [.43, .69, .82, 1], intensity: .25, transform: { position: [0, 6, 11] }, config: { range: 30 } },
  ] },
  environment: { backgroundColor: NEON_FOREST_COLORS.backgroundColor, exposure: 1, controls: { backgroundColor: ref('backgroundColor') } },
  effects: NEON_FOREST_FINISHING_EFFECTS,
  render: {
    targets: [{ id: target, descriptor: { size: { kind: 'viewport' }, colorFormat: 'rgba16f', depthFormat: 'depth24' }, ownership: 'transient' }, ...finishing.targets],
    passes: [{ id: pass, kind: 'scene', layers: [cinema2Ref(layer)], outputs: [
      { id: color, target: cinema2Ref(target), attachment: 'color' },
      { id: depth, target: cinema2Ref(target), attachment: 'depth' },
    ] }, ...finishing.passes], outputPass: cinema2Ref(finishing.output),
  },
  defaults: { camera: cinema2Ref(camera) },
  output: { renderPass: cinema2Ref(finishing.output), colorSpace: 'srgb', alphaMode: 'opaque' },
}
