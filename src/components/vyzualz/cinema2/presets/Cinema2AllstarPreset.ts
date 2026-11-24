import { cinema2AutoTargets } from './Cinema2AutoPerformanceAuthoring'
import { withCinema2MoodDrives } from './Cinema2MoodConductorAuthoring'
import {
  CINEMA2_NATIVE_PRESET_SCHEMA_ID,
  CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  cinema2NamespacedId,
  cinema2Ref,
  cinema2StableId,
  type Cinema2CameraId,
  type Cinema2ChoreographyActionId,
  type Cinema2ChoreographyRuleId,
  type Cinema2Color,
  type Cinema2EffectId,
  type Cinema2LayerId,
  type Cinema2LightId,
  type Cinema2ModuleId,
  type Cinema2NativePresetManifest,
  type Cinema2ParameterId,
  type Cinema2PresetId,
  type Cinema2RenderPassId,
  type Cinema2RenderSlotId,
  type Cinema2RenderTargetId,
  type Cinema2SceneNodeId,
  type Cinema2Vector3,
} from '../contracts/Cinema2NativePresetManifest'
import { CINEMA2_CINEMATIC_FINISH_EFFECT_TYPE_ID } from '../effects/Cinema2CinematicFinishEffect'
import { CINEMA2_HDR_BLOOM_EFFECT_TYPE_ID } from '../effects/Cinema2HdrBloomEffect'
import { CINEMA2_VOLUMETRIC_ATMOSPHERE_EFFECT_TYPE_ID } from '../effects/Cinema2VolumetricAtmosphereEffect'
import { CINEMA2_ALLSTAR_NATIVE_MODULE_TYPE_ID } from '../modules/Cinema2AllstarNativeModule'
import { ALLSTAR_PATTERNS, ALLSTAR_LABELS } from '../modules/allstar/Cinema2AllstarPatterns'
import type { Cinema2ChoreographyContinuousSourcePath } from '../contracts/Cinema2NativePresetManifest'
import type { Cinema2MoodDrive } from './Cinema2MoodConductorAuthoring'
import { CINEMA2_QUALITY_MODE_PARAMETER } from '../parameters/Cinema2PerformanceParameters'
import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from './Cinema2AfterhoursPreset'

export const CINEMA2_ALLSTAR_PRESET_ID = cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.allstar')
export const CINEMA2_ALLSTAR_MODULE_ID = cinema2StableId<Cinema2ModuleId>('allstar-system')
export const CINEMA2_ALLSTAR_CAMERA_ID = cinema2StableId<Cinema2CameraId>('allstar-camera')
const pid = (name: string) => cinema2StableId<Cinema2ParameterId>(`allstar-${name}`)
const ROOT_NODE_ID = cinema2StableId<Cinema2SceneNodeId>('allstar-root')
const TUNNEL_NODE_ID = cinema2StableId<Cinema2SceneNodeId>('allstar-tunnel-node')
const WORLD_LAYER_ID = cinema2StableId<Cinema2LayerId>('allstar-world-layer')
const AMBIENT_LIGHT_ID = cinema2StableId<Cinema2LightId>('allstar-ambient-light')
const HAZE_LIGHT_ID = cinema2StableId<Cinema2LightId>('allstar-haze-light')
const ATMOSPHERE_EFFECT_ID = cinema2StableId<Cinema2EffectId>('allstar-atmosphere')
const BLOOM_EFFECT_ID = cinema2StableId<Cinema2EffectId>('allstar-bloom')
const FINISH_EFFECT_ID = cinema2StableId<Cinema2EffectId>('allstar-finish')

const targetId = (name: string) => cinema2StableId<Cinema2RenderTargetId>(`allstar-${name}-target`)
const passId = (name: string) => cinema2StableId<Cinema2RenderPassId>(`allstar-${name}-pass`)
const slotId = (name: string) => cinema2StableId<Cinema2RenderSlotId>(`allstar-${name}`)
const SCENE_TARGET_ID = targetId('scene')
const ATMOSPHERE_TARGET_ID = targetId('atmosphere')
const BLOOM_TARGET_ID = targetId('bloom')
const SCENE_PASS_ID = passId('scene')
const ATMOSPHERE_PASS_ID = passId('atmosphere')
const BLOOM_PASS_ID = passId('bloom')
const FINISH_PASS_ID = passId('finish')
const SCENE_COLOR_ID = slotId('scene-color')
const SCENE_DEPTH_ID = slotId('scene-depth')

const vec3 = (x: number, y: number, z: number): Cinema2Vector3 => Object.freeze([x, y, z])
const color = (r: number, g: number, b: number, a = 1): Cinema2Color => Object.freeze([r, g, b, a])
const parameterBase = Object.freeze({
  section: 'Design', exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
  modulatable: true, choreographable: true, automatable: false,
})
const floatParameter = (id: Cinema2ParameterId, label: string, description: string, defaultValue: number, min: number, max: number, step: number, parent: 'master-controls' | 'design' | 'effects', group: string, order: number) => Object.freeze({
  ...parameterBase, id, label, description, type: 'float' as const, defaultValue, min, max, step, designParentGroup: parent, group, order,
})
const colorParameter = (id: Cinema2ParameterId, label: string, description: string, defaultValue: Cinema2Color, order: number) => Object.freeze({
  ...parameterBase, modulatable: false, choreographable: false, id, label, description, type: 'color' as const, defaultValue, designParentGroup: 'palette' as const, group: 'Color', order,
})

