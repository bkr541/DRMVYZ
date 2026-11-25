export type Facet = 'name' | 'category' | 'favorite' | 'tag' | 'collection'
export type Filters = Partial<Record<Facet, string[]>>
export const DEFAULT_FILTERS: Filters = {}

export interface FilterPreset {
  id: string
  artworkId: string
  name: string
  description: string
  category: string
  tags: readonly string[]
  favorite: boolean
  collections: readonly { id: string; name: string }[]
}

export interface FilterOption { value: string; label: string }
export interface FilterGroup { id: Facet; label: string; options: FilterOption[] }

function namedOptions(values: readonly string[]): FilterOption[] {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b))
    .map(value => ({ value, label: value }))
}

export function getFilterGroups(presets: readonly FilterPreset[]): FilterGroup[] {
  const collections = new Map(presets.flatMap(preset => preset.collections.map(collection => [collection.id, collection.name] as const)))
  return [
    { id: 'name', label: 'Preset name', options: [...presets].sort((a, b) => a.name.localeCompare(b.name)).map(preset => ({ value: preset.id, label: preset.name })) },
    { id: 'category', label: 'Category', options: namedOptions(presets.map(preset => preset.category)) },
    { id: 'favorite', label: 'Favorites', options: [{ value: 'yes', label: 'Favorited' }, { value: 'no', label: 'Not favorited' }] },
    { id: 'tag', label: 'Tags', options: namedOptions(presets.flatMap(preset => [...preset.tags])) },
    { id: 'collection', label: 'Collections', options: [...collections].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label)) },
  ]
}

export function toggleValue(values: readonly string[], value: string): string[] {
  return values.includes(value) ? values.filter(item => item !== value) : [...values, value]
}

export function matchesPreset(preset: FilterPreset, query: string, filters: Filters): boolean {
  if (!preset.name.toLowerCase().includes(query.trim().toLowerCase())) return false
  const fields: Record<Facet, readonly string[]> = {
    name: [preset.id], category: [preset.category], favorite: [preset.favorite ? 'yes' : 'no'],
    tag: preset.tags, collection: preset.collections.map(collection => collection.id),
  }
  // OR within a group; AND between groups. Empty groups do not restrict results.
  return (Object.keys(fields) as Facet[]).every(facet => {
    const selected = filters[facet] ?? []
    return !selected.length || selected.some(value => fields[facet].includes(value))
  })
}

export function appliedFilters(groups: readonly FilterGroup[], filters: Filters) {
  return groups.flatMap(group => group.options.filter(option => filters[group.id]?.includes(option.value))
    .map(option => ({ ...option, id: group.id })))
}
