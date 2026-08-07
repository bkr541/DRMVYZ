import type { CinematicWorldConfig } from '../react/CinematicWorldConfig'
import type { ReactPerformancePad, ReactPreset, ReactPresetAutomationCue } from '../react/ReactTypes'
import type {
  CinemaCollectionDefinition,
  CinemaCompositionDefinition,
  CinemaCompositionInstance,
  CinemaJsonObject,
  CinemaParameterValues,
} from './CinemaDomain'
import {
  cinemaStableId,
  type CinemaCollectionId,
  type CinemaCompositionId,
  type CinemaCompositionInstanceId,
} from './CinemaIdentifiers'
import { CINEMA_LEGACY_PRESET_CATALOG } from './CinemaFoundation'
import { createCinemaCinematicPresetComposition } from './CinemaCinematicWorldAdapter'
import { cinemaShaderParameterId, createCinemaShaderSceneParameterValues } from './CinemaShaderSceneAdapter'

export const CINEMA_LEGACY_ENGINE_IDS = Object.freeze(['shaderPads', 'cinematicPortal'] as const)
export type CinemaLegacyEngineId = typeof CINEMA_LEGACY_ENGINE_IDS[number]

export interface CinemaLegacySelectionMigration {
  legacyEngineId: CinemaLegacyEngineId
  legacySourceId: string | null
}

export interface CinemaLegacyMasterControls {
  intensity: number
  motion: number
  glow: number
  bassReactivity: number
  trailDecay: number
  fogDensity: number
  particleDensity: number
}

export function isCinemaLegacyEngineId(value: unknown): value is CinemaLegacyEngineId {
  return value === 'shaderPads' || value === 'cinematicPortal'
}


export function resolveCinemaLegacyFallbackSourceId(engineId: CinemaLegacyEngineId): string | null {
  return CINEMA_LEGACY_PRESET_CATALOG.manifest.find(entry => entry.legacyEngineId === engineId)?.legacySourceId ?? null
}

export function normalizeCinemaLegacySelectionMigration(
  engineId: unknown,
  sourceId: unknown,
): CinemaLegacySelectionMigration | null {
  if (!isCinemaLegacyEngineId(engineId)) return null
  const requestedSourceId = typeof sourceId === 'string' && sourceId ? sourceId : null
  const mappedSourceId = requestedSourceId && resolveCinemaLegacyCompositionId(engineId, requestedSourceId)
    ? requestedSourceId
    : engineId === 'shaderPads' && requestedSourceId == null
      ? null
      : resolveCinemaLegacyFallbackSourceId(engineId)
  return { legacyEngineId: engineId, legacySourceId: mappedSourceId }
}

export function resolveCinemaLegacyManifestEntry(
  legacyEngineId: CinemaLegacyEngineId,
  legacySourceId: string,
) {
  return CINEMA_LEGACY_PRESET_CATALOG.manifest.find(entry => (
    entry.legacyEngineId === legacyEngineId && entry.legacySourceId === legacySourceId
  )) ?? null
}

export function resolveCinemaLegacyCompositionId(
  legacyEngineId: CinemaLegacyEngineId,
  legacySourceId: string,
): CinemaCompositionId | null {
  return resolveCinemaLegacyManifestEntry(legacyEngineId, legacySourceId)?.compositionId ?? null
}

export function resolveCinemaLegacySourceForComposition(compositionId: string | null | undefined) {
  if (!compositionId) return null
  return CINEMA_LEGACY_PRESET_CATALOG.manifest.find(entry => entry.compositionId === compositionId) ?? null
}

export function migrateLegacyPerformancePadsToCinema(
  pads: readonly ReactPerformancePad[],
): ReactPerformancePad[] {
  return pads.map(pad => {
    if (!pad.presetId) return { ...pad }
    const compositionId = resolveCinemaLegacyCompositionId('cinematicPortal', pad.presetId)
    return compositionId
      ? { ...pad, presetId: null, cinemaCompositionId: compositionId }
      : { ...pad }
  })
}

export function migrateLegacyPresetAutomationCuesToCinema(
  cuesByTrackId: Readonly<Record<string, readonly ReactPresetAutomationCue[]>>,
): Record<string, ReactPresetAutomationCue[]> {
  return Object.fromEntries(Object.entries(cuesByTrackId).map(([trackId, cues]) => [
    trackId,
    cues.map(cue => {
      if (!cue.presetId) return { ...cue }
      const compositionId = resolveCinemaLegacyCompositionId('cinematicPortal', cue.presetId)
      return compositionId
        ? { ...cue, presetId: null, cinemaCompositionId: compositionId }
        : { ...cue }
    }),
  ]))
}

export function legacyRetirementInstanceId(
  engineId: CinemaLegacyEngineId,
  sourceId: string,
): CinemaCompositionInstanceId {
  return cinemaStableId<CinemaCompositionInstanceId>(
    `legacy-${engineId === 'shaderPads' ? 'shader' : 'cinematic'}-${stableSegment(sourceId)}-migration`,
    'composition instance',
  )
}

