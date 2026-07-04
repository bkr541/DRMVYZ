import type { CinematicWorldMode } from './CinematicWorldConfig'

export const PACK_A_CINEMATIC_WORLD_MODES = [
  'eventHorizon',
  'infiniteCorridor',
  'fractureRift',
  'monolithGate',
] as const

export const PACK_B_CINEMATIC_WORLD_MODES = [
  'liquidMembrane',
  'celestialCathedral',
  'mirrorDimension',
  'ancientMachine',
  'stormGateway',
] as const

export const GEOMETRY_CINEMATIC_WORLD_MODES = ['reactiveConstellation'] as const

export const IMPLEMENTED_CINEMATIC_WORLD_MODES = [
  ...PACK_A_CINEMATIC_WORLD_MODES,
  ...PACK_B_CINEMATIC_WORLD_MODES,
  ...GEOMETRY_CINEMATIC_WORLD_MODES,
] as const

export type ImplementedCinematicWorldMode = typeof IMPLEMENTED_CINEMATIC_WORLD_MODES[number]

export interface EventHorizonSettings {
  coreRadius: number
  ringRadius: number
  ringThickness: number
  accretionTilt: number
  lensingStrength: number
  depthLayers: number
  rotationSpeed: number
  shockwaveStrength: number
  dropExpansion: number
  bloomBoost: number
  chromaticAberrationBoost: number
}

export interface InfiniteCorridorSettings {
  corridorDensity: number
  travelSpeed: number
  tunnelWidth: number
  archThickness: number
  alternatingLights: number
  fogDensity: number
  cameraSway: number
  vanishingOffset: number
  structureStyle: number
}

export interface FractureRiftSettings {
  openingAmount: number
  edgeComplexity: number
  shardDensity: number
  crackPropagation: number
  fractureMotion: number
  innerDepth: number
  shardDrift: number
  openingShape: number
  innerSurface: number
}

export interface MonolithGateSettings {
  gateScale: number
  columnCount: number
  slabDepth: number
  ringCount: number
  lightShaftIntensity: number
  glyphDensity: number
  openingAmount: number
  lockStrength: number
  cameraTravel: number
  architectureStyle: number
}

export interface LiquidMembraneSettings {
  membraneScale: number
  viscosity: number
  stretch: number
  rippleDensity: number
  rippleSpeed: number
  tearAmount: number
  refractionStrength: number
  surfaceDetail: number
  edgeSoftness: number
  openingBias: number
  midSurfaceMotion: number
}

export interface CelestialCathedralSettings {
  cathedralScale: number
  archCount: number
  pillarCount: number
  ribDensity: number
  aisleDepth: number
  lightShaftIntensity: number
  starDensity: number
  majesticSpeed: number
  cameraDrift: number
  illuminationResponse: number
  architectureStyle: number
}

export interface MirrorDimensionSettings {
  symmetryCount: number
  recursionDepth: number
  chamberDepth: number
  mirrorScale: number
  feedbackAmount: number
  feedbackDrift: number
  snapStrength: number
  foldStrength: number
  rotationSpeed: number
  structureStyle: number
}

export interface AncientMachineSettings {
  gateRadius: number
  ringCount: number
  gearCount: number
  glyphDensity: number
  rotationSpeed: number
  lockProgress: number
  unlockResponse: number
  radialComplexity: number
  mechanicalDepth: number
  progressionMode: number
  toothDensity: number
}

export interface StormGatewaySettings {
  stormIntensity: number
  cloudDensity: number
  cloudLayers: number
  vortexStrength: number
  windSpeed: number
  debrisDensity: number
  lightningFrequency: number
  lightningBranching: number
  gatewayRadius: number
  atmosphericDepth: number
  turbulence: number
  lightningResponse: number
}

export const REACTIVE_CONSTELLATION_TOPOLOGIES = ['cluster', 'chain', 'triangulated', 'starburst', 'branching', 'ring', 'splitClusters'] as const
export type ReactiveConstellationTopologyStyle = typeof REACTIVE_CONSTELLATION_TOPOLOGIES[number]

export const REACTIVE_CONSTELLATION_POLYHEDRA = ['tetrahedron', 'octahedron', 'icosahedron', 'irregularCrystal', 'mixed'] as const
export type ReactiveConstellationPolyhedronStyle = typeof REACTIVE_CONSTELLATION_POLYHEDRA[number]

export const REACTIVE_CONSTELLATION_VISUAL_DNA_PROFILES = [
  'melodicBass', 'heavyDubstep', 'hybridTrap', 'house', 'techno', 'openFormat', 'custom',
] as const
export type ReactiveConstellationVisualDnaProfile = typeof REACTIVE_CONSTELLATION_VISUAL_DNA_PROFILES[number]

