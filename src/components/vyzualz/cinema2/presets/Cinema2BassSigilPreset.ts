import { finishBassSigil } from './Cinema2BassSigilFinish'
import { bassSigilPerformance, BASS_SIGIL_SCORE_CHANNELS } from './Cinema2BassSigilPerformance'
import { withCinema2MoodDrives } from './Cinema2MoodConductorAuthoring'
import { createBassSigilAudioRules } from './Cinema2BassSigilAudio'
import { CINEMA2_BASS_SIGIL_MODULE_TYPE_ID } from '../modules/Cinema2BassSigilNativeModule'
import { BASS_SIGIL_PALETTE, BASS_SIGIL_PATTERNS } from '../modules/bassSigil/Cinema2BassSigilMotion'
import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from './Cinema2AfterhoursPreset'
import {
  CINEMA2_NATIVE_PRESET_SCHEMA_ID, CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  cinema2NamespacedId, cinema2Ref, cinema2StableId,
  type Cinema2NativePresetManifest, type Cinema2PresetId, type Cinema2ModuleId, type Cinema2SceneNodeId,
  type Cinema2EffectId, type Cinema2Vector3, type Cinema2ParameterManifest, type Cinema2ParameterId, type Cinema2CameraId, type Cinema2RenderTargetId, type Cinema2RenderPassId, type Cinema2RenderSlotId, type Cinema2LightId,
} from '../contracts/Cinema2NativePresetManifest'

export const CINEMA2_BASS_SIGIL_PRESET_ID = cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.crate-bass-sigil')
const moduleId = cinema2StableId<Cinema2ModuleId>('bass-sigil-core')
const root = cinema2StableId<Cinema2SceneNodeId>('bass-sigil-root')
const model = cinema2StableId<Cinema2SceneNodeId>('bass-sigil-model')
const camera = cinema2StableId<Cinema2CameraId>('bass-sigil-camera')
const target = cinema2StableId<Cinema2RenderTargetId>('bass-sigil-target')
const pass = cinema2StableId<Cinema2RenderPassId>('bass-sigil-scene')
const output = cinema2StableId<Cinema2RenderPassId>('bass-sigil-output')
const color = cinema2StableId<Cinema2RenderSlotId>('bass-sigil-color')