const choreographyRuleId = (name: string) => cinema2StableId<Cinema2ChoreographyRuleId>(`allstar-${name.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`)}-rule`)
const choreographyActionId = (name: string) => cinema2StableId<Cinema2ChoreographyActionId>(`allstar-${name.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`)}-action`)
const moduleContinuousRule = (
  name: string,
  capability: 'audio.features' | 'audio.bands' | 'music.vocal-presence' | 'visual-director.significance',
  path: Cinema2ChoreographyContinuousSourcePath,
  property: string,
  smoothingMs: number,
) => Object.freeze({
  id: choreographyRuleId(name),
  priority: 12,
  strengthParameter: cinema2Ref(pid('reactivity')),
  source: Object.freeze({ signal: 'continuous' as const, capability, path, smoothingMs }),
  conditions: Object.freeze([{kind:'not-silent' as const}]),
  actions: Object.freeze([Object.freeze({
    id: choreographyActionId(name),
    target: Object.freeze({ kind: 'module' as const, ref: cinema2Ref(CINEMA2_ALLSTAR_MODULE_ID), property }),
    operation: 'replace' as const,
    value: 1,
  })]),
})
const moduleEnvelopeRule = (
  name: string,
  signal: 'beat' | 'kick' | 'snare' | 'downbeat' | 'bar' | 'phrase' | 'section-change' | 'drop',
  capability: 'music.beat' | 'music.rhythm-events' | 'music.downbeat' | 'music.bar' | 'music.phrase' | 'music.section' | 'music.drop',
  property: string,
  attack: number,
  hold: number,
  release: number,
) => Object.freeze({
  id: choreographyRuleId(name),
  priority: 30,
  strengthParameter: cinema2Ref(pid('reactivity')),
  source: Object.freeze({ signal, capability }),
  conditions: Object.freeze([Object.freeze({ kind: 'once-per-event' as const }), ...(signal === 'drop' ? [] : [{ kind: 'not-silent' as const }])]),
  actions: Object.freeze([Object.freeze({
    id: choreographyActionId(name),
    target: Object.freeze({ kind: 'module' as const, ref: cinema2Ref(CINEMA2_ALLSTAR_MODULE_ID), property }),
    operation: 'envelope' as const,
    value: 1,
    composition: 'replace' as const,
    envelope: Object.freeze({ attack, hold, release, unit: 'seconds' as const }),
    retrigger: 'restart' as const,
  })]),
})
const viewportTarget = (id: Cinema2RenderTargetId, depth = false) => Object.freeze({
  id,
  descriptor: Object.freeze({
    size: Object.freeze({ kind: 'viewport' as const }),
    colorFormat: 'rgba16f' as const,
    fallbackColorFormat: 'rgba8' as const,
    ...(depth ? { depthFormat: 'depth24' as const } : {}),
  }),
  ownership: 'transient' as const,
})
function effectPass(id: Cinema2RenderPassId, after: Cinema2RenderPassId, afterOutput: Cinema2RenderSlotId, effect: Cinema2EffectId, name: string, output: Cinema2RenderTargetId | null, withDepth: boolean) {
  return Object.freeze({
    id,
    kind: 'fullscreen' as const,
    dependsOn: Object.freeze([cinema2Ref(after)]),
    effect: cinema2Ref(effect),
    inputs: Object.freeze([
      Object.freeze({ id: slotId(`${name}-color-input`), source: Object.freeze({ pass: cinema2Ref(after), output: afterOutput }), attachment: 'color' as const }),
      ...(withDepth ? [Object.freeze({ id: slotId(`${name}-depth-input`), source: Object.freeze({ pass: cinema2Ref(SCENE_PASS_ID), output: SCENE_DEPTH_ID }), attachment: 'depth' as const })] : []),
    ]),
    ...(output ? { outputs: Object.freeze([Object.freeze({ id: slotId(`${name}-output`), target: cinema2Ref(output), attachment: 'color' as const })]) } : {}),
  })
}

