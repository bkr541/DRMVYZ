import {
  CINEMA_COMPOSITION_SCHEMA_ID,
  CINEMA_COMPOSITION_SCHEMA_VERSION,
  type CinemaBrandRole,
  type CinemaCameraResourceDefinition,
  type CinemaColor,
  type CinemaCompositionDefinition,
  type CinemaJsonObject,
  type CinemaNodeDefinition,
  type CinemaParameterDefinition,
  type CinemaParameterValue,
  type CinemaParameterValues,
  type CinemaVector3,
} from './CinemaDomain'
import { createCinemaDiagnostic } from './CinemaDiagnostics'
import {
  cinemaNamespacedId,
  cinemaStableId,
  type CinemaCameraId,
  type CinemaCompositionId,
  type CinemaConnectionId,
  type CinemaEnumOptionId,
  type CinemaNodeId,
  type CinemaNodeTypeId,
  type CinemaParameterId,
  type CinemaPortId,
  type CinemaRendererPluginId,
} from './CinemaIdentifiers'
import type { CinemaPersistedDefinition } from './CinemaPersistence'
import { Cinema3DObjectRuntime, type Cinema3DObjectRuntimeService } from './Cinema3DObjectRuntime'
import {
  applyCinema3DObjectRuntimeQuality,
  CINEMA_3D_OBJECT_PARAMETER_CAPABILITIES,
  CINEMA_3D_OBJECT_PARAMETER_SCHEMAS,
  hydrateCinema3DObjectDefinition,
} from './Cinema3DObjectState'
import {
  type CinemaWorld3DObjectAnchor,
} from './CinemaWorld3DObject'
import type {
  CinemaCameraControl,
  CinemaFrameContext,
  CinemaNodeDisposeContext,
  CinemaNodeInitializeContext,
  CinemaNodePlugin,
  CinemaNodeRenderContext,
  CinemaNodeResetContext,
  CinemaNodeResizeContext,
  CinemaNodeTypeDefinition,
  CinemaParameterCapabilityDescriptor,
  CinemaRenderNode,
  CinemaStateResetActionId,
  CinemaAssetRuntimeService,
  CinemaCameraUniformSnapshot,
  CinemaViewport,
} from './CinemaRendererContracts'
import { CINEMA_STATE_RESET_ACTION_IDS } from './CinemaRendererContracts'
import type { CinemaRuntimeNodeRegistration } from './CinemaRuntimeNodeRegistry'
import {
  CINEMATIC_AUDIO_EVENT_SOURCES,
  CINEMATIC_AUDIO_SOURCES,
  CINEMATIC_AUDIO_TARGETS,
  CINEMATIC_NUMERIC_RANGES,
  CINEMATIC_QUALITY_TIERS,
  createCinematicWorldConfig,
  createLegacyPortalCinematicConfig,
  normalizeCinematicWorldConfig,
  resolveSupportedCinematicCameraRig,
  type CinematicAudioEventSource,
  type CinematicAudioSource,
  type CinematicAudioTarget,
  type CinematicQualityTier,
  type CinematicWorldConfig,
  type CinematicWorldMode,
} from '../react/CinematicWorldConfig'
import * as WorldSettings from '../react/CinematicWorldSettings'
import { DEFAULT_REACT_PRESET_RENDER_SETTINGS, type ReactPalette, type ReactPreset, type ReactSectionType } from '../react/ReactTypes'
import type { ReactPerformanceActionEvent } from '../react/ReactPerformanceActions'
import { DEFAULT_REACT_RENDER_PARAMS, type ReactRenderParams } from '../react/renderers/reactRenderUtils'
import {
  cinematicWorldRendererRegistry,
} from '../react/renderers/CinematicPortalRenderer'
import type {
  CinematicCanvasWorldDefinition,
  CinematicFrameContext,
  CinematicRendererResetReason,
  CinematicWebGLServices,
  CinematicWebGLWorldDefinition,
  CinematicWebGLWorldRenderer,
  CinematicWorldDefinition,
  CinematicWorldRenderer,
  CinematicWorldObject3DDrawResult,
  CinematicWorldObject3DService,
  CinematicWorldObject3DSnapshot,
} from '../react/renderers/CinematicWorldRenderer'
import {
  CinematicModulationEngine,
  type CinematicModulationSnapshot,
  type CinematicNormalizedAudioFrame,
} from '../react/renderers/cinematic/CinematicAudioModulation'
import type { CinematicCameraFrame } from '../react/renderers/cinematic/CinematicCameraDirector'
import type { CinematicWorldDirection } from '../react/renderers/cinematic/CinematicWorldDirection'
import { cinematicWorldDefinitions } from '../react/renderers/cinematic/worlds'
import { FullscreenPass, FULLSCREEN_VERT_SRC } from '../react/shaders/runtime/FullscreenPass'
import { ShaderCompiler } from '../react/shaders/runtime/ShaderCompiler'
import { ShaderFramebuffer } from '../react/shaders/runtime/ShaderFramebuffer'
import { ShaderProgram, type ShaderProgramDescriptor } from '../react/shaders/runtime/ShaderProgram'
import { ShaderResourceManager } from '../react/shaders/runtime/ShaderResourceManager'
import { ShaderTexture } from '../react/shaders/runtime/ShaderTexture'
import type { FramebufferDescriptor, TextureDescriptor } from '../react/shaders/runtime/shaderRuntimeTypes'

export const CINEMA_CINEMATIC_WORLD_ADAPTER_VERSION = 1 as const
export const CINEMA_CINEMATIC_WORLD_COLOR_OUTPUT_PORT_ID = cinemaStableId<CinemaPortId>('color', 'port')

const QUALITY_PARAMETER_ID = cinemaStableId<CinemaParameterId>('quality-tier', 'parameter')
const SEED_PARAMETER_ID = cinemaStableId<CinemaParameterId>('seed', 'parameter')
const INTENSITY_PARAMETER_ID = cinemaStableId<CinemaParameterId>('intensity', 'parameter')
const MOTION_PARAMETER_ID = cinemaStableId<CinemaParameterId>('motion', 'parameter')
const GLOW_PARAMETER_ID = cinemaStableId<CinemaParameterId>('glow', 'parameter')
const BASS_REACTIVITY_PARAMETER_ID = cinemaStableId<CinemaParameterId>('bass-reactivity', 'parameter')
const TRAIL_DECAY_PARAMETER_ID = cinemaStableId<CinemaParameterId>('trail-decay', 'parameter')
const FOG_DENSITY_PARAMETER_ID = cinemaStableId<CinemaParameterId>('fog-density', 'parameter')
const PARTICLE_DENSITY_PARAMETER_ID = cinemaStableId<CinemaParameterId>('particle-density', 'parameter')
const CINEMATIC_PALETTE_SPECS = Object.freeze([
  ['primary', 'Primary Color'],
  ['secondary', 'Secondary Color'],
  ['accent', 'Accent Color'],
  ['background', 'Background Color'],
  ['highlight', 'Highlight Color'],
  ['text', 'Foreground Color'],
] as const)

const ENVIRONMENT_PARAMETER_SPECS = Object.freeze([
  ['depth', 'Environment Depth'],
  ['architecture', 'Architecture'],
  ['fog', 'Environment Fog'],
  ['debris', 'Environment Debris'],
  ['stars', 'Stars'],
  ['atmosphere', 'Atmosphere'],
] as const)

const MATERIAL_PARAMETER_SPECS = Object.freeze([
  ['distortion', 'Distortion'],
  ['refraction', 'Refraction'],
  ['bloom', 'Bloom'],
  ['chromaticAberration', 'Chromatic Aberration'],
  ['feedback', 'Feedback'],
  ['glow', 'Material Glow'],
] as const)

const CINEMATIC_WORLD_COMMON_PARAMETER_IDS = Object.freeze([
  INTENSITY_PARAMETER_ID,
  MOTION_PARAMETER_ID,
  GLOW_PARAMETER_ID,
  BASS_REACTIVITY_PARAMETER_ID,
  TRAIL_DECAY_PARAMETER_ID,
  FOG_DENSITY_PARAMETER_ID,
  PARTICLE_DENSITY_PARAMETER_ID,
] as const)

const CINEMA_3D_OBJECT_PARAMETER_ID_SET = new Set<CinemaParameterId>(
  CINEMA_3D_OBJECT_PARAMETER_SCHEMAS.map(parameter => parameter.id),
)

/**
 * Common React parameters that the world renderer itself reads after the
 * Cinema adapter has constructed a frame. These remain live even when a
 * legacy preset supplies its own authored audio mapping. Parameters omitted
 * here can only influence the adapter's fallback modulation snapshot.
 */
const DIRECT_COMMON_PARAMETER_USAGE: Readonly<Partial<Record<CinematicWorldMode, readonly CinemaParameterId[]>>> = Object.freeze({
  legacyPortal: Object.freeze([
    INTENSITY_PARAMETER_ID,
    MOTION_PARAMETER_ID,
    GLOW_PARAMETER_ID,
    BASS_REACTIVITY_PARAMETER_ID,
    FOG_DENSITY_PARAMETER_ID,
    PARTICLE_DENSITY_PARAMETER_ID,
  ]),
  reactiveConstellation: Object.freeze([
    INTENSITY_PARAMETER_ID,
    MOTION_PARAMETER_ID,
    GLOW_PARAMETER_ID,
  ]),
})

/** Environment/material fields read by the direct Cinema world renderers. */
const DIRECT_ENVIRONMENT_PARAMETER_USAGE: Readonly<Partial<Record<CinematicWorldMode, readonly string[]>>> = Object.freeze({
  reactiveConstellation: Object.freeze(['fog', 'atmosphere']),
})

const DIRECT_MATERIAL_PARAMETER_USAGE: Readonly<Partial<Record<CinematicWorldMode, readonly string[]>>> = Object.freeze({
  reactiveConstellation: Object.freeze(['glow']),
})

/**
 * Direct-renderer modulation targets that are fed by Cinema's generic common
 * sliders. This intentionally does not reuse definition.capabilities because
 * those legacy declarations also describe standalone-only post-processing
 * targets, while renderer targets unrelated to common sliders do not affect
 * this visibility decision.
 */
const cinematicAudioTargets = (...targets: CinematicAudioTarget[]): readonly CinematicAudioTarget[] => Object.freeze(targets)

const DIRECT_COMMON_MODULATION_TARGET_USAGE: Readonly<Partial<Record<CinematicWorldMode, readonly CinematicAudioTarget[]>>> = Object.freeze({
  eventHorizon: cinematicAudioTargets('environmentBrightness', 'portalAperture', 'geometryRotation'),
  infiniteCorridor: cinematicAudioTargets('environmentBrightness', 'cameraTravel', 'fogDensity'),
  fractureRift: cinematicAudioTargets('environmentBrightness', 'portalAperture', 'particleEmission'),
  monolithGate: cinematicAudioTargets('environmentBrightness', 'portalAperture', 'cameraTravel'),
  liquidMembrane: cinematicAudioTargets('environmentBrightness', 'portalAperture'),
  celestialCathedral: cinematicAudioTargets('environmentBrightness', 'cameraTravel', 'particleEmission'),
  mirrorDimension: cinematicAudioTargets('environmentBrightness', 'geometryRotation', 'feedback'),
  ancientMachine: cinematicAudioTargets('environmentBrightness', 'portalAperture', 'cameraTravel', 'geometryRotation'),
  stormGateway: cinematicAudioTargets('environmentBrightness', 'portalAperture', 'fogDensity', 'particleEmission'),
  reactiveConstellation: cinematicAudioTargets('environmentBrightness', 'geometryRotation'),
})

/**
 * Authored world settings retained for compatibility but not read by the
 * Cinema production renderer. Event Horizon's two boost fields are consumed
 * only by the standalone post-processing pipeline, which the Cinema graph
 * adapter does not execute. Reactive Constellation's visualDnaProfile is
 * normalized/persisted but has no production render consumer.
 */
const UNCONSUMED_WORLD_SETTING_KEYS: Readonly<Partial<Record<CinematicWorldMode, readonly string[]>>> = Object.freeze({
  eventHorizon: Object.freeze(['bloomBoost', 'chromaticAberrationBoost']),
  reactiveConstellation: Object.freeze(['visualDnaProfile']),
})

