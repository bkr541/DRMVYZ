import {
  CINEMA2_NATIVE_PRESET_SCHEMA_ID, CINEMA2_NATIVE_PRESET_SCHEMA_VERSION, cinema2Ref, cinema2StableId, cinema2NamespacedId,
  type Cinema2PresetId, type Cinema2ModuleId, type Cinema2SceneNodeId, type Cinema2LayerId,
  type Cinema2CameraId, type Cinema2NativePresetManifest, type Cinema2ParameterManifest,
} from '../contracts/Cinema2NativePresetManifest'
import { CINEMA2_IFRIT_MODULE_TYPE } from '../modules/Cinema2IfritNativeModule'
import { IFRIT_COLORS, IFRIT_NUMBERS, IFRIT_PATTERNS, IFRIT_PATTERN_LABELS, IFRIT_CHANNELS, ifritParameterId as pid } from '../modules/ifrit/Cinema2IfritDomain'
import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from './Cinema2AfterhoursPreset'
import { IFRIT_CHOREOGRAPHY } from './Cinema2IfritChoreography'
import { IFRIT_EFFECTS, IFRIT_RENDER_GRAPH } from './Cinema2IfritFinishing'

export const CINEMA2_IFRIT_PRESET_ID = cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.ifrit')
const moduleId = cinema2StableId<Cinema2ModuleId>('ifrit-tunnel')
const root = cinema2StableId<Cinema2SceneNodeId>('ifrit-root')
const node = cinema2StableId<Cinema2SceneNodeId>('ifrit-geometry')
const layer = cinema2StableId<Cinema2LayerId>('ifrit-world')
const camera = cinema2StableId<Cinema2CameraId>('ifrit-camera')

const base = { section: 'Design', exposure: 'primary', persistence: 'preset', reset: 'authored-default' } as const
const labels: Record<string,string> = { intensity:'Master Intensity', reactivity:'Music Reactivity', count:'Frame Count', aperture:'Aperture', spacing:'Frame Spacing', thickness:'Frame Thickness', travel:'Travel Speed', rotation:'Rotation Speed', twist:'Twist Amount', detail:'Wall Detail', bloom:'Bloom' }
const descriptions: Record<string,string> = {
  intensity:'Ceiling for all emitted and structural light. Zero retains only Background.', reactivity:'Strength of bounded shared musical responses.',
  count:'Actual visible portal count, distributed across the authored tunnel depth.', aperture:'Uniform passage and wall scale; does not stretch the hexagons.',
  spacing:'Depth distribution of the portal frames.', thickness:'Width and depth of structural beams and illuminated contours.',
  travel:'Axial passage speed. Zero holds the current travel phase.', rotation:'Signed angular rate. Zero holds the current rotation.',
  twist:'Relative angular offsets between frames; each pattern retains its native movement.', detail:'Visible wall rail and rib occupancy. Zero removes all peripheral detail.',
  bloom:'Shared finishing halo. Zero removes bloom without changing the underlying structure.',
}
const parameters: Cinema2ParameterManifest[] = [
  ...Object.entries(IFRIT_NUMBERS).map(([key,[min,defaultValue,max]],order)=>({ ...base,id:pid(key),label:labels[key],description:descriptions[key],type:key==='count'?'integer' as const:'float' as const,min,defaultValue,max,step:key==='count'?1:0.01,
    designParentGroup:key==='intensity'||key==='reactivity'?'master-controls' as const:key==='bloom'?'effects' as const:'design' as const,group:key==='bloom'?'Finishing':'Geometry',order:10+order })),
  { ...base,id:pid('bpm-sync'),label:'BPM Sync',description:'Locks movement to shared musical timing. OFF uses seconds-based rates; host Sync does not veto this setting.',type:'boolean',defaultValue:true,designParentGroup:'master-controls',group:'Timing',order:1 },
  { ...base,id:pid('auto-performance'),label:'Auto Performance',description:'Permits temporary build/drop pattern substitutions. Manual Pattern selection takes effect immediately.',type:'boolean',defaultValue:false,designParentGroup:'master-controls',group:'Timing',order:2 },
  { ...base,id:pid('pattern'),label:'Pattern',type:'enum',defaultValue:'infernalPassage',options:IFRIT_PATTERNS.map((value,i)=>({value,label:IFRIT_PATTERN_LABELS[i]})),designParentGroup:'design',group:'Pattern',order:0 },
  { ...base,id:pid('pattern-change'),label:'Pattern Change',type:'boolean',defaultValue:false,designParentGroup:'design',group:'Pattern',order:1 },
  { ...base,id:pid('trigger'),label:'Trigger',type:'enum',defaultValue:'phrase',options:CINEMA2_AFTERHOURS_TRIGGER_OPTIONS,visibleWhen:[{kind:'parameter-equals',parameterId:pid('pattern-change'),value:true}],designParentGroup:'design',group:'Pattern',order:2 },
  ...Object.entries(IFRIT_COLORS).map(([key,defaultValue],order)=>({ ...base,id:pid(key),label:({background:'Background',portal:'Portal Emission',wall:'Wall Emission',corner:'Corner Highlights'} as Record<string,string>)[key],type:'color' as const,defaultValue:[...defaultValue],designParentGroup:'palette' as const,group:'Colors',order })),
]