const authored: Readonly<Cinema2NativePresetManifest> = {
  schemaId: CINEMA2_NATIVE_PRESET_SCHEMA_ID, schemaVersion: CINEMA2_NATIVE_PRESET_SCHEMA_VERSION, id:CINEMA2_ALLSTAR_PRESET_ID, revision:1,
  metadata:{name:'ALLSTAR',description:'A sixfold metallic neon corridor with independent morphing stars and twelve spatial performance patterns.',tags:['allstar','3d','tunnel','kaleidoscope','audio-reactive','choreography']},
  capabilities: Object.freeze([
    Object.freeze({ id: 'render.webgl2' as const, requirement: 'required' as const, purpose: 'Instanced procedural hexagonal tunnel and independent emissive formations.' }),
    Object.freeze({ id: 'render.depth' as const, requirement: 'required' as const, purpose: 'Correct ring occlusion and depth-aware atmosphere.' }),
    Object.freeze({ id: 'render.hdr' as const, requirement: 'optional' as const, purpose: 'Preserves light-strip values above white for HDR bloom, with an 8-bit fallback.' }),
    Object.freeze({ id: 'scene.3d' as const, requirement: 'required' as const, purpose: 'World-space tunnel geometry.' }),
    Object.freeze({ id: 'camera.world' as const, requirement: 'required' as const, purpose: 'Perspective view down the tunnel.' }),
    Object.freeze({ id: 'lighting' as const, requirement: 'required' as const, purpose: 'Low ambient structure visibility and atmospheric scattering.' }),
    Object.freeze({ id: 'audio.transport' as const, requirement: 'optional' as const, purpose: 'Transport-safe timing when a track is present.' }),
    Object.freeze({ id: 'audio.features' as const, requirement: 'optional' as const, purpose: 'Energy and spectral flux brighten and speed the tunnel.' }),
    Object.freeze({ id: 'audio.bands' as const, requirement: 'optional' as const, purpose: 'Bass, mid and high bands shape the light patterns.' }),
    Object.freeze({ id: 'music.beat' as const, requirement: 'optional' as const, purpose: 'Beats drive the pattern clock and a small pulse.' }),
    Object.freeze({ id: 'music.rhythm-events' as const, requirement: 'optional' as const, purpose: 'Kick and snare accents excite distinct strips.' }),
    Object.freeze({ id: 'music.downbeat' as const, requirement: 'optional' as const, purpose: 'Downbeats lift the hero ring and the far glow.' }),
    Object.freeze({ id: 'music.bar' as const, requirement: 'optional' as const, purpose: 'Bar boundaries advance manual and automatic patterns.' }),
    Object.freeze({ id: 'music.phrase' as const, requirement: 'optional' as const, purpose: 'Phrase boundaries add a restrained camera accent.' }),
    Object.freeze({ id: 'music.section' as const, requirement: 'optional' as const, purpose: 'Section context chooses pattern behavior.' }),
    Object.freeze({ id: 'music.vocal-presence' as const, requirement: 'optional' as const, purpose: 'Quiet vocal passages hold the tunnel back.' }),
    Object.freeze({ id: 'music.build' as const, requirement: 'optional' as const, purpose: 'Build progress quickens the tunnel.' }),
    Object.freeze({ id: 'music.drop' as const, requirement: 'optional' as const, purpose: 'Drops discharge the strips, bounded by Flash Accents and Drop Strength.' }),
    Object.freeze({ id: 'visual-director.significance' as const, requirement: 'optional' as const, purpose: 'Build and impact scale motion and light without lifting dark structure.' }),
  ]),
  parameters: [
    CINEMA2_QUALITY_MODE_PARAMETER,
    { ...parameterBase, modulatable: false, choreographable: false, id: pid("auto-performance"), label: "Auto Performance", description: "Use the shared Mood Conductor and automatic trigger policy.", type: "boolean", defaultValue: false, designParentGroup: "master-controls", group: "Playback", order: 1 },
    { ...parameterBase, modulatable: false, choreographable: false, id: pid("bpm-sync"), label: "BPM Sync", description: "Lock the shared motion clock to available host tempo.", type: "boolean", defaultValue: true, designParentGroup: "master-controls", group: "Playback", order: 2 },
    { ...parameterBase, modulatable: false, choreographable: false, id: pid("motion-safety"), label: "Motion Safety", description: "Full, reduced, or locked spatial motion.", type: "enum", defaultValue: "full", designParentGroup: "master-controls", group: "Playback", order: 3, options: [{value:'full',label:'Full Motion'},{value:'reduced',label:'Reduced Motion'},{value:'lockoff',label:'Lock Off'}] },
    { ...parameterBase, modulatable: false, choreographable: false, id: pid("flash-accents"), label: "Flash Accents", description: "Off forbids intentional flash accents.", type: "enum", defaultValue: "reduced", designParentGroup: "master-controls", group: "Playback", order: 4, options: [{value:'off',label:'Off'},{value:'reduced',label:'Reduced'},{value:'full',label:'Full'}] },
    { ...parameterBase, modulatable: false, choreographable: false, id: pid("pattern"), label: "Pattern", description: "Select the authored base pattern without disabling Pattern Change.", type: "enum", defaultValue: "infinitePassage", designParentGroup: "design", group: "Pattern", order: 1, options: ALLSTAR_PATTERNS.map((value,i)=>({value,label:ALLSTAR_LABELS[i]!})) },
    { ...parameterBase, modulatable: false, choreographable: false, id: pid("pattern-change"), label: "Pattern Change", description: "Advance the runtime base on new qualifying shared events.", type: "boolean", defaultValue: false, designParentGroup: "design", group: "Pattern", order: 2 },
    { ...parameterBase, modulatable: false, choreographable: false, id: pid("trigger"), label: "Trigger", description: "Choose a shared musical event.", type: "enum", defaultValue: "bar4", designParentGroup: "design", group: "Pattern", order: 3, options: CINEMA2_AFTERHOURS_TRIGGER_OPTIONS, visibleWhen: [{ kind: 'parameter-equals', parameterId: pid('pattern-change'), value: true }] },
    { ...parameterBase, modulatable: false, choreographable: false, id: pid("geometry"), label: "Geometry", description: "Hard permission for independent shapes.", type: "boolean", defaultValue: true, designParentGroup: "design", group: "Geometry", order: 1 },
    { ...parameterBase, modulatable: false, choreographable: false, id: pid("camera-motion"), label: "Camera Motion", description: "Hard permission for camera movement.", type: "boolean", defaultValue: true, designParentGroup: "design", group: "Camera", order: 1 },
    { ...parameterBase, modulatable: false, choreographable: false, id: pid("perimeter-lighting"), label: "Perimeter Lighting", description: "Hard permission for perimeter emitters.", type: "boolean", defaultValue: true, designParentGroup: "design", group: "Lighting", order: 1 },
    { ...parameterBase, modulatable: false, choreographable: false, id: pid("recessed-fixtures"), label: "Recessed Fixtures", description: "Hard permission for recessed emitters.", type: "boolean", defaultValue: true, designParentGroup: "design", group: "Lighting", order: 2 },
    floatParameter(pid("intensity"), "Master Intensity", "Overall emissive brightness.", 1, 0, 2, 0.01, "master-controls", "Light", 1),
    floatParameter(pid("reactivity"), "Music Reactivity", "Strength of shared musical and mood contributions.", 1, 0, 2, 0.01, "master-controls", "Playback", 5),
    floatParameter(pid("motion-amount"), "Motion Amount", "Global extent of spatial motion.", 0.75, 0, 1, 0.01, "master-controls", "Playback", 6),
    floatParameter(pid("tunnel-width"), "Tunnel Width", "Physical hexagon radius.", 4, 2.8, 5.5, 0.01, "design", "Architecture", 1),
    floatParameter(pid("tunnel-depth"), "Tunnel Depth", "Distance between tunnel modules.", 1, 0.75, 1.5, 0.01, "design", "Architecture", 2),
    floatParameter(pid("frame-thickness"), "Frame Thickness", "Thickness of structural ribs.", 0.16, 0.08, 0.32, 0.005, "design", "Architecture", 3),
    floatParameter(pid("structural-detail"), "Structural Detail", "Amount of inset panels, trim and machining detail.", 0.75, 0, 1, 0.01, "design", "Architecture", 4),
    floatParameter(pid("surface-roughness"), "Surface Roughness", "Width of reflected metallic highlights.", 0.35, 0.12, 0.85, 0.01, "design", "Architecture", 5),
    floatParameter(pid("geometry-layers"), "Geometry Layers", "Maximum independent depth layers.", 5, 1, 9, 1, "design", "Geometry", 2),
    floatParameter(pid("geometry-size"), "Geometry Size", "Radius of independent shapes.", 1, 0.5, 1.5, 0.01, "design", "Geometry", 3),
    floatParameter(pid("geometry-thickness"), "Geometry Thickness", "Physical width of luminous geometric edges.", 0.045, 0.015, 0.12, 0.005, "design", "Geometry", 4),
    floatParameter(pid("morph-amount"), "Morph Amount", "Polygon to star deformation.", 0.65, 0, 1, 0.01, "design", "Geometry", 5),
    floatParameter(pid("geometry-intensity"), "Geometry Intensity", "Independent outline emission.", 1, 0, 2, 0.01, "design", "Geometry", 6),
    floatParameter(pid("geometric-separation"), "Geometric Separation", "Depth distance between geometric layers.", 0.7, 0.2, 1, 0.01, "design", "Geometry", 7),
    floatParameter(pid("travel-speed"), "Travel Speed", "Tunnel traversal rate.", 0.7, 0, 2, 0.01, "design", "Movement", 1),
    floatParameter(pid("geometry-travel"), "Geometry Travel", "Independent formation depth speed.", 0.85, 0, 2, 0.01, "design", "Movement", 2),
    floatParameter(pid("rotation-speed"), "Rotation Speed", "Rotation rate of independent outlines.", 0.12, 0, 1, 0.01, "design", "Movement", 3),
    floatParameter(pid("counter-rotation"), "Counter-Rotation", "Opposing rotation of alternating layers.", 0.35, 0, 1, 0.01, "design", "Movement", 4),
    floatParameter(pid("expansion-amount"), "Expansion Amount", "Radial expansion and contraction.", 0.75, 0, 1, 0.01, "design", "Movement", 5),
    floatParameter(pid("morph-speed"), "Morph Speed", "Deformation cycle rate.", 0.6, 0, 2, 0.01, "design", "Movement", 6),
    floatParameter(pid("depth-wave"), "Depth Wave", "Spatial ripple through tunnel modules.", 0.45, 0, 1, 0.01, "design", "Movement", 7),
    floatParameter(pid("camera-sway"), "Camera Sway", "Restrained camera drift and tempo motion.", 0.1, 0, 0.5, 0.01, "design", "Camera", 2),
    floatParameter(pid("camera-roll"), "Camera Roll", "Subtle relative axial roll of the scene.", 0.02, 0, 0.25, 0.01, "design", "Camera", 3),
    floatParameter(pid("fov"), "Field of View", "Perspective angle.", 65, 50, 85, 1, "design", "Camera", 4),
    floatParameter(pid("camera-impact"), "Camera Impact", "Maximum bounded musical camera impact.", 0.12, 0, 0.5, 0.01, "design", "Camera", 5),
    floatParameter(pid("perimeter-intensity"), "Perimeter Intensity", "Main architectural light rail emission.", 1, 0, 2, 0.01, "design", "Lighting", 3),
    floatParameter(pid("fixture-intensity"), "Fixture Intensity", "Short recessed fixture emission.", 0.85, 0, 2, 0.01, "design", "Lighting", 4),
    floatParameter(pid("fixture-density"), "Fixture Density", "Fraction of short fixtures recruited.", 0.65, 0.1, 1, 0.01, "design", "Lighting", 5),
    floatParameter(pid("lighting-chase-speed"), "Lighting Chase Speed", "Sequential illumination speed.", 0.6, 0, 2, 0.01, "design", "Lighting", 6),
    floatParameter(pid("lighting-contrast"), "Lighting Contrast", "Difference between dormant and lit fixtures.", 0.8, 0, 1, 0.01, "design", "Lighting", 7),
    floatParameter(pid("blackout-depth"), "Blackout Depth", "Extent of selective darkening.", 0.75, 0, 1, 0.01, "design", "Lighting", 8),
    floatParameter(pid("bloom"), "Bloom", "HDR emissive halo.", 0.45, 0, 2, 0.01, "effects", "Illumination", 1),
    floatParameter(pid("bloom-spread"), "Bloom Spread", "Halo extent.", 0.3, 0.05, 0.8, 0.01, "effects", "Illumination", 2),
    floatParameter(pid("light-spill"), "Light Spill", "Local illumination on adjacent panels.", 0.65, 0, 1, 0.01, "effects", "Illumination", 3),
    floatParameter(pid("reflections"), "Reflections", "Analytic local metallic reflection.", 0.55, 0, 1, 0.01, "effects", "Illumination", 4),
    floatParameter(pid("atmosphere"), "Atmosphere", "Depth-aware haze density.", 0.012, 0, 0.12, 0.001, "effects", "Atmosphere", 1),
    floatParameter(pid("depth-falloff"), "Depth Falloff", "Distant geometry attenuation.", 0.55, 0, 1, 0.01, "effects", "Atmosphere", 2),
    floatParameter(pid("atmospheric-texture"), "Atmospheric Texture", "Haze texture variation.", 0.15, 0, 0.5, 0.01, "effects", "Atmosphere", 3),
    floatParameter(pid("finish"), "Cinematic Finish", "Overall tone-mapped cinematic finish.", 1, 0, 1, 0.01, "effects", "Cinematic Finish", 1),
    floatParameter(pid("contrast"), "Contrast", "Light/dark separation.", 1.2, 0.8, 1.5, 0.01, "effects", "Cinematic Finish", 2),
    floatParameter(pid("saturation"), "Saturation", "Overall color richness.", 1, 0, 1.5, 0.01, "effects", "Cinematic Finish", 3),
    floatParameter(pid("vignette"), "Vignette", "Peripheral darkening.", 0.25, 0, 0.8, 0.01, "effects", "Cinematic Finish", 4),
    floatParameter(pid("drop-strength"), "Drop Strength", "Caps drop-specific responses.", 0.75, 0, 1, 0.01, "effects", "Cinematic Finish", 5),
    colorParameter(pid("background"), "Background", "Independent background color role.", color(0.023529, 0.011765, 0.043137, 1), 1),
    colorParameter(pid("metal"), "Structural Metal", "Independent structural metal color role.", color(0.145098, 0.12549, 0.172549, 1), 2),
    colorParameter(pid("panel"), "Panel Surface", "Independent panel surface color role.", color(0.25098, 0.2, 0.286275, 1), 3),
    colorParameter(pid("perimeter"), "Perimeter Light", "Independent perimeter light color role.", color(0.960784, 0.164706, 0.85098, 1), 4),
    colorParameter(pid("geometry-color"), "Geometry", "Independent geometry color role.", color(0.25098, 0.87451, 1.0, 1), 5),
    colorParameter(pid("accent"), "Accent Light", "Independent accent light color role.", color(1.0, 0.945098, 0.988235, 1), 6),
    colorParameter(pid("atmosphere-color"), "Atmosphere", "Independent atmosphere color role.", color(0.329412, 0.086275, 0.435294, 1), 7),
  ],
  modules: [{ id:CINEMA2_ALLSTAR_MODULE_ID,typeId:CINEMA2_ALLSTAR_NATIVE_MODULE_TYPE_ID,version:1,enabled:true,
    parameters: {
  "autoPerformance": false,
  "bpmSync": true,
  "motionSafety": "full",
  "flashAccents": "reduced",
  "pattern": "infinitePassage",
  "patternChange": false,
  "trigger": "bar4",
  "geometry": true,
  "cameraMotion": true,
  "perimeterLighting": true,
  "recessedFixtures": true,
  "intensity": 1,
  "reactivity": 1,
  "motionAmount": 0.75,
  "tunnelWidth": 4,
  "tunnelDepth": 1,
  "frameThickness": 0.16,
  "structuralDetail": 0.75,
  "surfaceRoughness": 0.35,
  "geometryLayers": 5,
  "geometrySize": 1,
  "geometryThickness": 0.045,
  "morphAmount": 0.65,
  "geometryIntensity": 1,
  "geometricSeparation": 0.7,
  "travelSpeed": 0.7,
  "geometryTravel": 0.85,
  "rotationSpeed": 0.12,
  "counterRotation": 0.35,
  "expansionAmount": 0.75,
  "morphSpeed": 0.6,
  "depthWave": 0.45,
  "cameraRoll": 0.02,
  "perimeterIntensity": 1,
  "fixtureIntensity": 0.85,
  "fixtureDensity": 0.65,
  "lightingChaseSpeed": 0.6,
  "lightingContrast": 0.8,
  "blackoutDepth": 0.75,
  "lightSpill": 0.65,
  "reflections": 0.55,
  "depthFalloff": 0.55,
  "dropStrength": 0.75,
  "metal": [
    0.145098,
    0.12549,
    0.172549,
    1
  ],
  "panel": [
    0.25098,
    0.2,
    0.286275,
    1
  ],
  "perimeter": [
    0.960784,
    0.164706,
    0.85098,
    1
  ],
  "geometryColor": [
    0.25098,
    0.87451,
    1.0,
    1
  ],
  "accent": [
    1.0,
    0.945098,
    0.988235,
    1
  ],
  "overallEnergy": 0,
  "subAmount": 0,
  "bassPressure": 0,
  "lowMidAmount": 0,
  "midAmount": 0,
  "highsAmount": 0,
  "airAmount": 0,
  "fluxAmount": 0,
  "vocalPresence": 0,
  "directorIntensity": 0,
  "directorMomentum": 0,
  "buildAmount": 0,
  "directorImpact": 0,
  "variation": 0,
  "beatAccent": 0,
  "kickAccent": 0,
  "snareAccent": 0,
  "downbeatAccent": 0,
  "barAccent": 0,
  "phraseAccent": 0,
  "sectionAccent": 0,
  "dropAccent": 0
},
    parameterBindings: {
      autoPerformance: cinema2Ref(pid("auto-performance")),
      bpmSync: cinema2Ref(pid("bpm-sync")),
      motionSafety: cinema2Ref(pid("motion-safety")),
      flashAccents: cinema2Ref(pid("flash-accents")),
      pattern: cinema2Ref(pid("pattern")),
      patternChange: cinema2Ref(pid("pattern-change")),
      trigger: cinema2Ref(pid("trigger")),
      geometry: cinema2Ref(pid("geometry")),
      cameraMotion: cinema2Ref(pid("camera-motion")),
      perimeterLighting: cinema2Ref(pid("perimeter-lighting")),
      recessedFixtures: cinema2Ref(pid("recessed-fixtures")),
      intensity: cinema2Ref(pid("intensity")),
      reactivity: cinema2Ref(pid("reactivity")),
      motionAmount: cinema2Ref(pid("motion-amount")),
      tunnelWidth: cinema2Ref(pid("tunnel-width")),
      tunnelDepth: cinema2Ref(pid("tunnel-depth")),
      frameThickness: cinema2Ref(pid("frame-thickness")),
      structuralDetail: cinema2Ref(pid("structural-detail")),
      surfaceRoughness: cinema2Ref(pid("surface-roughness")),
      geometryLayers: cinema2Ref(pid("geometry-layers")),
      geometrySize: cinema2Ref(pid("geometry-size")),
      geometryThickness: cinema2Ref(pid("geometry-thickness")),
      morphAmount: cinema2Ref(pid("morph-amount")),
      geometryIntensity: cinema2Ref(pid("geometry-intensity")),
      geometricSeparation: cinema2Ref(pid("geometric-separation")),
      travelSpeed: cinema2Ref(pid("travel-speed")),
      geometryTravel: cinema2Ref(pid("geometry-travel")),
      rotationSpeed: cinema2Ref(pid("rotation-speed")),
      counterRotation: cinema2Ref(pid("counter-rotation")),
      expansionAmount: cinema2Ref(pid("expansion-amount")),
      morphSpeed: cinema2Ref(pid("morph-speed")),
      depthWave: cinema2Ref(pid("depth-wave")),
      cameraRoll: cinema2Ref(pid("camera-roll")),
      perimeterIntensity: cinema2Ref(pid("perimeter-intensity")),
      fixtureIntensity: cinema2Ref(pid("fixture-intensity")),
      fixtureDensity: cinema2Ref(pid("fixture-density")),
      lightingChaseSpeed: cinema2Ref(pid("lighting-chase-speed")),
      lightingContrast: cinema2Ref(pid("lighting-contrast")),
      blackoutDepth: cinema2Ref(pid("blackout-depth")),
      lightSpill: cinema2Ref(pid("light-spill")),
      reflections: cinema2Ref(pid("reflections")),
      depthFalloff: cinema2Ref(pid("depth-falloff")),
      dropStrength: cinema2Ref(pid("drop-strength")),
      metal: cinema2Ref(pid("metal")),
      panel: cinema2Ref(pid("panel")),
      perimeter: cinema2Ref(pid("perimeter")),
      geometryColor: cinema2Ref(pid("geometry-color")),
      accent: cinema2Ref(pid("accent")),
    }
  }],
  scene: Object.freeze({
    nodes: Object.freeze([
      Object.freeze({ id: ROOT_NODE_ID, kind: 'group' as const, coordinateSpace: 'world' as const }),
      Object.freeze({ id: TUNNEL_NODE_ID, kind: 'module' as const, parent: cinema2Ref(ROOT_NODE_ID), module: cinema2Ref(CINEMA2_ALLSTAR_MODULE_ID) }),
    ]),
    roots: Object.freeze([cinema2Ref(ROOT_NODE_ID)]),
  }),
  layers: Object.freeze([
    Object.freeze({ id: WORLD_LAYER_ID, label: 'ALLSTAR Tunnel', source: cinema2Ref(ROOT_NODE_ID), role: 'world', depthPolicy: 'read-write' as const, order: 0 }),
  ]),
  cameras: [{ id: CINEMA2_ALLSTAR_CAMERA_ID, label:'ALLSTAR Camera', projection:'perspective', fovDegrees:65, minAspect:.6, near:.08, far:100,
    transform:{position:vec3(0,0,.4)}, target:vec3(0,0,-60), rig:{kind:'static'},
    motion:{drift:{position:.28,target:.15,rollDegrees:0,fovDegrees:0,speed:.04,seed:8242},tempo:{referenceBpm:120,weave:.16,bob:.12,roll:0,fov:0,punch:0},fovRateLimitDegreesPerSecond:7},
    controls:{motionEnabled:cinema2Ref(pid('camera-motion')),motionAmount:cinema2Ref(pid('camera-sway')),masterMotionAmount:cinema2Ref(pid('motion-amount')),motionSafety:cinema2Ref(pid('motion-safety')),tempoSync:cinema2Ref(pid('bpm-sync')),fovDegrees:cinema2Ref(pid('fov'))},
    smoothingMs:160,safety:{minPosition:vec3(-.3,-.2,-.1),maxPosition:vec3(.3,.2,.8),maxPositionOffset:vec3(.3,.2,.3),maxTargetOffset:vec3(.15,.15,.15),minFovDegrees:47,maxFovDegrees:88,minNear:.08,maxFar:100}}],
  choreography: { rules: [
    moduleContinuousRule("overallEnergy", "audio.features", "audio.features.overallEnergy", "overallEnergy", 200),
    moduleContinuousRule("subAmount", "audio.bands", "audio.bands.sub", "subAmount", 140),
    moduleContinuousRule("bassPressure", "audio.bands", "audio.bands.bass", "bassPressure", 90),
    moduleContinuousRule("lowMidAmount", "audio.bands", "audio.bands.lowMid", "lowMidAmount", 140),
    moduleContinuousRule("midAmount", "audio.bands", "audio.bands.mid", "midAmount", 110),
    moduleContinuousRule("highsAmount", "audio.bands", "audio.bands.high", "highsAmount", 65),
    moduleContinuousRule("airAmount", "audio.bands", "audio.bands.air", "airAmount", 120),
    moduleContinuousRule("fluxAmount", "audio.features", "audio.features.spectralFlux", "fluxAmount", 85),
    moduleContinuousRule("vocalPresence", "music.vocal-presence", "audio.features.vocalPresence", "vocalPresence", 220),
    moduleContinuousRule("directorIntensity", "visual-director.significance", "director.intensity", "directorIntensity", 120),
    moduleContinuousRule("directorMomentum", "visual-director.significance", "director.momentum", "directorMomentum", 95),
    moduleContinuousRule("buildAmount", "visual-director.significance", "director.build", "buildAmount", 140),
    moduleContinuousRule("directorImpact", "visual-director.significance", "director.impact", "directorImpact", 45),
    moduleContinuousRule("variation", "visual-director.significance", "director.variation", "variation", 120),
    moduleEnvelopeRule("beatAccent", "beat", "music.beat", "beatAccent", 0.02, 0.025, 0.18),
    moduleEnvelopeRule("kickAccent", "kick", "music.rhythm-events", "kickAccent", 0.015, 0.04, 0.22),
    moduleEnvelopeRule("snareAccent", "snare", "music.rhythm-events", "snareAccent", 0.015, 0.03, 0.15),
    moduleEnvelopeRule("downbeatAccent", "downbeat", "music.downbeat", "downbeatAccent", 0.025, 0.08, 0.35),
    moduleEnvelopeRule("barAccent", "bar", "music.bar", "barAccent", 0.05, 0.1, 0.4),
    moduleEnvelopeRule("phraseAccent", "phrase", "music.phrase", "phraseAccent", 0.08, 0.2, 0.65),
    moduleEnvelopeRule("sectionAccent", "section-change", "music.section", "sectionAccent", 0.1, 0.1, 0.75),
    moduleEnvelopeRule("dropAccent", "drop", "music.drop", "dropAccent", 0.03, 0.15, 0.9),
    {id:choreographyRuleId('camera-impact'),priority:110,strengthParameter:cinema2Ref(pid('camera-impact')),enabledParameter:cinema2Ref(pid('camera-motion')),source:{signal:'drop',capability:'music.drop'},conditions:[{kind:'once-per-event'}],actions:[{id:choreographyActionId('camera-impact'),target:{kind:'camera',ref:cinema2Ref(CINEMA2_ALLSTAR_CAMERA_ID),property:'fovDegrees'},operation:'envelope',composition:'add',value:-6,envelope:{attack:.04,hold:.08,release:.7,unit:'seconds'},retrigger:'restart'}]},
  ]},
  lighting: Object.freeze({
    lights: Object.freeze([
      Object.freeze({ id: AMBIENT_LIGHT_ID, type: 'ambient' as const, color: color(0.3, 0.32, 0.38), intensity: 0.03 }),
      Object.freeze({ id: HAZE_LIGHT_ID, type: 'point' as const, color: color(.95,.8,1), intensity: 0.14, transform: Object.freeze({ position: vec3(0, 0, -30) }), config: Object.freeze({ range: 38 }) }),
    ]),
  }),
  environment: Object.freeze({
    backgroundColor: color(.023529,.011765,.043137),
    exposure: 1,
    controls: Object.freeze({ backgroundColor: cinema2Ref(pid('background')) }),
  }),
  effects: Object.freeze([
    Object.freeze({
      id: ATMOSPHERE_EFFECT_ID,
      typeId: CINEMA2_VOLUMETRIC_ATMOSPHERE_EFFECT_TYPE_ID,
      version: 1,
      enabled: true,
      order: 0,
      scope: 'output' as const,
      parameters: Object.freeze({
        mix: 1, density: 0.012, beamIntensity: 0.065, mistAmount: 0, mistHeight: 0.5, mistFloor: -4.5, floorY: -4.5, floorReflection: 0,
        anisotropy: 0.4, occlusion: 0.82, ambientHaze: 0.08, noiseScale: 0.34, hazeColor: color(.329412,.086275,.435294), noiseStrength: 0.15, drift: 0.025, maxDistance: 70, reactivity: 0,
      }),
      parameterBindings: Object.freeze({ density: cinema2Ref(pid('atmosphere')), noiseStrength: cinema2Ref(pid('atmospheric-texture')), hazeColor: cinema2Ref(pid('atmosphere-color')) }),
    }),
    Object.freeze({
      id: BLOOM_EFFECT_ID,
      typeId: CINEMA2_HDR_BLOOM_EFFECT_TYPE_ID,
      version: 1,
      enabled: true,
      order: 1,
      scope: 'output' as const,
      parameters: Object.freeze({ mix: 1, threshold: 1.45, knee: 0.35, intensity: 0.45, spread: 0.3, levels: 4, clampMax: 12 }),
      parameterBindings: Object.freeze({ intensity: cinema2Ref(pid('bloom')), spread: cinema2Ref(pid('bloom-spread')) }),
    }),
    Object.freeze({
      id: FINISH_EFFECT_ID,
      typeId: CINEMA2_CINEMATIC_FINISH_EFFECT_TYPE_ID,
      version: 1,
      enabled: true,
      order: 2,
      scope: 'output' as const,
      parameters: Object.freeze({ mix: 1, toneMap: 1, exposure: 0.95, contrast: 1.2, saturation: 1, vignette: 0.25, vignetteSoftness: 0.7, grain: 0.025, aberration: 0.01 }),
      parameterBindings: Object.freeze({ mix: cinema2Ref(pid('finish')), contrast: cinema2Ref(pid('contrast')), saturation: cinema2Ref(pid('saturation')), vignette: cinema2Ref(pid('vignette')) }),
    }),
  ]),
  render: Object.freeze({
    targets: Object.freeze([
      viewportTarget(SCENE_TARGET_ID, true),
      viewportTarget(ATMOSPHERE_TARGET_ID),
      viewportTarget(BLOOM_TARGET_ID),
    ]),
    passes: Object.freeze([
      Object.freeze({
        id: SCENE_PASS_ID,
        kind: 'scene' as const,
        layers: Object.freeze([cinema2Ref(WORLD_LAYER_ID)]),
        outputs: Object.freeze([
          Object.freeze({ id: SCENE_COLOR_ID, target: cinema2Ref(SCENE_TARGET_ID), attachment: 'color' as const }),
          Object.freeze({ id: SCENE_DEPTH_ID, target: cinema2Ref(SCENE_TARGET_ID), attachment: 'depth' as const }),
        ]),
      }),
      effectPass(ATMOSPHERE_PASS_ID, SCENE_PASS_ID, SCENE_COLOR_ID, ATMOSPHERE_EFFECT_ID, 'atmosphere', ATMOSPHERE_TARGET_ID, true),
      effectPass(BLOOM_PASS_ID, ATMOSPHERE_PASS_ID, slotId('atmosphere-output'), BLOOM_EFFECT_ID, 'bloom', BLOOM_TARGET_ID, false),
      effectPass(FINISH_PASS_ID, BLOOM_PASS_ID, slotId('bloom-output'), FINISH_EFFECT_ID, 'finish', null, false),
    ]),
    outputPass: cinema2Ref(FINISH_PASS_ID),
  }),
  output: Object.freeze({ renderPass: cinema2Ref(FINISH_PASS_ID), colorSpace: 'srgb' as const, alphaMode: 'opaque' as const }),
}

