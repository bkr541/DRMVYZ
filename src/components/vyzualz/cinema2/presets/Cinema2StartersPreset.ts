import { CINEMA2_NATIVE_PRESET_SCHEMA_ID, CINEMA2_NATIVE_PRESET_SCHEMA_VERSION, cinema2NamespacedId, cinema2Ref, cinema2StableId, type Cinema2ChoreographyActionId, type Cinema2ChoreographyRuleId, type Cinema2Color, type Cinema2LayerId, type Cinema2ModuleId, type Cinema2NativePresetManifest, type Cinema2ParameterId, type Cinema2PresetId, type Cinema2RenderPassId, type Cinema2SceneNodeId } from '../contracts/Cinema2NativePresetManifest'
import { CINEMA2_STARTERS_NATIVE_MODULE_TYPE_ID } from '../modules/Cinema2StartersNativeModule'

export const CINEMA2_STARTERS_PRESET_ID = cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.starters')
export const CINEMA2_STARTERS_MODULE_ID = cinema2StableId<Cinema2ModuleId>('starters-scene')
const pid = (name: string) => cinema2StableId<Cinema2ParameterId>(`starters-${name}`)
export const CINEMA2_STARTERS_PARAMETER_IDS = Object.freeze({
  intensity: pid('intensity'), reactivity: pid('reactivity'), autoPerformance: pid('auto-performance'), bpmSync: pid('bpm-sync'),
  caseOpen: pid('case-open'), ballSpread: pid('ball-spread'), ballScale: pid('ball-scale'), ballWiggle: pid('ball-wiggle'), ballRotation: pid('ball-rotation'), cameraMotion: pid('camera-motion'), cameraOrbit: pid('camera-orbit'), cameraPan: pid('camera-pan'), cameraSpeed: pid('camera-speed'), centerLight: pid('center-light'), grassDensity: pid('grass-density'), ambientMotion: pid('ambient-motion'),
  glow: pid('glow'), vignette: pid('vignette'), background: pid('background'), grass: pid('grass'), leather: pid('leather'), ballRed: pid('ball-red'), ballWhite: pid('ball-white'), metal: pid('metal'),
})
const P = CINEMA2_STARTERS_PARAMETER_IDS
const ROOT = cinema2StableId<Cinema2SceneNodeId>('starters-root'), NODE = cinema2StableId<Cinema2SceneNodeId>('starters-node'), LAYER = cinema2StableId<Cinema2LayerId>('starters-layer'), PASS = cinema2StableId<Cinema2RenderPassId>('starters-pass')
const color = (r: number, g: number, b: number): Cinema2Color => Object.freeze([r, g, b, 1])
const BACKGROUND = color(0.005, 0.06, 0.025), GRASS = color(0.02, 0.64, 0.18), LEATHER = color(0.68, 0.29, 0.055), RED = color(0.9, 0.055, 0.12), WHITE = color(0.92, 0.94, 0.9), METAL = color(0.58, 0.62, 0.6)
const base = Object.freeze({ section: 'Design', exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const, modulatable: true, choreographable: true, automatable: false })
const float = (id: Cinema2ParameterId, label: string, description: string, defaultValue: number, min: number, max: number, step: number, parent: 'master-controls' | 'design' | 'effects', group: string, order: number) => Object.freeze({ ...base, id, label, description, type: 'float' as const, defaultValue, min, max, step, designParentGroup: parent, group, order })
const palette = (id: Cinema2ParameterId, label: string, value: Cinema2Color, order: number) => Object.freeze({ ...base, id, label, description: `Controls the ${label.toLowerCase()} role.`, type: 'color' as const, defaultValue: value, designParentGroup: 'palette' as const, group: 'Starters Palette', order })
const ruleId = (name: string) => cinema2StableId<Cinema2ChoreographyRuleId>(`starters-${name}-rule`)
const actionId = (name: string) => cinema2StableId<Cinema2ChoreographyActionId>(`starters-${name}-action`)
const continuous = (name: string, property: string) => Object.freeze({ id: actionId(name), target: Object.freeze({ kind: 'module' as const, ref: cinema2Ref(CINEMA2_STARTERS_MODULE_ID), property }), operation: 'replace' as const, value: 1 })
const envelope = (name: string, property: string, release: number) => Object.freeze({ id: actionId(name), target: Object.freeze({ kind: 'module' as const, ref: cinema2Ref(CINEMA2_STARTERS_MODULE_ID), property }), operation: 'envelope' as const, value: 1, composition: 'replace' as const, envelope: Object.freeze({ attack: 0.015, hold: 0.035, release, unit: 'seconds' as const }), retrigger: 'restart' as const })

