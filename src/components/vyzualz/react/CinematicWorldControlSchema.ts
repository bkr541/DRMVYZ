import {
  CINEMATIC_WORLD_MODES,
  type CinematicAudioTarget,
  type CinematicCameraRig,
  type CinematicWorldConfig,
  type CinematicWorldMode,
} from './CinematicWorldConfig'
import {
  ANCIENT_MACHINE_BOUNDS,
  ANCIENT_MACHINE_DEFAULTS,
  CELESTIAL_CATHEDRAL_BOUNDS,
  CELESTIAL_CATHEDRAL_DEFAULTS,
  EVENT_HORIZON_BOUNDS,
  EVENT_HORIZON_DEFAULTS,
  FRACTURE_RIFT_BOUNDS,
  FRACTURE_RIFT_DEFAULTS,
  INFINITE_CORRIDOR_BOUNDS,
  INFINITE_CORRIDOR_DEFAULTS,
  LIQUID_MEMBRANE_BOUNDS,
  LIQUID_MEMBRANE_DEFAULTS,
  MIRROR_DIMENSION_BOUNDS,
  MIRROR_DIMENSION_DEFAULTS,
  MONOLITH_GATE_BOUNDS,
  MONOLITH_GATE_DEFAULTS,
  REACTIVE_CONSTELLATION_BOUNDS,
  STORM_GATEWAY_BOUNDS,
  STORM_GATEWAY_DEFAULTS,
  createDefaultCinematicWorldSettings,
  normalizeCinematicWorldSettings,
  type CinematicWorldSettingsByMode,
  type CinematicWorldSpecificConfig,
  type NumericBounds,
} from './CinematicWorldSettings'

export type CinematicWorldCategory = 'Cosmic' | 'Architectural' | 'Organic' | 'Mechanical' | 'Storm' | 'Media' | 'Legacy'
export type CinematicWorldControlVisibility = 'all' | 'simple' | 'advanced'

type SettingKey<Mode extends CinematicWorldMode> = Extract<keyof CinematicWorldSettingsByMode[Mode], string>
type NumericSettingKey<Mode extends CinematicWorldMode> = {
  [Key in SettingKey<Mode>]: CinematicWorldSettingsByMode[Mode][Key] extends number ? Key : never
}[SettingKey<Mode>]
type BooleanSettingKey<Mode extends CinematicWorldMode> = {
  [Key in SettingKey<Mode>]: CinematicWorldSettingsByMode[Mode][Key] extends boolean ? Key : never
}[SettingKey<Mode>]
type SelectSettingKey<Mode extends CinematicWorldMode> = {
  [Key in SettingKey<Mode>]: CinematicWorldSettingsByMode[Mode][Key] extends string | number ? Key : never
}[SettingKey<Mode>]

type SelectValue<Mode extends CinematicWorldMode, Key extends SelectSettingKey<Mode>> =
  Extract<CinematicWorldSettingsByMode[Mode][Key], string | number>

interface CinematicWorldControlBase<Key extends string> {
  id: string
  setting: Key
  label: string
  description?: string
  visibility?: CinematicWorldControlVisibility
}

export type CinematicWorldSliderControl<Mode extends CinematicWorldMode> = {
  [Key in NumericSettingKey<Mode>]: CinematicWorldControlBase<Key> & {
    kind: 'slider'
    min: number
    max: number
    step: number
  }
}[NumericSettingKey<Mode>]

export type CinematicWorldIntegerControl<Mode extends CinematicWorldMode> = {
  [Key in NumericSettingKey<Mode>]: CinematicWorldControlBase<Key> & {
    kind: 'integer'
    min: number
    max: number
    step: number
  }
}[NumericSettingKey<Mode>]

export type CinematicWorldSelectControl<Mode extends CinematicWorldMode> = {
  [Key in SelectSettingKey<Mode>]: CinematicWorldControlBase<Key> & {
    kind: 'select'
    options: readonly {
      value: SelectValue<Mode, Key>
      label: string
      disabled?: boolean
    }[]
  }
}[SelectSettingKey<Mode>]

export type CinematicWorldToggleControl<Mode extends CinematicWorldMode> = {
  [Key in BooleanSettingKey<Mode>]: CinematicWorldControlBase<Key> & {
    kind: 'toggle'
  }
}[BooleanSettingKey<Mode>]

export type CinematicWorldControlDefinition<Mode extends CinematicWorldMode> =
  | CinematicWorldSliderControl<Mode>
  | CinematicWorldIntegerControl<Mode>
  | CinematicWorldSelectControl<Mode>
  | CinematicWorldToggleControl<Mode>

export interface CinematicWorldControlGroup<Mode extends CinematicWorldMode> {
  id: string
  label: string
  description?: string
  visibility?: CinematicWorldControlVisibility
  controls: readonly CinematicWorldControlDefinition<Mode>[]
}

