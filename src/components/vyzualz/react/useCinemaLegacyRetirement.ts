import { useEffect, useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useReactStore } from '../../../stores/reactStore'
import {
  buildLegacyCinematicCinemaInstance,
  buildLegacyShaderCinemaInstance,
  createLegacyCinemaCollection,
  resolveCinemaLegacyCompositionId,
  resolveCinemaLegacyFallbackSourceId,
} from '../cinema/CinemaLegacyRetirement'
import { useCinemaStore } from '../cinema/CinemaStore'
import { snapshotCinemaPersistedState } from '../cinema/CinemaPersistence'
import type { CinemaCompositionId } from '../cinema/CinemaIdentifiers'
import { useShaderPanelStore } from './shaders/ui/shaderPanelStore'
import { useShaderLibraryStore } from './shaders/library/ShaderLibraryStore'
import { DEFAULT_SHADER_SCENE_ID } from './shaders/scenes'
import { readReactPresetFavorites, writeReactPresetFavorites } from './reactPresetLibraryState'

const STAGE_23_RETIREMENT_METADATA_KEY = 'stage23LegacyEngineRetirementComplete'

/**
 * Final Stage-23 compatibility handoff. Legacy stores remain readable so old
 * projects can be reconstructed, while all public selection lands in Cinema's
 * canonical persisted composition/instance document.
 */
