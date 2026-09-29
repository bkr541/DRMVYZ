// Which sub-tab of a Presets tab a preset belongs to.
//
// The catalog (`presets`) only needs a row for a preset that is NOT public. A preset with no row, or a row whose scope is 'system', is a system
// preset: shown to everyone under SYSTEM. A row with scope 'user' is private: it is shown under USER to the users who hold it (`user_presets`)
// and is hidden from everyone else, including under SYSTEM. So a new preset added in code is a system preset with no database work.

export type PresetScopeTab = 'system' | 'user'

/** Where a preset appears for the current user: a sub-tab, or nowhere (a private preset someone else holds). */
export type ResolvedPresetScope = PresetScopeTab | 'hidden'

export interface PresetCatalogEntry {
  id: string
  engine_id: string
  preset_key: string
  scope: PresetScopeTab
}

export interface PresetCatalogSnapshot {
  entries: readonly PresetCatalogEntry[]
  /** Catalog ids (`presets.id`) the current user holds in `user_presets`. */
  heldPresetIds: readonly string[]
}

export const EMPTY_PRESET_CATALOG: PresetCatalogSnapshot = { entries: [], heldPresetIds: [] }

export function resolvePresetScope(snapshot: PresetCatalogSnapshot, engineId: string, presetKey: string): ResolvedPresetScope {
  const entry = snapshot.entries.find(candidate => candidate.engine_id === engineId && candidate.preset_key === presetKey)
  if (!entry || entry.scope === 'system') return 'system'
  return snapshot.heldPresetIds.includes(entry.id) ? 'user' : 'hidden'
}

/** A predicate for one engine's Presets tab: does this preset belong under the given sub-tab? */
export function createPresetScopeFilter(snapshot: PresetCatalogSnapshot, engineId: string, tab: PresetScopeTab): (presetKey: string) => boolean {
  return presetKey => resolvePresetScope(snapshot, engineId, presetKey) === tab
}