const WORLD_BOUNDS: Readonly<Record<string, Readonly<Record<string, readonly [number, number]>>>> = Object.freeze({
  eventHorizon: WorldSettings.EVENT_HORIZON_BOUNDS,
  infiniteCorridor: WorldSettings.INFINITE_CORRIDOR_BOUNDS,
  fractureRift: WorldSettings.FRACTURE_RIFT_BOUNDS,
  monolithGate: WorldSettings.MONOLITH_GATE_BOUNDS,
  liquidMembrane: WorldSettings.LIQUID_MEMBRANE_BOUNDS,
  celestialCathedral: WorldSettings.CELESTIAL_CATHEDRAL_BOUNDS,
  mirrorDimension: WorldSettings.MIRROR_DIMENSION_BOUNDS,
  ancientMachine: WorldSettings.ANCIENT_MACHINE_BOUNDS,
  stormGateway: WorldSettings.STORM_GATEWAY_BOUNDS,
  electricStorm: WorldSettings.ELECTRIC_STORM_BOUNDS,
  reactiveConstellation: WorldSettings.REACTIVE_CONSTELLATION_BOUNDS,
})

const WORLD_COLOR_SETTING_KEYS: Readonly<Partial<Record<CinematicWorldMode, readonly string[]>>> = Object.freeze({
  electricStorm: Object.freeze(['backgroundColor', 'lightningColor']),
})

const REACTIVE_ENUMS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  visualDnaProfile: WorldSettings.REACTIVE_CONSTELLATION_VISUAL_DNA_PROFILES,
  choreographyProfile: WorldSettings.REACTIVE_CONSTELLATION_CHOREOGRAPHY_PROFILES,
  topologyStyle: WorldSettings.REACTIVE_CONSTELLATION_TOPOLOGIES,
  polyhedronStyle: WorldSettings.REACTIVE_CONSTELLATION_POLYHEDRA,
})

const OUTPUT_DESCRIPTOR = Object.freeze({
  colorSpace: 'srgb' as const,
  alphaMode: 'premultiplied' as const,
  colorFormat: 'rgba8' as const,
  hasDepth: false,
  hasMask: false,
})

export interface CinemaCinematicWorldAdapterEntry {
  worldId: CinematicWorldMode
  backend: 'webgl2' | 'canvas2d'
  typeId: CinemaNodeTypeId
  pluginId: CinemaRendererPluginId
  definition: Readonly<CinemaNodeTypeDefinition>
  persistedDefinition: Readonly<CinemaPersistedDefinition>
  plugin: CinemaNodePlugin
}

export interface CinemaCinematicWorldAdapterBundle {
  entries: readonly CinemaCinematicWorldAdapterEntry[]
  persistedDefinitions: readonly CinemaPersistedDefinition[]
  runtimeRegistrations: readonly CinemaRuntimeNodeRegistration[]
}

export interface CinemaCinematicWorldAdapterOptions {
  webglDefinitions?: readonly CinematicWebGLWorldDefinition[]
  legacyDefinition?: CinematicCanvasWorldDefinition | null
  createCanvas?: () => HTMLCanvasElement
}

export function cinemaCinematicWorldTypeId(worldId: string): CinemaNodeTypeId {
  return cinemaNamespacedId<CinemaNodeTypeId>(`drmvyz.cinema.cinematic-world.${namespacedSegment(worldId)}`, 'node type')
}

export function cinemaCinematicWorldPluginId(worldId: string): CinemaRendererPluginId {
  return cinemaNamespacedId<CinemaRendererPluginId>(`drmvyz.cinema.renderer.cinematic-world.${namespacedSegment(worldId)}`, 'renderer plugin')
}

export function cinemaCinematicWorldParameterId(name: string): CinemaParameterId {
  return cinemaStableId<CinemaParameterId>(stableSegment(name), 'parameter')
}

export function createCinemaCinematicWorldAdapterBundle(
  options: CinemaCinematicWorldAdapterOptions = {},
): CinemaCinematicWorldAdapterBundle {
  const webglDefinitions = options.webglDefinitions ?? cinematicWorldDefinitions
  const legacyDefinition = options.legacyDefinition === undefined
    ? resolveLegacyPortalDefinition()
    : options.legacyDefinition
  const entries: CinemaCinematicWorldAdapterEntry[] = webglDefinitions.map(definition => (
    createWebGLAdapterEntry(definition)
  ))
  if (legacyDefinition) entries.push(createCanvas2DAdapterEntry(legacyDefinition, options.createCanvas))
  return deepFreeze({
    entries,
    persistedDefinitions: entries.map(entry => entry.persistedDefinition),
    runtimeRegistrations: entries.map(entry => ({ pluginId: entry.pluginId, plugin: entry.plugin })),
  })
}

export const CINEMA_CINEMATIC_WORLD_ADAPTER_BUNDLE = createCinemaCinematicWorldAdapterBundle()

export function createCinemaCinematicWorldComposition(
  worldId: CinematicWorldMode,
  outputTypeId: CinemaNodeTypeId,
  outputInputPortId: CinemaPortId,
  options: {
    compositionId?: CinemaCompositionId
    worldNodeId?: CinemaNodeId
    outputNodeId?: CinemaNodeId
    outputNodeFamily?: CinemaNodeDefinition['family']
    name?: string
    description?: string
  } = {},
): CinemaCompositionDefinition {
  const entry = CINEMA_CINEMATIC_WORLD_ADAPTER_BUNDLE.entries.find(candidate => candidate.worldId === worldId)
  if (!entry) throw new Error(`Cinematic World "${worldId}" is not registered for Cinema.`)
  const compositionId = options.compositionId ?? cinemaStableId<CinemaCompositionId>(stableSegment(`cinematic-${worldId}`), 'composition')
  const worldNodeId = options.worldNodeId ?? cinemaStableId<CinemaNodeId>(stableSegment(`${worldId}-node`), 'node')
  const outputNodeId = options.outputNodeId ?? cinemaStableId<CinemaNodeId>(stableSegment(`${worldId}-output`), 'node')
  const connectionId = cinemaStableId<CinemaConnectionId>(stableSegment(`${worldId}-to-output`), 'connection')
  return deepFreeze({
    schemaId: CINEMA_COMPOSITION_SCHEMA_ID,
    schemaVersion: CINEMA_COMPOSITION_SCHEMA_VERSION,
    id: compositionId,
    revision: 1,
    metadata: {
      name: options.name ?? `${entry.definition.label} Cinema Adapter`,
      description: options.description ?? `Cinematic World ${entry.definition.label} rendered inside the Cinema-owned graph runtime.`,
      tags: ['cinematic-world', worldId, entry.backend],
      provenance: { builtIn: true, stage: 10, adapterVersion: CINEMA_CINEMATIC_WORLD_ADAPTER_VERSION },
    },
    nodes: [
      {
        id: worldNodeId,
        typeId: entry.typeId,
        typeVersion: entry.definition.version,
        family: 'procedural',
        label: entry.definition.label,
        enabled: true,
        opacity: 1,
        parameterValues: Object.fromEntries(entry.definition.parameters.filter(parameter => 'default' in parameter).map(parameter => [parameter.id, parameter.default])) as Record<CinemaParameterId, CinemaParameterValue>,
      },
      {
        id: outputNodeId,
        typeId: outputTypeId,
        typeVersion: 1,
        family: options.outputNodeFamily ?? 'output',
        label: 'Cinema Output',
        enabled: true,
        opacity: 1,
        parameterValues: {},
      },
    ],
    connections: [{
      id: connectionId,
      from: { nodeId: worldNodeId, portId: CINEMA_CINEMATIC_WORLD_COLOR_OUTPUT_PORT_ID },
      to: { nodeId: outputNodeId, portId: outputInputPortId },
      enabled: true,
    }],
    outputNodeId,
    masterParameters: [],
    masterValues: {},
    cameras: createCinemaCameraResources(worldId),
    assetBindings: [],
    modulationRoutes: [],
    performanceRules: [],
  })
}


export function createCinemaCinematicPresetComposition(
  preset: ReactPreset,
  outputTypeId: CinemaNodeTypeId,
  outputInputPortId: CinemaPortId,
  options: {
    compositionId?: CinemaCompositionId
    worldNodeId?: CinemaNodeId
    outputNodeId?: CinemaNodeId
    outputNodeFamily?: CinemaNodeDefinition['family']
  } = {},
): CinemaCompositionDefinition {
  if (preset.engine !== 'cinematicPortal') {
    throw new Error(`React preset "${preset.id}" is not a Cinematic Worlds preset.`)
  }
  const config = normalizeCinematicWorldConfig(preset.cinematicConfig ?? createLegacyPortalCinematicConfig({
    ...preset.params,
    ...DEFAULT_REACT_PRESET_RENDER_SETTINGS,
    ...preset.renderSettings,
  }))
  const entry = CINEMA_CINEMATIC_WORLD_ADAPTER_BUNDLE.entries.find(candidate => candidate.worldId === config.worldMode)
  if (!entry) throw new Error(`Cinematic World "${config.worldMode}" is not registered for Cinema.`)
  const compositionId = options.compositionId ?? cinemaStableId<CinemaCompositionId>(stableSegment(`cinematic-preset-${preset.id}`), 'composition')
  const worldNodeId = options.worldNodeId ?? cinemaStableId<CinemaNodeId>(stableSegment(`${preset.id}-world`), 'node')
  const outputNodeId = options.outputNodeId ?? cinemaStableId<CinemaNodeId>(stableSegment(`${preset.id}-output`), 'node')
  const base = createCinemaCinematicWorldComposition(config.worldMode, outputTypeId, outputInputPortId, {
    compositionId,
    worldNodeId,
    outputNodeId,
    outputNodeFamily: options.outputNodeFamily,
    name: preset.name,
    description: preset.description,
  })
  return deepFreeze({
    ...base,
    metadata: {
      ...base.metadata,
      name: preset.name,
      description: preset.description,
      tags: ['built-in', 'legacy-catalog', 'cinematic-worlds', config.worldMode],
      provenance: {
        builtIn: true,
        stage: 21,
        catalogVersion: 1,
        sourceEngine: 'cinematicPortal',
        sourceId: preset.id,
        worldId: config.worldMode,
        adapter: 'cinematic-world',
        adapterVersion: CINEMA_CINEMATIC_WORLD_ADAPTER_VERSION,
      },
    },
    nodes: base.nodes.map(node => node.id === worldNodeId ? {
      ...node,
      label: preset.name,
      parameterValues: createCinematicPresetParameterValues(entry.definition.parameters, preset, config),
      metadata: {
        ...node.metadata,
        legacyCinematicPreset: cloneJson({
          id: preset.id,
          name: preset.name,
          description: preset.description,
          palette: preset.palette,
          params: preset.params,
          renderSettings: {
            ...DEFAULT_REACT_PRESET_RENDER_SETTINGS,
            ...preset.renderSettings,
          },
          scenes: preset.scenes,
          sectionMappings: preset.sectionMappings,
          cinematicConfig: config,
        }) as unknown as CinemaJsonObject,
      },
    } : node),
    cameras: createCinemaCameraResources(config.worldMode, config),
  })
}