export const CINEMA2_STARTERS_PRESET_MANIFEST: Readonly<Cinema2NativePresetManifest> = Object.freeze({
  schemaId: CINEMA2_NATIVE_PRESET_SCHEMA_ID, schemaVersion: CINEMA2_NATIVE_PRESET_SCHEMA_VERSION, id: CINEMA2_STARTERS_PRESET_ID, revision: 1,
  metadata: Object.freeze({ name: 'Starters', description: 'A procedural field case and three capture balls that rock, rotate, flash, and recoil with shared Audio Intelligence.', tags: Object.freeze(['keeper', 'procedural', 'meadow', 'starter', 'audio-reactive']) }),
  capabilities: Object.freeze([
    Object.freeze({ id: 'render.webgl2' as const, requirement: 'required' as const, purpose: 'Procedurally draws the complete Starters scene.' }),
    Object.freeze({ id: 'audio.features' as const, requirement: 'optional' as const, purpose: 'Shared energy shapes light and material response.' }),
    Object.freeze({ id: 'audio.bands' as const, requirement: 'optional' as const, purpose: 'Shared bass and high bands shape bounce and highlights.' }),
    Object.freeze({ id: 'music.rhythm-events' as const, requirement: 'optional' as const, purpose: 'Shared kick and snare events accent physical details.' }),
    Object.freeze({ id: 'music.drop' as const, requirement: 'optional' as const, purpose: 'Shared drop events create a bounded hero accent.' }),
    Object.freeze({ id: 'visual-director.significance' as const, requirement: 'optional' as const, purpose: 'The Visual Director build signal opens the case toward a reveal.' }),
  ]),
  parameters: Object.freeze([
    float(P.intensity, 'Master Intensity', 'Scales the finished scene without changing its composition.', 1, 0, 2, 0.01, 'master-controls', 'Playback', 1),
    float(P.reactivity, 'Music Reactivity', 'Scales all shared Audio Intelligence choreography.', 0.8, 0, 1, 0.01, 'master-controls', 'Playback', 2),
    Object.freeze({ ...base, id: P.autoPerformance, label: 'Auto Performance', description: 'Authorizes bounded additive audio choreography while preserving authored controls.', type: 'boolean' as const, defaultValue: true, designParentGroup: 'master-controls' as const, group: 'Playback', order: 3 }),
    Object.freeze({ ...base, id: P.bpmSync, label: 'BPM Sync', description: 'On follows the shared analyzed beat grid; off uses a 120 BPM free-running motion clock.', type: 'boolean' as const, defaultValue: true, designParentGroup: 'master-controls' as const, group: 'Playback', order: 4 }),
    float(P.caseOpen, 'Case Open', 'Sets the resting lid presentation; zero preserves the approved closed-case composition.', 0, 0, 1, 0.01, 'design', 'Hero Geometry', 1),
    float(P.ballSpread, 'Ball Spread', 'Sets the horizontal spacing of the foreground balls.', 1, 0.55, 1.6, 0.01, 'design', 'Hero Geometry', 2),
    float(P.ballScale, 'Ball Scale', 'Sets the foreground ball size.', 1, 0.6, 1.5, 0.01, 'design', 'Hero Geometry', 3),
    float(P.ballWiggle, 'Ball Wiggle', 'Sets the beat-synced rocking response driven by energy, bass, kicks, snares, and high-frequency detail.', 0.8, 0, 1.5, 0.01, 'design', 'Motion', 4),
    float(P.ballRotation, 'Ball Rotation', 'Sets the tempo-synced counter-rotation and drop turn of the three capture balls.', 0.65, 0, 1.5, 0.01, 'design', 'Motion', 5),
    float(P.grassDensity, 'Grass Density', 'Sets the amount of foreground meadow texture.', 0.72, 0, 1, 0.01, 'design', 'Environment', 6),
    float(P.ambientMotion, 'Ambient Motion', 'Sets the tempo-aware resting hover and subtle forest sway. Zero is a hard stop.', 0.45, 0, 1, 0.01, 'design', 'Motion', 7),
    float(P.cameraMotion, 'Camera Motion', 'Master amount for the front-facing orbit and pan; zero locks the approved camera.', 0.55, 0, 1, 0.01, 'design', 'Camera', 8),
    float(P.cameraOrbit, 'Camera Orbit', 'Sets the bounded horizontal rotation and subtle rise around the front of the balls.', 0.7, 0, 1, 0.01, 'design', 'Camera', 9),
    float(P.cameraPan, 'Camera Pan', 'Sets the lateral pan across the foreground ball arrangement.', 0.55, 0, 1, 0.01, 'design', 'Camera', 10),
    float(P.cameraSpeed, 'Camera Speed', 'Sets the tempo-relative speed of the camera movement.', 0.4, 0, 1, 0.01, 'design', 'Camera', 11),
    float(P.centerLight, 'Center Light', 'Sets the release-button flash driven by kicks, snares, highs, energy, and drops.', 0.85, 0, 2, 0.01, 'effects', 'Finish', 1),
    float(P.glow, 'Capture Glow', 'Sets the restrained aura and center-light spill around the capture balls.', 0.38, 0, 1.5, 0.01, 'effects', 'Finish', 2),
    float(P.vignette, 'Vignette', 'Frames the central case and ball composition.', 0.35, 0, 1, 0.01, 'effects', 'Finish', 3),
    palette(P.background, 'Forest Background', BACKGROUND, 1), palette(P.grass, 'Grass', GRASS, 2), palette(P.leather, 'Leather', LEATHER, 3), palette(P.ballRed, 'Ball Red', RED, 4), palette(P.ballWhite, 'Ball White', WHITE, 5), palette(P.metal, 'Metal', METAL, 6),
  ]),
  modules: Object.freeze([Object.freeze({
    id: CINEMA2_STARTERS_MODULE_ID, typeId: CINEMA2_STARTERS_NATIVE_MODULE_TYPE_ID, version: 1, enabled: true,
    parameters: Object.freeze({ intensity: 1, bpmSync: true, caseOpen: 0, ballSpread: 1, ballScale: 1, ballWiggle: 0.8, ballRotation: 0.65, cameraMotion: 0.55, cameraOrbit: 0.7, cameraPan: 0.55, cameraSpeed: 0.4, centerLight: 0.85, grassDensity: 0.72, ambientMotion: 0.45, glow: 0.38, vignette: 0.35, backgroundColor: BACKGROUND, grassColor: GRASS, leatherColor: LEATHER, ballRedColor: RED, ballWhiteColor: WHITE, metalColor: METAL, overallEnergy: 0, bassPressure: 0, kickAccent: 0, snareAccent: 0, buildAmount: 0, dropAccent: 0, highsAmount: 0 }),
    parameterBindings: Object.freeze({ intensity: cinema2Ref(P.intensity), bpmSync: cinema2Ref(P.bpmSync), caseOpen: cinema2Ref(P.caseOpen), ballSpread: cinema2Ref(P.ballSpread), ballScale: cinema2Ref(P.ballScale), ballWiggle: cinema2Ref(P.ballWiggle), ballRotation: cinema2Ref(P.ballRotation), cameraMotion: cinema2Ref(P.cameraMotion), cameraOrbit: cinema2Ref(P.cameraOrbit), cameraPan: cinema2Ref(P.cameraPan), cameraSpeed: cinema2Ref(P.cameraSpeed), centerLight: cinema2Ref(P.centerLight), grassDensity: cinema2Ref(P.grassDensity), ambientMotion: cinema2Ref(P.ambientMotion), glow: cinema2Ref(P.glow), vignette: cinema2Ref(P.vignette), backgroundColor: cinema2Ref(P.background), grassColor: cinema2Ref(P.grass), leatherColor: cinema2Ref(P.leather), ballRedColor: cinema2Ref(P.ballRed), ballWhiteColor: cinema2Ref(P.ballWhite), metalColor: cinema2Ref(P.metal) }),
  })]),
  scene: Object.freeze({ nodes: Object.freeze([Object.freeze({ id: ROOT, kind: 'group' as const, coordinateSpace: 'normalized-screen' as const, visible: true }), Object.freeze({ id: NODE, kind: 'module' as const, parent: cinema2Ref(ROOT), module: cinema2Ref(CINEMA2_STARTERS_MODULE_ID), visible: true })]), roots: Object.freeze([cinema2Ref(ROOT)]) }),
  layers: Object.freeze([Object.freeze({ id: LAYER, label: 'Starters Scene', source: cinema2Ref(ROOT), visible: true, opacity: 1, blendMode: 'normal' as const, depthPolicy: 'disabled' as const, order: 0 })]),
  choreography: Object.freeze({ tempoSyncParameter: cinema2Ref(P.bpmSync), rules: Object.freeze([
    Object.freeze({ id: ruleId('energy'), priority: 10, enabledParameter: cinema2Ref(P.autoPerformance), strengthParameter: cinema2Ref(P.reactivity), source: Object.freeze({ signal: 'continuous' as const, capability: 'audio.features' as const, path: 'audio.features.overallEnergy' as const, smoothingMs: 150 }), actions: Object.freeze([continuous('energy', 'overallEnergy')]) }),
    Object.freeze({ id: ruleId('bass'), priority: 11, enabledParameter: cinema2Ref(P.autoPerformance), strengthParameter: cinema2Ref(P.reactivity), source: Object.freeze({ signal: 'continuous' as const, capability: 'audio.bands' as const, path: 'audio.bands.bass' as const, smoothingMs: 100 }), actions: Object.freeze([continuous('bass', 'bassPressure')]) }),
    Object.freeze({ id: ruleId('highs'), priority: 12, enabledParameter: cinema2Ref(P.autoPerformance), strengthParameter: cinema2Ref(P.reactivity), source: Object.freeze({ signal: 'continuous' as const, capability: 'audio.bands' as const, path: 'audio.bands.high' as const, smoothingMs: 85 }), actions: Object.freeze([continuous('highs', 'highsAmount')]) }),
    Object.freeze({ id: ruleId('kick'), priority: 20, enabledParameter: cinema2Ref(P.autoPerformance), strengthParameter: cinema2Ref(P.reactivity), source: Object.freeze({ signal: 'kick' as const, capability: 'music.rhythm-events' as const }), conditions: Object.freeze([Object.freeze({ kind: 'once-per-event' as const })]), actions: Object.freeze([envelope('kick', 'kickAccent', 0.24)]) }),
    Object.freeze({ id: ruleId('snare'), priority: 21, enabledParameter: cinema2Ref(P.autoPerformance), strengthParameter: cinema2Ref(P.reactivity), source: Object.freeze({ signal: 'snare' as const, capability: 'music.rhythm-events' as const }), conditions: Object.freeze([Object.freeze({ kind: 'once-per-event' as const })]), actions: Object.freeze([envelope('snare', 'snareAccent', 0.3)]) }),
    Object.freeze({ id: ruleId('build'), priority: 30, enabledParameter: cinema2Ref(P.autoPerformance), strengthParameter: cinema2Ref(P.reactivity), source: Object.freeze({ signal: 'continuous' as const, capability: 'visual-director.significance' as const, path: 'director.build' as const, smoothingMs: 170 }), actions: Object.freeze([continuous('build', 'buildAmount')]) }),
    Object.freeze({ id: ruleId('drop'), priority: 40, enabledParameter: cinema2Ref(P.autoPerformance), strengthParameter: cinema2Ref(P.reactivity), source: Object.freeze({ signal: 'drop' as const, capability: 'music.drop' as const }), conditions: Object.freeze([Object.freeze({ kind: 'once-per-event' as const })]), actions: Object.freeze([envelope('drop', 'dropAccent', 1.1)]) }),
  ]) }),
  render: Object.freeze({ passes: Object.freeze([Object.freeze({ id: PASS, kind: 'scene' as const, layers: Object.freeze([cinema2Ref(LAYER)]) })]), outputPass: cinema2Ref(PASS) }),
  output: Object.freeze({ renderPass: cinema2Ref(PASS), colorSpace: 'srgb' as const, alphaMode: 'opaque' as const }),
})
