import {
  CINEMA2_NATIVE_PRESET_SCHEMA_ID,
  CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  cinema2NamespacedId,
  cinema2Ref,
  cinema2StableId,
  type Cinema2LayerId,
  type Cinema2ModuleId,
  type Cinema2NativePresetManifest,
  type Cinema2ParameterId,
  type Cinema2PresetId,
  type Cinema2SceneNodeId,
} from '../contracts/Cinema2NativePresetManifest'
import { CINEMA2_ELECTRIC_STORM_NATIVE_MODULE_TYPE_ID } from '../modules/Cinema2ElectricStormNativeModule'

export const CINEMA2_ELECTRIC_STORM_PRESET_ID = cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.electric-storm')
export const CINEMA2_ELECTRIC_STORM_LIGHTNING_COLOR_ID = cinema2StableId<Cinema2ParameterId>('electric-storm-lightning-color')
export const CINEMA2_ELECTRIC_STORM_MASTER_INTENSITY_ID = cinema2StableId<Cinema2ParameterId>('electric-storm-master-intensity')
export const CINEMA2_ELECTRIC_STORM_STRIKE_RATE_ID = cinema2StableId<Cinema2ParameterId>('electric-storm-strike-rate')
export const CINEMA2_ELECTRIC_STORM_BRANCHING_ID = cinema2StableId<Cinema2ParameterId>('electric-storm-branching')
export const CINEMA2_ELECTRIC_STORM_THICKNESS_ID = cinema2StableId<Cinema2ParameterId>('electric-storm-thickness')
export const CINEMA2_ELECTRIC_STORM_GLOW_ID = cinema2StableId<Cinema2ParameterId>('electric-storm-glow')
export const CINEMA2_ELECTRIC_STORM_BACKGROUND_ID = cinema2StableId<Cinema2ParameterId>('electric-storm-background')
export const CINEMA2_ELECTRIC_STORM_HAZE_ID = cinema2StableId<Cinema2ParameterId>('electric-storm-haze')

export const CINEMA2_ELECTRIC_STORM_MODULE_ID = cinema2StableId<Cinema2ModuleId>('electric-storm-procedural-lightning')
const ELECTRIC_STORM_ROOT_NODE_ID = cinema2StableId<Cinema2SceneNodeId>('electric-storm-root')
const ELECTRIC_STORM_MODULE_NODE_ID = cinema2StableId<Cinema2SceneNodeId>('electric-storm-module-node')
const ELECTRIC_STORM_LAYER_ID = cinema2StableId<Cinema2LayerId>('electric-storm-layer')

/** Stage 14A intentionally authors only visual/design state. Shared musical
 * direction, event mappings, and user-facing React controls arrive in 14B. */