function createCinemaCameraResources(
  worldId: CinematicWorldMode,
  authoredConfig?: CinematicWorldConfig,
): readonly CinemaCameraResourceDefinition[] {
  const definition = cinematicWorldDefinitions.find(candidate => candidate.id === worldId)
  if (!definition?.direction) return []
  const defaults = authoredConfig ? normalizeCinematicWorldConfig(authoredConfig) : createBaseConfig(worldId)
  const direction = definition.direction
  const minDepth = direction.safeCameraRange.minDepth ?? direction.safeCameraRange.minDistance
  const maxDepth = direction.safeCameraRange.maxDepth ?? direction.safeCameraRange.maxDistance
  const flyThroughPath = direction.flyThroughPaths?.[0]?.map(point => ({
    position: [point.position.x, point.position.y, point.position.z] as const,
    ...(point.rotation
      ? { rotation: [point.rotation.x ?? 0, point.rotation.y ?? 0, point.rotation.z ?? 0] as const }
      : {}),
    ...(point.fieldOfView != null ? { fovDegrees: point.fieldOfView } : {}),
  }))
  const safePosition = {
    x: clampToRange(defaults.camera.locked.position.x, -direction.safeCameraRange.maxLateral, direction.safeCameraRange.maxLateral),
    y: clampToRange(defaults.camera.locked.position.y, direction.safeCameraRange.minElevation, direction.safeCameraRange.maxElevation),
    z: clampToRange(defaults.camera.locked.position.z, minDepth, maxDepth),
  }
  const cameraId = cinemaStableId<CinemaCameraId>(stableSegment(`${worldId}-shared-camera`), 'camera')
  return [deepFreeze({
    id: cameraId,
    label: `${definition.label} Shared Camera`,
    mode: authoredConfig
      ? cameraResourceMode(resolveSupportedCinematicCameraRig(defaults.cameraRig, direction.supportedCameraRigs, 'locked'))
      : direction.supportedCameraRigs.includes('autoDirector') ? 'auto-director' : 'locked',
    parameterValues: {
      [cinemaCinematicWorldParameterId('position')]: [
        safePosition.x,
        safePosition.y,
        safePosition.z,
      ],
      [cinemaCinematicWorldParameterId('rotation')]: [
        defaults.camera.locked.rotation.x,
        defaults.camera.locked.rotation.y,
        defaults.camera.locked.rotation.z,
      ],
      [cinemaCinematicWorldParameterId('target')]: [0, 0, 0],
      [cinemaCinematicWorldParameterId('fov-degrees')]: defaults.camera.locked.fieldOfView,
      [cinemaCinematicWorldParameterId('roll-radians')]: 0,
      [cinemaCinematicWorldParameterId('near')]: 0.05,
      [cinemaCinematicWorldParameterId('far')]: Math.max(100, direction.safeCameraRange.maxDistance * 25),
      [cinemaCinematicWorldParameterId('orbit-radius')]: defaults.camera.orbit.radius,
      [cinemaCinematicWorldParameterId('orbit-speed')]: defaults.camera.orbit.angularSpeed,
      [cinemaCinematicWorldParameterId('orbit-elevation')]: defaults.camera.orbit.elevation,
      [cinemaCinematicWorldParameterId('dolly-range')]: defaults.camera.dolly.range,
      [cinemaCinematicWorldParameterId('dolly-speed')]: defaults.camera.dolly.speed,
      [cinemaCinematicWorldParameterId('fly-speed')]: defaults.camera.flyThrough.speed,
      [cinemaCinematicWorldParameterId('banking')]: defaults.camera.flyThrough.banking,
      [cinemaCinematicWorldParameterId('shake')]: defaults.camera.handheld.impactShake,
      [cinemaCinematicWorldParameterId('beat-punch')]: defaults.camera.locked.beatPunch,
      [cinemaCinematicWorldParameterId('handheld')]: defaults.camera.handheld.strength,
      [cinemaCinematicWorldParameterId('focus-distance')]: 4,
      [cinemaCinematicWorldParameterId('aperture')]: 0,
    },
    ...(flyThroughPath ? { path: flyThroughPath } : {}),
    safeRange: {
      minPosition: [-direction.safeCameraRange.maxLateral, direction.safeCameraRange.minElevation, minDepth],
      maxPosition: [direction.safeCameraRange.maxLateral, direction.safeCameraRange.maxElevation, maxDepth],
      minFovDegrees: direction.safeCameraRange.minFieldOfView,
      maxFovDegrees: direction.safeCameraRange.maxFieldOfView,
      minNear: 0.01,
      maxFar: Math.max(100, direction.safeCameraRange.maxDistance * 25),
    },
    authoredShots: direction.shots.map(shot => {
      const position = shot.pose?.position
        ? [shot.pose.position.x ?? defaults.camera.locked.position.x, shot.pose.position.y ?? defaults.camera.locked.position.y, shot.pose.position.z ?? defaults.camera.locked.position.z] as const
        : null
      const rotation = shot.pose?.rotation
        ? [shot.pose.rotation.x ?? defaults.camera.locked.rotation.x, shot.pose.rotation.y ?? defaults.camera.locked.rotation.y, shot.pose.rotation.z ?? defaults.camera.locked.rotation.z] as const
        : null
      const path = shot.rig === 'flyThrough' ? flyThroughPath : null
      return {
        id: shot.id,
        mode: cinemaCameraModeForRig(shot.rig),
        sections: [...shot.sections],
        ...(shot.weight != null ? { weight: shot.weight } : {}),
        ...(shot.minimumDurationSec != null ? { minimumDurationSec: shot.minimumDurationSec } : {}),
        ...(position ? { position } : {}),
        ...(rotation ? { rotation } : {}),
        ...(shot.pose?.fieldOfView != null ? { fovDegrees: shot.pose.fieldOfView } : {}),
        ...(path ? { path } : {}),
        metadata: { legacyAction: shot.action ?? 'hold' },
      }
    }),
    metadata: {
      source: 'cinematic-world-direction',
      worldId,
      supportedCameraRigs: [...direction.supportedCameraRigs],
    },
  })]
}

function cinemaCameraModeForRig(
  rig: CinematicWorldDirection['supportedCameraRigs'][number],
): Exclude<CinemaCameraResourceDefinition['mode'], 'auto-director'> {
  if (rig === 'flyThrough') return 'fly'
  if (rig === 'autoDirector') return 'locked'
  return rig
}


function cameraResourceMode(
  rig: CinematicWorldDirection['supportedCameraRigs'][number],
): CinemaCameraResourceDefinition['mode'] {
  return rig === 'autoDirector' ? 'auto-director' : cinemaCameraModeForRig(rig)
}

function createCinematicPresetParameterValues(
  definitions: readonly CinemaParameterDefinition[],
  preset: ReactPreset,
  config: CinematicWorldConfig,
): Record<CinemaParameterId, CinemaParameterValue> {
  const values = Object.fromEntries(definitions.filter(parameter => 'default' in parameter).map(parameter => [parameter.id, parameter.default])) as Record<CinemaParameterId, CinemaParameterValue>
  const renderSettings = { ...DEFAULT_REACT_PRESET_RENDER_SETTINGS, ...preset.renderSettings }
  values[INTENSITY_PARAMETER_ID] = preset.params.intensity
  values[MOTION_PARAMETER_ID] = preset.params.motion
  values[GLOW_PARAMETER_ID] = preset.params.glow
  values[BASS_REACTIVITY_PARAMETER_ID] = preset.params.bassReactivity
  values[TRAIL_DECAY_PARAMETER_ID] = renderSettings.trailDecay
  values[FOG_DENSITY_PARAMETER_ID] = renderSettings.fogDensity
  values[PARTICLE_DENSITY_PARAMETER_ID] = renderSettings.particleDensity
  values[SEED_PARAMETER_ID] = config.seed
  values[QUALITY_PARAMETER_ID] = qualityOptionId(config.qualityTier)
  for (const [role] of CINEMATIC_PALETTE_SPECS) {
    values[cinemaCinematicWorldParameterId(`palette-${role}`)] = hexToCinemaColor(preset.palette[role])
  }
  for (const [key] of ENVIRONMENT_PARAMETER_SPECS) values[cinemaCinematicWorldParameterId(`environment-${key}`)] = config.environment[key]
  for (const [key] of MATERIAL_PARAMETER_SPECS) values[cinemaCinematicWorldParameterId(`material-${key}`)] = config.material[key]
  for (const [key, value] of Object.entries(config.worldSettings.settings as Record<string, unknown>)) {
    if (typeof value === 'number') values[worldParameterId(key)] = value
    else if (typeof value === 'string') {
      values[worldParameterId(key)] = isWorldColorSetting(config.worldMode, key)
        ? hexToCinemaColor(value)
        : worldEnumOptionId(key, value)
    }
  }
  return values
}

function createWebGLAdapterEntry(definition: CinematicWebGLWorldDefinition): CinemaCinematicWorldAdapterEntry {
  const typeId = cinemaCinematicWorldTypeId(definition.id)
  const pluginId = cinemaCinematicWorldPluginId(definition.id)
  const nodeDefinition = createNodeDefinition(definition, typeId, 'webgl2')
  const plugin: CinemaNodePlugin = Object.freeze({
    definition: nodeDefinition,
    createNode(node: Readonly<CinemaNodeDefinition>) {
      return new CinematicWorldNodeAdapter(node.id, node.opacity, definition, nodeDefinition, readLegacyCinematicPreset(node))
    },
  })
  return deepFreeze({
    worldId: definition.id as CinematicWorldMode,
    backend: 'webgl2',
    typeId,
    pluginId,
    definition: nodeDefinition,
    persistedDefinition: createPersistedDefinition(definition.id, nodeDefinition, pluginId, definition.id === 'reactiveConstellation'),
    plugin,
  })
}

function createCanvas2DAdapterEntry(
  definition: CinematicCanvasWorldDefinition,
  createCanvas?: () => HTMLCanvasElement,
): CinemaCinematicWorldAdapterEntry {
  const typeId = cinemaCinematicWorldTypeId(definition.id)
  const pluginId = cinemaCinematicWorldPluginId(definition.id)
  const nodeDefinition = createNodeDefinition(definition, typeId, 'canvas2d')
  const plugin: CinemaNodePlugin = Object.freeze({
    definition: nodeDefinition,
    createNode(node: Readonly<CinemaNodeDefinition>) {
      return new CinemaCanvas2DNodeAdapter(node.id, node.opacity, definition, nodeDefinition, createCanvas, readLegacyCinematicPreset(node))
    },
  })
  return deepFreeze({
    worldId: definition.id as CinematicWorldMode,
    backend: 'canvas2d',
    typeId,
    pluginId,
    definition: nodeDefinition,
    persistedDefinition: createPersistedDefinition(definition.id, nodeDefinition, pluginId, false),
    plugin,
  })
}

function createNodeDefinition(
  definition: CinematicWorldDefinition,
  typeId: CinemaNodeTypeId,
  backend: 'webgl2' | 'canvas2d',
): Readonly<CinemaNodeTypeDefinition> {
  const specialized = definition.id === 'reactiveConstellation'
  const direction = definition.direction
  const object3dSlots = backend === 'webgl2' && definition.backend === 'webgl2'
    ? definition.object3dSlots ?? []
    : []
  const parameters = [
    ...createParameterDefinitions(definition.id as CinematicWorldMode),
    ...(object3dSlots.length > 0 ? CINEMA_3D_OBJECT_PARAMETER_SCHEMAS : []),
  ]
  const outputDescriptor = {
    ...OUTPUT_DESCRIPTOR,
    hasDepth: definition.capabilities.supportsGeometryPasses,
  }
  return deepFreeze({
    typeId,
    version: CINEMA_CINEMATIC_WORLD_ADAPTER_VERSION,
    label: definition.label,
    description: backend === 'canvas2d'
      ? 'Legacy Canvas2D Cinematic World rasterized offscreen and uploaded through the Cinema-owned WebGL graph.'
      : `Cinematic World ${definition.label} rendered into a Cinema-owned target without a competing canvas or animation loop.`,
    family: 'procedural',
    inputPorts: [],
    outputPorts: [{
      id: CINEMA_CINEMATIC_WORLD_COLOR_OUTPUT_PORT_ID,
      label: 'Color',
      direction: 'output',
      dataType: 'color-texture',
    }],
    parameters,
    parameterCapabilities: [
      ...createCinematicWorldParameterCapabilities(
        definition,
        parameters.filter(parameter => !CINEMA_3D_OBJECT_PARAMETER_ID_SET.has(parameter.id)),
        backend,
      ),
      ...(object3dSlots.length > 0 ? CINEMA_3D_OBJECT_PARAMETER_CAPABILITIES : []),
    ],
    capabilities: {
      backends: backend === 'canvas2d' ? ['webgl2', 'canvas2d'] : ['webgl2'],
      canvas2d: {
        compatibility: backend === 'canvas2d' ? 'raster-upload' : 'unsupported',
        preservesPremultipliedAlpha: true,
      },
      camera: {
        mode: direction ? 'worldCamera' : 'none',
        controls: cinematicWorldCameraControls(direction),
        autoDirector: direction?.supportedCameraRigs.includes('autoDirector') ?? false,
      },
      palette: { roles: cinematicWorldPaletteRoles(definition) },
      requires: backend === 'canvas2d' ? { webgl2: true, canvas2d: true } : { webgl2: true },
      fallbacks: [
        {
          capability: 'webgl2',
          behavior: 'safe-output',
          message: 'Cinematic World adapters require the Cinema-owned WebGL2 runtime.',
        },
        ...(backend === 'canvas2d' ? [{
          capability: 'canvas2d' as const,
          behavior: 'disable-node' as const,
          message: 'Legacy Portal requires an offscreen Canvas2D context for compatibility upload.',
        }] : []),
      ],
    },
    cost: {
      cpu: specialized ? 'high' : backend === 'canvas2d' ? 'medium' : 'low',
      gpu: specialized ? 'high' : 'medium',
      estimatedPassCount: specialized ? 3 : backend === 'canvas2d' ? 2 : 1,
      persistentTargetCount: 0,
      pingPongPairCount: 0,
      ...(specialized ? { estimatedTextureMemoryMb: 24 } : {}),
    },
    seekPolicy: specialized
      ? { mode: 'reset-at-position', seedScope: 'musical-position' }
      : { mode: 'reset-at-position', seedScope: 'track' },
    output: outputDescriptor,
    metadata: {
      adapter: 'CinematicWorldNodeAdapter',
      adapterVersion: CINEMA_CINEMATIC_WORLD_ADAPTER_VERSION,
      worldId: definition.id,
      backend,
      specializedProceduralRenderer: specialized,
      legacyCapabilities: cloneJson(definition.capabilities) as unknown as CinemaJsonObject,
      direction: cloneJson(direction ?? null) as unknown as CinemaJsonObject,
      safeCameraRange: cloneJson(direction?.safeCameraRange ?? null) as unknown as CinemaJsonObject,
      authoredShots: cloneJson(direction?.shots ?? []) as unknown as CinemaJsonObject,
      postStackInputsRetained: definition.capabilities.supportsPostProcessing,
      standaloneEngineRetained: true,
      object3dSlotIds: object3dSlots.map(slot => slot.id),
      object3dControlsExposed: object3dSlots.length > 0,
      rendererOwnsTargetClear: backend === 'webgl2' && definition.backend === 'webgl2' && definition.ownsTargetClear === true,
    },
  })
}