export const bassSigilParameterId = (name: string) => cinema2StableId<Cinema2ParameterId>(`bass-sigil-${name.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}`)
const base = { section: 'Design', exposure: 'primary', persistence: 'preset', reset: 'authored-default' } as const
const number = (name: string, label: string, group: Cinema2ParameterManifest['designParentGroup'], value: number, min: number, max: number, order: number): Cinema2ParameterManifest => ({ ...base, id: bassSigilParameterId(name), label, type: 'float', defaultValue: value, min, max, step: .01, designParentGroup: group, order })
const bind = (name: string) => cinema2Ref(bassSigilParameterId(name))
const bindings = Object.fromEntries(['autoPerformance','reactivity','scoreAmount','bpmSync','intensity','pattern','patternChange','trigger','motionRate','geometryExtent','coreTravel','membraneScale','particleDensity','tunnelDepth','heroScale','logoSpinRate','logoSway','logoHeading','logoPitch','logoRoll','membraneOpacity','glow',...Object.keys(BASS_SIGIL_PALETTE).map(role=>`${role}Color`)].map(name=>[name,bind(name)]))
const parameters: readonly Cinema2ParameterManifest[] = [
    { ...base, id: bassSigilParameterId('bpmSync'), label: 'BPM Sync', type: 'boolean', defaultValue: true, designParentGroup: 'master-controls', order: 0, description: 'Locks native motion to shared tempo. Off runs at the 120 BPM reference; the host toggle does not override this choice.' },
    number('intensity','Intensity','master-controls',1,0,2,1),
    { ...base,id:bassSigilParameterId('autoPerformance'),label:'Auto Performance',type:'boolean',defaultValue:false,designParentGroup:'master-controls',order:3,description:'The shared Mood Conductor directs bounded motion and effects, pattern timing and temporary build/drop programs. Turn off to edit Design and Effects; saved values and palette are preserved.' },
    number('scoreAmount','Score Amount','design',.5,0,1,18),
    { ...number('reactivity','Audio Reactivity','master-controls',.65,0,1,2), description: 'Strength of bounded bass, energy, vocal and rhythmic reactions. Zero restores the authored native motion. Pattern Change and BPM Sync remain independent.' },
    { ...base, id: bassSigilParameterId('pattern'), label: 'Pattern', type: 'enum', defaultValue: 'reference-vortex', options: BASS_SIGIL_PATTERNS, designParentGroup: 'design', group: 'Pattern', order: 0 },
    { ...base, id: bassSigilParameterId('patternChange'), label: 'Pattern Change', type: 'boolean', defaultValue: false, designParentGroup: 'design', group: 'Pattern', order: 1 },
    { ...base, id: bassSigilParameterId('trigger'), label: 'Trigger', type: 'enum', defaultValue: 'bar4', options: CINEMA2_AFTERHOURS_TRIGGER_OPTIONS, designParentGroup: 'design', group: 'Pattern', order: 2, visibleWhen: [{ kind: 'parameter-equals', parameterId: bassSigilParameterId('patternChange'), value: true }] },
    number('motionRate','Motion Rate','design',1,0,2,11),
    { ...number('geometryExtent','Geometry Extent','design',.35,0,1,12), description: 'Deformation strength in the native variants. Reference Vortex keeps the original sphere shape and animates its rotation.' },
    number('coreTravel','Core Travel','design',.25,0,1,13),
    number('membraneScale','Membrane Scale','design',1,.65,1.4,14),
    number('particleDensity','Particle Density','design',1,0,1,15),
    number('tunnelDepth','Tunnel Depth','design',1,.5,1.5,16),
    number('heroScale','Hero Scale','design',1,.75,1.15,17),
    { ...number('logoSpinRate','Logo Spin Rate','design',.25,0,2,1), group: 'Logo' },
    { ...number('logoSway','Logo Sway','design',.35,0,1,2), group: 'Logo' },
    { ...number('logoHeading','Logo Heading','design',0,-180,180,3), group: 'Logo' },
    { ...number('logoPitch','Logo Pitch','design',0,-90,90,4), group: 'Logo' },
    { ...number('logoRoll','Logo Roll','design',0,-180,180,5), group: 'Logo' },
    { ...base, id: bassSigilParameterId('cameraMode'), label: 'Camera Mode', type: 'enum', defaultValue: 'omnidirectional', options: [{ value: 'manual', label: 'Manual Orbit' }, { value: 'horizontal', label: 'Horizontal Orbit' }, { value: 'omnidirectional', label: 'Omnidirectional Orbit' }], designParentGroup: 'design', group: 'Camera', order: 0, description: 'Orbit the entire original sphere. Manual gives full heading/elevation control; Omnidirectional travels around, above and below it.' },
    { ...number('cameraSpeed','Camera Speed','design',1,0,2,1), group: 'Camera', visibleWhen: [{ kind: 'parameter-not-equals', parameterId: bassSigilParameterId('cameraMode'), value: 'manual' }], description: 'Speed of automatic camera travel. Zero holds its current position; independent of geometry and logo motion.' },
    { ...number('cameraHeading','Camera Heading','design',0,-180,180,2), group: 'Camera', visibleWhen: [{ kind: 'parameter-equals', parameterId: bassSigilParameterId('cameraMode'), value: 'manual' }] },
    { ...number('cameraElevation','Camera Elevation','design',0,-89.9,89.9,3), group: 'Camera', visibleWhen: [{ kind: 'parameter-equals', parameterId: bassSigilParameterId('cameraMode'), value: 'manual' }] },
    { ...number('cameraDistance','Camera Distance','design',11.2,8,30,4), group: 'Camera', visibleWhen: [{ kind: 'parameter-equals', parameterId: bassSigilParameterId('cameraMode'), value: 'manual' }] },
    { ...number('cameraFov','Camera Field of View','design',40,30,65,5), group: 'Camera' },
    number('bloom','Bloom','effects',.3,0,.8,10),
    number('focus','Background Focus','effects',.2,0,1,11),
    number('trails','Background Trails','effects',.1,0,.45,12),
    number('flares','Flares','effects',.15,0,.6,13),
    number('finishMix','Tone Finish','effects',1,0,1,14),
    number('membraneOpacity','Membrane Opacity','effects',1,0,1,0),
    number('glow','Core Glow','effects',1,0,2,1),
    { ...base, id: bassSigilParameterId('background'), label: 'Background', type: 'color', defaultValue: [0,0,0,1], designParentGroup: 'palette', order: 0 },
    ...Object.entries(BASS_SIGIL_PALETTE).map(([role,color],i): Cinema2ParameterManifest => ({ ...base, id: bassSigilParameterId(`${role}Color`), label: role[0].toUpperCase()+role.slice(1), type: 'color', defaultValue: color, designParentGroup: 'palette', order: i+1 })),
  ]