export const CINEMA2_ELECTRIC_STORM_PRESET_MANIFEST: Readonly<Cinema2NativePresetManifest> = Object.freeze({
  schemaId: CINEMA2_NATIVE_PRESET_SCHEMA_ID,
  schemaVersion: CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  id: CINEMA2_ELECTRIC_STORM_PRESET_ID,
  revision: 1,
  metadata: Object.freeze({
    name: 'Electric Storm 2.0',
    description: 'Native Cinema 2.0 procedural lightning with deterministic strike topology and shared atmosphere ownership.',
    tags: Object.freeze(['electric-storm', 'native', 'procedural-lightning']),
  }),
  capabilities: Object.freeze([
    Object.freeze({ id: 'render.webgl2' as const, requirement: 'required' as const, purpose: 'Procedural fullscreen lightning rendering.' }),
  ]),
  parameters: Object.freeze([
    Object.freeze({
      id: CINEMA2_ELECTRIC_STORM_LIGHTNING_COLOR_ID,
      label: 'Lightning Color',
      type: 'color' as const,
      defaultValue: Object.freeze([0.29, 0.65, 1, 1] as const),
      section: 'Design', group: 'Lightning', order: 10,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_ELECTRIC_STORM_MASTER_INTENSITY_ID,
      label: 'Master Intensity',
      type: 'float' as const, defaultValue: 0.82, min: 0, max: 1.5, step: 0.01,
      section: 'Design', group: 'Lightning', order: 11,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_ELECTRIC_STORM_STRIKE_RATE_ID,
      label: 'Strike Rate',
      type: 'float' as const, defaultValue: 0.58, min: 0, max: 1, step: 0.01,
      section: 'Design', group: 'Lightning', order: 12,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_ELECTRIC_STORM_BRANCHING_ID,
      label: 'Branching',
      type: 'float' as const, defaultValue: 0.68, min: 0, max: 1, step: 0.01,
      section: 'Design', group: 'Lightning', order: 13,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_ELECTRIC_STORM_THICKNESS_ID,
      label: 'Thickness',
      type: 'float' as const, defaultValue: 0.52, min: 0, max: 1, step: 0.01,
      section: 'Design', group: 'Lightning', order: 14,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_ELECTRIC_STORM_GLOW_ID,
      label: 'Glow',
      type: 'float' as const, defaultValue: 0.72, min: 0, max: 1, step: 0.01,
      section: 'Design', group: 'Lightning', order: 15,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_ELECTRIC_STORM_BACKGROUND_ID,
      label: 'Background',
      type: 'color' as const,
      defaultValue: Object.freeze([0.004, 0.007, 0.014, 1] as const),
      section: 'Design', group: 'Atmosphere', order: 20,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
    Object.freeze({
      id: CINEMA2_ELECTRIC_STORM_HAZE_ID,
      label: 'Haze',
      type: 'float' as const, defaultValue: 0.08, min: 0, max: 0.35, step: 0.005,
      section: 'Design', group: 'Atmosphere', order: 21,
      exposure: 'primary' as const, persistence: 'preset' as const, reset: 'authored-default' as const,
    }),
  ]),
  modules: Object.freeze([Object.freeze({
    id: CINEMA2_ELECTRIC_STORM_MODULE_ID,
    typeId: CINEMA2_ELECTRIC_STORM_NATIVE_MODULE_TYPE_ID,
    version: 1,
    enabled: true,
    parameters: Object.freeze({
      lightningColor: Object.freeze([0.29, 0.65, 1, 1] as const),
      masterIntensity: 0.82,
      strikeRate: 0.58,
      branching: 0.68,
      thickness: 0.52,
      glow: 0.72,
      impactShake: 0.42,
      zoomPunch: 0.28,
    }),
    parameterBindings: Object.freeze({
      lightningColor: cinema2Ref(CINEMA2_ELECTRIC_STORM_LIGHTNING_COLOR_ID),
      masterIntensity: cinema2Ref(CINEMA2_ELECTRIC_STORM_MASTER_INTENSITY_ID),
      strikeRate: cinema2Ref(CINEMA2_ELECTRIC_STORM_STRIKE_RATE_ID),
      branching: cinema2Ref(CINEMA2_ELECTRIC_STORM_BRANCHING_ID),
      thickness: cinema2Ref(CINEMA2_ELECTRIC_STORM_THICKNESS_ID),
      glow: cinema2Ref(CINEMA2_ELECTRIC_STORM_GLOW_ID),
    }),
  })]),
  scene: Object.freeze({
    nodes: Object.freeze([
      Object.freeze({ id: ELECTRIC_STORM_ROOT_NODE_ID, kind: 'group' as const, coordinateSpace: 'normalized-screen' as const, visible: true }),
      Object.freeze({ id: ELECTRIC_STORM_MODULE_NODE_ID, kind: 'module' as const, parent: cinema2Ref(ELECTRIC_STORM_ROOT_NODE_ID), module: cinema2Ref(CINEMA2_ELECTRIC_STORM_MODULE_ID), visible: true }),
    ]),
  }),
  layers: Object.freeze([Object.freeze({
    id: ELECTRIC_STORM_LAYER_ID,
    label: 'Electric Storm',
    source: cinema2Ref(ELECTRIC_STORM_ROOT_NODE_ID),
    visible: true,
    opacity: 1,
    blendMode: 'normal' as const,
    depthPolicy: 'disabled' as const,
    order: 0,
  })]),
  environment: Object.freeze({
    backgroundColor: Object.freeze([0.004, 0.007, 0.014, 1] as const),
    exposure: 1,
    fog: Object.freeze({
      mode: 'exponential' as const,
      color: Object.freeze([0.045, 0.09, 0.16, 1] as const),
      density: 0.08,
      near: 0,
      far: 100,
    }),
    controls: Object.freeze({
      backgroundColor: cinema2Ref(CINEMA2_ELECTRIC_STORM_BACKGROUND_ID),
      fogDensity: cinema2Ref(CINEMA2_ELECTRIC_STORM_HAZE_ID),
    }),
  }),
})