export const REACTIVE_CONSTELLATION_CHOREOGRAPHY_PROFILES = ['standard', 'crimsonLaunch'] as const
export type ReactiveConstellationChoreographyProfile = typeof REACTIVE_CONSTELLATION_CHOREOGRAPHY_PROFILES[number]

export const REACTIVE_CONSTELLATION_MACRO_KEYS = [
  'macroStructure', 'macroMotion', 'macroImpact', 'macroTrails', 'macroMaterial', 'macroCamera',
] as const
export type ReactiveConstellationMacroKey = typeof REACTIVE_CONSTELLATION_MACRO_KEYS[number]

export interface ReactiveConstellationSettings {
  visualDnaProfile: ReactiveConstellationVisualDnaProfile
  choreographyProfile: ReactiveConstellationChoreographyProfile
  macroStructure: number
  macroMotion: number
  macroImpact: number
  macroTrails: number
  macroMaterial: number
  macroCamera: number
  nodeCount: number
  topologyStyle: ReactiveConstellationTopologyStyle
  polyhedronStyle: ReactiveConstellationPolyhedronStyle
  networkSpread: number
  depthSpread: number
  neighborCount: number
  nodeScale: number
  nodeScaleVariation: number
  faceOpacity: number
  facetContrast: number
  internalGlow: number
  rimIntensity: number
  wireframeAmount: number
  colorVariation: number
  nodeSpin: number
  backgroundCurtains: number
  curtainDensity: number
  depthFade: number
  beamWidth: number
  beamCoreBrightness: number
  beamGlow: number
  edgeOpacity: number
  trailSamples: number
  trailDecay: number
  trailSpacing: number
  beamFanAmount: number
  centralGravity: number
  cameraOrbit: number
  initialExpansion: number
  expansionTarget: number
  expansionAttackSec: number
  expansionReleaseSec: number
  expansionSpringStrength: number
  expansionDamping: number
  expansionOvershoot: number
  radialStaggerSec: number
  expansionBurstImpulse: number
  springStrength: number
  damping: number
  driftAmount: number
  turbulence: number
  orbitAmount: number
  elasticity: number
  topologyStability: number
  collapseAmount: number
  burstStrength: number
  reseedEveryBars: number
}

export type EmptyCinematicWorldSettings = Record<string, never>

export interface CinematicWorldSettingsByMode {
  legacyPortal: EmptyCinematicWorldSettings
  eventHorizon: EventHorizonSettings
  infiniteCorridor: InfiniteCorridorSettings
  fractureRift: FractureRiftSettings
  monolithGate: MonolithGateSettings
  liquidMembrane: LiquidMembraneSettings
  celestialCathedral: CelestialCathedralSettings
  mirrorDimension: MirrorDimensionSettings
  ancientMachine: AncientMachineSettings
  stormGateway: StormGatewaySettings
  reactiveConstellation: ReactiveConstellationSettings
}

export type CinematicWorldSpecificConfig = {
  [Mode in CinematicWorldMode]: {
    mode: Mode
    settings: CinematicWorldSettingsByMode[Mode]
  }
}[CinematicWorldMode]

export interface CinematicSeededVariation {
  phase: number
  skew: number
  density: number
  motion: number
}

export interface CinematicQualityProfile {
  level: number
  geometryScale: number
  particleScale: number
  raymarchSteps: number
  atmosphericLayers: number
  feedbackScale: number
}

type CinematicQualityTier = 'auto' | 'low' | 'medium' | 'high' | 'ultra'

export type NumericBounds<T extends object> = {
  [Key in keyof T]: readonly [min: number, max: number]
}

export const CINEMATIC_QUALITY_PROFILES: Record<CinematicQualityTier, CinematicQualityProfile> = {
  auto: {
    level: 2,
    geometryScale: 0.82,
    particleScale: 0.78,
    raymarchSteps: 28,
    atmosphericLayers: 6,
    feedbackScale: 0.84,
  },
  low: {
    level: 0,
    geometryScale: 0.46,
    particleScale: 0.36,
    raymarchSteps: 12,
    atmosphericLayers: 2,
    feedbackScale: 0.54,
  },
  medium: {
    level: 1,
    geometryScale: 0.68,
    particleScale: 0.58,
    raymarchSteps: 20,
    atmosphericLayers: 4,
    feedbackScale: 0.72,
  },
  high: {
    level: 2,
    geometryScale: 0.86,
    particleScale: 0.82,
    raymarchSteps: 30,
    atmosphericLayers: 6,
    feedbackScale: 0.88,
  },
  ultra: {
    level: 3,
    geometryScale: 1,
    particleScale: 1,
    raymarchSteps: 42,
    atmosphericLayers: 8,
    feedbackScale: 1,
  },
}