export interface CinematicWorldControlSchema<Mode extends CinematicWorldMode> {
  mode: Mode
  groups: readonly CinematicWorldControlGroup<Mode>[]
}

export interface CinematicWorldCatalogEntry<Mode extends CinematicWorldMode> {
  id: Mode
  label: string
  description: string
  category: CinematicWorldCategory
  cameraRigs: readonly CinematicCameraRig[]
  modulationTargets: readonly CinematicAudioTarget[]
  rendererModulationTargets?: readonly CinematicAudioTarget[]
  supportsPortalShape: boolean
  controls: CinematicWorldControlSchema<Mode>
}

export type AnyCinematicWorldControlDefinition =
  | (CinematicWorldControlBase<string> & { kind: 'slider' | 'integer'; min: number; max: number; step: number })
  | (CinematicWorldControlBase<string> & { kind: 'select'; options: readonly { value: string | number; label: string; disabled?: boolean }[] })
  | (CinematicWorldControlBase<string> & { kind: 'toggle' })

export interface AnyCinematicWorldControlGroup {
  id: string
  label: string
  description?: string
  visibility?: CinematicWorldControlVisibility
  controls: readonly AnyCinematicWorldControlDefinition[]
}

export interface AnyCinematicWorldControlSchema {
  mode: CinematicWorldMode
  groups: readonly AnyCinematicWorldControlGroup[]
}

export type CinematicWorldCatalog = {
  [Mode in CinematicWorldMode]: CinematicWorldCatalogEntry<Mode>
}

export type AnyCinematicWorldCatalogEntry = {
  [Mode in CinematicWorldMode]: CinematicWorldCatalogEntry<Mode>
}[CinematicWorldMode]

const SAFE_CONTROL_ID = /^[A-Za-z][A-Za-z0-9_-]*$/

export function isAccessibilitySafeCinematicControlId(id: string): boolean {
  return SAFE_CONTROL_ID.test(id)
}

export function humanizeCinematicSettingKey(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/^./, value => value.toUpperCase())
}

function getStep(min: number, max: number): number {
  if (Number.isInteger(min) && Number.isInteger(max) && max - min <= 20) return 1
  if (max - min <= 0.5) return 0.005
  if (max - min <= 3) return 0.01
  return 0.1
}

function createNumericControlSchema<Mode extends CinematicWorldMode>(input: {
  mode: Mode
  groupLabel: string
  defaults: CinematicWorldSettingsByMode[Mode]
  bounds: NumericBounds<CinematicWorldSettingsByMode[Mode]>
  integerKeys?: readonly NumericSettingKey<Mode>[]
}): CinematicWorldControlSchema<Mode> {
  const integers = new Set<string>(input.integerKeys ?? [])
  const controls = (Object.keys(input.bounds) as NumericSettingKey<Mode>[]).map((setting) => {
    const [min, max] = input.bounds[setting] as readonly [number, number]
    return {
      kind: integers.has(setting) ? 'integer' : 'slider',
      id: `cinematic-world-setting-${setting}`,
      setting,
      label: humanizeCinematicSettingKey(setting),
      min,
      max,
      step: getStep(min, max),
      visibility: 'advanced',
    } as CinematicWorldControlDefinition<Mode>
  })
  return {
    mode: input.mode,
    groups: [{
      id: `${input.mode}-world-controls`,
      label: input.groupLabel,
      visibility: 'advanced',
      controls,
    }],
  }
}

const EMPTY_SCHEMA = <Mode extends 'legacyPortal'>(mode: Mode): CinematicWorldControlSchema<Mode> => ({ mode, groups: [] })