export function buildLegacyShaderCinemaInstance(input: {
  composition: CinemaCompositionDefinition
  sceneId: string
  shaderValues?: Readonly<Record<string, unknown>>
  masterControls?: CinemaLegacyMasterControls | null
  instanceIdSource?: string
  label?: string
}): CinemaCompositionInstance {
  const entry = resolveCinemaLegacyManifestEntry('shaderPads', input.sceneId)
  if (!entry || entry.compositionId !== input.composition.id) {
    throw new Error(`Shader scene "${input.sceneId}" does not map to Cinema composition "${input.composition.id}".`)
  }
  const sceneNode = input.composition.nodes.find(node => node.typeId === entry.adapterNodeTypeId)
  if (!sceneNode) throw new Error(`Cinema Shader composition "${input.composition.id}" is missing its adapter node.`)

  const masterOverrides: CinemaParameterValues = input.masterControls ? {
    [cinemaShaderParameterId('master-intensity')]: input.masterControls.intensity,
    [cinemaShaderParameterId('master-motion')]: input.masterControls.motion,
    [cinemaShaderParameterId('master-glow')]: input.masterControls.glow,
    [cinemaShaderParameterId('master-bass-reactivity')]: input.masterControls.bassReactivity,
    [cinemaShaderParameterId('master-trail-decay')]: input.masterControls.trailDecay,
    [cinemaShaderParameterId('master-fog-density')]: input.masterControls.fogDensity,
    [cinemaShaderParameterId('master-particle-density')]: input.masterControls.particleDensity,
  } : {}

  return {
    id: legacyRetirementInstanceId('shaderPads', input.instanceIdSource ?? input.sceneId),
    compositionId: input.composition.id,
    label: input.label ?? `${String(input.composition.metadata.name ?? input.sceneId)} · Legacy Migration`,
    revision: 1,
    masterOverrides,
    nodeOverrides: [{
      nodeId: sceneNode.id,
      values: createCinemaShaderSceneParameterValues(input.sceneId, input.shaderValues ?? {}),
    }],
    cameraOverrides: [],
    assetBindingOverrides: [],
    metadata: legacyMigrationMetadata('shaderPads', input.sceneId),
  }
}

export function buildLegacyCinematicCinemaInstance(input: {
  composition: CinemaCompositionDefinition
  preset: ReactPreset
  config?: CinematicWorldConfig | null
  masterControls?: CinemaLegacyMasterControls | null
}): CinemaCompositionInstance {
  const entry = resolveCinemaLegacyManifestEntry('cinematicPortal', input.preset.id)
  if (!entry || entry.compositionId !== input.composition.id) {
    throw new Error(`Cinematic preset "${input.preset.id}" does not map to Cinema composition "${input.composition.id}".`)
  }
  const outputNode = input.composition.nodes.find(node => node.id === input.composition.outputNodeId)
  const worldNode = input.composition.nodes.find(node => node.typeId === entry.adapterNodeTypeId)
  const outputConnection = input.composition.connections.find(connection => connection.to.nodeId === input.composition.outputNodeId)
  if (!outputNode || !worldNode || !outputConnection) {
    throw new Error(`Cinema Cinematic composition "${input.composition.id}" is missing its canonical adapter/output path.`)
  }

  const controls = input.masterControls
  const migratedPreset: ReactPreset = {
    ...input.preset,
    ...(controls ? {
      params: {
        intensity: controls.intensity,
        motion: controls.motion,
        glow: controls.glow,
        bassReactivity: controls.bassReactivity,
      },
      renderSettings: {
        trailDecay: controls.trailDecay,
        fogDensity: controls.fogDensity,
        particleDensity: controls.particleDensity,
      },
    } : {}),
    ...(input.config ? { cinematicConfig: input.config } : {}),
  }
  const authored = createCinemaCinematicPresetComposition(
    migratedPreset,
    outputNode.typeId,
    outputConnection.to.portId,
    {
      compositionId: input.composition.id,
      worldNodeId: worldNode.id,
      outputNodeId: outputNode.id,
    },
  )
  const authoredWorld = authored.nodes.find(node => node.id === worldNode.id)
  if (!authoredWorld) throw new Error(`Migrated Cinematic preset "${input.preset.id}" did not produce its world node.`)

  return {
    id: legacyRetirementInstanceId('cinematicPortal', input.preset.id),
    compositionId: input.composition.id,
    label: `${input.preset.name} · Legacy Migration`,
    revision: 1,
    masterOverrides: {},
    nodeOverrides: [{ nodeId: worldNode.id, values: authoredWorld.parameterValues }],
    cameraOverrides: authored.cameras.map(camera => ({ cameraId: camera.id, values: camera.parameterValues })),
    assetBindingOverrides: [],
    metadata: legacyMigrationMetadata('cinematicPortal', input.preset.id),
  }
}

export function createLegacyCinemaCollection(
  label: string,
  compositionIds: readonly CinemaCompositionId[],
  source: string,
): CinemaCollectionDefinition | null {
  const uniqueIds = [...new Set(compositionIds)]
  if (uniqueIds.length === 0) return null
  return {
    id: cinemaStableId<CinemaCollectionId>(`legacy-${stableSegment(label)}-${stableHash(`${source}:${label}`)}`, 'collection'),
    label,
    compositionIds: uniqueIds,
    metadata: {
      migration: 'stage-23-legacy-engine-retirement',
      source,
    },
  }
}

function legacyMigrationMetadata(engineId: CinemaLegacyEngineId, sourceId: string): CinemaJsonObject {
  return {
    migration: 'stage-23-legacy-engine-retirement',
    sourceEngine: engineId,
    sourceId,
  }
}

function stableSegment(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'legacy'
}

function stableHash(value: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(36)
}