function cinematicWorldCameraControls(
  direction: Readonly<CinematicWorldDirection> | undefined,
): readonly CinemaCameraControl[] {
  if (!direction) return Object.freeze([])
  const rigs = new Set(direction.supportedCameraRigs)
  const controls = new Set<CinemaCameraControl>(['position', 'rotation', 'fov', 'roll'])
  if (rigs.has('locked') || rigs.has('autoDirector')) controls.add('beat-punch')
  if (rigs.has('orbit')) {
    controls.add('target')
    controls.add('orbit')
    controls.add('speed')
    controls.add('banking')
  }
  if (rigs.has('dolly')) {
    controls.add('dolly')
    controls.add('speed')
    controls.add('beat-punch')
  }
  if (rigs.has('flyThrough')) {
    controls.add('speed')
    controls.add('banking')
  }
  if (rigs.has('handheld')) {
    controls.add('handheld')
    controls.add('shake')
    controls.add('beat-punch')
  }
  return Object.freeze([...controls])
}

function cinematicWorldPaletteRoles(definition: CinematicWorldDefinition): readonly CinemaBrandRole[] {
  return Object.freeze((definition.capabilities.paletteRoles ?? []).map(role => (
    role === 'text' ? 'foreground' : role
  )))
}

function createCinematicWorldParameterCapabilities(
  definition: CinematicWorldDefinition,
  parameters: readonly CinemaParameterDefinition[],
  backend: 'webgl2' | 'canvas2d',
): readonly CinemaParameterCapabilityDescriptor[] {
  const worldId = definition.id as CinematicWorldMode
  const targets = new Set(DIRECT_COMMON_MODULATION_TARGET_USAGE[worldId] ?? [])
  const paletteRoles = new Set<CinemaBrandRole>(cinematicWorldPaletteRoles(definition))
  const directCommon = new Set(DIRECT_COMMON_PARAMETER_USAGE[worldId] ?? [])
  const directEnvironment = new Set(DIRECT_ENVIRONMENT_PARAMETER_USAGE[worldId] ?? [])
  const directMaterial = new Set(DIRECT_MATERIAL_PARAMETER_USAGE[worldId] ?? [])
  const unconsumedWorldSettings = new Set((UNCONSUMED_WORLD_SETTING_KEYS[worldId] ?? []).map(worldParameterId))
  const paletteParameterRoles = new Map<CinemaParameterId, CinemaBrandRole>(CINEMATIC_PALETTE_SPECS.map(([role]) => [
    cinemaCinematicWorldParameterId(`palette-${role}`),
    role === 'text' ? 'foreground' : role,
  ]))
  const commonSupport = new Map<CinemaParameterId, boolean>([
    [INTENSITY_PARAMETER_ID, directCommon.has(INTENSITY_PARAMETER_ID)],
    [MOTION_PARAMETER_ID, directCommon.has(MOTION_PARAMETER_ID) || targets.has('cameraTravel') || targets.has('cameraMotion') || targets.has('geometryRotation')],
    [GLOW_PARAMETER_ID, directCommon.has(GLOW_PARAMETER_ID) || targets.has('bloom') || targets.has('environmentBrightness') || targets.has('atmosphere') || targets.has('glow')],
    [BASS_REACTIVITY_PARAMETER_ID, directCommon.has(BASS_REACTIVITY_PARAMETER_ID) || targets.has('portalAperture')],
    [TRAIL_DECAY_PARAMETER_ID, directCommon.has(TRAIL_DECAY_PARAMETER_ID) || targets.has('feedback')],
    [FOG_DENSITY_PARAMETER_ID, directCommon.has(FOG_DENSITY_PARAMETER_ID) || targets.has('fogDensity') || targets.has('fog')],
    [PARTICLE_DENSITY_PARAMETER_ID, directCommon.has(PARTICLE_DENSITY_PARAMETER_ID) || targets.has('particleEmission') || targets.has('debris')],
  ])
  return parameters.map(parameter => {
    const paletteRole = paletteParameterRoles.get(parameter.id)
    if (paletteRole) {
      const supported = paletteRoles.has(paletteRole)
      return {
        parameterId: parameter.id,
        support: supported ? 'live' as const : 'unsupported' as const,
        ...(!supported ? { reason: `This Cinematic World does not consume the ${paletteRole} palette role.` } : {}),
      }
    }
    if (parameter.id === SEED_PARAMETER_ID) return { parameterId: parameter.id, support: 'structural' as const }
    if (parameter.id === QUALITY_PARAMETER_ID) {
      const supported = backend === 'webgl2'
      return {
        parameterId: parameter.id,
        support: supported ? 'structural' as const : 'unsupported' as const,
        ...(!supported ? { reason: 'The Legacy Portal Canvas2D renderer does not consume the authored quality tier.' } : {}),
      }
    }
    const common = commonSupport.get(parameter.id)
    if (common === false) {
      return {
        parameterId: parameter.id,
        support: 'unsupported' as const,
        reason: 'This Cinematic World does not advertise the modulation/runtime target consumed by this parameter.',
      }
    }
    if (common === true) return { parameterId: parameter.id, support: 'live' as const }

    const environmentKey = environmentParameterKey(parameter.id)
    if (environmentKey) {
      const supported = directEnvironment.has(environmentKey)
      return {
        parameterId: parameter.id,
        support: supported ? 'live' as const : 'unsupported' as const,
        ...(!supported ? { reason: 'This Cinema world renderer does not read this environment field.' } : {}),
      }
    }
    const materialKey = materialParameterKey(parameter.id)
    if (materialKey) {
      const supported = directMaterial.has(materialKey)
      return {
        parameterId: parameter.id,
        support: supported ? 'live' as const : 'unsupported' as const,
        ...(!supported ? { reason: 'This Cinema world renderer does not read this material field.' } : {}),
      }
    }
    if (unconsumedWorldSettings.has(parameter.id)) {
      return {
        parameterId: parameter.id,
        support: 'unsupported' as const,
        reason: 'This authored world setting is retained for compatibility but has no reachable Cinema production renderer consumer.',
      }
    }
    return { parameterId: parameter.id, support: 'live' as const }
  })
}

/**
 * Applies the active preset's runtime branch on top of the renderer-owned
 * definition capability map. Legacy preset-backed nodes with authored audio
 * mappings bypass Cinema's fallback modulation snapshot, so common sliders
 * that only feed that fallback path must disappear for those presets.
 */
export function getCinemaCinematicWorldSupportedParameterSchemasForNode(
  definition: Readonly<CinemaNodeTypeDefinition>,
  node: Readonly<CinemaNodeDefinition>,
): readonly CinemaParameterDefinition[] {
  if (definition.metadata?.adapter !== 'CinematicWorldNodeAdapter') return Object.freeze([])
  const declared = new Map((definition.parameterCapabilities ?? []).map(capability => [capability.parameterId, capability]))
  const hideObjectControls = definition.metadata?.object3dControlsExposed === false
  const staticallySupported = definition.parameters.filter(parameter => (
    declared.get(parameter.id)?.support !== 'unsupported'
    && (!hideObjectControls || !CINEMA_3D_OBJECT_PARAMETER_ID_SET.has(parameter.id))
  ))
  const sourcePreset = readLegacyCinematicPreset(node)
  if (!sourcePreset?.cinematicConfig?.audioMapping.enabled) return Object.freeze(staticallySupported)

  const worldId = sourcePreset.cinematicConfig.worldMode
  const directCommon = new Set(DIRECT_COMMON_PARAMETER_USAGE[worldId] ?? [])
  const commonIds = new Set<CinemaParameterId>(CINEMATIC_WORLD_COMMON_PARAMETER_IDS)
  return Object.freeze(staticallySupported.filter(parameter => (
    !commonIds.has(parameter.id) || directCommon.has(parameter.id)
  )))
}

function environmentParameterKey(parameterId: CinemaParameterId): string | null {
  for (const [key] of ENVIRONMENT_PARAMETER_SPECS) {
    if (parameterId === cinemaCinematicWorldParameterId(`environment-${key}`)) return key
  }
  return null
}

function materialParameterKey(parameterId: CinemaParameterId): string | null {
  for (const [key] of MATERIAL_PARAMETER_SPECS) {
    if (parameterId === cinemaCinematicWorldParameterId(`material-${key}`)) return key
  }
  return null
}

function createPersistedDefinition(
  worldId: string,
  definition: Readonly<CinemaNodeTypeDefinition>,
  pluginId: CinemaRendererPluginId,
  specialized: boolean,
): Readonly<CinemaPersistedDefinition> {
  return deepFreeze({
    id: definition.typeId,
    definition,
    rendererPluginId: pluginId,
    source: { kind: 'adapter', id: `cinematic-world:${worldId}` },
    quality: {
      minimumTier: 'low',
      maximumTier: 'ultra',
      adaptive: true,
      maximumEstimatedPassCount: specialized ? 4 : 2,
      maximumPersistentTargetCount: 0,
      maximumPingPongPairCount: 0,
    },
  })
}

function createParameterDefinitions(worldId: CinematicWorldMode): readonly CinemaParameterDefinition[] {
  const defaults = createBaseConfig(worldId)
  const common: CinemaParameterDefinition[] = [
    floatParameter(INTENSITY_PARAMETER_ID, 'Intensity', 0.7, 0, 1, 0),
    floatParameter(MOTION_PARAMETER_ID, 'Motion', 0.5, 0, 1, 1),
    floatParameter(GLOW_PARAMETER_ID, 'Glow', 0.65, 0, 1, 2),
    floatParameter(BASS_REACTIVITY_PARAMETER_ID, 'Bass Reactivity', 0.8, 0, 1, 3),
    floatParameter(TRAIL_DECAY_PARAMETER_ID, 'Trail Decay', 0.08, 0, 1, 4),
    floatParameter(FOG_DENSITY_PARAMETER_ID, 'Fog Density', 0.5, 0, 1, 5),
    floatParameter(PARTICLE_DENSITY_PARAMETER_ID, 'Particle Density', 0.5, 0, 1, 6),
    {
      id: SEED_PARAMETER_ID,
      label: 'Seed',
      type: 'integer',
      default: defaults.seed,
      min: CINEMATIC_NUMERIC_RANGES.seed.min,
      max: CINEMATIC_NUMERIC_RANGES.seed.max,
      step: 1,
      modulatable: false,
      ui: { control: 'number', order: 7 },
    },
    {
      id: QUALITY_PARAMETER_ID,
      label: 'Quality Tier',
      type: 'enum',
      default: qualityOptionId(defaults.qualityTier),
      options: CINEMATIC_QUALITY_TIERS.map(value => ({ id: qualityOptionId(value), label: titleCase(value) })),
      modulatable: false,
      ui: { control: 'select', order: 8 },
    },
  ]
  for (const [role, label] of CINEMATIC_PALETTE_SPECS) {
    common.push({
      id: cinemaCinematicWorldParameterId(`palette-${role}`),
      label,
      type: 'color',
      default: hexToCinemaColor(defaultPalette()[role]),
      modulatable: true,
      brandRole: role === 'text' ? 'foreground' : role,
      brandPolicy: 'free',
      ui: { control: 'color', order: 10 + CINEMATIC_PALETTE_SPECS.findIndex(entry => entry[0] === role) },
    })
  }
  let order = 20
  for (const [key, label] of ENVIRONMENT_PARAMETER_SPECS) {
    const range = CINEMATIC_NUMERIC_RANGES.environment[key]
    common.push(floatParameter(cinemaCinematicWorldParameterId(`environment-${key}`), label, defaults.environment[key], range.min, range.max, order++))
  }
  for (const [key, label] of MATERIAL_PARAMETER_SPECS) {
    const range = CINEMATIC_NUMERIC_RANGES.material[key]
    common.push(floatParameter(cinemaCinematicWorldParameterId(`material-${key}`), label, defaults.material[key], range.min, range.max, order++))
  }
  const settings = defaults.worldSettings.settings as Record<string, unknown>
  const bounds = WORLD_BOUNDS[worldId] ?? {}
  for (const [key, value] of Object.entries(settings)) {
    const id = worldParameterId(key)
    if (typeof value === 'number') {
      const range = bounds[key] ?? [Math.min(0, value), Math.max(1, value)]
      const integer = Number.isInteger(value) && Number.isInteger(range[0]) && Number.isInteger(range[1])
      common.push(integer ? {
        id,
        label: titleCase(key),
        type: 'integer',
        default: value,
        min: range[0],
        max: range[1],
        step: 1,
        modulatable: true,
        ui: { control: 'number', order: order++ },
      } : floatParameter(id, titleCase(key), value, range[0], range[1], order++))
      continue
    }
    if (typeof value === 'string') {
      if (isWorldColorSetting(worldId, key)) {
        // No brandPolicy/brandRole here: unlike the palette-role common
        // colors above, these are world-authored colors with no Brand Kit
        // semantic role, and the shared parameter-schema validator rejects
        // a brandPolicy declared without a matching brandRole.
        common.push({
          id,
          label: titleCase(key),
          type: 'color',
          default: hexToCinemaColor(value),
          modulatable: false,
          ui: { control: 'color', order: order++ },
        })
        continue
      }
      const options = REACTIVE_ENUMS[key] ?? [value]
      common.push({
        id,
        label: titleCase(key),
        type: 'enum',
        default: worldEnumOptionId(key, value),
        options: options.map(option => ({ id: worldEnumOptionId(key, option), label: titleCase(option) })),
        modulatable: false,
        ui: { control: 'select', order: order++ },
      })
    }
  }
  return common
}