const EVENT_HORIZON_CONTROLS = createNumericControlSchema({
  mode: 'eventHorizon', groupLabel: 'Event Horizon Controls', defaults: EVENT_HORIZON_DEFAULTS, bounds: EVENT_HORIZON_BOUNDS,
  integerKeys: ['depthLayers'],
})
const INFINITE_CORRIDOR_CONTROLS = createNumericControlSchema({
  mode: 'infiniteCorridor', groupLabel: 'Infinite Corridor Controls', defaults: INFINITE_CORRIDOR_DEFAULTS, bounds: INFINITE_CORRIDOR_BOUNDS,
  integerKeys: ['structureStyle'],
})
const FRACTURE_RIFT_CONTROLS = createNumericControlSchema({
  mode: 'fractureRift', groupLabel: 'Fracture Rift Controls', defaults: FRACTURE_RIFT_DEFAULTS, bounds: FRACTURE_RIFT_BOUNDS,
  integerKeys: ['openingShape', 'innerSurface'],
})
const MONOLITH_GATE_CONTROLS = createNumericControlSchema({
  mode: 'monolithGate', groupLabel: 'Monolith Gate Controls', defaults: MONOLITH_GATE_DEFAULTS, bounds: MONOLITH_GATE_BOUNDS,
  integerKeys: ['columnCount', 'ringCount', 'architectureStyle'],
})
const LIQUID_MEMBRANE_CONTROLS = createNumericControlSchema({
  mode: 'liquidMembrane', groupLabel: 'Liquid Membrane Controls', defaults: LIQUID_MEMBRANE_DEFAULTS, bounds: LIQUID_MEMBRANE_BOUNDS,
  integerKeys: ['rippleDensity', 'surfaceDetail'],
})
const CELESTIAL_CATHEDRAL_CONTROLS = createNumericControlSchema({
  mode: 'celestialCathedral', groupLabel: 'Celestial Cathedral Controls', defaults: CELESTIAL_CATHEDRAL_DEFAULTS, bounds: CELESTIAL_CATHEDRAL_BOUNDS,
  integerKeys: ['archCount', 'pillarCount', 'architectureStyle'],
})
const MIRROR_DIMENSION_CONTROLS = createNumericControlSchema({
  mode: 'mirrorDimension', groupLabel: 'Mirror Dimension Controls', defaults: MIRROR_DIMENSION_DEFAULTS, bounds: MIRROR_DIMENSION_BOUNDS,
  integerKeys: ['symmetryCount', 'recursionDepth', 'structureStyle'],
})
const ANCIENT_MACHINE_CONTROLS = createNumericControlSchema({
  mode: 'ancientMachine', groupLabel: 'Ancient Machine Controls', defaults: ANCIENT_MACHINE_DEFAULTS, bounds: ANCIENT_MACHINE_BOUNDS,
  integerKeys: ['ringCount', 'gearCount', 'progressionMode'],
})
const STORM_GATEWAY_CONTROLS = createNumericControlSchema({
  mode: 'stormGateway', groupLabel: 'Storm Gateway Controls', defaults: STORM_GATEWAY_DEFAULTS, bounds: STORM_GATEWAY_BOUNDS,
  integerKeys: ['cloudLayers'],
})

