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
  ELECTRIC_STORM_BOUNDS,
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

export type CinematicWorldCategory = 'Cosmic' | 'Architectural' | 'Organic' | 'Mechanical' | 'Storm' | 'Legacy'
export type CinematicWorldControlVisibility = 'all' | 'simple' | 'advanced'

type SettingKey<Mode extends CinematicWorldMode> = Extract<keyof CinematicWorldSettingsByMode[Mode], string>
type NumericSettingKey<Mode extends CinematicWorldMode> = {
  [Key in SettingKey<Mode>]: CinematicWorldSettingsByMode[Mode][Key] extends number ? Key : never
}[SettingKey<Mode>]
type BooleanSettingKey<Mode extends CinematicWorldMode> = {
  [Key in SettingKey<Mode>]: CinematicWorldSettingsByMode[Mode][Key] extends boolean ? Key : never
}[SettingKey<Mode>]
type ColorSettingKey<Mode extends CinematicWorldMode> = {
  [Key in SettingKey<Mode>]: CinematicWorldSettingsByMode[Mode][Key] extends string ? Key : never
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

export type CinematicWorldColorControl<Mode extends CinematicWorldMode> = {
  [Key in ColorSettingKey<Mode>]: CinematicWorldControlBase<Key> & {
    kind: 'color'
  }
}[ColorSettingKey<Mode>]

export type CinematicWorldControlDefinition<Mode extends CinematicWorldMode> =
  | CinematicWorldSliderControl<Mode>
  | CinematicWorldIntegerControl<Mode>
  | CinematicWorldSelectControl<Mode>
  | CinematicWorldToggleControl<Mode>
  | CinematicWorldColorControl<Mode>

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
  | (CinematicWorldControlBase<string> & { kind: 'color' })
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

const EMPTY_SCHEMA = <Mode extends CinematicWorldMode>(mode: Mode): CinematicWorldControlSchema<Mode> => ({ mode, groups: [] })

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

const ELECTRIC_STORM_CONTROLS = {
  mode: 'electricStorm',
  groups: [{
    id: 'electric-storm-design-controls',
    label: 'Electric Storm Controls',
    visibility: 'all',
    controls: [
      { kind: 'color', id: 'electric-storm-background-color', setting: 'backgroundColor', label: 'Background Color', visibility: 'all' },
      { kind: 'color', id: 'electric-storm-lightning-color', setting: 'lightningColor', label: 'Lightning Color', visibility: 'all' },
      { kind: 'slider', id: 'electric-storm-master-intensity', setting: 'masterIntensity', label: 'Master Intensity', min: ELECTRIC_STORM_BOUNDS.masterIntensity[0], max: ELECTRIC_STORM_BOUNDS.masterIntensity[1], step: 0.01, visibility: 'all' },
      { kind: 'slider', id: 'electric-storm-strike-rate', setting: 'strikeRate', label: 'Strike Rate', min: ELECTRIC_STORM_BOUNDS.strikeRate[0], max: ELECTRIC_STORM_BOUNDS.strikeRate[1], step: 0.01, visibility: 'all' },
      { kind: 'slider', id: 'electric-storm-branching', setting: 'branching', label: 'Branching', min: ELECTRIC_STORM_BOUNDS.branching[0], max: ELECTRIC_STORM_BOUNDS.branching[1], step: 0.01, visibility: 'all' },
      { kind: 'slider', id: 'electric-storm-thickness', setting: 'thickness', label: 'Thickness', min: ELECTRIC_STORM_BOUNDS.thickness[0], max: ELECTRIC_STORM_BOUNDS.thickness[1], step: 0.01, visibility: 'all' },
      { kind: 'slider', id: 'electric-storm-glow', setting: 'glow', label: 'Glow', min: ELECTRIC_STORM_BOUNDS.glow[0], max: ELECTRIC_STORM_BOUNDS.glow[1], step: 0.01, visibility: 'all' },
      { kind: 'slider', id: 'electric-storm-impact-shake', setting: 'impactShake', label: 'Impact Shake', min: ELECTRIC_STORM_BOUNDS.impactShake[0], max: ELECTRIC_STORM_BOUNDS.impactShake[1], step: 0.01, visibility: 'all' },
      { kind: 'slider', id: 'electric-storm-zoom-punch', setting: 'zoomPunch', label: 'Zoom Punch', min: ELECTRIC_STORM_BOUNDS.zoomPunch[0], max: ELECTRIC_STORM_BOUNDS.zoomPunch[1], step: 0.01, visibility: 'all' },
    ],
  }],
} as const satisfies CinematicWorldControlSchema<'electricStorm'>

const ORBITAL_PRISM_ARRAY_CONTROLS = EMPTY_SCHEMA('orbitalPrismArray')

const REACTIVE_CONSTELLATION_CONTROLS = {
  mode: 'reactiveConstellation',
  groups: [
    {
      id: 'reactive-constellation-composition',
      label: 'Structure and Topology',
      visibility: 'advanced',
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
      id: 'reactive-constellation-beams',
      label: 'Beams and Trails',
      visibility: 'advanced',
      controls: [
        { kind: 'slider', id: 'constellation-beam-width', setting: 'beamWidth', label: 'Beam Width', description: 'Sets the perspective-stable ribbon width in output pixels.', min: REACTIVE_CONSTELLATION_BOUNDS.beamWidth[0], max: REACTIVE_CONSTELLATION_BOUNDS.beamWidth[1], step: 0.1, visibility: 'all' },
        { kind: 'slider', id: 'constellation-edge-opacity', setting: 'edgeOpacity', label: 'Edge Opacity', min: REACTIVE_CONSTELLATION_BOUNDS.edgeOpacity[0], max: REACTIVE_CONSTELLATION_BOUNDS.edgeOpacity[1], step: 0.01, visibility: 'all' },
        { kind: 'integer', id: 'constellation-trail-samples', setting: 'trailSamples', label: 'Trail Samples', description: 'Controls the requested history depth before the active quality budget is applied.', min: REACTIVE_CONSTELLATION_BOUNDS.trailSamples[0], max: REACTIVE_CONSTELLATION_BOUNDS.trailSamples[1], step: 1, visibility: 'all' },
        { kind: 'slider', id: 'constellation-beam-fan', setting: 'beamFanAmount', label: 'Beam Fan', description: 'Compresses or exaggerates historical edge displacement around the live network.', min: REACTIVE_CONSTELLATION_BOUNDS.beamFanAmount[0], max: REACTIVE_CONSTELLATION_BOUNDS.beamFanAmount[1], step: 0.01, visibility: 'all' },
      ],
    },
    {
      id: 'reactive-constellation-beam-detail',
      label: 'Beam Detail',
      visibility: 'advanced',
      controls: [
        { kind: 'slider', id: 'constellation-beam-core', setting: 'beamCoreBrightness', label: 'Core Brightness', min: REACTIVE_CONSTELLATION_BOUNDS.beamCoreBrightness[0], max: REACTIVE_CONSTELLATION_BOUNDS.beamCoreBrightness[1], step: 0.05 },
        { kind: 'slider', id: 'constellation-beam-glow', setting: 'beamGlow', label: 'Glow Shell', description: 'Scales the wider emissive shell while shared Cinematic bloom remains the only bloom pipeline.', min: REACTIVE_CONSTELLATION_BOUNDS.beamGlow[0], max: REACTIVE_CONSTELLATION_BOUNDS.beamGlow[1], step: 0.05 },
        { kind: 'slider', id: 'constellation-trail-decay', setting: 'trailDecay', label: 'Trail Retention', description: 'Higher values preserve older edge copies for longer.', min: REACTIVE_CONSTELLATION_BOUNDS.trailDecay[0], max: REACTIVE_CONSTELLATION_BOUNDS.trailDecay[1], step: 0.01 },
        { kind: 'slider', id: 'constellation-trail-spacing', setting: 'trailSpacing', label: 'Trail Spacing', description: 'Seconds between bounded history captures while transport is playing.', min: REACTIVE_CONSTELLATION_BOUNDS.trailSpacing[0], max: REACTIVE_CONSTELLATION_BOUNDS.trailSpacing[1], step: 0.001 },
      ],
    },
    {
      id: 'reactive-constellation-structure',
      label: 'Node Geometry',
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
      label: 'Physics and Motion',
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
      id: 'reactive-constellation-expansion',
      label: 'Center-Out Expansion',
      visibility: 'advanced',
      controls: [
        { kind: 'slider', id: 'constellation-initial-expansion', setting: 'initialExpansion', label: 'Initial Expansion', description: 'Sets how tightly simulated nodes begin around the center without changing their authored full-spread anchors.', min: REACTIVE_CONSTELLATION_BOUNDS.initialExpansion[0], max: REACTIVE_CONSTELLATION_BOUNDS.initialExpansion[1], step: 0.01 },
        { kind: 'slider', id: 'constellation-expansion-target', setting: 'expansionTarget', label: 'Expansion Target', description: 'Sets the settled radial scale relative to the authored graph anchors.', min: REACTIVE_CONSTELLATION_BOUNDS.expansionTarget[0], max: REACTIVE_CONSTELLATION_BOUNDS.expansionTarget[1], step: 0.01 },
        { kind: 'slider', id: 'constellation-expansion-attack', setting: 'expansionAttackSec', label: 'Expansion Attack', description: 'Controls how quickly nodes accelerate toward a larger radial target.', min: REACTIVE_CONSTELLATION_BOUNDS.expansionAttackSec[0], max: REACTIVE_CONSTELLATION_BOUNDS.expansionAttackSec[1], step: 0.01 },
        { kind: 'slider', id: 'constellation-expansion-release', setting: 'expansionReleaseSec', label: 'Expansion Release', description: 'Controls how quickly nodes recover toward a smaller radial target.', min: REACTIVE_CONSTELLATION_BOUNDS.expansionReleaseSec[0], max: REACTIVE_CONSTELLATION_BOUNDS.expansionReleaseSec[1], step: 0.01 },
        { kind: 'slider', id: 'constellation-expansion-spring', setting: 'expansionSpringStrength', label: 'Expansion Spring', description: 'Controls radial spring acceleration independently from the graph-edge springs.', min: REACTIVE_CONSTELLATION_BOUNDS.expansionSpringStrength[0], max: REACTIVE_CONSTELLATION_BOUNDS.expansionSpringStrength[1], step: 0.01 },
        { kind: 'slider', id: 'constellation-expansion-damping', setting: 'expansionDamping', label: 'Expansion Damping', description: 'Settles radial expansion velocity after launch and overshoot.', min: REACTIVE_CONSTELLATION_BOUNDS.expansionDamping[0], max: REACTIVE_CONSTELLATION_BOUNDS.expansionDamping[1], step: 0.01 },
        { kind: 'slider', id: 'constellation-expansion-overshoot', setting: 'expansionOvershoot', label: 'Expansion Overshoot', description: 'Allows a bounded elastic pass beyond the radial target before settling.', min: REACTIVE_CONSTELLATION_BOUNDS.expansionOvershoot[0], max: REACTIVE_CONSTELLATION_BOUNDS.expansionOvershoot[1], step: 0.01 },
        { kind: 'slider', id: 'constellation-radial-stagger', setting: 'radialStaggerSec', label: 'Radial Stagger', description: 'Spreads deterministic node launch delays across this many seconds.', min: REACTIVE_CONSTELLATION_BOUNDS.radialStaggerSec[0], max: REACTIVE_CONSTELLATION_BOUNDS.radialStaggerSec[1], step: 0.01 },
        { kind: 'slider', id: 'constellation-expansion-burst', setting: 'expansionBurstImpulse', label: 'Launch Impulse', description: 'Adds a one-time outward kick as each staggered node begins expanding.', min: REACTIVE_CONSTELLATION_BOUNDS.expansionBurstImpulse[0], max: REACTIVE_CONSTELLATION_BOUNDS.expansionBurstImpulse[1], step: 0.01 },
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
      id: 'reactive-constellation-atmosphere',
      label: 'Atmosphere & Depth',
      visibility: 'advanced',
      controls: [
        { kind: 'slider', id: 'constellation-background-curtains', setting: 'backgroundCurtains', label: 'Laser Curtains', description: 'Adds restrained palette-derived beam curtains behind the sculpture without duplicating the shared bloom or fog pipeline.', min: REACTIVE_CONSTELLATION_BOUNDS.backgroundCurtains[0], max: REACTIVE_CONSTELLATION_BOUNDS.backgroundCurtains[1], step: 0.01 },
        { kind: 'integer', id: 'constellation-curtain-density', setting: 'curtainDensity', label: 'Curtain Density', description: 'Requests a bounded number of background curtain strands before the quality-tier cap is applied.', min: REACTIVE_CONSTELLATION_BOUNDS.curtainDensity[0], max: REACTIVE_CONSTELLATION_BOUNDS.curtainDensity[1], step: 1 },
        { kind: 'slider', id: 'constellation-depth-fade', setting: 'depthFade', label: 'Depth Fade', description: 'Controls distance falloff while the shared Environment Fog setting remains the only fog density control.', min: REACTIVE_CONSTELLATION_BOUNDS.depthFade[0], max: REACTIVE_CONSTELLATION_BOUNDS.depthFade[1], step: 0.01 },
      ],
    },
    {
      id: 'reactive-constellation-surface',
      label: 'Materials and Atmosphere',
      visibility: 'advanced',
      controls: [
        { kind: 'slider', id: 'constellation-face-opacity', setting: 'faceOpacity', label: 'Face Opacity', description: 'Uses ordered transparency coverage so faces remain stable without per-triangle sorting corruption.', min: REACTIVE_CONSTELLATION_BOUNDS.faceOpacity[0], max: REACTIVE_CONSTELLATION_BOUNDS.faceOpacity[1], step: 0.01 },
        { kind: 'slider', id: 'constellation-facet-contrast', setting: 'facetContrast', label: 'Facet Contrast', min: REACTIVE_CONSTELLATION_BOUNDS.facetContrast[0], max: REACTIVE_CONSTELLATION_BOUNDS.facetContrast[1], step: 0.01 },
        { kind: 'slider', id: 'constellation-internal-glow', setting: 'internalGlow', label: 'Internal Glow', min: REACTIVE_CONSTELLATION_BOUNDS.internalGlow[0], max: REACTIVE_CONSTELLATION_BOUNDS.internalGlow[1], step: 0.01 },
        { kind: 'slider', id: 'constellation-rim-intensity', setting: 'rimIntensity', label: 'Rim Intensity', min: REACTIVE_CONSTELLATION_BOUNDS.rimIntensity[0], max: REACTIVE_CONSTELLATION_BOUNDS.rimIntensity[1], step: 0.01 },
        { kind: 'slider', id: 'constellation-wireframe-amount', setting: 'wireframeAmount', label: 'Wireframe Amount', min: REACTIVE_CONSTELLATION_BOUNDS.wireframeAmount[0], max: REACTIVE_CONSTELLATION_BOUNDS.wireframeAmount[1], step: 0.01 },
        { kind: 'slider', id: 'constellation-color-variation', setting: 'colorVariation', label: 'Color Variation', description: 'Controls seeded interpolation across the active preset palette.', min: REACTIVE_CONSTELLATION_BOUNDS.colorVariation[0], max: REACTIVE_CONSTELLATION_BOUNDS.colorVariation[1], step: 0.01 },
        { kind: 'slider', id: 'constellation-node-spin', setting: 'nodeSpin', label: 'Node Spin', min: REACTIVE_CONSTELLATION_BOUNDS.nodeSpin[0], max: REACTIVE_CONSTELLATION_BOUNDS.nodeSpin[1], step: 0.01 },
        { kind: 'slider', id: 'constellation-camera-orbit', setting: 'cameraOrbit', label: 'World Orbit', description: 'Adds a model-space orbit while retaining the shared Cinematic camera frame.', min: REACTIVE_CONSTELLATION_BOUNDS.cameraOrbit[0], max: REACTIVE_CONSTELLATION_BOUNDS.cameraOrbit[1], step: 0.01 },
      ],
    },
  ],
} as const satisfies CinematicWorldControlSchema<'reactiveConstellation'>

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
  stormGateway: { id: 'stormGateway', label: 'Storm Gateway', category: 'Storm', description: 'Cloud vortex, debris, turbulence and branching lightning.', cameraRigs: ['locked', 'orbit', 'handheld', 'autoDirector'], modulationTargets: ['portalAperture', 'depth', 'cameraPunch', 'fogDensity', 'particleEmission', 'lightning', 'environmentBrightness', 'distortion', 'bloom', 'chromaticAberration', 'impact'], supportsPortalShape: true, controls: STORM_GATEWAY_CONTROLS },
  electricStorm: { id: 'electricStorm', label: 'Electric Storm', category: 'Storm', description: 'Screen-space procedural lightning over a configurable abstract storm atmosphere.', cameraRigs: ['locked'], modulationTargets: [], supportsPortalShape: false, controls: ELECTRIC_STORM_CONTROLS },
  orbitalPrismArray: { id: 'orbitalPrismArray', label: 'Orbital Prism Array', category: 'Cosmic', description: 'Central faceted prism with three orbital rings, deterministic depth shards, and a lightweight star field.', cameraRigs: ['locked', 'dolly', 'orbit', 'flyThrough', 'handheld', 'autoDirector'], modulationTargets: ['geometryRotation', 'environmentBrightness', 'nodeScale', 'edgeBrightness', 'particleEmission', 'impact', 'burstImpulse', 'bloom'], supportsPortalShape: false, controls: ORBITAL_PRISM_ARRAY_CONTROLS },
  reactiveConstellation: { id: 'reactiveConstellation', label: 'Reactive Constellation', category: 'Cosmic', description: 'A true 3D faceted crystal network with palette-derived emissive beams, crystalline materials, and bounded temporal beam fans.', cameraRigs: ['locked', 'dolly', 'orbit', 'handheld', 'autoDirector'], modulationTargets: ['networkSpread', 'nodeScale', 'nodeSpin', 'edgeBrightness', 'edgeWidth', 'trailLength', 'topologyMorph', 'collapseForce', 'burstImpulse', 'facetOpacity', 'depth', 'geometryRotation', 'environmentBrightness', 'cameraPunch', 'bloom', 'impact'], supportsPortalShape: false, controls: REACTIVE_CONSTELLATION_CONTROLS },
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
  CINEMATIC_WORLD_CATALOG.electricStorm,
  CINEMATIC_WORLD_CATALOG.orbitalPrismArray,
  CINEMATIC_WORLD_CATALOG.reactiveConstellation,
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
    case 'color': {
      if (typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value.trim())) return value.trim().toLowerCase()
      return typeof fallback === 'string' ? fallback : '#000000'
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
      } else if (control.kind === 'color') {
        if (typeof fallback !== 'string' || !/^#[0-9a-f]{6}$/i.test(fallback)) {
          errors.push(`Control "${control.id}" requires a six-digit hex color default`)
        }
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