export class CinematicWorldNodeAdapter implements CinemaRenderNode {
  readonly typeId: CinemaNodeTypeId
  private renderer: CinematicWebGLWorldRenderer | null = null
  private scope: CinematicWebGLServiceScope | null = null
  private object3dBridge: CinemaCinematicWorldObject3DBridge | null = null
  private configKey = ''
  private disposed = false
  private readonly modulationEngine = new CinematicModulationEngine()

  constructor(
    readonly nodeId: CinemaNodeId,
    private readonly authoredOpacity: number,
    private readonly legacyDefinition: CinematicWebGLWorldDefinition,
    definition: Readonly<CinemaNodeTypeDefinition>,
    private readonly sourcePreset: ReactPreset | null = null,
  ) {
    this.typeId = definition.typeId
  }

  initialize(context: CinemaNodeInitializeContext): void | Promise<void> {
    if (context.signal.aborted) throw new DOMException('Cinema node initialization was cancelled.', 'AbortError')
    this.disposed = false
    const config = this.sourcePreset?.cinematicConfig ?? createBaseConfig(this.legacyDefinition.id as CinematicWorldMode)
    const object3dSlots = this.legacyDefinition.object3dSlots ?? []
    if (object3dSlots.length === 0) {
      this.replaceRenderer(context.webgl.gl, context.viewport, config)
      return
    }
    this.object3dBridge?.dispose()
    this.object3dBridge = new CinemaCinematicWorldObject3DBridge(
      context.webgl.objectInstances,
      context.node.parameterValues,
      context.assetManager,
      object3dSlots,
    )
    this.replaceRenderer(context.webgl.gl, context.viewport, config)
    return this.object3dBridge.initialize(context.signal)
  }

  resize(context: CinemaNodeResizeContext): void {
    this.renderer?.resize(context.viewport)
  }

  render(context: CinemaNodeRenderContext): void {
    if (!context.target || context.outputNode || this.disposed) {
      throw new Error(`Cinematic World ${this.legacyDefinition.id} is not ready for a Cinema-owned target.`)
    }
    const runtimeValues = applyRuntimeQualityValues(context.values, context.quality)
    const nextConfig = resolveConfig(this.legacyDefinition.id as CinematicWorldMode, runtimeValues, this.sourcePreset?.cinematicConfig)
    const nextKey = configStructuralKey(nextConfig)
    if (nextKey !== this.configKey) {
      this.replaceRenderer(context.webgl.gl, context.viewport, nextConfig, 'structuralConfigurationChanged')
    }
    if (!this.renderer || !this.scope) {
      throw new Error(`Cinematic World ${this.legacyDefinition.id} renderer resources are unavailable.`)
    }
    const target = context.webgl.bindTarget(context.target)
    context.webgl.resetState()
    const object3dValues = applyCinema3DObjectRuntimeQuality(runtimeValues, context.quality?.tier)
    this.object3dBridge?.updateFrame(object3dValues, context.viewport, context.frame.camera, context.assetManager)
    const frame = adaptCinemaFrame(
      context.frame,
      nextConfig,
      runtimeValues,
      this.authoredOpacity,
      this.sourcePreset,
      this.modulationEngine,
      this.legacyDefinition.capabilities.modulationTargets,
    )
    this.renderer.render(frame, {
      framebuffer: target.framebuffer,
      texture: target.texture,
      width: target.width,
      height: target.height,
    })
    const diagnostic = this.renderer.getDiagnostic?.()
    if (diagnostic) {
      context.diagnostics.report(createCinemaDiagnostic({
        code: 'CINEMA_SAFE_OUTPUT_ACTIVE',
        severity: 'warning',
        message: diagnostic,
        attribution: { nodeId: this.nodeId, stage: 'cinematic-world-adapter' },
      }))
    }
  }

  reset(context: CinemaNodeResetContext): void {
    const reason = cinemaCinematicResetReason(context.actionId)
    this.modulationEngine.reset(cinematicAudioResetReason(reason))
    this.renderer?.reset(reason)
  }

  dispose(_context: CinemaNodeDisposeContext): void {
    this.retireResources('dispose')
  }

  private replaceRenderer(
    gl: WebGL2RenderingContext,
    viewport: Readonly<{ width: number; height: number; dpr: number }>,
    config: CinematicWorldConfig,
    resetReason?: CinematicRendererResetReason,
  ): void {
    if (resetReason) {
      try { this.renderer?.reset(resetReason) } catch { /* Replacement continues. */ }
    }
    try { this.renderer?.dispose() } catch { /* Replacement continues. */ }
    this.renderer = null
    this.scope?.dispose()
    this.scope = null

    const scope = new CinematicWebGLServiceScope(gl, this.object3dBridge ?? undefined)
    const renderer = this.legacyDefinition.create()
    try {
      renderer.initialize({ services: scope.services, config, presetId: this.sourcePreset?.id ?? this.nodeId })
      renderer.resize(viewport)
    } catch (error) {
      try { renderer.dispose() } catch { /* Initialization failure cleanup continues. */ }
      scope.dispose()
      throw error
    }
    this.scope = scope
    this.renderer = renderer
    this.configKey = configStructuralKey(config)
  }

  private retireResources(reason: CinematicRendererResetReason): void {
    if (this.disposed) return
    this.disposed = true
    this.modulationEngine.reset('manual')
    try { this.renderer?.reset(reason) } catch { /* Cleanup continues. */ }
    try { this.renderer?.dispose() } catch { /* Cleanup continues. */ }
    this.renderer = null
    this.scope?.dispose()
    this.scope = null
    this.object3dBridge?.dispose()
    this.object3dBridge = null
  }
}

/** Explicit Canvas2D compatibility boundary. It owns no visible canvas, context, or animation loop. */
export class CinemaCanvas2DNodeAdapter implements CinemaRenderNode {
  readonly typeId: CinemaNodeTypeId
  private renderer: CinematicWorldRenderer | null = null
  private canvas: HTMLCanvasElement | null = null
  private canvasContext: CanvasRenderingContext2D | null = null
  private texture: ShaderTexture | null = null
  private program: ShaderProgram | null = null
  private pass: FullscreenPass | null = null
  private configKey = ''
  private disposed = false
  private readonly modulationEngine = new CinematicModulationEngine()

  constructor(
    readonly nodeId: CinemaNodeId,
    private readonly authoredOpacity: number,
    private readonly legacyDefinition: CinematicCanvasWorldDefinition,
    definition: Readonly<CinemaNodeTypeDefinition>,
    private readonly createCanvas?: () => HTMLCanvasElement,
    private readonly sourcePreset: ReactPreset | null = null,
  ) {
    this.typeId = definition.typeId
  }

  initialize(context: CinemaNodeInitializeContext): void {
    if (context.signal.aborted) throw new DOMException('Cinema node initialization was cancelled.', 'AbortError')
    const canvas = this.createCanvas?.() ?? (typeof document !== 'undefined' ? document.createElement('canvas') : null)
    const canvasContext = canvas?.getContext('2d', { alpha: true }) ?? null
    if (!canvas || !canvasContext) {
      context.diagnostics.report(createCinemaDiagnostic({
        code: 'CINEMA_CAPABILITY_UNAVAILABLE',
        severity: 'error',
        message: 'Legacy Portal cannot initialize because an offscreen Canvas2D context is unavailable.',
        attribution: { nodeId: this.nodeId, stage: 'canvas2d-compatibility' },
      }))
      throw new Error('Canvas2D compatibility context unavailable.')
    }
    this.disposed = false
    this.canvas = canvas
    this.canvasContext = canvasContext
    const config = this.sourcePreset?.cinematicConfig ?? createBaseConfig('legacyPortal')
    this.replaceRenderer(config, context.viewport.dpr)
    this.resizeCanvas(context.viewport.width, context.viewport.height, context.viewport.dpr)
    const gl = context.webgl.gl
    this.texture = new ShaderTexture(gl, { format: 'rgba8', filter: 'linear', wrap: 'clamp' })
    this.pass = new FullscreenPass(gl)
    const result = ShaderProgram.create(gl, new ShaderCompiler(gl), {
      vertSrc: FULLSCREEN_VERT_SRC,
      fragSrc: CANVAS_UPLOAD_FRAGMENT_SHADER,
      label: 'Cinema/LegacyPortalUpload',
      requiredUniforms: ['uCanvasTexture', 'uOpacity'],
    })
    if (!result.program) {
      this.retireResources()
      throw new Error(`Legacy Portal upload shader failed: ${result.error.log}`)
    }
    this.program = result.program
  }

  resize(context: CinemaNodeResizeContext): void {
    this.resizeCanvas(context.viewport.width, context.viewport.height, context.viewport.dpr)
  }