const REACTIVE_CONSTELLATION_CONTROLS = {
  mode: 'reactiveConstellation',
  groups: [
    {
      id: 'reactive-constellation-composition',
      label: 'Constellation Composition',
      visibility: 'all',
      controls: [
        { kind: 'integer', id: 'constellation-node-count', setting: 'nodeCount', label: 'Node Count', min: REACTIVE_CONSTELLATION_BOUNDS.nodeCount[0], max: REACTIVE_CONSTELLATION_BOUNDS.nodeCount[1], step: 1, visibility: 'all' },
        {
          kind: 'select', id: 'constellation-topology-style', setting: 'topologyStyle', label: 'Topology Style', visibility: 'all',
          options: [
            { value: 'cluster', label: 'Cluster' },
            { value: 'chain', label: 'Chain' },
            { value: 'triangulated', label: 'Triangulated' },
            { value: 'starburst', label: 'Starburst' },
            { value: 'branching', label: 'Branching' },
            { value: 'ring', label: 'Ring' },
            { value: 'splitClusters', label: 'Split Clusters' },
          ],
        },
        {
          kind: 'select', id: 'constellation-polyhedron-style', setting: 'polyhedronStyle', label: 'Polyhedron Style', visibility: 'all',
          options: [
            { value: 'tetrahedron', label: 'Tetrahedron' },
            { value: 'octahedron', label: 'Octahedron' },
            { value: 'icosahedron', label: 'Icosahedron' },
            { value: 'irregularCrystal', label: 'Irregular Crystal' },
            { value: 'mixed', label: 'Mixed Facets' },
          ],
        },
        { kind: 'slider', id: 'constellation-network-spread', setting: 'networkSpread', label: 'Network Spread', min: REACTIVE_CONSTELLATION_BOUNDS.networkSpread[0], max: REACTIVE_CONSTELLATION_BOUNDS.networkSpread[1], step: 0.01, visibility: 'all' },
        { kind: 'slider', id: 'constellation-node-scale', setting: 'nodeScale', label: 'Node Scale', min: REACTIVE_CONSTELLATION_BOUNDS.nodeScale[0], max: REACTIVE_CONSTELLATION_BOUNDS.nodeScale[1], step: 0.005, visibility: 'all' },
      ],
    },
    {
      id: 'reactive-constellation-structure',
      label: 'Network Structure',
      visibility: 'advanced',
      controls: [
        { kind: 'slider', id: 'constellation-depth-spread', setting: 'depthSpread', label: 'Depth Spread', min: REACTIVE_CONSTELLATION_BOUNDS.depthSpread[0], max: REACTIVE_CONSTELLATION_BOUNDS.depthSpread[1], step: 0.01 },
        { kind: 'integer', id: 'constellation-neighbor-count', setting: 'neighborCount', label: 'Neighbor Count', description: 'Changes graph connectivity, node orientation, and connected-node prominence.', min: REACTIVE_CONSTELLATION_BOUNDS.neighborCount[0], max: REACTIVE_CONSTELLATION_BOUNDS.neighborCount[1], step: 1 },
        { kind: 'slider', id: 'constellation-scale-variation', setting: 'nodeScaleVariation', label: 'Scale Variation', min: REACTIVE_CONSTELLATION_BOUNDS.nodeScaleVariation[0], max: REACTIVE_CONSTELLATION_BOUNDS.nodeScaleVariation[1], step: 0.01 },
        { kind: 'slider', id: 'constellation-central-gravity', setting: 'centralGravity', label: 'Central Gravity', min: REACTIVE_CONSTELLATION_BOUNDS.centralGravity[0], max: REACTIVE_CONSTELLATION_BOUNDS.centralGravity[1], step: 0.01 },
      ],
    },
    {
      id: 'reactive-constellation-motion',
      label: 'Elastic Motion',
      visibility: 'advanced',
      controls: [
        { kind: 'slider', id: 'constellation-spring-strength', setting: 'springStrength', label: 'Spring Strength', description: 'Controls how strongly connected nodes pull back toward their graph rest lengths.', min: REACTIVE_CONSTELLATION_BOUNDS.springStrength[0], max: REACTIVE_CONSTELLATION_BOUNDS.springStrength[1], step: 0.01 },
        { kind: 'slider', id: 'constellation-damping', setting: 'damping', label: 'Damping', description: 'Reduces oscillation and settles the network after impacts.', min: REACTIVE_CONSTELLATION_BOUNDS.damping[0], max: REACTIVE_CONSTELLATION_BOUNDS.damping[1], step: 0.01 },
        { kind: 'slider', id: 'constellation-elasticity', setting: 'elasticity', label: 'Elasticity', description: 'Increases overshoot, displacement, and scale stretch without removing safety clamps.', min: REACTIVE_CONSTELLATION_BOUNDS.elasticity[0], max: REACTIVE_CONSTELLATION_BOUNDS.elasticity[1], step: 0.01 },
        { kind: 'slider', id: 'constellation-topology-stability', setting: 'topologyStability', label: 'Topology Stability', description: 'Controls anchor resistance while preserving the selected graph structure.', min: REACTIVE_CONSTELLATION_BOUNDS.topologyStability[0], max: REACTIVE_CONSTELLATION_BOUNDS.topologyStability[1], step: 0.01 },
        { kind: 'slider', id: 'constellation-drift-amount', setting: 'driftAmount', label: 'Seeded Drift', min: REACTIVE_CONSTELLATION_BOUNDS.driftAmount[0], max: REACTIVE_CONSTELLATION_BOUNDS.driftAmount[1], step: 0.01 },
        { kind: 'slider', id: 'constellation-turbulence', setting: 'turbulence', label: 'Turbulence', min: REACTIVE_CONSTELLATION_BOUNDS.turbulence[0], max: REACTIVE_CONSTELLATION_BOUNDS.turbulence[1], step: 0.01 },
        { kind: 'slider', id: 'constellation-orbit-amount', setting: 'orbitAmount', label: 'Node Orbit Force', min: REACTIVE_CONSTELLATION_BOUNDS.orbitAmount[0], max: REACTIVE_CONSTELLATION_BOUNDS.orbitAmount[1], step: 0.01 },
      ],
    },
    {
      id: 'reactive-constellation-impulses',
      label: 'Collapse & Recovery',
      visibility: 'advanced',
      controls: [
        { kind: 'slider', id: 'constellation-collapse-amount', setting: 'collapseAmount', label: 'Collapse Amount', description: 'Adds a bounded inward force that the spring network must resist and recover from.', min: REACTIVE_CONSTELLATION_BOUNDS.collapseAmount[0], max: REACTIVE_CONSTELLATION_BOUNDS.collapseAmount[1], step: 0.01 },
        { kind: 'slider', id: 'constellation-burst-strength', setting: 'burstStrength', label: 'Burst Strength', description: 'Scales radial response to the existing impact modulation signal.', min: REACTIVE_CONSTELLATION_BOUNDS.burstStrength[0], max: REACTIVE_CONSTELLATION_BOUNDS.burstStrength[1], step: 0.01 },
        { kind: 'integer', id: 'constellation-reseed-bars', setting: 'reseedEveryBars', label: 'Reseed Every Bars', description: 'Zero disables musical reseeding. Other values rebuild deterministically at matching bar boundaries.', min: REACTIVE_CONSTELLATION_BOUNDS.reseedEveryBars[0], max: REACTIVE_CONSTELLATION_BOUNDS.reseedEveryBars[1], step: 1 },
      ],
    },
    {
      id: 'reactive-constellation-surface',
      label: 'Faceted Surface',
      visibility: 'advanced',
      controls: [
        { kind: 'slider', id: 'constellation-face-opacity', setting: 'faceOpacity', label: 'Face Opacity', min: REACTIVE_CONSTELLATION_BOUNDS.faceOpacity[0], max: REACTIVE_CONSTELLATION_BOUNDS.faceOpacity[1], step: 0.01 },
        { kind: 'slider', id: 'constellation-rim-intensity', setting: 'rimIntensity', label: 'Rim Intensity', min: REACTIVE_CONSTELLATION_BOUNDS.rimIntensity[0], max: REACTIVE_CONSTELLATION_BOUNDS.rimIntensity[1], step: 0.01 },
        { kind: 'slider', id: 'constellation-wireframe-amount', setting: 'wireframeAmount', label: 'Wireframe Amount', min: REACTIVE_CONSTELLATION_BOUNDS.wireframeAmount[0], max: REACTIVE_CONSTELLATION_BOUNDS.wireframeAmount[1], step: 0.01 },
        { kind: 'slider', id: 'constellation-node-spin', setting: 'nodeSpin', label: 'Node Spin', min: REACTIVE_CONSTELLATION_BOUNDS.nodeSpin[0], max: REACTIVE_CONSTELLATION_BOUNDS.nodeSpin[1], step: 0.01 },
        { kind: 'slider', id: 'constellation-camera-orbit', setting: 'cameraOrbit', label: 'World Orbit', description: 'Adds a model-space orbit while retaining the shared Cinematic camera frame.', min: REACTIVE_CONSTELLATION_BOUNDS.cameraOrbit[0], max: REACTIVE_CONSTELLATION_BOUNDS.cameraOrbit[1], step: 0.01 },
      ],
    },
  ],
} as const satisfies CinematicWorldControlSchema<'reactiveConstellation'>

