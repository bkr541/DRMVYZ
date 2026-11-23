import { presetMatchesDiscoveryQuery } from '../presetDiscovery'

type FacetDefinition = { id: string; label: string; options: readonly string[]; any?: string; single?: boolean; allSelected?: boolean }

export const FILTER_GROUPS = [
  { id: 'text', label: 'Search in', options: ['Name', 'Description', 'Engine', 'Category', 'Tags', 'Author'], any: 'All searchable fields', single: true },
  { id: 'engine', label: 'Engine', options: ['Cinema 2.0', 'Sound Drawing', 'CANVAS', 'LaserDMX', 'PixGrid', 'HEADLINER'], any: 'Any engine', single: true },
  { id: 'source', label: 'Source', options: ['System', 'User'], any: 'All sources', single: true },
  { id: 'category', label: 'Category', options: ['Architecture', 'Light & Laser', 'Objects', 'Generative', 'Media Deck', 'Camera Effects'] },
  { id: 'tag', label: 'Tags', options: ['Laser', 'Night', 'Mechanical', 'Installation', 'Geometric', 'Live Camera', 'House', 'Rhythmic'] },
  { id: 'author', label: 'Author', options: ['STAGELESS', 'DVYDRM', 'You'] },
  { id: 'capability', label: 'Visual capabilities', options: ['3D Environment', 'Camera Motion', 'User Media'], allSelected: true },
  { id: 'audio', label: 'Audio capabilities', options: ['Audio Reactive', 'Beat Sync', 'Section Aware'], allSelected: true },
  { id: 'type', label: 'Preset type', options: ['Built-in', 'Custom'] },
  { id: 'favorite', label: 'Favorites', options: ['Favorites only', 'Not favorited'], single: true },
  { id: 'personal-tag', label: 'My tags', options: ['Opener', 'Warmup', 'Late Night'] },
  { id: 'collection', label: 'Collections', options: ['Demo Set', 'Club Set', 'My Visuals', 'No collection'] },
  { id: 'pack', label: 'Preset pack', options: ['Cinema 2.0 Starters', 'No pack'] },
  { id: 'created', label: 'Year added', options: ['2026', '2025', 'No date recorded'] },
  { id: 'updated', label: 'Year updated', options: ['2026', '2025', 'No date recorded'] },
] as const satisfies readonly FacetDefinition[]

export type Facet = typeof FILTER_GROUPS[number]['id']
export type Filters = Partial<Record<Facet, string[]>>

const DEFAULT_ENGINE = 'Cinema 2.0'
export const DEFAULT_FILTERS: Filters = { engine: ['cinema-2.0'], source: ['system'] }
export const QUICK_TAGS = ['Laser', 'Night', 'Mechanical', 'Installation']
export const TOKEN_SUGGESTIONS = ['tag:laser', 'tag:night', 'category:architecture']

export function tokenValue(label: string): string {
  return label.toLowerCase().trim().replaceAll(' & ', ' ').replace(/\s+/g, '-')
}

interface SamplePreset {
  id: string
  artworkId: string
  name: string
  description: string
  fields: Partial<Record<Exclude<Facet, 'text'>, readonly string[]>>
}

interface SampleOptions {
  engine?: string
  source?: string
  author?: string
  capability?: string[]
  audio?: string[]
  type?: string
  favorite?: boolean
  personalTags?: string[]
  collections?: string[]
  pack?: string
  created?: string
  updated?: string
  artworkId?: string
}