  render(context: CinemaNodeRenderContext): void {
    if (!context.target || context.outputNode || !this.renderer || !this.canvas || !this.texture || !this.program || !this.pass) {
      throw new Error('Legacy Portal Canvas2D compatibility resources are unavailable.')
    }
    const runtimeValues = applyRuntimeQualityValues(context.values, context.quality)
    const config = resolveConfig('legacyPortal', runtimeValues, this.sourcePreset?.cinematicConfig)
    if (configStructuralKey(config) !== this.configKey) {
      this.replaceRenderer(config, context.viewport.dpr, 'structuralConfigurationChanged')
    }
    const target = context.webgl.bindTarget(context.target)
    if (this.canvas.width !== target.width || this.canvas.height !== target.height) {
      this.resizeCanvas(target.width, target.height, context.viewport.dpr)
    }
    const frame = adaptCinemaFrame(
      context.frame,
      config,
      runtimeValues,
      this.authoredOpacity,
      this.sourcePreset,
      this.modulationEngine,
      this.legacyDefinition.capabilities.modulationTargets,
    )
    this.renderer.render(frame)
    const gl = context.webgl.gl
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true)
    try {
      this.texture.uploadCanvas(this.canvas)
    } finally {
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
    }
    const texture = this.texture.handle
    if (!texture) throw new Error('Legacy Portal Canvas2D upload did not create a texture.')
    context.webgl.resetState()
    this.program.setFloat('uOpacity', clamp01(numberValue(context.values[INTENSITY_PARAMETER_ID], 0.7) * this.authoredOpacity))
    this.pass.run(this.program, target.framebuffer, target.width, target.height, [{
      unit: 0,
      texture,
      uniformName: 'uCanvasTexture',
    }], { clear: true })
  }

  reset(context: CinemaNodeResetContext): void {
    const reason = cinemaCinematicResetReason(context.actionId)
    this.modulationEngine.reset(cinematicAudioResetReason(reason))
    this.renderer?.reset(reason)
  }

  dispose(_context: CinemaNodeDisposeContext): void {
    this.retireResources()
  }

  private replaceRenderer(
    config: CinematicWorldConfig,
    dpr: number,
    resetReason?: CinematicRendererResetReason,
  ): void {
    if (!this.canvas || !this.canvasContext) throw new Error('Legacy Portal Canvas2D surface is unavailable.')
    if (resetReason) {
      try { this.renderer?.reset(resetReason) } catch { /* Replacement continues. */ }
    }
    try { this.renderer?.dispose() } catch { /* Replacement continues. */ }
    const renderer = this.legacyDefinition.create()
    try {
      renderer.initialize({ context: this.canvasContext, config, presetId: this.sourcePreset?.id ?? this.nodeId })
      renderer.resize({ width: Math.max(1, this.canvas.width), height: Math.max(1, this.canvas.height), dpr: Math.max(0.1, dpr) })
    } catch (error) {
      try { renderer.dispose() } catch { /* Initialization failure cleanup continues. */ }
      throw error
    }
    this.renderer = renderer
    this.configKey = configStructuralKey(config)
  }

  private resizeCanvas(width: number, height: number, dpr: number): void {
    if (!this.canvas || !this.renderer) return
    const nextWidth = Math.max(1, Math.floor(width))
    const nextHeight = Math.max(1, Math.floor(height))
    if (this.canvas.width !== nextWidth) this.canvas.width = nextWidth
    if (this.canvas.height !== nextHeight) this.canvas.height = nextHeight
    this.renderer.resize({ width: nextWidth, height: nextHeight, dpr: Math.max(0.1, dpr) })
  }

  private retireResources(): void {
    if (this.disposed) return
    this.disposed = true
    this.modulationEngine.reset('manual')
    try { this.renderer?.reset('dispose') } catch { /* Cleanup continues. */ }
    try { this.renderer?.dispose() } catch { /* Cleanup continues. */ }
    this.renderer = null
    this.texture?.dispose()
    this.texture = null
    this.program?.dispose()
    this.program = null
    this.pass?.dispose()
    this.pass = null
    if (this.canvas) {
      this.canvas.width = 0
      this.canvas.height = 0
    }
    this.canvas = null
    this.canvasContext = null
  }
}


class CinemaCinematicWorldObject3DBridge implements CinematicWorldObject3DService {
  private readonly object: Cinema3DObjectRuntime
  private readonly allowedAnchors: ReadonlySet<string>
  private values: Readonly<CinemaParameterValues>
  private viewport: Readonly<CinemaViewport> = Object.freeze({ width: 1, height: 1, dpr: 1 })
  private camera: Readonly<CinemaCameraUniformSnapshot> | null = null
  private assetManager: CinemaAssetRuntimeService
  private preparationController: AbortController | null = null
  private preparationGeneration = 0
  private sourceRevisionKey: string | null = null
  private disposed = false

  constructor(
    objectInstances: Cinema3DObjectRuntimeService,
    initialValues: Readonly<CinemaParameterValues>,
    assetManager: CinemaAssetRuntimeService,
    anchors: readonly Readonly<CinemaWorld3DObjectAnchor>[],
  ) {
    this.values = initialValues
    this.assetManager = assetManager
    this.allowedAnchors = new Set(anchors.map(anchor => anchor.id))
    this.object = objectInstances.createObject(hydrateCinema3DObjectDefinition(initialValues))
  }

  async initialize(signal: AbortSignal): Promise<void> {
    if (this.disposed || signal.aborted) return
    await this.prepareCurrent(signal)
  }

  updateFrame(
    values: Readonly<CinemaParameterValues>,
    viewport: Readonly<CinemaViewport>,
    camera: Readonly<CinemaCameraUniformSnapshot> | null,
    assetManager: CinemaAssetRuntimeService,
  ): void {
    if (this.disposed) return
    this.values = values
    this.viewport = viewport
    this.camera = camera
    this.assetManager = assetManager
    const invalidation = this.object.setResolvedParameterValues(values)
    const revisionKey = this.resolveSourceRevisionKey()
    const sourceRevisionChanged = revisionKey !== this.sourceRevisionKey
    this.sourceRevisionKey = revisionKey
    if (invalidation === 'source' || invalidation === 'geometry' || sourceRevisionChanged) this.schedulePreparation()
  }

  draw(anchor: Readonly<CinemaWorld3DObjectAnchor>): Readonly<CinematicWorldObject3DDrawResult> {
    const validated = this.snapshotFor(anchor)
    if (validated.error || anchor.visible === false || validated.status !== 'ready' || !this.camera) {
      return Object.freeze({ ...validated, drawn: false })
    }
    const drawn = this.object.draw(this.viewport, this.camera, anchor)
    return Object.freeze({ ...this.snapshotFor(anchor), drawn })
  }

  getSnapshot(anchor: Readonly<CinemaWorld3DObjectAnchor>): Readonly<CinematicWorldObject3DSnapshot> {
    return this.snapshotFor(anchor)
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.preparationGeneration += 1
    this.preparationController?.abort()
    this.preparationController = null
    this.object.dispose()
  }

  private snapshotFor(anchor: Readonly<CinemaWorld3DObjectAnchor>): Readonly<CinematicWorldObject3DSnapshot> {
    if (!this.allowedAnchors.has(anchor.id)) {
      return Object.freeze({
        status: 'error' as const,
        error: `Cinematic World requested undeclared 3D object anchor "${anchor.id}".`,
        worldBounds: null,
        focusAnchor: Object.freeze([0, 0, 0]) as CinemaVector3,
      })
    }
    const snapshot = this.object.getSnapshot(anchor)
    return Object.freeze({
      status: snapshot.status,
      error: snapshot.error,
      worldBounds: snapshot.worldBounds,
      focusAnchor: snapshot.focusAnchor,
    })
  }

  private schedulePreparation(): void {
    this.preparationController?.abort()
    const controller = new AbortController()
    this.preparationController = controller
    const generation = ++this.preparationGeneration
    void this.prepareCurrent(controller.signal).finally(() => {
      if (this.preparationGeneration === generation && this.preparationController === controller) {
        this.preparationController = null
      }
    })
  }

  private async prepareCurrent(signal: AbortSignal): Promise<void> {
    if (this.disposed || signal.aborted) return
    const definition = hydrateCinema3DObjectDefinition(this.values)
    this.sourceRevisionKey = this.resolveSourceRevisionKey()
    try {
      if (definition.source.type === 'text') await this.object.prepareTextAsset(this.assetManager, signal)
      else await this.object.prepareSvg(this.assetManager, signal)
    } catch (error) {
      if (signal.aborted || this.disposed || isAbortLike(error)) return
    }
  }

  private resolveSourceRevisionKey(): string {
    const definition = hydrateCinema3DObjectDefinition(this.values)
    const asset = definition.source.type === 'text' ? definition.source.font : definition.source.asset
    if (!asset) return `${definition.source.type}:none`
    const revision = this.assetManager.getSourceRevision?.(asset.assetId) ?? null
    return `${definition.source.type}:${asset.assetId}:${revision == null ? 'missing' : String(revision)}`
  }
}

class CinematicWebGLServiceScope {
  readonly services: CinematicWebGLServices
  private readonly programs = new Set<ShaderProgram>()
  private readonly framebuffers = new Set<ShaderFramebuffer>()
  private readonly textures = new Set<ShaderTexture>()
  private readonly fullscreenPass: FullscreenPass
  private readonly resources: ShaderResourceManager
  private disposed = false

  constructor(gl: WebGL2RenderingContext, object3d?: CinematicWorldObject3DService) {
    const compiler = new ShaderCompiler(gl)
    this.fullscreenPass = new FullscreenPass(gl)
    this.resources = new ShaderResourceManager(gl)
    this.services = {
      gl,
      compiler,
      fullscreenPass: this.fullscreenPass,
      resources: this.resources,
      compileProgram: (descriptor: ShaderProgramDescriptor) => {
        const result = ShaderProgram.create(gl, compiler, descriptor)
        if (!result.program) throw new Error(`${descriptor.label} failed: ${result.error.log}`)
        this.programs.add(result.program)
        return result.program
      },
      createFramebuffer: (descriptor?: FramebufferDescriptor) => {
        const framebuffer = new ShaderFramebuffer(gl, descriptor)
        this.framebuffers.add(framebuffer)
        return framebuffer
      },
      createTexture: (descriptor?: TextureDescriptor) => {
        const texture = new ShaderTexture(gl, descriptor)
        this.textures.add(texture)
        return texture
      },
      ...(object3d ? { object3d } : {}),
    }
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    for (const program of this.programs) program.dispose()
    for (const framebuffer of this.framebuffers) framebuffer.dispose()
    for (const texture of this.textures) texture.dispose()
    this.programs.clear()
    this.framebuffers.clear()
    this.textures.clear()
    this.fullscreenPass.dispose()
    this.resources.disposeAll()
  }
}


function isAbortLike(error: unknown): boolean {
  return error instanceof DOMException
    ? error.name === 'AbortError'
    : error instanceof Error && error.name === 'AbortError'
}

function cinematicAudioResetReason(reason: CinematicRendererResetReason): Parameters<CinematicModulationEngine['reset']>[0] {
  switch (reason) {
    case 'seek':
    case 'trackReplacement':
    case 'transportRestart':
    case 'worldReplacement':
    case 'presetReplacement':
      return reason
    default:
      return 'manual'
  }
}

export function cinemaCinematicResetReason(
  actionId: CinemaStateResetActionId | string,
): CinematicRendererResetReason {
  switch (actionId) {
    case CINEMA_STATE_RESET_ACTION_IDS.contextRestore: return 'contextRestored'
    case CINEMA_STATE_RESET_ACTION_IDS.seek: return 'seek'
    case CINEMA_STATE_RESET_ACTION_IDS.trackChange: return 'trackReplacement'
    case CINEMA_STATE_RESET_ACTION_IDS.playbackRestart: return 'transportRestart'
    case CINEMA_STATE_RESET_ACTION_IDS.timingDiscontinuity:
    case CINEMA_STATE_RESET_ACTION_IDS.visibilityRestore:
    case CINEMA_STATE_RESET_ACTION_IDS.resume:
      return 'timingDiscontinuity'
    case CINEMA_STATE_RESET_ACTION_IDS.activation: return 'worldReplacement'
    default: return 'manualReset'
  }
}

function adaptCinemaFrame(
  frame: Readonly<CinemaFrameContext>,
  config: CinematicWorldConfig,
  values: Readonly<Partial<Record<CinemaParameterId, CinemaParameterValue>>>,
  authoredOpacity: number,
  sourcePreset: ReactPreset | null = null,
  modulationEngine: CinematicModulationEngine | null = null,
  supportedModulationTargets: readonly CinematicAudioTarget[] = CINEMATIC_AUDIO_TARGETS,
): CinematicFrameContext {
  const sectionType = normalizeSectionType(frame.music.sectionType)
  const params = createReactParams(frame, values, authoredOpacity)
  const presetId = sourcePreset?.id ?? `cinema-${config.worldMode}`
  const preset = createPreset(presetId, config, params, frame, values, sourcePreset)
  const musicalAudio = createMusicalAudioFrame(frame, sectionType, presetId)
  const authoredMapping = sourcePreset?.cinematicConfig?.audioMapping
  const modulation = authoredMapping?.enabled && modulationEngine
    ? modulationEngine.update(
        musicalAudio,
        authoredMapping.routes,
        supportedModulationTargets,
        frame.timing.deltaTimeSec,
        authoredMapping.smoothingMs,
        sourcePreset?.cinematicConfig?.seed ?? config.seed,
      )
    : createModulationSnapshot(frame, params)
  const camera = createCameraFrame(frame, config)
  return {
    elapsedTimeSec: frame.timing.elapsedTimeSec,
    deltaTimeSec: frame.timing.deltaTimeSec,
    timingDiscontinuity: frame.transport.discontinuity || frame.transport.reset.required,
    transportTimeSec: frame.transport.audioTimeSec,
    isPlaying: frame.transport.playing,
    frameIndex: frame.timing.frameIndex,
    resolution: { width: frame.viewport.width, height: frame.viewport.height },
    devicePixelRatio: frame.viewport.dpr,
    audio: {
      raw: { bass: frame.audio.bass, mid: frame.audio.mid, high: frame.audio.high, volume: frame.audio.volume },
      smoothed: { bass: frame.audio.bass, mid: frame.audio.mid, high: frame.audio.high, volume: frame.audio.volume },
      spectrum: frame.audio.fft as Uint8Array<ArrayBuffer> | null,
      waveform: frame.audio.waveform as Uint8Array<ArrayBuffer> | null,
    },
    beat: {
      hit: frame.impulses.beat,
      phase: frame.music.beatPhase,
      bpm: frame.music.bpm ?? 120,
      kick: frame.impulses.kick ? Math.max(frame.audio.bass, frame.audio.dropImpact, 1) : frame.audio.bass,
      snare: frame.impulses.snare ? Math.max(frame.audio.mid, 1) : frame.audio.mid,
      transient: frame.impulses.transient ? Math.max(frame.audio.flux, 1) : frame.audio.flux,
      beatIndex: frame.music.beatIndex ?? 0,
      beatInBar: frame.music.beatInBar ?? 0,
      barIndex: frame.music.barIndex ?? 0,
      barProgress: frame.music.clocks.states.bar.phase,
      downbeat: frame.impulses.downbeat,
    },
    musicalAudio,
    modulation,
    camera,
    section: {
      type: sectionType,
      startSec: 0,
      endSec: frame.transport.durationSec ?? Math.max(frame.transport.audioTimeSec + 1, 1),
      progress: frame.music.sectionProgress,
      changed: frame.impulses.sectionStart,
      analysis: null,
      label: frame.music.sectionType ?? undefined,
      intensity: frame.audio.energy,
      confidence: frame.capabilities.authoritativeSections ? 1 : 0,
      source: frame.capabilities.authoritativeSections ? 'manual' : 'unknown',
    },
    config,
    transition: {
      mode: 'cut',
      active: false,
      progress: 1,
      fromWorld: null,
      toWorld: config.worldMode,
    },
    randomSeed: frame.timing.seeds.musicalPosition,
    preset,
    presetId,
    params,
    requestedWorldId: config.worldMode,
  }
}

