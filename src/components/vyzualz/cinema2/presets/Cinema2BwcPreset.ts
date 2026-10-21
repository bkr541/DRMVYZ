import { CINEMA2_NATIVE_PRESET_SCHEMA_ID, CINEMA2_NATIVE_PRESET_SCHEMA_VERSION, cinema2NamespacedId, cinema2Ref, cinema2StableId, type Cinema2Color, type Cinema2LayerId, type Cinema2ModuleId, type Cinema2NativePresetManifest, type Cinema2ParameterId, type Cinema2PresetId, type Cinema2RenderPassId, type Cinema2SceneNodeId } from '../contracts/Cinema2NativePresetManifest'
import { CINEMA2_BWC_NATIVE_MODULE_TYPE_ID } from '../modules/Cinema2BwcNativeModule'

export const CINEMA2_BWC_PRESET_ID = cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.bwc')
export const CINEMA2_BWC_MODULE_ID = cinema2StableId<Cinema2ModuleId>('bwc-scene')
const pid = (name: string) => cinema2StableId<Cinema2ParameterId>(`bwc-${name}`)
export const CINEMA2_BWC_PARAMETER_IDS = Object.freeze({
  intensity: pid('intensity'), bpmSync: pid('bpm-sync'), conveyorSpeed: pid('conveyor-speed'), portalScale: pid('portal-scale'), canScale: pid('can-scale'), conveyorWidth: pid('conveyor-width'), ledStrength: pid('led-strength'),
  background: pid('background'), structure: pid('structure'), canWhite: pid('can-white'), energy: pid('energy'), darkMetal: pid('dark-metal'),
})
const P = CINEMA2_BWC_PARAMETER_IDS
const ROOT = cinema2StableId<Cinema2SceneNodeId>('bwc-root'), NODE = cinema2StableId<Cinema2SceneNodeId>('bwc-node'), LAYER = cinema2StableId<Cinema2LayerId>('bwc-layer'), PASS = cinema2StableId<Cinema2RenderPassId>('bwc-pass')
const color = (r: number, g: number, b: number): Cinema2Color => Object.freeze([r, g, b, 1])
const BACKGROUND = color(0.035, 0.055, 0.058), STRUCTURE = color(0.52, 0.59, 0.62), CAN_WHITE = color(0.86, 0.88, 0.86), ENERGY = color(0.28, 0.62, 0.18), DARK_METAL = color(0.018, 0.028, 0.032)
const base = Object.freeze({ section: 'Design', exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const, modulatable: false, choreographable: false, automatable: false })
const float = (id: Cinema2ParameterId, label: string, description: string, defaultValue: number, min: number, max: number, step: number, parent: 'master-controls' | 'design', group: string, order: number) => Object.freeze({ ...base, id, label, description, type: 'float' as const, defaultValue, min, max, step, designParentGroup: parent, group, order })
const toggle = (id: Cinema2ParameterId, label: string, description: string, defaultValue: boolean, parent: 'master-controls' | 'design', group: string, order: number) => Object.freeze({ ...base, id, label, description, type: 'boolean' as const, defaultValue, designParentGroup: parent, group, order })
const palette = (id: Cinema2ParameterId, label: string, value: Cinema2Color, order: number) => Object.freeze({ ...base, id, label, description: `Controls the static ${label.toLowerCase()} material.`, type: 'color' as const, defaultValue: value, designParentGroup: 'palette' as const, group: 'BWC Palette', order })

