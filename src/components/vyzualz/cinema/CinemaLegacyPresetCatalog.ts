import type { CinemaCompositionDefinition, CinemaJsonObject } from './CinemaDomain'
import {
  cinemaStableId,
  type CinemaCompositionId,
  type CinemaNodeId,
  type CinemaNodeTypeId,
  type CinemaPortId,
} from './CinemaIdentifiers'
import {
  CINEMA_SHADER_SCENE_ADAPTER_VERSION,
  cinemaShaderSceneTypeId,
  createCinemaShaderSceneComposition,
} from './CinemaShaderSceneAdapter'
import {
  CINEMA_CINEMATIC_WORLD_ADAPTER_VERSION,
  cinemaCinematicWorldTypeId,
  createCinemaCinematicPresetComposition,
} from './CinemaCinematicWorldAdapter'
import { PRODUCTION_SCENES, SHADER_SCENE_REGISTRY_AUDIT } from '../react/shaders/scenes'
import { DEFAULT_REACT_PRESETS } from '../react/ReactTypes'
import type { CinematicWorldMode } from '../react/CinematicWorldConfig'

export const CINEMA_LEGACY_PRESET_CATALOG_VERSION = 1 as const

export type CinemaLegacyPresetSourceKind = 'shader-scene' | 'cinematic-preset'

export interface CinemaLegacyPresetManifestEntry {
  sourceKind: CinemaLegacyPresetSourceKind
  legacyEngineId: 'shaderPads' | 'cinematicPortal'
  legacySourceId: string
  worldId?: CinematicWorldMode
  compositionId: CinemaCompositionId
  adapterNodeTypeId: CinemaNodeTypeId
}

export interface CinemaLegacyPresetCatalog {
  version: typeof CINEMA_LEGACY_PRESET_CATALOG_VERSION
  manifest: readonly CinemaLegacyPresetManifestEntry[]
  compositions: readonly CinemaCompositionDefinition[]
  audit: {
    shaderSceneExclusions: Readonly<Record<string, string>>
    cinematicPresetCount: number
  }
}

export function createCinemaLegacyPresetCatalog(
  outputTypeId: CinemaNodeTypeId,
  outputInputPortId: CinemaPortId,
): CinemaLegacyPresetCatalog {
  const manifest: CinemaLegacyPresetManifestEntry[] = []
  const compositions: CinemaCompositionDefinition[] = []

  for (const scene of PRODUCTION_SCENES) {
    const compositionId = legacyCompositionId('shader', scene.id)
    const sceneNodeId = legacyNodeId('shader', scene.id)
    const outputNodeId = legacyNodeId('shader-output', scene.id)
    const base = createCinemaShaderSceneComposition(scene.id, outputTypeId, outputInputPortId, {
      compositionId,
      sceneNodeId,
      outputNodeId,
      name: scene.name,
      description: scene.description,
    })
    const node = base.nodes.find(candidate => candidate.id === sceneNodeId)
    if (!node) throw new Error(`Cinema catalog could not resolve Shader scene node "${scene.id}".`)
    compositions.push(deepFreeze({
      ...base,
      metadata: {
        ...base.metadata,
        name: scene.name,
        description: scene.description,
        tags: uniqueStrings(['built-in', 'legacy-catalog', 'shader-pads', scene.category, ...(scene.tags ?? [])]),
        provenance: {
          builtIn: true,
          stage: 21,
          catalogVersion: CINEMA_LEGACY_PRESET_CATALOG_VERSION,
          sourceEngine: 'shaderPads',
          sourceId: scene.id,
          adapter: 'shader-scene',
          adapterVersion: CINEMA_SHADER_SCENE_ADAPTER_VERSION,
        },
      },
      nodes: base.nodes.map(candidate => candidate.id === sceneNodeId ? {
        ...candidate,
        metadata: {
          ...candidate.metadata,
          legacyCatalog: jsonClone({
            sceneId: scene.id,
            category: scene.category,
            version: scene.version,
            tags: scene.tags ?? [],
            quality: scene.quality ?? null,
            performanceProgram: scene.performanceProgram ?? null,
          }),
        },
      } : candidate),
    }))
    manifest.push(deepFreeze({
      sourceKind: 'shader-scene',
      legacyEngineId: 'shaderPads',
      legacySourceId: scene.id,
      compositionId,
      adapterNodeTypeId: cinemaShaderSceneTypeId(scene.id),
    }))
  }

  const cinematicPresets = DEFAULT_REACT_PRESETS.filter(preset => preset.engine === 'cinematicPortal')
  for (const preset of cinematicPresets) {
    const config = preset.cinematicConfig
    if (!config) throw new Error(`Active Cinematic Worlds preset "${preset.id}" is missing cinematicConfig.`)
    const compositionId = legacyCompositionId('cinematic', preset.id)
    compositions.push(createCinemaCinematicPresetComposition(preset, outputTypeId, outputInputPortId, {
      compositionId,
      worldNodeId: legacyNodeId('cinematic', preset.id),
      outputNodeId: legacyNodeId('cinematic-output', preset.id),
    }))
    manifest.push(deepFreeze({
      sourceKind: 'cinematic-preset',
      legacyEngineId: 'cinematicPortal',
      legacySourceId: preset.id,
      worldId: config.worldMode,
      compositionId,
      adapterNodeTypeId: cinemaCinematicWorldTypeId(config.worldMode),
    }))
  }

  assertOneToOneManifest(manifest, compositions)
  return deepFreeze({
    version: CINEMA_LEGACY_PRESET_CATALOG_VERSION,
    manifest,
    compositions,
    audit: {
      shaderSceneExclusions: { ...SHADER_SCENE_REGISTRY_AUDIT },
      cinematicPresetCount: cinematicPresets.length,
    },
  })
}

function legacyCompositionId(kind: 'shader' | 'cinematic', legacyId: string): CinemaCompositionId {
  return cinemaStableId<CinemaCompositionId>(stableSegment(`legacy-${kind}-${legacyId}`), 'composition')
}

function legacyNodeId(kind: string, legacyId: string): CinemaNodeId {
  return cinemaStableId<CinemaNodeId>(stableSegment(`legacy-${kind}-${legacyId}`), 'node')
}

function stableSegment(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'legacy'
}

function uniqueStrings(values: readonly (string | undefined)[]): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))]
}

function jsonClone(value: unknown): CinemaJsonObject {
  return JSON.parse(JSON.stringify(value)) as CinemaJsonObject
}

function assertOneToOneManifest(
  manifest: readonly CinemaLegacyPresetManifestEntry[],
  compositions: readonly CinemaCompositionDefinition[],
): void {
  const sourceKeys = new Set<string>()
  const compositionIds = new Set<string>()
  for (const entry of manifest) {
    const sourceKey = `${entry.legacyEngineId}:${entry.legacySourceId}`
    if (sourceKeys.has(sourceKey)) throw new Error(`Duplicate Cinema legacy catalog source "${sourceKey}".`)
    if (compositionIds.has(entry.compositionId)) throw new Error(`Duplicate Cinema legacy catalog composition "${entry.compositionId}".`)
    sourceKeys.add(sourceKey)
    compositionIds.add(entry.compositionId)
  }
  if (manifest.length !== compositions.length) throw new Error('Cinema legacy catalog manifest/composition counts diverged.')
  for (const composition of compositions) {
    if (!compositionIds.has(composition.id)) throw new Error(`Cinema legacy catalog composition "${composition.id}" has no manifest entry.`)
  }
}

function deepFreeze<Value>(value: Value): Value {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested)
  }
  return value
}
