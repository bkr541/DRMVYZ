import {
  CINEMA2_NATIVE_PRESET_SCHEMA_ID, CINEMA2_NATIVE_PRESET_SCHEMA_VERSION, cinema2Ref, cinema2StableId, cinema2NamespacedId,
  type Cinema2PresetId, type Cinema2ModuleId, type Cinema2SceneNodeId, type Cinema2LayerId,
  type Cinema2CameraId, type Cinema2NativePresetManifest, type Cinema2ParameterManifest,
} from '../contracts/Cinema2NativePresetManifest'
import { CINEMA2_IFRIT_MODULE_TYPE } from '../modules/Cinema2IfritNativeModule'
import { IFRIT_COLORS, IFRIT_NUMBERS, IFRIT_PATTERNS, IFRIT_PATTERN_LABELS, IFRIT_CHANNELS, IFRIT_MECHANICS_NUMBERS, IFRIT_SHATTER_NUMBERS, IFRIT_SHATTER_TRIGGERS, IFRIT_SHATTER_TRIGGER_LABELS, IFRIT_SECTORS, ifritParameterId as pid } from '../modules/ifrit/Cinema2IfritDomain'
import { cinema2AutoTargets } from './Cinema2AutoPerformanceAuthoring'
import { withCinema2MoodDrives } from './Cinema2MoodConductorAuthoring'
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