const drives: Cinema2MoodDrive[] = [
  {id:'travel-speed-momentum',target:cinema2AutoTargets.module('allstar-system','travelSpeed'),source:'mood.momentum',operation:'multiply',value:1.64},
  {id:'travel-speed-calm',target:cinema2AutoTargets.module('allstar-system','travelSpeed'),source:'mood.calm',operation:'multiply',value:0.64},
  {id:'geometry-travel-activity',target:cinema2AutoTargets.module('allstar-system','geometryTravel'),source:'mood.activity',operation:'multiply',value:1.41},
  {id:'morph-amount-tense',target:cinema2AutoTargets.module('allstar-system','morphAmount'),source:'mood.tense',operation:'multiply',value:1.38},
  {id:'expansion-amount-peak',target:cinema2AutoTargets.module('allstar-system','expansionAmount'),source:'mood.peak',operation:'multiply',value:1.27},
  {id:'depth-wave-build',target:cinema2AutoTargets.module('allstar-system','depthWave'),source:'mood.build',operation:'multiply',value:1.78},
  {id:'perimeter-intensity-peak',target:cinema2AutoTargets.module('allstar-system','perimeterIntensity'),source:'mood.peak',operation:'multiply',value:1.3},
  {id:'perimeter-intensity-calm',target:cinema2AutoTargets.module('allstar-system','perimeterIntensity'),source:'mood.calm',operation:'multiply',value:0.8},
  {id:'fixture-density-complexity',target:cinema2AutoTargets.module('allstar-system','fixtureDensity'),source:'mood.complexity',operation:'add',value:0.2},
  {id:'geometry-intensity-activity',target:cinema2AutoTargets.module('allstar-system','geometryIntensity'),source:'mood.activity',operation:'multiply',value:1.25},
  {id:'lighting-chase-speed-drive',target:cinema2AutoTargets.module('allstar-system','lightingChaseSpeed'),source:'mood.drive',operation:'multiply',value:1.58},
  {id:'light-spill-brightness',target:cinema2AutoTargets.module('allstar-system','lightSpill'),source:'mood.brightness',operation:'multiply',value:1.31},
  {id:'intensity-silence',target:cinema2AutoTargets.module('allstar-system','intensity'),source:'mood.silence',operation:'multiply',value:0.1},
  {id:'geometry-intensity-silence',target:cinema2AutoTargets.module('allstar-system','geometryIntensity'),source:'mood.silence',operation:'multiply',value:0.15},
  {id:'fixture-intensity-silence',target:cinema2AutoTargets.module('allstar-system','fixtureIntensity'),source:'mood.silence',operation:'multiply',value:0.06},
  {id:'bloom-peak',target:cinema2AutoTargets.effect('allstar-bloom','intensity'),source:'mood.peak',operation:'multiply',value:1.44},
  {id:'atmosphere-tense',target:cinema2AutoTargets.effect('allstar-atmosphere','density'),source:'mood.tense',operation:'multiply',value:1.67},
]
export const CINEMA2_ALLSTAR_PRESET_MANIFEST = withCinema2MoodDrives(authored,{idPrefix:'allstar-auto',enabledParameter:pid('auto-performance'),strengthParameter:pid('reactivity'),patternControls:{patternChange:pid('pattern-change'),trigger:pid('trigger')},drives})
