import { getFilterGroups, matchesPreset, searchStudyPresets, type Facet, type FilterPreset } from './presetFilterStudyData'

export type SearchMode = 'grouped-search' | 'metadata-suggestions' | 'visual-search'
export type PopupChoice = { kind: 'preset'; key: string; preset: FilterPreset }
  | { kind: 'facet'; key: string; facet: Facet; value: string; label: string; count: number }
export interface PopupSection { label: string; choices: PopupChoice[] }

export function getPopupSections(mode: SearchMode, presets: readonly FilterPreset[], query: string): PopupSection[] {
  const matches = searchStudyPresets(presets, query)
  const row = (preset: FilterPreset): PopupChoice => ({ kind: 'preset', key: `preset:${preset.id}`, preset })
  if (mode === 'visual-search') return matches.length ? [{ label: 'Presets', choices: matches.map(row) }] : []
  if (!query.trim()) return []
  if (mode === 'grouped-search') {
    const tokens = query.trim().toLowerCase().split(/\s+/)
    const byName = (preset: FilterPreset) => tokens.every(token => preset.name.toLowerCase().includes(token))
    return [{ label: 'Preset names', choices: matches.filter(byName).map(row) },
      { label: 'Metadata matches', choices: matches.filter(preset => !byName(preset)).map(row) }].filter(section => section.choices.length)
  }
  // Exact-value suggestions are not duplicate preset hits. Counts are for the
  // full scoped library, because choosing a suggestion replaces the text query.
  const sections: PopupSection[] = getFilterGroups(presets).filter(group => group.id !== 'name' && group.id !== 'favorite').map(group => ({
    label: group.label,
    choices: group.options.filter(option => query.trim().toLowerCase().split(/\s+/).every(token => option.label.toLowerCase().includes(token))).map(option => ({
      kind: 'facet' as const, key: `${group.id}:${option.value}`, facet: group.id, value: option.value, label: option.label,
      count: presets.filter(preset => matchesPreset(preset, '', { [group.id]: [option.value] })).length,
    })),
  }))
  return [...sections, { label: 'Presets', choices: matches.map(row) }].filter(section => section.choices.length)
}