function createReactParams(
  frame: Readonly<CinemaFrameContext>,
  values: Readonly<Partial<Record<CinemaParameterId, CinemaParameterValue>>>,
  authoredOpacity: number,
): ReactRenderParams {
  const events: ReactPerformanceActionEvent[] = (frame.performance.events ?? frame.performance.actionIds.map((actionId, index) => ({
    actionId,
    sequence: frame.timing.frameIndex * 1000 + index,
  }))).map(event => ({
    actionId: String(event.actionId),
    sequence: event.sequence,
    target: { engineId: 'cinematicPortal' },
    triggeredAtMs: frame.timing.elapsedTimeSec * 1000,
    toggleState: frame.performance.toggleStates[event.actionId],
  }))
  return {
    ...DEFAULT_REACT_RENDER_PARAMS,
    intensity: clamp01(numberValue(values[INTENSITY_PARAMETER_ID], 0.7) * authoredOpacity),
    motion: clamp01(numberValue(values[MOTION_PARAMETER_ID], 0.5)),
    glow: clamp01(numberValue(values[GLOW_PARAMETER_ID], 0.65)),
    bassReactivity: clamp01(numberValue(values[BASS_REACTIVITY_PARAMETER_ID], 0.8)),
    trailDecay: clamp01(numberValue(values[TRAIL_DECAY_PARAMETER_ID], 0.08)),
    fogDensity: clamp01(numberValue(values[FOG_DENSITY_PARAMETER_ID], 0.5)),
    particleDensity: clamp01(numberValue(values[PARTICLE_DENSITY_PARAMETER_ID], 0.5)),
    performanceActionEvent: events[0] ?? null,
    performanceActionEvents: events,
    performanceActionToggleStates: Object.fromEntries(Object.entries(frame.performance.toggleStates).filter((entry): entry is [string, boolean] => typeof entry[1] === 'boolean').map(([key, value]) => [String(key), value])),
  }
}

function createPreset(
  presetId: string,
  config: CinematicWorldConfig,
  params: ReactRenderParams,
  frame: Readonly<CinemaFrameContext>,
  values: Readonly<Partial<Record<CinemaParameterId, CinemaParameterValue>>>,
  sourcePreset: ReactPreset | null = null,
): ReactPreset {
  return {
    id: presetId,
    name: sourcePreset?.name ?? `Cinema ${titleCase(config.worldMode)}`,
    description: sourcePreset?.description ?? 'Runtime-only compatibility view for a Cinema-owned Cinematic World node.',
    engine: 'cinematicPortal',
    palette: createRuntimePalette(values, sourcePreset?.palette ?? createPalette(frame)),
    params: {
      intensity: params.intensity,
      motion: params.motion,
      glow: params.glow,
      bassReactivity: params.bassReactivity,
    },
    renderSettings: {
      trailDecay: params.trailDecay,
      fogDensity: params.fogDensity,
      particleDensity: params.particleDensity,
    },
    scenes: sourcePreset?.scenes ? cloneJson(sourcePreset.scenes) as unknown as ReactPreset['scenes'] : [],
    sectionMappings: sourcePreset?.sectionMappings ? cloneJson(sourcePreset.sectionMappings) as unknown as ReactPreset['sectionMappings'] : [],
    cinematicConfig: config,
  }
}

function createRuntimePalette(
  values: Readonly<Partial<Record<CinemaParameterId, CinemaParameterValue>>>,
  fallback: ReactPalette,
): ReactPalette {
  return Object.fromEntries(CINEMATIC_PALETTE_SPECS.map(([role]) => {
    const value = values[cinemaCinematicWorldParameterId(`palette-${role}`)]
    return [role, Array.isArray(value) ? colorHex(value as unknown as CinemaColor, fallback[role]) : fallback[role]]
  })) as unknown as ReactPalette
}

function defaultPalette(): ReactPalette {
  return { primary: '#0ad9ee', secondary: '#6f4df6', accent: '#f34fae', background: '#02040a', highlight: '#ffffff', text: '#ffffff' }
}

function hexToCinemaColor(value: string): CinemaColor {
  const match = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})([\da-f]{2})?$/i.exec(value.trim())
  if (!match) return [1, 1, 1, 1]
  return [parseInt(match[1], 16) / 255, parseInt(match[2], 16) / 255, parseInt(match[3], 16) / 255, match[4] ? parseInt(match[4], 16) / 255 : 1]
}

function createPalette(frame: Readonly<CinemaFrameContext>): ReactPalette {
  return {
    primary: colorHex(frame.brand.colors.primary, '#0ad9ee'),
    secondary: colorHex(frame.brand.colors.secondary, '#6f4df6'),
    accent: colorHex(frame.brand.colors.accent, '#f34fae'),
    background: colorHex(frame.brand.colors.background, '#02040a'),
    highlight: colorHex(frame.brand.colors.highlight, '#ffffff'),
    text: colorHex(frame.brand.colors.foreground, '#ffffff'),
  }
}

function createMusicalAudioFrame(
  frame: Readonly<CinemaFrameContext>,
  sectionType: ReactSectionType | null,
  presetId: string,
): CinematicNormalizedAudioFrame {
  const sources = Object.fromEntries(CINEMATIC_AUDIO_SOURCES.map(source => [source, sourceValue(source, frame)])) as Record<CinematicAudioSource, number>
  const events = Object.fromEntries(CINEMATIC_AUDIO_EVENT_SOURCES.map(source => [source, eventValue(source, frame)])) as Record<CinematicAudioEventSource, boolean>
  return {
    frameId: frame.timing.frameIndex,
    sourceId: presetId,
    trackId: frame.transport.trackId,
    transportTimeSec: frame.transport.audioTimeSec,
    isPlaying: frame.transport.playing,
    values: sources,
    events,
    timing: {
      bpm: frame.music.bpm ?? 120,
      beatPhase: frame.music.beatPhase,
      beatIndex: frame.music.beatIndex ?? 0,
      beatInBar: frame.music.beatInBar ?? 0,
      barIndex: frame.music.barIndex ?? 0,
      barPosition: frame.music.clocks.states.bar.phase,
      phraseProgress: frame.music.clocks.states.phrase.phase,
    },
    section: {
      type: sectionType,
      label: frame.music.sectionType ?? '',
      startSec: 0,
      endSec: frame.transport.durationSec ?? Math.max(1, frame.transport.audioTimeSec + 1),
      progress: frame.music.sectionProgress,
      intensity: frame.audio.energy,
      confidence: frame.capabilities.authoritativeSections ? 1 : 0,
      source: frame.capabilities.authoritativeSections ? 'manual' : 'unknown',
    },
    capabilities: {
      musicIntelligence: frame.capabilities.musicIntelligence,
      broadBands: frame.audio.available,
      detailedBands: frame.audio.available,
      transientEvents: frame.capabilities.analyser,
      kickEvents: frame.capabilities.analyser,
      snareEvents: frame.capabilities.analyser,
      beatTiming: frame.capabilities.beatGrid,
      downbeatTiming: frame.capabilities.beatGrid,
      barTiming: frame.capabilities.beatGrid,
      phraseTiming: frame.capabilities.beatGrid,
      sectionTiming: frame.capabilities.authoritativeSections,
      buildProgress: frame.capabilities.musicIntelligence,
      dropState: frame.capabilities.musicIntelligence,
      trackEnergyCurve: frame.capabilities.musicIntelligence,
      vocalEnergy: frame.capabilities.musicIntelligence,
    },
    resetReasons: frame.transport.reset.reasons.map(reason => reason === 'track-change' ? 'trackReplacement' : reason === 'seek' ? 'seek' : 'manual'),
  }
}

function createModulationSnapshot(
  frame: Readonly<CinemaFrameContext>,
  params: ReactRenderParams,
): CinematicModulationSnapshot {
  const values = Object.fromEntries(CINEMATIC_AUDIO_TARGETS.map(target => [target, modulationValue(target, frame, params)])) as Record<CinematicAudioTarget, number>
  return { values, issues: [], planKey: 'cinema-frame-direct-v1' }
}

function createCameraFrame(
  frame: Readonly<CinemaFrameContext>,
  config: CinematicWorldConfig,
): CinematicCameraFrame | undefined {
  const camera = frame.camera
  if (!camera) return undefined
  const requestedRig = camera.mode === 'auto-director'
    ? 'autoDirector'
    : camera.mode === 'fly' || camera.mode === 'path'
      ? 'flyThrough'
      : camera.mode ?? config.cameraRig
  const resolvedMode = camera.resolvedMode ?? (camera.mode === 'auto-director' ? 'locked' : camera.mode)
  const rig = resolvedMode === 'fly' || resolvedMode === 'path'
    ? 'flyThrough'
    : resolvedMode ?? (requestedRig === 'autoDirector' ? 'locked' : requestedRig)
  return {
    rig,
    requestedRig,
    pose: {
      position: { x: camera.position[0], y: camera.position[1], z: camera.position[2] },
      rotation: { x: camera.rotation[0], y: camera.rotation[1], z: camera.rotation[2] + camera.rollRadians },
      fieldOfView: camera.fovDegrees,
    },
    shotId: camera.shotId ?? String(camera.cameraId),
    action: frame.impulses.dropStart ? 'impact' : frame.impulses.sectionStart ? 'establish' : 'hold',
    routeProgress: frame.music.sectionProgress,
    transitionProgress: 1,
    sectionType: normalizeSectionType(frame.music.sectionType),
    sectionSource: frame.capabilities.authoritativeSections ? 'analyzed' : 'none',
    usedFallbackRig: requestedRig === 'autoDirector' && camera.shotId == null,
  }
}

function applyRuntimeQualityValues(
  values: Readonly<Partial<Record<CinemaParameterId, CinemaParameterValue>>>,
  quality: CinemaNodeRenderContext['quality'],
): Readonly<Partial<Record<CinemaParameterId, CinemaParameterValue>>> {
  if (!quality) return values
  const next: Partial<Record<CinemaParameterId, CinemaParameterValue>> = { ...values }
  const authoredTier = readQuality(values[QUALITY_PARAMETER_ID], 'auto')
  const authoredRank = authoredTier === 'auto' ? Number.POSITIVE_INFINITY : CINEMATIC_QUALITY_TIERS.indexOf(authoredTier)
  const runtimeRank = CINEMATIC_QUALITY_TIERS.indexOf(quality.tier)
  const effectiveTier = authoredTier === 'auto' || runtimeRank < authoredRank ? quality.tier : authoredTier
  next[QUALITY_PARAMETER_ID] = qualityOptionId(effectiveTier)
  next[PARTICLE_DENSITY_PARAMETER_ID] = clamp01(
    numberValue(values[PARTICLE_DENSITY_PARAMETER_ID], 0.5) * quality.simulationScale,
  )
  return Object.freeze(next)
}