const MEDIA_PORTAL_CONTROLS = {
  mode: 'mediaPortal',
  groups: [
    {
      id: 'media-portal-playback',
      label: 'Media',
      visibility: 'all',
      controls: [
        {
          kind: 'select', id: 'cinematic-media-fit', setting: 'fit', label: 'Source Fitting', description: 'Controls how the selected artwork fills the portal surface.', visibility: 'all',
          options: [
            { value: 'contain', label: 'Contain' },
            { value: 'cover', label: 'Cover' },
            { value: 'stretch', label: 'Stretch' },
            { value: 'centerCrop', label: 'Center Crop' },
          ],
        },
        { kind: 'toggle', id: 'cinematic-media-loop', setting: 'loop', label: 'Loop Video', visibility: 'all' },
      ],
    },
    {
      id: 'media-portal-effects',
      label: 'Media Effects',
      visibility: 'advanced',
      controls: [
        { kind: 'slider', id: 'cinematic-media-zoom', setting: 'zoom', label: 'Zoom', min: 0.25, max: 4, step: 0.01 },
        { kind: 'slider', id: 'cinematic-media-pan-x', setting: 'panX', label: 'Pan X', min: -1, max: 1, step: 0.01 },
        { kind: 'slider', id: 'cinematic-media-pan-y', setting: 'panY', label: 'Pan Y', min: -1, max: 1, step: 0.01 },
        { kind: 'slider', id: 'cinematic-media-rotation', setting: 'rotation', label: 'Rotation', min: -3.14, max: 3.14, step: 0.01 },
        { kind: 'toggle', id: 'cinematic-media-mirror-x', setting: 'mirrorX', label: 'Mirror Horizontally' },
        { kind: 'toggle', id: 'cinematic-media-mirror-y', setting: 'mirrorY', label: 'Mirror Vertically' },
        {
          kind: 'select', id: 'cinematic-media-mask-mode', setting: 'maskMode', label: 'Mask Interpretation',
          options: [{ value: 'alpha', label: 'Alpha' }, { value: 'luminance', label: 'Luminance' }],
        },
        { kind: 'slider', id: 'cinematic-media-displacement', setting: 'displacement', label: 'Displacement', min: 0, max: 1, step: 0.01 },
        { kind: 'slider', id: 'cinematic-media-scanlines', setting: 'scanlines', label: 'Scanlines', min: 0, max: 1, step: 0.01 },
        { kind: 'slider', id: 'cinematic-media-edgeGlow', setting: 'edgeGlow', label: 'Edge Glow', min: 0, max: 1.5, step: 0.01 },
        { kind: 'slider', id: 'cinematic-media-ripple', setting: 'ripple', label: 'Ripple', min: 0, max: 1, step: 0.01 },
        { kind: 'slider', id: 'cinematic-media-pixelation', setting: 'pixelation', label: 'Pixelation', min: 0, max: 1, step: 0.01 },
        { kind: 'slider', id: 'cinematic-media-revealAmount', setting: 'revealAmount', label: 'Reveal Amount', min: 0, max: 1, step: 0.01 },
        { kind: 'slider', id: 'cinematic-media-beatFlash', setting: 'beatFlash', label: 'Beat Flash', min: 0, max: 1, step: 0.01 },
        { kind: 'slider', id: 'cinematic-media-bassWarping', setting: 'bassWarping', label: 'Bass Warping', min: 0, max: 1, step: 0.01 },
      ],
    },
  ],
} as const satisfies CinematicWorldControlSchema<'mediaPortal'>