export const EVENT_HORIZON_DEFAULTS: EventHorizonSettings = {
  coreRadius: 0.19,
  ringRadius: 0.34,
  ringThickness: 0.065,
  accretionTilt: 0.42,
  lensingStrength: 0.72,
  depthLayers: 4,
  rotationSpeed: 0.32,
  shockwaveStrength: 0.72,
  dropExpansion: 0.24,
  bloomBoost: 0.18,
  chromaticAberrationBoost: 0.08,
}

export const EVENT_HORIZON_BOUNDS: NumericBounds<EventHorizonSettings> = {
  coreRadius: [0.08, 0.34],
  ringRadius: [0.20, 0.62],
  ringThickness: [0.015, 0.18],
  accretionTilt: [-0.95, 0.95],
  lensingStrength: [0, 1.5],
  depthLayers: [1, 7],
  rotationSpeed: [-1.5, 1.5],
  shockwaveStrength: [0, 1.5],
  dropExpansion: [0, 0.55],
  bloomBoost: [0, 0.6],
  chromaticAberrationBoost: [0, 0.45],
}

export const INFINITE_CORRIDOR_DEFAULTS: InfiniteCorridorSettings = {
  corridorDensity: 0.58,
  travelSpeed: 0.48,
  tunnelWidth: 0.72,
  archThickness: 0.055,
  alternatingLights: 0.72,
  fogDensity: 0.46,
  cameraSway: 0.14,
  vanishingOffset: 0,
  structureStyle: 0,
}

export const INFINITE_CORRIDOR_BOUNDS: NumericBounds<InfiniteCorridorSettings> = {
  corridorDensity: [0.15, 1],
  travelSpeed: [0, 1.8],
  tunnelWidth: [0.38, 1.25],
  archThickness: [0.015, 0.16],
  alternatingLights: [0, 1.5],
  fogDensity: [0, 1],
  cameraSway: [0, 0.55],
  vanishingOffset: [-0.42, 0.42],
  structureStyle: [0, 2],
}

export const FRACTURE_RIFT_DEFAULTS: FractureRiftSettings = {
  openingAmount: 0.56,
  edgeComplexity: 0.62,
  shardDensity: 0.54,
  crackPropagation: 0.48,
  fractureMotion: 0.58,
  innerDepth: 0.70,
  shardDrift: 0.42,
  openingShape: 0,
  innerSurface: 0,
}

export const FRACTURE_RIFT_BOUNDS: NumericBounds<FractureRiftSettings> = {
  openingAmount: [0.12, 1],
  edgeComplexity: [0, 1.5],
  shardDensity: [0, 1],
  crackPropagation: [0, 1.5],
  fractureMotion: [0, 1.5],
  innerDepth: [0, 1.5],
  shardDrift: [0, 1.5],
  openingShape: [0, 2],
  innerSurface: [0, 2],
}

export const MONOLITH_GATE_DEFAULTS: MonolithGateSettings = {
  gateScale: 0.76,
  columnCount: 5,
  slabDepth: 0.62,
  ringCount: 3,
  lightShaftIntensity: 0.72,
  glyphDensity: 0.54,
  openingAmount: 0.42,
  lockStrength: 0.48,
  cameraTravel: 0.16,
  architectureStyle: 0,
}

export const MONOLITH_GATE_BOUNDS: NumericBounds<MonolithGateSettings> = {
  gateScale: [0.42, 1.15],
  columnCount: [2, 9],
  slabDepth: [0.1, 1.5],
  ringCount: [0, 6],
  lightShaftIntensity: [0, 1.5],
  glyphDensity: [0, 1],
  openingAmount: [0, 1],
  lockStrength: [0, 1],
  cameraTravel: [0, 0.75],
  architectureStyle: [0, 2],
}

export const LIQUID_MEMBRANE_DEFAULTS: LiquidMembraneSettings = {
  membraneScale: 0.72,
  viscosity: 0.62,
  stretch: 0.48,
  rippleDensity: 5,
  rippleSpeed: 0.55,
  tearAmount: 0.38,
  refractionStrength: 0.58,
  surfaceDetail: 4,
  edgeSoftness: 0.08,
  openingBias: 0.48,
  midSurfaceMotion: 0.72,
}

export const LIQUID_MEMBRANE_BOUNDS: NumericBounds<LiquidMembraneSettings> = {
  membraneScale: [0.3, 1.2],
  viscosity: [0, 1],
  stretch: [0, 1.5],
  rippleDensity: [1, 12],
  rippleSpeed: [0, 2],
  tearAmount: [0, 1],
  refractionStrength: [0, 1.5],
  surfaceDetail: [1, 7],
  edgeSoftness: [0.015, 0.24],
  openingBias: [0, 1],
  midSurfaceMotion: [0, 1.5],
}

