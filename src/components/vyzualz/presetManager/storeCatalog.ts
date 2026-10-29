export type StoreItemKind = 'pack' | 'preset'
export type StoreMotif = 'triangle' | 'ring' | 'crystal' | 'cube' | 'peaks' | 'waves' | 'frame' | 'noise'
export type StoreSortId = 'featured' | 'newest' | 'priceLow' | 'priceHigh' | 'name'
export type StoreTypeFilter = 'all' | StoreItemKind
export type StorePriceFilter = 'all' | 'free' | 'paid'
export type StoreSectionId = 'packs' | 'popular' | 'free'

/** Generated placeholder artwork: a hue pair and a motif, rendered without any image asset. */
export interface StoreArtSpec {
  motif: StoreMotif
  hue: number
  accentHue: number
}

export interface StorePackPreset {
  id: string
  name: string
  description: string
  engine: string
  art: StoreArtSpec
}

export interface StoreItemDetails {
  author: string
  version: string
  category: string
  tags: readonly string[]
  sizeMb: number
  license: string
}

export interface StoreItem {
  id: string
  kind: StoreItemKind
  name: string
  /** Short label under the title, e.g. "Expansion Pack" or "Preset". */
  subtitle: string
  description: string
  engines: readonly string[]
  presetCount?: number
  /** Whole cents. 0 means free. */
  priceCents: number
  isNew?: boolean
  /** Shown in the hero banner, in this order. */
  bannerRank?: number
  /** Listed under Featured Packs / Popular Presets, in this order. */
  featuredRank?: number
  popularRank?: number
  /** ISO date, used only for the "Newest" sort. */
  releasedAt: string
  art: StoreArtSpec
  details: StoreItemDetails
  /** The preset records inside a pack; absent for single presets. */
  contents?: readonly StorePackPreset[]
}

type StoreItemBase = Omit<StoreItem, 'details' | 'contents'>

export interface StoreCatalog {
  items: readonly StoreItem[]
}

/**
 * Read-only store catalog source. The Store UI takes a catalog as data, so a
 * Supabase-backed source can replace this local sample without UI changes.
 */
const BASE_ITEMS: readonly StoreItemBase[] = [
  {
    id: 'pack-midnight-signals', kind: 'pack', name: 'Midnight Signals', subtitle: 'Expansion Pack',
    description: 'Atmospheric audiovisual presets for the late hours. Neon lightscapes, analog textures and ethereal motion.',
    engines: ['Cinema 2.0', 'PixGrid'], presetCount: 8, priceCents: 2400, bannerRank: 1, featuredRank: 1,
    releasedAt: '2026-10-20', art: { motif: 'peaks', hue: 214, accentHue: 196 },
  },
  {
    id: 'pack-lumen-vault', kind: 'pack', name: 'Lumen Vault', subtitle: 'Expansion Pack',
    description: 'Cut-glass geometry lit from within. Volumetric beams, ember glare and slow, heavy camera moves.',
    engines: ['Cinema 2.0'], presetCount: 12, priceCents: 3200, bannerRank: 2, featuredRank: 2,
    releasedAt: '2026-10-12', art: { motif: 'cube', hue: 18, accentHue: 205 },
  },
  {
    id: 'pack-static-bloom', kind: 'pack', name: 'Static Bloom', subtitle: 'Expansion Pack',
    description: 'Grainy broadcast ghosts and flowering signal noise for high-contrast, low-light sets.',
    engines: ['CANVAS', 'PixGrid'], presetCount: 6, priceCents: 1800, bannerRank: 3, featuredRank: 3,
    releasedAt: '2026-09-30', art: { motif: 'noise', hue: 280, accentHue: 320 },
  },
  {
    id: 'pack-afterglow-district', kind: 'pack', name: 'Afterglow District', subtitle: 'Expansion Pack',
    description: 'Rain-slick streets and sodium haze. A neon-noir city block that follows the beat.',
    engines: ['Cinema 2.0', 'LaserDMX'], presetCount: 10, priceCents: 2800, bannerRank: 4, featuredRank: 4,
    releasedAt: '2026-09-14', art: { motif: 'frame', hue: 330, accentHue: 190 },
  },
  {
    id: 'preset-prism-drift', kind: 'preset', name: 'Prism Drift', subtitle: 'Preset',
    description: 'Refracted light and fluid motion for organic visuals.',
    engines: ['Cinema 2.0'], priceCents: 700, popularRank: 1,
    releasedAt: '2026-10-18', art: { motif: 'crystal', hue: 200, accentHue: 300 },
  },
  {
    id: 'preset-ghost-frequency', kind: 'preset', name: 'Ghost Frequency', subtitle: 'Preset',
    description: 'Haunting textures and spectral rhythms.',
    engines: ['PixGrid'], priceCents: 900, isNew: true, popularRank: 2,
    releasedAt: '2026-10-27', art: { motif: 'ring', hue: 215, accentHue: 220 },
  },
  {
    id: 'preset-monochrome-pulse', kind: 'preset', name: 'Monochrome Pulse', subtitle: 'Preset',
    description: 'Minimal forms. Maximum impact.',
    engines: ['Cinema 2.0'], priceCents: 0, popularRank: 3,
    releasedAt: '2026-10-05', art: { motif: 'ring', hue: 0, accentHue: 0 },
  },
  {
    id: 'preset-surface-noise', kind: 'preset', name: 'Surface Noise', subtitle: 'Preset',
    description: 'Slow-moving metallic grain with a soft specular sweep.',
    engines: ['CANVAS'], priceCents: 0,
    releasedAt: '2026-08-22', art: { motif: 'waves', hue: 225, accentHue: 250 },
  },
  {
    id: 'preset-neon-flats', kind: 'preset', name: 'Neon Flats', subtitle: 'Preset',
    description: 'Flat, saturated neon frames that pulse with the kick.',
    engines: ['PixGrid'], priceCents: 0,
    releasedAt: '2026-08-10', art: { motif: 'frame', hue: 275, accentHue: 180 },
  },
  {
    id: 'preset-echo-field', kind: 'preset', name: 'Echo Field', subtitle: 'Preset',
    description: 'Concentric echoes that trail the lead melody.',
    engines: ['Sound Drawing'], priceCents: 0,
    releasedAt: '2026-07-28', art: { motif: 'ring', hue: 210, accentHue: 190 },
  },
]