export const CINEMA2_BWC_PRESET_MANIFEST: Readonly<Cinema2NativePresetManifest> = Object.freeze({
  schemaId: CINEMA2_NATIVE_PRESET_SCHEMA_ID, schemaVersion: CINEMA2_NATIVE_PRESET_SCHEMA_VERSION, id: CINEMA2_BWC_PRESET_ID, revision: 3,
  metadata: Object.freeze({ name: 'BWC', description: 'A dim industrial canning corridor converging on a green-energy reactor portal.', tags: Object.freeze(['keeper', 'procedural', 'industrial', 'factory', 'portal', 'static']) }),
  capabilities: Object.freeze([
    Object.freeze({ id: 'render.webgl2' as const, requirement: 'required' as const, purpose: 'Procedurally draws the BWC factory scene and its production line.' }),
    Object.freeze({ id: 'audio.transport' as const, requirement: 'optional' as const, purpose: 'Play, pause, seek and track changes drive and reset the production line.' }),
    Object.freeze({ id: 'music.beat' as const, requirement: 'optional' as const, purpose: 'The analyzed tempo sets the line speed when BPM Sync is on; a 120 BPM clock is the fallback.' }),
  ]),
  parameters: Object.freeze([
    float(P.intensity, 'Master Intensity', 'Sets the overall brightness of the static scene.', 1.1, 0, 2, 0.01, 'master-controls', 'Presentation', 1),
    toggle(P.bpmSync, 'BPM Sync', 'Locks the production line to the music: with it on the line advances one slot every two beats at the analyzed (or Audio Dock) tempo, and needs the Audio Dock Sync on as well. With it off the line free-runs at the 120 BPM rate.', true, 'master-controls', 'Conveyor', 2),
    float(P.conveyorSpeed, 'Conveyor Speed', 'Scales how fast the production line moves, with or without BPM Sync. 1 is one slot every two beats at the reference tempo; 0 stops the line.', 1, 0, 2, 0.01, 'master-controls', 'Conveyor', 3),
    float(P.portalScale, 'Portal Scale', 'Sets the size of the circular production portal.', 1, 0.7, 1.35, 0.01, 'design', 'Portal', 1),
    float(P.ledStrength, 'LED Strength', 'Sets the authored brightness of the static portal and conduit LEDs.', 0.85, 0, 1.5, 0.01, 'design', 'Portal', 2),
    float(P.canScale, 'Can Scale', 'Sets the size of the white cans on the conveyor.', 1, 0.7, 1.35, 0.01, 'design', 'Assembly Line', 3),
    float(P.conveyorWidth, 'Conveyor Width', 'Sets the width of the production conveyor and guide rails.', 1, 0.75, 1.35, 0.01, 'design', 'Assembly Line', 4),
    palette(P.background, 'Factory Background', BACKGROUND, 1), palette(P.structure, 'Machine Structure', STRUCTURE, 2), palette(P.canWhite, 'Can White', CAN_WHITE, 3), palette(P.energy, 'Energy Green', ENERGY, 4), palette(P.darkMetal, 'Dark Metal', DARK_METAL, 5),
  ]),
  modules: Object.freeze([Object.freeze({
    id: CINEMA2_BWC_MODULE_ID, typeId: CINEMA2_BWC_NATIVE_MODULE_TYPE_ID, version: 1, enabled: true,
    parameters: Object.freeze({ intensity: 1.1, bpmSync: true, conveyorSpeed: 1, portalScale: 1, canScale: 1, conveyorWidth: 1, ledStrength: 0.85, backgroundColor: BACKGROUND, structureColor: STRUCTURE, canWhiteColor: CAN_WHITE, energyColor: ENERGY, darkMetalColor: DARK_METAL }),
    parameterBindings: Object.freeze({ intensity: cinema2Ref(P.intensity), bpmSync: cinema2Ref(P.bpmSync), conveyorSpeed: cinema2Ref(P.conveyorSpeed), portalScale: cinema2Ref(P.portalScale), canScale: cinema2Ref(P.canScale), conveyorWidth: cinema2Ref(P.conveyorWidth), ledStrength: cinema2Ref(P.ledStrength), backgroundColor: cinema2Ref(P.background), structureColor: cinema2Ref(P.structure), canWhiteColor: cinema2Ref(P.canWhite), energyColor: cinema2Ref(P.energy), darkMetalColor: cinema2Ref(P.darkMetal) }),
  })]),
  scene: Object.freeze({ nodes: Object.freeze([Object.freeze({ id: ROOT, kind: 'group' as const, coordinateSpace: 'normalized-screen' as const, visible: true }), Object.freeze({ id: NODE, kind: 'module' as const, parent: cinema2Ref(ROOT), module: cinema2Ref(CINEMA2_BWC_MODULE_ID), visible: true })]), roots: Object.freeze([cinema2Ref(ROOT)]) }),
  layers: Object.freeze([Object.freeze({ id: LAYER, label: 'BWC Factory', source: cinema2Ref(ROOT), visible: true, opacity: 1, blendMode: 'normal' as const, depthPolicy: 'disabled' as const, order: 0 })]),
  render: Object.freeze({ passes: Object.freeze([Object.freeze({ id: PASS, kind: 'scene' as const, layers: Object.freeze([cinema2Ref(LAYER)]) })]), outputPass: cinema2Ref(PASS) }),
  output: Object.freeze({ renderPass: cinema2Ref(PASS), colorSpace: 'srgb' as const, alphaMode: 'opaque' as const }),
})
