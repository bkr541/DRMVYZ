import { useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useReactStore } from '../../../stores/reactStore'
import { migrateLegacyCinemaStoreToCinema2 } from '../cinema2/migration/Cinema2LegacyStateMigration'
import { resolveCinemaLegacySourceForComposition } from '../cinema/CinemaLegacyRetirement'
import { snapshotCinemaPersistedState } from '../cinema/CinemaPersistence'
import { useCinemaStore } from '../cinema/CinemaStore'

/**
 * Phase-4 data bridge. The legacy store remains mounted until Phase 5, but its
 * durable document is copied exactly once into the Cinema 2.0 workspace and a
 * known active built-in is translated through the typed migration manifest.
 */
export function useCinemaLegacyRetirement(): void {
  const legacyState = useCinemaStore(useShallow(state => ({
    definitions: state.definitions,
    compositions: state.compositions,
    instances: state.instances,
    collections: state.collections,
    activeCompositionId: state.activeCompositionId,
    activeInstanceId: state.activeInstanceId,
    editorMetadata: state.editorMetadata,
    migrationProvenance: state.migrationProvenance,
  })))
  const workspace = useReactStore(state => state.cinema2Workspace)

  useEffect(() => {
    const snapshot = snapshotCinemaPersistedState({
      ...useCinemaStore.getState(),
      ...legacyState,
    })
    const source = resolveCinemaLegacySourceForComposition(snapshot.activeCompositionId)
    const nextWorkspace = migrateLegacyCinemaStoreToCinema2({
      workspace,
      legacyDocument: snapshot,
      activeSource: source
        ? { sourceEngineId: source.legacyEngineId, sourceId: source.legacySourceId }
        : null,
    })
    if (nextWorkspace === workspace || JSON.stringify(nextWorkspace) === JSON.stringify(workspace)) return
    useReactStore.setState(state => ({
      cinema2Workspace: nextWorkspace,
      ...(state.activeReactEngineId === 'cinema'
        ? { activeReactEngineId: 'cinema2' as const, activeReactPresetId: null }
        : {}),
      pendingCinemaLegacySelectionMigration: null,
    }))
  }, [legacyState, workspace])
}