const STANDARD_LICENSE = 'Personal & commercial performance use'

const ITEM_DETAILS: Readonly<Record<string, StoreItemDetails>> = {
  'pack-midnight-signals': { author: 'DRMVYZ Studio', version: '1.2.0', category: 'Cinematic', tags: ['neon', 'atmospheric', 'night'], sizeMb: 184, license: STANDARD_LICENSE },
  'pack-lumen-vault': { author: 'DRMVYZ Studio', version: '1.0.3', category: 'Cinematic', tags: ['glass', 'volumetric', 'architectural'], sizeMb: 266, license: STANDARD_LICENSE },
  'pack-static-bloom': { author: 'Signal Garden', version: '1.1.0', category: 'Abstract', tags: ['noise', 'analog', 'texture'], sizeMb: 92, license: STANDARD_LICENSE },
  'pack-afterglow-district': { author: 'North Alley Co.', version: '2.0.1', category: 'Cinematic', tags: ['city', 'neon', 'laser'], sizeMb: 231, license: STANDARD_LICENSE },
  'preset-prism-drift': { author: 'DRMVYZ Studio', version: '1.0.1', category: 'Cinematic', tags: ['refraction', 'fluid', 'organic'], sizeMb: 21, license: STANDARD_LICENSE },
  'preset-ghost-frequency': { author: 'Signal Garden', version: '1.0.0', category: 'Pixel Art', tags: ['spectral', 'texture', 'haunting'], sizeMb: 14, license: STANDARD_LICENSE },
  'preset-monochrome-pulse': { author: 'DRMVYZ Studio', version: '1.3.0', category: 'Cinematic', tags: ['minimal', 'monochrome', 'pulse'], sizeMb: 9, license: STANDARD_LICENSE },
  'preset-surface-noise': { author: 'Signal Garden', version: '1.0.2', category: 'Abstract', tags: ['grain', 'metallic', 'slow'], sizeMb: 6, license: STANDARD_LICENSE },
  'preset-neon-flats': { author: 'North Alley Co.', version: '1.0.0', category: 'Pixel Art', tags: ['flat', 'neon', 'kick'], sizeMb: 5, license: STANDARD_LICENSE },
  'preset-echo-field': { author: 'DRMVYZ Studio', version: '1.1.0', category: 'Sound Drawing', tags: ['echo', 'concentric', 'melody'], sizeMb: 4, license: STANDARD_LICENSE },
}

const PACK_MOTIFS: readonly StoreMotif[] = ['triangle', 'ring', 'crystal', 'cube', 'peaks', 'waves', 'frame', 'noise']