export const CELESTIAL_CATHEDRAL_DEFAULTS: CelestialCathedralSettings = {
  cathedralScale: 0.86,
  archCount: 10,
  pillarCount: 7,
  ribDensity: 0.62,
  aisleDepth: 0.86,
  lightShaftIntensity: 0.78,
  starDensity: 0.6,
  majesticSpeed: 0.18,
  cameraDrift: 0.12,
  illuminationResponse: 0.72,
  architectureStyle: 0,
}

export const CELESTIAL_CATHEDRAL_BOUNDS: NumericBounds<CelestialCathedralSettings> = {
  cathedralScale: [0.45, 1.35],
  archCount: [3, 18],
  pillarCount: [3, 15],
  ribDensity: [0, 1.5],
  aisleDepth: [0.15, 1.5],
  lightShaftIntensity: [0, 1.5],
  starDensity: [0, 1],
  majesticSpeed: [0, 0.9],
  cameraDrift: [0, 0.5],
  illuminationResponse: [0, 1.5],
  architectureStyle: [0, 2],
}

export const MIRROR_DIMENSION_DEFAULTS: MirrorDimensionSettings = {
  symmetryCount: 6,
  recursionDepth: 5,
  chamberDepth: 0.72,
  mirrorScale: 0.86,
  feedbackAmount: 0.24,
  feedbackDrift: 0.18,
  snapStrength: 0.72,
  foldStrength: 0.86,
  rotationSpeed: 0.16,
  structureStyle: 0,
}

export const MIRROR_DIMENSION_BOUNDS: NumericBounds<MirrorDimensionSettings> = {
  symmetryCount: [3, 12],
  recursionDepth: [2, 8],
  chamberDepth: [0.2, 1.5],
  mirrorScale: [0.45, 1.2],
  feedbackAmount: [0, 0.55],
  feedbackDrift: [0, 1],
  snapStrength: [0, 1.5],
  foldStrength: [0, 1.5],
  rotationSpeed: [-1, 1],
  structureStyle: [0, 2],
}

export const ANCIENT_MACHINE_DEFAULTS: AncientMachineSettings = {
  gateRadius: 0.58,
  ringCount: 5,
  gearCount: 8,
  glyphDensity: 0.64,
  rotationSpeed: 0.32,
  lockProgress: 0.72,
  unlockResponse: 0.9,
  radialComplexity: 0.68,
  mechanicalDepth: 0.72,
  progressionMode: 0,
  toothDensity: 0.7,
}

export const ANCIENT_MACHINE_BOUNDS: NumericBounds<AncientMachineSettings> = {
  gateRadius: [0.3, 1],
  ringCount: [2, 8],
  gearCount: [3, 14],
  glyphDensity: [0, 1],
  rotationSpeed: [-1.5, 1.5],
  lockProgress: [0, 1],
  unlockResponse: [0, 1.5],
  radialComplexity: [0, 1],
  mechanicalDepth: [0.1, 1.5],
  progressionMode: [0, 2],
  toothDensity: [0, 1],
}

export const STORM_GATEWAY_DEFAULTS: StormGatewaySettings = {
  stormIntensity: 0.72,
  cloudDensity: 0.76,
  cloudLayers: 5,
  vortexStrength: 0.7,
  windSpeed: 0.62,
  debrisDensity: 0.58,
  lightningFrequency: 0.55,
  lightningBranching: 0.72,
  gatewayRadius: 0.46,
  atmosphericDepth: 0.82,
  turbulence: 0.78,
  lightningResponse: 0.92,
}

