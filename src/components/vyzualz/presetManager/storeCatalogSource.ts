import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase, supabaseConfigured } from '../../../lib/supabase'
import type { StoreArtSpec, StoreCatalog, StoreItem, StoreMotif, StorePackPreset } from './storeCatalog'

// The Store catalog as the database holds it: published products, the presets inside each pack, and the version of each release. Read-only.
// Migration 0043 lets any client read these rows and hides everything private (storage paths, hashes, signing keys), so nothing here can
// reach a download. Written against raw rows so it can be tested without a database.

const db = supabase as unknown as SupabaseClient

export interface ProductRow {
  id: string
  kind: 'preset' | 'pack'
  preset_id: string | null
  pack_id: string | null
  current_release_id: string | null
  slug: string
  title: string
  subtitle: string | null
  description: string | null
  tags: string[] | null
  sort_order: number
  published_at: string | null
}
export interface PackItemRow { pack_id: string; preset_id: string; release_id: string; position: number }
export interface PresetRow { id: string; engine_id: string; preset_key: string; name: string }
export interface ReleaseRow { id: string; preset_id: string; version: string }

export interface StoreCatalogRows {
  products: readonly ProductRow[]
  packItems: readonly PackItemRow[]
  presets: readonly PresetRow[]
  releases: readonly ReleaseRow[]
}

const ENGINE_NAMES: Readonly<Record<string, string>> = {
  cinema2: 'Cinema 2.0',
  oscilloscope: 'Sound Drawing',
  canvas: 'CANVAS',
  laserDmx: 'LaserDMX',
  pixGrid: 'PixGrid',
  headliner: 'HEADLINER',
}

export function storeEngineName(engineId: string): string {
  return ENGINE_NAMES[engineId] ?? engineId
}

const MOTIFS: readonly StoreMotif[] = ['triangle', 'ring', 'crystal', 'cube', 'peaks', 'waves', 'frame', 'noise']

function hashString(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

/** Placeholder art that is the same every time for the same key, since a catalog row carries no image yet. */
export function storeArtFor(key: string): StoreArtSpec {
  const hash = hashString(key)
  return { motif: MOTIFS[hash % MOTIFS.length] ?? 'ring', hue: hash % 360, accentHue: (hash >>> 9) % 360 }
}

export function buildStoreCatalog(rows: StoreCatalogRows): StoreCatalog {
  const presetsById = new Map(rows.presets.map(preset => [preset.id, preset]))
  const releasesById = new Map(rows.releases.map(release => [release.id, release]))
  const products = [...rows.products].sort((a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title))

  const items = products.flatMap((product): StoreItem[] => {
    const released = (product.published_at ?? new Date(0).toISOString()).slice(0, 10)
    const tags = product.tags ?? []
    const base = {
      id: product.id,
      name: product.title,
      description: product.description ?? '',
      priceCents: 0,
      releasedAt: released,
      art: storeArtFor(product.slug),
    }

    if (product.kind === 'pack') {
      const members = rows.packItems.filter(item => item.pack_id === product.pack_id).sort((a, b) => a.position - b.position)
      if (members.length === 0) return []
      const contents = members.map((member): StorePackPreset => {
        const preset = presetsById.get(member.preset_id)
        return {
          id: `${product.id}:${member.position}`,
          name: preset?.name ?? 'Preset',
          description: '',
          engine: preset ? storeEngineName(preset.engine_id) : 'Unknown engine',
          art: storeArtFor(preset?.preset_key ?? member.preset_id),
        }
      })
      return [{
        ...base,
        kind: 'pack',
        subtitle: product.subtitle ?? 'Expansion Pack',
        engines: [...new Set(contents.map(preset => preset.engine))],
        presetCount: contents.length,
        bannerRank: product.sort_order,
        featuredRank: product.sort_order,
        details: { tags },
        contents,
      }]
    }

    const preset = product.preset_id ? presetsById.get(product.preset_id) : undefined
    const release = product.current_release_id ? releasesById.get(product.current_release_id) : undefined
    return [{
      ...base,
      kind: 'preset',
      subtitle: product.subtitle ?? 'Preset',
      engines: [preset ? storeEngineName(preset.engine_id) : 'Unknown engine'],
      details: { tags, version: release?.version },
    }]
  })

  return { items }
}

async function select<T>(query: PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

/** Reads every published product and what it needs to be shown. Throws when any read fails. */
export async function loadStoreCatalogRows(client: SupabaseClient = db): Promise<StoreCatalogRows> {
  const products = await select<ProductRow>(client.from('store_products')
    .select('id, kind, preset_id, pack_id, current_release_id, slug, title, subtitle, description, tags, sort_order, published_at')
    .eq('status', 'published'))
  const packIds = products.flatMap(product => product.pack_id ? [product.pack_id] : [])
  const packItems = packIds.length > 0
    ? await select<PackItemRow>(client.from('preset_pack_items').select('pack_id, preset_id, release_id, position').in('pack_id', packIds))
    : []
  const presetIds = [...new Set([
    ...products.flatMap(product => product.preset_id ? [product.preset_id] : []),
    ...packItems.map(item => item.preset_id),
  ])]
  const releaseIds = [...new Set(products.flatMap(product => product.current_release_id ? [product.current_release_id] : []))]
  const [presets, releases] = await Promise.all([
    presetIds.length > 0 ? select<PresetRow>(client.from('presets').select('id, engine_id, preset_key, name').in('id', presetIds)) : [],
    releaseIds.length > 0 ? select<ReleaseRow>(client.from('preset_releases').select('id, preset_id, version').in('id', releaseIds)) : [],
  ])
  return { products, packItems, presets, releases }
}

export type StoreCatalogSource =
  | { status: 'loading' }
  | { status: 'database'; catalog: StoreCatalog }
  /** `reason` says why the sample catalog is shown instead. */
  | { status: 'sample'; reason: string }

/** The catalog to show: the database's published products, or a stated reason to fall back to the sample catalog. */
export function useStoreCatalogSource(load: () => Promise<StoreCatalogRows> = loadStoreCatalogRows): StoreCatalogSource {
  const [source, setSource] = useState<StoreCatalogSource>(supabaseConfigured ? { status: 'loading' } : { status: 'sample', reason: 'Supabase is not configured.' })

  useEffect(() => {
    if (!supabaseConfigured) return
    let cancelled = false
    load().then(rows => {
      if (cancelled) return
      const catalog = buildStoreCatalog(rows)
      setSource(catalog.items.length > 0
        ? { status: 'database', catalog }
        : { status: 'sample', reason: 'No published products yet.' })
    }).catch(() => {
      if (!cancelled) setSource({ status: 'sample', reason: 'The store could not be loaded.' })
    })
    return () => { cancelled = true }
  }, [load])

  return source
}