const MECHANICS_GROUP = 'Radial Mechanics', SHATTER_GROUP = 'Shatter & Reconstruction'
const MECHANICS_SECTORS = 'Radial Mechanics / Sector Overrides', SHATTER_SECTORS = 'Shatter & Reconstruction / Sector Overrides'
const enhancementLabels: Record<string,string> = {
  'mechanics-density':'Mechanics Density','spoke-extension':'Spoke Extension','spoke-pulse':'Spoke Pulse','gear-speed':'Gear Speed','blade-sweep':'Blade Sweep','blade-count':'Blade Count',
  'satellite-count':'Satellite Count','satellite-orbit-radius':'Satellite Orbit Radius','satellite-orbit-speed':'Satellite Orbit Speed',
  'shatter-strength':'Shatter Strength','shatter-hold':'Shatter Hold','fragments-per-edge':'Fragments Per Edge','fragment-spread':'Fragment Spread','fragment-spin':'Fragment Spin','reassembly-duration':'Reassembly Duration',
}
const enhancementDescriptions: Record<string,string> = {
  'mechanics-density':'How much of the radial machinery is present. 0 removes it; the default shows the authored counts.',
  'spoke-extension':'Resting reach of each telescoping spoke into the mechanical wall.','spoke-pulse':'How far the pattern and kicks drive each spoke beyond its resting reach.',
  'gear-speed':'Signed rotor rate on the shared musical clock. Negative reverses; 0 holds the gears.','blade-sweep':'How far each blade swings about its pivot as the pattern and snares drive it.',
  'blade-count':'Blades fanned across each sector (0-6).','satellite-count':'Small geometric satellites orbiting each sector (0-6).',
  'satellite-orbit-radius':'Orbit size, in world units. Satellites orbit through depth and never enter the central opening.','satellite-orbit-speed':'Signed orbit rate on the shared musical clock.',
  'shatter-strength':'Ceiling for how far portal edges break apart on a musical cue. 0 keeps them whole.','shatter-hold':'Manual: the fracture shown with the Manual trigger. Other triggers: keeps a live fracture lingering at this level.',
  'fragments-per-edge':'Sections each portal edge breaks into (1-4; fewer on lower render quality).','fragment-spread':'How far the pieces travel.','fragment-spin':'How much the pieces tumble.',
  'reassembly-duration':'Shapes the return: shorter snaps the pieces back, longer lets them linger. 0.75 is the authored curve.',
}
function enhancementParameters(): Cinema2ParameterManifest[] {
  const mechOn = [{ kind: 'parameter-equals' as const, parameterId: pid('mechanics-enabled'), value: true }]
  const shatterOn = [{ kind: 'parameter-equals' as const, parameterId: pid('shatter-enabled'), value: true }]
  const integer = (key: string) => key === 'blade-count' || key === 'satellite-count' || key === 'fragments-per-edge'
  const number = (key: string, [min, defaultValue, max]: readonly [number, number, number], group: string, visibleWhen: typeof mechOn, order: number): Cinema2ParameterManifest => ({
    ...base, id: pid(key), label: enhancementLabels[key], description: enhancementDescriptions[key], type: integer(key) ? 'integer' : 'float', min, defaultValue, max,
    step: integer(key) ? 1 : key === 'gear-speed' || key === 'satellite-orbit-speed' ? 0.05 : 0.01, designParentGroup: 'design', group, order, visibleWhen,
  })
  const out: Cinema2ParameterManifest[] = [
    { ...base, id: pid('mechanics-enabled'), label: 'Radial Mechanics', description: 'Telescoping spokes, gears, pivoting blades and orbiting satellites between the portal frames. OFF removes them entirely.', type: 'boolean', defaultValue: true, designParentGroup: 'design', group: MECHANICS_GROUP, order: 40 },
    ...Object.entries(IFRIT_MECHANICS_NUMBERS).map(([key, range], i) => number(key, range, MECHANICS_GROUP, mechOn, 41 + i)),
    { ...base, id: pid('shatter-enabled'), label: 'Shatter & Reconstruction', description: 'Portal edges break into addressable pieces on musical cues and rebuild exactly. OFF keeps every edge whole.', type: 'boolean', defaultValue: true, designParentGroup: 'design', group: SHATTER_GROUP, order: 60 },
    { ...base, id: pid('shatter-trigger'), label: 'Shatter Trigger', description: 'Which shared musical event breaks the edges. Manual shows the Shatter Hold fracture and never invents an event.', type: 'enum', defaultValue: 'drop', options: IFRIT_SHATTER_TRIGGERS.map((value, i) => ({ value, label: IFRIT_SHATTER_TRIGGER_LABELS[i] })), designParentGroup: 'design', group: SHATTER_GROUP, order: 61, visibleWhen: shatterOn },
    ...Object.entries(IFRIT_SHATTER_NUMBERS).map(([key, range], i) => number(key, range, SHATTER_GROUP, shatterOn, 62 + i)),
  ]
  for (let sector = 0; sector < IFRIT_SECTORS; sector++) {
    const n = sector + 1
    out.push(
      { ...base, exposure: 'advanced', id: pid(`sector-${sector}-enabled`), label: `Sector ${n} Mechanics`, description: `Shows or hides the mechanics on side ${n} of every portal.`, type: 'boolean', defaultValue: true, designParentGroup: 'design', group: MECHANICS_SECTORS, order: 100 + sector * 3, visibleWhen: mechOn },
      { ...base, exposure: 'advanced', id: pid(`sector-${sector}-arm-offset`), label: `Sector ${n} Arm Offset`, description: `Adds to or takes from the spoke reach on side ${n}.`, type: 'float', min: -1, defaultValue: 0, max: 1, step: 0.01, designParentGroup: 'design', group: MECHANICS_SECTORS, order: 101 + sector * 3, visibleWhen: mechOn },
      { ...base, exposure: 'advanced', id: pid(`sector-${sector}-blade-offset`), label: `Sector ${n} Blade Offset`, description: `Turns the blades on side ${n}, in degrees.`, type: 'float', min: -180, defaultValue: 0, max: 180, step: 1, designParentGroup: 'design', group: MECHANICS_SECTORS, order: 102 + sector * 3, visibleWhen: mechOn },
      { ...base, exposure: 'advanced', id: pid(`sector-${sector}-shatter-bias`), label: `Sector ${n} Shatter`, description: `How readily the edge on side ${n} breaks. 0 keeps it whole.`, type: 'float', min: 0, defaultValue: 1, max: 1, step: 0.01, designParentGroup: 'design', group: SHATTER_SECTORS, order: 130 + sector, visibleWhen: shatterOn },
    )
  }
  out.push({ ...base, exposure: 'advanced', id: pid('element-overrides'), label: 'Element Overrides', description: 'Per-part patches as JSON keyed by part id, for example {"ring-01/sector-4/blade-0":{"rotationOffset":0.4}}. Fields: enabled, rotationOffset, extensionOffset, spreadMultiplier, angularVelocityMultiplier, phaseOffset, scaleMultiplier. Unknown ids and fields are ignored.', type: 'text', defaultValue: '{}', designParentGroup: 'design', group: 'Element Overrides', order: 140 })
  return out
}