export const STORM_GATEWAY_BOUNDS: NumericBounds<StormGatewaySettings> = {
  stormIntensity: [0, 1.5],
  cloudDensity: [0, 1],
  cloudLayers: [2, 8],
  vortexStrength: [0, 1.5],
  windSpeed: [0, 2],
  debrisDensity: [0, 1],
  lightningFrequency: [0, 1],
  lightningBranching: [0, 1],
  gatewayRadius: [0.2, 0.85],
  atmosphericDepth: [0, 1.5],
  turbulence: [0, 1.5],
  lightningResponse: [0, 1.5],
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function clampNumber(value: unknown, fallback: number, bounds: readonly [number, number]): number {
  const number = typeof value === 'number' && Number.isFinite(value) ? value : fallback
  return Math.min(bounds[1], Math.max(bounds[0], number))
}

function normalizeNumericSettings<T extends object>(
  raw: unknown,
  defaults: T,
  bounds: NumericBounds<T>,
  integerKeys: readonly (keyof T)[] = [],
): T {
  const source = isRecord(raw) ? raw : {}
  const integers = new Set<keyof T>(integerKeys)
  const entries = Object.keys(defaults).map((key) => {
    const typedKey = key as keyof T
    const fallback = defaults[typedKey] as number
    const bounded = clampNumber(source[key], fallback, bounds[typedKey])
    return [key, integers.has(typedKey) ? Math.round(bounded) : bounded]
  })
  return Object.fromEntries(entries) as T
}

function settingsPayload(value: unknown, mode: CinematicWorldMode): unknown {
  if (!isRecord(value)) return value
  if ('mode' in value && value.mode !== mode) return undefined
  return 'settings' in value ? value.settings : value
}

export const REACTIVE_CONSTELLATION_DEFAULTS: ReactiveConstellationSettings = {
  visualDnaProfile: 'openFormat',
  choreographyProfile: 'standard',
  macroStructure: 0.5,
  macroMotion: 0.5,
  macroImpact: 0.5,
  macroTrails: 0.5,
  macroMaterial: 0.5,
  macroCamera: 0.5,
  nodeCount: 42,
  topologyStyle: 'cluster',
  polyhedronStyle: 'mixed',
  networkSpread: 1.2,
  depthSpread: 0.72,
  neighborCount: 3,
  nodeScale: 0.12,
  nodeScaleVariation: 0.48,
  faceOpacity: 0.82,
  facetContrast: 1.18,
  internalGlow: 0.68,
  rimIntensity: 0.88,
  wireframeAmount: 0.28,
  colorVariation: 0.72,
  nodeSpin: 0.34,
  backgroundCurtains: 0.34,
  curtainDensity: 10,
  depthFade: 0.56,
  beamWidth: 2.4,
  beamCoreBrightness: 2.6,
  beamGlow: 1.15,
  edgeOpacity: 0.78,
  trailSamples: 12,
  trailDecay: 0.78,
  trailSpacing: 0.032,
  beamFanAmount: 1,
  centralGravity: 0.18,
  cameraOrbit: 0.16,
  initialExpansion: 0.08,
  expansionTarget: 1,
  expansionAttackSec: 0.72,
  expansionReleaseSec: 0.48,
  expansionSpringStrength: 0.9,
  expansionDamping: 0.58,
  expansionOvershoot: 0.18,
  radialStaggerSec: 0.18,
  expansionBurstImpulse: 0.42,
  springStrength: 0.72,
  damping: 0.62,
  driftAmount: 0.22,
  turbulence: 0.18,
  orbitAmount: 0.2,
  elasticity: 0.58,
  topologyStability: 0.72,
  collapseAmount: 0.06,
  burstStrength: 0.46,
  reseedEveryBars: 0,
}

export const REACTIVE_CONSTELLATION_BOUNDS = {
  macroStructure: [0, 1],
  macroMotion: [0, 1],
  macroImpact: [0, 1],
  macroTrails: [0, 1],
  macroMaterial: [0, 1],
  macroCamera: [0, 1],
  nodeCount: [12, 96],
  networkSpread: [0.45, 2.4],
  depthSpread: [0.08, 1.8],
  neighborCount: [1, 8],
  nodeScale: [0.045, 0.28],
  nodeScaleVariation: [0, 1],
  faceOpacity: [0.08, 1],
  facetContrast: [0, 2],
  internalGlow: [0, 2],
  rimIntensity: [0, 2],
  wireframeAmount: [0, 1],
  colorVariation: [0, 1],
  nodeSpin: [-1.5, 1.5],
  backgroundCurtains: [0, 1],
  curtainDensity: [0, 24],
  depthFade: [0, 1.5],
  beamWidth: [0.5, 12],
  beamCoreBrightness: [0, 6],
  beamGlow: [0, 3],
  edgeOpacity: [0, 1],
  trailSamples: [0, 32],
  trailDecay: [0.2, 0.98],
  trailSpacing: [0.008, 0.25],
  beamFanAmount: [0, 2],
  centralGravity: [0, 1],
  cameraOrbit: [-1, 1],
  initialExpansion: [0.01, 1],
  expansionTarget: [0, 1.35],
  expansionAttackSec: [0.08, 4],
  expansionReleaseSec: [0.08, 4],
  expansionSpringStrength: [0, 2],
  expansionDamping: [0, 1],
  expansionOvershoot: [0, 0.75],
  radialStaggerSec: [0, 1.5],
  expansionBurstImpulse: [0, 2.5],
  springStrength: [0, 2],
  damping: [0, 1],
  driftAmount: [0, 1.5],
  turbulence: [0, 1.5],
  orbitAmount: [-1.5, 1.5],
  elasticity: [0, 1],
  topologyStability: [0, 1],
  collapseAmount: [0, 1.5],
  burstStrength: [0, 2.5],
  reseedEveryBars: [0, 64],
} as const satisfies NumericBounds<Omit<ReactiveConstellationSettings, 'visualDnaProfile' | 'choreographyProfile' | 'topologyStyle' | 'polyhedronStyle'>>

function normalizeReactiveConstellationSettings(raw: unknown): ReactiveConstellationSettings {
  const payload = settingsPayload(raw, 'reactiveConstellation')
  const source = isRecord(payload) ? payload : {}
  const numeric = normalizeNumericSettings(
    source,
    {
      macroStructure: REACTIVE_CONSTELLATION_DEFAULTS.macroStructure,
      macroMotion: REACTIVE_CONSTELLATION_DEFAULTS.macroMotion,
      macroImpact: REACTIVE_CONSTELLATION_DEFAULTS.macroImpact,
      macroTrails: REACTIVE_CONSTELLATION_DEFAULTS.macroTrails,
      macroMaterial: REACTIVE_CONSTELLATION_DEFAULTS.macroMaterial,
      macroCamera: REACTIVE_CONSTELLATION_DEFAULTS.macroCamera,
      nodeCount: REACTIVE_CONSTELLATION_DEFAULTS.nodeCount,
      networkSpread: REACTIVE_CONSTELLATION_DEFAULTS.networkSpread,
      depthSpread: REACTIVE_CONSTELLATION_DEFAULTS.depthSpread,
      neighborCount: REACTIVE_CONSTELLATION_DEFAULTS.neighborCount,
      nodeScale: REACTIVE_CONSTELLATION_DEFAULTS.nodeScale,
      nodeScaleVariation: REACTIVE_CONSTELLATION_DEFAULTS.nodeScaleVariation,
      faceOpacity: REACTIVE_CONSTELLATION_DEFAULTS.faceOpacity,
      facetContrast: REACTIVE_CONSTELLATION_DEFAULTS.facetContrast,
      internalGlow: REACTIVE_CONSTELLATION_DEFAULTS.internalGlow,
      rimIntensity: REACTIVE_CONSTELLATION_DEFAULTS.rimIntensity,
      wireframeAmount: REACTIVE_CONSTELLATION_DEFAULTS.wireframeAmount,
      colorVariation: REACTIVE_CONSTELLATION_DEFAULTS.colorVariation,
      nodeSpin: REACTIVE_CONSTELLATION_DEFAULTS.nodeSpin,
      backgroundCurtains: REACTIVE_CONSTELLATION_DEFAULTS.backgroundCurtains,
      curtainDensity: REACTIVE_CONSTELLATION_DEFAULTS.curtainDensity,
      depthFade: REACTIVE_CONSTELLATION_DEFAULTS.depthFade,
      beamWidth: REACTIVE_CONSTELLATION_DEFAULTS.beamWidth,
      beamCoreBrightness: REACTIVE_CONSTELLATION_DEFAULTS.beamCoreBrightness,
      beamGlow: REACTIVE_CONSTELLATION_DEFAULTS.beamGlow,
      edgeOpacity: REACTIVE_CONSTELLATION_DEFAULTS.edgeOpacity,
      trailSamples: REACTIVE_CONSTELLATION_DEFAULTS.trailSamples,
      trailDecay: REACTIVE_CONSTELLATION_DEFAULTS.trailDecay,
      trailSpacing: REACTIVE_CONSTELLATION_DEFAULTS.trailSpacing,
      beamFanAmount: REACTIVE_CONSTELLATION_DEFAULTS.beamFanAmount,
      centralGravity: REACTIVE_CONSTELLATION_DEFAULTS.centralGravity,
      cameraOrbit: REACTIVE_CONSTELLATION_DEFAULTS.cameraOrbit,
      initialExpansion: REACTIVE_CONSTELLATION_DEFAULTS.initialExpansion,
      expansionTarget: REACTIVE_CONSTELLATION_DEFAULTS.expansionTarget,
      expansionAttackSec: REACTIVE_CONSTELLATION_DEFAULTS.expansionAttackSec,
      expansionReleaseSec: REACTIVE_CONSTELLATION_DEFAULTS.expansionReleaseSec,
      expansionSpringStrength: REACTIVE_CONSTELLATION_DEFAULTS.expansionSpringStrength,
      expansionDamping: REACTIVE_CONSTELLATION_DEFAULTS.expansionDamping,
      expansionOvershoot: REACTIVE_CONSTELLATION_DEFAULTS.expansionOvershoot,
      radialStaggerSec: REACTIVE_CONSTELLATION_DEFAULTS.radialStaggerSec,
      expansionBurstImpulse: REACTIVE_CONSTELLATION_DEFAULTS.expansionBurstImpulse,
      springStrength: REACTIVE_CONSTELLATION_DEFAULTS.springStrength,
      damping: REACTIVE_CONSTELLATION_DEFAULTS.damping,
      driftAmount: REACTIVE_CONSTELLATION_DEFAULTS.driftAmount,
      turbulence: REACTIVE_CONSTELLATION_DEFAULTS.turbulence,
      orbitAmount: REACTIVE_CONSTELLATION_DEFAULTS.orbitAmount,
      elasticity: REACTIVE_CONSTELLATION_DEFAULTS.elasticity,
      topologyStability: REACTIVE_CONSTELLATION_DEFAULTS.topologyStability,
      collapseAmount: REACTIVE_CONSTELLATION_DEFAULTS.collapseAmount,
      burstStrength: REACTIVE_CONSTELLATION_DEFAULTS.burstStrength,
      reseedEveryBars: REACTIVE_CONSTELLATION_DEFAULTS.reseedEveryBars,
    },
    REACTIVE_CONSTELLATION_BOUNDS,
    ['nodeCount', 'neighborCount', 'trailSamples', 'curtainDensity', 'reseedEveryBars'],
  )
  const legacyTopologyAliases: Record<string, ReactiveConstellationTopologyStyle> = {
    radial: 'starburst',
    clustered: 'cluster',
    helix: 'chain',
    layered: 'splitClusters',
  }
  const visualDnaProfile = REACTIVE_CONSTELLATION_VISUAL_DNA_PROFILES.includes(source.visualDnaProfile as ReactiveConstellationVisualDnaProfile)
    ? source.visualDnaProfile as ReactiveConstellationVisualDnaProfile
    : REACTIVE_CONSTELLATION_DEFAULTS.visualDnaProfile
  const choreographyProfile = REACTIVE_CONSTELLATION_CHOREOGRAPHY_PROFILES.includes(source.choreographyProfile as ReactiveConstellationChoreographyProfile)
    ? source.choreographyProfile as ReactiveConstellationChoreographyProfile
    : REACTIVE_CONSTELLATION_DEFAULTS.choreographyProfile
  const topologyCandidate = legacyTopologyAliases[String(source.topologyStyle)] ?? source.topologyStyle
  const topologyStyle = REACTIVE_CONSTELLATION_TOPOLOGIES.includes(topologyCandidate as ReactiveConstellationTopologyStyle)
    ? topologyCandidate as ReactiveConstellationTopologyStyle
    : REACTIVE_CONSTELLATION_DEFAULTS.topologyStyle
  const polyhedronStyle = REACTIVE_CONSTELLATION_POLYHEDRA.includes(source.polyhedronStyle as ReactiveConstellationPolyhedronStyle)
    ? source.polyhedronStyle as ReactiveConstellationPolyhedronStyle
    : REACTIVE_CONSTELLATION_DEFAULTS.polyhedronStyle
  return { ...numeric, visualDnaProfile, choreographyProfile, topologyStyle, polyhedronStyle }
}

export function createDefaultCinematicWorldSettings(mode: CinematicWorldMode): CinematicWorldSpecificConfig {
  switch (mode) {
    case 'eventHorizon': return { mode, settings: { ...EVENT_HORIZON_DEFAULTS } }
    case 'infiniteCorridor': return { mode, settings: { ...INFINITE_CORRIDOR_DEFAULTS } }
    case 'fractureRift': return { mode, settings: { ...FRACTURE_RIFT_DEFAULTS } }
    case 'monolithGate': return { mode, settings: { ...MONOLITH_GATE_DEFAULTS } }
    case 'liquidMembrane': return { mode, settings: { ...LIQUID_MEMBRANE_DEFAULTS } }
    case 'celestialCathedral': return { mode, settings: { ...CELESTIAL_CATHEDRAL_DEFAULTS } }
    case 'mirrorDimension': return { mode, settings: { ...MIRROR_DIMENSION_DEFAULTS } }
    case 'ancientMachine': return { mode, settings: { ...ANCIENT_MACHINE_DEFAULTS } }
    case 'stormGateway': return { mode, settings: { ...STORM_GATEWAY_DEFAULTS } }
    case 'reactiveConstellation': return { mode, settings: { ...REACTIVE_CONSTELLATION_DEFAULTS } }
    default: return { mode, settings: {} } as CinematicWorldSpecificConfig
  }
}

export function normalizeCinematicWorldSettings(
  mode: CinematicWorldMode,
  value: unknown,
): CinematicWorldSpecificConfig {
  const payload = settingsPayload(value, mode)
  switch (mode) {
    case 'eventHorizon':
      return {
        mode,
        settings: normalizeNumericSettings(payload, EVENT_HORIZON_DEFAULTS, EVENT_HORIZON_BOUNDS, ['depthLayers']),
      }
    case 'infiniteCorridor':
      return {
        mode,
        settings: normalizeNumericSettings(payload, INFINITE_CORRIDOR_DEFAULTS, INFINITE_CORRIDOR_BOUNDS, ['structureStyle']),
      }
    case 'fractureRift':
      return {
        mode,
        settings: normalizeNumericSettings(payload, FRACTURE_RIFT_DEFAULTS, FRACTURE_RIFT_BOUNDS, ['openingShape', 'innerSurface']),
      }
    case 'monolithGate':
      return {
        mode,
        settings: normalizeNumericSettings(payload, MONOLITH_GATE_DEFAULTS, MONOLITH_GATE_BOUNDS, [
          'columnCount', 'ringCount', 'architectureStyle',
        ]),
      }
    case 'liquidMembrane':
      return {
        mode,
        settings: normalizeNumericSettings(payload, LIQUID_MEMBRANE_DEFAULTS, LIQUID_MEMBRANE_BOUNDS, [
          'rippleDensity', 'surfaceDetail',
        ]),
      }
    case 'celestialCathedral':
      return {
        mode,
        settings: normalizeNumericSettings(payload, CELESTIAL_CATHEDRAL_DEFAULTS, CELESTIAL_CATHEDRAL_BOUNDS, [
          'archCount', 'pillarCount', 'architectureStyle',
        ]),
      }
    case 'mirrorDimension':
      return {
        mode,
        settings: normalizeNumericSettings(payload, MIRROR_DIMENSION_DEFAULTS, MIRROR_DIMENSION_BOUNDS, [
          'symmetryCount', 'recursionDepth', 'structureStyle',
        ]),
      }
    case 'ancientMachine':
      return {
        mode,
        settings: normalizeNumericSettings(payload, ANCIENT_MACHINE_DEFAULTS, ANCIENT_MACHINE_BOUNDS, [
          'ringCount', 'gearCount', 'progressionMode',
        ]),
      }
    case 'stormGateway':
      return {
        mode,
        settings: normalizeNumericSettings(payload, STORM_GATEWAY_DEFAULTS, STORM_GATEWAY_BOUNDS, ['cloudLayers']),
      }
    case 'reactiveConstellation': return { mode, settings: normalizeReactiveConstellationSettings(value) }
    default:
      return { mode, settings: {} } as CinematicWorldSpecificConfig
  }
}

export function resolveEventHorizonSettings(value: CinematicWorldSpecificConfig): EventHorizonSettings {
  return normalizeCinematicWorldSettings('eventHorizon', value).settings as EventHorizonSettings
}

export function resolveInfiniteCorridorSettings(value: CinematicWorldSpecificConfig): InfiniteCorridorSettings {
  return normalizeCinematicWorldSettings('infiniteCorridor', value).settings as InfiniteCorridorSettings
}

export function resolveFractureRiftSettings(value: CinematicWorldSpecificConfig): FractureRiftSettings {
  return normalizeCinematicWorldSettings('fractureRift', value).settings as FractureRiftSettings
}

export function resolveMonolithGateSettings(value: CinematicWorldSpecificConfig): MonolithGateSettings {
  return normalizeCinematicWorldSettings('monolithGate', value).settings as MonolithGateSettings
}

export function resolveLiquidMembraneSettings(value: CinematicWorldSpecificConfig): LiquidMembraneSettings {
  return normalizeCinematicWorldSettings('liquidMembrane', value).settings as LiquidMembraneSettings
}

export function resolveCelestialCathedralSettings(value: CinematicWorldSpecificConfig): CelestialCathedralSettings {
  return normalizeCinematicWorldSettings('celestialCathedral', value).settings as CelestialCathedralSettings
}

export function resolveMirrorDimensionSettings(value: CinematicWorldSpecificConfig): MirrorDimensionSettings {
  return normalizeCinematicWorldSettings('mirrorDimension', value).settings as MirrorDimensionSettings
}

export function resolveAncientMachineSettings(value: CinematicWorldSpecificConfig): AncientMachineSettings {
  return normalizeCinematicWorldSettings('ancientMachine', value).settings as AncientMachineSettings
}

export function resolveStormGatewaySettings(value: CinematicWorldSpecificConfig): StormGatewaySettings {
  return normalizeCinematicWorldSettings('stormGateway', value).settings as StormGatewaySettings
}

export function resolveReactiveConstellationSettings(value: CinematicWorldSpecificConfig): ReactiveConstellationSettings {
  return normalizeCinematicWorldSettings('reactiveConstellation', value).settings as ReactiveConstellationSettings
}

function modeSalt(mode: CinematicWorldMode): number {
  let hash = 2166136261 >>> 0
  for (let index = 0; index < mode.length; index += 1) {
    hash ^= mode.charCodeAt(index)
    hash = Math.imul(hash, 16777619) >>> 0
  }
  return hash
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

export function createCinematicSeededVariation(
  mode: CinematicWorldMode,
  seed: number,
): CinematicSeededVariation {
  const random = mulberry32((Math.trunc(seed) >>> 0) ^ modeSalt(mode))
  return {
    phase: random(),
    skew: random() * 2 - 1,
    density: 0.8 + random() * 0.4,
    motion: 0.8 + random() * 0.4,
  }
}

export function cinematicQualityProfile(quality: CinematicQualityTier): CinematicQualityProfile {
  return CINEMATIC_QUALITY_PROFILES[quality]
}

export function cinematicQualityLevel(quality: CinematicQualityTier): number {
  return cinematicQualityProfile(quality).level
}