export function useCinemaLegacyRetirement(): void {
  const pending = useReactStore(state => state.pendingCinemaLegacySelectionMigration)
  const reactPresets = useReactStore(state => state.reactPresets)
  const cinematicConfigsByPresetId = useReactStore(state => state.cinematicConfigsByPresetId)
  const masterControls = useReactStore(useShallow(state => ({
    intensity: state.reactIntensity,
    motion: state.reactMotion,
    glow: state.reactGlow,
    bassReactivity: state.reactBassReactivity,
    trailDecay: state.reactTrailDecay,
    fogDensity: state.reactFogDensity,
    particleDensity: state.reactParticleDensity,
  })))
  const completePendingMigration = useReactStore(state => state.completeCinemaLegacySelectionMigration)

  const activeShaderId = useShaderPanelStore(state => state.activeShaderId)
  const paramValuesByShaderId = useShaderPanelStore(state => state.paramValuesByShaderId)
  const shaderFavorites = useShaderLibraryStore(state => state.favorites)
  const shaderCollections = useShaderLibraryStore(state => state.collections)
  const shaderRecentlyUsed = useShaderLibraryStore(state => state.recentlyUsed)
  const shaderPresets = useShaderLibraryStore(state => state.shaderPresets)

  const cinemaCompositions = useCinemaStore(state => state.compositions)
  const cinemaInstances = useCinemaStore(state => state.instances)
  const cinemaCollections = useCinemaStore(state => state.collections)
  const activeCinemaCompositionId = useCinemaStore(state => state.activeCompositionId)
  const activeCinemaInstanceId = useCinemaStore(state => state.activeInstanceId)

  const compositionById = useMemo(
    () => new Map(cinemaCompositions.map(composition => [String(composition.id), composition])),
    [cinemaCompositions],
  )

  useEffect(() => {
    const cinema = useCinemaStore.getState()
    const snapshot = snapshotCinemaPersistedState(cinema)
    const libraryMigrationComplete = snapshot.editorMetadata[STAGE_23_RETIREMENT_METADATA_KEY] === true
    let instances = [...snapshot.instances]
    let collections = [...snapshot.collections]
    let nextActiveCompositionId = snapshot.activeCompositionId
    let nextActiveInstanceId = snapshot.activeInstanceId
    let changed = false

    const upsertInstance = (instance: typeof instances[number]) => {
      const index = instances.findIndex(candidate => candidate.id === instance.id)
      if (index >= 0) {
        if (!serializableEqual(instances[index], instance)) {
          instances[index] = instance
          changed = true
        }
      } else {
        instances.push(instance)
        changed = true
      }
    }

    const upsertCollection = (collection: typeof collections[number] | null) => {
      if (!collection) return
      const index = collections.findIndex(candidate => candidate.id === collection.id)
      if (index >= 0) {
        if (!serializableEqual(collections[index], collection)) {
          collections[index] = collection
          changed = true
        }
      } else {
        collections.push(collection)
        changed = true
      }
    }

    // Copy compatibility-library state once per Cinema document. After this
    // marker is committed, Cinema is authoritative and this bridge must never
    // overwrite later edits made to the migrated instances or collections.
    const reactFavoriteIds = readReactPresetFavorites()
    let migratedReactFavoriteIds: CinemaCompositionId[] = []
    if (!libraryMigrationComplete) {
      // Preserve authored per-scene Shader values, including changes that were
      // never saved as a named Shader Library preset.
      for (const [sceneId, shaderValues] of Object.entries(paramValuesByShaderId)) {
        const compositionId = resolveCinemaLegacyCompositionId('shaderPads', sceneId)
        const composition = compositionId ? compositionById.get(String(compositionId)) : null
        if (!composition) continue
        upsertInstance(buildLegacyShaderCinemaInstance({
          composition,
          sceneId,
          shaderValues,
        }))
      }

      // Named Shader Library presets become stable Cinema instances.
      for (const preset of Object.values(shaderPresets)) {
        const compositionId = resolveCinemaLegacyCompositionId('shaderPads', preset.sceneId)
        const composition = compositionId ? compositionById.get(String(compositionId)) : null
        if (!composition) continue
        upsertInstance(buildLegacyShaderCinemaInstance({
          composition,
          sceneId: preset.sceneId,
          shaderValues: preset.values,
          instanceIdSource: `preset-${preset.id}`,
          label: preset.name,
        }))
      }

      // Cinematic Worlds stores authored configuration per preset. Preserve
      // every verified override, not only whichever preset happened to be active.
      for (const [presetId, config] of Object.entries(cinematicConfigsByPresetId)) {
        const compositionId = resolveCinemaLegacyCompositionId('cinematicPortal', presetId)
        const composition = compositionId ? compositionById.get(String(compositionId)) : null
        const preset = reactPresets.find(candidate => candidate.id === presetId && candidate.engine === 'cinematicPortal') ?? null
        if (!composition || !preset) continue
        upsertInstance(buildLegacyCinematicCinemaInstance({ composition, preset, config }))
      }

      migratedReactFavoriteIds = reactFavoriteIds.flatMap(presetId => {
        const compositionId = resolveCinemaLegacyCompositionId('cinematicPortal', presetId)
        return compositionId ? [compositionId] : []
      })
      const migratedShaderFavoriteIds = shaderFavorites.flatMap(sceneId => {
        const compositionId = resolveCinemaLegacyCompositionId('shaderPads', sceneId)
        return compositionId ? [compositionId] : []
      })
      upsertCollection(createLegacyCinemaCollection(
        'Legacy Visual Favorites',
        [...migratedReactFavoriteIds, ...migratedShaderFavoriteIds],
        'stage23:favorites',
      ))

      for (const [name, sceneIds] of Object.entries(shaderCollections)) {
        const compositionIds = sceneIds.flatMap(sceneId => {
          const compositionId = resolveCinemaLegacyCompositionId('shaderPads', sceneId)
          return compositionId ? [compositionId] : []
        })
        upsertCollection(createLegacyCinemaCollection(
          `Shader Pads · ${name}`,
          compositionIds,
          `stage23:shader-collection:${name}`,
        ))
      }
      upsertCollection(createLegacyCinemaCollection(
        'Shader Pads · Recently Used',
        shaderRecentlyUsed.flatMap(sceneId => {
          const compositionId = resolveCinemaLegacyCompositionId('shaderPads', sceneId)
          return compositionId ? [compositionId] : []
        }),
        'stage23:shader-recent',
      ))
      changed = true
    }

    let pendingCompleted = pending == null
    if (pending) {
      if (pending.legacyEngineId === 'shaderPads') {
        const requestedSceneId = pending.legacySourceId ?? activeShaderId ?? DEFAULT_SHADER_SCENE_ID
        const sceneId = resolveCinemaLegacyCompositionId('shaderPads', requestedSceneId)
          ? requestedSceneId
          : (resolveCinemaLegacyFallbackSourceId('shaderPads') ?? DEFAULT_SHADER_SCENE_ID)
        const compositionId = resolveCinemaLegacyCompositionId('shaderPads', sceneId)
        const composition = compositionId ? compositionById.get(String(compositionId)) : null
        if (composition) {
          const instance = buildLegacyShaderCinemaInstance({
            composition,
            sceneId,
            shaderValues: paramValuesByShaderId[sceneId] ?? {},
            masterControls,
          })
          upsertInstance(instance)
          nextActiveCompositionId = composition.id
          nextActiveInstanceId = instance.id
          pendingCompleted = true
        }
      } else {
        const sourceId = pending.legacySourceId ?? resolveCinemaLegacyFallbackSourceId('cinematicPortal')
        const compositionId = sourceId
          ? resolveCinemaLegacyCompositionId('cinematicPortal', sourceId)
          : null
        const composition = compositionId ? compositionById.get(String(compositionId)) : null
        const preset = sourceId
          ? reactPresets.find(candidate => candidate.id === sourceId && candidate.engine === 'cinematicPortal') ?? null
          : null
        if (sourceId && composition && preset) {
          const instance = buildLegacyCinematicCinemaInstance({
            composition,
            preset,
            config: cinematicConfigsByPresetId[sourceId] ?? preset.cinematicConfig ?? null,
            masterControls,
          })
          upsertInstance(instance)
          nextActiveCompositionId = composition.id
          nextActiveInstanceId = instance.id
          pendingCompleted = true
        }
      }
    }

    if (nextActiveCompositionId !== snapshot.activeCompositionId || nextActiveInstanceId !== snapshot.activeInstanceId) {
      changed = true
    }

    if (changed) {
      const result = cinema.hydrateCinemaState({
        ...snapshot,
        instances,
        collections,
        activeCompositionId: nextActiveCompositionId,
        activeInstanceId: nextActiveInstanceId,
        editorMetadata: libraryMigrationComplete
          ? snapshot.editorMetadata
          : { ...snapshot.editorMetadata, [STAGE_23_RETIREMENT_METADATA_KEY]: true },
      })
      if (!result.ok) return
    }

    // React preset favorites are no longer a public home for Cinematic Worlds.
    // Remove only IDs copied by this successful one-time migration; unrelated
    // favorites stay put and later Cinema edits remain fully authoritative.
    if (!libraryMigrationComplete && migratedReactFavoriteIds.length > 0) {
      const migratedLegacyPresetIds = new Set(
        reactFavoriteIds.filter(presetId => resolveCinemaLegacyCompositionId('cinematicPortal', presetId)),
      )
      writeReactPresetFavorites(reactFavoriteIds.filter(presetId => !migratedLegacyPresetIds.has(presetId)))
    }

    if (pending && pendingCompleted) completePendingMigration()
  }, [
    activeCinemaCompositionId,
    activeCinemaInstanceId,
    activeShaderId,
    cinematicConfigsByPresetId,
    cinemaCollections,
    cinemaInstances,
    completePendingMigration,
    compositionById,
    masterControls,
    paramValuesByShaderId,
    pending,
    reactPresets,
    shaderCollections,
    shaderFavorites,
    shaderPresets,
    shaderRecentlyUsed,
  ])
}

function serializableEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}
