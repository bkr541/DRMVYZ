import { createSplitPersistStorage } from '../../../../lib/splitPersistStorage'
import type { Cinema2LegacySourceIdentity } from './Cinema2LegacyStateMigration'

const LEGACY_CINEMA_STORAGE_NAME = 'drmvyz:cinema-store'

const LEGACY_CINEMA_PROJECT_KEYS = Object.freeze([
  'schemaId',
  'schemaVersion',
  'definitions',
  'compositions',
  'instances',
  'collections',
  'activeCompositionId',
  'activeInstanceId',
  'editorMetadata',
  'migrationProvenance',
] as const)

const legacyCinemaStorage = createSplitPersistStorage<Record<string, unknown>>({
  projectKeys: LEGACY_CINEMA_PROJECT_KEYS,
})

/**
 * Reads the retired store's persisted data without importing or constructing
 * its Zustand store, renderer, runtime, or React workspace.
 */
export async function readLegacyCinemaPersistedDocument(): Promise<Record<string, unknown> | null> {
  const envelope = await legacyCinemaStorage.getItem(LEGACY_CINEMA_STORAGE_NAME)
  return isRecord(envelope?.state) ? envelope.state : null
}

/** Resolves the source identity embedded in legacy built-in composition metadata. */
export function resolveLegacyCinemaPersistedActiveSource(
  document: unknown,
): Cinema2LegacySourceIdentity | null {
  if (!isRecord(document) || typeof document.activeCompositionId !== 'string') return null
  if (!Array.isArray(document.compositions)) return null
  const active = document.compositions.find(candidate => (
    isRecord(candidate) && candidate.id === document.activeCompositionId
  ))
  if (!isRecord(active) || !isRecord(active.metadata) || !isRecord(active.metadata.provenance)) return null
  const sourceEngineId = active.metadata.provenance.sourceEngine
  const sourceId = active.metadata.provenance.sourceId
  if ((sourceEngineId !== 'shaderPads' && sourceEngineId !== 'cinematicPortal') || typeof sourceId !== 'string') {
    return null
  }
  return { sourceEngineId, sourceId }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