const COMMON_TARGETS = ['portalAperture', 'depth', 'cameraPunch', 'environmentBrightness', 'bloom', 'impact'] as const

export const CINEMATIC_WORLD_CATALOG: CinematicWorldCatalog = {
  eventHorizon: { id: 'eventHorizon', label: 'Event Horizon', category: 'Cosmic', description: 'Black-hole core, accretion light and gravitational shockwaves.', cameraRigs: ['locked', 'orbit', 'autoDirector'], modulationTargets: ['portalAperture', 'depth', 'lensing', 'distortion', 'geometryRotation', 'bloom', 'chromaticAberration', 'environmentBrightness', 'feedback', 'impact'], supportsPortalShape: true, controls: EVENT_HORIZON_CONTROLS },
  infiniteCorridor: { id: 'infiniteCorridor', label: 'Infinite Corridor', category: 'Architectural', description: 'Repeating structures and forward travel through real perspective depth.', cameraRigs: ['dolly', 'flyThrough', 'handheld', 'autoDirector'], modulationTargets: ['depth', 'cameraPunch', 'cameraTravel', 'fogDensity', 'environmentBrightness', 'bloom', 'impact'], supportsPortalShape: false, controls: INFINITE_CORRIDOR_CONTROLS },
  fractureRift: { id: 'fractureRift', label: 'Fracture Rift', category: 'Organic', description: 'A dimensional tear with shards, cracks and a living opening.', cameraRigs: ['locked', 'orbit', 'handheld', 'autoDirector'], modulationTargets: ['portalAperture', 'depth', 'fractureAmount', 'particleEmission', 'distortion', 'refraction', 'chromaticAberration', 'environmentBrightness', 'impact'], supportsPortalShape: true, controls: FRACTURE_RIFT_CONTROLS },
  monolithGate: { id: 'monolithGate', label: 'Monolith Gate', category: 'Architectural', description: 'Massive stone geometry, glyphs and a ceremonial gateway.', cameraRigs: ['locked', 'dolly', 'orbit', 'autoDirector'], modulationTargets: COMMON_TARGETS, rendererModulationTargets: ['portalAperture', 'depth', 'cameraPunch', 'cameraTravel', 'fogDensity', 'environmentBrightness', 'bloom', 'impact'], supportsPortalShape: true, controls: MONOLITH_GATE_CONTROLS },
  liquidMembrane: { id: 'liquidMembrane', label: 'Liquid Membrane', category: 'Organic', description: 'Elastic fluid surface with ripples, tearing and refraction.', cameraRigs: ['locked', 'orbit', 'handheld', 'autoDirector'], modulationTargets: ['portalAperture', 'distortion', 'refraction', 'environmentBrightness', 'feedback', 'bloom', 'chromaticAberration', 'impact'], supportsPortalShape: true, controls: LIQUID_MEMBRANE_CONTROLS },
  celestialCathedral: { id: 'celestialCathedral', label: 'Celestial Cathedral', category: 'Architectural', description: 'Cosmic arches, pillars, stars and deep light shafts.', cameraRigs: ['locked', 'dolly', 'flyThrough', 'autoDirector'], modulationTargets: ['depth', 'cameraTravel', 'fogDensity', 'particleEmission', 'environmentBrightness', 'bloom', 'impact'], supportsPortalShape: false, controls: CELESTIAL_CATHEDRAL_CONTROLS },
  mirrorDimension: { id: 'mirrorDimension', label: 'Mirror Dimension', category: 'Cosmic', description: 'Symmetrical mirrored chambers with controlled recursive depth.', cameraRigs: ['locked', 'orbit', 'autoDirector'], modulationTargets: ['depth', 'geometryRotation', 'feedback', 'distortion', 'chromaticAberration', 'environmentBrightness', 'bloom', 'impact'], supportsPortalShape: false, controls: MIRROR_DIMENSION_CONTROLS },
  ancientMachine: { id: 'ancientMachine', label: 'Ancient Machine', category: 'Mechanical', description: 'Interlocking rings, gears, glyphs and a mechanical unlock sequence.', cameraRigs: ['locked', 'dolly', 'orbit', 'autoDirector'], modulationTargets: ['portalAperture', 'depth', 'geometryRotation', 'cameraPunch', 'cameraTravel', 'environmentBrightness', 'bloom', 'impact'], supportsPortalShape: true, controls: ANCIENT_MACHINE_CONTROLS },
  reactiveConstellation: { id: 'reactiveConstellation', label: 'Reactive Constellation', category: 'Cosmic', description: 'A true 3D network of independently transformed faceted crystal nodes.', cameraRigs: ['locked', 'dolly', 'orbit', 'handheld', 'autoDirector'], modulationTargets: ['depth', 'geometryRotation', 'environmentBrightness', 'bloom', 'impact'], supportsPortalShape: false, controls: REACTIVE_CONSTELLATION_CONTROLS },
  stormGateway: { id: 'stormGateway', label: 'Storm Gateway', category: 'Storm', description: 'Cloud vortex, debris, turbulence and branching lightning.', cameraRigs: ['locked', 'orbit', 'handheld', 'autoDirector'], modulationTargets: ['portalAperture', 'depth', 'cameraPunch', 'fogDensity', 'particleEmission', 'lightning', 'environmentBrightness', 'distortion', 'bloom', 'chromaticAberration', 'impact'], supportsPortalShape: true, controls: STORM_GATEWAY_CONTROLS },
  mediaPortal: { id: 'mediaPortal', label: 'Media Portal', category: 'Media', description: 'Places images, video, logos or SVG artwork inside a reactive gateway.', cameraRigs: ['locked', 'dolly', 'orbit', 'autoDirector'], modulationTargets: ['portalAperture', 'distortion', 'refraction', 'bloom', 'chromaticAberration', 'feedback', 'impact'], supportsPortalShape: true, controls: MEDIA_PORTAL_CONTROLS },
  legacyPortal: { id: 'legacyPortal', label: 'Legacy Portal', category: 'Legacy', description: 'Compatibility renderer for projects created before Cinematic Worlds.', cameraRigs: ['locked'], modulationTargets: ['portalAperture', 'cameraPunch', 'fogDensity', 'particleEmission', 'environmentBrightness', 'impact', 'fog', 'debris', 'atmosphere', 'glow', 'cameraMotion', 'portalPulse'], rendererModulationTargets: ['portalAperture', 'cameraPunch', 'fogDensity', 'particleEmission', 'environmentBrightness', 'impact'], supportsPortalShape: true, controls: EMPTY_SCHEMA('legacyPortal') },
}