/** [name, description, engine] per preset record; art is derived from the pack's own hues. */
const PACK_RECORDS: Readonly<Record<string, readonly (readonly [string, string, string])[]>> = {
  'pack-midnight-signals': [
    ['Moonlit Static', 'Pale lunar haze over a field of slow analog grain.', 'Cinema 2.0'],
    ['Harbor Lights', 'Reflected dock lights ripple across black water.', 'Cinema 2.0'],
    ['Sleepless Grid', 'A city grid that never quite goes dark.', 'Cinema 2.0'],
    ['Tidal Neon', 'Neon tubes swell and recede with the low end.', 'Cinema 2.0'],
    ['Low Orbit', 'A slow camera drift above a glowing horizon.', 'Cinema 2.0'],
    ['Obsidian Rain', 'Glossy dark columns of falling light.', 'PixGrid'],
    ['Afterimage', 'Trails of color that linger after every hit.', 'PixGrid'],
    ['Signal Fade', 'A signal that dissolves into pixel dust.', 'PixGrid'],
  ],
  'pack-lumen-vault': [
    ['Cut Glass', 'Faceted glass lit from behind.', 'Cinema 2.0'],
    ['Ember Hall', 'A long hall of drifting embers.', 'Cinema 2.0'],
    ['Prism Atrium', 'Light splits into color across a tall atrium.', 'Cinema 2.0'],
    ['Gilded Beam', 'A single warm shaft through heavy fog.', 'Cinema 2.0'],
    ['Slow Refraction', 'Bending light with a patient camera.', 'Cinema 2.0'],
    ['Vault Door', 'A circular door opening onto cold light.', 'Cinema 2.0'],
    ['Lantern Court', 'Hanging lanterns pulse on the downbeat.', 'Cinema 2.0'],
    ['Amber Drift', 'Slow amber particles in a still room.', 'Cinema 2.0'],
    ['Crown Facet', 'A rotating crown of crystal edges.', 'Cinema 2.0'],
    ['Quiet Chandelier', 'Restrained light that swells on the chorus.', 'Cinema 2.0'],
    ['Shaft Light', 'Volumetric shafts that follow the melody.', 'Cinema 2.0'],
    ['Reliquary Glow', 'A glowing relic in a dark stone chamber.', 'Cinema 2.0'],
  ],
  'pack-static-bloom': [
    ['Snowfall Tape', 'Worn tape snow with bright dropouts.', 'CANVAS'],
    ['Ghost Channel', 'A channel between channels, faintly alive.', 'CANVAS'],
    ['Bloom Scan', 'Scanlines flower into soft color.', 'CANVAS'],
    ['Dead Air', 'Quiet static that tightens before the drop.', 'PixGrid'],
    ['Tracking Error', 'Tape tracking glitches on every snare.', 'PixGrid'],
    ['Phosphor Garden', 'Glowing phosphor shapes growing in rows.', 'PixGrid'],
  ],
  'pack-afterglow-district': [
    ['Sodium Haze', 'Orange street haze with soft halos.', 'Cinema 2.0'],
    ['Wet Asphalt', 'Neon puddles that shiver with the bass.', 'Cinema 2.0'],
    ['Crosswalk', 'Signal lights that count the bars.', 'Cinema 2.0'],
    ['Rooftop Signs', 'Buzzing signs above a dark skyline.', 'Cinema 2.0'],
    ['Night Bus', 'A lit bus crossing the frame in the rain.', 'Cinema 2.0'],
    ['Neon Alley', 'A narrow alley of flickering color.', 'Cinema 2.0'],
    ['Late Diner', 'Warm window light and cold street blue.', 'Cinema 2.0'],
    ['Underpass', 'Echoing light under a concrete span.', 'Cinema 2.0'],
    ['Laser Skyline', 'Beams sweep a distant skyline.', 'LaserDMX'],
    ['Beam Matrix', 'A crossing matrix of colored beams.', 'LaserDMX'],
  ],
}

function withDetails(item: StoreItemBase): StoreItem {
  const details = ITEM_DETAILS[item.id]
  if (!details) throw new Error(`Store item "${item.id}" has no details.`)
  const records = PACK_RECORDS[item.id]
  if (!records) return Object.freeze({ ...item, details })
  const contents = records.map(([name, description, engine], index): StorePackPreset => ({
    id: `${item.id}:${index + 1}`,
    name,
    description,
    engine,
    art: {
      motif: PACK_MOTIFS[(index + PACK_MOTIFS.indexOf(item.art.motif)) % PACK_MOTIFS.length] ?? item.art.motif,
      hue: (item.art.hue + index * 11) % 360,
      accentHue: (item.art.accentHue + index * 17) % 360,
    },
  }))
  return Object.freeze({ ...item, details, contents: Object.freeze(contents), presetCount: contents.length })
}

