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

// Treat search tokens as literal text, including punctuation in real tags.
function searchTokens(query: string): string[] {
  return query.trim().split(/\s+/).filter(Boolean).map(token => token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
}

function metadataValues(preset: FilterPreset): readonly string[] {
  return [preset.category, ...preset.tags, ...preset.collections.map(collection => collection.name)]
}

/** Only metadata values that explain a hit; don't repeat a category/tag with the same text. */
export function getStudyMatchingValues(preset: FilterPreset, query: string): string[] {
  const patterns = searchTokens(query).map(token => new RegExp(token, 'iu'))
  const seen = new Set<string>()
  return metadataValues(preset).filter(value => {
    const key = value.toLowerCase()
    if (seen.has(key) || !patterns.some(pattern => pattern.test(value))) return false
    seen.add(key)
    return true
  })
}

/** Preserve the original spelling and mark every matching character, including overlapping tokens. */
export function getStudyMatchParts(value: string, query: string): { text: string; matched: boolean }[] {
  const marks = new Uint8Array(value.length)
  for (const token of searchTokens(query)) {
    // A lookahead finds overlapping occurrences without consuming the matched text.
    for (const match of value.matchAll(new RegExp(`(?=(${token}))`, 'giu'))) {
      marks.fill(1, match.index, match.index + match[1].length)
    }
  }
  const parts: { text: string; matched: boolean }[] = []
  for (let start = 0; start < value.length;) {
    let end = start + 1
    while (end < value.length && marks[end] === marks[start]) end++
    parts.push({ text: value.slice(start, end), matched: Boolean(marks[start]) })
    start = end
  }
  return parts
}

/** Smart study only: every typed token must match at least one searchable field.
 * Rank title matches first; preserve the catalog's order within each rank. */
export function searchStudyPresets(presets: readonly FilterPreset[], query: string): FilterPreset[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return [...presets]
  const patterns = searchTokens(query).map(token => new RegExp(token, 'iu'))
  return presets.flatMap(preset => {
    const name = preset.name.toLowerCase()
    const fields = [preset.name, ...metadataValues(preset)]
    if (!patterns.every(pattern => fields.some(field => pattern.test(field)))) return []
    const rank = name === needle ? 0 : name.startsWith(needle) ? 1 : name.includes(needle) ? 2 : 3
    return [{ preset, rank }]
  }).sort((a, b) => a.rank - b.rank).map(result => result.preset)
}