function sample(id: string, name: string, description: string, category: string, tags: string[], options: SampleOptions = {}): SamplePreset {
  const engine = options.engine ?? DEFAULT_ENGINE
  return {
    id,
    artworkId: options.artworkId ?? (engine === DEFAULT_ENGINE ? `drmvyz.cinema2.${id}` : id),
    name,
    description,
    fields: {
      engine: [engine],
      source: [options.source ?? 'System'],
      category: [category],
      tag: tags,
      author: options.author ? [options.author] : [],
      capability: options.capability ?? [],
      audio: options.audio ?? [],
      type: [options.type ?? 'Built-in'],
      favorite: [options.favorite ? 'Favorites only' : 'Not favorited'],
      'personal-tag': options.personalTags ?? [],
      collection: options.collections ?? ['No collection'],
      pack: [options.pack ?? 'No pack'],
      created: [options.created ?? 'No date recorded'],
      updated: [options.updated ?? 'No date recorded'],
    },
  }
}

export const SAMPLE_PRESETS = [
  sample('afterhours', 'Afterhours', 'Moving laser fans cut through nightclub haze.', 'Light & Laser', ['Laser', 'Night'], {
    author: 'STAGELESS', capability: ['3D Environment', 'Camera Motion'], audio: ['Audio Reactive', 'Beat Sync', 'Section Aware'],
    favorite: true, personalTags: ['Late Night'], collections: ['Club Set'], pack: 'Cinema 2.0 Starters', created: '2025', updated: '2026',
  }),
  sample('ancient-machine', 'Ancient Machine', 'A rotating mechanical assembly built around rings.', 'Objects', ['Mechanical'], {
    capability: ['3D Environment', 'Camera Motion'], audio: ['Audio Reactive', 'Section Aware'],
  }),
  sample('atl-hoe', 'ATL HOE', 'An Atlanta skyline with glowing nighttime signage.', 'Architecture', ['Night'], {
    capability: ['3D Environment', 'Camera Motion', 'User Media'], audio: ['Audio Reactive'],
  }),
  sample('atmosphere-reference', 'Crystalized', 'Illuminated crystals suspended in a dark space.', 'Objects', ['Installation'], { capability: ['3D Environment'] }),
  sample('blockshift', 'Blockshift', 'A field of floating cubes with luminous edges.', 'Architecture', ['Mechanical'], {
    author: 'DVYDRM', capability: ['3D Environment', 'Camera Motion'], audio: ['Audio Reactive', 'Beat Sync'], created: '2026', updated: '2026',
  }),
  sample('canopy', 'Canopy', 'Rows of fixtures sweep beneath an overhead rig.', 'Light & Laser', ['Installation'], {
    capability: ['3D Environment', 'Camera Motion'], audio: ['Audio Reactive', 'Beat Sync', 'Section Aware'],
  }),
  sample('cathedral', 'Cathedral', 'A long corridor lined with columns and shafts of light.', 'Architecture', ['Night', 'Installation'], {
    capability: ['3D Environment', 'Camera Motion'], audio: ['Audio Reactive', 'Section Aware'], pack: 'Cinema 2.0 Starters',
  }),
  sample('chamber', 'Chamber', 'A circular chamber with metallic walls.', 'Architecture', ['Mechanical'], { author: 'STAGELESS', capability: ['3D Environment', 'Camera Motion'] }),
  sample('constellation', 'Constellation', 'Colorful points drift in a dark environment.', 'Objects', ['Night'], { capability: ['3D Environment'] }),
  sample('crate-bass-sigil', 'Bass Sigil', 'Blue particles trace a sigil in response to bass.', 'Light & Laser', ['Laser'], { capability: ['3D Environment'], audio: ['Audio Reactive', 'Beat Sync'] }),
  sample('opening-set', 'Opening Set', 'Laser sweeps for the opening of a live set.', 'Light & Laser', ['Laser', 'Night'], {
    artworkId: 'drmvyz.cinema2.afterhours', source: 'User', author: 'You', type: 'Custom', favorite: true,
    capability: ['3D Environment', 'Camera Motion'], audio: ['Audio Reactive', 'Beat Sync'],
    personalTags: ['Opener'], collections: ['Demo Set', 'Club Set'], created: '2026', updated: '2026',
  }),
  sample('warmup-set', 'Warmup Set', 'A slower variation on the floating cube scene.', 'Architecture', ['Mechanical'], {
    artworkId: 'drmvyz.cinema2.blockshift', source: 'User', author: 'You', type: 'Custom',
    capability: ['3D Environment'], audio: ['Audio Reactive'], personalTags: ['Warmup'], collections: ['Demo Set'], created: '2025', updated: '2026',
  }),
  sample('low-light', 'Low Light', 'A private lighting preset for low-light sets.', 'Light & Laser', ['Installation'], {
    artworkId: 'drmvyz.cinema2.canopy', source: 'User', capability: ['3D Environment'], personalTags: ['Late Night'], created: '2025', updated: '2025',
  }),
  sample('signal-trace', 'Signal Trace', 'An oscilloscope trace driven by the input signal.', 'Generative', ['Geometric'], { engine: 'Sound Drawing', audio: ['Audio Reactive'] }),
  sample('color-field', 'Color Field', 'A reactive geometric field with a media layer.', 'Generative', ['Geometric'], { engine: 'CANVAS', capability: ['User Media'], audio: ['Audio Reactive'] }),
  sample('house-sweep', 'House Sweep', 'A rhythmic beam sequence for house sets.', 'Light & Laser', ['Laser', 'House', 'Rhythmic'], { engine: 'LaserDMX', audio: ['Audio Reactive', 'Beat Sync', 'Section Aware'] }),
  sample('pixel-loop', 'Pixel Loop', 'A looping image deck for LED matrices.', 'Media Deck', ['Geometric'], { engine: 'PixGrid', capability: ['User Media'] }),
  sample('camera-trails', 'Camera Trails', 'A trail effect on a live camera feed.', 'Camera Effects', ['Live Camera'], { engine: 'HEADLINER' }),
]