export const CINEMATIC_WORLD_CATALOG_LIST: readonly AnyCinematicWorldCatalogEntry[] = [
  CINEMATIC_WORLD_CATALOG.eventHorizon,
  CINEMATIC_WORLD_CATALOG.infiniteCorridor,
  CINEMATIC_WORLD_CATALOG.fractureRift,
  CINEMATIC_WORLD_CATALOG.monolithGate,
  CINEMATIC_WORLD_CATALOG.liquidMembrane,
  CINEMATIC_WORLD_CATALOG.celestialCathedral,
  CINEMATIC_WORLD_CATALOG.mirrorDimension,
  CINEMATIC_WORLD_CATALOG.ancientMachine,
  CINEMATIC_WORLD_CATALOG.stormGateway,
  CINEMATIC_WORLD_CATALOG.reactiveConstellation,
  CINEMATIC_WORLD_CATALOG.mediaPortal,
  CINEMATIC_WORLD_CATALOG.legacyPortal,
]

function controlVisibilityMatches(
  visibility: CinematicWorldControlVisibility | undefined,
  uiMode: 'simple' | 'advanced',
): boolean {
  return visibility === undefined || visibility === 'all' || visibility === uiMode
}

export function getVisibleCinematicWorldControlGroups(
  schema: AnyCinematicWorldControlSchema,
  uiMode: 'simple' | 'advanced',
): readonly AnyCinematicWorldControlGroup[] {
  return schema.groups
    .filter(group => controlVisibilityMatches(group.visibility, uiMode))
    .map(group => ({
      ...group,
      controls: group.controls.filter(control => controlVisibilityMatches(control.visibility, uiMode)),
    }))
    .filter(group => group.controls.length > 0)
}

function settingsRecord(settings: object): Record<string, unknown> {
  return settings as Record<string, unknown>
}

export function readCinematicWorldSetting(
  config: CinematicWorldConfig,
  setting: string,
): unknown {
  const worldSettings = config.worldSettings.mode === config.worldMode
    ? config.worldSettings
    : createDefaultCinematicWorldSettings(config.worldMode)
  return settingsRecord(worldSettings.settings)[setting]
}