export const CINEMA2_IFRIT_PRESET_MANIFEST: Readonly<Cinema2NativePresetManifest> = {
  schemaId: CINEMA2_NATIVE_PRESET_SCHEMA_ID, schemaVersion: CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  id: CINEMA2_IFRIT_PRESET_ID, revision: 4,
  metadata: { name: 'Ifrit', description: 'An infernal hexagonal passage with extruded orange portals, red mechanical walls, six musical patterns and a dark central rift.', tags: ['geometric', 'tunnel', 'audio-reactive'] },
  capabilities: [
    { id: 'render.webgl2', requirement: 'required', purpose: 'Procedural hexagonal frame and wall geometry.' },
    { id: 'render.depth', requirement: 'required', purpose: 'Occlusion between extruded portal frames and peripheral structure.' },
    { id: 'scene.3d', requirement: 'required', purpose: 'World-space tunnel composition.' },
    { id: 'camera.world', requirement: 'required', purpose: 'Centered perspective reference framing.' },
    ...(['audio.transport','audio.features','audio.bands','music.beat','music.rhythm-events','music.downbeat','music.bar','music.phrase','music.section','music.build','music.drop','music.vocal-presence','visual-director.significance'] as const).map(id=>({id,requirement:'optional' as const,purpose:'Shared musical facts and bounded tunnel performance.'})),
  ],
  parameters,
  modules: [{ id: moduleId, typeId: CINEMA2_IFRIT_MODULE_TYPE, version: 1, enabled: true, parameters: { ...Object.fromEntries(parameters.map(p=>[p.id.slice(6),p.defaultValue!])), ...Object.fromEntries(IFRIT_CHANNELS.map(key=>[key,0])) }, parameterBindings: Object.fromEntries(parameters.map(p=>[p.id.slice(6),cinema2Ref(p.id)])) }],
  scene: { nodes: [
    { id: root, kind: 'group', coordinateSpace: 'world', visible: true },
    { id: node, kind: 'module', parent: cinema2Ref(root), module: cinema2Ref(moduleId), visible: true },
  ], roots: [cinema2Ref(root)] },
  layers: [{ id: layer, label: 'Ifrit Tunnel', source: cinema2Ref(root), role: 'world', depthPolicy: 'read-write', order: 0 }],
  cameras: [{
    id: camera, label: 'Ifrit Reference Camera', projection: 'perspective', fovDegrees: 70, minAspect: 1, minAspectAnchor: 0,
    near: 0.1, far: 30, transform: { position: [0, 0, 0] }, target: [0, 0, -10], rig: { kind: 'static' }, smoothingMs: 0,
    // Keep the approved axial composition fixed. Shared aspect fitting widens
    // vertical FOV in portrait after these authored-pose limits are applied.
    safety: {
      minPosition: [0, 0, 0], maxPosition: [0, 0, 0],
      maxPositionOffset: [0, 0, 0], maxTargetOffset: [0, 0, 0],
      minFovDegrees: 69.9, maxFovDegrees: 70.1, minNear: 0.1, maxFar: 30,
    },
  }],
  environment: { backgroundColor: [0.001, 0, 0, 1], exposure: 1, controls: { backgroundColor: cinema2Ref(pid('background')) } },
  choreography: { tempoSyncParameter: cinema2Ref(pid('bpm-sync')), rules: IFRIT_CHOREOGRAPHY },
  effects: IFRIT_EFFECTS, render: IFRIT_RENDER_GRAPH,
  defaults: { camera: cinema2Ref(camera) },
}
