import { notify } from '../../../stores/notificationStore'
import { REACT_ENGINE_CATALOG } from './reactEngineCatalog'
import type { ReactEngineId } from './ReactTypes'

/**
 * Posts the card for a live engine whose renderer could not start or stopped drawing. The engine is retired when this
 * happens, so without a card the user is left looking at a frozen or empty canvas with no explanation.
 */
export function reportReactEngineFailure(engine: ReactEngineId, stage: 'setup-failed' | 'render-failed', error: unknown): void {
  const label = REACT_ENGINE_CATALOG[engine]?.label ?? 'The engine'
  const detail = (error instanceof Error ? error.message : typeof error === 'string' ? error : '').trim()
  notify('react', {
    tone: 'error',
    title: stage === 'setup-failed' ? `${label} could not start` : `${label} stopped rendering`,
    message: `${stage === 'setup-failed' ? 'The preview could not be set up.' : 'The preview hit an error and was stopped.'} Select the engine or preset again to restart it.${detail ? ` (${detail})` : ''}`,
  })
}