function normalizeControlValue(
  control: AnyCinematicWorldControlDefinition,
  value: unknown,
  fallback: unknown,
): unknown {
  switch (control.kind) {
    case 'slider': {
      const numeric = typeof value === 'number' && Number.isFinite(value) ? value : fallback
      const safe = typeof numeric === 'number' && Number.isFinite(numeric) ? numeric : control.min
      return Math.min(control.max, Math.max(control.min, safe))
    }
    case 'integer': {
      const numeric = typeof value === 'number' && Number.isFinite(value) ? value : fallback
      const safe = typeof numeric === 'number' && Number.isFinite(numeric) ? numeric : control.min
      return Math.round(Math.min(control.max, Math.max(control.min, safe)))
    }
    case 'select': {
      if (control.options.some(option => Object.is(option.value, value))) return value
      if (control.options.some(option => Object.is(option.value, fallback))) return fallback
      return control.options[0]?.value
    }
    case 'toggle':
      return typeof value === 'boolean' ? value : typeof fallback === 'boolean' ? fallback : false
  }
}

export function updateCinematicWorldSettings<Mode extends CinematicWorldMode>(
  worldSettings: Extract<CinematicWorldSpecificConfig, { mode: Mode }>,
  control: CinematicWorldControlDefinition<Mode>,
  value: unknown,
): Extract<CinematicWorldSpecificConfig, { mode: Mode }> {
  const source = settingsRecord(worldSettings.settings)
  const normalizedValue = normalizeControlValue(
    control as AnyCinematicWorldControlDefinition,
    value,
    source[control.setting],
  )
  return normalizeCinematicWorldSettings(worldSettings.mode, {
    ...source,
    [control.setting]: normalizedValue,
  }) as Extract<CinematicWorldSpecificConfig, { mode: Mode }>
}

export function updateCinematicWorldConfigSetting(
  config: CinematicWorldConfig,
  schema: AnyCinematicWorldControlSchema,
  control: AnyCinematicWorldControlDefinition,
  value: unknown,
): CinematicWorldConfig {
  const worldSettings = config.worldMode === schema.mode && config.worldSettings.mode === schema.mode
    ? config.worldSettings
    : createDefaultCinematicWorldSettings(schema.mode)
  const source = settingsRecord(worldSettings.settings)
  const normalizedValue = normalizeControlValue(control, value, source[control.setting])
  return {
    ...config,
    worldMode: schema.mode,
    worldSettings: normalizeCinematicWorldSettings(schema.mode, {
      ...source,
      [control.setting]: normalizedValue,
    }),
  }
}

export function validateCinematicWorldControlSchema(
  schema: AnyCinematicWorldControlSchema,
): string[] {
  const errors: string[] = []
  const ids = new Set<string>()
  const defaults = settingsRecord(createDefaultCinematicWorldSettings(schema.mode).settings)

  const checkId = (id: string, kind: string) => {
    if (!isAccessibilitySafeCinematicControlId(id)) errors.push(`${kind} id "${id}" is not accessibility-safe`)
    if (ids.has(id)) errors.push(`Duplicate control schema id "${id}"`)
    ids.add(id)
  }

  for (const group of schema.groups) {
    checkId(group.id, 'Group')
    if (!group.label.trim()) errors.push(`Group "${group.id}" is missing a label`)
    for (const control of group.controls) {
      checkId(control.id, 'Control')
      if (!control.label.trim()) errors.push(`Control "${control.id}" is missing a label`)
      if (!(control.setting in defaults)) errors.push(`Control "${control.id}" references unknown setting "${control.setting}"`)
      const fallback = defaults[control.setting]
      if (control.kind === 'slider' || control.kind === 'integer') {
        if (typeof fallback !== 'number') errors.push(`Control "${control.id}" requires a numeric default`)
        if (![control.min, control.max, control.step].every(Number.isFinite) || control.min > control.max || control.step <= 0) {
          errors.push(`Control "${control.id}" has invalid numeric metadata`)
        }
        if (control.kind === 'integer' && !Number.isInteger(fallback)) errors.push(`Control "${control.id}" requires an integer default`)
      } else if (control.kind === 'select') {
        if (control.options.length === 0) errors.push(`Control "${control.id}" requires at least one option`)
        if (new Set(control.options.map(option => String(option.value))).size !== control.options.length) {
          errors.push(`Control "${control.id}" has ambiguous serialized option values`)
        }
        if (!control.options.some(option => Object.is(option.value, fallback))) errors.push(`Control "${control.id}" options do not include the default value`)
      } else if (typeof fallback !== 'boolean') {
        errors.push(`Control "${control.id}" requires a boolean default`)
      }
    }
  }
  return errors
}

for (const mode of CINEMATIC_WORLD_MODES) {
  const errors = validateCinematicWorldControlSchema(CINEMATIC_WORLD_CATALOG[mode].controls)
  if (errors.length > 0) throw new Error(`Invalid cinematic world control schema for ${mode}: ${errors.join('; ')}`)
}