const parameters: Cinema2ParameterManifest[] = [
  ...Object.entries(IFRIT_NUMBERS).map(([key,[min,defaultValue,max]],order)=>({ ...base,id:pid(key),label:labels[key],description:descriptions[key],type:key==='count'?'integer' as const:'float' as const,min,defaultValue,max,step:key==='count'?1:0.01,
    designParentGroup:key==='intensity'||key==='reactivity'?'master-controls' as const:key==='bloom'?'effects' as const:'design' as const,group:key==='bloom'?'Finishing':'Geometry',order:10+order })),
  { ...base,id:pid('bpm-sync'),label:'BPM Sync',description:'Locks movement to shared musical timing. OFF uses seconds-based rates; host Sync does not veto this setting.',type:'boolean',defaultValue:true,designParentGroup:'master-controls',group:'Timing',order:1 },
  { ...base,id:pid('auto-performance'),label:'Auto Performance',description:'Permits temporary build/drop pattern substitutions. Manual Pattern selection takes effect immediately.',type:'boolean',defaultValue:false,designParentGroup:'master-controls',group:'Timing',order:2 },
  { ...base,id:pid('pattern'),label:'Pattern',type:'enum',defaultValue:'infernalPassage',options:IFRIT_PATTERNS.map((value,i)=>({value,label:IFRIT_PATTERN_LABELS[i]})),designParentGroup:'design',group:'Pattern',order:0 },
  { ...base,id:pid('pattern-change'),label:'Pattern Change',type:'boolean',defaultValue:false,designParentGroup:'design',group:'Pattern',order:1 },
  { ...base,id:pid('trigger'),label:'Trigger',type:'enum',defaultValue:'phrase',options:CINEMA2_AFTERHOURS_TRIGGER_OPTIONS,visibleWhen:[{kind:'parameter-equals',parameterId:pid('pattern-change'),value:true}],designParentGroup:'design',group:'Pattern',order:2 },
  ...enhancementParameters(),
  ...Object.entries(IFRIT_COLORS).map(([key,defaultValue],order)=>({ ...base,id:pid(key),label:({background:'Background',portal:'Portal Emission',wall:'Wall Emission',corner:'Corner Highlights'} as Record<string,string>)[key],type:'color' as const,defaultValue:[...defaultValue],designParentGroup:'palette' as const,group:'Colors',order })),
]

const CINEMA2_IFRIT_AUTHORED_PRESET_MANIFEST: Readonly<Cinema2NativePresetManifest> = {
  schemaId: CINEMA2_NATIVE_PRESET_SCHEMA_ID, schemaVersion: CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  id: CINEMA2_IFRIT_PRESET_ID, revision: 5,
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

const ifritModule = (property: string) => cinema2AutoTargets.module(moduleId as string, property)
const drive = (id: string, property: string, source: 'mood.activity' | 'mood.calm' | 'mood.shock' | 'mood.peak' | 'mood.tense', value: number) => ({ id, target: ifritModule(property), source, operation: 'add' as const, value })
/**
 * Ifrit's own Auto Performance (build and drop pattern substitutions) is unchanged. The shared Mood Conductor adds, while the toggle is on, a music
 * choice of Pattern Change and Trigger, and drives that move the passage with how it feels around the authored values. Travel, Rotation and Gear
 * Speed are deliberately not driven: they set the shared timeline, and a drive there would put energy into the passage clock.
 */
export const CINEMA2_IFRIT_PRESET_MANIFEST: Readonly<Cinema2NativePresetManifest> = withCinema2MoodDrives(CINEMA2_IFRIT_AUTHORED_PRESET_MANIFEST, {
  idPrefix: 'ifrit-auto',
  enabledParameter: pid('auto-performance'),
  strengthParameter: pid('reactivity'),
  patternControls: { patternChange: pid('pattern-change'), trigger: pid('trigger') },
  drives: [
    drive('intensity-calm', 'intensity', 'mood.calm', -0.3),
    drive('twist-tense', 'twist', 'mood.tense', 0.25), drive('twist-peak', 'twist', 'mood.peak', 0.15),
    drive('thickness-shock', 'thickness', 'mood.shock', 0.3),
    { id: 'bloom-activity', target: cinema2AutoTargets.effect('ifrit-bloom', 'mix'), source: 'mood.activity' as const, operation: 'add' as const, value: 0.12 },
    { id: 'bloom-shock', target: cinema2AutoTargets.effect('ifrit-bloom', 'mix'), source: 'mood.shock' as const, operation: 'add' as const, value: 0.2 },
    { id: 'bloom-calm', target: cinema2AutoTargets.effect('ifrit-bloom', 'mix'), source: 'mood.calm' as const, operation: 'add' as const, value: -0.1 },
    drive('spoke-peak', 'spoke-extension', 'mood.peak', 0.35), drive('spoke-shock', 'spoke-extension', 'mood.shock', 0.3), drive('spoke-calm', 'spoke-extension', 'mood.calm', -0.15),
    drive('pulse-activity', 'spoke-pulse', 'mood.activity', 0.3),
    drive('blade-activity', 'blade-sweep', 'mood.activity', 0.25), drive('blade-tense', 'blade-sweep', 'mood.tense', 0.15),
    drive('orbit-peak', 'satellite-orbit-radius', 'mood.peak', 0.35), drive('orbit-shock', 'satellite-orbit-radius', 'mood.shock', 0.3),
  ],
})