export function toggleValue(values: readonly string[], value: string): string[] {
  return values.includes(value) ? values.filter(item => item !== value) : [...values, value]
}

export function parseSearch(query: string, tokensEnabled: boolean) {
  if (!tokensEnabled) return { text: query.trim(), filters: {} as Filters }
  const text: string[] = []
  const filters: Filters = {}
  for (const word of query.trim().split(/\s+/)) {
    const [key, value] = word.toLowerCase().split(':', 2)
    const group = FILTER_GROUPS.find(({ id }) => id === key)
    if (!group || !value || (value !== 'any' && !group.options.some(label => tokenValue(label) === value))) {
      text.push(word)
      continue
    }
    const values = filters[group.id] ?? []
    filters[group.id] = value === 'any' ? [] : 'single' in group ? [value] : [...new Set([...values, value])]
  }
  return { text: text.join(' '), filters }
}

export function matchesPreset(preset: SamplePreset, query: string, filters: Filters): boolean {
  const category = preset.fields.category?.[0]
  const tags = preset.fields.tag
  const author = preset.fields.author?.[0]
  const engine = preset.fields.engine?.[0]
  const searchField = filters.text?.[0]
  const fields: Record<string, readonly string[]> = {
    name: [preset.name], description: [preset.description], category: category ? [category] : [],
    tags: tags ?? [], author: author ? [author] : [], engine: engine ? [engine] : [],
  }
  const needle = query.toLowerCase()
  const matchesText = searchField
    ? (fields[searchField] ?? []).some(value => value.toLowerCase().includes(needle)) || !needle
    : presetMatchesDiscoveryQuery(query, { name: preset.name, description: preset.description, category, tags })
      || [author, engine].some(value => value?.toLowerCase().includes(needle))
  return matchesText && FILTER_GROUPS.every(group => {
    if (group.id === 'text') return true
    const values = filters[group.id]
    if (!values?.length) return true
    const available = preset.fields[group.id]?.map(tokenValue) ?? []
    return 'allSelected' in group ? values.every(value => available.includes(value)) : values.some(value => available.includes(value))
  })
}