// A closed spherical path has changing azimuth and elevation; shared spline/tempo runtime owns travel.
const orbitPoints = Array.from({ length: 12 }, (_,i) => {
  const azimuth = i * Math.PI / 6, elevation = Math.sin(azimuth * 2) * 75 * Math.PI / 180
  return { position: [Math.sin(azimuth)*Math.cos(elevation)*11.2, Math.sin(elevation)*11.2, Math.cos(azimuth)*Math.cos(elevation)*11.2] as Cinema2Vector3, target: [0,0,0] as Cinema2Vector3 }
})
/** Complete original artifact with shared musical choreography, Mood policy and depth-aware finishing. */
const authored: Readonly<Cinema2NativePresetManifest> = {
  schemaId: CINEMA2_NATIVE_PRESET_SCHEMA_ID, schemaVersion: CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  id: CINEMA2_BASS_SIGIL_PRESET_ID, revision: 2,
  metadata: { name: 'Bass Sigil', description: 'The original Bass Sigil sphere, particle fields and 3D logo with eight native programs, omnidirectional camera, musical geometry score, shared Auto Performance and cinematic finishing.', tags: ['reference', 'crate', '3d'] },
  capabilities: [
    { id: 'render.webgl2', requirement: 'required', purpose: 'Render the original hero, cellular sphere and particles.' },
    { id: 'render.depth', requirement: 'required', purpose: 'Preserve true depth between the hero, open cells and particles.' },
    { id: 'render.hdr', requirement: 'optional', purpose: 'Linear-light bloom and glints with shared tier fallbacks.' },
    { id: 'render.history', requirement: 'required', purpose: 'Depth-masked background trails with lifecycle-safe history.' },
    { id: 'scene.3d', requirement: 'required', purpose: 'World-space 3D composition.' },
    { id: 'camera.world', requirement: 'required', purpose: 'Full 3D orbit around the original sphere, with manual and automatic travel.' },
    { id: 'lighting', requirement: 'required', purpose: 'Read metallic bevels and rounded rib surfaces without bloom.' },
    ...(['audio.transport','audio.bands','audio.features','music.rhythm-events','music.downbeat','music.phrase','music.drop','music.vocal-presence','visual-director.significance'] as const).map(id=>({id,requirement:'optional' as const,purpose:'Shared tempo, available audio features and canonical events; no local detection.'})),
  ],
  parameters,
  modules: [{ id: moduleId, typeId: CINEMA2_BASS_SIGIL_MODULE_TYPE_ID, version: 1, parameters: {...Object.fromEntries(Object.entries(bindings).map(([name,ref])=>[name,parameters.find(p=>p.id===ref.$ref)!.defaultValue!])),...Object.fromEntries(BASS_SIGIL_SCORE_CHANNELS.map(name=>[name,0]))}, parameterBindings: bindings, config: { hdr:true, instances: [{ asset: 'cinema2-crate-bass-sigil', node: model, preserveMaterials: true, spin: false }] } }],
  scene: { nodes: [{ id: root, kind: 'group', coordinateSpace: 'world' }, { id: model, kind: 'module', parent: cinema2Ref(root), module: cinema2Ref(moduleId) }], roots: [cinema2Ref(root)] },
  cameras: [{ id: camera, label: 'Sphere orbit', projection: 'perspective', fovDegrees: 40, minAspect: 16 / 9, minAspectAnchor: 0, near: .05, far: 100, target: [0,0,0],
    rig: { kind: 'path', points: orbitPoints, durationSeconds: 32, loop: true },
    rigVariants: {
      manual: { kind: 'orbit', radius: 11.2, azimuthDegrees: 0, elevationDegrees: 0, angularVelocityDegreesPerSecond: 0 },
      horizontal: { kind: 'orbit', radius: 11.2, azimuthDegrees: 0, elevationDegrees: 0, angularVelocityDegreesPerSecond: 11.25 },
      omnidirectional: { kind: 'path', points: orbitPoints, durationSeconds: 32, loop: true },
    },
    motion: { idleMotion: true, interpolation: 'spline', constantSpeed: true, tempo: { referenceBpm: 120, flightSpeed: true } },
    controls: { rigMode: bind('cameraMode'), motionSpeed: bind('cameraSpeed'), tempoSync: bind('bpmSync'), orbitRadius: bind('cameraDistance'), orbitAzimuthDegrees: bind('cameraHeading'), orbitElevationDegrees: bind('cameraElevation'), fovDegrees: bind('cameraFov') },
  }],
  defaults: { camera: cinema2Ref(camera) },
  environment: { backgroundColor: [0,0,0,1], exposure: 1, controls: { backgroundColor: bind('background') } },
  choreography: { tempoSyncParameter: bind('bpmSync'), rules: [...createBassSigilAudioRules(moduleId,bassSigilParameterId),...bassSigilPerformance(moduleId,bassSigilParameterId).rules] },
  lighting: { lights: [
    { id: cinema2StableId<Cinema2LightId>('bass-sigil-fill'), type: 'ambient', color: [.3,.42,.7,1], intensity: .25 },
    { id: cinema2StableId<Cinema2LightId>('bass-sigil-key'), type: 'directional', color: [.78,.88,1,1], intensity: 1.4, transform: { position: [-4,6,8] }, targetNode: cinema2Ref(model) },
    { id: cinema2StableId<Cinema2LightId>('bass-sigil-rim'), type: 'directional', color: [.25,.42,1,1], intensity: .8, transform: { position: [6,-2,4] }, targetNode: cinema2Ref(model) },
  ] },
  render: { targets: [{ id: target, descriptor: { size: { kind: 'viewport' }, colorFormat: 'rgba8', depthFormat: 'depth24' } }], passes: [
    { id: pass, kind: 'scene', scene: cinema2Ref(root), outputs: [{ id: color, target: cinema2Ref(target), attachment: 'color' }] },
    { id: output, kind: 'output', inputs: [{ id: cinema2StableId<Cinema2RenderSlotId>('bass-sigil-input'), source: { pass: cinema2Ref(pass), output: color }, attachment: 'color' }] },
  ], outputPass: cinema2Ref(output) },
  output: { renderPass: cinema2Ref(output), colorSpace: 'srgb', alphaMode: 'opaque' },
}

