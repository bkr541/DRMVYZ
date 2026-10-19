import { useEffect } from 'react'
import { useReactStore } from '../../../stores/reactStore'
import {
  readLegacyCinemaPersistedDocument,
  resolveLegacyCinemaPersistedActiveSource,
} from '../cinema2/migration/Cinema2LegacyPersistenceReader'
import { migrateLegacyCinemaStoreToCinema2 } from '../cinema2/migration/Cinema2LegacyStateMigration'

/**
 * One-way, data-only compatibility read for users upgrading directly from the
 * retired Cinema store. No legacy runtime module is loaded by this hook.
 */
export function useCinema2LegacyPersistenceMigration(): void {
  useEffect(() => {
    let cancelled = false
    const migrate = () => {
      void readLegacyCinemaPersistedDocument().then(legacyDocument => {
        if (cancelled || !legacyDocument) return
        useReactStore.setState(state => {
          const cinema2Workspace = migrateLegacyCinemaStoreToCinema2({
            workspace: state.cinema2Workspace,
            legacyDocument,
            activeSource: resolveLegacyCinemaPersistedActiveSource(legacyDocument),
          })
          if (cinema2Workspace === state.cinema2Workspace && state.activeReactEngineId !== 'cinema') return {}
          return {
            cinema2Workspace,
            ...(state.activeReactEngineId === 'cinema'
              ? { activeReactEngineId: 'cinema2' as const, activeReactPresetId: null }
              : {}),
            pendingCinemaLegacySelectionMigration: null,
          }
        })
      }).catch(error => {
        console.warn('[Cinema 2.0] Legacy persistence migration could not be read.', error)
      })
    }
    let unsubscribe = () => undefined
    if (useReactStore.persist.hasHydrated()) migrate()
    else unsubscribe = useReactStore.persist.onFinishHydration(migrate)
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])
}