function resolveConfig(
  worldId: CinematicWorldMode,
  values: Readonly<Partial<Record<CinemaParameterId, CinemaParameterValue>>>,
  authoredConfig?: CinematicWorldConfig,
): CinematicWorldConfig {
  const defaults = authoredConfig ? normalizeCinematicWorldConfig(authoredConfig) : createBaseConfig(worldId)
  const environment = { ...defaults.environment }
  const material = { ...defaults.material }
  for (const [key] of ENVIRONMENT_PARAMETER_SPECS) {
    environment[key] = numberValue(values[cinemaCinematicWorldParameterId(`environment-${key}`)], environment[key])
  }
  for (const [key] of MATERIAL_PARAMETER_SPECS) {
    material[key] = numberValue(values[cinemaCinematicWorldParameterId(`material-${key}`)], material[key])
  }
  const seed = Math.trunc(numberValue(values[SEED_PARAMETER_ID], defaults.seed)) >>> 0
  const qualityTier = readQuality(values[QUALITY_PARAMETER_ID], defaults.qualityTier)
  if (worldId === 'legacyPortal') {
    const legacy = createLegacyPortalCinematicConfig({
      intensity: numberValue(values[INTENSITY_PARAMETER_ID], 0.7),
      motion: numberValue(values[MOTION_PARAMETER_ID], 0.5),
      glow: numberValue(values[GLOW_PARAMETER_ID], 0.65),
      bassReactivity: numberValue(values[BASS_REACTIVITY_PARAMETER_ID], 0.8),
      trailDecay: numberValue(values[TRAIL_DECAY_PARAMETER_ID], 0.08),
      fogDensity: numberValue(values[FOG_DENSITY_PARAMETER_ID], 0.5),
      particleDensity: numberValue(values[PARTICLE_DENSITY_PARAMETER_ID], 0.5),
    }, { cinemaAdapterVersion: CINEMA_CINEMATIC_WORLD_ADAPTER_VERSION })
    return normalizeCinematicWorldConfig(authoredConfig
      ? { ...defaults, seed, qualityTier, environment, material }
      : { ...legacy, seed, qualityTier, environment, material })
  }
  const settings = { ...(defaults.worldSettings.settings as Record<string, unknown>) }
  for (const [key, defaultValue] of Object.entries(settings)) {
    const value = values[worldParameterId(key)]
    if (typeof defaultValue === 'number') settings[key] = numberValue(value, defaultValue)
    else if (typeof defaultValue === 'string') {
      settings[key] = isWorldColorSetting(worldId, key) && Array.isArray(value)
        ? colorHex(value as unknown as CinemaColor, defaultValue)
        : readWorldEnum(key, value, defaultValue)
    }
  }
  if (authoredConfig) {
    return normalizeCinematicWorldConfig({
      ...defaults,
      worldSettings: { mode: worldId, settings },
      environment,
      material,
      seed,
      qualityTier,
    })
  }
  return createCinematicWorldConfig(worldId, settings, {
    environment,
    material,
    seed,
    qualityTier,
    audioMapping: { enabled: false },
    compatibility: { extensions: { cinemaAdapterVersion: CINEMA_CINEMATIC_WORLD_ADAPTER_VERSION } },
  })
}

function createBaseConfig(worldId: CinematicWorldMode): CinematicWorldConfig {
  return worldId === 'legacyPortal'
    ? createLegacyPortalCinematicConfig({})
    : createCinematicWorldConfig(worldId, {})
}

function readLegacyCinematicPreset(node: Readonly<CinemaNodeDefinition>): ReactPreset | null {
  const raw = node.metadata?.legacyCinematicPreset
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const source = raw as Record<string, unknown>
  if (typeof source.id !== 'string' || typeof source.name !== 'string' || typeof source.description !== 'string') return null
  const palette = source.palette
  const params = source.params
  if (!palette || typeof palette !== 'object' || Array.isArray(palette) || !params || typeof params !== 'object' || Array.isArray(params)) return null
  const renderSettings = source.renderSettings
  const scenes = Array.isArray(source.scenes) ? source.scenes : []
  const sectionMappings = Array.isArray(source.sectionMappings) ? source.sectionMappings : []
  return {
    id: source.id,
    name: source.name,
    description: source.description,
    engine: 'cinematicPortal',
    palette: cloneJson(palette) as unknown as ReactPalette,
    params: cloneJson(params) as unknown as ReactPreset['params'],
    ...(renderSettings && typeof renderSettings === 'object' && !Array.isArray(renderSettings)
      ? { renderSettings: cloneJson(renderSettings) as unknown as ReactPreset['renderSettings'] }
      : {}),
    scenes: cloneJson(scenes) as unknown as ReactPreset['scenes'],
    sectionMappings: cloneJson(sectionMappings) as unknown as ReactPreset['sectionMappings'],
    cinematicConfig: normalizeCinematicWorldConfig(source.cinematicConfig),
  }
}

function resolveLegacyPortalDefinition(): CinematicCanvasWorldDefinition | null {
  const definition = cinematicWorldRendererRegistry.resolve('legacyPortal')
  return definition?.backend === 'canvas2d' ? definition : null
}

function configStructuralKey(config: CinematicWorldConfig): string {
  return `${config.worldMode}:${config.seed}`
}

function floatParameter(
  id: CinemaParameterId,
  label: string,
  defaultValue: number,
  min: number,
  max: number,
  order: number,
): CinemaParameterDefinition {
  return {
    id,
    label,
    type: 'float',
    default: defaultValue,
    min,
    max,
    step: Math.max((max - min) / 100, 0.001),
    modulatable: true,
    ui: { control: 'slider', order },
  }
}

function sourceValue(source: CinematicAudioSource, frame: Readonly<CinemaFrameContext>): number {
  switch (source) {
    case 'overallEnergy':
    case 'trackEnergy': return frame.audio.energy
    case 'subBass': return frame.audio.sub
    case 'bass': return frame.audio.bass
    case 'lowMid':
    case 'mid': return frame.audio.mid
    case 'highMid': return (frame.audio.mid + frame.audio.high) * 0.5
    case 'highs':
    case 'high': return frame.audio.high
    case 'volume': return frame.audio.volume
    case 'transientIntensity': return frame.audio.flux
    case 'kickStrength': return frame.impulses.kick ? 1 : frame.audio.bass
    case 'snareStrength': return frame.impulses.snare ? 1 : frame.audio.mid
    case 'beatPhase': return frame.music.beatPhase
    case 'barPosition': return frame.music.clocks.states.bar.phase
    case 'phraseProgress': return frame.music.clocks.states.phrase.phase
    case 'sectionProgress': return frame.music.sectionProgress
    case 'sectionEnergy': return frame.audio.energy
    case 'buildProgress': return frame.audio.buildProgress
    case 'dropState': return Math.max(frame.audio.dropImpact, frame.impulses.dropStart ? 1 : 0)
    case 'vocalEnergy': return frame.audio.vocalPresence
    default: return eventValue(source as CinematicAudioEventSource, frame) ? 1 : 0
  }
}

function eventValue(source: CinematicAudioEventSource, frame: Readonly<CinemaFrameContext>): boolean {
  switch (source) {
    case 'beat': return frame.impulses.beat
    case 'kick': return frame.impulses.kick
    case 'snare': return frame.impulses.snare
    case 'downbeat': return frame.impulses.downbeat
    case 'barStart': return frame.music.clocks.states.bar.hit
    case 'sectionChange': return frame.impulses.sectionStart
    case 'dropEntry': return frame.impulses.dropStart
  }
}

function modulationValue(target: CinematicAudioTarget, frame: Readonly<CinemaFrameContext>, params: ReactRenderParams): number {
  switch (target) {
    case 'portalAperture': return frame.audio.bass * params.bassReactivity
    case 'depth': return frame.audio.sub * 0.45
    case 'cameraPunch': return frame.impulses.downbeat ? frame.audio.dropImpact || 1 : 0
    case 'cameraTravel':
    case 'cameraMotion': return frame.audio.buildProgress * params.motion
    case 'lensing':
    case 'refraction': return frame.audio.mid * 0.5
    case 'distortion': return frame.audio.flux * 0.65
    case 'geometryRotation': return frame.music.beatPhase * params.motion
    case 'fractureAmount': return frame.audio.flux
    case 'fogDensity':
    case 'fog': return frame.audio.energy * params.fogDensity
    case 'particleEmission':
    case 'debris': return frame.audio.high * params.particleDensity
    case 'lightning': return frame.impulses.snare ? 1 : frame.audio.flux
    case 'bloom':
    case 'environmentBrightness':
    case 'atmosphere':
    case 'glow': return frame.audio.energy * params.glow
    case 'chromaticAberration': return frame.audio.high * 0.35
    case 'feedback': return frame.audio.energy * (1 - params.trailDecay) * 0.4
    case 'impact':
    case 'portalPulse': return frame.impulses.dropStart ? 1 : frame.impulses.beat ? 0.35 : 0
    case 'networkSpread': return frame.audio.sub * 0.34 + frame.audio.buildProgress * 0.38
    case 'nodeScale': return frame.audio.bass * 0.28
    case 'nodeSpin': return (frame.impulses.snare ? 0.5 : 0) + frame.audio.high * 0.22
    case 'edgeBrightness': return frame.audio.energy * 0.54 + (frame.impulses.dropStart ? 0.9 : 0)
    case 'edgeWidth': return frame.audio.bass * 0.32
    case 'trailLength': return frame.audio.buildProgress * 0.72 + frame.audio.energy * 0.24
    case 'topologyMorph': return frame.audio.buildProgress * 0.52 + frame.music.clocks.states.phrase.phase * 0.26
    case 'collapseForce': return 0
    case 'burstImpulse': return frame.impulses.dropStart ? 1 : frame.impulses.kick ? 0.68 : 0
    case 'facetOpacity': return frame.impulses.snare ? 0.32 : 0
  }
}

function normalizeSectionType(value: string | null): ReactSectionType | null {
  const valid: readonly ReactSectionType[] = ['intro', 'verse', 'build', 'preDrop', 'drop', 'breakdown', 'bridge', 'outro', 'unknown']
  return value && valid.includes(value as ReactSectionType) ? value as ReactSectionType : value ? 'unknown' : null
}

function qualityOptionId(value: CinematicQualityTier): CinemaEnumOptionId {
  return cinemaStableId<CinemaEnumOptionId>(`quality-${stableSegment(value)}`, 'enum option')
}

function worldParameterId(key: string): CinemaParameterId {
  return cinemaCinematicWorldParameterId(`world-${key}`)
}

function isWorldColorSetting(worldId: CinematicWorldMode, key: string): boolean {
  return WORLD_COLOR_SETTING_KEYS[worldId]?.includes(key) ?? false
}

function worldEnumOptionId(key: string, value: string): CinemaEnumOptionId {
  return cinemaStableId<CinemaEnumOptionId>(stableSegment(`${key}-${value}`), 'enum option')
}

function readQuality(value: unknown, fallback: CinematicQualityTier): CinematicQualityTier {
  const matched = CINEMATIC_QUALITY_TIERS.find(candidate => value === qualityOptionId(candidate))
  return matched ?? fallback
}

function readWorldEnum(key: string, value: unknown, fallback: string): string {
  const options = REACTIVE_ENUMS[key] ?? [fallback]
  return options.find(candidate => value === worldEnumOptionId(key, candidate)) ?? fallback
}

function numberValue(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function colorHex(value: CinemaColor | undefined, fallback: string): string {
  if (!value || value.length < 3) return fallback
  return `#${value.slice(0, 3).map(component => Math.round(clamp01(component) * 255).toString(16).padStart(2, '0')).join('')}`
}

function titleCase(value: string): string {
  return value.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[-_]+/g, ' ').replace(/\b\w/g, character => character.toUpperCase())
}

function stableSegment(value: string): string {
  return value.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'value'
}

function namespacedSegment(value: string): string {
  return stableSegment(value)
}

function clamp01(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0
}

function clampToRange(value: number, minimum: number, maximum: number): number {
  const finite = Number.isFinite(value) ? value : minimum
  return Math.min(maximum, Math.max(minimum, finite))
}


function cloneJson<Value>(value: Value): Value {
  return JSON.parse(JSON.stringify(value)) as Value
}

function deepFreeze<Value>(value: Value): Value {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested)
  }
  return value
}

const CANVAS_UPLOAD_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D uCanvasTexture;
uniform float uOpacity;
out vec4 outColor;
void main() {
  vec4 color = texture(uCanvasTexture, v_uv);
  outColor = vec4(color.rgb * uOpacity, color.a * uOpacity);
}`
