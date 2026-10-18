/** Search and classification metadata shared by every React visual engine. */
export interface PresetDiscoveryMetadata {
  category: string
  tags: readonly string[]
}

/** Authoring fields shared by preset source formats; legacy content may omit them. */
export interface PresetDiscoveryFields {
  category?: string | null
  tags?: readonly string[] | null
}

export interface PresetDiscoverySource extends PresetDiscoveryFields {
  name: string
  description?: string | null
}

function clean(value: string): string {
  return value.trim()
}

/**
 * Produces the same complete metadata shape for every engine, including older
 * preset formats that did not author discovery fields themselves.
 */
export function resolvePresetDiscoveryMetadata(
  source: Pick<PresetDiscoverySource, 'category' | 'tags'>,
  fallbackCategory: string,
  additionalTags: readonly string[] = [],
): PresetDiscoveryMetadata {
  const category = clean(source.category ?? '') || clean(fallbackCategory) || 'uncategorized'
  const seen = new Set<string>()
  const tags = [category, ...(source.tags ?? []), ...additionalTags].flatMap(value => {
    const tag = clean(value)
    if (!tag) return []
    const key = tag.toLowerCase()
    if (seen.has(key)) return []
    seen.add(key)
    return [tag]
  })
  return { category, tags }
}

/** Case-insensitive preset search across its title, copy, category, and tags. */
export function presetMatchesDiscoveryQuery(
  query: string,
  source: PresetDiscoverySource,
): boolean {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  return [source.name, source.description ?? '', source.category ?? '', ...(source.tags ?? [])]
    .some(value => value.toLowerCase().includes(needle))
}