const moduleTarget=(property:string)=>({kind:'module' as const,ref:cinema2Ref(moduleId),property})
const effectTarget=(name:string,property:string)=>({kind:'effect' as const,ref:cinema2Ref(cinema2StableId<Cinema2EffectId>(`bass-sigil-${name}`)),property})
export const CINEMA2_BASS_SIGIL_PRESET_MANIFEST=withCinema2MoodDrives(finishBassSigil(authored,bassSigilParameterId),{
 idPrefix:'bass-sigil',enabledParameter:bassSigilParameterId('autoPerformance'),strengthParameter:bassSigilParameterId('reactivity'),patternControls:{patternChange:bassSigilParameterId('patternChange'),trigger:bassSigilParameterId('trigger')},
 drives:[...bassSigilPerformance(moduleId,bassSigilParameterId).drives,
  {id:'bloom-peak',target:effectTarget('bloom','intensity'),source:'mood.peak',operation:'multiply',value:1.4},
  {id:'flare-shock',target:effectTarget('flares','mix'),source:'mood.shock',operation:'multiply',value:1.6},
  {id:'bloom-silence',target:effectTarget('bloom','intensity'),source:'mood.silence',operation:'multiply',value:.1},
  {id:'trails-silence',target:effectTarget('trails','mix'),source:'mood.silence',operation:'multiply',value:.1},
  {id:'flares-silence',target:effectTarget('flares','mix'),source:'mood.silence',operation:'multiply',value:.1},
  {id:'logo-silence',target:moduleTarget('logoSpinRate'),source:'mood.silence',operation:'multiply',value:.1},
 ],
})
