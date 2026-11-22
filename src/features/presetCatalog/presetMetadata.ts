/**
 * Admin-managed metadata for the presets the app ships (table `preset_catalog_metadata`, migration 0056).
 *
 * A row is keyed like a Preset Manager record (`<engine>:<sourceId>`, which is `engine_id` and `preset_key` joined by a colon). Each column is an
 * override: NULL means "keep what the app ships", so a row only ever says what an admin changed. The app applies name, description, category, tags and
 * display order; the publication status and the store fields are kept for the store and for the admin to read.
 */
export interface PresetMetadataRow {
  engine_id: string
  preset_key: string
  name: string | null
  description: string | null
  category: string | null
  tags: string[] | null
  display_order: number | null
  publication_status: 'designing' | 'draft' | 'published' | 'archived' | null
  store_title: string | null
  store_subtitle: string | null
  store_cover_ref: string | null
  store_preview_ref: string | null
  updated_at?: string
}

export interface PresetMetadataTarget {
  id: string
  name: string
  description: string
  category: string
  tags: readonly string[]
}

export const presetMetadataKey = (engineId: string, presetKey: string) => `${engineId}:${presetKey}`

export function indexPresetMetadata(rows: readonly PresetMetadataRow[]): ReadonlyMap<string, PresetMetadataRow> {
  return new Map(rows.map(row => [presetMetadataKey(row.engine_id, row.preset_key), row]))
}

/**
 * The presets with the admin's overrides applied, in display order: a preset with no display order counts as 0, so a negative one moves it earlier and a
 * positive one later, and presets with equal order keep the order they were shipped in.
 */
export function applyPresetMetadata<T extends PresetMetadataTarget>(presets: readonly T[], metadata: ReadonlyMap<string, PresetMetadataRow>): T[] {
  if (metadata.size === 0) return [...presets]
  return presets
    .map((preset, index) => {
      const row = metadata.get(preset.id)
      const merged = row
        ? { ...preset, name: row.name ?? preset.name, description: row.description ?? preset.description, category: row.category ?? preset.category, tags: row.tags ?? preset.tags }
        : preset
      return { preset: merged, order: row?.display_order ?? 0, index }
    })
    .sort((a, b) => a.order - b.order || a.index - b.index)
    .map(entry => entry.preset)
}