export const MOCK_STORE_CATALOG: StoreCatalog = Object.freeze({
  items: Object.freeze(BASE_ITEMS.map(withDetails)),
})

export function findStoreItem(catalog: StoreCatalog, id: string): StoreItem | null {
  return catalog.items.find(item => item.id === id) ?? null
}

/** "Oct 20, 2026", independent of the viewer's time zone. */
export function formatStoreDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

export interface StoreQuery {
  text: string
  type: StoreTypeFilter
  price: StorePriceFilter
  /** 'all' or an engine name from the catalog. */
  engine: string
  sort: StoreSortId
}

export const DEFAULT_STORE_QUERY: StoreQuery = Object.freeze({
  text: '', type: 'all', price: 'all', engine: 'all', sort: 'featured',
})

export function formatStorePrice(priceCents: number): string {
  return priceCents === 0 ? 'FREE' : `$${(priceCents / 100).toFixed(2)}`
}

export function storeEngineNames(catalog: StoreCatalog): string[] {
  return Array.from(new Set(catalog.items.flatMap(item => item.engines))).sort((a, b) => a.localeCompare(b))
}

/** True once any search, filter or non-default sort has narrowed the home view to a flat result list. */
export function isStoreQueryActive(query: StoreQuery): boolean {
  return query.text.trim() !== '' || query.type !== 'all' || query.price !== 'all' || query.engine !== 'all'
}

function sortItems(items: readonly StoreItem[], sort: StoreSortId, featuredOrder: (item: StoreItem) => number): StoreItem[] {
  const next = [...items]
  switch (sort) {
    case 'newest': return next.sort((a, b) => b.releasedAt.localeCompare(a.releasedAt))
    case 'priceLow': return next.sort((a, b) => a.priceCents - b.priceCents || a.name.localeCompare(b.name))
    case 'priceHigh': return next.sort((a, b) => b.priceCents - a.priceCents || a.name.localeCompare(b.name))
    case 'name': return next.sort((a, b) => a.name.localeCompare(b.name))
    default: return next.sort((a, b) => featuredOrder(a) - featuredOrder(b))
  }
}

const rank = (value: number | undefined) => value ?? Number.MAX_SAFE_INTEGER

export function matchStoreItems(catalog: StoreCatalog, query: StoreQuery): StoreItem[] {
  const needle = query.text.trim().toLowerCase()
  const matches = catalog.items.filter(item => {
    if (query.type !== 'all' && item.kind !== query.type) return false
    if (query.price === 'free' && item.priceCents !== 0) return false
    if (query.price === 'paid' && item.priceCents === 0) return false
    if (query.engine !== 'all' && !item.engines.includes(query.engine)) return false
    return !needle || [item.name, item.subtitle, item.description, ...item.engines].some(value => value.toLowerCase().includes(needle))
  })
  return sortItems(matches, query.sort, item => rank(item.featuredRank ?? item.popularRank))
}

export function storeBannerItems(catalog: StoreCatalog): StoreItem[] {
  return catalog.items.filter(item => item.bannerRank !== undefined).sort((a, b) => rank(a.bannerRank) - rank(b.bannerRank))
}

export const STORE_SECTIONS: readonly { id: StoreSectionId; title: string }[] = [
  { id: 'packs', title: 'Featured Packs' },
  { id: 'popular', title: 'Popular Presets' },
  { id: 'free', title: 'Free Presets' },
]

/** Items belonging to one home section, ordered by the active sort (Featured keeps the curated order). */
export function storeSectionItems(catalog: StoreCatalog, section: StoreSectionId, sort: StoreSortId): StoreItem[] {
  if (section === 'packs') {
    return sortItems(catalog.items.filter(item => item.kind === 'pack' && item.featuredRank !== undefined), sort, item => rank(item.featuredRank))
  }
  if (section === 'popular') {
    return sortItems(catalog.items.filter(item => item.kind === 'preset' && item.popularRank !== undefined), sort, item => rank(item.popularRank))
  }
  // Free presets already listed under Popular are not repeated here.
  return sortItems(
    catalog.items.filter(item => item.kind === 'preset' && item.priceCents === 0 && item.popularRank === undefined),
    sort,
    () => 0,
  )
}
