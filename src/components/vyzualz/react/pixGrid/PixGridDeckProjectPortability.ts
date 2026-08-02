import { useReactStore } from '../../../../stores/reactStore'
import {
  exportPixGridDeckProjectMediaBundle,
  importPixGridDeckProjectMediaBundle,
  type PixGridDeckProjectExportOptions,
  type PixGridDeckProjectImportResult,
  type PixGridDeckProjectMediaBundle,
} from './PixGridDeckProjectMedia'

/** Canonical project export boundary for persisted Deck definitions and source bytes. */
export function exportCurrentPixGridDeckProjectMediaBundle(
  options: PixGridDeckProjectExportOptions = {},
): Promise<PixGridDeckProjectMediaBundle> {
  return exportPixGridDeckProjectMediaBundle(useReactStore.getState().pixGridDecks, options)
}

/**
 * Restores source media first, then atomically replaces the project-owned Deck
 * collection and generated Preset references. Runtime caches are rebuilt by the
 * existing compiler subscription and are never imported.
 */
export async function importPixGridDeckProjectMediaBundleIntoStore(
  bundle: PixGridDeckProjectMediaBundle,
): Promise<PixGridDeckProjectImportResult> {
  const result = await importPixGridDeckProjectMediaBundle(bundle)
  useReactStore.getState().replacePixGridDeckProject(result.decks)
  return result
}
